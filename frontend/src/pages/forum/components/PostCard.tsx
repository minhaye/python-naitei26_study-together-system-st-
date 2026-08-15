/**
 * PostCard — Card hiển thị 1 bài viết trong danh sách Forum.
 *
 * Khôi phục 100% kích thước, padding, màu sắc, layout, số lượt thích và bình luận từ HomePage.tsx gốc.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import type { Post } from '../types/forum.types';
import { CommentSection } from './CommentSection';

interface PostCardProps {
  post: Post;
  onToggleLike: (postId: string) => void;
}

const AUTHOR_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];
function getAuthorColor(id: string) {
  let hash = 0;
  for (const ch of id) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}

export const PostCard: React.FC<PostCardProps> = ({ post, onToggleLike }) => {
  const [showComments, setShowComments] = useState(false);
  const authorInitial = post.authorId.slice(0, 2).toUpperCase();
  const authorColor = getAuthorColor(post.authorId);

  const tags = ['#Toán12', '#GiảiTích'];

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      {/* Post Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: authorColor,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {authorInitial}
          </div>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: '600', color: '#0F172A', fontSize: 15 }}>{post.authorId}</span>
              <span style={{ color: '#94A3B8', fontSize: 13 }}>• {post.timeAgo}</span>
            </div>
            <div style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>{post.categoryName}</div>
          </div>
        </div>
      </div>

      {/* Post Content */}
      <h2 style={{ fontSize: 20, fontWeight: '700', color: '#0F172A', margin: '0 0 12px 0' }}>
        <Link
          to={`/forum/post/${post.id}`}
          style={{ color: '#0F172A', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#1D4ED8')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#0F172A')}
        >
          {post.title}
        </Link>
      </h2>
      <p style={{ fontSize: 15, color: '#334155', lineHeight: '1.6', margin: '0 0 16px 0' }}>
        {post.content}
      </p>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{ padding: '4px 10px', background: '#F1F5F9', color: '#3B82F6', borderRadius: 6, fontSize: 13, fontWeight: '500' }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Like button with likes count */}
          <div
            onClick={() => onToggleLike(post.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: post.isLiked ? '#3B82F6' : '#64748B',
              cursor: 'pointer',
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#3B82F6')}
            onMouseOut={(e) => (e.currentTarget.style.color = post.isLiked ? '#3B82F6' : '#64748B')}
          >
            <ThumbsUp size={18} fill={post.isLiked ? '#3B82F6' : 'none'} />
            <span style={{ fontWeight: '500', fontSize: 14 }}>{post.likesCount}</span>
          </div>

          {/* Comment button with comments count */}
          <div
            onClick={() => setShowComments((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3B82F6', cursor: 'pointer' }}
          >
            <MessageSquare size={18} />
            <span style={{ fontWeight: '500', fontSize: 14 }}>{post.commentsCount} bình luận</span>
          </div>
        </div>

        {/* Share button */}
        <div
          onClick={() => {
            navigator.clipboard?.writeText(window.location.origin + `/forum/post/${post.id}`);
            alert('Đã copy link bài viết để chia sẻ!');
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#3B82F6')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#64748B')}
        >
          <Share2 size={18} />
          <span style={{ fontWeight: '500', fontSize: 14 }}>Chia sẻ</span>
        </div>
      </div>

      {/* Inline Comment Input / Thread */}
      <div style={{ marginTop: 20 }}>
        {showComments ? (
          <CommentSection postId={post.id} />
        ) : (
          <div
            onClick={() => setShowComments(true)}
            style={{ display: 'flex', gap: 12, cursor: 'pointer' }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ color: '#64748B', fontSize: 14, fontWeight: 'bold' }}>ME</span>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                placeholder="Viết bình luận..."
                readOnly
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 20,
                  outline: 'none',
                  fontSize: 14,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
