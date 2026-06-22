import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { bearer } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * List this employer's work-verification enrollments with computed status
 * (overdue) + the latest check result per enrollment. Powers the employer
 * console "Workforce" section.
 */
export async function GET(req: Request) {
  const session = bearer(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: enrollments } = await sb
    .from("work_enrollments")
    .select("id,credential_id,interval_days,next_due,status,created_at")
    .eq("employer_id", session.sub)
    .order("created_at", { ascending: false });

  const rows = enrollments ?? [];
  const enrollmentIds = rows.map((r) => r.id);
  const credentialIds = rows.map((r) => r.credential_id).filter(Boolean) as string[];

  // Latest check per enrollment (fetch recent events, reduce in JS).
  const { data: events } = enrollmentIds.length
    ? await sb
        .from("work_check_events")
        .select("enrollment_id,result,distance,checked_at")
        .in("enrollment_id", enrollmentIds)
        .order("checked_at", { ascending: false })
    : { data: [] };
  const lastByEnrollment = new Map<string, { result: string; distance: number | null; checked_at: string }>();
  for (const e of events ?? []) {
    if (e.enrollment_id && !lastByEnrollment.has(e.enrollment_id)) lastByEnrollment.set(e.enrollment_id, e);
  }

  // Credential score for display.
  const { data: creds } = credentialIds.length
    ? await sb.from("credentials").select("id,payload_json,revoked").in("id", credentialIds)
    : { data: [] };
  const credById = new Map((creds ?? []).map((c) => [c.id, c]));

  const now = Date.now();
  const out = rows.map((r) => {
    const last = lastByEnrollment.get(r.id);
    const cred = credById.get(r.credential_id) as { payload_json?: { aiCollaboration?: { score?: number } }; revoked?: boolean } | undefined;
    return {
      id: r.id,
      credentialId: r.credential_id,
      score: cred?.payload_json?.aiCollaboration?.score ?? 0,
      revoked: cred?.revoked ?? false,
      intervalDays: r.interval_days,
      nextDue: r.next_due,
      status: r.status,
      overdue: r.status === "active" && new Date(r.next_due).getTime() < now,
      lastResult: last?.result ?? null,
      lastDistance: last?.distance ?? null,
      lastCheckedAt: last?.checked_at ?? null,
    };
  });

  return NextResponse.json({ enrollments: out }, { headers: { "Cache-Control": "no-store" } });
}
