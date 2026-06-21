"use client";

/**
 * THE SIGNATURE — the Minted Credential card (brief §6, the one aesthetic risk).
 *
 * A credential rendered as one of the galaxies: pulled out of the field and
 * handed to you. Its seal is the exact galaxy-core gradient, so it glows like a
 * nucleus. On load it mints in one orchestrated ~1.6s sequence — seal ignites,
 * hairline draws on, scores count up, QR resolves from noise, the crypto line
 * types in — then it settles into a gentle 7s float.
 *
 * Desktop pointers tilt it toward verification (a credential that leans toward
 * the cursor). Touch keeps the float + liveness pulse but never tilts. Reduced
 * motion shows the final, lit card with no mint and no tilt.
 *
 * SSR / no-JS / reduced-motion all render the finished card (no flash, no CLS);
 * the mint pre-state is armed in a layout effect, before the browser paints, so
 * motion users never glimpse the completed card first.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const SCORES = { direct: 86, judge: 91, correct: 78 } as const;
const CRYPTO = "exp 2026-12-20 · Ed25519 · did:web";
const TOKEN_ID = "HP·8F2C-49A1-7DD0";
const ISSUED = "2026-06-20 14:32 IST";
const VERIFY_URL = "hireproof.app/v/8f2c49a1";

/** Deterministic QR-like matrix (illustrative) with three finder eyes. */
function qrCells(seed: string, n = 21) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const finderOn = (r: number, c: number) => {
    const local = (rr: number, cc: number) =>
      rr === 0 || rr === 6 || cc === 0 || cc === 6 || (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4);
    if (r < 7 && c < 7) return local(r, c);
    if (r < 7 && c >= n - 7) return local(r, c - (n - 7));
    if (r >= n - 7 && c < 7) return local(r - (n - 7), c);
    return false;
  };
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const r = Math.floor(i / n);
    const c = i % n;
    cells.push(isFinder(r, c) ? finderOn(r, c) : (h & 7) > 3);
  }
  return { cells, n };
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function MintedCredential({
  mint = true,
  compact = false,
}: {
  mint?: boolean;
  compact?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const armed = useRef(false);

  // SSR / no-JS / reduced-motion render the finished card.
  const [phase, setPhase] = useState<"mint" | "settled">("settled");
  const [scores, setScores] = useState<{ direct: number; judge: number; correct: number }>(SCORES);
  const [crypto, setCrypto] = useState(CRYPTO);

  const { cells, n } = qrCells("8f2c-49a1-7dd0");

  /* ---- arm the mint pre-state before paint (no flash) ---- */
  useIsomorphicLayoutEffect(() => {
    if (!mint || compact || armed.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    armed.current = true;
    setPhase("mint");
    setScores({ direct: 0, judge: 0, correct: 0 });
    setCrypto("");
  }, [mint, compact]);

  /* ---- run the orchestrated mint ---- */
  useEffect(() => {
    if (!armed.current) return; // reduced-motion / compact / no-mint: already final
    const timers: number[] = [];
    let raf = 0;

    // scores count up (start ~350ms, run ~900ms)
    timers.push(
      window.setTimeout(() => {
        const t0 = performance.now();
        const dur = 900;
        const tick = () => {
          const p = Math.min(1, (performance.now() - t0) / dur);
          const e = easeOut(p);
          setScores({
            direct: Math.round(SCORES.direct * e),
            judge: Math.round(SCORES.judge * e),
            correct: Math.round(SCORES.correct * e),
          });
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, 350)
    );

    // crypto line types in (start ~1000ms)
    timers.push(
      window.setTimeout(() => {
        let i = 0;
        const type = () => {
          i += 1;
          setCrypto(CRYPTO.slice(0, i));
          if (i < CRYPTO.length) timers.push(window.setTimeout(type, 18));
        };
        type();
      }, 1000)
    );

    // settle into the float
    timers.push(window.setTimeout(() => setPhase("settled"), 1600));

    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* ---- pointer tilt (desktop only) ---- */
  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;

    const MAX = 8; // degrees
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        card.style.setProperty("--ry", `${(px - 0.5) * 2 * MAX}deg`);
        card.style.setProperty("--rx", `${(0.5 - py) * 2 * MAX}deg`);
        card.style.setProperty("--mx", `${px * 100}%`);
        card.style.setProperty("--my", `${py * 100}%`);
        card.style.setProperty("--spec", "1");
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--spec", "0");
    };
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const gauges: [string, number][] = [
    ["Direct", scores.direct],
    ["Judge", scores.judge],
    ["Correct", scores.correct],
  ];

  return (
    <div ref={stageRef} className="hp-cred-stage" style={compact ? { maxWidth: 330 } : undefined}>
      <div className="hp-cred-float">
        <article
          ref={cardRef}
          className="hp-cred"
          data-phase={phase}
          aria-label="Sample HireProof credential — Verified Human, liveness passed"
        >
          <span className="hp-cred-spec" aria-hidden="true" />
          <svg className="hp-cred-frame" aria-hidden="true" preserveAspectRatio="none">
            <rect />
          </svg>

          {/* header */}
          <header className="hp-cred-head">
            <div>
              <p className="hp-cred-brand">HireProof</p>
              <p className="hp-cred-id">{TOKEN_ID}</p>
            </div>
            <div>
              <span className="hp-cred-status">
                <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Verified Human
              </span>
              <p className="hp-cred-issued">Issued {ISSUED}</p>
            </div>
          </header>

          {/* identity row: seal + sub-line */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <span className="hp-cred-seal-wrap" aria-hidden="true">
              <span className="hp-cred-seal-ring" />
              <span className="hp-cred-seal" />
            </span>
            <p className="hp-cred-sub">Liveness passed · Identity continuous</p>
          </div>

          {/* AI-collaboration · judgment gauges */}
          <div>
            <p className="hp-eyebrow" style={{ fontSize: "0.55rem", marginBottom: "0.3rem" }}>
              AI-collaboration · judgment
            </p>
            <div className="hp-cred-gauges">
              {gauges.map(([label, value]) => (
                <div key={label} className="hp-cred-gauge">
                  <span className="hp-cred-gauge-ring" style={{ "--val": value } as React.CSSProperties} aria-hidden="true">
                    <span className="hp-cred-gauge-val">{value}</span>
                  </span>
                  <span className="hp-cred-gauge-lbl">
                    {label} <span className="sr-only">{value} of 100</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* QR + crypto footer */}
          <div className="hp-cred-foot">
            <div className="hp-cred-qr" role="img" aria-label={`Scan to verify at ${VERIFY_URL} — no login`}>
              <div
                className="hp-cred-qr-grid"
                style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }}
                aria-hidden="true"
              >
                {cells.map((on, i) => (
                  <span key={i} style={on ? undefined : { background: "transparent" }} />
                ))}
              </div>
              <span className="hp-cred-qr-noise" aria-hidden="true" />
            </div>
            <div className="hp-cred-qr-cap">
              <p className="hp-eyebrow" style={{ fontSize: "0.5rem" }}>Scan to verify · no login</p>
              <p className="hp-cred-id" style={{ marginTop: "2px" }}>{VERIFY_URL}</p>
              <p className="hp-cred-crypto" style={{ marginTop: "3px" }}>{crypto || " "}</p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
