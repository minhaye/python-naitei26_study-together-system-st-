-- Post-migration verification for 006_direct_conversation_pair_uniqueness.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- Same reasoning as 004/005's verify scripts: one UNION ALL query, one
-- result grid. Everything with status OK/INFO is expected. Anything FAIL
-- means the migration did not end up in the state it was designed to reach.

with
  columns_present as (
    select
      'conversations.' || column_name || ' present, nullable' as check_name,
      case when is_nullable = 'YES' then 'OK' else 'FAIL' end as status,
      data_type as detail
    from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations'
      and column_name in ('direct_user_min_id', 'direct_user_max_id')
  ),
  fkeys_present as (
    select
      'fkey_present:' || conname as check_name,
      'OK' as status,
      pg_get_constraintdef(oid) as detail
    from pg_constraint
    where conrelid = 'public.conversations'::regclass
      and conname in ('conversations_direct_user_min_id_fkey', 'conversations_direct_user_max_id_fkey')
  ),
  check_constraint_present as (
    select
      'conversations_direct_pair_check present' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.conversations'::regclass and conname = 'conversations_direct_pair_check'
  ),
  unique_index_present as (
    select
      'conversations_direct_pair_key present' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      coalesce(max(indexdef), 'missing') as detail
    from pg_indexes
    where schemaname = 'public' and tablename = 'conversations' and indexname = 'conversations_direct_pair_key'
  ),
  no_bad_direct_rows as (
    select
      'direct_conversations_with_missing_or_unsorted_pair (must be 0)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.conversations
    where type = 'direct'::public.conversation_type
      and (
        direct_user_min_id is null
        or direct_user_max_id is null
        or direct_user_min_id >= direct_user_max_id
      )
  ),
  no_bad_non_direct_rows as (
    select
      'non_direct_conversations_with_pair_columns_set (must be 0)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from public.conversations
    where type <> 'direct'::public.conversation_type
      and (direct_user_min_id is not null or direct_user_max_id is not null)
  ),
  no_duplicate_pairs as (
    select
      'no_duplicate_direct_pairs (must be 0)' as check_name,
      case when count(*) = 0 then 'OK' else 'FAIL' end as status,
      count(*)::text || ' duplicated pair(s)' as detail
    from (
      select direct_user_min_id, direct_user_max_id
      from public.conversations
      where type = 'direct'::public.conversation_type
      group by direct_user_min_id, direct_user_max_id
      having count(*) > 1
    ) d
  ),
  -- Untouched-by-this-migration sanity checks, same spirit as 005_verify's
  -- "conversation-based schema must still be intact" section.
  conversations_type_target_check_intact as (
    select
      'conversations_type_target_check (pre-existing, from 004) still present' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.conversations'::regclass and conname = 'conversations_type_target_check'
  ),
  rls_still_enabled as (
    select
      'rls_enabled:' || relname as check_name,
      case when relrowsecurity then 'OK' else 'FAIL' end as status,
      relrowsecurity::text as detail
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in ('conversations', 'conversation_members', 'messages')
  )

select * from columns_present
union all select * from fkeys_present
union all select * from check_constraint_present
union all select * from unique_index_present
union all select * from no_bad_direct_rows
union all select * from no_bad_non_direct_rows
union all select * from no_duplicate_pairs
union all select * from conversations_type_target_check_intact
union all select * from rls_still_enabled
order by check_name;
