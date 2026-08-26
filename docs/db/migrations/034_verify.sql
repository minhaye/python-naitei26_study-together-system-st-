-- 034_verify.sql — READ-ONLY. Run after 034_consolidate_forum_categories.sql.

-- 1. Exactly 19 categories, matching the final list byte-for-byte.
WITH expected(name) AS (VALUES
  ('Ngoại ngữ'), ('Công nghệ thông tin'), ('Trí tuệ nhân tạo & Khoa học dữ liệu'),
  ('An toàn thông tin & Mạng máy tính'), ('Toán học'), ('Vật lý'), ('Hóa học'), ('Sinh học'),
  ('Y khoa & Dược học'), ('Kinh tế & Tài chính'), ('Quản trị kinh doanh & Marketing'),
  ('Kế toán & Kiểm toán'), ('Luật học'), ('Khoa học Xã hội & Nhân văn'), ('Kỹ thuật & Công nghệ'),
  ('Kiến trúc & Xây dựng'), ('Giáo dục & Sư phạm'), ('Trung học Phổ thông (THPT)'),
  ('Ôn thi THPT Quốc gia – TSA – HSA')
)
SELECT
  (SELECT COUNT(*) FROM forum_categories) AS actual_category_count, -- expect 19
  (SELECT COUNT(*) FROM expected) AS expected_category_count, -- expect 19
  (SELECT COUNT(*) FROM forum_categories c WHERE NOT EXISTS (SELECT 1 FROM expected e WHERE e.name = c.name)) AS unexpected_categories, -- expect 0
  (SELECT COUNT(*) FROM expected e WHERE NOT EXISTS (SELECT 1 FROM forum_categories c WHERE c.name = e.name)) AS missing_categories; -- expect 0

-- 2. No forum_posts row references a category_id that no longer exists (RESTRICT should
--    have made this structurally impossible, this is defense-in-depth).
SELECT COUNT(*) AS orphaned_posts
FROM forum_posts p
WHERE NOT EXISTS (SELECT 1 FROM forum_categories c WHERE c.id = p.category_id);
-- expect 0

-- 3. Total post count is unchanged from preflight (no post was deleted by this migration —
--    compare against 034_preflight.sql's post_count).
SELECT COUNT(*) AS post_count_after FROM forum_posts;

-- 4. Per-category post counts after consolidation (sanity check — every removed/merged
-- category's posts should now show up under its replacement).
SELECT c.name, COUNT(p.id) AS post_count
FROM forum_categories c
LEFT JOIN forum_posts p ON p.category_id = c.id
GROUP BY c.name
ORDER BY c.name;
