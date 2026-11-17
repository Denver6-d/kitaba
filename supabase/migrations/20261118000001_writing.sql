-- Phase F: sentences and messages (DECISIONS F6).
-- Two more synced record types in the generic progress table:
--   writings   : free-writing and dictation history (append-only)
--   dictionary : the learner's own words, never flagged by the spelling checker
-- Records stay jsonb validated by the client's strict zod schemas (DECISIONS A3);
-- RLS, the 64 KB row cap, the 50,000-record quota and the SECURITY DEFINER
-- upsert_progress() path are unchanged. Only the allowed table names widen.
-- Written as a separate migration so it applies on top of an existing database.

alter table public.progress_records drop constraint if exists progress_records_table_name_check;

alter table public.progress_records
  add constraint progress_records_table_name_check check (
    table_name in ('srs', 'mastery', 'activity', 'achievements', 'profile', 'sessions', 'stages', 'writings', 'dictionary')
  );
