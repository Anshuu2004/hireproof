import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scoreTranscript, type Turn } from "@/lib/ai/scorer";
import type { TaskSpec } from "@/lib/ai/task";
import { appendAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  sessionId: z.string().uuid(),
  taskId: z.string().uuid(),
  turns: z.array(z.object({ role: z.enum(["candidate", "assistant"]), content: z.string() })),
  finalAnswer: z.string().min(1),
});

/** Score the AI-collaboration transcript: deterministic signals + locked-rubric grader. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { sessionId, taskId, turns, finalAnswer } = parsed.data;

  const sb = supabaseAdmin();
  const { data: task } = await sb
    .from("ai_tasks")
    .select("prompt_seed")
    .eq("id", taskId)
    .single();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const spec = (task.prompt_seed as { spec: TaskSpec }).spec;

  let result;
  try {
    result = await scoreTranscript(
      { brief: spec.brief, plantedError: spec.plantedError, correctApproach: spec.correctApproach },
      turns as Turn[],
      finalAnswer
    );
  } catch (e) {
    return NextResponse.json(
      { error: `AI unavailable: ${e instanceof Error ? e.message : "error"}` },
      { status: 502 }
    );
  }

  // persist transcript turns (the audit material) + final answer
  const rows = [...turns, { role: "candidate" as const, content: `FINAL ANSWER:\n${finalAnswer}` }].map(
    (t, i) => ({ ai_task_id: taskId, turn_no: i + 1, role: t.role, content: t.content })
  );
  await sb.from("ai_transcript_turns").insert(rows);

  await sb.from("scores").insert({
    session_id: sessionId,
    error_detection: result.rubric.error_detection,
    direction_quality: result.rubric.direction_quality,
    verification: result.rubric.verification,
    iteration: result.rubric.iteration,
    final_correctness: result.rubric.final_correctness,
    deterministic_signals_json: result.signals,
    ai_collab_score: result.aiCollabScore,
    model_version: result.provider,
    prompt_version: "rubric-v1",
  });

  await sb.from("sessions").update({ status: "scored" }).eq("id", sessionId);

  await appendAudit({
    sessionId,
    eventType: "ai-collab-score",
    output: {
      aiCollabScore: result.aiCollabScore,
      bands: result.bands,
      caughtPlantedError: result.rubric.caughtPlantedError,
      capped: result.capped,
      subScores: {
        error_detection: result.rubric.error_detection,
        direction_quality: result.rubric.direction_quality,
        verification: result.rubric.verification,
        iteration: result.rubric.iteration,
        final_correctness: result.rubric.final_correctness,
      },
    },
    modelVersion: result.provider,
    promptVersion: "rubric-v1",
  });

  return NextResponse.json({
    aiCollabScore: result.aiCollabScore,
    bands: result.bands,
    rubric: result.rubric,
    signals: result.signals,
    capped: result.capped,
    provider: result.provider,
  });
}
