-- 030: Notification system enhancements for the full FB-style notification feature.
--
-- Adds:
-- 1. `data` JSONB column on `notifications` for flexible metadata (task_count,
--    resource_name, room_name, message_preview, other_count, etc.) that varies
--    per notification type and cannot be captured by the existing FK columns.
-- 2. Partial index on (user_id) WHERE is_read = FALSE -- makes the unread-count
--    query (used by the bell badge) sub-millisecond regardless of total row count.
-- 3. Adds 8 new values to the `notification_type` PostgreSQL enum to cover all
--    four tabs: Forum, Groups, Goals, Messages.
-- 4. Enables Supabase Realtime on the `notifications` table so INSERT events are
--    pushed to the frontend via WebSocket (same pattern as messages / channels).
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL) connected to your project.
-- The file is also kept in docs/db/migrations/ for Git history.

-- ============================================================================
-- 1. Extend the notification_type enum with new values
-- ============================================================================
-- Each ADD VALUE is idempotent (IF NOT EXISTS) so re-running is safe.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_daily_reminder';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_due_soon';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_overdue';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'group_new_resource';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'study_room_first_joiner';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'study_room_active';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_direct_message';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'message_group';

-- ============================================================================
-- 2. Add the `data` JSONB column for flexible per-type metadata
-- ============================================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- 3. Partial index for fast unread-count queries (< 1ms)
-- ============================================================================
-- Only indexes rows where is_read = FALSE, so the index stays tiny even as the
-- table grows with millions of historical (read) notifications.

CREATE INDEX IF NOT EXISTS idx_notifications_unread_user
ON notifications (user_id)
WHERE is_read = FALSE;

-- ============================================================================
-- 4. Enable Supabase Realtime on the notifications table
-- ============================================================================
-- This makes Supabase push postgres_changes (INSERT/UPDATE) events to frontend
-- clients subscribed to the `notifications` channel filtered by user_id.
-- If the table is already in the publication, this is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END
$$;
