import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signDetached } from "@/lib/credential/issuer";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Portable DPDP consent receipt. Itemised consent is captured at session start;
 * here we hand the candidate a signed, independently-verifiable record of exactly
 * what they consented to, when, and for what purpose — re-derivable from
 * sessions.consent_json and verifiable against the issuer key like any credential.
 * Makes "itemised consent" provable and portable, not just stored.
 */
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "missing sessionId" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: session } = await sb
    .from("sessions")
    .select("id,language,consent_json,created_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

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
