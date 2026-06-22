import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deferAudit } from "@/lib/audit";
import { verifyCredential } from "@/lib/credential/issuer";

export const runtime = "nodejs";

/** DB-backed status for a credential: revocation, round count, expiry. Optional
 *  online enhancement on top of the offline signature verification.
 *
 *  If the caller supplies the credential `token`, we ACTUALLY verify its Ed25519
 *  signature server-side and record the real result — we never assert a check we
 *  did not perform (that would poison the tamper-evident audit log). When no
 *  token is given this is a pure status lookup and signature_valid stays null. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const token = url.searchParams.get("token");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("credentials")
    .select("id,revoked,round_count,issued_at,expires_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) return NextResponse.json({ found: false });

  // Only attest a signature result we actually computed. `null` = not checked.
  let signatureValid: boolean | null = null;
  if (token) {
    const v = await verifyCredential(token);
    // the token must also be FOR this credential id (jti/sub === id)
    const sub = (v.payload?.sub as string | undefined) ?? (v.payload?.jti as string | undefined);
    signatureValid = v.valid && sub === id;
  }

  await sb.from("verifications").insert({
    credential_id: id,
    signature_valid: signatureValid,
    cross_round_status: data.round_count > 1 ? "multi-round" : "first-round",
  });
  deferAudit({
    sessionId: null,
    eventType: token ? "credential-verified" : "credential-status-checked",
    output: { credentialId: id, revoked: data.revoked, signatureValid },
  });

  return NextResponse.json({
    found: true,
    revoked: data.revoked,
    rounds: data.round_count,
    issuedAt: data.issued_at,
    expiresAt: data.expires_at,
    signatureValid,
  });
}
