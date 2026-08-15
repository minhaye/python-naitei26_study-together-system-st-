/**
 * usePostActions — Quản lý các hành động trên bài viết Forum.
 */

import { useState } from 'react';
import type { Post, ForumPostCreate } from '../types/forum.types';
import { forumApi } from '../lib/forum.api';
import { useAuth } from '../../../hooks/useAuth';

const CURRENT_USER_ID = 'user-current';

export function usePostActions(setPosts: React.Dispatch<React.SetStateAction<Post[]>>) {
  const { requireAuth } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreatePost = (payload: Omit<ForumPostCreate, 'author_id'>) => {
    requireAuth(async () => {
      const newPost = await forumApi.createPost({
        ...payload,
        author_id: CURRENT_USER_ID,
      });
      setPosts((prev) => [newPost, ...prev]);
      setShowCreateModal(false);
    });
  };

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
    });
  };

  return {
    showCreateModal,
    setShowCreateModal,
    handleCreatePost,
    handleToggleLike,
  };
}
