import { SignJWT, importJWK, type JWK } from "jose";
import { env } from "@/lib/env";

/**
 * Issuer signing boundary — the one place the Ed25519 private key is ever
 * touched. Today that's an EnvSigner (key in an env var); production swaps in a
 * KMS/HSM-backed signer by changing this file alone, not the call sites. Because
 * verification needs only the published PUBLIC keys (see issuer.ts), a
 * verify-only deployment can run without the private key present at all.
 */
export interface Signer {
  /** Key id published in did:web; written into the JWS `kid` header. */
  readonly kid: string;
  /** Sign a JWT payload with the issuer key and return the compact JWS. */
  sign(payload: Record<string, unknown>, opts: SignOpts): Promise<string>;
}

export interface SignOpts {
  issuer: string;
  subject?: string;
  jti?: string;
  expiresIn: string; // e.g. "180d"
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
const b64url = (b: Uint8Array) => Buffer.from(b).toString("base64url");

/**
 * Current production signer: Ed25519 key from an env var (Vercel-encrypted at
 * rest). Honest prototype posture — the key is read lazily, only when signing,
 * so importing this module on a verify-only path never requires the secret.
 */
class EnvSigner implements Signer {
  constructor(readonly kid: string) {}

  private async key() {
    const jwk: JWK = {
      kty: "OKP",
      crv: "Ed25519",
      d: b64url(hexToBytes(env.issuerPrivateKeyHex)),
      x: b64url(hexToBytes(env.issuerPublicKeyHex)),
    };
    return importJWK(jwk, "EdDSA");
  }

  async sign(payload: Record<string, unknown>, opts: SignOpts): Promise<string> {
    const key = await this.key();
    const jwt = new SignJWT(payload)
      .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: this.kid })
      .setIssuer(opts.issuer)
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn);
    if (opts.subject) jwt.setSubject(opts.subject);
    if (opts.jti) jwt.setJti(opts.jti);
    return jwt.sign(key);
  }
}

/**
 * ROADMAP (NOT wired) — a KMS/HSM-backed signer. The private key never leaves
 * the HSM: the signing input goes to `kms:Sign` and the JWS is assembled around
 * the returned signature. AWS KMS added Ed25519 (ECC_NIST_EDWARDS25519, signed
 * with ED25519_SHA_512 / MessageType RAW) in Nov 2025. Left as an explicit,
 * labelled stub — like the mock ATS write-back — so it can never be mistaken
 * for a live integration.
 */
class KmsSigner implements Signer {
  constructor(readonly kid: string) {}
  async sign(): Promise<string> {
    throw new Error(
      "KmsSigner is a roadmap stub and is not wired. Set ISSUER_SIGNER=env to use the env-var signer. See SECURITY.md T1."
    );
  }
}

let cached: Signer | null = null;
/** The active issuer signer. Swap the implementation (env → KMS) here, once. */
export function getSigner(): Signer {
  if (!cached) {
    cached = env.signerKind === "kms" ? new KmsSigner(env.issuerKid) : new EnvSigner(env.issuerKid);
  }
  return cached;
}
