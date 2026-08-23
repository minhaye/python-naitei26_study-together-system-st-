-- User report system (feat/forum-moderation follow-up). Purely additive -- new table only,
-- no existing column touched. 030 (profiles.role / user_bans / forum_moderation_actions) is
-- already live, so this is a separate migration rather than an edit to 030.
--
-- Adds:
--   1. report_reason enum -- spam / harassment / inappropriate_content / impersonation / other.
--   2. report_status enum -- pending / resolved / dismissed.
--   3. user_reports -- one row per report a user files against another user. A moderator
--      reviewing the Reports tab typically resolves one by opening the existing Ban flow
--      against reported_user_id (see BanUserModal/ReportsTable), then marks the report
--      resolved; or dismisses it outright with no ban.
--
-- RLS: enabled with zero authenticated policies -- FastAPI (postgres role) remains the sole
-- reader/writer, same as user_bans/forum_moderation_actions (030's note).
--
-- Idempotent: CREATE TYPE/TABLE guarded by existence checks, CREATE INDEX uses IF NOT EXISTS
-- (004/009/013/030's established convention).

begin;

-- ============================================================================
-- 1. Enums
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_reason') then
    create type public.report_reason as enum ('spam', 'harassment', 'inappropriate_content', 'impersonation', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('pending', 'resolved', 'dismissed');
  end if;
end $$;

-- ============================================================================
-- 2. user_reports
-- ============================================================================
create table if not exists public.user_reports (
    id uuid primary key default gen_random_uuid(),
    reporter_id uuid not null references public.profiles(id) on delete cascade,
    reported_user_id uuid not null references public.profiles(id) on delete cascade,
    reason public.report_reason not null,
    description text,
    status public.report_status not null default 'pending',
    created_at timestamptz not null default now(),
    resolved_at timestamptz,
    resolved_by uuid references public.profiles(id) on delete restrict,
    resolution_note text,
    constraint user_reports_not_self check (reporter_id <> reported_user_id)
);

create index if not exists idx_user_reports_reported_user_id on public.user_reports (reported_user_id);
create index if not exists idx_user_reports_status on public.user_reports (status);

-- ============================================================================
-- 3. RLS -- zero authenticated policies, FastAPI is the sole reader/writer (matches
--    user_bans/forum_moderation_actions, see 030's note)
-- ============================================================================
alter table public.user_reports enable row level security;

commit;
