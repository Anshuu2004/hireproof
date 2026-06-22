import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { auditRowHash } from "@/lib/audit-hash";

/**
 * Append a row to the hash-chained audit log — the explainability trail
 * (DPDP / EU AI Act) and the "why this score" evidence source.
 *
 * Two layers, so this is correct with OR without the DB migration applied:
 *
 *  1. App layer (here): the hash covers the FULL set of application fields
 *     (session_id, event_type, input_hash, output, model/prompt version, and an
 *     explicit created_at) — not just `output` as the original code did. Editing
 *     any of those fields now breaks the chain. This fixes the output-only
 *     defect immediately, with no database change required.
 *
 *  2. DB layer (migration 20260621120000_audit_chain_hardening.sql): a
 *     BEFORE INSERT trigger SUPERSEDES the app-computed values, recomputing the
 *     chain server-side over the full canonical row INCLUDING the db-assigned id
 *     and a monotonic `seq`, under a transaction-scoped advisory lock — which
 *     also removes the read-then-insert race the app layer alone can't. When the
 *     migration is applied, `select * from verify_audit_chain()` re-checks
 *     integrity end to end.
 *
 * Net: deploying the app before the migration is safe (full-field app hash);
 * after the migration the stronger atomic full-row hash takes over.
 */
export async function appendAudit(params: {
  sessionId?: string | null;
  eventType: string;
  output: unknown;
  inputHash?: string | null;
  modelVersion?: string | null;
  promptVersion?: string | null;
}): Promise<string> {
  const sb = supabaseAdmin();

  const { data: last } = await sb
    .from("audit_log")
    .select("row_hash")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevHash = last?.row_hash ?? "GENESIS";
  const createdAt = new Date().toISOString();

  // Canonical hash over every persisted application field, in a fixed order
  // (see lib/audit-hash.ts — shared with the unit tests). NOTE: the Postgres
  // trigger uses a DIFFERENT, stronger canonicalisation (it also folds in the
  // db-assigned id + a monotonic seq and a microsecond timestamp) and OVERRIDES
  // this value on insert — the two are intentionally NOT identical. We read back
  // whichever hash was actually stored (see docs/adr/0004-audit-hash-chain.md).
  const rowHash = auditRowHash(prevHash, params, createdAt);

  // Insert with the app-computed chain. If the DB trigger is present it will
  // override prev_hash / row_hash (and set seq) atomically; we read back
  // whichever value was actually stored.
  const { data, error } = await sb
    .from("audit_log")
    .insert({
      session_id: params.sessionId ?? null,
      event_type: params.eventType,
      input_hash: params.inputHash ?? null,
      output_json: params.output ?? null,
      model_version: params.modelVersion ?? null,
      prompt_version: params.promptVersion ?? null,
      created_at: createdAt,
      prev_hash: prevHash,
      row_hash: rowHash,
    })
    .select("row_hash")
    .single();

  if (error) throw error;
  return (data?.row_hash as string) ?? rowHash;
}

/**
 * Schedule an audit append to run AFTER the HTTP response is sent. On Vercel,
 * `after()` keeps the invocation alive to flush it, so the hash-chain insert +
 * its advisory lock never sit on user-facing latency. Fire-and-forget; logged on error.
 * The audit row is append-only evidence — the client's response never depends on it.
 */
export function deferAudit(params: Parameters<typeof appendAudit>[0]): void {
  after(() => appendAudit(params).catch((e) => console.error("[audit] deferred append failed", e)));
}
