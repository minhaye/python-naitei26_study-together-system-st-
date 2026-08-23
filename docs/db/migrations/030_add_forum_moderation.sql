-- Forum Moderator + Ban system (feat/forum-moderation). Purely additive -- no existing
-- column/table is touched beyond two new nullable/defaulted columns, so this is a single
-- expand-only migration (no contract phase needed, same as 023/024).
--
-- Adds:
--   1. profiles.role (profile_role enum: user/moderator/admin) -- the first-ever global,
--      site-wide role in this app; every prior "role" (GroupMemberRole, StudyRoomMemberRole)
--      was scoped to a single Group/Room. Defaults every existing profile to 'user'.
--   2. user_bans -- one row per (user, ban_type) grant. ban_type covers post/comment
--      creation, messaging, group creation, group joining, and study room joining
--      independently. Application
--      code (ModerationService) treats a row as "active" when revoked_at is null and
--      (expires_at is null or expires_at > now()) -- not encoded as a partial index, since a
--      now()-based predicate isn't IMMUTABLE.
--   3. forum_moderation_actions -- unified audit log for deletes/bans/unbans/role grants.
--   4. forum_posts.deleted_by -- soft-delete attribution, same convention as
--      channels.deleted_by/study_rooms.deleted_by (009/010).
--
-- RLS: enabled on both new tables with zero authenticated policies -- FastAPI (postgres role)
-- remains the sole reader/writer, same as the rest of Forum (028's note: no Realtime/
-- direct-client access exists here, unlike chat).
--
-- Idempotent: CREATE TYPE/TABLE guarded by existence checks, ALTER TABLE ADD COLUMN uses IF
-- NOT EXISTS, CREATE INDEX uses IF NOT EXISTS (004/009/013's established convention).

begin;

-- ============================================================================
-- 1. Enums
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_role') then
    create type public.profile_role as enum ('user', 'moderator', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'ban_type') then
    create type public.ban_type as enum ('post', 'message', 'create_group', 'join_group', 'join_room');
  end if;
  if not exists (select 1 from pg_type where typname = 'forum_moderation_action_type') then
    create type public.forum_moderation_action_type as enum (
      'delete_post', 'delete_comment', 'ban_user', 'unban_user', 'grant_moderator', 'revoke_moderator'
    );
  end if;
end $$;

-- ============================================================================
-- 2. profiles.role
-- ============================================================================
alter table public.profiles add column if not exists role public.profile_role not null default 'user';

-- ============================================================================
-- 3. user_bans
-- ============================================================================
create table if not exists public.user_bans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    ban_type public.ban_type not null,
    reason text,
    created_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamptz not null default now(),
    expires_at timestamptz,
    revoked_at timestamptz,
    revoked_by uuid references public.profiles(id) on delete restrict
);

create index if not exists idx_user_bans_user_id on public.user_bans (user_id);

-- ============================================================================
-- 4. forum_moderation_actions
-- ============================================================================
create table if not exists public.forum_moderation_actions (
    id uuid primary key default gen_random_uuid(),
    moderator_id uuid not null references public.profiles(id) on delete restrict,
    action public.forum_moderation_action_type not null,
    target_user_id uuid references public.profiles(id) on delete restrict,
    target_id uuid,
    reason text,
    created_at timestamptz not null default now()
);

create index if not exists idx_forum_moderation_actions_target_user on public.forum_moderation_actions (target_user_id);
create index if not exists idx_forum_moderation_actions_moderator on public.forum_moderation_actions (moderator_id);

-- ============================================================================
-- 5. forum_posts.deleted_by
-- ============================================================================
alter table public.forum_posts add column if not exists deleted_by uuid references public.profiles(id) on delete restrict;

-- ============================================================================
-- 6. RLS -- zero authenticated policies, FastAPI is the sole reader/writer (matches the rest
--    of Forum, see 028's note)
-- ============================================================================
alter table public.user_bans enable row level security;
alter table public.forum_moderation_actions enable row level security;

commit;

-- ============================================================================
-- Manual bootstrap step (run separately, after this migration commits): promote your own
-- account to Admin so you can grant Moderator to others through the new dashboard UI. Find
-- your email in Supabase Auth > Users, then:
-- ============================================================================
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'REPLACE_ME@example.com');
