-- Fix: can_access_channel() does not re-check group_members.status for the
-- private-channel / channel_members branch.
--
-- Found by comparing the live function body (pg_get_functiondef) against the
-- documented permission model in docs/db/STUDY_PLATFORM_DATABASE_SPEC.md. The
-- current definition is:
--
--   is_private = false  -> is_group_member(group_id)            [checks status='active', OK]
--   is_private = true   -> is_group_manager(group_id)            [checks status='active', OK]
--                          OR EXISTS(channel_members row)         [does NOT check status]
--
-- Consequence: a user who is banned or has left the group, but still has a
-- leftover row in channel_members for a private channel they were previously
-- added to, still passes this function. FastAPI's app/core/permissions.py
-- already re-checks active group membership unconditionally, so the REST API
-- is not affected -- but Supabase Realtime (Postgres Changes) evaluates this
-- function directly against the subscriber's own JWT, bypassing FastAPI
-- entirely. That means a banned/left member could still receive Realtime
-- INSERT events for that private channel's messages.
--
-- Fix: always require active group membership as a baseline, and additionally
-- require (group manager OR channel_members row) for private channels. This
-- matches the documented model exactly and keeps the same function signature,
-- so no policy needs to be dropped or recreated -- messages_select,
-- channels_select and channel_members_select all reference
-- can_access_channel(channel_id) and pick up the new body automatically.
--
-- Safe to run multiple times (CREATE OR REPLACE is idempotent). Does not
-- drop or disable anything.

create or replace function public.can_access_channel(p_channel_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.channels c
    where c.id = p_channel_id
      and public.is_group_member(c.group_id, p_user_id)
      and (
        c.is_private = false
        or public.is_group_manager(c.group_id, p_user_id)
        or exists (
          select 1
          from public.channel_members cm
          where cm.channel_id = c.id
            and cm.user_id = p_user_id
        )
      )
  );
$function$;
