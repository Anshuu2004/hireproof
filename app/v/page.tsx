"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { importJWK, jwtVerify } from "jose";
import { QrCode, SealCheck, XCircle, Clock, X } from "@phosphor-icons/react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Wordmark } from "@/components/wordmark";
import { CredentialCard } from "@/components/credential-card";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
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

/** A QR encodes the verify URL (…/v#<token>); accept a raw token too. */
function tokenFromScan(text: string): string {
  const hash = text.indexOf("#");
  return (hash >= 0 ? text.slice(hash + 1) : text).trim();
}

export default function VerifyPage() {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [pasted, setPasted] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const timer = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const verify = useCallback(async (token: string, expectedSub?: string) => {
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
      // Try every published issuer key (active + retired during a rotation
      // window); accept on the first that verifies, prefer an expiry reason.
      const methods: Array<{ publicKeyJwk: Parameters<typeof importJWK>[0] }> = did.verificationMethod ?? [];
      let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"] | undefined;
      let expiredErr: unknown, otherErr: unknown;
      for (const m of methods) {
        try {
          const key = await importJWK(m.publicKeyJwk, "EdDSA");
          ({ payload } = await jwtVerify(token, key, { issuer: did.id }));
          break;
        } catch (err) {
          if ((err as { code?: string })?.code === "ERR_JWT_EXPIRED") expiredErr = err;
          else otherErr = err;
        }
      }
      if (!payload) throw expiredErr ?? otherErr ?? new Error("Signature invalid");
      // When resolved by id (short QR), bind the verified token back to that id so a
      // swapped same-origin token-endpoint response can't show the wrong credential.
      if (expectedSub && (payload.sub as string | undefined) !== expectedSub) {
        throw new Error("Credential id mismatch");
      }
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

  // Resolve a SHORT QR (…/v?c=<id>) → fetch the token, then verify it offline.
  const verifyById = useCallback(
    async (id: string) => {
      setState("verifying");
      setResult(null);
      try {
        const { token } = await fetch(`/api/credential/token?id=${encodeURIComponent(id)}`).then((r) => r.json());
        if (token) return verify(token, id);
        setState("invalid");
        setResult({ state: "invalid", took: 0, reason: "Credential not found" });
      } catch {
        setState("invalid");
        setResult({ state: "invalid", took: 0, reason: "Couldn't resolve that QR" });
      }
    },
    [verify]
  );

  // A scanned/opened value may be a short scan URL (?c=<id>), a verify URL
  // (…/v#<token>), or a raw token. Route each to the right path.
  const handleScan = useCallback(
    (text: string) => {
      try {
        const u = new URL(text);
        const c = u.searchParams.get("c");
        if (c) return verifyById(c);
        if (u.hash.length > 1) return verify(u.hash.slice(1));
      } catch {
        /* not a URL — fall through to raw token */
      }
      verify(tokenFromScan(text));
    },
    [verify, verifyById]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash.slice(1);
    const c = new URLSearchParams(window.location.search).get("c");
    if (h) verify(h);
    else if (c) verifyById(c);
    return () => window.clearInterval(timer.current);
  }, [verify, verifyById]);

  const stopScan = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }, []);

  // Live QR scan via the rear camera (zxing). On decode → verify the token.
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    const reader = new BrowserQRCodeReader();
    (async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current!,
          (res, _err, ctrl) => {
            if (res && !cancelled) {
              const text = res.getText();
              ctrl?.stop();
              controlsRef.current = null;
              setScanning(false);
              handleScan(text);
            }
          }
        );
        controlsRef.current = controls;
      } catch {
        if (!cancelled) {
          setScanErr("Couldn't open the camera. Allow camera access, or paste the token below.");
          setScanning(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [scanning, handleScan]);

  const took = state === "verifying" ? elapsed : (result?.took ?? 0);
  const hp = result?.payload?.hp;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-950">
      <header className="border-b border-ink-700/70">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <BackLink />
            <Wordmark />
          </div>
          <span className="hidden eyebrow text-ink-500 sm:block">Public credential verify</span>
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

        {/* scan or paste */}
        <div className="mt-10 w-full max-w-md">
          <button
            type="button"
            onClick={() => { setScanErr(""); setScanning(true); }}
            className="flex w-full items-center justify-center gap-2 rounded-control border border-ink-700 bg-ink-900 px-4 py-3 text-sm font-medium text-ink-100 transition-colors hover:border-indigo/50 active:translate-y-px"
          >
            <QrCode size={18} /> Scan QR with camera
          </button>
          {scanErr && <p className="mt-2 text-center text-xs text-danger">{scanErr}</p>}

          <div className="my-4 flex items-center gap-3 text-ink-600">
            <span className="h-px flex-1 bg-ink-700" />
            <span className="eyebrow">or paste</span>
            <span className="h-px flex-1 bg-ink-700" />
          </div>

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

      {/* camera QR scanner overlay */}
      {scanning && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/90 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-sheet border border-ink-700 bg-ink-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-ink-100">Scan the candidate&apos;s QR</p>
              <button type="button" onClick={stopScan} className="text-ink-400 transition-colors hover:text-ink-100" aria-label="Cancel scan">
                <X size={18} />
              </button>
            </div>
            <div className="relative aspect-square overflow-hidden rounded-card border border-ink-700 bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-proof/70" />
            </div>
            <p className="mt-3 text-center font-data text-xs text-ink-500">Point the camera at the HireProof QR code.</p>
          </div>
        </div>
      )}
    </div>
  );
}
