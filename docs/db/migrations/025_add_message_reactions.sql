-- Adds message_reactions: Messenger-style emoji reactions on chat messages (Channel, Study
-- Room, and Direct conversations alike -- everything already funnels through `messages`/
-- `conversations`, see 004). One row per (message, user): picking a new emoji replaces the
-- user's previous reaction on that message, enforced by the unique constraint below (also
-- the ON CONFLICT target for MessagesService.set_reaction's upsert).
--
-- Purely additive new table -- no existing code reads/writes it yet, so this is both the
-- expand and contract phase at once (same reasoning as 023/024).

create table if not exists public.message_reactions (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references public.messages(id) on delete cascade,
    -- Denormalized from messages.conversation_id at write time (see
    -- MessagesService.set_reaction) purely so Realtime subscribers can filter this table by
    -- conversation_id the same way useChannelMessagesRealtime.ts already filters `messages`
    -- -- Supabase's postgres_changes filter only supports a single equality predicate, and
    -- message_reactions has no other conversation-scoped column to filter on.
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    -- Fixed quick-react set -- mirrors ALLOWED_MESSAGE_REACTIONS in
    -- app/messages/dto/message_dto.py and QUICK_REACTIONS in
    -- frontend/src/components/chat/MessageReactions.tsx. Keep all three in sync if this set
    -- ever changes.
    emoji text not null check (emoji in ('👍', '❤️', '😆', '😮', '😢', '😡')),
    created_at timestamptz not null default now(),
    unique (message_id, user_id)
);

create index if not exists idx_message_reactions_conversation
  on public.message_reactions (conversation_id);

-- Required so a Realtime DELETE event's `old` payload carries message_id/conversation_id,
-- not just the row id -- Postgres's default replica identity only ships the primary key on
-- delete, and useMessageReactionsRealtime.ts needs message_id to know which message to
-- re-hydrate.
alter table public.message_reactions replica identity full;

-- RLS: same shape as messages_select (004 §13) -- FastAPI (postgres role) bypasses RLS and
-- remains the sole writer, no authenticated INSERT/UPDATE/DELETE policy is added.
alter table public.message_reactions enable row level security;

drop policy if exists message_reactions_select on public.message_reactions;
create policy message_reactions_select on public.message_reactions
  for select to authenticated
  using (public.can_access_conversation(conversation_id));

-- Realtime: broadcast INSERT/UPDATE/DELETE so other viewers see reaction changes live --
-- unlike `messages` (001), which only ever needed INSERT.
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'message_reactions'
    ) then
        alter publication supabase_realtime add table public.message_reactions;
    end if;
end $$;
