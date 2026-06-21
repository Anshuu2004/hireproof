"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "scanning" | "verified" | "failed";
type Variant = "real" | "fake";

interface Props {
  variant?: Variant;
  /** ms to wait after the card enters view before the sequence runs */
  startDelay?: number;
  credentialId?: string;
  issued?: string;
  qrSlug?: string;
  /** reason chip shown on the fake card */
  reason?: string;
}

const SCORES = { direct: 86, judge: 91, correct: 78 };

// a fixed, decorative QR-like pattern (7×7) — not a real code (aria-hidden;
// the scannable equivalent is the caption text).
const QR = [
  1, 1, 1, 0, 1, 0, 1,
  1, 0, 1, 0, 0, 1, 1,
  1, 0, 1, 1, 1, 0, 1,
  0, 0, 0, 1, 0, 1, 0,
  1, 1, 0, 0, 1, 1, 1,
  1, 0, 1, 1, 0, 0, 1,
  1, 1, 0, 1, 1, 0, 1,
];

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** rAF count-up from 0 → target while `run` is true (instant if reduced). */
function useCountUp(target: number, run: boolean, reduced: boolean, durationMs = 1200): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (reduced) {
      setVal(target);
      return;
    }
    let raf = 0;
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, reduced, durationMs]);
  return val;
}

export function VerificationCard({
  variant = "real",
  startDelay = 0,
  credentialId = "HP·8F2C-49A1-7DD0",
  issued = "2026-06-20 14:32 IST",
  qrSlug = "8f2c49a1",
  reason = "PROXY · LLM, STATELESS",
}: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const started = useRef(false);

  // start the sequence the first time the card is meaningfully in view
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const begin = () => {
      if (started.current) return;
      started.current = true;
      if (reduced) {
        setPhase(variant === "fake" ? "failed" : "verified");
        return;
      }
      const timers: number[] = [];
      timers.push(window.setTimeout(() => setPhase("scanning"), startDelay));
      if (variant === "fake") {
        timers.push(window.setTimeout(() => setPhase("failed"), startDelay + 950));
      } else {
        timers.push(window.setTimeout(() => setPhase("verified"), startDelay + 1600));
      }
      el.dataset.timers = timers.join(",");
    };
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && begin()),
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [variant, startDelay, reduced]);

  const verified = phase === "verified";
  const failed = phase === "failed";
  const direct = useCountUp(SCORES.direct, verified, reduced);
  const judge = useCountUp(SCORES.judge, verified, reduced);
  const correct = useCountUp(SCORES.correct, verified, reduced);

  const status =
    phase === "idle" || phase === "scanning"
      ? { label: "Pending", live: "Verifying credential…" }
      : failed
        ? { label: "Fake detected", live: "Verification failed — fake detected." }
        : { label: "Verified Human", live: "Credential verified — real, live human." };

  const fill = (v: number) => ({ width: verified ? `${v}%` : "0%" });

  return (
    <div ref={ref} className="vc lp-hero-card" data-phase={phase} data-variant={variant}>
      <div className="vc-shimmer" aria-hidden="true" />

      {/* polite status announcement for screen readers */}
      <span className="sr-only" aria-live="polite">{status.live}</span>

      <div className="vc-head">
        <span className="vc-brand">
          <span className="lp-seal" aria-hidden="true">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          HireProof
        </span>
        <span className="vc-pill">
          <span className="vc-pill-dot" aria-hidden="true" />
          {status.label}
        </span>
      </div>

      <div className="vc-id">
        <div className="lp-data">{credentialId}</div>
        <div className="lp-data" style={{ opacity: 0.75 }}>Issued: {issued}</div>
      </div>

      {/* liveness zone with biometric scan + verdict mark */}
      <div className="vc-liveness" aria-hidden="true">
        <svg className="vc-face" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="32" cy="24" r="11" />
          <path d="M14 54c2.5-9.5 10-15 18-15s15.5 5.5 18 15" strokeLinecap="round" />
        </svg>
        <span className="vc-scan" />
        <svg className="vc-verdict" viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="15" r="14" />
          {variant === "fake" ? (
            <>
              <path className="vc-stroke is-cross" pathLength={1} d="M10 10l10 10" />
              <path className="vc-stroke is-cross" pathLength={1} d="M20 10l-10 10" style={{ animationDelay: "120ms" }} />
            </>
          ) : (
            <path className="vc-stroke is-check" pathLength={1} d="M9 15.5l4 4 8-9" />
          )}
        </svg>
      </div>

      {/* AI-collaboration · judgment */}
      <div className="vc-gauges" role="group" aria-label="AI-collaboration judgment scores">
        {[
          ["Direct", direct, SCORES.direct],
          ["Judge", judge, SCORES.judge],
          ["Correct", correct, SCORES.correct],
        ].map(([lbl, shown, target]) => (
          <div key={lbl as string}>
            <div className="vc-gauge-lbl">{lbl}</div>
            <div className="vc-gauge-val">{failed ? "—" : (shown as number)}</div>
            <div className="vc-gauge-bar">
              <div className="vc-gauge-fill" style={fill(target as number)} />
            </div>
          </div>
        ))}
      </div>

      {failed && (
        <div className="vc-reason" role="status">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          {reason}
        </div>
      )}

      <div className="vc-foot">
        <div className="vc-qr" aria-hidden="true">
          <div className="vc-qr-grid">
            {QR.map((on, i) => (
              <i key={i} className={on ? "" : "off"} />
            ))}
          </div>
        </div>
        <div className="vc-foot-cap">
          <div className="lp-data" style={{ color: "var(--ink)", fontSize: "0.7rem" }}>
            Scan to verify · no login
          </div>
          <div className="vc-crypto">hireproof.app/v/{qrSlug}</div>
          <div className="vc-crypto" style={{ marginTop: "0.2rem" }}>
            exp 2026-12-20 · Ed25519 · did:web
          </div>
        </div>
      </div>
    </div>
  );
}
