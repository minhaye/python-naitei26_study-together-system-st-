import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { moderationApi } from '../../../../lib/moderation.api';
import { MODERATION_ACTION_LABELS, type ModerationActionResponse } from '../../../../lib/moderation.types';
import { ApiError } from '../../../../lib/apiClient';

const ACTION_COLORS: Record<string, string> = {
  delete_post: '#DC2626',
  delete_comment: '#DC2626',
  ban_user: '#B91C1C',
  unban_user: '#16A34A',
  grant_moderator: '#7C3AED',
  revoke_moderator: '#7C3AED',
};

export const ModerationActionsLog: React.FC = () => {
  const [actions, setActions] = useState<ModerationActionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    moderationApi
      .listActions({ limit: 100 })
      .then(setActions)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không thể tải lịch sử kiểm duyệt.'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
        <History size={18} /> Lịch sử kiểm duyệt
      </h3>

      {error && (
        <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ color: '#64748B', fontSize: 13.5 }}>Đang tải...</div>
      ) : actions.length === 0 ? (
        <div style={{ color: '#94A3B8', fontSize: 13.5 }}>Chưa có hành động kiểm duyệt nào.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actions.map((action) => (
            <div key={action.id} style={{ padding: '12px 14px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: ACTION_COLORS[action.action] ?? '#334155' }}>
                  {MODERATION_ACTION_LABELS[action.action]}
                </span>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{new Date(action.created_at).toLocaleString('vi-VN')}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
                Bởi <strong>{action.moderator_name ?? action.moderator_id}</strong>
                {action.target_user_name && (
                  <>
                    {' '}
                    → <strong>{action.target_user_name}</strong>
                  </>
                )}
              </div>
              {action.reason && <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 4 }}>Lý do: {action.reason}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
