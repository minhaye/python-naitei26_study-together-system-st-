import { useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * useKeepAlive — Ping /health mỗi 9 phút để ngăn Render free-tier spin-down.
 *
 * - Chỉ ping khi tab đang visible (document.visibilityState === 'visible')
 * - Không throw error nếu ping thất bại (best-effort)
 * - Render spin-down timeout = 15 phút → ping mỗi 9 phút là đủ an toàn
 */
export function useKeepAlive(): void {
  useEffect(() => {
    const PING_INTERVAL_MS = 9 * 60 * 1000; // 9 phút

    const ping = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
      } catch {
        // Ignore network errors — this is best-effort keep-alive
      }
    };

    // Ping ngay lần đầu khi app mount để warm-up server sớm nhất có thể
    void ping();

    const intervalId = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);
}
