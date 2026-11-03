-- ThirdEye AI: Initial Schema
-- Phase 2 — Database Schema + Supabase Setup

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_trgm";

-- ──────────────────────────────────────────────
-- Custom types
-- ──────────────────────────────────────────────

create type user_role as enum ('owner', 'admin', 'analyst', 'viewer');
create type entity_type as enum ('individual', 'company', 'trust', 'partnership', 'other');
create type investigation_status as enum ('active', 'pending_review', 'completed', 'escalated', 'archived');
create type screening_type as enum ('sanctions', 'pep', 'adverse_media', 'registry');
create type screening_status as enum ('pending', 'running', 'completed', 'failed');
create type report_status as enum ('draft', 'in_review', 'final', 'archived');
create type report_template as enum ('standard_dd', 'enhanced_dd', 'sanctions_alert', 'periodic_review');
create type link_type as enum ('ownership', 'control', 'nominee', 'beneficial_owner', 'other');

-- ──────────────────────────────────────────────
-- organisations
-- ──────────────────────────────────────────────

create table organisations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  settings jsonb not null default '{}',
  logo_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_organisations_slug on organisations (slug);

-- ──────────────────────────────────────────────
-- users (extends auth.users)
-- ──────────────────────────────────────────────

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  role user_role not null default 'viewer',
  full_name text not null,
  avatar_url text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_users_org_id on users (org_id);
create index idx_users_role on users (role);

-- ──────────────────────────────────────────────
-- entities
-- ──────────────────────────────────────────────

create table entities (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organisations (id) on delete cascade,
  name text not null,
  type entity_type not null default 'individual',
  jurisdiction text,
  registration_number text,
  date_of_birth date,
  address text,
  metadata jsonb not null default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_entities_org_id on entities (org_id);
create index idx_entities_name_trgm on entities using gin (name gin_trgm_ops);
create index idx_entities_type on entities (type);

-- ──────────────────────────────────────────────
-- investigations
-- ──────────────────────────────────────────────

create table investigations (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organisations (id) on delete cascade,
  entity_id uuid not null references entities (id) on delete restrict,
  status investigation_status not null default 'active',
  risk_score integer check (risk_score >= 0 and risk_score <= 100),
  assigned_to uuid references users (id) on delete set null,
  due_date date,
  summary text,
  created_by uuid not null references users (id) on delete restrict,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_investigations_org_id on investigations (org_id);
create index idx_investigations_entity_id on investigations (entity_id);
create index idx_investigations_status on investigations (status);
create index idx_investigations_assigned_to on investigations (assigned_to);

-- ──────────────────────────────────────────────
-- screening_results
-- ──────────────────────────────────────────────

create table screening_results (
  id uuid default gen_random_uuid() primary key,
  investigation_id uuid not null references investigations (id) on delete cascade,
  type screening_type not null,
  status screening_status not null default 'pending',
  hit_count integer not null default 0,
  raw_data jsonb not null default '{}',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_screening_results_investigation on screening_results (investigation_id);
create index idx_screening_results_type on screening_results (type);
create index idx_screening_results_status on screening_results (status);

-- ──────────────────────────────────────────────
-- screening_hits
-- ──────────────────────────────────────────────

create table screening_hits (
  id uuid default gen_random_uuid() primary key,
  result_id uuid not null references screening_results (id) on delete cascade,
  source text not null,
  match_score numeric(5, 2) not null check (match_score >= 0 and match_score <= 100),
  matched_name text,
  data jsonb not null default '{}',
  is_confirmed boolean,
  reviewed_by uuid references users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_screening_hits_result on screening_hits (result_id);
create index idx_screening_hits_score on screening_hits (match_score desc);

-- ──────────────────────────────────────────────
-- documents
-- ──────────────────────────────────────────────

create table documents (
  id uuid default gen_random_uuid() primary key,
  investigation_id uuid not null references investigations (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  file_size_bytes bigint,
  uploaded_by uuid not null references users (id) on delete restrict,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_documents_investigation on documents (investigation_id);
create index idx_documents_org on documents (org_id);

-- ──────────────────────────────────────────────
-- reports
-- ──────────────────────────────────────────────

create table reports (
  id uuid default gen_random_uuid() primary key,
  investigation_id uuid not null references investigations (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  template report_template not null default 'standard_dd',
  status report_status not null default 'draft',
  title text not null,
  content jsonb not null default '{}',
  generated_by uuid references users (id) on delete set null,
  approved_by uuid references users (id) on delete set null,
  approved_at timestamptz,
  share_token text unique,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_reports_investigation on reports (investigation_id);
create index idx_reports_org on reports (org_id);
create index idx_reports_status on reports (status);
create index idx_reports_share_token on reports (share_token) where share_token is not null;

-- ──────────────────────────────────────────────
-- timeline_events
-- ──────────────────────────────────────────────

create table timeline_events (
  id uuid default gen_random_uuid() primary key,
  investigation_id uuid not null references investigations (id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  data jsonb not null default '{}',
  created_by uuid references users (id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_timeline_events_investigation on timeline_events (investigation_id);
create index idx_timeline_events_type on timeline_events (event_type);
create index idx_timeline_events_created on timeline_events (created_at desc);

-- ──────────────────────────────────────────────
-- analyst_notes
-- ──────────────────────────────────────────────

create table analyst_notes (
  id uuid default gen_random_uuid() primary key,
  investigation_id uuid not null references investigations (id) on delete cascade,
  content text not null,
  author_id uuid not null references users (id) on delete restrict,
  is_pinned boolean not null default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_analyst_notes_investigation on analyst_notes (investigation_id);
create index idx_analyst_notes_author on analyst_notes (author_id);

-- ──────────────────────────────────────────────
-- api_keys
-- ──────────────────────────────────────────────

create table api_keys (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organisations (id) on delete cascade,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  permissions jsonb not null default '[]',
  is_active boolean not null default true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references users (id) on delete restrict,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_api_keys_org on api_keys (org_id);
create index idx_api_keys_prefix on api_keys (key_prefix);

-- ──────────────────────────────────────────────
-- audit_log (append-only)
-- ──────────────────────────────────────────────

create table audit_log (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organisations (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  data jsonb not null default '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_audit_log_org on audit_log (org_id);
create index idx_audit_log_user on audit_log (user_id);
create index idx_audit_log_action on audit_log (action);
create index idx_audit_log_created on audit_log (created_at desc);

-- ──────────────────────────────────────────────
-- risk_scoring_rules
-- ──────────────────────────────────────────────

create table risk_scoring_rules (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organisations (id) on delete cascade,
  factor text not null,
  weight numeric(5, 2) not null default 1.0 check (weight >= 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (org_id, factor)
);

create index idx_risk_scoring_rules_org on risk_scoring_rules (org_id);

-- ──────────────────────────────────────────────
-- ownership_links
-- ──────────────────────────────────────────────

create table ownership_links (
  id uuid default gen_random_uuid() primary key,
  parent_entity_id uuid not null references entities (id) on delete cascade,
  child_entity_id uuid not null references entities (id) on delete cascade,
  org_id uuid not null references organisations (id) on delete cascade,
  ownership_pct numeric(5, 2) check (ownership_pct >= 0 and ownership_pct <= 100),
  link_type link_type not null default 'ownership',
  is_verified boolean not null default false,
  source text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint no_self_reference check (parent_entity_id != child_entity_id)
);

create index idx_ownership_links_parent on ownership_links (parent_entity_id);
create index idx_ownership_links_child on ownership_links (child_entity_id);
create index idx_ownership_links_org on ownership_links (org_id);
