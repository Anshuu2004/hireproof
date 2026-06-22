-- R-14: exclude 'undisclosed' from the protected-class cohorts in the four-fifths
-- impact-ratio test. 'undisclosed' is a declined-to-state bucket, NOT a protected
-- class — treating it as its own group can manufacture or mask an adverse-impact
-- finding, which is methodologically wrong for an LL144 / EU-AI-Act fairness claim.
-- We keep grouping by the real classes; the non-PII 'language' proxy is unaffected.
-- `create or replace` is non-destructive and idempotent.
create or replace function hp_bias_cohorts(p_pass_threshold int default 60)
returns table(dimension text, grp text, total bigint, selected bigint)
language sql stable as $$
  with base as (
    -- one (latest) score per session, joined to opt-in demographics
    select distinct on (s.id)
      s.id as session_id,
      s.language,
      sco.ai_collab_score as score,
      d.gender, d.age_band, d.region, d.category
    from sessions s
    join scores sco on sco.session_id = s.id
    left join audit_demographics d on d.session_id = s.id and d.consented = true
    where sco.ai_collab_score is not null
    order by s.id, sco.created_at desc
  )
  select 'gender'::text, b.gender, count(*), count(*) filter (where b.score >= p_pass_threshold)
    from base b where b.gender is not null and b.gender <> 'undisclosed' group by b.gender
  union all
  select 'age_band', b.age_band, count(*), count(*) filter (where b.score >= p_pass_threshold)
    from base b where b.age_band is not null and b.age_band <> 'undisclosed' group by b.age_band
  union all
  select 'region', b.region, count(*), count(*) filter (where b.score >= p_pass_threshold)
    from base b where b.region is not null and b.region <> 'undisclosed' group by b.region
  union all
  select 'category', b.category, count(*), count(*) filter (where b.score >= p_pass_threshold)
    from base b where b.category is not null and b.category <> 'undisclosed' group by b.category
  union all
  -- proxy cohort: UI language (always available, no new PII)
  select 'language', b.language, count(*), count(*) filter (where b.score >= p_pass_threshold)
    from base b group by b.language;
$$;
