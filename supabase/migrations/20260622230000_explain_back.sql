-- HireProof — oral "explain-back" integrity challenge (additive only).
--   scores.explain_json : the post-task spoken-explanation grading — how well the
--     candidate's live, time-boxed verbal explanation matches their OWN submitted
--     answer, and whether they can articulate the core idea in their own words.
--   This binds the WORK to the verified (live) person without proctoring the task.
alter table scores add column if not exists explain_json jsonb;
