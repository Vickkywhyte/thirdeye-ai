-- ThirdEye AI: Phase E — Periodic Reviews

create table reviews (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organisations (id) on delete cascade,
  investigation_id uuid not null references investigations (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'overdue')),
  due_date timestamptz not null,
  completed_at timestamptz,
  completed_by uuid references users (id) on delete set null,
  source_id uuid references sources (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_reviews_org_id on reviews (org_id);
create index idx_reviews_investigation_id on reviews (investigation_id);
create index idx_reviews_status on reviews (status);
create index idx_reviews_due_date on reviews (due_date);
create index idx_reviews_completed_by on reviews (completed_by);
create index idx_reviews_source_id on reviews (source_id);

alter table reviews enable row level security;

create policy "tenant_isolation_reviews_select"
  on reviews for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_reviews_insert"
  on reviews for insert
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_reviews_update"
  on reviews for update
  using (org_id = get_org_id_for_user(auth.uid()))
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_reviews_delete"
  on reviews for delete
  using (org_id = get_org_id_for_user(auth.uid()));

create trigger set_updated_at_reviews
  before update on reviews
  for each row execute function update_updated_at();
