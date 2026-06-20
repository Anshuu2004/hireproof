import { cn } from "@/lib/cn";

/**
 * HireProof wordmark — a tamper-evident mark, not a logo with sparkle.
 * The seal glyph is a notch-cut square (evidence/▢ form), never a shield or padlock.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <span className="relative grid h-6 w-6 place-items-center rounded-[6px] border border-ink-300/60 bg-ink-900">
        <span className="block h-2 w-2 rotate-45 border border-ink-200/80" />
      </span>
      <span className="text-[0.95rem] font-semibold tracking-[-0.01em] text-ink-50">
        Hire<span className="text-ink-300">Proof</span>
      </span>
    </span>
  );
}
