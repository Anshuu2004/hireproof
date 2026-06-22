-- Performance: index the hot foreign-key filters that were doing sequential scans.
-- These grow with TOTAL rows (not just the current session), so they become latency
-- cliffs as the pilot grows. All non-destructive (IF NOT EXISTS); safe to re-run.

-- scanned on EVERY /assistant (count + order by turn_no) and /score (read transcript)
create index if not exists ai_transcript_turns_task_idx on ai_transcript_turns (ai_task_id, turn_no);

-- read by /mint, /score, /reliance
create index if not exists scores_session_idx on scores (session_id, created_at desc);

-- read by the employer audit view; hp_metrics() groups by session_id and filters event_type
create index if not exists audit_log_session_idx on audit_log (session_id, id);
create index if not exists audit_log_event_idx on audit_log (event_type);

-- written/read by /liveness, /mint, /erase
create index if not exists face_descriptors_session_idx on face_descriptors (session_id);

-- FK lookups by session
create index if not exists credentials_session_idx on credentials (session_id);

-- written by /credential-status on every public verification
create index if not exists verifications_credential_idx on verifications (credential_id);
