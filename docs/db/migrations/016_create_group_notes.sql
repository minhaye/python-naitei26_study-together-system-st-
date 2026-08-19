-- Adds `group_notes`: the backend-authoritative table for the Notes MVP.
--
-- ============================================================================
-- Why
-- ============================================================================
-- Notes is entirely mock/absent today: the Group Detail page's sidebar shows
-- a hardcoded "Owner Note" announcement banner (single string, local-only
-- React state, no backend concept -- see StudyGroupDetail.tsx), and no Notes
-- DB table/DTO/service/router exists anywhere in this repo. This migration
-- creates the table the new /notes API (app/notes/) is built on.
--
-- Scoped to a Study Group (`group_id`), NOT a Study Room -- the product/UI
-- placement for Notes is the Group sidebar (above Channels), not the Study
-- Room page. Each Group has its own shared, persistent set of Notes.
--
-- This migration:
--   1. Creates `group_notes`: id, group_id (FK groups, cascade), author_id
--      (FK profiles, restrict -- same as resources.uploader_id/
--      invitations.created_by, a note must always have a resolvable
--      author), optional title, required content, created_at/updated_at.
--      `author_id` is informational only (records who originally wrote the
--      note) -- it does NOT gate mutation permission; see note_router.py.
--   2. Enables RLS with NO policies for `authenticated` at all (full
--      deny-by-default for direct PostgREST/Supabase-client access) --
--      Notes is never read via Realtime or a direct Supabase client
--      subscription (no Realtime introduced for Notes, per MVP scope), so
--      there is no SELECT-own policy to add either. FastAPI (postgres
--      role, bypasses RLS) is the sole reader and writer, same precedent
--      as invitations' write side (013).
--
-- Read docs/db/migrations/016_preflight.sql and its output BEFORE running
-- this. Read docs/db/migrations/016_verify.sql AFTER running this.
--
-- Safety:
--   - Single transaction. Any error aborts the whole migration -- nothing
--     partial is left behind.
--   - Purely additive: CREATE TABLE IF NOT EXISTS, no existing table/column
--     is touched, no row anywhere is modified or deleted.
--   - Idempotent: CREATE TABLE/INDEX use IF NOT EXISTS.
--   - This migration corrects an earlier, never-applied draft that scoped
--     Notes to `study_rooms` instead of `groups` -- corrected before the
--     first (and only) apply, so no room_id/room_notes schema or data
--     ever existed to migrate away from.

begin;

-- ============================================================================
-- 1. group_notes
-- ============================================================================
create table if not exists public.group_notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  title text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_group_notes_group_id on public.group_notes (group_id);

-- ============================================================================
-- 2. RLS: fully closed to `authenticated` (no direct PostgREST/Supabase
--    client access, no Realtime) -- FastAPI (postgres role) is the sole
--    reader and writer.
-- ============================================================================
alter table public.group_notes enable row level security;

commit;

-- ============================================================================
-- After this migration:
--   - public.group_notes exists: group_id/author_id FKs, content required,
--     title optional, RLS enabled with zero policies for `authenticated`
--     (deny-all -- only the FastAPI/postgres role can read or write).
--   - No existing table/row anywhere was modified.
-- ============================================================================
