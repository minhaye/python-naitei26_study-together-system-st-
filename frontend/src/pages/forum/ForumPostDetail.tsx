/**
 * ForumPostDetail — Trang xem chi tiết 1 bài viết / câu hỏi.
 *
 * Route: /forum/post/:id
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PostCard } from './components/PostCard';
import { ForumRightSidebar } from './components/ForumRightSidebar';
import { forumApi } from './lib/forum.api';
import type { Post } from './types/forum.types';

export const ForumPostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    // Lấy bài viết theo ID từ API
    forumApi
      .getPosts(null, 0, 9999)
      .then((all) => {
        const found = all.find((p) => p.id === id);
        if (found) setPost(found);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleToggleLike = async (postId: string) => {
    if (!post) return;
    if (post.isLiked) {
      await forumApi.unlikePost(postId);
    } else {
      await forumApi.likePost(postId);
    }
    setPost((prev) => (prev ? { ...prev, isLiked: !prev.isLiked } : null));
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

          {/* Post Card */}
          {!isLoading && post && <PostCard post={post} onToggleLike={handleToggleLike} />}

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
