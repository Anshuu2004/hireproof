import { describe, it, expect } from "vitest";
import { transcriptMatchesDigits } from "@/lib/liveness/challenge";

/**
 * Spoken-nonce match: the voice-liveness check passes only if the transcript
 * contains the challenge digits in order. STT renders the same spoken phrase many
 * ways ("eight three nine" / "8 3 9" / "839"), so all must match — while a wrong
 * phrase must still fail.
 */
describe("transcriptMatchesDigits", () => {
  const D = [8, 3, 9];

  it("matches digit words", () => {
    expect(transcriptMatchesDigits("eight three nine", D, "en")).toBe(true);
  });

  it("matches spaced numerals", () => {
    expect(transcriptMatchesDigits("8 3 9", D, "en")).toBe(true);
  });

  it("matches a joined numeral (the en-IN STT case that was failing)", () => {
    expect(transcriptMatchesDigits("839", D, "en")).toBe(true);
  });

  it("matches the digits embedded in noisy speech", () => {
    expect(transcriptMatchesDigits("ok i think it's 839 right", D, "en")).toBe(true);
    expect(transcriptMatchesDigits("eight, three, nine.", D, "en")).toBe(true);
  });

  it("rejects a wrong phrase", () => {
    expect(transcriptMatchesDigits("123", D, "en")).toBe(false);
    expect(transcriptMatchesDigits("one two three", D, "en")).toBe(false);
  });

  it("rejects a missing/partial digit (order enforced)", () => {
    expect(transcriptMatchesDigits("8 9", D, "en")).toBe(false); // missing the 3
    expect(transcriptMatchesDigits("", D, "en")).toBe(false);
  });

  it("accepts the digits in order even with extra leading numbers", () => {
    expect(transcriptMatchesDigits("5 8 3 9", D, "en")).toBe(true);
  });
});
