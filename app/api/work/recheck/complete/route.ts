import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({
  sessionId: z.string().uuid(),
  secret: z.string().min(1), // holder proof-of-possession — only the holder can finalise their re-check
});

/**
 * Finalise a work-verification re-check: read the liveness verdict + the
 * cross-round match (from the liveness audit event), record the result, and
 * advance the enrollment's next-due date. A different face -> 'mismatch'
 * (human-review-gated; never an auto-action).
 */
export async function POST(req: Request) {
  const rl = limited(req, "work-recheck-complete", 30, 60_000);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { sessionId } = parsed.data;

  const sb = supabaseAdmin();
  const { data: session } = await sb
    .from("sessions")
    .select("liveness_verdict,credential_id,status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status === "work-checked") {
    return NextResponse.json({ error: "Re-check already recorded" }, { status: 409 });
  }

  // Holder proof-of-possession: only the credential's owner may finalise a
  // re-check and advance its schedule — knowing a sessionId is not enough.
  // (The /start step is already holder-gated; this closes the matching gap.)
  const { data: cred } = session.credential_id
    ? await sb.from("credentials").select("holder_secret_hash").eq("id", session.credential_id).maybeSingle()
    : { data: null };
  const presented = createHash("sha256").update(parsed.data.secret).digest();
  let owned = false;
  if (cred?.holder_secret_hash) {
    const stored = Buffer.from(cred.holder_secret_hash, "hex");
    owned = stored.length === presented.length && timingSafeEqual(stored, presented);
  }
  if (!owned) return NextResponse.json({ error: "Holder key does not match" }, { status: 403 });

  // Cross-round result comes from the liveness event (it matched against priors
  // BEFORE this round's descriptor was inserted — recomputing now would self-match).
  const { data: ev } = await sb
    .from("audit_log")
    .select("output_json")
    .eq("session_id", sessionId)
    .eq("event_type", "liveness")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const crossRound = (ev?.output_json as { crossRound?: { distance: number; match: boolean } } | null)?.crossRound ?? null;

  let result: "pass" | "fail" | "mismatch";
  if (session.liveness_verdict !== "pass") result = "fail";
  else if (crossRound && crossRound.match === false) result = "mismatch";
  else result = "pass";
  const distance = crossRound?.distance ?? null;

  // Advance the active enrollment (if any) and link the event to it.
  const { data: enrollment } = session.credential_id
    ? await sb
        .from("work_enrollments")
        .select("id,interval_days")
        .eq("credential_id", session.credential_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  await sb.from("work_check_events").insert({
    enrollment_id: enrollment?.id ?? null,
    credential_id: session.credential_id,
    session_id: sessionId,
    result,
    distance,
  });

  if (enrollment) {
    const nextDue = new Date(Date.now() + (enrollment.interval_days ?? 30) * 86400_000).toISOString();
    await sb.from("work_enrollments").update({ next_due: nextDue }).eq("id", enrollment.id);
  }

  await sb.from("sessions").update({ status: "work-checked" }).eq("id", sessionId);

  await appendAudit({
    sessionId,
    eventType: "work-recheck",
    output: { credentialId: session.credential_id, result, distance, match: crossRound?.match ?? null, enrolled: !!enrollment },
  });

  return NextResponse.json({ result, distance, match: crossRound?.match ?? null });
}
