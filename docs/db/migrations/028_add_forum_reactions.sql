-- Adds post_reactions / comment_reactions: Facebook-style multi-emotion reactions on Forum
-- posts and comments, replacing the old boolean-only post_likes/comment_likes tables. Same
-- emoji set and one-row-per-(target, user) shape as message_reactions (025) -- picking a new
-- emoji replaces the user's previous reaction, enforced by the unique constraints below (also
-- the ON CONFLICT targets for ForumService.set_post_reaction/set_comment_reaction's upserts).
--
-- Expand phase: creates the new tables and backfills every existing post_likes/comment_likes
-- row as a '👍' reaction (the closest equivalent of a plain "like"), but leaves post_likes/
-- comment_likes in place -- FastAPI stops reading/writing them the moment the accompanying
-- backend change (app/forum/) ships, but they aren't dropped here so rolling back that deploy
-- doesn't lose data. See 029_drop_forum_likes.sql for the contract phase (same two-step this
-- repo already used for messages.channel_id -- 004 expand / 005 contract).

create table if not exists public.post_reactions (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.forum_posts(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    -- Same fixed quick-react set as message_reactions (025) -- mirrors ALLOWED_FORUM_REACTIONS
    -- in app/forum/dto/forum_dto.py and QUICK_REACTIONS in
    -- frontend/src/pages/forum/components/ReactionPicker.tsx. Keep all three in sync if this
    -- set ever changes.
    emoji text not null check (emoji in ('👍', '❤️', '😆', '😮', '😢', '😡')),
    created_at timestamptz not null default now(),
    unique (post_id, user_id)
);

create index if not exists idx_post_reactions_post on public.post_reactions (post_id);

create table if not exists public.comment_reactions (
    id uuid primary key default gen_random_uuid(),
    comment_id uuid not null references public.comments(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    emoji text not null check (emoji in ('👍', '❤️', '😆', '😮', '😢', '😡')),
    created_at timestamptz not null default now(),
    unique (comment_id, user_id)
);

create index if not exists idx_comment_reactions_comment on public.comment_reactions (comment_id);

-- Backfill: every existing plain "like" becomes a 👍 reaction. ON CONFLICT DO NOTHING makes
-- this idempotent (safe to re-run) and defensive against a post_reactions row already existing
-- for that (post_id, user_id) pair -- e.g. someone reacted through the new API before this
-- backfill ran.
insert into public.post_reactions (id, post_id, user_id, emoji, created_at)
select gen_random_uuid(), pl.post_id, pl.user_id, '👍', pl.created_at
from public.post_likes pl
on conflict (post_id, user_id) do nothing;

insert into public.comment_reactions (id, comment_id, user_id, emoji, created_at)
select gen_random_uuid(), cl.comment_id, cl.user_id, '👍', cl.created_at
from public.comment_likes cl
on conflict (comment_id, user_id) do nothing;

-- RLS: forum_posts/post_likes/comment_likes have no authenticated-role policies captured
-- anywhere in this repo (FastAPI's postgres role bypasses RLS and has always been the sole
-- reader/writer for Forum -- unlike chat, no Realtime/direct-client access exists here). These
-- are brand-new tables so their RLS state isn't inherited from anything uncertain: enable RLS
-- with zero authenticated policies, same starting point group_notes (019) used before 020
-- added its first read policy.
alter table public.post_reactions enable row level security;
alter table public.comment_reactions enable row level security;
