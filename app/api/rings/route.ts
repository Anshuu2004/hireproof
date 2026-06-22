import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { shortId } from "@/lib/format";
import { limited } from "@/lib/ratelimit";

export const runtime = "nodejs";

interface Edge { a_credential: string; b_credential: string; distance: number }
interface Cred { id: string; issued_at: string; issuer_did: string | null; payload_json: { aiCollaboration?: { score?: number } } | null }

/**
 * Cross-employer fraud-ring view: groups credentials whose enrolled faces match
 * across DIFFERENT candidate identities (the laptop-farm / proxy pattern). The
 * SAME pgvector operator as cross-round match, dropped across credential
 * boundaries. A human-review flag, never an auto-reject.
 */
export async function GET(req: Request) {
  // Public endpoint over a quadratic all-pairs face self-join — rate-limit so it
  // can't be hammered into a request-time DoS as enrollment grows.
  const rl = limited(req, "rings", 30, 60_000);
  if (rl) return rl;

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

  // PRIVACY: this is a PUBLIC view, so it must NEVER expose the real biometric
  // linkage graph (who matches whom) for genuine candidates — that is sensitive
  // cross-employer data and a DPDP purpose-limitation breach. Restrict the public
  // payload to fully SEEDED/synthetic rings (the demonstration data); real rings
  // are computed but withheld here and belong behind the authenticated console.
  const isSynthetic = (id: string) => (meta.get(id)?.issuer_did ?? "").includes("synthetic");

  const rings = [...groups.values()]
    .filter((g) => g.length >= 2)
    .filter((g) => g.every(isSynthetic))
    .map((g) => ({
      size: g.length,
      synthetic: true,
      members: g.map((id) => ({
        id,
        shortId: shortId(id),
        issuedAt: meta.get(id)?.issued_at ?? null,
        score: meta.get(id)?.payload_json?.aiCollaboration?.score ?? null,
      })),
    }))
    .sort((a, b) => b.size - a.size);

  // Only emit edges among the synthetic credentials we actually surface.
  const shownIds = new Set(rings.flatMap((r) => r.members.map((m) => m.id)));
  const shownEdges = edges.filter((e) => shownIds.has(e.a_credential) && shownIds.has(e.b_credential));

  return NextResponse.json(
    { rings, edges: shownEdges, totalFlagged: rings.reduce((n, r) => n + r.size, 0) },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } }
  );
}
