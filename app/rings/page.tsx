"use client";

import { useEffect, useState } from "react";
import { Warning, UsersThree, Detective } from "@phosphor-icons/react";
import { Wordmark } from "@/components/wordmark";

interface Member { id: string; shortId: string; issuedAt: string | null; score: number | null }
interface Ring { size: number; synthetic: boolean; members: Member[] }
interface RingData { rings: Ring[]; totalFlagged: number }

/** Radial graph: one shared face at the centre, N identities around it. */
function RingGraph({ n }: { n: number }) {
  const cx = 130, cy = 110, r = 78;
  const nodes = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  return (
    <svg viewBox="0 0 260 220" className="w-full">
      {nodes.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--color-danger)" strokeWidth="1.2" strokeOpacity="0.55" />
      ))}
      {nodes.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="11" fill="var(--color-ink-800)" stroke="var(--color-ink-600)" strokeWidth="1" />
          <text x={p.x} y={p.y + 3} textAnchor="middle" className="fill-ink-400" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>id{i + 1}</text>
        </g>
      ))}
      {/* shared face at the centre */}
      <circle cx={cx} cy={cy} r="20" fill="var(--color-danger-wash)" stroke="var(--color-danger)" strokeWidth="1.6" />
      <text x={cx} y={cy + 4} textAnchor="middle" className="fill-danger" style={{ fontSize: 10, fontWeight: 600 }}>1 face</text>
    </svg>
  );
}

export default function RingsPage() {
  const [d, setD] = useState<RingData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/rings")
      .then((r) => r.json())
      .then((x) => (x.error ? setErr(x.error) : setD(x as RingData)))
      .catch(() => setErr("Could not load rings"));
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-950">
      <header className="border-b border-ink-700/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="hidden h-4 w-px bg-ink-700 sm:block" />
            <span className="hidden eyebrow text-ink-500 sm:block">Fraud-ring analytics</span>
          </div>
          <span className="rounded-full border border-ink-700 px-2.5 py-1 eyebrow text-ink-500">cross-employer · network effect</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">Cross-employer fraud rings</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-400">
          One operator, many identities. We run the same face-embedding match that catches a seat-swap
          across rounds — but <span className="text-ink-200">across credential boundaries</span>. A ring
          rotates phone, IP and résumé; it cannot rotate the face. Every credential issued strengthens this
          view — the compounding moat a per-tenant verifier can&apos;t replicate.
        </p>

        <div className="mt-4 flex items-start gap-3 rounded-card border border-amber/30 bg-amber-wash/5 p-3.5 text-xs leading-relaxed text-ink-400">
          <Warning size={15} className="mt-0.5 shrink-0 text-amber" weight="fill" />
          <span>
            <span className="text-ink-200">Honest scope:</span> rings shown below are <span className="text-amber">SEEDED / synthetic</span> to
            demonstrate the query — this is a <span className="text-ink-200">human-review flag, never an auto-reject</span>; face-api 128-D FAR/FRR is
            unmeasured; the network effect is <span className="text-ink-200">architectural</span> until many employers verify; cross-candidate linking is a
            stated DPDP purpose-limitation governance item. No single-candidate verifier ships a cross-employer ring view via a candidate-owned biometric credential.
          </span>
        </div>

        {err && <p className="mt-6 text-sm text-danger">Error: {err}</p>}
        {!d && !err && <p className="mt-10 font-data text-xs text-ink-500">scanning embeddings…</p>}

        {d && d.rings.length === 0 && (
          <div className="mt-8 rounded-card border border-ink-700/70 bg-ink-900/60 p-8 text-center">
            <Detective size={24} className="mx-auto text-proof" />
            <p className="mt-3 text-base font-medium text-ink-100">No rings detected</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-400">
              No face currently appears under multiple identities at the 0.30 threshold. Seed a synthetic
              ring (one face, N identities) to demonstrate the detector.
            </p>
          </div>
        )}

        {d && d.rings.length > 0 && (
          <div className="mt-8 space-y-5">
            {d.rings.map((ring, i) => (
              <div key={i} className="overflow-hidden rounded-card border border-danger/50 bg-danger-wash/[0.06]">
                <div className="flex items-center justify-between border-b border-danger/30 px-5 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-danger">
                    <UsersThree size={17} weight="fill" /> RING FLAGGED — 1 face / {ring.size} identities
                  </span>
                  {ring.synthetic && <span className="rounded-full bg-amber-wash/20 px-2.5 py-0.5 eyebrow text-amber">seeded · synthetic</span>}
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-[260px_1fr]">
                  <RingGraph n={ring.size} />
                  <div>
                    <p className="eyebrow mb-2 text-ink-400">Linked identities (same biometric)</p>
                    <ul className="divide-y divide-ink-800">
                      {ring.members.map((mem) => (
                        <li key={mem.id} className="flex items-center justify-between py-2">
                          <span className="font-data text-xs text-ink-200">{mem.shortId}</span>
                          <span className="font-data text-[0.65rem] text-ink-500">
                            {mem.issuedAt ? new Date(mem.issuedAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—"}
                            {mem.score != null ? ` · score ${mem.score}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
