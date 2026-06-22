"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { importJWK, jwtVerify } from "jose";
import { QrCode, SealCheck, XCircle, Clock } from "@phosphor-icons/react";
import { Wordmark } from "@/components/wordmark";
import { CredentialCard } from "@/components/credential-card";
import { Button } from "@/components/ui/button";
import { shortId } from "@/lib/format";
import { cn } from "@/lib/cn";

type State = "idle" | "verifying" | "valid" | "expired" | "revoked" | "invalid";

interface HpClaims {
  humanVerified: boolean;
  livenessPassed: boolean;
  aiCollaboration: { score: number; direct: number; judge: number; correct: number };
  rounds: number;
}

interface Result {
  state: State;
  took: number;
  payload?: { sub?: string; iss?: string; iat?: number; exp?: number; hp?: HpClaims };
  reason?: string;
  status?: { revoked?: boolean; rounds?: number };
}

export default function VerifyPage() {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [pasted, setPasted] = useState("");
  const timer = useRef<number>(0);

  const verify = useCallback(async (token: string) => {
    if (!token || token.split(".").length !== 3) {
      setState("invalid");
      setResult({ state: "invalid", took: 0, reason: "Not a credential token" });
      return;
    }
    setState("verifying");
    setResult(null);
    const t0 = performance.now();
    setElapsed(0);
    timer.current = window.setInterval(() => setElapsed((performance.now() - t0) / 1000), 40);

    try {
      const did = await fetch("/.well-known/did.json").then((r) => r.json());
      const jwk = did.verificationMethod[0].publicKeyJwk;
      const key = await importJWK(jwk, "EdDSA");
      const { payload } = await jwtVerify(token, key, { issuer: did.id });
      let status: Result["status"];
      try {
        // Pass the token so the server confirms the signature too (and records a
        // truthful audit event) — the client already verified it offline above.
        status = await fetch(`/api/credential-status?id=${payload.sub}&token=${encodeURIComponent(token)}`).then((r) => r.json());
      } catch {
        status = undefined;
      }
      window.clearInterval(timer.current);
      const took = (performance.now() - t0) / 1000;
      if (status?.revoked) {
        setState("revoked");
        setResult({ state: "revoked", took, payload: payload as Result["payload"], status });
      } else {
        setState("valid");
        setResult({ state: "valid", took, payload: payload as Result["payload"], status });
      }
    } catch (e) {
      window.clearInterval(timer.current);
      const code = (e as { code?: string })?.code;
      const expired = code === "ERR_JWT_EXPIRED";
      const st: State = expired ? "expired" : "invalid";
      setState(st);
      setResult({ state: st, took: (performance.now() - t0) / 1000, reason: expired ? "Credential expired" : "Signature invalid" });
    }
  }, []);

  useEffect(() => {
    const h = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (h) verify(h);
    return () => window.clearInterval(timer.current);
  }, [verify]);

  const took = state === "verifying" ? elapsed : (result?.took ?? 0);
  const hp = result?.payload?.hp;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-950">
      <header className="border-b border-ink-700/70">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5">
          <Wordmark />
          <span className="eyebrow text-ink-500">Public credential verify</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-5 py-12">
        {/* elapsed-seconds verify reveal */}
        {state === "idle" && (
          <div className="w-full max-w-md text-center">
            <QrCode size={28} className="mx-auto text-ink-400" />
            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.01em] text-ink-50">Verify a HireProof</h1>
            <p className="mt-2 text-ink-300">Scan a candidate&apos;s QR, or paste their credential token below.</p>
          </div>
        )}

        {state === "verifying" && (
          <div className="w-full max-w-md text-center">
            <p className="eyebrow text-indigo-bright">Verifying signature…</p>
            <p className="mt-3 font-data text-4xl font-semibold text-ink-50">{took.toFixed(2)}s</p>
            <p className="mt-2 font-data text-xs text-ink-500">checking Ed25519 against the published did:web key</p>
          </div>
        )}

        {result && state !== "verifying" && (
          <div className="w-full max-w-md">
            {/* decisive snap to a verdict */}
            <div
              className={cn(
                "flex items-center gap-3 rounded-card border p-4",
                state === "valid"
                  ? "border-proof/40 bg-proof-wash-dark/40"
                  : state === "expired"
                    ? "border-warn/40 bg-warn-wash/10"
                    : "border-danger/40 bg-danger-wash/10"
              )}
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full",
                  state === "valid" ? "bg-proof text-ink-950" : state === "expired" ? "bg-warn text-ink-950" : "bg-danger text-white"
                )}
              >
                {state === "valid" ? <SealCheck size={22} weight="fill" /> : state === "expired" ? <Clock size={22} weight="fill" /> : <XCircle size={22} weight="fill" />}
              </span>
              <div>
                <p className="font-medium text-ink-50">
                  {state === "valid" && "Real human · verified"}
                  {state === "expired" && "Credential expired"}
                  {state === "revoked" && "Credential revoked"}
                  {state === "invalid" && "Could not verify"}
                </p>
                <p className="font-data text-xs text-ink-400">
                  {state === "valid" ? `signature valid · ${took.toFixed(2)}s` : result.reason}
                </p>
              </div>
            </div>

            {state === "valid" && hp && result.payload && (
              <>
                <div className="mt-6 flex justify-center">
                  <CredentialCard
                    tokenId={shortId(result.payload.sub ?? "")}
                    issuedAt={result.payload.iat ? new Date(result.payload.iat * 1000).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}
                    expiresAt={result.payload.exp ? new Date(result.payload.exp * 1000).toLocaleDateString("en-IN", { dateStyle: "medium" }) : ""}
                    scores={hp.aiCollaboration}
                    showQr={false}
                  />
                </div>

                <div className="mt-6 divide-y divide-ink-700/70 overflow-hidden rounded-card border border-ink-700 bg-ink-900">
                  {[
                    ["Ed25519 signature", "valid"],
                    ["Issued by", result.payload.iss ?? ""],
                    ["Re-verification rounds", String(result.status?.rounds ?? hp.rounds)],
                    ["AI-collaboration score", String(hp.aiCollaboration.score)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-ink-300">{k}</span>
                      <span className="font-data text-xs text-ink-100">{v}</span>
                    </div>
                  ))}
                </div>

                {/* honesty block — what this proves / does NOT prove */}
                <div className="mt-4 rounded-card border border-ink-700 bg-ink-900 p-4 text-sm">
                  <p className="eyebrow text-ink-400">What this proves / does not prove</p>
                  <ul className="mt-2 space-y-1.5 text-ink-400">
                    <li>✓ A live human passed a randomised liveness check at issuance.</li>
                    <li>✓ A measured AI-collaboration judgment score (not affect/personality).</li>
                    <li>✗ Not a legal-identity / KYC document.</li>
                    <li>✗ Challenge-response liveness — not certified anti-deepfake PAD.</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* paste box */}
        <div className="mt-10 w-full max-w-md">
          <label className="eyebrow text-ink-400">Paste a credential token</label>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={3}
            placeholder="eyJhbGciOiJFZERTQSJ9…"
            className="mt-2 w-full resize-y rounded-control border border-ink-700 bg-ink-900 px-3 py-2 font-data text-xs text-ink-200 placeholder:text-ink-600 focus:border-indigo focus:outline-none"
          />
          <Button onClick={() => verify(pasted.trim())} disabled={!pasted.trim()} className="mt-2 w-full">
            Verify
          </Button>
        </div>

        <Link href="/" className="mt-10 text-sm text-ink-500 underline-offset-4 hover:text-ink-300 hover:underline">
          HireProof
        </Link>
      </main>
    </div>
  );
}
