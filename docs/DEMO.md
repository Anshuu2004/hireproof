# HireProof — Demo Scenario & Honest Status

This is the judge-facing walkthrough: one end-to-end story you can run in ~90
seconds, three pre-signed credentials you can verify in 10 seconds, and an
explicit table of what is real vs mocked vs roadmap.

---

## The 90-second killer demo (one loop, two contrasting runs)

The product proves one thing: **a candidate is a live human who can direct an AI
*and catch it when it's confidently wrong* — captured in an unforgeable,
offline-verifiable credential.** The fastest way to see it is to run the same
flow twice.

1. **Open `/verify`.** Pick a language, grant camera + mic (itemised DPDP
   consent). The server issues a *randomised* liveness challenge (e.g.
   blink → turn → speak a 3-digit nonce) the instant you start — it can't be
   pre-staged.
2. **Pass liveness.** MediaPipe reads the actions in-browser; a 128-D face
   descriptor is computed locally (raw video never leaves the device).
3. **The AI-collaboration task.** You're handed a task and an AI assistant
   (Claude/Gemini via Vercel AI Gateway). The AI's first answer contains **one
   deliberately planted error** (e.g. an `INNER` vs `LEFT JOIN` bug, a wrong
   denominator).
   - **Run A — good judgment:** spot the error, correct it. → score lands ~**67**
     (`Direct · Judge · Correct` bands all healthy).
   - **Run B — blind accept:** take the AI's answer as-is. → the deterministic
     verbatim-copy signal fires and the score is **hard-capped ≤ 40** (~**32**).
   The contrast is the whole point: HireProof scores *judgment*, not *usage*.
4. **Mint.** The server assembles a W3C VC 2.0, Ed25519-signs it, binds a holder
   secret (`cnf`), and renders a QR.
5. **Verify offline.** Open `/v`, scan the QR (or paste the token). The browser
   fetches the issuer key from `/.well-known/did.json` and verifies the Ed25519
   signature **with no server call** — throttle your network to prove it. You see
   the score breakdown and an honest "what this proves / does not prove" block.
6. **Round 2 — catch a proxy.** Re-verify the credential with a *different* face:
   the cross-round biometric match (pgvector cosine distance) flags a **MISMATCH**
   — the proxy/seat-swap case.

---

## Instant verification (no flow required) — 3 pre-signed credentials

Run `npm run seed:demo`. It signs **three real credentials with the production
issuer key** and writes QR codes to `docs/demo/`:

| Credential | Score | What it shows at `/v` |
|---|---|---|
| `GOOD` (`docs/demo/good.png`) | **67** | Valid signature; caught + corrected the planted error |
| `BLIND` (`docs/demo/blind.png`) | **32** | Valid signature; blind-accepted the AI → the ≤40 cap |
| `REVOKED` (`docs/demo/revoked.png`) | 70 | Signature valid **but revoked** → revocation banner (server status check) |

The script prints a `/v#…<token>` link for each. Open `GOOD` and `BLIND`
side-by-side to make the score legible instantly; open `REVOKED` to show the
lifecycle. `node scripts/seed-demo.mjs clean` removes them.

> These verify offline against the published `did.json`. The signatures are
> genuine — not mocked.

---

## Employer console

Open `/employer` → **one-click demo login** (`demo@hireproof.app` / `demo1234`,
seeded by migration `20260621140000_real_features.sql`). You can:
- list verified credentials, filter, and open a record;
- **revoke** a credential (reflected at `/v`);
- **re-verify (round 2)** to trigger the cross-round biometric check;
- read the **hash-chained audit trail** (`select * from verify_audit_chain()` is
  the server-side integrity check);
- push to an ATS — which returns `mock: true` (see below; honest by design).

---

## What is REAL / MOCK / ROADMAP (the honest part)

**REAL, end-to-end:**
- Active challenge-response liveness (randomised actions + spoken nonce + timing).
- Cross-round biometric continuity (128-D descriptors, pgvector cosine match).
- Planted-error AI task; server-recorded transcript; deterministic signals +
  temp-0 locked-rubric grader; verbatim hard-cap.
- Ed25519-signed W3C VC 2.0, QR, **offline verification** via did:web.
- Holder proof-of-possession (`cnf`), credential revocation.
- Employer auth (scrypt + HMAC sessions), hash-chained audit log.
- Issuer key isolated behind a single `Signer` boundary; **key rotation
  supported** (did:web publishes active + retired keys).

**MOCK (clearly labelled, real contract/shape):**
- **ATS write-back** (`/api/employer/ats-writeback`) — returns `mock: true`; shows
  the Workday/Greenhouse/Lever push shape, makes no external call.
- **DigiLocker** (`/api/digilocker/*`) — real HMAC-signed contract + DPDP consent,
  but sandbox only; no real Aadhaar/Meri-Pehchaan call.

**ROADMAP (disclosed in SECURITY.md):**
- KMS/HSM-backed signing (the `KmsSigner` stub is not wired).
- Empirically measured cross-round FAR/FRR (threshold 0.3 is human-review-gated).
- Certified PAD (ISO/IEC 30107-3) — current liveness is anti-spoof, not certified.
- Enterprise auth (SSO/SAML/SCIM/MFA), external audit-log anchoring, SOC 2.

Seeded/synthetic data is labelled as such (`/metrics`, `/fairness`, `/rings`).

---

## Run it

**Local:**
```bash
cp .env.example .env.local      # fill in Supabase + issuer keys (gen command in .env.example)
npm install
npm run dev                     # http://localhost:3000
npm test                        # offline credential security smoke test (5 assertions)
npm run seed:demo               # mint the 3 demo credentials + QR codes
```

**Deploy (Vercel):** the repo is Vercel-ready ([vercel.json](../vercel.json) pins
region `bom1`; the issuer DID + site URL derive from the production domain).
1. `vercel` (link/create the project).
2. Set env vars in the Vercel project: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ISSUER_PRIVATE_KEY_HEX`, `ISSUER_PUBLIC_KEY_HEX` (optional:
   `AI_GATEWAY_API_KEY`, `ISSUER_DID`, `NEXT_PUBLIC_SITE_URL`).
3. Apply `supabase/migrations/*` to the Supabase project (includes the demo
   employer seed).
4. `vercel --prod`, then `npm run seed:demo` (with `.env.local` pointing at prod
   Supabase + the prod `ISSUER_DID`) to publish the verifiable demo credentials.
