"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Vault, ShieldCheck, Warning } from "@phosphor-icons/react";
import { Wordmark } from "@/components/wordmark";

/**
 * Demo DigiLocker consent screen. Mirrors the real "an issuer wants to add a
 * document to your DigiLocker" consent step. The holder key proves the credential
 * is the candidate's own (server-side proof-of-possession in /callback).
 */
export default function DigiLockerConsentPage() {
  const router = useRouter();
  const [credentialId, setCredentialId] = useState("");
  const [state, setState] = useState("");
  const [handle, setHandle] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setCredentialId(q.get("credentialId") ?? "");
    setState(q.get("state") ?? "");
    setHandle(`demo-${Math.random().toString(36).slice(2, 8)}`);
    const stashed = window.sessionStorage.getItem("hp_dl_secret");
    if (stashed) setSecret(stashed);
  }, []);

  async function allow() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/digilocker/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId, secret, dlHandle: handle, state }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add the document");
        return;
      }
      window.sessionStorage.removeItem("hp_dl_secret");
      router.push(`/digilocker?handle=${encodeURIComponent(data.handle)}`);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-950">
      <header className="border-b border-ink-700/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-2 text-ink-100">
            <Vault size={20} className="text-proof-bright" weight="fill" />
            <span className="text-sm font-semibold">DigiLocker</span>
            <span className="rounded-full border border-amber/40 bg-amber-wash/10 px-2 py-0.5 eyebrow text-amber">
              Sandbox demo
            </span>
          </div>
          <Wordmark />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md rounded-sheet border border-ink-700 bg-ink-950 p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-bright" />
            <h1 className="text-base font-semibold text-ink-50">Add a document to your DigiLocker</h1>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-400">
            <span className="text-ink-200">HireProof</span> wants to issue this document to your DigiLocker
            account. It will appear under <span className="text-ink-200">Issued Documents</span> and can be
            verified by any employer offline.
          </p>

          <div className="mt-5 rounded-card border border-ink-700 bg-ink-900 p-4">
            <p className="eyebrow text-ink-400">Document</p>
            <p className="mt-1 text-sm font-medium text-ink-100">Verified Hiring Credential</p>
            <p className="font-data text-[0.65rem] text-ink-500">HPCRD · {credentialId.slice(0, 8) || "—"}</p>
          </div>

          <label className="mt-4 block">
            <span className="eyebrow text-ink-400">Your DigiLocker handle (demo)</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="mt-1.5 w-full rounded-control border border-ink-700 bg-ink-950 px-3 py-2 font-data text-sm text-ink-100 focus:border-indigo focus:outline-none"
            />
          </label>

          <label className="mt-3 block">
            <span className="eyebrow text-ink-400">Holder key (proves the credential is yours)</span>
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="paste the key shown when you minted"
              className="mt-1.5 w-full rounded-control border border-ink-700 bg-ink-950 px-3 py-2 font-data text-xs text-amber placeholder:text-ink-600 focus:border-indigo focus:outline-none"
            />
          </label>

          {error && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-danger">
              <Warning size={13} weight="fill" /> {error}
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-control border border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-300 transition-colors hover:border-ink-500 hover:bg-ink-900"
            >
              Deny
            </button>
            <button
              type="button"
              onClick={allow}
              disabled={busy || !credentialId || !secret}
              className="rounded-control bg-proof px-4 py-2.5 text-sm font-medium text-ink-950 transition-colors hover:bg-proof-strong disabled:bg-ink-800 disabled:text-ink-500"
            >
              {busy ? "Adding…" : "Allow"}
            </button>
          </div>

          <p className="mt-4 text-center text-[0.65rem] leading-relaxed text-ink-500">
            Sandbox that mirrors DigiLocker&apos;s real Issued-Documents flow. No real DigiLocker or Aadhaar
            call is made. Production needs Meri-Pehchaan / APISetu partner onboarding.
          </p>
        </div>
      </main>
    </div>
  );
}
