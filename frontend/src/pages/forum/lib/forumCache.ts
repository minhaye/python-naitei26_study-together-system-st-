import type { Post, ReactionSummary } from '../types/forum.types';

const CACHE_KEY = 'forum_landing_posts_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

interface CacheData {
  timestamp: number;
  posts: Post[];
}

export const forumCache = {
  /** 
   * Lấy dữ liệu từ LocalStorage nếu chưa hết hạn 
   */
  get: (): Post[] | null => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored) as CacheData;
      
      // Kiểm tra hạn sử dụng (TTL)
      if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      
      return parsed.posts;
    } catch (e) {
      console.error('Failed to read forum cache', e);
      return null;
    }
  },
  
  /** 
   * Lưu dữ liệu vào LocalStorage kèm timestamp 
   */
  set: (posts: Post[]) => {
    try {
      const data: CacheData = {
        timestamp: Date.now(),
        posts
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to write forum cache', e);
    }
  },

  /**
   * Cập nhật reaction của một bài viết trong LocalStorage cache
   */
  updatePostReaction: (postId: string, reactions: ReactionSummary[]) => {
    const posts = forumCache.get();
    if (!posts) return;
    const updated = posts.map((p) => (p.id === postId ? { ...p, reactions } : p));
    forumCache.set(updated);
  },

  /**
   * Cập nhật thông tin một bài viết trong LocalStorage cache
   */
  updatePost: (postId: string, updatedPost: Post) => {
    const posts = forumCache.get();
    if (!posts) return;
    const updated = posts.map((p) => (p.id === postId ? updatedPost : p));
    forumCache.set(updated);
  }
};

