import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateChallenge, spokenPhrase, type Language } from "@/lib/liveness/challenge";
import { deferAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";
import { getEmployer } from "@/lib/auth/employer";

export const runtime = "nodejs";

const Body = z.object({
  language: z.enum(["en"]).default("en"),
  consent: z.object({
    face: z.boolean(),
    voice: z.boolean(),
    crossStage: z.boolean(),
    // Opt-in flag for aggregate-only fairness auditing. Never gates the flow and
    // never affects scoring; just authorises /api/audit-demographics to record.
    demographicsForAudit: z.boolean().optional(),
  }),
  credentialId: z.string().uuid().optional(), // present on re-verify rounds
});

/** Start a verification session: record itemised consent, issue a randomised challenge. */
export async function POST(req: Request) {
  // Unauthenticated session creation — rate-limit to stop session-spam/enumeration.
  const rl = limited(req, "session", 30, 60_000);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { language, consent, credentialId } = parsed.data;
  if (!consent.face || !consent.voice) {
    return NextResponse.json(
      { error: "Face and voice consent are required to proceed." },
      { status: 403 }
    );
  }

  const challenge = generateChallenge(language as Language);
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("sessions")
    .insert({
      language,
      consent_json: { ...consent, at: new Date().toISOString() },
      nonce: challenge.nonce,
      task_seed_json: { actions: challenge.actions, digits: challenge.digits },
      liveness_verdict: "pending",
      credential_id: credentialId ?? null,
      round_no: credentialId ? 2 : 1,
      status: "created",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Database error" }, { status: 500 });
  }

  // A re-verify started by an authenticated employer claims governance of that
  // candidate (best-effort; scopes the candidate to this employer's console).
  if (credentialId) {
    const emp = await getEmployer(req);
    if (emp) await sb.from("credentials").update({ governed_by: emp.sub }).eq("id", credentialId).then(() => {}, () => {});
  }

  deferAudit({
    sessionId: data.id,
    eventType: "consent+challenge",
    output: { language, consent, actions: challenge.actions, reverify: Boolean(credentialId) },
  });

  return NextResponse.json({
    sessionId: data.id,
    challenge: { actions: challenge.actions, digits: challenge.digits, language },
    spokenPhrase: spokenPhrase(challenge),
  });
}
