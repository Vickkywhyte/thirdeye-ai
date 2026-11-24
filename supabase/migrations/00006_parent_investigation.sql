alter table investigations
  add column parent_investigation_id uuid
    references investigations(id) on delete set null;

create index idx_investigations_parent_id on investigations(parent_investigation_id);
