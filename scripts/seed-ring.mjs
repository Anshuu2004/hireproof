#!/usr/bin/env node
/**
 * Seed (or clean) a SYNTHETIC fraud ring for the BN-1 demo: one face enrolled
 * under N different candidate identities. Everything is namespaced under issuer
 * `did:web:synthetic-demo` so it is excluded from /metrics (hp_metrics filters
 * it out) and trivially removable.
 *
 *   node scripts/seed-ring.mjs [N]     seed a ring of N identities (default 6)
 *   node scripts/seed-ring.mjs clean   delete all synthetic ring data
 */
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

const env = readFileSync(".env.local", "utf8");
const g = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim();
const URL = g("NEXT_PUBLIC_SUPABASE_URL"), SR = g("SUPABASE_SERVICE_ROLE_KEY");
const SYNTH_ISSUER = "did:web:synthetic-demo";
const H = { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" };

const rest = async (path, opts = {}) => {
  const r = await fetch(`${URL}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
};

async function clean() {
  const creds = await rest(`credentials?select=id&issuer_did=eq.${encodeURIComponent(SYNTH_ISSUER)}`);
  const ids = creds.map((c) => c.id);
  if (ids.length) {
    const inList = `(${ids.join(",")})`;
    await rest(`face_descriptors?credential_id=in.${inList}`, { method: "DELETE" });
    await rest(`credentials?issuer_did=eq.${encodeURIComponent(SYNTH_ISSUER)}`, { method: "DELETE" });
  }
  console.log(`cleaned ${ids.length} synthetic credential(s) + their descriptors`);
}

function unitVec(dim = 128) {
  const v = Array.from({ length: dim }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
  return v.map((x) => x / norm);
}
function jitterNormalize(vec, eps = 0.02) {
  const out = vec.map((v) => v + (Math.random() * 2 - 1) * eps);
  const norm = Math.sqrt(out.reduce((a, b) => a + b * b, 0)) || 1;
  return out.map((v) => v / norm);
}

async function seed(n) {
  // A RANDOM unit vector as the shared synthetic "face" — near-orthogonal to all
  // real face embeddings (distance ~1.0), so the ring is purely the N synthetic
  // identities and can never entangle a real candidate.
  const baseVec = unitVec(128);

  for (let i = 0; i < n; i++) {
    const id = randomUUID();
    const score = [41, 58, 63, 49, 72, 55, 38, 67][i % 8];
    await rest("credentials", {
      method: "POST",
      body: JSON.stringify({
        id,
        session_id: null,
        payload_json: { humanVerified: true, livenessPassed: true, aiCollaboration: { score, direct: 60, judge: 80, correct: 70 }, rounds: 1, synthetic: true },
        signature: "synthetic-demo",
        issuer_did: SYNTH_ISSUER,
        round_count: 1,
      }),
    });
    const vec = jitterNormalize(baseVec); // same face, tiny variation → distance well under 0.30
    await rest("face_descriptors", {
      method: "POST",
      body: JSON.stringify({ credential_id: id, session_id: null, embedding: `[${vec.join(",")}]`, round_no: 1 }),
    });
  }
  console.log(`seeded a synthetic ring: 1 face / ${n} identities (issuer ${SYNTH_ISSUER})`);
}

const arg = process.argv[2];
if (arg === "clean") await clean();
else await seed(parseInt(arg || "6", 10));
