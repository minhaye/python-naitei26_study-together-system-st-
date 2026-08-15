-- Preflight checks for 006_direct_conversation_pair_uniqueness.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including
-- against production, at any time.
--
-- Same reasoning as 004/005's preflight scripts: one UNION ALL query so the
-- Supabase SQL Editor's single result grid shows every check at once.
-- Anything with status FAIL means 006 is not safe to run yet.
--
-- Run this BEFORE 006_direct_conversation_pair_uniqueness.sql.

with
  conversations_table_exists as (
    select
      'table_exists:conversations' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'conversations'
  ),
  no_existing_direct_conversations as (
    select
      'row_count:existing type=direct conversations (informational -- expect 0, this migration has nothing to backfill)' as check_name,
      'INFO' as status,
      count(*)::text as detail
    from public.conversations
    where type = 'direct'::public.conversation_type
  ),
  columns_not_already_present as (
    select
      'conversations.direct_user_min_id / direct_user_max_id: absent (must be 0 -- expected before 006)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' matching column(s) found' as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations'
      and column_name in ('direct_user_min_id', 'direct_user_max_id')
  ),
  no_existing_check_constraint as (
    select
      'conversations_direct_pair_check absent (must be 0 -- expected before 006)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.conversations'::regclass and conname = 'conversations_direct_pair_check'
  ),
  no_existing_unique_index as (
    select
      'conversations_direct_pair_key absent (must be 0 -- expected before 006)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'conversations' and indexname = 'conversations_direct_pair_key'
  ),
  profiles_table_exists as (
    select
      'table_exists:profiles (FK target)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  )

select * from conversations_table_exists
union all select * from no_existing_direct_conversations
union all select * from columns_not_already_present
union all select * from no_existing_check_constraint
union all select * from no_existing_unique_index
union all select * from profiles_table_exists
order by check_name;
