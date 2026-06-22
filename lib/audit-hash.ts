import { createHash } from "crypto";

/**
 * Pure, dependency-free core of the hash-chained audit log.
 *
 * Extracted from lib/audit.ts so the chain logic is unit-testable WITHOUT
 * pulling in next/server or the Supabase client. lib/audit.ts (app layer) and
 * the Postgres BEFORE-INSERT trigger (DB layer) must stay byte-identical to
 * this canonicalisation, or `verify_audit_chain()` would disagree with the app.
 *
 * The hash covers the FULL set of persisted application fields in a fixed
 * order (not just `output`), so editing any field — or the timestamp — breaks
 * the chain. Each row also folds in the previous row's hash, so reordering or
 * deleting a row breaks every row after it.
 */
export interface AuditRowFields {
  sessionId?: string | null;
  eventType: string;
  output: unknown;
  inputHash?: string | null;
  modelVersion?: string | null;
  promptVersion?: string | null;
}

/** The fixed-order canonical string a row's hash is computed over. */
export function auditCanonical(fields: AuditRowFields, createdAt: string): string {
  return [
    fields.sessionId ?? "",
    fields.eventType,
    fields.inputHash ?? "",
    JSON.stringify(fields.output ?? null),
    fields.modelVersion ?? "",
    fields.promptVersion ?? "",
    createdAt,
  ].join("|");
}

/**
 * Chain hash for one row: sha256(prevHash | canonical(row)). The genesis row
 * uses prevHash = "GENESIS".
 */
export function auditRowHash(prevHash: string, fields: AuditRowFields, createdAt: string): string {
  return createHash("sha256").update(`${prevHash}|${auditCanonical(fields, createdAt)}`).digest("hex");
}
