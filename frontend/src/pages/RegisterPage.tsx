import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { describeAuthError, getEmailConfirmationRedirect, resendSignupConfirmation } from '../lib/authFlow';
import { useResendCooldown } from '../hooks/useResendCooldown';

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { cooldown: resendCooldown, start: startResendCooldown } = useResendCooldown();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    let data;
    let signUpError;
    try {
      ({ data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: getEmailConfirmationRedirect() },
      }));
    } catch (err) {
      console.error('signUp failed unexpectedly', err);
      setIsSubmitting(false);
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      return;
    }
    setIsSubmitting(false);

    if (signUpError) {
      console.error('signUp error', signUpError);
      setError(describeAuthError(signUpError));
      return;
    }

    // A profile row is created lazily by AuthContext the first time a session for this
    // user appears (works whether that happens immediately, i.e. email confirmation is
    // disabled, or only later once the user confirms their email).
    if (data.session) {
      navigate('/');
      return;
    }

    setPendingConfirmation(true);
    startResendCooldown();
    setInfo('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản trước khi đăng nhập.');
  };

  const handleResend = async () => {
    if (isResending || resendCooldown > 0) return;
    setIsResending(true);
    setError(null);
    try {
      const { error: resendError } = await resendSignupConfirmation(email);
      if (resendError) {
        console.error('resend confirmation error', resendError);
        setError(describeAuthError(resendError));
      } else {
        setInfo('Đã gửi lại email xác nhận. Vui lòng kiểm tra hộp thư của bạn.');
        startResendCooldown();
      }
    } catch (err) {
      console.error('resend confirmation failed unexpectedly', err);
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div style={{minHeight: '100vh', width: '100%', background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24}}>
      <div style={{width: '100%', maxWidth: 420, background: 'white', borderRadius: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden'}}>
        
        <div style={{padding: '40px 40px 32px'}}>
          <div style={{textAlign: 'center', marginBottom: 32}}>
            <h1 style={{fontSize: 28, fontWeight: '800', color: '#00236F', margin: '0 0 8px 0'}}>Tạo tài khoản</h1>
            <p style={{color: '#64748B', fontSize: 15, margin: 0}}>Tham gia cộng đồng học tập trực tuyến</p>
          </div>

          <form onSubmit={handleRegister} style={{display: 'flex', flexDirection: 'column', gap: 20}}>
            <div>
              <label style={{display: 'block', fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8}}>Họ và tên</label>
              <div style={{position: 'relative'}}>
                <User size={18} color="#94A3B8" style={{position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)'}} />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  style={{width: '100%', padding: '12px 16px 12px 42px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, outline: 'none', fontSize: 15, color: '#0F172A', boxSizing: 'border-box', transition: 'border-color 0.2s'}}
                  onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                />
              </div>
            </div>

            <div>
              <label style={{display: 'block', fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8}}>Email</label>
              <div style={{position: 'relative'}}>
                <Mail size={18} color="#94A3B8" style={{position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)'}} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nhapemail@example.com"
                  style={{width: '100%', padding: '12px 16px 12px 42px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, outline: 'none', fontSize: 15, color: '#0F172A', boxSizing: 'border-box', transition: 'border-color 0.2s'}}
                  onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
                  onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                />
              </div>
            </div>

            <div>
              <label style={{display: 'block', fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8}}>Mật khẩu</label>
              <div style={{position: 'relative'}}>
                <Lock size={18} color="#94A3B8" style={{position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)'}} />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
            {info && (
              <p style={{color: '#16A34A', fontSize: 14, margin: 0}}>{info}</p>
            )}

            {pendingConfirmation && (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || resendCooldown > 0}
                style={{width: '100%', padding: '10px', background: 'transparent', color: '#00236F', border: '1px solid #CBD5E1', borderRadius: 12, fontSize: 14, fontWeight: '600', cursor: isResending || resendCooldown > 0 ? 'default' : 'pointer', opacity: isResending || resendCooldown > 0 ? 0.6 : 1}}
              >
                {isResending
                  ? 'Đang gửi lại...'
                  : resendCooldown > 0
                    ? `Gửi lại email xác nhận (${resendCooldown}s)`
                    : 'Gửi lại email xác nhận'}
              </button>
            )}

            <button type="submit" disabled={isSubmitting} style={{width: '100%', marginTop: 8, padding: '14px', background: '#00236F', color: 'white', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: '600', cursor: isSubmitting ? 'default' : 'pointer', opacity: isSubmitting ? 0.7 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, transition: 'background 0.2s'}} onMouseOver={e => e.currentTarget.style.background = '#1E3A8A'} onMouseOut={e => e.currentTarget.style.background = '#00236F'}>
              {isSubmitting ? 'Đang đăng ký...' : 'Đăng ký tài khoản'}
              <ArrowRight size={18} />
            </button>
          </form>

          <div style={{marginTop: 32, textAlign: 'center'}}>
            <p style={{color: '#64748B', fontSize: 14, margin: 0}}>
              Đã có tài khoản? <Link to="/login" style={{color: '#00236F', fontWeight: '700', textDecoration: 'none'}}>Đăng nhập ngay</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
