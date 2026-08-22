import { apiClient } from '../../../lib/apiClient';
import type {
  ForumCategoryResponse,
  ForumPostResponse,
  CommentResponse,
  Post,
  Comment,
  ReactionSummary,
  ReactionSummaryResponse,
  ForumPostCreate,
  ForumPostUpdate,
  CommentCreate,
  CommentUpdate,
  TagResponse,
} from '../types/forum.types';
import { commentCache } from './commentCache';

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

/** Map ReactionSummaryResponse (BE DTO, snake_case) → ReactionSummary (UI model, camelCase) */
function mapReactions(dtos: ReactionSummaryResponse[] | undefined): ReactionSummary[] {
  return (dtos ?? []).map((r) => ({ emoji: r.emoji, count: r.count, reactedByMe: r.reacted_by_me }));
}

/** Map ForumPostResponse (BE DTO) → Post (UI Model) */
function mapPost(dto: ForumPostResponse): Post {
  const isEdited = dto.updated_at && dto.created_at && new Date(dto.updated_at).getTime() - new Date(dto.created_at).getTime() > 5000;
  return {
    id: dto.id,
    authorId: dto.author_id,
    authorName: dto.author_name ?? 'Không rõ',
    authorAvatarUrl: dto.author_avatar_url ?? null,
    categoryId: dto.category_id,
    categoryName: dto.category_name ?? 'Không rõ',
    title: dto.title,
    content: dto.content,
    imagePath: dto.image_path,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    isEdited: Boolean(isEdited),
    timeAgo: timeAgo(dto.created_at),
    reactions: mapReactions(dto.reactions),
    commentsCount: dto.comments_count ?? 0,
    tags: dto.tags ?? [],
  };
}

/** Map CommentResponse (BE DTO) → Comment (UI Model) */
function mapComment(dto: CommentResponse): Comment {
  const isEdited = dto.updated_at && dto.created_at && new Date(dto.updated_at).getTime() - new Date(dto.created_at).getTime() > 5000;
  return {
    id: dto.id,
    postId: dto.post_id,
    authorId: dto.author_id,
    authorName: dto.author_name ?? 'Ẩn danh',
    authorAvatarUrl: dto.author_avatar_url ?? null,
    parentCommentId: dto.parent_comment_id,
    content: dto.content,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    isEdited: Boolean(isEdited),
    timeAgo: timeAgo(dto.created_at),
    reactions: mapReactions(dto.reactions),
    replies: [],
  };
}

/** Nhóm comment chuẩn Facebook Best Practice: 2 cấp DOM (Root Comment -> Flat Thread Replies) */
function nestComments(flat: Comment[]): Comment[] {
  const roots: Comment[] = [];
  const rootMap = new Map<string, Comment>();
  const parentToRootMap = new Map<string, string>();

  // 1. Nhặt tất cả comment gốc (parentCommentId === null)
  flat.forEach((c) => {
    if (!c.parentCommentId) {
      const rootItem = { ...c, replies: [] };
      rootMap.set(c.id, rootItem);
      parentToRootMap.set(c.id, c.id);
      roots.push(rootItem);
    }
  });

  // 2. Nhặt các reply cấp 1 (trực tiếp từ root)
  flat.forEach((c) => {
    if (c.parentCommentId && rootMap.has(c.parentCommentId)) {
      const rootId = c.parentCommentId;
      parentToRootMap.set(c.id, rootId);
      rootMap.get(rootId)!.replies.push({ ...c, replies: [] });
    }
  });

  // 3. Nhặt các reply cấp sâu hơn (reply của reply) -> Gom hết vào mảng replies của Root!
  flat.forEach((c) => {
    if (c.parentCommentId && !rootMap.has(c.parentCommentId)) {
      const rootId = parentToRootMap.get(c.parentCommentId);
      if (rootId && rootMap.has(rootId)) {
        parentToRootMap.set(c.id, rootId);
        rootMap.get(rootId)!.replies.push({ ...c, replies: [] });
      } else {
        roots.push({ ...c, replies: [] });
      }
    }
  });

  return roots;
}

// ─── API Functions ─────────────────────────────────────────────────────────────

export const forumApi = {
  /** Đăng ký tác giả vào bộ nhớ tạm (Không cần thiết với real API nhưng giữ để component không lỗi) */
  registerAuthor: (_authorId: string, _name: string) => {
    // Không dùng nữa vì Real API đã join với profiles
  },

  getCategories: async (): Promise<ForumCategoryResponse[]> => {
    return apiClient.get<ForumCategoryResponse[]>('/forum/categories');
  },

  getPosts: async (
    categoryId: string | null,
    skip = 0,
    limit = 5,
    tag?: string | null,
    userId?: string | null
  ): Promise<Post[]> => {
    let url = `/forum/posts?skip=${skip}&limit=${limit}`;
    if (categoryId) {
      url += `&category_id=${categoryId}`;
    }
    if (tag) {
      url += `&tag=${encodeURIComponent(tag)}`;
    }
    if (userId) {
      url += `&user_id=${userId}`;
    }
    const response = await apiClient.get<ForumPostResponse[]>(url);
    return response.map((p) => mapPost(p));
  },

  getTrendingTags: async (limit = 5): Promise<TagResponse[]> => {
    return apiClient.get<TagResponse[]>(`/forum/tags/trending?limit=${limit}`);
  },

  searchTags: async (query: string, limit = 10): Promise<TagResponse[]> => {
    return apiClient.get<TagResponse[]>(`/forum/tags/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  createPost: async (
    payload: ForumPostCreate,
    authorName?: string,
    categoryName?: string,
    authorAvatarUrl?: string | null
  ): Promise<Post> => {
    const response = await apiClient.post<ForumPostResponse>('/forum/posts', payload);
    return mapPost({
      ...response,
      category_name: categoryName ?? 'Chung',
      author_name: authorName ?? 'Bạn',
      author_avatar_url: authorAvatarUrl ?? response.author_avatar_url ?? null,
      reactions: [],
      comments_count: 0,
    });
  },

  updatePost: async (postId: string, payload: ForumPostUpdate, categoryName?: string): Promise<Post> => {
    const response = await apiClient.put<ForumPostResponse>(`/forum/posts/${postId}`, payload);
    return mapPost({
      ...response,
      category_name: categoryName ?? response.category_name,
    });
  },

  deletePost: async (postId: string): Promise<void> => {
    await apiClient.delete(`/forum/posts/${postId}`);
  },

  setPostReaction: async (postId: string, emoji: string, userId?: string): Promise<ReactionSummary[]> => {
    // Backend expects user_id as query param (Forum has no auth dependency on any endpoint)
    const response = await apiClient.put<ReactionSummaryResponse[]>(
      `/forum/posts/${postId}/reactions?user_id=${userId ?? '00000000-0000-0000-0000-000000000000'}`,
      { emoji }
    );
    return mapReactions(response);
  },

  removePostReaction: async (postId: string, userId?: string): Promise<ReactionSummary[]> => {
    const response = await apiClient.delete<ReactionSummaryResponse[]>(
      `/forum/posts/${postId}/reactions?user_id=${userId ?? '00000000-0000-0000-0000-000000000000'}`
    );
    return mapReactions(response);
  },

  getLikedPosts: async (userId: string, skip = 0, limit = 50): Promise<Post[]> => {
    const response = await apiClient.get<ForumPostResponse[]>(`/forum/users/${userId}/liked-posts?skip=${skip}&limit=${limit}`);
    return response.map((p) => mapPost(p));
  },

  getCachedComments: (postId: string): Comment[] | null => {
    return commentCache.get(postId);
  },

  getComments: async (postId: string, userId?: string | null): Promise<Comment[]> => {
    let url = `/forum/comments?post_id=${postId}`;
    if (userId) {
      url += `&user_id=${userId}`;
    }
    const response = await apiClient.get<CommentResponse[]>(url);
    const flat = response.map((c) => mapComment(c));
    const nested = nestComments(flat);
    commentCache.set(postId, nested);
    return nested;
  },

  createComment: async (payload: CommentCreate, authorName?: string, authorAvatarUrl?: string | null): Promise<Comment> => {
    const response = await apiClient.post<CommentResponse>('/forum/comments', payload);
    const mapped = mapComment({
      ...response,
      author_name: authorName ?? 'Bạn',
      author_avatar_url: authorAvatarUrl ?? response.author_avatar_url ?? null,
      reactions: [],
    });
    commentCache.addComment(payload.post_id, mapped);
    return mapped;
  },

  updateComment: async (commentId: string, payload: CommentUpdate, postId?: string): Promise<Comment> => {
    const response = await apiClient.put<CommentResponse>(`/forum/comments/${commentId}`, payload);
    const mapped = mapComment(response);
    if (postId) {
      commentCache.updateComment(postId, commentId, payload.content);
    }
    return mapped;
  },

  deleteComment: async (commentId: string, postId?: string): Promise<void> => {
    await apiClient.delete(`/forum/comments/${commentId}`);
    if (postId) {
      commentCache.deleteComment(postId, commentId);
    }
  },

  setCommentReaction: async (commentId: string, emoji: string, userId?: string, postId?: string): Promise<ReactionSummary[]> => {
    const response = await apiClient.put<ReactionSummaryResponse[]>(
      `/forum/comments/${commentId}/reactions?user_id=${userId ?? '00000000-0000-0000-0000-000000000000'}`,
      { emoji }
    );
    if (postId) {
      commentCache.reactComment(postId, commentId, emoji);
    }
    return mapReactions(response);
  },

  removeCommentReaction: async (commentId: string, userId?: string, postId?: string): Promise<ReactionSummary[]> => {
    const response = await apiClient.delete<ReactionSummaryResponse[]>(
      `/forum/comments/${commentId}/reactions?user_id=${userId ?? '00000000-0000-0000-0000-000000000000'}`
    );
    if (postId) {
      commentCache.reactComment(postId, commentId, null);
    }
    return mapReactions(response);
  },
};
