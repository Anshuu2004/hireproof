import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signSession, verifyPassword } from "@/lib/auth/session";
import { appendAudit } from "@/lib/audit";
import { limited } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

/** Real employer login: verify scrypt password, issue an HMAC-signed session. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Brute-force backoff: the seeded demo password is public, so throttle hard —
  // 8 attempts / 10 min per IP+email before locking out.
  const rl = limited(req, "login", 8, 600_000, parsed.data.email.toLowerCase());
  if (rl) return rl;

  const sb = supabaseAdmin();
  const { data: emp } = await sb
    .from("employers")
    .select("id,email,org_name,password_hash")
    .ilike("email", parsed.data.email)
    .maybeSingle();

  if (!emp || !verifyPassword(parsed.data.password, emp.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = signSession({ id: emp.id, email: emp.email });
  await appendAudit({ eventType: "employer-login", output: { employerId: emp.id, email: emp.email } });
  return NextResponse.json({ token, employer: { email: emp.email, org: emp.org_name } });
}
