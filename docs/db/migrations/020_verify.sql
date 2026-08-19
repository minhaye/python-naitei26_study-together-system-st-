-- Verify for 020_enable_workspace_realtime_sync.sql. READ-ONLY. Run after applying it.

-- 1. All four tables now in the supabase_realtime publication.
select
  t.tablename,
  case when p.tablename is not null then 'OK' else 'FAIL' end as status
from (values ('messages'), ('channels'), ('study_rooms'), ('group_notes')) as t(tablename)
left join pg_publication_tables p
  on p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = t.tablename
order by t.tablename;

-- 2. group_notes has exactly one `authenticated` policy: group_notes_select_active_member,
--    a SELECT policy whose body calls is_group_member(group_id, auth.uid()).
select
  case
    when count(*) = 1
     and bool_and(policyname = 'group_notes_select_active_member')
     and bool_and(cmd = 'r') -- 'r' = SELECT
     and bool_and(qual like '%is_group_member(group_id, auth.uid())%')
    then 'OK' else 'FAIL'
  end as group_notes_select_policy_status,
  count(*) as authenticated_policy_count
from pg_policies
where schemaname = 'public' and tablename = 'group_notes' and 'authenticated' = any(roles);

-- 3. No INSERT/UPDATE/DELETE policy for `authenticated` exists on group_notes -- FastAPI
--    (postgres role) remains the sole writer.
select
  case when count(*) = 0 then 'OK' else 'FAIL' end as group_notes_no_authenticated_write_policy
from pg_policies
where schemaname = 'public' and tablename = 'group_notes'
  and 'authenticated' = any(roles) and cmd != 'r';

-- 4. RLS still enabled on all three tables (this migration never disables it anywhere).
select relname as tablename, case when relrowsecurity then 'OK' else 'FAIL' end as rls_status
from pg_class
where relnamespace = 'public'::regnamespace and relname in ('channels', 'study_rooms', 'group_notes')
order by relname;

-- 5. channels_select / study_rooms' pre-existing policies and can_access_channel()/
--    can_access_room_conversation() are untouched -- this migration adds no function and no
--    policy to either table. Prints their current policies for a manual before/after diff
--    against 020_preflight.sql's output (informational, not a pass/fail check -- this repo
--    does not have the pre-020 body captured for automated comparison here).
select 'channels' as tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'channels'
union all
select 'study_rooms', policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'study_rooms'
order by tablename, policyname;
