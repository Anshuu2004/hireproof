import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Latest fairness-audit run — public, aggregate only. Powers the /fairness
 * transparency page (same model as /metrics). Returns the stored report + the
 * signed certificate; no demographics rows or individual records are exposed.
 */
export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("bias_audit_runs")
    .select("id,run_at,report_json,selection_rate_ratio,four_fifths_pass,dataset_note,certificate_jws,pass_threshold")
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ run: null }, { headers: { "Cache-Control": "no-store" } });

  return NextResponse.json(
    {
      run: {
        id: data.id,
        runAt: data.run_at,
        report: data.report_json,
        worstImpactRatio: data.selection_rate_ratio,
        overallPass: data.four_fifths_pass,
        datasetNote: data.dataset_note,
        certificate: data.certificate_jws,
        passThreshold: data.pass_threshold,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
