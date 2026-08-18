/**
 * ForumPage — Trang Diễn đàn chính.
 *
 * Tích hợp ForumStateContext giữ nguyên trạng thái danh mục, bộ lọc, từ khóa, danh sách bài viết
 * và khôi phục vị trí cuộn cuộn màn hình (scrollTop) khi người dùng bấm Quay lại (Back) từ trang Chi tiết.
 */

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ForumSidebar } from './components/ForumSidebar';
import { ForumFilterBar } from './components/ForumFilterBar';
import { PostCard } from './components/PostCard';
import { ForumRightSidebar } from './components/ForumRightSidebar';
import { CreatePostModal } from './components/CreatePostModal';
import { useForumPosts } from './hooks/useForumPosts';
import { usePostActions } from './hooks/usePostActions';
import { useAuth } from '../../hooks/useAuth';
import { forumApi } from './lib/forum.api';
import type { ForumCategoryResponse } from './types/forum.types';
import { PostSkeleton } from '../../components/ui/Skeleton';
import { useForumState } from './context/ForumStateContext';

export const ForumPage: React.FC = () => {
  const { isLoggedIn, currentUser } = useAuth();
  const forumState = useForumState();

  const {
    selectedCategoryId,
    setSelectedCategoryId,
    selectedCategoryName,
    setSelectedCategoryName,
    selectedTag,
    setSelectedTag,
    selectedFilter,
    setSelectedFilter,
    search,
    setSearch,
    scrollTop,
    setScrollTop,
  } = forumState;

  const [categories, setCategories] = useState<ForumCategoryResponse[]>([]);

  // Hooks với bộ lọc selectedFilter từ Context
  const { posts, setPosts, isLoading, hasMore, fetchNextPage } = useForumPosts(
    selectedCategoryId,
    search,
    selectedFilter,
    currentUser.id
  );
  const { showCreateModal, setShowCreateModal, handleCreatePost, handleToggleLike } = usePostActions(setPosts);

  // Ref cho cột giữa (Middle Feed) để lưu & khôi phục scrollTop
  const feedRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    forumApi.getCategories().then((cats) => {
      setCategories(cats);
    });
  }, []);

  // 🔄 KHÔI PHỤC VỊ TRÍ CUỘN MÀN HÌNH (scrollTop) khi Back về ForumPage
  useLayoutEffect(() => {
    if (feedRef.current && scrollTop > 0) {
      feedRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop, posts]);

  // IntersectionObserver trigger cho Infinite Scroll khi cuộn cột giữa
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

  // Cập nhật selectedCategoryName nếu tìm thấy từ danh sách categories
  const resolvedCategoryName =
    selectedCategoryName ?? categories.find((c) => c.id === selectedCategoryId)?.name ?? null;

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
            onSelectCategory={(id, name) => {
              setSelectedCategoryId(id);
              setSelectedCategoryName(name ?? null);
              setSelectedTag(null);
            }}
            onSearchChange={setSearch}
          />
        </div>

        {/* CỘT 2: Feed Giữa (Flex 1 - Scroll độc lập + Infinite Scroll) */}
        <main
          ref={feedRef}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
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
            categoryName={resolvedCategoryName}
            selectedTag={selectedTag}
            onClearTag={() => setSelectedTag(null)}
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
                justifyContent: 'space-between',
                padding: '14px 20px',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: 12,
                color: '#1E40AF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={20} color="#2563EB" />
                <span style={{ fontSize: 14, fontWeight: '500' }}>
                  Bạn đang ở chế độ khách. Đăng nhập để đăng bài viết, bình luận và thả tim!
                </span>
              </div>
              <Link
                to="/login"
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#2563EB',
                  textDecoration: 'none',
                }}
              >
                Đăng nhập ngay →
              </Link>
            </div>
          )}

          {/* Feed Bài Viết */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onToggleLike={handleToggleLike} />
            ))}

            {/* Skeleton Loading State khi nạp bài viết lần đầu */}
            {isLoading && posts.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <PostSkeleton />
                <PostSkeleton />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && posts.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 0',
                  color: '#64748B',
                  background: 'white',
                  borderRadius: 12,
                  border: '1px solid #E2E8F0',
                }}
              >
                Chưa có bài viết nào trong mục này. Hãy là người đầu tiên đặt câu hỏi!
              </div>
            )}

            {/* Loading spinner ở cuối Feed khi Infinite Scroll nạp trang tiếp */}
            {isLoading && posts.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                <Loader2 size={24} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            {/* Observer Element trigger khi cuộn tới đáy */}
            <div ref={observerRef} style={{ height: 20 }} />
          </div>
        </main>

        {/* CỘT 3: Right Sidebar (Thống kê & Bài viết yêu thích) */}
        <div style={{ width: 320, flexShrink: 0, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
          <ForumRightSidebar />
        </div>
      </div>

      {/* Modal Đăng bài viết mới */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePost}
      />
    </div>
  );
};
