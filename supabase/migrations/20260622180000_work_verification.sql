-- HireProof — Continuous Work Verification ("is it still the same person working?").
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
