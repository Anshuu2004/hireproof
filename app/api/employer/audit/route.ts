import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmployer } from "@/lib/auth/employer";

export const runtime = "nodejs";

/** The hash-chained audit trail for a session — the explainable evidence record.
 *  Scoped: if the session's credential is governed by ANOTHER employer, the trail
 *  is not readable (no cross-tenant enumeration of candidates you don't govern). */
export async function GET(req: Request) {
  const session = await getEmployer(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "missing sessionId" }, { status: 400 });
  const sb = supabaseAdmin();

  // Governance check: deny if this session's credential is governed by someone else.
  const { data: sess } = await sb.from("sessions").select("credential_id").eq("id", sessionId).maybeSingle();
  if (sess?.credential_id) {
    const { data: cred, error } = await sb
      .from("credentials")
      .select("governed_by")
      .eq("id", sess.credential_id)
      .maybeSingle();
    // Only enforce when the column exists (error === null) and is set to another employer.
    if (!error && cred?.governed_by && cred.governed_by !== session.sub) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { data } = await sb
    .from("audit_log")
    .select("id,event_type,output_json,model_version,prev_hash,row_hash,created_at")
    .eq("session_id", sessionId)
    .order("id");
  return NextResponse.json({ events: data ?? [] });
}
