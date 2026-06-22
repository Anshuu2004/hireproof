import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * The one primary action primitive for the functional (dark) app surfaces.
 * Variants reproduce the established Forensic-Calm button language so the
 * visual output is unchanged — this only centralizes the previously copy-pasted
 * class strings and adds Emil Kowalski's press feedback (scale 0.97 · 150ms ease-out).
 *
 * For links/anchors (`<a>`, next/link), use `buttonClass(...)` on the element
 * so the same language applies without a polymorphic `as` prop.
 */
type Variant = "primary" | "proof" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex select-none items-center justify-center gap-2 rounded-control font-medium " +
  "transition-[transform,background-color,border-color,color] duration-150 ease-snap " +
  "active:scale-[0.97] disabled:pointer-events-none";

const VARIANTS: Record<Variant, string> = {
  // indigo = structure / primary action
  primary: "bg-indigo text-white hover:bg-indigo-deep disabled:bg-ink-800 disabled:text-ink-500",
  // proof green = the one "commit your judgment" moment (submit for scoring)
  proof: "bg-proof text-ink-950 hover:bg-proof-strong disabled:bg-ink-800 disabled:text-ink-500",
  // ghost / secondary
  ghost: "border border-ink-700 text-ink-200 hover:border-ink-500 hover:bg-ink-900 disabled:opacity-50",
  // destructive (revoke / erase)
  danger: "border border-danger/40 text-danger hover:bg-danger-wash/10 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
