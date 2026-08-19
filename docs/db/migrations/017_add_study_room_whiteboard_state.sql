-- Add whiteboard_state JSONB column to study_rooms table

ALTER TABLE public.study_rooms ADD COLUMN whiteboard_state JSONB DEFAULT NULL;
