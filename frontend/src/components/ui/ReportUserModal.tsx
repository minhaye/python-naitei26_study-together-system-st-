import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { moderationApi } from '../../lib/moderation.api';
import { REPORT_REASON_LABELS, type ReportReason } from '../../lib/moderation.types';
import { fetchProfile } from '../../lib/profile.api';
import type { Profile } from '../../lib/profile.types';
import { ApiError } from '../../lib/apiClient';

const REPORT_REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  fontSize: 14,
  color: '#0F172A',
  background: 'white',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
};

export interface ReportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedUserId: string;
}

/** Popup any logged-in user can open (via ProfilePage's "Báo cáo" button) to report
 * another user for moderator review -- see ReportsTable.tsx for the moderator-facing side. */
export const ReportUserModal: React.FC<ReportUserModalProps> = ({ isOpen, onClose, reportedUserId }) => {
  const [target, setTarget] = useState<Profile | null>(null);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTarget(null);
    setReason('');
    setDescription('');
    setIsSubmitted(false);
    setError(null);
    fetchProfile(reportedUserId)
      .then(setTarget)
      .catch(() => setError('Không thể tải thông tin người dùng.'));
  }, [isOpen, reportedUserId]);

  const handleSubmit = async () => {
    if (!reason) {
      setError('Vui lòng chọn lý do báo cáo.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await moderationApi.createReport({
        reported_user_id: reportedUserId,
        reason,
        description: description.trim() || null,
      });
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể gửi báo cáo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = target ? `Báo cáo ${target.display_name ?? target.username}` : 'Báo cáo người dùng';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {isSubmitted ? (
        <>
          <p style={{ margin: 0, color: '#334155', fontSize: 14 }}>
            Cảm ơn bạn đã báo cáo. Đội ngũ kiểm duyệt sẽ xem xét và xử lý sớm nhất có thể.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </>
      ) : (
        <>
          {error && (
            <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
              Lý do
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              style={fieldStyle}
            >
              <option value="" disabled>
                Chọn lý do báo cáo...
              </option>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REPORT_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
              Chi tiết (không bắt buộc)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Mô tả thêm về hành vi vi phạm..."
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Huỷ
            </Button>
            <Button variant="danger" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Đang gửi...' : 'Gửi báo cáo'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};
