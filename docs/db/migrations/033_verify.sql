-- VERIFY 033
-- Run this to verify state after running 033_create_group_streaks.sql

BEGIN;

DO $$
BEGIN
    RAISE NOTICE '--- VERIFY 033: GROUP STREAKS ---';
    
    -- Check if table exists
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_streaks') THEN
        RAISE EXCEPTION 'FAIL: Table public.group_streaks does not exist.';
    END IF;

    -- Check RLS
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'group_streaks' AND relrowsecurity = true) THEN
        RAISE EXCEPTION 'FAIL: RLS is not enabled on public.group_streaks.';
    END IF;

    -- Check trigger functions
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_group_streak') THEN
        RAISE EXCEPTION 'FAIL: Function update_group_streak does not exist.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_update_streak_on_message') THEN
        RAISE EXCEPTION 'FAIL: Function trigger_update_streak_on_message does not exist.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_update_streak_on_study') THEN
        RAISE EXCEPTION 'FAIL: Function trigger_update_streak_on_study does not exist.';
    END IF;

    -- Check triggers
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_message_insert_for_streak' AND tgrelid = 'public.messages'::regclass) THEN
        RAISE EXCEPTION 'FAIL: Trigger on_message_insert_for_streak does not exist.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_study_room_leave_for_streak' AND tgrelid = 'public.study_room_members'::regclass) THEN
        RAISE EXCEPTION 'FAIL: Trigger on_study_room_leave_for_streak does not exist.';
    END IF;

    RAISE NOTICE 'OK: All group_streaks objects verified successfully.';
END $$;

ROLLBACK;
