import dns from 'dns';
import dnsPromises from 'dns/promises';
import net from 'net';
import http from 'http';
import https from 'https';
import { URL } from 'url';

// ---------------------------------------------------------------------------
// Blocked address ranges (IPv4 + IPv6). IPv4-mapped IPv6 is unwrapped first.
// ---------------------------------------------------------------------------
const blocked = new net.BlockList();
const v4: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];
for (const [a, p] of v4) blocked.addSubnet(a, p, 'ipv4');
const v6: Array<[string, number]> = [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001::', 32],
  ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
];
for (const [a, p] of v6) blocked.addSubnet(a, p, 'ipv6');

export function isPrivateIp(ipRaw: string): boolean {
  let ip = ipRaw.trim().toLowerCase();
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);

  // IPv4-mapped / compatible IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) ip = mapped[1];
  else if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(ip)) {
    const [, hi, lo] = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)!;
    const n = (parseInt(hi, 16) << 16) | parseInt(lo, 16);
    ip = [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  const family = net.isIP(ip);
  if (family === 0) return true; // not a valid IP literal -> treat as unsafe
  return blocked.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.corp', '.intranet'];

function assertHostnameAllowed(hostname: string): void {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (h === 'localhost' || BLOCKED_HOST_SUFFIXES.some(s => h.endsWith(s)) || h === 'metadata.google.internal') {
    throw new Error('Access to internal, loopback, or metadata hostnames is forbidden.');
  }
  if (net.isIP(h) && isPrivateIp(h)) {
    throw new Error('Destination IP is a restricted private/loopback network.');
  }
}

/**
 * Validates a URL: http(s) only, no credentials, no internal hostnames, and every
 * resolved address must be public. NOTE: validation alone is not enough (DNS can change
 * between check and use) - safeRequest() re-validates at connection time.
 */
export async function validateSafeUrl(urlStr: string): Promise<{ valid: boolean; normalizedUrl: string; hostname: string }> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error('Invalid URL format');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsed.protocol}. Only http: and https: are allowed.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed.');
  }
  const hostname = parsed.hostname.toLowerCase();
  assertHostnameAllowed(hostname);

  if (!net.isIP(hostname.replace(/^\[|\]$/g, ''))) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await dnsPromises.lookup(hostname, { all: true });
    } catch (err: any) {
      throw new Error(`DNS resolution failed for hostname "${hostname}": ${err.message}`);
    }
    if (addresses.length === 0) throw new Error(`DNS resolution returned no addresses for "${hostname}"`);
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        throw new Error('Resolved destination IP is a restricted private/loopback network.');
      }
    }
  }
  return { valid: true, normalizedUrl: parsed.toString(), hostname };
}

/** Host-only check used for non-URL endpoints (e.g. SMTP host). */
export async function validateSafeHost(host: string): Promise<void> {
  const h = host.trim();
  if (!h) throw new Error('Host is required.');
  assertHostnameAllowed(h);
  if (!net.isIP(h)) {
    const addresses = await dnsPromises.lookup(h, { all: true });
    if (addresses.length === 0 || addresses.some(a => isPrivateIp(a.address))) {
      throw new Error('Host resolves to a restricted private/loopback network.');
    }
  }
}

// DNS lookup that is executed by the socket at CONNECT time and rejects private
// addresses - this closes the DNS-rebinding (TOCTOU) window.
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  (dns.lookup as any)(hostname, { ...(options as object), all: true }, (err: Error | null, addrs: dns.LookupAddress[]) => {
    if (err) return (callback as any)(err);
    const ok = addrs.filter(a => !isPrivateIp(a.address));
    if (ok.length === 0 || ok.length !== addrs.length) {
      return (callback as any)(new Error('Resolved destination IP is a restricted private/loopback network.'));
    }
    if ((options as any)?.all) return (callback as any)(null, ok);
    return (callback as any)(null, ok[0].address, ok[0].family);
  });
};

export interface SafeResponse {
  status: number;
  ok: boolean;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  text(): string;
}

export interface SafeRequestOptions {
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

function requestOnce(url: URL, opts: Required<Omit<SafeRequestOptions, 'maxRedirects'>>): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: opts.method,
      headers: opts.headers,
      lookup: safeLookup,
      timeout: opts.timeoutMs,
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > opts.maxBytes) {
          // keep what we have; stop reading (metadata is always near the top of the page)
          res.destroy();
          return;
        }
        chunks.push(c);
      });
      const finish = () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) });
      res.on('end', finish);
      res.on('close', finish);
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`Request timed out fetching ${url.hostname}`)));
    req.on('error', reject);
    req.end();
  });
}

/**
 * SSRF-safe HTTP client. Every hop (including redirects) is validated BEFORE the
 * request is made, and the connection itself re-validates the resolved IP.
 */
export async function safeRequest(urlStr: string, options: SafeRequestOptions = {}): Promise<SafeResponse> {
  const maxRedirects = options.maxRedirects ?? 5;
  const opts = {
    method: options.method || 'GET',
    headers: { 'User-Agent': 'AffiliateOS-Bot/2.0', ...(options.headers || {}) },
    timeoutMs: options.timeoutMs ?? 8000,
    maxBytes: options.maxBytes ?? 2 * 1024 * 1024,
  } as Required<Omit<SafeRequestOptions, 'maxRedirects'>>;

  let current = (await validateSafeUrl(urlStr)).normalizedUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await requestOnce(new URL(current), opts);
    const loc = res.headers.location;
    if (res.status >= 300 && res.status < 400 && loc) {
      const next = new URL(loc, current).toString();
      current = (await validateSafeUrl(next)).normalizedUrl; // re-validate every hop
      continue;
    }
    return {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      url: current,
      headers: res.headers,
      body: res.body,
      text: () => res.body.toString('utf8'),
    };
  }
  throw new Error('Too many redirects');
}

/** Backwards-compatible alias. */
export const safeFetch = safeRequest;
