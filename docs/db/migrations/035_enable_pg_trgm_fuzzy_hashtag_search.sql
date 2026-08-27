-- 035_enable_pg_trgm_fuzzy_hashtag_search.sql
--
-- Enables the pg_trgm PostgreSQL extension and adds a trigram GIN index on
-- tags.name to support fast fuzzy hashtag search (similarity matching).
--
-- Why pg_trgm?
--   The /forum/tags/search endpoint (ForumService.search_tags) now combines:
--     1. ilike substring match     → "tienghat" matches "tienghat123"
--     2. similarity() >= 0.2       → "tienghat" fuzzy-matches "tiengnhat"
--   Without a trigram index, similarity() scans the entire tags table on every
--   request. The GIN index makes it sub-millisecond even with thousands of tags.
--
-- Supabase note:
--   pg_trgm ships with Supabase and is safe to enable via CREATE EXTENSION IF NOT EXISTS.
--   It is a Postgres built-in contrib module — no additional installation required.
--
-- Idempotent: both CREATE EXTENSION IF NOT EXISTS and CREATE INDEX IF NOT EXISTS
-- are safe to re-run.
--
-- No rollback: dropping the index is fine; dropping the extension requires checking
-- that no other objects depend on it — omitted because Supabase already enables
-- pg_trgm by default in most projects anyway.

BEGIN;

-- 1. Enable pg_trgm (safe no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN trigram index on tags.name for O(1) similarity lookups
CREATE INDEX IF NOT EXISTS idx_tags_name_trgm
    ON public.tags
    USING GIN (name gin_trgm_ops);

COMMIT;
