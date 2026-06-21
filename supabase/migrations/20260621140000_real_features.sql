-- HireProof — convert mocked surfaces into real ones.
--   1. Holder binding: a per-credential holder secret (only its hash is stored)
--      so the credential is no longer a pure bearer token — possession of the
--      secret can be proven. The secret hash is also committed inside the signed
--      VC (cnf claim), so the binding is tamper-proof.
--   2. Employer authentication: real password-gated employer accounts (scrypt
--      hashed) + a seeded demo account so reviewers can sign in with one click.

-- Holder proof-of-possession ------------------------------------------------
alter table credentials add column if not exists holder_secret_hash text;

-- Employer auth -------------------------------------------------------------
alter table employers add column if not exists password_hash text;
create unique index if not exists employers_email_uniq on employers (lower(email));

-- Seed a demo employer (email: demo@hireproof.app · password: demo1234).
-- password_hash = scrypt$<salt>$<key>. Idempotent.
insert into employers (email, org_name, password_hash)
select
  'demo@hireproof.app',
  'Acme Talent (demo employer)',
  'scrypt$bdf6b83bf7eeb74ae7674429436fa2a9$2bfca2868ba85253bd5b866c769e85d39aeaffc7d1bc4b42c5acc63837efab1a'
where not exists (select 1 from employers where lower(email) = 'demo@hireproof.app');
