DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'study_rooms' 
          AND column_name = 'whiteboard_state'
    ) THEN 
        RAISE EXCEPTION 'Column whiteboard_state does not exist on study_rooms.'; 
    END IF; 
END $$;
