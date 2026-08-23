/**
 * ForumFilterBar — Thanh filter 4 tùy chọn + nút "Đặt câu hỏi" ở đầu trang Forum.
 *
 * Tùy chọn lọc:
 *   1. Mới nhất (Latest)
 *   2. Chưa trả lời (Unanswered)
 *   3. Câu hỏi hay (Popular)
 *   4. Câu hỏi của tôi (My Questions)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown, Edit3, Check, X } from 'lucide-react';

export type FilterOption = 'latest' | 'my_questions';

export const FILTER_LABELS: Record<FilterOption, string> = {
  latest: 'Mới nhất',
  my_questions: 'Câu hỏi của tôi',
};

interface ForumFilterBarProps {
  categoryName: string | null;
  selectedTag?: string | null;
  onClearTag?: () => void;
  selectedFilter: FilterOption;
  onSelectFilter: (filter: FilterOption) => void;
  onOpenCreateModal: () => void;
  /** True when the current user is under an active 'post' restriction -- dims the "Đặt câu
   * hỏi" button and prevents opening the composer instead of letting them find out on submit. */
  createDisabled?: boolean;
}

export const ForumFilterBar: React.FC<ForumFilterBarProps> = ({
  categoryName,
  selectedTag,
  onClearTag,
  selectedFilter,
  onSelectFilter,
  onOpenCreateModal,
  createDisabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Thao tác click bên ngoài để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options: FilterOption[] = ['latest', 'my_questions'];

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: '700', color: '#0F172A', margin: 0 }}>
          Diễn đàn thảo luận
        </h1>
        <div style={{ padding: '4px 12px', background: '#DBEAFE', color: '#1E40AF', borderRadius: 999, fontSize: 12, fontWeight: '600' }}>
          {categoryName || 'Tất cả'}
        </div>
        {selectedTag && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: '#EFF6FF',
              color: '#2563EB',
              border: '1px solid #BFDBFE',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            <span>🏷️ #{selectedTag}</span>
            {onClearTag && (
              <X
                size={14}
                style={{ cursor: 'pointer' }}
                onClick={onClearTag}
              />
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
        {/* Dropdown Filter Box */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setIsOpen((prev) => !prev)}
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
              userSelect: 'none',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'white')}
          >
            <Filter size={16} />
            <span>{FILTER_LABELS[selectedFilter]}</span>
            <ChevronDown size={16} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
          </div>

          {/* Menu Dropdown Popup */}
          {isOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                width: 180,
                background: 'white',
                borderRadius: 10,
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                padding: '6px 0',
                zIndex: 50,
              }}
            >
              {options.map((option) => {
                const isSelected = selectedFilter === option;
                return (
                  <div
                    key={option}
                    onClick={() => {
                      onSelectFilter(option);
                      setIsOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      fontSize: 14,
                      color: isSelected ? '#1D4ED8' : '#334155',
                      fontWeight: isSelected ? '600' : '400',
                      background: isSelected ? '#EFF6FF' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                    }}
                    onMouseOut={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>{FILTER_LABELS[option]}</span>
                    {isSelected && <Check size={16} color="#1D4ED8" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Nút Đặt câu hỏi */}
        <button
          onClick={onOpenCreateModal}
          disabled={createDisabled}
          title={createDisabled ? 'Bạn đang bị hạn chế đăng bài' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            background: '#00236F',
            border: 'none',
            borderRadius: 8,
            cursor: createDisabled ? 'not-allowed' : 'pointer',
            color: 'white',
            fontSize: 14,
            fontWeight: '600',
            opacity: createDisabled ? 0.5 : 1,
          }}
        >
          <Edit3 size={16} />
          Đặt câu hỏi
        </button>
      </div>
    </div>
  );
};
