import { z } from "zod";
import { genObject } from "./gateway";
import type { TaskSpec } from "./task";

export interface Turn {
  role: "candidate" | "assistant";
  content: string;
}

/** Cheap text similarity (token Jaccard) to detect "shipped the AI's answer verbatim". */
function similarity(a: string, b: string): number {
  const tok = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const A = tok(a);
  const B = tok(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface DeterministicSignals {
  candidateTurns: number;
  firstAiAnswer: string;
  acceptedVerbatim: boolean;
  finalSimilarityToAi: number;
  divergedFromAi: boolean;
}

/** Process signals computed in code (no LLM) — anchors the score against a chatty grader. */
export function deterministicSignals(turns: Turn[], finalAnswer: string): DeterministicSignals {
  const candidateTurns = turns.filter((t) => t.role === "candidate").length;
  const firstAi = turns.find((t) => t.role === "assistant")?.content ?? "";
  const sim = similarity(finalAnswer, firstAi);
  return {
    candidateTurns,
    firstAiAnswer: firstAi.slice(0, 400),
    acceptedVerbatim: sim > 0.82,
    finalSimilarityToAi: Math.round(sim * 100) / 100,
    divergedFromAi: sim < 0.6,
  };
}

const Rubric = z.object({
  caughtPlantedError: z.boolean().describe("Did the candidate detect and address the specific planted error?"),
  error_detection: z.number().int().min(0).max(5),
  direction_quality: z.number().int().min(0).max(5),
  verification: z.number().int().min(0).max(5),
  iteration: z.number().int().min(0).max(5),
  final_correctness: z.number().int().min(0).max(5),
  justifications: z.object({
    error_detection: z.string(),
    direction_quality: z.string(),
    verification: z.string(),
    iteration: z.string(),
    final_correctness: z.string(),
  }),
});
export type Rubric = z.infer<typeof Rubric>;

const WEIGHTS: Record<keyof Pick<Rubric, "error_detection" | "direction_quality" | "verification" | "iteration" | "final_correctness">, number> = {
  error_detection: 0.3,
  final_correctness: 0.25,
  direction_quality: 0.2,
  verification: 0.15,
  iteration: 0.1,
};

export interface ScoreResult {
  rubric: Rubric;
  signals: DeterministicSignals;
  aiCollabScore: number;
  bands: { direct: number; judge: number; correct: number };
  provider: string;
  capped: boolean;
}

/**
 * Score the transcript. EU-AI-Act-safe: grades task judgment/output ONLY —
 * never tone, confidence, personality, or affect. The deterministic
 * accepted-verbatim flag hard-caps the score, because shipping the AI's wrong
 * answer is the exact failure mode we test.
 */
export async function scoreTranscript(
  task: Pick<TaskSpec, "brief" | "plantedError" | "correctApproach">,
  turns: Turn[],
  finalAnswer: string
): Promise<ScoreResult> {
  const signals = deterministicSignals(turns, finalAnswer);
  const transcript = turns.map((t) => `${t.role.toUpperCase()}: ${t.content}`).join("\n\n");

  const { object: rubric, provider } = await genObject("smart", {
    schema: Rubric,
    temperature: 0,
    system:
      "You are a strict, fair grader of AI-collaboration JUDGMENT. You score ONLY the candidate's task reasoning and output: did they catch the AI's mistake, direct it well, verify, iterate, and deliver a correct result. You MUST NOT consider tone, confidence, enthusiasm, personality, accent, or 'cultural fit' — scoring those is prohibited. Every justification must quote the transcript. Be conservative: if the candidate accepted the AI's flawed answer, error_detection and final_correctness must be low.",
    prompt: `TASK BRIEF (shown to candidate):
${task.brief}

PLANTED ERROR (hidden from candidate — the AI embedded this):
${task.plantedError}

CORRECT APPROACH (reference):
${task.correctApproach}

FULL TRANSCRIPT:
${transcript}

CANDIDATE'S FINAL ANSWER:
${finalAnswer}

Score each dimension 0-5 (5 = excellent), set caughtPlantedError, and give a one-line justification per dimension that quotes the transcript.`,
  });

  let score =
    100 *
    (rubric.error_detection / 5 * WEIGHTS.error_detection +
      rubric.final_correctness / 5 * WEIGHTS.final_correctness +
      rubric.direction_quality / 5 * WEIGHTS.direction_quality +
      rubric.verification / 5 * WEIGHTS.verification +
      rubric.iteration / 5 * WEIGHTS.iteration);

  // Hard cap: shipping the AI's answer unchanged is the failure we test for.
  const capped = signals.acceptedVerbatim && !rubric.caughtPlantedError;
  if (capped) score = Math.min(score, 40);

  return {
    rubric,
    signals,
    aiCollabScore: Math.round(score),
    bands: {
      direct: Math.round((rubric.direction_quality / 5) * 100),
      judge: Math.round((rubric.error_detection / 5) * 100),
      correct: Math.round((rubric.final_correctness / 5) * 100),
    },
    provider,
    capped,
  };
}
