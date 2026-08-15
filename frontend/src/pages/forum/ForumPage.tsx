/**
 * ForumPage — Trang Diễn đàn chính.
 *
 * Lắp ghép các component:
 *   - Left: ForumSidebar (SearchInput + Danh mục)
 *   - Center: ForumFilterBar, Unauth Banner, Feed bài viết (PostCard + Infinite Scroll), CreatePostModal
 *   - Right: Right Sidebar (Chủ đề nổi bật + Widget trợ giúp)
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ForumSidebar } from './components/ForumSidebar';
import { ForumFilterBar } from './components/ForumFilterBar';
import { PostCard } from './components/PostCard';
import { CreatePostModal } from './components/CreatePostModal';
import { useForumPosts } from './hooks/useForumPosts';
import { usePostActions } from './hooks/usePostActions';
import { useAuth } from '../../hooks/useAuth';
import { FORUM_COLORS } from './constants/colors';
import { forumApi } from './lib/forum.api';
import type { ForumCategoryResponse } from './types/forum.types';

export const ForumPage: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<ForumCategoryResponse[]>([]);

  // Hooks
  const { posts, setPosts, isLoading, hasMore, fetchNextPage } = useForumPosts(selectedCategoryId, search);
  const { showCreateModal, setShowCreateModal, handleCreatePost, handleToggleLike } = usePostActions(setPosts);

  // Trigger div cho Infinite Scroll
  const observerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    forumApi.getCategories().then(setCategories);
  }, []);

  // IntersectionObserver trigger
  useEffect(() => {
    if (!observerRef.current || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, fetchNextPage]);

  const selectedCategoryName = categories.find((c) => c.id === selectedCategoryId)?.name ?? null;

  return (
    <div style={{ width: '100%', flex: 1, background: FORUM_COLORS.bg, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 1280,
          padding: '28px 32px',
          display: 'flex',
          gap: 28,
        }}
      >
        {/* Left Sidebar */}
        <ForumSidebar
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          onSearchChange={setSearch}
        />

        {/* Main Content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Header Filter Bar */}
          <ForumFilterBar
            categoryName={selectedCategoryName}
            onOpenCreateModal={() => setShowCreateModal(true)}
          />

          {/* Unauthenticated Alert Banner */}
          {!isLoggedIn && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                background: FORUM_COLORS.dangerBg,
                border: `1px solid ${FORUM_COLORS.dangerBorder}`,
                borderRadius: 12,
              }}
            >
              <AlertCircle color={FORUM_COLORS.danger} size={18} />
              <div style={{ color: '#991B1B', fontSize: 14 }}>
                Bạn chưa đăng nhập. Vui lòng{' '}
                <Link to="/login" style={{ textDecoration: 'underline', fontWeight: '600', color: '#991B1B' }}>
                  đăng nhập
                </Link>{' '}
                để hỏi bài, thích và tham gia bình luận.
              </div>
            </div>
          )}

          {/* Feed Post List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {posts.length === 0 && !isLoading && (
              <div
                style={{
                  background: FORUM_COLORS.card,
                  borderRadius: 14,
                  padding: 40,
                  textAlign: 'center',
                  color: FORUM_COLORS.textMuted,
                  border: `1px solid ${FORUM_COLORS.border}`,
                }}
              >
                Chưa có câu hỏi nào trong danh mục này. Hãy là người đầu tiên đặt câu hỏi!
              </div>
            )}

            {posts.map((post) => (
              <PostCard key={post.id} post={post} onToggleLike={handleToggleLike} />
            ))}
          </div>

          {/* Infinite Scroll Trigger & Loader */}
          <div ref={observerRef} style={{ textAlign: 'center', padding: '16px 0', minHeight: 40 }}>
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, color: FORUM_COLORS.textMuted }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 14 }}>Đang tải thêm...</span>
              </div>
            )}
            {!hasMore && posts.length > 0 && (
              <span style={{ fontSize: 13, color: FORUM_COLORS.textDisabled }}>Đã hiển thị tất cả câu hỏi</span>
            )}
          </div>
        </main>

        {/* Right Sidebar */}
        <aside
          style={{
            width: 280,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            alignSelf: 'flex-start',
            position: 'sticky',
            top: 24,
          }}
        >
          {/* Chủ đề nổi bật */}
          <div
            style={{
              background: FORUM_COLORS.card,
              borderRadius: 14,
              padding: 20,
              border: `1px solid ${FORUM_COLORS.border}`,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: '700', color: FORUM_COLORS.textPrimary, margin: '0 0 14px' }}>
              Chủ đề nổi bật
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['#Toán12', '#GiảiTích', '#Java', '#IELTS', '#VậtLýĐạiCương'].map((tag) => (
                <div
                  key={tag}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ color: FORUM_COLORS.primaryText, fontWeight: '500' }}>{tag}</span>
                  <span style={{ color: FORUM_COLORS.textDisabled, fontSize: 12 }}>+120 bài</span>
                </div>
              ))}
            </div>
          </div>

          {/* Widget Trợ giúp */}
          <div
            style={{
              background: `linear-gradient(135deg, ${FORUM_COLORS.primary} 0%, #1E40AF 100%)`,
              borderRadius: 14,
              padding: 20,
              color: 'white',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: '700', margin: '0 0 8px' }}>Bạn cần trợ giúp?</h3>
            <p style={{ fontSize: 13, color: FORUM_COLORS.primaryLighter, margin: '0 0 16px', lineHeight: 1.5 }}>
              Tham gia ngay vào các nhóm học để được hướng dẫn trực tiếp từ các bạn cùng tiến.
            </p>
            <Link
              to="/groups"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '9px 0',
                background: 'white',
                color: FORUM_COLORS.primary,
                borderRadius: 8,
                fontWeight: '600',
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Khám phá nhóm học
            </Link>
          </div>
        </aside>
      </div>

      {/* Modal Đặt câu hỏi */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePost}
      />
    </div>
  );
};
