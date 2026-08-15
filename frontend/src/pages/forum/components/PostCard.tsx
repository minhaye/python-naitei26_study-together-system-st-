/**
 * PostCard — Card hiển thị 1 bài viết trong danh sách Forum.
 *
 * Hiển thị:
 *   - Avatar + tên tác giả + danh mục + thời gian
 *   - Tiêu đề + nội dung (tóm tắt)
 *   - Nút Like (toggle), Bình luận (mở section), Chia sẻ
 *   - CommentSection (mở khi click "Bình luận")
 */

import React, { useState } from 'react';
import { ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { FORUM_COLORS } from '../constants/colors';
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
  const [likeHovered, setLikeHovered] = useState(false);
  const [shareHovered, setShareHovered] = useState(false);
  const [commentHovered, setCommentHovered] = useState(false);

  const authorInitial = post.authorId.slice(0, 2).toUpperCase();

  const actionBtnStyle = (hovered: boolean, active = false): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    color: active ? FORUM_COLORS.primary : hovered ? FORUM_COLORS.primaryText : FORUM_COLORS.textMuted,
    fontWeight: '500',
    fontSize: 14,
    transition: 'color 0.15s ease',
    background: 'none',
    border: 'none',
    padding: 0,
  });

  return (
    <article
      style={{
        background: FORUM_COLORS.card,
        borderRadius: 14,
        padding: 24,
        border: `1px solid ${FORUM_COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Avatar
          initials={authorInitial}
          color={getAuthorColor(post.authorId)}
          size="md"
        />
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: '600', color: FORUM_COLORS.textPrimary, fontSize: 15 }}>
              {post.authorId}
            </span>
            <span style={{ color: FORUM_COLORS.textDisabled, fontSize: 13 }}>
              · {post.timeAgo}
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: FORUM_COLORS.primaryText,
              background: FORUM_COLORS.primaryLighter,
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            {post.categoryName}
          </span>
        </div>
      </div>

      {/* Content */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: '700', color: FORUM_COLORS.textPrimary, margin: '0 0 8px' }}>
          {post.title}
        </h2>
        <p
          style={{
            fontSize: 14,
            color: FORUM_COLORS.textSecondary,
            lineHeight: 1.65,
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {post.content}
        </p>
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          paddingTop: 12,
          borderTop: `1px solid ${FORUM_COLORS.border}`,
        }}
      >
        {/* Like */}
        <button
          style={actionBtnStyle(likeHovered, post.isLiked)}
          onMouseEnter={() => setLikeHovered(true)}
          onMouseLeave={() => setLikeHovered(false)}
          onClick={() => onToggleLike(post.id)}
        >
          <ThumbsUp size={16} fill={post.isLiked ? FORUM_COLORS.primary : 'none'} />
          {post.isLiked ? 'Đã thích' : 'Thích'}
        </button>

        {/* Comment */}
        <button
          style={actionBtnStyle(commentHovered)}
          onMouseEnter={() => setCommentHovered(true)}
          onMouseLeave={() => setCommentHovered(false)}
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageSquare size={16} />
          Bình luận
        </button>

        {/* Share */}
        <button
          style={actionBtnStyle(shareHovered)}
          onMouseEnter={() => setShareHovered(true)}
          onMouseLeave={() => setShareHovered(false)}
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
          }}
        >
          <Share2 size={16} />
          Chia sẻ
        </button>
      </div>

      {/* Comment Section */}
      {showComments && <CommentSection postId={post.id} />}
    </article>
  );
};
