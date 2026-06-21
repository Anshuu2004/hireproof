import { NextResponse } from "next/server";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { genText } from "@/lib/ai/gateway";
import type { TaskSpec } from "@/lib/ai/task";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  taskId: z.string().uuid(),
  messages: z
    .array(z.object({ role: z.enum(["candidate", "assistant"]), content: z.string() }))
    .min(1),
});

/** The AI tool the candidate is given. Steered (per task) to embed the planted error. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: task } = await sb
    .from("ai_tasks")
    .select("prompt_seed")
    .eq("id", parsed.data.taskId)
    .single();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const spec = (task.prompt_seed as { spec: TaskSpec }).spec;
  const messages: ModelMessage[] = parsed.data.messages.map((m) => ({
    role: m.role === "candidate" ? "user" : "assistant",
    content: m.content,
  }));

  try {
    const { text, provider } = await genText("smart", {
      system: spec.assistantSystemPrompt,
      messages,
      temperature: 0.7,
      maxOutputTokens: 700,
    });

    // Persist the turn server-side so scoring is authoritative and cannot be
    // gamed by a forged client transcript: the AI's reply is recorded as the
    // model actually produced it, alongside the candidate's latest prompt.
    const lastCandidate = parsed.data.messages[parsed.data.messages.length - 1];
    const { count } = await sb
      .from("ai_transcript_turns")
      .select("*", { count: "exact", head: true })
      .eq("ai_task_id", parsed.data.taskId);
    let turnNo = count ?? 0;
    const rows: { ai_task_id: string; turn_no: number; role: string; content: string }[] = [];
    if (lastCandidate?.role === "candidate") {
      rows.push({ ai_task_id: parsed.data.taskId, turn_no: ++turnNo, role: "candidate", content: lastCandidate.content });
    }
    rows.push({ ai_task_id: parsed.data.taskId, turn_no: ++turnNo, role: "assistant", content: text });
    await sb.from("ai_transcript_turns").insert(rows);

    return NextResponse.json({ reply: text, provider });
  } catch (e) {
    return NextResponse.json(
      { error: `AI unavailable: ${e instanceof Error ? e.message : "error"}` },
      { status: 502 }
    );
  }
}
