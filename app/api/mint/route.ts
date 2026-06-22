import { NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { createHash, randomBytes, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signCredential, descriptorHash, type CredentialClaims } from "@/lib/credential/issuer";
import { deferAudit } from "@/lib/audit";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.object({ sessionId: z.string().uuid() });
const EXPIRY_DAYS = 180;

/** Mint the candidate-owned credential: assemble claims, Ed25519-sign, persist, QR. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: session } = await sb
    .from("sessions")
    .select("liveness_verdict,round_no,status,credential_id")
    .eq("id", parsed.data.sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.liveness_verdict !== "pass") {
    return NextResponse.json({ error: "Liveness not passed — cannot mint" }, { status: 400 });
  }

  // Idempotency: a session mints EXACTLY ONE credential. If one already exists,
  // return it rather than issuing a second — re-minting would re-point the face
  // descriptor to a new credential id, orphan the prior credential's biometric
  // link, and break erase-by-credential_id. The holder secret is shown only at
  // first mint and never stored, so it is not (and cannot be) re-returned here.
  if (session.credential_id || session.status === "issued") {
    const { data: existing } = await sb
      .from("credentials")
      .select("id,payload_json,signature,issued_at,expires_at")
      .eq("id", session.credential_id)
      .maybeSingle();
    if (existing) {
      const verifyUrl = `${env.siteUrl}/v#${existing.signature}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        scale: 6,
        color: { dark: "#0a0b0d", light: "#fcfcfd" },
      });
      return NextResponse.json({
        token: existing.signature,
        credentialId: existing.id,
        holderSecret: null, // only revealed at first mint; never stored
        alreadyIssued: true,
        verifyUrl,
        qrDataUrl,
        claims: existing.payload_json,
        issuedAt: existing.issued_at,
        expiresAt: existing.expires_at,
      });
    }
  }

  // Two independent reads in parallel (and narrowed off `select *`).
  const [{ data: scoreRow }, { data: fd }] = await Promise.all([
    sb
      .from("scores")
      .select("ai_collab_score,direction_quality,error_detection,final_correctness")
      .eq("session_id", parsed.data.sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("face_descriptors").select("embedding").eq("session_id", parsed.data.sessionId).limit(1).maybeSingle(),
  ]);
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

  // Holder proof-of-possession: a secret the candidate keeps; only its hash is
  // stored and committed into the signed VC (cnf). Makes the credential bound
  // to its holder rather than a pure bearer token.
  const holderSecret = randomBytes(16).toString("hex");
  const holderCommit = createHash("sha256").update(holderSecret).digest("hex");

  const token = await signCredential(claims, credentialId, EXPIRY_DAYS, holderCommit);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + EXPIRY_DAYS * 86400_000);

  // QR encodes a SHORT, scannable URL (…/v?c=<id>) — NOT the full ~1.2 KB JWT,
  // which produced a version-40 QR no webcam could read. /v resolves the token by
  // id and still verifies its signature offline against did:web. `verifyUrl` keeps
  // the full self-contained token for the copy/paste (fully-offline) path.
  const verifyUrl = `${env.siteUrl}/v#${token}`;
  const scanUrl = `${env.siteUrl}/v?c=${credentialId}`;
  const qrPromise = QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
    color: { dark: "#0a0b0d", light: "#fcfcfd" },
  });

  const { error } = await sb.from("credentials").insert({
    id: credentialId,
    session_id: parsed.data.sessionId,
    payload_json: claims,
    signature: token,
    issuer_did: env.issuerDid,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    round_count: claims.rounds,
    holder_secret_hash: holderCommit,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // bind the descriptor to the credential + mark issued (independent tables → parallel)
  await Promise.all([
    sb.from("face_descriptors").update({ credential_id: credentialId }).eq("session_id", parsed.data.sessionId),
    sb.from("sessions").update({ credential_id: credentialId, status: "issued" }).eq("id", parsed.data.sessionId),
  ]);
  deferAudit({
    sessionId: parsed.data.sessionId,
    eventType: "credential-issued",
    output: { credentialId, score: claims.aiCollaboration.score, issuer: env.issuerDid },
  });

  const qrDataUrl = await qrPromise;

  return NextResponse.json({
    token,
    credentialId,
    holderSecret, // shown to the candidate ONCE; never stored server-side
    verifyUrl,
    qrDataUrl,
    claims,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
}
