# ADR 0007 — Self-contained employer auth (scrypt + HMAC) over a managed provider

- **Status:** Accepted (2026-06-21)
- **Context:** The employer console was open-access (a disclosed mock). It needed
  real authentication. The obvious option was Supabase Auth, but enabling/seeding
  it depends on the remote project's email-provider configuration (confirmation
  flows, SMTP) we can't fully control or verify under deadline — a risk to a
  working demo two days out.

## Decision

Implement a small, fully self-contained auth (`lib/auth/session.ts`):

- **Passwords:** scrypt-hashed, stored as `scrypt$<salt>$<key>` in
  `employers.password_hash`. A demo employer is seeded by migration.
- **Sessions:** an HMAC-SHA256-signed token `base64url(payload).sig`, where the
  key is derived from the server-only service-role secret. No new env var, no
  external dependency.
- `/api/employer/login` verifies the password and issues a token; protected
  routes (`employer/credentials`, `employer/audit`, `credential/revoke`) call
  `bearer(req)`; the `/employer` page gates on a stored token with a one-click
  seeded demo login.

## Rationale

- **No external provider config** to depend on or break — fully under our control
  and reproducible from migrations.
- Real password hashing (scrypt) + signed, expiring sessions + constant-time
  comparison. Adequate and honest for the scope.

## Consequences

- This is **app-level auth**, not a full IdP: no SSO/SAML, SCIM, MFA, or password
  reset — those are the enterprise roadmap (see the README honesty table).
- The HMAC key is derived from the service-role secret; rotating that secret
  invalidates sessions (acceptable). A dedicated `AUTH_SECRET` is a trivial future
  change.
- Employer reads and revocation are now genuinely access-controlled; the audit log
  records logins.
