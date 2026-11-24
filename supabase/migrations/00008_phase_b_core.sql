-- ThirdEye AI: Phase B — Decision & Application Core
-- Adds sources (provenance), applications, decisions tables and a counterparty_type column on entities.

-- ──────────────────────────────────────────────
-- sources (provenance for any ingested data)
-- ──────────────────────────────────────────────

create table sources (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organisations (id) on delete cascade,
  source_type text not null check (source_type in ('registry', 'sanctions', 'pep', 'media', 'llm', 'manual')),
  source_name text not null,
  source_url text,
  retrieved_at timestamptz not null default now(),
  content_hash text,
  raw_content jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sources_org_id on sources (org_id);
create index idx_sources_type on sources (source_type);
create index idx_sources_content_hash on sources (content_hash);

alter table sources enable row level security;

create policy "tenant_isolation_sources_select"
  on sources for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_sources_insert"
  on sources for insert
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_sources_update"
  on sources for update
  using (org_id = get_org_id_for_user(auth.uid()))
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_sources_delete"
  on sources for delete
  using (org_id = get_org_id_for_user(auth.uid()));

-- ──────────────────────────────────────────────
-- entities.counterparty_type
-- ──────────────────────────────────────────────

alter table entities
  add column counterparty_type text
    check (counterparty_type in ('merchant', 'partner', 'psp', 'vendor', 'respondent_institution', 'other'));

create index idx_entities_counterparty_type on entities (counterparty_type);

-- ──────────────────────────────────────────────
-- applications (counterparty onboarding applications)
-- ──────────────────────────────────────────────

create table applications (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organisations (id) on delete cascade,
  investigation_id uuid not null references investigations (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'decided')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_applications_org_id on applications (org_id);
create index idx_applications_investigation_id on applications (investigation_id);
create index idx_applications_status on applications (status);

alter table applications enable row level security;

create policy "tenant_isolation_applications_select"
  on applications for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_applications_insert"
  on applications for insert
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_applications_update"
  on applications for update
  using (org_id = get_org_id_for_user(auth.uid()))
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_applications_delete"
  on applications for delete
  using (org_id = get_org_id_for_user(auth.uid()));

-- ──────────────────────────────────────────────
-- decisions (approve / reject / refer on an application)
-- ──────────────────────────────────────────────

create table decisions (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organisations (id) on delete cascade,
  application_id uuid not null references applications (id) on delete cascade,
  decision_type text not null check (decision_type in ('approve', 'reject', 'refer')),
  rationale text not null,
  decided_by uuid not null references users (id) on delete restrict,
  source_id uuid references sources (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_decisions_org_id on decisions (org_id);
create index idx_decisions_application_id on decisions (application_id);
create index idx_decisions_decided_by on decisions (decided_by);
create index idx_decisions_source_id on decisions (source_id);

alter table decisions enable row level security;

create policy "tenant_isolation_decisions_select"
  on decisions for select
  using (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_decisions_insert"
  on decisions for insert
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_decisions_update"
  on decisions for update
  using (org_id = get_org_id_for_user(auth.uid()))
  with check (org_id = get_org_id_for_user(auth.uid()));

create policy "tenant_isolation_decisions_delete"
  on decisions for delete
  using (org_id = get_org_id_for_user(auth.uid()));

-- ──────────────────────────────────────────────
-- updated_at triggers (reuse existing update_updated_at() from 00003_functions.sql)
-- ──────────────────────────────────────────────

create trigger set_updated_at_sources
  before update on sources
  for each row execute function update_updated_at();

create trigger set_updated_at_applications
  before update on applications
  for each row execute function update_updated_at();

create trigger set_updated_at_decisions
  before update on decisions
  for each row execute function update_updated_at();
