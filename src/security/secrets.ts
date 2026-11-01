import crypto from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

function loadSessionSecret(): string {
  const configured = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (configured) {
    if (configured.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 48');
    }
    return configured;
  }
  if (isProduction) {
    throw new Error(
      'SESSION_SECRET is required in production. Generate one with: openssl rand -hex 48'
    );
  }
  // Development only: ephemeral random secret (sessions reset on restart).
  console.warn('[Security] SESSION_SECRET not set - using an ephemeral random secret (development only).');
  return crypto.randomBytes(48).toString('hex');
}

export const SESSION_SECRET = loadSessionSecret();

/** Keyed HMAC (used for IP pseudonymisation; not reversible by brute-forcing the IPv4 space). */
export function hmac(value: string, purpose = 'generic'): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(`${purpose}:${value}`).digest('hex');
}

const ENC_KEY = crypto.createHash('sha256').update(`enc:${SESSION_SECRET}`).digest();

/** AES-256-GCM encryption for secrets stored in the database (e.g. SMTP password). */
export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith('enc:v1:')) return stored; // legacy plaintext value; re-encrypted on next save
  try {
    const [, , ivB64, tagB64, dataB64] = stored.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    console.error('[Security] Could not decrypt stored secret (SESSION_SECRET changed?). Re-enter it in settings.');
    return '';
  }
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = crypto.createHash('sha256').update(a).digest();
  const bb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ab, bb);
}
