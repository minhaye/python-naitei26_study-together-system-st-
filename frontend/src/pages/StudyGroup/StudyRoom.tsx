import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  Hand,
  PhoneOff,
  MessageSquare,
  Users,
  Send,
  ArrowLeft,
  Share2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Download,
  UserX,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Pencil,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useStudyRoom } from '../../hooks/useStudyRoom';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { useMessageReactionActions } from '../../hooks/useMessageReactionActions';
import { useMessageImageAttachment, ALLOWED_IMAGE_ACCEPT } from '../../hooks/useMessageImageAttachment';
import { MessageAttachmentImage } from '../../components/chat/MessageAttachmentImage';
import { MessageReactions } from '../../components/chat/MessageReactions';
import { SelectedImagePreview } from '../../components/chat/SelectedImagePreview';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { RestrictionBanner } from '../../components/ui/RestrictionBanner';
import { getAvatarInitials, getAvatarColor } from '../../utils/avatarUtils';
import { getDisplayName } from '../../utils/userDisplay';
import { isLocalhost } from '../../utils/env';
import { InviteModal } from '../../components/invitations/InviteModal';
import { MessageUserTrigger } from '../../components/messages/MessageUserTrigger';
import { MeetingProvider } from './meeting/MeetingProvider';
import { MeetingVideoGrid } from './meeting/MeetingVideoGrid';
import { MeetingControls } from './meeting/MeetingControls';
import { WhiteboardPanel } from './meeting/WhiteboardPanel';
import { WhiteboardUnavailableModal } from './meeting/WhiteboardUnavailableModal';
import { PresentationViewer } from './meeting/PresentationViewer';
import { PreJoinLobby } from './meeting/PreJoinLobby';
import type { MediaJoinChoice } from './meeting/PreJoinLobby';

interface CenteredRoomMessageProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children?: ReactNode;
}

function CenteredRoomMessage({ title, subtitle, onBack, children }: CenteredRoomMessageProps) {
  return (
    <div style={{width: '100vw', height: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, fontFamily: 'Inter, sans-serif', textAlign: 'center'}}>
      <h1 style={{color: 'white', fontSize: 20, fontWeight: '700', margin: 0}}>{title}</h1>
      {subtitle && <p style={{color: '#94A3B8', fontSize: 14, margin: '4px 0 12px', maxWidth: 420}}>{subtitle}</p>}
      {children}
      {onBack && (
        <button
          onClick={onBack}
          style={{marginTop: 16, background: '#334155', border: 'none', color: 'white', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: '500'}}
        >
          Quay lại
        </button>
      )}
    </div>
  );
}

export function StudyRoom() {
  const navigate = useNavigate();
  const { id: roomId } = useParams();
  const { currentUser, getBan } = useAuth();
  const messageBan = getBan('message');

  const {
    room,
    members,
    loading,
    roomError,
    membersError,
    actionError,
    clearActionError,
    currentUserId,
    isGroupManager,
    isCurrentUserMember,
    handRaisedUserIds,
    moderationMutedUserIds,
    join,
    leave,
    start,
    end,
    deleteRoom,
    moderate,
    changeMemberRole,
  } = useStudyRoom(roomId);

  const currentUserRole = useMemo(() => {
    const member = members.find((m) => m.user_id === currentUserId && !m.left_at);
    return member?.role;
  }, [members, currentUserId]);

  // Room states
  const [activeMode, setActiveMode] = useState<'video' | 'whiteboard'>('video');
  const [activeRightTab, setActiveRightTab] = useState<'chat' | 'participants'>('chat');
  const [activeBoardTab, setActiveBoardTab] = useState<'whiteboard' | 'presentation'>('whiteboard');

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isDeleteRoomModalOpen, setIsDeleteRoomModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [isLifecycleBusy, setIsLifecycleBusy] = useState(false);
  const [lobbyConfirmed, setLobbyConfirmed] = useState(false);
  const [mediaChoice, setMediaChoice] = useState<MediaJoinChoice>({ audioEnabled: true, videoEnabled: true });

  // Whiteboard tools (now handled internally by Tldraw)

  // Tldraw's license only covers localhost/dev usage -- mounting it on any other origin would
  // surface licensing violations, so the whiteboard is gated on the browser's own hostname
  // rather than a build-time flag (see utils/env.ts).
  const whiteboardAllowed = useMemo(() => isLocalhost(), []);
  const [isWhiteboardUnavailableModalOpen, setIsWhiteboardUnavailableModalOpen] = useState(false);
  const isWhiteboardTabActive = activeMode === 'whiteboard' && activeBoardTab === 'whiteboard';
  useEffect(() => {
    if (isWhiteboardTabActive && !whiteboardAllowed) {
      setIsWhiteboardUnavailableModalOpen(true);
    }
  }, [isWhiteboardTabActive, whiteboardAllowed]);

  const handleLeaveRoom = async () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    try {
      await leave();
    } catch {
      // Best-effort: still navigate away even if the leave call failed (e.g. already left).
    }
    navigate(room ? `/groups/${room.group_id}` : '/groups');
  };

  const handleStartRoom = async () => {
    setIsLifecycleBusy(true);
    try {
      await start();
    } catch {
      // actionError is already populated by the hook.
    } finally {
      setIsLifecycleBusy(false);
    }
  };

  const handleEndRoom = async () => {
    setIsLifecycleBusy(true);
    try {
      await end();
    } catch {
      // actionError is already populated by the hook.
    } finally {
      setIsLifecycleBusy(false);
    }
  };

  const handleConfirmDeleteRoom = async () => {
    if (isDeletingRoom) return;
    setIsDeletingRoom(true);
    try {
      await deleteRoom();
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      // Only navigate away after the backend confirms the delete -- no optimistic/fake
      // success. There is no "room removed" state to fall back to in this hook, so leaving
      // the deleted room's page entirely (back to its Group) is the correct reset.
      navigate(room ? `/groups/${room.group_id}` : '/groups');
    } catch {
      // Keep the modal open so the user can see actionError (set by the hook) and retry.
    } finally {
      setIsDeletingRoom(false);
    }
  };

  const currentUserHandRaised = currentUserId ? handRaisedUserIds.has(currentUserId) : false;

  const handleToggleHand = async () => {
    if (!currentUserId) return;
    try {
      await moderate(currentUserId, currentUserHandRaised ? 'lower_hand' : 'raise_hand');
    } catch {
      // actionError is already populated by the hook.
    }
  };

  const handleKick = async (targetUserId: string) => {
    try {
      await moderate(targetUserId, 'kick');
    } catch {
      // actionError is already populated by the hook.
    }
  };

  const handleToggleMute = async (targetUserId: string, currentlyMuted: boolean) => {
    try {
      await moderate(targetUserId, currentlyMuted ? 'unmute' : 'mute');
    } catch {
      // actionError is already populated by the hook.
    }
  };

  const handleToggleModerator = async (targetUserId: string, isModerator: boolean) => {
    try {
      await changeMemberRole(targetUserId, isModerator ? 'participant' : 'moderator');
    } catch {
      // actionError is already populated by the hook.
    }
  };

  // Real session timer, derived from the backend's started_at/ended_at (no fabricated duration).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (room?.status !== 'active') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [room?.status]);

  const elapsedSeconds = useMemo(() => {
    if (!room?.started_at) return null;
    const startMs = new Date(room.started_at).getTime();
    const endMs = room.status === 'ended' && room.ended_at ? new Date(room.ended_at).getTime() : now;
    return Math.max(0, Math.floor((endMs - startMs) / 1000));
  }, [room, now]);

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Real active member roster from the Study Room membership API. `isMuted` here reflects
  // Study Room moderation-mute state (audit log) for the sidebar member list -- it is NOT the
  // real LiveKit microphone state, which the video call grid (MeetingVideoGrid) renders
  // separately from the actual LiveKit track/participant state. Hand-raise is likewise derived
  // from the real moderation audit log, not fabricated.
  const participants = useMemo(() => {
    return members
      .filter((m) => !m.left_at)
      .map((m) => {
        const isSelf = m.user_id === currentUserId;
        const name = isSelf ? `${currentUser.name} (Bạn)` : getDisplayName(m.user);
        return {
          id: m.user_id,
          userId: m.user_id,
          role: m.role,
          name,
          initial: isSelf ? currentUser.initials : getAvatarInitials(name),
          color: isSelf ? currentUser.color : getAvatarColor(name),
          avatarUrl: isSelf ? currentUser.avatarUrl : m.user.avatar_url,
          isHost: m.role === 'host',
          isModerator: m.role === 'moderator',
          isSelf,
          isMuted: moderationMutedUserIds.has(m.user_id),
          handRaised: handRaisedUserIds.has(m.user_id),
        };
      });
  }, [members, currentUserId, currentUser, moderationMutedUserIds, handRaisedUserIds]);

  // Real persisted messages for this room's ROOM Conversation (reuses the same
  // /conversations/{id}/messages REST API + Realtime subscription as Channel chat --
  // see useRoomMessages.ts). `room.conversation_id` is null only in the brief instant
  // before `room` has loaded; the chat panel treats that the same as "not ready yet".
  //
  // Gated on `isCurrentUserMember`, not just `room?.conversation_id`: the room GET has no
  // membership check, so conversation_id is available (and this hook would start fetching)
  // before the join API call has actually committed a study_room_members row. Fetching that
  // early hits the backend's can_access_room 403 ("You do not have access to this
  // conversation") and, since the hook only re-fetches when conversationId itself changes,
  // that error used to stick around even after join succeeded -- only a full reload (which
  // re-fetches after membership already exists) cleared it. Gating here makes conversationId
  // flip from null to real only once membership is actually confirmed, so the fetch is
  // correctly deferred instead of firing-then-erroring.
  const {
    messages,
    isLoading: isMessagesLoading,
    loadError: messagesError,
    isSending: isSendingMessage,
    sendError: sendMessageError,
    sendMessage,
    updateMessageReactions,
  } = useRoomMessages(isCurrentUserMember ? room?.conversation_id ?? null : null);
  const handleReactionSelect = useMessageReactionActions(updateMessageReactions);
  const [chatInput, setChatInput] = useState('');
  const imageAttachment = useMessageImageAttachment();
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);

  const senderDisplay = (message: (typeof messages)[number]) => {
    const isSelf = message.sender_id === currentUserId;
    const name = isSelf ? `${currentUser.name} (Bạn)` : getDisplayName(message.sender);
    return {
      name,
      initial: isSelf ? currentUser.initials : getAvatarInitials(name),
      color: isSelf ? currentUser.color : getAvatarColor(name),
      avatarUrl: isSelf ? currentUser.avatarUrl : message.sender.avatar_url,
      isSelf,
    };
  };

  const formatMessageTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeRightTab]);

  const handleSendMessage = async () => {
    const trimmed = chatInput.trim();
    const conversationId = room?.conversation_id ?? null;
    if ((!trimmed && !imageAttachment.hasImage) || !conversationId || isSendingMessage || imageAttachment.isUploading || messageBan) return;
    try {
      // Upload first, create the message second -- a failed upload must never produce an
      // orphaned/misleading message record (see useMessageImageAttachment.uploadImage).
      const attachmentPath = imageAttachment.hasImage ? await imageAttachment.uploadImage(conversationId) : null;
      await sendMessage(trimmed, attachmentPath);
      setChatInput('');
      imageAttachment.clearImage();
    } catch {
      // sendMessageError / imageAttachment.uploadError is already populated; keep the draft
      // (and any selected image) so the user can retry.
    }
  };

  const handleChatImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) imageAttachment.selectImage(picked);
    e.target.value = '';
  };

  // --- Loading / error / not-yet-joined states (real backend data drives all of these) ---

  if (!roomId) {
    return (
      <CenteredRoomMessage title="Liên kết phòng học không hợp lệ" subtitle="Không tìm thấy mã phòng học trong đường dẫn." onBack={() => navigate('/groups')} />
    );
  }

  if (loading) {
    return <CenteredRoomMessage title="Đang tải phòng học..." />;
  }

  if (roomError || !room) {
    return (
      <CenteredRoomMessage
        title={roomError?.status === 404 ? 'Không tìm thấy phòng học' : 'Không thể tải phòng học'}
        subtitle={roomError?.message}
        onBack={() => navigate('/groups')}
      />
    );
  }

  const statusColor = room.status === 'active' ? '#10B981' : room.status === 'waiting' ? '#F59E0B' : '#64748B';
  const statusLabel = room.status === 'active' ? 'Đang diễn ra' : room.status === 'waiting' ? 'Chưa bắt đầu' : 'Đã kết thúc';
  const isRoomEnded = room.status === 'ended';

  if (!isCurrentUserMember && isRoomEnded) {
    return (
      <CenteredRoomMessage
        title={room.name}
        subtitle={room.description || undefined}
        onBack={() => navigate(`/groups/${room.group_id}`)}
      >
        <div style={{color: '#94A3B8', fontSize: 13, marginBottom: 16}}>
          {membersError?.status === 403 ? 'Phòng học này đã kết thúc.' : membersError?.message}
        </div>
      </CenteredRoomMessage>
    );
  }

  // Pre-join lobby: lets the user preview/toggle camera & mic (and pick a device) before the
  // LiveKit connection is made, instead of connecting with audio/video hardcoded on immediately.
  // Also doubles as the room-membership join step for first-time visitors -- "Tham gia phòng học"
  // both joins the room and confirms the media setup in one action, instead of a separate screen.
  if (!lobbyConfirmed && !isRoomEnded) {
    return (
      <PreJoinLobby
        roomName={room.name}
        roomSubtitle={room.description || undefined}
        userName={currentUser.name}
        userInitial={currentUser.initials}
        userColor={currentUser.color}
        userAvatarUrl={currentUser.avatarUrl ?? undefined}
        isJoining={isJoining}
        joinError={actionError?.message}
        restrictionBan={isCurrentUserMember ? undefined : getBan('join_room')}
        onJoin={async (choice) => {
          setMediaChoice(choice);
          if (isCurrentUserMember) {
            setLobbyConfirmed(true);
            return;
          }
          setIsJoining(true);
          try {
            await join();
            setLobbyConfirmed(true);
          } catch {
            // actionError is already populated by the hook.
          } finally {
            setIsJoining(false);
          }
        }}
        onBack={() => navigate(`/groups/${room.group_id}`)}
      />
    );
  }

  return (
    <MeetingProvider
      roomId={roomId}
      enabled={isCurrentUserMember && !isRoomEnded}
      initialAudioEnabled={mediaChoice.audioEnabled}
      initialVideoEnabled={mediaChoice.videoEnabled}
      audioDeviceId={mediaChoice.audioDeviceId}
      videoDeviceId={mediaChoice.videoDeviceId}
    >
    <div style={{width: '100vw', height: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Inter, sans-serif'}}>

      {/* Top Header Bar */}
      <header style={{height: 64, background: '#1E293B', borderBottom: '1px solid #334155', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 20, position: 'relative'}}>

        {/* Left Info & Back button */}
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <button
            onClick={handleLeaveRoom}
            style={{background: '#334155', border: 'none', color: 'white', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: '500'}}
          >
            <ArrowLeft size={16} /> Rời phòng
          </button>

          <div style={{height: 24, width: 1, background: '#475569'}} />

          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={{width: 10, height: 10, borderRadius: '50%', background: statusColor, boxShadow: room.status === 'active' ? `0 0 10px ${statusColor}` : 'none'}} />
            <h1 style={{fontSize: 16, fontWeight: '600', color: 'white', margin: 0, whiteSpace: 'nowrap'}}>
              {room.name} • <span style={{color: '#94A3B8', fontWeight: '400'}}>{statusLabel}</span>
            </h1>
          </div>
        </div>

        {/* Center Mode Switcher Tabs */}
        <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', background: '#0F172A', padding: 4, borderRadius: 10, border: '1px solid #334155', display: 'flex', gap: 4}}>
          <button 
            onClick={() => setActiveMode('video')}
            style={{
              padding: '6px 16px', 
              borderRadius: 8, 
              border: 'none', 
              background: activeMode === 'video' ? '#2563EB' : 'transparent', 
              color: activeMode === 'video' ? 'white' : '#94A3B8', 
              fontSize: 13, 
              fontWeight: '600', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <VideoIcon size={16} /> Gọi Video ({participants.length})
          </button>
          <button 
            onClick={() => setActiveMode('whiteboard')}
            style={{
              padding: '6px 16px', 
              borderRadius: 8, 
              border: 'none', 
              background: activeMode === 'whiteboard' ? '#2563EB' : 'transparent', 
              color: activeMode === 'whiteboard' ? 'white' : '#94A3B8', 
              fontSize: 13, 
              fontWeight: '600', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <Pencil size={16} /> Bảng Trắng & Ghi Chú
          </button>
        </div>

        {/* Right Timer & Status */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          {actionError && (
            <div
              onClick={clearActionError}
              title="Bấm để ẩn thông báo"
              style={{color: '#F87171', fontSize: 12, maxWidth: 220, cursor: 'pointer'}}
            >
              {actionError.message}
            </div>
          )}
          {isGroupManager && room.status === 'waiting' && (
            <button
              onClick={handleStartRoom}
              disabled={isLifecycleBusy}
              style={{background: '#10B981', border: 'none', color: 'white', padding: '8px 14px', borderRadius: 8, cursor: isLifecycleBusy ? 'default' : 'pointer', fontSize: 13, fontWeight: '600', opacity: isLifecycleBusy ? 0.7 : 1}}
            >
              Bắt đầu phòng
            </button>
          )}
          {isGroupManager && room.status === 'active' && (
            <button
              onClick={handleEndRoom}
              disabled={isLifecycleBusy}
              style={{background: '#DC2626', border: 'none', color: 'white', padding: '8px 14px', borderRadius: 8, cursor: isLifecycleBusy ? 'default' : 'pointer', fontSize: 13, fontWeight: '600', opacity: isLifecycleBusy ? 0.7 : 1}}
            >
              Kết thúc phòng
            </button>
          )}
          {isGroupManager && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              title="Mời thêm người"
              style={{background: 'transparent', border: '1px solid #475569', color: '#94A3B8', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: '600', display: 'flex', alignItems: 'center'}}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#00236F'; e.currentTarget.style.color = '#00236F'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.color = '#94A3B8'; }}
            >
              <UserPlus size={16} />
            </button>
          )}
          {isGroupManager && (
            <button
              onClick={() => setIsDeleteRoomModalOpen(true)}
              title="Xóa phòng học"
              style={{background: 'transparent', border: '1px solid #475569', color: '#94A3B8', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: '600', display: 'flex', alignItems: 'center'}}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.color = '#F87171'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.color = '#94A3B8'; }}
            >
              <Trash2 size={16} />
            </button>
          )}
          <div style={{background: '#334155', padding: '6px 14px', borderRadius: 8, color: '#38BDF8', fontSize: 14, fontFamily: 'monospace', fontWeight: '600'}}>
            {elapsedSeconds !== null ? formatTime(elapsedSeconds) : statusLabel}
          </div>
        </div>
      </header>

      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        target={{ roomId: room.id }}
        targetLabel={room.name}
      />

      <WhiteboardUnavailableModal
        isOpen={isWhiteboardUnavailableModalOpen}
        onClose={() => setIsWhiteboardUnavailableModalOpen(false)}
      />

      {/* Modal: Xác nhận xóa phòng học */}
      {isDeleteRoomModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200 }}>
          <div style={{ background: '#1E293B', borderRadius: 12, width: 420, padding: 32, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.3)', border: '1px solid #334155' }}>
            <button
              onClick={() => { if (!isDeletingRoom) { setIsDeleteRoomModalOpen(false); clearActionError(); } }}
              disabled={isDeletingRoom}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: isDeletingRoom ? 'not-allowed' : 'pointer', color: '#94A3B8', fontSize: 18 }}
            >
              ✕
            </button>

            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 12 }}>
              Xóa "{room.name}"?
            </h2>

            <p style={{ fontSize: 14, color: '#CBD5E1', lineHeight: 1.5, marginBottom: 8 }}>
              Phòng học này sẽ không còn truy cập được nữa.
            </p>
            <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5, marginBottom: 24 }}>
              Dữ liệu lịch sử (tin nhắn, thành viên, lịch sử kiểm duyệt) vẫn được lưu giữ. Thao tác này hiện chưa thể hoàn tác.
            </p>

            {actionError && (
              <div style={{ background: '#450A0A', border: '1px solid #7F1D1D', borderRadius: 8, padding: 12, color: '#FCA5A5', fontSize: 13, marginBottom: 16 }}>
                {actionError.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { if (!isDeletingRoom) { setIsDeleteRoomModalOpen(false); clearActionError(); } }}
                disabled={isDeletingRoom}
                style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: '#334155', color: '#E2E8F0', border: 'none', fontSize: 14, fontWeight: 600, cursor: isDeletingRoom ? 'not-allowed' : 'pointer' }}
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmDeleteRoom}
                disabled={isDeletingRoom}
                style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: isDeletingRoom ? '#7F1D1D' : '#DC2626', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: isDeletingRoom ? 'not-allowed' : 'pointer' }}
              >
                {isDeletingRoom ? 'Đang xóa...' : 'Xóa phòng học'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <div style={{flex: 1, display: 'flex', overflow: 'hidden', position: 'relative'}}>
        
        {/* MODE A: LIVEKIT VIDEO CALL VIEW */}
        {activeMode === 'video' && (
          <div style={{flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', background: '#0F172A'}}>
            <MeetingVideoGrid
              members={members}
              currentUserId={currentUserId}
              currentUserName={currentUser.name}
              currentUserAvatarUrl={currentUser.avatarUrl}
              unavailableReason={isRoomEnded ? 'Phòng học này đã kết thúc, cuộc gọi không còn khả dụng.' : undefined}
            />
          </div>
        )}

        {/* MODE B: WHITEBOARD & PRESENTATION VIEW */}
        {activeMode === 'whiteboard' && (
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC'}}>
            
            {/* Board Sub-header */}
            <div style={{height: 48, background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{display: 'flex', gap: 8}}>
                <button 
                  onClick={() => setActiveBoardTab('whiteboard')}
                  style={{padding: '6px 14px', borderRadius: 6, border: 'none', background: activeBoardTab === 'whiteboard' ? '#EFF6FF' : 'transparent', color: activeBoardTab === 'whiteboard' ? '#1D4ED8' : '#64748B', fontWeight: '600', fontSize: 13, cursor: 'pointer'}}
                >
                  🎨 Bảng trắng chung
                </button>
                <button 
                  onClick={() => setActiveBoardTab('presentation')}
                  style={{padding: '6px 14px', borderRadius: 6, border: 'none', background: activeBoardTab === 'presentation' ? '#EFF6FF' : 'transparent', color: activeBoardTab === 'presentation' ? '#1D4ED8' : '#64748B', fontWeight: '600', fontSize: 13, cursor: 'pointer'}}
                >
                  📄 Slide Bài giảng{room.presentation_state ? ` (${room.presentation_state.file_name})` : ''}
                </button>
              </div>

              {/* Action buttons */}
              <div style={{display: 'flex', gap: 12}}>
                <button style={{display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontWeight: '500', color: '#334155', cursor: 'pointer'}}>
                  <Download size={14} /> Tải bảng (PNG)
                </button>
                <button style={{display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontWeight: '500', color: '#334155', cursor: 'pointer'}}>
                  <Share2 size={14} /> Chia sẻ link
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div style={{flex: 1, position: 'relative', overflow: 'hidden'}}>
              
              {activeBoardTab === 'whiteboard' ? (
                <WhiteboardPanel
                  roomId={room.id}
                  initialState={room.whiteboard_state}
                  isReadonly={!(isGroupManager || currentUserRole === 'host' || currentUserRole === 'moderator')}
                  isAvailable={whiteboardAllowed}
                  onUnavailableClick={() => setIsWhiteboardUnavailableModalOpen(true)}
                />
              ) : (
                <div style={{position: 'absolute', inset: 0, background: '#FFFFFF', backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '24px 24px'}}>
                  <PresentationViewer
                    roomId={room.id}
                    initialState={room.presentation_state}
                    isReadonly={!(isGroupManager || currentUserRole === 'host' || currentUserRole === 'moderator')}
                  />
                </div>
              )}

            </div>

          </div>
        )}

        {/* RIGHT COLLAPSIBLE SIDEBAR WITH SLEEK EDGE TOGGLE */}
        {isSidebarOpen ? (
          <aside style={{width: 340, background: '#1E293B', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', zIndex: 10, position: 'relative'}}>
            
            {/* Collapse Edge Handle */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              style={{
                position: 'absolute',
                top: '50%',
                left: -14,
                transform: 'translateY(-50%)',
                background: '#1E293B',
                border: '1px solid #334155',
                borderRight: 'none',
                color: '#94A3B8',
                width: 26,
                height: 48,
                borderRadius: '8px 0 0 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 25,
                boxShadow: '-2px 0 8px rgba(0,0,0,0.2)'
              }}
              title="Thu gọn thanh bên"
            >
              <ChevronRight size={18} />
            </button>

            {/* Sidebar Tabs */}
            <div style={{display: 'flex', borderBottom: '1px solid #334155', background: '#0F172A'}}>
              <button 
                onClick={() => setActiveRightTab('chat')}
                style={{
                  flex: 1, 
                  padding: '14px 0', 
                  border: 'none', 
                  background: 'transparent', 
                  color: activeRightTab === 'chat' ? '#38BDF8' : '#94A3B8', 
                  borderBottom: activeRightTab === 'chat' ? '2px solid #38BDF8' : '2px solid transparent',
                  fontWeight: '600', 
                  fontSize: 13, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <MessageSquare size={16} /> Trò chuyện
              </button>
              <button 
                onClick={() => setActiveRightTab('participants')}
                style={{
                  flex: 1, 
                  padding: '14px 0', 
                  border: 'none', 
                  background: 'transparent', 
                  color: activeRightTab === 'participants' ? '#38BDF8' : '#94A3B8', 
                  borderBottom: activeRightTab === 'participants' ? '2px solid #38BDF8' : '2px solid transparent',
                  fontWeight: '600', 
                  fontSize: 13, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Users size={16} /> Thành viên ({participants.length})
              </button>
            </div>

            {/* TAB CONTENT: CHAT */}
            {activeRightTab === 'chat' && (
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden'}}>
                
                {/* Messages List */}
                <div style={{flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16}}>
                  {isMessagesLoading ? (
                    <div style={{display: 'flex', justifyContent: 'center', margin: '32px 0', color: '#94A3B8', fontSize: 13}}>
                      Đang tải tin nhắn...
                    </div>
                  ) : messagesError ? (
                    <div style={{margin: '16px 0', padding: '12px 14px', background: '#450A0A', border: '1px solid #7F1D1D', borderRadius: 8, color: '#FCA5A5', fontSize: 12.5}}>
                      {messagesError.message}
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '32px 0', color: '#94A3B8', fontSize: 13, textAlign: 'center', gap: 4}}>
                      <div>Chưa có tin nhắn nào trong phòng học này.</div>
                      <div>Hãy là người đầu tiên nói lời chào!</div>
                    </div>
                  ) : (
                    // Keyed by conversation so a crash here (and the boundary it trips) resets
                    // on room/conversation change instead of showing the fallback forever -- and
                    // so it can never take the sibling LiveKit meeting tree down with it (see
                    // ErrorBoundary.tsx).
                    <ErrorBoundary
                      key={room?.conversation_id ?? 'none'}
                      fallback={
                        <div style={{margin: '16px 0', padding: '12px 14px', background: '#450A0A', border: '1px solid #7F1D1D', borderRadius: 8, color: '#FCA5A5', fontSize: 12.5}}>
                          Không thể hiển thị tin nhắn trong phòng học này.
                        </div>
                      }
                    >
                      {messages.map((m) => {
                        const display = senderDisplay(m);
                        return (
                          <div key={m.id} style={{display: 'flex', gap: 10, flexDirection: display.isSelf ? 'row-reverse' : 'row'}}>
                            <MessageUserTrigger userId={m.sender_id} isSelf={display.isSelf}>
                              {display.avatarUrl ? (
                                <img src={display.avatarUrl} alt={display.name} style={{width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0}} />
                              ) : (
                                <div style={{width: 32, height: 32, borderRadius: '50%', background: display.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 12, flexShrink: 0}}>
                                  {display.initial}
                                </div>
                              )}
                            </MessageUserTrigger>
                            <div style={{maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: display.isSelf ? 'flex-end' : 'flex-start'}}>
                              <div style={{display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 4}}>
                                <span style={{color: '#94A3B8', fontSize: 11, fontWeight: '600'}}>{display.name}</span>
                                <span style={{color: '#64748B', fontSize: 10}}>{formatMessageTime(m.created_at)}</span>
                              </div>
                              <div style={{
                                padding: '10px 14px',
                                borderRadius: display.isSelf ? '14px 2px 14px 14px' : '2px 14px 14px 14px',
                                background: display.isSelf ? '#2563EB' : '#334155',
                                color: 'white',
                                fontSize: 13,
                                lineHeight: '1.4',
                                wordBreak: 'break-word'
                              }}>
                                {m.content && <div style={{marginBottom: m.attachment_path ? 6 : 0}}>{m.content}</div>}
                                {m.attachment_path && <MessageAttachmentImage messageId={m.id} initialUrl={m.attachment_url} />}
                              </div>
                              <MessageReactions
                                reactions={m.reactions}
                                isSelf={display.isSelf}
                                onSelect={(emoji) => handleReactionSelect(m, emoji)}
                                dark
                              />
                            </div>
                          </div>
                        );
                      })}
                    </ErrorBoundary>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div style={{padding: 16, background: '#0F172A', borderTop: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: 8}}>
                  {messageBan && <RestrictionBanner ban={messageBan} actionLabel="nhắn tin" variant="dark" />}
                  {(sendMessageError || imageAttachment.uploadError || imageAttachment.pickError) && (
                    <div style={{padding: '8px 12px', background: '#450A0A', border: '1px solid #7F1D1D', borderRadius: 8, color: '#FCA5A5', fontSize: 12}}>
                      {sendMessageError?.message || imageAttachment.uploadError?.message || imageAttachment.pickError}
                    </div>
                  )}
                  {imageAttachment.previewUrl && (
                    <SelectedImagePreview
                      previewUrl={imageAttachment.previewUrl}
                      onRemove={imageAttachment.clearImage}
                      disabled={isSendingMessage || imageAttachment.isUploading}
                    />
                  )}
                  <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                    <input
                      type="file"
                      accept={ALLOWED_IMAGE_ACCEPT}
                      ref={chatImageInputRef}
                      onChange={handleChatImageSelected}
                      style={{display: 'none'}}
                    />
                    <button
                      type="button"
                      onClick={() => chatImageInputRef.current?.click()}
                      disabled={!room?.conversation_id || isSendingMessage || !!messageBan}
                      aria-label="Đính kèm ảnh"
                      style={{background: '#1E293B', border: '1px solid #334155', color: '#94A3B8', padding: 10, borderRadius: 8, display: 'flex', cursor: !room?.conversation_id || isSendingMessage || messageBan ? 'default' : 'pointer', opacity: !room?.conversation_id || isSendingMessage || messageBan ? 0.6 : 1}}
                    >
                      <ImageIcon size={16} />
                    </button>
                    <input
                      type="text"
                      placeholder={messageBan ? 'Bạn đang bị hạn chế nhắn tin...' : 'Nhập tin nhắn vào phòng học...'}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      disabled={!room?.conversation_id || isSendingMessage || !!messageBan}
                      style={{flex: 1, padding: '10px 14px', background: '#1E293B', border: '1px solid #334155', borderRadius: 8, outline: 'none', color: 'white', fontSize: 13, opacity: !room?.conversation_id || isSendingMessage || messageBan ? 0.6 : 1}}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={(!chatInput.trim() && !imageAttachment.hasImage) || !room?.conversation_id || isSendingMessage || imageAttachment.isUploading || !!messageBan}
                      style={{background: '#2563EB', border: 'none', color: 'white', padding: 10, borderRadius: 8, cursor: ((!chatInput.trim() && !imageAttachment.hasImage) || !room?.conversation_id || isSendingMessage || imageAttachment.isUploading || messageBan) ? 'default' : 'pointer', opacity: ((!chatInput.trim() && !imageAttachment.hasImage) || !room?.conversation_id || isSendingMessage || imageAttachment.isUploading || messageBan) ? 0.6 : 1}}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: PARTICIPANTS */}
            {activeRightTab === 'participants' && (
              <div style={{flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12}}>
                <span style={{color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5}}>Danh sách đang tham gia</span>
                {participants.map((p) => {
                  // Backend rule (can_manage_room / is_group_manager): a current active Group
                  // owner/moderator may moderate any room member, including whoever holds the
                  // HOST role -- the room-scoped "moderators cannot act against the host"
                  // carve-out was removed 2026-08-18 alongside the host_id authorization fix.
                  const canActOnThisMember = isGroupManager && !p.isSelf;
                  return (
                  <div key={p.id} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#0F172A', borderRadius: 10, border: '1px solid #334155', gap: 8}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 10, minWidth: 0}}>
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.name} style={{width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0}} />
                      ) : (
                        <div style={{width: 36, height: 36, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 13, flexShrink: 0}}>
                          {p.initial}
                        </div>
                      )}
                      <div style={{minWidth: 0}}>
                        <div style={{color: 'white', fontSize: 13, fontWeight: '600', display: 'flex', alignItems: 'center', gap: 6}}>
                          {p.name}
                          {p.isHost && <span style={{background: '#3B82F6', color: 'white', fontSize: 10, padding: '1px 5px', borderRadius: 4, flexShrink: 0}}>Host</span>}
                          {p.isModerator && <span style={{background: '#7C3AED', color: 'white', fontSize: 10, padding: '1px 5px', borderRadius: 4, flexShrink: 0}}>Điều hành</span>}
                        </div>
                        <div style={{color: '#94A3B8', fontSize: 11}}>{p.handRaised ? '✋ Đang giơ tay' : 'Đang tham gia'}</div>
                      </div>
                    </div>

                    <div style={{display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', flexShrink: 0}}>
                      {p.handRaised && <Hand size={16} color="#F59E0B" />}
                      {/* Reflects Study Room moderation-mute state (audit log), not a real WebRTC mic mute. */}
                      {p.isMuted ? <MicOff size={16} color="#EF4444" /> : <Mic size={16} color="#10B981" />}
                      {canActOnThisMember && (
                        <>
                          <button
                            onClick={() => handleToggleMute(p.userId, p.isMuted)}
                            title={p.isMuted ? 'Bỏ tắt tiếng (moderation)' : 'Tắt tiếng (moderation)'}
                            style={{background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4, display: 'flex'}}
                          >
                            {p.isMuted ? <Mic size={15} /> : <MicOff size={15} />}
                          </button>
                          {/* Backend rule (update_member_role): also requires an active
                              Group owner/moderator, same as canActOnThisMember above -- no
                              separate host-only gate needed here any more. */}
                          <button
                            onClick={() => handleToggleModerator(p.userId, p.isModerator)}
                            title={p.isModerator ? 'Bỏ quyền điều hành' : 'Đặt làm điều hành viên'}
                            style={{background: 'transparent', border: 'none', color: p.isModerator ? '#7C3AED' : '#94A3B8', cursor: 'pointer', padding: 4, display: 'flex'}}
                          >
                            {p.isModerator ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                          </button>
                          <button
                            onClick={() => handleKick(p.userId)}
                            title="Mời ra khỏi phòng"
                            style={{background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4, display: 'flex'}}
                          >
                            <UserX size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

          </aside>
        ) : (
          /* Sleek Right-Edge Chevron Handle when closed */
          <button 
            onClick={() => setIsSidebarOpen(true)}
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#2563EB',
              color: 'white',
              border: 'none',
              borderRadius: '10px 0 0 10px',
              padding: '16px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '-4px 0 16px rgba(37, 99, 235, 0.4)',
              cursor: 'pointer',
              zIndex: 30,
              transition: 'all 0.2s'
            }}
            title="Mở thanh tiện ích (Trò chuyện & Thành viên)"
          >
            <ChevronLeft size={22} />
          </button>
        )}

      </div>

      {/* Floating Bottom Control Dock */}
      <footer style={{height: 72, background: '#1E293B', borderTop: '1px solid #334155', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 30, position: 'relative'}}>
        
        {/* Left indicators */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12, color: '#94A3B8', fontSize: 13}}>
          <Sparkles size={18} color="#38BDF8" />
          <span>StudyTogether Call Room v2.0</span>
        </div>

        {/* Center Control Buttons */}
        <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 16}}>
          
          {/* Mic / Camera — real LiveKit track state, see meeting/MeetingControls.tsx. */}
          <MeetingControls disabled={isRoomEnded} />

          {/* Raise Hand — real moderation action (self-service raise_hand/lower_hand). */}
          <button
            onClick={handleToggleHand}
            disabled={isRoomEnded}
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: 'none',
              background: currentUserHandRaised ? '#F59E0B' : '#334155',
              color: 'white',
              cursor: isRoomEnded ? 'default' : 'pointer',
              opacity: isRoomEnded ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Giơ tay phát biểu"
          >
            <Hand size={20} />
          </button>

          {/* Leave Room Button */}
          <button 
            onClick={handleLeaveRoom}
            style={{
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              border: 'none', 
              background: '#DC2626', 
              color: 'white', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.2s'
            }}
            title="Thoát phòng học"
          >
            <PhoneOff size={20} />
          </button>

        </div>

      </footer>

    </div>
    </MeetingProvider>
  );
}