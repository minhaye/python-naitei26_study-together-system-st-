import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ReasonPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => Promise<void> | void;
}

/** Modal dùng chung cho các hành động kiểm duyệt cần ghi lý do (xoá bài/bình luận vi phạm,
 * cấm người dùng...) -- lý do là tuỳ chọn, được gửi kèm lên backend để lưu vào lịch sử kiểm duyệt. */
export const ReasonPromptModal: React.FC<ReasonPromptModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = 'Xác nhận',
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {description && <p style={{ margin: 0, color: '#64748B', fontSize: 13.5 }}>{description}</p>}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Lý do (không bắt buộc)..."
        rows={3}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          outline: 'none',
          fontSize: 14,
          color: '#334155',
          resize: 'vertical',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Huỷ
        </Button>
        <Button variant="danger" onClick={handleConfirm} disabled={isSubmitting}>
          {isSubmitting ? 'Đang xử lý...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};
