import { z } from "zod";
import { genObject } from "./gateway";

/**
 * Appropriate-reliance probe (BN-3). The single planted-error task measures only
 * the RSR dimension (reject ONE wrong suggestion). This probe measures CALIBRATED
 * reliance across several items — accept-the-correct AND override-the-wrong —
 * grounded in Schemmer et al. 2023 (Relative AI Reliance / Relative Self-Reliance).
 *
 * Honest scope: small-N, noisy per candidate — a research-GROUNDED signal, not a
 * psychometrically validated instrument. isCorrect flags are server-side only.
 */
const Panel = z.object({
  suggestions: z
    .array(
      z.object({
        claim: z.string().describe("A specific, plausible AI suggestion about the task (1-2 sentences)."),
        isCorrect: z.boolean().describe("Whether this suggestion is actually correct."),
        why: z.string().describe("One line: why it is right, or exactly what is wrong with it."),
      })
    )
    .length(4),
});

export interface PanelItem { id: number; claim: string; isCorrect: boolean; why: string }

export async function generateReliancePanel(task: {
  brief: string;
  correctApproach: string;
  plantedError: string;
}): Promise<{ items: PanelItem[]; provider: string }> {
  const { object, provider } = await genObject("fast", {
    schema: Panel,
    temperature: 0.8,
    system:
      "You generate AI-advice items to test a candidate's APPROPRIATE RELIANCE: the ability to accept correct AI suggestions AND reject incorrect ones. Produce exactly 4 short, plausible claims about the given task — exactly 2 genuinely CORRECT and 2 SUBTLY INCORRECT (wrong but believable, never absurd). Set isCorrect truthfully. Each claim must be concrete and checkable against the task.",
    prompt: `TASK BRIEF:
${task.brief}

CORRECT APPROACH (reference):
${task.correctApproach}

(A separate planted error in this task is: ${task.plantedError} — do not reuse it verbatim.)

Generate 4 AI "suggestions" about this task: exactly 2 correct, 2 subtly wrong. A careful expert accepts the 2 correct and rejects the 2 wrong; a careless one over-relies and accepts the wrong ones.`,
  });

  // light shuffle so correct/incorrect aren't positionally predictable
  const shuffled = [...object.suggestions]
    .map((s, i) => ({ s, k: (i * 7 + 3) % object.suggestions.length }))
    .sort((a, b) => a.k - b.k)
    .map(({ s }) => s);
  const items = shuffled.map((s, i) => ({ id: i, ...s }));
  return { items, provider };
}

export interface RelianceResult {
  rair: number;            // Relative AI Reliance: accept-correct rate (0-1)
  rsr: number;             // Relative Self-Reliance: reject-wrong rate (0-1)
  appropriateReliance: number; // (correct accepts + correct rejects) / total, 0-100
  correctCount: number;
  wrongCount: number;
  acceptedCorrect: number;
  rejectedWrong: number;
  total: number;
}

/** decisions[id] === true means the candidate ACCEPTED that suggestion. */
export function scoreReliance(items: PanelItem[], decisions: Record<string, boolean>): RelianceResult {
  const correct = items.filter((i) => i.isCorrect);
  const wrong = items.filter((i) => !i.isCorrect);
  const acceptedCorrect = correct.filter((i) => decisions[String(i.id)] === true).length;
  const rejectedWrong = wrong.filter((i) => decisions[String(i.id)] === false).length;
  const rair = correct.length ? acceptedCorrect / correct.length : 0;
  const rsr = wrong.length ? rejectedWrong / wrong.length : 0;
  return {
    rair: Math.round(rair * 100) / 100,
    rsr: Math.round(rsr * 100) / 100,
    appropriateReliance: Math.round(((acceptedCorrect + rejectedWrong) / Math.max(1, items.length)) * 100),
    correctCount: correct.length,
    wrongCount: wrong.length,
    acceptedCorrect,
    rejectedWrong,
    total: items.length,
  };
}
