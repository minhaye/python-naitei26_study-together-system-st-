import React, { useState, useRef, useEffect } from 'react';
import { ThumbsUp, CornerDownRight, Send, Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { RichContentView } from '../../../components/ui/RichContentView';
import { EditTextTool } from '../../../components/ui/EditTextTool';
import { FORUM_COLORS } from '../constants/colors';
import type { Comment } from '../types/forum.types';
import { EditComment } from './EditComment';
import { ReactionPicker } from './ReactionPicker';
import { DEFAULT_REACTION_EMOJI, REACTION_META_BY_EMOJI, myReactionEmoji, topReactionEmojis, totalReactionCount } from '../constants/reactions';
import { useAuth } from '../../../hooks/useAuth';
import { ReasonPromptModal } from '../../../components/ui/ReasonPromptModal';
import { MessageUserTrigger } from '../../../components/messages/MessageUserTrigger';

interface CommentItemProps {
  comment: Comment;
  onReply: (parentId: string, content: string) => void;
  onEdit?: (commentId: string, newContent: string) => void;
  onDelete?: (commentId: string, reason?: string) => void;
  onReact: (commentId: string, emoji: string) => void;
  onRemoveReaction: (commentId: string) => void;
  isReply?: boolean;
  nestingLevel?: number; // 0 = Gốc (Root), 1 = Reply trong luồng
  isLastChild?: boolean; // Đánh dấu comment con cuối cùng trong nhánh
}

const getPlainText = (html: string) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
};

export const CommentItem: React.FC<CommentItemProps> = React.memo(({
  comment,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onRemoveReaction,
  isReply = false,
  nestingLevel = 0,
  isLastChild = false,
}) => {
  const { currentUser, requireAuth, isModerator } = useAuth();
  const isAuthor = currentUser?.id === comment.authorId;

  const [isEditing, setIsEditing] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [showReplyRichEditor, setShowReplyRichEditor] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [replyHovered, setReplyHovered] = useState(false);
  const [isBubbleHovered, setIsBubbleHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModeratorDeleteModalOpen, setIsModeratorDeleteModalOpen] = useState(false);

  const myEmoji = myReactionEmoji(comment.reactions);
  const activeMeta = myEmoji ? REACTION_META_BY_EMOJI[myEmoji] : null;
  const totalReactions = totalReactionCount(comment.reactions);
  const topEmojis = topReactionEmojis(comment.reactions, 3);

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

  const handleLikeClick = () => {
    requireAuth(() => {
      if (myEmoji) {
        onRemoveReaction(comment.id);
      } else {
        onReact(comment.id, DEFAULT_REACTION_EMOJI);
      }
    });
  };

  const handlePickReaction = (emoji: string) => {
    setReactionPickerOpen(false);
    requireAuth(() => {
      if (myEmoji === emoji) {
        onRemoveReaction(comment.id);
      } else {
        onReact(comment.id, emoji);
      }
    });
  };

  const handleOpenReplyBox = () => {
    requireAuth(() => {
      const nextState = !showReplyBox;
      setShowReplyBox(nextState);
      if (nextState && !replyText) {
        setReplyText(`@${comment.authorName} `);
      }
      if (!nextState) {
        setShowReplyRichEditor(false);
      }
    });
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;

    let finalContent = replyText.trim();
    const mentionStr = `@${comment.authorName}`;

    // Tự động đóng gói tag @Mention màu xanh nổi bật ngay cả khi nằm trong thẻ <p> hoặc có thêm chữ/ảnh phía sau
    if (!finalContent.includes('<span style=')) {
      const escapeReg = mentionStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const mentionRegex = new RegExp(`^(?:<p>)?\\s*(${escapeReg})`, 'i');
      if (mentionRegex.test(finalContent)) {
        finalContent = finalContent.replace(mentionRegex, (match, tag) => {
          const hasP = match.startsWith('<p>');
          return `${hasP ? '<p>' : ''}<span style="color: #1D4ED8; font-weight: 600; cursor: pointer;">${tag}</span>`;
        });
      }
    }

    onReply(comment.id, finalContent);
    setReplyText('');
    setShowReplyBox(false);
    setShowReplyRichEditor(false);
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
        <MessageUserTrigger userId={comment.authorId} isSelf={isAuthor}>
          <Avatar name={comment.authorName} src={comment.authorAvatarUrl} size={isRoot ? 'sm' : 'xs'} />
        </MessageUserTrigger>
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
              <MessageUserTrigger userId={comment.authorId} isSelf={isAuthor}>
                <span style={{ fontWeight: '600', fontSize: 13, color: FORUM_COLORS.textPrimary }}>
                  {comment.authorName}
                </span>
              </MessageUserTrigger>
              <div style={{ marginTop: 4 }}>
                {renderFormattedContent(comment.content)}
              </div>
            </div>

            {/* Menu 3 chấm Facebook (tác giả hoặc kiểm duyệt viên thấy khi hover hoặc mở menu) */}
            {(isAuthor || isModerator) && (
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
                    {isAuthor && (
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
                    )}

                    <div
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (isAuthor) {
                          if (window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) {
                            onDelete?.(comment.id);
                          }
                        } else {
                          setIsModeratorDeleteModalOpen(true);
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
                      <span>{isAuthor ? 'Xóa' : 'Xóa (Kiểm duyệt viên)'}</span>
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

            {/* Nút Bày tỏ cảm xúc -- hover để mở bảng chọn emoji, click nhanh = 👍 */}
            <div
              style={{ position: 'relative' }}
              onMouseEnter={() => setReactionPickerOpen(true)}
              onMouseLeave={() => setReactionPickerOpen(false)}
            >
              {reactionPickerOpen && <ReactionPicker onSelect={handlePickReaction} align="center" emojiSize={16} />}
              <button
                type="button"
                onClick={handleLikeClick}
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
                  color: activeMeta ? activeMeta.color : FORUM_COLORS.textMuted,
                  transition: 'color 0.15s ease',
                }}
              >
                {myEmoji ? <span style={{ fontSize: 14 }}>{myEmoji}</span> : <ThumbsUp size={12} />}
                <span>{activeMeta ? activeMeta.label : 'Thích'}</span>
                {totalReactions > 0 && (
                  <span style={{ fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    ({topEmojis.join('')} {totalReactions})
                  </span>
                )}
              </button>
            </div>

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

        {/* Khung gõ Reply (Mặc định nhỏ gọn, click/focus mở rộng EditTextTool phong phú) */}
        {showReplyBox && (
          <div style={{ marginTop: 8, width: '100%' }}>
            {!showReplyRichEditor ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                <input
                  value={getPlainText(replyText)}
                  onFocus={() => setShowReplyRichEditor(true)}
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
                    cursor: 'text',
                  }}
                />
                <button
                  type="button"
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
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <EditTextTool
                  content={replyText}
                  onChange={setReplyText}
                  placeholder={`Trả lời ${comment.authorName}...`}
                  minHeight={80}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplyRichEditor(false);
                      setShowReplyBox(false);
                    }}
                    style={{
                      padding: '5px 12px',
                      background: 'transparent',
                      border: '1px solid #CBD5E1',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: '500',
                      color: '#64748B',
                      cursor: 'pointer',
                    }}
                  >
                    Thu gọn
                  </button>
                  <button
                    type="button"
                    onClick={handleSendReply}
                    style={{
                      padding: '5px 14px',
                      background: FORUM_COLORS.primary,
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: '600',
                      color: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    Gửi phản hồi
                  </button>
                </div>
              </div>
            )}
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
                onReact={onReact}
                onRemoveReaction={onRemoveReaction}
                isReply
                nestingLevel={1}
                isLastChild={index === comment.replies.length - 1}
              />
            ))}
          </div>
        )}

        {/* Modal Xóa bình luận (Kiểm duyệt viên) -- ghi lý do vào lịch sử kiểm duyệt */}
        {isModeratorDeleteModalOpen && (
          <ReasonPromptModal
            isOpen={isModeratorDeleteModalOpen}
            onClose={() => setIsModeratorDeleteModalOpen(false)}
            title="Xóa bình luận vi phạm"
            description="Bình luận sẽ bị gỡ khỏi diễn đàn. Lý do (nếu có) sẽ được lưu vào lịch sử kiểm duyệt."
            confirmLabel="Xóa bình luận"
            onConfirm={async (reason) => {
              onDelete?.(comment.id, reason || undefined);
            }}
          />
        )}
      </div>
    </div>
  );
});
