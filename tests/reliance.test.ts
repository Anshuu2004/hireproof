import { describe, it, expect } from "vitest";
import { scoreReliance, type PanelItem } from "@/lib/ai/reliance";

/**
 * Appropriate-reliance scoring (BN-3, RAIR/RSR). scoreReliance is a pure
 * function: given which suggestions are actually correct and which the candidate
 * accepted, it computes accept-correct rate (RAIR), reject-wrong rate (RSR), and
 * the combined appropriate-reliance %. These tests pin the calibration maths so
 * an over-relier and a blanket-rejecter both score 50, and only a calibrated
 * candidate scores 100.
 */

// 2 correct (ids 0,1) + 2 wrong (ids 2,3) — the panel shape generateReliancePanel emits.
const panel: PanelItem[] = [
  { id: 0, claim: "correct A", isCorrect: true, why: "" },
  { id: 1, claim: "correct B", isCorrect: true, why: "" },
  { id: 2, claim: "wrong A", isCorrect: false, why: "" },
  { id: 3, claim: "wrong B", isCorrect: false, why: "" },
];

describe("scoreReliance", () => {
  it("scores perfect calibration 100 (accept both correct, reject both wrong)", () => {
    const r = scoreReliance(panel, { "0": true, "1": true, "2": false, "3": false });
    expect(r.rair).toBe(1);
    expect(r.rsr).toBe(1);
    expect(r.appropriateReliance).toBe(100);
    expect(r.acceptedCorrect).toBe(2);
    expect(r.rejectedWrong).toBe(2);
  });

  it("penalises over-reliance (accept everything) — RSR 0, appropriate 50", () => {
    const r = scoreReliance(panel, { "0": true, "1": true, "2": true, "3": true });
    expect(r.rair).toBe(1);
    expect(r.rsr).toBe(0);
    expect(r.appropriateReliance).toBe(50);
    expect(r.rejectedWrong).toBe(0);
  });

  it("penalises blanket self-reliance (reject everything) — RAIR 0, appropriate 50", () => {
    const r = scoreReliance(panel, { "0": false, "1": false, "2": false, "3": false });
    expect(r.rair).toBe(0);
    expect(r.rsr).toBe(1);
    expect(r.appropriateReliance).toBe(50);
    expect(r.acceptedCorrect).toBe(0);
  });

  it("handles partial / missing decisions (undecided ≠ rejected for RSR)", () => {
    const r = scoreReliance(panel, { "0": true, "2": false }); // 1 and 3 left undecided
    expect(r.rair).toBe(0.5); // accepted 1 of 2 correct
    expect(r.rsr).toBe(0.5); // rejected 1 of 2 wrong
    expect(r.appropriateReliance).toBe(50);
  });

  it("rounds RAIR/RSR to two decimals and reports counts", () => {
    const three: PanelItem[] = [
      { id: 0, claim: "", isCorrect: true, why: "" },
      { id: 1, claim: "", isCorrect: true, why: "" },
      { id: 2, claim: "", isCorrect: true, why: "" },
      { id: 3, claim: "", isCorrect: false, why: "" },
    ];
    const r = scoreReliance(three, { "0": true }); // 1 of 3 correct accepted
    expect(r.rair).toBe(0.33); // 1/3 rounded to 2dp
    expect(r.correctCount).toBe(3);
    expect(r.wrongCount).toBe(1);
    expect(r.total).toBe(4);
  });

  it("never divides by zero on an empty panel", () => {
    const r = scoreReliance([], {});
    expect(r.rair).toBe(0);
    expect(r.rsr).toBe(0);
    expect(r.appropriateReliance).toBe(0);
    expect(r.total).toBe(0);
  });
});
