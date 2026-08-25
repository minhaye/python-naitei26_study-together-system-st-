import { Modal } from '../../../components/ui/Modal';

interface WhiteboardUnavailableModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhiteboardUnavailableModal({ isOpen, onClose }: WhiteboardUnavailableModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bảng trắng hiện không khả dụng">
      <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
        Tính năng Bảng trắng hiện không khả dụng trên phiên bản triển khai do giới hạn giấy phép của Tldraw. Vui lòng chạy hệ thống trên localhost để sử dụng tính năng này.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Đã hiểu
        </button>
      </div>
    </Modal>
  );
}
