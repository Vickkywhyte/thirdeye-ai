-- ThirdEye AI: PostgreSQL Functions and Triggers

-- ──────────────────────────────────────────────
-- update_updated_at() trigger function
-- ──────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to all tables with updated_at
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'organisations',
      'users',
      'entities',
      'investigations',
      'screening_results',
      'screening_hits',
      'documents',
      'reports',
      'timeline_events',
      'analyst_notes',
      'api_keys',
      'audit_log',
      'risk_scoring_rules',
      'ownership_links'
    ])
  loop
    execute format(
      'create trigger trg_%s_updated_at
         before update on %I
         for each row
         execute function update_updated_at()',
      tbl, tbl
    );
  end loop;
end;
$$;

-- ──────────────────────────────────────────────
-- get_org_id_for_user()
-- Already created in 00002_rls_policies.sql as forward declaration.
-- This is a no-op re-declaration to keep it documented here.
-- ──────────────────────────────────────────────

create or replace function get_org_id_for_user(user_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select org_id from public.users where id = user_id;
$$;

-- ──────────────────────────────────────────────
-- get_investigation_risk_score()
-- Aggregates screening results into a 0-100 score
-- ──────────────────────────────────────────────

create or replace function get_investigation_risk_score(investigation_uuid uuid)
returns integer
language plpgsql
stable
as $$
declare
  total_weight numeric := 0;
  weighted_score numeric := 0;
  screening record;
  type_weight numeric;
  hit_severity numeric;
begin
  for screening in
    select
      sr.type,
      sr.status,
      sr.hit_count,
      coalesce(max(sh.match_score), 0) as max_match_score,
      count(sh.id) as confirmed_hits
    from screening_results sr
    left join screening_hits sh on sh.result_id = sr.id
    where sr.investigation_id = investigation_uuid
      and sr.status = 'completed'
    group by sr.id, sr.type, sr.status, sr.hit_count
  loop
    -- Weight by screening type severity
    case screening.type
      when 'sanctions' then type_weight := 40;
      when 'pep' then type_weight := 25;
      when 'adverse_media' then type_weight := 20;
      when 'registry' then type_weight := 15;
    end case;

    total_weight := total_weight + type_weight;

    -- Score based on highest match quality and hit count
    if screening.hit_count > 0 then
      hit_severity := least(screening.max_match_score, 100);
      -- Boost for multiple hits (diminishing returns)
      hit_severity := hit_severity * (1 + ln(greatest(screening.hit_count, 1)) * 0.1);
      hit_severity := least(hit_severity, 100);
    else
      hit_severity := 0;
    end if;

    weighted_score := weighted_score + (type_weight * hit_severity);
  end loop;

  if total_weight = 0 then
    return null;
  end if;

  return least(round(weighted_score / total_weight), 100)::integer;
end;
$$;

-- ──────────────────────────────────────────────
-- Handle new auth.users signup → create public.users row
-- ──────────────────────────────────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, org_id, role, full_name)
  values (
    new.id,
    coalesce(
      (new.raw_user_meta_data ->> 'org_id')::uuid,
      gen_random_uuid()
    ),
    coalesce(
      (new.raw_user_meta_data ->> 'role')::user_role,
      'viewer'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.email
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
