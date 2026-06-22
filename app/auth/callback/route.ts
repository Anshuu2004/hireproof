import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAllowlisted } from "@/lib/auth/allowlist";
import { deferAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Google OAuth callback. Exchanges the PKCE code for a session, then enforces
 * AUTHORIZATION (not just authentication): the signed-in identity must be a
 * verified Google email that is on the employer_allowlist (by email or company
 * domain, checked with parameterized filters in isAllowlisted). Allowed ->
 * provision/link the employers row and enter the console. Not allowed -> sign
 * back out and bounce to a "request access" state (no usable session retained).
 */
export async function GET(req: Request) {
  const { origin, searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/employer?error=oauth`);

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.redirect(`${origin}/employer?error=not-configured`);

  const exchange = await supabase.auth.exchangeCodeForSession(code);
  if (exchange.error || !exchange.data.user) return NextResponse.redirect(`${origin}/employer?error=oauth`);

  const user = exchange.data.user;
  const email = (user.email ?? "").trim().toLowerCase();
  const provider = user.app_metadata?.provider ?? "";
  // Google always returns a verified email; reject anything explicitly unverified.
  const emailVerified = user.user_metadata?.email_verified !== false;

  // Hard-reject (BEFORE any allowlist query) anything that isn't a verified
  // Google email, then authorize against the allowlist with parameterized filters.
  const authorized =
    provider === "google" &&
    emailVerified &&
    email.includes("@") &&
    (await isAllowlisted(email));

  if (!authorized) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/employer?access=pending`);
  }

  const domain = email.split("@")[1] ?? "";
  const sb = supabaseAdmin();

  // Provision / link the employers row by auth_user_id. Claim an existing row
  // ONLY by EXACT email and ONLY if it is not a password-provisioned account, so
  // an OAuth identity can never take over the seeded demo/password employer.
  const { data: existing } = await sb
    .from("employers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!existing) {
    const { data: byEmail } = await sb
      .from("employers")
      .select("id,password_hash")
      .eq("email", email)
      .maybeSingle();
    if (byEmail && !byEmail.password_hash) {
      await sb.from("employers").update({ auth_user_id: user.id }).eq("id", byEmail.id);
    } else if (!byEmail) {
      await sb.from("employers").insert({ auth_user_id: user.id, email, org_name: domain || email });
    }
    // byEmail WITH a password_hash: do not hijack it — leave unclaimed.
  }

  deferAudit({ eventType: "employer-login-google", output: { email, provider: "google" } });
  return NextResponse.redirect(`${origin}/employer`);
}
