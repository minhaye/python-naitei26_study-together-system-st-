-- 034_consolidate_forum_categories.sql
--
-- Consolidates the ~52 forum_categories rows (accumulated by scripts/seed_forum.py and
-- scripts/seed_rich_data.py — see 034_preflight.sql for the exact live list) down to a
-- fixed set of 19 school/university study subjects. forum_posts.category_id is
-- ON DELETE RESTRICT (see app/forum/entities/forum_entity.py), so every merged/removed
-- category is first re-pointed to its replacement via UPDATE before the row is deleted —
-- no post loses its category, and no post is left pointing at a deleted category.
--
-- Strategy: pick one existing row per final category as the "anchor" (renamed in place,
-- keeping its id — so any external reference to that id, e.g. a client's cached
-- category_id, still resolves), reassign every other row's posts to its anchor, then
-- delete the now-empty non-anchor rows. One final category ("Kế toán & Kiểm toán") has no
-- existing row to anchor on and is inserted fresh. Categories with zero posts and no
-- reasonable final-category fit are dropped outright.
--
-- Idempotent: safe to re-run. After the first successful run, every WHERE name = '<old
-- name>' clause matches zero rows (the anchor has already been renamed / the merge-source
-- rows already deleted), so the UPDATE/DELETE statements become no-ops; the final INSERT
-- is already guarded by NOT EXISTS.
--
-- No rollback script: reverting would mean re-creating 30+ deleted category rows and
-- un-merging which posts originally belonged to which of them — not reconstructible from
-- the post-migration state alone (same reasoning 008/009/012/013 used to skip one).

BEGIN;

-- 1. Reassign posts from merge-source categories to their anchor (by current name), then
--    delete the emptied merge-source rows. Grouped by destination anchor.

-- -> Công nghệ thông tin (IT)  [anchor, renamed to "Công nghệ thông tin" in step 3]
UPDATE forum_posts SET category_id = (SELECT id FROM forum_categories WHERE name = 'Công nghệ thông tin (IT)')
WHERE category_id IN (SELECT id FROM forum_categories WHERE name IN
  ('DevOps & Cloud Computing', 'Game Development', 'Lập Trình Di Động (Flutter/React Native)'));
DELETE FROM forum_categories WHERE name IN
  ('DevOps & Cloud Computing', 'Game Development', 'Lập Trình Di Động (Flutter/React Native)');

-- -> Hỏi đáp chung  [anchor, renamed to "Giáo dục & Sư phạm" in step 3 — general/miscellaneous bucket]
UPDATE forum_posts SET category_id = (SELECT id FROM forum_categories WHERE name = 'Hỏi đáp chung')
WHERE category_id IN (SELECT id FROM forum_categories WHERE name IN
  ('Góc thư giãn', 'Góc Tự Học & Quản Lý Thời Gian', 'Khoa học Tự nhiên', 'Kỹ năng mềm & Nghề nghiệp',
   'Kỹ Năng Mềm & Phát Triển Bản Thân', 'Trung học Cơ sở (THCS)'));
DELETE FROM forum_categories WHERE name IN
  ('Góc thư giãn', 'Góc Tự Học & Quản Lý Thời Gian', 'Khoa học Tự nhiên', 'Kỹ năng mềm & Nghề nghiệp',
   'Kỹ Năng Mềm & Phát Triển Bản Thân', 'Trung học Cơ sở (THCS)');

-- -> Khoa học Xã hội & Nhân văn  [anchor, name unchanged]
UPDATE forum_posts SET category_id = (SELECT id FROM forum_categories WHERE name = 'Khoa học Xã hội & Nhân văn')
WHERE category_id IN (SELECT id FROM forum_categories WHERE name IN
  ('Tâm Lý Học Học Đường', 'Triết học & Chính trị', 'Triết Học & Tư Duy Phản Biện', 'Văn Học & Nghệ Thuật'));
DELETE FROM forum_categories WHERE name IN
  ('Tâm Lý Học Học Đường', 'Triết học & Chính trị', 'Triết Học & Tư Duy Phản Biện', 'Văn Học & Nghệ Thuật');

-- -> Kiến Trúc & Xây Dựng  [anchor, renamed to "Kiến trúc & Xây dựng" in step 3]
UPDATE forum_posts SET category_id = (SELECT id FROM forum_categories WHERE name = 'Kiến Trúc & Xây Dựng')
WHERE category_id IN (SELECT id FROM forum_categories WHERE name = 'Kiến trúc & Thiết kế');
DELETE FROM forum_categories WHERE name = 'Kiến trúc & Thiết kế';

-- -> Kinh tế & Tài chính  [anchor, name unchanged]
UPDATE forum_posts SET category_id = (SELECT id FROM forum_categories WHERE name = 'Kinh tế & Tài chính')
WHERE category_id IN (SELECT id FROM forum_categories WHERE name IN
  ('Kinh Tế Vĩ Mô & Vi Mô', 'Kỹ Năng Quản Lý Tài Chính', 'Tài Chính Doanh Nghiệp'));
DELETE FROM forum_categories WHERE name IN
  ('Kinh Tế Vĩ Mô & Vi Mô', 'Kỹ Năng Quản Lý Tài Chính', 'Tài Chính Doanh Nghiệp');

-- -> Kỹ Thuật Điện Điện Tử  [anchor, renamed to "Kỹ thuật & Công nghệ" in step 3]
UPDATE forum_posts SET category_id = (SELECT id FROM forum_categories WHERE name = 'Kỹ Thuật Điện Điện Tử')
WHERE category_id IN (SELECT id FROM forum_categories WHERE name IN
  ('Chế Tạo Robot & IoT', 'Thiết Kế Đồ Họa & UI/UX'));
DELETE FROM forum_categories WHERE name IN
  ('Chế Tạo Robot & IoT', 'Thiết Kế Đồ Họa & UI/UX');

-- -> Luật học  [anchor, name unchanged]
UPDATE forum_posts SET category_id = (SELECT id FROM forum_categories WHERE name = 'Luật học')
WHERE category_id IN (SELECT id FROM forum_categories WHERE name = 'Luật Kinh Tế & Pháp Luật');
DELETE FROM forum_categories WHERE name = 'Luật Kinh Tế & Pháp Luật';

-- -> Ngoại ngữ  [anchor, name unchanged]
UPDATE forum_posts SET category_id = (SELECT id FROM forum_categories WHERE name = 'Ngoại ngữ')
WHERE category_id IN (SELECT id FROM forum_categories WHERE name IN
  ('Ngoại Ngữ - Tiếng Anh', 'Ngoại Ngữ - Tiếng Nhật', 'Tiếng Hàn (TOPIK)', 'Tiếng Trung (HSK)'));
DELETE FROM forum_categories WHERE name IN
  ('Ngoại Ngữ - Tiếng Anh', 'Ngoại Ngữ - Tiếng Nhật', 'Tiếng Hàn (TOPIK)', 'Tiếng Trung (HSK)');

-- -> Ôn thi THPT Quốc gia-TSA-HSA  [anchor, renamed to "Ôn thi THPT Quốc gia – TSA – HSA" in step 3]
UPDATE forum_posts SET category_id = (SELECT id FROM forum_categories WHERE name = 'Ôn thi THPT Quốc gia-TSA-HSA')
WHERE category_id IN (SELECT id FROM forum_categories WHERE name = 'Luyện Thi SAT & ACT');
DELETE FROM forum_categories WHERE name = 'Luyện Thi SAT & ACT';

-- -> Quản trị & Marketing  [anchor, renamed to "Quản trị kinh doanh & Marketing" in step 3]
UPDATE forum_posts SET category_id = (SELECT id FROM forum_categories WHERE name = 'Quản trị & Marketing')
WHERE category_id IN (SELECT id FROM forum_categories WHERE name IN
  ('Khởi Nghiệp & Startup Student', 'Kinh Nghiệm Phỏng Vấn Công Ty', 'Marketing Digital', 'Quản Trị Nhân Sự'));
DELETE FROM forum_categories WHERE name IN
  ('Khởi Nghiệp & Startup Student', 'Kinh Nghiệm Phỏng Vấn Công Ty', 'Marketing Digital', 'Quản Trị Nhân Sự');

-- -> Y khoa & Dược học  [anchor, name unchanged]
UPDATE forum_posts SET category_id = (SELECT id FROM forum_categories WHERE name = 'Y khoa & Dược học')
WHERE category_id IN (SELECT id FROM forum_categories WHERE name = 'Sức khỏe');
DELETE FROM forum_categories WHERE name = 'Sức khỏe';

-- 2. Drop categories with zero posts and no reasonable fit in the final 19 (confirmed
--    zero via 034_preflight.sql — if any of these ever gain a post before this runs,
--    re-run preflight and re-triage instead of assuming this list is still safe).
DELETE FROM forum_categories WHERE name IN
  ('Âm Nhạc & Cảm Âm', 'Góc Tuyển Dụng & Thực Tập Sinh', 'Săn Học Bổng Du Học 2026', 'Thể Thao & Sức Khỏe Học Đường');

-- 3. Rename the surviving anchor rows to their final canonical name (ids unchanged).
UPDATE forum_categories SET name = 'An toàn thông tin & Mạng máy tính' WHERE name = 'An Toàn Thông Tin & Cyber Security';
UPDATE forum_categories SET name = 'Công nghệ thông tin' WHERE name = 'Công nghệ thông tin (IT)';
UPDATE forum_categories SET name = 'Hóa học' WHERE name = 'Hóa Học & Đời Sống';
UPDATE forum_categories SET name = 'Giáo dục & Sư phạm' WHERE name = 'Hỏi đáp chung';
UPDATE forum_categories SET name = 'Kiến trúc & Xây dựng' WHERE name = 'Kiến Trúc & Xây Dựng';
UPDATE forum_categories SET name = 'Kỹ thuật & Công nghệ' WHERE name = 'Kỹ Thuật Điện Điện Tử';
UPDATE forum_categories SET name = 'Ôn thi THPT Quốc gia – TSA – HSA' WHERE name = 'Ôn thi THPT Quốc gia-TSA-HSA';
UPDATE forum_categories SET name = 'Quản trị kinh doanh & Marketing' WHERE name = 'Quản trị & Marketing';
UPDATE forum_categories SET name = 'Sinh học' WHERE name = 'Sinh Học & Y Học Thường Thức';
UPDATE forum_categories SET name = 'Toán học' WHERE name = 'Toán học & Toán cao cấp';
UPDATE forum_categories SET name = 'Trí tuệ nhân tạo & Khoa học dữ liệu' WHERE name = 'Trí Tuệ Nhân Tạo & Data Science';
UPDATE forum_categories SET name = 'Trung học Phổ thông (THPT)' WHERE name = 'Trung học Phổ Thông (THPT)';
UPDATE forum_categories SET name = 'Vật lý' WHERE name = 'Vật Lý Đại Xung & Cơ Học';
-- (Khoa học Xã hội & Nhân văn, Kinh tế & Tài chính, Luật học, Ngoại ngữ, Y khoa & Dược học
-- already carry their final name — no rename needed.)

-- 4. Insert the one final category with no existing anchor row.
INSERT INTO forum_categories (name, description)
SELECT 'Kế toán & Kiểm toán', 'Kế toán, kiểm toán, thuế và tài chính doanh nghiệp'
WHERE NOT EXISTS (SELECT 1 FROM forum_categories WHERE name = 'Kế toán & Kiểm toán');

COMMIT;
