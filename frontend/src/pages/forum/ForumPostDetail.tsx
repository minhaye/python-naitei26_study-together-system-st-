import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PostCard } from './components/PostCard';
import { ForumRightSidebar } from './components/ForumRightSidebar';
import { forumApi } from './lib/forum.api';
import type { Post, ForumPostUpdate } from './types/forum.types';
import { applyReactionOptimistic } from './constants/reactions';

import { useAuth } from '../../hooks/useAuth';
import { useForumState } from './context/ForumStateContext';

export const ForumPostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoggedIn, currentUser, requireAuth } = useAuth();
  const { updatePostInState, deletePostInState } = useForumState();

  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    // Chỉ truyền userId thực (UUID hợp lệ) khi đã đăng nhập, không gửi 'user-current' lên backend
    const userId = isLoggedIn ? currentUser?.id : undefined;
    forumApi
      .getPosts(null, 0, 9999, null, userId)
      .then((all) => {
        const found = all.find((p) => p.id === id);
        if (found) setPost(found);
      })
      .finally(() => setIsLoading(false));
  }, [id, isLoggedIn, currentUser?.id]);

  const handleReact = (postId: string, emoji: string) => {
    requireAuth(async () => {
      setPost((prev) => (prev ? { ...prev, reactions: applyReactionOptimistic(prev.reactions, emoji) } : null));
      await forumApi.setPostReaction(postId, emoji, currentUser?.id);
    });
  };

  const handleRemoveReaction = (postId: string) => {
    requireAuth(async () => {
      setPost((prev) => (prev ? { ...prev, reactions: applyReactionOptimistic(prev.reactions, null) } : null));
      await forumApi.removePostReaction(postId, currentUser?.id);
    });
  };

  const handleUpdatePost = async (
    postId: string,
    payload: ForumPostUpdate,
    categoryName?: string
  ) => {
    if (!post) return;
    // Optimistic local update
    const optimisticPost: Post = {
      ...post,
      title: payload.title ?? post.title,
      content: payload.content ?? post.content,
      categoryId: payload.category_id ?? post.categoryId,
      categoryName: categoryName ?? post.categoryName,
      imagePath: payload.image_path !== undefined ? payload.image_path : post.imagePath,
      updatedAt: new Date().toISOString(),
      isEdited: true,
      status: 'updating',
    };
    setPost(optimisticPost);
    updatePostInState(optimisticPost);

    try {
      const updated = await forumApi.updatePost(postId, payload, categoryName);
      setPost(updated);
      updatePostInState(updated);
    } catch (error) {
      console.error('Failed to update post detail', error);
      setPost((prev) => (prev ? { ...prev, status: 'error' } : null));
    }
  };

  const handleDeletePost = async (postId: string) => {
    deletePostInState(postId);
    navigate('/');
    try {
      await forumApi.deletePost(postId);
    } catch (error) {
      console.error('Failed to delete post detail', error);
    }
  };

  return (
    <div style={{ width: '100%', flex: 1, background: '#F8FAFC', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          padding: '32px 48px',
          display: 'flex',
          gap: '32px',
        }}
      >
        {/* Main Feed Content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          {/* Back Button */}
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: '#1D4ED8',
              fontWeight: '600',
              fontSize: 14,
              textDecoration: 'none',
              width: 'fit-content',
            }}
          >
            <ArrowLeft size={18} />
            Quay lại diễn đàn
          </Link>

          {/* Loading */}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: '#64748B' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {/* Post Card — Tự động mở sẵn bình luận */}
          {!isLoading && post && (
            <PostCard
              post={post}
              onReact={handleReact}
              onRemoveReaction={handleRemoveReaction}
              onUpdatePost={handleUpdatePost}
              onDeletePost={handleDeletePost}
              defaultShowComments={true}
              isDetailPage={true}
            />
          )}

          {/* Not Found */}
          {!isLoading && !post && (
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: 40,
                textAlign: 'center',
                color: '#64748B',
                border: '1px solid #E2E8F0',
              }}
            >
              Không tìm thấy bài viết này hoặc bài viết đã bị xóa.
            </div>
          )}
        </main>

        {/* Right Sidebar */}
        <ForumRightSidebar />
      </div>
    </div>
  );
};
