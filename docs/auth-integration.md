# Hướng dẫn tích hợp Auth (frontend)

Xác thực do **Supabase Auth** đảm nhiệm hoàn toàn. Backend FastAPI **không** có
endpoint đăng ký/đăng nhập/đăng xuất, không lưu mật khẩu, không phát hành
token của riêng nó — nó chỉ **xác minh** access token do Supabase cấp.

## Đăng ký / đăng nhập / đăng xuất

Các thao tác này gọi thẳng Supabase Auth bằng Supabase client SDK
(`supabase-js` hoặc tương đương), **không** đi qua FastAPI:

```text
supabase.auth.signUp({ email, password })
supabase.auth.signInWithPassword({ email, password })
supabase.auth.signOut()
```

- Sau khi `signUp` thành công, trigger `on_auth_user_created` trong DB tự
  động tạo một dòng `profiles` tương ứng — frontend **không** cần tự gọi
  `POST /profiles/` sau khi đăng ký.
- Đăng xuất là hành động thuần client-side (Supabase SDK xoá session cục
  bộ); backend không giữ session nên không có endpoint logout để gọi.
- Sau khi đăng nhập, lưu `access_token` từ session của Supabase — đây là
  token cần gửi cho mọi request tới FastAPI.

## Lấy thông tin người dùng hiện tại

```http
GET /auth/me
Authorization: Bearer <supabase access token>
```

```json
{ "id": "uuid", "email": "user@example.com", "role": "authenticated" }
```

`id`, `email`, `role` được lấy trực tiếp từ claim của JWT (`sub`, `email`,
`role`) — không có truy vấn DB nào ở endpoint này. Dùng để lấy `id` (UUID)
của người dùng hiện tại khi cần điền vào các trường như `owner_id`,
`author_id`, `uploader_id`, `user_id` ở những module khác (xem phần
"Lưu ý quan trọng" bên dưới).

## Gửi token cho các request khác

Mọi request tới API (trừ các route không cần auth) phải có header:

```text
Authorization: Bearer <supabase access token>
```

Không tự ký hay tự tạo token — luôn dùng access token thật lấy từ session
Supabase của người dùng đang đăng nhập. Khi access token hết hạn, dùng
`supabase.auth.refreshSession()` (SDK tự làm việc này ở chế độ mặc định) rồi
gửi lại token mới.

## Cơ chế xác minh token (để hiểu lỗi 401)

`app/auth/services/auth_service.py` xác minh token theo thứ tự:

1. Lấy signing key từ JWKS của Supabase (`RS256`/`ES256`), verify chữ ký,
   `audience = "authenticated"`, `issuer = <SUPABASE_URL>/auth/v1`.
2. Nếu project Supabase là loại cũ dùng HS256 (không public JWKS), fallback
   sang gọi thẳng `GET {SUPABASE_URL}/auth/v1/user` với chính token đó để
   xác minh qua Supabase Auth server — bí mật HS256 của project không được
   hard-code ở đâu trong backend.

Mọi lỗi xác minh trả về `401` kèm header `WWW-Authenticate: Bearer`:

- Thiếu header `Authorization` → `401 Missing bearer token`.
- Token sai định dạng / chữ ký sai / hết hạn → `401 Malformed token` hoặc
  `401 Invalid token: ...`.
- Token hợp lệ nhưng thiếu claim `sub` → `401 Token missing subject claim`.

## Lưu ý quan trọng: không phải endpoint nào cũng kiểm tra token

Hiện tại trong toàn bộ backend, chỉ **`/auth/me`**, các endpoint dưới
`app/messages` và `app/attachments` (xem
[chat-integration.md](chat-integration.md)) là thực sự yêu cầu
`Authorization: Bearer <token>` và kiểm tra quyền truy cập
(`Depends(get_current_user)` + `app/core/permissions.py`).

Các module còn lại — **Groups, Forum, Resources, Profiles, Channels
(CRUD/membership), Study Rooms, Notifications** — router của chúng hiện
**không** có `Depends(get_current_user)` và **không** kiểm tra token. Các
trường như `owner_id`, `author_id`, `uploader_id`, `created_by`, `user_id`
được nhận trực tiếp từ body/query do client gửi lên và được tin tưởng
nguyên trạng — backend không đối chiếu chúng với người dùng đang đăng nhập.

Ngoài ra, kết nối DB của FastAPI (`DATABASE_URL`, xem `app/core/config.py`)
dùng role `postgres` qua Supabase connection pooler — role này **bypass
RLS**, nên các policy RLS đã định nghĩa sẵn trong Supabase (mô hình phân
quyền "đúng" theo `auth.uid()`) **không** có tác dụng đối với các request đi
qua FastAPI; RLS chỉ có hiệu lực với truy cập trực tiếp vào Supabase
(Realtime, PostgREST, Storage) bằng access token của người dùng.

**Hệ quả cho frontend:**

- Luôn tự lấy `id` từ `GET /auth/me` (đã verify token) và dùng chính giá trị
  đó cho `owner_id`/`author_id`/`user_id`/... khi gọi các endpoint chưa có
  auth — đừng để người dùng tự nhập ID.
- Không nên coi các endpoint này là an toàn trước giả mạo (spoofing) ở thời
  điểm hiện tại; đừng dựa vào chúng để hiển thị dữ liệu nhạy cảm chỉ dành
  riêng cho một người dùng cụ thể mà không tự kiểm tra thêm ở phía client.
- Việc còn thiếu (chưa làm ở backend, khuyến nghị làm theo đúng mẫu
  `app/messages/routers/message_router.py` /
  `app/attachments/routers/attachment_router.py`): thêm
  `current_user: CurrentUser = Depends(get_current_user)` và các hàm trong
  `app/core/permissions.py` (`is_active_group_member`, `is_group_manager`)
  vào `group_router`, `forum_router`, `resource_router`, `profile_router`,
  `channel_router`.
