"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACTION_COPY,
  SPEECH_LANG,
  type Language,
  type LivenessAction,
} from "@/lib/liveness/challenge";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

// Served locally from /public — version-matched WASM, no CDN/version drift,
// works offline (e.g. on venue wifi at the finale).
const FACE_LANDMARKER_WASM = "/mediapipe/wasm";
const FACE_LANDMARKER_MODEL = "/mediapipe/face_landmarker.task";
const FACEAPI_MODELS = "/models";

// MediaPipe/emscripten prints benign "INFO:" lines (e.g. the XNNPACK CPU delegate
// notice) to stderr -> console.error, which Next's dev overlay shows as a red error.
// They are not failures; filter just these lines so the UI stays clean.
declare global {
  interface Window {
    __hpLogPatched?: boolean;
  }
}
if (typeof window !== "undefined" && !window.__hpLogPatched) {
  window.__hpLogPatched = true;
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const s = typeof args[0] === "string" ? args[0] : "";
    if (s.startsWith("INFO:") || s.includes("XNNPACK") || s.includes("TensorFlow Lite")) return;
    orig(...args);
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blendshape(result: any, name: string): number {
  const cats = result?.faceBlendshapes?.[0]?.categories;
  if (!cats) return 0;
  const c = cats.find((x: { categoryName: string; score: number }) => x.categoryName === name);
  return c?.score ?? 0;
}

/** Head-turn magnitude from landmarks: nose offset from the cheek midpoint, normalised by face width. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function headTurn(result: any): number {
  const lm = result?.faceLandmarks?.[0];
  if (!lm) return 0;
  const nose = lm[1];
  const left = lm[234];
  const right = lm[454];
  if (!nose || !left || !right) return 0;
  const faceW = Math.abs(right.x - left.x) || 1;
  return (nose.x - (left.x + right.x) / 2) / faceW;
}

export interface LivenessResult {
  verdict: "pass" | "fail";
  checks: { actionsOk: boolean; faceOk: boolean; voiceOk: boolean };
  crossRound: { distance: number; priorRounds: number; match: boolean } | null;
}

type Phase =
  | "loading"
  | "ready"
  | "getready"
  | "running"
  | "confirm"
  | "speaking"
  | "capturing"
  | "submitting"
  | "done"
  | "error";

interface Props {
  sessionId: string;
  challenge: { actions: LivenessAction[]; digits: number[]; language: Language };
  spokenPhrase: string;
  onComplete: (result: LivenessResult) => void;
}

const HOLD_FRAMES = 6; // sustained frames required for held actions
const LISTEN_SECONDS = 8;

export function LivenessStep({ sessionId, challenge, spokenPhrase, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number>(0);

  const idxRef = useRef(0);
  const completedRef = useRef<{ action: string; atMs: number }[]>([]);
  const faceContinuousRef = useRef(true);
  const startRef = useRef(0);
  const phaseRef = useRef<Phase>("loading");

  // per-action detection state
  const holdRef = useRef(0);
  const blinkCountRef = useRef(0);
  const blinkClosedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("loading");
  const [idx, setIdx] = useState(0);
  const [faceLocked, setFaceLocked] = useState(false);
  const [signal, setSignal] = useState("");
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [listenLeft, setListenLeft] = useState(LISTEN_SECONDS);
  const [transcript, setTranscript] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState<
    "idle" | "listening" | "heard" | "mic-blocked" | "stt-unsupported" | "stt-network"
  >("idle");
  const [error, setError] = useState("");

  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number>(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ---------- setup ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM);
        const options = (delegate: "GPU" | "CPU") => ({
          baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL, delegate },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO" as const,
          numFaces: 1,
        });
        try {
          landmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, options("GPU"));
        } catch {
          landmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, options("CPU"));
        }
        if (!cancelled) {
          setPhase("ready");
          rafRef.current = requestAnimationFrame(tick);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn("[liveness] setup failed:", e);
          setError(msg || "Model load failed");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- confirm an action, pause, then advance ----------
  const confirmAdvance = useCallback(
    (action: LivenessAction) => {
      completedRef.current.push({ action, atMs: Math.round(performance.now() - startRef.current) });
      holdRef.current = 0;
      blinkCountRef.current = 0;
      blinkClosedRef.current = false;
      setProgress(1);
      setPhase("confirm");
      window.setTimeout(() => {
        const next = idxRef.current + 1;
        idxRef.current = next;
        setProgress(0);
        setSignal("");
        if (next >= challenge.actions.length) {
          setPhase("speaking");
        } else {
          setIdx(next);
          setPhase("running");
        }
      }, 850);
    },
    [challenge.actions.length]
  );

  // ---------- detection loop ----------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evaluate = useCallback(
    (result: any) => {
      const action = challenge.actions[idxRef.current];
      if (action === "blink") {
        const closed = blendshape(result, "eyeBlinkLeft") > 0.5 && blendshape(result, "eyeBlinkRight") > 0.5;
        if (closed) blinkClosedRef.current = true;
        else if (blinkClosedRef.current) {
          blinkClosedRef.current = false;
          blinkCountRef.current += 1;
        }
        setSignal(`blinks ${blinkCountRef.current}/2`);
        setProgress(Math.min(1, blinkCountRef.current / 2));
        if (blinkCountRef.current >= 2) confirmAdvance("blink");
      } else if (action === "mouth_open") {
        const v = blendshape(result, "jawOpen");
        setSignal(`mouth open ${Math.round(v * 100)}%`);
        if (v > 0.4) holdRef.current += 1;
        else holdRef.current = Math.max(0, holdRef.current - 1);
        setProgress(Math.min(1, holdRef.current / HOLD_FRAMES));
        if (holdRef.current >= HOLD_FRAMES) confirmAdvance("mouth_open");
      } else if (action === "smile") {
        const v = Math.min(blendshape(result, "mouthSmileLeft"), blendshape(result, "mouthSmileRight"));
        setSignal(`smile ${Math.round(v * 100)}%`);
        if (v > 0.4) holdRef.current += 1;
        else holdRef.current = Math.max(0, holdRef.current - 1);
        setProgress(Math.min(1, holdRef.current / HOLD_FRAMES));
        if (holdRef.current >= HOLD_FRAMES) confirmAdvance("smile");
      } else if (action === "turn") {
        const v = Math.abs(headTurn(result));
        setSignal(`head turn ${Math.round((v / 0.18) * 100)}%`);
        if (v > 0.16) holdRef.current += 1;
        else holdRef.current = Math.max(0, holdRef.current - 1);
        setProgress(Math.min(1, holdRef.current / 4));
        if (holdRef.current >= 4) confirmAdvance("turn");
      }
    },
    [challenge.actions, confirmAdvance]
  );

  const tick = useCallback(() => {
    const lm = landmarkerRef.current;
    const video = videoRef.current;
    if (lm && video && video.readyState >= 2) {
      const result = lm.detectForVideo(video, performance.now());
      const hasFace = (result?.faceLandmarks?.length ?? 0) > 0;
      setFaceLocked(hasFace);
      const p = phaseRef.current;
      if (p === "running") {
        if (!hasFace) {
          faceContinuousRef.current = false;
          setSignal("no face — center yourself in the oval");
        } else {
          evaluate(result);
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluate]);

  const begin = () => {
    startRef.current = performance.now();
    idxRef.current = 0;
    completedRef.current = [];
    faceContinuousRef.current = true;
    holdRef.current = 0;
    blinkCountRef.current = 0;
    setIdx(0);
    setCountdown(3);
    setPhase("getready");
  };

  // get-ready countdown -> running
  useEffect(() => {
    if (phase !== "getready") return;
    if (countdown <= 0) {
      setPhase("running");
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => window.clearTimeout(t);
  }, [phase, countdown]);

  // ---------- voice: paced listening window ----------
  const capture = useCallback(
    async (spoken: string, voiceActivity: boolean) => {
      setPhase("capturing");
      try {
        const faceapi = await import("@vladmandic/face-api");
        await faceapi.nets.ssdMobilenetv1.loadFromUri(FACEAPI_MODELS);
        await faceapi.nets.faceLandmark68Net.loadFromUri(FACEAPI_MODELS);
        await faceapi.nets.faceRecognitionNet.loadFromUri(FACEAPI_MODELS);
        const det = await faceapi
          .detectSingleFace(videoRef.current!, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        const descriptor = det ? Array.from(det.descriptor) : new Array(128).fill(0);

        setPhase("submitting");
        const res = await fetch("/api/liveness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            livenessProof: {
              completedActions: completedRef.current,
              faceContinuous: faceContinuousRef.current,
              durationMs: Math.round(performance.now() - startRef.current),
            },
            faceDescriptor: descriptor,
            spokenTranscript: spoken,
            voiceActivity,
          }),
        });
        const data = (await res.json()) as LivenessResult;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(rafRef.current);
        setPhase("done");
        onComplete(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Capture failed");
        setPhase("error");
      }
    },
    [onComplete, sessionId]
  );

  useEffect(() => {
    if (phase !== "speaking") return;
    let finalText = "";
    let voiceActive = false;
    let cancelled = false;
    setTranscript("");
    setListenLeft(LISTEN_SECONDS);
    setMicLevel(0);
    setVoiceStatus("idle");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rec: any = null;

    (async () => {
      // 1) mic level meter — diagnostic ("is my mic working?") + fallback voice-present signal
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
          const rms = Math.sqrt(sum / buf.length);
          setMicLevel(rms);
          if (rms > 0.045) voiceActive = true;
          meterRafRef.current = requestAnimationFrame(meter);
        };
        meter();
        setVoiceStatus("listening");
      } catch {
        setVoiceStatus("mic-blocked");
      }

      // 2) speech-to-text for the digit transcript (Chrome/Edge, needs internet)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        rec = new SR();
        rec.lang = SPEECH_LANG[challenge.language];
        rec.interimResults = true;
        rec.continuous = true;
        rec.maxAlternatives = 3;
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
          else if (ev?.error === "network") setVoiceStatus("stt-network");
        };
        try {
          rec.start();
        } catch {}
      } else {
        setVoiceStatus((s) => (s === "mic-blocked" ? s : "stt-unsupported"));
      }
    })();

    const interval = window.setInterval(() => setListenLeft((s) => Math.max(0, s - 1)), 1000);
    const done = window.setTimeout(() => capture(finalText, voiceActive), LISTEN_SECONDS * 1000);

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
  }, [phase]);

  const currentAction = challenge.actions[idx];
  const prompt = currentAction ? ACTION_COPY[currentAction][challenge.language] : "";
  const busy = phase === "loading" || phase === "capturing" || phase === "submitting";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sheet border border-ink-700 bg-ink-950">
        <video ref={videoRef} playsInline muted className="absolute inset-0 size-full -scale-x-100 object-cover opacity-90" />

        {/* oval guide */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div
            className={cn(
              "h-[72%] w-[58%] rounded-[50%] border-2 transition-colors duration-300",
              faceLocked
                ? "border-proof shadow-[0_0_0_9999px_rgba(10,11,13,0.55)]"
                : "border-ink-300/70 shadow-[0_0_0_9999px_rgba(10,11,13,0.7)]"
            )}
          />
        </div>

        {/* live realness indicator — flips when you cover the camera */}
        {!busy && phase !== "ready" && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-ink-950/70 px-2.5 py-1">
            <span className={cn("size-2 rounded-full", faceLocked ? "bg-proof" : "bg-ink-500")} />
            <span className="eyebrow text-ink-300">{faceLocked ? "Face detected" : "No face"}</span>
          </div>
        )}

        {/* indigo recording cue (never red) */}
        {(phase === "running" || phase === "confirm" || phase === "speaking") && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-ink-950/70 px-2.5 py-1">
            <span className="size-2 rounded-full bg-indigo-bright pulse-soft" />
            <span className="eyebrow text-ink-300">Live · on-device</span>
          </div>
        )}

        {/* get-ready countdown */}
        {phase === "getready" && (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/40">
            <div className="text-center">
              <p className="font-data text-6xl font-semibold text-ink-50">{countdown}</p>
              <p className="mt-1 eyebrow text-ink-300">center your face</p>
            </div>
          </div>
        )}

        {/* action prompt + live metric (proves the model is tracking YOU) */}
        {phase === "running" && (
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="mx-auto w-fit max-w-full rounded-control border border-ink-700 bg-ink-950/85 px-4 py-2.5 backdrop-blur">
              <p className="eyebrow text-indigo-bright">
                Challenge {idx + 1} / {challenge.actions.length}
              </p>
              <p className={cn("mt-0.5 text-base font-medium text-ink-50", challenge.language !== "en" && "font-deva")}>
                {prompt}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 w-28 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full rounded-full bg-proof transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
                </div>
                <span className="font-data text-[0.65rem] text-ink-400">{signal}</span>
              </div>
            </div>
          </div>
        )}

        {phase === "confirm" && (
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="mx-auto flex w-fit items-center gap-2 rounded-control border border-proof/40 bg-proof-wash-dark/70 px-4 py-2.5 backdrop-blur">
              <span className="grid size-5 place-items-center rounded-full bg-proof text-ink-950">
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm font-medium text-proof">Confirmed</span>
            </div>
          </div>
        )}

        {/* voice — paced listening window with live transcript */}
        {phase === "speaking" && (
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="mx-auto w-full max-w-xs rounded-control border border-ink-700 bg-ink-950/90 px-4 py-3 text-center backdrop-blur">
              <div className="flex items-center justify-center gap-2">
                <span className="size-2 rounded-full bg-indigo-bright pulse-soft" />
                <p className="eyebrow text-indigo-bright">Listening · {listenLeft}s</p>
              </div>
              <p className="mt-1 text-xs text-ink-400">Read these numbers aloud</p>
              <p className={cn("mt-1 font-data text-2xl tracking-[0.15em] text-ink-50", challenge.language !== "en" && "font-deva")}>
                {spokenPhrase}
              </p>

              {/* live mic meter — the bar moves if your mic is picking up sound */}
              <div className="mt-3 flex items-center gap-2">
                <span className="eyebrow shrink-0 text-ink-500">mic</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-75",
                      micLevel > 0.045 ? "bg-proof" : "bg-ink-400"
                    )}
                    style={{ width: `${Math.min(100, Math.round(micLevel * 350))}%` }}
                  />
                </div>
              </div>

              <p className="mt-2 min-h-[1.2em] text-xs">
                {voiceStatus === "mic-blocked" ? (
                  <span className="text-warn">Microphone blocked — allow mic access and retry</span>
                ) : voiceStatus === "stt-unsupported" ? (
                  <span className="text-ink-400">No speech-to-text here — your live voice still counts</span>
                ) : voiceStatus === "stt-network" ? (
                  <span className="text-warn">Speech service offline — your live voice still counts</span>
                ) : transcript ? (
                  <span className="text-ink-300">heard: {transcript}</span>
                ) : (
                  <span className="text-ink-500">speak now…</span>
                )}
              </p>
            </div>
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/60">
            <div className="text-center">
              <div className="mx-auto mb-3 h-1 w-32 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full w-1/2 animate-[pulse-soft_1.2s_ease-in-out_infinite] rounded-full bg-indigo-bright" />
              </div>
              <p className="font-data text-xs text-ink-300">
                {phase === "loading" && "loading face engine…"}
                {phase === "capturing" && "computing 128-d face fingerprint…"}
                {phase === "submitting" && "verifying signals on the server…"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* signal pills */}
      <div className="mt-5 flex w-full items-center justify-center gap-2">
        {(["Face", "Voice", "Reasoning"] as const).map((s) => {
          const active =
            (s === "Face" && ["running", "confirm", "speaking", "capturing", "submitting", "done"].includes(phase)) ||
            (s === "Voice" && ["speaking", "capturing", "submitting", "done"].includes(phase)) ||
            (s === "Reasoning" && phase === "done");
          return (
            <div
              key={s}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                active ? "border-proof/40 text-proof" : "border-ink-700 text-ink-500"
              )}
            >
              <span className={cn("size-1.5 rounded-full", active ? "bg-proof" : "bg-ink-600")} />
              {s}
            </div>
          );
        })}
      </div>

      {phase === "ready" && (
        <>
          <Button size="lg" onClick={begin} className="mt-6 w-full">
            Begin the live check
          </Button>
          <p className="mt-3 text-center text-xs text-ink-500">
            Good light, face centred. {challenge.actions.length} quick actions, then read 3 numbers aloud.
          </p>
        </>
      )}

      {phase === "error" && (
        <div className="mt-6 w-full rounded-control border border-danger/40 bg-danger-wash/10 p-4 text-sm text-ink-200">
          <p className="font-medium text-ink-50">Couldn&apos;t start the check</p>
          <p className="mt-1 text-ink-400">{error}</p>
          <p className="mt-2 text-xs text-ink-500">Allow camera access and use Chrome/Edge for voice support.</p>
        </div>
      )}
    </div>
  );
}
