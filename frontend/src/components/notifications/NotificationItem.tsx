import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageSquare,
  Reply,
  FileText,
  Flame,
  Users,
  Sun,
  Clock,
  AlertTriangle,
  Mail,
  UserPlus,
} from 'lucide-react';
import type { NotificationItem as NotificationItemType } from '../../types/notification';
import { formatNotification } from './notificationFormatter';
import { Avatar } from '../ui/Avatar';

interface NotificationItemProps {
  item: NotificationItemType;
  onMarkAsRead: (id: string, category: NotificationItemType['category']) => void;
  onCloseModal?: () => void;
}

function renderIcon(iconName: string) {
  switch (iconName) {
    case 'heart':
      return <Heart size={14} fill="#EF4444" color="#EF4444" />;
    case 'comment':
      return <MessageSquare size={14} color="#3B82F6" />;
    case 'reply':
      return <Reply size={14} color="#8B5CF6" />;
    case 'file':
      return <FileText size={14} color="#10B981" />;
    case 'flame':
      return <Flame size={14} color="#F59E0B" />;
    case 'users':
      return <Users size={14} color="#6366F1" />;
    case 'sun':
      return <Sun size={14} color="#F59E0B" />;
    case 'clock':
      return <Clock size={14} color="#EC4899" />;
    case 'alert':
      return <AlertTriangle size={14} color="#EF4444" />;
    case 'invite':
      return <UserPlus size={14} color="#10B981" />;
    case 'message':
    default:
      return <Mail size={14} color="#3B82F6" />;
  }
}

export const NotificationItem: React.FC<NotificationItemProps> = memo(({ item, onMarkAsRead, onCloseModal }) => {
  const navigate = useNavigate();
  const formatted = formatNotification(item);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!item.is_read) {
      onMarkAsRead(item.id, item.category);
    }
    if (onCloseModal) {
      onCloseModal();
    }
    navigate(formatted.targetLink);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        minHeight: 68,
        borderRadius: 8,
        cursor: 'pointer',
        backgroundColor: item.is_read ? 'transparent' : '#F0F7FF',
        transition: 'background-color 0.15s ease',
        position: 'relative',
        contain: 'content',
      }}
      className="hover:bg-slate-100/80"
    >
      {/* Avatar with type badge overlay */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar name={formatted.actorName} size="md" />
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderIcon(formatted.iconName)}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: item.is_read ? 0 : 12 }}>
        <div
          style={{
            fontSize: 14,
            lineHeight: '20px',
            color: '#1E293B',
            wordBreak: 'break-word',
          }}
        >
          <span style={{ fontWeight: 600, color: '#0F172A' }}>{formatted.actorName}</span>{' '}
          <span style={{ fontWeight: item.is_read ? 400 : 500, color: item.is_read ? '#475569' : '#0F172A' }}>
            {formatted.previewText}
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            color: item.is_read ? '#94A3B8' : '#2563EB',
            fontWeight: item.is_read ? 400 : 500,
            marginTop: 4,
          }}
        >
          {formatted.timeAgo}
        </div>
      </div>

      {/* Unread blue dot */}
      {!item.is_read && (
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: '#2563EB',
            flexShrink: 0,
            marginTop: 8,
          }}
        />
      )}
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';
