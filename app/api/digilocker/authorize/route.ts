import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Demo OAuth-style authorize entry. In production this redirects to DigiLocker's
 * own authorize endpoint (Meri-Pehchaan); in the sandbox it forwards to our
 * DigiLocker-styled consent screen, carrying the same client_id/state/redirect
 * params so the swap to the real endpoint is a URL change only.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const credentialId = url.searchParams.get("credentialId") ?? "";
  const state = url.searchParams.get("state") ?? "";

  const dest = new URL("/digilocker/consent", req.url);
  if (credentialId) dest.searchParams.set("credentialId", credentialId);
  if (state) dest.searchParams.set("state", state);
  return NextResponse.redirect(dest);
}
