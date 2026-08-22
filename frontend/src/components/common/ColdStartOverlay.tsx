import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { subscribeColdStart } from '../../lib/apiClient';

/** Hiện khi có request treo quá lâu — dấu hiệu backend Render free tier đang "thức dậy". */
export function ColdStartOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeColdStart(setVisible), []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <Loader2 size={40} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
      <p
        style={{
          maxWidth: 320,
          padding: '0 16px',
          textAlign: 'center',
          fontSize: 15,
          color: '#334155',
        }}
      >
        Server đang khởi động lại vì đang chạy trên gói miễn phí của Render.
        <br />
        Quá trình này có thể mất khoảng 1 phút, vui lòng đợi trong giây lát...
      </p>
    </div>
  );
}
