/**
 * ForumSidebar — Danh sách danh mục môn học bên trái trang Forum.
 *
 * Hiển thị:
 *   - Ô tìm kiếm (SearchInput)
 *   - "Tất cả môn học" (reset filter)
 *   - Danh sách ForumCategoryResponse nhóm theo tag (KHOA HỌC CƠ BẢN, CNTT, ...)
 *   - Item đang chọn được highlight bằng FORUM_COLORS.primaryLight
 */

import React, { useState, useEffect } from 'react';
import { SearchInput } from '../../../components/ui/SearchInput';
import { FORUM_COLORS } from '../constants/colors';
import { forumApi } from '../lib/forum.api';
import type { ForumCategoryResponse } from '../types/forum.types';

interface ForumSidebarProps {
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onSearchChange: (search: string) => void;
}

export const ForumSidebar: React.FC<ForumSidebarProps> = ({
  selectedCategoryId,
  onSelectCategory,
  onSearchChange,
}) => {
  const [categories, setCategories] = useState<ForumCategoryResponse[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    forumApi.getCategories().then(setCategories);
  }, []);

  const isActive = (id: string | null) => selectedCategoryId === id;

  const itemStyle = (id: string | null): React.CSSProperties => ({
    padding: '9px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: isActive(id) ? '600' : '400',
    color: isActive(id) ? FORUM_COLORS.primaryText : FORUM_COLORS.textSecondary,
    background: isActive(id)
      ? FORUM_COLORS.primaryLight
      : hoveredId === id
      ? FORUM_COLORS.subtle
      : 'transparent',
    transition: 'background 0.15s ease, color 0.15s ease',
  });

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        background: FORUM_COLORS.card,
        borderRadius: 12,
        padding: 20,
        border: `1px solid ${FORUM_COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignSelf: 'flex-start',
        position: 'sticky',
        top: 24,
      }}
    >
      <SearchInput
        placeholder="Tìm môn học..."
        onChange={(e) => onSearchChange(e.target.value)}
      />

      {/* Tất cả */}
      <div
        style={itemStyle(null)}
        onMouseEnter={() => setHoveredId('__all__')}
        onMouseLeave={() => setHoveredId(null)}
        onClick={() => onSelectCategory(null)}
      >
        📚 Tất cả môn học
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: FORUM_COLORS.textDisabled,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '0 8px',
            marginBottom: 4,
          }}
        >
          Danh mục
        </div>

        {categories.map((cat) => (
          <div
            key={cat.id}
            style={itemStyle(cat.id)}
            onMouseEnter={() => setHoveredId(cat.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectCategory(cat.id)}
          >
            {cat.name}
          </div>
        ))}
      </div>
    </aside>
  );
};
