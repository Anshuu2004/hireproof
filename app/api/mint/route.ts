import { NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signCredential, descriptorHash, type CredentialClaims } from "@/lib/credential/issuer";
import { appendAudit } from "@/lib/audit";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.object({ sessionId: z.string().uuid() });
const EXPIRY_DAYS = 180;

/** Mint the candidate-owned credential: assemble claims, Ed25519-sign, persist, QR. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: session } = await sb.from("sessions").select("*").eq("id", parsed.data.sessionId).single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.liveness_verdict !== "pass") {
    return NextResponse.json({ error: "Liveness not passed — cannot mint" }, { status: 400 });
  }

  const { data: scoreRow } = await sb
    .from("scores")
    .select("*")
    .eq("session_id", parsed.data.sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: fd } = await sb
    .from("face_descriptors")
    .select("embedding")
    .eq("session_id", parsed.data.sessionId)
    .limit(1)
    .maybeSingle();
  const descriptor: number[] = fd?.embedding
    ? typeof fd.embedding === "string"
      ? JSON.parse(fd.embedding)
      : fd.embedding
    : [];

  const credentialId = randomUUID();
  const claims: CredentialClaims = {
    humanVerified: true,
    livenessPassed: true,
    aiCollaboration: {
      score: scoreRow?.ai_collab_score ?? 0,
      direct: Math.round(((scoreRow?.direction_quality ?? 0) / 5) * 100),
      judge: Math.round(((scoreRow?.error_detection ?? 0) / 5) * 100),
      correct: Math.round(((scoreRow?.final_correctness ?? 0) / 5) * 100),
    },
    faceDescriptorHash: descriptor.length ? descriptorHash(descriptor, credentialId) : "",
    rounds: session.round_no ?? 1,
  };

  const token = await signCredential(claims, credentialId, EXPIRY_DAYS);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + EXPIRY_DAYS * 86400_000);

  const { error } = await sb.from("credentials").insert({
    id: credentialId,
    session_id: parsed.data.sessionId,
    payload_json: claims,
    signature: token,
    issuer_did: env.issuerDid,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    round_count: claims.rounds,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // bind this session's descriptor to the credential for cross-round matching
  await sb.from("face_descriptors").update({ credential_id: credentialId }).eq("session_id", parsed.data.sessionId);
  await sb.from("sessions").update({ credential_id: credentialId, status: "issued" }).eq("id", parsed.data.sessionId);
  await appendAudit({
    sessionId: parsed.data.sessionId,
    eventType: "credential-issued",
    output: { credentialId, score: claims.aiCollaboration.score, issuer: env.issuerDid },
  });

  const verifyUrl = `${env.siteUrl}/v#${token}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 6,
    color: { dark: "#0a0b0d", light: "#fcfcfd" },
  });

  return NextResponse.json({
    token,
    credentialId,
    verifyUrl,
    qrDataUrl,
    claims,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
}
