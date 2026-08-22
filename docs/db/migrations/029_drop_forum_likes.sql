-- Contract phase for 028_add_forum_reactions.sql. Drops post_likes/comment_likes once the
-- accompanying backend change (app/forum/) has been deployed and confirmed reading/writing
-- post_reactions/comment_reactions exclusively -- same two-step this repo already used for
-- messages.channel_id (004 expand / 005 contract). 028's backfill already migrated every
-- existing like into post_reactions/comment_reactions as a '👍' reaction, so nothing is lost by
-- dropping these two tables once the new code path is confirmed live.
--
-- Do NOT run this until 028 has been applied AND the backend deploy that stops writing to
-- post_likes/comment_likes is live -- run 029_preflight.sql first and read every row.

drop table if exists public.post_likes;
drop table if exists public.comment_likes;
