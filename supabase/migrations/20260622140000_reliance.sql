-- HireProof — appropriate-reliance probe (BN-3). Additive only.
--   ai_tasks.reliance_json : the generated 4-item panel WITH server-side
--     isCorrect flags (never sent to the candidate).
--   scores.reliance_json   : the candidate's RAIR/RSR result for the session.
alter table ai_tasks add column if not exists reliance_json jsonb;
alter table scores   add column if not exists reliance_json jsonb;
