/**
 * usePostActions — Quản lý các hành động trên bài viết Forum.
 *
 * Optimistic UI pattern (Facebook/Twitter style):
 * 1. Tạo ngay post tạm (status: 'sending') và hiển thị lên Feed trước khi API phản hồi.
 * 2. API gọi song song ở background.
 * 3. Thành công → thay id tạm bằng id thực từ server, xóa status.
 * 4. Thất bại → set status: 'error' trên post đó (KHÔNG tự ý xóa bài).
 */

import { useState } from 'react';
import type { Post, ForumPostCreate, ForumPostUpdate } from '../types/forum.types';
import { forumApi } from '../lib/forum.api';
import { useAuth } from '../../../hooks/useAuth';
import { applyReactionOptimistic } from '../constants/reactions';


export function usePostActions(setPosts: React.Dispatch<React.SetStateAction<Post[]>>) {
  const { requireAuth, currentUser } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreatePost = (payload: Omit<ForumPostCreate, 'author_id'>, categoryName?: string) => {
    return requireAuth(async () => {
      // Tạo id tạm để theo dõi bài viết optimistic
      const optimisticId = `optimistic-${crypto.randomUUID()}`;

      // Tạo đối tượng Post tạm từ dữ liệu form (không cần đợi BE)
      const optimisticPost: Post = {
        id: optimisticId,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatarUrl: currentUser.avatarUrl,
        categoryId: payload.category_id,
        categoryName: categoryName ?? 'Chung',
        title: payload.title,
        content: payload.content,
        imagePath: payload.image_path ?? null,
        createdAt: new Date().toISOString(),
        timeAgo: 'Vừa xong',
        reactions: [],
        commentsCount: 0,
        tags: [],
        status: 'sending',
      };

      // Hiển thị ngay lên đầu Feed
      setPosts((prev) => [optimisticPost, ...prev]);
      setShowCreateModal(false);

      try {
        // Gửi API ở background
        const newPost = await forumApi.createPost(
          { ...payload, author_id: currentUser.id },
          currentUser.name,
          categoryName,
          currentUser.avatarUrl
        );

        // Thay thế post tạm bằng post thực từ server
        setPosts((prev) =>
          prev.map((p) => (p.id === optimisticId ? { ...newPost, status: undefined } : p))
        );

        // Báo hiệu để Trending Tags sidebar refresh
        window.dispatchEvent(new CustomEvent('post_created'));
      } catch (error) {
        console.error('Failed to create post', error);
        // Không xóa bài — chuyển sang trạng thái lỗi, để người dùng tự quyết định
        setPosts((prev) =>
          prev.map((p) => (p.id === optimisticId ? { ...p, status: 'error' } : p))
        );
      }
    });
  };

  const handleUpdatePost = (
    postId: string,
    payload: ForumPostUpdate,
    categoryName?: string
  ) => {
    return requireAuth(async () => {
      // 1. Optimistic UI: Cập nhật thông tin bài viết tại chỗ và đặt status 'updating'
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            title: payload.title ?? p.title,
            content: payload.content ?? p.content,
            categoryId: payload.category_id ?? p.categoryId,
            categoryName: categoryName ?? p.categoryName,
            imagePath: payload.image_path !== undefined ? payload.image_path : p.imagePath,
            updatedAt: new Date().toISOString(),
            isEdited: true,
            status: 'updating',
          };
        })
      );

      try {
        // 2. Gửi API ở background
        const updatedPost = await forumApi.updatePost(postId, payload, categoryName);
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...updatedPost, status: undefined } : p))
        );
        window.dispatchEvent(new CustomEvent('post_created'));
      } catch (error) {
        console.error('Failed to update post', error);
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, status: 'error' } : p))
        );
        throw error;
      }
    });
  };

  const handleDeletePost = (postId: string) => {
    return requireAuth(async () => {
      // 1. Optimistic UI: Xóa khỏi danh sách ngay lập tức
      setPosts((prev) => prev.filter((p) => p.id !== postId));

      try {
        // 2. Gửi API delete ở background
        await forumApi.deletePost(postId);
        window.dispatchEvent(new CustomEvent('post_created'));
      } catch (error) {
        console.error('Failed to delete post', error);
      }
    });
  };

  const handleRetryPost = (failedPost: Post, payload: Omit<ForumPostCreate, 'author_id'>) => {
    requireAuth(async () => {
      // Chuyển lại trạng thái 'sending'
      setPosts((prev) =>
        prev.map((p) => (p.id === failedPost.id ? { ...p, status: 'sending' } : p))
      );
      try {
        const newPost = await forumApi.createPost(
          { ...payload, author_id: currentUser.id },
          currentUser.name,
          failedPost.categoryName,
          currentUser.avatarUrl
        );
        setPosts((prev) =>
          prev.map((p) => (p.id === failedPost.id ? { ...newPost, status: undefined } : p))
        );
        window.dispatchEvent(new CustomEvent('post_created'));
      } catch {
        setPosts((prev) =>
          prev.map((p) => (p.id === failedPost.id ? { ...p, status: 'error' } : p))
        );
      }
    });
  };

  const handleDiscardPost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleReact = (postId: string, emoji: string) => {
    requireAuth(async () => {
      let previousReactions = null as Post['reactions'] | null;

      // 1. Cập nhật UI ngay lập tức (Optimistic UI - 0ms)
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          previousReactions = p.reactions;
          return { ...p, reactions: applyReactionOptimistic(p.reactions, emoji) };
        })
      );

      // 2. Gửi API lên backend ở background
      try {
        await forumApi.setPostReaction(postId, emoji, currentUser.id);
        window.dispatchEvent(new CustomEvent('post_liked_toggled'));
      } catch (error) {
        console.error('Failed to set reaction', error);
        // 3. Rollback UI nếu API gặp sự cố
        if (previousReactions) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, reactions: previousReactions! } : p)));
        }
      }
    });
  };

  const handleRemoveReaction = (postId: string) => {
    requireAuth(async () => {
      let previousReactions = null as Post['reactions'] | null;

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          previousReactions = p.reactions;
          return { ...p, reactions: applyReactionOptimistic(p.reactions, null) };
        })
      );

      try {
        await forumApi.removePostReaction(postId, currentUser.id);
        window.dispatchEvent(new CustomEvent('post_liked_toggled'));
      } catch (error) {
        console.error('Failed to remove reaction', error);
        if (previousReactions) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, reactions: previousReactions! } : p)));
        }
      }
    });
  };

  return {
    showCreateModal,
    setShowCreateModal,
    handleCreatePost,
    handleUpdatePost,
    handleDeletePost,
    handleRetryPost,
    handleDiscardPost,
    handleReact,
    handleRemoveReaction,
  };
}
