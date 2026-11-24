-- ThirdEye AI: add the unique constraint that screening upserts depend on.
--
-- POST /api/screening writes screening_results with
--   .upsert(..., { onConflict: 'investigation_id,type' })
-- Postgres requires a unique or exclusion constraint matching the ON CONFLICT
-- target. Without one it raises 42P10 and the write fails. Because the route
-- discarded the error, every screening run silently persisted zero rows while
-- still updating risk_score and inserting a "Screening completed" timeline
-- event -- which is why the Screening tab stayed empty.
--
-- One row per investigation x check type is also the correct data model.

alter table screening_results
  add constraint screening_results_investigation_id_type_key
  unique (investigation_id, type);
