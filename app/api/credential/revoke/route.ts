import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { bearer } from "@/lib/auth/session";
import { appendAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({ credentialId: z.string().uuid() });

/** Real revocation: an authenticated employer marks a credential revoked. */
export async function POST(req: Request) {
  const session = bearer(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("credentials")
    .update({ revoked: true })
    .eq("id", parsed.data.credentialId)
    .select("id,revoked")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Credential not found" }, { status: 404 });

  await appendAudit({
    eventType: "credential-revoked",
    output: { credentialId: parsed.data.credentialId, by: session.email },
  });

  return NextResponse.json({ revoked: true });
}
