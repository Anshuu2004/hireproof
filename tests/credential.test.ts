import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { generateKeyPairSync, createHash } from "node:crypto";
import { SignJWT, importJWK } from "jose";
import {
  signCredential,
  verifyCredential,
  descriptorHash,
  publicJwk,
  didDocument,
  type CredentialClaims,
} from "@/lib/credential/issuer";

/**
 * Trust-core tests for the credential itself — the cryptographic claim the whole
 * product rests on: a HireProof credential is an Ed25519 (EdDSA) JWT-VC that
 * verifies against a published public key alone, and any tampering, expiry,
 * wrong-key, or holder re-binding is rejected. These exercise the REAL
 * lib/credential/issuer.ts + signer.ts (not a re-implementation).
 */

const DID = "did:web:hireproof.test";

function genKeyHex() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "jwk" }) as { x: string };
  const priv = privateKey.export({ format: "jwk" }) as { d: string };
  const toHex = (b64url: string) => Buffer.from(b64url, "base64url").toString("hex");
  return { privHex: toHex(priv.d), pubHex: toHex(pub.x) };
}

let keyA: ReturnType<typeof genKeyHex>;
let keyB: ReturnType<typeof genKeyHex>;

function sampleClaims(): CredentialClaims {
  return {
    humanVerified: true,
    livenessPassed: true,
    aiCollaboration: { score: 67, direct: 18, judge: 27, correct: 22 },
    faceDescriptorHash: "a3f1c0deadbeef",
    rounds: 1,
  };
}

/** The decoded credential payload, just enough to mutate it in tamper tests. */
interface DecodedPayload {
  hp: { aiCollaboration: { score: number } };
  vc?: { credentialSubject?: { aiCollaboration?: { score: number } } };
  cnf?: { "x-hp-holder": string };
  [k: string]: unknown;
}

/** Flip a field in a signed token's payload, keeping the original signature. */
function tamper(token: string, mutate: (pl: DecodedPayload) => void): string {
  const [h, p, s] = token.split(".");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as DecodedPayload;
  mutate(payload);
  return `${h}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${s}`;
}

/** Mint a token directly with jose (used to forge expired / foreign-key inputs). */
async function mint(
  k: { privHex: string; pubHex: string },
  claims: CredentialClaims,
  id: string,
  opts: { exp?: string | number; iss?: string } = {}
): Promise<string> {
  const key = await importJWK(
    {
      kty: "OKP",
      crv: "Ed25519",
      d: Buffer.from(k.privHex, "hex").toString("base64url"),
      x: Buffer.from(k.pubHex, "hex").toString("base64url"),
    },
    "EdDSA"
  );
  const iss = opts.iss ?? DID;
  const vc = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "HireProofCredential"],
    issuer: iss,
    credentialSubject: claims,
  };
  return new SignJWT({ vc, hp: claims })
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: `${DID}#key-1` })
    .setIssuer(iss)
    .setSubject(id)
    .setJti(id)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "180d")
    .sign(key);
}

beforeAll(() => {
  keyA = genKeyHex();
  keyB = genKeyHex();
});

beforeEach(() => {
  // A clean, deterministic issuer config before each test. The signing key never
  // changes (keyA); only the PUBLIC key set is varied, to test rotation.
  process.env.ISSUER_DID = DID;
  process.env.ISSUER_KEY_ID = "key-1";
  process.env.ISSUER_PRIVATE_KEY_HEX = keyA.privHex;
  process.env.ISSUER_PUBLIC_KEY_HEX = keyA.pubHex;
  process.env.ISSUER_RETIRED_PUBLIC_KEYS = "";
  process.env.ISSUER_SIGNER = "env";
});

describe("credential — sign & verify", () => {
  it("accepts a genuine credential and round-trips the claims", async () => {
    const claims = sampleClaims();
    const token = await signCredential(claims, "HP-TEST-0001");
    const res = await verifyCredential(token);

    expect(res.valid).toBe(true);
    expect(res.payload?.iss).toBe(DID);
    expect(res.payload?.sub).toBe("HP-TEST-0001");
    expect(res.payload?.hp?.aiCollaboration.score).toBe(67);
    expect(res.payload?.hp?.humanVerified).toBe(true);
  });

  it("rejects a tampered claim (attacker inflates the score)", async () => {
    const token = await signCredential(sampleClaims(), "HP-TEST-0002");
    const forged = tamper(token, (pl) => {
      pl.hp.aiCollaboration.score = 99;
      if (pl.vc?.credentialSubject?.aiCollaboration) pl.vc.credentialSubject.aiCollaboration.score = 99;
    });
    const res = await verifyCredential(forged);
    expect(res.valid).toBe(false);
  });

  it("rejects an expired credential with an expiry reason", async () => {
    const expired = await mint(keyA, sampleClaims(), "HP-EXP", {
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const res = await verifyCredential(expired);
    expect(res.valid).toBe(false);
    expect(res.reason ?? "").toMatch(/exp/i);
  });

  it("rejects a credential signed by a key the issuer never published", async () => {
    // keyB is not the active key and not in the retired set.
    const foreign = await mint(keyB, sampleClaims(), "HP-FOREIGN");
    const res = await verifyCredential(foreign);
    expect(res.valid).toBe(false);
  });

  it("rejects a credential presented under the wrong issuer", async () => {
    const wrongIssuer = await mint(keyA, sampleClaims(), "HP-ISS", { iss: "did:web:attacker.example" });
    const res = await verifyCredential(wrongIssuer);
    expect(res.valid).toBe(false);
  });
});

describe("credential — holder binding (non-bearer)", () => {
  it("binds a holder commit into the signature and rejects re-binding", async () => {
    const commit = createHash("sha256").update("holder-secret").digest("hex");
    const token = await signCredential(sampleClaims(), "HP-HOLDER", 180, commit);

    const res = await verifyCredential(token);
    expect(res.valid).toBe(true);
    const cnf = (res.payload as { cnf?: { "x-hp-holder"?: string } }).cnf;
    expect(cnf?.["x-hp-holder"]).toBe(commit);

    // Swapping the holder commit must break the signature — it isn't a bearer token.
    const rebound = tamper(token, (pl) => {
      pl.cnf = { "x-hp-holder": "attacker-controlled-commit" };
    });
    expect((await verifyCredential(rebound)).valid).toBe(false);
  });
});

describe("credential — key rotation (did:web)", () => {
  it("keeps verifying an old credential while its key is published as retired", async () => {
    const token = await signCredential(sampleClaims(), "HP-ROT"); // signed with keyA

    // Rotate: keyB becomes active, keyA moves to the retired (still-trusted) set.
    process.env.ISSUER_PUBLIC_KEY_HEX = keyB.pubHex;
    process.env.ISSUER_RETIRED_PUBLIC_KEYS = keyA.pubHex;
    expect((await verifyCredential(token)).valid).toBe(true);

    // Fully retire keyA — the old credential must now be rejected.
    process.env.ISSUER_RETIRED_PUBLIC_KEYS = "";
    expect((await verifyCredential(token)).valid).toBe(false);
  });
});

describe("did:web document", () => {
  it("publishes the active key and any retired keys", () => {
    const doc = didDocument();
    expect(doc.id).toBe(DID);
    expect(doc.verificationMethod).toHaveLength(1);
    expect(doc.verificationMethod[0].publicKeyJwk.x).toBe(publicJwk().x);
    expect(doc.assertionMethod).toContain(`${DID}#key-1`);

    process.env.ISSUER_RETIRED_PUBLIC_KEYS = keyB.pubHex;
    expect(didDocument().verificationMethod).toHaveLength(2);
  });
});

describe("descriptorHash — privacy-preserving biometric fingerprint", () => {
  it("is deterministic, salt- and descriptor-sensitive, and never leaks raw values", () => {
    const d = [0.1234, 0.5678, 0.9012];
    const h1 = descriptorHash(d, "salt-1");

    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(descriptorHash(d, "salt-1")).toBe(h1); // deterministic
    expect(descriptorHash(d, "salt-2")).not.toBe(h1); // salted
    expect(descriptorHash([0.1234, 0.5678, 0.9099], "salt-1")).not.toBe(h1); // descriptor-bound
    expect(h1).not.toContain("0.1234"); // one-way: raw descriptor is not recoverable from the hash
  });
});
