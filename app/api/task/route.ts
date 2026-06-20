import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateTask } from "@/lib/ai/task";
import { appendAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ sessionId: z.string().uuid() });

/** Generate a fresh, randomised AI-collaboration task (with a hidden planted error). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: session } = await sb
    .from("sessions")
    .select("id,status")
    .eq("id", parsed.data.sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  let spec, provider;
  try {
    ({ spec, provider } = await generateTask());
  } catch (e) {
    return NextResponse.json(
      { error: `AI unavailable: ${e instanceof Error ? e.message : "error"}` },
      { status: 502 }
    );
  }

  const { data, error } = await sb
    .from("ai_tasks")
    .insert({
      session_id: parsed.data.sessionId,
      task_type: spec.domain,
      prompt_seed: { spec },
      brief: spec.brief,
      planted_error_desc: spec.plantedError,
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "db error" }, { status: 500 });

  await appendAudit({
    sessionId: parsed.data.sessionId,
    eventType: "task-generated",
    output: { taskId: data.id, domain: spec.domain },
    modelVersion: provider,
  });

  return NextResponse.json({ taskId: data.id, title: spec.title, brief: spec.brief, provider });
}
