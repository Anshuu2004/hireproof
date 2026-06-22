import { createBrowserClient } from "@supabase/ssr";

// NEXT_PUBLIC_* are inlined at build time; safe on the client.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Browser Supabase client used ONLY for employer Google sign-in. Returns null if
 * Supabase Auth isn't configured, so the UI degrades gracefully (Google button
 * disabled) and the existing demo/password login is unaffected.
 */
export function createBrowserSupabase() {
  if (!url || !anon) return null;
  client ??= createBrowserClient(url, anon);
  return client;
}
