import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmployer } from "@/lib/auth/employer";
import { appendAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";
import { signDetached } from "@/lib/credential/issuer";
import { buildFairnessReport, worstImpactRatio, type CohortRow } from "@/lib/bias/fairness";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.object({
  passThreshold: z.number().int().min(0).max(100).default(60),
  minCell: z.number().int().min(1).max(100).default(10),
});

/**
 * Run a bias / fairness audit (employer-only) and mint a signed, exportable
 * certificate. The cohort counts come from hp_bias_cohorts; the four-fifths math
 * + cell suppression run in lib/bias/fairness. The certificate is an Ed25519 JWT
 * (same issuer key as a credential), so it is tamper-evident and verifiable
 * offline against /.well-known/did.json.
 */
export async function POST(req: Request) {
  const session = await getEmployer(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rl = limited(req, "bias-audit-run", 10, 60_000, session.sub);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { passThreshold, minCell } = parsed.data;

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("hp_bias_cohorts", { p_pass_threshold: passThreshold });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: CohortRow[] = (data ?? []).map((r: { dimension: string; grp: string; total: number; selected: number }) => ({
    dimension: r.dimension,
    grp: r.grp,
    total: Number(r.total),
    selected: Number(r.selected),
  }));

  const report = buildFairnessReport(rows, { passThreshold, minCell });
  const ratio = worstImpactRatio(report);
  const datasetNote =
    "Computed live over real scored sessions. Demographics are opt-in + aggregate-only; small cohorts are cell-suppressed. Small-N pilot — not a production-scale audit.";

  // Tamper-evident, did:web-verifiable certificate. We sign a digest of the
  // report so the JWT stays small but binds to the exact figures shown.
  const reportHash = createHash("sha256").update(JSON.stringify(report)).digest("hex");
  const certificate = await signDetached({
    type: "HireProofFairnessAudit",
    framework: "NYC Local Law 144 (four-fifths rule) + EU AI Act high-risk AI",
    issuer: env.issuerDid,
    rule: report.rule,
    passThreshold,
    minCell,
    overallPass: report.overallPass,
    worstImpactRatio: ratio,
    evaluableDimensions: report.evaluableDimensions,
    reportHash,
    datasetNote,
  });

  const { data: ins, error: insErr } = await sb
    .from("bias_audit_runs")
    .insert({
      group_buckets_json: report.dimensions,
      selection_rate_ratio: ratio,
      four_fifths_pass: report.overallPass,
      dataset_note: datasetNote,
      report_json: report,
      certificate_jws: certificate,
      pass_threshold: passThreshold,
    })
    .select("id,run_at")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  await appendAudit({
    eventType: "bias-audit-run",
    output: {
      runId: ins.id,
      passThreshold,
      minCell,
      overallPass: report.overallPass,
      worstImpactRatio: ratio,
      evaluableDimensions: report.evaluableDimensions,
      reportHash,
    },
    promptVersion: "fourfifths-v1",
  });

  return NextResponse.json({
    runId: ins.id,
    runAt: ins.run_at,
    report,
    worstImpactRatio: ratio,
    certificate,
    datasetNote,
  });
}
