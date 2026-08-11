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

---

# 12. study_rooms — Phòng học trực tuyến

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

# 13. Study Room Status

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

# 14. study_room_members — Thành viên trong Study Room

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

# 15. Business Rule khi tạo Study Room

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

# 16. Join / Leave / Rejoin Study Room

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

# 17. room_moderation_actions — Lịch sử moderation

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

# 18. Study Room Permission Model

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

# 19. resource_folders — Thư mục tài liệu

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

# 20. resources — Tài liệu

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

# 21. forum_categories — Danh mục diễn đàn

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

# 22. forum_posts — Bài viết diễn đàn

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

# 23. post_likes — Like bài viết

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

# 24. comments — Bình luận

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

# 25. comment_likes

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

# 26. notifications — Thông báo

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

# 27. Tổng quan quan hệ Database

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
    │      ├── channel_members                         ├── comment_likes
    │      │                                           │
    │      └── messages                                └── replies
    │
    ├── study_rooms
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

---

# 28. Quan hệ chính

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

## Channel — Message

```text
channels
   │ 1:N
   ▼
messages
```

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

# 29. Backend Layer đề xuất

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

# 30. Các service nghiệp vụ quan trọng

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

# 31. Permission Checks đề xuất

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

# 32. Security

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

# 33. RLS cần kiểm tra

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

---

# 34. Quy tắc tránh duplicate data

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

# 35. Quy ước timestamp

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

# 36. File Storage Architecture

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

# 37. MVP Scope

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

# 38. Các điểm cần thống nhất giữa Dev

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

# 39. Kết luận

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

# 40. Danh sách bảng hiện tại

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
```

Tổng cộng:

```text
17 tables
```

Ngoài ra database sử dụng các enum domain như:

```text
group_member_role
member_status
channel_type
study_room_status
study_room_member_role
moderation_action
notification_type
```

---

**Document status:** Draft technical specification  
**Purpose:** Shared understanding between Backend / Frontend / Database developers
