import { Camera, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAuthContext } from '../contexts/auth-context';
import { updateProfile, uploadProfileAvatar } from '../lib/profile.api';

const fieldStyle: React.CSSProperties = { width: '100%', height: 43, padding: '0 12px', border: '1px solid #D9E1EF', borderRadius: 5, background: '#F8FAFF', color: '#344460', fontSize: 16, outline: 'none', boxSizing: 'border-box' };
const cardStyle: React.CSSProperties = { background: '#FFF', border: '1px solid #DCE4F0', borderRadius: 9, padding: 24 };
const sectionTitle: React.CSSProperties = { margin: 0, color: '#151E34', fontSize: 20, lineHeight: 1.35, fontWeight: 700 };
const mutedText: React.CSSProperties = { margin: '3px 0 0', color: '#51596B', fontSize: 14, lineHeight: 1.45 };
const divider: React.CSSProperties = { height: 1, background: '#DEE5F0', marginTop: 8 };
const labelStyle: React.CSSProperties = { display: 'grid', gap: 5, color: '#172139', fontSize: 14, fontWeight: 650 };
const settingLabel: React.CSSProperties = { color: '#172139', fontSize: 14, fontWeight: 650 };
const settingRow: React.CSSProperties = { minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 };
const primaryButton: React.CSSProperties = { minHeight: 34, border: 0, borderRadius: 5, padding: '0 16px', background: '#062A78', color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 14, fontWeight: 650, cursor: 'pointer' };
const textButton: React.CSSProperties = { border: 0, background: 'transparent', color: '#0A347F', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 };
const selectButton: React.CSSProperties = { height: 30, border: '1px solid #D9E1EF', borderRadius: 3, background: '#F8FAFF', color: '#344460', fontSize: 14, padding: '0 9px' };

export function AccountSettingsPage() {
  const { currentUser, user } = useAuth();
  const { profile, refreshProfile } = useAuthContext();
  const [language, setLanguage] = useState('Tiếng Việt');
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void refreshProfile(); }, []);
  useEffect(() => { if (profile) setName(profile.displayName); }, [profile]);

  const save = async () => {
    if (!user) return;
    await updateProfile(user.id, { display_name: name.trim() || null });
    await refreshProfile();
    setSaved(true);
  };

  const changeAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    try { await uploadProfileAvatar(file); await refreshProfile(); }
    finally { setUploadingAvatar(false); }
  };

  return <main style={{ width: '100%', minHeight: 'calc(100vh - 64px)', background: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)', padding: 32, boxSizing: 'border-box' }}>
    <style>{`
      .settings-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; align-items: start; }
      .settings-actions { border-top: 1px solid #DEE5F0; padding-top: 24px; display: flex; justify-content: flex-end; align-items: center; gap: 28px; }
      @media (max-width: 800px) { .settings-layout { grid-template-columns: 1fr; } .settings-profile { grid-row: 1; } .settings-actions { gap: 16px; flex-wrap: wrap; } }
      @media (max-width: 520px) { .settings-page { padding: 20px !important; } .settings-card { padding: 18px !important; } }
    `}</style>
    <div className="settings-page" style={{ display: 'grid', gap: 24 }}>
      <div className="settings-layout">
        <div style={{ display: 'grid', gap: 24 }}>
          <section className="settings-card" style={cardStyle}><div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}><h2 style={sectionTitle}>Thông tin cá nhân</h2><span style={{ color: '#0A347F', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>HỒ SƠ</span></div><div style={divider} /><div style={{ display: 'grid', gap: 16, marginTop: 18 }}><label style={labelStyle}>Họ và tên<input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} /></label><label style={labelStyle}>Địa chỉ email<input type="email" value={user?.email || ''} readOnly style={{ ...fieldStyle, background: '#E2E8F0', color: '#64748B', cursor: 'not-allowed' }} /></label><label style={labelStyle}>Trường đại học / Tổ chức<input defaultValue="Đại học Bách Khoa" style={fieldStyle} /></label></div></section>
          <section className="settings-card" style={{ ...cardStyle, padding: '20px 24px' }}><h2 style={sectionTitle}>Tài khoản & Ứng dụng</h2><div style={divider} /><div style={{ display: 'grid', gap: 10, marginTop: 12 }}><div style={settingRow}><div><strong style={settingLabel}>Mật khẩu</strong><p style={{ ...mutedText, fontSize: 13 }}>Lần thay đổi gần nhất: 3 tháng trước</p></div><button style={textButton}>Thay đổi</button></div><div style={settingRow}><strong style={settingLabel}>Giao diện</strong><button style={selectButton}>Sáng</button></div><div style={settingRow}><strong style={settingLabel}>Ngôn ngữ</strong><label style={{ position: 'relative' }}><select value={language} onChange={event => setLanguage(event.target.value)} style={{ ...selectButton, appearance: 'none', paddingRight: 30 }}><option>Tiếng Việt</option><option>English</option></select><ChevronDown size={14} style={{ position: 'absolute', right: 9, top: 9, pointerEvents: 'none', color: '#64748B' }} /></label></div></div></section>
        </div>
        <aside className="settings-profile settings-card" style={{ ...cardStyle, display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 14, background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F8FF 100%)' }}>
          <div style={{ position: 'relative', width: 104, height: 104, borderRadius: '50%', background: currentUser?.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 'bold', border: '3px solid #E4ECFA' }}>
            {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="Ảnh đại diện" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : currentUser?.initials}
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void changeAvatar(event)} style={{ display: 'none' }} />
            <button type="button" aria-label="Thay đổi ảnh đại diện" title="Thay đổi ảnh đại diện" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} style={{ position: 'absolute', right: -3, bottom: -3, width: 34, height: 34, padding: 0, borderRadius: '50%', border: '2px solid white', background: '#062A78', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingAvatar ? 'wait' : 'pointer' }}><Camera size={17} /></button>
          </div>
          <div><h2 style={sectionTitle}>{name}</h2><p style={mutedText}>{user?.email || 'Chưa cập nhật'}</p><span style={{ display: 'inline-block', marginTop: 10, padding: '4px 10px', borderRadius: 999, background: '#E8F0FF', color: '#0A347F', fontSize: 12, fontWeight: 700 }}>Sinh viên</span></div><div style={{ width: '100%', borderTop: '1px solid #DEE5F0', paddingTop: 14, display: 'grid', gap: 10, textAlign: 'left', fontSize: 14, color: '#475569' }}><div><strong style={{ color: '#172139' }}>Tổ chức</strong><div style={{ marginTop: 2 }}>Đại học Bách Khoa</div></div><div><strong style={{ color: '#172139' }}>Tham gia</strong><div style={{ marginTop: 2 }}>Tháng 9, 2023</div></div></div></aside>
      </div>
      <div className="settings-actions"><span style={{ color: '#16803C', fontSize: 14, visibility: saved ? 'visible' : 'hidden' }}>Đã lưu thay đổi</span><button type="button" style={textButton} onClick={() => { setName(profile?.displayName || currentUser?.name || ''); setSaved(false); }}>Hủy</button><button type="button" style={primaryButton} onClick={() => void save()}>Lưu thay đổi</button></div>
    </div>
  </main>;
}
