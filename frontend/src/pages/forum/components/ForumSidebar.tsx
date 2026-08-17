/**
 * ForumSidebar — Sidebar danh mục bên trái trang Forum.
 *
 * Tích hợp:
 *   1. Danh mục phân cấp Accordion từng ngành riêng (THCS & THPT lên top 1, 2; tiếp theo là CNTT, Kinh tế, Ngoại ngữ...)
 *   2. Ô tìm kiếm thông minh kèm Search Suggestions kiểu Google
 *   3. Click vào gợi ý: Tự động điền ➔ Tự động mở bung Accordion ➔ Tự động cuộn mượt (Scroll Into View) & Highlight xanh!
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  X,
  School,
  Building,
  Laptop,
  TrendingUp,
  Globe,
  Calculator,
  BookOpen,
  HeartPulse,
} from 'lucide-react';

interface CategoryGroup {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: { id: string; name: string }[];
}

// Cấu trúc danh mục Accordion từng ngành riêng biệt (THCS & THPT ở top đầu)
const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'thcs',
    title: 'THCS (Trung học Cơ sở)',
    icon: <School size={16} color="#2563EB" />,
    items: [
      { id: 'thcs-toan', name: 'Toán học THCS (Lớp 6-9)' },
      { id: 'thcs-van', name: 'Ngữ văn THCS' },
      { id: 'thcs-anh', name: 'Tiếng Anh THCS' },
      { id: 'thcs-ly', name: 'Vật lý THCS' },
      { id: 'thcs-hoa', name: 'Hóa học THCS' },
      { id: 'thcs-sinh', name: 'Sinh học THCS' },
      { id: 'thcs-su-dia', name: 'Lịch sử & Địa lý THCS' },
    ],
  },
  {
    id: 'thpt',
    title: 'THPT (Trung học Phổ thông)',
    icon: <Building size={16} color="#4F46E5" />,
    items: [
      { id: 'thpt-toan', name: 'Toán 12 & Ôn thi ĐH' },
      { id: 'thpt-van', name: 'Ngữ văn THPT' },
      { id: 'thpt-anh', name: 'Tiếng Anh THPT' },
      { id: 'thpt-ly', name: 'Vật lý THPT' },
      { id: 'thpt-hoa', name: 'Hóa học THPT' },
      { id: 'thpt-sinh', name: 'Sinh học THPT' },
      { id: 'thpt-su', name: 'Lịch sử THPT' },
      { id: 'thpt-dia', name: 'Địa lý THPT' },
    ],
  },
  {
    id: 'it',
    title: 'CNTT & Lập trình (IT)',
    icon: <Laptop size={16} color="#0D9488" />,
    items: [
      { id: 'it-ctdl', name: 'Cấu trúc dữ liệu & Giải thuật' },
      { id: 'it-web', name: 'Lập trình Web & Mobile' },
      { id: 'it-csdl', name: 'Cơ sở dữ liệu & SQL' },
      { id: 'it-mang', name: 'Mạng máy tính & An toàn thông tin' },
      { id: 'it-hdh', name: 'Hệ điều hành & Linux' },
      { id: 'it-ai', name: 'Trí tuệ nhân tạo (AI & Machine Learning)' },
    ],
  },
  {
    id: 'kinhte',
    title: 'Kinh tế & Quản trị',
    icon: <TrendingUp size={16} color="#D97706" />,
    items: [
      { id: 'kt-vimo', name: 'Kinh tế vi mô & Vĩ mô' },
      { id: 'kt-taichinh', name: 'Tài chính doanh nghiệp' },
      { id: 'kt-mkt', name: 'Marketing & Truyền thông' },
      { id: 'kt-ketoan', name: 'Kế toán & Kiểm toán' },
      { id: 'kt-quantri', name: 'Quản trị kinh doanh' },
    ],
  },
  {
    id: 'ngoaigu',
    title: 'Ngoại ngữ & Chứng chỉ',
    icon: <Globe size={16} color="#059669" />,
    items: [
      { id: 'nn-ielts', name: 'Luyện thi IELTS (Academic / General)' },
      { id: 'nn-toeic', name: 'Luyện thi TOEIC' },
      { id: 'nn-trung', name: 'Tiếng Trung (HSK)' },
      { id: 'nn-nhat', name: 'Tiếng Nhật (JLPT)' },
      { id: 'nn-han', name: 'Tiếng Hàn (TOPIK)' },
    ],
  },
  {
    id: 'toan-caocap',
    title: 'Toán cao cấp & Đại số',
    icon: <Calculator size={16} color="#7C3AED" />,
    items: [
      { id: 'tcc-giaitich', name: 'Giải tích 1, 2 & 3' },
      { id: 'tcc-daiso', name: 'Đại số tuyến tính' },
      { id: 'tcc-xacsuat', name: 'Xác suất thống kê' },
      { id: 'tcc-toanroirac', name: 'Toán rời rạc & Đồ thị' },
    ],
  },
  {
    id: 'triethoc',
    title: 'Triết học & Lý luận',
    icon: <BookOpen size={16} color="#DC2626" />,
    items: [
      { id: 'th-maclenin', name: 'Triết học Mác - Lênin' },
      { id: 'th-tutuong', name: 'Tư tưởng Hồ Chí Minh' },
      { id: 'th-kinhte', name: 'Kinh tế chính trị Mác - Lênin' },
      { id: 'th-chunaixahoi', name: 'Chủ nghĩa xã hội khoa học' },
    ],
  },
  {
    id: 'yduoc',
    title: 'Y Dược & Sức khỏe',
    icon: <HeartPulse size={16} color="#E11D48" />,
    items: [
      { id: 'yd-giaiphau', name: 'Giải phẫu học & Sinh lý học' },
      { id: 'yd-duocly', name: 'Dược lý học & Dược lâm sàng' },
      { id: 'yd-hoasinh', name: 'Hóa sinh y học' },
    ],
  },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    thcs: true,
    thpt: true,
    it: true,
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  // Đóng Search Suggestions khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Chuyển đổi trạng thái đóng/mở Accordion
  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Tính danh sách gợi ý tìm kiếm (Search Suggestions kiểu Google)
  const suggestions: { groupId: string; groupTitle: string; itemId?: string; itemName: string }[] = [];
  if (searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase().trim();
    CATEGORY_GROUPS.forEach((group) => {
      // Khớp tên nhóm Accordion
      if (group.title.toLowerCase().includes(q)) {
        suggestions.push({
          groupId: group.id,
          groupTitle: group.title,
          itemName: `Tất cả thuộc ${group.title}`,
        });
      }
      // Khớp từng môn học bên trong
      group.items.forEach((item) => {
        if (item.name.toLowerCase().includes(q)) {
          suggestions.push({
            groupId: group.id,
            groupTitle: group.title,
            itemId: item.id,
            itemName: item.name,
          });
        }
      });
    });
  }

  // Khi click chọn 1 gợi ý từ Dropdown kiểu Google
  const handleSelectSuggestion = (groupId: string, itemId?: string, itemName?: string) => {
    const term = itemName || '';
    setSearchQuery(term);
    onSearchChange(term);
    setShowSuggestions(false);

    // 1. Tự động mở bung Accordion tương ứng
    setExpandedGroups((prev) => ({ ...prev, [groupId]: true }));

    // 2. Chọn category id nếu có
    if (itemId) {
      onSelectCategory(itemId);
    }

    // 3. Tự động cuộn mượt (Scroll Into View) & Highlight xanh trong 2s
    const targetId = itemId || groupId;
    setTimeout(() => {
      const el = itemRefs.current[targetId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedId(targetId);
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
    <aside style={{ width: 'clamp(220px, 18vw, 290px)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 18,
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        }}
      >
        {/* Search Box với Dropdown Search Suggestions kiểu Google */}
        <div ref={searchBoxRef} style={{ position: 'relative', marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: 10,
              padding: '8px 12px',
              gap: 8,
              transition: 'border 0.2s, box-shadow 0.2s',
            }}
          >
            <Search size={16} color="#64748B" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => searchQuery.trim().length > 0 && setShowSuggestions(true)}
              placeholder="Tìm môn học hoặc ngành..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: '#0F172A',
                fontWeight: '500',
              }}
            />
            {searchQuery && (
              <X
                size={16}
                color="#64748B"
                style={{ cursor: 'pointer', flexShrink: 0 }}
                onClick={handleClearSearch}
              />
            )}
          </div>

          {/* Search Suggestions Dropdown (Gợi ý kiểu Google) */}
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
                borderRadius: 12,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                zIndex: 99,
                maxHeight: 280,
                overflowY: 'auto',
                padding: '6px 0',
              }}
            >
              <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: '0.05em' }}>
                GỢI Ý TÌM KIẾM
              </div>
              {suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectSuggestion(sug.groupId, sug.itemId, sug.itemName)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 13,
                    color: '#1E293B',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    borderBottom: idx < suggestions.length - 1 ? '1px solid #F1F5F9' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#EFF6FF')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontWeight: '600', color: '#1D4ED8' }}>{sug.itemName}</span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>Thuộc nhóm {sug.groupTitle}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nút "Tất cả môn học" */}
        <div
          onClick={() => {
            onSelectCategory(null);
            handleClearSearch();
          }}
          style={{
            padding: '10px 14px',
            background: isActive(null) ? '#1D4ED8' : 'transparent',
            color: isActive(null) ? 'white' : '#334155',
            fontWeight: isActive(null) ? '600' : '500',
            borderRadius: 10,
            cursor: 'pointer',
            marginBottom: 16,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
          onMouseOver={(e) => {
            if (!isActive(null)) e.currentTarget.style.background = '#F1F5F9';
          }}
          onMouseOut={(e) => {
            if (!isActive(null)) e.currentTarget.style.background = 'transparent';
          }}
        >

          Tất cả môn học
        </div>

        {/* Accordion Categories List (Phân cấp theo từng ngành lớn) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CATEGORY_GROUPS.map((group) => {
            const isExpanded = !!expandedGroups[group.id];

            return (
              <div
                key={group.id}
                ref={(el) => { itemRefs.current[group.id] = el; }}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: highlightedId === group.id ? '#DBEAFE' : '#F8FAFC',
                  transition: 'background 0.3s ease',
                }}
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleGroup(group.id)}
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: isExpanded ? '#FFFFFF' : '#F8FAFC',
                    borderBottom: isExpanded ? '1px solid #E2E8F0' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {group.icon}
                    <span style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{group.title}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={16} color="#64748B" />
                  ) : (
                    <ChevronRight size={16} color="#64748B" />
                  )}
                </div>

                {/* Accordion Items Body */}
                {isExpanded && (
                  <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3, background: 'white' }}>
                    {group.items.map((item) => {
                      const selected = isActive(item.id);
                      const isItemHighlighted = highlightedId === item.id;

                      return (
                        <div
                          key={item.id}
                          ref={(el) => { itemRefs.current[item.id] = el; }}
                          onClick={() => onSelectCategory(item.id)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: selected ? '600' : '400',
                            color: selected ? '#1D4ED8' : '#334155',
                            background: selected
                              ? '#EFF6FF'
                              : isItemHighlighted
                              ? '#BFDBFE'
                              : 'transparent',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          onMouseOver={(e) => {
                            if (!selected && !isItemHighlighted) e.currentTarget.style.background = '#F1F5F9';
                          }}
                          onMouseOut={(e) => {
                            if (!selected && !isItemHighlighted) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: selected ? '#1D4ED8' : '#94A3B8',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ flex: 1, lineHeight: 1.3 }}>{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
