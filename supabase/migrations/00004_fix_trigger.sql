-- Fix handle_new_user() trigger
--
-- The previous version used gen_random_uuid() as the org_id fallback,
-- which violates the FK constraint on public.users.org_id → organisations.id.
-- It also crashed on missing or invalid metadata, rolling back the entire
-- auth.users insert and producing "Database error saving new user".
--
-- This version:
--   1. Extracts org_id from raw_user_meta_data; if missing or not a valid
--      UUID, it skips the public.users insert entirely (the server action
--      can create the row later once the org exists).
--   2. Validates the role enum; falls back to 'analyst' on bad values.
--   3. Never crashes — the signup always succeeds.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _org_id uuid;
  _role   user_role;
  _name   text;
begin
  -- Extract org_id; skip insert if not a valid FK
  begin
    _org_id := (new.raw_user_meta_data ->> 'org_id')::uuid;
  exception when others then
    _org_id := null;
  end;

  if _org_id is null then
    return new;
  end if;

  -- Verify the organisation actually exists
  if not exists (select 1 from public.organisations where id = _org_id) then
    return new;
  end if;

  -- Extract role; default to 'analyst' on bad or missing value
  begin
    _role := coalesce(
      (new.raw_user_meta_data ->> 'role')::user_role,
      'analyst'
    );
  exception when others then
    _role := 'analyst';
  end;

  -- Extract full_name; fall back to email
  _name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    new.email
  );

  insert into public.users (id, org_id, role, full_name)
  values (new.id, _org_id, _role, _name);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
