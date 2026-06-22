import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transcriptMatchesDigits, type Language, type LivenessAction } from "@/lib/liveness/challenge";
import { deferAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";

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
/** A challenge is only valid briefly after it was issued — defeats slow proxy
 *  coaching and replay of an old captured body. */
const FRESHNESS_MS = 180_000;
/** Plausible bounds for completing three actions (defeats instantaneous replay). */
const MIN_DURATION_MS = 1200;
const MAX_DURATION_MS = 180_000;
/** A genuine 128-D face-api descriptor has an L2 norm comfortably above this; an
 *  all-zeros / blank vector (what the real client sends on NO face, and what a
 *  headless forge submits) is ~0. Below this we treat the face as absent/forged. */
const MIN_FACE_NORM = 0.1;

export async function POST(req: Request) {
  const rl = limited(req, "liveness", 30, 60_000);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { sessionId, livenessProof, faceDescriptor, spokenTranscript, voiceActivity } = parsed.data;

  const sb = supabaseAdmin();
  const { data: session, error } = await sb
    .from("sessions")
    .select("liveness_verdict,status,task_seed_json,created_at,language,credential_id,round_no")
    .eq("id", sessionId)
    .single();
  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Replay/one-shot guard: a session that already PASSED liveness cannot be
  // re-driven by re-POSTing a captured body (a retry after a fail is still ok).
  if (session.liveness_verdict === "pass" || ["live_passed", "scored", "issued"].includes(session.status)) {
    return NextResponse.json({ error: "Liveness already verified for this session" }, { status: 409 });
  }

  const seed = session.task_seed_json as { actions: LivenessAction[]; digits: number[] };
  const completed = livenessProof.completedActions.map((a) => a.action);

  // Server re-checks the independent signals (never trusts a client "pass"):
  const actionsOk =
    completed.length >= seed.actions.length && seed.actions.every((a, i) => completed[i] === a);
  // Server-side face sanity, not just the client's continuity flag: a real
  // face-api descriptor has a substantial L2 norm; a blank/all-zeros vector is ~0.
  // This blocks a headless forge (and a no-face capture) from passing liveness
  // and going on to mint a "verified human" credential with no real face.
  const faceNorm = Math.sqrt(faceDescriptor.reduce((s, x) => s + x * x, 0));
  const faceDescriptorReal = faceNorm >= MIN_FACE_NORM;
  const faceOk = livenessProof.faceContinuous && faceDescriptorReal;

  // Timing: the client already sends per-action atMs + durationMs — validate them
  // instead of ignoring them. The submission must be fresh (within FRESHNESS_MS of
  // issuance), the per-action timestamps strictly increasing, and the total
  // duration humanly plausible. This kills instantaneous replays and slow-proxy
  // coaching using data we already collect.
  const ageMs = Date.now() - new Date(session.created_at as string).getTime();
  const acts = livenessProof.completedActions;
  const atMonotonic = acts.every((a, i) => i === 0 || a.atMs > acts[i - 1].atMs);
  const durOk = livenessProof.durationMs >= MIN_DURATION_MS && livenessProof.durationMs <= MAX_DURATION_MS;
  const timingOk = ageMs <= FRESHNESS_MS && atMonotonic && durOk;

  // Strongest signal: the spoken transcript contains the just-issued digits, in
  // the session's chosen language. If the browser exposes STT and produced a
  // transcript, it MUST match — a wrong spoken phrase fails. Only when STT is
  // genuinely unavailable (empty transcript) do we fall back to confirmed
  // live-voice activity, recorded explicitly as a degraded mode (never a silent
  // pass on nothing).
  const digitsMatched = transcriptMatchesDigits(spokenTranscript, seed.digits, session.language as Language);
  const sttUnavailable = spokenTranscript.trim() === "";
  const voiceOk = digitsMatched || (sttUnavailable && voiceActivity === true);
  const voiceMode = digitsMatched ? "spoken-nonce" : voiceOk ? "voice-activity-fallback" : "none";
  const verdict: "pass" | "fail" = actionsOk && faceOk && voiceOk && timingOk ? "pass" : "fail";

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

  // One descriptor per session (a retry replaces, never appends). The descriptor
  // replace (ordered delete→insert) runs in parallel with the session update —
  // different tables, no dependency.
  const writeDescriptor = (async () => {
    await sb.from("face_descriptors").delete().eq("session_id", sessionId);
    await sb.from("face_descriptors").insert({
      credential_id: session.credential_id,
      session_id: sessionId,
      embedding: vec,
      round_no: session.round_no ?? 1,
    });
  })();
  await Promise.all([
    writeDescriptor,
    sb
      .from("sessions")
      .update({
        liveness_verdict: verdict,
        liveness_proof_json: livenessProof,
        spoken_transcript: spokenTranscript,
        status: verdict === "pass" ? "live_passed" : "created",
      })
      .eq("id", sessionId),
  ]);

  deferAudit({
    sessionId,
    eventType: "liveness",
    output: {
      verdict,
      checks: { actionsOk, faceOk, voiceOk, timingOk },
      face: { faceContinuous: livenessProof.faceContinuous, descriptorReal: faceDescriptorReal, norm: Math.round(faceNorm * 1000) / 1000 },
      timing: { ageMs, durationMs: livenessProof.durationMs, atMonotonic, durOk, fresh: ageMs <= FRESHNESS_MS },
      voice: { digitsMatched, voiceMode, voiceActivity: voiceActivity ?? null },
      crossRound,
    },
  });

  return NextResponse.json({ verdict, checks: { actionsOk, faceOk, voiceOk, timingOk }, voiceMode, crossRound });
}
