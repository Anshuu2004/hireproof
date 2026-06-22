"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Warning, X, Key, ArrowsClockwise } from "@phosphor-icons/react";
import { Wordmark } from "@/components/wordmark";
import { LivenessStep, type LivenessResult } from "@/components/verify/liveness-step";
import type { Language, LivenessAction } from "@/lib/liveness/challenge";

interface SessionData {
  sessionId: string;
  challenge: { actions: LivenessAction[]; digits: number[]; language: Language };
  spokenPhrase: string;
}
type Step = "enter" | "live" | "result";
type Result = "pass" | "fail" | "mismatch";

export default function RecheckPage() {
  const [step, setStep] = useState<Step>("enter");
  const [credentialId, setCredentialId] = useState("");
  const [secret, setSecret] = useState("");
  const [session, setSession] = useState<SessionData | null>(null);
  const [result, setResult] = useState<{ result: Result; distance: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const cred = new URLSearchParams(window.location.search).get("cred");
    if (cred) setCredentialId(cred);
  }, []);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/work/recheck/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId: credentialId.trim(), secret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start the re-check");
        return;
      }
      setSession(data as SessionData);
      setStep("live");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function complete(r: LivenessResult) {
    if (!session) return;
    try {
      const res = await fetch("/api/work/recheck/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      const data = await res.json();
      setResult({ result: (data.result as Result) ?? (r.verdict === "pass" ? "pass" : "fail"), distance: data.distance ?? null });
    } catch {
      setResult({ result: r.verdict === "pass" ? "pass" : "fail", distance: r.crossRound?.distance ?? null });
    } finally {
      setStep("result");
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-950">
      <header className="border-b border-ink-700/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="hidden h-4 w-px bg-ink-700 sm:block" />
            <span className="hidden eyebrow text-ink-500 sm:block">Work re-verification</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-indigo/30 px-2.5 py-1 eyebrow text-indigo-bright">
            <ArrowsClockwise size={13} /> continuous check
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        {step === "enter" && (
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink-50">Confirm you&apos;re still you</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">
              A quick 30-second live check to keep your verified credential active. We match your face
              against your enrolled check — no employer can do this for you.
            </p>

            <label className="mt-6 block">
              <span className="eyebrow text-ink-400">Credential ID</span>
              <input
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="mt-1.5 w-full rounded-control border border-ink-700 bg-ink-950 px-3 py-2 font-data text-xs text-ink-100 placeholder:text-ink-600 focus:border-indigo focus:outline-none"
              />
            </label>
            <label className="mt-3 block">
              <span className="eyebrow text-ink-400">Holder key</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-control border border-ink-700 bg-ink-950 px-3 focus-within:border-indigo">
                <Key size={15} className="text-amber" />
                <input
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="the key shown when you minted"
                  className="w-full bg-transparent py-2 font-data text-xs text-amber placeholder:text-ink-600 focus:outline-none"
                />
              </div>
            </label>

            {error && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-danger">
                <Warning size={13} weight="fill" /> {error}
              </p>
            )}

            <button
              type="button"
              onClick={start}
              disabled={busy || !credentialId.trim() || !secret}
              className="mt-6 w-full rounded-control bg-indigo px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-deep disabled:bg-ink-800 disabled:text-ink-500 active:translate-y-px"
            >
              {busy ? "Starting…" : "Start live re-check"}
            </button>
          </div>
        )}

        {step === "live" && session && (
          <LivenessStep
            sessionId={session.sessionId}
            challenge={session.challenge}
            spokenPhrase={session.spokenPhrase}
            onComplete={complete}
          />
        )}

        {step === "result" && result && (
          <div className="mx-auto w-full max-w-md text-center">
            {result.result === "pass" ? (
              <>
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-proof text-ink-950">
                  <ShieldCheck size={26} weight="bold" />
                </div>
                <h1 className="mt-5 text-2xl font-semibold text-ink-50">Re-verified — still you</h1>
                <p className="mt-2 text-sm text-ink-300">
                  Your credential stays active. We&apos;ll ask again at the next interval.
                </p>
              </>
            ) : result.result === "mismatch" ? (
              <>
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-danger text-white">
                  <Warning size={26} weight="fill" />
                </div>
                <h1 className="mt-5 text-2xl font-semibold text-ink-50">Face didn&apos;t match</h1>
                <p className="mt-2 text-sm text-ink-300">
                  This face differs from the enrolled person. Flagged for human review — never an
                  automatic action.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-danger text-white">
                  <X size={26} weight="bold" />
                </div>
                <h1 className="mt-5 text-2xl font-semibold text-ink-50">Live check didn&apos;t pass</h1>
                <p className="mt-2 text-sm text-ink-300">One or more signals didn&apos;t complete. You can retry.</p>
              </>
            )}
            {result.distance != null && (
              <p className="mt-4 font-data text-xs text-ink-500">biometric distance {result.distance.toFixed(3)}</p>
            )}
            <button
              type="button"
              onClick={() => {
                setStep("enter");
                setResult(null);
                setSession(null);
              }}
              className="mt-6 rounded-control border border-ink-600 px-5 py-3 text-sm font-medium text-ink-100 transition-colors hover:border-ink-400 hover:bg-ink-900"
            >
              Done
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
