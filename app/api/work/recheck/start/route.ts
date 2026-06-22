import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateChallenge, spokenPhrase, type Language } from "@/lib/liveness/challenge";
import { appendAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({
  credentialId: z.string().uuid(),
  secret: z.string().min(1), // holder proof-of-possession — only the holder can re-check
  language: z.enum(["en", "hi", "te"]).optional(),
});

/**
 * Start a continuous work-verification re-check. Holder-gated (account-less):
 * the candidate proves ownership with the holder secret, then a fresh randomised
 * challenge is issued bound to the credential, so /api/liveness will cross-round
 * match the new face against the enrolled descriptors.
 */
export async function POST(req: Request) {
  const rl = limited(req, "work-recheck-start", 20, 60_000);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { credentialId } = parsed.data;
  const language = (parsed.data.language ?? "en") as Language;

  const sb = supabaseAdmin();
  const { data: cred } = await sb
    .from("credentials")
    .select("holder_secret_hash,revoked,round_count")
    .eq("id", credentialId)
    .maybeSingle();
  if (!cred) return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  if (cred.revoked) return NextResponse.json({ error: "Credential is revoked" }, { status: 409 });

  const presented = createHash("sha256").update(parsed.data.secret).digest();
  let owned = false;
  if (cred.holder_secret_hash) {
    const stored = Buffer.from(cred.holder_secret_hash, "hex");
    owned = stored.length === presented.length && timingSafeEqual(stored, presented);
  }
  if (!owned) return NextResponse.json({ error: "Holder key does not match" }, { status: 403 });

  const challenge = generateChallenge(language);
  const roundNo = (cred.round_count ?? 1) + 1;

  const { data, error } = await sb
    .from("sessions")
    .insert({
      language,
      consent_json: { face: true, voice: true, crossStage: true, recheck: true, at: new Date().toISOString() },
      nonce: challenge.nonce,
      task_seed_json: { actions: challenge.actions, digits: challenge.digits },
      liveness_verdict: "pending",
      credential_id: credentialId,
      round_no: roundNo,
      status: "work-recheck",
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Database error" }, { status: 500 });

  await appendAudit({
    sessionId: data.id,
    eventType: "work-recheck-start",
    output: { credentialId, roundNo, actions: challenge.actions },
  });

  return NextResponse.json({
    sessionId: data.id,
    challenge: { actions: challenge.actions, digits: challenge.digits, language },
    spokenPhrase: spokenPhrase(challenge),
  });
}
