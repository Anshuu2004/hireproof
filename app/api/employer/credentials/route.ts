import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { bearer } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Recent issued credentials for the authenticated employer console. */
export async function GET(req: Request) {
  if (!bearer(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("credentials")
    .select("id,session_id,payload_json,issued_at,expires_at,revoked,round_count")
    .order("issued_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ credentials: data ?? [] });
}
