/**
 * ForumRightSidebar — Sidebar bên phải trang Forum.
 *
 * Tích hợp <Avatar name={...} size="sm" /> đồng bộ.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { LikedPostSkeleton, TrendingTopicSkeleton } from '../../../components/ui/Skeleton';
import { Avatar } from '../../../components/ui/Avatar';
import { forumApi } from '../lib/forum.api';
import type { Post, TagResponse } from '../types/forum.types';
import { LikedPostsModal } from './LikedPostsModal';
import { useForumState } from '../context/ForumStateContext';

export const ForumRightSidebar: React.FC = () => {
  const { isLoggedIn, currentUser } = useAuth();
  const { setSelectedTag } = useForumState();
  const [isLoadingLiked, setIsLoadingLiked] = useState(false);
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);
  const [trendingTags, setTrendingTags] = useState<TagResponse[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setIsLoadingTrending(true);
    forumApi.getTrendingTags(10)
      .then((tags) => setTrendingTags(tags))
      .catch(console.error)
      .finally(() => setIsLoadingTrending(false));
  }, []);

  useEffect(() => {
    const fetchLikedPosts = () => {
      if (isLoggedIn && currentUser?.id) {
        setIsLoadingLiked(true);
        forumApi.getLikedPosts(currentUser.id, 0, 50)
          .then(posts => {
            setLikedPosts(posts);
          })
          .catch(console.error)
          .finally(() => {
            setIsLoadingLiked(false);
          });
      }
    };

    fetchLikedPosts();
    
    window.addEventListener('post_liked_toggled', fetchLikedPosts);
    return () => {
      window.removeEventListener('post_liked_toggled', fetchLikedPosts);
    };
  }, [isLoggedIn, currentUser?.id]);

  const visiblePosts = likedPosts.slice(0, 2);

  return (
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* 1. Banner trợ giúp */}
      <div
        style={{
          background: 'linear-gradient(135deg, #00236F 0%, #1E40AF 100%)',
          borderRadius: 12,
          padding: 24,
          color: 'white',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: '700', margin: '0 0 12px 0' }}>Bạn cần trợ giúp?</h3>
        <p style={{ fontSize: 14, color: '#DBEAFE', margin: '0 0 20px 0', lineHeight: 1.5 }}>
          Tham gia ngay vào các nhóm học để được hướng dẫn trực tiếp từ các gia sư và bạn bè.
        </p>
        <Link
          to="/groups"
          style={{
            display: 'block',
            textAlign: 'center',
            width: '100%',
            padding: '10px 0',
            background: 'white',
            color: '#00236F',
            border: 'none',
            borderRadius: 8,
            fontWeight: '600',
            cursor: 'pointer',
            textDecoration: 'none',
            boxSizing: 'border-box',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'white')}
        >
          Khám phá nhóm học
        </Link>
      </div>

      {/* 2. Chủ đề nổi bật */}
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 20,
          outline: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', margin: '0 0 16px 0' }}>
          Chủ đề nổi bật
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isLoadingTrending && (
            <>
              <TrendingTopicSkeleton />
              <TrendingTopicSkeleton />
              <TrendingTopicSkeleton />
              <TrendingTopicSkeleton />
              <TrendingTopicSkeleton />
            </>
          )}

          {!isLoadingTrending && trendingTags.length === 0 && (
            <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '8px 0' }}>
              Chưa có chủ đề nào
            </div>
          )}

          {!isLoadingTrending &&
            trendingTags.map((tag) => (
              <div
                key={tag.id}
                onClick={() => setSelectedTag(tag.name)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                <span style={{ color: '#3B82F6', fontSize: 14, fontWeight: '500' }}>#{tag.name}</span>
                <span style={{ color: '#94A3B8', fontSize: 12 }}>+{tag.post_count} bài</span>
              </div>
            ))}
        </div>
      </div>

      {/* 3. BÀI VIẾT ĐÃ THÍCH (Chỉ hiển thị khi đã đăng nhập) */}
      {isLoggedIn && (
        <div
          style={{
            width: '100%',
            padding: 16,
            background: 'white',
            borderRadius: 8,
            outline: '1px #E2E8F0 solid',
            outlineOffset: '-1px',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 16,
            display: 'flex',
          }}
        >
          <div
            style={{
              alignSelf: 'stretch',
              height: 39,
              paddingBottom: 8,
              borderBottom: '1px #E2E8F0 solid',
              justifyContent: 'space-between',
              alignItems: 'center',
              display: 'flex',
            }}
          >
            <div
              style={{
                color: '#0F172A',
                fontSize: 14,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.35,
              }}
            >
              BÀI VIẾT ĐÃ THÍCH
            </div>
            <div
              onClick={() => setIsModalOpen(true)}
              style={{ color: '#1E3A8A', fontSize: 12, fontWeight: '500', cursor: 'pointer' }}
            >
              Xem thêm
            </div>
          </div>

          <div style={{ alignSelf: 'stretch', flexDirection: 'column', gap: 16, display: 'flex' }}>
            {isLoadingLiked && (
              <>
                <LikedPostSkeleton />
                <LikedPostSkeleton />
              </>
            )}

            {!isLoadingLiked && likedPosts.length === 0 && (
              <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', padding: '8px 0' }}>
                Chưa có bài viết nào
              </div>
            )}

            {!isLoadingLiked &&
              visiblePosts.map((post) => (
                <div key={post.id} style={{ alignSelf: 'stretch', gap: 12, display: 'flex' }}>
                  <Avatar name={post.authorName} size="sm" />
                  <div style={{ flex: 1, flexDirection: 'column', gap: 2, display: 'flex' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B' }}>
                      <span style={{ color: '#0F172A', fontWeight: '500' }}>{post.authorName}</span>
                      <span>•</span>
                      <span>{post.timeAgo}</span>
                    </div>
                    <Link
                      to={`/forum/post/${post.id}`}
                      style={{
                        color: '#0F172A',
                        fontSize: 14,
                        fontWeight: '500',
                        textDecoration: 'none',
                        transition: 'color 0.2s',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.color = '#1D4ED8')}
                      onMouseOut={(e) => (e.currentTarget.style.color = '#0F172A')}
                    >
                      {post.title}
                    </Link>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748B', paddingTop: 2 }}>
                      <span>{post.likesCount} thích</span>
                      <span>{post.commentsCount} bình luận</span>
                    </div>
                  </div>
                  {post.imagePath ? (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        background: '#F1F5F9',
                        borderRadius: 6,
                        border: '1px #E2E8F0 solid',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexShrink: 0,
                        overflow: 'hidden'
                      }}
                    >
                      <img src={post.imagePath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        background: '#F1F5F9',
                        borderRadius: 6,
                        border: '1px #E2E8F0 solid',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ width: 18, height: 18, background: '#CBD5E1', borderRadius: 2 }} />
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Modal hiển thị tất cả bài viết đã thích */}
      <LikedPostsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        posts={likedPosts}
      />
    </aside>
  );
};
