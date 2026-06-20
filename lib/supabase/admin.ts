import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service-role key. Bypasses RLS, so it
 * must NEVER be imported into a client component. Used for all HireProof writes
 * (sessions, scores, credentials, append-only audit log).
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.supabaseUrl, env.supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
