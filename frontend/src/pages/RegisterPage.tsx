import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createProfile } from '../lib/profile.api';

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      try {
        await createProfile(
          { id: data.session.user.id, display_name: fullName.trim() || null },
          data.session.access_token,
        );
      } catch (profileError) {
        setError(profileError instanceof Error ? profileError.message : 'Could not create your profile.');
        return;
      }
      // Email confirmation is disabled for this project — a session is issued immediately.
      navigate('/');
      return;
    }

    // Email confirmation is required: signUp succeeded but there is no session yet.
    setInfo('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản trước khi đăng nhập.');
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
