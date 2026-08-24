import React, { useMemo } from 'react';
import { BellOff, MessageSquare, Users, Target, Mail } from 'lucide-react';
import type { NotificationCategory, NotificationItem as NotificationItemType } from '../../types/notification';
import { NotificationItem } from './NotificationItem';

interface NotificationTabContentProps {
  notifications: NotificationItemType[];
  activeCategory: NotificationCategory;
  isLoading: boolean;
  onMarkAsRead: (id: string, category: NotificationCategory) => void;
  onCloseModal?: () => void;
}

function getEmptyStateInfo(category: NotificationCategory) {
  switch (category) {
    case 'unread':
      return {
        icon: <BellOff size={36} color="#94A3B8" />,
        text: 'Bạn không có thông báo chưa đọc nào',
      };
    case 'forum':
      return {
        icon: <MessageSquare size={36} color="#94A3B8" />,
        text: 'Chưa có thông báo diễn đàn nào',
      };
    case 'group':
      return {
        icon: <Users size={36} color="#94A3B8" />,
        text: 'Chưa có thông báo nhóm học nào',
      };
    case 'goal':
      return {
        icon: <Target size={36} color="#94A3B8" />,
        text: 'Chưa có nhắc nhở mục tiêu nào',
      };
    case 'message':
      return {
        icon: <Mail size={36} color="#94A3B8" />,
        text: 'Chưa có thông báo tin nhắn nào',
      };
    case 'all':
    default:
      return {
        icon: <BellOff size={36} color="#94A3B8" />,
        text: 'Chưa có thông báo nào',
      };
  }
}

export const NotificationTabContent: React.FC<NotificationTabContentProps> = ({
  notifications,
  activeCategory,
  isLoading,
  onMarkAsRead,
  onCloseModal,
}) => {
  // Filter notifications by active tab category
  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    if (activeCategory === 'unread') return notifications.filter((item) => !item.is_read);
    return notifications.filter((item) => item.category === activeCategory);
  }, [notifications, activeCategory]);

  const emptyState = getEmptyStateInfo(activeCategory);

  if (isLoading && filteredNotifications.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B', fontSize: 14 }}>
        Đang tải thông báo...
      </div>
    );
  }

  if (filteredNotifications.length === 0) {
    return (
      <div
        style={{
          padding: '48px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: '#64748B',
        }}
      >
        {emptyState.icon}
        <div style={{ fontSize: 14, fontWeight: 500 }}>{emptyState.text}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxHeight: 380,
        overflowY: 'auto',
        padding: '4px 8px',
        willChange: 'transform',
      }}
    >
      {filteredNotifications.map((item) => (
        <NotificationItem
          key={item.id}
          item={item}
          onMarkAsRead={onMarkAsRead}
          onCloseModal={onCloseModal}
        />
      ))}
    </div>
  );
};
