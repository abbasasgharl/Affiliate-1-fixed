# Security & reliability fixes

## Deploy checklist (CyberPanel / any VPS)
1. `cp .env.example .env` and fill in at least: `SESSION_SECRET` (`openssl rand -hex 48`),
   `SETUP_TOKEN` (`openssl rand -hex 24`), `BASE_URL`, database settings, `OWNER_EMAIL`.
2. `npm install` (no more `--legacy-peer-deps` needed), `npm run build`.
3. Create tables once: `npx drizzle-kit push` (drizzle-kit is a devDependency).
4. Start with `npm start` (sets NODE_ENV=production and runs through tsx).
5. Put it behind HTTPS (the session cookie is `Secure`). Set `TRUST_PROXY_HOPS` to the number of
   reverse proxies in front of Node (1 for OpenLiteSpeed/nginx; 0 if Node is exposed directly).
6. Open the site, click Admin, create the first administrator with your `SETUP_TOKEN`.
7. In Admin, review every sample program (they are seeded as `needs_review`): replace the placeholder
   link with YOUR approved affiliate link, then set status to `active`.

## What changed
Auth: mandatory SESSION_SECRET; signature verified before DB lookup, DB session required (fail closed);
setup endpoint needs SETUP_TOKEN + is serialised; token only in HttpOnly SameSite=Strict cookie (not in JSON /
localStorage); login lockout + constant-time failure path; 12-char password policy; password hash no longer
returned by /api/auth/me; last-admin/self-delete guards; sessions revoked when a user is removed.
SSRF: new safeRequest() validates every redirect hop and re-checks the resolved IP at connect time;
full IPv4/IPv6 block list incl. IPv4-mapped; SMTP host checked; scrape/health/analyze all use it.
Abuse: rate limits use proxy-verified req.ip; per-click bot/prefetch filtering and 30s dedupe; alert e-mails
throttled; unbounded inputs validated; async errors no longer crash the process.
Web: CSP, HSTS, Permissions-Policy, Origin check on state-changing API calls, HTML-escaping in server pages/e-mails.
Data: SMTP password encrypted at rest and never returned to the browser; IP hashes are keyed HMACs;
only the referrer domain is stored; hard-coded owner e-mail removed; Firebase packages removed (0 prod vulns).
Honesty: nothing is auto-"verified"; AI no longer invents commission/health data; misleading claims removed;
sample programs seeded as needs_review; public API only exposes active programs.
Consent: Google tag and visitor recording load only after the visitor accepts.
SEO: per-program <title>/description/canonical injected server-side; sitemap lists active programs only.
Other: program "delete" archives by default (DELETE ?permanent=true for hard delete); dotenv now loads first;
PORT respected in all modes.

## Not changed (needs a business decision or is a larger feature)
- Real affiliate links / approvals, content, traffic.
- Conversion (sale) tracking via network postbacks.
- Full server-side rendering of page bodies (only meta tags are injected).
- Multi-instance rate limiting (in-memory today; use Redis if you scale out).
- Login UI for password change / MFA.
