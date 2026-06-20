import { cn } from "@/lib/cn";

export type CredentialScores = { direct: number; judge: number; correct: number };

export interface CredentialCardProps {
  tokenId?: string;
  issuedAt?: string;
  expiresAt?: string;
  subject?: string;
  scores?: CredentialScores;
  verifyUrl?: string;
  className?: string;
  /** show a faux QR pattern (landing/demo) until a real one is minted */
  qrSeed?: string;
  /** a real, scannable QR data URL (set once minted) */
  qrDataUrl?: string;
}

/** Deterministic faux-QR — a 21×21 grid driven by the seed, with quiet-zone keyline. */
function FauxQR({ seed }: { seed: string }) {
  const n = 21;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    cells.push((h & 7) > 3);
  }
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  return (
    <div
      className="grid aspect-square w-full rounded-[2px] bg-paper p-[6%]"
      style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
      aria-label="HireProof verification QR (illustrative)"
    >
      {cells.map((on, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        const finder = isFinder(r, c);
        const ring =
          finder &&
          ((r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) ||
            (c >= n - 7 && (c === n - 7 || c === n - 1 || r === 0 || r === 6 || (r >= 2 && r <= 4 && c >= n - 5 && c <= n - 3))) ||
            (r >= n - 7 && (r === n - 7 || r === n - 1 || c === 0 || c === 6 || (r >= n - 5 && r <= n - 3 && c >= 2 && c <= 4))));
        const filled = finder ? ring : on;
        return <span key={i} className={filled ? "bg-ink-950" : "bg-transparent"} />;
      })}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow text-ink-300">{label}</span>
        <span className="font-data text-[0.7rem] text-ink-100">{value}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full bg-indigo-bright"
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The HireProof credential — a portrait "evidence card" (passport/banknote logic,
 * not a badge). Reused identically at mint, in the candidate wallet, on the employer
 * detail view, and on the public verify page.
 */
export function CredentialCard({
  tokenId = "HP·8F2C-49A1-7DD0",
  issuedAt = "2026-06-20 14:32 IST",
  expiresAt = "2026-12-20",
  subject = "Verified Human",
  scores = { direct: 86, judge: 91, correct: 78 },
  verifyUrl = "hireproof.app/v/8f2c49a1",
  qrSeed = "8f2c-49a1-7dd0",
  qrDataUrl,
  className,
}: CredentialCardProps) {
  return (
    <div
      className={cn(
        "relative w-full max-w-[340px] overflow-hidden rounded-doc border border-ink-700 bg-ink-900 shadow-lift",
        className
      )}
    >
      {/* guilloché-style engraved texture, ~4% opacity (security-document cue, abstracted) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 30% -10%, #fff 0 1px, transparent 1px 9px), repeating-radial-gradient(circle at 90% 120%, #fff 0 1px, transparent 1px 11px)",
        }}
      />
      <div className="relative flex flex-col gap-5 p-5">
        {/* header: token id + timestamps */}
        <div className="flex items-start justify-between border-b border-ink-700 pb-3">
          <div className="space-y-1">
            <p className="eyebrow text-ink-400">HireProof credential</p>
            <p className="font-data text-[0.7rem] text-ink-200">{tokenId}</p>
          </div>
          <div className="text-right">
            <p className="eyebrow text-ink-400">Issued</p>
            <p className="font-data text-[0.65rem] text-ink-300">{issuedAt}</p>
          </div>
        </div>

        {/* identity: amber seal + VERIFIED HUMAN */}
        <div className="flex items-center gap-3">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-wash/10 ring-1 ring-amber/50">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-amber text-ink-950">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </span>
          <div>
            <p className="text-base font-bold leading-tight tracking-[-0.01em] text-ink-50">{subject}</p>
            <p className="eyebrow text-proof">Liveness passed · Identity continuous</p>
          </div>
        </div>

        {/* AI-collaboration skill band: three judgment axes (never a vanity number) */}
        <div className="space-y-2.5">
          <p className="eyebrow text-ink-400">AI-collaboration · judgment</p>
          <ScoreBar label="Direct" value={scores.direct} />
          <ScoreBar label="Judge" value={scores.judge} />
          <ScoreBar label="Correct" value={scores.correct} />
        </div>

        {/* QR + verify url */}
        <div className="flex items-end gap-3 border-t border-ink-700 pt-4">
          <div className="w-20 shrink-0 rounded-[3px] p-[3px] ring-1 ring-proof/60">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="HireProof verification QR" className="aspect-square w-full rounded-[2px]" />
            ) : (
              <FauxQR seed={qrSeed} />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1 pb-0.5">
            <p className="eyebrow text-ink-400">Scan to verify · no login</p>
            <p className="truncate font-data text-[0.7rem] text-ink-200">{verifyUrl}</p>
            <p className="font-data text-[0.6rem] text-ink-400">exp {expiresAt} · Ed25519 · did:web</p>
          </div>
        </div>
      </div>
    </div>
  );
}
