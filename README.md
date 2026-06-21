# HireProof

**A candidate-owned, cryptographically-signed credential that proves a job applicant is a real, live human with real AI-collaboration judgment — verifiable by any employer in seconds, re-checked every interview round, and built privacy-first for India's DPDP Act and the EU AI Act.**

[![CI](https://github.com/Anshuu2004/hireproof/actions/workflows/ci.yml/badge.svg)](https://github.com/Anshuu2004/hireproof/actions/workflows/ci.yml)
&nbsp;[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
&nbsp;[![W3C VC 2.0](https://img.shields.io/badge/W3C-VC_2.0-005a9c.svg)](https://www.w3.org/TR/vc-data-model-2.0/)

🔗 **Live demo:** https://hireproof-ecru.vercel.app
&nbsp;·&nbsp; Candidate flow: [`/verify`](https://hireproof-ecru.vercel.app/verify) &nbsp;·&nbsp; Public verify: [`/v`](https://hireproof-ecru.vercel.app/v) &nbsp;·&nbsp; Employer console: [`/employer`](https://hireproof-ecru.vercel.app/employer)

> Team **DOMINATORS** · InnovateZ 2026 (Zentiti) · Round 2. This is a working prototype — see [Honest status](#honest-status--whats-real-partial-mocked) for exactly what is real vs mocked.

**Project docs:** [Architecture](docs/architecture.md) · [Competitive landscape](docs/market-landscape.md) · [Decision records (ADRs)](docs/adr/) · [Security & threat model](SECURITY.md) · [Compliance](COMPLIANCE.md) · [Contributing](CONTRIBUTING.md)

**Try the cryptography in 5 seconds** (no setup, no server): `npm install && npm run verify:demo` — mints a sample credential, verifies the Ed25519 signature, tampers one claim, and watches the verification reject it.

---

## 1. The problem (and why now)

Remote hiring no longer guarantees the person you interview is real, qualified, or unassisted. The evidence is now from tier-1 sources, not vendor hype:

- **Gartner (Jul 2025):** *by 2028, 1 in 4 candidate profiles worldwide will be fake*; 6% of 3,000 surveyed candidates admit to interview fraud.
- **U.S. DOJ (30 Jun 2025):** nationwide takedown of the North-Korean IT-worker scheme — **100+ U.S. companies** infiltrated, 80+ stolen identities, 29 "laptop farms" raided. (A related DOJ/IRS-CI case: **309 companies** via stolen identities, $17M to the regime.)
- **India / "Built for Bharat":** AuthBridge 2025 (vendor-reported) — **9.46% discrepancy in IT/ITeS hiring**; **Infosys deferred tests for 20,000+** candidates over impersonation (press-reported); NASSCOM IT-BPM employs **~5.95M** people (FY26). *(The two India hiring-fraud figures are vendor/press-reported; we cite them as directional, not audited.)*
- **Experian 2026 Future of Fraud:** "Deepfakes outsmart HR" is one of five named top fraud threats for 2026.

**The deeper problem.** Fake certificates are only the visible symptom. The harder issue is that even *legitimate* credentials say almost nothing about how someone performs under real conditions — the signal that matters is **execution under constraint, not completeness of résumé**:

> "Interviewed 60+ candidates last year — every one had the right credentials on paper. Maybe three could ship something functional from Day 1."
> — *a hiring manager, reflecting on 60+ candidates interviewed last year*

Today's tools either run a **detection arms race** (a costly, escalating game as injection attacks improve) or **surveil every applicant** (false positives, no candidate ownership). HireProof flips the model: **the candidate owns the proof, and we measure the one skill that matters now — directing AI well.**

---

## 2. What HireProof is (honest novelty)

No single pillar here is novel on its own (HackerRank scores AI-collaboration; CodeSignal has reusable scores; Velocity/Indicio issue portable W3C credentials; iProov does liveness). **Our defensible novelty is the fusion no one ships:** one candidate-owned token binding

1. a **live, un-pre-stageable human-proof** (randomised active challenge-response liveness — anti-spoof, *not* a certified PAD; we don't claim to out-detect dedicated vendors),
2. an **AI-collaboration *judgment* score** (catch + correct an AI's deliberate mistake), and
3. **cross-round biometric re-verification** (catch proxy / seat-swap rings),

issued on open standards (**W3C VC 2.0**, **did:web**, **Ed25519**), India-first, and **compliant-by-design** with DPDP + the EU AI Act. *Integration is the innovation.*

This is a two-part answer to the deeper problem in §1. (a) The candidate-owned, cryptographically-signed credential is the **unforgeable** reply to fake certificates — we don't *detect* forgeries after the fact (a detection arms race), we make the credential impossible to forge in the first place. (b) The planted-error judgment score measures **execution under constraint** — can the candidate catch and correct a confidently-wrong AI — not completeness of résumé. We don't issue a HIRE/REJECT verdict; we hand the employer an honest, human-review-gated **signal** (EU-AI-Act-safe by design).

**Competitive landscape (honest):** we surveyed the 2025–2026 market and every pillar already has serious players — AI-collaboration scoring (HackerRank AI IDE / AI Interviewer, CodeSignal, Karat), deepfake/proxy interview-fraud detection (Cicero, Willo, InterviewGuard, Sherlock AI), candidate-owned W3C credentials (Velocity Network, Dock, Indicio), and certified liveness/IDV (iProov, Incode, Persona). **What no one ships is the fusion of all three in one candidate-owned, offline-verifiable credential** — and the market is converging on it *now*, so this is a timing window, not a moat. Full gap-table, named competitors, and risks: **[docs/market-landscape.md](docs/market-landscape.md)**.

---

## 3. Architecture

```
                          ┌─────────────────────────── BROWSER (candidate) ───────────────────────────┐
                          │  getUserMedia / WebRTC                                                     │
                          │   ├─ MediaPipe FaceLandmarker (WASM)  → action liveness (blendshapes+pose) │
                          │   ├─ @vladmandic/face-api             → 128-D face descriptor (local)      │
                          │   ├─ Web Speech API + mic meter        → spoken-nonce voice liveness        │
                          │   └─ AI-collaboration workspace (chat) → directs an AI, submits final answer│
                          └───────────────┬───────────────────────────────────────────────────────────┘
   raw video NEVER leaves device          │  POST { liveness_proof, 128-D descriptor, transcript, turns }
                                          ▼
        ┌──────────────────────── Next.js 16 App Router · Vercel (Node runtime) ────────────────────────┐
        │  /api/session    issue randomised challenge (actions + nonce digits)                          │
        │  /api/liveness   re-verify actions+face+voice · pgvector cross-round match · audit             │
        │  /api/task       generate randomised task w/ HIDDEN planted error     ─┐                       │
        │  /api/assistant  AI tool (steered) · persists each turn server-side    ├─ Claude (Vercel AI    │
        │  /api/score      deterministic signals + locked-rubric grader (DB turns)┘  Gateway/OIDC)       │
        │                                                                           → Gemini failover    │
        │  /api/mint       W3C VC 2.0 → Ed25519 sign (jose) + holder `cnf` → QR                          │
        │  /api/credential/{revoke,prove}   revoke (auth) · holder proof-of-possession                  │
        │  /api/employer/{login,credentials,audit}   scrypt password · HMAC-signed sessions             │
        │  /.well-known/did.json   publish issuer public key (did:web)                                   │
        └───────┬───────────────────────────────────────────────────┬───────────────────────────────────┘
                ▼                                                     ▼
   ┌──────────────────────────┐                       ┌────────────────────────────────────┐
   │  Supabase (Mumbai)       │                       │  Employer / verifier                │
   │  Postgres + pgvector     │                       │  /employer  sign-in · revoke · re-vfy│
   │  hash-chained audit_log  │                       │  /v  scan QR → verify Ed25519 vs    │
   │  + verify_audit_chain()  │                       │      did:web key OFFLINE (jose)     │
   └──────────────────────────┘                       └────────────────────────────────────┘
```

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn-style components, deployed on **Vercel**. Supabase **Postgres + pgvector** (cross-round face match) + Storage + Auth. **Claude** via the **Vercel AI Gateway** (OIDC) with automatic **Gemini** failover (Vercel AI SDK v6). **MediaPipe Tasks-Vision** (in-browser liveness) + **@vladmandic/face-api** (128-D descriptors). **jose** (Ed25519 credential signing). All TypeScript — no separate Python service. CI runs lint + typecheck + an offline credential-verifier smoke test on every push.

---

## 4. Under-the-hood — one candidate input → a signed credential

1. **Consent + session:** candidate picks language (EN / हिंदी / తెలుగు), grants camera+mic via itemised DPDP consent; server creates a session row with a random **nonce**.
2. **Randomised challenge:** server issues a unique liveness action sequence (`blink / turn / mouth-open / smile`) + a 3-digit phrase bound to the nonce — generated *the instant the candidate starts*, so a proxy/deepfake can't pre-stage it.
3. **Capture (browser):** MediaPipe reads blendshapes + head-pose per frame to confirm each action live (with on-screen metric readout); face-api computes a 128-D descriptor; the mic meter + Web Speech confirm a spoken phrase. **Raw video never leaves the device** — only the descriptor + derived signals + transcript do.
4. **Server re-check (`/api/liveness`):** independently verifies the actions occurred in the issued order, the face was continuous, and the transcript contains the nonce digits (with a live-voice fallback). Stores the descriptor in pgvector.
5. **Cross-round match:** if re-verifying an existing credential, the new descriptor is compared (cosine distance) to the enrolled one → same-person or **MISMATCH** flag.
6. **AI-collaboration task (`/api/task` + `/api/assistant`):** a fresh task is generated with a *hidden planted error*; the candidate is given an AI tool steered to be confidently wrong. **Each turn is recorded server-side** as the model actually produced it — so scoring is authoritative and can't be gamed by a forged client transcript.
7. **Scoring (`/api/score`):** graded against the **server-recorded** transcript: deterministic signals (did the candidate ship the AI's answer verbatim? did they diverge?) + a locked-rubric LLM grader (temp 0) scoring five judgment axes — **never affect/personality**. Shipping the AI's flawed answer **hard-caps the score ≤ 40**.
8. **Audit:** every step writes an append-only, **hash-chained** `audit_log` row. The chain is computed **server-side in a Postgres trigger over the full canonical row** (seq, id, session, event type, input hash, output, model/prompt version, timestamp) under a transaction-scoped advisory lock — so editing any field, reordering rows, or racing concurrent appends breaks it. Re-checkable anytime via `select * from verify_audit_chain()`. (See [ADR 0004](docs/adr/0004-audit-hash-chain.md).)
9. **Mint (`/api/mint`):** assemble a **W3C VC 2.0**-shaped payload, **Ed25519-sign** it (jose) → compact JWS, render a QR. A **holder secret** is generated and its hash is bound into the signature (`cnf` claim); only the hash is stored — so the credential is the holder's, not a pure bearer token (the secret is shown once). Bind the descriptor to the credential for future rounds.
10. **Verify (`/v`):** an employer scans/pastes the token → fetches the issuer public key from `/.well-known/did.json` → verifies the signature **client-side / offline** (works even if our server is down) → renders the record + an honest "what this does NOT prove" block.
11. **Govern (`/employer`):** an **authenticated** employer (scrypt password + HMAC-signed session) reviews the record, can **revoke** the credential (`/api/credential/revoke`), re-verify identity each round (cross-round biometric match), and read the hash-chained audit trail. The holder can prove ownership at `/api/credential/prove`.

---

## 5. Value beyond a generic LLM

*Why can't a user get the same result by pasting the input into ChatGPT/Claude?*

1. **It's a protocol, not an inference.** Liveness depends on a server-issued *random* action sequence + nonce verified against real-time landmark dynamics — a chatbot has no challenge-response loop and can't prove the actions happened live, in order, in time.
2. **Bound to the moment.** The voice/reasoning sample is tied to a phrase generated < 2 min ago with a server nonce; a generic LLM would happily score a pre-recorded or proxy submission.
3. **Stateful across rounds.** pgvector over 128-D descriptors catches seat-swap rings — an LLM is stateless per call with no enrollment history.
4. **A cryptographic, candidate-owned, offline-verifiable credential.** An employer trusts the issuer key, not a screenshot. ChatGPT can't mint a signed VC against a published `did:web` key — and we prove tamper-evidence (a modified token is rejected).
5. **Anchored, auditable scoring.** The score is anchored by a *planted error the candidate never saw* + deterministic signals (verbatim cap). "Rate this candidate" in ChatGPT is an unanchored opinion with no hash-chained trail.
6. **Compliance is a system property** — consented, minimised, no-emotion-inference, append-only audit, erasure-by-revocation — not something a single prompt provides.

---

## 6. AI-collaboration scoring (detail)

- **Part A — deterministic (TypeScript, no LLM):** `accepted_verbatim` (shipped the AI's answer unchanged → hard cap), `divergedFromAi`, candidate-turn count.
- **Part B — locked-rubric grader (temp 0, strict JSON):** 5 sub-scores 0–5 (`error_detection`, `direction_quality`, `verification`, `iteration`, `final_correctness`), each justification must quote the transcript; `caughtPlantedError` boolean.
- **Fusion:** `score = 100 × weighted_mean` (weights: error_detection .30, final_correctness .25, direction_quality .20, verification .15, iteration .10); displayed as three bands — **Direct · Judge · Correct**.
- **EU AI Act Art 5(1)(f) safe:** explicitly excludes tone, confidence, enthusiasm, accent, "cultural fit." Liveness computes anti-spoofing only.

Verified behaviour: a candidate who **blind-accepts** the AI's flawed answer scores **4** (capped); one who **catches + corrects** it scores **67**.

---

## 7. Data sources, APIs & regulations

**Libraries / APIs:** MediaPipe Tasks-Vision (Apache-2.0), @vladmandic/face-api (MIT), Web Speech API, Web Audio API, Anthropic Claude via Vercel AI Gateway, Google Gemini (AI SDK v6), Supabase (Postgres + pgvector), `jose` (Ed25519 / EdDSA JWT-VC signing), `qrcode`, `@zxing/browser`.

**Standards & regulations (cited with dates):**
- **India DPDP Act 2023 + DPDP Rules 2025** (notified 13 Nov 2025) — itemised consent, minimisation, erasure-by-revocation.
- **EU AI Act** — recruitment = high-risk (Annex III §4); **emotion recognition in the workplace prohibited** (Art 5(1)(f), since 2 Feb 2025); untargeted facial scraping prohibited (Art 5(1)(e)).
- **W3C Verifiable Credentials 2.0** (Recommendation, 15 May 2025) + **DID Core 1.0** (19 Jul 2022) + `did:web`.
- **ISO/IEC 30107-3** (presentation-attack detection) + **NIST FATE-PAD** (NISTIR 8491) — the liveness benchmarks we aspire to.
- **NYC Local Law 144** + **EEOC four-fifths rule** — bias-audit framing.

**Market stats** (Gartner, U.S. DOJ/IRS-CI, AuthBridge, Experian, NASSCOM) are summarised in §1; full sourced list in the submission PDF.

---

## 8. Setup (local development)

**Prerequisites:** Node 20+ (built on 24), a Supabase project, and either a Vercel AI Gateway (Claude) or a free Google Gemini API key.

```bash
git clone https://github.com/Anshuu2004/hireproof.git
cd hireproof
npm install

# configure environment
cp .env.example .env.local      # then fill in the values (see table below)

# apply the database schema to your Supabase project
npx supabase link --project-ref <your-ref>
npx supabase db push            # creates 11 tables + pgvector + cross-round match fn

# generate the Ed25519 issuer keypair (writes ISSUER_*_KEY_HEX) — or set your own
node -e "const{generateKeyPairSync}=require('crypto');const{publicKey,privateKey}=generateKeyPairSync('ed25519');const h=s=>Buffer.from(s,'base64url').toString('hex');console.log('ISSUER_PRIVATE_KEY_HEX='+h(privateKey.export({format:'jwk'}).d));console.log('ISSUER_PUBLIC_KEY_HEX='+h(publicKey.export({format:'jwk'}).x));"

npm run dev                      # http://localhost:3000  (use Chrome/Edge for camera+mic)
```

The MediaPipe WASM + the face-api / face-landmarker models are committed under `public/` (≈13 MB) so the app works offline with no CDN dependency.

**Scripts:** `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm run verify:demo` (offline credential sign→verify→tamper→reject; also the CI smoke test). To verify a real token offline against the issuer key: `ISSUER_PUBLIC_KEY_HEX=… node scripts/verify-credential.mjs <token>`.

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB writes (never exposed to client) |
| `ISSUER_PRIVATE_KEY_HEX` / `ISSUER_PUBLIC_KEY_HEX` | Ed25519 credential-signing keypair |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini (fallback / no-card LLM) |
| `AI_GATEWAY_API_KEY` *(optional)* | Vercel AI Gateway key for Claude in local dev (OIDC is automatic on Vercel) |
| `LLM_PRIMARY` | `claude` or `gemini` — provider preference order |
| `ISSUER_DID`, `NEXT_PUBLIC_SITE_URL` *(optional)* | Auto-derived from the Vercel domain if unset |

---

## 9. Repository structure

```
hireproof/
├─ app/
│  ├─ page.tsx                     # landing
│  ├─ verify/                      # candidate flow (consent → liveness → task → mint)
│  ├─ v/                           # public no-login verify page
│  ├─ employer/                    # employer console + seat-swap re-verify
│  ├─ .well-known/did.json/        # did:web issuer key
│  └─ api/                         # session · liveness · task · assistant · score · mint ·
│                                  #   credential/{revoke,prove} · employer/{login,credentials,audit} · credential-status
├─ components/                     # wordmark, credential-card, verify/* (consent, liveness, task, mint)
├─ lib/
│  ├─ ai/        (gateway, task, scorer)     # Claude/Gemini failover + locked rubric
│  ├─ credential/(issuer)                    # Ed25519 sign/verify + did:web + holder `cnf`
│  ├─ auth/      (session)                   # scrypt password + HMAC-signed employer sessions
│  ├─ liveness/  (challenge)                 # randomised challenge + transcript match
│  ├─ audit.ts   supabase/admin.ts  env.ts   # hash-chained audit, DB, typed env
├─ scripts/verify-credential.mjs   # standalone offline verifier (CI smoke test)
├─ supabase/migrations/            # schema + pgvector + cross-round match + audit-chain trigger
├─ docs/                           # architecture.md + adr/ (decision records)
├─ .github/workflows/ci.yml        # lint · typecheck · offline-verifier
└─ public/{mediapipe,models}/      # in-browser ML assets (version-matched, offline)
```

See also: [LICENSE](LICENSE) (Apache-2.0) · [SECURITY.md](SECURITY.md) · [COMPLIANCE.md](COMPLIANCE.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [docs/architecture.md](docs/architecture.md) · [docs/adr/](docs/adr/).

---

## 10. Honest status — what's real / partial / mocked

| Capability | Status |
|---|---|
| Active face liveness (randomised challenge) | **Real** — MediaPipe in-browser |
| Cross-round biometric match (seat-swap) | **Real** — pgvector, demoably flags MISMATCH |
| Randomised task + AI-collaboration judgment scoring | **Real** — LLM + deterministic signals |
| Voice liveness (spoken nonce) | **Real** — spoken-nonce match; explicit `voiceMode` (`spoken-nonce` / `voice-activity-fallback`) recorded in the audit, no silent pass |
| Ed25519-signed W3C VC + QR + offline verify | **Real** — tamper-evident, verified offline; runnable via `npm run verify:demo` and in CI |
| Holder proof-of-possession (non-bearer) | **Real** — a holder secret is bound into the signed VC (`cnf`); only its hash is stored; `/api/credential/prove` verifies ownership |
| Credential revocation | **Real** — authenticated employer can revoke (`/api/credential/revoke`); verify + console show revoked state. (W3C Bitstring *encoding* still roadmap) |
| Employer authentication | **Real** — password-gated accounts (scrypt) + HMAC-signed sessions; one-click seeded demo login |
| AI-score transcript integrity | **Real** — the graded transcript is the **server-recorded** one (persisted in `/api/assistant`), not a client-submitted payload |
| Hash-chained audit log | **Real** — server-side trigger hashes the **full canonical row** atomically; `verify_audit_chain()` re-checks integrity |
| Vernacular (EN / हिंदी / తెలుగు) | **Partial** — 3 languages end-to-end |
| Single-round liveness attestation | **Partial (honest)** — the server validates the issued challenge sequence + spoken nonce, but the "face was present" signal is **client-attested** (real anti-spoof runs in-browser; sending raw frames server-side would break the privacy design). *Cross-round* match is fully server-side. |
| Certified anti-deepfake / injection PAD | **Not claimed** — challenge-response liveness, *not* ISO 30107-3-certified PAD; a certified vendor (iProov/Incode) is the production swap-in |
| Cross-round match FAR/FRR | **Not yet measured** — threshold 0.3 is a sensible default; result is human-review-gated, never an auto-reject |
| Bias audit (four-fifths / LL144) | **Methodology only** — on synthetic/seeded data; a real audit needs real outcome data we don't (and shouldn't) fabricate |
| Issuer key management | **Roadmap** — key is an env var today; KMS/HSM + rotation is the top hardening item ([SECURITY.md](SECURITY.md)) |
| ATS write-back, SSO/SCIM, SOC 2 | **Roadmap** — see [docs/architecture.md](docs/architecture.md#what-is-working-vs-roadmap) |

---

## 11. Demo scenarios

1. **Proxy / seat-swap caught mid-funnel** — candidate A mints a credential; a *different* person re-verifies in `/employer` → live **MISMATCH** (the gap onboarding-only IDV misses).
2. **Judgment, not memorisation** — a candidate who blind-accepts the AI's planted-wrong output scores low (capped); one who catches and corrects it scores high. See the "why this score" panel.
3. **Portability in seconds** — the same QR token is verified by any employer at `/v`, signature-checked **offline**, in < 2 s — with a real elapsed counter.
4. **Governed lifecycle** — sign in to `/employer` (one-click demo account), **revoke** a credential and watch `/v` flip to *Revoked*; the holder proves ownership with their private key (`/api/credential/prove`). Every step lands in the hash-chained audit trail.

---

## 12. Security & privacy

Raw video never leaves the device; only a 128-D descriptor + a salted hash are stored. **Candidates** are account-less — the credential is the identity, bound to a holder secret (proof-of-possession via the signed `cnf` claim) so it is not a pure bearer token. **Employers** authenticate (scrypt-hashed passwords + HMAC-signed sessions) to reach the console, and revocation is authenticated. Consent is itemised and revocable. No emotion/affect is ever inferred. The audit log is append-only and hash-chained over the full row server-side (re-checkable via `verify_audit_chain()`). Secrets live in `.env.local` (git-ignored) / Vercel env — never committed.

---

*Built for InnovateZ 2026 · Team DOMINATORS. Prototype — calibrated claims over absolutes.*
