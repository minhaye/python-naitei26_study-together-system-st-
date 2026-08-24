import React, { memo, useState } from 'react';
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
  Check,
  X,
} from 'lucide-react';
import type { NotificationItem as NotificationItemType } from '../../types/notification';
import { formatNotification } from './notificationFormatter';
import { Avatar } from '../ui/Avatar';
import { declineInvitation, redeemInvitationById } from '../../lib/invitation.api';
import { targetRoute } from '../../lib/invitationNavigation';

interface NotificationItemProps {
  item: NotificationItemType;
  onMarkAsRead: (id: string, category: NotificationItemType['category']) => void;
  onCloseModal?: () => void;
}

function renderIcon(iconName: string, emoji?: string) {
  if (emoji) {
    return <span style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>;
  }
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
  const [isBusy, setIsBusy] = useState(false);
  const [actionDone, setActionDone] = useState<'accepted' | 'declined' | 'error' | null>(null);

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

  const handleAcceptInvitation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.invitation_id || isBusy) return;
    setIsBusy(true);
    try {
      const result = await redeemInvitationById(item.invitation_id);
      onMarkAsRead(item.id, item.category);
      setActionDone('accepted');
      if (onCloseModal) onCloseModal();
      if (result.outcome === 'group_membership_required') {
        navigate(`/groups/${result.target.group_id}`);
        return;
      }
      navigate(targetRoute(result.target));
    } catch {
      setActionDone('error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeclineInvitation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.invitation_id || isBusy) return;
    setIsBusy(true);
    try {
      await declineInvitation(item.invitation_id);
      onMarkAsRead(item.id, item.category);
      setActionDone('declined');
    } catch {
      setActionDone('error');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        minHeight: 60,
        borderRadius: 8,
        cursor: 'pointer',
        backgroundColor: 'transparent',
        transition: 'background-color 0.15s ease',
        position: 'relative',
        flexShrink: 0,
        boxSizing: 'border-box',
        width: '100%',
      }}
      className="hover:bg-slate-100 transition-colors"
    >
      {/* Avatar with type badge overlay */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar name={formatted.actorName} src={formatted.actorAvatarUrl} size="md" />
        <div
          style={{
            position: 'absolute',
            bottom: -8,
            right: -4,
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: 'white',
            border: '2px solid #ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 0,
          }}
        >
          {renderIcon(formatted.iconName, formatted.emoji)}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: item.is_read ? 0 : 8 }}>
        <div
          style={{
            fontSize: 14,
            lineHeight: '20px',
            wordBreak: 'break-word',
          }}
        >
          <span
            style={{
              fontWeight: item.is_read ? 600 : 700,
              color: item.is_read ? '#65676B' : '#050505',
            }}
          >
            {formatted.actorName}
          </span>{' '}
          <span
            style={{
              fontWeight: item.is_read ? 400 : 500,
              color: item.is_read ? '#65676B' : '#050505',
            }}
          >
            {formatted.previewText}
          </span>
        </div>

        {/* Action Buttons for Invitations */}
        {item.invitation_id && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {actionDone === 'accepted' ? (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#10B981' }}>✓ Đã tham gia</span>
            ) : actionDone === 'declined' ? (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Đã từ chối</span>
            ) : (
              <>
                <button
                  onClick={handleDeclineInvitation}
                  disabled={isBusy}
                  style={{
                    padding: '4px 10px',
                    background: 'white',
                    color: '#64748B',
                    border: '1px solid #CBD5E1',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <X size={12} /> Từ chối
                </button>
                <button
                  onClick={handleAcceptInvitation}
                  disabled={isBusy}
                  style={{
                    padding: '4px 10px',
                    background: '#1877F2',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Check size={12} /> Tham gia
                </button>
              </>
            )}
          </div>
        )}

        <div
          style={{
            fontSize: 12,
            color: item.is_read ? '#8A8D91' : '#1877F2',
            fontWeight: item.is_read ? 400 : 600,
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
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: '#1877F2',
            flexShrink: 0,
            alignSelf: 'center',
          }}
        />
      )}
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';
