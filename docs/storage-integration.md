# Hướng dẫn tích hợp Storage (frontend)

Kiến trúc file dự kiến của toàn hệ thống (theo
`docs/db/STUDY_PLATFORM_DATABASE_SPEC.md`, mục "File Storage Architecture"):
Postgres chỉ lưu **metadata** (đường dẫn dạng `bucket/path/file.ext`), file
nhị phân thật nằm trong **Supabase Storage**, chia làm 4 bucket:

```text
Supabase Storage
    │
    ├── avatars              -- KHÔNG tồn tại, chưa implement
    ├── group-resources      -- KHÔNG tồn tại, chưa implement
    ├── message-attachments  -- ĐÃ tồn tại, ĐÃ implement đầy đủ
    └── forum-images         -- KHÔNG tồn tại, chưa implement
```

**Chỉ `message-attachments` (file đính kèm trong chat) là có luồng upload
hoàn chỉnh ở thời điểm hiện tại.** 3 bucket còn lại mới dừng ở mức field
text trong DB (`avatar_url`, `Resource.file_path`, `image_path`) — chưa có
bucket, chưa có endpoint cấp signed URL, chưa có code service nào xử lý
chúng.

## Đã implement: file đính kèm chat (`message-attachments`)

Toàn bộ luồng (request signed upload URL → PUT thẳng lên Supabase Storage →
gửi `attachment_path` khi tạo message → xem qua signed download URL ngắn
hạn) đã có sẵn và được mô tả chi tiết ở
[chat-integration.md](chat-integration.md#send-a-file). Đây cũng là **mẫu
tham khảo** để implement 3 bucket còn lại — logic nằm ở
`app/attachments/services/attachment_service.py` (`build_object_path`,
`validate_ownership`, `create_signed_upload_url`,
`create_signed_download_url`, `object_exists`, `delete_object`), không nên
viết lại từ đầu mà nên tổng quát hoá module này cho các bucket khác.

Điểm mấu chốt của mẫu này (áp dụng lại cho avatar/resource/forum-image):

1. Bucket **private** (`public = false`) — không có URL công khai vĩnh
   viễn, mọi truy cập đều qua signed URL do backend cấp bằng
   `SUPABASE_SERVICE_ROLE_KEY`.
2. Object path có cấu trúc cố định, chứa `user_id`/`group_id` để có thể
   kiểm tra "path này có đúng là path đã cấp cho đúng user/scope này
   không" bằng string check thuần (không cần gọi mạng) — xem
   `validate_ownership`.
3. Trước khi lưu path vào DB, backend gọi `object_exists` để chắc chắn
   client thực sự đã upload, tránh lưu path trỏ tới file không tồn tại.
4. `storage.objects` có RLS bật, **không có policy nào** cho
   `anon`/`authenticated` (deny-by-default) — nghĩa là bucket riêng tư kiểu
   này an toàn kể cả khi ai đó có access token hợp lệ của Supabase nhưng
   không đi qua backend.

## Chưa implement: `avatars` (ảnh đại diện user/group)

`profiles.avatar_url` và `groups.avatar_url`
([group-integration.md](group-integration.md)) hiện là cột text nhận **bất
kỳ chuỗi nào**, kể cả URL bên ngoài — không có xác thực, không có bucket
`avatars` nào tồn tại trong Supabase (theo migration
`003_create_message_attachments_bucket.sql`, tại thời điểm viết migration
đó `storage.buckets` đang **rỗng**, mới được thêm đúng 1 bucket là
`message-attachments`).

**Frontend hiện chưa có cách nào để upload ảnh đại diện qua backend.** Cho
tới khi có endpoint tương đương
`POST /channels/{channel_id}/attachments/upload-url` cho avatar (ví dụ
`POST /profiles/{profile_id}/avatar/upload-url`,
`POST /groups/{group_id}/avatar/upload-url`), lựa chọn hiện có:

- Không làm tính năng upload ảnh đại diện, chỉ cho nhập URL ảnh có sẵn
  (chấp nhận hạn chế của MVP), hoặc
- Chờ backend bổ sung bucket `avatars` + endpoint signed URL theo đúng mẫu
  ở trên.

Không tự upload thẳng lên Supabase Storage từ frontend bằng access token
của user cho tính năng này — bucket chưa tồn tại nên sẽ lỗi, và kể cả khi
ai đó tạo bucket thủ công mà chưa có policy RLS phù hợp, việc đó cũng đi
ngược lại mô hình "mọi upload qua backend" đang dùng cho chat.

## Chưa implement: `group-resources` (tài liệu nhóm)

Module `app/resources` (folder + file trong group,
`POST /resources/files`) yêu cầu client tự truyền sẵn `file_path` như thể
file đã có trên Storage:

```json
POST /resources/files
{
  "group_id": "<uuid>",
  "uploader_id": "<uuid>",
  "folder_id": null,
  "name": "de-cuong-on-tap.pdf",
  "file_path": "???",
  "file_type": "application/pdf",
  "file_size": 204800
}
```

Nhưng không có endpoint nào cấp `file_path` hợp lệ (không có
`POST /resources/upload-url` hay tương tự), và bucket `group-resources`
chưa tồn tại. Nói cách khác, `POST /resources/files` hiện **không thể dùng
được thật** cho việc upload file từ frontend — nó chỉ hoạt động nếu có một
cơ chế khác (không thuộc phạm vi tài liệu này) tạo sẵn object trong Storage
và biết trước đường dẫn của nó.

Việc cần làm ở backend trước khi tính năng này dùng được: tạo bucket
`group-resources` (private) + endpoint
`POST /resources/upload-url` (nhận `group_id`, `folder_id`, `file_name`,
`content_type`, `file_size`, trả `{ path, upload_url, token }` — cùng dạng
`UploadUrlResponse` đang dùng cho chat) + endpoint lấy signed download URL
theo `file_id`, tái sử dụng `AttachmentsService` đã tổng quát hoá.

## Chưa implement: `forum-images` (ảnh trong bài viết forum)

`forum_posts.image_path`
([forum-integration.md](forum-integration.md#bài-viết-post)) có cùng tình
trạng như trên: cột text tự do, không bucket, không endpoint upload. Cùng
một khuyến nghị: bucket `forum-images` (có thể để `public = true` nếu ảnh
forum không cần riêng tư, khác với chat/resource/avatar — cần quyết định
sản phẩm trước khi implement) + endpoint cấp signed/public upload URL theo
đúng mẫu.

## Lưu ý: object path của `message-attachments` sẽ đổi định dạng sau khi backend refactor sang Conversation

Object path hiện tại (`groups/{group_id}/channels/{channel_id}/{user_id}/{uuid}/{filename}`)
gắn cứng vào `channel_id`. Migration 004
(`docs/db/migrations/004_refactor_chat_to_conversations.sql`, xem
`docs/db/STUDY_PLATFORM_DATABASE_SPEC.md` § 12) chỉ đổi schema DB, **chưa**
đụng tới Storage — path hiện tại vẫn giữ nguyên cho tới khi backend
(`build_object_path` trong `attachment_service.py`) được refactor ở phase
sau. Mục tiêu path mới (chưa implement):

```text
conversations/{conversation_id}/{user_id}/{uuid}/{safe_filename}
```

để một object path dùng chung được cho cả channel/room/direct message thay
vì chỉ channel. Không có object nào cần di chuyển ở lần đổi này —
`storage.buckets`/`storage.objects` hiện vẫn rỗng (bucket `message-attachments`
còn chưa được tạo, xem đầu file này). Khi backend refactor thật, cần một kế
hoạch migrate riêng cho các object đã tồn tại lúc đó (nếu có).

## Cấu hình cần thiết khi thêm bucket mới

Giống hệt yêu cầu đã ghi trong
[chat-integration.md](chat-integration.md#pending-manual-actions) cho
`message-attachments`: mỗi bucket mới cần một migration SQL tạo
`storage.buckets` row (`public`, `file_size_limit`, `allowed_mime_types`),
và biến môi trường `SUPABASE_SERVICE_ROLE_KEY` phải được cấu hình ở server
(không bao giờ lộ ra frontend) — thiếu biến này thì mọi endpoint cấp signed
URL trả `500 Attachment storage is not configured` (hoặc lỗi tương đương
nếu đổi tên biến/service cho bucket mới).
