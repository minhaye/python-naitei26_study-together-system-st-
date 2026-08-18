/**
 * ForumSidebar — Sidebar danh mục bên trái trang Forum.
 *
 * Giao diện dạng phẳng (Flat list, không Accordion, không Icon), width 280px chuẩn style ban đầu.
 * Tích hợp ô tìm kiếm thông minh kiểu Google: Click gợi ý -> Tự chọn -> Scroll Into View & Highlight xanh.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { forumApi } from '../lib/forum.api';
import type { ForumCategoryResponse } from '../types/forum.types';

interface ForumSidebarProps {
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null, name?: string | null) => void;
  onSearchChange: (search: string) => void;
}

export const ForumSidebar: React.FC<ForumSidebarProps> = ({
  selectedCategoryId,
  onSelectCategory,
  onSearchChange,
}) => {
  const [categories, setCategories] = useState<ForumCategoryResponse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  // Lấy danh mục từ Backend API
  useEffect(() => {
    forumApi.getCategories().then((apiCats) => {
      setCategories(apiCats);
    });
  }, []);

  // Đóng dropdown tìm kiếm khi click ra ngoài ô Search Box
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Danh sách gợi ý tìm kiếm (Google Search Suggestions)
  const suggestions = searchQuery.trim()
    ? categories.filter((cat) => cat.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : [];

  // Khi click chọn 1 gợi ý từ dropdown Google
  const handleSelectSuggestion = (catId: string, catName: string) => {
    setSearchQuery(catName);
    onSearchChange(catName);
    setShowSuggestions(false);
    onSelectCategory(catId, catName);

    // Tự động cuộn mượt (Scroll Into View) & Highlight xanh trong 2s
    setTimeout(() => {
      const el = itemRefs.current[catId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedId(catId);
        setTimeout(() => setHighlightedId(null), 2000);
      }
    }, 100);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    onSearchChange(val);
    setShowSuggestions(val.trim().length > 0);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    onSearchChange('');
    setShowSuggestions(false);
  };

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
        {/* Search Box với Gợi ý tìm kiếm (Search Suggestions kiểu Google) */}
        <div ref={searchBoxRef} style={{ position: 'relative', marginBottom: 20 }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => searchQuery.trim().length > 0 && setShowSuggestions(true)}
              placeholder="Tìm môn học..."
              style={{
                width: '100%',
                padding: '10px 36px 10px 36px',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                outline: 'none',
                fontSize: 14,
                color: '#334155',
                fontWeight: '500',
              }}
            />
            {searchQuery && (
              <X
                size={16}
                color="#64748B"
                style={{ position: 'absolute', right: 12, cursor: 'pointer' }}
                onClick={handleClearSearch}
              />
            )}
          </div>

          {/* Search Suggestions Dropdown kiểu Google */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 6,
                background: 'white',
                border: '1px solid #CBD5E1',
                borderRadius: 10,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                zIndex: 99,
                maxHeight: 240,
                overflowY: 'auto',
                padding: '6px 0',
              }}
            >
              <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: '0.05em' }}>
                GỢI Ý TÌM KIẾM
              </div>
              {suggestions.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => handleSelectSuggestion(cat.id, cat.name)}
                  style={{
                    padding: '9px 14px',
                    fontSize: 13,
                    color: '#1E293B',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'background 0.15s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#EFF6FF')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontWeight: '500', color: '#1D4ED8' }}>{cat.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lựa chọn: Tất cả môn học */}
        <div
          onClick={() => {
            onSelectCategory(null, null);
            handleClearSearch();
          }}
          style={{
            padding: '10px 16px',
            background: isActive(null) ? '#EFF6FF' : 'transparent',
            color: isActive(null) ? '#1D4ED8' : '#475569',
            fontWeight: isActive(null) ? '600' : '500',
            borderRadius: 8,
            cursor: 'pointer',
            marginBottom: 16,
            fontSize: 14,
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            if (!isActive(null)) e.currentTarget.style.background = '#F8FAFC';
          }}
          onMouseOut={(e) => {
            if (!isActive(null)) e.currentTarget.style.background = 'transparent';
          }}
        >
          Tất cả môn học
        </div>

        {/* Danh sách danh mục dạng phẳng (Flat Category List - Không Accordion, Không Icon) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {categories.map((cat) => {
            const selected = isActive(cat.id);
            const isHighlighted = highlightedId === cat.id;

            return (
              <div
                key={cat.id}
                ref={(el) => {
                  itemRefs.current[cat.id] = el;
                }}
                onClick={() => onSelectCategory(cat.id, cat.name)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: selected ? '600' : '400',
                  color: selected ? '#1D4ED8' : '#334155',
                  background: selected
                    ? '#EFF6FF'
                    : isHighlighted
                    ? '#DBEAFE'
                    : 'transparent',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  if (!selected && !isHighlighted) e.currentTarget.style.background = '#F8FAFC';
                }}
                onMouseOut={(e) => {
                  if (!selected && !isHighlighted) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ flex: 1, lineHeight: 1.3 }}>{cat.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
