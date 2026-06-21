import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({ credentialId: z.string().uuid(), secret: z.string().min(1) });

/**
 * Real holder proof-of-possession. The credential is NOT a pure bearer token:
 * at mint a holder secret is generated and only its sha256 is stored (and
 * committed in the signed VC's cnf claim). Here the holder proves ownership by
 * presenting the secret; the server confirms it matches without ever storing
 * the secret itself.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("credentials")
    .select("holder_secret_hash")
    .eq("id", parsed.data.credentialId)
    .maybeSingle();

  if (!data) return NextResponse.json({ found: false, owned: false });

  const presented = createHash("sha256").update(parsed.data.secret).digest();
  let owned = false;
  if (data.holder_secret_hash) {
    const stored = Buffer.from(data.holder_secret_hash, "hex");
    owned = stored.length === presented.length && timingSafeEqual(stored, presented);
  }

  await appendAudit({
    eventType: "ownership-proof",
    output: { credentialId: parsed.data.credentialId, owned },
  });

  return NextResponse.json({ found: true, owned });
}
