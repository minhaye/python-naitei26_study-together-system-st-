/**
 * CommentSection — Phần bình luận của 1 bài viết.
 *
 * Tích hợp:
 *   - Nút "Xem thêm X bình luận" trên Diễn đàn Feed chính (Mặc định hiện 3 bình luận)
 *   - Mở tràn 100% tất cả bình luận trên Trang Chi Tiết (isDetailPage = true)
 *   - EditTextTool (TipTap Editor) hỗ trợ ảnh, công thức toán và định dạng.
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
  isDetailPage?: boolean;
  initialLimit?: number;
  onCommentAdded?: () => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  isDetailPage = false,
  initialLimit = 3,
  onCommentAdded,
}) => {
  const { currentUser, isLoggedIn, requireAuth } = useAuth();
  const { comments, isLoading, handleAddComment, handleReply, handleUpdateComment, handleDeleteComment, handleToggleCommentLike } =
    useComments(postId, onCommentAdded);
  const [newComment, setNewComment] = useState('');
  const [showRichEditor, setShowRichEditor] = useState(false);
  const [expandedAll, setExpandedAll] = useState(false);

  const handleSubmit = () => {
    requireAuth(() => {
      if (!newComment.trim()) return;
      const hasImage = /<img[^>]*>/i.test(newComment);
      const textOnly = newComment.replace(/<[^>]*>/g, '').trim();
      if (!textOnly && !hasImage) return;

      handleAddComment(newComment);
      setNewComment('');
      setShowRichEditor(false);
    });
  };

  const handleFocusInput = () => {
    requireAuth(() => setShowRichEditor(true));
  };

  const displayedComments = isDetailPage || expandedAll
    ? comments
    : comments.slice(0, initialLimit);

  const remainingCount = comments.length - initialLimit;

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
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Avatar name={currentUser.name} src={currentUser.avatarUrl} size="sm" style={{ marginTop: 4 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!showRichEditor ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
              <input
                value={newComment}
                readOnly={!isLoggedIn}
                onFocus={handleFocusInput}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={
                  isLoggedIn
                    ? 'Viết bình luận (bấm để mở công cụ soạn thảo, chèn toán, ảnh)...'
                    : 'Đăng nhập để bình luận...'
                }
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  background: FORUM_COLORS.subtle,
                  border: `1px solid ${FORUM_COLORS.border}`,
                  borderRadius: 20,
                  outline: 'none',
                  fontSize: 14,
                  color: FORUM_COLORS.textPrimary,
                  cursor: isLoggedIn ? 'text' : 'pointer',
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
                  opacity: isLoggedIn ? 1 : 0.5,
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
          {displayedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onEdit={handleUpdateComment}
              onDelete={handleDeleteComment}
              onLike={handleToggleCommentLike}
            />
          ))}

          {/* Nút "Xem thêm X bình luận" (Chỉ hiện ở Feed chính khi comment > initialLimit) */}
          {!isDetailPage && !expandedAll && remainingCount > 0 && (
            <button
              onClick={() => setExpandedAll(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 0',
                color: FORUM_COLORS.primary,
                fontWeight: '600',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
                width: 'fit-content',
              }}
            >
              Xem thêm {remainingCount} bình luận...
            </button>
          )}
        </div>
      )}
    </div>
  );
};
