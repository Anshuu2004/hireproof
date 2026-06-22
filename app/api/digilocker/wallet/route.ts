import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Demo wallet read — the "inside DigiLocker" view for a handle. Unlike the
 * HMAC-protected /pull contract endpoint (which an external DigiLocker server
 * calls), this serves the candidate's own linked documents to the sandbox wallet
 * UI. Returns the credential token so the UI can verify offline via did:web.
 */
export async function GET(req: Request) {
  const handle = (new URL(req.url).searchParams.get("handle") ?? "").trim().toLowerCase();
  if (!handle) return NextResponse.json({ handle: "", docs: [] });

  const sb = supabaseAdmin();
  const { data: links } = await sb
    .from("digilocker_links")
    .select("credential_id,consented_at")
    .eq("dl_handle", handle)
    .order("consented_at", { ascending: false });

  const ids = (links ?? []).map((l) => l.credential_id).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ handle, docs: [] });

  const { data: creds } = await sb
    .from("credentials")
    .select("id,payload_json,signature,issued_at,expires_at,revoked")
    .in("id", ids as string[]);

  const docs = (creds ?? []).map((c) => {
    const claims = c.payload_json as { aiCollaboration?: { score?: number } };
    // Never hand out the live JWS token for a REVOKED credential — the signature
    // verifies offline forever, so leaking it would let a killed credential keep
    // circulating. Still list it (so the wallet can show "revoked"), just without
    // the verifiable token.
    return {
      credentialId: c.id,
      score: claims.aiCollaboration?.score ?? 0,
      issuedAt: c.issued_at,
      expiresAt: c.expires_at,
      revoked: c.revoked,
      token: c.revoked ? null : c.signature,
      verifyUrl: c.revoked ? null : `${env.siteUrl}/v#${c.signature}`,
    };
  });

  return NextResponse.json({ handle, docs }, { headers: { "Cache-Control": "no-store" } });
}
