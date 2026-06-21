-- HireProof — real-traction metrics aggregator (BN-2).
-- Read-only over the data the app already records (audit_log timestamps every
-- session event; the ai-collab-score event carries the score + caughtPlantedError;
-- the liveness event carries the cross-round match result). Returns ONE jsonb so
-- /api/metrics is a single RPC. NOTHING here is fabricated — it is whatever real
-- sessions exist. Synthetic fraud-ring rows (BN-1) are EXCLUDED: they carry
-- issuer_did 'did:web:synthetic-demo' and never produce audit/score events, so
-- the cohort numbers below stay clean.

create or replace function hp_metrics()
returns jsonb language sql stable as $$
  with sess_time as (
    select session_id,
      extract(epoch from (
        max(created_at) filter (where event_type = 'credential-issued')
        - min(created_at) filter (where event_type like 'consent%')
      )) as secs
    from audit_log
    where session_id is not null
    group by session_id
  ),
  completed as (
    -- end-to-end runs that actually minted a credential, within a sane window
    select secs from sess_time where secs is not null and secs > 0 and secs < 3600
  ),
  scored as (
    select (output_json->>'aiCollabScore')::int as score,
           (output_json->>'caughtPlantedError')::boolean as caught
    from audit_log
    where event_type = 'ai-collab-score' and output_json ? 'aiCollabScore'
  ),
  xround as (
    select (output_json#>>'{crossRound,match}')::boolean as m
    from audit_log
    where event_type = 'liveness'
      and output_json #> '{crossRound}' is not null
      and output_json #> '{crossRound}' <> 'null'::jsonb
  )
  select jsonb_build_object(
    'verifiedCandidates', (select count(*) from credentials where coalesce(issuer_did,'') not like '%synthetic%'),
    'completedRuns',     (select count(*) from completed),
    'medianSecs',        (select round(percentile_cont(0.5) within group (order by secs))::int from completed),
    'p25Secs',           (select round(percentile_cont(0.25) within group (order by secs))::int from completed),
    'p75Secs',           (select round(percentile_cont(0.75) within group (order by secs))::int from completed),
    'scoredRuns',        (select count(*) from scored),
    'medianScore',       (select round(percentile_cont(0.5) within group (order by score))::int from scored),
    'caughtRatePct',     (select round(100.0 * avg(case when caught then 1 else 0 end))::int from scored where caught is not null),
    'scores',            (select coalesce(jsonb_agg(score order by score), '[]'::jsonb) from scored),
    'completionSecs',    (select coalesce(jsonb_agg(round(secs)::int order by secs), '[]'::jsonb) from completed),
    'crossRoundChecks',     (select count(*) from xround),
    'crossRoundMatches',    (select count(*) from xround where m is true),
    'crossRoundMismatches', (select count(*) from xround where m is false),
    'offlineVerifies',   (select count(*) from audit_log where event_type = 'credential-verified')
  );
$$;
