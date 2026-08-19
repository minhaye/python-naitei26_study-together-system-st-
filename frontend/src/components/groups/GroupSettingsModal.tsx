import { useEffect, useState } from 'react';
import { Check, Globe, Lock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ApiError } from '../../lib/apiClient';
import { updateGroup } from '../../lib/group.api';
import type { Group } from '../../lib/group.types';

export interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  onUpdated: (updated: Group) => void;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

/** Owner-only Group settings (name/description/visibility). The backend independently
 * re-checks owner authority on PUT /groups/{id} -- this modal is only reachable for the
 * owner in the UI, never the sole authorization boundary. */
export function GroupSettingsModal({ isOpen, onClose, group, onUpdated }: GroupSettingsModalProps) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [isPublic, setIsPublic] = useState(group.is_public);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(group.name);
    setDescription(group.description ?? '');
    setIsPublic(group.is_public);
    setSaving(false);
    setError(null);
    setSuccess(false);
  }, [isOpen, group]);

  if (!isOpen) return null;

  const trimmedName = name.trim();

  const handleSave = async () => {
    if (saving) return;
    if (!trimmedName) {
      setError('Tên nhóm không được để trống');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateGroup(group.id, {
        name: trimmedName,
        description: description.trim() || null,
        is_public: isPublic,
      });
      onUpdated(updated);
      setSuccess(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const visibilityButtonStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px',
    borderRadius: 8,
    border: `1px solid ${active ? '#00236F' : '#E2E8F0'}`,
    background: active ? '#EEF2FF' : 'white',
    color: active ? '#00236F' : '#64748B',
    fontWeight: 600,
    fontSize: 13,
    cursor: saving ? 'not-allowed' : 'pointer',
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cài đặt nhóm học">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Tên nhóm *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            maxLength={100}
            style={{
              padding: '10px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
            placeholder="Mô tả ngắn về nhóm học (không bắt buộc)"
            style={{
              padding: '10px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
              resize: 'vertical',
              minHeight: 72,
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Chế độ hiển thị</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => !saving && setIsPublic(true)}
              disabled={saving}
              style={visibilityButtonStyle(isPublic)}
            >
              <Globe size={16} /> Công khai
            </button>
            <button
              type="button"
              onClick={() => !saving && setIsPublic(false)}
              disabled={saving}
              style={visibilityButtonStyle(!isPublic)}
            >
              <Lock size={16} /> Riêng tư
            </button>
          </div>
        </div>

        {error && <div style={{ color: '#EF4444', fontSize: 13 }}>{error}</div>}
        {success && !error && (
          <div style={{ color: '#16A34A', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={14} /> Đã lưu thay đổi
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !trimmedName}
          style={{
            padding: '10px',
            background: saving || !trimmedName ? '#94A3B8' : '#00236F',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            cursor: saving || !trimmedName ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </Modal>
  );
}
