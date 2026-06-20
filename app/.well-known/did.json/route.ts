import { NextResponse } from "next/server";
import { didDocument } from "@/lib/credential/issuer";

export const runtime = "nodejs";

/**
 * did:web document — publishes the HireProof issuer's Ed25519 public key so any
 * employer can verify a credential's signature offline, without trusting (or
 * even reaching) HireProof's database.
 */
export function GET() {
  return NextResponse.json(didDocument(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
