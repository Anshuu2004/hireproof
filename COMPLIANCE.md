# Compliance by Design

HireProof is built to be defensible under the laws that govern biometric
verification and AI in hiring — **ahead of their enforcement dates**, not as a
claim that every statutory obligation is already operationally met. Dates and
statuses below were current as of **June 2026**; re-verify legislative status
before relying on any single date.

> Design principle: **No emotion AI.** Liveness is anti-spoof only; scoring is
> task-output/judgment only. We never infer emotion, enthusiasm, confidence, or
> "cultural fit." This is both a legal red line and a product stance.

## India — Digital Personal Data Protection (DPDP) Act 2023 + Rules 2025

- **Status:** Act passed 2023; DPDP Rules notified **13–14 Nov 2025**;
  substantive provisions take effect **13 May 2027**. We therefore frame our
  posture as **compliance-by-design ahead of the 13 May 2027 enforcement date**.
- **Our role, per data-flow (important — we are not uniformly a "processor"):**
  - **Data Fiduciary** for the verification we determine the purpose and means
    of: liveness challenge, biometric descriptor handling, AI-collaboration
    scoring, and credential issuance. Biometric + profiling invites
    Significant-Data-Fiduciary-grade scrutiny.
  - **Data Processor** only for data we handle strictly on an employer's behalf
    (e.g. their verification records) under their instructions.
- **Data minimization:** raw video never persists; only a 128-D descriptor
  (server-side) and a salted one-way hash (in the credential). Erasure = revoke
  credential + delete descriptor.
- **Consent:** itemized DPDP consent receipt captured per session
  (`sessions.consent_json`).
- **Residency:** primary data store is Supabase in **Mumbai (`ap-south-1`)**.
- **Note:** DPDP grants **no statutory data-portability right** — credential
  portability is **candidate-controlled cryptographic sharing**, not a legal
  portability claim. The credential is now **holder-bound** (a secret committed in
  the signed VC via `cnf`; ownership provable at `/api/credential/prove`) rather
  than a pure bearer token — so sharing is the holder's deliberate act.
- **Roadmap:** breach notification workflow to the Data Protection Board; formal
  DPA + DPIA pack; retention schedule for descriptors.

## EU — AI Act

- **Art. 5(1)(f) — prohibited practice (IN FORCE since 2 Feb 2025):** emotion
  recognition in the workplace is banned (fines up to €35M / 7% of global
  turnover). HireProof performs **no affect inference** — by design.
- **Annex III high-risk (employment):** obligations for AI used in recruitment.
  As of June 2026, **2 August 2026 remains the operative deadline.** A deferral
  to ~2 Dec 2027 (the "Digital Omnibus") is a **Commission proposal (19 Nov 2025)
  with only a provisional political agreement (May 2026) — it is NOT enacted.**
  Counsel (e.g. DLA Piper, Gibson Dunn, June 2026) advise continuing to prepare
  for **2 Aug 2026**. **Re-verify status before submission/deployment.**
- **High-risk readiness measures we already embody:** human oversight (scores are
  decision-support, never auto-reject), logging/traceability (hash-chained audit),
  transparency (the candidate sees and owns their credential), and a documented
  scoring rubric.

## AI hiring fairness (US + general)

- **Bias-audit method:** AI-derived hiring signals are high-risk. We document an
  **adverse-impact (four-fifths rule) methodology** for the AI-collaboration
  score (see `bias_audit_runs` table; current data is **seeded/synthetic —
  methodology demonstration**, clearly labeled). Aligns with **NYC Local Law 144**
  intent and **EEOC** four-fifths guidance.
- Note: the **Colorado AI Act was repealed** — we reference NYC LL144, Texas
  CUBI, and EEOC rather than treating it as live.

## Biometrics-specific

- **Active liveness** (challenge-response), explicitly **not** a certified
  ISO/IEC 30107-3 PAD and **not** NIST FATE-PAD (which is passive-only). Framed
  as anti-spoof defense-in-depth; a certified PAD vendor is the production
  swap-in for high-assurance contexts.
- BIPA/CUBI-style posture: notice + consent before capture, no sale of biometric
  data, minimization and a deletion path (deletion flow is roadmap).

## Standards alignment

- **W3C Verifiable Credentials 2.0** (Recommendation, 15 May 2025) — credential
  shape and `@context`.
- **DID Core / did:web** — issuer identifier and public-key publication.
- **Roadmap:** SD-JWT-VC selective disclosure (still an IETF draft) and
  OID4VCI/OID4VP issuance/presentation for EU/eIDAS-wallet interoperability;
  W3C Bitstring Status List 2021 encoding for revocation interop (revocation
  already works today via the DB status route).

## Honest limitations

This file describes **design intent and current posture**. Formal certifications
(SOC 2 Type II, ISO 27001/27701), a signed DPA, a completed DPIA, and a third-
party bias audit are **roadmap**, not done. We label what is built vs. planned so
no reviewer is misled.
