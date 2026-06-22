import { createHash, createHmac, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { env } from "@/lib/env";

const scryptAsync = promisify(scrypt) as (password: string | Buffer, salt: Buffer, keylen: number) => Promise<Buffer>;

/**
 * Self-contained employer session auth — real, no external auth provider config
 * required. A session is an HMAC-signed token (key derived from the server-only
 * service-role secret); passwords are scrypt-hashed. Protected employer routes
 * call `bearer(req)`; the login route issues a token via `signSession`.
 */
export interface EmployerSession {
  sub: string;
  email: string;
  exp: number;
}

function key(): Buffer {
  return createHash("sha256").update(`${env.supabaseServiceRole}|hireproof-employer-auth`).digest();
}

export function signSession(employer: { id: string; email: string }, ttlMs = 12 * 3600_000): string {
  const payload: EmployerSession = { sub: employer.id, email: employer.email, exp: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | null | undefined): EmployerSession | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as EmployerSession;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Extract + verify the employer session from an Authorization: Bearer header. */
export function bearer(req: Request): EmployerSession | null {
  const h = req.headers.get("authorization") ?? "";
  return verifySession(h.startsWith("Bearer ") ? h.slice(7) : null);
}

/** Verify a password against a stored `scrypt$<saltHex>$<keyHex>` hash (async — does not block the event loop). */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
