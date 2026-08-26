-- 034_preflight.sql — READ-ONLY. Run before 034_consolidate_forum_categories.sql.
--
-- Confirms forum_categories/forum_posts exist, prints the current category list with
-- post counts (so the merge/rename mapping in 034 can be diffed against live data before
-- running it), and confirms the FK is ON DELETE RESTRICT as assumed by the migration
-- (if it is not, the migration's plain DELETEs could behave differently than expected).

-- 1. Confirm FK delete rule on forum_posts.category_id.
SELECT
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name = 'forum_posts'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.constraint_name LIKE '%category%';
-- Expected: delete_rule = 'RESTRICT'.

-- 2. Current category list with post counts (compare against docs/db/migrations/README.md #034).
SELECT c.id, c.name, COUNT(p.id) AS post_count
FROM forum_categories c
LEFT JOIN forum_posts p ON p.category_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- 3. Total category / post counts (informational — for comparing against 034_verify.sql after running).
SELECT
  (SELECT COUNT(*) FROM forum_categories) AS category_count,
  (SELECT COUNT(*) FROM forum_posts) AS post_count;
