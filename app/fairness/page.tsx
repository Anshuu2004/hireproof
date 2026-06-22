"use client";

import { useEffect, useState } from "react";
import { Scales, ShieldCheck, Warning, SealCheck, DownloadSimple, Eye } from "@phosphor-icons/react";
import { Wordmark } from "@/components/wordmark";
import { dimensionLabel, type FairnessReport, type DimensionReport } from "@/lib/bias/fairness";

interface LatestRun {
  id: string;
  runAt: string;
  report: FairnessReport;
  worstImpactRatio: number | null;
  overallPass: boolean | null;
  datasetNote: string;
  certificate: string;
  passThreshold: number;
}

function PassBadge({ pass }: { pass: boolean | null }) {
  if (pass === null)
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-ink-700 px-2.5 py-1 eyebrow text-ink-400">
        <Eye size={13} /> not yet evaluable
      </span>
    );
  return pass ? (
    <span className="flex items-center gap-1.5 rounded-full border border-proof/30 bg-proof/10 px-2.5 py-1 eyebrow text-proof">
      <ShieldCheck size={13} weight="fill" /> passes four-fifths
    </span>
  ) : (
    <span className="flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger-wash/10 px-2.5 py-1 eyebrow text-danger">
      <Warning size={13} weight="fill" /> adverse impact flagged
    </span>
  );
}

function DimensionCard({ d, minCell }: { d: DimensionReport; minCell: number }) {
  const maxRate = Math.max(0.0001, ...d.groups.map((g) => g.rate ?? 0));
  return (
    <div className="rounded-card border border-ink-700/70 bg-ink-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-100">{dimensionLabel(d.dimension)}</p>
        <div className="flex items-center gap-2">
          {d.evaluable && d.impactRatio != null && (
            <span className="font-data text-xs text-ink-400">ratio {(d.impactRatio).toFixed(2)}</span>
          )}
          <PassBadge pass={d.pass} />
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {d.groups.map((g) => (
          <div key={g.group} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs text-ink-300">{g.group}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
              {!g.suppressed && g.rate != null && (
                <div
                  className="h-full rounded-full bg-indigo/70"
                  style={{ width: `${(g.rate / maxRate) * 100}%`, minWidth: g.rate > 0 ? 4 : 0 }}
                />
              )}
            </div>
            <span className="w-24 shrink-0 text-right font-data text-[0.65rem] text-ink-500">
              {g.suppressed ? `suppressed (n<${minCell})` : `${Math.round((g.rate ?? 0) * 100)}% · n=${g.total}`}
            </span>
          </div>
        ))}
      </div>

      {d.note && <p className="mt-3 text-xs text-ink-500">{d.note}</p>}
    </div>
  );
}

export default function FairnessPage() {
  const [run, setRun] = useState<LatestRun | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/bias-audit/latest")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else setRun(d.run);
      })
      .catch(() => setErr("Could not load the fairness audit"))
      .finally(() => setLoaded(true));
  }, []);

  function downloadCert() {
    if (!run?.certificate) return;
    const blob = new Blob([run.certificate], { type: "application/jwt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hireproof-fairness-audit-${run.id.slice(0, 8)}.jwt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-950">
      <header className="border-b border-ink-700/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="hidden h-4 w-px bg-ink-700 sm:block" />
            <span className="hidden eyebrow text-ink-500 sm:block">Fairness audit</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-indigo/30 px-2.5 py-1 eyebrow text-indigo-bright">
            <Scales size={13} /> NYC LL144 · EU AI Act
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">Bias &amp; fairness audit</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-400">
          Hiring AI is a high-risk system under the EU AI Act, and NYC Local Law 144 requires an
          independent adverse-impact (four-fifths) audit. HireProof runs that audit on its own
          AI-collaboration scoring and publishes a signed, offline-verifiable certificate here.
        </p>

        {err && <p className="mt-6 text-sm text-danger">Error: {err}</p>}
        {!loaded && !err && <p className="mt-10 font-data text-xs text-ink-500">loading latest audit…</p>}

        {loaded && !run && !err && (
          <div className="mt-8 rounded-card border border-ink-700/70 bg-ink-900/60 p-8 text-center">
            <Scales size={26} className="mx-auto text-indigo-bright" />
            <p className="mt-3 text-base font-medium text-ink-100">No audit run yet</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-400">
              An employer can run the four-fifths audit from the verify console. This page fills with
              per-group selection rates and a signed certificate the moment it does.
            </p>
          </div>
        )}

        {run && (
          <>
            <div className="mt-8 flex flex-col gap-4 rounded-card border border-ink-700/70 bg-ink-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow text-ink-400">Overall verdict</p>
                <div className="mt-2 flex items-center gap-3">
                  <PassBadge pass={run.overallPass} />
                  {run.worstImpactRatio != null && (
                    <span className="font-data text-sm text-ink-200">
                      worst ratio {run.worstImpactRatio.toFixed(2)}{" "}
                      <span className="text-ink-500">/ 0.80 threshold</span>
                    </span>
                  )}
                </div>
                <p className="mt-2 font-data text-[0.65rem] text-ink-500">
                  selection = score ≥ {run.passThreshold} · run {new Date(run.runAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <button
                type="button"
                onClick={downloadCert}
                className="flex items-center justify-center gap-2 rounded-control border border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-200 transition-colors hover:border-ink-500 hover:bg-ink-900"
              >
                <SealCheck size={16} className="text-proof" /> Download signed certificate
                <DownloadSimple size={14} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {run.report.dimensions.map((d) => (
                <DimensionCard key={d.dimension} d={d} minCell={run.report.minCell} />
              ))}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-ink-500">
              <span className="text-ink-300">Method &amp; honesty:</span> {run.datasetNote} Demographics
              are opt-in and aggregate-only; cohorts below the minimum cell size are suppressed (shown as
              &ldquo;suppressed&rdquo;). The certificate is an Ed25519 JWT signed by the same issuer key as a
              credential — verify it offline against{" "}
              <span className="font-data text-ink-300">/.well-known/did.json</span>.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
