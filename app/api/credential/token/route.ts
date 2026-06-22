import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Resolve a credential's signed JWS by id. This lets the QR encode a SHORT,
 * reliably-scannable URL (…/v?c=<id>) instead of the full ~1.2 KB JWT — which
 * produced a version-40 QR that a webcam realistically can't read. /v fetches the
 * token here and still verifies its Ed25519 signature OFFLINE against the
 * published did:web key, so authenticity is unchanged: the server cannot forge a
 * signature, and a tampered token fails the client-side check. (The paste-token
 * path on /v remains fully offline.) Returns only the already-public signature.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const sb = supabaseAdmin();
  const { data } = await sb.from("credentials").select("signature").eq("id", id).maybeSingle();
  if (!data?.signature) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json({ token: data.signature });
}
