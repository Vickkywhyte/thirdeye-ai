-- ThirdEye AI: Phase A schema catch-up
-- Captures two columns that were added directly to the remote DB (project kbhlnzxhjzhmwprxgbcn)
-- during Phase A without a corresponding migration file. IF NOT EXISTS makes this a no-op on
-- the remote while bringing fresh local resets in line with what the code expects.

alter table investigations
  add column if not exists last_screened_at timestamptz;

create index if not exists idx_investigations_last_screened_at
  on investigations (last_screened_at);

alter table users
  add column if not exists last_read_at timestamptz;
