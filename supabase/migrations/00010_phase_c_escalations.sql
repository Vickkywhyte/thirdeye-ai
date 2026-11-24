-- ThirdEye AI: Phase C — Escalations
-- Adds the compliance_manager role and the escalations table.

-- ──────────────────────────────────────────────
-- user_role enum: add 'compliance_manager' between admin and analyst
-- ──────────────────────────────────────────────

alter type user_role add value if not exists 'compliance_manager' before 'analyst';

-- ──────────────────────────────────────────────
-- escalations
-- ──────────────────────────────────────────────

create table escalations (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organisations (id) on delete cascade,
  investigation_id uuid not null references investigations (id) on delete cascade,
  escalated_by uuid not null references users (id) on delete restrict,
  assigned_to uuid references users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  reason text not null check (char_length(reason) >= 20),
  resolution_notes text,
  resolved_at timestamptz,
  source_id uuid references sources (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_escalations_org_id on escalations (org_id);
create index idx_escalations_investigation_id on escalations (investigation_id);
create index idx_escalations_escalated_by on escalations (escalated_by);
create index idx_escalations_assigned_to on escalations (assigned_to);
create index idx_escalations_status on escalations (status);
create index idx_escalations_source_id on escalations (source_id);

alter table escalations enable row level security;

create policy "tenant_isolation_escalations_select"
  on escalations for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_escalations_insert"
  on escalations for insert
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_escalations_update"
  on escalations for update
  using (org_id = get_org_id_for_user(auth.uid()))
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_escalations_delete"
  on escalations for delete
  using (org_id = get_org_id_for_user(auth.uid()));

create trigger set_updated_at_escalations
  before update on escalations
  for each row execute function update_updated_at();
