import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signDetached } from "@/lib/credential/issuer";
import { limited } from "@/lib/ratelimit";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.object({
  sessionId: z.string().uuid(),
  secret: z.string().min(1), // holder proof-of-possession
});

/**
 * Portable DPDP consent receipt. Itemised consent is captured at session start;
 * here we hand the candidate a signed, independently-verifiable record of exactly
 * what they consented to. Holder-gated (POST {sessionId, secret}) + rate-limited:
 * it is NOT an open signing oracle on the issuer key, nor a consent-data leak by
 * UUID — only the data principal who owns the credential can mint their receipt.
 */
export async function POST(req: Request) {
  const rl = limited(req, "consent-receipt", 20, 60_000);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { sessionId, secret } = parsed.data;

  const sb = supabaseAdmin();
  const { data: session } = await sb
    .from("sessions")
    .select("id,language,consent_json,created_at,credential_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Holder proof-of-possession against the session's credential.
  const { data: cred } = session.credential_id
    ? await sb.from("credentials").select("holder_secret_hash").eq("id", session.credential_id).maybeSingle()
    : { data: null };
  const presented = createHash("sha256").update(secret).digest();
  let owned = false;
  if (cred?.holder_secret_hash) {
    const stored = Buffer.from(cred.holder_secret_hash, "hex");
    owned = stored.length === presented.length && timingSafeEqual(stored, presented);
  }
  if (!owned) return NextResponse.json({ error: "Holder key does not match" }, { status: 403 });

  const consent = (session.consent_json ?? {}) as Record<string, unknown>;
  const receipt = {
    type: "HireProofConsentReceipt",
    framework: "India DPDP Act 2023 + DPDP Rules 2025",
    sessionId: session.id,
    issuer: env.issuerDid,
    collectedAt: (consent.at as string) ?? session.created_at,
    language: session.language,
    purpose: "Hiring-integrity verification (liveness + AI-collaboration judgment scoring).",
    items: {
      face: { consented: consent.face === true, use: "In-browser liveness + a 128-D descriptor for cross-round match. Raw video never leaves the device." },
      voice: { consented: consent.voice === true, use: "Spoken-nonce liveness. Only a transcript match signal is kept." },
      crossStage: { consented: consent.crossStage === true, use: "Re-verify the same person across interview rounds." },
    },
    rights: { erasure: "Revoke + delete descriptor via /api/credential/erase (holder-secret gated).", minimisation: "Only a salted descriptor hash enters the credential." },
  };

  const token = await signDetached(receipt as unknown as Record<string, unknown>);
  return NextResponse.json({ receipt, token });
}
