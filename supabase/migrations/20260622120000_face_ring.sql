-- HireProof — cross-employer fraud-ring detection (BN-1).
-- The same pgvector cosine operator hp_cross_round_match uses WITHIN one
-- credential, dropped ACROSS credential boundaries: if one face appears under
-- many different candidate identities, that's a ring (the laptop-farm / proxy
-- pattern). Returns the matching credential-pair edges; connected components are
-- grouped in the app. Same 0.30 threshold as cross-round match — stated once.
--
-- This is a human-review FLAG, never an auto-reject. face-api 128-D FAR/FRR is
-- unmeasured (see the FAR/FRR harness). Cross-candidate linking is a stated DPDP
-- purpose-limitation governance item, demoed on SEEDED/synthetic data.

create or replace function hp_face_ring(p_threshold float default 0.30)
returns table(a_credential uuid, b_credential uuid, distance float)
language sql stable as $$
  select a.credential_id as a_credential,
         b.credential_id as b_credential,
         min(a.embedding <=> b.embedding)::float as distance
  from face_descriptors a
  join face_descriptors b
    on a.credential_id < b.credential_id          -- ordered pairs, no self-join
  where a.credential_id is not null
    and b.credential_id is not null
    and (a.embedding <=> b.embedding) < p_threshold
  group by a.credential_id, b.credential_id;
$$;
