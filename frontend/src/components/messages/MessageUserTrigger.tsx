import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ShieldAlert, Flag } from 'lucide-react';
import { ApiError } from '../../lib/apiClient';
import { createOrGetDirectConversation } from '../../lib/conversation.api';
import { useUnreadMessages } from '../../contexts/unread-messages-context';
import { useAuth } from '../../hooks/useAuth';
import { BanUserModal } from '../../pages/forum/moderation/components/BanUserModal';
import { ReportUserModal } from '../ui/ReportUserModal';

export interface MessageUserTriggerProps {
  /** Target user's id -- passed straight through to POST /conversations/direct. */
  userId: string;
  /** When true, renders `children` unwrapped with no click behavior (viewer's own
   * avatar/name) -- callers already compute this via their existing self-check. */
  isSelf?: boolean;
  children: React.ReactNode;
  /** Merged onto the wrapper div so callers can preserve their existing row layout
   * (e.g. `flex: 1`, `gap`). */
  style?: React.CSSProperties;
}

/** Wraps any avatar/name element so clicking it reveals a small "Nhắn tin" popover that
 * starts (or resumes) a direct conversation with that user, then navigates to it. Used at
 * every place another user's identity is rendered (group member rows, forum post authors,
 * chat message senders) -- see PendingInvitationsBell.tsx/PostCard.tsx's 3-dot menu for the
 * click-outside-close + popover styling convention this follows. */
export function MessageUserTrigger({ userId, isSelf = false, children, style }: MessageUserTriggerProps) {
  const navigate = useNavigate();
  const { refresh } = useUnreadMessages();
  const { isModerator, requireAuth } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isSelf) {
    return <>{children}</>;
  }

  async function handleMessageClick() {
    setIsCreating(true);
    setError(null);
    try {
      const conversation = await createOrGetDirectConversation(userId);
      refresh();
      setIsOpen(false);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể mở cuộc trò chuyện.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div ref={ref} onClick={() => setIsOpen((v) => !v)} style={{ position: 'relative', cursor: 'pointer', ...style }}>
      {children}

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'white',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            zIndex: 90,
            minWidth: 150,
            padding: 6,
          }}
        >
          <button
            onClick={handleMessageClick}
            disabled={isCreating}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              color: '#0F172A',
              fontSize: 13,
              fontWeight: 600,
              cursor: isCreating ? 'not-allowed' : 'pointer',
              opacity: isCreating ? 0.6 : 1,
            }}
          >
            <MessageCircle size={15} color="#00236F" />
            {isCreating ? 'Đang mở...' : 'Nhắn tin'}
          </button>

          {/* Bất kỳ người dùng đã đăng nhập nào cũng thấy -- chưa đăng nhập sẽ được điều
              hướng sang /login (cùng quy ước requireAuth với ForumPage/CommentSection). */}
          <button
            onClick={() => {
              setIsOpen(false);
              requireAuth(() => setIsReportModalOpen(true));
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              color: '#0F172A',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Flag size={15} color="#B45309" />
            Báo cáo
          </button>

          {/* Chỉ Kiểm duyệt viên/Admin thấy -- backend độc lập kiểm tra lại quyền này trên
              từng endpoint /moderation/*, đây chỉ là UI. */}
          {isModerator && (
            <button
              onClick={() => {
                setIsOpen(false);
                setIsBanModalOpen(true);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                color: '#DC2626',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ShieldAlert size={15} color="#DC2626" />
              Hạn chế (Restrict)
            </button>
          )}

          {error && <div style={{ padding: '4px 10px', color: '#B91C1C', fontSize: 11.5 }}>{error}</div>}
        </div>
      )}

      {/* stopPropagation: Modal renders via a DOM portal (document.body), but React still
          bubbles its synthetic events through the *component* tree, not the DOM tree -- so
          it's still a React descendant of this trigger's onClick-toggling wrapper. Without
          this, any click inside the modal (including the backdrop) would bubble up and
          toggle the "Nhắn tin" popover open/closed as a side effect. */}
      {isModerator && isBanModalOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <BanUserModal
            isOpen={isBanModalOpen}
            onClose={() => setIsBanModalOpen(false)}
            onCreated={() => setIsBanModalOpen(false)}
            presetUserId={userId}
          />
        </div>
      )}

      {isReportModalOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <ReportUserModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            reportedUserId={userId}
          />
        </div>
      )}
    </div>
  );
}
