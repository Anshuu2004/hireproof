import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** DB-backed status for a credential: revocation, round count, expiry. Optional
 *  online enhancement on top of the offline signature verification. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("credentials")
    .select("id,revoked,round_count,issued_at,expires_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) return NextResponse.json({ found: false });

  // record the verification event (audit who checked what)
  await sb.from("verifications").insert({ credential_id: id, signature_valid: true, cross_round_status: data.round_count > 1 ? "multi-round" : "first-round" });
  await appendAudit({ sessionId: null, eventType: "credential-verified", output: { credentialId: id, revoked: data.revoked } });

  return NextResponse.json({
    found: true,
    revoked: data.revoked,
    rounds: data.round_count,
    issuedAt: data.issued_at,
    expiresAt: data.expires_at,
  });
}
