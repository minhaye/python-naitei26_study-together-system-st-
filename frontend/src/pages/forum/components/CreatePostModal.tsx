/**
 * CreatePostModal — Popup tạo câu hỏi / bài viết mới trên Forum.
 *
 * Tích hợp Dropdown tùy chỉnh hiện đại cho Môn học/Danh mục và Trình soạn thảo TipTap (EditTextTool).
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Nạp danh sách môn học khi mở Modal
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

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasContent = (html: string) => {
    if (!html.trim()) return false;
    const hasImage = /<img[^>]*>/i.test(html);
    const textOnly = html.replace(/<[^>]*>/g, '').trim();
    return textOnly.length > 0 || hasImage;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !hasContent(content) || !categoryId) return;
    onSubmit({
      category_id: categoryId,
      title: title.trim(),
      content: content.trim(),
    });
    setTitle('');
    setContent('');
    setIsDropdownOpen(false);
  };

  const selectedCategory = categories.find((cat) => cat.id === categoryId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Đặt câu hỏi mới">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Dropdown Chọn môn học Tùy chỉnh (Modern Custom Select Dropdown) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: '600', color: FORUM_COLORS.textSecondary }}>
            Môn học / Danh mục
          </label>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Box chọn chính (Dropdown Trigger Box) */}
            <div
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: isDropdownOpen ? '1px solid #3B82F6' : `1px solid ${FORUM_COLORS.border}`,
                background: isDropdownOpen ? '#FFFFFF' : FORUM_COLORS.subtle,
                fontSize: 14,
                fontWeight: '500',
                color: selectedCategory ? FORUM_COLORS.textPrimary : '#94A3B8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: isDropdownOpen ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
                transition: 'all 0.2s ease',
                userSelect: 'none',
              }}
            >
              <span>{selectedCategory ? selectedCategory.name : 'Chọn môn học...'}</span>
              <ChevronDown
                size={18}
                color="#64748B"
                style={{
                  transition: 'transform 0.2s ease',
                  transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </div>

            {/* Popup Danh sách chọn (Custom Floating Menu) */}
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid #CBD5E1',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 999,
                  maxHeight: 220,
                  overflowY: 'auto',
                  padding: '6px 0',
                }}
              >
                {categories.map((cat) => {
                  const isSelected = cat.id === categoryId;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setCategoryId(cat.id);
                        setIsDropdownOpen(false);
                      }}
                      style={{
                        padding: '10px 14px',
                        fontSize: 14,
                        fontWeight: isSelected ? '600' : '400',
                        color: isSelected ? '#1D4ED8' : FORUM_COLORS.textPrimary,
                        background: isSelected ? '#EFF6FF' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseOver={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                      }}
                      onMouseOut={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span>{cat.name}</span>
                      {isSelected && <Check size={16} color="#1D4ED8" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${FORUM_COLORS.border}`,
              background: FORUM_COLORS.subtle,
              fontSize: 14,
              color: FORUM_COLORS.textPrimary,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#3B82F6')}
            onBlur={(e) => (e.target.style.borderColor = FORUM_COLORS.border)}
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
            disabled={!title.trim() || !hasContent(content) || !categoryId}
          >
            Đăng câu hỏi
          </Button>
        </div>
      </form>
    </Modal>
  );
};
