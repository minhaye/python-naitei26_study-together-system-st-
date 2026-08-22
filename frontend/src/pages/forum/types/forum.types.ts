// ─── DTOs — Mirror chính xác response từ Backend API ─────────────────────────

export interface ForumCategoryResponse {
  id: string;                       // UUID
  name: string;
  description: string | null;
  created_at: string;               // ISO datetime string
}

export interface TagResponse {
  id: string;
  name: string;
  post_count: number;
  created_at: string;
}

/** Mirrors ReactionSummary (app/forum/dto/forum_dto.py) -- grouped-by-emoji counts, never raw
 * per-user reaction rows. `reacted_by_me` is relative to whichever user_id was sent with the
 * request. */
export interface ReactionSummaryResponse {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
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
  category_name?: string;
  author_name?: string;
  author_avatar_url?: string | null;
  reactions?: ReactionSummaryResponse[];
  comments_count?: number;
  tags?: string[];
}

export interface CommentResponse {
  id: string;                       // UUID
  post_id: string;                  // UUID
  author_id: string;                // UUID
  parent_comment_id: string | null; // null = comment chính, có id = reply
  content: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_avatar_url?: string | null;
  reactions?: ReactionSummaryResponse[];
}

// ─── Request Payloads — Gửi lên Backend ──────────────────────────────────────

export interface ForumPostCreate {
  author_id: string;
  category_id: string;
  title: string;
  content: string;
  image_path?: string | null;
}

export interface ForumPostUpdate {
  category_id?: string;
  title?: string;
  content?: string;
  image_path?: string | null;
}

export interface CommentCreate {
  post_id: string;
  author_id: string;
  parent_comment_id?: string | null;
  content: string;
}

export interface CommentUpdate {
  content: string;
}

// ─── UI Models — Biến đổi từ DTO để dùng trên giao diện React ────────────────

/** Grouped-by-emoji reaction count for the UI layer -- camelCase mirror of
 * ReactionSummaryResponse. */
export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;        // Name of the author
  authorAvatarUrl: string | null;
  categoryId: string;
  categoryName: string;      // Lấy từ ForumCategoryResponse khi join
  title: string;
  content: string;
  imagePath: string | null;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  timeAgo: string;           // Tính client-side: "2 giờ trước"
  reactions: ReactionSummary[]; // Cảm xúc theo từng loại emoji (thay cho like đơn thuần)
  commentsCount: number;     // Số lượt bình luận
  tags?: string[];           // Danh sách hashtag
  status?: 'sending' | 'updating' | 'error'; // Optimistic UI: undefined = đã lưu thành công
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;        // Lấy từ user profile sau này
  authorAvatarUrl: string | null;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  timeAgo: string;           // Tính client-side
  reactions: ReactionSummary[]; // Cảm xúc theo từng loại emoji (thay cho like đơn thuần)
  replies: Comment[];        // FE tự nhóm: comment có parentCommentId = id này
}
