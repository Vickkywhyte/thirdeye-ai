# ThirdEye AI — Project Instructions

**Stack:** Next.js 16.4.5 App Router · React 19.3.0 · Supabase PostgreSQL · Tailwind 4 · TanStack Table v9

---

## 1. Project North Star

ThirdEye AI is a multi-tenant SaaS for AML / KYC / enhanced due diligence investigations. One org per customer; one `users` row per team member; investigations are the primary unit of work and anchor screening results, documents, reports, notes, ownership graphs, and AI risk analysis.

## 2. Supabase project

Project id: `kbhlnzxhjzhmwprxgbcn`. The admin client (`SUPABASE_SERVICE_ROLE_KEY`) is server-only — never import it into a client component. Row-level security is enforced per-org via `get_org_id_for_user(user_id)`.

## 3. Auth & RBAC

Four roles (`owner`, `admin`, `analyst`, `viewer`) map to 37 permissions in [src/lib/auth/rbac.ts](src/lib/auth/rbac.ts). Every route calls `requirePermission()` (or returns 403) before touching data.

## 4. Screening pipeline

Fire-and-forget: `POST /api/screening` returns 202 and schedules `runScreening()`. Risk weights are hardcoded: sanctions 0.4, pep 0.25, adverse_media 0.2, registry 0.15. Per-org rule overrides exist as a schema but are not yet consumed (see ADR 0008 D4).

## 5. AI provider chain

Ollama (primary, `llama3`) → OpenRouter (fallback, `meta-llama/llama-3.2-3b-instruct`). On total failure the route returns 503 with `code: 'AI_UNAVAILABLE'` — never an invented completion.

## 6. Rate limiting

In-memory sliding window per IP. Not production-safe for multi-instance deployments (see ADR 0008 D3). Screening: 10/min. AI analysis: 5/min.

## 7. Data boundaries

- The signed-in user's email is used only to identify them in-app; never send it to external services without explicit per-call approval.
- Documents go to Supabase Storage bucket `documents`; reports to bucket `reports`. Both are private — only signed URLs leave the server.

## 8. Commit hygiene

- Never skip hooks (`--no-verify`) unless explicitly asked.
- Attribution lines are injected by the harness when it writes a commit on your behalf — don't hand-roll them.
- Branch off `main`; PRs target `main`.

## 9. Documentation

- Data model: [docs/02-DATA-MODEL.md](../docs/02-DATA-MODEL.md)
- API contract: [docs/03-API-CONTRACT.md](../docs/03-API-CONTRACT.md)
- PRD delta (Phase B deferred features): [docs/09-PRD-DELTA.md](../docs/09-PRD-DELTA.md)
- ADR index: [docs/08-ADR-INDEX.md](../docs/08-ADR-INDEX.md)

Any change that adds, removes, or renames a table, column, enum, or API route requires a matching update to the relevant doc in the same PR.

---

## 10. Phase gate

| Phase | Status | Gate |
|---|---|---|
| **A — MVP build** | ✅ Complete | Investigations, screening (4 providers), reports, AI analysis, ownership graph, dashboard, alerts, notifications, portfolio monitoring, documents all deployed. |
| **A′ — Build ↔ Document Reconciliation** | ✅ Complete (2026-11-24) | **Gate A′ passed:** ADR 0008 written; `docs/02-DATA-MODEL.md`, `docs/03-API-CONTRACT.md`, `docs/08-ADR-INDEX.md`, `docs/09-PRD-DELTA.md`, and `.claude/CLAUDE.md` all reflect actual deployed state. No feature code or migrations written. |
| **B — Phase B features** | ⏳ Next | Activates "wired-but-dormant" assets (feature flags, DOB field, prompts) and builds the 6 deferred features in [docs/09-PRD-DELTA.md](../docs/09-PRD-DELTA.md). Also replaces in-memory rate limiter with Upstash Redis and adds a 24h sanctions list cache (ADR 0008 D3) before onboarding the first paying tenant. |

**Working on Phase B:** read [docs/09-PRD-DELTA.md](../docs/09-PRD-DELTA.md) and [docs/adr/0008-build-doc-reconciliation.md](../docs/adr/0008-build-doc-reconciliation.md) first. No schema migrations are needed for the 6 Phase B features — only routes and UI.
