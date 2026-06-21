-- HireProof — audit-log hardening: full-canonical-row hash + atomic append.
--
-- Fixes two real defects in the original append-only audit log:
--   (1) row_hash hashed ONLY output_json, so id / session_id / event_type /
--       timestamp / model_version sat OUTSIDE the chain and could be edited or
--       rows reordered without breaking it. The hash now covers the full row.
--   (2) The chain was built with a read-last-hash-then-insert in app code with
--       no lock, so concurrent appends could read the same tip and fork the
--       chain. The chain is now built inside a BEFORE INSERT trigger that takes
--       a transaction-scoped advisory lock and assigns a dedicated monotonic
--       `seq`, so appends are serialized and ordering is unambiguous.
--
-- Existing rows are re-chained under the new scheme so verify_audit_chain()
-- passes end-to-end. Safe to run while older app code is still deployed: the
-- trigger overrides whatever prev_hash/row_hash the app sends.

-- ── Monotonic chain position, independent of the bigserial id ─────────────────
create sequence if not exists audit_log_seq;
alter table audit_log add column if not exists seq bigint;

-- ── Canonical row hash — the single definition used by the trigger, the
--    backfill, and the verifier, so they can never drift apart. ──────────────
create or replace function audit_row_hash(
  p_prev    text,
  p_seq     bigint,
  p_id      bigint,
  p_session uuid,
  p_event   text,
  p_input   text,
  p_output  jsonb,
  p_model   text,
  p_prompt  text,
  p_created timestamptz
) returns text
language sql immutable as $$
  select encode(
    digest(
      p_prev || '|' || concat_ws('|',
        p_seq::text,
        p_id::text,
        coalesce(p_session::text, ''),
        p_event,
        coalesce(p_input, ''),
        coalesce(p_output::text, 'null'),
        coalesce(p_model, ''),
        coalesce(p_prompt, ''),
        to_char(p_created at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- ── Re-chain any rows that already exist, deterministically by id ─────────────
do $$
declare
  r       record;
  v_prev  text   := 'GENESIS';
  v_seq   bigint := 0;
  v_hash  text;
begin
  for r in select * from audit_log order by id asc loop
    v_seq  := v_seq + 1;
    v_hash := audit_row_hash(v_prev, v_seq, r.id, r.session_id, r.event_type,
                             r.input_hash, r.output_json, r.model_version,
                             r.prompt_version, r.created_at);
    update audit_log
       set seq = v_seq, prev_hash = v_prev, row_hash = v_hash
     where id = r.id;
    v_prev := v_hash;
  end loop;
  perform setval('audit_log_seq', greatest(v_seq, 1));
end $$;

create unique index if not exists audit_log_seq_idx on audit_log(seq);

-- ── The trigger that chains every new row atomically ──────────────────────────
create or replace function audit_log_chain() returns trigger
language plpgsql as $$
declare
  v_prev text;
  v_seq  bigint;
begin
  -- Serialize all appends for the lifetime of the transaction so two inserts
  -- cannot read the same tip and fork the chain. Constant key = the audit log.
  perform pg_advisory_xact_lock(872349123);

  v_seq := nextval('audit_log_seq');

  select row_hash into v_prev from audit_log order by seq desc limit 1;
  if v_prev is null then
    v_prev := 'GENESIS';
  end if;

  new.seq       := v_seq;
  new.prev_hash := v_prev;
  new.row_hash  := audit_row_hash(v_prev, v_seq, new.id, new.session_id,
                                  new.event_type, new.input_hash, new.output_json,
                                  new.model_version, new.prompt_version, new.created_at);
  return new;
end $$;

drop trigger if exists audit_log_chain_trg on audit_log;
create trigger audit_log_chain_trg
  before insert on audit_log
  for each row execute function audit_log_chain();

-- ── Integrity verifier: recomputes the whole chain and reports the first break ─
create or replace function verify_audit_chain()
returns table(ok boolean, broken_at_seq bigint, total bigint)
language plpgsql as $$
declare
  r         record;
  v_prev    text   := 'GENESIS';
  v_expect  text;
  v_total   bigint := 0;
  v_break   bigint := null;
begin
  for r in select * from audit_log order by seq asc loop
    v_total  := v_total + 1;
    v_expect := audit_row_hash(v_prev, r.seq, r.id, r.session_id, r.event_type,
                               r.input_hash, r.output_json, r.model_version,
                               r.prompt_version, r.created_at);
    if (r.prev_hash is distinct from v_prev or r.row_hash is distinct from v_expect)
       and v_break is null then
      v_break := r.seq;
    end if;
    v_prev := r.row_hash;
  end loop;
  return query select (v_break is null), v_break, v_total;
end $$;
