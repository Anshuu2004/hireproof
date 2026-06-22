-- HireProof — initial schema
-- Data model per PLAN.md §4.3. All biometric storage is minimised:
-- raw video never lands here; we keep a 128-D descriptor (for cross-round match),
-- a salted hash in the credential, and only derived signals + audit rows.
-- DPDP-aware: candidates are account-less; erasure = revoke + delete descriptor.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ── Employers (the only authenticated actor; backed by Supabase Auth) ──────────
create table if not exists employers (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                       -- maps to auth.users.id
  email        text,
  org_name     text,
  created_at   timestamptz not null default now()
);

-- ── Verification session ──────────────────────────────────────────────────────
create table if not exists sessions (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  language           text not null default 'en',          -- en
  consent_json       jsonb,                                -- itemised DPDP consent receipt
  nonce              text not null,                        -- server-issued, binds the live challenge
  task_seed_json     jsonb,                                -- liveness action order + spoken sentence
  liveness_verdict   text,                                 -- pass | fail | pending
  liveness_proof_json jsonb,                               -- actions + timestamps from the client
  spoken_transcript  text,
  round_no           int not null default 1,
  credential_id      uuid,                                 -- set once a credential exists (re-verify rounds)
  status             text not null default 'created'       -- created|live_passed|scored|issued|flagged
);

-- ── Account-less candidate holder (identity lives in the token, not a login) ───
create table if not exists candidates (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid references sessions(id) on delete cascade,
  holder_secret_hash text,                                 -- proves token ownership, never the secret itself
  created_at         timestamptz not null default now()
);

-- ── Face descriptors for cross-round biometric continuity (pgvector) ──────────
create table if not exists face_descriptors (
  id            uuid primary key default gen_random_uuid(),
  credential_id uuid,
  session_id    uuid references sessions(id) on delete cascade,
  embedding     vector(128) not null,                      -- L2-normalised face-api/human descriptor
  round_no      int not null default 1,
  created_at    timestamptz not null default now()
);
create index if not exists face_descriptors_embedding_idx
  on face_descriptors using hnsw (embedding vector_cosine_ops);
create index if not exists face_descriptors_credential_idx
  on face_descriptors (credential_id);

-- ── AI-collaboration task (the planted-error problem the candidate must catch) ─
create table if not exists ai_tasks (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid references sessions(id) on delete cascade,
  task_type         text not null,                         -- sql | code | summary | analysis
  prompt_seed       jsonb,                                 -- the randomised parameters
  brief             text,                                  -- what the candidate sees
  planted_error_desc text,                                 -- the deliberate flaw the AI is steered toward
  created_at        timestamptz not null default now()
);

-- ── Turn-by-turn transcript = raw material for judgment scoring ────────────────
create table if not exists ai_transcript_turns (
  id          uuid primary key default gen_random_uuid(),
  ai_task_id  uuid references ai_tasks(id) on delete cascade,
  turn_no     int not null,
  role        text not null,                               -- candidate | assistant | system
  content     text not null,
  accepted    boolean,                                     -- did the candidate accept this AI output?
  edit_diff   text,                                        -- candidate's correction, if any
  created_at  timestamptz not null default now()
);

-- ── Scores (judgment/output only — NEVER affect; EU AI Act Art 5(1)(f)) ────────
create table if not exists scores (
  id                       uuid primary key default gen_random_uuid(),
  session_id               uuid references sessions(id) on delete cascade,
  error_detection          int,                            -- 0..5 sub-scores
  direction_quality        int,
  verification             int,
  iteration                int,
  final_correctness        int,
  deterministic_signals_json jsonb,                        -- planted_error_caught, accepted_verbatim, etc.
  ai_collab_score          int,                            -- 0..100 fused
  model_version            text,
  prompt_version           text,
  created_at               timestamptz not null default now()
);

-- ── The issued credential (Ed25519-signed, candidate-owned) ───────────────────
create table if not exists credentials (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references sessions(id) on delete cascade,
  payload_json jsonb not null,                             -- W3C VC 2.0-shaped subject claims
  signature    text not null,                              -- compact JWS / detached Ed25519 sig
  issuer_did   text not null,                              -- did:web:hireproof...
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz,
  revoked      boolean not null default false,
  round_count  int not null default 1
);
alter table sessions
  add constraint sessions_credential_fk
  foreign key (credential_id) references credentials(id) on delete set null
  not valid;

-- ── Employer verifications (audit of who checked what) ────────────────────────
create table if not exists verifications (
  id               uuid primary key default gen_random_uuid(),
  credential_id    uuid references credentials(id) on delete cascade,
  employer_id      uuid references employers(id) on delete set null,
  verified_at      timestamptz not null default now(),
  signature_valid  boolean,
  cross_round_status text                                  -- match | mismatch | first-round | n/a
);

-- ── Append-only, hash-chained audit log (explainability + DPDP/EU-AI-Act trail) ─
create table if not exists audit_log (
  id             bigserial primary key,
  session_id     uuid references sessions(id) on delete set null,
  event_type     text not null,                            -- consent|challenge|capture|score|issue|verify|revoke
  input_hash     text,
  output_json    jsonb,
  model_version  text,
  prompt_version text,
  prev_hash      text,                                     -- previous row's row_hash
  row_hash       text,                                     -- sha256(prev_hash || canonical(output))
  created_at     timestamptz not null default now()
);

-- ── Bias-audit methodology runs (four-fifths / NYC LL144; seeded data, labelled) ─
create table if not exists bias_audit_runs (
  id                  uuid primary key default gen_random_uuid(),
  run_at              timestamptz not null default now(),
  group_buckets_json  jsonb,
  selection_rate_ratio numeric,
  four_fifths_pass    boolean,
  dataset_note        text                                 -- always 'seeded/synthetic — methodology demo'
);

-- ── RLS: lock the tables; the server uses the service-role key (bypasses RLS).
-- Employer-facing reads will get explicit policies when employer auth lands.
alter table employers          enable row level security;
alter table sessions           enable row level security;
alter table candidates         enable row level security;
alter table face_descriptors   enable row level security;
alter table ai_tasks           enable row level security;
alter table ai_transcript_turns enable row level security;
alter table scores             enable row level security;
alter table credentials        enable row level security;
alter table verifications      enable row level security;
alter table audit_log          enable row level security;
alter table bias_audit_runs    enable row level security;
