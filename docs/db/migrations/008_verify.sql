-- Post-migration verification for 008_track_group_owner_membership_trigger.sql.
-- READ-ONLY. Modifies nothing. Run this AFTER the migration commits.
--
-- Same reasoning as 004-007's verify scripts: one UNION ALL query, one
-- result grid. Everything with status OK/INFO is expected. Anything FAIL
-- means the migration did not end up in the state it was designed to reach
-- -- on both a fresh database and the current live one.

with
  function_present as (
    select
      'function_present:add_group_owner' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_proc
    where proname = 'add_group_owner'
      and pronamespace = 'public'::regnamespace
  ),
  function_is_security_definer as (
    select
      'function_is_security_definer:add_group_owner (must be OK)' as check_name,
      case when bool_and(prosecdef) then 'OK' else 'FAIL' end as status,
      bool_and(prosecdef)::text as detail
    from pg_proc
    where proname = 'add_group_owner'
      and pronamespace = 'public'::regnamespace
  ),
  function_body_has_upsert as (
    select
      'function_body_has_on_conflict_upsert:add_group_owner (must be OK)' as check_name,
      case when pg_get_functiondef(p.oid) like '%on conflict (group_id, user_id)%'
        then 'OK' else 'FAIL' end as status,
      pg_get_functiondef(p.oid) as detail
    from pg_proc p
    where p.proname = 'add_group_owner'
      and p.pronamespace = 'public'::regnamespace
  ),
  trigger_present_and_enabled as (
    select
      'trigger_present_and_enabled:groups_add_owner (must be OK)' as check_name,
      case when count(*) filter (where t.tgenabled <> 'D') = 1 then 'OK' else 'FAIL' end as status,
      string_agg(t.tgenabled, ',') as detail
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'groups'
      and t.tgname = 'groups_add_owner'
      and not t.tgisinternal
  ),
  trigger_is_after_insert_for_each_row as (
    select
      'trigger_is_after_insert_for_each_row:groups_add_owner (must be OK)' as check_name,
      case when pg_get_triggerdef(t.oid) like 'CREATE TRIGGER groups_add_owner AFTER INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION add_group_owner()'
        then 'OK' else 'FAIL' end as status,
      pg_get_triggerdef(t.oid) as detail
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'groups'
      and t.tgname = 'groups_add_owner'
      and not t.tgisinternal
  ),
  -- Untouched-by-this-migration sanity check: the other groups trigger must
  -- still be intact (this migration must not have affected it).
  set_updated_at_trigger_intact as (
    select
      'trigger_intact:groups_set_updated_at (must be OK -- unrelated to this migration)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'groups'
      and t.tgname = 'groups_set_updated_at'
      and not t.tgisinternal
  ),
  group_members_unique_constraint_intact as (
    select
      'unique_constraint_intact:group_members(group_id,user_id) (must be OK -- unrelated to this migration)' as check_name,
      case when count(*) = 1 then 'OK' else 'FAIL' end as status,
      count(*)::text as detail
    from pg_constraint
    where conrelid = 'public.group_members'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (group_id, user_id)'
  )

select * from function_present
union all select * from function_is_security_definer
union all select * from function_body_has_upsert
union all select * from trigger_present_and_enabled
union all select * from trigger_is_after_insert_for_each_row
union all select * from set_updated_at_trigger_intact
union all select * from group_members_unique_constraint_intact
order by check_name;
