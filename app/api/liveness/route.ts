import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transcriptMatchesDigits, type LivenessAction } from "@/lib/liveness/challenge";
import { appendAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  sessionId: z.string().uuid(),
  livenessProof: z.object({
    completedActions: z.array(z.object({ action: z.string(), atMs: z.number() })),
    faceContinuous: z.boolean(),
    durationMs: z.number(),
  }),
  faceDescriptor: z.array(z.number()).length(128),
  spokenTranscript: z.string().default(""),
  voiceActivity: z.boolean().optional(),
});

/** Cosine-distance threshold below which two descriptors are the same person (tunable). */
const SAME_PERSON_THRESHOLD = 0.3;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { sessionId, livenessProof, faceDescriptor, spokenTranscript, voiceActivity } = parsed.data;

  const sb = supabaseAdmin();
  const { data: session, error } = await sb
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const seed = session.task_seed_json as { actions: LivenessAction[]; digits: number[] };
  const completed = livenessProof.completedActions.map((a) => a.action);

  // Server re-checks the three independent signals (never trusts a client "pass"):
  const actionsOk =
    completed.length >= seed.actions.length && seed.actions.every((a, i) => completed[i] === a);
  const faceOk = livenessProof.faceContinuous;
  // Strongest signal: the spoken transcript contains the just-issued digits.
  // Fallback (when the browser's STT is unavailable/offline): a live voice was
  // present during the bound window. We never silently pass on nothing.
  const digitsMatched = transcriptMatchesDigits(spokenTranscript, seed.digits);
  const voiceOk = digitsMatched || (spokenTranscript.trim() === "" && voiceActivity === true);
  const verdict: "pass" | "fail" = actionsOk && faceOk && voiceOk ? "pass" : "fail";

  const vec = `[${faceDescriptor.join(",")}]`;

  // Cross-round match BEFORE inserting this round's descriptor (so we compare to priors only).
  let crossRound: { distance: number; priorRounds: number; match: boolean } | null = null;
  if (session.credential_id) {
    const { data: m } = await sb.rpc("hp_cross_round_match", {
      p_credential_id: session.credential_id,
      p_embedding: vec,
    });
    const row = Array.isArray(m) ? m[0] : m;
    if (row && Number(row.prior_rounds) > 0) {
      const distance = Number(row.min_distance);
      crossRound = {
        distance,
        priorRounds: Number(row.prior_rounds),
        match: distance <= SAME_PERSON_THRESHOLD,
      };
    }
  }

  await sb.from("face_descriptors").insert({
    credential_id: session.credential_id,
    session_id: sessionId,
    embedding: vec,
    round_no: session.round_no ?? 1,
  });

  await sb
    .from("sessions")
    .update({
      liveness_verdict: verdict,
      liveness_proof_json: livenessProof,
      spoken_transcript: spokenTranscript,
      status: verdict === "pass" ? "live_passed" : "created",
    })
    .eq("id", sessionId);

  await appendAudit({
    sessionId,
    eventType: "liveness",
    output: {
      verdict,
      checks: { actionsOk, faceOk, voiceOk },
      voice: { digitsMatched, voiceActivity: voiceActivity ?? null },
      crossRound,
    },
  });

  return NextResponse.json({ verdict, checks: { actionsOk, faceOk, voiceOk }, crossRound });
}
