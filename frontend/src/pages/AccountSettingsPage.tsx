import { Camera, ChevronDown } from 'lucide-react';
import { useState } from 'react';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  height: 43,
  padding: '0 12px',
  border: '1px solid #D9E1EF',
  borderRadius: 5,
  background: '#F8FAFF',
  color: '#344460',
  fontSize: 16,
  outline: 'none',
};

export function AccountSettingsPage() {
  const [twoFactor, setTwoFactor] = useState(false);
  const [language, setLanguage] = useState('Tiếng Việt');
  const [saved, setSaved] = useState(false);

  return (
    <main style={{ width: '100%', minHeight: 'calc(100vh - 64px)', background: '#F7F9FF', padding: '50px 24px 62px' }}>
      <div style={{ maxWidth: 952, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#111B33', fontSize: 36, lineHeight: 1.2, fontWeight: 750, letterSpacing: '-1px' }}>Cài đặt tài khoản</h1>
          <p style={{ marginTop: 8, color: '#50576A', fontSize: 19, lineHeight: 1.45 }}>Quản lý thông tin cá nhân, tùy chọn bảo mật và cài đặt ứng dụng.</p>
        </header>

        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 64 }}>
            <img src="https://i.pravatar.cc/160?img=11" alt="Ảnh đại diện của bạn" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12, border: '1px solid #D9E1EF' }} />
            <div style={{ flex: 1 }}>
              <h2 style={sectionTitle}>Ảnh đại diện</h2>
              <p style={mutedText}>Cập nhật ảnh và thông tin cá nhân của bạn.</p>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <button type="button" style={primaryButton}><Camera size={16} /> Thay đổi</button>
              <button type="button" style={textButton}>Xóa</button>
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle, marginTop: 24 }}>
          <h2 style={sectionTitle}>Thông tin cá nhân</h2>
          <div style={divider} />
          <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
            <label style={labelStyle}>Họ và tên<input defaultValue="Alex Rivers" style={fieldStyle} /></label>
            <label style={labelStyle}>Địa chỉ email<input type="email" defaultValue="alex.rivers@example.edu" style={fieldStyle} /></label>
            <label style={labelStyle}>Trường đại học / Tổ chức<input defaultValue="Đại học Bang" style={fieldStyle} /></label>
          </div>
        </section>

        <section style={{ ...cardStyle, marginTop: 24 }}>
          <h2 style={sectionTitle}>Tài khoản & Ứng dụng</h2>
          <div style={divider} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 48px', marginTop: 16 }}>
            <div style={settingRow}><div><strong style={settingLabel}>Mật khẩu</strong><p style={mutedText}>Lần thay đổi gần nhất: 3 tháng trước</p></div><button style={textButton}>Thay đổi</button></div>
            <div style={settingRow}><strong style={settingLabel}>Giao diện</strong><button style={selectButton}>Sáng</button></div>
            <div style={settingRow}><strong style={settingLabel}>Xác thực hai yếu tố</strong><button onClick={() => setTwoFactor(!twoFactor)} aria-pressed={twoFactor} aria-label="Bật xác thực hai yếu tố" style={{ width: 40, height: 22, border: 0, borderRadius: 999, padding: 3, background: twoFactor ? '#062A78' : '#DDE5F1', cursor: 'pointer' }}><span style={{ display: 'block', width: 16, height: 16, borderRadius: '50%', background: '#FFF', transform: twoFactor ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .2s' }} /></button></div>
            <div style={settingRow}><strong style={settingLabel}>Ngôn ngữ</strong><label style={{ position: 'relative' }}><select value={language} onChange={(event) => setLanguage(event.target.value)} style={{ ...selectButton, appearance: 'none', paddingRight: 30 }}><option>Tiếng Việt</option><option>English</option></select><ChevronDown size={14} style={{ position: 'absolute', right: 9, top: 9, pointerEvents: 'none', color: '#64748B' }} /></label></div>
          </div>
        </section>

        <div style={{ borderTop: '1px solid #DEE5F0', marginTop: 48, paddingTop: 24, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 28 }}>
          {saved && <span style={{ color: '#16803C', fontSize: 14 }}>Đã lưu thay đổi</span>}
          <button type="button" style={textButton} onClick={() => setSaved(false)}>Hủy</button>
          <button type="button" style={primaryButton} onClick={() => setSaved(true)}>Lưu thay đổi</button>
        </div>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = { background: '#FFF', border: '1px solid #DCE4F0', borderRadius: 9, padding: 24 };
const sectionTitle: React.CSSProperties = { margin: 0, color: '#151E34', fontSize: 20, lineHeight: 1.35, fontWeight: 700 };
const mutedText: React.CSSProperties = { margin: '3px 0 0', color: '#51596B', fontSize: 14, lineHeight: 1.35 };
const divider: React.CSSProperties = { height: 1, background: '#DEE5F0', marginTop: 6 };
const labelStyle: React.CSSProperties = { display: 'grid', gap: 5, color: '#172139', fontSize: 14, fontWeight: 650 };
const settingLabel: React.CSSProperties = { color: '#172139', fontSize: 14, fontWeight: 650 };
const settingRow: React.CSSProperties = { minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 };
const primaryButton: React.CSSProperties = { minHeight: 32, border: 0, borderRadius: 4, padding: '0 16px', background: '#062A78', color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 14, fontWeight: 650, cursor: 'pointer' };
const textButton: React.CSSProperties = { border: 0, background: 'transparent', color: '#0A347F', fontSize: 14, fontWeight: 550, cursor: 'pointer', padding: 0 };
const selectButton: React.CSSProperties = { height: 30, border: '1px solid #D9E1EF', borderRadius: 3, background: '#F8FAFF', color: '#344460', fontSize: 14, padding: '0 9px' };
