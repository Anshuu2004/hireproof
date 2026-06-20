"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadSimple, Copy, ArrowSquareOut, Check } from "@phosphor-icons/react";
import { CredentialCard } from "@/components/credential-card";
import type { ScoreResult } from "./task-step";
import { cn } from "@/lib/cn";

interface MintResult {
  token: string;
  credentialId: string;
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
  const started = useRef(false);

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
        <p className="eyebrow text-indigo-bright">Minting your proof</p>
        <div className="mx-auto mt-6 grid size-16 place-items-center rounded-full border border-ink-700 bg-ink-900">
          <span className="size-8 rounded-full bg-indigo/20" />
        </div>
        <p className="mt-5 font-data text-xs text-ink-400">
          {phase === "minting" ? "assembling W3C verifiable credential…" : "signing · Ed25519 · did:web"}
        </p>
        <div className="mx-auto mt-3 max-w-sm break-all rounded-control border border-ink-700 bg-ink-950 p-3 text-left">
          <span className="font-data text-[0.7rem] leading-relaxed text-proof-bright caret">{fp}</span>
        </div>
      </div>
    );
  }

  // done
  const tokenId = cred ? `HP·${cred.credentialId.slice(0, 4).toUpperCase()}-${cred.credentialId.slice(4, 8).toUpperCase()}` : "";
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center">
      {/* seal */}
      <div className="seal-press relative grid size-14 place-items-center rounded-full bg-amber-wash/10 ring-1 ring-amber/50">
        <span className="grid size-9 place-items-center rounded-full bg-amber text-ink-950">
          <Check size={20} weight="bold" />
        </span>
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-[-0.01em] text-ink-50">Minted. This proof is yours.</h1>
      <p className="mt-1.5 text-center text-sm text-ink-300">
        A signed, portable credential — reuse it with any employer.
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

      <div className="mt-6 grid w-full grid-cols-3 gap-2">
        <a
          href={cred?.qrDataUrl}
          download={`hireproof-${tokenId}.png`}
          className="flex items-center justify-center gap-1.5 rounded-control border border-ink-700 px-3 py-2.5 text-xs font-medium text-ink-200 transition-colors hover:border-ink-500 hover:bg-ink-900"
        >
          <DownloadSimple size={15} /> Save QR
        </a>
        <button
          type="button"
          onClick={copyToken}
          className="flex items-center justify-center gap-1.5 rounded-control border border-ink-700 px-3 py-2.5 text-xs font-medium text-ink-200 transition-colors hover:border-ink-500 hover:bg-ink-900"
        >
          {copied ? <Check size={15} className="text-proof" /> : <Copy size={15} />} {copied ? "Copied" : "Copy token"}
        </button>
        <a
          href={cred ? `/v#${cred.token}` : "#"}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-control border border-ink-700 px-3 py-2.5 text-xs font-medium text-ink-200 transition-colors hover:border-ink-500 hover:bg-ink-900"
        >
          <ArrowSquareOut size={15} /> Verify it
        </a>
      </div>

      <div className={cn("mt-5 w-full rounded-control border px-4 py-3 text-center text-xs",
        score.rubric.caughtPlantedError ? "border-proof/30 text-proof" : "border-ink-700 text-ink-400")}>
        AI-collaboration judgment score <span className="font-data text-ink-100">{score.aiCollabScore}</span>
        {score.rubric.caughtPlantedError ? " · caught the planted flaw" : ""}
      </div>
    </div>
  );
}
