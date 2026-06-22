import { createGateway } from "@ai-sdk/gateway";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, generateText, type ModelMessage } from "ai";
import type { z } from "zod";
import { env } from "@/lib/env";

/**
 * Resilient LLM layer. Two providers, tried in preference order with automatic
 * failover:
 *   - Claude via the Vercel AI Gateway (OIDC on Vercel / AI_GATEWAY_API_KEY local)
 *   - Google Gemini (free tier) when GOOGLE_GENERATIVE_AI_API_KEY is set
 *
 * Order is controlled by LLM_PRIMARY ("claude" | "gemini"). Default "claude".
 * While the Vercel card isn't added, set LLM_PRIMARY=gemini to avoid a wasted
 * failing Claude call on every request; flip back to "claude" once it's added.
 *
 * Two tiers: "fast" (randomised task generation) and "smart" (the assistant the
 * candidate is given, and the locked-rubric grader — distinct call sites).
 */
const gateway = createGateway(env.aiGatewayKey ? { apiKey: env.aiGatewayKey } : {});
const google = createGoogleGenerativeAI({});

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

const hasGemini = () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

function providerOrder(): Provider[] {
  const primary: Provider = process.env.LLM_PRIMARY === "gemini" ? "gemini" : "claude";
  const order: Provider[] = primary === "gemini" ? ["gemini", "claude"] : ["claude", "gemini"];
  return order.filter((p) => (p === "gemini" ? hasGemini() : true));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function modelFor(p: Provider, tier: Tier): any {
  return p === "claude" ? gateway(CLAUDE[tier]) : google(GEMINI[tier]);
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
  for (const p of providerOrder()) {
    try {
      const extra = p === "gemini" && tier === "fast" ? GEMINI_FAST_OPTS : {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await generateText({ model: modelFor(p, tier), ...(rest as any), ...extra, abortSignal: AbortSignal.timeout(timeoutMs ?? TIMEOUT_MS) });
      return { text: r.text, provider: p };
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
}

export async function genObject<T>(tier: Tier, params: ObjectParams<T>): Promise<{ object: T; provider: Provider }> {
  const opts = {
    schema: params.schema,
    system: params.system,
    prompt: params.prompt,
    messages: params.messages,
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens ?? 3000,
  };
  let lastErr: unknown;
  for (const p of providerOrder()) {
    try {
      const extra = p === "gemini" && tier === "fast" ? GEMINI_FAST_OPTS : {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await generateObject({ model: modelFor(p, tier), ...(opts as any), ...extra, abortSignal: AbortSignal.timeout(TIMEOUT_MS) });
      return { object: r.object as T, provider: p };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("No LLM provider available");
}
