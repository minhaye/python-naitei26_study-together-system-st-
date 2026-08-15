/**
 * ForumRightSidebar — Sidebar bên phải trang Forum.
 *
 * Sắp xếp thứ tự Widget:
 *   1. Bạn cần trợ giúp? (banner gradient dẫn tới /groups)
 *   2. Chủ đề nổi bật (#Toán12, #GiảiTích, #Java...)
 *   3. BÀI VIẾT ĐÃ THÍCH (chỉ hiển thị khi đã đăng nhập, có toggle "Xem thêm / Thu gọn")
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';

export const ForumRightSidebar: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  const likedPosts = [
    {
      id: 'liked-1',
      authorInitial: 'HM',
      authorColor: '#2563EB',
      authorName: 'Hải Minh',
      timeAgo: '4 ngày trước',
      title: 'most useful barrier oat',
      likes: 85,
      comments: 1,
    },
    {
      id: 'liked-2',
      authorInitial: 'TT',
      authorColor: '#10B981',
      authorName: 'Tuấn Tú',
      timeAgo: '6 ngày trước',
      title: 'Sự khác biệt giữa Abstract Class',
      likes: 76,
      comments: 33,
    },
    {
      id: 'liked-3',
      authorInitial: 'NA',
      authorColor: '#F59E0B',
      authorName: 'Ngọc Anh',
      timeAgo: '1 tuần trước',
      title: 'Giải thích hiện tượng giao thoa ánh sáng',
      likes: 42,
      comments: 15,
    },
    {
      id: 'liked-4',
      authorInitial: 'KH',
      authorColor: '#8B5CF6',
      authorName: 'Khánh Hoàng',
      timeAgo: '2 tuần trước',
      title: 'Ôn thi Cấu trúc dữ liệu & Giải thuật',
      likes: 95,
      comments: 28,
    },
  ];

  const visiblePosts = isExpanded ? likedPosts : likedPosts.slice(0, 2);

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
          }}
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
          {['#Toán12', '#GiảiTích', '#Java', '#IELTS', '#VậtLýĐạiCương'].map((tag, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: '#3B82F6', fontSize: 14, fontWeight: '500' }}>{tag}</span>
              <span style={{ color: '#94A3B8', fontSize: 12 }}>+120 bài</span>
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
              onClick={() => setIsExpanded((prev) => !prev)}
              style={{ color: '#1E3A8A', fontSize: 12, fontWeight: '500', cursor: 'pointer' }}
            >
              {isExpanded ? 'Thu gọn' : 'Xem thêm'}
            </div>
          </div>

          <div style={{ alignSelf: 'stretch', flexDirection: 'column', gap: 16, display: 'flex' }}>
            {visiblePosts.map((post) => (
              <div key={post.id} style={{ alignSelf: 'stretch', gap: 12, display: 'flex' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    background: post.authorColor,
                    borderRadius: 9999,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: '600',
                    flexShrink: 0,
                  }}
                >
                  {post.authorInitial}
                </div>
                <div style={{ flex: 1, flexDirection: 'column', gap: 2, display: 'flex' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B' }}>
                    <span style={{ color: '#0F172A', fontWeight: '500' }}>{post.authorName}</span>
                    <span>•</span>
                    <span>{post.timeAgo}</span>
                  </div>
                  <div style={{ color: '#0F172A', fontSize: 14, fontWeight: '500' }}>{post.title}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748B', paddingTop: 2 }}>
                    <span>{post.likes} thích</span>
                    <span>{post.comments} bình luận</span>
                  </div>
                </div>
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
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
