/**
 * CommentSection — Phần bình luận của 1 bài viết.
 *
 * Dùng hook useComments để:
 *   - Tải danh sách comment (cây 2 cấp)
 *   - Gửi comment mới
 *   - Xử lý reply và like comment (delegate xuống CommentItem)
 */

import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { CommentItem } from './CommentItem';
import { useComments } from '../hooks/useComments';
import { FORUM_COLORS } from '../constants/colors';

interface CommentSectionProps {
  postId: string;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ postId }) => {
  const { comments, isLoading, handleAddComment, handleReply, handleToggleCommentLike } =
    useComments(postId);
  const [newComment, setNewComment] = useState('');

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    handleAddComment(newComment.trim());
    setNewComment('');
  };

  return (
    <div
      style={{
        borderTop: `1px solid ${FORUM_COLORS.border}`,
        paddingTop: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Input gửi comment mới */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Avatar initials="ME" size="sm" color={FORUM_COLORS.textDisabled} />
        <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Viết bình luận..."
            style={{
              flex: 1,
              padding: '9px 16px',
              background: FORUM_COLORS.subtle,
              border: `1px solid ${FORUM_COLORS.border}`,
              borderRadius: 20,
              outline: 'none',
              fontSize: 14,
              color: FORUM_COLORS.textPrimary,
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              background: FORUM_COLORS.primary,
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Send size={15} color="white" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <Loader2 size={20} color={FORUM_COLORS.textDisabled} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {/* Danh sách comment */}
      {!isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {comments.length === 0 && (
            <p style={{ fontSize: 13, color: FORUM_COLORS.textDisabled, textAlign: 'center', margin: 0 }}>
              Chưa có bình luận nào. Hãy là người đầu tiên!
            </p>
          )}
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onLike={handleToggleCommentLike}
            />
          ))}
        </div>
      )}
    </div>
  );
};
