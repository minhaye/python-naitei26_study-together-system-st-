import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ApiError } from '../../lib/apiClient';
import { resolveInvitation, redeemInvitation } from '../../lib/invitation.api';
import { targetRoute, TARGET_TYPE_LABEL, JOIN_ACTION_LABEL } from '../../lib/invitationNavigation';
import type { InvitationPreview, InvitationTarget, InvitationTargetType } from '../../lib/invitation.types';

export interface JoinByCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which invitation target type this entry point is for -- a resolved code whose actual
   * target doesn't match is rejected with a clear "use the other action" message rather
   * than silently redeeming into the wrong place. */
  expectedTarget: InvitationTargetType;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

/** Reusable target-aware "join by invitation code" flow: code -> resolve -> (mismatch
 * explained, or preview) -> redeem -> navigate to the real target from the backend response.
 * One backend invitation system (see app/invitations/), three distinct, explicit frontend
 * entry points (Join Group / Join Study Room / Join Private Channel) via `expectedTarget`. */
export function JoinByCodeModal({ isOpen, onClose, expectedTarget }: JoinByCodeModalProps) {
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<InvitationTarget | null>(null);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [groupRequired, setGroupRequired] = useState<InvitationTarget | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCode('');
    setResolveError(null);
    setMismatch(null);
    setPreview(null);
    setRedeemError(null);
    setGroupRequired(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleContinue = async () => {
    if (!code.trim() || resolving) return;
    setResolving(true);
    setResolveError(null);
    setMismatch(null);
    try {
      const resolved = await resolveInvitation(code.trim());
      if (resolved.target.type !== expectedTarget) {
        setMismatch(resolved.target);
      } else {
        setPreview(resolved);
      }
    } catch (err) {
      setResolveError(errorMessage(err));
    } finally {
      setResolving(false);
    }
  };

  const handleJoin = async () => {
    if (redeeming) return;
    setRedeeming(true);
    setRedeemError(null);
    setGroupRequired(null);
    try {
      const result = await redeemInvitation(code.trim());
      if (result.outcome === 'group_membership_required') {
        setGroupRequired(result.target);
        return;
      }
      onClose();
      navigate(targetRoute(result.target));
    } catch (err) {
      setRedeemError(errorMessage(err));
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={JOIN_ACTION_LABEL[expectedTarget]}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!preview && !mismatch && (
          <>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ticket size={16} /> Mã mời
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setResolveError(null); }}
              placeholder="K9XR-7P2M"
              autoFocus
              style={{ padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none' }}
            />
            {resolveError && <div style={{ color: '#EF4444', fontSize: 13 }}>{resolveError}</div>}
            <button
              onClick={handleContinue}
              disabled={!code.trim() || resolving}
              style={{
                padding: '10px',
                background: !code.trim() || resolving ? '#94A3B8' : '#00236F',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: !code.trim() || resolving ? 'not-allowed' : 'pointer',
              }}
            >
              {resolving ? 'Đang kiểm tra...' : 'Tiếp tục'}
            </button>
          </>
        )}

        {mismatch && (
          <>
            <div style={{ color: '#B91C1C', fontSize: 13, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12 }}>
              Mã này dùng cho {TARGET_TYPE_LABEL[mismatch.type]}, không phải {TARGET_TYPE_LABEL[expectedTarget]}. Vui
              lòng dùng chức năng "{JOIN_ACTION_LABEL[mismatch.type]}".
            </div>
            <button
              onClick={() => { setMismatch(null); setCode(''); }}
              style={{ padding: '10px', background: 'white', color: '#00236F', border: '1px solid #00236F', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
            >
              Nhập mã khác
            </button>
          </>
        )}

        {preview && (
          <>
            <div style={{ fontSize: 13, color: '#64748B' }}>{TARGET_TYPE_LABEL[preview.target.type]}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{preview.target.name}</div>
            {preview.target.type !== 'group' && (
              <div style={{ fontSize: 12, color: '#94A3B8' }}>Thuộc nhóm: {preview.target.group_name}</div>
            )}
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Được mời bởi {preview.inviter_name}</div>

            {groupRequired && (
              <div style={{ color: '#92400E', fontSize: 13, background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span>
                  Bạn cần tham gia nhóm "{groupRequired.group_name}" trước khi có thể vào đây.
                </span>
                <button
                  onClick={() => { onClose(); navigate(`/groups/${groupRequired.group_id}`); }}
                  style={{ alignSelf: 'flex-start', padding: '6px 12px', background: '#00236F', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                >
                  Đến trang Nhóm học
                </button>
              </div>
            )}
            {redeemError && <div style={{ color: '#EF4444', fontSize: 13 }}>{redeemError}</div>}

            <button
              onClick={handleJoin}
              disabled={redeeming}
              style={{
                padding: '10px',
                background: redeeming ? '#94A3B8' : '#00236F',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: redeeming ? 'not-allowed' : 'pointer',
              }}
            >
              {redeeming ? 'Đang tham gia...' : JOIN_ACTION_LABEL[expectedTarget]}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
