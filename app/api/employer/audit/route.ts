import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { bearer } from "@/lib/auth/session";

export const runtime = "nodejs";

/** The hash-chained audit trail for a session — the explainable evidence record. */
export async function GET(req: Request) {
  if (!bearer(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "missing sessionId" }, { status: 400 });
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("audit_log")
    .select("id,event_type,output_json,model_version,prev_hash,row_hash,created_at")
    .eq("session_id", sessionId)
    .order("id");
  return NextResponse.json({ events: data ?? [] });
}
