import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Recent issued credentials for the employer console (demo: open access). */
export async function GET() {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("credentials")
    .select("id,session_id,payload_json,issued_at,expires_at,revoked,round_count")
    .order("issued_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ credentials: data ?? [] });
}
