"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowsClockwise, X, Check, Warning, FileText } from "@phosphor-icons/react";
import { Wordmark } from "@/components/wordmark";
import { CredentialCard } from "@/components/credential-card";
import { LivenessStep, type LivenessResult } from "@/components/verify/liveness-step";
import type { Language, LivenessAction } from "@/lib/liveness/challenge";
import { cn } from "@/lib/cn";

interface Claims {
  humanVerified: boolean;
  livenessPassed: boolean;
  aiCollaboration: { score: number; direct: number; judge: number; correct: number };
  rounds: number;
}
interface Credential {
  id: string;
  session_id: string;
  payload_json: Claims;
  issued_at: string;
  expires_at: string;
  revoked: boolean;
  round_count: number;
}
interface AuditEvent {
  id: number;
  event_type: string;
  row_hash: string;
  created_at: string;
}
interface SessionData {
  sessionId: string;
  challenge: { actions: LivenessAction[]; digits: number[]; language: Language };
  spokenPhrase: string;
}

const shortId = (id: string) => `HP·${id.slice(0, 4).toUpperCase()}-${id.slice(4, 8).toUpperCase()}`;

export default function EmployerPage() {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [sel, setSel] = useState<Credential | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverify, setReverify] = useState<SessionData | null>(null);
  const [reverifyResult, setReverifyResult] = useState<LivenessResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch("/api/employer/credentials").then((r) => r.json());
    setCreds(data.credentials ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setReverifyResult(null);
    setReverify(null);
    if (!sel) return setAudit([]);
    fetch(`/api/employer/audit?sessionId=${sel.session_id}`)
      .then((r) => r.json())
      .then((d) => setAudit(d.events ?? []));
  }, [sel]);

  async function startReverify() {
    if (!sel) return;
    setBusy(true);
    setReverifyResult(null);
    try {
      const data = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "en",
          consent: { face: true, voice: true, crossStage: true },
          credentialId: sel.id,
        }),
      }).then((r) => r.json());
      setReverify(data as SessionData);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-950">
      <header className="border-b border-ink-700/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="hidden h-4 w-px bg-ink-700 sm:block" />
            <span className="hidden eyebrow text-ink-500 sm:block">Verify console</span>
          </div>
          <span className="rounded-full border border-ink-700 px-2.5 py-1 eyebrow text-ink-500">demo · open access</span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-px overflow-hidden bg-ink-700/40 md:grid-cols-[340px_1fr]">
        {/* LEFT: credential list */}
        <div className="flex flex-col bg-ink-950">
          <div className="flex items-center justify-between border-b border-ink-700/70 px-4 py-3">
            <span className="text-sm font-medium text-ink-100">Verified candidates</span>
            <span className="font-data text-xs text-ink-500">{creds.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-px p-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-[pulse-soft_1.4s_ease-in-out_infinite] rounded-control bg-ink-900" />
                ))}
              </div>
            ) : creds.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <FileText size={22} className="text-ink-600" />
                <p className="text-sm text-ink-400">No credentials yet.</p>
                <Link href="/verify" className="text-sm text-indigo-bright underline-offset-4 hover:underline">
                  Mint one at /verify
                </Link>
              </div>
            ) : (
              creds.map((c) => {
                const ok = c.payload_json?.humanVerified && !c.revoked;
                const active = sel?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSel(c)}
                    className={cn(
                      "flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors",
                      active ? "border-indigo-bright bg-ink-900" : "border-transparent hover:bg-ink-900/60"
                    )}
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", ok ? "bg-proof" : "bg-danger")} />
                    <div className="min-w-0 flex-1">
                      <p className="font-data text-xs text-ink-200">{shortId(c.id)}</p>
                      <p className="text-xs text-ink-500">
                        {ok ? "Real human" : "Revoked"} · {c.round_count} round{c.round_count > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="font-data text-base font-medium text-ink-100">
                      {c.payload_json?.aiCollaboration?.score ?? 0}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: detail */}
        <div className="overflow-y-auto bg-ink-950 p-5 sm:p-8">
          {!sel ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-ink-400">Select a candidate to see their verified record.</p>
              <p className="max-w-sm text-xs text-ink-600">
                Each credential is signed and re-verifiable. Re-verify identity each round to catch
                proxy and seat-swap rings.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl">
              <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
                <div className="flex justify-center lg:block">
                  <CredentialCard
                    tokenId={shortId(sel.id)}
                    issuedAt={new Date(sel.issued_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    expiresAt={new Date(sel.expires_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    scores={sel.payload_json.aiCollaboration}
                    qrSeed={sel.id}
                    verifyUrl=""
                  />
                </div>

                <div className="space-y-5">
                  {/* verdict + reverify */}
                  <div>
                    <p className="eyebrow text-ink-400">Trust verdict</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-sm", sel.payload_json.humanVerified && !sel.revoked ? "bg-proof/15 text-proof" : "bg-danger-wash/15 text-danger")}>
                        <Check size={14} weight="bold" /> {sel.revoked ? "Revoked" : "Real human · verified"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startReverify}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-control bg-indigo px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-deep disabled:bg-ink-800 active:translate-y-px"
                  >
                    <ArrowsClockwise size={16} /> Re-verify identity (next round)
                  </button>

                  {reverifyResult?.crossRound && (
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-card border p-4",
                        reverifyResult.crossRound.match ? "border-proof/40 bg-proof-wash-dark/40" : "border-danger/50 bg-danger-wash/10"
                      )}
                    >
                      <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", reverifyResult.crossRound.match ? "bg-proof text-ink-950" : "bg-danger text-white")}>
                        {reverifyResult.crossRound.match ? <Check size={15} weight="bold" /> : <Warning size={15} weight="fill" />}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-ink-50">
                          {reverifyResult.crossRound.match ? "Same person across rounds" : "MISMATCH — proxy / seat-swap flagged"}
                        </p>
                        <p className="font-data text-xs text-ink-400">
                          biometric distance {reverifyResult.crossRound.distance.toFixed(3)} · {reverifyResult.crossRound.priorRounds} prior round(s)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* audit trail */}
                  <div>
                    <p className="eyebrow text-ink-400">Auditable trail · hash-chained</p>
                    <ol className="mt-3 space-y-0">
                      {audit.map((e, i) => (
                        <li key={e.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className="size-2 rounded-full bg-indigo-bright" />
                            {i < audit.length - 1 && <span className="w-px flex-1 bg-ink-700" />}
                          </div>
                          <div className="pb-4">
                            <p className="text-sm text-ink-200">{e.event_type}</p>
                            <p className="font-data text-[0.65rem] text-ink-500">
                              {new Date(e.created_at).toLocaleTimeString("en-IN", { hour12: false })} · {e.row_hash.slice(0, 16)}…
                            </p>
                          </div>
                        </li>
                      ))}
                      {audit.length === 0 && <li className="text-xs text-ink-600">no events</li>}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* re-verify overlay */}
      {reverify && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/85 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-sheet border border-ink-700 bg-ink-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-ink-100">Re-verify · Round 2</p>
              <button onClick={() => setReverify(null)} className="text-ink-400 hover:text-ink-100">
                <X size={18} />
              </button>
            </div>
            <LivenessStep
              sessionId={reverify.sessionId}
              challenge={reverify.challenge}
              spokenPhrase={reverify.spokenPhrase}
              onComplete={(r) => {
                setReverify(null);
                setReverifyResult(r);
                load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
