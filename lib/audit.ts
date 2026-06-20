import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Append a row to the tamper-evident, hash-chained audit log.
 * row_hash = sha256(prev_hash | canonical(output)). Any later edit to a row
 * breaks every subsequent hash — this is both the explainability trail
 * (DPDP / EU AI Act) and the "why this score" evidence source.
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
  const canonical = JSON.stringify(params.output ?? null);
  const rowHash = createHash("sha256").update(`${prevHash}|${canonical}`).digest("hex");

  await sb.from("audit_log").insert({
    session_id: params.sessionId ?? null,
    event_type: params.eventType,
    input_hash: params.inputHash ?? null,
    output_json: params.output ?? null,
    model_version: params.modelVersion ?? null,
    prompt_version: params.promptVersion ?? null,
    prev_hash: prevHash,
    row_hash: rowHash,
  });

  return rowHash;
}
