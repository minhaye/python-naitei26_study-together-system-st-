import { useEffect, useState } from 'react';
import { Loader2, Wifi } from 'lucide-react';
import { subscribeColdStart } from '../../lib/apiClient';

/**
 * ColdStartToast — Thay thế overlay blocking bằng toast nhỏ góc dưới phải.
 * Người dùng vẫn có thể tương tác với UI (xem skeleton, điều hướng) trong lúc server khởi động.
 */
export function ColdStartOverlay() {
  const [visible, setVisible] = useState(false);
  const [dots, setDots] = useState('');

  useEffect(() => subscribeColdStart(setVisible), []);

  // Animated ellipsis để thể hiện "đang hoạt động"
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        background: 'white',
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        padding: '14px 18px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        maxWidth: 320,
        animation: 'toast-slide-in 0.3s ease',
      }}
    >
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#EFF6FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Loader2 size={18} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
      </div>

      {/* Text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Wifi size={13} color="#64748B" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontFamily: 'Inter' }}>
            Đang kết nối server{dots}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#64748B', lineHeight: '1.5', fontFamily: 'Inter' }}>
          Server miễn phí (Render) đang khởi động lại.
          <br />
          Có thể mất ~1 phút, vui lòng đợi.
        </span>
      </div>
    </div>
  );
}
