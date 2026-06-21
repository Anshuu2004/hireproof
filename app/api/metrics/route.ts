import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Live pilot metrics — aggregate only, no PII. Everything here is computed from
 * REAL session events (see hp_metrics()); there are no placeholder numbers. When
 * no cohort has run yet, the counts are simply zero and the page says so.
 */
export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("hp_metrics");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {}, { headers: { "Cache-Control": "no-store" } });
}
