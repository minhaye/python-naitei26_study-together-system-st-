-- Add presentation_state JSONB column to study_rooms table
-- Backs the shared "Slide Bài giảng" (presentation deck) feature, synced the same way as the
-- existing whiteboard_state column (017_add_study_room_whiteboard_state.sql) -- a JSONB blob
-- shaped {asset_path, file_name, page, page_count}, written only via the dedicated
-- PUT /study-rooms/{room_id}/presentation endpoint (host/moderator only, see
-- can_edit_whiteboard in app/core/permissions.py).

ALTER TABLE public.study_rooms ADD COLUMN presentation_state JSONB DEFAULT NULL;
