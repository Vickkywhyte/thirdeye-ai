# ThirdEye AI — API Contract

**Version:** 1.1 (reconciled ADR 0008)  
**Last updated:** 2026-11-24  
**Base URL:** `/api` (relative; all routes are Next.js App Router route handlers)  
**Auth:** Supabase session cookie (server-side `createClient`). All routes except `/api/health*` require an authenticated session. The admin client (`SUPABASE_SERVICE_ROLE_KEY`) is used server-side only for cross-org queries; it is never exposed to the browser.

---

## Conventions

### Response envelope
All routes return JSON via `apiSuccess`, `apiCreated`, `apiError`, etc. (`src/lib/api/response.ts`):

```json
// 200 / 201 success
{ "data": <payload> }

// Error
{ "error": "<message>", "code": "<OPTIONAL_CODE>" }
```

### Auth errors
- `401 Unauthorized` — no session
- `403 Forbidden` — session exists but role lacks the required permission

### Validation
- `400 Bad Request` — Zod validation failure (body) or UUID format failure (path param)
- Input validated via `src/lib/validation/schemas.ts` (Zod) and `validateUUID()` from `src/lib/security/input-validator.ts`

### Rate limits (in-memory, per-IP)
- Screening: 10 req/min
- AI analysis: 5 req/min

---

## Health

### `GET /api/health`
Liveness probe.

**Response 200:**
```json
{ "data": { "status": "ok" } }
```

### `GET /api/health/ready`
Readiness probe — verifies DB connectivity.

**Response 200:** `{ "data": { "ready": true } }`  
**Response 503:** `{ "error": "Database not reachable" }`

---

## Entities

### `GET /api/entities`
**Permission:** `entities:read`  
**Query params:** `q` (search), `type` (entity_type), `page` (default 1), `limit` (default 20, max 100)

**Response 200:**
```json
{ "data": { "entities": [Entity], "pagination": { "page": 1, "limit": 20, "total": 42 } } }
```

### `POST /api/entities`
**Permission:** `entities:create`  
**Body:** `EntityInput` (Zod schema)

```json
{
  "name": "string (required)",
  "type": "individual | company | trust | partnership | other",
  "jurisdiction": "string?",
  "registration_number": "string?",
  "date_of_birth": "string? (ISO 8601)",
  "address": "string?"
}
```
**Response 201:** `{ "data": Entity }`

### `GET /api/entities/[id]`
**Permission:** `entities:read`  
**Response 200:** `{ "data": Entity }`

### `PATCH /api/entities/[id]`
**Permission:** `entities:update`  
**Body:** Partial `EntityInput`  
**Response 200:** `{ "data": Entity }`

### `DELETE /api/entities/[id]`
**Permission:** `entities:delete`  
**Response 200:** `{ "data": { "deleted": true } }`  
**Side-effects:** Writes `audit_log` entry (`entity.deleted`)

---

## Investigations

### `GET /api/investigations`
**Permission:** `investigations:read`  
**Query params:** `status` (investigation_status), `assigned_to` (UUID), `search` (entity name ilike), `page`, `limit` (default 20, max 100)

**Response 200:**
```json
{
  "data": {
    "investigations": [Investigation & { entity: Entity }],
    "pagination": { "page": 1, "limit": 20, "total": 42 }
  }
}
```

### `POST /api/investigations`
**Permission:** `investigations:create`  
**Body:** `CreateInvestigationInput`

```json
{
  "entity_name": "string (required)",
  "entity_type": "individual | company | trust | partnership | other",
  "jurisdiction": "string?",
  "registration_number": "string?",
  "parent_investigation_id": "UUID? (links to parent investigation)"
}
```
**Response 201:** `{ "data": Investigation & { entity: Entity } }`  
**Side-effects:** Creates `entities` row, `timeline_events` row (`investigation_created`), parent timeline event if `parent_investigation_id` set, `audit_log` entry.

### `GET /api/investigations/[id]`
**Permission:** `investigations:read`  
**Response 200:**
```json
{
  "data": {
    ...investigation,
    "entity": Entity,
    "screening_results": [ScreeningResult],
    "timeline_events": [TimelineEvent]
  }
}
```

### `PATCH /api/investigations/[id]`
**Permission:** `investigations:update`  
**Body:** `UpdateInvestigationInput`

```json
{
  "status": "active | pending_review | completed | escalated | archived",
  "assigned_to": "UUID | null",
  "summary": "string",
  "due_date": "string (ISO 8601)"
}
```
**Response 200:** `{ "data": Investigation }`  
**Side-effects:** Writes `status_changed` timeline event when `status` is provided.

### `DELETE /api/investigations/[id]`
**Permission:** `investigations:delete`  
**Response 200:** `{ "data": { "deleted": true } }`  
**Side-effects:** `audit_log` entry (`investigation.deleted`)

---

## Investigation — Screening

### `POST /api/screening`
Initiates screening. Returns **202** immediately; screening runs asynchronously.

**Permission:** `screening:run`  
**Rate limit:** 10/min per IP  
**Body:**
```json
{
  "investigation_id": "UUID",
  "types": ["sanctions", "pep", "adverse_media", "registry"]
}
```
**Response 202:**
```json
{ "message": "Screening started", "investigation_id": "UUID", "types": ["sanctions", "pep"] }
```
**Notes:**
- `registry` is silently dropped for `individual` entity type.
- Upserts `screening_results` rows before returning.
- Writes `audit_log` entry (`screening.triggered`).

### `GET /api/screening/[investigationId]/status`
**Permission:** `investigations:read`  
**Response 200:** `{ "data": [ScreeningResult] }`

---

## Investigation — AI Analysis

### `GET /api/investigations/[id]/ai-analysis`
**Permission:** `investigations:read`  
**Response 200:** `{ "data": { "analysis": RiskAnalysis | null } }`  
Returns the JSON-parsed `investigations.summary` column, or `null` if not yet generated.

### `POST /api/investigations/[id]/ai-analysis`
**Permission:** `screening:run`  
**Rate limit:** 5/min per IP  
**Response 201:** `{ "data": { "analysis": RiskAnalysis } }`  
**Error 400:** `"No completed screening results found. Run screening first."`  
**Error 503 (`AI_UNAVAILABLE`):** LLM provider failure — message describes which providers failed and why.  
**Side-effects:** Stores analysis in `investigations.summary`; writes `ai_analysis` timeline event.

---

## Investigation — Risk Override

### `POST /api/investigations/[id]/risk-override`
**Permission:** `investigations:update`  
**Body:**
```json
{
  "riskLevel": "low | medium | high | critical",
  "reason": "string (min 20 chars)"
}
```
**Response 200:** `{ "data": { "overrideScore": 75, "riskLevel": "high" } }`  
**Side-effects:** Updates `risk_score`, `override_*` columns; writes `risk_override` timeline event; writes `audit_log` entry.

**Risk level → score mapping:** `low=20`, `medium=50`, `high=75`, `critical=90`

---

## Investigation — Notes

### `GET /api/investigations/[id]/notes`
**Permission:** `notes:read`  
**Response 200:** `{ "data": [AnalystNote] }`

### `POST /api/investigations/[id]/notes`
**Permission:** `notes:create`  
**Body:** `AnalystNoteInput` — `{ "content": "string (required)" }`  
**Response 201:** `{ "data": AnalystNote }`

### `PATCH /api/investigations/[id]/notes`
**Permission:** `notes:update`  
**Body:** `{ "id": "UUID", "content"?: "string", "is_pinned"?: bool }`  
**Response 200:** `{ "data": AnalystNote }`

### `DELETE /api/investigations/[id]/notes`
**Permission:** `notes:delete`  
**Body:** `{ "id": "UUID" }`  
**Response 200:** `{ "data": { "deleted": true } }`

---

## Investigation — Documents

### `GET /api/investigations/[id]/documents`
**Permission:** `documents:read`  
**Response 200:** `{ "data": [DocumentMeta] }` where `DocumentMeta` includes `uploaded_by_name`.

### `POST /api/investigations/[id]/documents`
**Permission:** `documents:upload`  
**Content-Type:** `multipart/form-data`  
**Form field:** `file` (File)  
**Max size:** 25 MB  
**Response 201:** `{ "data": DocumentMeta }`  
**Side-effects:** Uploads to Supabase Storage bucket `documents`; inserts `documents` row; writes `document_uploaded` timeline event.

### `GET /api/investigations/[id]/documents/[docId]`
**Permission:** `documents:read`  
**Response 200:** `{ "data": { "signedUrl": "string", "expiresIn": 3600 } }`

### `DELETE /api/investigations/[id]/documents/[docId]`
**Permission:** `documents:delete`  
**Response 200:** `{ "data": { "deleted": true } }`  
**Side-effects:** Removes from Supabase Storage and deletes `documents` row.

---

## Investigation — Ownership Graph

### `GET /api/investigations/[id]/graph`
**Permission:** `investigations:read`  
**Response 200:**
```json
{
  "data": {
    "nodes": [GraphNode],
    "edges": [GraphEdge],
    "maxDepth": 2,
    "totalNodes": 5,
    "totalEdges": 4
  }
}
```
Traverses `ownership_links` up to depth 3. Cross-investigation network detection marks nodes that appear in other org investigations.

---

## Investigation — Timeline

### `GET /api/investigations/[id]/timeline`
**Permission:** `investigations:read`  
**Query params:** `page`, `limit`  
**Response 200:** `{ "data": { "events": [TimelineEvent], "pagination": {...} } }`

---

## Reports

### `GET /api/reports`
**Permission:** `reports:read`  
**Query params:** `status` (report_status), `page`, `limit`  
**Response 200:** `{ "data": { "reports": [Report], "total": 42, "page": 1, "limit": 20 } }`

### `POST /api/reports`
**Permission:** `reports:create`  
**Body:** `{ "investigationId": "UUID", "template": "standard_dd | …", "title": "string" }`  
**Response 201:** `{ "data": { "report": Report } }`  
**Behaviour:** Creates report row + attempts to generate LLM narrative inline. If LLM fails, report is left as `draft`; if LLM succeeds, status is `final`.

### `GET /api/reports/[id]`
**Permission:** `reports:read`  
**Response 200:** `{ "data": { "report": Report, "investigation": Investigation, "entity": Entity } }`

### `PATCH /api/reports/[id]`
**Permission:** `reports:update`  
**Body:** `{ "title"?: "string", "status"?: "draft | in_review | final | archived" }`  
**Response 200:** `{ "data": { "report": Report } }`

### `DELETE /api/reports/[id]`
**Permission:** `reports:delete`  
**Response 200:** `{ "data": { "message": "Report archived" } }`  
**Note:** Soft-deletes by setting status to `archived`.

### `POST /api/reports/[id]/generate`
**Permission:** `reports:create`  
**Response 200:** `{ "data": { "url": "signed-url", "filePath": "string", "status": "ready" } }`  
**Behaviour:** Builds `ReportData`, generates PDF via `@react-pdf/renderer`, uploads to `reports` bucket, returns 1-hour signed URL. Writes `audit_log` entry (`report.generated`).

### `GET /api/reports/[id]/preview`
**Permission:** `reports:read`  
**Response 200:** `{ "data": { "html": "string" } }`

### `GET /api/reports/[id]/download`
**Permission:** `reports:read`  
**Response 200:** `{ "data": { "url": "signed-url" } }`

---

## Analytics

### `GET /api/analytics/dashboard`
**Permission:** authenticated (any role)  
**Query params:** `days=30|90` (trend period)  
**Response 200:**
```json
{
  "data": {
    "metrics": DashboardMetrics,
    "riskDistribution": [RiskBand],
    "trend": [TrendPoint],
    "screeningBreakdown": ScreeningBreakdown,
    "topRiskEntities": [TopRiskEntity],
    "recentActivity": [RecentActivityItem]
  }
}
```

**`DashboardMetrics` shape:**
```json
{
  "totalInvestigations": 0,
  "activeInvestigations": 0,
  "completedThisMonth": 0,
  "avgRiskScore": 0,
  "highRiskCount": 0,
  "pendingReviews": 0,
  "monitoredCount": 0
}
```

---

## Alerts

### `GET /api/alerts`
**Permission:** `investigations:read`  
**Query params:** `limit` (default 50, max 100)  
**Response 200:** `{ "data": { "alerts": [AlertItem], "total": 42 } }`

**Filtering logic:**
- Only `event_type` values in `ACTIONABLE_TYPES`: `risk_override`, `screening_completed`, `child_investigation_opened`, `status_changed`, `escalated`
- `screening_completed` events with 0 hits or risk score < 40 are **excluded**
- Deduplicated: only the most recent event per `(investigation_id, event_type)` pair is returned

---

## Notifications

### `GET /api/notifications`
**Permission:** `investigations:read`  
**Response 200:** `{ "data": { "notifications": [NotificationItem], "last_read_at": "ISO string | null" } }`  
Returns 10 most recent timeline events across all org investigations + the user's `last_read_at` cursor.

### `PATCH /api/notifications`
**Permission:** authenticated  
**Response 200:** `{ "data": { "last_read_at": "ISO string" } }`  
Updates `users.last_read_at = now()` for the calling user.

---

## Portfolio Monitoring

### `POST /api/portfolio-monitoring`
**Permission:** `investigations:read`  
**Response 200:** `{ "data": { "monitored": 42 } }`  
**Behaviour:** Stamps `last_screened_at = now()` on all non-archived investigations in the org; inserts a `portfolio_monitored` timeline event per investigation.

---

## Reconciliation (ADR 0008)

*Section added 2026-11-24 by ADR 0008 — Build ↔ Document Reconciliation.*

The following routes are **not yet built** but have backing schema and RBAC as of Phase A. They are Phase B deliverables.

| Route | Method | Permission | Phase B deliverable |
|---|---|---|---|
| `/api/users` | GET | `users:read` | List org members |
| `/api/users/invite` | POST | `users:invite` | Email invite flow |
| `/api/users/[id]` | PATCH | `users:update_role` | Change member role |
| `/api/users/[id]` | DELETE | `users:remove` | Remove member |
| `/api/api-keys` | GET/POST/DELETE | `api_keys:manage` | API key management |
| `/api/reports/[id]/approve` | POST | `reports:approve` | Report approval workflow |
| `/api/reports/[id]/share` | POST | `reports:create` | Generate public share token |
| `/api/investigations/[id]/hits/[hitId]` | PATCH | `screening:review` | Confirm / dismiss a screening hit |
| `/api/settings/risk-rules` | GET/PATCH | `settings:update` | Per-org risk weight configuration |
| `/api/audit-log` | GET | `audit_log:read` | Browse audit log |
