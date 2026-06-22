import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scoreTranscript, type Turn } from "@/lib/ai/scorer";
import type { TaskSpec } from "@/lib/ai/task";
import { deferAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";

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
  // Unauthenticated + calls the paid AI Gateway — rate-limit to stop cost-drain/DoS.
  const rl = limited(req, "score", 20, 60_000);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { sessionId, taskId, finalAnswer } = parsed.data;

  const sb = supabaseAdmin();
  // Validate the task first (cheap), then ATOMICALLY claim the session for scoring
  // before the expensive LLM grade. The claim is one conditional UPDATE
  // (live_passed -> scoring); only one of N concurrent POSTs can win, so we can't
  // double-charge the grader or write duplicate/conflicting score rows for a
  // session — the read-then-write idempotency race is closed in a single statement.
  const { data: task } = await sb.from("ai_tasks").select("prompt_seed,session_id").eq("id", taskId).single();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // The task must belong to this session — stops cross-session task harvesting
  // (grabbing a taskId and scoring it against an unrelated session).
  if (task.session_id && task.session_id !== sessionId) {
    return NextResponse.json({ error: "Task does not belong to this session" }, { status: 403 });
  }

  const { data: claimed } = await sb
    .from("sessions")
    .update({ status: "scoring" })
    .eq("id", sessionId)
    .eq("status", "live_passed")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    // Claim failed — disambiguate: missing vs already-scored vs in-flight/not-ready.
    const { data: sess } = await sb.from("sessions").select("status").eq("id", sessionId).maybeSingle();
    if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (sess.status === "scored" || sess.status === "issued") {
      return NextResponse.json({ error: "Session already scored" }, { status: 409 });
    }
    return NextResponse.json({ error: "Session is not ready to score, or scoring is already in progress" }, { status: 409 });
  }

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
    // Grading failed after we claimed the session — RELEASE the claim so the
    // candidate can retry (otherwise it would be stuck in 'scoring' forever).
    await sb.from("sessions").update({ status: "live_passed" }).eq("id", sessionId).eq("status", "scoring");
    return NextResponse.json(
      { error: `AI unavailable: ${e instanceof Error ? e.message : "error"}` },
      { status: 502 }
    );
  }

  const scoreRow = {
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
  };
  // Three independent writes in parallel: close the transcript with the final
  // answer, persist the score (with a graceful rubric_json fallback if the column
  // isn't migrated), and mark the session scored.
  await Promise.all([
    sb.from("ai_transcript_turns").insert({
      ai_task_id: taskId,
      turn_no: turns.length + 1,
      role: "candidate",
      content: `FINAL ANSWER:\n${finalAnswer}`,
    }),
    (async () => {
      const ins = await sb.from("scores").insert({ ...scoreRow, rubric_json: result.rubric });
      if (ins.error) await sb.from("scores").insert(scoreRow);
    })(),
    sb.from("sessions").update({ status: "scored" }).eq("id", sessionId),
  ]);

  deferAudit({
    sessionId,
    eventType: "ai-collab-score",
    output: {
      aiCollabScore: result.aiCollabScore,
      bands: result.bands,
      caughtPlantedError: result.rubric.caughtPlantedError,
      capped: result.capped,
      promptInjectionSuspected: result.signals.promptInjectionSuspected,
      subScores: {
        error_detection: result.rubric.error_detection,
        direction_quality: result.rubric.direction_quality,
        verification: result.rubric.verification,
        iteration: result.rubric.iteration,
        final_correctness: result.rubric.final_correctness,
      },
      justifications: result.rubric.justifications,
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
