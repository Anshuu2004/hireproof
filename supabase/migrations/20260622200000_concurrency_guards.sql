-- Concurrency guards (backstop the app-level atomic claim in /api/score).
--
-- Two races existed: (1) two concurrent POST /api/score could both grade and
-- INSERT a scores row (double charge + duplicate/conflicting score for one
-- session); (2) concurrent POST /api/assistant could derive the same turn_no and
-- scramble transcript order — which matters because the verbatim-copy hard-cap in
-- the grader reads the FIRST assistant turn. The app now claims the session
-- atomically before grading; these unique indexes enforce the same invariants in
-- Postgres so the guarantee holds even under direct API abuse.
--
-- Existing duplicates are removed FIRST (keeping the newest row) so the unique
-- indexes can be created on already-clean data and this migration cannot fail.

-- 1. At most one score row per session ------------------------------------------
delete from public.scores a
using public.scores b
where a.session_id = b.session_id
  and a.session_id is not null
  and (a.created_at < b.created_at
       or (a.created_at = b.created_at and a.ctid < b.ctid));

create unique index if not exists scores_session_id_key
  on public.scores (session_id)
  where session_id is not null;

-- 2. Unique transcript turn per task --------------------------------------------
delete from public.ai_transcript_turns a
using public.ai_transcript_turns b
where a.ai_task_id = b.ai_task_id
  and a.turn_no = b.turn_no
  and a.ctid < b.ctid;

create unique index if not exists ai_transcript_turns_task_turn_key
  on public.ai_transcript_turns (ai_task_id, turn_no);
