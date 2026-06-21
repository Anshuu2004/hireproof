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
  // `turns` is accepted for backward compatibility but IGNORED for scoring —
  // the graded transcript is read from the server-recorded turns below.
  turns: z.array(z.object({ role: z.enum(["candidate", "assistant"]), content: z.string() })).optional(),
  finalAnswer: z.string().min(1),
});

/** Score the AI-collaboration transcript: deterministic signals + locked-rubric grader. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { sessionId, taskId, finalAnswer } = parsed.data;

  const sb = supabaseAdmin();
  const { data: task } = await sb
    .from("ai_tasks")
    .select("prompt_seed")
    .eq("id", taskId)
    .single();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const spec = (task.prompt_seed as { spec: TaskSpec }).spec;

  // Authoritative transcript: read the turns the SERVER recorded (in /assistant),
  // not whatever the client sends — so the score can't be gamed by a forged
  // transcript. The AI replies here are exactly what the model produced.
  const { data: turnRows } = await sb
    .from("ai_transcript_turns")
    .select("role,content,turn_no")
    .eq("ai_task_id", taskId)
    .order("turn_no");
  const turns: Turn[] = (turnRows ?? [])
    .filter((t) => t.role === "candidate" || t.role === "assistant")
    .map((t) => ({ role: t.role as "candidate" | "assistant", content: t.content }));

  let result;
  try {
    result = await scoreTranscript(
      { brief: spec.brief, plantedError: spec.plantedError, correctApproach: spec.correctApproach },
      turns,
      finalAnswer
    );
  } catch (e) {
    return NextResponse.json(
      { error: `AI unavailable: ${e instanceof Error ? e.message : "error"}` },
      { status: 502 }
    );
  }

  // append the final answer as the closing turn (the conversation was already
  // persisted server-side during /assistant)
  await sb.from("ai_transcript_turns").insert({
    ai_task_id: taskId,
    turn_no: turns.length + 1,
    role: "candidate",
    content: `FINAL ANSWER:\n${finalAnswer}`,
  });

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
