# HireProof — Competitive Landscape

*Calibrated claims over absolutes. We name real competitors and concede what is not a moat — same
voice as the [README honest-status](../README.md#10-honest-status--whats-real--partial--mocked) table.*

## Verdict

Every individual pillar HireProof stands on **already exists in the market — several as mature,
well-funded products.** What we could **not** find anywhere is a single product that fuses all three —
a live human-proof, an AI-collaboration *judgment* score, and cross-round biometric re-verification —
into **one candidate-owned, offline-verifiable cryptographic credential.** That intersection is our
position. It is a **timing window, not a moat**: the market is converging on exactly this fusion
*right now* (2025–2026).

## Where we sit (gap analysis)

| Capability | HackerRank / CodeSignal | Cicero / Willo (fraud) | Velocity / Dock (VC) | iProov / Persona (IDV) | **HireProof** |
|---|:--:|:--:|:--:|:--:|:--:|
| Score AI-collaboration *judgment* (planted error) | ~ generic | ✗ | ✗ | ✗ | **✓ specific mechanic** |
| Live anti-proxy / anti-deepfake liveness | ✗ | ✓ | ✗ | ✓ certified | ✓ challenge-response |
| Cross-round biometric re-verify (seat-swap) | ✗ | ~ | ✗ | ~ onboarding | **✓** |
| Candidate-owned, offline-verifiable W3C credential | ✗ | ✗ | ✓ | ✗ | **✓** |
| **All three fused in ONE token** | ✗ | ✗ | ✗ | ✗ | **✓ ← the novelty** |
| India DPDP + EU AI Act compliant-by-design | ~ | ~ | ~ | ~ | **✓ explicit** |

**No competitor fills the bottom three rows together.**

## Segment by segment

**1. AI-collaboration / AI-judgment assessment — most crowded, fastest-moving.** It is no longer novel
to score *how a candidate works with AI*. HackerRank shipped an AI-assisted IDE and an AI Interviewer at
AI Day 2025 (~172,800 assessments/day) [1][2]; CodeSignal and CoderPad shipped AI-assisted live
environments [3]; Karat positions for the "Human + AI era" [10]. The industry (Deel, SHRM) openly
names the **"AI-evaluation skills" gap** — but as emerging consensus, not a shipped product with our
exact mechanic [7][8]. **Our edge:** the *hidden planted error the candidate never saw* + a deterministic
verbatim-cap is a concrete, anchored implementation of what others only discuss abstractly. The
*mechanic* is differentiated; the *category* is not — and the mechanic is copyable once seen.

**2. Deepfake / proxy interview-fraud detection — a 2025–2026 land-grab.** InterviewGuard, Sherlock AI,
and Resemble AI do real-time deepfake/proxy detection. **Cicero Interview** already combines identity
verification + liveness + nonlinear interview paths — our closest fusion competitor on the fraud side.
**Willo** pairs async structured interviews with automated authenticity checks. The problem is tier-1
sourced (Greenhouse 2025: 31% of hiring managers hit a suspected/confirmed deepfake candidate; Gartner:
6% admit interview fraud; 320+ companies in the NK IT-worker scheme), which validates our problem
statement. **Our edge:** privacy-first (raw video never leaves the device; only a 128-D descriptor + hash
are stored) and candidate-owned, vs. the detection-arms-race + surveillance model.

**3. Candidate-owned verifiable credentials — mature and standardised; we are not first.**
Velocity Network / Velocity Career Labs ships a free, self-sovereign, candidate-owned "Career Wallet"
(W3C VC) [5]; Dock and Indicio issue/revoke W3C workforce credentials; JFF/SkillRise drive skills-wallet
adoption; Cisive frames VCs as hiring-trust. **Our edge:** not the credential plumbing (W3C VC, did:web,
Ed25519, holder binding, revocation are all standard) but **what the credential attests** — a *live,
anti-proxy, skill event*, not a past education/employment record. Velocity attests history; we attest a
moment.

**4. Identity verification / liveness (IDV) — mature vendor category we concede.** iProov and Incode
(our named production swap-ins), Persona (recently graduated candidate verification), Onfido, Shufti,
Ondato, ID Dataweb. We **do not** claim to out-detect them — ours is challenge-response liveness, *not*
ISO 30107-3-certified PAD. **Our edge:** *cross-round* re-verification tied to one credential, which
onboarding-only IDV misses.

**5. Proof-of-personhood credentials — adjacent.** Worldcoin/World, Humanity Protocol (palm biometrics),
Passport (human.tech), and the MIT/OpenAI "personhood credentials" research prove "you're a unique human"
as a portable credential — overlapping pillars 1 and 3, but **not hiring-specific and with no AI-judgment
scoring.**

## Honest risks to the novelty

1. **Convergence is happening now.** Cicero and Willo already fuse identity + liveness + assessment.
   Either adding a portable W3C credential *or* an AI-judgment rubric closes the gap. The moat is
   integration + execution speed + India compliance, not any single technology.
2. **Incumbent risk.** HackerRank (172k/day) could bolt on identity + a credential; Velocity could add a
   live-assessment issuer; Persona could add skills. Each already owns one pillar.
3. **The "planted error" mechanic is copyable** once seen — clever assessment design, not defensible IP.
4. **Certified PAD is conceded** — enterprise-grade anti-deepfake depends on swapping in iProov/Incode,
   so pillar 1 is not a true differentiator versus them.
5. **Adoption chicken-and-egg** — a candidate-owned credential is only worth what employers accept;
   Velocity has spent years building an issuer/verifier network that a prototype has not.

## What is genuinely defensible (lead with these)

- **The fusion + candidate-owned framing** ("the candidate owns the proof") — no one ships it.
- **Measuring AI *judgment* (catch + correct), not AI *usage*** — ahead of most vendors.
- **India-first + DPDP + EU AI Act compliant-by-design + no emotion inference** — a real, narrowing
  regulatory wedge that US-centric incumbents handle weakly.
- **Privacy architecture** (raw video never leaves the device) — a compliance and marketing
  differentiator versus surveil-everyone detection vendors.
- **The unforgeable, execution-anchored answer to the fake-credential problem** — rather than joining
  the detection arms race (catching fake certificates after the fact), HireProof makes the credential
  impossible to forge AND anchors it to *execution under constraint* (catch + correct a planted AI
  error), not résumé completeness. Reinforces the candidate-owned trust-rail framing above.

## Sources

- [1] [HackerRank — AI-Assisted IDE Shoot-Out (Q3 2025)](https://www.hackerrank.com/writing/ai-assisted-ide-shootout-hackerrank-vs-codesignal-coderpad-q3-2025)
- [2] [HackerRank AI IDE vs standard platforms](https://www.hackerrank.com/writing/hackerrank-ai-ide-vs-standard-coding-assessment-platforms)
- [3] [CoderScreen — State of Technical Interviews 2025 (AI)](https://coderscreen.com/blog/state-of-technical-interviews-2025-ai)
- [5] [Velocity Career Labs](https://www.velocitycareerlabs.com/) · [Velocity Network Foundation — VCs in talent acquisition](https://www.velocitynetwork.foundation/verifiable-credentials-trust-and-truth-in-an-ai-enabled-talent-acquisition-market)
- [7] [Deel — AI literacy hiring-assessment gap](https://www.deel.com/deel-works/ai-literacy-hiring-assessment-gap/)
- [8] [SHRM — When candidates can fake skills in real time](https://www.shrm.org/labs/resources/when-candidates-can-fake-skills-real-time-assessment-design)
- [10] [Karat — technical interviews for the Human + AI era](https://karat.com/)
- Deepfake interview fraud: [Sherlock AI](https://www.withsherlock.ai/blog/rise-of-ai-interview-fraud) · [InterviewGuard](https://www.interviewguard.io/solutions/deepfake-detection)
- All-in-one verification (Cicero / Willo): [USA Staffing — talent authentication 2026](https://www.usastaffingservices.com/talent-authentication-secrets-revealed-how-to-verify-candidates-in-2026/) · [Willo — candidate assessment software](https://www.willo.video/blog/candidate-assessment-software)
- Verifiable credentials in hiring: [Dock — workforce case study](https://www.dock.io/case-study-workforce) · [Cisive — verifiable credentials & hiring trust](https://www.cisive.com/dont-get-played-podcast/verifiable-credentials-hiring-trust)
- Proof of personhood: [MIT Media Lab — personhood credentials](https://www.media.mit.edu/articles/how-personhood-credentials-could-help-prove-you-re-a-human-online/) · [Biometric Update — Humanity Protocol](https://www.biometricupdate.com/202602/humanity-protocol-pivots-from-proof-of-personhood-but-sticks-with-palm-biometrics)
- [Persona — candidate verification](https://www.computerweekly.com/blog/CW-Developer-Network/Persona-graduates-with-candidate-verification-for-job-identity-control)
- [AuthBridge — Workforce Fraud Files 2025 (India)](https://authbridge.com/workforce-fraud-files-2025/)

*Compiled June 2026 for InnovateZ 2026 · Team DOMINATORS. Directional market scan, not an audited report.*
