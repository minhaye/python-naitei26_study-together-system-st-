# Hướng dẫn tích hợp Forum (frontend)

Forum chung toàn hệ thống (không scope theo group): chuyên mục
(`ForumCategory`) → bài viết (`ForumPost`, soft-delete) → bình luận
(`Comment`, hỗ trợ reply lồng nhau qua `parent_comment_id`) → like cho cả
post và comment.

**Đọc trước:
[auth-integration.md — "Lưu ý quan trọng: không phải endpoint nào cũng kiểm
tra token"](auth-integration.md#lưu-ý-quan-trọng-không-phải-endpoint-nào-cũng-kiểm-tra-token).**
Toàn bộ endpoint dưới đây **không** yêu cầu `Authorization` header. `author_id`
(post/comment) và `user_id` (like) được nhận trực tiếp từ body/query do
client gửi — frontend phải tự đảm bảo luôn dùng `id` của người dùng đang
đăng nhập (lấy từ `GET /auth/me`), backend không đối chiếu.

## Chuyên mục (Category)

```http
POST   /forum/categories        { "name": "Toán", "description": "..." }
GET    /forum/categories
GET    /forum/categories/{category_id}
PUT    /forum/categories/{category_id}   { "name": "...", "description": "..." }
DELETE /forum/categories/{category_id}
```

`name` unique ở DB — tạo trùng tên sẽ lỗi `400`. Theo RLS đã định nghĩa
(`forum_categories_select` = `true`, không có insert/update/delete policy
cho role `authenticated`), category về ý nghĩa là dữ liệu do admin quản lý,
không phải do user thường tạo — nhưng backend hiện không phân biệt, ai gọi
cũng tạo/sửa/xoá được. Cân nhắc ẩn các nút này khỏi UI người dùng thường.

## Bài viết (Post)

```http
POST /forum/posts
{
  "author_id": "<uuid>",
  "category_id": "<uuid>",
  "title": "Cách học từ vựng nhanh",
  "content": "...",
  "image_path": null
}
```

`image_path` chỉ là chuỗi text — chưa có endpoint upload ảnh cho bài viết
(xem [storage-integration.md](storage-integration.md), bucket
`forum-images` chưa được tạo).

```http
GET /forum/posts/{post_id}
GET /forum/posts?category_id={category_id}&skip=0&limit=50
PUT /forum/posts/{post_id}   { "title": "...", "content": "...", "category_id": "...", "image_path": "..." }
```

`GET /forum/posts` **bắt buộc** query `category_id` — không có cách liệt kê
post xuyên nhiều category trong một lần gọi. Kết quả sắp xếp mới nhất
trước (`created_at desc`).

### Xoá bài viết là soft-delete, không phải xoá thật

```http
DELETE /forum/posts/{post_id}
```

Endpoint này set `deleted_at = now()` (không xoá row), và **trả về `200`
với body là `ForumPostResponse`** (post đã cập nhật `deleted_at`) — không
phải `204 No Content` như các endpoint xoá khác trong API. Frontend nên đọc
response body để lấy `deleted_at` mới, không nên coi response rỗng.

Lưu ý một khoảng trống hiện tại: `GET /forum/posts?category_id=...` **có**
lọc `deleted_at IS NULL`, nhưng `GET /forum/posts/{post_id}` (lấy 1 post
theo ID) **không** lọc — nếu frontend cache/link trực tiếp tới ID của một
post đã bị xoá, endpoint này vẫn trả về nó với `deleted_at` khác `null`.
Luôn tự kiểm tra `deleted_at != null` trước khi hiển thị post lấy theo ID,
và ẩn các hành động sửa/bình luận/like nếu post đã bị xoá.

## Bình luận (Comment)

```http
POST /forum/comments
{
  "post_id": "<uuid>",
  "author_id": "<uuid>",
  "parent_comment_id": null,
  "content": "Cảm ơn bài viết!"
}
```

`parent_comment_id = null` → bình luận gốc; khác `null` → reply lồng vào
comment đó (đệ quy không giới hạn độ sâu ở tầng DB). Backend **không** kiểm
tra `post_id`/`parent_comment_id` có bị xoá hay không khi tạo comment (RLS
trong Supabase có kiểm tra `forum_posts.deleted_at IS NULL` cho insert,
nhưng như đã nêu ở [auth-integration.md](auth-integration.md), RLS không có
hiệu lực với các request qua FastAPI) — tự chặn ở UI việc bình luận vào bài
đã xoá.

```http
GET    /forum/comments/{comment_id}
GET    /forum/comments?post_id={post_id}
PUT    /forum/comments/{comment_id}   { "content": "..." }
DELETE /forum/comments/{comment_id}
```

`GET /forum/comments?post_id=...` trả **flat list** sắp theo `created_at`
tăng dần — không tự dựng cây theo `parent_comment_id`, frontend tự build
cây reply từ danh sách phẳng này. Xoá comment là xoá cứng
(`ondelete="CASCADE"` trên `parent_comment_id`), khác với xoá post — xoá
một comment gốc sẽ xoá luôn toàn bộ reply bên dưới nó.

## Like

```http
POST   /forum/posts/{post_id}/like?user_id=<uuid>
DELETE /forum/posts/{post_id}/unlike?user_id=<uuid>
POST   /forum/comments/{comment_id}/like?user_id=<uuid>
DELETE /forum/comments/{comment_id}/unlike?user_id=<uuid>
```

`user_id` là **query param**, không phải JSON body. Like trùng (đã like
rồi like tiếp) trả `400`; unlike khi chưa like trả `404`. Không có endpoint
đếm nhanh tổng số like — tự đếm bằng cách gọi list rồi lấy độ dài mảng, hoặc
đợi backend bổ sung field đếm sẵn trên `ForumPostResponse`/`CommentResponse`
(hiện chưa có).

## Đề xuất tiếp theo (chưa làm)

- Wire `Depends(get_current_user)` vào `forum_router.py` (ép
  `author_id`/`user_id` = `current_user.id`, chặn sửa/xoá post hay comment
  không phải của mình — RLS `forum_posts_update_own`,
  `forum_posts_delete_own`, `comments_update_own`, `comments_delete_own`
  trong Supabase đã mô tả sẵn đúng mô hình này).
- Lọc `deleted_at IS NULL` trong `get_post_by_id` (dùng cho cả
  `GET /forum/posts/{post_id}`, `PUT`, `DELETE`) để nhất quán với
  `list_posts_by_category`.
- Thêm endpoint upload ảnh cho `image_path` (xem
  [storage-integration.md](storage-integration.md)).
