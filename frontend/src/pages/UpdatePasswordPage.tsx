import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function UpdatePasswordPage() {
  const navigate = useNavigate();
  const { isLoggedIn, loading } = useAuth();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If Supabase handles the password reset flow, the user will automatically 
  // be logged in via the access token in the URL fragment when arriving at this page.
  // We can double check if they are logged in before allowing them to update the password.

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        // Redirect to login or home after a few seconds
        setTimeout(() => navigate('/'), 3000);
      }
    } catch {
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Đang tải...</div>;
  }

  // If we require the user to be logged in (which the reset link does by establishing a session)
  // If they are not logged in, maybe the link is invalid or expired.
  if (!isLoggedIn && !success) {
    return (
      <div style={{minHeight: '100vh', width: '100%', background: '#F8FAFC', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24}}>
        <div style={{textAlign: 'center', maxWidth: 400}}>
          <h2 style={{color: '#0F172A', fontSize: 24, marginBottom: 16}}>Liên kết không hợp lệ hoặc đã hết hạn</h2>
          <p style={{color: '#64748B', marginBottom: 24}}>Vui lòng yêu cầu lại liên kết khôi phục mật khẩu mới.</p>
          <button onClick={() => navigate('/forgot-password')} style={{padding: '12px 24px', background: '#00236F', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer'}}>
            Quay lại trang Quên mật khẩu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight: '100vh', width: '100%', background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24}}>
      <div style={{width: '100%', maxWidth: 420, background: 'white', borderRadius: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden'}}>
        
        <div style={{padding: '40px 40px 32px'}}>
          <div style={{textAlign: 'center', marginBottom: 32}}>
            <h1 style={{fontSize: 28, fontWeight: '800', color: '#00236F', margin: '0 0 8px 0'}}>Tạo mật khẩu mới</h1>
            <p style={{color: '#64748B', fontSize: 15, margin: 0}}>Vui lòng nhập mật khẩu mới cho tài khoản của bạn</p>
          </div>

          {success ? (
            <div style={{textAlign: 'center', padding: '24px 0'}}>
              <CheckCircle size={48} color="#059669" style={{marginBottom: 16}} />
              <h2 style={{color: '#0F172A', fontSize: 20, marginBottom: 8}}>Cập nhật thành công!</h2>
              <p style={{color: '#64748B'}}>Mật khẩu của bạn đã được thay đổi. Đang chuyển hướng...</p>
            </div>
          ) : (
            <form onSubmit={handleUpdate} style={{display: 'flex', flexDirection: 'column', gap: 20}}>
              <div>
                <label style={{display: 'block', fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8}}>Mật khẩu mới</label>
                <div style={{position: 'relative'}}>
                  <Lock size={18} color="#94A3B8" style={{position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)'}} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{width: '100%', padding: '12px 16px 12px 42px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, outline: 'none', fontSize: 15, color: '#0F172A', boxSizing: 'border-box', transition: 'border-color 0.2s'}}
                    onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                  />
                </div>
              </div>

              <div>
                <label style={{display: 'block', fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8}}>Xác nhận mật khẩu</label>
                <div style={{position: 'relative'}}>
                  <Lock size={18} color="#94A3B8" style={{position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)'}} />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{width: '100%', padding: '12px 16px 12px 42px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, outline: 'none', fontSize: 15, color: '#0F172A', boxSizing: 'border-box', transition: 'border-color 0.2s'}}
                    onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                  />
                </div>
              </div>

              {error && (
                <p style={{color: '#EF4444', fontSize: 14, margin: 0}}>{error}</p>
              )}

              <button type="submit" disabled={isSubmitting} style={{width: '100%', marginTop: 8, padding: '14px', background: '#00236F', color: 'white', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: '600', cursor: isSubmitting ? 'default' : 'pointer', opacity: isSubmitting ? 0.7 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, transition: 'background 0.2s'}} onMouseOver={e => e.currentTarget.style.background = '#1E3A8A'} onMouseOut={e => e.currentTarget.style.background = '#00236F'}>
                {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
