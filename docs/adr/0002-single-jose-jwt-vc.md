# ADR 0002 — A single `jose` EdDSA JWT-VC over a full VC framework (walt.id/Veramo)

- **Status:** Accepted (2026-06-21)
- **Context:** HireProof issues W3C Verifiable Credentials. Options ranged from a
  full SSI stack (walt.id, Veramo, Credo/Aries) to a minimal JWS-based VC.

## Decision

Issue the credential as an **EdDSA (Ed25519) compact JWS in JWT-VC shape**
(W3C VC 2.0 `@context`), signed with **`jose`**, issuer identified by **did:web**
with the public key at `/.well-known/did.json`.

## Rationale

- **Offline, dependency-light verification is the product's core promise.** A
  JWT-VC verifies against the public key alone — no agent, ledger, wallet
  protocol, or DB lookup. That is exactly the "verify in seconds, anywhere" claim.
- **Ed25519** is small, fast, and ubiquitously supported (WebCrypto, `jose`),
  ideal for a QR-sized credential and in-browser verification.
- **did:web** needs only HTTPS + a well-known document — no ledger, no fees, no
  new trust root for an employer to learn.
- A full SSI framework adds protocol surface (DIDComm, ledger DIDs, status
  registries) we don't need for the demo and that would obscure the crypto.

## Consequences / trade-offs

- We forgo, **for now**, selective disclosure and standardized presentation
  exchange. **SD-JWT-VC + OID4VCI/OID4VP are roadmap** for eIDAS-wallet interop.
- **Key management is the main risk:** the issuer private key is currently an env
  var (`ISSUER_PRIVATE_KEY_HEX`). Production must move it to **KMS/HSM with
  rotation and a published issuer-trust statement** — the #1 hardening item
  (see `SECURITY.md` T1). did:web makes key rotation a document update.
- Revocation works today via the DB status route; the **W3C Bitstring Status
  List 2021 encoding** is roadmap for interop.
