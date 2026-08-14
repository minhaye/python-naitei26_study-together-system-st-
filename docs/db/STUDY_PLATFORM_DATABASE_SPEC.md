# Study Platform — Database & Backend Specification

> Tài liệu đặc tả dành cho Backend, Frontend và Database Developer.  
> Mục tiêu: giúp các thành viên hiểu thống nhất **domain model**, **database schema**, **quan hệ dữ liệu**, **business rules** và **quy tắc phân quyền** của hệ thống.

---

# 1. Tổng quan hệ thống

Ứng dụng gồm hai nhóm chức năng chính:

## 1.1. Học nhóm — Study Groups

Người dùng có thể:

- Tạo nhóm học.
- Tham gia nhóm.
- Quản lý thành viên trong nhóm theo quyền hạn.
- Tạo nhiều kênh chat trong một nhóm.
- Nhắn tin trong channel.
- Gửi file đính kèm trong tin nhắn.
- Tạo phòng học trực tuyến — Study Room.
- Tham gia Study Room.
- Host/Moderator quản lý người trong phòng.
- Lưu trữ và tổ chức tài liệu chung theo thư mục.

Một Group có thể chứa:

```text
Group
├── Members
├── Channels
│   ├── Channel Members
│   └── Messages
├── Study Rooms
│   ├── Room Members
│   └── Moderation Actions
└── Resources
    └── Folders
```

---

## 1.2. Diễn đàn — Forum

Người dùng có thể:

- Đăng bài viết học tập.
- Chọn lĩnh vực/category.
- Xem bài theo từng lĩnh vực.
- Like bài viết.
- Bình luận.
- Reply bình luận.
- Like bình luận.
- Nhận notification khi có tương tác liên quan.

Cấu trúc:

```text
Forum Category
└── Forum Posts
    ├── Post Likes
    └── Comments
        ├── Replies
        └── Comment Likes
```

---

# 2. Authentication và Profile

Authentication do **Supabase Auth** quản lý.

Bảng `profiles` chứa thông tin mở rộng của user trong ứng dụng.

Quan hệ:

```text
auth.users
    │
    │ 1:1
    ▼
profiles
```

`profiles.id` tương ứng với `auth.users.id`.

---

# 3. profiles — Hồ sơ người dùng

## Vai trò

Lưu thông tin cơ bản của mỗi người dùng.

## Fields

```text
profiles
├── id
├── username
├── display_name
├── avatar_url
├── bio
├── created_at
└── updated_at
```

| Field | Ý nghĩa |
|---|---|
| `id` | UUID của user, đồng thời liên kết với Supabase Auth |
| `username` | Username duy nhất của người dùng |
| `display_name` | Tên hiển thị |
| `avatar_url` | URL ảnh đại diện |
| `bio` | Giới thiệu ngắn |
| `created_at` | Thời điểm tạo profile |
| `updated_at` | Thời điểm cập nhật profile gần nhất |

---

# 4. groups — Nhóm học

## Vai trò

Đại diện cho một nhóm học.

## Fields

```text
groups
├── id
├── name
├── description
├── avatar_url
├── owner_id
├── invite_code
├── is_public
├── created_at
└── updated_at
```

| Field | Ý nghĩa |
|---|---|
| `id` | UUID của group |
| `name` | Tên nhóm |
| `description` | Mô tả nhóm |
| `avatar_url` | Ảnh đại diện group |
| `owner_id` | User sở hữu group |
| `invite_code` | Mã mời tham gia group |
| `is_public` | Group công khai hay riêng tư |
| `created_at` | Thời điểm tạo |
| `updated_at` | Thời điểm cập nhật |

## Quan hệ

Một group có thể có nhiều:

- `group_members`
- `channels`
- `study_rooms`
- `resource_folders`
- `resources`

---

# 5. group_members — Thành viên của Group

## Vai trò

Bảng trung gian giữa `profiles` và `groups`.

Một user có thể tham gia nhiều group và một group có nhiều user.

## Fields

```text
group_members
├── id
├── group_id
├── user_id
├── role
├── status
└── joined_at
```

| Field | Ý nghĩa |
|---|---|
| `id` | UUID của membership |
| `group_id` | Group mà user tham gia |
| `user_id` | User |
| `role` | Vai trò trong group |
| `status` | Trạng thái membership |
| `joined_at` | Thời điểm tham gia |

## Unique Rule

```text
UNIQUE(group_id, user_id)
```

Một user chỉ có một membership trong một group.

---

# 6. Phân quyền Group

`group_members.role` có ba giá trị:

```text
owner
moderator
member
```

## 6.1. Owner

Người sở hữu group.

Có thể:

- Sửa thông tin group.
- Quản lý thành viên.
- Promote/Demote Moderator.
- Quản lý channel.
- Quản lý tài liệu.
- Xóa group.

## 6.2. Moderator

Người hỗ trợ quản lý group.

Có thể:

- Quản lý member.
- Quản lý channel.
- Hỗ trợ moderation.
- Quản lý các nội dung được backend cho phép.

Moderator **không mặc định có quyền thay đổi Owner**.

Việc Moderator có được promote một Member thành Moderator hay không phải tuân theo business rule của backend. Khuyến nghị:

```text
Owner:
    có quyền thay đổi role Member <-> Moderator

Moderator:
    không có quyền thay đổi role
```

## 6.3. Member

Thành viên bình thường.

Có thể:

- Chat.
- Tham gia Study Room.
- Upload tài liệu.
- Tạo Study Room.

---

# 7. Group Membership Status

`group_members.status`:

```text
active
banned
left
```

Ý nghĩa:

| Status | Ý nghĩa |
|---|---|
| `active` | Đang là thành viên |
| `banned` | Bị cấm khỏi group |
| `left` | Đã rời group |

Backend nên ưu tiên cập nhật status thay vì xóa membership nếu cần giữ lịch sử.

---

# 8. Business Rule khi tạo Group

`groups.owner_id` và `group_members.role = owner` biểu diễn cùng một quan hệ ownership ở hai vị trí khác nhau.

Do đó khi tạo group:

```text
Create Group
    ↓
Insert groups.owner_id = current_user
    ↓
Insert group_members
    ├── group_id = group.id
    ├── user_id = current_user
    ├── role = owner
    └── status = active
```

Hai thao tác nên được thực hiện trong **cùng một transaction**.

Không được để xảy ra trạng thái:

```text
groups.owner_id = A
```

nhưng không tồn tại:

```text
group_members(group_id, A, owner)
```

---

# 9. channels — Kênh chat

## Vai trò

Một group có thể chia thành nhiều channel để tổ chức thảo luận.

Ví dụ:

```text
#general
#ielts-writing
#ielts-speaking
#documents
```

## Fields

```text
channels
├── id
├── group_id
├── name
├── description
├── type
├── is_private
├── created_by
├── created_at
└── updated_at
```

| Field | Ý nghĩa |
|---|---|
| `id` | UUID channel |
| `group_id` | Group chứa channel |
| `name` | Tên channel |
| `description` | Mô tả |
| `type` | Loại channel |
| `is_private` | Channel riêng tư hay không |
| `created_by` | Người tạo |
| `created_at` | Thời điểm tạo |
| `updated_at` | Thời điểm cập nhật |

Hiện tại `channel_type`:

```text
text
```

Có thể mở rộng sau này:

```text
text
announcement
voice
```

---

# 10. channel_members

## Vai trò

Lưu membership riêng của channel.

Bảng này đặc biệt hữu ích nếu sau này có:

- Private channel.
- Channel chỉ dành cho Moderator.
- Channel theo project/sub-team.

## Fields

```text
channel_members
├── id
├── channel_id
├── user_id
└── joined_at
```

## Unique Rule

```text
UNIQUE(channel_id, user_id)
```

Một user không được xuất hiện nhiều lần trong cùng một channel.

---

# 11. messages — Tin nhắn

## Vai trò

Mỗi message thuộc về một channel.

## Fields

```text
messages
├── id
├── channel_id
├── sender_id
├── content
├── attachment_path
├── created_at
└── updated_at
```

| Field | Ý nghĩa |
|---|---|
| `id` | UUID message |
| `channel_id` | Channel chứa message |
| `sender_id` | Người gửi |
| `content` | Nội dung text |
| `attachment_path` | File đính kèm |
| `created_at` | Thời điểm gửi |
| `updated_at` | Thời điểm chỉnh sửa |

## Message Validation

Message phải có ít nhất một trong hai:

```text
content
OR
attachment_path
```

Các trường hợp hợp lệ:

```text
Text only
File only
Text + File
```

Không cho phép:

```text
content = NULL
attachment_path = NULL
```

## Trạng thái hiện tại (xác nhận live 2026-08-14) — đang trong quá trình migration

`channel_id` ở trên là schema **mục tiêu sau khi migration hoàn tất**. Migration 004 **đã chạy thành công trên live database** (đã verify: 33/33 check OK, xem `docs/db/migrations/004_verify.sql`). `messages` hiện đang ở trạng thái **transitional** (expand phase — xem § 12):

```text
messages
├── id
├── channel_id        ← vẫn NOT NULL, vẫn còn (chưa drop)
├── conversation_id    ← NOT NULL, mới thêm, đã backfill đủ cho toàn bộ message hiện có
├── sender_id
├── content
├── attachment_path
├── created_at
└── updated_at
```

Cả hai cột cùng tồn tại và được một trigger (`messages_sync_conversation_id`) tự đồng bộ hai chiều. `channel_id` sẽ bị xóa hẳn ở migration 005 (chưa viết), sau khi backend refactor xong. Chi tiết đầy đủ ở § 12–15.

---

# 12. Chat Architecture Migration — Channel → Conversation

## Vai trò

Tính năng chat ban đầu (mục § 9–11) chỉ hỗ trợ **channel chat trong group**. Hệ thống đang được mở rộng để hỗ trợ thêm:

```text
Room chat      — chat trong một Study Room đang hoạt động (nhiều người)
Direct message — nhắn tin 1-1 giữa hai user
```

Cả hai tính năng này **chưa tồn tại trước khi migration này bắt đầu** — `study_rooms` trước đó không có quan hệ nào tới `messages`, và không có model/service nào cho DM.

## Kiến trúc mục tiêu

Thay vì `messages` gắn cứng vào `channels`, một bảng trung gian `conversations` được thêm vào, đóng vai trò polymorphic parent cho `messages`:

```text
Channel  ─┐
Room     ─┼──► Conversation ──► Messages
Direct   ─┘
```

`conversations.type` quyết định quan hệ nào áp dụng, và quyền truy cập cũng rẽ nhánh theo `type` — xem § 14.

## Chiến lược migration: expand/contract

Vì `messages.channel_id` đang được backend (chưa refactor) đọc/ghi trực tiếp, migration **không đổi schema một phát ăn ngay** — làm theo hai giai đoạn tách biệt để không phá vỡ backend đang chạy:

```text
Expand  (004)  Thêm schema mới (conversations, conversation_members,
               messages.conversation_id) SONG SONG với schema cũ.
               messages.channel_id vẫn giữ nguyên, KHÔNG bị đổi/xóa.
               Trigger messages_sync_conversation_id giữ hai cột đồng bộ.
                    ↓
[Backend refactor — SQLAlchemy models + MessageService dùng conversation_id]
                    ↓
Contract (005) Xóa messages.channel_id, FK, index cũ, và trigger compatibility.
               Chỉ chạy SAU KHI backend refactor đã test xong.
```

## Trạng thái migration (xác nhận live 2026-08-14)

| File | Trạng thái | Ghi chú |
|---|---|---|
| `001_enable_realtime_messages.sql` | ✅ Đã áp dụng live | Bật Realtime cho `messages` |
| `002_fix_can_access_channel_active_membership.sql` | ✅ Fix đã sống (qua 004 §7) | `can_access_channel()` live hiện đã re-check `group_members.status='active'` — xác nhận bằng cách đọc lại function body thật |
| `003_create_message_attachments_bucket.sql` | ✅ Đã áp dụng live | `storage.buckets` xác nhận có `message-attachments` (`public=false`, giới hạn 10MB) |
| `004_refactor_chat_to_conversations.sql` | ✅ Đã áp dụng live, đã verify | `004_verify.sql` chạy live: 33/33 check OK, 0 FAIL. `conversations`: 16 channel-type + 8 room-type = 24 rows, khớp đúng số `channels`/`study_rooms` hiện có |
| `005_*` (contract phase) | ❌ Chưa viết | Chờ backend refactor xong (SQLAlchemy models + `MessageService` sang dùng `conversation_id`) |

Các mục § 13–15 dưới đây mô tả schema **đã live thật** trên Supabase kể từ khi 004 chạy — không còn là "đích đến" nữa.

## Quyền truy cập theo loại Conversation

```text
type = channel  → dựa vào group_members (active) + channel_members (nếu private)
type = room     → dựa vào group_members (active) + study_room_members
                    (row tồn tại AND left_at IS NULL)
type = direct   → dựa vào conversation_members
```

Hàm `can_access_conversation(conversation_id)` là entry point duy nhất, tự rẽ nhánh theo `type` — xem § 14.

---

# 13. conversation_type — Enum loại hội thoại

```text
channel
room
direct
```

`group_direct` (nhóm chat DM nhiều người, không gắn Room/Channel) **chưa** nằm trong scope hiện tại — dự kiến thêm sau nếu cần, bằng `ALTER TYPE ... ADD VALUE`.

---

# 14. conversations — Hội thoại (polymorphic)

## Vai trò

Parent chung cho mọi loại chat: channel, room, direct. Mỗi `channels` hiện có và mỗi `study_rooms` hiện có được backfill đúng 1 row `conversations` tương ứng.

## Fields

```text
conversations
├── id
├── type          -- conversation_type
├── channel_id    -- nullable, FK -> channels.id
├── room_id       -- nullable, FK -> study_rooms.id
├── created_by    -- FK -> profiles.id
├── created_at
└── updated_at
```

| Field | Ý nghĩa |
|---|---|
| `type` | `channel` \| `room` \| `direct` |
| `channel_id` | Chỉ set khi `type = channel`, `NULL` với room/direct |
| `room_id` | Chỉ set khi `type = room`, `NULL` với channel/direct |
| `created_by` | Người tạo conversation (`ON DELETE RESTRICT`, giống `channels.created_by`) |

## Ràng buộc polymorphic bắt buộc

```sql
(type = 'channel' AND channel_id IS NOT NULL AND room_id IS NULL)
OR (type = 'room' AND room_id IS NOT NULL AND channel_id IS NULL)
OR (type = 'direct' AND channel_id IS NULL AND room_id IS NULL)
```

## Unique Rule

```text
1 Channel  ↔ tối đa 1 Conversation   (partial unique index trên channel_id)
1 Study Room ↔ tối đa 1 Conversation (partial unique index trên room_id)
```

Không cho phép hai `conversations` row cùng trỏ về một channel/room — tránh việc lịch sử tin nhắn bị chia làm hai nhánh.

## ON DELETE

```text
channel_id  -> CASCADE   (xóa channel kéo theo xóa conversation + messages)
room_id     -> CASCADE   (xóa room kéo theo xóa conversation + messages)
created_by  -> RESTRICT  (không xóa được profile còn đứng tên tạo conversation)
```

---

# 15. conversation_members — Thành viên hội thoại trực tiếp (DM)

## Vai trò

**Chỉ dùng cho `type = direct`** ở phase hiện tại. Channel/Room chat KHÔNG duplicate membership vào đây — vẫn dùng `channel_members`/`study_room_members` như cũ, tránh lưu hai nguồn sự thật cho cùng một thông tin.

## Fields

```text
conversation_members
├── id
├── conversation_id
├── user_id
└── joined_at
```

## Unique Rule

```text
UNIQUE(conversation_id, user_id)
```

## Giới hạn đã biết (chưa giải quyết ở mức DB)

Một cặp user A/B có thể vô tình có **nhiều hơn một** `conversation` type=direct nếu service layer không tự kiểm tra trước khi tạo — DB hiện **không** enforce uniqueness cho cặp DM (membership nằm ở bảng con, không thể declarative-constraint trực tiếp). Việc chống trùng DM phải xử lý ở tầng service (kèm xử lý concurrency, không chỉ `SELECT` rồi `INSERT` đơn giản) khi triển khai DM API — chưa nằm trong scope của migration 004.

---

# 16. study_rooms — Phòng học trực tuyến

## Vai trò

Study Room là phiên học trực tuyến được tạo bên trong một Group.

Host của Study Room **không nhất thiết là Owner hoặc Moderator của Group**.

Một `Member` bình thường vẫn có thể tạo Study Room và trở thành Host của room đó.

## Fields

```text
study_rooms
├── id
├── group_id
├── name
├── description
├── host_id
├── status
├── max_participants
├── created_at
├── started_at
└── ended_at
```

| Field | Ý nghĩa |
|---|---|
| `id` | UUID Study Room |
| `group_id` | Group chứa room |
| `name` | Tên room |
| `description` | Mô tả |
| `host_id` | Người tạo/host |
| `status` | Trạng thái |
| `max_participants` | Số người tối đa |
| `created_at` | Thời điểm tạo |
| `started_at` | Thời điểm bắt đầu |
| `ended_at` | Thời điểm kết thúc |

Mặc định:

```text
max_participants = 50
```

---

# 17. Study Room Status

`study_room_status`:

```text
waiting
active
ended
```

## Lifecycle đề xuất

```text
Room created
    │
    ▼
waiting
    │
    │ session starts
    ▼
active
    │
    │ session finishes / no active participants
    ▼
ended
```

Không nên DELETE room ngay khi kết thúc.

Thay vào đó:

```text
status = ended
ended_at = now()
```

để giữ lịch sử phiên học.

---

# 18. study_room_members — Thành viên trong Study Room

## Vai trò

Theo dõi ai đã/đang tham gia một Study Room.

## Fields

```text
study_room_members
├── id
├── room_id
├── user_id
├── role
├── joined_at
└── left_at
```

## Role

```text
host
moderator
participant
```

| Role | Ý nghĩa |
|---|---|
| `host` | Chủ room |
| `moderator` | Người hỗ trợ quản lý room |
| `participant` | Người tham gia |

## Active Participant

Một member được xem là đang ở trong room khi:

```text
left_at IS NULL
```

---

# 19. Business Rule khi tạo Study Room

Khi user A tạo Study Room:

```text
study_rooms.host_id = A
```

backend đồng thời phải thêm:

```text
study_room_members
├── room_id = room.id
├── user_id = A
├── role = host
├── joined_at = now()
└── left_at = NULL
```

Hai thao tác nên chạy trong cùng transaction.

---

# 20. Join / Leave / Rejoin Study Room

Database có:

```text
UNIQUE(room_id, user_id)
```

Do đó cùng một user không được tạo nhiều record membership cho cùng một room.

## Join lần đầu

```text
INSERT study_room_members
```

## Leave

```text
UPDATE study_room_members
SET left_at = now()
```

## Rejoin

Không INSERT record mới.

Thay vào đó:

```text
UPDATE study_room_members
SET
    joined_at = now(),
    left_at = NULL
WHERE
    room_id = ?
    AND user_id = ?
```

Đây là behavior khuyến nghị cho MVP.

---

# 21. room_moderation_actions — Lịch sử moderation

## Vai trò

Lưu lịch sử các hành động quản lý trong Study Room.

## Fields

```text
room_moderation_actions
├── id
├── room_id
├── moderator_id
├── target_user_id
├── action
├── reason
└── created_at
```

## Actions

Enum hiện tại:

```text
mute
unmute
kick
raise_hand
lower_hand
```

Ví dụ:

```text
Host A kicks User B

room_moderation_actions:
    room_id = X
    moderator_id = A
    target_user_id = B
    action = kick
```

---

# 22. Study Room Permission Model

## Host

Có thể:

- Kick participant.
- Mute/unmute participant.
- Promote/Demote Room Moderator nếu được backend hỗ trợ.
- Kết thúc Study Room.

## Room Moderator

Có thể:

- Kick participant.
- Mute/unmute participant.
- Thực hiện moderation được Host/Backend cho phép.

## Participant

Có thể:

- Join/leave room.
- Raise/lower hand.
- Sử dụng các tính năng học tập thông thường.

---

# 23. resource_folders — Thư mục tài liệu

## Vai trò

Cho phép Group tổ chức tài liệu theo cấu trúc thư mục.

## Fields

```text
resource_folders
├── id
├── group_id
├── parent_folder_id
├── name
├── created_by
└── created_at
```

`parent_folder_id` cho phép nested folder.

Ví dụ:

```text
IELTS
├── Writing
│   ├── Task 1
│   └── Task 2
└── Speaking
```

Root folder:

```text
parent_folder_id = NULL
```

---

# 24. resources — Tài liệu

## Vai trò

Lưu metadata của file.

## Fields

```text
resources
├── id
├── group_id
├── uploader_id
├── folder_id
├── name
├── file_path
├── file_type
├── file_size
├── created_at
└── updated_at
```

## Lưu ý

**File binary không lưu trực tiếp trong PostgreSQL.**

PostgreSQL chỉ lưu:

```text
file_path
file_type
file_size
...
```

File thật nên được lưu tại object storage.

Khuyến nghị nếu đang dùng Supabase:

```text
Supabase Storage
```

Ví dụ bucket:

```text
group-resources
message-attachments
forum-images
avatars
```

---

# 25. forum_categories — Danh mục diễn đàn

## Vai trò

Dùng để phân loại bài viết theo lĩnh vực.

## Fields

```text
forum_categories
├── id
├── name
├── description
└── created_at
```

Ví dụ:

```text
IELTS
Programming
Mathematics
English
Science
Business
```

---

# 26. forum_posts — Bài viết diễn đàn

## Vai trò

Lưu bài viết của user.

## Fields

```text
forum_posts
├── id
├── author_id
├── category_id
├── title
├── content
├── image_path
├── created_at
├── updated_at
└── deleted_at
```

## Soft Delete

`deleted_at` dùng để soft-delete bài viết.

Ví dụ:

```text
deleted_at IS NULL
```

→ bài đang tồn tại.

```text
deleted_at IS NOT NULL
```

→ bài đã bị xóa về mặt logic.

Backend nên mặc định filter:

```sql
WHERE deleted_at IS NULL
```

khi trả danh sách bài viết thông thường.

---

# 27. post_likes — Like bài viết

## Vai trò

Lưu user đã like bài nào.

## Fields

```text
post_likes
├── id
├── post_id
├── user_id
└── created_at
```

## Unique Rule

```text
UNIQUE(post_id, user_id)
```

Một user chỉ like một post tối đa một lần.

Unlike:

```text
DELETE post_likes
WHERE post_id = ? AND user_id = ?
```

---

# 28. comments — Bình luận

## Vai trò

Lưu comment và reply của bài viết.

## Fields

```text
comments
├── id
├── post_id
├── author_id
├── parent_comment_id
├── content
├── created_at
└── updated_at
```

## Comment gốc

```text
parent_comment_id = NULL
```

## Reply

```text
parent_comment_id = ID của comment cha
```

Ví dụ:

```text
Comment A
├── Reply B
├── Reply C
└── Reply D
```

Nếu cần nested reply sâu hơn:

```text
Comment A
└── Reply B
    └── Reply C
```

database hiện vẫn hỗ trợ vì `parent_comment_id` self-reference tới `comments.id`.

---

# 29. comment_likes

## Vai trò

Like comment.

## Fields

```text
comment_likes
├── id
├── comment_id
├── user_id
└── created_at
```

## Unique Rule

```text
UNIQUE(comment_id, user_id)
```

Một user chỉ like một comment một lần.

---

# 30. notifications — Thông báo

## Vai trò

Lưu notification gửi cho user.

## Fields

```text
notifications
├── id
├── user_id
├── type
├── actor_id
├── post_id
├── comment_id
├── group_id
├── is_read
└── created_at
```

## Ý nghĩa

| Field | Ý nghĩa |
|---|---|
| `user_id` | Người nhận notification |
| `actor_id` | Người gây ra action |
| `type` | Loại notification |
| `post_id` | Post liên quan nếu có |
| `comment_id` | Comment liên quan nếu có |
| `group_id` | Group liên quan nếu có |
| `is_read` | Đã đọc hay chưa |
| `created_at` | Thời điểm tạo |

## Notification Types hiện tại

```text
post_like
post_comment
comment_reply
group_invite
group_role_changed
room_kicked
mention
```

Ví dụ:

```text
User A comments vào Post của User B
```

notification:

```text
user_id = B
actor_id = A
type = post_comment
post_id = post.id
```

---

# 31. Tổng quan quan hệ Database

```text
auth.users
    │
    ▼
profiles
    │
    ├─────────────────────────────────────────────┐
    │                                             │
    ▼                                             ▼
groups                                      forum_posts
    │                                             │
    ├── group_members                             ├── post_likes
    │                                             │
    ├── channels                                  └── comments
    │      │                                           │
    │      └── channel_members                         ├── comment_likes
    │                                                   │
    ├── study_rooms                                     └── replies
    │      │
    │      ├── study_room_members
    │      │
    │      └── room_moderation_actions
    │
    ├── resource_folders
    │      │
    │      └── resource_folders
    │           (nested folders)
    │
    └── resources

forum_categories
    │
    └── forum_posts

profiles
    │
    └── notifications
```

## Conversation / Messages (§ 12–15, đã live)

`messages` không còn là con trực tiếp của `channels` — nó đi qua `conversations` trung gian, polymorphic theo `type`. Sơ đồ trên (mục đích minh họa Group hierarchy chung) cố tình không vẽ nhánh này để giữ đơn giản; sơ đồ đúng cho chat là:

```text
channels ──────┐
study_rooms ───┼──► conversations ──► messages
(profiles, DM) ─┘         │
                     conversation_members
                     (chỉ dùng khi type = direct)
```

Đã áp dụng live 2026-08-14, đã verify (33/33 check OK) — xem § 12 để biết chi tiết trạng thái migration.

---

# 32. Quan hệ chính

## User — Group

```text
profiles
   │
   │ many-to-many
   ▼
group_members
   │
   ▼
groups
```

## Group — Channel

```text
groups
   │ 1:N
   ▼
channels
```

## Channel / Room / Direct — Conversation — Message

```text
channels     ─┐
study_rooms  ─┼─ 1:1 (partial unique) ─► conversations ── 1:N ──► messages
(no table)   ─┘   (direct: không có parent bảng nào, danh tính
                    tới hoàn toàn từ conversation_members)
```

Quan hệ `channels → messages` trực tiếp (1:N) đã **thay thế** bằng quan hệ qua `conversations` ở trên — xem § 12. Trên live DB hiện tại, `messages` vẫn còn cả hai cột (`channel_id` trực tiếp lẫn `conversation_id`) cho tới khi migration 005 chạy.

## Group — Study Room

```text
groups
   │ 1:N
   ▼
study_rooms
```

## Study Room — Members

```text
study_rooms
   │ 1:N
   ▼
study_room_members
```

## Group — Resources

```text
groups
   │ 1:N
   ▼
resources
```

## Category — Posts

```text
forum_categories
   │ 1:N
   ▼
forum_posts
```

## Post — Comments

```text
forum_posts
   │ 1:N
   ▼
comments
```

---

# 33. Backend Layer đề xuất

Nếu sử dụng FastAPI:

```text
Backend
├── models
├── schemas
├── repositories / crud
├── services
├── api
│   └── routes
├── core
│   ├── auth
│   ├── permissions
│   └── config
└── db
```

Luồng:

```text
Request
   ↓
API Route
   ↓
Permission Check
   ↓
Service
   ↓
Repository / CRUD
   ↓
PostgreSQL
```

Không nên đặt toàn bộ business logic trực tiếp trong route.

---

# 34. Các service nghiệp vụ quan trọng

Một số thao tác không nên chỉ là CRUD đơn giản.

## create_group()

Cần:

```text
1. Create groups
2. Create group_members(role=owner)
```

trong cùng transaction.

## create_study_room()

Cần:

```text
1. Validate user thuộc group
2. Create study_rooms
3. Insert study_room_members(role=host)
```

## join_study_room()

Cần:

```text
1. Validate room tồn tại
2. Validate room chưa ended
3. Validate max participants
4. INSERT hoặc UPDATE membership
```

## leave_study_room()

Cần:

```text
1. Set left_at
2. Check số active participants
3. Nếu không còn session hoạt động → cân nhắc end room
```

## create_comment()

Nếu là reply:

```text
parent_comment_id != NULL
```

thì có thể tạo notification:

```text
type = comment_reply
```

cho tác giả comment cha.

---

# 35. Permission Checks đề xuất

Backend nên có các helper/service kiểu:

```text
is_group_member(user_id, group_id)

is_group_owner(user_id, group_id)

is_group_manager(user_id, group_id)

is_room_member(user_id, room_id)

is_room_manager(user_id, room_id)
```

Trong đó:

```text
is_group_manager
=
owner OR moderator
```

và:

```text
is_room_manager
=
host OR room moderator
```

Không nên phụ thuộc hoàn toàn vào role gửi từ frontend.

Role phải được kiểm tra từ database.

---

# 36. Security

Hệ thống đang sử dụng Supabase nên cần kết hợp:

```text
FastAPI Authorization
+
Supabase Row Level Security (RLS)
```

Backend không nên giả định:

> Có endpoint protection là đủ.

RLS giúp bảo vệ dữ liệu ngay ở tầng PostgreSQL.

---

# 37. RLS cần kiểm tra

Trong schema hiện tại có một policy của `room_moderation_actions` chứa điều kiện dạng:

```sql
srm.room_id = srm.room_id
```

Điều kiện này luôn đúng.

Ý định nhiều khả năng phải là so sánh membership room với room của moderation action, ví dụ:

```sql
srm.room_id = room_moderation_actions.room_id
```

Owner database cần kiểm tra lại policy này trước khi production.

Đây là **security issue tiềm năng**, không chỉ là lỗi logic thông thường.

**Xác nhận lại trên live DB (2026-08-14): bug này vẫn còn tồn tại, chưa được fix.** Policy `room_moderation_select` hiện tại:

```sql
(is_room_manager(room_id) OR (EXISTS (
  SELECT 1 FROM study_room_members srm
  WHERE srm.room_id = srm.room_id       -- vẫn tautology
    AND srm.user_id = auth.uid()
    AND srm.left_at IS NULL
)))
```

Hệ quả thực tế: bất kỳ user nào đang là active member của **bất kỳ** study room nào (không nhất thiết room X) đều pass được điều kiện `EXISTS` này khi đọc `room_moderation_actions` của room X — miễn không phải room manager thì vẫn lọt qua nhánh OR thứ hai một cách sai lệch. Chưa nằm trong scope của migration 004 (chỉ đụng tới `messages`/`channels`/`conversations`) — cần một migration riêng (transaction nhỏ, một dòng `CREATE OR REPLACE POLICY` hoặc `ALTER POLICY`) để sửa `srm.room_id = srm.room_id` thành `srm.room_id = room_moderation_actions.room_id`.

## can_access_channel() — bug đã biết, ĐÃ FIX (xác nhận live 2026-08-14)

Tương tự, `can_access_channel()` có một bug khác (không liên quan tới bug trên): nhánh private channel không re-check `group_members.status = 'active'`, nên banned/left member với `channel_members` row còn sót lại vẫn đọc được private channel. Fix đã soạn ở `002_fix_can_access_channel_active_membership.sql` và được gộp lại (idempotent) trong `004_refactor_chat_to_conversations.sql` § 7. **Đã xác nhận live**: đọc lại `pg_get_functiondef` của `can_access_channel()` sau khi 004 chạy, `public.is_group_member(c.group_id, p_user_id)` giờ là điều kiện `AND` bắt buộc (không còn nằm trong nhánh `OR` của riêng private channel) — bug đã được đóng.

## RLS mới cho Conversation (§ 12–15)

`conversations`/`conversation_members`/`messages` (bản mới) dùng chung một entry point:

```text
can_access_conversation(conversation_id)
```

Hàm này (và 2 hàm con `can_access_room_conversation`, `is_conversation_member`) **chỉ nhận resource id, tự đọc `auth.uid()` nội bộ** — không nhận `p_user_id` tùy ý như 3 hàm cũ (`can_access_channel`, `is_group_member`, `is_group_manager`), để tránh việc một client bất kỳ dùng RPC probe quyền truy cập hộ người dùng khác. Chi tiết xem comment trong `004_refactor_chat_to_conversations.sql`.

---

# 38. Quy tắc tránh duplicate data

Các bảng association đã có unique constraint:

```text
group_members:
UNIQUE(group_id, user_id)

channel_members:
UNIQUE(channel_id, user_id)

study_room_members:
UNIQUE(room_id, user_id)

post_likes:
UNIQUE(post_id, user_id)

comment_likes:
UNIQUE(comment_id, user_id)
```

Backend nên xử lý gracefully khi violation xảy ra.

Ví dụ API Like Post nên có semantics rõ ràng:

```text
POST /posts/{id}/like
DELETE /posts/{id}/like
```

thay vì tạo duplicate record.

---

# 39. Quy ước timestamp

Các timestamp nên dùng:

```text
timestamptz
```

và backend truyền/nhận theo ISO 8601.

Ví dụ:

```text
2026-08-09T05:00:00+07:00
```

Database có thể lưu UTC và frontend convert theo timezone người dùng.

---

# 40. File Storage Architecture

Khuyến nghị:

```text
PostgreSQL
    │
    └── metadata only

Supabase Storage
    │
    ├── avatars
    ├── group-resources
    ├── message-attachments
    └── forum-images
```

Database lưu:

```text
bucket/path/file.pdf
```

không lưu binary file trực tiếp.

---

# 41. MVP Scope

Các chức năng cần ưu tiên:

## Authentication

- Login
- Register
- Profile

## Group

- Create group
- Join group
- Group members
- Role management
- Channels
- Messages

## Study Room

- Create
- Join
- Leave
- Host
- Moderator
- Participant
- Moderation history

## Resources

- Folder
- Upload
- Download
- Delete

## Forum

- Categories
- Posts
- Likes
- Comments
- Replies
- Comment likes

## Notifications

- Create notification
- List notification
- Mark read

---

# 42. Các điểm cần thống nhất giữa Dev

Trước khi triển khai sâu, team cần thống nhất:

### Group

- Private group join bằng invite code hay phải approve?
- Moderator có được kick member không?
- Moderator có được ban member không?
- Moderator có được promote moderator khác không?
- Owner transfer ownership có được hỗ trợ không?

### Channel

- `is_private = true` dùng logic nào?
- Ai có quyền add user vào private channel?
- Có cần default `#general` khi tạo group không?

### Study Room

- Room chuyển `active` khi Host join hay khi room được tạo?
- Room tự `ended` khi không còn participant hay chỉ Host được end?
- Host disconnect tạm thời xử lý thế nào?
- Moderator có quyền promote moderator khác không?
- Kick là kick tạm thời hay không cho rejoin?

### Forum

- User có edit post/comment không?
- Delete comment dùng hard delete hay soft delete?
- Nested replies cho phép sâu bao nhiêu level?

### Notifications

- Notification có push realtime không?
- Có cần email notification không?
- Có gom nhiều notification giống nhau không?

---

# 43. Kết luận

Schema hiện tại phù hợp với kiến trúc ứng dụng:

```text
Study Group Platform
+
Study Room
+
Group Resource Storage
+
Learning Forum
+
Notifications
```

Các entity chính đã được tách tương đối rõ ràng.

Backend nên tập trung vào ba nhóm logic quan trọng:

```text
1. Authentication / Authorization
2. Group & Study Room business rules
3. Consistency giữa các bảng quan hệ
```

Đặc biệt cần bảo đảm các cặp dữ liệu:

```text
groups.owner_id
↔
group_members.role = owner
```

và:

```text
study_rooms.host_id
↔
study_room_members.role = host
```

luôn đồng bộ.

---

# 44. Danh sách bảng hiện tại

```text
1. profiles
2. groups
3. group_members
4. channels
5. channel_members
6. messages
7. study_rooms
8. study_room_members
9. room_moderation_actions
10. resource_folders
11. resources
12. forum_categories
13. forum_posts
14. post_likes
15. comments
16. comment_likes
17. notifications
18. conversations              -- migration 004, đã live — xem § 12
19. conversation_members       -- migration 004, đã live — xem § 12
```

Tổng cộng:

```text
19 tables
```

`messages.channel_id` vẫn còn tồn tại song song với `messages.conversation_id` (expand phase, migration 005 sẽ dọn — xem § 12), nên không tính là bảng/cột riêng biệt ở đây.

Ngoài ra database sử dụng các enum domain như:

```text
group_member_role
member_status
channel_type
study_room_status
study_room_member_role
moderation_action
notification_type
conversation_type              -- migration 004, đã live — xem § 13
```

---

**Document status:** Draft technical specification, đã cập nhật theo migration chat → conversation (004 đã áp dụng live — xem § 12–15)
**Purpose:** Shared understanding between Backend / Frontend / Database developers
**Last verified against live Supabase project:** 2026-08-14, sau khi migration 004 chạy (`004_verify.sql`: 33/33 check OK — chi tiết các query đã chạy xem `docs/db/migrations/004_preflight.sql` / `004_verify.sql`)
