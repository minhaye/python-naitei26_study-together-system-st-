/**
 * EditPostModal — Popup chỉnh sửa bài viết trên Forum (Facebook Style).
 *
 * Tải sẵn dữ liệu cũ (title, content, categoryId), cho phép người dùng sửa tiêu đề, nội dung (Rich Text TipTap)
 * và danh mục môn học, hỗ trợ gợi ý hashtag (#) tự động.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { EditTextTool } from '../../../components/ui/EditTextTool';
import { FORUM_COLORS } from '../constants/colors';
import { forumApi } from '../lib/forum.api';
import type { ForumCategoryResponse, Post, TagResponse, ForumPostUpdate } from '../types/forum.types';
import { useCaretPosition } from '../hooks/useCaretPosition';

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  onSave: (payload: ForumPostUpdate, categoryName?: string) => Promise<void> | void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  isOpen,
  onClose,
  post,
  onSave,
}) => {
  const [categories, setCategories] = useState<ForumCategoryResponse[]>([]);
  const [categoryId, setCategoryId] = useState<string>(post.categoryId);
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [editorKey, setEditorKey] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [tagSuggestions, setTagSuggestions] = useState<TagResponse[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const tagSuggestionsRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const { position: suggestionPos, updateCaretPosition } = useCaretPosition();

  // Re-sync state mỗi khi post hoặc isOpen thay đổi
  useEffect(() => {
    if (isOpen) {
      setTitle(post.title);
      setContent(post.content);
      setCategoryId(post.categoryId);
      setEditorKey((prev) => prev + 1);

      forumApi.getCategories().then((cats) => {
        setCategories(cats);
      });
    }
  }, [isOpen, post]);

  // Gợi ý Hashtag tự động khi gõ ký tự # (Hỗ trợ tiếng Việt Unicode)
  useEffect(() => {
    const cleanText = content.replace(/<[^>]*>/g, '');
    const match = cleanText.match(/#([\w\u00C0-\u024F\u1EA0-\u1EF9]*)$/);
    if (match) {
      const q = match[1];
      forumApi.searchTags(q).then((tags) => {
        setTagSuggestions(tags);
        if (tags.length > 0) {
          updateCaretPosition(editorContainerRef.current);
          setShowTagSuggestions(true);
        } else {
          setShowTagSuggestions(false);
        }
      });
    } else {
      setShowTagSuggestions(false);
    }
  }, [content, updateCaretPosition]);

  const handleSelectTagSuggestion = (tagName: string) => {
    const cleanText = content.replace(/<[^>]*>/g, '');
    const match = cleanText.match(/#([\w\u00C0-\u024F\u1EA0-\u1EF9]*)$/);
    if (match) {
      const targetTag = match[0];
      const newTagStr = `#${tagName} `;
      const lastIdx = content.lastIndexOf(targetTag);
      if (lastIdx !== -1) {
        const updated = content.slice(0, lastIdx) + newTagStr + content.slice(lastIdx + targetTag.length);
        setContent(updated);
        setEditorKey((prev) => prev + 1);
      }
    }
    setShowTagSuggestions(false);
  };

  // Đóng dropdown & tag suggestions khi click ra ngoài hoặc bấm Esc
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (tagSuggestionsRef.current && !tagSuggestionsRef.current.contains(event.target as Node)) {
        setShowTagSuggestions(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowTagSuggestions(false);
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const hasContent = (html: string) => {
    if (!html.trim()) return false;
    const hasImage = /<img[^>]*>/i.test(html);
    const textOnly = html.replace(/<[^>]*>/g, '').trim();
    return textOnly.length > 0 || hasImage;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCategory = categories.find((cat) => cat.id === categoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !hasContent(content) || !categoryId || isSubmitting) return;

    setIsDropdownOpen(false);
    onClose();
    onSave(
      {
        category_id: categoryId,
        title: title.trim(),
        content: content.trim(),
      },
      selectedCategory?.name
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa bài viết">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Dropdown Chọn môn học Tùy chỉnh */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: '600', color: FORUM_COLORS.textSecondary }}>
            Môn học / Danh mục
          </label>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
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
              <span>{selectedCategory ? selectedCategory.name : (post.categoryName || 'Chọn môn học...')}</span>
              <ChevronDown
                size={18}
                color="#64748B"
                style={{
                  transition: 'transform 0.2s ease',
                  transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </div>

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
            Tiêu đề bài viết
          </label>
          <input
            type="text"
            placeholder="Tiêu đề bài viết..."
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
        <div ref={editorContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
          <label style={{ fontSize: 13, fontWeight: '600', color: FORUM_COLORS.textSecondary }}>
            Nội dung bài viết
          </label>
          <EditTextTool
            key={editorKey}
            content={content}
            onChange={setContent}
            placeholder="Nội dung bài viết... Nhập # để thêm hashtag"
            minHeight={140}
          />
          {showTagSuggestions && tagSuggestions.length > 0 && (
            <div
              ref={tagSuggestionsRef}
              style={{
                position: 'absolute',
                top: suggestionPos.top,
                left: suggestionPos.left,
                width: 280,
                background: 'white',
                border: '1px solid #CBD5E1',
                borderRadius: 10,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                zIndex: 99,
                maxHeight: 180,
                overflowY: 'auto',
                padding: '6px 0',
                transition: 'top 0.1s ease, left 0.1s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 12px',
                  borderBottom: '1px solid #F1F5F9',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: '0.05em' }}>
                  GỢI Ý HASHTAG (#)
                </span>
                <button
                  type="button"
                  onClick={() => setShowTagSuggestions(false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#94A3B8',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Đóng gợi ý (Esc)"
                >
                  <X size={14} />
                </button>
              </div>
              {tagSuggestions.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handleSelectTagSuggestion(t.name)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 13,
                    color: '#2563EB',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#EFF6FF')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>#{t.name}</span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{t.post_count} bài viết</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button variant="outline" type="button" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!title.trim() || !hasContent(content) || !categoryId || isSubmitting}
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
