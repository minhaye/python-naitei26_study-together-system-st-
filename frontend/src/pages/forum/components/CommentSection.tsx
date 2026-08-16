/**
 * CommentSection — Phần bình luận của 1 bài viết.
 *
 * Tích hợp EditTextTool (TipTap Editor) giúp bình luận hỗ trợ ảnh, bảng, công thức toán và định dạng.
 */

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { EditTextTool } from '../../../components/ui/EditTextTool';
import { CommentItem } from './CommentItem';
import { useComments } from '../hooks/useComments';
import { FORUM_COLORS } from '../constants/colors';
import { CommentSkeleton } from '../../../components/ui/Skeleton';
import { useAuth } from '../../../hooks/useAuth';

interface CommentSectionProps {
  postId: string;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ postId }) => {
  const { currentUser } = useAuth();
  const { comments, isLoading, handleAddComment, handleReply, handleToggleCommentLike } =
    useComments(postId);
  const [newComment, setNewComment] = useState('');
  const [showRichEditor, setShowRichEditor] = useState(false);

  const handleSubmit = () => {
    const textOnly = newComment.replace(/<[^>]*>/g, '').trim();
    if (!textOnly) return;
    handleAddComment(newComment);
    setNewComment('');
    setShowRichEditor(false);
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
      {/* Input gửi comment mới với Avatar đồng bộ của currentUser */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Avatar name={currentUser.name} size="sm" style={{ marginTop: 4 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!showRichEditor ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
              <input
                value={newComment}
                onFocus={() => setShowRichEditor(true)}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Viết bình luận (bấm để mở công cụ soạn thảo, chèn toán, bảng, ảnh)..."
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <EditTextTool
                content={newComment}
                onChange={setNewComment}
                placeholder="Viết bình luận..."
                minHeight={80}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowRichEditor(false)}
                  style={{
                    padding: '6px 14px',
                    background: 'transparent',
                    border: '1px solid #CBD5E1',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: '500',
                    color: '#64748B',
                    cursor: 'pointer',
                  }}
                >
                  Thu gọn
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  style={{
                    padding: '6px 16px',
                    background: FORUM_COLORS.primary,
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: '600',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Gửi bình luận
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading CommentSkeletons */}
      {isLoading && comments.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 6 }}>
          <CommentSkeleton />
          <CommentSkeleton />
        </div>
      )}

      {/* Danh sách comment thật */}
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
