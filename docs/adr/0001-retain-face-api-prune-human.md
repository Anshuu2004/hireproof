# ADR 0001 — Retain @vladmandic/face-api for descriptors; prune @vladmandic/human

- **Status:** Accepted (2026-06-21)
- **Context:** The repo carried both `@vladmandic/face-api` and
  `@vladmandic/human`, plus `@noble/ed25519` / `@noble/hashes`. A casual reading
  ("face-api is in maintenance mode") might suggest dropping face-api in favor of
  Human. A direct code audit on 2026-06-21 showed the opposite.

## Decision

- **Keep `@vladmandic/face-api`.** It is **load-bearing**: it produces the 128-D
  face descriptor that the cross-round biometric match depends on
  (`components/verify/liveness-step.tsx`; `/api/liveness` enforces a length-128
  vector; `SAME_PERSON_THRESHOLD = 0.3`). The headline seat-swap demo breaks
  without it.
- **Remove `@vladmandic/human`.** It is imported **nowhere** in the source —
  carrying it only invites the "why is this dependency here?" question and bloats
  install.
- **Remove `@noble/ed25519` and `@noble/hashes`.** Signing is done entirely with
  `jose` (see ADR 0002); the noble packages are unused. The README previously
  implied noble was used for signing — corrected.

## Consequences

- Smaller, honest dependency set; `npm ci` in CI stays meaningful.
- The deliberate retention of face-api (stable embeddings) is documented, with a
  potential future migration to Human as **roadmap, not urgent**.
- A reviewer auditing dependencies finds intent, not cruft.
