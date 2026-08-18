/**
 * CommentItem — Hiển thị 1 bình luận (hoặc 1 reply trong mảng replies phẳng chuẩn Facebook).
 *
 * Chuẩn Facebook Best Practice (2-Tier Layout):
 *   - DOM phẳng 2 cấp: Root Comment (Cấp 1) -> Thread Replies (Cấp 2).
 *   - Tất cả câu trả lời (dù reply cho gốc hay reply cho reply khác) đều gióng thẳng hàng 100% ở Cấp 2 (lề 32px).
 *   - Tự động gắn tag `@TênTácGiả` màu xanh đậm nổi bật khi trả lời các câu reply trong luồng.
 *   - Nút "Xem X phản hồi" / "Ẩn X phản hồi" bung danh sách trả lời.
 */

import React, { useState } from 'react';
import { ThumbsUp, CornerDownRight, Send } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { RichContentView } from '../../../components/ui/RichContentView';
import { FORUM_COLORS } from '../constants/colors';
import type { Comment } from '../types/forum.types';

interface CommentItemProps {
  comment: Comment;
  onReply: (parentId: string, content: string) => void;
  onLike: (commentId: string, isLiked: boolean) => void;
  isReply?: boolean;
  nestingLevel?: number; // 0 = Gốc (Root), 1 = Reply trong luồng
  isLastChild?: boolean; // Đánh dấu comment con cuối cùng trong nhánh
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onReply,
  onLike,
  isReply = false,
  nestingLevel = 0,
  isLastChild = false,
}) => {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [likeHovered, setLikeHovered] = useState(false);
  const [replyHovered, setReplyHovered] = useState(false);

  const handleOpenReplyBox = () => {
    const nextState = !showReplyBox;
    setShowReplyBox(nextState);
    if (nextState && !replyText) {
      // Tự động chèn @Tag tên tác giả
      setReplyText(`@${comment.authorName} `);
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;

    let finalContent = replyText.trim();
    const mentionStr = `@${comment.authorName}`;
    if (finalContent.startsWith(mentionStr)) {
      // Bọc thẻ span có inline style cho tag mention để lưu vào DB
      const restText = finalContent.substring(mentionStr.length);
      finalContent = `<span style="color: #1D4ED8; font-weight: 600; cursor: pointer;">${mentionStr}</span>${restText}`;
    }

    onReply(comment.id, finalContent);
    setReplyText('');
    setShowReplyBox(false);
    setShowReplies(true); // Tự động mở danh sách reply khi vừa trả lời
  };

  const isRoot = nestingLevel === 0;
  // Đường kẻ nối L mượt mà từ Root sang các Reply
  const showConnectorLine = isReply;

  // Render nội dung comment có nhận diện thẻ @Tag tác giả màu xanh nổi bật kiểu Facebook (Fallback cho các comment cũ)
  const renderFormattedContent = (text: string) => {
    // Nếu text đã chứa thẻ span chứa mention do FE tự tạo thì hiển thị luôn
    if (text.includes('<span style="color: #1D4ED8;')) {
      return <RichContentView content={text} />;
    }

    // Fallback regex cho các dữ liệu cũ (chỉ match tối đa 2 từ)
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
        {/* Bubble chứa nội dung comment */}
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

        {/* Meta + Actions */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 6, paddingLeft: 4 }}>
          <span style={{ fontSize: 11, color: FORUM_COLORS.textDisabled }}>{comment.timeAgo}</span>

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

        {/* Mảng replies phẳng chuẩn Facebook: Tất cả reply trong luồng đều gióng thẳng hàng ở Cấp 2 */}
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
