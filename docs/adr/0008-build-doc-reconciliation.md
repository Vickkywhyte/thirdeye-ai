# ADR 0008 — Build ↔ Document Reconciliation (Phase A′)

**Status:** Accepted  
**Date:** 2026-11-24  
**Authors:** vickkywhyte (ThirdEye AI)  
**Context:** First formal reconciliation pass after Phase A (MVP build completion). The BUILD_GUIDE.md and DEPLOYMENT.md pre-dated the actual construction; this ADR records every drift between the documented spec and the deployed codebase, and codifies how each will be handled going into Phase B.

---

## Drift Register

The table below lists every item where the deployed build diverges from BUILD_GUIDE.md or the implicit PRD intent. Each item is assigned to one of the four decisions (D1–D4) below.

| # | Category | Spec / Expectation | Actual (deployed) | Decision |
|---|---|---|---|---|
| 1 | Dependency version | Next.js 14+ | Next.js 16.4.5 | D1 |
| 2 | Dependency version | Tailwind CSS 3+ | Tailwind CSS 4 | D1 |
| 3 | Dependency version | TanStack Table v8 | TanStack Table v9 (`LegacyColumnDef` pattern) | D1 |
| 4 | Dependency version | "Free tier" Supabase | Supabase hosted (project `kbhlnzxhjzhmwprxgbcn`) | D1 |
| 5 | Feature flag enforcement | 4 env-var feature flags defined | Flags defined in `feature-flags.ts` but `isFeatureEnabled()` never called at any route or component | D2 |
| 6 | Rate limiter durability | Implied Redis for production | In-memory sliding window in `rate-limiter.ts`; resets on deploy; not shared across instances | D3 |
| 7 | Risk scoring configurability | `risk_scoring_rules` table in schema | Table exists and has RBAC permission (`settings:update`) but app uses hardcoded weights (`sanctions:0.4, pep:0.25, adverse_media:0.2, registry:0.15`); table is never queried | D4 |
| 8 | Sanctions list performance | Implied: cached list data | OFAC/EU/UN lists fetched live (HTTP) on every screening run; no DB or Redis cache | D3 |
| 9 | Report approval flow | `approved_by`/`approved_at` columns, `reports:approve` permission | Schema columns and RBAC exist; no route (`PATCH /reports/[id]/approve`) and no UI | D4 |
| 10 | Hit review workflow | `screening_hits.is_confirmed`, `reviewed_at`, `reviewed_by` columns | Schema columns exist; no API route and no UI to review or confirm individual hits | D4 |
| 11 | Report share token | `reports.share_token` column | Column exists; no generation route and no public consumption endpoint | D4 |
| 12 | User management | `users:invite`, `users:update_role`, `users:remove` permissions | RBAC permissions defined; no routes and no UI | D4 |
| 13 | API key management | `api_keys` table, `api_keys:manage` permission | Table and RBAC exist; no routes and no UI | D4 |
| 14 | Real-time / push alerts | Implied by "Alerts" section | Pull-based polling via `GET /api/notifications`; alerts page shows explicit "Phase 2" banner | D4 |
| 15 | PEP data source | "OpenSanctions.org + Wikidata" (BUILD_GUIDE) | OpenSanctions `/match/default` REST API only; Wikidata not integrated | D1 |
| 16 | Adverse media prompts | `ADVERSE_MEDIA_CLASSIFICATION_PROMPT` defined | Defined in `prompts.ts` but not wired; adverse media uses a different inline prompt in `adverse-media.ts` | D2 |
| 17 | Entity resolution | `ENTITY_RESOLUTION_PROMPT` defined | Defined in `prompts.ts` but no route calls it | D4 |
| 18 | Sub-investigation UI | `parent_investigation_id` column, API logic | Column and POST body field exist; no UI to create or view linked sub-investigations | D4 |
| 19 | Date-of-birth in entity form | `date_of_birth` in entity schema + DB column | Column and Zod field exist; `NewInvestigationForm` does not expose the field | D2 |
| 20 | Multi-jurisdiction registry | Implied broader coverage | UK Companies House only; no EU/international registry adapter | D4 |

---

## Decision D1 — Accept version drift; freeze at current locked versions

**Rationale:** Upgraded framework and library versions deliver security patches and API improvements available at the time of construction. Downgrading would be purely cosmetic. The BUILD_GUIDE.md language ("14+", "v8", "3+") expressed minimums, not exact pins.

**Action:** Update `docs/02-DATA-MODEL.md`, `docs/03-API-CONTRACT.md`, and this ADR index to reflect actual versions. No code changes required.

**Affects:** Drift rows 1–4, 15.

---

## Decision D2 — Document as "wired but dormant"; activate in Phase B

These items have correct infrastructure (functions, columns, or prompts) but lack the final connection point. They are not broken; they are simply not activated.

**Action:**
- `feature-flags.ts`: Phase B first task is to gate `FEATURE_AI_ANALYSIS`, `FEATURE_PDF_EXPORT`, `FEATURE_OWNERSHIP_GRAPH`, and `FEATURE_ADVERSE_MEDIA` at their respective routes and UI entry points.
- `ADVERSE_MEDIA_CLASSIFICATION_PROMPT`: Evaluate whether the per-article structured JSON prompt should replace or augment the current inline summary prompt during Phase B adverse media hardening.
- `date_of_birth` field: Expose in `NewInvestigationForm` as an optional field for `individual` entity type only.

**Affects:** Drift rows 5, 16, 19.

---

## Decision D3 — Document as known operational limitation; replace before first paying tenant

The in-memory rate limiter and live sanctions list fetches are acceptable for a single-instance development/demo deployment but are production blockers for a multi-instance SaaS.

**Action (Phase B):**
1. Replace `createRateLimiter` with `@upstash/ratelimit` backed by Upstash Redis (free tier covers dev/staging).
2. Add a `sanctions_cache` table (or Redis key) to store OFAC/EU/UN list snapshots with a 24-hour TTL. The orchestrator checks cache age before fetching.

**Affects:** Drift rows 6, 8.

---

## Decision D4 — List as "schema-ready, Phase B features"; add to PRD delta

These items have correct database columns and/or RBAC permissions but no backend routes or UI. They are confirmed Phase B scope.

**Action:** Each item is logged in `docs/09-PRD-DELTA.md` as a delta row with status `schema-ready`. No schema migrations needed in Phase B for these items; only routes and UI are required.

**Affects:** Drift rows 7, 9–14, 17–18, 20.

---

## Consequences

- All documentation in `docs/` now reflects the actual deployed state.
- Phase B begins with a clean, accurate baseline.
- No schema migrations are created by this ADR.
- No feature code is written by this ADR.
- The Gate A′ checklist (§10 of `.claude/CLAUDE.md`) is marked complete upon merge of these documentation changes.
