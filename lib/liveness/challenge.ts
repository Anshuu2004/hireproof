/**
 * Liveness challenge: a server-issued, randomised action sequence + a spoken
 * digit phrase bound to a session nonce. Because the order is generated the
 * instant the candidate starts, a static photo, a pre-recorded loop, a deepfake
 * avatar, or a late-joining proxy cannot pre-stage it.
 */

export type Language = "en";

export type LivenessAction = "blink" | "turn" | "mouth_open" | "smile";

export interface LivenessChallenge {
  nonce: string;
  actions: LivenessAction[];
  digits: number[];
  language: Language;
}

const ACTION_POOL: LivenessAction[] = ["blink", "turn", "mouth_open", "smile"];

/** Instruction copy per action. */
export const ACTION_COPY: Record<LivenessAction, Record<Language, string>> = {
  blink: { en: "Blink twice" },
  turn: { en: "Turn your head to the side" },
  mouth_open: { en: "Open your mouth" },
  smile: { en: "Smile" },
};

export const ACTION_SHORT: Record<LivenessAction, string> = {
  blink: "Blink",
  turn: "Turn head",
  mouth_open: "Open mouth",
  smile: "Smile",
};

/** Digit words for the spoken phrase. */
export const DIGIT_WORDS: Record<Language, string[]> = {
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
};

export const SPEECH_LANG: Record<Language, string> = { en: "en-IN" };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Generate a fresh challenge: 3 distinct actions + a 3-digit spoken phrase. */
export function generateChallenge(language: Language): LivenessChallenge {
  const actions = shuffle(ACTION_POOL).slice(0, 3);
  const digits = Array.from({ length: 3 }, () => Math.floor(Math.random() * 10));
  return { nonce: crypto.randomUUID(), actions, digits, language };
}

/** The phrase the candidate must read aloud, in their chosen language. */
export function spokenPhrase(challenge: Pick<LivenessChallenge, "digits" | "language">): string {
  return challenge.digits.map((d) => DIGIT_WORDS[challenge.language][d]).join(" ");
}

/**
 * Does a speech transcript contain the challenge digits, in order? Tolerant of
 * STT noise: matches numerals plus digit words. When a `language` is given we
 * scope word-matching to THAT language (numerals always count) — so the chosen
 * language is enforced and a cross-language pre-recorded clip is harder to pass.
 * Omitting `language` keeps the permissive all-language behaviour (back-compat).
 */
export function transcriptMatchesDigits(transcript: string, digits: number[], language?: Language): boolean {
  const lower = ` ${transcript.toLowerCase()} `;
  // Build, in order, the sequence of digits found by scanning for words/numerals.
  const found: number[] = [];
  const tokens = lower.split(/[\s,.-]+/).filter(Boolean);
  const wordToDigit = new Map<string, number>();
  const langs: Language[] = language ? [language] : ["en"];
  langs.forEach((lng) =>
    (DIGIT_WORDS[lng] ?? []).forEach((w, d) => wordToDigit.set(w.toLowerCase(), d))
  );
  for (const t of tokens) {
    if (/^\d$/.test(t)) found.push(Number(t));
    else if (wordToDigit.has(t)) found.push(wordToDigit.get(t)!);
  }
  // subsequence check: the challenge digits must appear in order within `found`
  let i = 0;
  for (const f of found) {
    if (f === digits[i]) i++;
    if (i === digits.length) return true;
  }
  return false;
}
