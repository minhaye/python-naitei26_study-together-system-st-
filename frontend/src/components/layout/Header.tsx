import { useState } from 'react';
import { Search, Settings, ShieldCheck } from 'lucide-react';
import { NavLink, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAuthContext } from '../../contexts/auth-context';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../ui/Avatar';
import { CountBadge } from '../ui/CountBadge';
import { NotificationBell } from '../notifications/NotificationBell';
import { useUnreadMessages } from '../../contexts/unread-messages-context';

export function Header() {
  const { isLoggedIn, currentUser, isModerator } = useAuth();
  const { totalUnread } = useUnreadMessages();
  const { setDevSession, profile } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [headerSearch, setHeaderSearch] = useState(searchParams.get('q') || '');

  const handleLogout = async () => {
    setDevSession(null);
    await supabase.auth.signOut().catch(() => {});
    navigate('/');
  };

  return (
    <div style={{width: '100%', background: 'white', borderBottom: '1px #E2E8F0 solid', display: 'flex', justifyContent: 'center', zIndex: 1000, position: 'sticky', top: 0}}>
        <div style={{width: '100%', maxWidth: '100%', paddingLeft: 32, paddingRight: 32, height: 64, justifyContent: 'space-between', alignItems: 'center', display: 'flex'}}>
            <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 24, display: 'flex'}}>
                <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                    <Link to="/" style={{textDecoration: 'none'}}>
                        <div style={{justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#00236F', fontSize: 20, fontFamily: 'Inter', fontWeight: '700', lineHeight: '28px'}}>StudyTogether</div>
                    </Link>
                </div>
                <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 24, display: 'flex', marginLeft: 16}}>
                    <NavLink to="/" style={({isActive}) => ({
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
            <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 24, display: 'flex'}}>
                <div style={{position: 'relative', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                    <div style={{width: 256, paddingTop: 9, paddingBottom: 10, paddingLeft: 40, paddingRight: 16, background: '#F8F9FF', borderRadius: 6, outline: '1px #E2E8F0 solid', outlineOffset: '-1px', display: 'flex'}}>
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm nhóm..." 
                            value={headerSearch}
                            onChange={(e) => setHeaderSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const q = headerSearch.trim();
                                    if (q) {
                                        navigate(`/groups?q=${encodeURIComponent(q)}`);
                                    } else {
                                        navigate(`/groups`);
                                    }
                                }
                            }}
                            style={{width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#6B7280', fontSize: 14, fontFamily: 'Inter', fontWeight: '400'}} 
                        />
                    </div>
                    <div style={{left: 12, top: 9, position: 'absolute', display: 'flex', alignItems: 'center'}}>
                        <Search size={18} color="#757682" />
                    </div>
                </div>
                
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
