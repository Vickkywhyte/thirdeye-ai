-- ThirdEye AI: Screening Reliability (Audit Item D)
-- Turns the fire-and-forget provider pipeline into a durable state machine
-- with explicit retry counting, timeout recovery, and surface-level freshness.

alter table screening_results
  add column retry_count integer not null default 0 check (retry_count >= 0);

-- A distinct "last provider interaction" timestamp so the UI can show
-- freshness ("Updated 2h ago") without conflating it with the row-level
-- updated_at (which fires on any touch, including the status-reset
-- that happens at the start of a retry).
alter table screening_results
  add column last_updated_at timestamptz not null default now();

create index idx_screening_results_last_updated_at
  on screening_results (last_updated_at);

create index idx_screening_results_status_started_at
  on screening_results (status, started_at);
