/**
 * Canonical short credential id, e.g. "HP·3A7E-0000".
 * Single source of truth — was previously re-implemented inline in
 * employer/page.tsx, v/page.tsx, mint-step.tsx and api/rings/route.ts.
 */
export function shortId(id: string): string {
  return `HP·${id.slice(0, 4).toUpperCase()}-${id.slice(4, 8).toUpperCase()}`;
}
