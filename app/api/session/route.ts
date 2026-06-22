import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
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
    // In-task camera proctoring during the secured skill test (itemised consent,
    // recorded in consent_json). Optional in the schema for backward-compatible
    // payloads; the client requires it before the flow can start.
    proctor: z.boolean().optional(),
    crossStage: z.boolean(),
    // Opt-in flag for aggregate-only fairness auditing. Never gates the flow and
    // never affects scoring; just authorises /api/audit-demographics to record.
    demographicsForAudit: z.boolean().optional(),
  }),
  credentialId: z.string().uuid().optional(), // present on re-verify rounds
  secret: z.string().min(1).optional(), // holder proof-of-possession for a candidate-initiated re-verify
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

  const sb = supabaseAdmin();

  // A re-verify round binds a NEW face descriptor to an existing credential, so
  // this path must be AUTHORISED — otherwise anyone who learns a credential id
  // could pollute its biometric history or fabricate a cross-round "mismatch".
  // Accept EITHER an authenticated employer (console-initiated round) OR the
  // holder secret (candidate-initiated). Round-1 (no credentialId) is open as before.
  let employerSub: string | null = null;
  if (credentialId) {
    const emp = await getEmployer(req);
    employerSub = emp?.sub ?? null;
    let authorized = !!emp;
    if (!authorized && parsed.data.secret) {
      const { data: cred } = await sb
        .from("credentials")
        .select("holder_secret_hash,revoked")
        .eq("id", credentialId)
        .maybeSingle();
      if (cred && !cred.revoked && cred.holder_secret_hash) {
        const presented = createHash("sha256").update(parsed.data.secret).digest();
        const stored = Buffer.from(cred.holder_secret_hash, "hex");
        authorized = stored.length === presented.length && timingSafeEqual(stored, presented);
      }
    }
    if (!authorized) {
      return NextResponse.json(
        { error: "Re-verify must be started from the employer console or with the holder key." },
        { status: 403 }
      );
    }
  }

  const challenge = generateChallenge(language as Language);

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

  // An employer-initiated re-verify claims governance of that candidate
  // (best-effort; scopes the candidate to this employer's console).
  if (credentialId && employerSub) {
    await sb.from("credentials").update({ governed_by: employerSub }).eq("id", credentialId).then(() => {}, () => {});
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
