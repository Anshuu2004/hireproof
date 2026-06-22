-- HireProof — Bias / Fairness audit (NYC Local Law 144 four-fifths + EU AI Act).
-- An AI hiring tool is a "high-risk" / AEDT system: it must be auditable for
-- adverse impact. This adds the data + the read-only aggregator behind the audit.
--
-- PRIVACY: demographics are OPT-IN, stored DECOUPLED from scoring (a separate
-- table, behind a separate consent flag), and used ONLY in aggregate. The scoring
-- path (lib/ai/scorer.ts, /api/score) never reads this table. Output is suppressed
-- below a minimum cell size (k-anonymity) by the API layer — no individual rows.

-- ── Opt-in self-declared demographics (aggregate-only; never affects a score) ───
create table if not exists audit_demographics (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references sessions(id) on delete cascade,
  gender      text,    -- female | male | nonbinary | undisclosed
  age_band    text,    -- 18-24 | 25-34 | 35-44 | 45-54 | 55+ | undisclosed
  region      text,    -- north | south | east | west | undisclosed
  category    text,    -- general | obc | sc | st | ews | undisclosed
  consented   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists audit_demographics_session_idx on audit_demographics (session_id);
alter table audit_demographics enable row level security;

-- ── Extend the (already-present) bias_audit_runs with the signed report fields ─
alter table bias_audit_runs add column if not exists report_json    jsonb;
alter table bias_audit_runs add column if not exists certificate_jws text;   -- Ed25519, did:web-verifiable
alter table bias_audit_runs add column if not exists pass_threshold  int default 60;

-- ── Read-only cohort aggregator. Returns grouped counts ONLY; the API computes
--    selection rates, the four-fifths impact ratio, and applies cell suppression.
--    `selected` = candidates at/above the pass threshold (the "selection" event).
create or replace function hp_bias_cohorts(p_pass_threshold int default 60)
returns table(dimension text, grp text, total bigint, selected bigint)
language sql stable as $$
  with base as (
    -- one (latest) score per session, joined to opt-in demographics
    select distinct on (s.id)
      s.id as session_id,
      s.language,
      sco.ai_collab_score as score,
      d.gender, d.age_band, d.region, d.category
    from sessions s
    join scores sco on sco.session_id = s.id
    left join audit_demographics d on d.session_id = s.id and d.consented = true
    where sco.ai_collab_score is not null
    order by s.id, sco.created_at desc
  )
  select 'gender'::text, b.gender, count(*), count(*) filter (where b.score >= p_pass_threshold)
    from base b where b.gender is not null group by b.gender
  union all
  select 'age_band', b.age_band, count(*), count(*) filter (where b.score >= p_pass_threshold)
    from base b where b.age_band is not null group by b.age_band
  union all
  select 'region', b.region, count(*), count(*) filter (where b.score >= p_pass_threshold)
    from base b where b.region is not null group by b.region
  union all
  select 'category', b.category, count(*), count(*) filter (where b.score >= p_pass_threshold)
    from base b where b.category is not null group by b.category
  union all
  -- proxy cohort: UI language (always available, no new PII)
  select 'language', b.language, count(*), count(*) filter (where b.score >= p_pass_threshold)
    from base b group by b.language;
$$;
