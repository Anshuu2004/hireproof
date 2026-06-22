import { describe, it, expect } from "vitest";
import { auditRowHash, auditCanonical, type AuditRowFields } from "@/lib/audit-hash";

/**
 * Hash-chained audit log — the explainability trail (DPDP / EU AI Act) and the
 * "why this score" evidence. The chain's whole value is tamper-evidence: editing
 * ANY persisted field, the timestamp, or the row order must change the hash.
 * These pin the canonicalisation the app layer and the Postgres trigger must
 * agree on byte-for-byte.
 */

const TS = "2026-06-22T00:00:00.000Z";
const base: AuditRowFields = {
  sessionId: "sess-1",
  eventType: "score",
  output: { score: 67 },
  inputHash: "ih-1",
  modelVersion: "claude-haiku-4.5",
  promptVersion: "v3",
};

describe("auditRowHash", () => {
  it("is a deterministic 64-char hex digest", () => {
    const h = auditRowHash("GENESIS", base, TS);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(auditRowHash("GENESIS", base, TS)).toBe(h);
  });

  it("chains: changing the previous hash changes this row's hash", () => {
    const genesis = auditRowHash("GENESIS", base, TS);
    const linked = auditRowHash(genesis, base, TS);
    expect(linked).not.toBe(genesis);
    // reordering (different prev) yields a different hash → row order is bound in
    expect(auditRowHash("SOME-OTHER-PREV", base, TS)).not.toBe(genesis);
  });

  it("is tamper-evident on every persisted field", () => {
    const h = auditRowHash("GENESIS", base, TS);
    const mutations: AuditRowFields[] = [
      { ...base, sessionId: "sess-2" },
      { ...base, eventType: "mint" },
      { ...base, inputHash: "ih-2" },
      { ...base, output: { score: 99 } },
      { ...base, modelVersion: "gemini-2.5-flash" },
      { ...base, promptVersion: "v4" },
    ];
    for (const m of mutations) {
      expect(auditRowHash("GENESIS", m, TS)).not.toBe(h);
    }
    // editing the timestamp also breaks the chain
    expect(auditRowHash("GENESIS", base, "2026-06-22T00:00:01.000Z")).not.toBe(h);
  });

  it("does not let field values be ambiguously swapped across columns", () => {
    const a = auditRowHash("G", { ...base, sessionId: "x", eventType: "y" }, TS);
    const b = auditRowHash("G", { ...base, sessionId: "y", eventType: "x" }, TS);
    expect(a).not.toBe(b);
  });

  it("canonicalises null/undefined fields consistently", () => {
    expect(auditCanonical({ eventType: "e", output: null }, TS)).toBe(["", "e", "", "null", "", "", TS].join("|"));
    // undefined output and explicit null output hash the same (both → "null")
    expect(auditRowHash("G", { eventType: "e", output: undefined }, TS)).toBe(
      auditRowHash("G", { eventType: "e", output: null }, TS)
    );
  });
});
