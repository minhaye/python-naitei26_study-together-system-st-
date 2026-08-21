import { useEffect, useRef, useState } from 'react';
import { Check, Globe, ImageIcon, Lock, Trash2, Upload } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ApiError } from '../../lib/apiClient';
import { removeGroupBackground, updateGroup, uploadGroupBackground } from '../../lib/group.api';
import type { Group } from '../../lib/group.types';

export interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  onUpdated: (updated: Group) => void;
  /** Whether the caller may edit name/description/visibility -- owner-only, enforced
   * server-side too (PUT /groups/{id}). The background-image section below is NOT gated
   * by this: an active moderator may also open this modal (see StudyGroupDetail's
   * isGroupManager) and change the background, just not the rest of these settings. */
  isOwner: boolean;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

/** Group settings modal. Name/description/visibility stay owner-only (the backend
 * independently re-checks owner authority on PUT /groups/{id}). The background image is
 * owner-OR-moderator (POST/DELETE /groups/{id}/background) -- see `isOwner` prop doc. */
export function GroupSettingsModal({ isOpen, onClose, group, onUpdated, isOwner }: GroupSettingsModalProps) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [isPublic, setIsPublic] = useState(group.is_public);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(group.name);
    setDescription(group.description ?? '');
    setIsPublic(group.is_public);
    setSaving(false);
    setError(null);
    setSuccess(false);
    setBackgroundBusy(false);
    setBackgroundError(null);
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

  const handleBackgroundFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackgroundBusy(true);
    setBackgroundError(null);
    try {
      const updated = await uploadGroupBackground(group.id, file);
      onUpdated(updated);
    } catch (err) {
      setBackgroundError(errorMessage(err) || (err instanceof Error ? err.message : 'Không thể tải ảnh lên.'));
    } finally {
      setBackgroundBusy(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (backgroundBusy) return;
    setBackgroundBusy(true);
    setBackgroundError(null);
    try {
      const updated = await removeGroupBackground(group.id);
      onUpdated(updated);
    } catch (err) {
      setBackgroundError(errorMessage(err));
    } finally {
      setBackgroundBusy(false);
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
          <label style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Hình nền nhóm</label>
          <div
            style={{
              position: 'relative',
              height: 120,
              borderRadius: 8,
              overflow: 'hidden',
              background: group.background_url ? undefined : '#F1F5F9',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {group.background_url ? (
              <img
                src={group.background_url}
                alt="Hình nền nhóm"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <ImageIcon size={28} color="#94A3B8" />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleBackgroundFileChange}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={backgroundBusy}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                background: 'white',
                color: '#00236F',
                fontWeight: 600,
                fontSize: 13,
                cursor: backgroundBusy ? 'not-allowed' : 'pointer',
              }}
            >
              <Upload size={14} /> {backgroundBusy ? 'Đang xử lý...' : 'Tải ảnh lên'}
            </button>
            {group.background_url && (
              <button
                type="button"
                onClick={handleRemoveBackground}
                disabled={backgroundBusy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #FEE2E2',
                  background: 'white',
                  color: '#DC2626',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: backgroundBusy ? 'not-allowed' : 'pointer',
                }}
              >
                <Trash2 size={14} /> Xóa
              </button>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            Trưởng nhóm và điều hành viên có thể thay đổi hình nền. JPEG, PNG, WebP hoặc GIF, tối đa 5 MB.
          </span>
          {backgroundError && <div style={{ color: '#EF4444', fontSize: 13 }}>{backgroundError}</div>}
        </div>

        <div style={{ height: 1, background: '#E2E8F0' }} />

        {!isOwner && (
          <div style={{ color: '#94A3B8', fontSize: 12 }}>
            Chỉ trưởng nhóm mới có thể chỉnh sửa tên, mô tả và chế độ hiển thị.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Tên nhóm *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving || !isOwner}
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
            disabled={saving || !isOwner}
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
              onClick={() => isOwner && !saving && setIsPublic(true)}
              disabled={saving || !isOwner}
              style={visibilityButtonStyle(isPublic)}
            >
              <Globe size={16} /> Công khai
            </button>
            <button
              type="button"
              onClick={() => isOwner && !saving && setIsPublic(false)}
              disabled={saving || !isOwner}
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

        {isOwner && (
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
        )}
      </div>
    </Modal>
  );
}
