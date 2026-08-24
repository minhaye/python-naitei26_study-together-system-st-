-- PREFLIGHT 033
-- Run this to verify state before running 033_create_group_streaks.sql

BEGIN;

DO $$
BEGIN
    RAISE NOTICE '--- PREFLIGHT 033: GROUP STREAKS ---';
    
    -- Check if groups exists
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'groups') THEN
        RAISE EXCEPTION 'FAIL: Table public.groups does not exist.';
    END IF;

    -- Check if group_streaks already exists
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_streaks') THEN
        RAISE EXCEPTION 'FAIL: Table public.group_streaks ALREADY exists.';
    END IF;

    -- Output current groups count
    RAISE NOTICE 'INFO: Current groups row count: %', (SELECT count(*) FROM public.groups);
END $$;

ROLLBACK;
