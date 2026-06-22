import { createGateway } from "@ai-sdk/gateway";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, generateText, type ModelMessage } from "ai";
import type { z } from "zod";
import { env } from "@/lib/env";

/**
 * Resilient LLM layer. Two providers, tried in preference order with automatic
 * failover:
 *   - Claude via the Vercel AI Gateway (OIDC on Vercel / AI_GATEWAY_API_KEY local)
 *   - Google Gemini (free tier). ONE OR MORE keys are supported for rotation:
 *     GOOGLE_GENERATIVE_AI_API_KEY plus GOOGLE_GENERATIVE_AI_API_KEY_2..N (and an
 *     optional comma-separated GEMINI_API_KEYS). Keys are round-robined per call
 *     and failed over WITHIN a call, so one key's free-tier 429 doesn't break the
 *     request — the next key is tried automatically.
 *
 * Order is controlled by LLM_PRIMARY ("claude" | "gemini"). Default "claude".
 * While the Vercel card isn't added, set LLM_PRIMARY=gemini to avoid a wasted
 * failing Claude call on every request; flip back to "claude" once it's added.
 *
 * Two tiers: "fast" (randomised task generation) and "smart" (the assistant the
 * candidate is given, and the locked-rubric grader — distinct call sites).
 */
const gateway = createGateway(env.aiGatewayKey ? { apiKey: env.aiGatewayKey } : {});

export type Tier = "fast" | "smart";
export type Provider = "claude" | "gemini";

const CLAUDE: Record<Tier, string> = {
  fast: "anthropic/claude-haiku-4.5",
  smart: "anthropic/claude-sonnet-4.6",
};
const GEMINI: Record<Tier, string> = {
  fast: "gemini-2.5-flash-lite",
  smart: "gemini-2.5-flash",
};

// Disable Gemini's "thinking" budget for latency (ignored by Claude/gateway).
const GEMINI_FAST_OPTS = { providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } } };

// Abandon a hung/slow provider after this and fail over to the next, so a stalled
// provider can't block the whole request up to the 60s function limit.
const TIMEOUT_MS = 20_000;

// Every configured Gemini key: the canonical one, numbered fallbacks for
// rotation, and an optional comma-separated list. De-duplicated, order preserved.
function geminiKeys(): string[] {
  const keys: string[] = [];
  const push = (k?: string | null) => {
    if (k && k.trim()) keys.push(k.trim());
  };
  push(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  for (let i = 2; i <= 10; i++) push(process.env[`GOOGLE_GENERATIVE_AI_API_KEY_${i}`]);
  if (process.env.GEMINI_API_KEYS) for (const k of process.env.GEMINI_API_KEYS.split(",")) push(k);
  return [...new Set(keys)];
}

// One provider instance per key, cached.
const googleClients = new Map<string, ReturnType<typeof createGoogleGenerativeAI>>();
function googleFor(key: string) {
  let c = googleClients.get(key);
  if (!c) {
    c = createGoogleGenerativeAI({ apiKey: key });
    googleClients.set(key, c);
  }
  return c;
}

// Round-robin the STARTING key each call so load spreads across keys; within a
// call the remaining keys form the in-call failover order (429 -> next key).
let rotationCursor = 0;
function rotatedGeminiKeys(): string[] {
  const keys = geminiKeys();
  if (keys.length <= 1) return keys;
  const start = rotationCursor % keys.length;
  rotationCursor = (rotationCursor + 1) % keys.length;
  return [...keys.slice(start), ...keys.slice(0, start)];
}

const hasGemini = () => geminiKeys().length > 0;

// Claude via the Vercel AI Gateway is only attempted when EXPLICITLY enabled: the
// gateway returns a hard "requires a valid credit card" error otherwise, which
// would surface to candidates as "AI unavailable". Default OFF so Gemini is the
// workhorse and that error never appears. Turn it on (once a card is on file) with
// AI_GATEWAY_API_KEY or LLM_ENABLE_CLAUDE=true.
const hasClaude = () => Boolean(env.aiGatewayKey) || process.env.LLM_ENABLE_CLAUDE === "true";

function providerOrder(): Provider[] {
  const primary: Provider = process.env.LLM_PRIMARY === "gemini" ? "gemini" : "claude";
  const order: Provider[] = primary === "gemini" ? ["gemini", "claude"] : ["claude", "gemini"];
  return order.filter((p) => (p === "gemini" ? hasGemini() : hasClaude()));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Attempt { provider: Provider; model: any; gemini: boolean; }

// Ordered failover attempts for a tier: Claude once (the gateway), Gemini once
// per key (rotated). A 429/timeout/error on one attempt falls through to the next.
function attemptsFor(tier: Tier): Attempt[] {
  const out: Attempt[] = [];
  for (const p of providerOrder()) {
    if (p === "claude") {
      out.push({ provider: "claude", model: gateway(CLAUDE[tier]), gemini: false });
    } else {
      for (const key of rotatedGeminiKeys()) {
        out.push({ provider: "gemini", model: googleFor(key)(GEMINI[tier]), gemini: true });
      }
    }
  }
  return out;
}

interface TextParams {
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  // Per-call override of the failover timeout. The default (TIMEOUT_MS) suits the
  // hot candidate paths; long code-generation (the assistant) passes a larger one.
  timeoutMs?: number;
}

export async function genText(tier: Tier, params: TextParams): Promise<{ text: string; provider: Provider }> {
  const { timeoutMs, ...rest } = params;
  let lastErr: unknown;
  for (const a of attemptsFor(tier)) {
    try {
      const extra = a.gemini && tier === "fast" ? GEMINI_FAST_OPTS : {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await generateText({ model: a.model, ...(rest as any), ...extra, abortSignal: AbortSignal.timeout(timeoutMs ?? TIMEOUT_MS) });
      return { text: r.text, provider: a.provider };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("No LLM provider available");
}

interface ObjectParams<T> {
  schema: z.ZodType<T>;
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export async function genObject<T>(tier: Tier, params: ObjectParams<T>): Promise<{ object: T; provider: Provider }> {
  const { timeoutMs, maxOutputTokens, ...rest } = params;
  const opts = { ...rest, maxOutputTokens: maxOutputTokens ?? 3000 };
  let lastErr: unknown;
  for (const a of attemptsFor(tier)) {
    try {
      const extra = a.gemini && tier === "fast" ? GEMINI_FAST_OPTS : {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await generateObject({ model: a.model, ...(opts as any), ...extra, abortSignal: AbortSignal.timeout(timeoutMs ?? TIMEOUT_MS) });
      return { object: r.object as T, provider: a.provider };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("No LLM provider available");
}
