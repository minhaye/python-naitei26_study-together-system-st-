import React, { useEffect, useRef, useState } from 'react';
import { CheckCheck, X, MoreHorizontal } from 'lucide-react';
import type { NotificationCategory } from '../../types/notification';
import { useNotifications } from '../../contexts/notification-context';
import { NotificationTabContent } from './NotificationTabContent';
import { CountBadge } from '../ui/CountBadge';

interface NotificationDropdownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABS: { key: NotificationCategory; label: string }[] = [
  { key: 'forum', label: 'Diễn đàn' },
  { key: 'group', label: 'Nhóm học' },
  { key: 'goal', label: 'Mục tiêu' },
  { key: 'message', label: 'Tin nhắn' },
];

export const NotificationDropdownModal: React.FC<NotificationDropdownModalProps> = ({
  isOpen,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [visibleCount, setVisibleCount] = useState<number>(4);
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);

  const {
    notifications,
    unreadCounts,
    isLoading,
    activeCategory,
    setActiveCategory,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // ResizeObserver to dynamically determine visible tabs count based on width
  useEffect(() => {
    if (!isOpen || !tabBarRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width < 390) {
          setVisibleCount(2);
        } else {
          setVisibleCount(4);
        }
      }
    });

    observer.observe(tabBarRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  // Close modal & popover on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentTabUnread = unreadCounts[activeCategory] || 0;
  const visibleTabs = TABS.slice(0, visibleCount);
  const overflowTabs = TABS.slice(visibleCount);
  const isOverflowActive = overflowTabs.some((tab) => tab.key === activeCategory);
  const overflowUnreadTotal = overflowTabs.reduce(
    (sum, tab) => sum + (unreadCounts[tab.key] || 0),
    0
  );

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
                color: '#1877F2',
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
            onClick={() => markAllAsRead()}
            title="Đánh dấu tất cả thông báo đã đọc"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              color: '#1877F2',
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
            <span style={{ display: 'inline' }}>Đã đọc tất cả</span>
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

      {/* Facebook Style Pill Tabs Bar */}
      <div
        ref={tabBarRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 16px 8px 16px',
          backgroundColor: 'white',
          position: 'relative',
        }}
      >
        {visibleTabs.map((tab) => {
          const isActive = activeCategory === tab.key;
          const count = unreadCounts[tab.key] || 0;

          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveCategory(tab.key);
                setIsMoreOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 20,
                border: 'none',
                backgroundColor: isActive ? '#E7F3FF' : 'transparent',
                color: isActive ? '#1877F2' : '#050505',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
                whiteSpace: 'nowrap',
              }}
              className={isActive ? '' : 'hover:bg-[#F2F3F5] transition-colors'}
            >
              <span>{tab.label}</span>
              <CountBadge count={count} style={{ position: 'relative', top: 'auto', right: 'auto' }} />
            </button>
          );
        })}

        {/* Overflow "..." button if some tabs are hidden */}
        {overflowTabs.length > 0 && (
          <div style={{ position: 'relative' }} ref={moreMenuRef}>
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              title="Xem thêm mục lọc"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 20,
                border: 'none',
                backgroundColor: isOverflowActive || isMoreOpen ? '#E7F3FF' : 'transparent',
                color: isOverflowActive || isMoreOpen ? '#1877F2' : '#050505',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
              className={isOverflowActive || isMoreOpen ? '' : 'hover:bg-[#F2F3F5] transition-colors'}
            >
              <MoreHorizontal size={18} />
              <CountBadge count={overflowUnreadTotal} style={{ position: 'relative', top: 'auto', right: 'auto' }} />
            </button>

            {/* Dropdown Popover Menu */}
            {isMoreOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  backgroundColor: 'white',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #E2E8F0',
                  padding: 6,
                  zIndex: 120,
                  minWidth: 160,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  animation: 'fadeIn 0.12s ease-out',
                }}
              >
                {overflowTabs.map((tab) => {
                  const isActive = activeCategory === tab.key;
                  const count = unreadCounts[tab.key] || 0;

                  return (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setActiveCategory(tab.key);
                        setIsMoreOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: 'none',
                        backgroundColor: isActive ? '#E7F3FF' : 'transparent',
                        color: isActive ? '#1877F2' : '#050505',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      className={isActive ? '' : 'hover:bg-slate-100'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{tab.label}</span>
                      </div>
                      <CountBadge count={count} style={{ position: 'relative', top: 'auto', right: 'auto' }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab List Content */}
      <div style={{ padding: '4px 4px 8px 4px' }}>
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
              color: '#1877F2',
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
