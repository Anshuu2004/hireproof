# ADR 0006 — Holder proof-of-possession via a committed secret (`cnf`)

- **Status:** Accepted (2026-06-21)
- **Context:** The credential was a **bearer token** — anyone holding the QR/JWS
  could present it as theirs. ADR 0002 flagged full holder binding (DID/key-based,
  e.g. OID4VP key binding) as roadmap. We needed a *real* ownership proof now,
  without breaking the offline-signature-verify promise or shipping a full SSI
  protocol under deadline.

## Decision

At mint, generate a random **holder secret**; store only its `sha256`
(`credentials.holder_secret_hash`) and **commit that hash inside the signed VC**
as a `cnf` (RFC 7800 confirmation) claim. The secret is shown to the candidate
**once**. Ownership is proven at `POST /api/credential/prove` by presenting the
secret; the server confirms `sha256(secret)` matches — it never stores the secret.

## Consequences

- The credential is **no longer a pure bearer token**: possession of the QR is not
  enough to *prove ownership*. Because the hash is inside the signature, the
  binding cannot be altered without breaking the Ed25519 signature.
- Offline signature verification is unchanged (the `cnf` claim is just extra
  payload); the ownership check is an **online** step, by design.
- **Honest scope:** this is a **shared-secret** PoP, not yet DID-/key-based holder
  binding (OID4VP / SD-JWT-VC key binding) — that remains the roadmap step, and a
  lost secret can't be rotated yet. It does not stop a holder from voluntarily
  sharing their secret. It *does* stop a stolen-credential-presenter from proving
  ownership. Disclosed in `SECURITY.md`.
