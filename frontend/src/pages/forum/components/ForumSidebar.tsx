import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, X, Hash, Code, LineChart, Megaphone, 
  Calculator, FlaskConical, Languages, Stethoscope, 
  Scale, BookOpen, Lightbulb, PenTool, GraduationCap, 
  School, HeartPulse, Briefcase, Smile, MessageCircle,
  LayoutGrid
} from 'lucide-react';
import { forumApi } from '../lib/forum.api';
import type { ForumCategoryResponse } from '../types/forum.types';

interface ForumSidebarProps {
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null, name?: string | null) => void;
  onSearchChange?: (search: string) => void;
}

// Hàm trợ giúp để gán icon cho từng chuyên mục dựa trên tên
const getCategoryIcon = (name: string, isActive: boolean) => {
  const color = isActive ? '#1D4ED8' : '#64748B';
  const size = 18;
  const n = name.toLowerCase();

  if (n.includes('công nghệ') || n.includes('it')) return <Code size={size} color={color} />;
  if (n.includes('kinh tế') || n.includes('tài chính')) return <LineChart size={size} color={color} />;
  if (n.includes('quản trị') || n.includes('marketing')) return <Megaphone size={size} color={color} />;
  if (n.includes('toán')) return <Calculator size={size} color={color} />;
  if (n.includes('tự nhiên') || n.includes('hoá') || n.includes('sinh')) return <FlaskConical size={size} color={color} />;
  if (n.includes('ngoại ngữ')) return <Languages size={size} color={color} />;
  if (n.includes('y khoa') || n.includes('dược')) return <Stethoscope size={size} color={color} />;
  if (n.includes('luật')) return <Scale size={size} color={color} />;
  if (n.includes('xã hội') || n.includes('nhân văn')) return <BookOpen size={size} color={color} />;
  if (n.includes('triết')) return <Lightbulb size={size} color={color} />;
  if (n.includes('kiến trúc') || n.includes('thiết kế')) return <PenTool size={size} color={color} />;
  if (n.includes('thpt') || n.includes('đại học')) return <GraduationCap size={size} color={color} />;
  if (n.includes('thcs')) return <School size={size} color={color} />;
  if (n.includes('sức khỏe')) return <HeartPulse size={size} color={color} />;
  if (n.includes('kỹ năng') || n.includes('nghề nghiệp')) return <Briefcase size={size} color={color} />;
  if (n.includes('thư giãn')) return <Smile size={size} color={color} />;
  if (n.includes('hỏi đáp')) return <MessageCircle size={size} color={color} />;
  
  return <Hash size={size} color={color} />;
};

export const ForumSidebar: React.FC<ForumSidebarProps> = ({
  selectedCategoryId,
  onSelectCategory,
}) => {
  const [categories, setCategories] = useState<ForumCategoryResponse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    forumApi.getCategories().then((apiCats) => {
      const sortedCats = [...apiCats].sort((a, b) => {
        if (a.name === 'Hỏi đáp chung') return 1;
        if (b.name === 'Hỏi đáp chung') return -1;
        return 0;
      });
      setCategories(sortedCats);
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suggestions = searchQuery.trim()
    ? categories.filter((cat) => cat.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : [];

  const handleSelectSuggestion = (catId: string, catName: string) => {
    setSearchQuery(catName);
    setShowSuggestions(false);
    onSelectCategory(catId, catName);

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
    setShowSuggestions(val.trim().length > 0);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const isActive = (id: string | null) => selectedCategoryId === id;

  // Custom CSS scrollbar chèn trực tiếp qua style (có thể cần bỏ vào App.css nếu muốn đồng bộ)
  return (
    <aside style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 16,
          outline: '1px solid #E2E8F0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 120px)', // Giới hạn chiều cao tổng để không bị lố màn hình
        }}
      >
        {/* Header & Search */}
        <div style={{ flexShrink: 0, marginBottom: 16 }}>
          <div ref={searchBoxRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={() => searchQuery.trim().length > 0 && setShowSuggestions(true)}
                placeholder="Tìm môn học..."
                style={{
                  width: '100%',
                  padding: '10px 36px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  outline: 'none',
                  fontSize: 14,
                  color: '#334155',
                  transition: 'border-color 0.2s',
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

            {/* Gợi ý */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 8,
                  background: 'white',
                  border: '1px solid #CBD5E1',
                  borderRadius: 10,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  zIndex: 99,
                  maxHeight: 240,
                  overflowY: 'auto',
                  padding: '6px 0',
                }}
              >
                <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: '700', color: '#94A3B8' }}>GỢI Ý</div>
                {suggestions.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => handleSelectSuggestion(cat.id, cat.name)}
                    style={{
                      padding: '8px 14px',
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
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
        </div>

        {/* Scrollable List Container */}
        <div 
          className="forum-sidebar-scroll"
          style={{ 
            overflowY: 'auto', 
            paddingRight: 4,
            display: 'flex', 
            flexDirection: 'column', 
            gap: 4 
          }}
        >
          {/* Nút Tất cả */}
          <div
            onClick={() => {
              onSelectCategory(null, null);
              handleClearSearch();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              background: isActive(null) ? '#EFF6FF' : 'transparent',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: 8,
            }}
            onMouseOver={(e) => { if (!isActive(null)) e.currentTarget.style.background = '#F8FAFC'; }}
            onMouseOut={(e) => { if (!isActive(null)) e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isActive(null) ? '#DBEAFE' : '#F1F5F9'
            }}>
              <LayoutGrid size={16} color={isActive(null) ? '#1D4ED8' : '#64748B'} />
            </div>
            <span style={{ 
              fontWeight: isActive(null) ? '600' : '500', 
              color: isActive(null) ? '#1D4ED8' : '#334155',
              fontSize: 14 
            }}>
              Tất cả danh mục
            </span>
          </div>

          {/* Danh mục */}
          {categories.map((cat) => {
            const selected = isActive(cat.id);
            const isHighlighted = highlightedId === cat.id;

            return (
              <div
                key={cat.id}
                ref={(el) => { itemRefs.current[cat.id] = el; }}
                onClick={() => onSelectCategory(cat.id, cat.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: selected ? '#EFF6FF' : isHighlighted ? '#DBEAFE' : 'transparent',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => { if (!selected && !isHighlighted) e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseOut={(e) => { if (!selected && !isHighlighted) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: selected ? '#DBEAFE' : '#F8FAFC'
                }}>
                  {getCategoryIcon(cat.name, selected)}
                </div>
                <span style={{ 
                  flex: 1, lineHeight: 1.3, fontSize: 13,
                  fontWeight: selected ? '600' : '500', 
                  color: selected ? '#1D4ED8' : '#475569' 
                }}>
                  {cat.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

