import React, { useEffect, useState } from 'react';
import { FileText, MessageSquare, Users, UserPlus, DoorOpen, Check } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { SearchInput } from '../../../../components/ui/SearchInput';
import { Avatar } from '../../../../components/ui/Avatar';
import { moderationApi } from '../../../../lib/moderation.api';
import { BAN_TYPE_LABELS, type BanType, type DurationType } from '../../../../lib/moderation.types';
import { fetchProfile } from '../../../../lib/profile.api';
import type { Profile } from '../../../../lib/profile.types';
import { ApiError } from '../../../../lib/apiClient';

const BAN_TYPES: BanType[] = ['post', 'message', 'create_group', 'join_group', 'join_room'];

const BAN_TYPE_ICONS: Record<BanType, React.ComponentType<{ size?: number; color?: string }>> = {
  post: FileText,
  message: MessageSquare,
  create_group: Users,
  join_group: UserPlus,
  join_room: DoorOpen,
};

const DURATION_OPTIONS: { value: DurationType; label: string }[] = [
  { value: 'day', label: 'Ngày' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
  { value: 'year', label: 'Năm' },
  { value: 'permanent', label: 'Vĩnh viễn' },
  { value: 'custom', label: 'Tùy chỉnh' },
];

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: '#64748B',
  marginBottom: 10,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

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

export interface BanUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Nếu truyền sẵn, bỏ qua bước tìm kiếm người dùng (mở modal thẳng từ 1 dòng cụ thể). */
  presetUser?: Profile | null;
  /** Thay thế cho presetUser khi chỉ có sẵn userId (VD: mở từ popover click-user) --
   * modal tự fetch profile đầy đủ khi mở. */
  presetUserId?: string | null;
}

export const BanUserModal: React.FC<BanUserModalProps> = ({ isOpen, onClose, onCreated, presetUser, presetUserId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(presetUser ?? null);
  const [banTypes, setBanTypes] = useState<BanType[]>([]);
  const [durationType, setDurationType] = useState<DurationType>('day');
  const [durationValue, setDurationValue] = useState(1);
  const [customExpiresAt, setCustomExpiresAt] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedUser(presetUser ?? null);
    setQuery('');
    setResults([]);
    setBanTypes([]);
    setDurationType('day');
    setDurationValue(1);
    setCustomExpiresAt('');
    setReason('');
    setError(null);

    if (!presetUser && presetUserId) {
      fetchProfile(presetUserId)
        .then(setSelectedUser)
        .catch(() => setError('Không thể tải thông tin người dùng.'));
    }
  }, [isOpen, presetUser, presetUserId]);

  useEffect(() => {
    if (!query.trim() || selectedUser) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      moderationApi.searchUsers(query).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedUser]);

  const toggleBanType = (type: BanType) => {
    setBanTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const showStepper = durationType === 'day' || durationType === 'week' || durationType === 'month' || durationType === 'year';
  const durationUnitLabel = DURATION_OPTIONS.find((o) => o.value === durationType)?.label ?? '';

  const handleSubmit = async () => {
    if (!selectedUser) {
      setError('Vui lòng chọn người dùng cần cấm.');
      return;
    }
    if (banTypes.length === 0) {
      setError('Vui lòng chọn ít nhất một loại lệnh cấm.');
      return;
    }
    if (durationType === 'custom' && !customExpiresAt) {
      setError('Vui lòng chọn ngày hết hạn.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await moderationApi.createBan({
        user_id: selectedUser.id,
        ban_types: banTypes,
        duration_type: durationType,
        duration_value: durationType === 'permanent' || durationType === 'custom' ? null : durationValue,
        custom_expires_at: durationType === 'custom' ? new Date(customExpiresAt).toISOString() : null,
        reason: reason.trim() || null,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tạo lệnh cấm.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cấm người dùng">
      {error && (
        <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div>
        <label style={sectionLabelStyle}>Người dùng</label>
        {!selectedUser ? (
          <div>
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc username..."
            />
            {results.length > 0 && (
              <div style={{ marginTop: 8, border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                {results.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
                    onMouseOver={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Avatar name={u.display_name ?? u.username ?? '?'} src={u.avatar_url} size="sm" />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A' }}>{u.display_name ?? u.username}</div>
                      {u.username && <div style={{ fontSize: 12, color: '#64748B' }}>@{u.username}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={selectedUser.display_name ?? selectedUser.username ?? '?'} src={selectedUser.avatar_url} size="sm" />
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A' }}>
                {selectedUser.display_name ?? selectedUser.username}
              </div>
            </div>
            {!presetUser && !presetUserId && (
              <button
                onClick={() => setSelectedUser(null)}
                style={{ background: 'none', border: 'none', color: '#1D4ED8', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Đổi
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <label style={sectionLabelStyle}>Phạm vi giới hạn</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {BAN_TYPES.map((type) => {
            const Icon = BAN_TYPE_ICONS[type];
            const selected = banTypes.includes(type);
            return (
              <div
                key={type}
                onClick={() => toggleBanType(type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: selected ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                  background: selected ? '#FEF2F2' : 'white',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: selected ? '#FEE2E2' : '#F1F5F9',
                }}>
                  <Icon size={15} color={selected ? '#DC2626' : '#64748B'} />
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: selected ? '#B91C1C' : '#334155', lineHeight: 1.3 }}>
                  {BAN_TYPE_LABELS[type]}
                </span>
                <div style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: selected ? 'none' : '1.5px solid #CBD5E1',
                  background: selected ? '#DC2626' : 'transparent',
                }}>
                  {selected && <Check size={12} color="white" strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label style={sectionLabelStyle}>Thời hạn</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: showStepper || durationType === 'custom' ? 10 : 0 }}>
          {DURATION_OPTIONS.map((opt) => {
            const selected = durationType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDurationType(opt.value)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: selected ? '1px solid #00236F' : '1px solid #E2E8F0',
                  background: selected ? '#00236F' : 'white',
                  color: selected ? 'white' : '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {showStepper && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setDurationValue((v) => Math.max(1, v - 1))}
                style={{ width: 34, height: 36, border: 'none', background: '#F8FAFC', color: '#334155', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={durationValue}
                onChange={(e) => setDurationValue(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 56, height: 36, border: 'none', borderLeft: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', textAlign: 'center', fontSize: 14, color: '#0F172A', outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => setDurationValue((v) => v + 1)}
                style={{ width: 34, height: 36, border: 'none', background: '#F8FAFC', color: '#334155', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
              >
                +
              </button>
            </div>
            <span style={{ fontSize: 13.5, color: '#64748B' }}>{durationUnitLabel}</span>
          </div>
        )}

        {durationType === 'custom' && (
          <input
            type="datetime-local"
            value={customExpiresAt}
            onChange={(e) => setCustomExpiresAt(e.target.value)}
            style={fieldStyle}
          />
        )}
      </div>

      <div>
        <label style={sectionLabelStyle}>Lý do</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Lý do (không bắt buộc)..."
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '1px solid #F1F5F9' }}>
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Huỷ
        </Button>
        <Button variant="danger" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Đang xử lý...' : 'Cấm người dùng'}
        </Button>
      </div>
    </Modal>
  );
};
