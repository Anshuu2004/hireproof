import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmployer } from "@/lib/auth/employer";
import { appendAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({
  credentialId: z.string().uuid(),
  intervalDays: z.number().int().min(1).max(365).optional(),
});

/**
 * Enrol a credential into continuous work verification (employer-only). Sets a
 * recurring schedule; the holder re-passes liveness each interval and the new
 * face is cross-round-matched against the enrolled ones.
 */
export async function POST(req: Request) {
  const session = await getEmployer(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rl = limited(req, "work-enroll", 30, 60_000, session.sub);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { credentialId } = parsed.data;
  const intervalDays = parsed.data.intervalDays ?? 30;

  const sb = supabaseAdmin();
  const { data: cred } = await sb
    .from("credentials")
    .select("id,revoked")
    .eq("id", credentialId)
    .maybeSingle();
  if (!cred) return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  if (cred.revoked) return NextResponse.json({ error: "Credential is revoked" }, { status: 409 });

  // Claim governance so it scopes to this employer's console (best-effort).
  await sb.from("credentials").update({ governed_by: session.sub }).eq("id", credentialId).then(() => {}, () => {});

  // Idempotent: reactivate/update an existing enrollment instead of duplicating.
  const nextDue = new Date(Date.now() + intervalDays * 86400_000).toISOString();
  const { data: existing } = await sb
    .from("work_enrollments")
    .select("id")
    .eq("credential_id", credentialId)
    .eq("employer_id", session.sub)
    .maybeSingle();

  let enrollment;
  if (existing) {
    const { data } = await sb
      .from("work_enrollments")
      .update({ interval_days: intervalDays, status: "active", next_due: nextDue })
      .eq("id", existing.id)
      .select("id,credential_id,interval_days,next_due,status")
      .single();
    enrollment = data;
  } else {
    const { data, error } = await sb
      .from("work_enrollments")
      .insert({ credential_id: credentialId, employer_id: session.sub, interval_days: intervalDays, next_due: nextDue })
      .select("id,credential_id,interval_days,next_due,status")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    enrollment = data;
  }

  await appendAudit({
    eventType: "work-enrolled",
    output: { credentialId, employerId: session.sub, intervalDays, nextDue },
  });

  return NextResponse.json({ enrollment });
}
