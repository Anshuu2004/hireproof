#!/usr/bin/env node
/**
 * Dev utility: verify the employer_allowlist table + its rows on the REAL app
 * project, reading credentials from .env.local (service-role bypasses RLS).
 * Prints only allowlist rows (email/domain/note) — never any secret.
 *
 * Run:  node scripts/check-allowlist.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, "..", ".env.local");

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

let env;
try {
  env = parseEnv(readFileSync(envPath, "utf8"));
} catch {
  console.error("Could not read .env.local at " + envPath);
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

console.log("Project: " + url);
const res = await fetch(`${url}/rest/v1/employer_allowlist?select=email,domain,note`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
});

if (res.status === 404 || res.status === 400) {
  const body = await res.text().catch(() => "");
  console.error(`employer_allowlist NOT reachable (${res.status}) — migration likely NOT applied.`);
  console.error(body.slice(0, 300));
  process.exit(2);
}
if (!res.ok) {
  console.error(`Query failed (${res.status} ${res.statusText})`);
  process.exit(1);
}

const rows = await res.json();
console.log(`employer_allowlist EXISTS — ${rows.length} row(s):`);
for (const r of rows) {
  console.log("  - " + (r.email || "(no email)") + (r.domain ? " / domain:" + r.domain : "") + "  [" + (r.note || "") + "]");
}
