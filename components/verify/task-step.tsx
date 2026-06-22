"use client";

import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from "react";
import { PaperPlaneRight, Robot, User, Sparkle, CheckCircle, XCircle, Scales, Warning, LockKey } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { RelianceResult } from "@/lib/ai/reliance";
import type { IntegritySignals } from "@/lib/ai/scorer";
import type { ExplainResult } from "./explain-step";
import { ProctorCam } from "./proctor-cam";

export interface ScoreResult {
  aiCollabScore: number;
  bands: { direct: number; judge: number; correct: number };
  rubric: {
    caughtPlantedError: boolean;
    justifications: Record<string, string>;
    error_detection: number;
    direction_quality: number;
    verification: number;
    iteration: number;
    final_correctness: number;
  };
  signals: {
    candidateTurns: number;
    acceptedVerbatim: boolean;
    finalSimilarityToAi: number;
    divergedFromAi: boolean;
    promptInjectionSuspected: boolean;
  };
  capped: boolean;
  provider: string;
  reliance?: RelianceResult;
  integrity?: IntegritySignals;
  explain?: ExplainResult;
  taskId?: string;
}

type PanelItem = { id: number; claim: string };

type Msg = { role: "candidate" | "assistant"; content: string };
type LedgerEntry = { t: string; label: string };

function now() {
  const d = new Date();
  return d.toLocaleTimeString("en-IN", { hour12: false });
}

export function TaskStep({
  sessionId,
  prefetchedTask,
  onComplete,
  onIntegrityFail,
}: {
  sessionId: string;
  prefetchedTask?: { taskId: string; title: string; brief: string } | null;
  onComplete: (r: ScoreResult) => void;
  onIntegrityFail: (reason: string) => void;
}) {
  const [task, setTask] = useState<{ taskId: string; title: string; brief: string } | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [input, setInput] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [panel, setPanel] = useState<PanelItem[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const chatRef = useRef<HTMLDivElement>(null);

  // ── secured test mode + behavioural integrity telemetry ─────────────────────
  const [lockState, setLockState] = useState<"gate" | "active">("gate");
  const armedRef = useRef(false);
  const taskActiveAtRef = useRef(0);
  const firstActionAtRef = useRef(0);
  const pasteEventsRef = useRef(0);
  const pastedCharsRef = useRef(0);
  const finalAnswerPastedCharsRef = useRef(0);
  const awayEventsRef = useRef(0);
  const [warnings, setWarnings] = useState(0);
  const [warnBanner, setWarnBanner] = useState<{ text: string; n: number } | null>(null);
  const [inFullscreen, setInFullscreen] = useState(false);
  const warnCountRef = useRef(0);
  const onIntegrityFailRef = useRef(onIntegrityFail);
  const lastLockWarnRef = useRef(0);

  useEffect(() => {
    // If the flow pre-generated the task during liveness, use it immediately —
    // the "generating a fresh task…" spinner never shows.
    if (prefetchedTask) {
      setTask(prefetchedTask);
      setLedger([{ t: now(), label: "Task ready · the AI may slip up" }]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadErr(data.error ?? "Couldn't generate a task");
          return;
        }
        setTask(data);
        setLedger([{ t: now(), label: "Task ready · the AI may slip up" }]);
      } catch {
        if (!cancelled) setLoadErr("Network error generating task");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, prefetchedTask]);

  // Generate the reliance probe once a task exists. Best-effort: if it fails,
  // the panel simply doesn't appear and the main flow is unaffected.
  useEffect(() => {
    if (!task) return;
    let cancelled = false;
    fetch("/api/reliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.taskId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.items?.length) setPanel(d.items as PanelItem[]); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [task]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function markFirstAction() {
    if (!firstActionAtRef.current) firstActionAtRef.current = performance.now();
  }

  function recordPaste(e: ClipboardEvent, intoFinalAnswer: boolean) {
    markFirstAction();
    const len = e.clipboardData.getData("text").length;
    pasteEventsRef.current += 1;
    pastedCharsRef.current += len;
    if (intoFinalAnswer) finalAnswerPastedCharsRef.current += len;
  }

  function exitFullscreen() {
    if (typeof document !== "undefined" && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }

  // Enter secured mode on an explicit click — requestFullscreen needs a user gesture.
  function beginSecuredTest() {
    taskActiveAtRef.current = performance.now();
    Promise.resolve(document.documentElement.requestFullscreen?.())
      .catch(() => {}) // fullscreen denied → run anyway; the visibility guard still applies
      .finally(() => {
        armedRef.current = true;
        setInFullscreen(typeof document !== "undefined" && !!document.fullscreenElement);
        setLockState("active");
      });
  }

  function returnToFullscreen() {
    Promise.resolve(document.documentElement.requestFullscreen?.()).catch(() => {});
  }

  // Keep the latest fail callback without re-subscribing listeners every render.
  useEffect(() => {
    onIntegrityFailRef.current = onIntegrityFail;
  });

  // One unified warning. Each distinct violation — face proctor (no face / second
  // person / looking away), tab switch, or leaving full-screen — raises a warning +
  // on-screen toast; THREE warnings end the test. A single Esc / focus blip costs
  // one warning, not an instant fail, so honest candidates can recover (this
  // intentionally replaces the earlier instant-fail-on-leave).
  const raiseWarning = useCallback((label: string) => {
    if (!armedRef.current) return;
    warnCountRef.current += 1;
    const n = warnCountRef.current;
    setWarnings(n);
    setWarnBanner({ text: label, n });
    if (n >= 3) {
      armedRef.current = false;
      if (typeof document !== "undefined" && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      onIntegrityFailRef.current("warnings");
    }
  }, []);

  // Camera/proctor unavailable → the secured test can't be enforced → fail (strict).
  const handleCameraFail = useCallback(() => {
    if (!armedRef.current) return;
    armedRef.current = false;
    if (typeof document !== "undefined" && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    onIntegrityFailRef.current("camera");
  }, []);

  // Lockdown signals → warnings (not instant fails). `blur` is only counted, since
  // DevTools / OS dialogs would otherwise cause false positives.
  useEffect(() => {
    // One Alt-Tab out of full-screen fires BOTH visibilitychange and fullscreenchange;
    // coalesce them so a single user action costs at most one warning.
    const lockWarn = (label: string) => {
      const t = performance.now();
      if (t - lastLockWarnRef.current < 600) return;
      lastLockWarnRef.current = t;
      raiseWarning(label);
    };
    const onVis = () => { if (document.hidden) lockWarn("You switched away from the test window"); };
    const onFs = () => {
      const fs = typeof document !== "undefined" && !!document.fullscreenElement;
      setInFullscreen(fs);
      if (!fs) lockWarn("You left full-screen");
    };
    const onBlur = () => { if (armedRef.current) awayEventsRef.current += 1; };
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("blur", onBlur);
    };
  }, [raiseWarning]);

  // Auto-hide the warning toast.
  useEffect(() => {
    if (!warnBanner) return;
    const t = window.setTimeout(() => setWarnBanner(null), 3500);
    return () => window.clearTimeout(t);
  }, [warnBanner]);

  async function send() {
    markFirstAction();
    if (!input.trim() || !task || sending) return;
    const next: Msg[] = [...messages, { role: "candidate", content: input.trim() }];
    setMessages(next);
    setLedger((l) => [...l, { t: now(), label: `Asked the AI (${input.trim().length} chars)` }]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.taskId, messages: next }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
        setLedger((l) => [...l, { t: now(), label: "AI responded — review critically" }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: `[AI unavailable: ${data.error}]` }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "[network error]" }]);
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (!finalAnswer.trim() || !task || scoring) return;
    // Legit submit — disarm the lockdown first, so leaving full-screen now never self-fails.
    armedRef.current = false;
    exitFullscreen();
    setScoring(true);
    setLedger((l) => [...l, { t: now(), label: "Submitted final answer for scoring" }]);

    const fa = finalAnswer.trim();
    const nowMs = performance.now();
    const integrity = {
      elapsedMs: taskActiveAtRef.current ? Math.round(nowMs - taskActiveAtRef.current) : 0,
      timeToFirstActionMs:
        firstActionAtRef.current && taskActiveAtRef.current
          ? Math.max(0, Math.round(firstActionAtRef.current - taskActiveAtRef.current))
          : 0,
      pasteEvents: pasteEventsRef.current,
      pastedChars: pastedCharsRef.current,
      finalAnswerPastedChars: finalAnswerPastedCharsRef.current,
      finalAnswerLen: fa.length,
      awayEvents: awayEventsRef.current,
      lockdownUsed: true,
    };

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, taskId: task.taskId, turns: messages, finalAnswer: fa, integrity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadErr(data.error ?? "Scoring failed");
        return;
      }
      // Score the reliance probe too (best-effort — never blocks the main result).
      let reliance: RelianceResult | undefined;
      if (panel && Object.keys(decisions).length === panel.length) {
        try {
          const rr = await fetch("/api/reliance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: task.taskId, sessionId, decisions }),
          });
          if (rr.ok) reliance = (await rr.json()) as RelianceResult;
        } catch { /* ignore — main score stands */ }
      }
      onComplete({ ...(data as ScoreResult), reliance, taskId: task.taskId });
    } catch {
      setLoadErr("Network error during scoring");
    } finally {
      setScoring(false);
    }
  }

  if (loadErr) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-warn/40 bg-warn-wash/10 p-5 text-sm text-ink-200">
        <p className="font-medium text-ink-50">AI step unavailable</p>
        <p className="mt-1 text-ink-400">{loadErr}</p>
        <p className="mt-2 text-xs text-ink-500">
          Add a card to Vercel AI Gateway (free credit) or set a Gemini key, then retry.
        </p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <Sparkle size={22} className="text-indigo-bright" weight="fill" />
        <p className="font-data text-xs text-ink-300">generating a fresh task you can&apos;t have pre-staged…</p>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-ink-700">
          <div className="h-full w-1/2 animate-[pulse-soft_1.2s_ease-in-out_infinite] rounded-full bg-indigo-bright" />
        </div>
      </div>
    );
  }

  // Secured-test gate — the candidate must enter full-screen lockdown to start.
  if (lockState === "gate") {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full border border-indigo/30 bg-indigo/10 text-indigo-bright">
          <LockKey size={24} weight="fill" />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-[-0.01em] text-ink-50 sm:text-2xl">Secured test mode</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
          The skill task runs full-screen with your camera on. To keep it fair, integrity issues raise a
          warning — <span className="text-ink-200">three warnings end the test</span>. Keep everything you
          need in this tab.
        </p>
        <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
          {[
            "Enters full-screen and turns on your camera",
            "Your face is monitored — keep it in view, alone",
            "Switching tabs, leaving full-screen, or a second face costs a warning",
            "3 warnings end the test",
          ].map((t) => (
            <li
              key={t}
              className="flex items-start gap-2.5 rounded-control border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-ink-300"
            >
              <Warning size={14} weight="fill" className="mt-0.5 shrink-0 text-indigo-bright" /> {t}
            </li>
          ))}
        </ul>
        <Button size="lg" onClick={beginSecuredTest} className="mt-6 w-full gap-2">
          <LockKey size={16} weight="fill" /> Begin secured test
        </Button>
        <p className="mt-3 text-xs text-ink-500">Your task is ready — the AI may slip up. Catch it.</p>
      </div>
    );
  }

  const decided = Object.keys(decisions).length;
  const totalClaims = panel?.length ?? 0;
  const allDecided = !panel || decided >= totalClaims;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* on-screen warning toast */}
      {warnBanner && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-control border border-warn/50 bg-ink-900 px-4 py-2.5 text-sm shadow-lift">
            <Warning size={16} weight="fill" className="shrink-0 text-warn" />
            <span className="text-ink-100">{warnBanner.text}</span>
            <span className="font-data text-xs text-warn">warning {warnBanner.n}/3</span>
          </div>
        </div>
      )}

      {/* continuous face proctor (paused while scoring); camera failure fails the test */}
      <ProctorCam onWarn={raiseWarning} paused={scoring} onCameraFail={handleCameraFail} />

      {/* secured-test banner + warning counter */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-control border border-indigo/25 bg-indigo/5 px-3 py-2 text-xs text-ink-300">
        <LockKey size={14} weight="fill" className="shrink-0 text-indigo-bright" />
        <span>
          <span className="text-ink-100">Secured test.</span> Your face stays monitored. Switching tabs or
          leaving full-screen costs a warning — <span className="text-ink-100">3 warnings end the test</span>.
        </span>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 font-data text-[0.7rem]",
            warnings >= 2 ? "bg-warn-wash/15 text-warn" : "bg-ink-800 text-ink-400"
          )}
        >
          warnings {warnings}/3
        </span>
        {!inFullscreen && (
          <button
            type="button"
            onClick={returnToFullscreen}
            className="rounded-control border border-indigo/40 px-2 py-0.5 text-[0.7rem] text-indigo-bright transition-colors hover:bg-indigo/10"
          >
            Return to full-screen
          </button>
        )}
      </div>

      {/* step heading — orient the candidate */}
      <div className="mb-6">
        <p className="eyebrow text-indigo-bright">Skill · judgment under constraint</p>
        <h1 className="mt-1.5 text-xl font-semibold tracking-[-0.01em] text-ink-50 sm:text-2xl">
          Direct the AI — then catch where it&apos;s wrong
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-400">
          You&apos;re scored on judgment, not usage: accept what the AI gets right, reject what it gets
          wrong, and ship a correct final answer.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr]">
        {/* LEFT: brief · reliance check · ledger */}
        <div className="space-y-4">
          {/* task brief */}
          <div className="rounded-card border border-ink-700 bg-ink-900 p-5 shadow-card">
            <p className="eyebrow text-indigo-bright">Your task</p>
            <h2 className="mt-1.5 text-[0.95rem] font-semibold leading-snug text-ink-50">{task.title}</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-300">{task.brief}</p>
          </div>

          {/* judgment callout */}
          <div className="flex items-start gap-2.5 rounded-card border border-indigo/25 bg-indigo/5 p-3.5">
            <Warning size={16} weight="fill" className="mt-0.5 shrink-0 text-indigo-bright" />
            <p className="text-xs leading-relaxed text-ink-300">
              The AI can sound confident but be <span className="text-ink-100">wrong</span>. This task hides a
              planted flaw — shipping the AI&apos;s answer unchanged caps your score.
            </p>
          </div>

          {/* appropriate-reliance probe (RAIR/RSR): accept the right AI claims, reject the wrong ones */}
          {panel && panel.length > 0 && (
            <div className="rounded-card border border-indigo/25 bg-ink-900 p-5 shadow-card">
              <div className="flex items-center gap-2">
                <Scales size={15} className="text-indigo-bright" />
                <p className="eyebrow text-indigo-bright">Trust the AI only when it&apos;s right</p>
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 font-data text-[0.7rem]",
                    allDecided ? "bg-proof/15 text-proof" : "bg-ink-800 text-ink-400"
                  )}
                >
                  {decided}/{totalClaims}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
                The AI made these claims about your task.{" "}
                <span className="text-ink-300">Accept the ones that are right and reject the ones that are wrong.</span>
              </p>

              {/* progress */}
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full rounded-full bg-indigo-bright transition-[width] duration-300 ease-out"
                  style={{ width: `${totalClaims ? (decided / totalClaims) * 100 : 0}%` }}
                />
              </div>

              <ul className="mt-4 space-y-3">
                {panel.map((s, i) => {
                  const choice = decisions[s.id];
                  return (
                    <li
                      key={s.id}
                      className={cn(
                        "rounded-control border bg-ink-950 p-3 transition-colors",
                        choice === true
                          ? "border-proof/45"
                          : choice === false
                            ? "border-danger/45"
                            : "border-ink-700"
                      )}
                    >
                      <div className="flex gap-2.5">
                        <span className="font-data text-xs text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                        <p className="text-sm leading-relaxed text-ink-200">{s.claim}</p>
                      </div>
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          aria-pressed={choice === true}
                          onClick={() => setDecisions((d) => ({ ...d, [s.id]: true }))}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1.5 rounded-control border py-1.5 text-xs font-medium transition-colors",
                            choice === true
                              ? "border-proof bg-proof/15 text-proof"
                              : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200"
                          )}
                        >
                          <CheckCircle size={14} weight={choice === true ? "fill" : "regular"} /> Accept
                        </button>
                        <button
                          type="button"
                          aria-pressed={choice === false}
                          onClick={() => setDecisions((d) => ({ ...d, [s.id]: false }))}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1.5 rounded-control border py-1.5 text-xs font-medium transition-colors",
                            choice === false
                              ? "border-danger bg-danger/15 text-danger"
                              : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200"
                          )}
                        >
                          <XCircle size={14} weight={choice === false ? "fill" : "regular"} /> Reject
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* steps ledger */}
          <div className="rounded-card border border-ink-700 bg-ink-900 p-5 shadow-card">
            <p className="eyebrow text-ink-400">Your steps · logged</p>
            <ul className="mt-3 space-y-2">
              {ledger.map((e, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs">
                  <span className="font-data text-ink-500">{e.t}</span>
                  <span className="text-ink-300">{e.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* RIGHT: the AI tool + final answer */}
        <div className="flex flex-col rounded-card border border-ink-700 bg-ink-900 shadow-card">
          <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
            <span className="grid size-6 place-items-center rounded-full bg-indigo/20 text-indigo-bright">
              <Robot size={14} />
            </span>
            <span className="text-sm font-medium text-ink-100">AI assistant</span>
            <span className="eyebrow ml-auto text-ink-500">authorship logged</span>
          </div>

          <div ref={chatRef} className="max-h-[min(50vh,420px)] min-h-[200px] flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
                <Robot size={26} className="text-ink-600" />
                <p className="max-w-[28ch] text-sm text-ink-500">
                  Ask the AI to help with the task — then judge its answer critically.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2.5", m.role === "candidate" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-indigo/20 text-indigo-bright">
                    <Robot size={13} />
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[84%] whitespace-pre-wrap rounded-control px-3 py-2 text-sm leading-relaxed",
                    m.role === "candidate"
                      ? "bg-ink-700 text-ink-50"
                      : "border border-indigo/20 bg-indigo/10 text-ink-200"
                  )}
                >
                  {m.content}
                </div>
                {m.role === "candidate" && (
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-ink-700 text-ink-300">
                    <User size={13} />
                  </span>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-1.5 px-1">
                <span className="size-1.5 rounded-full bg-indigo-bright pulse-soft" />
                <span className="size-1.5 rounded-full bg-indigo-bright pulse-soft [animation-delay:200ms]" />
                <span className="size-1.5 rounded-full bg-indigo-bright pulse-soft [animation-delay:400ms]" />
                <span className="ml-1.5 font-data text-xs text-ink-500">AI is thinking</span>
              </div>
            )}
          </div>

          <div className="border-t border-ink-700 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => { markFirstAction(); setInput(e.target.value); }}
                onPaste={(e) => recordPaste(e, false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Ask the AI…"
                className="max-h-28 min-h-[40px] flex-1 resize-none rounded-control border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-indigo focus:outline-none"
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim() || sending}
                className="grid size-10 shrink-0 place-items-center rounded-control bg-indigo text-white transition-colors hover:bg-indigo-deep disabled:bg-ink-800 disabled:text-ink-500 active:translate-y-px"
              >
                <PaperPlaneRight size={16} weight="fill" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-baseline justify-between">
                <label className="eyebrow text-ink-400">Your final answer</label>
                <span className="font-data text-[0.7rem] text-ink-600">code · judged on correctness</span>
              </div>
              <textarea
                value={finalAnswer}
                onChange={(e) => { markFirstAction(); setFinalAnswer(e.target.value); }}
                onPaste={(e) => recordPaste(e, true)}
                rows={6}
                placeholder={"-- Write your corrected, final answer here\nSELECT ..."}
                className="w-full resize-y rounded-control border border-ink-700 bg-ink-950 px-3 py-2.5 font-data text-[0.8rem] leading-relaxed text-ink-100 placeholder:text-ink-600 focus:border-indigo focus:outline-none"
              />
              {panel && !allDecided && (
                <div className="flex items-center justify-center gap-1.5 rounded-control border border-warn/30 bg-warn-wash/5 py-1.5 text-xs text-warn">
                  <Scales size={13} />
                  Decide all {totalClaims} reliance claims ({decided}/{totalClaims} done) first
                </div>
              )}
              <Button
                variant="proof"
                size="lg"
                onClick={submit}
                disabled={!finalAnswer.trim() || scoring || (!!panel && !allDecided)}
                className="w-full"
              >
                {scoring ? "Scoring your judgment…" : "Submit for scoring"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
