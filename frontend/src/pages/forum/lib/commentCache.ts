import type { Comment } from '../types/forum.types';
import { applyReactionOptimistic } from '../constants/reactions';

const MAX_CACHED_POSTS = 10;

class CommentCacheManager {
  private cache = new Map<string, Comment[]>();

  /** Lấy comment của 1 post từ bộ nhớ RAM */
  get(postId: string): Comment[] | null {
    if (!this.cache.has(postId)) return null;
    // Cập nhật lại vị trí truy cập (LRU)
    const comments = this.cache.get(postId)!;
    this.cache.delete(postId);
    this.cache.set(postId, comments);
    return comments;
  }

  /** Lưu comment của 1 post vào bộ nhớ RAM, nếu vượt quá MAX_CACHED_POSTS thì xóa bài cũ nhất */
  set(postId: string, comments: Comment[]): void {
    if (this.cache.has(postId)) {
      this.cache.delete(postId);
    } else if (this.cache.size >= MAX_CACHED_POSTS) {
      // Xóa phần tử đầu tiên (bài viết cũ nhất được mở trong RAM)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(postId, comments);
  }

  /** Thêm comment mới vào cache */
  addComment(postId: string, comment: Comment): void {
    const existing = this.get(postId);
    if (existing) {
      this.set(postId, [comment, ...existing]);
    }
  }

  /** Cập nhật nội dung 1 comment trong cache (đệ quy) */
  updateComment(postId: string, commentId: string, newContent: string): void {
    const existing = this.get(postId);
    if (!existing) return;

    const updateTree = (list: Comment[]): Comment[] =>
      list.map((c) => {
        if (c.id === commentId) {
          return { ...c, content: newContent, updatedAt: new Date().toISOString(), isEdited: true };
        }
        if (c.replies && c.replies.length > 0) {
          return { ...c, replies: updateTree(c.replies) };
        }
        return c;
      });

    this.set(postId, updateTree(existing));
  }

  /** Xóa 1 comment khỏi cache (đệ quy) */
  deleteComment(postId: string, commentId: string): void {
    const existing = this.get(postId);
    if (!existing) return;

    const deleteTree = (list: Comment[]): Comment[] =>
      list
        .filter((c) => c.id !== commentId)
        .map((c) => {
          if (c.replies && c.replies.length > 0) {
            return { ...c, replies: deleteTree(c.replies) };
          }
          return c;
        });

    this.set(postId, deleteTree(existing));
  }

  /** Cập nhật reaction của comment trong cache */
  reactComment(postId: string, commentId: string, emoji: string | null): void {
    const existing = this.get(postId);
    if (!existing) return;

    const reactTree = (list: Comment[]): Comment[] =>
      list.map((c) => {
        if (c.id === commentId) {
          return { ...c, reactions: applyReactionOptimistic(c.reactions, emoji) };
        }
        if (c.replies && c.replies.length > 0) {
          return { ...c, replies: reactTree(c.replies) };
        }
        return c;
      });

    this.set(postId, reactTree(existing));
  }

  /** Clear sạch cache khi cần */
  clear(): void {
    this.cache.clear();
  }
}

export const commentCache = new CommentCacheManager();
