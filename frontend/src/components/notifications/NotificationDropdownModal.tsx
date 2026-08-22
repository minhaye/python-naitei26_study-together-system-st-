import React, { useEffect, useRef } from 'react';
import { CheckCheck, X } from 'lucide-react';
import type { NotificationCategory } from '../../types/notification';
import { useNotifications } from '../../contexts/notification-context';
import { NotificationTabContent } from './NotificationTabContent';
import { CountBadge } from '../ui/CountBadge';

interface NotificationDropdownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABS: { key: NotificationCategory; label: string; icon: string }[] = [
  { key: 'forum', label: 'Diễn đàn', icon: '💬' },
  { key: 'group', label: 'Nhóm học', icon: '👥' },
  { key: 'goal', label: 'Mục tiêu', icon: '🎯' },
  { key: 'message', label: 'Tin nhắn', icon: '✉️' },
];

export const NotificationDropdownModal: React.FC<NotificationDropdownModalProps> = ({
  isOpen,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCounts,
    isLoading,
    activeCategory,
    setActiveCategory,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentTabUnread = unreadCounts[activeCategory] || 0;

  return (
    <div
      ref={modalRef}
      style={{
        position: 'absolute',
        top: 48,
        right: 0,
        width: 420,
        maxWidth: 'calc(100vw - 32px)',
        backgroundColor: 'white',
        borderRadius: 16,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px 12px 20px',
          borderBottom: '1px solid #F1F5F9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
            Thông báo
          </h3>
          {unreadCounts.total > 0 && (
            <span
              style={{
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 12,
              }}
            >
              {unreadCounts.total} chưa đọc
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => markAllAsRead(activeCategory)}
            title="Đánh dấu tất cả đã đọc"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              color: '#2563EB',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              transition: 'background-color 0.15s ease',
            }}
            className="hover:bg-blue-50"
          >
            <CheckCheck size={16} />
            <span style={{ display: 'inline' }}>Đã đọc</span>
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: 4,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 4 Tabs Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 12px',
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          overflowX: 'auto',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeCategory === tab.key;
          const count = unreadCounts[tab.key] || 0;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: isActive ? 'white' : 'transparent',
                color: isActive ? '#0F172A' : '#64748B',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
                position: 'relative',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <CountBadge count={count} style={{ position: 'relative', top: 'auto', right: 'auto' }} />
            </button>
          );
        })}
      </div>

      {/* Tab List Content */}
      <div style={{ padding: '8px 4px' }}>
        <NotificationTabContent
          notifications={notifications}
          activeCategory={activeCategory}
          isLoading={isLoading}
          onMarkAsRead={markAsRead}
          onCloseModal={onClose}
        />
      </div>

      {/* Footer Bar */}
      {currentTabUnread > 0 && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => markAllAsRead(activeCategory)}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563EB',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Đánh dấu đọc tất cả mục {TABS.find((t) => t.key === activeCategory)?.label}
          </button>
        </div>
      )}
    </div>
  );
};
