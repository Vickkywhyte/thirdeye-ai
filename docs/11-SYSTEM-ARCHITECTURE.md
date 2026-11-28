# ThirdEye AI — System Architecture

**Version:** 1.0  
**Last updated:** 2026-11-28  
**Status:** Current through end of Phase E (MVP core complete).  
**Companion documents:** [02-DATA-MODEL.md](02-DATA-MODEL.md) · [03-API-CONTRACT.md](03-API-CONTRACT.md) · [08-ADR-INDEX.md](08-ADR-INDEX.md) · [09-PRD-DELTA.md](09-PRD-DELTA.md) · [adr/0007-lifecycle-scope.md](adr/0007-lifecycle-scope.md) · [adr/0008-build-doc-reconciliation.md](adr/0008-build-doc-reconciliation.md)

---

## 1. System Overview & Tech Stack

### Purpose

ThirdEye AI is a **B2B multi-tenant compliance and enhanced due-diligence (EDD) platform**. A regulated organisation (bank, fintech, payment institution, law firm) onboards a counterparty, screens them against sanctions / PEP / adverse-media / registry sources, captures the analyst's judgment through an onboarding application, records an approve/reject/refer decision, and then tracks the relationship through periodic reviews and escalations over its lifetime. The product is designed around a **"Calm Authority"** design language: dark-mode, muted, data-forward surfaces that frame regulated workflows without theatrics.

### Tech stack

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | Next.js **16.4.5** (App Router, Turbopack, `cacheComponents: true`) | Request-time segments marked with `export const instant = false` + `await connection()` |
| **UI runtime** | React **19.3.0** | Server Components by default; Client Components for interactive surfaces |
| **Language** | TypeScript, strict mode | Zero `tsc --noEmit` errors enforced in CI |
| **Styling** | Tailwind CSS **4** via `@tailwindcss/turbopack` | Semantic CSS tokens: `risk-low`, `risk-medium`, `risk-critical`, `accent-blue`, muted, sidebar-* |
| **UI primitives** | shadcn/ui (Radix-based): Dialog, Select, Textarea, Tabs, DataTable (TanStack Table v9 `LegacyColumnDef`), Button, Badge, Card, Skeleton, Tooltip | Local components live in `src/components/ui/` |
| **Charting** | Recharts (dashboard metrics) | |
| **Graph viz** | D3 v7 force simulation, dynamically imported | `.stop().tick(300)` for synchronous ownership-graph layout |
| **Forms** | react-hook-form + `@hookform/resolvers/zod` | Server routes revalidate with Zod regardless |
| **Validation** | Zod (`src/lib/validation/schemas.ts`) | Single source of truth for API request bodies |
| **Database** | Supabase PostgreSQL 17 (project `kbhlnzxhjzhmwprxgbcn`) | pg_trgm, vector, pgcrypto extensions enabled |
| **Auth** | Supabase Auth (email+password, cookie session via `@supabase/ssr`) | `cookies()` awaited in `src/lib/supabase/server.ts` |
| **Storage** | Supabase Storage (buckets: `documents`, `reports`) | 1-hour signed URLs for private files |
| **AI providers** | Ollama (primary, local, `llama3`) → OpenRouter fallback (`meta-llama/llama-3.2-3b-instruct`) | On total failure the route returns 503 with `code: 'AI_UNAVAILABLE'` — never a hallucinated completion |
| **Screening providers** | OFAC / EU / UN sanctions (XML + CSV), OpenSanctions `/match/default` for PEP, GDELT + NewsAPI for adverse media, UK Companies House for registry | See §2.1 for the orchestrator architecture |
| **Rate limiting** | In-memory sliding window (`src/lib/security/rate-limiter.ts`) | Known Phase B/pre-production gap — flagged in ADR 0008 D3 |
| **Testing** | Vitest 5 (jsdom), 6 files, 65 tests | `pnpm vitest run` |
| **Package manager** | pnpm 9 | Enforced via Nixpacks config |
| **Runtime (Node)** | Node 20 LTS | |

### Deployment targets

| Surface | Host | Notes |
|---|---|---|
| **Web app** | Vercel | Standalone output, cacheComponents enabled. The one-time build bug ("dynamic not compatible with cacheComponents") is resolved with `instant = false` + `await connection()`. |
| **Database** | Supabase Cloud, eu-west-1 | All 12 migrations applied; RLS enforced on every table. |
| **Scheduled jobs** | External scheduler → `GET /api/cron/check-reviews` | Secured by `CRON_SECRET` bearer token. Vercel Cron or Upstash QStash recommended. |
| **Secondary** | Railway (Nixpacks: Node 20 + pnpm 9) | Historical/alternative deploy; `railway.toml` + `nixpacks.toml` retained. |

### Observability

- Structured logging via `src/lib/monitoring/` modules; `LOG_LEVEL` env-var gated.
- Health probes: `GET /api/health` (liveness) and `GET /api/health/ready` (DB reachability).
- Audit log table (`audit_log`) captures every mutation action with actor, org, resource, IP, and user-agent.

---

## 2. Feature Breakdown

Each feature below maps concretely to the UI surface, API routes, and database tables that implement it.

### 2.1 Core Screening (Phase A)

**What it does.** For any investigation subject the platform runs up to four provider checks in parallel, aggregates the hits, assigns per-provider severity, and produces a weighted risk score (0–100) that drives the investigation workspace.

**Provider architecture.**

```
                  POST /api/screening (202)
                            │
                            ▼
              src/lib/screening/orchestrator.ts
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  sanctions.ts         pep.ts            adverse-media.ts        registry.ts
  (OFAC SDN,           (OpenSanctions    (GDELT + NewsAPI       (UK Companies
   EU, UN XML/CSV)      /match/default)   + AI classification)   House REST)
        │                   │                   │                   │
        └───────────── trigram similarity ──────┘                   │
                            │                                        │
                            ▼                                        ▼
              screening_results (status/hit_count)       ownership_links
              screening_hits  (source, match_score, data JSONB)
```

- **Fire-and-forget.** `POST /api/screening` upserts `screening_results` rows (one per requested type), returns **202 Accepted**, and then runs the orchestrator asynchronously so the UI can start polling status immediately.
- **Risk weights are hardcoded** (`sanctions: 0.4, pep: 0.25, adverse_media: 0.2, registry: 0.15`). `risk_scoring_rules` exists on disk but is not yet queried — see §6.
- **Registry is corporate-only.** The screening schema silently drops `registry` for `entity_type: 'individual'`.
- **Companies House side-effect.** Registry screening populates `ownership_links` and can create downstream `entities` rows for PSCs / officers, enabling the ownership graph.
- **AI post-processing.** `GET/POST /api/investigations/[id]/ai-analysis` consumes completed screening results and generates a structured `RiskAnalysis` JSON through the Ollama → OpenRouter chain. The result is stored in `investigations.summary`.

**UI surfaces.**

- [`src/app/(dashboard)/investigations/[id]/page.tsx`](../src/app/(dashboard)/investigations/[id]/page.tsx) — the investigation workspace shell.
- [`src/components/investigation/screening-results.tsx`](../src/components/investigation/screening-results.tsx) — per-provider card grid.
- [`src/components/investigation/risk-score-ring.tsx`](../src/components/investigation/risk-score-ring.tsx) — radial score with per-factor breakdown tooltip.
- [`src/components/investigation/ai-analysis-card.tsx`](../src/components/investigation/ai-analysis-card.tsx) — AI narrative + confidence.
- [`src/components/graph/ownership-graph.tsx`](../src/components/graph/ownership-graph.tsx) — D3 force-directed graph, lazy-loaded.

**API routes.** `POST /api/screening`, `GET /api/screening/[investigationId]/status`, `GET/POST /api/investigations/[id]/ai-analysis`, `GET /api/investigations/[id]/graph`.

**Tables.** `entities`, `investigations`, `screening_results`, `screening_hits`, `ownership_links`, `timeline_events`.

---

### 2.2 Onboarding Applications & Decisions (Phase B)

**What it does.** Every investigation can host a single onboarding `application` that moves through `draft → submitted → under_review → decided`. Once it reaches `submitted`, a user with `decisions:create` can record an immutable **Approve / Reject / Refer** decision with a ≥ 20-char rationale.

**Counterparty classification (KYB).** `entities.counterparty_type` captures the business relationship: `merchant | partner | psp | vendor | respondent_institution | other`. This surfaces on the New Investigation form and on the Entity Summary card, and is intended to drive policy routing in later phases.

**D1 Provenance.** `decisions.source_id` references the `sources` table and is nullable — the schema is ready to attribute each decision to a specific ingested evidence record. The API accepts `source_id` in the body but does not enforce it. See §3 for the `sources` design.

**UI surfaces.**

- [`src/components/investigation/new-investigation-form.tsx`](../src/components/investigation/new-investigation-form.tsx) — Counterparty Type dropdown on create.
- [`src/components/investigation/application-tab.tsx`](../src/components/investigation/application-tab.tsx) — Application tab inside the workspace; empty state, status, submit, decision history.
- [`src/components/investigation/record-decision-dialog.tsx`](../src/components/investigation/record-decision-dialog.tsx) — Approve/Reject/Refer radio-group dialog.

**API routes.** `GET/POST /api/applications`, `GET/PATCH /api/applications/[id]`, `GET/POST /api/applications/[id]/decisions`.

**Tables.** `applications` (unique on `investigation_id` — one application per investigation), `decisions`, `sources`, `timeline_events` (event types `investigation_created`, `decision_recorded`), `audit_log`.

---

### 2.3 Escalations (Phase C)

**What it does.** Any analyst can flag an investigation for senior review. The investigation status flips to `escalated`, a timeline entry is appended, and a compliance manager works the inbox to triage and resolve each escalation with a resolution note.

**New role: `compliance_manager`.** The 00010 migration added a new value to the `user_role` enum, slotted **between `admin` and `analyst`**. The `escalations:resolve` permission is granted only to `owner`, `admin`, and `compliance_manager`.

**UI surfaces.**

- [`src/components/investigation/create-escalation-dialog.tsx`](../src/components/investigation/create-escalation-dialog.tsx) — workspace header button (gated by `escalations:create`).
- [`src/app/(dashboard)/escalations/page.tsx`](../src/app/(dashboard)/escalations/page.tsx) — Escalations inbox (gated at the server page level).
- [`src/components/escalations/escalations-inbox.tsx`](../src/components/escalations/escalations-inbox.tsx) — DataTable with Open/Resolved/All filter.
- [`src/components/escalations/resolve-escalation-dialog.tsx`](../src/components/escalations/resolve-escalation-dialog.tsx) — Resolution-notes dialog.
- [`src/components/layout/nav-rail.tsx`](../src/components/layout/nav-rail.tsx) — Escalations nav item, gated by `escalations:resolve`.

**API routes.** `POST /api/investigations/[id]/escalations`, `GET /api/escalations`, `GET/PATCH /api/escalations/[id]`.

**Tables.** `escalations` (status check `open | resolved`, reason ≥ 20 chars enforced in SQL), `timeline_events` (`escalation_created`, `escalation_resolved`), `audit_log`.

---

### 2.4 Enhanced Due Diligence (Phase D)

**What it does.** For higher-risk counterparties the analyst captures a formal EDD assessment: five structured risk factors (**Source of Funds, Source of Wealth, Jurisdiction Risk, Complex Ownership, Business Nature**), each scored **Low / Medium / High**; an analyst-notes textarea; and a document-linking affordance that jumps to the Documents tab in-place. Submitting flips the assessment to `completed`, stamps `completed_by` + `completed_at`, locks the form, and writes an `edd_completed` timeline event.

**One-per-investigation.** The `edd_assessments` table has a `UNIQUE` constraint on `investigation_id`. The POST route upserts on that key, so there's never a duplicate assessment.

**Risk factors are freeform JSONB** keyed by factor slug, which lets the UI iterate on the factor list without requiring a migration.

**UI surfaces.**

- [`src/components/investigation/edd-tab.tsx`](../src/components/investigation/edd-tab.tsx) — EDD tab inside the workspace (tab between Screening and Application).
- Jump-to-Documents is implemented by lifting Tabs state in [`investigation-workspace.tsx`](../src/components/investigation/investigation-workspace.tsx) and passing a `setActiveTab` callback into the EDD tab.

**API routes.** `GET/POST /api/investigations/[id]/edd` (upsert), `GET/PATCH /api/edd/[id]`.

**Tables.** `edd_assessments` (unique investigation_id, nullable `completed_*`, `source_id` FK to `sources`), `timeline_events` (`edd_completed`), `audit_log`.

---

### 2.5 Periodic Reviews (Phase E)

**What it does.** Any investigation can carry one or more scheduled reviews on cadences of **30 / 90 / 365 days** (or a custom date). Reviews progress `pending → in_progress → completed`; a background cron sweep flips any `pending` row whose `due_date < now()` to `overdue` and writes a `review_overdue` timeline event.

**Scheduled cron.** `GET /api/cron/check-reviews` is secured by `CRON_SECRET`, accepts either `Authorization: Bearer <secret>` (Vercel Cron style) or `?secret=<secret>`, and uses the admin client to bulk-update rows and insert timeline + audit rows across tenants. Route handler is explicitly request-time via `await connection()` + absence of caching.

**UI surfaces.**

- [`src/components/investigation/schedule-review-dialog.tsx`](../src/components/investigation/schedule-review-dialog.tsx) — workspace header button, preset Select + custom-date input, live due-date preview chip.
- [`src/app/(dashboard)/reviews/page.tsx`](../src/app/(dashboard)/reviews/page.tsx) — Reviews inbox server page.
- [`src/components/reviews/reviews-inbox.tsx`](../src/components/reviews/reviews-inbox.tsx) — DataTable with status filter; row-level Start Review / Mark Completed actions; overdue rows get red text + red Overdue badge.
- NavRail "Reviews" item is visible to all 5 roles (everyone has `reviews:read`).

**API routes.** `POST /api/investigations/[id]/reviews`, `GET /api/reviews`, `GET/PATCH /api/reviews/[id]`, `GET /api/cron/check-reviews`.

**Tables.** `reviews` (status check `pending|in_progress|completed|overdue`, `due_date NOT NULL`, `completed_*` nullable, `source_id` FK to `sources`), `timeline_events` (`review_scheduled`, `review_completed`, `review_overdue`), `audit_log`.

---

### 2.6 Cross-cutting features (shipped in A)

| Feature | Route(s) | Key files |
|---|---|---|
| **Dashboard analytics** | `GET /api/analytics/dashboard` | `src/lib/analytics/queries.ts`, `src/app/(dashboard)/dashboard/dashboard-client.tsx` |
| **Alerts digest** | `GET /api/alerts` | Filters `timeline_events` to actionable types, deduplicates, hides zero-hit screening events |
| **Notifications** | `GET /api/notifications`, `PATCH /api/notifications` (last_read_at cursor) | `src/components/layout/notification-center.tsx` |
| **Portfolio monitoring** | `POST /api/portfolio-monitoring` | Stamps `investigations.last_screened_at` for every non-archived investigation in the org |
| **Documents** | `GET/POST /api/investigations/[id]/documents`, `GET/DELETE /api/investigations/[id]/documents/[docId]` | Supabase Storage bucket `documents`, 25 MB cap, 1 h signed URLs |
| **Analyst notes** | `GET/POST/PATCH/DELETE /api/investigations/[id]/notes` | Per-investigation note stream with pin flag |
| **Timeline** | `GET /api/investigations/[id]/timeline` | Append-only audit trail; drives the Timeline tab |
| **Reports** | `GET/POST /api/reports`, `GET/PATCH/DELETE /api/reports/[id]`, `POST /api/reports/[id]/generate`, `GET /api/reports/[id]/preview`, `GET /api/reports/[id]/download` | Inline LLM narrative + PDF via `@react-pdf/renderer` → Supabase Storage `reports` bucket |
| **Risk override** | `POST /api/investigations/[id]/risk-override` | Low / Medium / High / Critical → 20/50/75/90 scoring, min-20-char justification, writes timeline + audit |
| **Investigation linking** | `POST /api/investigations` with `parent_investigation_id` | Writes `child_investigation_opened` timeline event on the parent |

---

## 3. Database Schema & Data Model

### Tables (18 total)

| # | Table | Purpose |
|---|---|---|
| 1 | `organisations` | Tenant root (one org per customer). Carries `settings` JSONB. |
| 2 | `users` | Mirrors `auth.users.id`; holds `role`, `org_id`, `full_name`, `last_read_at` notification cursor. |
| 3 | `entities` | The subject of an investigation. Carries `counterparty_type` (Phase B KYB), `date_of_birth`, `metadata` JSONB. |
| 4 | `investigations` | Investigation lifecycle. Fields: `status`, `risk_score`, `override_risk_score`, `parent_investigation_id`, `last_screened_at`, `summary` (JSON-stringified RiskAnalysis). |
| 5 | `screening_results` | One row per (investigation, screening_type) pair; UNIQUE on both. Status + hit_count + raw provider payload. |
| 6 | `screening_hits` | Individual hits. Carries `is_confirmed`, `reviewed_at`, `reviewed_by` (schema-ready, no UI yet). |
| 7 | `ownership_links` | Directed PSC/officer graph edges populated by registry screening. Drives the ownership graph. |
| 8 | `timeline_events` | Append-only per-investigation event log. 12+ known `event_type` values across phases. |
| 9 | `documents` | File metadata; bytes live in Supabase Storage `documents`. 25 MB cap enforced at API. |
| 10 | `reports` | Report runs. Columns `approved_by`, `approved_at`, `share_token` are schema-ready for Phase B+ approval workflow. |
| 11 | `analyst_notes` | Rich-text notes with pin flag. |
| 12 | `audit_log` | Immutable actor/action record. Phase-specific actions enumerated in `AUDIT_ACTIONS`. |
| 13 | `api_keys` | Hashed keys + prefix. Schema-ready; no management UI yet. |
| 14 | `risk_scoring_rules` | Per-org weight overrides for the orchestrator. Schema-ready; orchestrator still reads the hardcoded weights. |
| 15 | `sources` | **D1 Provenance**. One row per ingested evidence record (`source_type`: registry / sanctions / pep / media / llm / manual, plus `source_name`, `source_url`, `retrieved_at`, `content_hash`, `raw_content` JSONB). |
| 16 | `applications` | Onboarding application per investigation (UNIQUE on `investigation_id`). |
| 17 | `decisions` | Approve / Reject / Refer with ≥ 20-char rationale; FK `source_id` → `sources` (per D1). |
| 18 | `escalations` | Open/Resolved queue; reason ≥ 20 chars enforced in SQL. |
| 19 | `edd_assessments` | One-per-investigation EDD record with JSONB risk factors. |
| 20 | `reviews` | Periodic review scheduler rows; `due_date NOT NULL`. |

### D1 Provenance (sources table)

ADR 0007 introduces the `sources` table so that every Phase B+ artefact (decisions, EDD, escalations, reviews) can be traced back to the exact ingested evidence that justified it. Each of those four tables has a nullable `source_id` FK. The API accepts `source_id` in bodies but does not enforce it yet — the enforcement contract will tighten once the ingest pipeline starts populating `sources` systematically. This leaves `screening_hits.source` (a `text` column) as-is; it is not retroactively migrated.

### Row-Level Security

**Every table** has `ROW LEVEL SECURITY` enabled plus a standard **tenant-isolation policy set** (SELECT / INSERT / UPDATE / DELETE), all defined via:

```sql
org_id = get_org_id_for_user(auth.uid())
```

`get_org_id_for_user(uuid)` is a `SECURITY DEFINER` SQL function that looks up the caller's `users.org_id`. The admin client (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS and is **server-only** — `src/lib/supabase/admin.ts` throws if invoked in the browser.

### Migrations

12 migrations are committed and applied on the remote (`kbhlnzxhjzhmwprxgbcn`). On the remote, 5 of them are tracked under timestamp versions (Phase A tail) and 7 under numbered versions — a harmless convention split that `supabase migration list` confirms.

```
00001_initial_schema.sql           00007_risk_override.sql
00002_rls_policies.sql             00008_phase_b_core.sql
00003_functions.sql                00009_phase_a_schema_catchup.sql
00004_fix_trigger.sql              00010_phase_c_escalations.sql
00005_screening_results_unique.sql 00011_phase_d_edd_assessments.sql
00006_parent_investigation.sql     00012_phase_e_reviews.sql
```

### DB functions & triggers

| Object | Role |
|---|---|
| `get_org_id_for_user(uuid)` | RLS helper. |
| `update_updated_at()` | Trigger function; every table has a `set_updated_at_<table>` trigger. |
| `handle_new_user()` | Fires on `auth.users` insert; creates the `public.users` row from `raw_user_meta_data`. |
| `get_investigation_risk_score(uuid)` | Stored procedure (not currently called — orchestrator computes inline). |

---

## 4. API & Route Catalogue

All routes return a uniform JSON envelope via `src/lib/api/response.ts`:

```json
{ "data": <payload> }           // 200 / 201 / 202
{ "error": "...", "code": "..." } // 4xx / 5xx
```

Validation is Zod-first; UUID path params are additionally validated via `validateUUID()`. Rate limits (in-memory, per IP): screening 10/min, AI analysis 5/min.

### Health

| Method | Path | Permission |
|---|---|---|
| GET | `/api/health` | — |
| GET | `/api/health/ready` | — |

### Entities

| Method | Path | Permission |
|---|---|---|
| GET | `/api/entities` | `entities:read` |
| POST | `/api/entities` | `entities:create` |
| GET | `/api/entities/[id]` | `entities:read` |
| PATCH | `/api/entities/[id]` | `entities:update` |
| DELETE | `/api/entities/[id]` | `entities:delete` |

### Investigations

| Method | Path | Permission |
|---|---|---|
| GET | `/api/investigations` | `investigations:read` |
| POST | `/api/investigations` | `investigations:create` |
| GET | `/api/investigations/[id]` | `investigations:read` |
| PATCH | `/api/investigations/[id]` | `investigations:update` |
| DELETE | `/api/investigations/[id]` | `investigations:delete` |
| GET | `/api/investigations/[id]/timeline` | `investigations:read` |
| POST | `/api/investigations/[id]/timeline` | `investigations:update` |
| GET | `/api/investigations/[id]/graph` | `investigations:read` |
| POST | `/api/investigations/[id]/risk-override` | `investigations:update` |

### Screening

| Method | Path | Permission |
|---|---|---|
| POST | `/api/screening` (202, fire-and-forget) | `screening:run` |
| GET | `/api/screening/[investigationId]/status` | `investigations:read` |
| GET | `/api/investigations/[id]/ai-analysis` | `investigations:read` |
| POST | `/api/investigations/[id]/ai-analysis` | `screening:run` |

### Applications & Decisions (Phase B)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/applications` | `applications:read` |
| POST | `/api/applications` | `applications:create` |
| GET | `/api/applications/[id]` | `applications:read` |
| PATCH | `/api/applications/[id]` | `applications:update` |
| GET | `/api/applications/[id]/decisions` | `decisions:read` |
| POST | `/api/applications/[id]/decisions` | `decisions:create` |

### Escalations (Phase C)

| Method | Path | Permission |
|---|---|---|
| POST | `/api/investigations/[id]/escalations` | `escalations:create` |
| GET | `/api/escalations` | `escalations:resolve` OR `escalations:create` |
| GET | `/api/escalations/[id]` | `escalations:resolve` OR `escalations:create` |
| PATCH | `/api/escalations/[id]` | `escalations:resolve` |

### EDD (Phase D)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/investigations/[id]/edd` | `edd:read` |
| POST | `/api/investigations/[id]/edd` (upsert) | `investigations:update` |
| GET | `/api/edd/[id]` | `edd:read` |
| PATCH | `/api/edd/[id]` | `edd:update` |

### Reviews (Phase E)

| Method | Path | Permission |
|---|---|---|
| POST | `/api/investigations/[id]/reviews` | `investigations:update` |
| GET | `/api/reviews` | `investigations:read` |
| GET | `/api/reviews/[id]` | `investigations:read` |
| PATCH | `/api/reviews/[id]` | `investigations:update` |

### Documents & Notes

| Method | Path | Permission |
|---|---|---|
| GET | `/api/investigations/[id]/documents` | `documents:read` |
| POST | `/api/investigations/[id]/documents` (25 MB cap) | `documents:upload` |
| GET | `/api/investigations/[id]/documents/[docId]` (signed URL) | `documents:read` |
| DELETE | `/api/investigations/[id]/documents/[docId]` | `documents:delete` |
| GET | `/api/investigations/[id]/notes` | `notes:read` |
| POST | `/api/investigations/[id]/notes` | `notes:create` |
| PATCH | `/api/investigations/[id]/notes` | `notes:update` |
| DELETE | `/api/investigations/[id]/notes` | `notes:delete` |

### Reports

| Method | Path | Permission |
|---|---|---|
| GET | `/api/reports` | `reports:read` |
| POST | `/api/reports` | `reports:create` |
| GET | `/api/reports/[id]` | `reports:read` |
| PATCH | `/api/reports/[id]` | `reports:update` |
| DELETE | `/api/reports/[id]` (soft) | `reports:delete` |
| POST | `/api/reports/[id]/generate` (PDF → storage) | `reports:create` |
| GET | `/api/reports/[id]/preview` | `reports:read` |
| GET | `/api/reports/[id]/download` | `reports:read` |

### Analytics, Alerts, Notifications

| Method | Path | Permission |
|---|---|---|
| GET | `/api/analytics/dashboard?days=30\|90` | authenticated |
| GET | `/api/alerts` | `investigations:read` |
| GET | `/api/notifications` | `investigations:read` |
| PATCH | `/api/notifications` (sets `last_read_at`) | authenticated |
| POST | `/api/portfolio-monitoring` | `investigations:read` |

### Cron

| Method | Path | Auth |
|---|---|---|
| GET | `/api/cron/check-reviews` | `CRON_SECRET` bearer |

---

## 5. RBAC & Security Model

### Roles and hierarchy

Five roles are enumerated in `src/types/database.ts` (`user_role` enum) and permission-mapped in `src/lib/auth/rbac.ts`:

| Role | Hierarchy | Typical holder |
|---|:-:|---|
| `owner` | 5 | Org founder / signatory |
| `admin` | 4 | MLRO, head of compliance |
| `compliance_manager` | 3 | Compliance lead who resolves escalations and approves reports |
| `analyst` | 2 | Day-to-day caseworker |
| `viewer` | 1 | Auditor, read-only stakeholder |

### Permission count & structure

44 permissions in total, grouped by resource. Representative gating shape (full matrix in [09-PRD-DELTA.md](09-PRD-DELTA.md) and the ADRs):

| Permission | owner | admin | compliance_manager | analyst | viewer |
|---|:-:|:-:|:-:|:-:|:-:|
| `investigations:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `investigations:create/update` | ✅ | ✅ | ✅ | ✅ | — |
| `investigations:delete` | ✅ | ✅ | — | — | — |
| `reports:approve` | ✅ | ✅ | ✅ | — | — |
| `escalations:create` | ✅ | ✅ | ✅ | ✅ | — |
| `escalations:resolve` | ✅ | ✅ | ✅ | — | — |
| `edd:update` | ✅ | ✅ | ✅ | ✅ | — |
| `reviews:update` | ✅ | ✅ | ✅ | ✅ | — |
| `users:invite/update_role/remove` | ✅ | ✅ | — | — | — |
| `org:billing` | ✅ | — | — | — | — |
| `api_keys:manage` | ✅ | ✅ | — | — | — |

Route handlers gate with `hasPermission(user.role, 'resource:action')`. Server pages resolve the user first with `await connection()` + `getUser()`, then gate inline (e.g. the Escalations and Reviews pages); client components receive `userRole` as a prop and use `hasPermission` to hide action buttons.

### Auth strategy

- **Supabase Auth** (email + password) issues a session cookie that is stored by the browser and read on every request via `src/lib/supabase/server.ts` (`cookies()` awaited under `cacheComponents`).
- **Session wrapper** `getUser()` (`src/lib/auth/session.ts`) returns `{ id, email, role, orgId, fullName }` by joining `auth.users` to `public.users`.
- **Proxy middleware** (`src/middleware.ts`) refreshes stale sessions silently on every request.
- **Admin client** (`src/lib/supabase/admin.ts`) uses `SUPABASE_SERVICE_ROLE_KEY` and is explicitly server-only — a browser-side invocation throws before Supabase is touched.

### Input validation

All request bodies are validated with **Zod** schemas in `src/lib/validation/schemas.ts`. Field-level rules worth flagging:

- Rationales, resolution notes, and override justifications enforce a **≥ 20-character minimum** (also mirrored in the `escalations.reason` and `edd_assessments.notes` DB-level constraints where applicable).
- UUIDs in request bodies use Zod's `.uuid()` plus the app's `validateUUID()` guard against SQL/XSS smuggling.
- Enum fields reject unknown values with a 400 before the SQL layer is reached.

### Audit log

Every mutation calls `logAuditEvent()` (`src/lib/security/audit.ts`), which writes a row to `audit_log` with:

- `user_id`, `org_id` (null for cron-initiated actions)
- `action` (stringly-typed constant from `AUDIT_ACTIONS`): `investigation.created`, `screening.triggered`, `report.generated`, `application.created/updated`, `decision.recorded`, `escalation.created/resolved`, `edd.created/updated`, `review.scheduled/completed/marked_overdue`, plus others
- `resource_type` + `resource_id`
- `ip_address`, `user_agent`
- `data` JSONB with action-specific context

Audit log is itself RLS-protected by `org_id`; the `audit_log:read` permission unlocks a future admin audit viewer (schema is ready; no UI yet).

### Security headers

`next.config.ts` sets a strict baseline: CSP (`default-src 'self'`, `frame-ancestors 'none'`), HSTS preload, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` neutralising camera / mic / geolocation / browsing-topics.

---

## 6. Explicitly Deferred Scope (per ADR 0007)

ADR 0007 drew a deliberate boundary around the MVP so the team could ship a tight, free-tier-compatible product. The following features are **intentionally not built**, and that is a decision, not a gap:

| # | Feature (from the expanded requirement set) | Status | Rationale |
|---|---|---|---|
| **5** | **Transaction monitoring** | **Deferred** | Transactional data is a different data domain (financial event streams, not entity graphs). Building it alongside due diligence would duplicate ingest and risk-engine work, blow out the DB footprint, and divert UX attention from the core case-worker flow. It is a candidate for a future product tier. |
| **8** | **Internal procedure management** | **Deferred** | Policy and SOP governance is adjacent to compliance but is primarily a document-management problem — better served by a connected system (Notion, Confluence, Egnyte) than by rebuilding a lightweight wiki inside ThirdEye. The Documents feature already covers evidence attachments per investigation. |

ADR 0008 further records a set of **"schema-ready, Phase B+" items** — database columns and RBAC permissions that exist today but have no route / UI yet. These are not deferred in scope; they are staged for the next phase:

- Sub-investigations (`investigations.parent_investigation_id` — the API already uses it; UI for a linked-investigation tree view is Phase B+).
- Hit review workflow (`screening_hits.is_confirmed`, `reviewed_at`, `reviewed_by`).
- Report approval (`reports.approved_by`, `approved_at`) and public share token (`reports.share_token`).
- User management UI, API-key management UI, risk-scoring-rules settings.
- Real-time push alerts (today the Alerts view is poll-based with an explicit "Phase 2" banner).

Known **operational limitations** (ADR 0008 D3) that must be addressed before the first paying tenant:

- Replace the in-memory sliding-window rate limiter with Upstash Redis (`@upstash/ratelimit`).
- Add a 24-hour cache for OFAC / EU / UN sanctions list fetches (currently refetched live on every screening run).

---

## Appendix A — Directory layout

```
src/
├── app/
│   ├── (auth)/               login, register, reset-password, actions.ts
│   ├── (dashboard)/          dashboard, investigations, escalations, reviews,
│   │                         reports, settings, alerts
│   ├── api/                  35 route.ts handlers (see §4)
│   ├── layout.tsx
│   ├── page.tsx              Root redirect to /dashboard (instant=false)
│   └── middleware.ts         Session refresh
├── components/
│   ├── ui/                   shadcn primitives
│   ├── shared/               DataTable, ClientDate, EmptyState, LoadingSkeleton
│   ├── layout/               NavRail, TopBar, ContextualDrawer, CommandPalette,
│   │                         NotificationCenter
│   ├── dashboard/            Metrics strip, charts, breakdown, top-risk, activity
│   ├── investigation/        Workspace + per-tab components, dialogs
│   ├── escalations/          Inbox + resolve dialog
│   ├── reviews/              Inbox
│   ├── reports/              Report viewer client
│   ├── graph/                Ownership graph (D3)
│   └── providers/            Theme provider etc.
├── lib/
│   ├── ai/                   Provider chain, prompts
│   ├── analytics/            Dashboard query layer
│   ├── api/                  response.ts, error-handler.ts
│   ├── auth/                 session.ts, rbac.ts
│   ├── config/               feature-flags.ts, env parsing
│   ├── graph/                BFS builder, ingest-ownership
│   ├── monitoring/           Structured logging
│   ├── reports/              PDF generator, HTML preview, types
│   ├── screening/            orchestrator.ts + 4 provider modules + registry.ts
│   ├── security/             audit.ts, rate-limiter.ts, input-validator.ts
│   ├── supabase/             admin.ts, client.ts, server.ts
│   ├── utils/                Formatting helpers
│   ├── utils.ts              cn() + general helpers
│   └── validation/           schemas.ts (Zod source of truth)
├── stores/                   Zustand UI store
└── types/                    database.ts (generated), domain shims
supabase/
├── config.toml               Local Supabase init (seed disabled; see 02-DATA-MODEL)
└── migrations/               00001 … 00012
docs/
├── 02-DATA-MODEL.md
├── 03-API-CONTRACT.md
├── 08-ADR-INDEX.md
├── 09-PRD-DELTA.md
├── 11-SYSTEM-ARCHITECTURE.md (this file)
└── adr/
    ├── 0007-lifecycle-scope.md
    └── 0008-build-doc-reconciliation.md
scripts/
├── verify.sh                 Documentation gate check
├── check-data-sources.ts
└── verify-screening-data.ts
```

## Appendix B — Environment variables

Documented in `.env.example`. **Required** for production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`. Screening providers: `OPENSANCTIONS_API_KEY`, `COMPANIES_HOUSE_API_KEY`, `NEWSAPI_API_KEY`. AI providers (at least one): `OLLAMA_BASE_URL` + `OLLAMA_MODEL` and/or `OPENROUTER_API_KEY` + `OPENROUTER_MODEL`.
