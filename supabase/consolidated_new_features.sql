-- ============================================================================
-- HireProof — Consolidated NEW-FEATURES migration (F1 + F2 + F3)
-- ============================================================================
-- One-shot bundle of the three feature migrations, for convenience:
--   • 20260622160000_bias_audit.sql        (F2 — Bias / Fairness audit)
--   • 20260622170000_digilocker.sql        (F3 — DigiLocker demo sandbox)
--   • 20260622180000_work_verification.sql (F1 — Continuous work verification)
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor and run, OR
--   psql "$DATABASE_URL" -f supabase/consolidated_new_features.sql
--
-- SAFE TO RE-RUN: every statement is idempotent (create ... if not exists /
--   add column if not exists / create or replace function). It assumes the base
--   schema (sessions, scores, credentials, employers, audit_log, bias_audit_runs)
--   from 20260620053000_init.sql already exists.
--
-- NOTE: if you use `supabase db push`, you do NOT need this file — the three
--   individual migration files in supabase/migrations/ already cover it. This is
--   only the manual one-paste convenience copy.
-- ============================================================================


-- ============================================================================
-- F2 — Bias / Fairness audit (NYC Local Law 144 four-fifths + EU AI Act)
-- ============================================================================
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


-- ============================================================================
-- F3 — DigiLocker integration (DEMO SANDBOX, real API contract)
-- ============================================================================
-- Mirrors DigiLocker's "Issued Documents" pull model: a citizen links their
-- DigiLocker, and the HireProof credential becomes a pullable Issued Document
-- (HMAC-signed pull request -> DocDetails response). This is a sandbox: NO real
-- DigiLocker/Aadhaar call, no real Aadhaar number. Production needs Meri-Pehchaan
-- / APISetu partner onboarding. The pull endpoint implements the real contract so
-- the swap to production is a config change, not a rewrite.

-- ── Linked DigiLocker handle -> credential (the "issued document" mapping) ──────
create table if not exists digilocker_links (
  id            uuid primary key default gen_random_uuid(),
  dl_handle     text not null,                       -- demo DigiLocker id (never a real Aadhaar)
  credential_id uuid references credentials(id) on delete cascade,
  consented_at  timestamptz not null default now(),
  unique (dl_handle, credential_id)
);
create index if not exists digilocker_links_handle_idx on digilocker_links (dl_handle);

-- ── Pull request log (audit of every DocDetails fetch over the contract) ────────
create table if not exists digilocker_pull_log (
  id          uuid primary key default gen_random_uuid(),
  dl_handle   text,
  doc_type    text,
  txn         text,
  ok          boolean,
  created_at  timestamptz not null default now()
);

alter table digilocker_links    enable row level security;
alter table digilocker_pull_log enable row level security;


-- ============================================================================
-- F1 — Continuous Work Verification ("is it still the same person working?")
-- ============================================================================
-- Extends the credential past the hiring moment: an employer enrolls a credential
-- on a recurring schedule; the holder periodically re-passes a 30-second liveness
-- check, and the new face descriptor is cross-round-matched against the enrolled
-- ones (reuses hp_cross_round_match). Catches the post-hire seat-swap that the
-- North-Korea-style remote-worker fraud relies on. Account-less: the holder
-- re-checks via a holder-secret-gated link; no candidate login/email.

-- ── Enrollment + schedule (one per credential per employer) ────────────────────
create table if not exists work_enrollments (
  id            uuid primary key default gen_random_uuid(),
  credential_id uuid references credentials(id) on delete cascade,
  employer_id   uuid references employers(id) on delete set null,
  interval_days int  not null default 30,
  next_due      timestamptz not null default now() + interval '30 days',
  status        text not null default 'active',     -- active | paused | revoked
  created_at    timestamptz not null default now()
);
create index if not exists work_enrollments_employer_idx on work_enrollments (employer_id);
create index if not exists work_enrollments_credential_idx on work_enrollments (credential_id);

-- ── Each recurring check result ────────────────────────────────────────────────
create table if not exists work_check_events (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid references work_enrollments(id) on delete cascade,
  credential_id uuid,
  session_id    uuid references sessions(id) on delete set null,
  result        text not null,                      -- pass | fail | mismatch
  distance      double precision,
  checked_at    timestamptz not null default now()
);
create index if not exists work_check_events_enrollment_idx on work_check_events (enrollment_id);

alter table work_enrollments  enable row level security;
alter table work_check_events enable row level security;

-- ============================================================================
-- Done. Verify quickly:
--   select count(*) from audit_demographics;        -- F2
--   select hp_bias_cohorts(60);                      -- F2 aggregator
--   select count(*) from digilocker_links;           -- F3
--   select count(*) from work_enrollments;           -- F1
-- ============================================================================
