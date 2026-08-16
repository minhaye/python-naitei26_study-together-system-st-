/**
 * CreatePostModal — Popup tạo câu hỏi / bài viết mới trên Forum.
 *
 * Tích hợp EditTextTool (TipTap Editor) với đầy đủ công cụ soạn thảo, bảng, ảnh & công thức toán.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { EditTextTool } from '../../../components/ui/EditTextTool';
import { FORUM_COLORS } from '../constants/colors';
import { forumApi } from '../lib/forum.api';
import type { ForumCategoryResponse } from '../types/forum.types';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { category_id: string; title: string; content: string }) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [categories, setCategories] = useState<ForumCategoryResponse[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (isOpen) {
      forumApi.getCategories().then((cats) => {
        setCategories(cats);
        if (cats.length > 0 && !categoryId) {
          setCategoryId(cats[0].id);
        }
      });
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Loại bỏ thẻ HTML thô nếu rỗng
    const textOnly = content.replace(/<[^>]*>/g, '').trim();
    if (!title.trim() || !textOnly || !categoryId) return;
    onSubmit({
      category_id: categoryId,
      title: title.trim(),
      content: content.trim(),
    });
    setTitle('');
    setContent('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Đặt câu hỏi mới">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Chọn môn học */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: '600', color: FORUM_COLORS.textSecondary }}>
            Môn học / Danh mục
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${FORUM_COLORS.border}`,
              background: FORUM_COLORS.subtle,
              fontSize: 14,
              color: FORUM_COLORS.textPrimary,
              outline: 'none',
            }}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tiêu đề */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: '600', color: FORUM_COLORS.textSecondary }}>
            Tiêu đề câu hỏi
          </label>
          <input
            type="text"
            placeholder="Ví dụ: Giúp mình hiểu về tích phân từng phần?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${FORUM_COLORS.border}`,
              background: FORUM_COLORS.subtle,
              fontSize: 14,
              color: FORUM_COLORS.textPrimary,
              outline: 'none',
            }}
          />
        </div>

        {/* Nội dung với Trình soạn thảo EditTextTool (TipTap) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: '600', color: FORUM_COLORS.textSecondary }}>
            Nội dung chi tiết (hỗ trợ công thức Toán, bảng, ảnh & định dạng)
          </label>
          <EditTextTool
            content={content}
            onChange={setContent}
            placeholder="Mô tả chi tiết câu hỏi hoặc thắc mắc của bạn..."
            minHeight={140}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button variant="outline" type="button" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!title.trim() || !content.replace(/<[^>]*>/g, '').trim() || !categoryId}
          >
            Đăng câu hỏi
          </Button>
        </div>
      </form>
    </Modal>
  );
};
