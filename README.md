# HireProof

**A candidate-owned, cryptographically-signed credential that proves a job applicant is a real, live human with real AI-collaboration judgment — verifiable by any employer in seconds, re-checked every interview round, and built privacy-first for India's DPDP Act and the EU AI Act.**

[![CI](https://github.com/Anshuu2004/hireproof/actions/workflows/ci.yml/badge.svg)](https://github.com/Anshuu2004/hireproof/actions/workflows/ci.yml)
&nbsp;[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
&nbsp;[![W3C VC 2.0](https://img.shields.io/badge/W3C-VC_2.0-005a9c.svg)](https://www.w3.org/TR/vc-data-model-2.0/)

🔗 **Live demo:** https://hireproof-ecru.vercel.app
&nbsp;·&nbsp; Candidate flow: [`/verify`](https://hireproof-ecru.vercel.app/verify) &nbsp;·&nbsp; Public verify: [`/v`](https://hireproof-ecru.vercel.app/v) &nbsp;·&nbsp; Employer console: [`/employer`](https://hireproof-ecru.vercel.app/employer)

> Team **DOMINATORS** · InnovateZ 2026 (Zentiti) · Round 2. This is a **working prototype**, not a slide deck — and we are honest about it. The [Honest status table](#9-demo-scenarios--honest-status-what-is-real--mocked--roadmap) says, line by line, exactly what is real vs mocked vs roadmap.

**In one sentence:** *Today an employer cannot be sure the person on the video call is real, is the same person across rounds, or can actually think — HireProof turns "trust me" into a credential you can cryptographically check in under 2 seconds.*

---

## 📍 Submission map (InnovateZ Round 2 — find everything fast)

Every required section, and exactly where it is answered. (Built so a human reviewer **or** an automated scan can locate the evidence instantly.)

| InnovateZ requirement | Where it's answered |
|---|---|
| **1. Problem & user flow** | [§1 The problem](#1-the-problem-and-why-now--real-evidence-not-hype) · [§3 User flow](#3-user-flow--one-input--one-signed-credential) |
| **2. Under-the-hood design** | [§4 Under the hood](#4-under-the-hood--exactly-what-happens-step-by-step) · [§4.1 Scoring logic](#41-ai-collaboration-scoring--how-the-number-is-actually-computed) |
| **3. Data sources & references** | [§7 Data sources, APIs & regulations](#7-data-sources-apis--regulations-exact-list) |
| **4. Value beyond a generic LLM** | [§5 Why ChatGPT can't do this](#5-value-beyond-a-generic-llm--why-chatgptclaudegemini-cant-give-you-this) |
| **5. Architecture & technical design** | [§8 Architecture](#8-architecture--frontend--backend--storage--ai--deployment) |
| **6. Demo scenario & limitations** | [§9 Demo scenarios & honest status](#9-demo-scenarios--honest-status-what-is-real--mocked--roadmap) |
| **MVP / working demo** | Live: [hireproof-ecru.vercel.app](https://hireproof-ecru.vercel.app) · 90-second walkthrough in [docs/DEMO.md](docs/DEMO.md) |
| **GitHub repo + setup** | [§10 Setup](#10-setup--run-it-locally) · [§12 Repository map](#12-repository-structure) |
| **Real-world market comparison** | [§6 Who else does this](#6-real-world-comparison--who-else-does-this-honest) · full version in [docs/market-landscape.md](docs/market-landscape.md) |

**Try the cryptography in 5 seconds** (no setup, no server, no keys): `npm install && npm run verify:demo` — it mints a sample credential, verifies the Ed25519 signature, tampers one claim, and watches the verification **reject** it. Then `npm test` runs the **trust-core suite** (20 Vitest tests over the credential lifecycle, audit hash-chain, and reliance scoring — no keys, no DB, no network).

---

## 1. The problem (and why now) — real evidence, not hype

**In plain words:** Remote hiring broke a basic assumption — that the person you interview is real, is the same person each round, and can actually do the work. In 2026 none of those are safe to assume anymore.

The evidence is from tier-1 sources (government, Gartner, named enterprises), not vendor marketing:

- **Gartner** — *by 2028, 1 in 4 candidate profiles worldwide will be fake.* In a survey of 3,000 candidates, **6% admitted to interview fraud** (someone else sat for them, or they sat for someone else). [[1]](#sources)
- **U.S. DOJ (14 Nov 2025)** — sweeping nationwide takedown of the North-Korean remote-IT-worker scheme: **$15M+ in forfeitures**, **100+ U.S. companies** infiltrated using **80+ stolen identities**, **137 laptops** seized from "laptop farms" across 14 states. [[2]](#sources)
- **Checkr (2025)** — **41% of IT/security/risk leaders** confirmed their organisation actually **hired and onboarded a fraudulent candidate.** [[3]](#sources)
- **CBS / industry surveys (2026)** — **~50% of businesses** have encountered AI-driven deepfake fraud; "fake candidates" now rank as the **#1 anticipated hiring challenge of 2026 — above the talent shortage itself.** [[3]](#sources)
- **India / "Built for Bharat":** AuthBridge 2025 reported **9.46% discrepancy in IT/ITeS hiring**; Infosys press-reported deferring tests for **20,000+** candidates over impersonation; NASSCOM IT-BPM employs **~5.95M** people. *(India figures are vendor/press-reported — we cite them as directional, not audited.)*

**The deeper problem (the part most tools miss).** Fake certificates are only the visible symptom. Even a *legitimate* résumé says almost nothing about how someone performs under real conditions. The signal that actually matters now is **execution under constraint — can you direct an AI and catch it when it's confidently wrong — not completeness of résumé.**

> "Interviewed 60+ candidates last year — every one had the right credentials on paper. Maybe three could ship something functional from Day 1." — *a hiring manager*

Today's tools pick one of two losing strategies: a **detection arms race** (forever chasing better deepfakes) or **surveillance** (record every applicant, lots of false positives, candidate owns nothing). **HireProof flips the model: the candidate owns the proof, and we measure the one skill that matters now — directing AI well.**

---

## 2. What HireProof is (honest novelty)

**In plain words:** One QR-code credential that says three things at once, in a way an employer can check offline in seconds — *(1) a live human made this, right now; (2) here's how well they actually think with AI; (3) it's the same person every round.*

No single pillar here is novel on its own — and we say so plainly. HackerRank already scores AI-collaboration; Velocity/Dock issue portable W3C credentials; iProov/Persona do certified liveness. **Our defensible position is the fusion no one ships:** one candidate-owned token binding

1. a **live, un-pre-stageable human-proof** — a randomised active challenge-response liveness check (anti-spoof; *not* a certified PAD — we don't claim to out-detect dedicated vendors),
2. an **AI-collaboration *judgment* score** — can the candidate catch and correct an AI's deliberately planted mistake, and
3. **cross-round biometric re-verification** — catch proxy / seat-swap rings between interview rounds,

issued on open standards (**W3C VC 2.0**, **did:web**, **Ed25519**), India-first, and **compliant-by-design** with DPDP + the EU AI Act. **Integration is the innovation** — and we are honest that it's a *timing window, not a permanent moat* (see [§6](#6-real-world-comparison--who-else-does-this-honest)).

This answers the deeper problem two ways: (a) the candidate-owned signed credential is the **unforgeable** reply to fake certificates — we don't *detect* forgeries after the fact, we make the credential **impossible to forge in the first place**; (b) the planted-error judgment score measures **execution under constraint**, not résumé completeness. We never issue a HIRE/REJECT verdict — we hand the employer an honest, human-review-gated **signal** (EU-AI-Act-safe by design).

---

## 3. User flow — one input → one signed credential

**In plain words:** A candidate spends ~90 seconds in front of their webcam. Out comes a QR code that any employer can scan and trust. Here's the journey:

```
 Candidate                                                      Employer
 ─────────                                                      ────────
 1. Consent (itemised, DPDP)                                    7. Scan QR at /v
 2. Liveness: blink → turn → speak a random 3-digit code   →    8. Signature verified
 3. AI task with a HIDDEN planted error                         OFFLINE in < 2s
 4. Direct the AI · catch + fix the error                  →    9. See score + "what
 5. Score computed from the SERVER-recorded transcript         this does NOT prove"
 6. Mint → Ed25519-signed W3C credential + QR             →   10. Round 2: re-verify
                                                               → cross-round face match
                                                                 flags a seat-swap
```

The candidate gives **one input** (their live presence + their handling of the AI task). Everything else — the random challenge, the planted error, the scoring, the signing — happens around that single session.

---

## 4. Under the hood — exactly what happens, step by step

**In plain words:** Below is the literal sequence of events from "candidate clicks start" to "employer trusts the result." No "we use AI" hand-waving — every step names the actual mechanism.

1. **Consent + session** (`/api/session`) — candidate grants camera + mic via an itemised DPDP consent screen; the server creates a session row with a random **nonce**.
2. **Randomised challenge** — the server issues a unique liveness action sequence (`blink / turn / mouth-open / smile`, 3 of 4, shuffled) **plus** a 3-digit spoken phrase bound to the nonce — generated *the instant the candidate starts*, so a proxy or pre-recorded deepfake can't stage it in advance.
3. **Capture in the browser** — **MediaPipe FaceLandmarker** reads facial blendshapes + head-pose per frame to confirm each action happened live (with an on-screen metric readout); **@vladmandic/face-api** computes a **128-D face descriptor** locally; the mic meter + **Web Speech API** confirm the spoken phrase. **Raw video never leaves the device** — only the descriptor + derived signals + transcript do.
4. **Server re-check** (`/api/liveness`) — independently verifies the actions occurred **in the issued order**, the face was continuous, the timing is fresh (< 180s) and monotonic, and the transcript contains the nonce digits (with an explicit, audited live-voice fallback — no silent pass). Stores the descriptor in **pgvector**.
5. **Cross-round match** — if re-verifying an existing credential, the new descriptor is compared by **cosine distance** (`hp_cross_round_match`, threshold **0.30**) to the enrolled one → same-person, or a **MISMATCH** flag for human review.
6. **AI-collaboration task** (`/api/task` + `/api/assistant`) — a fresh task is generated with a **hidden planted error**; the candidate is given an AI assistant that is *steered to be confidently wrong*. **Every turn is recorded server-side** as the model actually produced it — so the score is computed from an authoritative transcript that a forged client payload cannot fake.
7. **Scoring** (`/api/score`) — graded against the **server-recorded** transcript: deterministic signals (did they ship the AI's answer verbatim? did they diverge?) **plus** a locked-rubric LLM grader at **temperature 0**. Shipping the AI's flawed answer **hard-caps the score ≤ 40** — outside the LLM, so the grader can't override it. (Detail in [§4.1](#41-ai-collaboration-scoring--how-the-number-is-actually-computed).)
8. **Audit** — every step writes an **append-only, hash-chained** `audit_log` row. The chain is computed **server-side in a Postgres trigger over the full canonical row** under a transaction-scoped advisory lock — so editing any field, reordering rows, or racing concurrent appends breaks it. Re-checkable anytime via `select * from verify_audit_chain()`.
9. **Mint** (`/api/mint`) — assemble a **W3C VC 2.0** payload, **Ed25519-sign** it with `jose` → compact JWS → QR. A **holder secret** is generated and its hash is bound into the signature (`cnf` claim); only the hash is stored — so the credential is the holder's, **not a pure bearer token** (the secret is shown once).
10. **Verify** (`/v`) — an employer scans/pastes the token → fetches the issuer public key from `/.well-known/did.json` → verifies the signature **client-side / offline** (works even if our server is down) → renders the record + an honest "what this does NOT prove" block.
11. **Govern** (`/employer`) — an **authenticated** employer (scrypt password + HMAC-signed session) reviews the record, can **revoke** it (`/api/credential/revoke`), re-verify identity each round, and read the hash-chained audit trail. The holder proves ownership at `/api/credential/prove`.

### 4.1 AI-collaboration scoring — how the number is actually computed

**In plain words:** We don't ask an AI "rate this candidate" (that's an unanchored opinion). We plant a specific, hidden mistake the candidate never saw, and measure whether they catch it. The math is fixed and auditable.

- **Part A — deterministic (TypeScript, no LLM):** `accepted_verbatim` (shipped the AI's answer unchanged → **hard cap ≤ 40**), `divergedFromAi`, candidate-turn count. Verbatim copy is caught by **two** similarity measures (token-set Jaccard + character 4-gram Jaccard, threshold 0.72) so paraphrasing the AI's wrong answer doesn't slip through.
- **Part B — locked-rubric grader (`claude-sonnet-4.6`, temperature 0, strict JSON):** 5 sub-scores 0–5 — `error_detection`, `direction_quality`, `verification`, `iteration`, `final_correctness` — each justification must **quote the transcript**; plus a `caughtPlantedError` boolean. The grader is firewalled against prompt injection (transcript is treated as material to evaluate, never as commands).
- **Fusion:** `score = 100 × weighted_mean`, weights **error_detection .30 · final_correctness .25 · direction_quality .20 · verification .15 · iteration .10**; displayed as three plain bands — **Direct · Judge · Correct**.
- **EU AI Act Art 5(1)(f) safe:** explicitly excludes tone, confidence, enthusiasm, accent, "cultural fit." Liveness computes anti-spoofing only — **never** emotion or affect.

**Verified behaviour:** a candidate who **blind-accepts** the AI's flawed answer scores ~**32** (hard-capped); one who **catches and corrects** it scores ~**67**. The contrast is the whole point — we score *judgment*, not *usage*.

---

## 5. Value beyond a generic LLM — why ChatGPT/Claude/Gemini can't give you this

**Direct answer to the question "why can't I just paste the same input into ChatGPT?":**

1. **It's a protocol, not an inference.** Liveness depends on a server-issued *random* action sequence + nonce, verified against real-time landmark dynamics. A chatbot has no challenge-response loop and can't prove the actions happened live, in order, in time.
2. **Bound to the moment.** The voice/reasoning sample is tied to a phrase generated < 2 minutes ago with a server nonce. A generic LLM will happily "score" a pre-recorded or proxy submission.
3. **Stateful across rounds.** pgvector over 128-D descriptors catches seat-swap rings — an LLM is stateless per call with no enrolment history.
4. **A cryptographic, candidate-owned, offline-verifiable credential.** An employer trusts the *issuer key*, not a screenshot. ChatGPT cannot mint a signed VC against a published `did:web` key — and we prove tamper-evidence (a modified token is rejected, demonstrably).
5. **Anchored, auditable scoring.** The score is anchored by a *planted error the candidate never saw* + deterministic signals (verbatim cap). "Rate this candidate" in ChatGPT is an unanchored opinion with no hash-chained trail.
6. **Compliance is a system property** — consented, minimised, no-emotion-inference, append-only audit, erasure-by-revocation — not something a single prompt provides.

**One line:** ChatGPT can *generate text about* a candidate. HireProof *issues a fact* about a verified human event, signed so anyone can check it without trusting us.

---

## 6. Real-world comparison — who else does this (honest)

**In plain words:** Every pillar we stand on already has serious, well-funded players. We are not pretending to be first. What we couldn't find anywhere is **all three fused into one candidate-owned, offline-verifiable credential.** That fusion is our position — and we're honest it's a timing window, not a permanent moat.

| Capability | HackerRank / CodeSignal | Cicero / Willo (fraud) | Velocity / Dock (credentials) | iProov / Persona / Incode (IDV) | **HireProof** |
|---|:--:|:--:|:--:|:--:|:--:|
| Score AI-collaboration **judgment** (catch a planted error) | ~ generic "AI fluency" | ✗ | ✗ | ✗ | **✓ specific mechanic** |
| Live anti-proxy / anti-deepfake liveness | ✗ | ✓ | ✗ | ✓ **certified PAD** | ✓ challenge-response |
| Cross-round biometric re-verify (seat-swap) | ✗ | ~ | ✗ | ~ onboarding-only | **✓** |
| Candidate-owned, offline-verifiable W3C credential | ✗ | ✗ | ✓ | ✗ | **✓** |
| **All three fused into ONE token** | ✗ | ✗ | ✗ | ✗ | **✓ ← the novelty** |
| India DPDP + EU AI Act compliant-by-design | ~ | ~ | ~ | ~ | **✓ explicit** |

**The market is huge and moving — which validates the problem, and sets the bar:**
- Identity-verification market: **$14.86B (2025) → $43.38B (2034)**, ~12.6% CAGR. [[4]](#sources)
- **Persona** raised **$200M at a $2B valuation** (Apr 2025) and reported blocking **75M deepfakes** in hiring/onboarding flows in a single month. [[4]](#sources)
- **Incode** is raising at up to a **$3B valuation** (Nov 2025). [[4]](#sources)
- **HackerRank "AI Fluency"** already grades candidates A/B/C on how they collaborate with AI; **CodeSignal** ships full AI-session transcripts + replay. [[7]](#sources)
- **W3C Verifiable Credentials 2.0** became an official Recommendation (15 May 2025) — the standard we build on. [[8]](#sources)

**What this means, honestly:**
- Our genuinely **most original** piece is the **judgment score** (catch + correct a hidden AI error + verbatim hard-cap), not the identity layer — on identity we *concede* certified vendors (iProov/Incode) and name them as the production swap-in.
- The defensible angle is **the fusion + candidate-owned framing + India-first compliance + privacy architecture** (raw video never leaves the device), not any single technology.
- Full named-competitor analysis, segment by segment, with risks to our own novelty: **[docs/market-landscape.md](docs/market-landscape.md)**.

---

## 7. Data sources, APIs & regulations (exact list)

**Libraries / APIs (and how each one influences the output):**

| Source / API | Role in the pipeline |
|---|---|
| **MediaPipe Tasks-Vision** (Apache-2.0) | In-browser facial blendshapes + head-pose → confirms the randomised liveness actions happened live |
| **@vladmandic/face-api** (MIT) | In-browser 128-D face descriptor → the input to cross-round matching |
| **Web Speech API + Web Audio API** | Spoken-nonce transcription + voice-activity fallback → confirms the live spoken phrase |
| **Anthropic Claude** via Vercel AI Gateway | `claude-haiku-4.5` generates the planted-error task; `claude-sonnet-4.6` is the steered assistant + the temp-0 grader |
| **Google Gemini** (AI SDK v6) | Automatic failover (`gemini-2.5-flash-lite` / `gemini-2.5-flash`) if Claude is unavailable — same schemas, reproducible |
| **Supabase (Postgres + pgvector)** | 16 tables; pgvector cosine distance drives the cross-round + cross-employer ring match |
| **`jose`** (Ed25519 / EdDSA) | Signs the W3C VC and the did:web-verifiable certificates |
| **`qrcode`, `@zxing/browser`** | Render + scan the credential QR (real camera scanner on `/v`) |

**Standards & regulations (cited with dates, and how they shape the design):**
- **India DPDP Act 2023 + DPDP Rules 2025** (notified 13 Nov 2025) → itemised consent, data minimisation, erasure-by-revocation.
- **EU AI Act** → recruitment = high-risk (Annex III §4); **emotion recognition in the workplace prohibited** (Art 5(1)(f), since 2 Feb 2025) → our scoring excludes all affect; untargeted facial scraping prohibited (Art 5(1)(e)).
- **W3C Verifiable Credentials 2.0** (Recommendation, 15 May 2025) + **DID Core 1.0** + `did:web` → the credential format and key publication.
- **ISO/IEC 30107-3** (presentation-attack detection) + **NIST FATE-PAD** → the liveness benchmarks we *aspire* to (and honestly do not yet certify).
- **NYC Local Law 144** + **EEOC four-fifths rule** → the bias-audit framing (`/fairness`, `/api/bias-audit/run`).

**Market statistics** (Gartner, U.S. DOJ/IRS-CI, Checkr, CBS, Persona/Incode, AuthBridge, NASSCOM) — see [§1](#1-the-problem-and-why-now--real-evidence-not-hype) and [§6](#6-real-world-comparison--who-else-does-this-honest); full source links in [Sources](#sources).

---

## 8. Architecture — frontend → backend → storage → AI → deployment

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
        │  /api/credential/{revoke,prove,erase}   revoke (auth) · holder proof-of-possession · DPDP erase│
        │  /api/employer/{login,credentials,audit}   scrypt password · HMAC-signed sessions             │
        │  /api/reliance   appropriate-reliance probe (RAIR/RSR) · accept-correct + override-wrong       │
        │  /api/metrics    live pilot metrics (real session data) · /api/rings   cross-employer ring view│
        │  /api/work/*     post-hire continuous re-verification (enrol · recheck · status)               │
        │  /.well-known/did.json   publish issuer public key (did:web) + retired keys (rotation)         │
        └───────┬───────────────────────────────────────────────────┬───────────────────────────────────┘
                ▼                                                     ▼
   ┌──────────────────────────┐                       ┌────────────────────────────────────┐
   │  Supabase (Mumbai)       │                       │  Employer / verifier · analytics    │
   │  Postgres + pgvector     │                       │  /employer  sign-in · revoke · re-vfy│
   │  16 tables · hash-chained │                       │  /v verify offline · /metrics live  │
   │  audit_log + trigger     │                       │  /rings cross-employer fraud-ring   │
   │  + verify_audit_chain()  │                       │  /fairness signed bias-audit cert   │
   └──────────────────────────┘                       └────────────────────────────────────┘
```

**Stack at a glance:**
- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn-style components; in-browser ML (MediaPipe + face-api) so raw video stays on-device.
- **Backend:** 29 Next.js API routes on the Vercel Node runtime; all TypeScript (no separate Python service).
- **Storage:** Supabase **Postgres + pgvector** (16 tables, region-pinned to Mumbai `bom1`), hash-chained `audit_log` enforced by a Postgres trigger.
- **AI / model layer:** **Claude** via the **Vercel AI Gateway** (OIDC) with automatic **Gemini** failover (Vercel AI SDK v6); two tiers (`fast` task-gen, `smart` assistant + grader).
- **Crypto layer:** `jose` Ed25519 signing isolated behind a single `Signer` boundary; did:web key publication + rotation.
- **Deployment:** Vercel (`vercel.json` pins `bom1`); CI runs lint + typecheck + the 20-test trust suite + an offline credential-verifier smoke test on every push.

Deeper write-up + decision records: **[docs/architecture.md](docs/architecture.md)** · **[docs/adr/](docs/adr/)** (7 ADRs).

---

## 9. Demo scenarios & honest status (what is real / mocked / roadmap)

### Demo scenarios (concrete input → processing → output → why it's useful)

1. **Proxy / seat-swap caught mid-funnel.** *Input:* candidate A mints a credential; in round 2 a *different* person re-verifies. *Processing:* pgvector cosine distance between the two 128-D descriptors exceeds 0.30. *Output:* a live **MISMATCH** flag. *Why useful:* onboarding-only IDV completely misses this.
2. **Judgment, not memorisation.** *Input:* the AI assistant hands the candidate a confidently-wrong answer (e.g. an `INNER` vs `LEFT JOIN` bug). *Processing:* deterministic verbatim check + temp-0 rubric grader on the server-recorded transcript. *Output:* blind-accept → **~32 (hard-capped)**; catch-and-correct → **~67**, with a "why this score" panel. *Why useful:* measures the skill that actually predicts Day-1 performance.
3. **Portability in seconds.** *Input:* the same QR token at any employer's `/v`. *Processing:* fetch the issuer key from did:web, verify Ed25519 **offline**. *Output:* verified record in **< 2s** (real elapsed counter) — even with the network throttled. *Why useful:* no integration, no account, no trust in our servers required.
4. **Governed lifecycle.** *Input:* employer signs in (one-click demo account) and revokes a credential. *Output:* `/v` flips to **Revoked**; the holder can still prove ownership with their secret; every step lands in the hash-chained audit trail.

**Instant verification (no flow needed):** `npm run seed:demo` signs **three real credentials with the production issuer key** → `docs/demo/` — `GOOD` (score 67), `BLIND` (score 32, the ≤40 cap), `REVOKED` (valid signature but revoked). They verify offline against the published `did.json`. Full judge script: **[docs/DEMO.md](docs/DEMO.md)**.

### Honest status — what's real / partial / mocked

| Capability | Status |
|---|---|
| Active face liveness (randomised challenge) | **Real** — MediaPipe in-browser |
| Cross-round biometric match (seat-swap) | **Real** — pgvector, demoably flags MISMATCH |
| Randomised task + AI-collaboration judgment scoring | **Real** — LLM grader + deterministic signals |
| Voice liveness (spoken nonce) | **Real** — spoken-nonce match; explicit `voiceMode` recorded in audit, no silent pass |
| Ed25519-signed W3C VC + QR + offline verify | **Real** — tamper-evident, verified offline; `npm run verify:demo` + CI |
| Holder proof-of-possession (non-bearer) | **Real** — holder secret bound into the signed VC (`cnf`); only its hash stored |
| Credential revocation | **Real** — authenticated employer revokes; `/v` + console reflect it. (W3C Bitstring *encoding* still roadmap) |
| Employer authentication | **Real** — scrypt passwords + HMAC-signed sessions; one-click seeded demo login |
| AI-score transcript integrity | **Real** — the graded transcript is the **server-recorded** one, not a client payload |
| Hash-chained audit log | **Real** — Postgres trigger hashes the full canonical row atomically; `verify_audit_chain()` re-checks |
| Single-round "face present" attestation | **Partial (honest)** — server validates the challenge sequence + spoken nonce + timing; the "face present" signal is **client-attested** (real anti-spoof runs in-browser; sending raw frames would break the privacy design). *Cross-round* match is fully server-side. |
| Certified anti-deepfake / injection PAD | **Not claimed** — challenge-response liveness, *not* ISO 30107-3-certified PAD; a certified vendor (iProov/Incode) is the production swap-in |
| Cross-round match FAR/FRR | **Not yet measured** — threshold 0.30 is a sensible default; result is **human-review-gated, never an auto-reject** |
| Bias / fairness audit | **Real (small-N)** — four-fifths over real scored sessions with **opt-in, aggregate-only** demographics; small cells suppressed; emits an Ed25519-signed, did:web-verifiable certificate |
| Continuous post-hire re-verification | **Real (demo)** — holder re-passes liveness via a secret-gated link; cross-round match flags MISMATCH. Scheduling is pull-based (no background cron) |
| DigiLocker issuance | **Demo sandbox (real contract)** — mirrors DigiLocker's Issued-Documents pull (HMAC-signed `POST /api/digilocker/pull`); **no real Aadhaar/Meri-Pehchaan call** |
| Issuer key management | **Roadmap** — key is an env var today, isolated behind one `Signer` boundary; KMS/HSM + rotation wiring is the top hardening item ([SECURITY.md](SECURITY.md)) |
| ATS write-back | **Mock / demo** — clearly-labelled endpoint returns `mock: true` (authenticated + audited); no real Workday/Greenhouse/Lever call |
| SSO/SCIM, SOC 2 | **Roadmap** |

> We would rather a reviewer read these limits here than discover them in a demo. **Calibrated claims over absolutes** is the whole posture.

---

## 10. Setup — run it locally

**Prerequisites:** Node 20+ (built on 24), a Supabase project, and either a Vercel AI Gateway (Claude) or a free Google Gemini API key.

```bash
git clone https://github.com/Anshuu2004/hireproof.git
cd hireproof
npm install

# configure environment
cp .env.example .env.local      # then fill in the values (see table below)

# apply the database schema to your Supabase project
npx supabase link --project-ref <your-ref>
npx supabase db push            # creates 16 tables + pgvector + cross-round match fn + audit trigger

# generate the Ed25519 issuer keypair (writes ISSUER_*_KEY_HEX) — or set your own
node -e "const{generateKeyPairSync}=require('crypto');const{publicKey,privateKey}=generateKeyPairSync('ed25519');const h=s=>Buffer.from(s,'base64url').toString('hex');console.log('ISSUER_PRIVATE_KEY_HEX='+h(privateKey.export({format:'jwk'}).d));console.log('ISSUER_PUBLIC_KEY_HEX='+h(publicKey.export({format:'jwk'}).x));"

npm run dev                      # http://localhost:3000  (use Chrome/Edge for camera+mic)
```

The MediaPipe WASM + the face-api / face-landmarker models are committed under `public/` (≈13 MB) so the app works **offline with no CDN dependency.**

**Scripts:** `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` (Vitest trust core) · `npm run verify:demo` (offline sign→verify→tamper→reject) · `npm run seed:demo` (mint 3 demo credentials + QR codes).

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB writes (never exposed to client) |
| `ISSUER_PRIVATE_KEY_HEX` / `ISSUER_PUBLIC_KEY_HEX` | Ed25519 credential-signing keypair |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini (failover / no-card LLM) |
| `AI_GATEWAY_API_KEY` *(optional)* | Vercel AI Gateway key for Claude in local dev (OIDC is automatic on Vercel) |
| `LLM_PRIMARY` | `claude` or `gemini` — provider preference order |
| `ISSUER_DID`, `NEXT_PUBLIC_SITE_URL` *(optional)* | Auto-derived from the Vercel domain if unset |

---

## 11. Tests — the trust core (`npm test`)

`npm test` runs a **Vitest suite (20 tests)** over the security-critical paths an employer's trust actually rests on — exercising the *real* `lib/` code, with no network, DB, or API keys. All run in **CI on every push**, alongside lint, typecheck, and the offline verifier.

- **Credential lifecycle** — [`tests/credential.test.ts`](tests/credential.test.ts): a genuine credential verifies; a **tampered claim**, an **expired** token, a **foreign key**, and a **wrong issuer** are each rejected; the **holder binding** (`cnf`) can't be re-bound without breaking the signature; a **rotated key** still verifies while published as retired, then fails once removed.
- **Audit hash-chain** — [`tests/audit-hash.test.ts`](tests/audit-hash.test.ts): editing **any** persisted field, the timestamp, or the row order changes the digest. The same `lib/audit-hash.ts` is shared by the app and mirrored by the Postgres trigger.
- **Appropriate-reliance scoring** — [`tests/reliance.test.ts`](tests/reliance.test.ts): an over-relier and a blanket-rejecter both score 50; only a calibrated candidate (accept-correct **and** reject-wrong) scores 100.

---

## 12. Repository structure

```
hireproof/
├─ app/
│  ├─ page.tsx                     # landing
│  ├─ verify/                      # candidate flow (consent → liveness → task → mint)
│  ├─ v/                           # public no-login verify page (offline)
│  ├─ employer/                    # employer console + seat-swap re-verify
│  ├─ fairness/  metrics/  rings/  # signed bias audit · live metrics · cross-employer rings
│  ├─ .well-known/did.json/        # did:web issuer key (active + retired)
│  └─ api/                         # 29 routes: session · liveness · task · assistant · score · mint ·
│                                  #   credential/{revoke,prove,erase} · employer/* · digilocker/* · work/* · ...
├─ components/                     # wordmark, credential-card, verify/* (consent, liveness, task, mint)
├─ lib/
│  ├─ ai/        (gateway, task, scorer, reliance)  # Claude/Gemini failover + locked rubric + RAIR/RSR
│  ├─ credential/(issuer, signer)            # Ed25519 sign/verify + did:web + holder cnf (key isolated)
│  ├─ auth/      (session)                   # scrypt password + HMAC-signed employer sessions
│  ├─ liveness/  (challenge)                 # randomised challenge + transcript match
│  ├─ bias/ digilocker/                      # four-fifths fairness · DigiLocker doc contract
│  ├─ audit.ts  audit-hash.ts  supabase/admin.ts  env.ts  ratelimit.ts  # hash-chained audit, DB, typed env
├─ tests/                          # Vitest trust core — credential · audit-chain · reliance (20 tests)
├─ scripts/verify-credential.mjs   # standalone offline verifier (also a CI smoke test)
├─ supabase/migrations/            # 12 migrations: schema + pgvector + cross-round + audit trigger + ...
├─ docs/                           # architecture.md · market-landscape.md · DEMO.md · adr/ (7 records)
├─ .github/workflows/ci.yml        # lint · typecheck · 20 unit tests · offline verifier
└─ public/{mediapipe,models}/      # in-browser ML assets (version-matched, offline)
```

See also: [LICENSE](LICENSE) (Apache-2.0) · [SECURITY.md](SECURITY.md) · [COMPLIANCE.md](COMPLIANCE.md) · [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 13. Security & privacy

Raw video never leaves the device; only a 128-D descriptor + a salted hash are stored. **Candidates** are account-less — the credential *is* the identity, bound to a holder secret (proof-of-possession via the signed `cnf` claim) so it is not a pure bearer token. **Employers** authenticate (scrypt-hashed passwords + HMAC-signed sessions) to reach the console, and revocation is authenticated. Consent is itemised and revocable. No emotion/affect is ever inferred. The audit log is append-only and hash-chained over the full row server-side (re-checkable via `verify_audit_chain()`). Secrets live in `.env.local` (git-ignored) / Vercel env — never committed. Full threat model, including the conceded limits (env-var key, client-attested single-round face-present, unmeasured FAR/FRR): **[SECURITY.md](SECURITY.md)**.

---

## Sources

- **[1]** [Gartner — fake candidate profiles & interview fraud](https://www.gartner.com/en/newsroom) · [Sherlock AI — Rise of AI Interview Fraud 2026](https://www.withsherlock.ai/blog/rise-of-ai-interview-fraud) · [The Hacker News — Deepfake Job Hires](https://thehackernews.com/expert-insights/2026/01/deepfake-job-hires-when-your-next.html)
- **[2]** [U.S. DOJ — nationwide actions vs North-Korean remote IT workers (Nov 2025)](https://www.justice.gov/opa/pr/justice-department-announces-coordinated-nationwide-actions-combat-north-korean-remote) · [TechCrunch — takedown](https://techcrunch.com/2025/06/30/us-government-takes-down-major-north-korean-remote-it-workers-operation/)
- **[3]** [Fake candidates top 2026 hiring threats — Cumberlink](https://cumberlink.com/exclusive/article_f4ddc3f4-7b1b-5848-83aa-be576e09d838.html) · [Detecting candidate fraud 2026 — Bridgeview](https://www.bridgeviewit.com/blog/detecting-candidate-fraud/)
- **[4]** [Persona raises $200M at $2B valuation — PitchBook](https://pitchbook.com/news/articles/persona-id-verification-cybersecurity-raises-200m) · [Persona — 75M deepfakes blocked (PRNewswire)](https://www.prnewswire.com/news-releases/persona-raises-200m-at-2b-valuation-to-build-the-verified-identity-layer-for-an-agentic-ai-world-302442649.html) · [Incode seeks $3B valuation — Bloomberg](https://www.bloomberg.com/news/articles/2025-11-19/id-verification-startup-incode-seeks-up-to-3-billion-valuation)
- **[7]** [HackerRank AI Fluency Evaluation](https://support.hackerrank.com/articles/1773201418-ai-usage-summary) · [CodeSignal AI-Assisted Assessments](https://codesignal.com/blog/introducing-ai-assisted-coding-assessments-interviews/)
- **[8]** [W3C publishes Verifiable Credentials 2.0 as a Standard (May 2025)](https://www.w3.org/press-releases/2025/verifiable-credentials-2-0/) · [Velocity Network Foundation](https://www.velocitynetwork.foundation/)

*Built for InnovateZ 2026 · Team DOMINATORS. Prototype — calibrated claims over absolutes.*
