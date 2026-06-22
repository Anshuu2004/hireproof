import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { bearer } from "@/lib/auth/session";
import { appendAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  credentialId: z.string().uuid(),
  candidateScore: z.number().int().min(0).max(100),
  livenessPassed: z.boolean().optional(),
});

/**
 * MOCK ATS write-back — NOT a real integration (clearly labelled, by design).
 *
 * Shows the SHAPE of pushing a verified HireProof record into an ATS
 * (Workday / Greenhouse / Lever): an authenticated employer action, a typed
 * payload, an audited push. It makes NO external call and returns a response
 * explicitly flagged `mock: true`. The production path (real Workday REST) is
 * sketched in the comment block below. Status: roadmap — do not present this as
 * a live integration. (See README honest-status table.)
 */
export async function POST(req: Request) {
  const session = bearer(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // --- MOCK: no external ATS is contacted ---
  const mock = {
    mock: true,
    provider: "workday-sandbox (mock)",
    atsRecordId: `MOCK-WD-${randomUUID().slice(0, 8).toUpperCase()}`,
    pushedAt: new Date().toISOString(),
    pushed: {
      credentialId: parsed.data.credentialId,
      aiCollaborationScore: parsed.data.candidateScore,
      livenessVerified: parsed.data.livenessPassed ?? null,
      issuer: "did:web (HireProof)",
    },
    note: "Mock response — no external ATS call was made. Real Workday/Greenhouse/Lever REST integration is roadmap.",
  };

  await appendAudit({
    eventType: "ats-writeback-mock",
    output: { credentialId: parsed.data.credentialId, by: session.email, mock: true },
  });

  /* ---- PRODUCTION (roadmap) — real Workday REST. Uncomment + supply creds:
  const res = await fetch(`https://${process.env.WORKDAY_TENANT}.workday.com/ccx/api/recruiting/v1/candidates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WORKDAY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      externalCredential: parsed.data.credentialId,
      aiCollaborationScore: parsed.data.candidateScore,
      livenessVerified: parsed.data.livenessPassed,
      issuer: "did:web (HireProof)",
    }),
  });
  return NextResponse.json(await res.json());
  ---- */

  return NextResponse.json(mock);
}
