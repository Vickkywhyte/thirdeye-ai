-- ThirdEye AI: Evidence Provenance (Audit Item C)
-- Adds an authority tier to sources so analysts can grade the trustworthiness
-- of each provenance record (tier_1 = primary regulator/official register,
-- tier_2 = established secondary, tier_3 = other analyst-attached).

alter table sources
  add column authority_tier text not null default 'tier_3'
    check (authority_tier in ('tier_1', 'tier_2', 'tier_3'));

create index idx_sources_authority_tier on sources (authority_tier);
