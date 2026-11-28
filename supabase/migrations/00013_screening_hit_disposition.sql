-- ThirdEye AI: Hit Review Workflow
-- Adds disposition + review_rationale to screening_hits so analysts can
-- record a formal compliance judgment on each hit, backed by a rationale.
-- Powers PATCH /api/screening/hits/[id] and the Review Hit dialog.

alter table screening_hits
  add column disposition text not null default 'unreviewed'
    check (disposition in (
      'unreviewed',
      'confirmed',
      'false_positive',
      'needs_review',
      'unable_to_determine',
      'not_applicable'
    ));

alter table screening_hits
  add column review_rationale text
    check (review_rationale is null or char_length(review_rationale) >= 20);

create index idx_screening_hits_disposition on screening_hits (disposition);
