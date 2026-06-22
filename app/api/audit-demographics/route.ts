import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Opt-in, self-declared demographics for AGGREGATE fairness auditing only.
 *
 * Deliberately decoupled from the scoring path: this is its own route + its own
 * table (audit_demographics), gated by a separate consent flag in the session.
 * The grader (/api/score, lib/ai/scorer.ts) never reads any of this. It exists
 * purely so the NYC LL144 / four-fifths audit has protected-class groups; output
 * is always aggregate + cell-suppressed (see /api/bias-audit/run).
 */
const Body = z.object({
  sessionId: z.string().uuid(),
  gender: z.enum(["female", "male", "nonbinary", "undisclosed"]).optional(),
  age_band: z.enum(["18-24", "25-34", "35-44", "45-54", "55+", "undisclosed"]).optional(),
  region: z.enum(["north", "south", "east", "west", "undisclosed"]).optional(),
  category: z.enum(["general", "obc", "sc", "st", "ews", "undisclosed"]).optional(),
});

export async function POST(req: Request) {
  const rl = limited(req, "audit-demographics", 30, 60_000);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { sessionId, gender, age_band, region, category } = parsed.data;

  const sb = supabaseAdmin();
  const { data: session } = await sb
    .from("sessions")
    .select("consent_json")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Consent gate: only record if the candidate opted in for audit use.
  const consent = (session.consent_json ?? {}) as { demographicsForAudit?: boolean };
  if (consent.demographicsForAudit !== true) {
    return NextResponse.json({ error: "Demographics consent not granted" }, { status: 403 });
  }

  // One row per session (a resubmit replaces).
  await sb.from("audit_demographics").delete().eq("session_id", sessionId);
  const { error } = await sb.from("audit_demographics").insert({
    session_id: sessionId,
    gender: gender ?? null,
    age_band: age_band ?? null,
    region: region ?? null,
    category: category ?? null,
    consented: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit the FACT of collection (basis + which fields), never the values.
  await appendAudit({
    sessionId,
    eventType: "audit-demographics",
    output: {
      basis: "opt-in, aggregate-only fairness auditing (NYC LL144 / EU AI Act)",
      fields: { gender: !!gender, age_band: !!age_band, region: !!region, category: !!category },
      usedForScoring: false,
    },
  });

  return NextResponse.json({ ok: true });
}
