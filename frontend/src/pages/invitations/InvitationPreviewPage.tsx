/**
 * InvitationPreviewPage — Trang xem trước lời mời từ link email hoặc mã nhập tay.
 *
 * Route: /invitations/:secret (public -- không yêu cầu đăng nhập để xem trước;
 * Accept/Decline yêu cầu đăng nhập, được backend enforce lại độc lập).
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, Mail, Ticket } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/apiClient';
import { resolveInvitation, redeemInvitation, declineInvitation } from '../../lib/invitation.api';
import type { InvitationPreview } from '../../lib/invitation.types';

const TARGET_LABEL: Record<InvitationPreview['target']['type'], string> = {
  group: 'Nhóm học',
  study_room: 'Phòng học',
  private_channel: 'Kênh riêng tư',
};

export function InvitationPreviewPage() {
  const { secret } = useParams<{ secret: string }>();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    if (!secret) return;
    setLoading(true);
    resolveInvitation(secret)
      .then(setPreview)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Không thể tải lời mời này.'))
      .finally(() => setLoading(false));
  }, [secret]);

  async function handleAccept() {
    if (!secret || accepting) return;
    setAccepting(true);
    setActionError(null);
    try {
      const result = await redeemInvitation(secret);
      if (result.outcome === 'group_membership_required') {
        setActionError(
          `Bạn cần tham gia nhóm "${result.target.group_name}" trước khi có thể vào đây.`
        );
        return;
      }
      if (result.target.type === 'group') {
        navigate(`/groups/${result.target.id}`);
      } else if (result.target.type === 'study_room') {
        navigate(`/room/${result.target.id}`);
      } else {
        navigate(`/groups/${result.target.group_id}`);
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không thể chấp nhận lời mời này.');
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    if (!preview || declining) return;
    setDeclining(true);
    setActionError(null);
    try {
      await declineInvitation(preview.id);
      setDeclined(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không thể từ chối lời mời này.');
    } finally {
      setDeclining(false);
    }
  }

  if (loading || authLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
        <Loader2 className="animate-spin" size={20} style={{ marginRight: 8 }} /> Đang tải lời mời...
      </div>
    );
  }

  if (loadError || !preview) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ color: '#B91C1C', fontSize: 15 }}>{loadError ?? 'Lời mời không tồn tại hoặc đã hết hạn.'}</div>
        <Link to="/groups" style={{ color: '#00236F', fontSize: 14, fontWeight: 600 }}>Về danh sách nhóm học</Link>
      </div>
    );
  }

  if (declined) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ color: '#0F172A', fontSize: 15 }}>Bạn đã từ chối lời mời này.</div>
        <Link to="/groups" style={{ color: '#00236F', fontSize: 14, fontWeight: 600 }}>Về danh sách nhóm học</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 420, background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
        {preview.method === 'email' ? <Mail size={32} color="#00236F" /> : <Ticket size={32} color="#00236F" />}
        <div style={{ color: '#64748B', fontSize: 13 }}>{preview.inviter_name} đã mời bạn tham gia</div>
        <div style={{ color: '#0F172A', fontSize: 20, fontWeight: 700 }}>{preview.target.name}</div>
        <div style={{ color: '#94A3B8', fontSize: 13 }}>{TARGET_LABEL[preview.target.type]}</div>
        {preview.target.type !== 'group' && (
          <div style={{ color: '#94A3B8', fontSize: 12 }}>Thuộc nhóm: {preview.target.group_name}</div>
        )}
        <div style={{ color: '#94A3B8', fontSize: 12 }}>
          Hết hạn lúc {new Date(preview.expires_at).toLocaleString()}
        </div>

        {actionError && (
          <div style={{ width: '100%', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, color: '#B91C1C', fontSize: 13, boxSizing: 'border-box' }}>
            {actionError}
          </div>
        )}

        {!isLoggedIn ? (
          <button
            onClick={() => navigate('/login')}
            style={{ width: '100%', padding: '12px', background: '#00236F', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
          >
            Đăng nhập để tham gia
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 12, width: '100%' }}>
            {preview.method === 'email' && (
              <button
                onClick={handleDecline}
                disabled={declining || accepting}
                style={{ flex: 1, padding: '12px', background: 'white', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 8, fontWeight: 600, cursor: declining ? 'not-allowed' : 'pointer' }}
              >
                {declining ? 'Đang từ chối...' : 'Từ chối'}
              </button>
            )}
            <button
              onClick={handleAccept}
              disabled={accepting || declining}
              style={{ flex: 1, padding: '12px', background: accepting ? '#94A3B8' : '#00236F', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: accepting ? 'not-allowed' : 'pointer' }}
            >
              {accepting ? 'Đang tham gia...' : 'Tham gia'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
