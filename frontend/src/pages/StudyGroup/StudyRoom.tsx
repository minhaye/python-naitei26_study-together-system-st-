import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  Hand,
  PhoneOff,
  MessageSquare,
  Users,
  FileText,
  Send,
  Pencil,
  Type,
  Eraser,
  Square,
  RotateCcw,
  Trash2,
  ArrowLeft,
  Share2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Download,
  UserX,
  ShieldCheck,
  ShieldOff,
  UserPlus
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useStudyRoom } from '../../hooks/useStudyRoom';
import { getAvatarInitials, getAvatarColor } from '../../utils/avatarUtils';
import { getDisplayName } from '../../utils/userDisplay';
import { InviteModal } from '../../components/invitations/InviteModal';
import { MeetingProvider } from './meeting/MeetingProvider';
import { MeetingVideoGrid } from './meeting/MeetingVideoGrid';
import { MeetingControls } from './meeting/MeetingControls';

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
  const { currentUser } = useAuth();

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

  // Whiteboard tools
  const [selectedTool, setSelectedTool] = useState<'pen' | 'text' | 'eraser' | 'shape'>('pen');
  const [penColor, setPenColor] = useState('#00236F');

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

  const handleJoinRoom = async () => {
    setIsJoining(true);
    try {
      await join();
    } catch {
      // actionError is already populated by the hook.
    } finally {
      setIsJoining(false);
    }
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
          avatarUrl: isSelf ? null : m.user.avatar_url,
          isHost: m.role === 'host',
          isModerator: m.role === 'moderator',
          isSelf,
          isMuted: moderationMutedUserIds.has(m.user_id),
          handRaised: handRaisedUserIds.has(m.user_id),
        };
      });
  }, [members, currentUserId, currentUser, moderationMutedUserIds, handRaisedUserIds]);

  // Chat mock data
  const [messages, setMessages] = useState([
    { id: 1, sender: 'David Chen', initial: 'DC', time: '1:12 PM', text: 'Mọi người đã có slide bài giảng chương 4 chưa?', color: '#059669' },
    { id: 2, sender: 'Minh Anh (Bạn)', initial: 'MA', time: '1:15 PM', text: 'Có chứ, lát nữa tớ sẽ bật Bảng trắng chia sẻ ghi chú cho nhé!', color: '#2563EB', isSelf: true },
    { id: 3, sender: 'Elena Rodriguez', initial: 'ER', time: '1:16 PM', text: 'Cảm ơn Sarah! Liam đang có thắc mắc ở phần phương trình Schrödinger đấy.', color: '#D97706' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [
      ...prev,
      {
        id: Date.now(),
        sender: 'Minh Anh (Bạn)',
        initial: 'MA',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: chatInput,
        color: '#2563EB',
        isSelf: true
      }
    ]);
    setChatInput('');
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

  if (!isCurrentUserMember) {
    return (
      <CenteredRoomMessage
        title={room.name}
        subtitle={room.description || undefined}
        onBack={() => navigate(`/groups/${room.group_id}`)}
      >
        <div style={{color: '#94A3B8', fontSize: 13, marginBottom: 16}}>
          {room.status === 'ended'
            ? 'Phòng học này đã kết thúc.'
            : membersError?.status === 403
              ? 'Bạn cần tham gia để xem và tương tác trong phòng học này.'
              : membersError?.message}
        </div>
        {room.status !== 'ended' && (
          <button
            onClick={handleJoinRoom}
            disabled={isJoining}
            style={{padding: '12px 24px', background: '#2563EB', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: '600', cursor: isJoining ? 'default' : 'pointer', opacity: isJoining ? 0.7 : 1}}
          >
            {isJoining ? 'Đang tham gia...' : 'Tham gia phòng'}
          </button>
        )}
        {actionError && (
          <div style={{color: '#F87171', fontSize: 13, marginTop: 12}}>{actionError.message}</div>
        )}
      </CenteredRoomMessage>
    );
  }

  const statusColor = room.status === 'active' ? '#10B981' : room.status === 'waiting' ? '#F59E0B' : '#64748B';
  const statusLabel = room.status === 'active' ? 'Đang diễn ra' : room.status === 'waiting' ? 'Chưa bắt đầu' : 'Đã kết thúc';
  const isRoomEnded = room.status === 'ended';

  return (
    <MeetingProvider roomId={roomId} enabled={isCurrentUserMember && !isRoomEnded}>
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
                  📄 Slide Bài giảng (Chương 4.pdf)
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
            <div style={{flex: 1, position: 'relative', background: '#FFFFFF', backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '24px 24px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              
              {activeBoardTab === 'whiteboard' ? (
                <div style={{width: '90%', maxWidth: 900, background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 20}}>
                  <h2 style={{color: '#0F172A', fontSize: 24, fontWeight: '700', margin: 0, borderBottom: '2px solid #E2E8F0', paddingBottom: 12}}>
                    Chủ đề 4: Phương trình Schrödinger trong Giếng thế 1D
                  </h2>

                  {/* Formula display box */}
                  <div style={{background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: 20, textAlign: 'center'}}>
                    <div style={{color: '#0369A1', fontSize: 22, fontFamily: 'serif', fontWeight: 'bold'}}>
                      iℏ (∂Ψ / ∂t) = ĤΨ
                    </div>
                    <div style={{color: '#0284C7', fontSize: 13, marginTop: 6}}>
                      Phương trình trạng thái cơ học lượng tử phụ thuộc thời gian
                    </div>
                  </div>

                  {/* Notes cards */}
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16}}>
                    <div style={{background: '#FEF9C3', border: '1px solid #FDE047', padding: 16, borderRadius: 10, color: '#854D0E', fontSize: 14, lineHeight: '1.5'}}>
                      <strong>Ghi chú từ Thầy Hoàng:</strong><br />
                      Chú ý điều kiện biên Ψ(0) = 0 và Ψ(L) = 0 đối với giếng thế vô hạn chiều rộng L!
                    </div>
                    <div style={{background: '#ECFDF5', border: '1px solid #6EE7B7', padding: 16, borderRadius: 10, color: '#065F46', fontSize: 14, lineHeight: '1.5'}}>
                      <strong>Giải thích của Tuấn Kiệt:</strong><br />
                      Toán tử Ĥ bao gồm động năng (-ℏ²/2m ∇²) cộng với thế năng V(r).
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{width: '80%', height: '90%', background: 'white', borderRadius: 12, border: '1px solid #CBD5E1', boxShadow: '0 8px 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32}}>
                  <FileText size={64} color="#3B82F6" style={{marginBottom: 16}} />
                  <h3 style={{fontSize: 20, fontWeight: '700', color: '#0F172A', margin: '0 0 8px 0'}}>Slide Bài Giảng Chương 4: Cơ Học Lượng Tử</h3>
                  <p style={{color: '#64748B', fontSize: 14, margin: 0}}>Trang 12 / 45 • Đang trình chiếu trực tiếp bởi Thầy Hoàng</p>
                </div>
              )}

              {/* Floating Drawing Toolbar */}
              <div style={{position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'white', padding: '8px 16px', borderRadius: 16, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12}}>
                <button 
                  onClick={() => setSelectedTool('pen')}
                  style={{padding: 8, borderRadius: 8, border: 'none', background: selectedTool === 'pen' ? '#EFF6FF' : 'transparent', color: selectedTool === 'pen' ? '#2563EB' : '#64748B', cursor: 'pointer'}}
                  title="Bút vẽ"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={() => setSelectedTool('text')}
                  style={{padding: 8, borderRadius: 8, border: 'none', background: selectedTool === 'text' ? '#EFF6FF' : 'transparent', color: selectedTool === 'text' ? '#2563EB' : '#64748B', cursor: 'pointer'}}
                  title="Nhập văn bản"
                >
                  <Type size={18} />
                </button>
                <button 
                  onClick={() => setSelectedTool('shape')}
                  style={{padding: 8, borderRadius: 8, border: 'none', background: selectedTool === 'shape' ? '#EFF6FF' : 'transparent', color: selectedTool === 'shape' ? '#2563EB' : '#64748B', cursor: 'pointer'}}
                  title="Hình học"
                >
                  <Square size={18} />
                </button>
                <button 
                  onClick={() => setSelectedTool('eraser')}
                  style={{padding: 8, borderRadius: 8, border: 'none', background: selectedTool === 'eraser' ? '#EFF6FF' : 'transparent', color: selectedTool === 'eraser' ? '#2563EB' : '#64748B', cursor: 'pointer'}}
                  title="Tẩy xóa"
                >
                  <Eraser size={18} />
                </button>

                <div style={{height: 20, width: 1, background: '#CBD5E1'}} />

                {/* Color Palette */}
                {['#00236F', '#10B981', '#EF4444', '#F59E0B'].map(c => (
                  <div 
                    key={c}
                    onClick={() => setPenColor(c)}
                    style={{
                      width: 20, 
                      height: 20, 
                      borderRadius: '50%', 
                      background: c, 
                      cursor: 'pointer', 
                      outline: penColor === c ? '2px solid #2563EB' : 'none',
                      outlineOffset: 2
                    }}
                  />
                ))}

                <div style={{height: 20, width: 1, background: '#CBD5E1'}} />

                <button style={{padding: 8, borderRadius: 8, border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer'}} title="Hoàn tác">
                  <RotateCcw size={18} />
                </button>
                <button style={{padding: 8, borderRadius: 8, border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer'}} title="Xóa bảng">
                  <Trash2 size={18} />
                </button>
              </div>

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
                  {messages.map((m) => (
                    <div key={m.id} style={{display: 'flex', gap: 10, flexDirection: m.isSelf ? 'row-reverse' : 'row'}}>
                      <div style={{width: 32, height: 32, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 12, flexShrink: 0}}>
                        {m.initial}
                      </div>
                      <div style={{maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: m.isSelf ? 'flex-end' : 'flex-start'}}>
                        <div style={{display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 4}}>
                          <span style={{color: '#94A3B8', fontSize: 11, fontWeight: '600'}}>{m.sender}</span>
                          <span style={{color: '#64748B', fontSize: 10}}>{m.time}</span>
                        </div>
                        <div style={{
                          padding: '10px 14px', 
                          borderRadius: m.isSelf ? '14px 2px 14px 14px' : '2px 14px 14px 14px', 
                          background: m.isSelf ? '#2563EB' : '#334155', 
                          color: 'white', 
                          fontSize: 13, 
                          lineHeight: '1.4'
                        }}>
                          {m.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div style={{padding: 16, background: '#0F172A', borderTop: '1px solid #334155', display: 'flex', gap: 8, alignItems: 'center'}}>
                  <input 
                    type="text" 
                    placeholder="Nhập tin nhắn vào phòng học..." 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    style={{flex: 1, padding: '10px 14px', background: '#1E293B', border: '1px solid #334155', borderRadius: 8, outline: 'none', color: 'white', fontSize: 13}}
                  />
                  <button 
                    onClick={handleSendMessage}
                    style={{background: '#2563EB', border: 'none', color: 'white', padding: 10, borderRadius: 8, cursor: 'pointer'}}
                  >
                    <Send size={16} />
                  </button>
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