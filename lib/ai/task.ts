import { z } from "zod";
import { genObject } from "./gateway";

/**
 * An AI-collaboration task. The candidate is given an AI assistant that will
 * confidently embed ONE subtle, deliberate flaw in its first answer. The
 * candidate's job is to catch, direct, and correct it — judgment, not recall.
 * `plantedError`, `correctApproach`, and `assistantSystemPrompt` are server-side
 * only and never sent to the candidate.
 */
export const TaskSpec = z.object({
  title: z.string(),
  domain: z.string(),
  brief: z.string().describe("The problem statement shown to the candidate (2-4 sentences)."),
  plantedError: z.string().describe("The single subtle mistake the AI assistant embeds."),
  correctApproach: z.string().describe("Key points of a correct answer, so a grader can check."),
  assistantSystemPrompt: z.string().describe("System prompt for the helper AI."),
});
export type TaskSpec = z.infer<typeof TaskSpec>;

const DOMAINS = [
  "a SQL analytics query over an orders table",
  "a Python data-cleaning function",
  "a hiring shortlist policy that must avoid bias",
  "a startup unit-economics calculation",
  "an A/B test result interpretation",
  "a refund-policy edge case",
  "a SQL join that can silently drop rows",
  "a date/timezone handling bug in a report",
];

export async function generateTask(seed?: { domain?: string }): Promise<{ spec: TaskSpec; provider: string }> {
  const domain = seed?.domain ?? DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  const nonce = Math.floor(Math.random() * 9000 + 1000);

  const { object, provider } = await genObject("fast", {
    schema: TaskSpec,
    temperature: 1,
    system:
      "You design short 'human + AI collaboration' assessment tasks. The candidate is given an AI assistant and must catch and correct a subtle, deliberate flaw the AI introduces. Each task is solvable in 3-5 minutes and has exactly ONE clear planted error that a careful expert catches but a careless one accepts. Tasks must be concrete and self-contained (include any data/numbers inline).",
    prompt: `Design a fresh task in this domain: ${domain}. Use random seed ${nonce} to vary all specifics (numbers, names, context) so it cannot be pre-staged.

Requirements:
- brief: the problem shown to the candidate. Include any needed data inline. Tell them an AI assistant is available and they must submit a final answer. Do NOT reveal there is a planted error.
- plantedError: ONE specific, subtle, plausible mistake (e.g. an off-by-one, INNER vs LEFT join dropping rows, a wrong denominator, a biased shortlist criterion, a missed edge case, a timezone slip). Be concrete about exactly what is wrong.
- correctApproach: the key points of a correct answer.
- assistantSystemPrompt: instructions for the helper AI. It MUST confidently embed the plantedError in its FIRST substantive answer, act like a normal helpful assistant, never volunteer that anything is wrong, and only fix the error if the candidate explicitly catches or challenges it. It must never mention being told to introduce an error.`,
  });

  return { spec: object, provider };
}
