#!/usr/bin/env node
/**
 * HireProof — standalone, offline credential verifier.
 *
 * No server, no database, no network. It proves the core cryptographic claim of
 * the product the way an employer's machine would: a HireProof credential is a
 * self-contained EdDSA (Ed25519) JWT-VC that verifies against a public key
 * alone, and any tampering is rejected.
 *
 *   node scripts/verify-credential.mjs
 *       Self-contained demo + CI smoke test. Mints a sample credential with a
 *       throwaway key and asserts the credential's security properties:
 *         1. a genuine credential verifies,
 *         2. a tampered claim is rejected,
 *         3. an expired credential is rejected,
 *         4. a wrong-issuer credential is rejected,
 *         5. the holder binding (cnf) is present and tamper-evident.
 *       Exits non-zero if any property fails.
 *
 *   node scripts/verify-credential.mjs <token>
 *       Verify a real HireProof credential token offline against the issuer
 *       public key in ISSUER_PUBLIC_KEY_HEX (32-byte Ed25519, hex). Prints the
 *       decoded claims. This is exactly what the in-browser /v verifier does.
 *
 * Mirrors lib/credential/issuer.ts (same VC shape, alg, did:web issuer, kid).
 */
import { SignJWT, jwtVerify, generateKeyPair, importJWK } from "jose";
import { createHash } from "crypto";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const ok = (m) => console.log(`${GREEN}  OK${RESET}  ${m}`);
const bad = (m) => console.log(`${RED}  XX${RESET}  ${m}`);
const head = (m) => console.log(`\n${BOLD}${m}${RESET}`);

const ISSUER_DID = process.env.ISSUER_DID || "did:web:hireproof.app";
const KEY_ID = `${ISSUER_DID}#key-1`;

const SAMPLE_CLAIMS = {
  humanVerified: true,
  livenessPassed: true,
  aiCollaboration: { score: 67, direct: 18, judge: 27, correct: 22 },
  faceDescriptorHash: "a3f1c0…(salted sha256, never the raw biometric)",
  rounds: 1,
};

function hexToBytes(hex) {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
const b64url = (b) => Buffer.from(b).toString("base64url");

async function sign(claims, key, credentialId, { expiration = "180d", holderCommit } = {}) {
  const vc = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "HireProofCredential"],
    issuer: ISSUER_DID,
    credentialSubject: claims,
  };
  const payload = { vc, hp: claims };
  if (holderCommit) payload.cnf = { "x-hp-holder": holderCommit };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: KEY_ID })
    .setIssuer(ISSUER_DID)
    .setSubject(credentialId)
    .setJti(credentialId)
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(key);
}

/** Flip one claim in the payload while keeping the original signature. */
function tamper(token, mutate) {
  const [h, p, s] = token.split(".");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  mutate(payload);
  const forged = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${h}.${forged}.${s}`;
}

async function selfTest() {
  head("HireProof offline credential verifier — self-contained demo");
  console.log(`${DIM}  EdDSA / Ed25519 · W3C VC 2.0 shape · did:web issuer · verifies with the public key alone${RESET}`);

  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { extractable: true });

  head("1. Mint a credential (issuer holds the private key)");
  const holderCommit = createHash("sha256").update("demo-holder-secret").digest("hex");
  const token = await sign(SAMPLE_CLAIMS, privateKey, "HP-DEMO-0001", { holderCommit });
  ok(`signed ${token.length}-char JWT-VC · score ${SAMPLE_CLAIMS.aiCollaboration.score}/100`);

  head("2. Employer verifies offline (public key only, no DB, no network)");
  let genuineAccepted = false;
  try {
    const { payload } = await jwtVerify(token, publicKey, { issuer: ISSUER_DID });
    genuineAccepted = true;
    ok(`signature valid · subject ${payload.sub} · human=${payload.hp.humanVerified} · rounds=${payload.hp.rounds}`);
  } catch (e) {
    bad(`genuine credential was REJECTED — this is a failure: ${e.message}`);
  }

  head("3. Attacker inflates the score from 67 to 99 and re-presents it");
  const forged = tamper(token, (pl) => {
    // Claims live under hp + vc.credentialSubject (see lib/credential/issuer.ts).
    pl.hp.aiCollaboration.score = 99;
    if (pl.vc?.credentialSubject?.aiCollaboration) pl.vc.credentialSubject.aiCollaboration.score = 99;
  });
  let tamperRejected = false;
  try {
    await jwtVerify(forged, publicKey, { issuer: ISSUER_DID });
    bad("tampered credential was ACCEPTED — this is a failure");
  } catch {
    tamperRejected = true;
    ok("tampered credential REJECTED — signature no longer matches the payload");
  }

  head("4. An expired credential is rejected (past its expiry)");
  const expiredToken = await sign(SAMPLE_CLAIMS, privateKey, "HP-DEMO-EXP", {
    expiration: Math.floor(Date.now() / 1000) - 60, // expired one minute ago
  });
  let expiryRejected = false;
  try {
    await jwtVerify(expiredToken, publicKey, { issuer: ISSUER_DID });
    bad("expired credential was ACCEPTED — this is a failure");
  } catch (e) {
    if (e.code === "ERR_JWT_EXPIRED") {
      expiryRejected = true;
      ok("expired credential REJECTED — exp claim is enforced");
    } else {
      bad(`expired credential rejected for the wrong reason: ${e.message}`);
    }
  }

  head("5. A credential presented under the wrong issuer is rejected");
  let issuerMismatchRejected = false;
  try {
    await jwtVerify(token, publicKey, { issuer: "did:web:attacker.example" });
    bad("wrong-issuer credential was ACCEPTED — this is a failure");
  } catch {
    issuerMismatchRejected = true;
    ok("issuer mismatch REJECTED — iss claim is enforced");
  }

  head("6. Holder binding (cnf) is present and tamper-evident");
  const { payload: genuine } = await jwtVerify(token, publicKey, { issuer: ISSUER_DID });
  const hasHolderCommit = genuine.cnf?.["x-hp-holder"] === holderCommit;
  const reboundToken = tamper(token, (pl) => {
    pl.cnf = { "x-hp-holder": "attacker-controlled-commit" };
  });
  let holderRebindRejected = false;
  try {
    await jwtVerify(reboundToken, publicKey, { issuer: ISSUER_DID });
    bad("re-bound holder commit was ACCEPTED — this is a failure");
  } catch {
    holderRebindRejected = true;
  }
  const holderBindingOk = hasHolderCommit && holderRebindRejected;
  if (holderBindingOk) ok("cnf holder commit present and bound into the signature");
  else bad(`holder binding check failed (present=${hasHolderCommit}, rebind rejected=${holderRebindRejected})`);

  const pass =
    genuineAccepted && tamperRejected && expiryRejected && issuerMismatchRejected && holderBindingOk;
  head(pass ? `${GREEN}RESULT: PASS${RESET}` : `${RED}RESULT: FAIL${RESET}`);
  console.log(
    `${DIM}  genuine=${genuineAccepted} · tamper rejected=${tamperRejected} · expiry rejected=${expiryRejected} · issuer enforced=${issuerMismatchRejected} · holder binding=${holderBindingOk}${RESET}\n`
  );
  return pass;
}

async function verifyExternal(token) {
  head("HireProof offline credential verifier — external token");
  const hex = process.env.ISSUER_PUBLIC_KEY_HEX;
  if (!hex) {
    bad("set ISSUER_PUBLIC_KEY_HEX (32-byte Ed25519 public key, hex) to verify a real token offline");
    return false;
  }
  const key = await importJWK({ kty: "OKP", crv: "Ed25519", x: b64url(hexToBytes(hex)) }, "EdDSA");
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER_DID });
    ok("signature valid — credential is authentic and untampered");
    console.log(`${DIM}${JSON.stringify(payload.hp ?? payload, null, 2)}${RESET}`);
    return true;
  } catch (e) {
    bad(`verification failed: ${e.message}`);
    return false;
  }
}

const arg = process.argv[2];
const pass = arg ? await verifyExternal(arg) : await selfTest();
process.exit(pass ? 0 : 1);
