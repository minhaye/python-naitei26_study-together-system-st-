-- MIGRATION 033: Create Group Streaks and Triggers
-- Goal: Gamify group engagement by tracking daily message and study room activity.

BEGIN;

CREATE TABLE public.group_streaks (
    group_id UUID PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0,
    highest_streak INT NOT NULL DEFAULT 0,
    last_streak_date DATE,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    today_messages_count INT NOT NULL DEFAULT 0,
    today_study_minutes INT NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.group_streaks ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read group streaks (used for public group listings)
CREATE POLICY group_streaks_select ON public.group_streaks
FOR SELECT USING (true);

-- No write policy for authenticated. Only triggers/backend can write.

-- Core function to update the streak logic passively on activity
CREATE OR REPLACE FUNCTION public.update_group_streak(p_group_id UUID, p_type TEXT, p_amount INT)
RETURNS void AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_streak RECORD;
BEGIN
    -- get or insert streak record
    SELECT * INTO v_streak FROM public.group_streaks WHERE group_id = p_group_id FOR UPDATE;
    IF NOT FOUND THEN
        INSERT INTO public.group_streaks (group_id, activity_date) VALUES (p_group_id, v_today)
        RETURNING * INTO v_streak;
    END IF;

    -- Handle day rollover logic
    IF v_streak.activity_date < v_today THEN
        -- If they missed yesterday (last_streak_date is null or older than yesterday)
        IF v_streak.last_streak_date IS NULL OR v_streak.last_streak_date < v_today - 1 THEN
            v_streak.current_streak := 0;
        END IF;
        
        -- Reset daily counters
        v_streak.today_messages_count := 0;
        v_streak.today_study_minutes := 0;
        v_streak.activity_date := v_today;
    END IF;

    -- Add new activity
    IF p_type = 'message' THEN
        v_streak.today_messages_count := v_streak.today_messages_count + p_amount;
    ELSIF p_type = 'study' THEN
        v_streak.today_study_minutes := v_streak.today_study_minutes + p_amount;
    END IF;

    -- Check threshold for today (5 messages OR 10 study minutes)
    -- Only increment if we haven't already incremented for today
    IF (v_streak.today_messages_count >= 5 OR v_streak.today_study_minutes >= 10) AND (v_streak.last_streak_date IS NULL OR v_streak.last_streak_date < v_today) THEN
        v_streak.current_streak := v_streak.current_streak + 1;
        IF v_streak.current_streak > v_streak.highest_streak THEN
            v_streak.highest_streak := v_streak.current_streak;
        END IF;
        v_streak.last_streak_date := v_today;
    END IF;

    -- Update the record
    UPDATE public.group_streaks SET
        current_streak = v_streak.current_streak,
        highest_streak = v_streak.highest_streak,
        last_streak_date = v_streak.last_streak_date,
        activity_date = v_today,
        today_messages_count = v_streak.today_messages_count,
        today_study_minutes = v_streak.today_study_minutes
    WHERE group_id = p_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to increment streak on new message
CREATE OR REPLACE FUNCTION public.trigger_update_streak_on_message()
RETURNS TRIGGER AS $$
DECLARE
    v_group_id UUID;
BEGIN
    SELECT COALESCE(c.group_id, r.group_id) INTO v_group_id
    FROM public.conversations conv
    LEFT JOIN public.channels c ON conv.channel_id = c.id
    LEFT JOIN public.study_rooms r ON conv.room_id = r.id
    WHERE conv.id = NEW.conversation_id;

    IF v_group_id IS NOT NULL THEN
        PERFORM public.update_group_streak(v_group_id, 'message', 1);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_insert_for_streak
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_streak_on_message();


-- Trigger to increment streak on study room leave (calculating duration)
CREATE OR REPLACE FUNCTION public.trigger_update_streak_on_study()
RETURNS TRIGGER AS $$
DECLARE
    v_group_id UUID;
    v_minutes INT;
BEGIN
    IF NEW.left_at IS NOT NULL AND OLD.left_at IS NULL THEN
        -- calculate total minutes spent in room
        v_minutes := EXTRACT(EPOCH FROM (NEW.left_at - OLD.joined_at)) / 60;
        IF v_minutes > 0 THEN
            SELECT group_id INTO v_group_id FROM public.study_rooms WHERE id = NEW.room_id;
            IF v_group_id IS NOT NULL THEN
                PERFORM public.update_group_streak(v_group_id, 'study', v_minutes);
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_study_room_leave_for_streak
AFTER UPDATE OF left_at ON public.study_room_members
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_streak_on_study();

COMMIT;
