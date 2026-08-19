-- Preflight checks for 016_create_group_notes.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including
-- against production, at any time.
--
-- Same one-UNION-ALL-query shape as prior preflight scripts (single result
-- grid in the Supabase SQL Editor).
--
-- Context: 016 creates a brand-new `group_notes` table (no pre-existing
-- schema to diff against, same situation as 013's `invitations`). An
-- earlier still-unapplied draft of this migration scoped Notes to
-- `study_rooms` (`room_notes`/`room_id`); that draft was corrected to the
-- `groups`-scoped design below before ever being applied, so there is no
-- `room_notes` table or data to check for/clean up here.
--
-- Run this BEFORE 016_create_group_notes.sql.

with
  required_tables_exist as (
    select
      'required_tables_exist (must be OK -- groups/profiles, the tables 016''s new FKs point at)' as check_name,
      case when count(*) = 2 then 'OK' else 'FAIL' end as status,
      string_agg(table_name, ', ') as detail
    from information_schema.tables
    where table_schema = 'public' and table_name in ('groups', 'profiles')
  ),
  group_notes_table_absent as (
    select
      'group_notes_table_absent (must be OK/none-found -- 016 creates this table; if it already exists, STOP and review before running 016)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'FAIL/already-exists' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'group_notes'
  ),
  room_notes_table_absent as (
    select
      'room_notes_table_absent (informational -- an earlier, never-applied draft of this migration used this name; confirms nothing from that draft ever landed)' as check_name,
      case when count(*) = 0 then 'OK/none-found' else 'INFO/unexpectedly-exists' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'room_notes'
  )

select * from required_tables_exist
union all select * from group_notes_table_absent
union all select * from room_notes_table_absent
order by check_name;
