# ADR Index

Architecture Decision Records for ThirdEye AI. Each ADR is immutable once accepted; superseding decisions are recorded as new ADRs that reference the prior one.

| ID | Title | Status | Date | Summary |
|---|---|---|---|---|
| [0008](adr/0008-build-doc-reconciliation.md) | Build ↔ Document Reconciliation (Phase A′) | Accepted | 2026-11-24 | Records every drift between BUILD_GUIDE.md and the deployed Phase A codebase. Codifies four handling decisions (D1–D4): accept version drift, document "wired but dormant" items for Phase B activation, flag operational limits (in-memory rate limiter, live sanctions fetches) as pre-production blockers, and list schema-ready features deferred to Phase B. |
