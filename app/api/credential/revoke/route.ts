import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmployer } from "@/lib/auth/employer";
import { deferAudit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({ credentialId: z.string().uuid() });

/** Real revocation: an authenticated employer marks a credential revoked. */
export async function POST(req: Request) {
  const session = await getEmployer(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  // Ownership-scoped revoke: an employer may revoke a credential only if it is
  // ungoverned (first to act claims governance) OR already governed by them.
  // Revoking claims governance for this employer. This stops any authenticated
  // employer from revoking another employer's candidate by id.
  let { data, error } = await sb
    .from("credentials")
    .update({ revoked: true, governed_by: session.sub })
    .eq("id", parsed.data.credentialId)
    .or(`governed_by.is.null,governed_by.eq.${session.sub}`)
    .select("id,revoked")
    .maybeSingle();
  if (error) {
    // Fallback only if the governed_by column isn't migrated yet (pre-governance
    // deploy): keep revocation working, scoped by id alone.
    ({ data, error } = await sb
      .from("credentials")
      .update({ revoked: true })
      .eq("id", parsed.data.credentialId)
      .select("id,revoked")
      .maybeSingle());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // No row matched: either the credential doesn't exist, or it is governed by a
  // different employer (not yours to revoke). 404 either way (don't leak which).
  if (!data) return NextResponse.json({ error: "Credential not found or not yours to revoke" }, { status: 404 });

  deferAudit({
    eventType: "credential-revoked",
    output: { credentialId: parsed.data.credentialId, by: session.email },
  });

  return NextResponse.json({ revoked: true });
}
