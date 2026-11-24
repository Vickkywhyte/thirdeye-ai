-- ThirdEye AI: Phase D — EDD Assessments
-- One enhanced-due-diligence record per investigation.

create table edd_assessments (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organisations (id) on delete cascade,
  investigation_id uuid not null unique references investigations (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  risk_factors jsonb not null default '{}',
  notes text,
  completed_by uuid references users (id) on delete set null,
  completed_at timestamptz,
  source_id uuid references sources (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_edd_assessments_org_id on edd_assessments (org_id);
create index idx_edd_assessments_status on edd_assessments (status);
create index idx_edd_assessments_completed_by on edd_assessments (completed_by);
create index idx_edd_assessments_source_id on edd_assessments (source_id);

alter table edd_assessments enable row level security;

create policy "tenant_isolation_edd_assessments_select"
  on edd_assessments for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_edd_assessments_insert"
  on edd_assessments for insert
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_edd_assessments_update"
  on edd_assessments for update
  using (org_id = get_org_id_for_user(auth.uid()))
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_edd_assessments_delete"
  on edd_assessments for delete
  using (org_id = get_org_id_for_user(auth.uid()));

create trigger set_updated_at_edd_assessments
  before update on edd_assessments
  for each row execute function update_updated_at();
