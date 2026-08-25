import { Lock } from 'lucide-react';
import { SyncedWhiteboard } from './SyncedWhiteboard';

interface WhiteboardPanelProps {
  roomId: string;
  initialState: Record<string, any> | null;
  isReadonly: boolean;
  isAvailable: boolean;
  onUnavailableClick: () => void;
}

export function WhiteboardPanel({ roomId, initialState, isReadonly, isAvailable, onUnavailableClick }: WhiteboardPanelProps) {
  if (!isAvailable) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#64748B', textAlign: 'center', padding: 24 }}>
        <Lock size={40} color="#94A3B8" />
        <p style={{ margin: 0, fontSize: 14, maxWidth: 360 }}>
          Bảng trắng hiện không khả dụng trên phiên bản triển khai này.
        </p>
        <button
          onClick={onUnavailableClick}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: 'white', color: '#334155', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Xem chi tiết
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SyncedWhiteboard roomId={roomId} initialState={initialState} isReadonly={isReadonly} />
    </div>
  );
}
