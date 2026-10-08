# Security notes

Tracked in issue #30 (code-review security audit).

## Known, accepted risks

- **Grid overwrite via known email (ADR-0001).** Identity is an unverified email, so anyone who has the invite link
  and knows a participant's email can overwrite that participant's grid until the session is locked. Accepted for v1.
- **Tokens appear in request URLs.** Organizer and invite tokens are capability URLs, and `observability` logs request
  URLs. Treat Workers log access as sensitive. Responses on `/o/*`, `/i/*` and `POST /sessions` send `Cache-Control: no-store`
  and `Referrer-Policy: no-referrer`.
- **CSP keeps `'unsafe-inline'`** for scripts/styles because pages are server-rendered with inline blocks. Moving to nonces is a follow-up.

## Limits (enforced in code)

Pick count 1-100 (also a DB trigger, migration 0005); email 254; display name 50; pick 60 chars / 8 words; transcript 5 MB.

## Open / needs Cloudflare config or policy

Rate limiting (WAF rule or Rate Limiting binding, Turnstile on session creation), PII retention/deletion policy and
Privacy/Terms pages, disabling `workers_dev` on prod once a custom domain exists, tracking the `fflate` advisory via `satori`.
