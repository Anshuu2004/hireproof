# ADR 0004 — Server-side, full-row hash chain for the audit log

- **Status:** Accepted (2026-06-21), supersedes the original JS implementation
- **Context:** The append-only `audit_log` is the explainability/traceability
  trail (DPDP / EU AI Act) and the "why this score" evidence source. The original
  implementation had two real defects, found on audit:
  1. `row_hash = sha256(prev_hash | JSON.stringify(output))` hashed **only the
     `output` field** — `id`, `session_id`, `event_type`, `created_at`,
     `model_version` sat outside the chain and could be edited (or rows reordered)
     without breaking it. It was **not** tamper-evident over the record.
  2. It did **read-last-hash-then-insert in app code with no lock**, so concurrent
     appends could read the same tip and **fork/duplicate** the chain.

## Decision

Move chaining **into the database**. Migration
`20260621120000_audit_chain_hardening.sql` adds:

- a dedicated monotonic `seq` (independent of the bigserial `id`);
- a single canonical-hash function `audit_row_hash(...)` over the **full row**
  (seq, id, session, event_type, input_hash, output, model/prompt version,
  UTC ISO timestamp), used by the trigger, the backfill, and the verifier so they
  cannot drift;
- a `BEFORE INSERT` trigger that takes a **transaction-scoped advisory lock**,
  assigns `seq`, reads the committed tip, and sets `prev_hash` + `row_hash`
  atomically — so two appends cannot fork the chain;
- `verify_audit_chain()` which recomputes the whole chain and returns the first
  break (if any). Existing rows are re-chained under the new scheme.

App code (`lib/audit.ts`) is a defense-in-depth second layer: it computes a hash
over the **full set of application fields** (not just `output`) so the chain is
already fixed even before the migration is applied, then reads back whatever the
trigger actually stored. With the migration applied, the trigger's atomic
full-row hash (including the db-assigned `id` and `seq`) supersedes it. This makes
deploying the app before the migration safe.

## Consequences

- Editing **any** persisted field, or reordering rows, now breaks the chain —
  honestly "tamper-evident" within the database.
- Appends are serialized for the chain step (low-concurrency audit writes — not a
  hot path), eliminating the fork race.
- **Scope (disclosed):** this is in-database tamper-evidence, **not** an external
  anchor. Cross-organization non-repudiation via periodic root publication
  (e.g. to a public log) is roadmap.
