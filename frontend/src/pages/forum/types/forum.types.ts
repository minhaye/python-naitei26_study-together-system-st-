// ─── DTOs — Mirror chính xác response từ Backend API ─────────────────────────
// Các field dùng snake_case theo chuẩn Python/FastAPI

export interface ForumCategoryResponse {
  id: string;                       // UUID
  name: string;
  description: string | null;
  created_at: string;               // ISO datetime string
}

export interface ForumPostResponse {
  id: string;                       // UUID
  author_id: string;                // UUID
  category_id: string;              // UUID
  title: string;
  content: string;
  image_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CommentResponse {
  id: string;                       // UUID
  post_id: string;                  // UUID
  author_id: string;                // UUID
  parent_comment_id: string | null; // null = comment chính, có id = reply
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PostLikeResponse {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface CommentLikeResponse {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
}

// ─── Request Payloads — Gửi lên Backend ──────────────────────────────────────

export interface ForumPostCreate {
  author_id: string;
  category_id: string;
  title: string;
  content: string;
  image_path?: string | null;
}

export interface CommentCreate {
  post_id: string;
  author_id: string;
  parent_comment_id?: string | null;
  content: string;
}

// ─── UI Models — Biến đổi từ DTO để dùng trên giao diện React ────────────────
// Dùng camelCase theo chuẩn JS. Thêm các field tính toán phía client.

export interface Post {
  id: string;
  authorId: string;
  categoryId: string;
  categoryName: string;      // Lấy từ ForumCategoryResponse khi join
  title: string;
  content: string;
  imagePath: string | null;
  createdAt: string;
  timeAgo: string;           // Tính client-side: "2 giờ trước"
  isLiked: boolean;          // Client-side toggle (không có từ BE)
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;        // Lấy từ user profile sau này
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  timeAgo: string;           // Tính client-side
  isLiked: boolean;          // Client-side toggle
  replies: Comment[];        // FE tự nhóm: comment có parentCommentId = id này
}
