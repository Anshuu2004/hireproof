-- Employer auth: allowlist so Google sign-in is AUTHORIZED, not just authenticated.
-- The OAuth callback (app/auth/callback) only provisions an employer if the
-- signed-in email or its company domain is allowlisted; otherwise it signs the
-- user back out. employers.auth_user_id (already in init.sql) links auth.users.
-- Non-destructive; safe to re-run.

create table if not exists employer_allowlist (
  id         uuid primary key default gen_random_uuid(),
  email      text,                 -- exact email match (lower-cased)
  domain     text,                 -- OR whole company domain match
  note       text,
  created_at timestamptz not null default now()
);
create unique index if not exists employer_allowlist_email_idx  on employer_allowlist (lower(email))  where email  is not null;
create unique index if not exists employer_allowlist_domain_idx on employer_allowlist (lower(domain)) where domain is not null;

-- Server-only access (service-role); deny anon/authenticated by default.
alter table employer_allowlist enable row level security;

-- Seed only a NON-personal demo employer. Owner / teammate emails are added
-- out-of-band (a manual INSERT or deploy-time seed) so no personal address is
-- committed to a public repo:
--   insert into employer_allowlist (email, note) values ('you@example.com', 'owner');
insert into employer_allowlist (email, note)
select 'demo@hireproof.app', 'seeded demo employer'
where not exists (select 1 from employer_allowlist where lower(email) = 'demo@hireproof.app');
