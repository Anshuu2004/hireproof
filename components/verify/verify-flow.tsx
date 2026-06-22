"use client";

import { useState } from "react";
import { Check, X, Warning } from "@phosphor-icons/react";
import { Wordmark } from "@/components/wordmark";
import { ConsentStep, type ConsentValue } from "./consent-step";
import { LivenessStep, type LivenessResult } from "./liveness-step";
import { TaskStep, type ScoreResult } from "./task-step";
import { MintStep } from "./mint-step";
import { Button } from "@/components/ui/button";
import type { Language, LivenessAction } from "@/lib/liveness/challenge";
import { cn } from "@/lib/cn";

type Step = "consent" | "liveness" | "task" | "mint" | "fail";

interface SessionData {
  sessionId: string;
  challenge: { actions: LivenessAction[]; digits: number[]; language: Language };
  spokenPhrase: string;
}

const STEPS: { key: Step; label: string }[] = [
  { key: "consent", label: "Consent" },
  { key: "liveness", label: "Live check" },
  { key: "task", label: "Skill" },
  { key: "mint", label: "Credential" },
];

function StepRail({ current }: { current: Step }) {
  const cur = current === "fail" ? "liveness" : current;
  const activeIdx = STEPS.findIndex((s) => s.key === cur);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span className={cn("eyebrow transition-colors", i <= activeIdx ? "text-ink-200" : "text-ink-500")}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className={cn("h-px w-5", i < activeIdx ? "bg-ink-400" : "bg-ink-700")} />}
        </div>
      ))}
    </div>
  );
}

function FailPanel({ result }: { result: LivenessResult }) {
  const rows: [string, boolean][] = [
    ["Action sequence", result.checks.actionsOk],
    ["Face present throughout", result.checks.faceOk],
    ["Spoken phrase / live voice", result.checks.voiceOk],
  ];
  return (
    <div className="mx-auto w-full max-w-md text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-danger text-white">
        <X size={26} weight="bold" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.01em] text-ink-50">Live check didn&apos;t pass</h1>
      <p className="mt-2 text-ink-300">One or more signals didn&apos;t complete. You can retry.</p>
      <div className="mt-7 divide-y divide-ink-700/70 overflow-hidden rounded-card border border-ink-700 bg-ink-900 text-left">
        {rows.map(([label, ok]) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-ink-200">{label}</span>
            {ok ? (
              <span className="flex items-center gap-1.5 text-xs text-proof">
                <Check size={14} weight="bold" /> passed
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-warn">
                <Warning size={14} weight="fill" /> not met
              </span>
            )}
          </div>
        ))}
      </div>
      <Button variant="ghost" size="lg" onClick={() => location.reload()} className="mt-6">
        Retry the check
      </Button>
    </div>
  );
}

export function VerifyFlow() {
  const [step, setStep] = useState<Step>("consent");
  const [session, setSession] = useState<SessionData | null>(null);
  const [liveness, setLiveness] = useState<LivenessResult | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function handleProceed(language: Language, consent: ConsentValue) {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, consent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start a session");
        return;
      }
      setSession(data as SessionData);
      setStep("liveness");
    } catch {
      setError("Network error — please retry");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-950">
      <header className="border-b border-ink-700/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Wordmark />
          <StepRail current={step} />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        {step === "consent" && (
          <div className="w-full">
            <ConsentStep onProceed={handleProceed} />
            {starting && <p className="mt-4 text-center font-data text-xs text-ink-400">starting session…</p>}
            {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
          </div>
        )}

        {step === "liveness" && session && (
          <LivenessStep
            sessionId={session.sessionId}
            challenge={session.challenge}
            spokenPhrase={session.spokenPhrase}
            onComplete={(r) => {
              setLiveness(r);
              setStep(r.verdict === "pass" ? "task" : "fail");
            }}
          />
        )}

        {step === "task" && session && (
          <TaskStep
            sessionId={session.sessionId}
            onComplete={(r) => {
              setScore(r);
              setStep("mint");
            }}
          />
        )}

        {step === "mint" && session && score && <MintStep sessionId={session.sessionId} score={score} />}

        {step === "fail" && liveness && <FailPanel result={liveness} />}
      </main>
    </div>
  );
}
