/**
 * usePostActions — Quản lý các hành động trên bài viết Forum.
 *
 * Chịu trách nhiệm:
 *   - Mở/đóng modal đặt câu hỏi
 *   - Tạo bài viết mới (yêu cầu đăng nhập)
 *   - Toggle thích/bỏ thích bài viết (yêu cầu đăng nhập)
 *
 * Dùng `useAuth` từ global hooks để bảo vệ các action cần đăng nhập.
 *
 * Cách dùng:
 * ```tsx
 * const { showCreateModal, setShowCreateModal, handleCreatePost, handleToggleLike } =
 *   usePostActions(setPosts);
 * ```
 */

import { useState } from 'react';
import type { Post, ForumPostCreate } from '../types/forum.types';
import { forumApi } from '../lib/forum.api';
import { useAuth } from '../../../hooks/useAuth';

// ID giả cho user hiện tại (thay bằng real user id khi tích hợp auth thật)
const CURRENT_USER_ID = 'user-current';

export function usePostActions(setPosts: React.Dispatch<React.SetStateAction<Post[]>>) {
  const { requireAuth } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  /**
   * Tạo bài viết mới.
   * Yêu cầu đăng nhập — nếu chưa sẽ redirect sang /login.
   */
  const handleCreatePost = (payload: Omit<ForumPostCreate, 'author_id'>) => {
    requireAuth(async () => {
      const newPost = await forumApi.createPost({
        ...payload,
        author_id: CURRENT_USER_ID,
      });
      // Thêm bài viết mới lên đầu danh sách
      setPosts((prev) => [newPost, ...prev]);
      setShowCreateModal(false);
    });
  };

  /**
   * Toggle thích / bỏ thích bài viết.
   * Yêu cầu đăng nhập — nếu chưa sẽ redirect sang /login.
   */
  const handleToggleLike = (postId: string) => {
    requireAuth(async () => {
      const current = await forumApi.getPosts(null, 0, 9999)
        .then((all) => all.find((p) => p.id === postId));
      const isCurrentlyLiked = current?.isLiked ?? false;

      if (isCurrentlyLiked) {
        await forumApi.unlikePost(postId);
      } else {
        await forumApi.likePost(postId);
      }

      // Cập nhật trạng thái isLiked ngay trong UI (optimistic update)
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, isLiked: !isCurrentlyLiked } : p))
      );
    });
  };

  return {
    showCreateModal,
    setShowCreateModal,
    handleCreatePost,
    handleToggleLike,
  };
}
