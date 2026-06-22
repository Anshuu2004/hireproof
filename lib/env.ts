/**
 * Server-side environment access. Throws early with a clear message if a
 * required secret is missing, so misconfiguration fails loud, not silent.
 * NEXT_PUBLIC_* values are also readable on the client.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Add it to .env.local (see .env.example).`
    );
  }
  return value;
}

/** Resolve the issuer DID once; the production domain wins on Vercel. */
function resolveIssuerDid(): string {
  if (process.env.ISSUER_DID) return process.env.ISSUER_DID;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `did:web:${host}` : "did:web:hireproof.app";
}

export const env = {
  // Supabase
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  get supabaseServiceRole() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },

  // Credential issuer (Ed25519). On Vercel the issuer DID and site URL derive
  // from the production domain so the QR + did:web are correct with no manual
  // config; both stay internally consistent (token iss === did.json id).
  get issuerDid() {
    return resolveIssuerDid();
  },
  // The active key id (JWS `kid` + did:web verificationMethod id). Bump
  // ISSUER_KEY_ID on rotation; old keys move to ISSUER_RETIRED_PUBLIC_KEYS.
  get issuerKid() {
    return `${resolveIssuerDid()}#${process.env.ISSUER_KEY_ID ?? "key-1"}`;
  },
  get issuerPrivateKeyHex() {
    return required("ISSUER_PRIVATE_KEY_HEX");
  },
  get issuerPublicKeyHex() {
    return required("ISSUER_PUBLIC_KEY_HEX");
  },
  // Previously-active public keys still trusted during a rotation window, so
  // outstanding 180-day credentials keep verifying. Comma-separated 32-byte hex.
  get issuerRetiredPublicKeysHex(): string[] {
    return (process.env.ISSUER_RETIRED_PUBLIC_KEYS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  // Which signer backs issuance: "env" (key in env var, current) or "kms"
  // (HSM-backed, roadmap stub). Verification never needs the private key.
  signerKind: (process.env.ISSUER_SIGNER ?? "env") as "env" | "kms",

  // Public site origin (verify URLs, did:web)
  get siteUrl() {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    return host ? `https://${host}` : "http://localhost:3000";
  },

  // Vercel AI Gateway (OIDC token is injected automatically on Vercel;
  // AI_GATEWAY_API_KEY is only needed for local dev without a pulled token)
  aiGatewayKey: process.env.AI_GATEWAY_API_KEY,

  // DigiLocker demo sandbox. Defaults let the demo run with zero config; in
  // production these are the APISetu partner org id + the shared HMAC API key.
  digilockerOrgId: process.env.DIGILOCKER_ORG_ID ?? "HP-DEMO-ORG",
  get digilockerSecret() {
    return process.env.DIGILOCKER_DEMO_SECRET ?? "hireproof-digilocker-demo-shared-secret";
  },
} as const;
