"use client";

import { useEffect, useState } from "react";
import { Vault, ArrowSquareOut, SealCheck, Prohibit, FileText } from "@phosphor-icons/react";
import { Wordmark } from "@/components/wordmark";

interface Doc {
  credentialId: string;
  score: number;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
  token: string;
  verifyUrl: string;
}

const shortId = (id: string) => `HP·${id.slice(0, 4).toUpperCase()}-${id.slice(4, 8).toUpperCase()}`;

export default function DigiLockerWalletPage() {
  const [handle, setHandle] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const h = new URLSearchParams(window.location.search).get("handle") ?? "";
    setHandle(h);
    if (!h) {
      setLoaded(true);
      return;
    }
    fetch(`/api/digilocker/wallet?handle=${encodeURIComponent(h)}`)
      .then((r) => r.json())
      .then((d) => setDocs(d.docs ?? []))
      .catch(() => setDocs([]))
      .finally(() => setLoaded(true));
  }, []);

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

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">Issued Documents</h1>
        <p className="mt-1.5 text-sm text-ink-400">
          {handle ? (
            <>
              Account <span className="font-data text-ink-300">{handle}</span> — documents issued to your
              DigiLocker. Each one is independently verifiable offline via did:web.
            </>
          ) : (
            "No DigiLocker account in this session."
          )}
        </p>

        {!loaded && <p className="mt-10 font-data text-xs text-ink-500">loading wallet…</p>}

        {loaded && docs.length === 0 && (
          <div className="mt-8 rounded-card border border-ink-700/70 bg-ink-900/60 p-8 text-center">
            <FileText size={24} className="mx-auto text-ink-500" />
            <p className="mt-3 text-sm text-ink-300">No issued documents yet.</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-500">
              Mint a credential at <span className="font-data">/verify</span>, then choose “Save to
              DigiLocker”.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {docs.map((d) => (
            <div
              key={d.credentialId}
              className="flex flex-col gap-4 rounded-card border border-ink-700/70 bg-ink-900/60 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-control border border-proof/30 bg-proof/10 text-proof-bright">
                  <SealCheck size={20} weight="fill" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-50">Verified Hiring Credential</p>
                  <p className="font-data text-xs text-ink-400">
                    {shortId(d.credentialId)} · score {d.score}
                  </p>
                  <p className="font-data text-[0.65rem] text-ink-500">
                    issued {new Date(d.issuedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} · HPCRD
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {d.revoked ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-danger/40 px-2.5 py-1 eyebrow text-danger">
                    <Prohibit size={13} /> revoked
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full border border-proof/30 px-2.5 py-1 eyebrow text-proof">
                    <SealCheck size={13} /> valid
                  </span>
                )}
                <a
                  href={`/v#${d.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-control border border-ink-700 px-3 py-2 text-xs font-medium text-ink-200 transition-colors hover:border-ink-500 hover:bg-ink-900"
                >
                  <ArrowSquareOut size={14} /> Verify
                </a>
              </div>
            </div>
          ))}
        </div>

        {handle && (
          <p className="mt-6 text-[0.65rem] leading-relaxed text-ink-500">
            Sandbox view. An external DigiLocker server fetches these over the real Pull-Document contract
            (<span className="font-data">POST /api/digilocker/pull</span>, HMAC-signed) — the document it
            receives embeds the same Ed25519 credential, so it stays verifiable inside DigiLocker.
          </p>
        )}
      </main>
    </div>
  );
}
