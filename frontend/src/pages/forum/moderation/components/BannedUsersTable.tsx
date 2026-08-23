import React, { useEffect, useState } from 'react';
import { ShieldOff, UserX } from 'lucide-react';
import { moderationApi } from '../../../../lib/moderation.api';
import { BAN_TYPE_LABELS, type BanResponse } from '../../../../lib/moderation.types';
import { ApiError } from '../../../../lib/apiClient';
import { Button } from '../../../../components/ui/Button';
import { BanUserModal } from './BanUserModal';

export const BannedUsersTable: React.FC = () => {
  const [bans, setBans] = useState<BanResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);

  const load = () => {
    setIsLoading(true);
    moderationApi
      .listBans({ activeOnly: true, limit: 100 })
      .then(setBans)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách lệnh cấm.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRevoke = async (ban: BanResponse) => {
    if (!window.confirm('Gỡ lệnh cấm này?')) return;
    setPendingId(ban.id);
    try {
      await moderationApi.revokeBan(ban.id);
      setBans((prev) => prev.filter((b) => b.id !== ban.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể gỡ lệnh cấm.');
    } finally {
      setPendingId(null);
    }
  };

  const formatExpiry = (ban: BanResponse) => (ban.expires_at ? new Date(ban.expires_at).toLocaleString('vi-VN') : 'Vĩnh viễn');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#0F172A' }}>Người dùng đang bị cấm ({bans.length})</h3>
        <Button variant="danger" onClick={() => setIsBanModalOpen(true)}>
          <UserX size={16} /> Cấm người dùng
        </Button>
      </div>

      {error && (
        <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ color: '#64748B', fontSize: 13.5 }}>Đang tải...</div>
      ) : bans.length === 0 ? (
        <div style={{ color: '#94A3B8', fontSize: 13.5 }}>Không có người dùng nào đang bị cấm.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bans.map((ban) => (
            <div
              key={ban.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 10 }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{ban.user_name ?? ban.user_id}</div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                  {BAN_TYPE_LABELS[ban.ban_type]} • Hết hạn: {formatExpiry(ban)}
                </div>
                {ban.reason && <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2 }}>Lý do: {ban.reason}</div>}
              </div>
              <button
                onClick={() => handleRevoke(ban)}
                disabled={pendingId === ban.id}
                title="Gỡ lệnh cấm"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'transparent', border: '1px solid #CBD5E1', borderRadius: 8, color: pendingId === ban.id ? '#CBD5E1' : '#334155', cursor: pendingId === ban.id ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 600 }}
              >
                <ShieldOff size={13} /> Gỡ cấm
              </button>
            </div>
          ))}
        </div>
      )}

      <BanUserModal isOpen={isBanModalOpen} onClose={() => setIsBanModalOpen(false)} onCreated={load} />
    </div>
  );
};
