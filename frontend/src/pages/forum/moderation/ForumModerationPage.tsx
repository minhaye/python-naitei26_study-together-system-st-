import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Flag, History, ShieldCheck, UserX } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { PostsModerationTable } from './components/PostsModerationTable';
import { BannedUsersTable } from './components/BannedUsersTable';
import { ReportsTable } from './components/ReportsTable';
import { ModerationActionsLog } from './components/ModerationActionsLog';
import { ModeratorsPanel } from './components/ModeratorsPanel';

type TabKey = 'posts' | 'reports' | 'bans' | 'history' | 'moderators';

export const ForumModerationPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<TabKey>('posts');

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'posts', label: 'Bài viết', icon: <FileText size={15} /> },
    { key: 'reports', label: 'Báo cáo', icon: <Flag size={15} /> },
    { key: 'bans', label: 'Người dùng bị cấm', icon: <UserX size={15} /> },
    { key: 'history', label: 'Lịch sử', icon: <History size={15} /> },
    ...(isAdmin ? [{ key: 'moderators' as TabKey, label: 'Kiểm duyệt viên', icon: <ShieldCheck size={15} /> }] : []),
  ];

  return (
    <div style={{ width: '100%', flex: 1, background: '#F8FAFC', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 900, padding: '32px 24px' }}>
        <Link
          to="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#1D4ED8', fontWeight: 600, fontSize: 14, textDecoration: 'none', marginBottom: 16 }}
        >
          <ArrowLeft size={18} /> Quay lại diễn đàn
        </Link>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={24} color="#7C3AED" /> Trang Kiểm duyệt viên
        </h1>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E2E8F0', marginBottom: 20 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                borderBottom: tab === t.key ? '2px solid #7C3AED' : '2px solid transparent',
                color: tab === t.key ? '#7C3AED' : '#64748B',
                fontWeight: 600,
                fontSize: 13.5,
                cursor: 'pointer',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'posts' && <PostsModerationTable />}
        {tab === 'reports' && <ReportsTable />}
        {tab === 'bans' && <BannedUsersTable />}
        {tab === 'history' && <ModerationActionsLog />}
        {tab === 'moderators' && isAdmin && <ModeratorsPanel />}
      </div>
    </div>
  );
};
