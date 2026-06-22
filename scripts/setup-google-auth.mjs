#!/usr/bin/env node
/**
 * One-shot: enable Google sign-in on the LIVE Supabase project, surgically.
 *
 * Uses the Supabase Management API (PATCH /v1/projects/{ref}/config/auth), which
 * only updates the fields we send — it does NOT clobber the rest of the remote
 * auth config the way `supabase config push` (with the local-default config.toml)
 * would. We intentionally do NOT use config push for that reason.
 *
 * SECRETS NEVER TOUCH SOURCE OR CHAT. They are read from env vars only, and this
 * script prints status (booleans / lengths) — never the values themselves.
 *
 * Required env vars (set them in your shell or a GIT-IGNORED file, not here):
 *   SUPABASE_ACCESS_TOKEN   personal access token: https://supabase.com/dashboard/account/tokens
 *   GOOGLE_OAUTH_CLIENT_ID  from Google Cloud Console (Part 1)
 *   GOOGLE_OAUTH_SECRET     from Google Cloud Console (Part 1)
 *
 * Run:  node scripts/setup-google-auth.mjs
 */

const PROJECT_REF = "qfqnwzvapbluapephctf";
const SITE_URL = "https://hireproof-ecru.vercel.app";
const REDIRECT_URLS = [
  "https://hireproof-ecru.vercel.app/auth/callback",
  "http://localhost:3000/auth/callback",
];

const token = process.env.SUPABASE_ACCESS_TOKEN;
const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const secret = process.env.GOOGLE_OAUTH_SECRET;

const missing = [
  ["SUPABASE_ACCESS_TOKEN", token],
  ["GOOGLE_OAUTH_CLIENT_ID", clientId],
  ["GOOGLE_OAUTH_SECRET", secret],
].filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
  console.error("Missing env var(s): " + missing.join(", "));
  console.error("Set them (NOT in this file, NOT in chat) and re-run.");
  process.exit(1);
}

const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
const body = {
  site_url: SITE_URL,
  uri_allow_list: REDIRECT_URLS.join(","),
  external_google_enabled: true,
  external_google_client_id: clientId,
  external_google_secret: secret,
};

const res = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const text = await res.text().catch(() => "");
  console.error(`Failed (${res.status} ${res.statusText}): ${text}`);
  process.exit(1);
}

// Print status only — never echo the secret/client values.
console.log("Google sign-in configured on Supabase project " + PROJECT_REF);
console.log("  external_google_enabled : true");
console.log("  client_id length        : " + clientId.length);
console.log("  secret length           : " + secret.length);
console.log("  site_url                : " + SITE_URL);
console.log("  redirect URLs           :");
for (const u of REDIRECT_URLS) console.log("    - " + u);
console.log("\nDone. Test: http://localhost:3000/employer -> Continue with Google");
