#!/usr/bin/env node
/**
 * Dev utility: validate EVERY configured Gemini key in .env.local with a tiny
 * live call (the same @ai-sdk/google path the app uses). Prints OK/FAIL per key
 * — never the key value. Run:  node scripts/check-gemini-keys.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const here = dirname(fileURLToPath(import.meta.url));

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

let env;
try {
  env = parseEnv(readFileSync(join(here, "..", ".env.local"), "utf8"));
} catch {
  console.error("Could not read .env.local");
  process.exit(1);
}

const keys = [];
const add = (name) => { if (env[name]) keys.push([name, env[name]]); };
add("GOOGLE_GENERATIVE_AI_API_KEY");
for (let i = 2; i <= 10; i++) add(`GOOGLE_GENERATIVE_AI_API_KEY_${i}`);
if (env.GEMINI_API_KEYS) env.GEMINI_API_KEYS.split(",").forEach((k, idx) => { if (k.trim()) keys.push([`GEMINI_API_KEYS[${idx}]`, k.trim()]); });

if (!keys.length) { console.error("No Gemini keys found in .env.local"); process.exit(1); }

console.log(`Testing ${keys.length} Gemini key(s) with gemini-2.5-flash-lite...`);
let ok = 0;
for (const [name, key] of keys) {
  try {
    const google = createGoogleGenerativeAI({ apiKey: key });
    const r = await generateText({ model: google("gemini-2.5-flash-lite"), prompt: "Reply with the single word: OK", maxOutputTokens: 8 });
    console.log(`  ${name}: OK  (${JSON.stringify(r.text.trim().slice(0, 20))})`);
    ok++;
  } catch (e) {
    console.log(`  ${name}: FAIL  ${(e?.message || String(e)).slice(0, 160)}`);
  }
}
console.log(`${ok}/${keys.length} keys working.`);
process.exit(ok === keys.length ? 0 : 2);
