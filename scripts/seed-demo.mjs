#!/usr/bin/env node
/**
 * Seed three demo HireProof credentials a judge can verify in seconds:
 *   GOOD    — score 67 · caught + corrected the planted AI error
 *   BLIND   — score 32 · blind-accepted the AI's wrong answer (the ≤40 cap fires)
 *   REVOKED — valid signature but revoked=true (the server status check kicks in)
 *
 * Each is signed with the REAL issuer key (ISSUER_PRIVATE_KEY_HEX), so it
 * verifies offline at /v against the published /.well-known/did.json — genuine,
 * not mocked. Rows are tagged payload_json.demo=true for one-command cleanup.
 *
 *   node scripts/seed-demo.mjs          seed the three credentials + write QR PNGs
 *   node scripts/seed-demo.mjs clean    delete all demo credentials
 *
 * Mirrors scripts/seed-ring.mjs (Supabase REST + .env.local) and the signing
 * shape in lib/credential/issuer.ts.
 */
import { readFileSync, mkdirSync, existsSync } from "fs";
import { createHash, randomUUID } from "crypto";
import { SignJWT, importJWK } from "jose";
import QRCode from "qrcode";

if (!existsSync(".env.local")) {
  console.error("Missing .env.local — copy .env.example to .env.local and fill in Supabase + issuer keys.");
  process.exit(1);
}
const envText = readFileSync(".env.local", "utf8");
const g = (k) => (envText.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim();

const SB_URL = g("NEXT_PUBLIC_SUPABASE_URL");
const SR = g("SUPABASE_SERVICE_ROLE_KEY");
const PRIV = g("ISSUER_PRIVATE_KEY_HEX");
const PUB = g("ISSUER_PUBLIC_KEY_HEX");
const ISSUER_DID = g("ISSUER_DID") || "did:web:hireproof.app";
const KEY_ID = `${ISSUER_DID}#${g("ISSUER_KEY_ID") || "key-1"}`;
const SITE = g("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000";

if (!SB_URL || !SR) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const H = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };
const rest = async (path, opts = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
};

function hexToBytes(hex) {
  const c = hex.trim();
  const o = new Uint8Array(c.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = parseInt(c.slice(i * 2, i * 2 + 2), 16);
  return o;
}
const b64url = (b) => Buffer.from(b).toString("base64url");

async function signCredential(claims, credentialId, holderCommit) {
  if (!PRIV || !PUB) throw new Error("Missing ISSUER_PRIVATE_KEY_HEX / ISSUER_PUBLIC_KEY_HEX in .env.local");
  const key = await importJWK(
    { kty: "OKP", crv: "Ed25519", d: b64url(hexToBytes(PRIV)), x: b64url(hexToBytes(PUB)) },
    "EdDSA"
  );
  const vc = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "HireProofCredential"],
    issuer: ISSUER_DID,
    credentialSubject: claims,
  };
  return new SignJWT({ vc, hp: claims, cnf: { "x-hp-holder": holderCommit } })
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: KEY_ID })
    .setIssuer(ISSUER_DID)
    .setSubject(credentialId)
    .setJti(credentialId)
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(key);
}

const DEMOS = [
  { label: "GOOD", revoked: false, rounds: 1, ai: { score: 67, direct: 60, judge: 80, correct: 70 } },
  { label: "BLIND", revoked: false, rounds: 1, ai: { score: 32, direct: 40, judge: 20, correct: 25 } },
  { label: "REVOKED", revoked: true, rounds: 2, ai: { score: 70, direct: 70, judge: 80, correct: 75 } },
];

const DEMO_FILTER = "payload_json->>demo=eq.true";

async function clean() {
  const rows = await rest(`credentials?select=id&${DEMO_FILTER}`);
  if (rows.length) await rest(`credentials?${DEMO_FILTER}`, { method: "DELETE" });
  console.log(`cleaned ${rows.length} demo credential(s)`);
}

async function seed() {
  await clean(); // idempotent re-seed
  mkdirSync("docs/demo", { recursive: true });
  console.log(`\nIssuer: ${ISSUER_DID}\nSite:   ${SITE}\n`);
  for (const d of DEMOS) {
    const id = randomUUID();
    const holderCommit = createHash("sha256").update(randomUUID()).digest("hex");
    const claims = {
      humanVerified: true,
      livenessPassed: true,
      aiCollaboration: d.ai,
      faceDescriptorHash: "",
      rounds: d.rounds,
      demo: true,
      label: d.label,
    };
    const token = await signCredential(claims, id, holderCommit);
    await rest("credentials", {
      method: "POST",
      body: JSON.stringify({
        id,
        session_id: null,
        payload_json: claims,
        signature: token,
        issuer_did: ISSUER_DID,
        round_count: d.rounds,
        revoked: d.revoked,
      }),
    });
    const verifyUrl = `${SITE}/v#${token}`;
    await QRCode.toFile(`docs/demo/${d.label.toLowerCase()}.png`, verifyUrl, { margin: 1, scale: 6 });
    console.log(`${d.label.padEnd(8)} score ${String(d.ai.score).padStart(3)}/100  revoked=${d.revoked}`);
    console.log(`  ${verifyUrl}\n`);
  }
  console.log("QR codes written to docs/demo/*.png");
  console.log("Open the GOOD and BLIND links at /v to see 67 vs 32; REVOKED shows the revocation banner.");
}

const arg = process.argv[2];
if (arg === "clean") await clean();
else await seed();
