import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmployer } from "@/lib/auth/employer";

export const runtime = "nodejs";

/**
 * Credentials for the authenticated employer console. Scoped: an employer sees
 * the OPEN candidate-owned roster (credentials not yet governed by anyone) plus
 * the candidates THEY govern (claimed by revoke/re-verify) — never another
 * employer's governed candidates. (Falls back to the open list if the
 * governed_by column isn't migrated yet, so the console never hard-breaks.)
 */
export async function GET(req: Request) {
  const session = await getEmployer(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const cols = "id,session_id,payload_json,issued_at,expires_at,revoked,round_count";
  // Exclude synthetic fraud-ring demo data (issuer did:web:synthetic-demo) so it
  // never pollutes the real candidate roster.
  const scoped = await sb
    .from("credentials")
    .select(cols)
    .or(`governed_by.is.null,governed_by.eq.${session.sub}`)
    .not("issuer_did", "like", "%synthetic%")
    .order("issued_at", { ascending: false })
    .limit(50);

  let data = scoped.data;
  if (scoped.error) {
    // governed_by not present yet — fall back to the unscoped list.
    const fallback = await sb
      .from("credentials")
      .select(cols)
      .not("issuer_did", "like", "%synthetic%")
      .order("issued_at", { ascending: false })
      .limit(50);
    data = fallback.data;
  }
  return NextResponse.json({ credentials: data ?? [] });
}
