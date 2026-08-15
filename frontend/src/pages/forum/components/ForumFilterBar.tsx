/**
 * ForumFilterBar — Thanh filter + nút "Đặt câu hỏi" ở đầu trang Forum.
 *
 * Hiển thị:
 *   - Tiêu đề "Diễn đàn thảo luận" + badge tên danh mục đang chọn
 *   - Dropdown sắp xếp (Mới nhất / Nổi bật)
 *   - Nút "Đặt câu hỏi" (chỉ hoạt động khi đã đăng nhập)
 */

import React, { useState } from 'react';
import { Filter, Edit3 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { FORUM_COLORS } from '../constants/colors';

interface ForumFilterBarProps {
  categoryName: string | null;
  onOpenCreateModal: () => void;
}

type SortOption = 'newest' | 'popular';

export const ForumFilterBar: React.FC<ForumFilterBarProps> = ({
  categoryName,
  onOpenCreateModal,
}) => {
  const [sort, setSort] = useState<SortOption>('newest');
  const [isDropdownHovered, setIsDropdownHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      {/* Tiêu đề + badge danh mục */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: '700', color: FORUM_COLORS.textPrimary, margin: 0 }}>
          Diễn đàn thảo luận
        </h1>
        {categoryName && (
          <span
            style={{
              padding: '3px 12px',
              background: FORUM_COLORS.primaryLighter,
              color: FORUM_COLORS.primaryText,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            {categoryName}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {/* Sort dropdown */}
        <div
          onMouseEnter={() => setIsDropdownHovered(true)}
          onMouseLeave={() => setIsDropdownHovered(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            background: isDropdownHovered ? FORUM_COLORS.subtle : FORUM_COLORS.card,
            border: `1px solid ${FORUM_COLORS.border}`,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          <Filter size={14} color={FORUM_COLORS.textMuted} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            style={{
              appearance: 'none',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 13,
              fontWeight: '500',
              color: FORUM_COLORS.textSecondary,
              cursor: 'pointer',
            }}
          >
            <option value="newest">Mới nhất</option>
            <option value="popular">Nổi bật</option>
          </select>
        </div>

        {/* Đặt câu hỏi */}
        <Button variant="primary" shape="square" onClick={onOpenCreateModal}>
          <Edit3 size={14} />
          Đặt câu hỏi
        </Button>
      </div>
    </div>
  );
};
