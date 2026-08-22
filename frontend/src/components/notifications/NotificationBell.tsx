import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../contexts/notification-context';
import { CountBadge } from '../ui/CountBadge';
import { NotificationDropdownModal } from './NotificationDropdownModal';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCounts } = useNotifications();

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Thông báo"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isOpen ? '#2563EB' : '#00236F',
          padding: 6,
          borderRadius: '50%',
          position: 'relative',
          transition: 'color 0.2s, background-color 0.2s',
        }}
        className="hover:bg-slate-100"
      >
        <Bell size={21} strokeWidth={2.4} />
        <CountBadge count={unreadCounts.total} style={{ top: -2, right: -4 }} />
      </button>

      <NotificationDropdownModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
};
