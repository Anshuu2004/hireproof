-- HireProof — DigiLocker integration (DEMO SANDBOX, real API contract).
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
