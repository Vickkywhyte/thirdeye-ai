# ADR 0007 — Lifecycle Scope: Which Due-Diligence Features Are In the MVP

## Status
Accepted — 2026-11-03.

## Context
The expanded requirement set (features 1–8) describes an end-to-end compliance role. The MVP is a third-party screening tool. We must decide which features are in scope.

## Decision
- **In Scope (Phases B–E):** 1 (Counterparty types), 2 (Approve/Reject decisions), 3 (Periodic reviews), 4 (EDD), 6 (Screening - built), 7 (Escalations).
- **Out of Scope (Deferred):** 5 (Transaction monitoring - different data domain), 8 (Procedure management - docs governance only for now).

## Consequences
- No new paid dependencies.
- D1 (Provenance) applies to new tables only (`decisions`, `edd_assessments`, `escalations`, `reviews`), leaving `screening_hits.source` as-is.
