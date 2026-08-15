/**
 * ForumSidebar — Sidebar danh mục bên trái trang Forum.
 *
 * Khôi phục kích thước 280px và style từ HomePage.tsx gốc.
 * Danh mục hiển thị phẳng (flat list) trực tiếp từ Backend API.
 */

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
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

  useEffect(() => {
    forumApi.getCategories().then(setCategories);
  }, []);

  const isActive = (id: string | null) => selectedCategoryId === id;

  return (
    <aside style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 20,
          outline: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Search Box */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 12 }} />
          <input
            type="text"
            placeholder="Tìm môn học..."
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 10px 10px 36px',
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              outline: 'none',
              fontSize: 14,
              color: '#334155',
            }}
          />
        </div>

        {/* Tất cả môn học */}
        <div
          onClick={() => onSelectCategory(null)}
          style={{
            padding: '10px 16px',
            background: isActive(null) ? '#EFF6FF' : 'transparent',
            color: isActive(null) ? '#1D4ED8' : '#475569',
            fontWeight: isActive(null) ? '600' : '400',
            borderRadius: 8,
            cursor: 'pointer',
            marginBottom: 16,
            transition: 'all 0.2s',
          }}
        >
          Tất cả môn học
        </div>

        {/* Flat Category List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                color: isActive(cat.id) ? '#1D4ED8' : '#334155',
                background: isActive(cat.id) ? '#EFF6FF' : 'transparent',
                fontWeight: isActive(cat.id) ? '500' : '400',
                fontSize: 14,
                transition: 'all 0.2s',
              }}
            >
              {cat.name}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
