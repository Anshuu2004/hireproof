-- Cross-round biometric match: given a credential and a new face descriptor,
-- return the closest cosine distance to any descriptor previously enrolled under
-- that credential, plus how many prior rounds exist. Used to flag proxy/seat-swap.
-- Distance is cosine (pgvector <=> operator): 0 = identical, ~1 = unrelated.

create or replace function hp_cross_round_match(
  p_credential_id uuid,
  p_embedding vector(128)
)
returns table (min_distance double precision, prior_rounds int)
language sql
stable
as $$
  select
    coalesce(min(embedding <=> p_embedding), 1.0)::double precision as min_distance,
    count(*)::int as prior_rounds
  from face_descriptors
  where credential_id = p_credential_id;
$$;

comment on function hp_cross_round_match is
  'Returns the minimum cosine distance between p_embedding and all descriptors enrolled under p_credential_id (and the count of prior rounds). Threshold ~0.20 cosine = same person for face-api/human descriptors.';
