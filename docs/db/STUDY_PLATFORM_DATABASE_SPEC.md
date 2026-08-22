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
| `invite_code` | (Superseded, unused) DB-generated column, never read/validated by any endpoint. Real invite-code generation/redemption now lives entirely in the `invitations` table -- see `docs/invitations.md`, migration 013. |
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

**Không** thể:

- Tạo Study Room (đã đổi 2026-08-18 — xem § 16 "Vai trò"; trước đó Member được phép tạo).
- Có quyền quản lý người dùng khác chỉ vì là Member.

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

**Cơ chế thực tế (xác nhận live 2026-08-17, xem migration 008):** invariant này
được đảm bảo bởi trigger DB `groups_add_owner` (AFTER INSERT ON `groups`, gọi
`add_group_owner()` — SECURITY DEFINER, dùng `INSERT ... ON CONFLICT (group_id,
user_id) DO UPDATE`), **không phải** bởi application code. `GroupsService.create()`
(app/groups/services/group_service.py) chỉ insert vào `groups` — nó **không được**
tự insert `group_members(role=owner)` nữa. Trước đây `GroupsService.create()` từng
làm việc này song song với trigger, và hai insert đó đụng độ, gây
`UniqueViolation` trên `group_members_group_id_user_id_key` (mỗi INSERT vào
`groups` chỉ nên dẫn tới đúng MỘT insert vào `group_members` cho owner). Nếu cần
thay đổi cơ chế này trong tương lai, sửa ở tầng trigger (và cập nhật migration
008), không thêm lại insert phía application.

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
├── updated_at
├── deleted_at
└── deleted_by
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
| `deleted_at` | Thời điểm soft-delete, `NULL` nếu channel chưa bị xóa |
| `deleted_by` | Người thực hiện soft-delete (FK -> `profiles.id`, `ON DELETE RESTRICT`), `NULL` nếu channel chưa bị xóa |

## Soft Delete (migration 009, xác nhận thiết kế 2026-08-18)

`deleted_at`/`deleted_by` dùng để soft-delete channel — cùng quy ước với
`forum_posts` (§ 26), cộng thêm `deleted_by` để ghi lại ai đã xóa. Backend
luôn tự lấy `deleted_by` từ người gọi đã xác thực (bearer token), không bao
giờ tin một giá trị `deleted_by` do client gửi lên.

```text
deleted_at IS NULL
```

→ channel đang hoạt động bình thường.

```text
deleted_at IS NOT NULL
```

→ channel đã bị xóa về mặt logic. Row `channels`, `conversations`, và toàn
bộ `messages` lịch sử của nó **vẫn còn nguyên trong database** — không có gì
bị xóa vật lý. Chỉ có quyền truy cập bị thu hồi:

```text
Channel deleted
→ Channel row vẫn còn
→ Conversation vẫn còn
→ Messages vẫn còn
→ truy cập qua Conversation đó bị từ chối
```

`can_access_channel()` (cả bản Python trong `app/core/permissions.py` lẫn
bản SQL/RLS) kiểm tra `deleted_at IS NULL` trước tiên, trước mọi nhánh
public/private/manager/member khác — một channel đã xóa bị từ chối cho MỌI
người gọi, kể cả group owner/moderator. Vì `channels_select`,
`channel_members_select`, `conversations_select`, và `messages_select` (bao
gồm cả đường Realtime) đều gọi qua hàm này, việc sửa một hàm duy nhất áp
dụng cho tất cả các đường đó.

Backend nên mặc định filter:

```sql
WHERE deleted_at IS NULL
```

khi trả danh sách channel thông thường (`ChannelsService.list_by_group`).
`GET /channels/{id}` và các endpoint quản lý thành viên trả `404 Not Found`
cho một channel đã bị xóa, giống như thể nó không tồn tại.

Chỉ group owner/moderator (`is_group_manager`) mới được phép soft-delete
(`DELETE /channels/{id}`) — thành viên thường hoặc người ngoài nhóm bị từ
chối. Migration 009 cũng khóa 2 đường bypass trực tiếp qua Postgres/PostgREST
đã phát hiện khi rà soát RLS live: `channels_delete_manager` (cho phép DELETE
vật lý — đã bị xóa hẳn, không có policy thay thế, giống quy ước đã áp dụng
cho `messages`) và `channels_update_manager` (thiếu điều kiện `deleted_at is
null`, cho phép sửa/undelete một channel đã xóa trực tiếp qua Postgres).

Không có tính năng Restore (khôi phục) trong phạm vi hiện tại, nhưng thiết
kế cho phép làm điều đó sau này chỉ bằng cách set lại
`deleted_at = NULL, deleted_by = NULL`.

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

## Trạng thái hiện tại (xác nhận 2026-08-15) — expand + contract đã xong, Direct Message (1-1) đã live

`channel_id` ở trên là schema mục tiêu, **và đây cũng là schema thật hiện tại** — migration 005 (contract phase) đã chạy live, `messages.channel_id` đã bị xóa hẳn khỏi database. Toàn bộ chuỗi 004 → 005 → 006 giờ đã áp dụng xong trên Supabase:

```text
messages
├── id
├── conversation_id    ← NOT NULL, FK -> conversations.id; source of truth duy nhất
├── sender_id
├── content
├── attachment_path
├── created_at
└── updated_at
```

Backend (SQLAlchemy models, `MessagesService`, routers, `app/core/permissions.py`) đã refactor xong sang `conversation_id` từ trước (004 → 005). Trigger tương thích `messages_sync_conversation_id` và cột `messages.channel_id` đã bị 005 dọn sạch — không còn tồn tại trên live DB, không còn được backend tham chiếu.

Tiếp theo, migration 006 (`006_direct_conversation_pair_uniqueness.sql`) **đã chạy live** (xác nhận bởi người vận hành database), thêm ràng buộc uniqueness ở tầng DB cho cặp user của Direct Message — xem § 15. Cùng với đó, tầng application (FastAPI) đã triển khai đầy đủ Direct Message 1-1: `POST /conversations/direct`, `GET /conversations/direct`, dùng chung `GET/POST /conversations/{conversation_id}/messages` với channel/room. Chi tiết đầy đủ ở § 12–15.

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

## Trạng thái migration (xác nhận live 2026-08-16)

| File | Trạng thái | Ghi chú |
|---|---|---|
| `001_enable_realtime_messages.sql` | ✅ Đã áp dụng live | Bật Realtime cho `messages` |
| `002_fix_can_access_channel_active_membership.sql` | ✅ Fix đã sống (qua 004 §7) | `can_access_channel()` live hiện đã re-check `group_members.status='active'` — xác nhận bằng cách đọc lại function body thật |
| `003_create_message_attachments_bucket.sql` | ✅ Đã áp dụng live | `storage.buckets` xác nhận có `message-attachments` (`public=false`, giới hạn 10MB) |
| `004_refactor_chat_to_conversations.sql` | ✅ Đã áp dụng live, đã verify | `004_verify.sql` chạy live: 33/33 check OK, 0 FAIL. `conversations`: 16 channel-type + 8 room-type = 24 rows, khớp đúng số `channels`/`study_rooms` hiện có |
| `005_contract_messages_to_conversations.sql` | ✅ Đã áp dụng live | `messages.channel_id`, FK, index cũ, và trigger `messages_sync_conversation_id` đã bị xóa. `messages.conversation_id` là cột duy nhất còn lại, backend (SQLAlchemy + routers) đã refactor và test khớp trước khi chạy |
| `006_direct_conversation_pair_uniqueness.sql` | ✅ Đã áp dụng live | Thêm `conversations.direct_user_min_id`/`direct_user_max_id` + CHECK + partial unique index, đảm bảo một cặp user chỉ có tối đa một `conversation` type=direct — xem § 15 |
| `007_fix_room_moderation_select_policy.sql` | ✅ Đã áp dụng live | Sửa tautology `srm.room_id = srm.room_id` trong policy `room_moderation_select` trên `room_moderation_actions` thành `srm.room_id = room_moderation_actions.room_id` — xem § 37 |

Các mục § 13–15 dưới đây mô tả schema **đã live thật** trên Supabase kể từ khi 006 chạy — không còn là "đích đến" nữa.

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

Parent chung cho mọi loại chat: channel, room, direct. Migration 004 backfill đúng 1 row `conversations` cho mỗi `channels`/`study_rooms` **hiện có tại thời điểm 004 chạy** — đây là một lần dọn dữ liệu lịch sử, không phải cơ chế tạo Conversation lâu dài.

**Cập nhật 2026-08-18 (Study Room → Conversation creation invariant):** với Channel, việc tạo Conversation đã luôn là một phần của `ChannelsService.create()` (insert Channel, flush, insert Conversation type=channel trong cùng transaction — xem `app/channels/services/channel_service.py`). Với Study Room thì KHÔNG — `StudyRoomsService.create()` trước bản vá này chỉ insert `study_rooms` + `study_room_members` (host), không hề tạo `conversations`. Hệ quả: mọi Study Room tạo ra sau khi 004 chạy (và trước bản vá này) hoàn toàn không có Conversation — `room_id` đó không khớp với row `conversations` nào cả, nên chat/attachment/meeting-token cho room đó bị hỏng dù các thao tác khác (detail, members, start/end, moderation) vẫn hoạt động bình thường.

Đã sửa: `StudyRoomsService.create()` giờ tạo cả ba thứ nguyên tử trong cùng một transaction/session — Study Room, `study_room_members` (host), và Conversation type=room — giống hệt pattern của `ChannelsService.create()`. Nếu bước tạo Conversation thất bại (ví dụ vi phạm `conversations_room_id_key`), exception đó phải propagate ra ngoài `create()` mà không bị nuốt, để router (`study_room_router.create_room`) rollback toàn bộ transaction — không được để lại Study Room hay `study_room_members` mồ côi. Từ nay:

```text
Study Room hợp lệ
→ LUÔN có đúng 1 Conversation type=room
```

giữ đúng như bất biến đã thiết kế, không còn phụ thuộc vào một lần backfill lịch sử. Dữ liệu cũ (room tạo ra trong khoảng gap nói trên, kể cả room đã soft-delete) đã được sửa bằng migration 012 (`012_backfill_missing_room_conversations.sql`) — **đã áp dụng live và verify thành công**. `012_verify.sql` xác nhận: mọi Study Room (kể cả room đã soft-delete) có đúng 1 Conversation type=room, không room nào có nhiều hơn 1, `created_by` của các Conversation được backfill khớp đúng `host_id` của room tương ứng, trạng thái soft-delete không bị đổi, không mất row `study_rooms`/`conversations` nào có sẵn, `conversations_room_id_key` và `conversations_type_target_check` vẫn còn nguyên, RLS vẫn bật trên `conversations`/`messages`/`study_rooms`. Số liệu quan sát được tại thời điểm verify (lịch sử, không phải bất biến để so sánh cho các lần chạy sau): `study_rooms`=11, room-type conversations trước khi chạy=8 (3 room bị thiếu), sau khi chạy=11. Xem `docs/db/migrations/README.md`.

`StudyRoom.conversation_id` (Python, đọc qua relationship `StudyRoom.conversation` đã eager-load ở `StudyRoomsService.get_by_id`/`list_by_group`, và được set trong bộ nhớ ngay sau khi tạo) được thêm vào `StudyRoomResponse`, cùng cơ chế với `Channel.conversation_id`/`ChannelResponse.conversation_id` đã có từ trước — đây là cách duy nhất frontend có thể lấy được `conversation_id` của một room để gọi các endpoint `/conversations/{conversation_id}/messages` (không có endpoint tra cứu Conversation theo `room_id` riêng).

## Fields

```text
conversations
├── id
├── type                  -- conversation_type
├── channel_id            -- nullable, FK -> channels.id
├── room_id               -- nullable, FK -> study_rooms.id
├── created_by            -- FK -> profiles.id
├── direct_user_min_id    -- nullable, FK -> profiles.id (migration 006, chỉ set khi type=direct)
├── direct_user_max_id    -- nullable, FK -> profiles.id (migration 006, chỉ set khi type=direct)
├── created_at
└── updated_at
```

| Field | Ý nghĩa |
|---|---|
| `type` | `channel` \| `room` \| `direct` |
| `channel_id` | Chỉ set khi `type = channel`, `NULL` với room/direct |
| `room_id` | Chỉ set khi `type = room`, `NULL` với channel/direct |
| `created_by` | Người tạo conversation (`ON DELETE RESTRICT`, giống `channels.created_by`) |
| `direct_user_min_id` / `direct_user_max_id` | Cặp user id của cuộc DM, luôn được sort (`min < max`) để A→B và B→A cùng resolve về một row. Chỉ set khi `type = direct`, `NULL` với channel/room. Xem § 15 để biết lý do và cách dùng |

## Ràng buộc polymorphic bắt buộc

```sql
(type = 'channel' AND channel_id IS NOT NULL AND room_id IS NULL)
OR (type = 'room' AND room_id IS NOT NULL AND channel_id IS NULL)
OR (type = 'direct' AND channel_id IS NULL AND room_id IS NULL)
```

Migration 006 thêm một CHECK thứ hai, độc lập với CHECK trên (`conversations_direct_pair_check`):

```sql
(type = 'direct' AND direct_user_min_id IS NOT NULL AND direct_user_max_id IS NOT NULL
   AND direct_user_min_id < direct_user_max_id)
OR (type <> 'direct' AND direct_user_min_id IS NULL AND direct_user_max_id IS NULL)
```

## Unique Rule

```text
1 Channel    ↔ tối đa 1 Conversation          (partial unique index trên channel_id)
1 Study Room ↔ tối đa 1 Conversation          (partial unique index trên room_id)
1 cặp user   ↔ tối đa 1 Conversation type=direct (partial unique index trên
                (direct_user_min_id, direct_user_max_id) where type='direct' — migration 006)
```

Không cho phép hai `conversations` row cùng trỏ về một channel/room, và (từ 006) không cho phép hai `conversations` row type=direct cùng một cặp user — tránh việc lịch sử tin nhắn bị chia làm hai nhánh.

## ON DELETE

```text
channel_id           -> CASCADE   (xóa channel kéo theo xóa conversation + messages)
room_id              -> CASCADE   (xóa room kéo theo xóa conversation + messages)
created_by           -> RESTRICT  (không xóa được profile còn đứng tên tạo conversation)
direct_user_min_id   -> CASCADE   (xóa profile của 1 trong 2 người kéo theo xóa DM đó)
direct_user_max_id   -> CASCADE   (tương tự, giống ON DELETE của conversation_members.user_id)
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
├── joined_at
└── last_read_at   -- migration 024, đã live. NOT NULL, default now(). Cột duy nhất được
                    -- ghi qua POST /conversations/{id}/read (ConversationsService.mark_read);
                    -- không có RLS write policy mới -- FastAPI vẫn là writer duy nhất, giống
                    -- mọi cột khác trên bảng này.
```

## Unique Rule

```text
UNIQUE(conversation_id, user_id)
```

## Chống trùng DM cho một cặp user — đã giải quyết (migration 006)

`conversation_members` tự thân không thể declarative-constraint "cặp user A/B chỉ có tối đa 1 conversation", vì đây là bảng con (membership nằm ở 2 row riêng biệt, không phải 1 row đại diện cho cặp). Giải pháp (migration 006, § 14): thêm `direct_user_min_id`/`direct_user_max_id` trực tiếp trên `conversations` (luôn sort để A→B và B→A cùng resolve về 1 row), ràng buộc bởi CHECK + một partial unique index trên `(direct_user_min_id, direct_user_max_id) WHERE type='direct'`.

Race condition (A và B cùng mở DM gần như đồng thời) được xử lý ở tầng service bằng SAVEPOINT + retry, không phải `SELECT` rồi `INSERT` đơn giản: `ConversationsService.get_or_create_direct` (`app/conversations/services/conversation_service.py`) SELECT trước; nếu miss thì INSERT bên trong `session.begin_nested()` (SAVEPOINT thật); nếu insert thua race (`IntegrityError` từ unique index), SAVEPOINT tự rollback (không rollback cả transaction), rồi service SELECT lại để trả về row mà transaction thắng đã commit.

## API layer đã triển khai

```text
POST /conversations/direct       body: {"user_id": "<uuid>"}   -- idempotent get-or-create, luôn 200
GET  /conversations/direct                                      -- danh sách DM của current user,
                                                                  -- mỗi item kèm unread_count
POST /conversations/{id}/read                                   -- đánh dấu đã đọc (chỉ type=direct),
                                                                  -- set last_read_at = now()
```

`unread_count` (trên mỗi item của `GET /conversations/direct`) = số `messages` của conversation đó có `sender_id != current_user_id` và `created_at > conversation_members.last_read_at` (của current user trong conversation đó) — tính bằng 1 query gộp (`ConversationsService.count_unread_for_user`), không phải N query riêng lẻ mỗi conversation.

Sau khi có `conversation_id`, DM dùng chung API generic với channel/room — không có endpoint message riêng cho DM:

```text
GET/POST /conversations/{conversation_id}/messages
GET/PATCH/DELETE /messages/{message_id}
POST /conversations/{conversation_id}/attachments/upload-url
GET  /messages/{message_id}/attachment-url
```

Authorization (`app/core/permissions.py::can_access_conversation`, nhánh `DIRECT`) delegate sang `ConversationsService.is_member` — cùng logic với hàm SQL `is_conversation_member()` dùng trong RLS (§ 37). Attachment của DM dùng namespace riêng trong Storage: `direct/{conversation_id}/{user_id}/{object_id}/{filename}` (song song với `groups/{group_id}/channels/{channel_id}/...` của channel và `study-rooms/{room_id}/{user_id}/...` của room).

---

# 16. study_rooms — Phòng học trực tuyến

## Vai trò

Study Room là phiên học trực tuyến được tạo bên trong một Group.

**Cập nhật 2026-08-18 (thay thế nội dung cũ bên dưới):** chỉ một Group `owner` hoặc
`moderator` đang **active** (`is_group_manager`) mới được tạo Study Room
(`POST /study-rooms/`) — một `member` bình thường bị từ chối với `403`, kể cả khi đang là
thành viên active của group. Danh tính người tạo luôn lấy từ caller đã xác thực và trở
thành `host_id`, không đổi so với trước.

*(Nội dung dưới đây mô tả hành vi trước 2026-08-18, giữ lại để tham chiếu lịch sử: "Host của
Study Room không nhất thiết là Owner hoặc Moderator của Group. Một Member bình thường vẫn có
thể tạo Study Room và trở thành Host của room đó." — không còn đúng, kể cả cho quyền quản lý
sau khi tạo, xem "Host vs. Group role" ngay dưới đây.)*

## Host vs. Group role (chốt chính sách 2026-08-18)

`study_rooms.host_id` **chỉ là metadata xác định người tạo/host gốc của room** — nó **không**
phải một quyền cấp phép độc lập hay vĩnh viễn. Toàn bộ thẩm quyền QUẢN LÝ room (update Room,
start/end Room, xóa Room, đổi role thành viên room, KICK/MUTE/UNMUTE) được suy ra hoàn toàn từ
vai trò Group **hiện tại** của người gọi:

```text
can_manage_room(room, user)
  = room chưa bị soft-delete
    AND is_group_manager(room.group_id, user)   -- active Group owner/moderator, hiện tại
```

`is_room_host`/`is_room_moderator` (kiểm tra `host_id` hoặc `study_room_members.role` không
kèm điều kiện Group role hiện tại) đã bị loại bỏ khỏi mọi đường cấp quyền quản lý — xem
`app/core/permissions.py::can_manage_room` và `app/study_rooms/routers/study_room_router.py`
(2026-08-18). Hệ quả: một Moderator tạo room rồi bị Owner demote xuống Member (hoặc bị
ban/rời group) **không còn** giữ quyền quản lý room đó — `room.host_id` của họ không đổi,
nhưng update/start/end/delete/kick/mute/đổi-role đều trả về `403`. Vai trò
`study_room_members.role = moderator` (room-scoped, xem § 22) cũng không còn tự nó cấp quyền
quản lý — chỉ Group owner/moderator hiện tại mới có; § 22 mô tả hành vi trước bản cập nhật
này, giữ lại để tham chiếu lịch sử.

Quyền THAM GIA (participation — xem room, join/leave, chat, đính kèm file, lấy meeting token)
vẫn tách biệt với quyền quản lý, và **cũng không** còn nhận `host_id` làm cơ sở cấp quyền độc
lập. Kể từ bản vá parity 2026-08-18, quy tắc THAM GIA chuẩn (canonical) là:

```text
can_access_room(room, user)
  = room chưa bị soft-delete (deleted_at IS NULL)
    AND user là active Group member HIỆN TẠI của room.group_id (is_active_group_member)
    AND user có một hàng study_room_members đang active (left_at IS NULL) cho chính room đó
```

cả `can_access_room()` (Python, `app/core/permissions.py`) lẫn `can_access_room_conversation()`
(SQL/RLS, migration 011, đã áp dụng live) đều thực thi đúng ba điều kiện này — không có nhánh
nào khác, kể cả cho Group owner/moderator đang quản lý room đó (quyền quản lý và quyền tham gia
là hai khái niệm tách biệt: một manager vẫn cần chính hàng `study_room_members` active của họ
để đọc/gửi chat, giống mọi participant khác).

Trước bản vá 2026-08-18, `can_access_room()` phía Python **chỉ** kiểm tra hàng
`study_room_members` đang active — thiếu hẳn điều kiện Group-membership mà SQL/RLS migration
011 đã có sẵn. Vì rời/bị ban khỏi Group không tự động cập nhật `study_room_members.left_at` của
bất kỳ room nào (không có cascade nào giữa hai bảng), một user rời hoặc bị ban khỏi Group vẫn có
thể giữ hàng `study_room_members` active và tiếp tục đọc/gửi tin nhắn room đó qua FastAPI —
trong khi Realtime/PostgREST trực tiếp (đi qua SQL/RLS) đã đúng đắn từ chối cùng request đó kể
từ khi 011 chạy live. Đây là một Python/SQL parity bug thật, đã được sửa hoàn toàn ở phía Python
(`can_access_room()` thêm điều kiện `is_active_group_member`; endpoint join
(`POST /study-rooms/{id}/join`) cũng thêm cùng điều kiện này làm tiền đề join/rejoin riêng, vì
người join lần đầu chưa có `study_room_members` để `can_access_room()` kiểm tra được — không
dùng `can_access_room()` làm gate cho chính join). **Không cần migration SQL mới** — migration
011 đã triển khai đúng quy tắc chuẩn ở tầng SQL/RLS từ trước.

Điều này an toàn — không tạo ra "host không vào được room của chính mình" — vì
`StudyRoomsService.create()` luôn insert một hàng `study_room_members` role=`host`, `left_at IS
NULL` cho người tạo, trong cùng transaction với room, và người tạo bắt buộc phải là active Group
owner/moderator tại thời điểm tạo (`is_group_manager`, xem "Vai trò" ở trên); một host còn đang
tham gia room và còn active trong Group luôn thỏa cả hai điều kiện này. Một host mất quyền truy
cập khi: đã rời room (`left_at` được set), HOẶC Group membership của họ không còn active (rời/bị
ban Group) — dù `study_room_members` của họ vẫn còn active. `host_id` không tự nó bypass điều
kiện nào ở trên, dù là quyền quản lý hay quyền tham gia; room-scoped role (`study_room_members.role`)
cũng không bypass yêu cầu Group-membership.

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
├── ended_at
├── deleted_at
└── deleted_by
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
| `deleted_at` | Thời điểm soft-delete, `NULL` nếu room chưa bị xóa |
| `deleted_by` | Người thực hiện soft-delete (FK -> `profiles.id`, `ON DELETE RESTRICT`), `NULL` nếu room chưa bị xóa |

Mặc định:

```text
max_participants = 50
```

## Soft Delete (migration 010, xác nhận thiết kế 2026-08-18)

`deleted_at`/`deleted_by` dùng để soft-delete Study Room — cùng quy ước với
`channels` (§ 9). Backend luôn tự lấy `deleted_by` từ người gọi đã xác thực
(bearer token), không bao giờ tin một giá trị `deleted_by` do client gửi lên.

Đây là một trục **độc lập** với lifecycle (`status`/`ended_at`, § 17): một
room `ended` vẫn là lịch sử đọc được bình thường; một room bị xóa thì không,
bất kể `status` của nó là gì lúc bị xóa. Không dùng `ended_at`/`status` để
biểu diễn việc xóa.

```text
deleted_at IS NULL
```

→ room đang hoạt động bình thường.

```text
deleted_at IS NOT NULL
```

→ room đã bị xóa về mặt logic. Row `study_rooms`, `conversations`, toàn bộ
`messages` lịch sử, `study_room_members`, và `room_moderation_actions` của nó
**vẫn còn nguyên trong database** — không có gì bị xóa vật lý. Chỉ có quyền
truy cập bình thường bị thu hồi:

```text
Study Room deleted
→ Room row vẫn còn
→ Conversation vẫn còn
→ Messages vẫn còn
→ Members/moderation history vẫn còn
→ truy cập/thao tác bình thường qua room đó đều bị từ chối
```

`can_access_room()`/`can_manage_room()`/`can_join_room()` (Python,
`app/core/permissions.py`) kiểm tra `deleted_at IS NULL` trước tiên, trước
mọi nhánh host/member/moderator khác — một room đã xóa bị từ chối cho MỌI
người gọi, kể cả chính host. Vì `can_access_room` là điểm vào chung cho
message/attachment/meeting-token (qua `can_access_conversation` /
`can_send_to_conversation` / `can_join_room_meeting`), sửa một hàm áp dụng
cho tất cả các đường đó. Ở tầng router, `study_room_router._get_active_room_or_404`
coi room đã xóa giống hệt room không tồn tại (404) cho **mọi** entry point,
kể cả `leave_room` (get/update/start/end/join/leave/members/role/moderation/
meeting-token/delete) — rời một room đã bị xóa cũng bị từ chối, đúng theo bất
biến "một khi `deleted_at != NULL`, mọi thao tác thông thường trên room đó
phải dừng lại", kể cả thao tác chỉ động tới `study_room_members` của chính
người gọi. Room `ended` (nhưng chưa xóa) không bị ảnh hưởng — `leave` chưa
từng có lifecycle gate riêng, chỉ `join`/`send message` mới có.

Ở tầng SQL/RLS, `can_access_room_conversation()` (định nghĩa gốc ở § 12,
migration 004) được sửa hai chỗ:

1. Thêm điều kiện `sr.deleted_at is null`, kiểm tra trước tiên — đây là điểm
   vào chung cho `messages_select`/`conversations_select`/Realtime của
   conversation type=room.
2. Thêm nhánh `sr.host_id = auth.uid()` (OR, không điều kiện kèm theo) —
   đóng một parity gap Python/SQL đã tồn tại từ trước: `can_access_room()`
   phía Python luôn cho host quyền truy cập vô điều kiện, kể cả khi
   `study_room_members` của chính host bị thiếu hoặc có `left_at`, nhưng
   `can_access_room_conversation()` trước đây chưa từng có nhánh tương đương
   — một host bị `left_at` set trên hàng ghi của chính mình có thể đọc được
   tin nhắn room qua FastAPI nhưng lại bị RLS/Realtime từ chối cho đúng room
   đó. Vì migration 010 đã đụng tới hàm này để thêm guard `deleted_at`, nhánh
   host được thêm luôn trong cùng lần sửa thay vì giữ nguyên gap. Nhánh
   `study_room_members`/`is_group_member` sẵn có cho member thường **không
   đổi** — chỉ thêm nhánh host, không nới lỏng hay viết lại nhánh non-host.

Khác với channels (§ 9): các RLS policy gốc trên `study_rooms`/
`study_room_members`/`room_moderation_actions` **không được lưu lại trong
repo này** (ra đời trước mọi migration đang track), nên migration 010 không
thể an toàn DROP+CREATE lại các policy permissive đó mà không biết trước nội
dung. Thay vào đó, 010 thêm các policy **RESTRICTIVE** mới yêu cầu
`deleted_at IS NULL` — loại policy này luôn được AND với mọi policy permissive
đã có, nên chỉ có thể thu hẹp quyền truy cập, không bao giờ mở rộng, an toàn
để thêm ngay cả khi không biết nội dung policy hiện tại.

Chỉ room host **hoặc** group owner/moderator đang active (`is_group_manager`)
mới được phép soft-delete (`DELETE /study-rooms/{id}`) — thành viên thường,
người ngoài room, hoặc một group manager đã bị banned/left (`is_group_manager`
đã yêu cầu `MemberStatus.ACTIVE`) đều bị từ chối. Migration 010 cũng khóa
đường bypass vật lý qua Postgres/PostgREST: xóa (drop) mọi policy DELETE cho
role `authenticated` trên `study_rooms`, dò tìm động qua `pg_policies` (không
hardcode tên, vì tên policy gốc không được biết trước).

Không có tính năng Restore (khôi phục) trong phạm vi hiện tại, nhưng thiết kế
cho phép làm điều đó sau này chỉ bằng cách set lại
`deleted_at = NULL, deleted_by = NULL`.

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

**Thay thế 2026-08-18 — xem "Host vs. Group role" ở § 16.** Model Host/Room Moderator/
Participant độc lập với Group role mô tả dưới đây là hành vi **trước** bản cập nhật đó, giữ
lại để tham chiếu lịch sử. Kể từ 2026-08-18: mọi quyền quản lý room (kick/mute/unmute,
update/start/end/delete room, đổi role thành viên room) chỉ do Group `owner`/`moderator`
đang active nắm giữ (`can_manage_room` = `is_group_manager`) — không còn do `host_id` hay
`study_room_members.role = moderator` tự thân cấp. `role` trên `study_room_members`
(`host`/`moderator`/`participant`) vẫn tồn tại và vẫn được set (host khi tạo room; có thể đổi
qua `PUT /study-rooms/{id}/members/{id}/role`, nay chỉ Group manager mới gọi được) nhưng chỉ
mang tính hiển thị/lịch sử — không tự nó cấp quyền quản lý.

## Host (hành vi trước 2026-08-18)

Có thể:

- Kick participant.
- Mute/unmute participant.
- Promote/Demote Room Moderator nếu được backend hỗ trợ.
- Kết thúc Study Room.

## Room Moderator (hành vi trước 2026-08-18)

Có thể:

- Kick participant.
- Mute/unmute participant.
- Thực hiện moderation được Host/Backend cho phép.

## Participant

Có thể (không đổi):

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

**Trạng thái live (2026-08-19):** bucket `group-resources` (private, signed upload/download URL qua `app/resources/services/resource_storage_service.py`, cùng cơ chế với `message-attachments`) đã được tạo bởi migration `014_create_group_resources_bucket.sql` — **đã áp dụng live và verify thành công**. Khoảng 20 row `resources` là dữ liệu seed cũ (`mock-resource-<n>-<m>.<ext>`, không có object Storage tương ứng — xem `docs/db/migrations/README.md` mục 015 để biết nguồn gốc) đã được dọn bởi migration `015_cleanup_stale_mock_resources.sql` — **đã áp dụng live và verify thành công**, giữ nguyên toàn bộ 3 row `resources` thật (không phải seed) và không đụng tới `resource_folders`. Chi tiết trạng thái từng migration: `docs/db/migrations/README.md`.

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

# 27. post_reactions — Cảm xúc trên bài viết

**Migration 028** (`docs/db/migrations/028_add_forum_reactions.sql`, expand phase — ✅ đã chạy
live 2026-08-22) thay thế `post_likes` cũ (boolean-only) bằng multi-emotion reactions, cùng
shape với `message_reactions` (§ so sánh phần Chat): mỗi user chỉ có **một** reaction trên một
post tại một thời điểm (không phải nhiều cảm xúc cùng lúc trên cùng 1 post), chọn emoji khác
sẽ thay thế emoji cũ. Mọi row `post_likes` cũ đã được backfill thành reaction `👍` trước khi
migration 029 (contract phase — ✅ đã chạy live 2026-08-22) xoá hẳn bảng `post_likes`.

## Vai trò

Lưu cảm xúc (emoji) mà user đã bày tỏ trên bài viết nào.

## Fields

```text
post_reactions
├── id
├── post_id
├── user_id
├── emoji        -- CHECK IN ('👍','❤️','😆','😮','😢','😡')
└── created_at
```

## Unique Rule

```text
UNIQUE(post_id, user_id)
```

Một user chỉ có một reaction trên một post tối đa một lần — chọn emoji mới sẽ ghi đè
(`ON CONFLICT ... DO UPDATE`) emoji cũ, không cộng dồn.

Bỏ cảm xúc:

```text
DELETE post_reactions
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

# 29. comment_reactions — Cảm xúc trên bình luận

Cùng migration 028/029 và cùng lý do như § 27 (`post_reactions`) — thay thế `comment_likes`
bằng multi-emotion reactions, một reaction mỗi user mỗi comment.

## Vai trò

Lưu cảm xúc (emoji) mà user đã bày tỏ trên comment nào.

## Fields

```text
comment_reactions
├── id
├── comment_id
├── user_id
├── emoji        -- CHECK IN ('👍','❤️','😆','😮','😢','😡')
└── created_at
```

## Unique Rule

```text
UNIQUE(comment_id, user_id)
```

Một user chỉ có một reaction trên một comment tối đa một lần.

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
├── invitation_id      -- migration 013, applied live and verified 2026-08-18, see docs/invitations.md
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
| `invitation_id` | Invitation liên quan nếu có (GROUP_INVITE / STUDY_ROOM_INVITATION / PRIVATE_CHANNEL_INVITATION) -- Accept/Decline trong UI luôn gọi endpoint redeem/decline của invitation, không tự viết membership. Xem `docs/invitations.md`. |
| `is_read` | Đã đọc hay chưa |
| `created_at` | Thời điểm tạo |

**Bảo mật (2026-08-18):** `POST /notifications/` công khai đã bị **gỡ bỏ** -- audit phát hiện endpoint này không có auth, cho phép bất kỳ ai tạo notification với `user_id`/`actor_id` tuỳ ý (IDOR). Không có caller hợp lệ nào dùng endpoint này (chỉ được gọi in-process từ `InvitationsService`), nên endpoint bị gỡ thay vì chỉ thêm auth. `GET/PUT/DELETE` giờ yêu cầu đăng nhập và chỉ giới hạn ở `user_id = current_user.id`. Ở tầng RLS, `013_preflight.sql` phát hiện `notifications` **đã** bật RLS live với 3 policy chưa từng được ghi lại trong migration file nào (`notifications_select_own`/`_update_own`/`_delete_own`) -- migration 013 (đã chạy live và verify thành công 2026-08-18) giữ nguyên policy SELECT, **đã drop** hai policy UPDATE/DELETE để FastAPI (role `postgres`) là writer duy nhất, khớp với `messages`/`channels`/`invitations`. Xem `docs/invitations.md` § RLS.

## Notification Types hiện tại

```text
post_like
post_comment
comment_reply
group_invite
group_role_changed
room_kicked
mention
study_room_invitation      -- migration 013
private_channel_invitation -- migration 013
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
    ├── group_members                             ├── post_reactions
    │                                             │
    ├── channels                                  └── comments
    │      │                                           │
    │      └── channel_members                         ├── comment_reactions
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

Đã áp dụng live: 004 (2026-08-14), 005 và 006 (2026-08-15), 007 (2026-08-16) — xem § 12 để biết chi tiết trạng thái migration.

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
(profiles)   ─┘   (direct: cặp user identity nằm ở
                    conversations.direct_user_min_id/max_id — § 14 —
                    và được nhân đôi thành 2 row conversation_members)
```

Quan hệ `channels → messages` trực tiếp (1:N) đã **thay thế** bằng quan hệ qua `conversations` ở trên — xem § 12. Migration 005 đã chạy live: `messages.channel_id` không còn tồn tại, `conversation_id` là FK duy nhất từ `messages` xuống `conversations`.

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

trong cùng transaction — nhưng bước 2 do DB trigger `groups_add_owner` /
`add_group_owner()` đảm nhiệm (xem § 8 và migration 008), **không phải**
`GroupsService.create()`. Service chỉ làm bước 1 (insert `groups` với
`owner_id` là caller đã xác thực); tự insert thêm `group_members` ở tầng
application sẽ đụng độ với trigger và vi phạm unique constraint
`group_members_group_id_user_id_key`.

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
2. Validate room chưa bị soft-delete và chưa ended
3. Validate user là active Group member HIỆN TẠI của room.group_id
   (is_active_group_member -- cập nhật 2026-08-18, xem § 16; KHÔNG dùng
   can_access_room() làm gate ở đây, vì người join lần đầu chưa có
   study_room_members để can_access_room() kiểm tra)
4. Validate max participants
5. INSERT hoặc UPDATE (rejoin) membership
```

Một user đã rời/bị ban khỏi Group không được join/rejoin bất kỳ room nào của Group đó, kể cả
nếu họ còn giữ một hàng `study_room_members` cũ (active hoặc đã left) từ trước.

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

# 37. RLS — bug đã biết, ĐÃ FIX (xác nhận live 2026-08-16)

Policy `room_moderation_select` trên `room_moderation_actions` từng chứa điều kiện dạng:

```sql
srm.room_id = srm.room_id
```

Điều kiện này luôn đúng, nên không thực sự lọc theo room của dòng `room_moderation_actions` đang được đọc.

**Xác nhận lại trên live DB (2026-08-14): bug này vẫn còn tồn tại, chưa được fix.** Policy `room_moderation_select` lúc đó:

```sql
(is_room_manager(room_id) OR (EXISTS (
  SELECT 1 FROM study_room_members srm
  WHERE srm.room_id = srm.room_id       -- tautology
    AND srm.user_id = auth.uid()
    AND srm.left_at IS NULL
)))
```

Hệ quả thực tế trước khi fix: bất kỳ user nào đang là active member của **bất kỳ** study room nào (không nhất thiết room X) đều pass được điều kiện `EXISTS` này khi đọc `room_moderation_actions` của room X — miễn không phải room manager thì vẫn lọt qua nhánh OR thứ hai một cách sai lệch. Đây là **security issue thật**, không chỉ là lỗi logic thông thường.

Chưa nằm trong scope của migration 004 (chỉ đụng tới `messages`/`channels`/`conversations`), nên được tách thành migration riêng: `007_fix_room_moderation_select_policy.sql` (`ALTER POLICY`, sửa `srm.room_id = srm.room_id` thành `srm.room_id = room_moderation_actions.room_id`, không đổi gì khác của policy).

**Đã áp dụng live và verify (2026-08-16)** — `007_verify.sql` xác nhận: policy vẫn tồn tại, `qual` không còn chứa tautology, có chứa `srm.room_id = room_moderation_actions.room_id`, RLS vẫn bật trên `room_moderation_actions`, `is_room_manager()` không bị đụng tới. Từ nay policy chỉ cho phép đọc `room_moderation_actions` của room X nếu là room manager (host/moderator) của room X **hoặc** active member của **chính room X đó** — không còn rò rỉ sang room khác.

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

conversation_members:
UNIQUE(conversation_id, user_id)

conversations (chỉ khi type = direct, migration 006):
UNIQUE(direct_user_min_id, direct_user_max_id) WHERE type = 'direct'
-- đảm bảo 1 cặp user chỉ có tối đa 1 conversation type=direct, kể cả khi
-- request A→B và B→A tới gần như đồng thời — xem § 15

post_reactions (§ 27, thay cho post_likes cũ, đã xóa — xem migration 028/029):
UNIQUE(post_id, user_id)

comment_reactions (§ 29, thay cho comment_likes cũ, đã xóa — xem migration 028/029):
UNIQUE(comment_id, user_id)
```

Backend nên xử lý gracefully khi violation xảy ra — với reactions, "violation" được xử lý bằng
upsert (`ON CONFLICT ... DO UPDATE SET emoji = ...`) chứ không phải reject, vì chọn emoji khác
là một hành động hợp lệ (thay thế reaction cũ), không phải lỗi trùng lặp.

Ví dụ API Reaction nên có semantics rõ ràng:

```text
PUT /forum/posts/{id}/reactions      -- upsert reaction của user hiện tại (emoji trong body)
DELETE /forum/posts/{id}/reactions   -- bỏ reaction của user hiện tại
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

- Notification có push realtime không? (vẫn mở -- `notifications` không nằm trong `supabase_realtime` publication)
- Có cần email notification không? Đã trả lời một phần bởi migration 013 (`docs/invitations.md`): email invitation dùng `app/core/email_service.py` (SMTP qua stdlib `smtplib`, hoặc log ra console nếu chưa cấu hình `SMTP_HOST`). Chưa có email cho các loại notification khác (post_like, mention, ...).
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
14. comments
15. notifications
16. conversations              -- migration 004, đã live — xem § 12; 2 cột direct_user_min_id/max_id thêm bởi migration 006 — xem § 14
17. conversation_members       -- migration 004, đã live — xem § 12; cột last_read_at thêm bởi migration 024, đã chạy live 2026-08-21 — xem § 15
18. invitations                -- migration 013, đã chạy live và verify thành công 2026-08-18 — xem docs/invitations.md
19. group_notes                -- migration 019 (đánh số lại từ 016 khi merge origin/master vào feat/notes-persistence, do origin/master đã dùng 016-018 cho forum-hashtag/profile), đã chạy live và verify thành công 2026-08-19 — Ghi chú dùng chung theo Group (không theo Study Room), quyền đọc cho mọi active member, quyền tạo/sửa/xóa chỉ Owner/Moderator — xem docs/db/migrations/README.md
20. message_reactions          -- migration 025, đã chạy live và verify thành công 2026-08-22 — Reaction emoji (kiểu Messenger) trên messages, cho cả 3 loại conversation (channel/room/direct) — xem § 45
21. post_reactions             -- migration 028, đã chạy live 2026-08-22 — Reaction emoji nhiều cảm xúc trên forum_posts, thay cho post_likes (đã bị migration 029 xóa) — xem § 27
22. comment_reactions          -- migration 028, đã chạy live 2026-08-22 — Reaction emoji nhiều cảm xúc trên comments, thay cho comment_likes (đã bị migration 029 xóa) — xem § 29
```

Tổng cộng:

```text
22 tables (tất cả đã live) -- post_likes/comment_likes bị migration 029 xóa hẳn khỏi schema
(contract phase đã chạy live 2026-08-22 — xem docs/db/migrations/README.md); post_reactions/
comment_reactions (migration 028) là FK/bảng duy nhất còn lại cho reaction trên Forum.
```

`messages.channel_id` đã bị migration 005 xóa hẳn khỏi schema (contract phase đã chạy live — xem § 12); `messages.conversation_id` là FK duy nhất còn lại.

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

# 45. message_reactions — Reaction cảm xúc trên tin nhắn (migration 025, đã chạy live và verify thành công 2026-08-22)

## Vai trò

Reaction kiểu Messenger trên `messages` — áp dụng cho cả 3 loại conversation (channel/room/direct) vì tất cả đều dùng chung bảng `messages`/`conversations` (xem § 12, § 14). Mỗi user chỉ có tối đa 1 reaction trên 1 message tại một thời điểm — chọn emoji khác sẽ THAY THẾ reaction cũ, không cộng dồn.

## Fields

```text
message_reactions
├── id
├── message_id       -- FK -> messages.id, ON DELETE CASCADE
├── conversation_id  -- FK -> conversations.id, ON DELETE CASCADE. Denormalize từ
│                        messages.conversation_id lúc ghi (MessagesService.set_reaction) --
│                        CHỈ để Supabase Realtime filter theo conversation_id được (giống
│                        cách bảng messages đang filter), vì postgres_changes chỉ hỗ trợ 1
│                        điều kiện column=eq.value.
├── user_id          -- FK -> profiles.id, ON DELETE CASCADE
├── emoji             -- text, CHECK giới hạn 6 emoji cố định: 👍 ❤️ 😆 😮 😢 😡
│                        (ALLOWED_MESSAGE_REACTIONS trong app/messages/dto/message_dto.py,
│                        QUICK_REACTIONS trong frontend/src/components/chat/MessageReactions.tsx)
└── created_at
```

## Unique Rule

```text
UNIQUE(message_id, user_id)
```

Đồng thời là target của `ON CONFLICT DO UPDATE` trong `MessagesService.set_reaction` — chọn emoji mới ghi đè `emoji` của row cũ thay vì tạo row mới, race-safe cho request đồng thời từ cùng 1 user.

## RLS & Realtime

`REPLICA IDENTITY FULL` (khác với `messages`) — để event Realtime DELETE mang theo đầy đủ `message_id`/`conversation_id` trong payload `old`, vì replica identity mặc định của Postgres chỉ gửi primary key khi DELETE. Không có field này thì client không biết reaction vừa xoá thuộc message nào để re-hydrate.

RLS giống hệt `messages_select` (§ 12): 1 policy SELECT cho `authenticated` qua `can_access_conversation(conversation_id)`, không có write policy cho `authenticated` — FastAPI (`postgres` role) là writer duy nhất. Được thêm vào `supabase_realtime` publication với đầy đủ INSERT/UPDATE/DELETE (khác `messages`, chỉ cần INSERT).

## API layer

```text
PUT    /messages/{message_id}/reactions   body: {"emoji": "👍"}   -- upsert reaction của
                                                                     current user, trả về
                                                                     list[MessageReactionSummary]
DELETE /messages/{message_id}/reactions                          -- xoá reaction của current
                                                                     user (idempotent), trả về
                                                                     list[MessageReactionSummary]
GET    /messages/{message_id}/reactions                          -- dùng để hydrate raw
                                                                     Realtime event thành
                                                                     summary thật (không phải
                                                                     người thao tác gọi endpoint
                                                                     này — họ đã nhận list mới
                                                                     trực tiếp từ PUT/DELETE)
```

`MessageReactionSummary` = `{emoji, count, reacted_by_me}` — dữ liệu đã group theo emoji, không phải raw row. Đính kèm trên `MessageResponse.reactions` cho mọi endpoint đọc message (`GET /conversations/{id}/messages`, `GET /messages/{id}`).

Quyền truy cập dùng `can_access_conversation` (read-level) — KHÔNG dùng `can_send_to_conversation`/`is_room_conversation_open_for_writes`, vì react vào lịch sử chat của 1 Study Room đã kết thúc là vô hại (khác với gửi tin nhắn mới).

---

**Document status:** Draft technical specification, đã cập nhật theo migration chat → conversation + Direct Message (004, 005, 006 đều đã áp dụng live — xem § 12–15)
**Purpose:** Shared understanding between Backend / Frontend / Database developers
**Last verified against live Supabase project:** 2026-08-15, sau khi migration 006 chạy (`006_verify.sql` — chi tiết query xem `docs/db/migrations/006_preflight.sql` / `006_verify.sql`; 004/005 đã verify trước đó, xem `004_verify.sql`/`005_verify.sql`)
