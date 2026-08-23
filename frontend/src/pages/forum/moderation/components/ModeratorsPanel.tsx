import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { moderationApi } from '../../../../lib/moderation.api';
import { Avatar } from '../../../../components/ui/Avatar';
import { Button } from '../../../../components/ui/Button';
import { SearchInput } from '../../../../components/ui/SearchInput';
import { ApiError } from '../../../../lib/apiClient';
import type { Profile } from '../../../../lib/profile.types';
import { useAuth } from '../../../../hooks/useAuth';

export const ModeratorsPanel: React.FC = () => {
  const { profile: currentProfile } = useAuth();
  const [moderators, setModerators] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);

  const load = () => {
    setIsLoading(true);
    moderationApi
      .listModerators()
      .then(setModerators)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách kiểm duyệt viên.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      moderationApi.searchUsers(query).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleGrant = async (user: Profile) => {
    setPendingId(user.id);
    try {
      await moderationApi.updateUserRole(user.id, 'moderator');
      setQuery('');
      setResults([]);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể cấp quyền kiểm duyệt viên.');
    } finally {
      setPendingId(null);
    }
  };

  const handleRevoke = async (user: Profile) => {
    if (!window.confirm(`Thu hồi quyền kiểm duyệt viên của ${user.display_name ?? user.username}?`)) return;
    setPendingId(user.id);
    try {
      await moderationApi.updateUserRole(user.id, 'user');
      setModerators((prev) => prev.filter((m) => m.id !== user.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể thu hồi quyền kiểm duyệt viên.');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#0F172A' }}>Quản lý Kiểm duyệt viên</h3>

      {error && (
        <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
          Cấp quyền kiểm duyệt viên mới
        </label>
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên hoặc username..." />
        {results.length > 0 && (
          <div style={{ marginTop: 8, border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
            {results.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={u.display_name ?? u.username ?? '?'} src={u.avatar_url} size="sm" />
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A' }}>{u.display_name ?? u.username}</div>
                </div>
                {u.role === 'user' ? (
                  <Button variant="secondary" onClick={() => handleGrant(u)} disabled={pendingId === u.id}>
                    <UserPlus size={14} /> Cấp quyền
                  </Button>
                ) : (
                  <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Đã là {u.role === 'admin' ? 'Admin' : 'Kiểm duyệt viên'}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
        Danh sách hiện tại ({moderators.length})
      </div>

      {isLoading ? (
        <div style={{ color: '#64748B', fontSize: 13.5 }}>Đang tải...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {moderators.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={m.display_name ?? m.username ?? '?'} src={m.avatar_url} size="sm" />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A' }}>{m.display_name ?? m.username}</div>
                  <div style={{ fontSize: 12, color: m.role === 'admin' ? '#B91C1C' : '#7C3AED', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={12} /> {m.role === 'admin' ? 'Admin' : 'Kiểm duyệt viên'}
                  </div>
                </div>
              </div>
              {m.role === 'moderator' && (
                <button
                  onClick={() => handleRevoke(m)}
                  disabled={pendingId === m.id}
                  title="Thu hồi quyền"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'transparent', border: '1px solid #CBD5E1', borderRadius: 8, color: '#DC2626', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}
                >
                  <ShieldOff size={13} /> Thu hồi
                </button>
              )}
              {m.role === 'admin' && m.id === currentProfile?.id && (
                <span style={{ fontSize: 12, color: '#94A3B8' }}>Bạn</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
