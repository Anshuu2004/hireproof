"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Microphone, Scales, ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { SPEECH_LANG, type Language } from "@/lib/liveness/challenge";
import { cn } from "@/lib/cn";

/**
 * Oral explain-back — the anti-outsourcing integrity step. After the candidate
 * submits the skill task, they explain their answer OUT LOUD, live and time-boxed.
 * A remote helper who solved the task cannot easily feed a fresh, on-the-clock
 * verbal explanation that matches the candidate's own submission. Reuses the
 * mic + Web Speech pattern from the liveness step. Gracefully skippable if speech
 * recognition is unavailable — it is an added signal, never a hard gate.
 */
export interface ExplainResult {
  done: boolean; // did the candidate actually record a spoken explanation?
  verdict: "consistent" | "weak" | "inconsistent" | "skipped";
  consistency?: number;
  articulatedKeyIdea?: boolean;
  transcript?: string;
  note?: string;
}

const EXPLAIN_SECONDS = 25;
const FALLBACK_Q = "In your own words, explain how your answer works and the biggest mistake to avoid in this task.";

type Phase = "loading" | "ready" | "listening" | "grading";

export function ExplainStep({
  sessionId,
  taskId,
  language,
  onComplete,
}: {
  sessionId: string;
  taskId: string;
  language: Language;
  onComplete: (r: ExplainResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [question, setQuestion] = useState("");
  const [transcript, setTranscript] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [listenLeft, setListenLeft] = useState(EXPLAIN_SECONDS);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "heard" | "mic-blocked" | "stt-unsupported">("idle");

  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number>(0);

  // ── fetch the question once ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    // Never pin the candidate on "preparing…": time the question fetch out and
    // fall back to a generic prompt so they can always advance to mint.
    const ctrl = new AbortController();
    const to = window.setTimeout(() => ctrl.abort(), 8000);
    (async () => {
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, sessionId }),
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (cancelled) return;
        setQuestion(data.question ?? FALLBACK_Q);
        setPhase("ready");
      } catch {
        if (!cancelled) {
          setQuestion(FALLBACK_Q);
          setPhase("ready");
        }
      } finally {
        window.clearTimeout(to);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(to);
      ctrl.abort();
    };
  }, [taskId, sessionId]);

  const grade = useCallback(
    async (spoken: string) => {
      setPhase("grading");
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, sessionId, transcript: spoken }),
        });
        if (!res.ok) return onComplete({ done: true, verdict: "weak", transcript: spoken });
        const data = await res.json();
        onComplete({
          done: true,
          verdict: data.verdict ?? "weak",
          consistency: data.consistency,
          articulatedKeyIdea: data.articulatedKeyIdea,
          note: data.note,
          transcript: spoken,
        });
      } catch {
        onComplete({ done: true, verdict: "weak", transcript: spoken });
      }
    },
    [onComplete, sessionId, taskId]
  );

  // ── paced listening window (mic meter + Web Speech), mirrors liveness ──────────
  useEffect(() => {
    if (phase !== "listening") return;
    let finalText = "";
    let cancelled = false;
    setTranscript("");
    setListenLeft(EXPLAIN_SECONDS);
    setMicLevel(0);
    setVoiceStatus("idle");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rec: any = null;

    (async () => {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) return micStream.getTracks().forEach((t) => t.stop());
        micStreamRef.current = micStream;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const ctx = new AC();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(micStream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const meter = () => {
          if (cancelled) return;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          setMicLevel(Math.sqrt(sum / buf.length));
          meterRafRef.current = requestAnimationFrame(meter);
        };
        meter();
        setVoiceStatus("listening");
      } catch {
        setVoiceStatus("mic-blocked");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        rec = new SR();
        rec.lang = SPEECH_LANG[language] ?? "en-IN";
        rec.interimResults = true;
        rec.continuous = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (ev: any) => {
          let t = "";
          for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript + " ";
          finalText = t.trim();
          setTranscript(finalText);
          if (finalText) setVoiceStatus("heard");
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onerror = (ev: any) => {
          if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") setVoiceStatus("mic-blocked");
        };
        try {
          rec.start();
        } catch {}
      } else {
        setVoiceStatus((s) => (s === "mic-blocked" ? s : "stt-unsupported"));
      }
    })();

    const interval = window.setInterval(() => setListenLeft((s) => Math.max(0, s - 1)), 1000);
    const done = window.setTimeout(() => {
      cancelled = true;
      window.clearInterval(interval);
      cancelAnimationFrame(meterRafRef.current);
      try {
        rec?.stop();
      } catch {}
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      void audioCtxRef.current?.close?.();
      audioCtxRef.current = null;
      // No transcript captured (e.g. browser without speech-to-text) → don't penalise; mark skipped.
      if (finalText.trim()) grade(finalText);
      else onComplete({ done: false, verdict: "skipped" });
    }, EXPLAIN_SECONDS * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(done);
      cancelAnimationFrame(meterRafRef.current);
      try {
        rec?.stop();
      } catch {}
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      void audioCtxRef.current?.close?.();
      audioCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, language]);

  return (
    <div className="mx-auto w-full max-w-md text-center">
      <p className="eyebrow text-indigo-bright">Integrity · explain it back</p>
      <h1 className="mt-1.5 text-xl font-semibold tracking-[-0.01em] text-ink-50 sm:text-2xl">
        Explain your answer, out loud
      </h1>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-400">
        A short, live spoken check — it binds the work to you. {EXPLAIN_SECONDS}s, in your own words.
      </p>

      <div className="mt-6 rounded-card border border-ink-700 bg-ink-900 p-5 text-left shadow-card">
        <div className="flex items-center gap-2">
          <Scales size={15} className="text-indigo-bright" />
          <p className="eyebrow text-indigo-bright">your question</p>
          {phase === "listening" && (
            <span className="ml-auto flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-indigo-bright pulse-soft" />
              <span className="font-data text-xs text-ink-400">{listenLeft}s</span>
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-100">
          {phase === "loading" ? "preparing your question…" : question}
        </p>

        {phase === "listening" && (
          <>
            <div className="mt-4 flex items-center gap-2">
              <Microphone size={15} className="shrink-0 text-ink-400" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-75", micLevel > 0.045 ? "bg-proof" : "bg-ink-400")}
                  style={{ width: `${Math.min(100, Math.round(micLevel * 350))}%` }}
                />
              </div>
            </div>
            <p className="mt-2 min-h-[1.4em] text-xs">
              {voiceStatus === "mic-blocked" ? (
                <span className="text-warn">Microphone blocked — you can skip below</span>
              ) : voiceStatus === "stt-unsupported" ? (
                <span className="text-ink-400">No speech-to-text here — speak anyway, or skip</span>
              ) : transcript ? (
                <span className="text-ink-300">heard: {transcript}</span>
              ) : (
                <span className="text-ink-500">speak now…</span>
              )}
            </p>
          </>
        )}
      </div>

      {phase === "ready" && (
        <>
          <Button size="lg" onClick={() => setPhase("listening")} className="mt-6 w-full gap-2">
            <Microphone size={16} weight="fill" /> Start explaining ({EXPLAIN_SECONDS}s)
          </Button>
          <button
            type="button"
            onClick={() => onComplete({ done: false, verdict: "skipped" })}
            className="mt-3 inline-flex items-center gap-1 text-xs text-ink-500 transition-colors hover:text-ink-300"
          >
            No microphone — skip <ArrowRight size={12} />
          </button>
        </>
      )}

      {phase === "grading" && (
        <p className="mt-6 font-data text-xs text-ink-400">checking your explanation against your answer…</p>
      )}

      {/* always-available escape: while the question loads, or if recording isn't possible */}
      {(phase === "loading" ||
        (phase === "listening" && (voiceStatus === "mic-blocked" || voiceStatus === "stt-unsupported"))) && (
        <button
          type="button"
          onClick={() => onComplete({ done: false, verdict: "skipped" })}
          className="mt-4 inline-flex items-center gap-1 text-xs text-ink-500 transition-colors hover:text-ink-300"
        >
          {phase === "loading" ? "Taking too long? Skip this step" : "Can't record — skip"} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
