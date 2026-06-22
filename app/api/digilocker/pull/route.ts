import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";
import { env } from "@/lib/env";
import { buildDocDetails, notFoundResponse, verifyHmac, DOC_TYPE, type DocPayload } from "@/lib/digilocker/doc";

export const runtime = "nodejs";

/**
 * DigiLocker Pull-Document endpoint — the REAL contract (HMAC-signed request ->
 * PullURIResponse). This is what a DigiLocker server calls to fetch the Issued
 * Document. The returned DocData embeds the credential JWS, so the document is
 * offline-verifiable (did:web) even inside DigiLocker. Demo sandbox: the shared
 * HMAC secret + org id are demo defaults (see lib/env.ts); production uses the
 * APISetu partner key.
 *
 * Request body (JSON, DigiLocker-style): { orgId, docType, txn, format, digiLockerId, ts }
 * Header: x-digilocker-hmac = HMAC-SHA256(rawBody, sharedSecret)
 */
export async function POST(req: Request) {
  const rl = limited(req, "digilocker-pull", 60, 60_000);
  if (rl) return rl;

  const raw = await req.text();
  const hmac = req.headers.get("x-digilocker-hmac");
  if (!verifyHmac(raw, env.digilockerSecret, hmac)) {
    return NextResponse.json({ error: "invalid request signature" }, { status: 401 });
  }

  let body: { orgId?: string; docType?: string; txn?: string; format?: string; digiLockerId?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const txn = body.txn ?? "";
  const ts = new Date().toISOString();
  const format = body.format === "json" ? "json" : "xml";

  if (body.orgId !== env.digilockerOrgId) {
    return NextResponse.json({ error: "unknown org" }, { status: 403 });
  }

  const handle = (body.digiLockerId ?? "").trim().toLowerCase();
  const sb = supabaseAdmin();
  const { data: link } = await sb
    .from("digilocker_links")
    .select("credential_id")
    .eq("dl_handle", handle)
    .order("consented_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!link?.credential_id) {
    await sb.from("digilocker_pull_log").insert({ dl_handle: handle, doc_type: body.docType ?? DOC_TYPE, txn, ok: false });
    const xml = notFoundResponse(txn, ts);
    return format === "json"
      ? NextResponse.json({ status: 0, txn, ts })
      : new NextResponse(xml, { headers: { "Content-Type": "application/xml" } });
  }

  const { data: cred } = await sb
    .from("credentials")
    .select("id,payload_json,signature,issued_at,expires_at,revoked,issuer_did")
    .eq("id", link.credential_id)
    .maybeSingle();
  if (!cred) {
    await sb.from("digilocker_pull_log").insert({ dl_handle: handle, doc_type: DOC_TYPE, txn, ok: false });
    return format === "json"
      ? NextResponse.json({ status: 0, txn, ts })
      : new NextResponse(notFoundResponse(txn, ts), { headers: { "Content-Type": "application/xml" } });
  }

  // A revoked credential must NOT be served as an Issued Document (the embedded JWS
  // verifies offline forever, so serving it would let a killed credential keep
  // circulating). Treat revoked as not-found for the pull contract.
  if (cred.revoked) {
    await sb.from("digilocker_pull_log").insert({ dl_handle: handle, doc_type: DOC_TYPE, txn, ok: false });
    await appendAudit({ eventType: "digilocker-pull", output: { credentialId: cred.id, dlHandle: handle, txn, ok: false, reason: "revoked" } });
    return format === "json"
      ? NextResponse.json({ status: 0, txn, ts })
      : new NextResponse(notFoundResponse(txn, ts), { headers: { "Content-Type": "application/xml" } });
  }

  const claims = cred.payload_json as { aiCollaboration?: { score?: number } };
  const payload: DocPayload = {
    docType: DOC_TYPE,
    digiLockerId: handle,
    issuer: cred.issuer_did,
    credentialId: cred.id,
    issuedAt: cred.issued_at,
    expiresAt: cred.expires_at,
    score: claims.aiCollaboration?.score ?? 0,
    verifyUrl: `${env.siteUrl}/v#${cred.signature}`,
    token: cred.signature,
  };

  const { xml } = buildDocDetails(payload, txn, ts);
  await sb.from("digilocker_pull_log").insert({ dl_handle: handle, doc_type: DOC_TYPE, txn, ok: true });
  await appendAudit({ eventType: "digilocker-pull", output: { credentialId: cred.id, dlHandle: handle, txn, ok: true } });

  return format === "json"
    ? NextResponse.json({ status: 1, txn, ts, docDetails: payload })
    : new NextResponse(xml, { headers: { "Content-Type": "application/xml" } });
}
