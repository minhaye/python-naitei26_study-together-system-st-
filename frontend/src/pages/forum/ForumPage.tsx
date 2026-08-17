/**
 * ForumPage — Trang Diễn đàn chính.
 *
 * Tích hợp bộ lọc 4 tùy chọn (Mới nhất, Chưa trả lời, Câu hỏi hay, Câu hỏi của tôi).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ForumSidebar } from './components/ForumSidebar';
import { ForumFilterBar, type FilterOption } from './components/ForumFilterBar';
import { PostCard } from './components/PostCard';
import { ForumRightSidebar } from './components/ForumRightSidebar';
import { CreatePostModal } from './components/CreatePostModal';
import { useForumPosts } from './hooks/useForumPosts';
import { usePostActions } from './hooks/usePostActions';
import { useAuth } from '../../hooks/useAuth';
import { forumApi } from './lib/forum.api';
import type { ForumCategoryResponse } from './types/forum.types';
import { PostSkeleton } from '../../components/ui/Skeleton';

export const ForumPage: React.FC = () => {
  const { isLoggedIn, currentUser } = useAuth();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('latest');
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<ForumCategoryResponse[]>([]);

  // Hooks với bộ lọc selectedFilter
  const { posts, setPosts, isLoading, hasMore, fetchNextPage } = useForumPosts(
    selectedCategoryId,
    search,
    selectedFilter,
    currentUser.id
  );
  const { showCreateModal, setShowCreateModal, handleCreatePost, handleToggleLike } = usePostActions(setPosts);

  // Trigger div cho Infinite Scroll
  const observerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    forumApi.getCategories().then(setCategories);
  }, []);

  // IntersectionObserver trigger khi cuộn cột giữa
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
    <div
      style={{
        width: '100%',
        height: 'calc(100vh - 64px)',
        background: '#F8FAFC',
        display: 'flex',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          height: '100%',
          padding: '24px 48px',
          display: 'flex',
          gap: '32px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* CỘT 1: Left Sidebar (280px - Scroll độc lập) */}
        <div style={{ width: 295, flexShrink: 0, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
          <ForumSidebar
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            onSearchChange={setSearch}
          />
        </div>

        {/* CỘT 2: Feed Giữa (Flex 1 - Scroll độc lập + Infinite Scroll) */}
        <main
          style={{
            flex: 1,
            height: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            minWidth: 0,
            paddingRight: 8,
          }}
        >
          {/* Header Filter Bar */}
          <ForumFilterBar
            categoryName={selectedCategoryName}
            selectedFilter={selectedFilter}
            onSelectFilter={setSelectedFilter}
            onOpenCreateModal={() => setShowCreateModal(true)}
          />

          {/* Unauthenticated Alert Banner */}
          {!isLoggedIn && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 20px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 12,
              }}
            >
              <AlertCircle color="#DC2626" size={20} />
              <div style={{ color: '#991B1B', fontSize: 14 }}>
                Bạn chưa đăng nhập. Vui lòng{' '}
                <Link to="/login" style={{ textDecoration: 'underline', fontWeight: '600', color: '#991B1B' }}>
                  đăng nhập
                </Link>{' '}
                để hỏi bài và tham gia thảo luận.
              </div>
            </div>
          )}

          {/* Posts List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Lần đầu tải: Hiển thị 3 PostSkeleton */}
            {isLoading && posts.length === 0 && (
              <>
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </>
            )}

            {/* Khi không có dữ liệu */}
            {!isLoading && posts.length === 0 && (
              <div
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'white',
                  borderRadius: 16,
                  padding: 40,
                  textAlign: 'center',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                }}
              >
                Chưa có câu hỏi nào trong danh mục này. Hãy là người đầu tiên đặt câu hỏi!
              </div>
            )}

            {/* Dữ liệu thật */}
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onToggleLike={handleToggleLike} />
            ))}
          </div>

          {/* Infinite Scroll Trigger & Loader */}
          <div ref={observerRef} style={{ textAlign: 'center', padding: '24px 0', minHeight: 40 }}>
            {isLoading && posts.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, color: '#64748B' }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 14, fontWeight: '500' }}>Tải thêm câu hỏi...</span>
              </div>
            )}
            {!hasMore && posts.length > 0 && (
              <span style={{ fontSize: 14, color: '#64748B', fontWeight: '500' }}>Đã hiển thị tất cả câu hỏi</span>
            )}
          </div>
        </main>

        {/* CỘT 3: Right Sidebar (300px - Scroll độc lập) */}
        <div style={{ width: 319, flexShrink: 0, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
          <ForumRightSidebar />
        </div>
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
