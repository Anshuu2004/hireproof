import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { shortId } from "@/lib/format";

export const runtime = "nodejs";

interface Edge { a_credential: string; b_credential: string; distance: number }
interface Cred { id: string; issued_at: string; issuer_did: string | null; payload_json: { aiCollaboration?: { score?: number } } | null }

/**
 * Cross-employer fraud-ring view: groups credentials whose enrolled faces match
 * across DIFFERENT candidate identities (the laptop-farm / proxy pattern). The
 * SAME pgvector operator as cross-round match, dropped across credential
 * boundaries. A human-review flag, never an auto-reject.
 */
export async function GET() {
  const sb = supabaseAdmin();
  const { data: edgesRaw, error } = await sb.rpc("hp_face_ring", { p_threshold: 0.3 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const edges = (edgesRaw ?? []) as Edge[];

  // union-find → connected components
  const parent: Record<string, string> = {};
  const find = (x: string): string => {
    parent[x] ??= x;
    return parent[x] === x ? x : (parent[x] = find(parent[x]));
  };
  const ids = new Set<string>();
  for (const e of edges) {
    ids.add(e.a_credential);
    ids.add(e.b_credential);
    parent[find(e.a_credential)] = find(e.b_credential);
  }

  const idList = [...ids];
  const { data: credsRaw } = idList.length
    ? await sb.from("credentials").select("id,issued_at,issuer_did,payload_json").in("id", idList)
    : { data: [] as Cred[] };
  const meta = new Map<string, Cred>();
  (credsRaw as Cred[] | null ?? []).forEach((c) => meta.set(c.id, c));

  const groups = new Map<string, string[]>();
  idList.forEach((id) => {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(id);
  });

  const rings = [...groups.values()]
    .filter((g) => g.length >= 2)
    .map((g) => ({
      size: g.length,
      synthetic: g.some((id) => (meta.get(id)?.issuer_did ?? "").includes("synthetic")),
      members: g.map((id) => ({
        id,
        shortId: shortId(id),
        issuedAt: meta.get(id)?.issued_at ?? null,
        score: meta.get(id)?.payload_json?.aiCollaboration?.score ?? null,
      })),
    }))
    .sort((a, b) => b.size - a.size);

  return NextResponse.json(
    { rings, edges, totalFlagged: rings.reduce((n, r) => n + r.size, 0) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
