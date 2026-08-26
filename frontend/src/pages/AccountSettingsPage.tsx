import { Camera, Lock, Eye, EyeOff, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAuthContext } from '../contexts/auth-context';
import { updateProfile, uploadProfileAvatar } from '../lib/profile.api';
import { NotificationSettingsSection } from '../components/settings/NotificationSettingsSection';
import { supabase } from '../lib/supabase';

const fieldStyle: React.CSSProperties = { width: '100%', height: 43, padding: '0 12px', border: '1px solid #D9E1EF', borderRadius: 5, background: '#F8FAFF', color: '#344460', fontSize: 16, outline: 'none', boxSizing: 'border-box' };
const cardStyle: React.CSSProperties = { background: '#FFF', border: '1px solid #DCE4F0', borderRadius: 9, padding: 24 };
const sectionTitle: React.CSSProperties = { margin: 0, color: '#151E34', fontSize: 20, lineHeight: 1.35, fontWeight: 700 };
const mutedText: React.CSSProperties = { margin: '3px 0 0', color: '#51596B', fontSize: 14, lineHeight: 1.45 };
const divider: React.CSSProperties = { height: 1, background: '#DEE5F0', marginTop: 8 };
const labelStyle: React.CSSProperties = { display: 'grid', gap: 5, color: '#172139', fontSize: 14, fontWeight: 650 };
const primaryButton: React.CSSProperties = { minHeight: 34, border: 0, borderRadius: 5, padding: '0 16px', background: '#062A78', color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 14, fontWeight: 650, cursor: 'pointer' };
const textButton: React.CSSProperties = { border: 0, background: 'transparent', color: '#0A347F', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 };

export function AccountSettingsPage() {
  const { currentUser, user } = useAuth();
  const { profile, refreshProfile } = useAuthContext();
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [organization, setOrganization] = useState('');
  const [bio, setBio] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Đổi mật khẩu ──────────────────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  useEffect(() => { void refreshProfile(); }, []);
  useEffect(() => {
    if (profile) {
      setName(profile.displayName);
      setOrganization(profile.organization || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    await updateProfile(user.id, { display_name: name.trim() || null, organization: organization.trim() || null, bio: bio.trim() || null });
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (!currentPassword) { setPwError('Vui lòng nhập mật khẩu hiện tại.'); return; }
    if (newPassword.length < 6) { setPwError('Mật khẩu mới phải có ít nhất 6 ký tự.'); return; }
    if (newPassword !== confirmPassword) { setPwError('Mật khẩu xác nhận không khớp.'); return; }
    if (newPassword === currentPassword) { setPwError('Mật khẩu mới phải khác mật khẩu hiện tại.'); return; }
    setPwSubmitting(true);
    try {
      // Xác thực mật khẩu hiện tại bằng cách re-authenticate
      const email = user?.email;
      if (!email) { setPwError('Không tìm thấy email tài khoản.'); return; }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (signInError) {
        setPwError('Mật khẩu hiện tại không đúng. Vui lòng kiểm tra lại.');
        return;
      }
      // Mật khẩu cũ đúng → đổi sang mật khẩu mới
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setPwError(updateError.message);
      } else {
        setPwSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => { setPwSuccess(false); setPwOpen(false); }, 3000);
      }
    } catch {
      setPwError('Không thể kết nối. Vui lòng thử lại.');
    } finally {
      setPwSubmitting(false);
    }
  };

  const togglePwSection = () => {
    setPwOpen((v) => !v);
    setPwError(null);
    setPwSuccess(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // Tính độ mạnh mật khẩu (0-3)
  const getPwStrength = (pw: string): number => {
    if (pw.length < 6) return 0;
    if (pw.length < 10) return 1;
    if (pw.length < 14) return 2;
    return 3;
  };
  const strengthColors = ['#EF4444', '#F59E0B', '#3B82F6', '#16803C'];
  const strengthLabels = ['Quá ngắn', 'Yếu', 'Trung bình', 'Mạnh'];

  return (
    <main style={{ width: '100%', height: 'calc(100vh - 64px)', overflowY: 'auto', background: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)', padding: 32, boxSizing: 'border-box' }}>
      <style>{`
        .settings-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; align-items: start; }
        .settings-actions { border-top: 1px solid #DEE5F0; padding-top: 24px; display: flex; justify-content: flex-end; align-items: center; gap: 28px; }
        @media (max-width: 800px) { .settings-layout { grid-template-columns: 1fr; } .settings-profile { grid-row: 1; } .settings-actions { gap: 16px; flex-wrap: wrap; } }
        @media (max-width: 520px) { .settings-page { padding: 20px !important; } .settings-card { padding: 18px !important; } }
        .pw-field-wrap { position: relative; }
        .pw-field-wrap input { padding-right: 44px !important; }
        .pw-toggle-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #7B8CAA; display: flex; align-items: center; padding: 0; line-height: 1; }
        .pw-toggle-btn:hover { color: #062A78; }
        .pw-strength { display: flex; gap: 4px; margin-top: 6px; }
        .pw-strength-bar { height: 4px; flex: 1; border-radius: 2px; transition: background 0.3s; }
        .pw-header-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: none; border: none; cursor: pointer; padding: 0; }
        .pw-header-btn:hover .pw-icon-wrap { background: #E8F0FF !important; }
      `}</style>
      <div className="settings-page" style={{ display: 'grid', gap: 24 }}>
        <div className="settings-layout">
          <div style={{ display: 'grid', gap: 24 }}>

            {/* ── Thông tin cá nhân ── */}
            <section className="settings-card" style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
                <h2 style={sectionTitle}>Thông tin cá nhân</h2>
                <span style={{ color: '#0A347F', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>HỒ SƠ</span>
              </div>
              <div style={divider} />
              <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
                <label style={labelStyle}>
                  Họ và tên
                  <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  Địa chỉ email
                  <input type="email" value={user?.email || ''} readOnly style={{ ...fieldStyle, background: '#E2E8F0', color: '#64748B', cursor: 'not-allowed' }} />
                </label>
                <label style={labelStyle}>
                  Trường đại học / Tổ chức
                  <input value={organization} onChange={(e) => setOrganization(e.target.value)} style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  Mô tả
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} style={{ ...fieldStyle, height: 88, padding: 12, resize: 'vertical' }} />
                </label>
              </div>
            </section>

            <NotificationSettingsSection />

            {/* ── Đổi mật khẩu (đặt dưới Cài đặt Thông báo) ── */}
            <section className="settings-card" style={cardStyle}>
              {/* Header — click để mở/đóng */}
              <button type="button" className="pw-header-btn" onClick={togglePwSection}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    className="pw-icon-wrap"
                    style={{
                      width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                      background: pwOpen ? '#E8F0FF' : '#F1F5F9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s',
                    }}
                  >
                    <Lock size={18} color={pwOpen ? '#062A78' : '#64748B'} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h2 style={{ ...sectionTitle, fontSize: 18 }}>Đổi mật khẩu</h2>
                    <p style={mutedText}>Cập nhật mật khẩu đăng nhập của bạn</p>
                  </div>
                </div>
                <div style={{ color: '#7B8CAA', flexShrink: 0 }}>
                  {pwOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              {/* Collapsible form */}
              {pwOpen && (
                <div style={{ marginTop: 20 }}>
                  <div style={divider} />
                  {pwSuccess ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 0', textAlign: 'center' }}>
                      <CheckCircle2 size={48} color="#16803C" />
                      <p style={{ margin: 0, color: '#16803C', fontWeight: 700, fontSize: 16 }}>Đổi mật khẩu thành công!</p>
                      <p style={{ margin: 0, color: '#51596B', fontSize: 14 }}>
                        Mật khẩu mới đã được lưu. Vui lòng dùng mật khẩu mới trong lần đăng nhập tiếp theo.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={(e) => void handleChangePassword(e)} style={{ display: 'grid', gap: 18, marginTop: 18 }}>

                      {/* Mật khẩu hiện tại */}
                      <label style={labelStyle}>
                        Mật khẩu hiện tại
                        <div className="pw-field-wrap">
                          <input
                            type={showCurrentPw ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Nhập mật khẩu đang dùng"
                            required
                            style={fieldStyle}
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="pw-toggle-btn"
                            onClick={() => setShowCurrentPw((v) => !v)}
                            tabIndex={-1}
                            aria-label={showCurrentPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {showCurrentPw ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                      </label>

                      {/* Đường kẻ phân cách */}
                      <div style={{ height: 1, background: '#F1F5F9', margin: '0 -4px' }} />

                      {/* Mật khẩu mới */}
                      <label style={labelStyle}>
                        Mật khẩu mới
                        <div className="pw-field-wrap">
                          <input
                            type={showNewPw ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Tối thiểu 6 ký tự"
                            required
                            style={fieldStyle}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="pw-toggle-btn"
                            onClick={() => setShowNewPw((v) => !v)}
                            tabIndex={-1}
                            aria-label={showNewPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {showNewPw ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                        {/* Thanh độ mạnh mật khẩu */}
                        {newPassword.length > 0 && (
                          <div>
                            <div className="pw-strength">
                              {[0, 1, 2, 3].map((i) => {
                                const s = getPwStrength(newPassword);
                                return (
                                  <div
                                    key={i}
                                    className="pw-strength-bar"
                                    style={{ background: i <= s ? strengthColors[s] : '#E2E8F0' }}
                                  />
                                );
                              })}
                            </div>
                            <span style={{ fontSize: 12, color: strengthColors[getPwStrength(newPassword)], marginTop: 2, display: 'inline-block' }}>
                              {strengthLabels[getPwStrength(newPassword)]}
                            </span>
                          </div>
                        )}
                      </label>

                      {/* Xác nhận mật khẩu */}
                      <label style={labelStyle}>
                        Xác nhận mật khẩu mới
                        <div className="pw-field-wrap">
                          <input
                            type={showConfirmPw ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Nhập lại mật khẩu mới"
                            required
                            style={{
                              ...fieldStyle,
                              borderColor:
                                confirmPassword && confirmPassword !== newPassword
                                  ? '#EF4444'
                                  : confirmPassword && confirmPassword === newPassword
                                  ? '#16803C'
                                  : '#D9E1EF',
                            }}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="pw-toggle-btn"
                            onClick={() => setShowConfirmPw((v) => !v)}
                            tabIndex={-1}
                            aria-label={showConfirmPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {showConfirmPw ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                        {confirmPassword && confirmPassword !== newPassword && (
                          <span style={{ fontSize: 12, color: '#EF4444', marginTop: 2 }}>Mật khẩu không khớp</span>
                        )}
                        {confirmPassword && confirmPassword === newPassword && (
                          <span style={{ fontSize: 12, color: '#16803C', marginTop: 2 }}>✓ Khớp</span>
                        )}
                      </label>

                      {/* Thông báo lỗi */}
                      {pwError && (
                        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, color: '#B91C1C', fontSize: 14 }}>
                          {pwError}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button type="button" style={textButton} onClick={togglePwSection}>Hủy</button>
                        <button
                          type="submit"
                          disabled={pwSubmitting}
                          style={{ ...primaryButton, opacity: pwSubmitting ? 0.7 : 1, cursor: pwSubmitting ? 'default' : 'pointer' }}
                        >
                          {pwSubmitting ? 'Đang xác thực...' : 'Lưu mật khẩu mới'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ── Right Sidebar — Hồ sơ ── */}
          <aside
            className="settings-profile settings-card"
            style={{ ...cardStyle, display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 14, background: 'linear-gradient(180deg, #FFFFFF 0%, #F4F8FF 100%)' }}
          >
            <div style={{ position: 'relative', width: 104, height: 104, borderRadius: '50%', background: currentUser?.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 'bold', border: '3px solid #E4ECFA' }}>
              {profile?.avatarUrl
                ? <img src={profile.avatarUrl} alt="Ảnh đại diện" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : currentUser?.initials}
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void changeAvatar(event)} style={{ display: 'none' }} />
              <button
                type="button"
                aria-label="Thay đổi ảnh đại diện"
                title="Thay đổi ảnh đại diện"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                style={{ position: 'absolute', right: -3, bottom: -3, width: 34, height: 34, padding: 0, borderRadius: '50%', border: '2px solid white', background: '#062A78', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingAvatar ? 'wait' : 'pointer' }}
              >
                <Camera size={17} />
              </button>
            </div>
            <div>
              <h2 style={sectionTitle}>{name}</h2>
              <p style={mutedText}>{user?.email || 'Chưa cập nhật'}</p>
              <span style={{ display: 'inline-block', marginTop: 10, padding: '4px 10px', borderRadius: 999, background: '#E8F0FF', color: '#0A347F', fontSize: 12, fontWeight: 700 }}>Sinh viên</span>
            </div>
            <div style={{ width: '100%', borderTop: '1px solid #DEE5F0', paddingTop: 14, display: 'grid', gap: 10, textAlign: 'left', fontSize: 14, color: '#475569' }}>
              <div>
                <strong style={{ color: '#172139' }}>Tổ chức</strong>
                <div style={{ marginTop: 2 }}>{organization || 'Chưa cập nhật'}</div>
              </div>
              <div>
                <strong style={{ color: '#172139' }}>Tham gia</strong>
                <div style={{ marginTop: 2 }}>Tháng 9, 2023</div>
              </div>
            </div>
          </aside>
        </div>

        {/* ── Footer Actions — Lưu thông tin cá nhân ── */}
        <div className="settings-actions">
          <span style={{ color: '#16803C', fontSize: 14, visibility: saved ? 'visible' : 'hidden' }}>Đã lưu thay đổi</span>
          <button
            type="button"
            style={textButton}
            onClick={() => {
              setName(profile?.displayName || currentUser?.name || '');
              setOrganization(profile?.organization || '');
              setBio(profile?.bio || '');
              setSaved(false);
            }}
          >
            Hủy
          </button>
          <button type="button" style={primaryButton} onClick={() => void save()}>Lưu thay đổi</button>
        </div>
      </div>
    </main>
  );
}
