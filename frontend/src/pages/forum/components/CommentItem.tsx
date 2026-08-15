/**
 * CommentItem — Hiển thị 1 bình luận (hoặc 1 reply trong cây comment).
 *
 * Hỗ trợ:
 *   - Avatar + tên + thời gian
 *   - Nút Like (toggle)
 *   - Nút Reply (mở ô nhập reply)
 *   - Đệ quy hiển thị replies (cây 2 cấp từ useComments)
 *
 * @prop isReply - nếu true thì thụt lề vào, bỏ border trái
 */

import React, { useState } from 'react';
import { ThumbsUp, CornerDownRight, Send } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { FORUM_COLORS } from '../constants/colors';
import type { Comment } from '../types/forum.types';

interface CommentItemProps {
  comment: Comment;
  onReply: (parentId: string, content: string) => void;
  onLike: (commentId: string, isLiked: boolean) => void;
  isReply?: boolean;
}

const AUTHOR_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];
function getAuthorColor(id: string) {
  let hash = 0;
  for (const ch of id) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onReply,
  onLike,
  isReply = false,
}) => {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [likeHovered, setLikeHovered] = useState(false);
  const [replyHovered, setReplyHovered] = useState(false);

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText('');
    setShowReplyBox(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        paddingLeft: isReply ? 40 : 0,
      }}
    >
      <Avatar
        initials={comment.authorName.slice(0, 2).toUpperCase()}
        color={getAuthorColor(comment.authorId)}
        size={isReply ? 'xs' : 'sm'}
      />

      <div style={{ flex: 1 }}>
        {/* Bubble */}
        <div
          style={{
            background: FORUM_COLORS.subtle,
            borderRadius: 12,
            padding: '10px 14px',
            display: 'inline-block',
            maxWidth: '100%',
          }}
        >
          <span style={{ fontWeight: '600', fontSize: 13, color: FORUM_COLORS.textPrimary }}>
            {comment.authorName}
          </span>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: FORUM_COLORS.textSecondary, lineHeight: 1.55 }}>
            {comment.content}
          </p>
        </div>

        {/* Meta + Actions */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 6, paddingLeft: 4 }}>
          <span style={{ fontSize: 11, color: FORUM_COLORS.textDisabled }}>{comment.timeAgo}</span>

          {/* Like */}
          <button
            onMouseEnter={() => setLikeHovered(true)}
            onMouseLeave={() => setLikeHovered(false)}
            onClick={() => onLike(comment.id, comment.isLiked)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: '600',
              color: comment.isLiked
                ? FORUM_COLORS.primary
                : likeHovered
                ? FORUM_COLORS.textPrimary
                : FORUM_COLORS.textMuted,
              transition: 'color 0.15s ease',
            }}
          >
            <ThumbsUp size={12} fill={comment.isLiked ? FORUM_COLORS.primary : 'none'} />
            Thích
          </button>

          {/* Reply — chỉ hiển thị ở comment cấp 1 */}
          {!isReply && (
            <button
              onMouseEnter={() => setReplyHovered(true)}
              onMouseLeave={() => setReplyHovered(false)}
              onClick={() => setShowReplyBox((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: '600',
                color: replyHovered ? FORUM_COLORS.textPrimary : FORUM_COLORS.textMuted,
                transition: 'color 0.15s ease',
              }}
            >
              <CornerDownRight size={12} />
              Trả lời
            </button>
          )}
        </div>

        {/* Reply input */}
        {showReplyBox && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <input
              autoFocus
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
              placeholder={`Trả lời ${comment.authorName}...`}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: FORUM_COLORS.subtle,
                border: `1px solid ${FORUM_COLORS.border}`,
                borderRadius: 20,
                outline: 'none',
                fontSize: 13,
                color: FORUM_COLORS.textPrimary,
              }}
            />
            <button
              onClick={handleSendReply}
              style={{
                background: FORUM_COLORS.primary,
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Send size={14} color="white" />
            </button>
          </div>
        )}

        {/* Replies đệ quy (cấp 2) */}
        {comment.replies.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onReply={onReply}
                onLike={onLike}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
