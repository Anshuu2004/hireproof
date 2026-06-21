-- HireProof — hardening follow-ups (market-research-driven).
--   1. Durable, auditable score explanation: persist the full grader rubric
--      (per-axis justifications that quote the transcript + caughtPlantedError)
--      so the "why this score" is not lost after the API response.
--   2. Employer governance scoping: an employer claims governance of a candidate
--      when they revoke or re-verify them; once governed, that candidate's
--      credential + audit trail is scoped to the governing employer (others
--      cannot enumerate it). Ungoverned credentials remain the open,
--      candidate-owned roster any authenticated employer may pick up.

-- 1. Persist the rubric (justifications + flags) ----------------------------
alter table scores add column if not exists rubric_json jsonb;

-- 2. Governance scoping -----------------------------------------------------
alter table credentials
  add column if not exists governed_by uuid references employers(id) on delete set null;
create index if not exists credentials_governed_by_idx on credentials (governed_by);
