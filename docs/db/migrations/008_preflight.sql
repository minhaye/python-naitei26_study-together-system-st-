-- Preflight checks for 008_track_group_owner_membership_trigger.sql.
-- READ-ONLY. Modifies nothing. Safe to run any number of times, including
-- against production, at any time.
--
-- Same reasoning as 004-007's preflight scripts: one UNION ALL query so the
-- Supabase SQL Editor's single result grid shows every check at once.
--
-- Unlike 004-007, none of these checks are expected to FAIL before running
-- 008 -- on the CURRENT live database, add_group_owner()/groups_add_owner
-- already exist (that is the whole reason this migration exists: to capture
-- them in version control). The two INFO rows print the live function body
-- and trigger definition verbatim so they can be diffed against what
-- 008_track_group_owner_membership_trigger.sql is about to (re-)create,
-- before running it.
--
-- On a FRESH database built only from migrations 001-007 (no 008 yet), the
-- function_exists/trigger_exists checks below WILL show FAIL/0 -- that is the
-- expected, motivating case for this migration, not an error.
--
-- Run this BEFORE 008_track_group_owner_membership_trigger.sql.

with
  groups_table_exists as (
    select
      'table_exists:groups' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'groups'
  ),
  group_members_table_exists as (
    select
      'table_exists:group_members' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from information_schema.tables
    where table_schema = 'public' and table_name = 'group_members'
  ),
  group_members_unique_constraint as (
    select
      'unique_constraint_exists:group_members(group_id,user_id)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.group_members'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (group_id, user_id)'
  ),
  function_exists as (
    select
      'function_exists:add_group_owner (informational -- FAIL is expected on a fresh DB before 008)' as check_name,
      case when count(*) >= 1 then 'OK' else 'INFO/FAIL-expected-on-fresh-db' end as status,
      count(*)::text as detail
    from pg_proc
    where proname = 'add_group_owner'
      and pronamespace = 'public'::regnamespace
  ),
  trigger_exists as (
    select
      'trigger_exists:groups_add_owner (informational -- FAIL is expected on a fresh DB before 008)' as check_name,
      case when count(*) = 1 then 'OK' else 'INFO/FAIL-expected-on-fresh-db' end as status,
      count(*)::text as detail
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'groups'
      and t.tgname = 'groups_add_owner'
      and not t.tgisinternal
  ),
  current_function_body as (
    select
      'CURRENT add_group_owner() body -- READ THIS before running 008' as check_name,
      'INFO' as status,
      coalesce(pg_get_functiondef(p.oid), 'function not found') as detail
    from pg_proc p
    where p.proname = 'add_group_owner'
      and p.pronamespace = 'public'::regnamespace
  ),
  current_trigger_definition as (
    select
      'CURRENT groups_add_owner trigger definition -- READ THIS before running 008' as check_name,
      'INFO' as status,
      coalesce(pg_get_triggerdef(t.oid), 'trigger not found') as detail
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'groups'
      and t.tgname = 'groups_add_owner'
      and not t.tgisinternal
  )

select * from groups_table_exists
union all select * from group_members_table_exists
union all select * from group_members_unique_constraint
union all select * from function_exists
union all select * from trigger_exists
union all select * from current_function_body
union all select * from current_trigger_definition
order by check_name;
