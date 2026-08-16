/**
 * forum.api.ts — Tầng giao tiếp với Forum API Backend (với Mock Data Store lưu trong bộ nhớ)
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
function mapPost(
  dto: ForumPostResponse,
  categoryName: string,
  likesCount = 24,
  commentsCount = 8,
  isLiked = false
): Post {
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
    likesCount,
    commentsCount,
    isLiked,
  };
}

/** Map CommentResponse (BE DTO) → Comment (UI Model) */
function mapComment(
  dto: CommentResponse,
  authorName: string,
  likesCount = 3,
  isLiked = false
): Comment {
  return {
    id: dto.id,
    postId: dto.post_id,
    authorId: dto.author_id,
    authorName,
    parentCommentId: dto.parent_comment_id,
    content: dto.content,
    createdAt: dto.created_at,
    timeAgo: timeAgo(dto.created_at),
    likesCount,
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

// ─── Mock Data Store ──────────────────────────────────────────────────────────

const MOCK_CATEGORIES: ForumCategoryResponse[] = [
  { id: 'cat-1', name: 'Toán học', description: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-2', name: 'Lập trình OOP', description: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-3', name: 'Vật lý đại cương', description: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-4', name: 'Cơ sở dữ liệu', description: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-5', name: 'Hóa học đại cương', description: null, created_at: '2026-01-01T00:00:00Z' },
];

let MOCK_POSTS: (ForumPostResponse & { likesCount: number; commentsCount: number })[] = [
  {
    id: 'post-1', author_id: 'user-1', category_id: 'cat-1',
    title: 'Giúp mình hiểu về tích phân từng phần?',
    content: 'Mình đang mắc ở bài 4 trong phần bài tập. Có ai có thể giải thích chi tiết cách chọn "u" và "dv" sao cho hiệu quả không? Quy tắc "Nhất lốc, nhì đa..." thỉnh thoảng làm mình bối rối khi có logarit tự nhiên.',
    image_path: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
    deleted_at: null,
    likesCount: 24,
    commentsCount: 8,
  },
  {
    id: 'post-2', author_id: 'user-2', category_id: 'cat-2',
    title: 'Sự khác biệt giữa Abstract Class và Interface trong Java?',
    content: 'Mọi người cho mình hỏi trong thực tế dự án thì khi nào nên dùng Abstract Class và khi nào thì nên dùng Interface? Mình đọc lý thuyết thì hiểu nhưng áp dụng thực tế thấy khá hoang mang.',
    image_path: null,
    created_at: new Date(Date.now() - 18000000).toISOString(),
    updated_at: new Date(Date.now() - 18000000).toISOString(),
    deleted_at: null,
    likesCount: 45,
    commentsCount: 12,
  },
  {
    id: 'post-3', author_id: 'user-3', category_id: 'cat-3',
    title: 'Giải thích hiện tượng giao thoa ánh sáng đơn sắc?',
    content: 'Tại sao khi dùng ánh sáng trắng thì vân trung tâm lại là vân màu trắng, còn các vân bên cạnh lại có màu như cầu vồng?',
    image_path: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    deleted_at: null,
    likesCount: 18,
    commentsCount: 5,
  },
];

const MOCK_AUTHORS: Record<string, string> = {
  'user-1': 'Hải Minh',
  'user-2': 'Tuấn Tú',
  'user-3': 'Ngọc Anh',
};

let MOCK_COMMENTS: (CommentResponse & { likesCount: number })[] = [
  {
    id: 'cmt-1', post_id: 'post-1', author_id: 'user-2', parent_comment_id: null,
    content: 'Bạn cứ nhớ thứ tự ưu tiên chọn u: Logarit → Đa thức → Lượng giác → Mũ.',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    likesCount: 5,
  },
  {
    id: 'cmt-2', post_id: 'post-1', author_id: 'user-1', parent_comment_id: 'cmt-1',
    content: 'Cảm ơn bạn! Ví dụ có x*ln(x) thì chọn u = ln(x) đúng không?',
    created_at: new Date(Date.now() - 1800000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
    likesCount: 2,
  },
];

const likedPosts = new Set<string>();
const likedComments = new Set<string>();

// ─── API Functions ─────────────────────────────────────────────────────────────

export const forumApi = {
  /** Đăng ký tác giả vào bộ nhớ tạm */
  registerAuthor: (authorId: string, name: string) => {
    if (authorId && name) {
      MOCK_AUTHORS[authorId] = name;
    }
  },

  getCategories: async (): Promise<ForumCategoryResponse[]> => {
    return Promise.resolve([...MOCK_CATEGORIES]);
  },

  getPosts: async (categoryId: string | null, skip = 0, limit = 5): Promise<Post[]> => {
    let filtered = MOCK_POSTS.filter((p) => !p.deleted_at);
    if (categoryId) {
      filtered = filtered.filter((p) => p.category_id === categoryId);
    }
    const page = filtered.slice(skip, skip + limit);
    return Promise.resolve(
      page.map((p) => {
        const cat = MOCK_CATEGORIES.find((c) => c.id === p.category_id);
        return mapPost(p, cat?.name ?? '', p.likesCount, p.commentsCount, likedPosts.has(p.id));
      })
    );
  },

  createPost: async (payload: ForumPostCreate, authorName?: string): Promise<Post> => {
    if (authorName) {
      MOCK_AUTHORS[payload.author_id] = authorName;
    }
    const newDto = {
      id: `post-${Date.now()}`,
      author_id: payload.author_id,
      category_id: payload.category_id,
      title: payload.title,
      content: payload.content,
      image_path: payload.image_path ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      likesCount: 0,
      commentsCount: 0,
    };
    MOCK_POSTS = [newDto, ...MOCK_POSTS];
    const cat = MOCK_CATEGORIES.find((c) => c.id === payload.category_id);
    return Promise.resolve(mapPost(newDto, cat?.name ?? '', 0, 0));
  },

  likePost: async (postId: string): Promise<void> => {
    likedPosts.add(postId);
    const post = MOCK_POSTS.find((p) => p.id === postId);
    if (post) post.likesCount += 1;
    return Promise.resolve();
  },

  unlikePost: async (postId: string): Promise<void> => {
    likedPosts.delete(postId);
    const post = MOCK_POSTS.find((p) => p.id === postId);
    if (post && post.likesCount > 0) post.likesCount -= 1;
    return Promise.resolve();
  },

  getComments: async (postId: string): Promise<Comment[]> => {
    const flat = MOCK_COMMENTS
      .filter((c) => c.post_id === postId)
      .map((c) =>
        mapComment(
          c,
          MOCK_AUTHORS[c.author_id] ?? 'Ẩn danh', // Giữ nguyên fallback 'Ẩn danh'
          c.likesCount,
          likedComments.has(c.id)
        )
      );
    return Promise.resolve(nestComments(flat));
  },

  createComment: async (payload: CommentCreate, authorName?: string): Promise<Comment> => {
    if (authorName) {
      MOCK_AUTHORS[payload.author_id] = authorName;
    }
    const newDto = {
      id: `cmt-${Date.now()}`,
      post_id: payload.post_id,
      author_id: payload.author_id,
      parent_comment_id: payload.parent_comment_id ?? null,
      content: payload.content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      likesCount: 0,
    };
    MOCK_COMMENTS = [newDto, ...MOCK_COMMENTS];

    // Tăng đếm comment số lượng bài viết trong bộ nhớ API Store
    const post = MOCK_POSTS.find((p) => p.id === payload.post_id);
    if (post) post.commentsCount += 1;

    const resolvedAuthorName = MOCK_AUTHORS[payload.author_id] ?? authorName ?? 'Ẩn danh';
    return Promise.resolve(mapComment(newDto, resolvedAuthorName, 0));
  },

  likeComment: async (commentId: string): Promise<void> => {
    likedComments.add(commentId);
    const comment = MOCK_COMMENTS.find((c) => c.id === commentId);
    if (comment) comment.likesCount += 1;
    return Promise.resolve();
  },

  unlikeComment: async (commentId: string): Promise<void> => {
    likedComments.delete(commentId);
    const comment = MOCK_COMMENTS.find((c) => c.id === commentId);
    if (comment && comment.likesCount > 0) comment.likesCount -= 1;
    return Promise.resolve();
  },
};
