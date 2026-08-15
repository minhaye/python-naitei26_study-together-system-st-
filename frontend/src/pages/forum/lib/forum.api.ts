/**
 * forum.api.ts — Tầng giao tiếp với Forum API Backend
 *
 * Hiện tại: Dùng mock data trong bộ nhớ (phù hợp khi BE đang phát triển).
 * Khi nối BE thật: Thay phần mock bằng fetch() tương ứng với comment bên cạnh mỗi hàm.
 *
 * Base URL: http://localhost:8000/forum
 *
 * Các endpoint BE có sẵn:
 *   Categories : GET/POST/PUT/DELETE /forum/categories
 *   Posts      : GET /forum/posts?category_id=&skip=&limit=
 *                GET /forum/posts/{id}
 *                POST /forum/posts
 *                DELETE /forum/posts/{id}  (soft delete)
 *   Comments   : GET /forum/comments?post_id=
 *                POST /forum/comments       (parent_comment_id=null → chính, có id → reply)
 *                DELETE /forum/comments/{id}
 *   Likes      : POST   /forum/posts/{id}/like
 *                DELETE /forum/posts/{id}/unlike
 *                POST   /forum/comments/{id}/like
 *                DELETE /forum/comments/{id}/unlike
 */

import type {
  ForumCategoryResponse,
  ForumPostResponse,
  CommentResponse,
  Post,
  Comment,
  ForumPostCreate,
  CommentCreate,
} from '../types/forum.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

/** Map ForumPostResponse (BE DTO) → Post (UI Model) */
function mapPost(dto: ForumPostResponse, categoryName: string, isLiked = false): Post {
  return {
    id: dto.id,
    authorId: dto.author_id,
    categoryId: dto.category_id,
    categoryName,
    title: dto.title,
    content: dto.content,
    imagePath: dto.image_path,
    createdAt: dto.created_at,
    timeAgo: timeAgo(dto.created_at),
    isLiked,
  };
}

/** Map CommentResponse (BE DTO) → Comment (UI Model) */
function mapComment(dto: CommentResponse, authorName: string, isLiked = false): Comment {
  return {
    id: dto.id,
    postId: dto.post_id,
    authorId: dto.author_id,
    authorName,
    parentCommentId: dto.parent_comment_id,
    content: dto.content,
    createdAt: dto.created_at,
    timeAgo: timeAgo(dto.created_at),
    isLiked,
    replies: [],
  };
}

/** Nhóm danh sách comment phẳng → cây 2 cấp (comment + replies) */
function nestComments(flat: Comment[]): Comment[] {
  const roots: Comment[] = [];
  const map = new Map<string, Comment>();
  flat.forEach((c) => map.set(c.id, { ...c, replies: [] }));
  map.forEach((c) => {
    if (c.parentCommentId && map.has(c.parentCommentId)) {
      map.get(c.parentCommentId)!.replies.push(c);
    } else {
      roots.push(c);
    }
  });
  return roots;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
// Giả lập dữ liệu với đúng cấu trúc DTO của BE.

const MOCK_CATEGORIES: ForumCategoryResponse[] = [
  { id: 'cat-1', name: 'Toán học', description: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-2', name: 'Lập trình OOP', description: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-3', name: 'Vật lý đại cương', description: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-4', name: 'Cơ sở dữ liệu', description: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-5', name: 'Hóa học đại cương', description: null, created_at: '2026-01-01T00:00:00Z' },
];

let MOCK_POSTS: ForumPostResponse[] = [
  {
    id: 'post-1', author_id: 'user-1', category_id: 'cat-1',
    title: 'Giúp mình hiểu về tích phân từng phần?',
    content: 'Mình đang mắc ở bài 4 trong phần bài tập. Có ai có thể giải thích chi tiết cách chọn "u" và "dv" sao cho hiệu quả không?',
    image_path: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
    deleted_at: null,
  },
  {
    id: 'post-2', author_id: 'user-2', category_id: 'cat-2',
    title: 'Sự khác biệt giữa Abstract Class và Interface trong Java?',
    content: 'Mọi người cho mình hỏi trong thực tế dự án thì khi nào nên dùng Abstract Class và khi nào thì nên dùng Interface?',
    image_path: null,
    created_at: new Date(Date.now() - 18000000).toISOString(),
    updated_at: new Date(Date.now() - 18000000).toISOString(),
    deleted_at: null,
  },
  {
    id: 'post-3', author_id: 'user-3', category_id: 'cat-3',
    title: 'Giải thích hiện tượng giao thoa ánh sáng đơn sắc?',
    content: 'Tại sao khi dùng ánh sáng trắng thì vân trung tâm lại là vân màu trắng, còn các vân bên cạnh lại có màu như cầu vồng?',
    image_path: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    deleted_at: null,
  },
];

const MOCK_AUTHORS: Record<string, string> = {
  'user-1': 'Hải Minh',
  'user-2': 'Tuấn Tú',
  'user-3': 'Ngọc Anh',
};

let MOCK_COMMENTS: CommentResponse[] = [
  {
    id: 'cmt-1', post_id: 'post-1', author_id: 'user-2', parent_comment_id: null,
    content: 'Bạn cứ nhớ thứ tự ưu tiên chọn u: Logarit → Đa thức → Lượng giác → Mũ.',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'cmt-2', post_id: 'post-1', author_id: 'user-1', parent_comment_id: 'cmt-1',
    content: 'Cảm ơn bạn! Ví dụ có x*ln(x) thì chọn u = ln(x) đúng không?',
    created_at: new Date(Date.now() - 1800000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
  },
];

// Theo dõi trạng thái like phía client
const likedPosts = new Set<string>();
const likedComments = new Set<string>();

// ─── API Functions ─────────────────────────────────────────────────────────────

export const forumApi = {

  /** Lấy tất cả danh mục môn học
   *  BE: GET /forum/categories
   */
  getCategories: async (): Promise<ForumCategoryResponse[]> => {
    // return fetch('/forum/categories').then(r => r.json());
    return Promise.resolve([...MOCK_CATEGORIES]);
  },

  /** Lấy danh sách bài viết theo danh mục, hỗ trợ phân trang (Infinite Scroll)
   *  BE: GET /forum/posts?category_id={id}&skip={skip}&limit={limit}
   *
   *  @param categoryId  - null hoặc undefined = lấy tất cả (mock only; BE bắt buộc có category_id)
   *  @param skip        - Bỏ qua bao nhiêu record (phân trang)
   *  @param limit       - Lấy bao nhiêu record mỗi lần
   */
  getPosts: async (categoryId: string | null, skip = 0, limit = 5): Promise<Post[]> => {
    // return fetch(`/forum/posts?category_id=${categoryId}&skip=${skip}&limit=${limit}`).then(r => r.json());
    let filtered = MOCK_POSTS.filter((p) => !p.deleted_at);
    if (categoryId) {
      filtered = filtered.filter((p) => p.category_id === categoryId);
    }
    const page = filtered.slice(skip, skip + limit);
    return Promise.resolve(
      page.map((p) => {
        const cat = MOCK_CATEGORIES.find((c) => c.id === p.category_id);
        return mapPost(p, cat?.name ?? '', likedPosts.has(p.id));
      })
    );
  },

  /** Tạo bài viết mới
   *  BE: POST /forum/posts
   */
  createPost: async (payload: ForumPostCreate): Promise<Post> => {
    // return fetch('/forum/posts', { method: 'POST', body: JSON.stringify(payload) }).then(r => r.json());
    const newDto: ForumPostResponse = {
      id: `post-${Date.now()}`,
      author_id: payload.author_id,
      category_id: payload.category_id,
      title: payload.title,
      content: payload.content,
      image_path: payload.image_path ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    MOCK_POSTS = [newDto, ...MOCK_POSTS];
    const cat = MOCK_CATEGORIES.find((c) => c.id === payload.category_id);
    return Promise.resolve(mapPost(newDto, cat?.name ?? ''));
  },

  /** Thích bài viết
   *  BE: POST /forum/posts/{post_id}/like   (body: user_id)
   */
  likePost: async (postId: string): Promise<void> => {
    // return fetch(`/forum/posts/${postId}/like?user_id=...`, { method: 'POST' });
    likedPosts.add(postId);
    return Promise.resolve();
  },

  /** Bỏ thích bài viết
   *  BE: DELETE /forum/posts/{post_id}/unlike   (query: user_id)
   */
  unlikePost: async (postId: string): Promise<void> => {
    // return fetch(`/forum/posts/${postId}/unlike?user_id=...`, { method: 'DELETE' });
    likedPosts.delete(postId);
    return Promise.resolve();
  },

  /** Lấy danh sách bình luận của bài viết, trả về cây 2 cấp (replies đã được nhóm)
   *  BE: GET /forum/comments?post_id={post_id}
   */
  getComments: async (postId: string): Promise<Comment[]> => {
    // return fetch(`/forum/comments?post_id=${postId}`).then(r => r.json());
    const flat = MOCK_COMMENTS
      .filter((c) => c.post_id === postId)
      .map((c) => mapComment(c, MOCK_AUTHORS[c.author_id] ?? 'Ẩn danh', likedComments.has(c.id)));
    return Promise.resolve(nestComments(flat));
  },

  /** Đăng bình luận hoặc reply
   *  BE: POST /forum/comments
   *  parent_comment_id = null  → comment chính
   *  parent_comment_id = {id}  → reply cho comment đó
   */
  createComment: async (payload: CommentCreate): Promise<Comment> => {
    // return fetch('/forum/comments', { method: 'POST', body: JSON.stringify(payload) }).then(r => r.json());
    const newDto: CommentResponse = {
      id: `cmt-${Date.now()}`,
      post_id: payload.post_id,
      author_id: payload.author_id,
      parent_comment_id: payload.parent_comment_id ?? null,
      content: payload.content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    MOCK_COMMENTS = [...MOCK_COMMENTS, newDto];
    return Promise.resolve(mapComment(newDto, MOCK_AUTHORS[payload.author_id] ?? 'Bạn'));
  },

  /** Thích bình luận
   *  BE: POST /forum/comments/{comment_id}/like   (body: user_id)
   */
  likeComment: async (commentId: string): Promise<void> => {
    // return fetch(`/forum/comments/${commentId}/like?user_id=...`, { method: 'POST' });
    likedComments.add(commentId);
    return Promise.resolve();
  },

  /** Bỏ thích bình luận
   *  BE: DELETE /forum/comments/{comment_id}/unlike   (query: user_id)
   */
  unlikeComment: async (commentId: string): Promise<void> => {
    // return fetch(`/forum/comments/${commentId}/unlike?user_id=...`, { method: 'DELETE' });
    likedComments.delete(commentId);
    return Promise.resolve();
  },
};
