# ADR 0005 — Planted-error task + temperature-0, locked-rubric grader

- **Status:** Accepted (2026-06-21)
- **Context:** The product scores *AI-collaboration judgment*, not raw coding and
  not affect. The score must be reproducible, hard to game, and defensible under
  the EU AI Act (no emotion inference; human oversight).

## Decision

- Generate a task with a **server-planted error** the candidate must catch and
  correct. The hidden flaw is the ground truth.
- Fuse two signals:
  1. **Deterministic transcript signals** computed in code — e.g.
     `planted_error_caught`, an **accepted-verbatim hard cap** so blind relays
     cannot score well — these are not model-dependent.
  2. An **LLM grader at temperature 0** against a **locked rubric** (fixed axes),
     for the qualitative judgment dimension.
- Provider resilience via `ai/gateway.ts`: Claude (Vercel AI Gateway / OIDC) with
  automatic Gemini failover, order set by `LLM_PRIMARY`.

## Rationale

- **Temperature 0 + locked rubric** makes the qualitative score as reproducible
  as an LLM allows; the deterministic signals anchor the result so a flaky model
  response can't swing the verdict.
- **The planted error inverts the cheating arms race:** an overlay tool that
  relays the model's answer accepts the wrong answer verbatim and scores low — the
  cheater's own behavior is the failing signal. (We argue this logically with a
  real model completion; we do **not** claim to have tested against a specific
  commercial overlay.)
- **Compliance:** scoring is output/judgment only — never emotion, enthusiasm, or
  "fit." Scores are decision-support, never an automatic reject.

## Consequences

- The score is explainable: the audit log records inputs, model/prompt version,
  and the deterministic signals behind every result.
- Model brand is swappable (Claude/Gemini) — the determinism and rubric matter
  more than the vendor. The bias-audit methodology (four-fifths) is documented in
  `COMPLIANCE.md` (current data seeded/synthetic, labeled).
