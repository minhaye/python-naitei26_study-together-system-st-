-- Enable Supabase Realtime (Postgres Changes) for group channel chat.
-- Safe to run multiple times (idempotent).
--
-- Context: FastAPI connects to Postgres as the `postgres` role, which bypasses
-- RLS, so these policies do NOT protect the backend's own queries -- that
-- authorization is enforced in app/core/permissions.py. RLS here protects the
-- *Supabase Realtime* subscription path, where the frontend connects directly
-- with the end user's own access token (`authenticated` role).

-- 1. Make sure RLS is actually switched on for the tables Realtime reads.
--    (Existing policies on these tables were verified in docs/db/public;
--    this is a no-op if RLS is already enabled, but a policy with RLS
--    disabled on the table is silently ignored and leaves the table open.)
alter table public.messages enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.group_members enable row level security;

-- 2. Add messages to the supabase_realtime publication so INSERT events are
--    broadcast to subscribed clients. Skipped if already present.
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'messages'
    ) then
        alter publication supabase_realtime add table public.messages;
    end if;
end $$;
