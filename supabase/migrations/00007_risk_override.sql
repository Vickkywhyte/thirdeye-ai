alter table investigations
  add column if not exists override_risk_score integer,
  add column if not exists override_reason      text,
  add column if not exists override_by          uuid references users(id) on delete set null,
  add column if not exists override_at          timestamptz;
