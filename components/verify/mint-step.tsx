"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadSimple, Copy, ArrowSquareOut, Check, Key, Scales, Warning, Vault, LockKey, Microphone } from "@phosphor-icons/react";
import { CredentialCard } from "@/components/credential-card";
import { Button, buttonClass } from "@/components/ui/button";
import type { ScoreResult } from "./task-step";
import { shortId } from "@/lib/format";
import { cn } from "@/lib/cn";

/** The five judgment axes, in weight order, with human labels. Mirrors WEIGHTS
 *  in lib/ai/scorer.ts — the score IS this breakdown, not a black box. */
const AXES = [
  { key: "error_detection", label: "Error detection", weight: 30 },
  { key: "final_correctness", label: "Final correctness", weight: 25 },
  { key: "direction_quality", label: "Direction quality", weight: 20 },
  { key: "verification", label: "Verification", weight: 15 },
  { key: "iteration", label: "Iteration", weight: 10 },
] as const;

/** "Why this score" — surfaces the per-axis justifications the grader already
 *  produces (each quotes the transcript) plus the deterministic anchors. This is
 *  the explainable, judgment-not-usage evidence; nothing here is affect/personality. */
function ScoreExplain({ score }: { score: ScoreResult }) {
  const r = score.rubric;
  return (
    <div className="mt-5 w-full rounded-control border border-ink-700 bg-ink-900 p-4 text-left">
      <div className="flex items-center gap-2">
        <Scales size={15} className="text-indigo-bright" />
        <span className="text-xs font-medium text-ink-100">Why this score</span>
        <span className="font-data text-sm text-ink-50 ml-auto">{score.aiCollabScore}<span className="text-ink-500">/100</span></span>
      </div>
      <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-500">
        Every score line comes from your actual chat. Tone, confidence and
        &ldquo;cultural fit&rdquo; are never scored (EU AI Act Art 5(1)(f)).
      </p>

      <ul className="mt-3 space-y-2.5">
        {AXES.map((ax) => {
          const sub = r[ax.key] as number;
          return (
            <li key={ax.key}>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink-200">{ax.label}</span>
                <span className="eyebrow text-ink-400">·{ax.weight}%</span>
                <span className="ml-auto font-data text-ink-300">{sub}/5</span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-700">
                <div className="h-full rounded-full bg-indigo-bright" style={{ width: `${(sub / 5) * 100}%` }} />
              </div>
              {r.justifications?.[ax.key] && (
                <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-400">
                  &ldquo;{r.justifications[ax.key]}&rdquo;
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {/* deterministic anchors — the part no LLM opinion can move */}
      <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-ink-700/70 pt-3 font-data text-[0.65rem]">
        <span className={cn("rounded-full px-2 py-0.5", r.caughtPlantedError ? "bg-proof/15 text-proof" : "bg-ink-800 text-ink-400")}>
          {r.caughtPlantedError ? "caught planted flaw" : "missed planted flaw"}
        </span>
        <span className="rounded-full bg-ink-800 px-2 py-0.5 text-ink-400">
          similarity to AI {Math.round(score.signals.finalSimilarityToAi * 100)}%
        </span>
        {score.signals.acceptedVerbatim && (
          <span className="rounded-full bg-warn-wash/15 px-2 py-0.5 text-warn">shipped AI answer · capped ≤40</span>
        )}
        {score.signals.promptInjectionSuspected && (
          <span className="flex items-center gap-1 rounded-full bg-danger-wash/15 px-2 py-0.5 text-danger">
            <Warning size={11} weight="fill" /> score-injection attempt · capped
          </span>
        )}
      </div>
    </div>
  );
}

interface MintResult {
  token: string;
  credentialId: string;
  holderSecret: string;
  verifyUrl: string;
  qrDataUrl: string;
  claims: { aiCollaboration: { score: number; direct: number; judge: number; correct: number } };
  issuedAt: string;
  expiresAt: string;
}

type Phase = "minting" | "signing" | "done" | "error";

export function MintStep({ sessionId, score }: { sessionId: string; score: ScoreResult }) {
  const [phase, setPhase] = useState<Phase>("minting");
  const [cred, setCred] = useState<MintResult | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [erased, setErased] = useState(false);
  const [erasing, setErasing] = useState(false);
  const started = useRef(false);

  async function downloadReceipt() {
    if (!cred?.holderSecret) return; // receipt is now holder-gated (POST + secret)
    try {
      const data = await fetch(`/api/consent-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, secret: cred.holderSecret }),
      }).then((r) => r.json());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hireproof-consent-receipt-${sessionId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* best-effort */
    }
  }

  async function eraseData() {
    if (!cred || erasing) return;
    if (!window.confirm("Erase your biometric data and revoke this credential? This cannot be undone (DPDP Section 12).")) return;
    setErasing(true);
    try {
      const res = await fetch("/api/credential/erase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId: cred.credentialId, secret: cred.holderSecret }),
      });
      if (res.ok) setErased(true);
    } finally {
      setErasing(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/mint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Mint failed");
          setPhase("error");
          return;
        }
        setCred(data as MintResult);
        setPhase("signing");
      } catch {
        setError("Network error while minting");
        setPhase("error");
      }
    })();
  }, [sessionId]);

  // stream the real Ed25519 signature, then reveal the credential
  const signature = cred ? cred.token.split(".")[2] ?? "" : "";
  useEffect(() => {
    if (phase !== "signing" || !signature) return;
    const id = window.setInterval(() => {
      setRevealed((r) => {
        if (r >= signature.length) {
          window.clearInterval(id);
          window.setTimeout(() => setPhase("done"), 320);
          return r;
        }
        return r + 2;
      });
    }, 14);
    return () => window.clearInterval(id);
  }, [phase, signature]);

  function copyToken() {
    if (!cred) return;
    navigator.clipboard?.writeText(cred.token).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  function copySecret() {
    if (!cred) return;
    navigator.clipboard?.writeText(cred.holderSecret).then(() => {
      setSecretCopied(true);
      window.setTimeout(() => setSecretCopied(false), 1600);
    });
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-md rounded-card border border-danger/40 bg-danger-wash/10 p-5 text-sm text-ink-200">
        <p className="font-medium text-ink-50">Couldn&apos;t mint your credential</p>
        <p className="mt-1 text-ink-400">{error}</p>
      </div>
    );
  }

  if (phase === "minting" || phase === "signing") {
    const fp = signature.slice(0, revealed);
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <p className="eyebrow text-indigo-bright">Building your badge</p>
        <div className="mx-auto mt-6 grid size-16 place-items-center rounded-full border border-ink-700 bg-ink-900">
          <span className="size-8 rounded-full bg-indigo/20" />
        </div>
        <p className="mt-5 font-data text-xs text-ink-400">
          {phase === "minting" ? "building your badge…" : "adding the tamper-proof signature…"}
        </p>
        <div className="mx-auto mt-3 max-w-sm break-all rounded-control border border-ink-700 bg-ink-950 p-3 text-left">
          <span className="font-data text-[0.7rem] leading-relaxed text-proof-bright caret">{fp}</span>
        </div>
      </div>
    );
  }

  // done
  const tokenId = cred ? shortId(cred.credentialId) : "";
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center">
      {/* seal */}
      <div className="seal-press relative grid size-14 place-items-center rounded-full bg-amber-wash/10 ring-1 ring-amber/50">
        <span className="grid size-9 place-items-center rounded-full bg-amber text-ink-950">
          <Check size={20} weight="bold" />
        </span>
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-[-0.01em] text-ink-50">Done. This proof is yours.</h1>
      <p className="mt-1.5 text-center text-sm text-ink-300">
        A tamper-proof badge that&apos;s yours to keep. Reuse it with any employer.
      </p>

      {cred && (
        <div className="mt-7">
          <CredentialCard
            tokenId={tokenId}
            issuedAt={new Date(cred.issuedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            expiresAt={new Date(cred.expiresAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            scores={score.bands}
            verifyUrl={cred.verifyUrl.replace(/^https?:\/\//, "").split("#")[0]}
            qrDataUrl={cred.qrDataUrl}
          />
        </div>
      )}

      <div className="mt-6 grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
        <a href={cred?.qrDataUrl} download={`hireproof-${tokenId}.png`} className={buttonClass("ghost", "sm", "gap-1.5")}>
          <DownloadSimple size={15} /> Save QR
        </a>
        <Button variant="ghost" size="sm" onClick={copyToken} className="gap-1.5">
          {copied ? <Check size={15} className="text-proof" /> : <Copy size={15} />} {copied ? "Copied" : "Copy token"}
        </Button>
        <a href={cred ? `/v#${cred.token}` : "#"} target="_blank" rel="noreferrer" className={buttonClass("ghost", "sm", "gap-1.5")}>
          <ArrowSquareOut size={15} /> Verify it
        </a>
      </div>

      {/* Save into DigiLocker — India's govt wallet (demo sandbox; real API contract) */}
      {cred && (
        <button
          type="button"
          onClick={() => {
            window.sessionStorage.setItem("hp_dl_secret", cred.holderSecret);
            window.location.href = `/api/digilocker/authorize?credentialId=${cred.credentialId}`;
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-proof/30 bg-proof/5 px-4 py-2.5 text-sm font-medium text-proof-bright transition-colors hover:bg-proof/15 active:translate-y-px"
        >
          <Vault size={16} weight="fill" /> Save to DigiLocker <span className="eyebrow text-proof-bright/70">demo</span>
        </button>
      )}

      <ScoreExplain score={score} />

      {/* Appropriate-reliance (RAIR/RSR) — calibrated accept-correct AND override-wrong */}
      {score.reliance && (
        <div className="mt-3 w-full rounded-control border border-ink-700 bg-ink-900 p-4 text-left">
          <div className="flex items-center gap-2">
            <Scales size={15} className="text-indigo-bright" />
            <span className="text-xs font-medium text-ink-100">How well you trusted the AI</span>
            <span className="ml-auto font-data text-sm text-ink-50">
              {score.reliance.appropriateReliance}<span className="text-ink-500">/100</span>
            </span>
          </div>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-500">
            Calibrated reliance across {score.reliance.total} AI claims — accepted{" "}
            {score.reliance.acceptedCorrect}/{score.reliance.correctCount} correct, rejected{" "}
            {score.reliance.rejectedWrong}/{score.reliance.wrongCount} wrong. Grounded in Schemmer 2023.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5 font-data text-[0.65rem]">
            <span className="rounded-full bg-proof/15 px-2 py-0.5 text-proof">RAIR {Math.round(score.reliance.rair * 100)}% accept-correct</span>
            <span className="rounded-full bg-indigo/15 px-2 py-0.5 text-indigo-bright">RSR {Math.round(score.reliance.rsr * 100)}% override-wrong</span>
          </div>
        </div>
      )}

      {/* Oral explain-back — binds the WORK to the live person (anti-outsourcing) */}
      {score.explain?.done && (
        <div className="mt-3 w-full rounded-control border border-ink-700 bg-ink-900 p-4 text-left">
          <div className="flex items-center gap-2">
            <Microphone size={15} className="text-indigo-bright" weight="fill" />
            <span className="text-xs font-medium text-ink-100">Oral explain-back</span>
            <span
              className={cn(
                "ml-auto rounded-full px-2 py-0.5 font-data text-[0.65rem]",
                score.explain.verdict === "consistent"
                  ? "bg-proof/15 text-proof"
                  : score.explain.verdict === "inconsistent"
                    ? "bg-danger-wash/15 text-danger"
                    : "bg-ink-800 text-ink-400"
              )}
            >
              {score.explain.verdict}
            </span>
          </div>
          <p className="mt-1.5 text-[0.7rem] leading-relaxed text-ink-500">
            You explained your answer live, on the clock — it was{" "}
            {score.explain.verdict === "consistent"
              ? "consistent with"
              : score.explain.verdict === "inconsistent"
                ? "inconsistent with"
                : "weakly aligned to"}{" "}
            your submission
            {typeof score.explain.consistency === "number"
              ? ` (${Math.round(score.explain.consistency * 100)}% match)`
              : ""}
            . Binds the work to the verified person.
          </p>
        </div>
      )}

      {/* Session integrity — secured-test reviewer signals (never an auto-reject) */}
      {score.integrity && (
        <div className="mt-3 w-full rounded-control border border-ink-700 bg-ink-900 p-4 text-left">
          <div className="flex items-center gap-2">
            <LockKey size={15} className="text-indigo-bright" weight="fill" />
            <span className="text-xs font-medium text-ink-100">Session integrity</span>
            <span className="eyebrow ml-auto text-ink-500">secured test</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5 font-data text-[0.65rem]">
            <span
              className={cn(
                "rounded-full px-2 py-0.5",
                score.integrity.pasteHeavy ? "bg-warn-wash/15 text-warn" : "bg-proof/15 text-proof"
              )}
            >
              {score.integrity.pasteHeavy ? "large pasted answer" : "typed answer"}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5",
                score.integrity.fastSolve ? "bg-warn-wash/15 text-warn" : "bg-ink-800 text-ink-400"
              )}
            >
              {score.integrity.elapsedMs > 0
                ? `solved in ${Math.round(score.integrity.elapsedMs / 1000)}s${score.integrity.fastSolve ? " · fast" : ""}`
                : "timing unavailable"}
            </span>
            {score.integrity.awayEvents > 0 && (
              <span className="rounded-full bg-ink-800 px-2 py-0.5 text-ink-400">
                {score.integrity.awayEvents} focus leave{score.integrity.awayEvents === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="mt-2 text-[0.65rem] leading-relaxed text-ink-500">
            Behavioural signals for a human reviewer — never an automatic reject.
          </p>
        </div>
      )}

      {/* Holder secret — proof-of-possession, shown ONCE, never stored server-side */}
      {cred && (
        <div className="mt-5 w-full rounded-control border border-amber/30 bg-amber-wash/5 p-4">
          <div className="flex items-center gap-2">
            <Key size={15} className="text-amber" weight="fill" />
            <span className="text-xs font-medium text-ink-100">Your private key</span>
            <span className="eyebrow ml-auto text-ink-500">shown once</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
            This is tied to your badge. Keep it safe. It proves the badge is
            <span className="text-ink-200"> yours</span>, not just whoever has the QR.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <code className="flex-1 truncate rounded-control border border-ink-700 bg-ink-950 px-3 py-2 font-data text-xs text-amber">
              {cred.holderSecret}
            </code>
            <button
              type="button"
              onClick={copySecret}
              className="grid size-9 shrink-0 place-items-center rounded-control border border-ink-700 text-ink-300 transition-colors hover:border-ink-500 hover:bg-ink-900"
              aria-label="Copy holder key"
            >
              {secretCopied ? <Check size={15} className="text-proof" /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      )}

      {/* DPDP data rights — working endpoints, not roadmap prose */}
      <div className="mt-5 w-full rounded-control border border-ink-700 bg-ink-950 p-4">
        <p className="eyebrow text-ink-400">Your data rights · India DPDP</p>
        {erased ? (
          <p className="mt-2 text-xs text-proof">
            ✓ Erased — biometric descriptor deleted and credential revoked. Verifying its token now
            shows <span className="font-data">Revoked</span>.
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
              Itemised consent and erasure are exercisable here.
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <Button variant="ghost" size="sm" onClick={downloadReceipt} className="gap-1.5">
                <DownloadSimple size={14} /> Consent receipt
              </Button>
              <Button variant="danger" size="sm" onClick={eraseData} disabled={erasing} className="gap-1.5">
                {erasing ? "Erasing…" : "Erase my data"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
