/**
 * EditComment — Form chỉnh sửa bình luận Inline với đầy đủ công cụ (TipTap EditTextTool).
 *
 * Tích hợp EditTextTool hỗ trợ ảnh 🖼️, công thức Toán +/–, định dạng rich text,
 * bảo toàn ảnh cũ và thẻ tag tác giả (@Mention) khi chỉnh sửa.
 */

import React, { useState } from 'react';
import { FORUM_COLORS } from '../constants/colors';
import { EditTextTool } from '../../../components/ui/EditTextTool';

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
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasValidContent = () => {
    if (!content) return false;
    const hasImage = /<img[^>]*>/i.test(content);
    const textOnly = content.replace(/<[^>]*>/g, '').trim();
    return textOnly.length > 0 || hasImage;
  };

  const handleSave = async () => {
    if (!hasValidContent() || isSubmitting) return;

    let finalContent = content.trim();

    // Nếu văn bản có @Tag tác giả ở đầu (kể cả bọc trong <p> của TipTap) mà chưa có thẻ span màu xanh, tự động bọc lại
    if (!finalContent.includes('<span style=')) {
      const mentionRegex = /^(?:<p>)?\s*(@[\w\u00C0-\u024F\u1EA0-\u1EF9]+(?:\s+[\w\u00C0-\u024F\u1EA0-\u1EF9]+)?)/i;
      if (mentionRegex.test(finalContent)) {
        finalContent = finalContent.replace(mentionRegex, (match, tag) => {
          const hasP = match.startsWith('<p>');
          return `${hasP ? '<p>' : ''}<span style="color: #1D4ED8; font-weight: 600; cursor: pointer;">${tag}</span>`;
        });
      }
    }

    setIsSubmitting(true);
    try {
      await onSave(finalContent);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 4 }}>
      <EditTextTool
        content={content}
        onChange={setContent}
        placeholder="Chỉnh sửa bình luận..."
        minHeight={80}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'transparent',
            color: FORUM_COLORS.textMuted,
            border: '1px solid #CBD5E1',
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = FORUM_COLORS.textPrimary)}
          onMouseOut={(e) => (e.currentTarget.style.color = FORUM_COLORS.textMuted)}
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasValidContent() || isSubmitting}
          style={{
            background: FORUM_COLORS.primary,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            padding: '5px 14px',
            fontSize: 12,
            fontWeight: '600',
            cursor: !hasValidContent() || isSubmitting ? 'not-allowed' : 'pointer',
            opacity: !hasValidContent() || isSubmitting ? 0.6 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          {isSubmitting ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </div>
  );
};
