-- Hashtag System for Forum: tags & post_tags tables with automated post_count triggers.
-- Migration: 014_create_forum_tags.sql

BEGIN;

-- 1. Create `tags` table
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  post_count INT NOT NULL DEFAULT 0 CHECK (post_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tags_name_lowercase CHECK (name = lower(name))
);

-- 2. Create `post_tags` junction table
CREATE TABLE IF NOT EXISTS public.post_tags (
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, tag_id)
);

-- 3. Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_tags_post_count_desc ON public.tags (post_count DESC, name ASC);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON public.post_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON public.post_tags (post_id);

-- 4. Trigger function to auto-update tag post_count
CREATE OR REPLACE FUNCTION public.update_tag_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.tags SET post_count = post_count + 1 WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.tags SET post_count = GREATEST(0, post_count - 1) WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_tag_post_count ON public.post_tags;
CREATE TRIGGER trg_update_tag_post_count
AFTER INSERT OR DELETE ON public.post_tags
FOR EACH ROW EXECUTE FUNCTION public.update_tag_post_count();

-- 5. Row Level Security (RLS) Policies
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tags_select_public ON public.tags;
CREATE POLICY tags_select_public ON public.tags FOR SELECT USING (true);

DROP POLICY IF EXISTS post_tags_select_public ON public.post_tags;
CREATE POLICY post_tags_select_public ON public.post_tags FOR SELECT USING (true);

COMMIT;
