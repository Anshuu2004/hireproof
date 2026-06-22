import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Cookie-bound Supabase client for reading the employer's Auth session inside
 * route handlers (and the OAuth callback). Returns null if Auth isn't configured.
 */
export async function createServerSupabase() {
  if (!url || !anon) return null;
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a read-only context (e.g. a Server Component) — ignore.
        }
      },
    },
  });
}
