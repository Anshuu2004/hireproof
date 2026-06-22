import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deferAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({ credentialId: z.string().uuid(), secret: z.string().min(1) });

/**
 * DPDP Section 12 — erasure, exercised by the candidate (the data principal).
 * Gated by the same holder proof-of-possession as /prove: only the holder of the
 * credential's secret can erase. Erasure = revoke the credential AND delete the
 * stored face descriptors (the only biometric we keep). The signed token already
 * out in the world stops verifying as live because the credential is revoked and
 * the cross-round biometric is gone. A working right, not a roadmap line.
 */
export async function POST(req: Request) {
  const rl = limited(req, "erase", 10, 600_000);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: cred } = await sb
    .from("credentials")
    .select("id,holder_secret_hash,session_id")
    .eq("id", parsed.data.credentialId)
    .maybeSingle();
  if (!cred) return NextResponse.json({ error: "Credential not found" }, { status: 404 });

  // Prove ownership (constant-time) before honouring the erasure.
  const presented = createHash("sha256").update(parsed.data.secret).digest();
  let owned = false;
  if (cred.holder_secret_hash) {
    const stored = Buffer.from(cred.holder_secret_hash, "hex");
    owned = stored.length === presented.length && timingSafeEqual(stored, presented);
  }
  if (!owned) return NextResponse.json({ error: "Ownership proof failed" }, { status: 403 });

  // Revoke + delete the biometric descriptors tied to this credential.
  await sb.from("credentials").update({ revoked: true }).eq("id", cred.id);
  const { count } = await sb
    .from("face_descriptors")
    .delete({ count: "exact" })
    .eq("credential_id", cred.id);

  // Also erase any opt-in fairness-audit demographics tied to this credential's
  // sessions, so erasure covers ALL personal data, not just the biometric.
  const { data: sess } = await sb.from("sessions").select("id").eq("credential_id", cred.id);
  const sessionIds = new Set<string>((sess ?? []).map((s) => s.id as string));
  if (cred.session_id) sessionIds.add(cred.session_id as string);
  let demographicsDeleted = 0;
  if (sessionIds.size) {
    const { count: dcount } = await sb
      .from("audit_demographics")
      .delete({ count: "exact" })
      .in("session_id", [...sessionIds]);
    demographicsDeleted = dcount ?? 0;
  }

  deferAudit({
    eventType: "erasure",
    output: {
      credentialId: cred.id,
      revoked: true,
      descriptorsDeleted: count ?? null,
      demographicsDeleted,
      basis: "DPDP s.12 holder request",
    },
  });

  return NextResponse.json({ erased: true, descriptorsDeleted: count ?? 0, demographicsDeleted });
}
