# Contributing to HireProof

Thanks for your interest. HireProof is a credential-issuing system that handles
biometric-derived data — correctness and honesty matter more than speed.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill Supabase + issuer keys (see the table in README)
npm run dev
```

## Before you push

CI runs three gates on every push/PR (`.github/workflows/ci.yml`):

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run verify:demo # offline credential verifier: sign → verify → tamper → reject
```

All three must pass.

## Ground rules

- **No emotion AI.** Never add inference of emotion, enthusiasm, confidence, or
  "fit." Liveness is anti-spoof only; scoring is task-output/judgment only
  (EU AI Act Art 5(1)(f)). This is a hard line — see `COMPLIANCE.md`.
- **Minimize biometrics.** Raw video must never persist server-side. Store the
  128-D descriptor and a salted hash only.
- **Don't break the audit chain.** `audit_log` is hash-chained server-side; never
  bypass `appendAudit` or mutate rows directly. Re-check with
  `select * from verify_audit_chain()`.
- **Record significant decisions as ADRs** in `docs/adr/`.
- **Be honest about scope.** If something is mocked or partial, label it — in
  code comments, the README honesty table, `SECURITY.md`, and `COMPLIANCE.md`.

## Security

Report vulnerabilities privately — see `SECURITY.md`. Do not open public issues
for security problems.
