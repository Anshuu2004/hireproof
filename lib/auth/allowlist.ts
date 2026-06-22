import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Authorization check for employer sign-in: the email (or its company domain)
 * must be on employer_allowlist.
 *
 * Uses PARAMETERIZED .eq() filters — never string-interpolation into PostgREST
 * .or() — so a crafted OAuth email (e.g. a quoted local-part containing commas
 * or `domain.eq.<allowlisted>`) cannot inject extra filter clauses and match an
 * allowlisted row it has no right to. Fails closed for empty/malformed emails.
 *
 * Allowlist rows are expected to store lower-cased email/domain (matching the
 * lower(email)/lower(domain) unique indexes); we normalise the input the same way.
 */
export async function isAllowlisted(email: string): Promise<boolean> {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return false;
  const domain = normalized.split("@")[1] ?? "";
  const sb = supabaseAdmin();

  const byEmail = await sb
    .from("employer_allowlist")
    .select("id")
    .eq("email", normalized)
    .limit(1)
    .maybeSingle();
  if (byEmail.data) return true;

  if (domain) {
    const byDomain = await sb
      .from("employer_allowlist")
      .select("id")
      .eq("domain", domain)
      .limit(1)
      .maybeSingle();
    if (byDomain.data) return true;
  }
  return false;
}
