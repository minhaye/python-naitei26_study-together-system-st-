/**
 * CommentItem — Hiển thị 1 bình luận (hoặc 1 reply trong cây comment).
 *
 * Tích hợp nút "Xem X phản hồi" / "Ẩn X phản hồi" kiểu Facebook:
 *   - Mặc định KHÔNG tự động mở tràn các câu trả lời con.
 *   - Hiển thị nút "Xem X phản hồi". Bấm vào mới mở bung danh sách trả lời con.
 *   - Tự động mở bung khi người dùng vừa viết câu trả lời mới.
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
  nestingLevel?: number; // 0 = gốc, 1 = trả lời trực tiếp gốc, 2+ = trả lời của trả lời
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

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText('');
    setShowReplyBox(false);
    setShowReplies(true); // Tự động bung danh sách reply khi người dùng vừa trả lời
  };

  const isRoot = nestingLevel === 0;
  // Chỉ vẽ đường nối khi là comment trả lời cấp 2 trở lên
  const showConnectorLine = isReply && nestingLevel >= 2;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        position: 'relative',
      }}
    >
      {/* 🟢 ĐƯỜNG KẺ NỐI CHUẨN FACEBOOK */}
      {showConnectorLine && (
        <>
          {/* Comment con CUỐI CÙNG: Bắt đầu từ top: 0, uốn cong 90 độ tại y: 12px đâm vào tâm Avatar và DỪNG HẲN */}
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
            /* Comment con KHÔNG PHẢI CUỐI: Đường dọc kéo xuống hết chiều cao + Nét uốn L đâm vào tâm Avatar */
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
            <RichContentView content={comment.content} />
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

        {/* Mảng replies đệ quy (Chỉ mở khi showReplies === true) */}
        {showReplies && comment.replies.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginTop: 10,
              paddingLeft: 32,
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
                nestingLevel={nestingLevel + 1}
                isLastChild={index === comment.replies.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
