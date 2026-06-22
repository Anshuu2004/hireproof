import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateReliancePanel, scoreReliance, type PanelItem } from "@/lib/ai/reliance";
import { deferAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";
import type { TaskSpec } from "@/lib/ai/task";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  taskId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  decisions: z.record(z.string(), z.boolean()).optional(),
});

/**
 * Appropriate-reliance probe (BN-3). Additive to the planted-error task.
 *   POST { taskId }                      -> generate (or return) the 4-item panel, FLAGS STRIPPED.
 *   POST { taskId, sessionId, decisions } -> score RAIR/RSR against the stored flags.
 */
export async function POST(req: Request) {
  const rl = limited(req, "reliance", 30, 60_000);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { taskId, sessionId, decisions } = parsed.data;

  const sb = supabaseAdmin();
  const { data: task } = await sb
    .from("ai_tasks")
    .select("prompt_seed,reliance_json,session_id")
    .eq("id", taskId)
    .single();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // ── SCORE mode ──────────────────────────────────────────────────────────────
  if (decisions) {
    const items = (task.reliance_json as PanelItem[] | null) ?? [];
    if (!items.length) return NextResponse.json({ error: "No reliance panel for this task" }, { status: 400 });
    const result = scoreReliance(items, decisions);
    if (sessionId) await sb.from("scores").update({ reliance_json: result }).eq("session_id", sessionId);
    deferAudit({ sessionId: sessionId ?? task.session_id ?? null, eventType: "reliance-probe", output: result });
    return NextResponse.json(result);
  }

  // ── GENERATE mode (idempotent — reuse a stored panel) ─────────────────────────
  let items = task.reliance_json as PanelItem[] | null;
  if (!items || !items.length) {
    const spec = (task.prompt_seed as { spec: TaskSpec }).spec;
    try {
      const gen = await generateReliancePanel({
        brief: spec.brief,
        correctApproach: spec.correctApproach,
        plantedError: spec.plantedError,
      });
      items = gen.items;
      await sb.from("ai_tasks").update({ reliance_json: items }).eq("id", taskId);
    } catch (e) {
      return NextResponse.json({ error: `AI unavailable: ${e instanceof Error ? e.message : "error"}` }, { status: 502 });
    }
  }
  // never leak the isCorrect / why flags to the candidate
  return NextResponse.json({ items: items.map((i) => ({ id: i.id, claim: i.claim })) });
}
