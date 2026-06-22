"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Check, X, Warning } from "@phosphor-icons/react";
import { Wordmark } from "@/components/wordmark";
import { BackLink } from "@/components/back-link";
import { ConsentStep, type ConsentValue, type Demographics } from "./consent-step";
import { type LivenessResult } from "./liveness-step";
import { TaskStep, type ScoreResult } from "./task-step";
import { ExplainStep, type ExplainResult } from "./explain-step";
import { MintStep } from "./mint-step";
import { Button } from "@/components/ui/button";
import type { Language, LivenessAction } from "@/lib/liveness/challenge";
import { cn } from "@/lib/cn";

// Defer the heavy liveness code out of the /verify entry chunk (camera + MediaPipe-adjacent).
const LivenessStep = dynamic(() => import("./liveness-step").then((m) => m.LivenessStep), {
  ssr: false,
  loading: () => <p className="text-center font-data text-xs text-ink-400">loading the live check…</p>,
});

// Speculatively warm the heavy on-device liveness assets while the user reads
// consent, so the "loading face engine" + capture steps don't stall on cold
// downloads. Best-effort; liveness still loads them itself if these haven't landed.
function warmLivenessAssets() {
  if (typeof window === "undefined") return;
  import("@mediapipe/tasks-vision").catch(() => {});
  import("@vladmandic/face-api").catch(() => {});
  for (const url of [
    "/mediapipe/face_landmarker.task",
    "/mediapipe/wasm/vision_wasm_internal.wasm",
    "/models/ssd_mobilenetv1_model.bin",
    "/models/face_landmark_68_model.bin",
    "/models/face_recognition_model.bin",
  ]) {
    fetch(url, { cache: "force-cache" }).catch(() => {});
  }
}

type Step = "consent" | "liveness" | "task" | "explain" | "mint" | "fail" | "taskfail";

interface SessionData {
  sessionId: string;
  challenge: { actions: LivenessAction[]; digits: number[]; language: Language };
  spokenPhrase: string;
}

const STEPS: { key: Step; label: string }[] = [
  { key: "consent", label: "Consent" },
  { key: "liveness", label: "Live check" },
  { key: "task", label: "AI task" },
  { key: "mint", label: "Your badge" },
];

function StepRail({ current }: { current: Step }) {
  const cur =
    current === "fail"
      ? "liveness"
      : current === "explain" || current === "taskfail"
        ? "task"
        : current;
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
      <p className="mt-2 text-ink-300">One or more checks didn&apos;t finish. You can try again.</p>
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

/** Shown when the secured test is interrupted (tab switch / left full-screen). */
function IntegrityFailPanel({ reason }: { reason: string }) {
  const msg =
    reason === "camera"
      ? "The secured test needs your camera on for proctoring, and it wasn't available. Allow camera access and start over."
      : "You reached 3 warnings — face out of view, a second person, or repeatedly leaving the test.";
  return (
    <div className="mx-auto w-full max-w-md text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-danger text-white">
        <X size={26} weight="bold" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.01em] text-ink-50">Test ended</h1>
      <p className="mt-2 text-ink-300">{msg}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
        No credential is issued for an interrupted test. You can start over.
      </p>
      <Button variant="ghost" size="lg" onClick={() => location.reload()} className="mt-6">
        Start over
      </Button>
    </div>
  );
}

export function VerifyFlow() {
  const [step, setStep] = useState<Step>("consent");
  const [session, setSession] = useState<SessionData | null>(null);
  const [liveness, setLiveness] = useState<LivenessResult | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [integrityReason, setIntegrityReason] = useState("");
  const [prefetchedTask, setPrefetchedTask] = useState<{ taskId: string; title: string; brief: string } | null>(null);

  // Warm the on-device liveness assets the moment this flow mounts (consent screen).
  useEffect(() => {
    warmLivenessAssets();
  }, []);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function handleProceed(language: Language, consent: ConsentValue, demographics?: Demographics) {
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
      // Opt-in fairness-audit demographics — separate, aggregate-only, fire-and-forget.
      // Never blocks the flow; a failure here must not stop verification.
      if (consent.demographicsForAudit && demographics) {
        fetch("/api/audit-demographics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: data.sessionId, ...demographics }),
        }).catch(() => {});
      }
      setSession(data as SessionData);
      setStep("liveness");
      // Pre-generate the AI task NOW (during the ~15-30s liveness check) so it's
      // ready when the user reaches the task step. Best-effort — TaskStep still
      // fetches on its own if this hasn't landed.
      void fetch("/api/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: (data as SessionData).sessionId }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((t) => { if (t?.taskId) setPrefetchedTask(t); })
        .catch(() => {});
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
          <div className="flex items-center gap-3">
            <BackLink />
            <Wordmark />
          </div>
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
            prefetchedTask={prefetchedTask}
            onComplete={(r) => {
              setScore(r);
              setStep(r.taskId ? "explain" : "mint");
            }}
            onIntegrityFail={(reason) => {
              setIntegrityReason(reason);
              setStep("taskfail");
            }}
          />
        )}

        {step === "explain" && session && score?.taskId && (
          <ExplainStep
            sessionId={session.sessionId}
            taskId={score.taskId}
            language={session.challenge.language}
            onComplete={(ex: ExplainResult) => {
              setScore((s) => (s ? { ...s, explain: ex } : s));
              setStep("mint");
            }}
          />
        )}

        {step === "mint" && session && score && <MintStep sessionId={session.sessionId} score={score} />}

        {step === "fail" && liveness && <FailPanel result={liveness} />}

        {step === "taskfail" && <IntegrityFailPanel reason={integrityReason} />}
      </main>
    </div>
  );
}
