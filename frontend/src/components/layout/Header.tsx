import { Search, Bell } from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';

export function Header() {
  return (
    <div style={{width: '100%', background: 'white', borderBottom: '1px #E2E8F0 solid', display: 'flex', justifyContent: 'center', zIndex: 10, position: 'sticky', top: 0}}>
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
                </div>
            </div>
            <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 24, display: 'flex'}}>
                <div style={{position: 'relative', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                    <div style={{width: 256, paddingTop: 9, paddingBottom: 10, paddingLeft: 40, paddingRight: 16, background: '#F8F9FF', borderRadius: 6, outline: '1px #E2E8F0 solid', outlineOffset: '-1px', display: 'flex'}}>
                        <input type="text" placeholder="Tìm kiếm nhóm..." style={{width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#6B7280', fontSize: 14, fontFamily: 'Inter', fontWeight: '400'}} />
                    </div>
                    <div style={{left: 12, top: 9, position: 'absolute', display: 'flex', alignItems: 'center'}}>
                        <Search size={18} color="#757682" />
                    </div>
                </div>
                
                {localStorage.getItem('auth') === 'true' ? (
                  <>
                    <div style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                        <Bell size={20} color="#444651" />
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                        <img style={{width: 32, height: 32, borderRadius: 12, border: '1px #E2E8F0 solid', cursor: 'pointer'}} src="https://i.pravatar.cc/150?img=11" alt="Avatar" />
                        <div 
                          onClick={() => {
                            localStorage.removeItem('auth');
                            window.location.reload();
                          }}
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
