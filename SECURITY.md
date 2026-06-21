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
| Issuer signing key (Ed25519) | env var today → **KMS/HSM is roadmap** | every credential can be forged |
| Face descriptors (128-D) | pgvector, server-side; never the raw video | biometric exposure; re-identification |
| Audit chain | `audit_log`, hash-chained, server-computed | loss of tamper-evidence / explainability |
| Employer/session data | Supabase Postgres (RLS on, service-role server-side) | data leak |

## Threat model

### T1 — Credential forgery
A forged or altered credential must never verify.
- **Mitigation:** every credential is an EdDSA (Ed25519) JWT-VC. Verification
  uses the public key alone (`/.well-known/did.json`, did:web). Any change to the
  payload breaks the signature. Demonstrated by `npm run verify:demo` (mint →
  verify → tamper → reject) and exercised in CI on every push.
- **Residual risk (disclosed):** the issuer **private key currently lives in an
  environment variable** (`ISSUER_PRIVATE_KEY_HEX`). A leaked env var forges all
  credentials. **Production requires a KMS/HSM-held key with rotation and a
  published issuer-trust statement** — tracked as the top hardening item
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

## Secrets & dependencies

- Secrets are provided via environment variables and are git-ignored
  (`.env.local`). No secret is committed; see `.env.example` for the shape.
- Supabase Row Level Security is enabled on all tables; the server uses the
  service-role key and is the only writer.
- Dependency hygiene: unused packages are pruned (CI keeps `npm ci` honest);
  automated dependency/vulnerability scanning (Dependabot/Snyk) is roadmap.

## What is explicitly NOT claimed

- Not a certified PAD / anti-deepfake engine (see T3).
- Audit log is tamper-**evident** within the database, not externally anchored.
- Issuer key is not yet KMS/HSM-backed (see T1).
- Cross-round matching has no published FAR/FRR yet (see T4).

We would rather an enterprise reviewer read these limits here than discover them
in a demo.
