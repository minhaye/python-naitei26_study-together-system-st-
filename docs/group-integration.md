# Hướng dẫn tích hợp Group (frontend)

Quản lý nhóm học (`Group`) và thành viên (`GroupMember`: vai trò
`owner`/`moderator`/`member`, trạng thái `active`/`banned`/`left`). Kênh
chat (`Channel`) thuộc về group nhưng được tích hợp riêng — xem
[chat-integration.md](chat-integration.md).

**Đọc trước:
[auth-integration.md — "Lưu ý quan trọng: không phải endpoint nào cũng kiểm
tra token"](auth-integration.md#lưu-ý-quan-trọng-không-phải-endpoint-nào-cũng-kiểm-tra-token).**
Toàn bộ endpoint dưới đây **không** yêu cầu `Authorization` header và
**không** kiểm tra người gọi có đúng là `owner_id`/`user_id` hay không —
frontend phải tự đảm bảo luôn gửi `id` của người dùng đang đăng nhập (lấy từ
`GET /auth/me`), không lấy từ input do người dùng tự nhập.

## Tạo group

```http
POST /groups/
Content-Type: application/json

{
  "name": "Nhóm ôn thi giữa kỳ",
  "description": "...",
  "avatar_url": null,
  "owner_id": "<uuid của người tạo>",
  "is_public": true
}
```

`avatar_url` chỉ là một chuỗi text tuỳ ý ở tầng API — chưa có endpoint upload
ảnh đại diện nhóm (xem [storage-integration.md](storage-integration.md)).
Khi tạo group, backend tự động thêm `owner_id` làm thành viên với
`role = owner`, `status = active` (không cần gọi thêm
`POST /groups/{id}/members`).

`invite_code` được server sinh tự động (chuỗi hex ngẫu nhiên, duy nhất),
trả về trong `GroupResponse` nhưng **không** thể set khi tạo/sửa. Hiện chưa
có endpoint "tham gia bằng invite code" — muốn thêm ai đó vào group hiện
phải gọi thẳng `POST /groups/{group_id}/members`.

## Danh sách / xem chi tiết group

```http
GET /groups/?public_only=true&skip=0&limit=50
GET /groups/{group_id}
```

`public_only=true` (mặc định) chỉ trả group có `is_public = true`.
`public_only=false` trả tất cả group, kể cả group riêng tư mà người dùng
hiện tại không phải thành viên — vì không có kiểm tra quyền, endpoint này
đang lộ thông tin (tên, mô tả) của mọi group riêng tư cho bất kỳ ai gọi.

## Sửa / xoá group

```http
PUT    /groups/{group_id}   { "name": "...", "description": "...", "avatar_url": "...", "is_public": false }
DELETE /groups/{group_id}
```

Chỉ gửi field muốn đổi (các field khác giữ nguyên). Theo policy RLS đã định
nghĩa sẵn trong Supabase (`groups_update_manager`, `groups_delete_owner`),
mô hình đúng phải là: chỉ **owner** mới được xoá, chỉ **owner** mới được
sửa — nhưng như đã nêu ở trên, policy này không được backend hiện tại kiểm
tra, frontend cần tự ẩn/khoá các nút sửa/xoá dựa trên vai trò của người
dùng lấy qua `GET /groups/{group_id}/members/{user_id}`.

Xoá group: `owner_id` có `ondelete="RESTRICT"` với `profiles`, và các bảng
con (`group_members`, `channels`, `resources`, `resource_folders`,
`study_rooms`, `notifications`) đều `ondelete="CASCADE"` — xoá group sẽ xoá
theo toàn bộ dữ liệu liên quan trong group đó (kênh chat, tin nhắn, tài
liệu, phòng học...). Đây là hành động không thể hoàn tác, nên hỏi xác nhận
người dùng trước khi gọi.

## Thành viên nhóm

```http
POST   /groups/{group_id}/members
GET    /groups/{group_id}/members
GET    /groups/{group_id}/members/{user_id}
PUT    /groups/{group_id}/members/{user_id}/role?role=moderator
PUT    /groups/{group_id}/members/{user_id}/status?member_status=banned
DELETE /groups/{group_id}/members/{user_id}
```

Thêm thành viên:

```json
POST /groups/{group_id}/members
{
  "group_id": "<phải trùng với group_id trên URL>",
  "user_id": "<uuid>",
  "role": "member",
  "status": "active"
}
```

`role` nhận `owner` | `moderator` | `member`; `status` nhận
`active` | `banned` | `left`. `role`/`status` mặc định `member`/`active` nếu
không truyền. `409`/`400` nếu user đã là thành viên (kiểm tra qua unique
constraint `(group_id, user_id)`).

Đổi vai trò / trạng thái dùng query param (không phải JSON body):

```http
PUT /groups/{group_id}/members/{user_id}/role?role=moderator
PUT /groups/{group_id}/members/{user_id}/status?member_status=left
```

Theo RLS đã định nghĩa (`group_members_insert`,
`group_members_update_manager`), mô hình đúng là: một user chỉ tự thêm được
chính mình với `role=member, status=active` (ví dụ tự join group public);
mọi thao tác khác (đổi role, đổi status của người khác, thêm người khác)
chỉ owner/moderator mới được làm, và không ai được set `role=owner` qua các
endpoint này. Backend hiện chưa enforce điều này — tự kiểm soát ở UI.

## Đề xuất tiếp theo (chưa làm)

Wire `Depends(get_current_user)` (từ `app/auth/dependencies.py`) và
`app/core/permissions.is_active_group_member` /
`app/core/permissions.is_group_manager` vào `group_router.py`, theo đúng
mẫu đã có ở `app/messages/routers/message_router.py`. Việc này sẽ:

- Chặn `owner_id` giả mạo khi tạo group (ép `owner_id = current_user.id`).
- Chặn sửa/xoá group, đổi role/status thành viên nếu người gọi không phải
  owner/moderator của group đó.
- Cho `GET /groups/?public_only=false` chỉ trả thêm các group riêng tư mà
  chính người gọi là thành viên, thay vì mọi group riêng tư.
