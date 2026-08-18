/**
 * usePostActions — Quản lý các hành động trên bài viết Forum.
 */

import { useState } from 'react';
import type { Post, ForumPostCreate } from '../types/forum.types';
import { forumApi } from '../lib/forum.api';
import { useAuth } from '../../../hooks/useAuth';


export function usePostActions(setPosts: React.Dispatch<React.SetStateAction<Post[]>>) {
  const { requireAuth, currentUser } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreatePost = (payload: Omit<ForumPostCreate, 'author_id'>, categoryName?: string) => {
    return requireAuth(async () => {
      try {
        const newPost = await forumApi.createPost(
          {
            ...payload,
            author_id: currentUser.id,
          },
          currentUser.name,
          categoryName
        );
        setPosts((prev) => [newPost, ...prev]);
        setShowCreateModal(false);
      } catch (error) {
        console.error('Failed to create post', error);
        alert('Có lỗi xảy ra khi đăng bài!');
        throw error;
      }
    });
  };

  const handleToggleLike = (postId: string) => {
    requireAuth(async () => {
      const current = await forumApi.getPosts(null, 0, 9999)
        .then((all) => all.find((p) => p.id === postId));
      const isCurrentlyLiked = current?.isLiked ?? false;

      if (isCurrentlyLiked) {
        await forumApi.unlikePost(postId, currentUser.id);
      } else {
        await forumApi.likePost(postId, currentUser.id);
      }

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isLiked: !isCurrentlyLiked,
                likesCount: isCurrentlyLiked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1,
              }
            : p
        )
      );

      window.dispatchEvent(new CustomEvent('post_liked_toggled'));
    });
  };

  return {
    showCreateModal,
    setShowCreateModal,
    handleCreatePost,
    handleToggleLike,
  };
}
