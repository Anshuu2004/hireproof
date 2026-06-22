# HireProof — Architecture

HireProof is a **governed, offline-verifiable trust primitive**: it issues a
candidate-owned credential that binds (1) a live-human proof, (2) an
AI-collaboration *judgment* score, and (3) cross-round biometric continuity —
then any employer verifies it in seconds, offline, with no account.

All TypeScript: Next.js 16 (App Router) on Vercel + Supabase (Postgres +
pgvector). In-browser biometrics; server-side signing, scoring, and audit.

## System diagram

```mermaid
flowchart TB
    subgraph Candidate["Candidate browser (biometrics stay local)"]
        L[MediaPipe FaceLandmarker<br/>active liveness: blink/turn/mouth/smile]
        V[Voice nonce<br/>Web Speech + Web Audio]
        F["@vladmandic/face-api<br/>128-D descriptor"]
        T[AI-collaboration task UI<br/>catch the planted error]
        P[Secured-test proctor<br/>no/2nd face · look-away · lockdown]
    end

    subgraph Edge["Next.js API routes (Vercel)"]
        S[/api/session — issue nonce + challenge/]
        LV[/api/liveness — verify actions + descriptor/]
        TK[/api/task — generate planted-error task/]
        AS[/api/assistant — AI tool · persists turns/]
        SC[/api/score — grades server-recorded turns/]
        MT[/api/mint — sign VC + holder cnf/]
        CS[/api/credential-status — status/]
        RV[/api/credential/revoke — auth-gated/]
        PR[/api/credential/prove — holder PoP/]
        EM[/api/employer/login + reads — auth/]
    end

    subgraph Core["Server libraries"]
        ISS[issuer.ts<br/>Ed25519 JWT-VC · did:web · holder cnf]
        AUD[audit.ts → Postgres trigger<br/>full-row hash chain]
        AI[ai/gateway.ts<br/>Claude→Gemini failover, temp 0]
        AUTH[auth/session.ts<br/>scrypt password · HMAC sessions]
    end

    subgraph Data["Supabase — Mumbai ap-south-1"]
        PG[(Postgres + RLS)]
        VEC[(pgvector 128-D<br/>cross-round cosine 0.3)]
        AL[(audit_log<br/>hash-chained)]
    end

    subgraph Verify["Any employer (offline)"]
        DID[/.well-known/did.json]
        VP[/v — in-browser verify<br/>signature + tamper check/]
        CLI[scripts/verify-credential.mjs]
    end

    L & V & F --> LV
    T --> AS --> SC
    S --> LV --> VEC
    TK --> T
    T --> P
    P -->|integrity signals| SC
    SC --> ISS --> MT
    MT --> PG
    LV & SC & MT & CS & RV & PR & EM --> AUD --> AL
    AI --> TK & AS & SC
    EM --> AUTH
    MT -->|QR / token + holder secret| Verify
    DID --> VP
    DID --> CLI
```

## Request lifecycle (happy path)

1. **Session** — `/api/session` issues a server nonce + randomized liveness
   challenge (action order + spoken sentence) and an itemized DPDP consent
   receipt. Randomness is server-side so the flow can't be pre-recorded.
2. **Liveness** — the browser runs MediaPipe active challenge-response and a
   voice nonce; `@vladmandic/face-api` produces a 128-D descriptor. `/api/liveness`
   validates the actions and stores the L2-normalized descriptor in pgvector.
   Raw video never leaves the device.
3. **Cross-round match** — on re-verify rounds, the new descriptor is matched
   against prior rounds via cosine distance (threshold 0.3). A mismatch flags a
   proxy/seat-swap — **human-review-gated, never an auto-reject**.
4. **Task (secured, proctored)** — `/api/task` generates an AI-collaboration
   problem with a *planted error* the candidate must catch and correct. The task
   runs in **secured mode**: full-screen lockdown + a continuous in-browser face
   proctor (no-face / second-face / look-away) + tab-switch detection, with
   behavioural integrity telemetry (paste-heavy / fast-solve / away) captured
   client-side and re-validated server-side. All of this produces **human-review
   signals, never auto-rejects** — and raw video stays on the device.
5. **Task + score** — `/api/assistant` is the AI tool the candidate directs;
   **each turn is persisted server-side** as the model produced it. `/api/score`
   then grades the **server-recorded** transcript (not a client payload) with
   deterministic signals (e.g. accepted-verbatim hard cap) + a locked-rubric LLM
   grader at temperature 0. Output/judgment only — never affect (EU AI Act
   Art 5(1)(f)).
6. **Mint** — `/api/mint` signs an EdDSA (Ed25519) JWT-VC (W3C VC 2.0 shape) with
   the issuer key; a salted hash of the descriptor goes into the credential, not
   the biometric. A **holder secret** is generated and its hash is bound into the
   signature (`cnf`) so the credential is the holder's, not a pure bearer token;
   only the hash is stored. The QR/token + holder secret are handed to the candidate.
7. **Verify** — any employer verifies offline: `/v` in the browser, or
   `scripts/verify-credential.mjs` on the command line, against the public key at
   `/.well-known/did.json`. No DB, no callback. Tampering is rejected. The holder
   can prove possession at `/api/credential/prove`.
8. **Govern** — an **authenticated** employer (`/api/employer/login`, scrypt +
   HMAC session) reviews the record, can **revoke** (`/api/credential/revoke`),
   re-verify each round, and read the trail. `/api/credential-status` returns
   revoked/expiry/round-count; every step appends to the hash-chained `audit_log`.

## Trust & integrity properties

- **Offline verifiable** — authenticity needs only the public key; the issuer is
  a did:web identifier. See [adr/0002](adr/0002-single-jose-jwt-vc.md).
- **Tamper-evident audit** — the chain is computed server-side over the full
  canonical row under an advisory lock; re-checkable via `verify_audit_chain()`.
  See [adr/0004](adr/0004-audit-hash-chain.md).
- **Data-minimized biometrics** — descriptor in pgvector; only a salted hash in
  the credential. See [adr/0003](adr/0003-cross-round-cosine-threshold.md).
- **Deterministic scoring** — temp-0 grader + a planted-error task, graded over
  the server-recorded transcript, make the score reproducible and hard to game.
  See [adr/0005](adr/0005-temp-zero-grader.md).
- **Holder-bound credential** — a holder secret is committed in the signature
  (`cnf`); ownership is provable, so it is not a pure bearer token.
  See [adr/0006](adr/0006-holder-binding.md).
- **Authenticated console** — employer access + revocation are gated by real
  scrypt/HMAC auth. See [adr/0007](adr/0007-self-contained-employer-auth.md).
- **Layered cheat detection** — randomised liveness, a live in-task face proctor
  + full-screen lockdown, anti-outsourcing telemetry, and server-side anti-gaming
  (verbatim hard-cap + prompt-injection firewall), all written to the hash-chained
  audit log; every signal is human-review-gated, not an auto-rejection.

## What is working vs. roadmap

See the honesty table in the top-level `README.md` and `SECURITY.md` /
`COMPLIANCE.md` for the explicit working / partial / roadmap breakdown
(rubric §6). In short: the candidate flow, signing, offline verify, cross-round
match, hash-chained audit, **holder proof-of-possession, server-authoritative
scoring, employer authentication, credential revocation, a live `/metrics`
evidence dashboard, the `/rings` cross-employer fraud-ring view, and the
RAIR/RSR appropriate-reliance probe, and the live in-task proctoring +
anti-cheating detection system** are **real**. A
packaged Action API, the W3C Bitstring **encoding** of revocation, the live ATS
write-back, a KMS-backed issuer key, SSO/SCIM, and SOC 2 are **future scope**.
Certified ISO-30107-3 PAD and a higher-volume bias audit are also **future scope** —
the interfaces exist today (a certified vendor drops in behind the same liveness
boundary; the audit scales with pilot volume), so nothing here is faked.
