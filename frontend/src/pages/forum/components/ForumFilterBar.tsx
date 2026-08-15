/**
 * ForumFilterBar — Thanh filter + nút "Đặt câu hỏi" ở đầu trang Forum.
 *
 * Khôi phục 100% kích thước font, padding và style từ HomePage.tsx gốc.
 */

import React from 'react';
import { Filter, ChevronDown, Edit3 } from 'lucide-react';

interface ForumFilterBarProps {
  categoryName: string | null;
  onOpenCreateModal: () => void;
}

export const ForumFilterBar: React.FC<ForumFilterBarProps> = ({
  categoryName,
  onOpenCreateModal,
}) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: '700', color: '#0F172A', margin: 0 }}>
          Diễn đàn thảo luận
        </h1>
        <div style={{ padding: '4px 12px', background: '#DBEAFE', color: '#1E40AF', borderRadius: 999, fontSize: 12, fontWeight: '600' }}>
          {categoryName || 'Tất cả'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div
          onClick={() => alert('Bộ lọc "Mới nhất" đã được chọn!')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            cursor: 'pointer',
            color: '#475569',
            fontSize: 14,
            fontWeight: '500',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'white')}
        >
          <Filter size={16} />
          Mới nhất
          <ChevronDown size={16} />
        </div>
        <button
          onClick={onOpenCreateModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            background: '#00236F',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            color: 'white',
            fontSize: 14,
            fontWeight: '600',
          }}
        >
          <Edit3 size={16} />
          Đặt câu hỏi
        </button>
      </div>
    </div>
  );
};
