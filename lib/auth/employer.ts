import { bearer } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAllowlisted } from "@/lib/auth/allowlist";

export interface Employer {
  sub: string; // employers.id
  email: string;
}

/**
 * Unified employer identity for protected routes. Accepts EITHER:
 *   1. the legacy HMAC bearer token (demo + email/password path) — checked first,
 *      so the existing one-click demo keeps working with zero latency, OR
 *   2. a Supabase Auth cookie session (Google sign-in), mapped to the employers
 *      row via auth_user_id.
 * Returns the same { sub, email } shape `bearer()` returned, so call sites only
 * swap `bearer(req)` for `await getEmployer(req)`.
 */
export async function getEmployer(req?: Request): Promise<Employer | null> {
  // 1) Legacy HMAC bearer — no network, fast path for demo/password sessions.
  if (req) {
    const s = bearer(req);
    if (s) return { sub: s.sub, email: s.email };
  }

  // 2) Supabase Auth cookie session (Google). getUser() validates the JWT.
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return null;
    const userRes = await supabase.auth.getUser();
    const user = userRes.data.user;
    if (!user) return null;
    // Re-check authorization at REQUEST time, not just at provisioning: a
    // de-allowlisted employer must lose access even though their cookie session
    // (and auto-refreshing token) is otherwise still valid.
    const email = (user.email ?? "").trim().toLowerCase();
    if (!(await isAllowlisted(email))) return null;
    const sb = supabaseAdmin();
    const { data: emp } = await sb
      .from("employers")
      .select("id,email")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (emp) return { sub: emp.id as string, email: (emp.email as string) ?? user.email ?? "" };
  } catch {
    // Auth not configured / no session — fall through.
  }
  return null;
}
