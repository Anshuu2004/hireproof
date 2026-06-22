import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";
import { env } from "@/lib/env";
import { DOC_TYPE } from "@/lib/digilocker/doc";

export const runtime = "nodejs";

const Body = z.object({
  credentialId: z.string().uuid(),
  secret: z.string().min(1), // holder proof-of-possession — only the holder can issue their credential
  dlHandle: z.string().min(3).max(64),
  state: z.string().optional(),
});

/**
 * Demo token-exchange / link step: bind a (demo) DigiLocker handle to a credential
 * so it becomes a pullable Issued Document. Gated by the holder secret (same
 * proof-of-possession as erase/revoke) — a QR alone cannot issue into someone's
 * DigiLocker.
 */
export async function POST(req: Request) {
  const rl = limited(req, "digilocker-callback", 20, 60_000);
  if (rl) return rl;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { credentialId, dlHandle } = parsed.data;
  const handle = dlHandle.trim().toLowerCase();

  const sb = supabaseAdmin();
  const { data: cred } = await sb
    .from("credentials")
    .select("holder_secret_hash,revoked")
    .eq("id", credentialId)
    .maybeSingle();
  if (!cred) return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  if (cred.revoked) return NextResponse.json({ error: "Credential is revoked" }, { status: 409 });

  const presented = createHash("sha256").update(parsed.data.secret).digest();
  let owned = false;
  if (cred.holder_secret_hash) {
    const stored = Buffer.from(cred.holder_secret_hash, "hex");
    owned = stored.length === presented.length && timingSafeEqual(stored, presented);
  }
  if (!owned) return NextResponse.json({ error: "Holder key does not match" }, { status: 403 });

  // Idempotent link (unique on handle+credential).
  const ins = await sb.from("digilocker_links").insert({ dl_handle: handle, credential_id: credentialId });
  if (ins.error && !/duplicate|unique/i.test(ins.error.message)) {
    return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }

  await appendAudit({
    eventType: "digilocker-linked",
    output: { credentialId, dlHandle: handle, orgId: env.digilockerOrgId, sandbox: true },
  });

  return NextResponse.json({
    ok: true,
    handle,
    docType: DOC_TYPE,
    orgId: env.digilockerOrgId,
    pullUrl: `${env.siteUrl}/api/digilocker/pull`,
  });
}
