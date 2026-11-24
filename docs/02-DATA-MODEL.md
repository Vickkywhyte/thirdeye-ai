# ThirdEye AI — Data Model

**Version:** 1.1 (reconciled ADR 0008)  
**Last updated:** 2026-11-24  
**Database:** Supabase PostgreSQL — project `kbhlnzxhjzhmwprxgbcn`  
**TypeScript types:** `src/types/database.ts` (generated via `pnpm db:generate`)

---

## Enums

| Enum | Values |
|---|---|
| `entity_type` | `individual`, `company`, `trust`, `partnership`, `other` |
| `investigation_status` | `active`, `pending_review`, `completed`, `escalated`, `archived` |
| `link_type` | `ownership`, `control`, `nominee`, `beneficial_owner`, `other` |
| `report_status` | `draft`, `in_review`, `final`, `archived` |
| `report_template` | `standard_dd`, `enhanced_dd`, `sanctions_alert`, `periodic_review` |
| `screening_status` | `pending`, `running`, `completed`, `failed` |
| `screening_type` | `sanctions`, `pep`, `adverse_media`, `registry` |
| `user_role` | `owner`, `admin`, `analyst`, `viewer` |

---

## Tables

### `organisations`
Tenant root. One org per company using ThirdEye.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, default gen_random_uuid() | |
| name | text | NOT NULL | Display name |
| slug | text | NOT NULL, UNIQUE | URL-safe identifier |
| logo_url | text | nullable | |
| settings | JSONB | NOT NULL, default `{}` | e.g. `{"retention_days": 365}` |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

---

### `users`
Maps `auth.users.id` to org membership and role. Created by `on_auth_user_created` trigger reading `raw_user_meta_data`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, FK → auth.users | Matches Supabase auth UID |
| org_id | UUID | NOT NULL, FK → organisations | |
| full_name | text | NOT NULL | |
| role | user_role | NOT NULL, default `analyst` | |
| is_active | bool | NOT NULL, default true | |
| avatar_url | text | nullable | |
| last_login_at | timestamptz | nullable | Updated on successful auth |
| last_read_at | timestamptz | nullable | Notification read cursor — updated by `PATCH /api/notifications` |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

---

### `entities`
The subject of a due diligence investigation — a company, individual, trust, etc.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| org_id | UUID | NOT NULL, FK → organisations | |
| name | text | NOT NULL | |
| type | entity_type | NOT NULL, default `company` | |
| jurisdiction | text | nullable | ISO 3166-1 alpha-2 preferred |
| registration_number | text | nullable | Used for direct Companies House lookup |
| date_of_birth | text | nullable | ISO 8601 date string; relevant for `individual` only |
| address | text | nullable | |
| metadata | JSONB | NOT NULL, default `{}` | Freeform extra fields |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `investigations`
One investigation per entity-within-org. Holds lifecycle state and risk score.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| org_id | UUID | NOT NULL, FK → organisations | |
| entity_id | UUID | NOT NULL, FK → entities | |
| created_by | UUID | NOT NULL, FK → users | |
| assigned_to | UUID | nullable, FK → users | |
| status | investigation_status | NOT NULL, default `active` | |
| risk_score | int | nullable | 0–100; computed by orchestrator |
| override_risk_score | int | nullable | Score set by analyst override |
| override_reason | text | nullable | Min 20 chars; required when override set |
| override_by | UUID | nullable | FK → users (implicit) |
| override_at | timestamptz | nullable | |
| parent_investigation_id | UUID | nullable, self-ref FK | For sub-investigations — **schema-ready, no UI yet** |
| summary | text | nullable | JSON-stringified `RiskAnalysis` from AI |
| due_date | text | nullable | ISO 8601 |
| last_screened_at | timestamptz | nullable | Stamped by `POST /api/portfolio-monitoring` |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `screening_results`
One row per (investigation, screening_type) pair. Upserted at screening start; updated on completion.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| investigation_id | UUID | NOT NULL, FK → investigations | |
| type | screening_type | NOT NULL | |
| status | screening_status | NOT NULL, default `pending` | |
| hit_count | int | NOT NULL, default 0 | |
| raw_data | JSONB | NOT NULL, default `{}` | Provider metadata |
| error_message | text | nullable | |
| started_at | timestamptz | nullable | |
| completed_at | timestamptz | nullable | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |
| **Unique** | (investigation_id, type) | | Upsert-safe |

---

### `screening_hits`
Individual hits within a screening result.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| result_id | UUID | NOT NULL, FK → screening_results | |
| source | text | NOT NULL | e.g. `"OFAC SDN"`, `"GDELT"`, `"OpenSanctions"`, `"UK Companies House"` |
| match_score | int | NOT NULL | 0–100 |
| matched_name | text | nullable | Name from the source that matched |
| is_confirmed | bool | nullable | Analyst review — **schema-ready, no UI yet** |
| reviewed_at | timestamptz | nullable | **schema-ready, no UI yet** |
| reviewed_by | UUID | nullable, FK → users | **schema-ready, no UI yet** |
| data | JSONB | NOT NULL, default `{}` | Hit-specific payload (headline, URL, companyNumber, etc.) |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `timeline_events`
Append-only audit trail for every investigation lifecycle event.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| investigation_id | UUID | NOT NULL, FK → investigations | |
| event_type | text | NOT NULL | See known types below |
| title | text | NOT NULL | |
| description | text | nullable | For `screening_completed`: `"Risk score: {n}/100. {m} total hits across {k} checks."` |
| created_by | UUID | nullable, FK → users | null for system-generated events |
| data | JSONB | NOT NULL, default `{}` | Event-specific payload |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**Known `event_type` values:**

| Value | Writer |
|---|---|
| `investigation_created` | `POST /api/investigations` |
| `status_changed` | `PATCH /api/investigations/[id]` |
| `screening_completed` | Screening orchestrator |
| `risk_override` | `POST /api/investigations/[id]/risk-override` |
| `ai_analysis` | `POST /api/investigations/[id]/ai-analysis` |
| `child_investigation_opened` | `POST /api/investigations` (when parent set) |
| `document_uploaded` | `POST /api/investigations/[id]/documents` |
| `portfolio_monitored` | `POST /api/portfolio-monitoring` |

---

### `documents`
Files attached to investigations, stored in Supabase Storage bucket `documents`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| investigation_id | UUID | NOT NULL, FK → investigations | |
| org_id | UUID | NOT NULL, FK → organisations | |
| file_name | text | NOT NULL | Original filename |
| file_path | text | NOT NULL | Storage path: `{orgId}/{invId}/{timestamp}-{uuid}-{safeName}` |
| file_type | text | NOT NULL | MIME type |
| file_size_bytes | int | nullable | Max enforced at API: 25 MB |
| uploaded_by | UUID | NOT NULL, FK → users | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `reports`
Due diligence reports generated from investigation data.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| investigation_id | UUID | NOT NULL, FK → investigations | |
| org_id | UUID | NOT NULL, FK → organisations | |
| title | text | NOT NULL | |
| template | report_template | NOT NULL, default `standard_dd` | |
| status | report_status | NOT NULL, default `draft` | |
| content | JSONB | NOT NULL, default `{}` | `{status, narrative, filePath, generatedAt, …}` |
| generated_by | UUID | nullable, FK → users | |
| approved_by | UUID | nullable, FK → users | **schema-ready, no approval route/UI yet** |
| approved_at | timestamptz | nullable | **schema-ready, no approval route/UI yet** |
| share_token | text | nullable | **schema-ready, not generated/consumed yet** |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `analyst_notes`
Rich-text notes attached to investigations by analysts.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| investigation_id | UUID | NOT NULL, FK → investigations | |
| author_id | UUID | NOT NULL, FK → users | |
| content | text | NOT NULL | |
| is_pinned | bool | NOT NULL, default false | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `ownership_links`
Directed edges in the entity ownership/control graph. Populated by registry screening (`ingestOwnership`).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| org_id | UUID | NOT NULL, FK → organisations | |
| parent_entity_id | UUID | NOT NULL, FK → entities | "Owner / controller" |
| child_entity_id | UUID | NOT NULL, FK → entities | "Owned / controlled" |
| link_type | link_type | NOT NULL, default `ownership` | |
| ownership_pct | numeric | nullable | Lower bound of reported band (e.g. 25 for "25–50%") |
| is_verified | bool | NOT NULL, default false | |
| source | text | nullable | e.g. `"UK Companies House"` |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `audit_log`
Immutable audit trail of significant actions across the platform.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| org_id | UUID | NOT NULL, FK → organisations | |
| user_id | UUID | nullable, FK → users | null for system actions |
| action | text | NOT NULL | See `AUDIT_ACTIONS` in `src/lib/security/audit.ts` |
| resource_type | text | NOT NULL | e.g. `"investigation"`, `"report"` |
| resource_id | text | nullable | UUID of the affected resource |
| ip_address | inet | nullable | |
| user_agent | text | nullable | |
| data | JSONB | NOT NULL, default `{}` | Action-specific metadata |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `api_keys`
Hashed API keys for programmatic access. **Schema-ready; no management UI yet.**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| org_id | UUID | NOT NULL, FK → organisations | |
| created_by | UUID | NOT NULL, FK → users | |
| name | text | NOT NULL | Display label |
| key_hash | text | NOT NULL | Hash of the full key; never stored in plaintext |
| key_prefix | text | NOT NULL | First 8 chars; shown in UI for identification |
| permissions | JSONB | NOT NULL, default `{}` | Subset of RBAC permissions |
| is_active | bool | NOT NULL, default true | |
| last_used_at | timestamptz | nullable | |
| expires_at | timestamptz | nullable | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

### `risk_scoring_rules`
Per-org weight overrides for the risk scoring formula. **Schema-ready; app uses hardcoded weights.**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| org_id | UUID | NOT NULL, FK → organisations | |
| factor | text | NOT NULL | Matches `screening_type` values |
| weight | numeric | NOT NULL | 0.0–1.0; hardcoded default: sanctions 0.4, pep 0.25, adverse_media 0.2, registry 0.15 |
| description | text | nullable | |
| is_active | bool | NOT NULL, default true | |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

---

## DB Functions

| Function | Signature | Notes |
|---|---|---|
| `get_investigation_risk_score` | `(investigation_uuid UUID) → numeric` | Stored procedure; orchestrator computes risk inline and does not call this |
| `get_org_id_for_user` | `(user_id UUID) → text` | Used in RLS policies to scope rows by org |
| `show_limit` | `() → int` | pg_trgm extension helper |
| `show_trgm` | `(text) → text[]` | pg_trgm extension helper |

## Storage Buckets

| Bucket | Path pattern | Notes |
|---|---|---|
| `documents` | `{orgId}/{invId}/{ts}-{uuid}-{safeName}` | Investigation attachments; max 25 MB per file |
| `reports` | `{orgId}/{reportId}.pdf` | Generated PDF reports; signed URL TTL 1 hour |

---

## Reconciliation (ADR 0008)

*Section added 2026-11-24 by ADR 0008 — Build ↔ Document Reconciliation.*

The following schema elements exist in the deployed database but have no corresponding application code or UI as of Phase A. They are listed here as **schema-ready** to signal they require only routes and UI in Phase B — no migrations.

| Table.Column | Phase B deliverable |
|---|---|
| `investigations.parent_investigation_id` | Sub-investigation creation UI and linked-investigation view |
| `screening_hits.is_confirmed`, `reviewed_at`, `reviewed_by` | Hit review / confirm workflow on investigation detail page |
| `reports.approved_by`, `approved_at` | Report approval route (`PATCH /api/reports/[id]/approve`) and UI |
| `reports.share_token` | Public share link generation and anonymous report viewer |
| `api_keys.*` | API key management page (list, create, revoke) |
| `risk_scoring_rules.*` | Settings UI to configure per-org risk weights |

The `investigations.last_screened_at` column was added during Phase A for portfolio monitoring and is fully wired.
