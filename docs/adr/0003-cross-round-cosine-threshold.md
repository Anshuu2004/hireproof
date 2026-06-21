# ADR 0003 — Cross-round biometric continuity via pgvector cosine distance 0.3

- **Status:** Accepted (2026-06-21)
- **Context:** A proxy/seat-swap ring passes round 1 with candidate A and
  substitutes impostor B in round 2. One-time ID checks miss this; we need
  continuity *across* interview rounds.

## Decision

Store an L2-normalized **128-D face descriptor** per round in **pgvector** and
compare rounds with **cosine distance**, flagging a likely different person above
a threshold of **0.3** (`SAME_PERSON_THRESHOLD`).

## Rationale

- Descriptors are produced locally (face-api) so raw biometrics never persist;
  pgvector keeps the match in the same Postgres we already run, with an HNSW index.
- 0.3 cosine distance is a conservative starting separation for the face-api
  embedding space — tight enough to catch a substitution, loose enough to absorb
  normal lighting/pose variation between sessions.

## Consequences / honest limitations

- **FAR/FRR is not yet empirically measured.** 0.3 is a sensible default, not a
  validated operating point. This is disclosed in `SECURITY.md` (T4).
- Therefore the outcome is **decision-support, human-review-gated — never an
  automatic reject.** Wrongly flagging a genuine candidate as a seat-swap is the
  failure we most want to avoid.
- **Roadmap:** measure FAR/FRR on a labeled set, expose the threshold as policy,
  and document the operating point per deployment.
