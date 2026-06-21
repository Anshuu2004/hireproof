import { createHash } from "crypto";
import { SignJWT, jwtVerify, importJWK, type JWK, type JWTPayload } from "jose";
import { env } from "@/lib/env";

/**
 * HireProof credential issuance & verification.
 * A credential is an EdDSA (Ed25519) compact JWS (JWT-VC shape, W3C VC 2.0
 * context) signed by the HireProof issuer key. It is self-contained and
 * verifiable offline against the public key published at /.well-known/did.json
 * (did:web). No DB lookup is required to prove authenticity.
 */

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
const b64url = (b: Uint8Array) => Buffer.from(b).toString("base64url");

function privateJwk(): JWK {
  return {
    kty: "OKP",
    crv: "Ed25519",
    d: b64url(hexToBytes(env.issuerPrivateKeyHex)),
    x: b64url(hexToBytes(env.issuerPublicKeyHex)),
  };
}
export function publicJwk(): JWK {
  return { kty: "OKP", crv: "Ed25519", x: b64url(hexToBytes(env.issuerPublicKeyHex)) };
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

const KEY_ID = `${env.issuerDid}#key-1`;

export async function signCredential(
  claims: CredentialClaims,
  credentialId: string,
  expiresInDays = 180,
  holderCommit?: string
): Promise<string> {
  const key = await importJWK(privateJwk(), "EdDSA");
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

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: KEY_ID })
    .setIssuer(env.issuerDid)
    .setSubject(credentialId)
    .setJti(credentialId)
    .setIssuedAt()
    .setExpirationTime(`${expiresInDays}d`)
    .sign(key);
}

export interface VerifiedCredential {
  valid: boolean;
  reason?: string;
  payload?: JWTPayload & { hp?: CredentialClaims; vc?: unknown };
}

export async function verifyCredential(token: string): Promise<VerifiedCredential> {
  try {
    const key = await importJWK(publicJwk(), "EdDSA");
    const { payload } = await jwtVerify(token, key, { issuer: env.issuerDid });
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : "signature invalid" };
  }
}

/** The did:web document published at /.well-known/did.json. */
export function didDocument() {
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
    id: env.issuerDid,
    verificationMethod: [
      { id: KEY_ID, type: "JsonWebKey2020", controller: env.issuerDid, publicKeyJwk: publicJwk() },
    ],
    assertionMethod: [KEY_ID],
  };
}
