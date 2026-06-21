"use client";

import { useEffect, useState } from "react";
import { Pulse, ClockCounterClockwise, Scales, Detective, ShieldCheck, Users } from "@phosphor-icons/react";
import { Wordmark } from "@/components/wordmark";

interface Metrics {
  verifiedCandidates: number;
  completedRuns: number;
  medianSecs: number | null;
  p25Secs: number | null;
  p75Secs: number | null;
  scoredRuns: number;
  medianScore: number | null;
  caughtRatePct: number | null;
  scores: number[];
  completionSecs: number[];
  crossRoundChecks: number;
  crossRoundMatches: number;
  crossRoundMismatches: number;
  offlineVerifies: number;
}

const fmt = (s: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-ink-700/70 bg-ink-900/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-ink-400">
        {icon}
        <span className="eyebrow">{label}</span>
      </div>
      <p className="font-data text-3xl font-semibold tracking-tight text-ink-50">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

/** Score histogram in five bands (0–20 … 80–100). */
function ScoreHistogram({ scores }: { scores: number[] }) {
  const bands = [0, 0, 0, 0, 0];
  for (const s of scores) bands[Math.min(4, Math.floor(s / 20))]++;
  const max = Math.max(1, ...bands);
  const labels = ["0–20", "20–40", "40–60", "60–80", "80–100"];
  return (
    <div className="rounded-card border border-ink-700/70 bg-ink-900/60 p-5">
      <p className="eyebrow mb-4 text-ink-400">AI-collaboration judgment score · distribution</p>
      <div className="flex h-40 items-end gap-3">
        {bands.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-2">
            <span className="font-data text-xs text-ink-300">{n}</span>
            <div
              className="w-full rounded-t-control bg-indigo/70"
              style={{ height: `${(n / max) * 100}%`, minHeight: n > 0 ? 6 : 0 }}
            />
            <span className="font-data text-[0.65rem] text-ink-500">{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MetricsPage() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setM(d as Metrics)))
      .catch(() => setErr("Could not load metrics"));
  }, []);

  const hasData = m && (m.scoredRuns > 0 || m.completedRuns > 0);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-950">
      <header className="border-b border-ink-700/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="hidden h-4 w-px bg-ink-700 sm:block" />
            <span className="hidden eyebrow text-ink-500 sm:block">Live pilot metrics</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-proof/30 px-2.5 py-1 eyebrow text-proof">
            <span className="size-1.5 animate-[pulse-soft_1.4s_ease-in-out_infinite] rounded-full bg-proof" /> live
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">Real-run instrumentation</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-400">
          Every number here is computed live from real verification sessions — completion times and
          per-stage events from the hash-chained audit log, scores from the grader. No placeholder
          figures; synthetic fraud-ring data is excluded.
        </p>

        {err && <p className="mt-6 text-sm text-danger">Error: {err}</p>}

        {!m && !err && <p className="mt-10 font-data text-xs text-ink-500">loading live metrics…</p>}

        {m && !hasData && (
          <div className="mt-8 rounded-card border border-ink-700/70 bg-ink-900/60 p-8 text-center">
            <Pulse size={26} className="mx-auto text-indigo-bright" />
            <p className="mt-3 text-base font-medium text-ink-100">Live instrumentation active — pilot in progress</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-400">
              The cohort hasn&apos;t run yet, so there are no numbers to report. This page fills with
              real medians + the raw distribution the moment candidates complete the flow at{" "}
              <span className="font-data text-ink-200">/verify</span>. <span className="text-ink-200">N pending.</span>
            </p>
            <p className="mt-4 font-data text-xs text-ink-600">
              {m.verifiedCandidates} credential{m.verifiedCandidates === 1 ? "" : "s"} issued to date ·{" "}
              {m.offlineVerifies} offline verification{m.offlineVerifies === 1 ? "" : "s"}
            </p>
          </div>
        )}

        {m && hasData && (
          <>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Tile icon={<Users size={15} />} label="Real candidates" value={`${m.completedRuns}`} sub="completed end-to-end" />
              <Tile icon={<ClockCounterClockwise size={15} />} label="Median time" value={fmt(m.medianSecs)} sub={`${fmt(m.p25Secs)}–${fmt(m.p75Secs)} (p25–p75)`} />
              <Tile icon={<Scales size={15} />} label="Median judgment" value={m.medianScore != null ? `${m.medianScore}` : "—"} sub="0–100, RSR-style signal" />
              <Tile icon={<Detective size={15} />} label="Caught planted error" value={m.caughtRatePct != null ? `${m.caughtRatePct}%` : "—"} sub={`of ${m.scoredRuns} scored runs`} />
              <Tile icon={<ShieldCheck size={15} />} label="Seat-swaps flagged" value={`${m.crossRoundMismatches}`} sub={`of ${m.crossRoundChecks} cross-round checks`} />
              <Tile icon={<Pulse size={15} />} label="Offline verifies" value={`${m.offlineVerifies}`} sub="signature-checked, no server" />
            </div>

            {m.scores.length > 0 && (
              <div className="mt-4">
                <ScoreHistogram scores={m.scores} />
              </div>
            )}

            <p className="mt-6 text-xs leading-relaxed text-ink-500">
              <span className="text-ink-300">Honest scope:</span> campus pilot, N = {m.completedRuns} — not a
              production cohort. We report medians + the raw distribution and do not extrapolate population
              validity. The judgment score is a research-grounded RSR-style reliance signal (small-N, not a
              psychometrically validated instrument). Cross-round matching is human-review-gated and never auto-rejects.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
