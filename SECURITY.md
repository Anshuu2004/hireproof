# Security Policy & Threat Model

HireProof issues cryptographic credentials about real people. We treat the
issuer key, biometric-derived data, and the audit chain as the crown jewels.
This document states the threat model honestly — including what is **not yet**
production-hardened — because an enterprise reviewer should never have to guess.

## Reporting a vulnerability

Email **security@hireproof.app** (or open a private security advisory on the
GitHub repo). Please include reproduction steps and impact. We aim to acknowledge
within 72 hours. Do not file public issues for vulnerabilities.

## Assets we protect

| Asset | Where it lives | If compromised |
|---|---|---|
| Issuer signing key (Ed25519) | env var today, isolated behind a single `Signer` boundary → **KMS/HSM is roadmap** | every credential can be forged |
| Face descriptors (128-D) | pgvector, server-side; never the raw video | biometric exposure; re-identification |
| Audit chain | `audit_log`, hash-chained, server-computed | loss of tamper-evidence / explainability |
| Employer/session data | Supabase Postgres (RLS on, service-role server-side) | data leak |

## Key management — current vs target

The Ed25519 issuer key is the crown jewel (a leak forges every credential), so we
state its handling plainly. **Current = honest prototype posture; target = what
production requires.** The live KMS/HSM provider is **roadmap, not yet wired** —
but the architecture around it (a single signer boundary + key rotation) is in
place today, so the remaining work is wiring one module, not a refactor.

| Aspect | Current | Target (roadmap) |
|---|---|---|
| Key storage | Ed25519 private key in an env var (`ISSUER_PRIVATE_KEY_HEX`), Vercel-encrypted at rest | KMS/HSM-held key — never leaves the HSM (AWS KMS added Ed25519 / `ECC_NIST_EDWARDS25519` in Nov 2025; sign via `ED25519_SHA_512`, `MessageType: RAW`) |
| Signing path | **isolated behind one `Signer` boundary** ([lib/credential/signer.ts](lib/credential/signer.ts)): an `EnvSigner` reads the key lazily, only when signing | swap in the `KmsSigner` (labelled stub today) — `kms:Sign`, JWS assembled around the returned signature — a one-file change, no call sites move |
| Key exposure surface | the private key is needed **only** for issuance; verification (`/v`, `did.json`, `/api/credential-status`) uses public keys alone, so a verify-only deploy never holds the secret | unchanged — least secret, least surface |
| Rotation | **supported**: did:web publishes the active key + any `ISSUER_RETIRED_PUBLIC_KEYS`; a credential verifies against *any* published key, so bumping `ISSUER_KEY_ID` and retiring the old public key keeps live 180-day credentials valid | hardware-backed keys with the same `kid`-versioned did:web rotation |
| Access control | deploy-environment access | IAM least-privilege + MFA on the signer role |
| Key-use audit | none | KMS / CloudTrail usage logs |

**Honest note:** wiring KMS is *not* a drop-in at the provider level — KMS cannot
import an existing Ed25519 private key, so it needs a fresh KMS key and a did:web
rotation. The point of the `Signer` boundary + rotation support above is that
HireProof can now *do* that rotation; until the `KmsSigner` is wired, the active
key is still an env var (see T1).

## Threat model

### T1 — Credential forgery
A forged or altered credential must never verify.
- **Mitigation:** every credential is an EdDSA (Ed25519) JWT-VC. Verification
  uses the public key alone (`/.well-known/did.json`, did:web). Any change to the
  payload breaks the signature. Demonstrated by `npm run verify:demo` (mint →
  verify → tamper → reject) and exercised in CI on every push.
- **Residual risk (disclosed):** the active issuer **private key still lives in an
  environment variable** (`ISSUER_PRIVATE_KEY_HEX`). A leaked env var forges all
  credentials. We have reduced the blast radius — the key is isolated behind one
  `Signer` boundary, absent from all verify-only surfaces, and key **rotation is
  supported** (did:web publishes active + retired keys; see the table above) — but
  the key is still software-held. **Production requires a KMS/HSM-held key**, i.e.
  wiring the labelled `KmsSigner` stub; this is the top hardening item
  (see [docs/adr/0002](docs/adr/0002-single-jose-jwt-vc.md) and the roadmap).

### T2 — Audit-log tampering / repudiation
An employer or operator must not be able to silently rewrite history.
- **Mitigation:** `audit_log` is hash-chained. The chain is computed
  **server-side in a Postgres `BEFORE INSERT` trigger** over the **full canonical
  row** (seq, id, session, event_type, input_hash, output, model/prompt version,
  timestamp) — not just one field — under a transaction-scoped advisory lock, so
  concurrent appends cannot fork the chain. Integrity is re-checkable at any time
  with `select * from verify_audit_chain()`.
- **Note:** this protects against in-place edits/reordering within the DB. It is
  **not** an external anchor (e.g. a public notarization); cross-org
  non-repudiation via periodic root publication is roadmap.

### T3 — Presentation / injection attack on liveness (spoofing a human)
A deepfake or replayed video must not pass as a live human.
- **Mitigation (and honest scope):** HireProof performs **active
  challenge-response** liveness (server-issued randomized actions + a spoken
  nonce) — anti-spoof, defense-in-depth, with no emotion/affect inference (EU AI
  Act Art 5(1)(f)). It is **NOT** a certified Presentation Attack Detection
  system. We **do not** claim ISO/IEC 30107-3 certification or to out-detect
  dedicated vendors (iProov, Incode). For high-assurance deployments, a certified
  PAD provider is the intended swap-in behind the same interface.
- **Disclosed limitation:** for a *single* round the server validates the issued
  challenge **sequence** and the **spoken nonce**, but the "face was present
  throughout" signal is **client-attested** — the real anti-spoof runs in the
  browser and sending raw frames to the server would break the "video never
  leaves the device" privacy design. The *cross-round* biometric match (T4) is
  fully server-side. A future hardening is a signed client attestation.

### T4 — Proxy / seat-swap across rounds
Candidate A passes round 1; impostor B sits round 2.
- **Mitigation:** cross-round biometric continuity via pgvector cosine distance
  (threshold 0.3) flags a different person on the same identity.
- **Residual risk (disclosed):** FAR/FRR is **not yet empirically measured**. The
  threshold is tunable and the result is **human-review-gated — never an
  automatic reject** — to avoid wrongly flagging a genuine candidate.

### T5 — Biometric data exposure
- **Mitigation:** raw video never leaves the browser; only an L2-normalized 128-D
  descriptor is stored, and only a **salted one-way hash** of it goes into the
  credential. Data minimization is the design default. Erasure = revoke + delete
  descriptor.
- **Roadmap:** explicit consent capture, retention window, and self-serve
  deletion flow for descriptors.

### T6 — Score manipulation / cheating
A candidate relays an AI's answer instead of judging it.
- **Mitigation:** the task contains a server-planted error. A blind relay accepts
  the wrong answer and scores low; deterministic transcript signals cap
  accepted-verbatim behavior; the LLM grader runs at temperature 0 against a
  locked rubric. The scoring logic is the moat, not surveillance.

### T7 — Unauthorized access to the employer console
The employer surface must not be open to anyone with the URL.
- **Mitigation:** the console, its reads (`/api/employer/*`), and credential
  revocation require a real session (`lib/auth/session.ts`): scrypt-hashed
  passwords + HMAC-signed, expiring tokens with constant-time comparison. The
  *candidate* flow is intentionally public; the *employer* surface is gated.
  Logins are written to the audit log.
- **Scope (disclosed):** app-level auth, not a full IdP — no SSO/SAML, SCIM, MFA,
  or password reset yet. See [docs/adr/0007](docs/adr/0007-self-contained-employer-auth.md).

## Secrets & dependencies

- Secrets are provided via environment variables and are git-ignored
  (`.env.local`). No secret is committed; see `.env.example` for the shape.
- Supabase Row Level Security is enabled on all tables; the server uses the
  service-role key and is the only writer.
- Dependency hygiene: unused packages are pruned (CI keeps `npm ci` honest);
  automated dependency/vulnerability scanning (Dependabot/Snyk) is roadmap.

## Holder binding (proof-of-possession)

The credential is **not a pure bearer token**. At mint a holder secret is
generated; only its `sha256` is stored, and that hash is committed inside the
signed VC (`cnf` claim), so the binding cannot be altered without breaking the
signature. The holder proves ownership at `/api/credential/prove`. This is a
**shared-secret** PoP, not yet full DID-/key-based holder binding (e.g.
OID4VP / SD-JWT-VC key binding) — that remains the roadmap step.

## What is explicitly NOT claimed

- Not a certified PAD / anti-deepfake engine (see T3).
- Single-round "face present" is client-attested; the server validates the
  challenge + nonce, and cross-round match is server-side (see T3, T4).
- Holder binding is shared-secret PoP, not yet DID/key-based (see above).
- Audit log is tamper-**evident** within the database, not externally anchored.
- Issuer key is not yet KMS/HSM-backed (see T1).
- Cross-round matching has no published FAR/FRR yet (see T4).

We would rather an enterprise reviewer read these limits here than discover them
in a demo.
