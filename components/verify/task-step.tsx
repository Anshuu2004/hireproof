"use client";

import { useEffect, useRef, useState } from "react";
import { PaperPlaneRight, Robot, User, Sparkle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

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
  capped: boolean;
  provider: string;
}

type Msg = { role: "candidate" | "assistant"; content: string };
type LedgerEntry = { t: string; label: string };

function now() {
  const d = new Date();
  return d.toLocaleTimeString("en-IN", { hour12: false });
}

export function TaskStep({
  sessionId,
  onComplete,
}: {
  sessionId: string;
  onComplete: (r: ScoreResult) => void;
}) {
  const [task, setTask] = useState<{ taskId: string; title: string; brief: string } | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [input, setInput] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [scoring, setScoring] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
        setLedger([{ t: now(), label: "Task generated · planted flaw hidden" }]);
      } catch {
        if (!cancelled) setLoadErr("Network error generating task");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
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
    setScoring(true);
    setLedger((l) => [...l, { t: now(), label: "Submitted final answer for scoring" }]);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, taskId: task.taskId, turns: messages, finalAnswer: finalAnswer.trim() }),
      });
      const data = await res.json();
      if (res.ok) onComplete(data as ScoreResult);
      else setLoadErr(data.error ?? "Scoring failed");
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

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      {/* LEFT: brief + thinking ledger */}
      <div className="space-y-4">
        <div className="rounded-card border border-ink-700 bg-ink-900 p-5">
          <p className="eyebrow text-indigo-bright">Your task</p>
          <h2 className="mt-1.5 text-base font-semibold text-ink-50">{task.title}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-300">{task.brief}</p>
        </div>
        <div className="rounded-card border border-ink-700 bg-ink-900 p-5">
          <p className="eyebrow text-ink-400">Thinking ledger · auditable</p>
          <ul className="mt-3 space-y-2">
            {ledger.map((e, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs">
                <span className="font-data text-ink-500">{e.t}</span>
                <span className="text-ink-300">{e.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="px-1 text-xs leading-relaxed text-ink-500">
          The AI may be confidently wrong. You&apos;re scored on judgment — catching, directing, and
          correcting it — not on using it.
        </p>
      </div>

      {/* RIGHT: the AI tool + final answer */}
      <div className="flex flex-col rounded-card border border-ink-700 bg-ink-900">
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-2.5">
          <Robot size={16} className="text-indigo-bright" />
          <span className="text-sm font-medium text-ink-100">AI assistant</span>
          <span className="eyebrow ml-auto text-ink-500">authorship is labelled</span>
        </div>

        <div ref={chatRef} className="max-h-[300px] min-h-[180px] flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-500">
              Ask the AI to help with the task. Then judge its answer.
            </p>
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
                  "max-w-[82%] whitespace-pre-wrap rounded-control px-3 py-2 text-sm leading-relaxed",
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
          {sending && <p className="px-1 font-data text-xs text-ink-500">AI is thinking…</p>}
        </div>

        <div className="border-t border-ink-700 p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
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
            <label className="eyebrow text-ink-400">Your final answer</label>
            <textarea
              value={finalAnswer}
              onChange={(e) => setFinalAnswer(e.target.value)}
              rows={3}
              placeholder="Write your corrected, final answer here…"
              className="w-full resize-y rounded-control border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-indigo focus:outline-none"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!finalAnswer.trim() || scoring}
              className="w-full rounded-control bg-proof px-4 py-3 text-sm font-medium text-ink-950 transition-colors hover:bg-proof-strong disabled:bg-ink-800 disabled:text-ink-500 active:translate-y-px"
            >
              {scoring ? "Scoring your judgment…" : "Submit for scoring"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
