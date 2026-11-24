# ThirdEye AI — PRD Delta (Phase B Deferred Features)

**Version:** 1.0  
**Last updated:** 2026-11-24  
**Purpose:** Records features that are deferred from Phase A to Phase B. Each row has backing database schema and/or RBAC permissions already in place — no migrations are required; only routes and UI need to be built.

See [ADR 0008](adr/0008-build-doc-reconciliation.md) Decision D4 for the rationale.

---

| # | Feature | Status | Schema-ready assets | Missing in Phase A | Phase B deliverable |
|---|---|---|---|---|---|
| 1 | **User management UI** | `schema-ready` | `users` table with `is_active`, `role` columns; `users:invite`, `users:update_role`, `users:remove` RBAC permissions defined | No `/api/users` routes; no settings page for managing org members | List/invite/role-change/remove org members; settings tab "Team"; email invite via Supabase Auth |
| 2 | **API key management UI** | `schema-ready` | `api_keys` table (id, org_id, name, key_hash, key_prefix, permissions, is_active, expires_at); `api_keys:manage` RBAC permission | No `/api/api-keys` routes; no settings page | Settings tab "API Keys": list keys (prefix + name shown), create (show plaintext once), revoke |
| 3 | **Report approval workflow** | `schema-ready` | `reports.approved_by`, `reports.approved_at` columns; `reports:approve` RBAC permission | No `PATCH /api/reports/[id]/approve` route; no approval UI on report detail page | Approve button (admin/owner only); `PATCH /api/reports/[id]/approve`; approval badge in report list |
| 4 | **Screening hit review / confirm** | `schema-ready` | `screening_hits.is_confirmed`, `screening_hits.reviewed_at`, `screening_hits.reviewed_by` columns | No `PATCH /api/investigations/[id]/hits/[hitId]` route; no confirm/dismiss UI | Per-hit confirm/dismiss buttons on investigation screening tab; route updates `is_confirmed`, `reviewed_by`, `reviewed_at` |
| 5 | **Custom risk scoring rules** | `schema-ready` | `risk_scoring_rules` table (factor, weight, is_active per org); `settings:update` RBAC permission | Orchestrator uses hardcoded weights (`{sanctions:0.4, pep:0.25, adverse_media:0.2, registry:0.15}`); table never queried | Settings tab "Risk Rules": per-org weight sliders; `GET/PATCH /api/settings/risk-rules`; orchestrator reads per-org weights at runtime |
| 6 | **Real-time / push alerts** | `deferred` | `timeline_events` table (used for polling today); no blocking schema gap | Notifications use pull-based polling (`GET /api/notifications`); alerts page shows explicit "Phase 2" banner; no WebSocket or SSE | Replace polling with Supabase Realtime subscription on `timeline_events`; push badge updates to nav; remove "Phase 2" banner |
