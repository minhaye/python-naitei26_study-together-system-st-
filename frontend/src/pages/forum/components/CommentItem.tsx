import React, { useState, useRef, useEffect } from 'react';
import { ThumbsUp, CornerDownRight, Send, Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { RichContentView } from '../../../components/ui/RichContentView';
import { FORUM_COLORS } from '../constants/colors';
import type { Comment } from '../types/forum.types';
import { EditComment } from './EditComment';
import { useAuth } from '../../../hooks/useAuth';

interface CommentItemProps {
  comment: Comment;
  onReply: (parentId: string, content: string) => void;
  onEdit?: (commentId: string, newContent: string) => void;
  onDelete?: (commentId: string) => void;
  onLike: (commentId: string, isLiked: boolean) => void;
  isReply?: boolean;
  nestingLevel?: number; // 0 = Gốc (Root), 1 = Reply trong luồng
  isLastChild?: boolean; // Đánh dấu comment con cuối cùng trong nhánh
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onReply,
  onEdit,
  onDelete,
  onLike,
  isReply = false,
  nestingLevel = 0,
  isLastChild = false,
}) => {
  const { currentUser } = useAuth();
  const isAuthor = currentUser?.id === comment.authorId;

  const [isEditing, setIsEditing] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [likeHovered, setLikeHovered] = useState(false);
  const [replyHovered, setReplyHovered] = useState(false);
  const [isBubbleHovered, setIsBubbleHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenReplyBox = () => {
    const nextState = !showReplyBox;
    setShowReplyBox(nextState);
    if (nextState && !replyText) {
      setReplyText(`@${comment.authorName} `);
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;

    let finalContent = replyText.trim();
    const mentionStr = `@${comment.authorName}`;
    if (finalContent.startsWith(mentionStr)) {
      const restText = finalContent.substring(mentionStr.length);
      finalContent = `<span style="color: #1D4ED8; font-weight: 600; cursor: pointer;">${mentionStr}</span>${restText}`;
    }

    onReply(comment.id, finalContent);
    setReplyText('');
    setShowReplyBox(false);
    setShowReplies(true);
  };

  const isRoot = nestingLevel === 0;
  const showConnectorLine = isReply;

  const renderFormattedContent = (text: string) => {
    if (text.includes('<span style="color: #1D4ED8;')) {
      return <RichContentView content={text} />;
    }

    const mentionRegex = /^(@[^\s<]+(?:\s+[^\s<]+)?)/;
    const match = text.match(mentionRegex);

    if (match) {
      const mentionTag = match[1];
      const restText = text.slice(mentionTag.length);
      return (
        <div>
          <span
            style={{
              color: '#1D4ED8',
              fontWeight: '600',
              marginRight: 4,
              cursor: 'pointer',
            }}
          >
            {mentionTag}
          </span>
          <RichContentView content={restText} />
        </div>
      );
    }

    return <RichContentView content={text} />;
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        position: 'relative',
      }}
    >
      {/* 🟢 ĐƯỜNG KẺ NỐI CHUẨN FACEBOOK CHO CÁC REPLIES */}
      {showConnectorLine && (
        <>
          {isLastChild ? (
            <div
              style={{
                position: 'absolute',
                left: -20,
                top: 0,
                width: 20,
                height: 12,
                borderLeft: '2px solid #CBD5E1',
                borderBottom: '2px solid #CBD5E1',
                borderBottomLeftRadius: 10,
                pointerEvents: 'none',
              }}
            />
          ) : (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: -20,
                  top: 0,
                  bottom: -12,
                  width: 2,
                  borderLeft: '2px solid #CBD5E1',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: -20,
                  top: 0,
                  width: 20,
                  height: 12,
                  borderLeft: '2px solid #CBD5E1',
                  borderBottom: '2px solid #CBD5E1',
                  borderBottomLeftRadius: 10,
                  pointerEvents: 'none',
                }}
              />
            </>
          )}
        </>
      )}

      {/* Avatar dùng name prop đồng bộ */}
      <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <Avatar name={comment.authorName} size={isRoot ? 'sm' : 'xs'} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Chế độ Inline Edit hoặc Bubble comment thường kèm Menu 3 chấm chuẩn Facebook */}
        {isEditing ? (
          <EditComment
            initialContent={comment.content}
            onSave={async (newContent) => {
              onEdit?.(comment.id, newContent);
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div
            onMouseEnter={() => setIsBubbleHovered(true)}
            onMouseLeave={() => setIsBubbleHovered(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              maxWidth: '100%',
              position: 'relative',
            }}
          >
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
              <div style={{ marginTop: 4 }}>
                {renderFormattedContent(comment.content)}
              </div>
            </div>

            {/* Menu 3 chấm Facebook (chỉ tác giả thấy khi hover hoặc mở menu) */}
            {isAuthor && (
              <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((v) => !v)}
                  style={{
                    background: isMenuOpen ? '#E2E8F0' : 'transparent',
                    border: 'none',
                    padding: 4,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isBubbleHovered || isMenuOpen ? 1 : 0,
                    transition: 'opacity 0.15s ease, background 0.15s ease',
                  }}
                  title="Tùy chọn bình luận"
                >
                  <MoreHorizontal size={16} color="#64748B" />
                </button>

                {/* Dropdown Popover Menu chuẩn Facebook */}
                {isMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      background: 'white',
                      border: '1px solid #CBD5E1',
                      borderRadius: 10,
                      boxShadow: '0 10px 20px -5px rgba(0,0,0,0.15)',
                      zIndex: 90,
                      minWidth: 130,
                      padding: '4px 0',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsEditing(true);
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: '600',
                        color: '#1E293B',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'background 0.15s ease',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Edit2 size={13} color="#3B82F6" />
                      <span>Chỉnh sửa</span>
                    </div>

                    <div
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) {
                          onDelete?.(comment.id);
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: '600',
                        color: '#DC2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'background 0.15s ease',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = '#FEF2F2')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Trash2 size={13} color="#DC2626" />
                      <span>Xóa</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Meta + Actions */}
        {!isEditing && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 6, paddingLeft: 4 }}>
            <span style={{ fontSize: 11, color: FORUM_COLORS.textDisabled }}>
              {comment.timeAgo}
              {comment.isEdited && <span style={{ marginLeft: 4 }}>• Đã chỉnh sửa</span>}
            </span>

            {/* Nút Thích */}
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
              <span>Thích</span>
              {comment.likesCount > 0 && <span style={{ fontWeight: '500' }}>({comment.likesCount})</span>}
            </button>

            {/* Nút Trả lời */}
            <button
              onMouseEnter={() => setReplyHovered(true)}
              onMouseLeave={() => setReplyHovered(false)}
              onClick={handleOpenReplyBox}
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
              <span>Trả lời</span>
            </button>
          </div>
        )}

        {/* Nút "Xem X phản hồi" / "Ẩn X phản hồi" kiểu Facebook */}
        {comment.replies.length > 0 && (
          <button
            onClick={() => setShowReplies((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 0 0 4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: '600',
              color: FORUM_COLORS.primary,
              marginTop: 4,
            }}
          >
            <CornerDownRight size={13} />
            <span>
              {showReplies
                ? `Ẩn ${comment.replies.length} phản hồi`
                : `Xem ${comment.replies.length} phản hồi`}
            </span>
          </button>
        )}

        {/* Khung gõ Reply */}
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

        {/* Mảng replies phẳng chuẩn Facebook */}
        {showReplies && comment.replies.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginTop: 10,
              paddingLeft: isRoot ? 32 : 0,
              position: 'relative',
            }}
          >
            {comment.replies.map((reply, index) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onLike={onLike}
                isReply
                nestingLevel={1}
                isLastChild={index === comment.replies.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
