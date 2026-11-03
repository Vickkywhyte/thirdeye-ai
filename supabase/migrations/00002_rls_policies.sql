-- ThirdEye AI: Row Level Security Policies
-- All policies scope by org_id matching the authenticated user's org

-- Helper: get the current user's org_id
-- (function created in 00003_functions.sql, but RLS needs it — create a forward declaration)
create or replace function get_org_id_for_user(user_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select org_id from public.users where id = user_id;
$$;

-- ──────────────────────────────────────────────
-- Enable RLS on every table
-- ──────────────────────────────────────────────

alter table organisations enable row level security;
alter table users enable row level security;
alter table entities enable row level security;
alter table investigations enable row level security;
alter table screening_results enable row level security;
alter table screening_hits enable row level security;
alter table documents enable row level security;
alter table reports enable row level security;
alter table timeline_events enable row level security;
alter table analyst_notes enable row level security;
alter table api_keys enable row level security;
alter table audit_log enable row level security;
alter table risk_scoring_rules enable row level security;
alter table ownership_links enable row level security;

-- ──────────────────────────────────────────────
-- organisations
-- ──────────────────────────────────────────────

create policy "Users can view their own organisation"
  on organisations for select
  using (id = get_org_id_for_user(auth.uid()));

create policy "Owners can update their organisation"
  on organisations for update
  using (id = get_org_id_for_user(auth.uid()))
  with check (id = get_org_id_for_user(auth.uid()));

-- ──────────────────────────────────────────────
-- users
-- ──────────────────────────────────────────────

create policy "Users can view members of their org"
  on users for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "Users can update their own profile"
  on users for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins and owners can insert users"
  on users for insert
  with check (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

-- ──────────────────────────────────────────────
-- entities
-- ──────────────────────────────────────────────

create policy "Org members can view entities"
  on entities for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "Analysts+ can create entities"
  on entities for insert
  with check (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin', 'analyst')
  );

create policy "Analysts+ can update entities"
  on entities for update
  using (org_id = get_org_id_for_user(auth.uid()))
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "Admins+ can delete entities"
  on entities for delete
  using (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

-- ──────────────────────────────────────────────
-- investigations
-- ──────────────────────────────────────────────

create policy "Org members can view investigations"
  on investigations for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "Analysts+ can create investigations"
  on investigations for insert
  with check (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin', 'analyst')
  );

create policy "Analysts+ can update investigations"
  on investigations for update
  using (org_id = get_org_id_for_user(auth.uid()))
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "Admins+ can delete investigations"
  on investigations for delete
  using (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

-- ──────────────────────────────────────────────
-- screening_results
-- Scope via investigation's org_id
-- ──────────────────────────────────────────────

create policy "Org members can view screening results"
  on screening_results for select
  using (
    exists (
      select 1 from investigations i
      where i.id = investigation_id
        and i.org_id = get_org_id_for_user(auth.uid())
    )
  );

create policy "Analysts+ can create screening results"
  on screening_results for insert
  with check (
    exists (
      select 1 from investigations i
      where i.id = investigation_id
        and i.org_id = get_org_id_for_user(auth.uid())
    )
  );

create policy "Analysts+ can update screening results"
  on screening_results for update
  using (
    exists (
      select 1 from investigations i
      where i.id = investigation_id
        and i.org_id = get_org_id_for_user(auth.uid())
    )
  );

-- ──────────────────────────────────────────────
-- screening_hits
-- Scope via screening_result -> investigation -> org_id
-- ──────────────────────────────────────────────

create policy "Org members can view screening hits"
  on screening_hits for select
  using (
    exists (
      select 1 from screening_results sr
      join investigations i on i.id = sr.investigation_id
      where sr.id = result_id
        and i.org_id = get_org_id_for_user(auth.uid())
    )
  );

create policy "System can insert screening hits"
  on screening_hits for insert
  with check (
    exists (
      select 1 from screening_results sr
      join investigations i on i.id = sr.investigation_id
      where sr.id = result_id
        and i.org_id = get_org_id_for_user(auth.uid())
    )
  );

create policy "Analysts+ can update screening hits"
  on screening_hits for update
  using (
    exists (
      select 1 from screening_results sr
      join investigations i on i.id = sr.investigation_id
      where sr.id = result_id
        and i.org_id = get_org_id_for_user(auth.uid())
    )
  );

-- ──────────────────────────────────────────────
-- documents
-- ──────────────────────────────────────────────

create policy "Org members can view documents"
  on documents for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "Analysts+ can upload documents"
  on documents for insert
  with check (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin', 'analyst')
  );

create policy "Admins+ can delete documents"
  on documents for delete
  using (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

-- ──────────────────────────────────────────────
-- reports
-- ──────────────────────────────────────────────

create policy "Org members can view reports"
  on reports for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "Analysts+ can create reports"
  on reports for insert
  with check (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin', 'analyst')
  );

create policy "Analysts+ can update reports"
  on reports for update
  using (org_id = get_org_id_for_user(auth.uid()))
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "Admins+ can delete reports"
  on reports for delete
  using (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

-- ──────────────────────────────────────────────
-- timeline_events
-- Scope via investigation's org_id
-- ──────────────────────────────────────────────

create policy "Org members can view timeline events"
  on timeline_events for select
  using (
    exists (
      select 1 from investigations i
      where i.id = investigation_id
        and i.org_id = get_org_id_for_user(auth.uid())
    )
  );

create policy "Analysts+ can create timeline events"
  on timeline_events for insert
  with check (
    exists (
      select 1 from investigations i
      where i.id = investigation_id
        and i.org_id = get_org_id_for_user(auth.uid())
    )
  );

-- ──────────────────────────────────────────────
-- analyst_notes
-- Scope via investigation's org_id
-- ──────────────────────────────────────────────

create policy "Org members can view analyst notes"
  on analyst_notes for select
  using (
    exists (
      select 1 from investigations i
      where i.id = investigation_id
        and i.org_id = get_org_id_for_user(auth.uid())
    )
  );

create policy "Analysts+ can create notes"
  on analyst_notes for insert
  with check (
    exists (
      select 1 from investigations i
      where i.id = investigation_id
        and i.org_id = get_org_id_for_user(auth.uid())
    )
    and (select role from users where id = auth.uid()) in ('owner', 'admin', 'analyst')
  );

create policy "Authors can update their own notes"
  on analyst_notes for update
  using (author_id = auth.uid());

create policy "Admins+ can delete notes"
  on analyst_notes for delete
  using (
    exists (
      select 1 from investigations i
      where i.id = investigation_id
        and i.org_id = get_org_id_for_user(auth.uid())
    )
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

-- ──────────────────────────────────────────────
-- api_keys
-- ──────────────────────────────────────────────

create policy "Admins+ can view api keys"
  on api_keys for select
  using (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

create policy "Admins+ can create api keys"
  on api_keys for insert
  with check (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

create policy "Admins+ can update api keys"
  on api_keys for update
  using (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

create policy "Admins+ can delete api keys"
  on api_keys for delete
  using (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

-- ──────────────────────────────────────────────
-- audit_log (APPEND-ONLY: INSERT only, no UPDATE/DELETE)
-- ──────────────────────────────────────────────

create policy "Org members can view audit log"
  on audit_log for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "Authenticated users can insert audit log"
  on audit_log for insert
  with check (org_id = get_org_id_for_user(auth.uid()));

-- No UPDATE or DELETE policies — audit_log is immutable

-- ──────────────────────────────────────────────
-- risk_scoring_rules
-- ──────────────────────────────────────────────

create policy "Org members can view risk scoring rules"
  on risk_scoring_rules for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "Admins+ can manage risk scoring rules"
  on risk_scoring_rules for insert
  with check (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

create policy "Admins+ can update risk scoring rules"
  on risk_scoring_rules for update
  using (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );

-- ──────────────────────────────────────────────
-- ownership_links
-- ──────────────────────────────────────────────

create policy "Org members can view ownership links"
  on ownership_links for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "Analysts+ can create ownership links"
  on ownership_links for insert
  with check (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin', 'analyst')
  );

create policy "Analysts+ can update ownership links"
  on ownership_links for update
  using (org_id = get_org_id_for_user(auth.uid()))
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "Admins+ can delete ownership links"
  on ownership_links for delete
  using (
    org_id = get_org_id_for_user(auth.uid())
    and (select role from users where id = auth.uid()) in ('owner', 'admin')
  );
