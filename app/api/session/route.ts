import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateChallenge, spokenPhrase, type Language } from "@/lib/liveness/challenge";
import { appendAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  language: z.enum(["en", "hi", "te"]).default("en"),
  consent: z.object({
    face: z.boolean(),
    voice: z.boolean(),
    crossStage: z.boolean(),
  }),
  credentialId: z.string().uuid().optional(), // present on re-verify rounds
});

/** Start a verification session: record itemised consent, issue a randomised challenge. */
export async function POST(req: Request) {
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

  await appendAudit({
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
