/**
 * EditComment — Form chỉnh sửa bình luận Inline (Facebook Style).
 *
 * Tự động Focus vào ô input, hỗ trợ phím Enter để lưu, Escape để hủy,
 * đi kèm 2 nút bấm nhỏ "Lưu" và "Hủy" bên dưới bubble comment.
 */

import React, { useState } from 'react';
import { FORUM_COLORS } from '../constants/colors';

interface EditCommentProps {
  initialContent: string;
  onSave: (newContent: string) => Promise<void> | void;
  onCancel: () => void;
}

export const EditComment: React.FC<EditCommentProps> = ({
  initialContent,
  onSave,
  onCancel,
}) => {
  // Loại bỏ các thẻ HTML wrapper nếu có để người dùng chỉnh sửa văn bản gốc
  const getRawText = (html: string) => {
    // Nếu chứa thẻ mention span do FE tạo, giữ lại text
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  const [text, setText] = useState(getRawText(initialContent));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!text.trim() || isSubmitting) return;

    let finalContent = text.trim();
    // Nếu text có @Tag tác giả ở đầu, tự bọc lại thẻ span màu xanh
    const mentionRegex = /^(@[^\s<]+(?:\s+[^\s<]+)?)/;
    const match = finalContent.match(mentionRegex);
    if (match && !finalContent.includes('<span style=')) {
      const mentionTag = match[1];
      const restText = finalContent.slice(mentionTag.length);
      finalContent = `<span style="color: #1D4ED8; font-weight: 600; cursor: pointer;">${mentionTag}</span>${restText}`;
    }

    setIsSubmitting(true);
    try {
      await onSave(finalContent);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', marginTop: 2 }}>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Chỉnh sửa bình luận..."
        style={{
          width: '100%',
          padding: '8px 12px',
          background: '#FFFFFF',
          border: `1px solid ${FORUM_COLORS.primary}`,
          borderRadius: 16,
          outline: 'none',
          fontSize: 13,
          color: FORUM_COLORS.textPrimary,
          boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)',
        }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || isSubmitting}
          style={{
            background: FORUM_COLORS.primary,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 12,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: '600',
            cursor: !text.trim() || isSubmitting ? 'not-allowed' : 'pointer',
            opacity: !text.trim() || isSubmitting ? 0.6 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          {isSubmitting ? 'Đang lưu...' : 'Lưu'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'transparent',
            color: FORUM_COLORS.textMuted,
            border: 'none',
            padding: '4px 8px',
            fontSize: 12,
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'color 0.15s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = FORUM_COLORS.textPrimary)}
          onMouseOut={(e) => (e.currentTarget.style.color = FORUM_COLORS.textMuted)}
        >
          Hủy
        </button>
        <span style={{ fontSize: 11, color: FORUM_COLORS.textDisabled, marginLeft: 4 }}>
          Nhấn Enter để lưu, Esc để hủy
        </span>
      </div>
    </div>
  );
};
