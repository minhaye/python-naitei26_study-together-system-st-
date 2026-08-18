/**
 * PendingInvitationsBell — Chuông hiển thị các lời mời (Group/Study Room/Private Channel)
 * đang chờ, gửi tới email đã xác thực của người dùng hiện tại. Chỉ hiển thị invitation --
 * không phải trung tâm thông báo tổng quát (out of scope, xem docs/invitations.md).
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X } from 'lucide-react';
import { ApiError } from '../../lib/apiClient';
import { declineInvitation, listIncomingInvitations, redeemInvitationById } from '../../lib/invitation.api';
import type { Invitation } from '../../lib/invitation.types';

function targetLabel(invitation: Invitation): string {
  if (invitation.group_id) return 'nhóm học';
  if (invitation.room_id) return 'phòng học';
  return 'kênh riêng tư';
}

export function PendingInvitationsBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listIncomingInvitations()
      .then(setInvitations)
      .catch(() => {
        /* Silent: the bell should never break page load if this fails. */
      });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleOpen() {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setLoading(true);
        setError(null);
        listIncomingInvitations()
          .then(setInvitations)
          .catch((err) => setError(err instanceof ApiError ? err.message : 'Không thể tải lời mời.'))
          .finally(() => setLoading(false));
      }
      return next;
    });
  }

  async function handleAccept(invitation: Invitation) {
    setBusyId(invitation.id);
    setError(null);
    try {
      const result = await redeemInvitationById(invitation.id);
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      if (result.outcome === 'group_membership_required') {
        navigate(`/groups/${result.target.group_id}`);
        return;
      }
      setIsOpen(false);
      if (result.target.type === 'group') navigate(`/groups/${result.target.id}`);
      else if (result.target.type === 'study_room') navigate(`/room/${result.target.id}`);
      else navigate(`/groups/${result.target.group_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tham gia.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(invitation: Invitation) {
    setBusyId(invitation.id);
    setError(null);
    try {
      await declineInvitation(invitation.id);
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể từ chối.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }} onClick={toggleOpen}>
        <Bell size={20} color="#444651" />
        {invitations.length > 0 && (
          <div
            style={{
              position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%',
              background: '#EF4444', color: 'white', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {invitations.length > 9 ? '9+' : invitations.length}
          </div>
        )}
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute', top: 32, right: 0, width: 320, maxHeight: 400, overflowY: 'auto',
            background: 'white', borderRadius: 12, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            border: '1px solid #E2E8F0', zIndex: 50, padding: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Lời mời đang chờ</div>
          {loading && <div style={{ color: '#64748B', fontSize: 13 }}>Đang tải...</div>}
          {error && <div style={{ color: '#B91C1C', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          {!loading && invitations.length === 0 && (
            <div style={{ color: '#94A3B8', fontSize: 13 }}>Không có lời mời nào.</div>
          )}
          {invitations.map((invitation) => (
            <div key={invitation.id} style={{ padding: '8px 0', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 13, color: '#0F172A' }}>Bạn được mời tham gia {targetLabel(invitation)}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleDecline(invitation)}
                  disabled={busyId === invitation.id}
                  style={{ flex: 1, padding: '6px', background: 'white', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: busyId === invitation.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  <X size={12} /> Từ chối
                </button>
                <button
                  onClick={() => handleAccept(invitation)}
                  disabled={busyId === invitation.id}
                  style={{ flex: 1, padding: '6px', background: '#00236F', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: busyId === invitation.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  <Check size={12} /> Tham gia
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
