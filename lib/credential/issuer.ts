import { createHash } from "crypto";
import { jwtVerify, importJWK, type JWK, type JWTPayload } from "jose";
import { env } from "@/lib/env";
import { getSigner } from "./signer";

/**
 * HireProof credential issuance & verification.
 * A credential is an EdDSA (Ed25519) compact JWS (JWT-VC shape, W3C VC 2.0
 * context) signed by the HireProof issuer key. It is self-contained and
 * verifiable offline against the public key(s) published at /.well-known/did.json
 * (did:web). No DB lookup is required to prove authenticity.
 *
 * Signing is delegated to a single Signer (lib/credential/signer.ts) so the
 * private key lives in exactly one place; verification uses only public keys.
 */

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  // Fail LOUD on a malformed key (odd length / non-hex) instead of silently
  // producing a truncated/NaN-filled key that breaks every signature opaquely.
  if (clean.length === 0 || clean.length % 2 !== 0 || !/^[0-9a-f]+$/.test(clean)) {
    throw new Error("Invalid issuer key hex: expected an even-length hex string (check ISSUER_*_KEY_HEX).");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  if (out.length !== 32) throw new Error("Invalid issuer key: expected 32 bytes (64 hex chars) for Ed25519.");
  return out;
}
const b64url = (b: Uint8Array) => Buffer.from(b).toString("base64url");

const pubJwk = (hex: string): JWK => ({ kty: "OKP", crv: "Ed25519", x: b64url(hexToBytes(hex)) });

/** The active issuer public key (the one new credentials are signed against). */
export function publicJwk(): JWK {
  return pubJwk(env.issuerPublicKeyHex);
}

/**
 * Every public key a verifier should trust: the active key plus any retired keys
 * still published during a rotation window. Outstanding 180-day credentials keep
 * verifying after the active key changes, because did:web publishes both and a
 * credential is accepted if it validates against ANY published key.
 */
export function publicJwks(): JWK[] {
  return [publicJwk(), ...env.issuerRetiredPublicKeysHex.map(pubJwk)];
}

export interface CredentialClaims {
  humanVerified: boolean;
  livenessPassed: boolean;
  aiCollaboration: { score: number; direct: number; judge: number; correct: number };
  faceDescriptorHash: string;
  rounds: number;
}

/** Salted, one-way hash of a face descriptor — never the raw biometric. */
export function descriptorHash(descriptor: number[], salt: string): string {
  return createHash("sha256").update(salt + "|" + descriptor.map((x) => x.toFixed(4)).join(",")).digest("hex");
}

export async function signCredential(
  claims: CredentialClaims,
  credentialId: string,
  expiresInDays = 180,
  holderCommit?: string
): Promise<string> {
  const vc = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "HireProofCredential"],
    issuer: env.issuerDid,
    credentialSubject: claims,
  };
  // `cnf` (RFC 7800 confirmation) commits the holder-secret hash inside the
  // signature, so the credential is bound to its holder (not a pure bearer
  // token) and the binding cannot be altered without breaking the signature.
  const payload: Record<string, unknown> = { vc, hp: claims };
  if (holderCommit) payload.cnf = { "x-hp-holder": holderCommit };

  return getSigner().sign(payload, {
    issuer: env.issuerDid,
    subject: credentialId,
    jti: credentialId,
    expiresIn: `${expiresInDays}d`,
  });
}

/**
 * Sign an arbitrary JSON payload with the issuer key (EdDSA JWT) — used for
 * portable, independently-verifiable artifacts beyond the credential itself,
 * e.g. a DPDP consent receipt. Verifiable against the same /.well-known/did.json
 * key as a credential.
 */
export async function signDetached(payload: Record<string, unknown>, expiresIn = "365d"): Promise<string> {
  return getSigner().sign(payload, { issuer: env.issuerDid, expiresIn });
}

export interface VerifiedCredential {
  valid: boolean;
  reason?: string;
  payload?: JWTPayload & { hp?: CredentialClaims; vc?: unknown };
}

export async function verifyCredential(token: string): Promise<VerifiedCredential> {
  let reason = "signature invalid";
  // Accept the credential if it verifies against any currently-published issuer
  // key (active or, during rotation, a still-trusted retired key). The token's
  // `kid` is a hint; trust is the published key set, so this is robust to a kid
  // that doesn't map 1:1 after a rotation.
  for (const jwk of publicJwks()) {
    try {
      const key = await importJWK(jwk, "EdDSA");
      const { payload } = await jwtVerify(token, key, { issuer: env.issuerDid });
      return { valid: true, payload };
    } catch (e) {
      // Surface an expiry reason over a generic signature failure from other keys.
      const next = e instanceof Error ? e.message : "signature invalid";
      if (reason === "signature invalid" || (e as { code?: string })?.code === "ERR_JWT_EXPIRED") reason = next;
    }
  }
  return { valid: false, reason };
}

/** The did:web document published at /.well-known/did.json. */
export function didDocument() {
  const active = {
    id: env.issuerKid,
    type: "JsonWebKey2020",
    controller: env.issuerDid,
    publicKeyJwk: publicJwk(),
  };
  const retired = env.issuerRetiredPublicKeysHex.map((hex, i) => ({
    id: `${env.issuerDid}#retired-${i + 1}`,
    type: "JsonWebKey2020",
    controller: env.issuerDid,
    publicKeyJwk: pubJwk(hex),
  }));
  const methods = [active, ...retired];
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
    id: env.issuerDid,
    verificationMethod: methods,
    assertionMethod: methods.map((m) => m.id),
  };
}
