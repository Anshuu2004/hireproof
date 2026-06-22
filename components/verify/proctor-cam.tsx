"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Continuous in-task proctor. Reuses the same in-browser MediaPipe FaceLandmarker
 * as the liveness step to watch, during the secured task, for: no face (candidate
 * stepped away / covered the camera), a second face (someone helping), and a
 * sustained look-away (reading off-screen). Raw video NEVER leaves the device —
 * only a violation label is bubbled up. Each sustained violation episode raises
 * ONE warning via onWarn; the parent owns the 3-strike → fail policy.
 *
 * NOTE: this is webcam proctoring — a deliberate departure from the otherwise
 * no-surveillance design, enabled only inside the secured test.
 */

// Served locally from /public (version-matched, offline) — same assets as liveness.
const WASM = "/mediapipe/wasm";
const MODEL = "/mediapipe/face_landmarker.task";

type Status = "loading" | "ok" | "no-face" | "multiple-faces" | "looking-away" | "error";

const LABEL: Record<Exclude<Status, "loading" | "ok" | "error">, string> = {
  "no-face": "Keep your face in view of the camera",
  "multiple-faces": "More than one person detected",
  "looking-away": "Keep facing the screen",
};

/** Head-turn magnitude: nose offset from cheek midpoint, normalised by face width. */
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

const WARN_AFTER_MS = 1600; // a violation must persist this long to cost a warning
const GRACE_MS = 2500; // settle-in window after the camera starts

export function ProctorCam({
  onWarn,
  paused,
  onCameraFail,
}: {
  onWarn: (label: string) => void;
  paused?: boolean;
  /** Called once if the camera/proctor can't run — the secured test requires it. */
  onCameraFail?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef(0);
  const [status, setStatus] = useState<Status>("loading");

  // keep the latest callbacks / paused without restarting the camera loop
  const onWarnRef = useRef(onWarn);
  const pausedRef = useRef(paused);
  const onCameraFailRef = useRef(onCameraFail);
  useEffect(() => {
    onWarnRef.current = onWarn;
    pausedRef.current = paused;
    onCameraFailRef.current = onCameraFail;
  });

  useEffect(() => {
    let cancelled = false;
    // One episode = any CONTINUOUS non-ok stretch (the violation type may change
    // within it). We warn at most once per episode and only reset on a return to
    // "ok" — so an oscillating partial-departure can't evade, and one departure
    // can't burn multiple strikes.
    const episode = { active: false, since: 0, warned: false };
    let armedAt = 0;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM);
        const opts = (delegate: "GPU" | "CPU") => ({
          baseOptions: { modelAssetPath: MODEL, delegate },
          outputFaceBlendshapes: false,
          runningMode: "VIDEO" as const,
          numFaces: 2, // detect a second person
        });
        try {
          landmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, opts("GPU"));
        } catch {
          landmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, opts("CPU"));
        }
        if (cancelled) return;
        armedAt = performance.now() + GRACE_MS;
        setStatus("ok");

        const loop = () => {
          const lm = landmarkerRef.current;
          const video = videoRef.current;
          if (lm && video && video.readyState >= 2) {
            const res = lm.detectForVideo(video, performance.now());
            const faces = res?.faceLandmarks?.length ?? 0;
            let cur: Status = "ok";
            if (faces === 0) cur = "no-face";
            else if (faces > 1) cur = "multiple-faces";
            else if (Math.abs(headTurn(res)) > 0.22) cur = "looking-away";
            setStatus(cur);

            const t = performance.now();
            // Don't warn during the grace window or while the parent has paused us
            // (e.g. after submit). Raise exactly one warning per sustained episode.
            if (t >= armedAt && !pausedRef.current) {
              if (cur === "ok") {
                episode.active = false;
                episode.warned = false;
              } else {
                if (!episode.active) {
                  episode.active = true;
                  episode.since = t;
                  episode.warned = false;
                }
                if (!episode.warned && t - episode.since > WARN_AFTER_MS) {
                  episode.warned = true;
                  onWarnRef.current(LABEL[cur as keyof typeof LABEL]);
                }
              }
            }
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch {
        // Secured test requires the proctor camera — signal the parent to fail.
        if (!cancelled) {
          setStatus("error");
          onCameraFailRef.current?.();
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
    };
  }, []);

  const ok = status === "ok";
  const loading = status === "loading";
  const err = status === "error";

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-40 w-40 overflow-hidden rounded-card border bg-ink-950 shadow-lift transition-colors",
        ok || loading ? "border-ink-700" : err ? "border-ink-700" : "border-warn"
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-black">
        <video ref={videoRef} playsInline muted className="absolute inset-0 size-full -scale-x-100 object-cover opacity-90" />
        {err && (
          <div className="absolute inset-0 grid place-items-center px-2 text-center">
            <span className="text-[0.6rem] leading-tight text-warn">camera required for the secured test</span>
          </div>
        )}
        {!err && (
          <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-ink-950/70 px-1.5 py-0.5">
            <span className={cn("size-1.5 rounded-full", ok ? "bg-proof" : loading ? "bg-ink-500" : "bg-warn")} />
            <span className="eyebrow text-[0.55rem] text-ink-300">
              {loading ? "starting" : ok ? "monitored" : "check"}
            </span>
          </div>
        )}
      </div>
      {!ok && !loading && !err && (
        <p className="px-2 py-1 text-[0.6rem] leading-tight text-warn">{LABEL[status as keyof typeof LABEL]}</p>
      )}
    </div>
  );
}
