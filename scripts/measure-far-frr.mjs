#!/usr/bin/env node
/**
 * Measure the face-matcher's real separation: genuine (same person, different
 * rounds — within one credential) vs impostor (different people — across
 * credentials) cosine-distance distributions, and the FAR/FRR at the shipped
 * 0.30 threshold. Read-only; synthetic ring data is excluded.
 *
 *   node scripts/measure-far-frr.mjs
 *
 * Becomes meaningful only once enough real people are enrolled WITH repeat
 * rounds (each genuine pair needs 2+ descriptors under one credential). Run a
 * campus pilot, then this prints the histogram for the deck — converting
 * "FAR/FRR unmeasured" into "measured on a small sample, separation is clean."
 */
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const g = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim();
const URL = g("NEXT_PUBLIC_SUPABASE_URL"), SR = g("SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: SR, Authorization: "Bearer " + SR };
const THRESHOLD = 0.3;

const rest = (p) => fetch(`${URL}/rest/v1/${p}`, { headers: H }).then((r) => r.json());
const parse = (e) => (Array.isArray(e) ? e : JSON.parse(e));
const cosDist = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};
const pct = (xs, q) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };
const histo = (xs, label) => {
  if (!xs.length) return `  ${label}: (none)`;
  const bins = new Array(10).fill(0);
  xs.forEach((d) => bins[Math.min(9, Math.floor(Math.max(0, d) * 10))]++);
  const max = Math.max(...bins, 1);
  return bins.map((n, i) => `  ${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)} | ${"█".repeat(Math.round((n / max) * 30))} ${n}`).join("\n");
};

// exclude synthetic credentials
const synth = await rest(`credentials?select=id&issuer_did=like.*synthetic*`);
const synthIds = new Set(synth.map((c) => c.id));
const rows = (await rest(`face_descriptors?select=id,credential_id,embedding&credential_id=not.is.null`))
  .filter((r) => !synthIds.has(r.credential_id))
  .map((r) => ({ cred: r.credential_id, v: parse(r.embedding) }));

const byCred = new Map();
rows.forEach((r) => { if (!byCred.has(r.cred)) byCred.set(r.cred, []); byCred.get(r.cred).push(r.v); });

const genuine = [], impostor = [];
const creds = [...byCred.entries()];
for (const [, vs] of creds) for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) genuine.push(cosDist(vs[i], vs[j]));
for (let a = 0; a < creds.length; a++) for (let b = a + 1; b < creds.length; b++)
  impostor.push(cosDist(creds[a][1][0], creds[b][1][0]));

const far = impostor.length ? impostor.filter((d) => d < THRESHOLD).length / impostor.length : null; // false match
const frr = genuine.length ? genuine.filter((d) => d > THRESHOLD).length / genuine.length : null;     // false reject

console.log(`\nFAR/FRR @ cosine ${THRESHOLD}  ·  real descriptors: ${rows.length} across ${creds.length} people\n`);
console.log(`GENUINE pairs (same person, repeat rounds): ${genuine.length}`);
if (genuine.length) console.log(`  median ${pct(genuine, 0.5).toFixed(3)} · p95 ${pct(genuine, 0.95).toFixed(3)}\n${histo(genuine, "genuine")}`);
console.log(`\nIMPOSTOR pairs (different people): ${impostor.length}`);
if (impostor.length) console.log(`  median ${pct(impostor, 0.5).toFixed(3)} · p05 ${pct(impostor, 0.05).toFixed(3)}\n${histo(impostor, "impostor")}`);
console.log(`\nFAR (impostor < ${THRESHOLD}, false match): ${far == null ? "n/a" : (far * 100).toFixed(1) + "%"}`);
console.log(`FRR (genuine > ${THRESHOLD}, false reject): ${frr == null ? "n/a" : (frr * 100).toFixed(1) + "%"}`);
if (genuine.length < 10) console.log(`\nNOTE: only ${genuine.length} genuine pairs — enrol ~15 people with a 2nd round to make this meaningful.`);
