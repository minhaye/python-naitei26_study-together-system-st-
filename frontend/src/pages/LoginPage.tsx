import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/auth-context';
import { clearAuthUrlError, describeAuthError, readAuthUrlError, resendSignupConfirmation } from '../lib/authFlow';
import { useResendCooldown } from '../hooks/useResendCooldown';
import type { AuthError, Session } from '@supabase/supabase-js';

// Only used when Supabase itself isn't configured for this environment (no URL/anon key
// set -- see lib/supabase.ts's placeholder fallback). A REAL Supabase project rejecting a
// login (wrong password, unconfirmed email, unknown account) must never be masked by this --
// that previously produced a session that "looked" logged in client-side but carried a
// non-UUID user id (`dev-user-<timestamp>`) the backend rejected on every single request
// with 401 "Token missing subject claim", since app/auth/dependencies.py requires the
// dev-token's suffix to parse as a UUID.
const IS_SUPABASE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

const DEV_USER_MAP: Record<string, string> = {
  'user1@study.local': '10000000-0000-0000-0000-000000000001',
  'user2@study.local': '10000000-0000-0000-0000-000000000002',
  'user3@study.local': '10000000-0000-0000-0000-000000000003',
  'user4@study.local': '10000000-0000-0000-0000-000000000004',
  'user5@study.local': '10000000-0000-0000-0000-000000000005',
};

function createDevSession(email: string): Session {
  const userId = DEV_USER_MAP[email] || `dev-user-${Date.now()}`;
  return {
    access_token: `dev-token-${userId}`,
    refresh_token: `dev-refresh-token-${userId}`,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      email: email,
      user_metadata: { full_name: email.split('@')[0] },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  } as unknown as Session;
}

function describeSignInError(err: AuthError): string {
  console.error('signIn error', err);
  if (err.code === 'invalid_credentials' || err.message.includes('Invalid login credentials')) {
    return 'Email hoặc mật khẩu không đúng.';
  }
  if (err.code === 'email_not_confirmed' || err.message.includes('Email not confirmed')) {
    return 'Email chưa được xác thực. Vui lòng kiểm tra hộp thư của bạn.';
  }
  return describeAuthError(err);
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setDevSession } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendInfo, setResendInfo] = useState<string | null>(null);
  const { cooldown: resendCooldown, start: startResendCooldown } = useResendCooldown();

  useEffect(() => {
    const urlError = readAuthUrlError();
    if (urlError) {
      setError(urlError);
      clearAuthUrlError();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setResendInfo(null);
    setNeedsConfirmation(false);
    setIsSubmitting(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (!signInError && data.session) {
        navigate('/');
        return;
      }

      if (signInError) {
        if (!IS_SUPABASE_CONFIGURED) {
          setDevSession(createDevSession(email));
          navigate('/');
          return;
        }
        setError(describeSignInError(signInError));
        setNeedsConfirmation(signInError.code === 'email_not_confirmed');
      }
    } catch (err) {
      if (!IS_SUPABASE_CONFIGURED) {
        setDevSession(createDevSession(email));
        navigate('/');
        return;
      }
      console.error('signIn failed unexpectedly', err);
      setError('Không thể kết nối đến máy chủ đăng nhập. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (isResending || resendCooldown > 0) return;
    setIsResending(true);
    setResendInfo(null);
    try {
      const { error: resendError } = await resendSignupConfirmation(email);
      if (resendError) {
        console.error('resend confirmation error', resendError);
        setError(describeAuthError(resendError));
      } else {
        setResendInfo('Đã gửi lại email xác nhận. Vui lòng kiểm tra hộp thư của bạn.');
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
            <h1 style={{fontSize: 28, fontWeight: '800', color: '#00236F', margin: '0 0 8px 0'}}>Chào mừng trở lại</h1>
            <p style={{color: '#64748B', fontSize: 15, margin: 0}}>Đăng nhập để tiếp tục học tập và thảo luận</p>
          </div>

          <form onSubmit={handleLogin} style={{display: 'flex', flexDirection: 'column', gap: 20}}>
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
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                <label style={{fontSize: 14, fontWeight: '600', color: '#334155'}}>Mật khẩu</label>
                <Link to="/forgot-password" style={{fontSize: 13, fontWeight: '600', color: '#3B82F6', textDecoration: 'none'}}>Quên mật khẩu?</Link>
              </div>
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

            {error && (
              <p style={{color: '#EF4444', fontSize: 14, margin: 0}}>{error}</p>
            )}
            {resendInfo && (
              <p style={{color: '#16A34A', fontSize: 14, margin: 0}}>{resendInfo}</p>
            )}

            {needsConfirmation && (
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
              {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
              <ArrowRight size={18} />
            </button>
          </form>

          <div style={{marginTop: 32, textAlign: 'center'}}>
            <p style={{color: '#64748B', fontSize: 14, margin: 0}}>
              Chưa có tài khoản? <Link to="/register" style={{color: '#00236F', fontWeight: '700', textDecoration: 'none'}}>Đăng ký ngay</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
