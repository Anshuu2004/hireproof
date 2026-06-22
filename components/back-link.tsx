import Link from "next/link";

/**
 * Back-to-home pill for the dark functional surfaces (/v · /employer · etc.).
 * Robust on direct loads (e.g. a QR opens /v with no history) — always returns
 * to a known place rather than a no-op browser back. Matches the dark header pills.
 */
export function BackLink({ href = "/", label = "Back" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-full border border-ink-700 px-3 py-1 eyebrow text-ink-400 transition-colors hover:border-ink-500 hover:text-ink-200"
      aria-label={`${label} to home`}
    >
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M16 10H5M9 5L4 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}
