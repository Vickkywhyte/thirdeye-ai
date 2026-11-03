-- ThirdEye AI: Development Seed Data
-- Run with: supabase db seed

-- ──────────────────────────────────────────────
-- Test Organisation
-- ──────────────────────────────────────────────

insert into organisations (id, name, slug, settings) values
  ('a0000000-0000-0000-0000-000000000001', 'ThirdEye Demo Corp', 'thirdeye-demo', '{"default_screening_types": ["sanctions", "pep", "adverse_media", "registry"]}');

-- ──────────────────────────────────────────────
-- Test Users
-- Note: These reference auth.users entries that must exist first.
-- In local dev, create auth users via Supabase dashboard or
-- the handle_new_user() trigger will create these rows automatically.
-- These inserts are for seeding without the auth trigger.
-- ──────────────────────────────────────────────

insert into users (id, org_id, role, full_name) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin', 'Alice Admin'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'analyst', 'Bob Analyst')
on conflict (id) do nothing;

-- ──────────────────────────────────────────────
-- Sample Entities
-- ──────────────────────────────────────────────

insert into entities (id, org_id, name, type, jurisdiction, registration_number) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Acme Holdings Ltd', 'company', 'GB', '12345678'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'John Smith', 'individual', 'GB', null),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Global Trade Partners GmbH', 'company', 'DE', 'HRB 98765');

-- ──────────────────────────────────────────────
-- Sample Investigations
-- ──────────────────────────────────────────────

insert into investigations (id, org_id, entity_id, status, risk_score, assigned_to, created_by, summary) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'active', 45, 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Standard due diligence on Acme Holdings Ltd — new client onboarding'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'pending_review', 72, 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Enhanced due diligence on John Smith — PEP flag triggered');

-- ──────────────────────────────────────────────
-- Sample Timeline Events
-- ──────────────────────────────────────────────

insert into timeline_events (investigation_id, event_type, title, description, created_by) values
  ('d0000000-0000-0000-0000-000000000001', 'investigation_created', 'Investigation opened', 'Standard due diligence initiated for Acme Holdings Ltd', 'b0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000001', 'screening_started', 'Screening initiated', 'Sanctions, PEP, adverse media, and registry checks queued', 'b0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000001', 'assigned', 'Assigned to Bob Analyst', 'Investigation assigned for review', 'b0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002', 'investigation_created', 'Investigation opened', 'Enhanced due diligence initiated for John Smith', 'b0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002', 'risk_elevated', 'Risk score elevated to 72', 'PEP screening returned positive match — elevated for review', 'b0000000-0000-0000-0000-000000000002');

-- ──────────────────────────────────────────────
-- Default risk scoring rules
-- ──────────────────────────────────────────────

insert into risk_scoring_rules (org_id, factor, weight, description) values
  ('a0000000-0000-0000-0000-000000000001', 'sanctions_hit', 40, 'Weight for sanctions list matches'),
  ('a0000000-0000-0000-0000-000000000001', 'pep_hit', 25, 'Weight for PEP matches'),
  ('a0000000-0000-0000-0000-000000000001', 'adverse_media_hit', 20, 'Weight for adverse media results'),
  ('a0000000-0000-0000-0000-000000000001', 'registry_mismatch', 15, 'Weight for registry verification failures');
