import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Settings, ShieldCheck, Hash } from 'lucide-react';
import { NavLink, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAuthContext } from '../../contexts/auth-context';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../ui/Avatar';
import { CountBadge } from '../ui/CountBadge';
import { NotificationBell } from '../notifications/NotificationBell';
import { useUnreadMessages } from '../../contexts/unread-messages-context';
import { forumApi } from '../../pages/forum/lib/forum.api';
import type { TagResponse } from '../../pages/forum/types/forum.types';

export function Header() {
  const { isLoggedIn, currentUser, isModerator } = useAuth();
  const { totalUnread } = useUnreadMessages();
  const { setDevSession, profile } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [headerSearch, setHeaderSearch] = useState(searchParams.get('q') || '');

  // ── Hashtag autocomplete state ──
  const [tagSuggestions, setTagSuggestions] = useState<TagResponse[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHashtagMode = headerSearch.startsWith('#');

  // Fetch tag suggestions with 250ms debounce
  const fetchSuggestions = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const clean = query.replace(/^#/, '').trim();
    if (!clean) {
      // Show trending when user just typed '#'
      setIsLoadingSuggestions(true);
      forumApi.getTrendingTags(8)
        .then((tags) => { setTagSuggestions(tags); setShowSuggestions(true); })
        .catch(() => setTagSuggestions([]))
        .finally(() => setIsLoadingSuggestions(false));
      return;
    }
    debounceRef.current = setTimeout(() => {
      setIsLoadingSuggestions(true);
      forumApi.searchTags(clean, 8)
        .then((tags) => { setTagSuggestions(tags); setShowSuggestions(true); })
        .catch(() => setTagSuggestions([]))
        .finally(() => setIsLoadingSuggestions(false));
    }, 250);
  }, []);

  // Trigger suggestions whenever input changes in hashtag mode
  useEffect(() => {
    if (isHashtagMode) {
      fetchSuggestions(headerSearch);
    } else {
      setShowSuggestions(false);
      setTagSuggestions([]);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [headerSearch, isHashtagMode, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setActiveSuggestionIdx(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function navigateHashtag(tagName: string) {
    setHeaderSearch('');
    setShowSuggestions(false);
    setActiveSuggestionIdx(-1);
    navigate(`/?hashtag=${encodeURIComponent(tagName.toLowerCase().replace(/^#/, ''))}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // ── Hashtag mode: keyboard nav in dropdown ──
    if (isHashtagMode && showSuggestions && tagSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => Math.min(prev + 1, tagSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => Math.max(prev - 1, -1));
        return;
      }
      if (e.key === 'Enter') {
        if (activeSuggestionIdx >= 0 && tagSuggestions[activeSuggestionIdx]) {
          navigateHashtag(tagSuggestions[activeSuggestionIdx].name);
        } else {
          const clean = headerSearch.replace(/^#/, '').trim();
          if (clean) navigateHashtag(clean);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        setActiveSuggestionIdx(-1);
        return;
      }
    }

    // ── Hashtag mode: Enter without dropdown ──
    if (e.key === 'Enter' && isHashtagMode) {
      const clean = headerSearch.replace(/^#/, '').trim();
      if (clean) navigateHashtag(clean);
      return;
    }

    // ── Normal mode: tìm nhóm ──
    if (e.key === 'Enter' && !isHashtagMode) {
      const q = headerSearch.trim();
      navigate(q ? `/groups?q=${encodeURIComponent(q)}` : '/groups');
    }
  }

  const handleLogout = async () => {
    navigate('/');
    setDevSession(null);
    await supabase.auth.signOut().catch(() => {});
  };

  return (
    <div style={{width: '100%', background: 'white', borderBottom: '1px #E2E8F0 solid', display: 'flex', justifyContent: 'center', zIndex: 1000, position: 'sticky', top: 0}}>
        <div style={{width: '100%', maxWidth: '100%', paddingLeft: 32, paddingRight: 32, height: 64, justifyContent: 'space-between', alignItems: 'center', display: 'flex'}}>

            {/* ── LEFT: Logo + Nav ── */}
            <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 24, display: 'flex'}}>
                <Link to="/" style={{textDecoration: 'none'}}>
                    <div style={{color: '#00236F', fontSize: 20, fontFamily: 'Inter', fontWeight: '700', lineHeight: '28px'}}>StudyTogether</div>
                </Link>
                <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 24, display: 'flex', marginLeft: 16}}>
                    <NavLink to="/" end style={({isActive}) => ({
                        paddingBottom: 4,
                        borderBottom: isActive ? '2px #00236F solid' : '2px transparent solid',
                        justifyContent: 'center', display: 'flex', flexDirection: 'column',
                        color: isActive ? '#00236F' : '#444651',
                        fontSize: 16, fontFamily: 'Inter', fontWeight: isActive ? '600' : '400',
                        lineHeight: '24px', textDecoration: 'none', cursor: 'pointer',
                        transition: 'all 0.2s'
                    })}>
                        Diễn đàn
                    </NavLink>
                    <NavLink to="/groups" style={({isActive}) => ({
                        paddingBottom: 4,
                        borderBottom: isActive ? '2px #00236F solid' : '2px transparent solid',
                        justifyContent: 'center', display: 'flex', flexDirection: 'column',
                        color: isActive ? '#00236F' : '#444651',
                        fontSize: 16, fontFamily: 'Inter', fontWeight: isActive ? '600' : '400',
                        lineHeight: '24px', textDecoration: 'none', cursor: 'pointer',
                        transition: 'all 0.2s'
                    })}>
                        Nhóm học
                    </NavLink>
                    {!isModerator && (
                        <NavLink to="/aim" style={({isActive}) => ({
                            paddingBottom: 4,
                            borderBottom: isActive ? '2px #00236F solid' : '2px transparent solid',
                            justifyContent: 'center', display: 'flex', flexDirection: 'column',
                            color: isActive ? '#00236F' : '#444651',
                            fontSize: 16, fontFamily: 'Inter', fontWeight: isActive ? '600' : '400',
                            lineHeight: '24px', textDecoration: 'none', cursor: 'pointer',
                            transition: 'all 0.2s'
                        })}>
                            Mục tiêu
                        </NavLink>
                    )}
                    <NavLink to="/messages" style={({isActive}) => ({
                        paddingBottom: 4,
                        borderBottom: isActive ? '2px #00236F solid' : '2px transparent solid',
                        justifyContent: 'center', display: 'flex', flexDirection: 'column',
                        color: isActive ? '#00236F' : '#444651',
                        fontSize: 16, fontFamily: 'Inter', fontWeight: isActive ? '600' : '400',
                        lineHeight: '24px', textDecoration: 'none', cursor: 'pointer',
                        transition: 'all 0.2s'
                    })}>
                        <span style={{position: 'relative', display: 'inline-block'}}>
                            Tin nhắn
                            <CountBadge count={totalUnread} style={{top: -6, right: -14}} />
                        </span>
                    </NavLink>
                    {isModerator && (
                        <NavLink to="/forum/moderation" style={({isActive}) => ({
                            paddingBottom: 4,
                            borderBottom: isActive ? '2px #7C3AED solid' : '2px transparent solid',
                            justifyContent: 'center', alignItems: 'center', display: 'flex', flexDirection: 'row', gap: 6,
                            color: isActive ? '#7C3AED' : '#444651',
                            fontSize: 16, fontFamily: 'Inter', fontWeight: isActive ? '600' : '400',
                            lineHeight: '24px', textDecoration: 'none', cursor: 'pointer',
                            transition: 'all 0.2s'
                        })}>
                            {({isActive}) => (
                                <>
                                    <ShieldCheck size={17} color={isActive ? '#7C3AED' : '#444651'} />
                                    Kiểm duyệt
                                </>
                            )}
                        </NavLink>
                    )}
                </div>
            </div>

            {/* ── RIGHT: Search + User ── */}
            <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 24, display: 'flex'}}>

                {/* ── Smart Search Bar ── */}
                <div ref={searchRef} style={{position: 'relative'}}>
                    {/* Input wrapper */}
                    <div style={{
                        width: 280,
                        paddingTop: 9, paddingBottom: 10,
                        paddingLeft: 40, paddingRight: isHashtagMode ? 52 : 12,
                        background: isHashtagMode ? '#EFF6FF' : '#F8F9FF',
                        borderRadius: 6,
                        outline: isHashtagMode ? '1.5px #3B82F6 solid' : '1px #E2E8F0 solid',
                        outlineOffset: '-1px',
                        display: 'flex',
                        transition: 'background 0.2s, outline 0.2s',
                        boxSizing: 'border-box',
                    }}>
                        <input
                            type="text"
                            id="header-search-input"
                            placeholder={isHashtagMode ? 'Tìm hashtag bài viết...' : 'Tìm nhóm... hoặc #hashtag'}
                            value={headerSearch}
                            onChange={(e) => { setHeaderSearch(e.target.value); setActiveSuggestionIdx(-1); }}
                            onKeyDown={handleKeyDown}
                            onFocus={() => { if (isHashtagMode) fetchSuggestions(headerSearch); }}
                            style={{
                                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                                color: isHashtagMode ? '#1D4ED8' : '#374151',
                                fontSize: 14, fontFamily: 'Inter', fontWeight: '400',
                            }}
                        />
                    </div>

                    {/* Left icon: Hash or Search */}
                    <div style={{left: 12, top: '50%', transform: 'translateY(-50%)', position: 'absolute', display: 'flex', alignItems: 'center', pointerEvents: 'none'}}>
                        {isHashtagMode
                            ? <Hash size={17} color="#3B82F6" />
                            : <Search size={17} color="#9CA3AF" />
                        }
                    </div>

                    {/* Right badge: FORUM */}
                    {isHashtagMode && (
                        <div style={{
                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                            background: '#DBEAFE', color: '#1D4ED8', fontSize: 9, fontWeight: 700,
                            padding: '2px 5px', borderRadius: 3, fontFamily: 'Inter', letterSpacing: 0.5,
                            pointerEvents: 'none',
                        }}>
                            FORUM
                        </div>
                    )}

                    {/* ── Autocomplete Dropdown ── */}
                    {showSuggestions && (
                        <div style={{
                            position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                            width: 320, background: 'white', borderRadius: 12,
                            border: '1px solid #E2E8F0',
                            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)',
                            overflow: 'hidden', zIndex: 9999,
                        }}>
                            {/* Dropdown header */}
                            <div style={{
                                padding: '9px 14px', fontSize: 11, fontWeight: 700,
                                color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6,
                                borderBottom: '1px solid #F1F5F9', background: '#F8FAFC',
                                fontFamily: 'Inter',
                            }}>
                                {headerSearch.replace(/^#/, '').trim()
                                    ? `Gợi ý cho "${headerSearch}"`
                                    : 'Hashtag nổi bật'
                                }
                            </div>

                            {/* Loading skeleton */}
                            {isLoadingSuggestions && (
                                <div style={{padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8}}>
                                    {[1,2,3].map(i => (
                                        <div key={i} style={{
                                            height: 32, background: '#F1F5F9', borderRadius: 6,
                                            animation: 'pulse 1.5s ease-in-out infinite',
                                        }} />
                                    ))}
                                </div>
                            )}

                            {/* Empty state */}
                            {!isLoadingSuggestions && tagSuggestions.length === 0 && (
                                <div style={{padding: '16px 14px', fontSize: 13, color: '#94A3B8', fontFamily: 'Inter', textAlign: 'center'}}>
                                    Không tìm thấy hashtag phù hợp<br/>
                                    <span style={{fontSize: 12}}>Nhấn Enter để tìm bất kỳ</span>
                                </div>
                            )}

                            {/* Tag list */}
                            {!isLoadingSuggestions && tagSuggestions.map((tag, idx) => {
                                const isActive = idx === activeSuggestionIdx;
                                return (
                                    <div
                                        key={tag.id}
                                        onMouseDown={(e) => { e.preventDefault(); navigateHashtag(tag.name); }}
                                        onMouseEnter={() => setActiveSuggestionIdx(idx)}
                                        style={{
                                            padding: '10px 14px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            cursor: 'pointer',
                                            background: isActive ? '#EFF6FF' : 'white',
                                            transition: 'background 0.1s',
                                            borderBottom: idx < tagSuggestions.length - 1 ? '1px solid #F8FAFC' : 'none',
                                        }}
                                    >
                                        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                                            <div style={{
                                                width: 28, height: 28, borderRadius: 6,
                                                background: isActive ? '#DBEAFE' : '#F1F5F9',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0, transition: 'background 0.1s',
                                            }}>
                                                <Hash size={13} color={isActive ? '#2563EB' : '#64748B'} />
                                            </div>
                                            <span style={{
                                                fontSize: 14, fontWeight: isActive ? 600 : 500,
                                                color: isActive ? '#1D4ED8' : '#334155',
                                                fontFamily: 'Inter',
                                            }}>
                                                {tag.name}
                                            </span>
                                        </div>
                                        <span style={{
                                            fontSize: 12, color: '#94A3B8', fontFamily: 'Inter',
                                            background: '#F8FAFC', padding: '2px 8px', borderRadius: 99,
                                        }}>
                                            {tag.post_count} bài
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Keyboard hint footer */}
                            <div style={{
                                padding: '6px 14px', fontSize: 11, color: '#94A3B8',
                                borderTop: '1px solid #F1F5F9', background: '#F8FAFC',
                                fontFamily: 'Inter', display: 'flex', gap: 16, alignItems: 'center',
                            }}>
                                <span>↑↓ chọn</span>
                                <span>⏎ tìm</span>
                                <span>Esc đóng</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── User controls ── */}
                {isLoggedIn ? (
                  <>
                    <NotificationBell />
                    <Link to="/settings" aria-label="Cài đặt tài khoản" style={{display: 'flex', alignItems: 'center', color: '#00236F'}}>
                        <Settings size={21} strokeWidth={2.4} />
                    </Link>
                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                        <Link to="/settings" aria-label="Trang cài đặt">
                          <Avatar name={currentUser.name} src={profile?.avatarUrl} size="sm" style={{ cursor: 'pointer' }} />
                        </Link>
                        <div
                          onClick={handleLogout}
                          style={{color: '#EF4444', fontSize: 14, fontWeight: '600', cursor: 'pointer'}}
                        >
                          Đăng xuất
                        </div>
                    </div>
                  </>
                ) : (
                  <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <NavLink to="/login" style={{color: '#0F172A', fontSize: 14, fontWeight: '600', textDecoration: 'none'}}>Đăng nhập</NavLink>
                    <NavLink to="/register" style={{padding: '8px 16px', background: '#00236F', color: 'white', fontSize: 14, fontWeight: '600', borderRadius: 8, textDecoration: 'none'}}>Đăng ký</NavLink>
                  </div>
                )}
            </div>
        </div>
    </div>
  );
}
