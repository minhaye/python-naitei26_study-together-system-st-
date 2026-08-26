import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{minHeight: '100vh', width: '100%', background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24}}>
      <div style={{width: '100%', maxWidth: 420, background: 'white', borderRadius: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden'}}>
        
        <div style={{padding: '40px 40px 32px'}}>
          <div style={{textAlign: 'center', marginBottom: 32}}>
            <h1 style={{fontSize: 28, fontWeight: '800', color: '#00236F', margin: '0 0 8px 0'}}>Quên mật khẩu</h1>
            <p style={{color: '#64748B', fontSize: 15, margin: 0}}>Nhập email của bạn để nhận liên kết khôi phục</p>
          </div>

          {success ? (
            <div style={{textAlign: 'center', padding: '24px 0'}}>
              <div style={{background: '#ECFDF5', color: '#059669', padding: '16px', borderRadius: '12px', marginBottom: '24px'}}>
                <p style={{margin: 0, fontWeight: '500'}}>Email khôi phục đã được gửi!</p>
                <p style={{margin: '8px 0 0 0', fontSize: '14px'}}>Vui lòng kiểm tra hộp thư đến của bạn để đặt lại mật khẩu.</p>
              </div>
              <Link to="/login" style={{display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#00236F', fontWeight: '600', textDecoration: 'none'}}>
                <ArrowLeft size={18} />
                Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} style={{display: 'flex', flexDirection: 'column', gap: 20}}>
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

              {error && (
                <p style={{color: '#EF4444', fontSize: 14, margin: 0}}>{error}</p>
              )}

              <button type="submit" disabled={isSubmitting} style={{width: '100%', marginTop: 8, padding: '14px', background: '#00236F', color: 'white', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: '600', cursor: isSubmitting ? 'default' : 'pointer', opacity: isSubmitting ? 0.7 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, transition: 'background 0.2s'}} onMouseOver={e => e.currentTarget.style.background = '#1E3A8A'} onMouseOut={e => e.currentTarget.style.background = '#00236F'}>
                {isSubmitting ? 'Đang gửi...' : 'Gửi liên kết khôi phục'}
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {!success && (
            <div style={{marginTop: 32, textAlign: 'center'}}>
              <Link to="/login" style={{color: '#64748B', fontSize: 14, fontWeight: '600', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6}}>
                <ArrowLeft size={16} />
                Quay lại đăng nhập
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
