import { useEffect, useState } from 'react';
import { Mail, Ticket, Copy, Check, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ApiError } from '../../lib/apiClient';
import { createInvitation, getActiveCode, revokeInvitation } from '../../lib/invitation.api';
import type { ActiveCodeInfo, InvitationTargetRef } from '../../lib/invitation.types';

export interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: InvitationTargetRef;
  targetLabel: string;
}

type Tab = 'email' | 'code';

function formatCountdown(expiresAt: string, now: number): string {
  const remainingMs = new Date(expiresAt).getTime() - now;
  if (remainingMs <= 0) return '00:00';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

export function InviteModal({ isOpen, onClose, target, targetLabel }: InviteModalProps) {
  const [tab, setTab] = useState<Tab>('email');

  // Email tab
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Code tab
  const [activeCode, setActiveCode] = useState<ActiveCodeInfo | null>(null);
  const [freshCode, setFreshCode] = useState<string | null>(null); // plaintext, only right after generating
  const [loadingCode, setLoadingCode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    setTab('email');
    setEmail('');
    setSendError(null);
    setSentTo(null);
    setFreshCode(null);
    setCodeError(null);
    setCopied(false);
  }, [isOpen, target.groupId, target.roomId, target.channelId]);

  useEffect(() => {
    if (!isOpen || tab !== 'code') return;
    let cancelled = false;
    setLoadingCode(true);
    setCodeError(null);
    getActiveCode(target)
      .then((info) => {
        if (!cancelled) setActiveCode(info);
      })
      .catch((err) => {
        if (!cancelled) setCodeError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingCode(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tab, target.groupId, target.roomId, target.channelId]);

  useEffect(() => {
    if (!isOpen || tab !== 'code') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOpen, tab]);

  if (!isOpen) return null;

  const handleSendEmail = async () => {
    setSendError(null);
    setSending(true);
    try {
      const created = await createInvitation(target, 'email', email.trim());
      setSentTo(created.recipient_email);
      setEmail('');
    } catch (err) {
      setSendError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleGenerateCode = async () => {
    setCodeError(null);
    setGenerating(true);
    setCopied(false);
    try {
      const created = await createInvitation(target, 'code');
      setFreshCode(created.code);
      setActiveCode({ id: created.id, expires_at: created.expires_at });
    } catch (err) {
      setCodeError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!activeCode) return;
    setCodeError(null);
    setRevoking(true);
    try {
      await revokeInvitation(activeCode.id);
      setActiveCode(null);
      setFreshCode(null);
    } catch (err) {
      setCodeError(errorMessage(err));
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = () => {
    if (!freshCode) return;
    navigator.clipboard?.writeText(freshCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 0',
    textAlign: 'center',
    fontWeight: 600,
    fontSize: 14,
    color: isActive ? '#00236F' : '#64748B',
    borderBottom: isActive ? '2px solid #00236F' : '2px solid transparent',
    background: 'transparent',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: isActive ? '#00236F' : 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mời vào "${targetLabel}"`}>
      <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0' }}>
        <button style={tabButtonStyle(tab === 'email')} onClick={() => setTab('email')}>
          <Mail size={16} /> Email
        </button>
        <button style={tabButtonStyle(tab === 'code')} onClick={() => setTab('code')}>
          <Ticket size={16} /> Mã mời
        </button>
      </div>

      {tab === 'email' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Địa chỉ email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            disabled={sending}
            style={{
              padding: '10px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
            }}
          />
          {sendError && <div style={{ color: '#EF4444', fontSize: 13 }}>{sendError}</div>}
          {sentTo && (
            <div style={{ color: '#16A34A', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} /> Đã gửi lời mời tới {sentTo}
            </div>
          )}
          <button
            onClick={handleSendEmail}
            disabled={sending || !email.trim()}
            style={{
              padding: '10px',
              background: sending || !email.trim() ? '#94A3B8' : '#00236F',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: sending || !email.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {sending ? 'Đang gửi...' : 'Gửi lời mời'}
          </button>
        </div>
      )}

      {tab === 'code' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
          {codeError && <div style={{ color: '#EF4444', fontSize: 13 }}>{codeError}</div>}
          {loadingCode && <div style={{ color: '#64748B', fontSize: 13 }}>Đang tải...</div>}

          {!loadingCode && freshCode && activeCode && (
            <>
              <div
                style={{
                  padding: '16px',
                  background: '#F8FAFC',
                  border: '1px dashed #94A3B8',
                  borderRadius: 8,
                  textAlign: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: '#0F172A',
                }}
              >
                {freshCode}
              </div>
              <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center' }}>
                Còn hiệu lực: {formatCountdown(activeCode.expires_at, now)} (hết hạn lúc{' '}
                {new Date(activeCode.expires_at).toLocaleTimeString()})
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'white',
                    color: '#00236F',
                    border: '1px solid #00236F',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Đã sao chép' : 'Sao chép mã'}
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'white',
                    color: '#EF4444',
                    border: '1px solid #EF4444',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: revoking ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <X size={16} /> {revoking ? 'Đang hủy...' : 'Hủy mã'}
                </button>
              </div>
            </>
          )}

          {!loadingCode && !freshCode && activeCode && (
            <>
              <div style={{ fontSize: 13, color: '#0F172A' }}>
                Đang có một mã mời hoạt động, hết hạn sau {formatCountdown(activeCode.expires_at, now)}. Mã đã tạo
                trước đó không thể hiển thị lại — tạo mã mới sẽ hủy mã hiện tại.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleGenerateCode}
                  disabled={generating}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: generating ? '#94A3B8' : '#00236F',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: generating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {generating ? 'Đang tạo...' : 'Tạo mã mới'}
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'white',
                    color: '#EF4444',
                    border: '1px solid #EF4444',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: revoking ? 'not-allowed' : 'pointer',
                  }}
                >
                  {revoking ? 'Đang hủy...' : 'Hủy mã'}
                </button>
              </div>
            </>
          )}

          {!loadingCode && !freshCode && !activeCode && (
            <>
              <div style={{ fontSize: 13, color: '#64748B' }}>
                Chưa có mã mời nào đang hoạt động. Mã mời có hiệu lực trong 5 phút.
              </div>
              <button
                onClick={handleGenerateCode}
                disabled={generating}
                style={{
                  padding: '10px',
                  background: generating ? '#94A3B8' : '#00236F',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: generating ? 'not-allowed' : 'pointer',
                }}
              >
                {generating ? 'Đang tạo...' : 'Tạo mã mời'}
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
