import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Hash,
    Video,
    FileText,
    Settings,
    Send,
    UserPlus,
    ChevronDown,
    Shield,
    Globe,
    Lock,
    LogOut,
    Users,
    Plus
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/apiClient';
import { getGroup, listGroupMembers, leaveGroup, updateGroup } from '../../lib/group.api';
import { createChannel, listChannelsByGroup } from '../../lib/channel.api';
import { createStudyRoom, listStudyRoomsByGroup } from '../../lib/studyRoom.api';
import type { Group, GroupMember } from '../../lib/group.types';
import type { Channel } from '../../lib/channel.types';
import type { StudyRoom } from '../../lib/studyRoom.types';
import { getAvatarInitials, getAvatarColor } from '../../utils/avatarUtils';

export function StudyGroupDetail() {
  const navigate = useNavigate();
  const { id: groupId } = useParams();
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const { user, currentUser } = useAuth();
  const currentUserId = user?.id ?? null;

  // Dynamic States
  const [activeChannel, setActiveChannel] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [mainView, setMainView] = useState<'chat' | 'rooms' | 'documents'>('chat');

  // Group Settings & Dropdown Menu States
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [ownerNote, setOwnerNote] = useState('Nhắc nhở từ Thầy Hoàng: Đọc slide Bài 4 trước 15h hôm nay!');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [newNote, setNewNote] = useState(ownerNote);

  // Real Group/Channel/Study Room domain state (replaces the previous hard-coded mock group).
  const [group, setGroup] = useState<Group | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [studyRooms, setStudyRooms] = useState<StudyRoom[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status: number | null; message: string } | null>(null);

  // Leave-group and public/private-toggle mutation state
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Create Study Room modal state
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [createRoomName, setCreateRoomName] = useState('');
  const [createRoomDescription, setCreateRoomDescription] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createRoomError, setCreateRoomError] = useState<string | null>(null);

  // Create Channel modal state
  const [isCreateChannelModalOpen, setIsCreateChannelModalOpen] = useState(false);
  const [createChannelName, setCreateChannelName] = useState('');
  const [createChannelDescription, setCreateChannelDescription] = useState('');
  const [createChannelIsPrivate, setCreateChannelIsPrivate] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [createChannelError, setCreateChannelError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [groupData, channelsData, roomsData, membersData] = await Promise.all([
          getGroup(groupId as string),
          listChannelsByGroup(groupId as string),
          listStudyRoomsByGroup(groupId as string),
          listGroupMembers(groupId as string),
        ]);
        if (cancelled) return;
        setGroup(groupData);
        setChannels(channelsData);
        setStudyRooms(roomsData);
        setGroupMembers(membersData);
        setActiveChannel((prev) =>
          channelsData.some((c) => c.id === prev) ? prev : (channelsData[0]?.id ?? '')
        );
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setLoadError({ status: err.status, message: err.message });
        } else {
          setLoadError({ status: null, message: 'Không thể tải dữ liệu nhóm học.' });
        }
        setGroup(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const activeMembers = groupMembers.filter((m) => m.status === 'active');
  const isOwner = !!group && !!currentUserId && group.owner_id === currentUserId;
  // Backend rule (POST /study-rooms/): any ACTIVE group member -- any role, not just
  // owner/moderator -- may create a study room (STUDY_PLATFORM_DATABASE_SPEC.md §16).
  const isActiveMember = isOwner || (!!currentUserId && activeMembers.some((m) => m.user_id === currentUserId));
  // Backend rule (POST /channels/, is_group_manager): only the group owner or an active
  // moderator may create a channel -- unlike Study Rooms, plain members cannot.
  const isGroupManager =
    isOwner || (!!currentUserId && activeMembers.some((m) => m.user_id === currentUserId && m.role === 'moderator'));

  async function handleLeaveGroup() {
    if (!group || !currentUserId || isLeaving) return;
    const confirmMessage = isOwner
      ? `Bạn là trưởng nhóm "${group.name}". Rời nhóm sẽ không chuyển quyền trưởng nhóm cho ai khác. Bạn vẫn muốn rời nhóm?`
      : `Bạn có chắc muốn rời nhóm "${group.name}"?`;
    if (!window.confirm(confirmMessage)) return;

    setIsLeaving(true);
    setLeaveError(null);
    try {
      await leaveGroup(group.id, currentUserId);
      navigate('/groups');
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : 'Không thể rời nhóm học.');
      setIsLeaving(false);
    }
  }

  async function handleTogglePublic() {
    if (!group || isTogglingPublic) return;
    setIsTogglingPublic(true);
    setToggleError(null);
    try {
      const updated = await updateGroup(group.id, { is_public: !group.is_public });
      setGroup(updated);
    } catch (err) {
      setToggleError(err instanceof ApiError ? err.message : 'Không thể đổi chế độ công khai/riêng tư.');
    } finally {
      setIsTogglingPublic(false);
    }
  }

  async function handleCreateRoom() {
    if (!group || !currentUserId || !createRoomName.trim() || isCreatingRoom) return;
    setIsCreatingRoom(true);
    setCreateRoomError(null);
    try {
      const newRoom = await createStudyRoom({
        group_id: group.id,
        name: createRoomName.trim(),
        description: createRoomDescription.trim() || null,
      });
      // Real, persisted room returned by the backend -- append to reflect it immediately;
      // a refresh re-fetches from the backend and will show the same room.
      setStudyRooms((prev) => [...prev, newRoom]);
      setIsCreateRoomModalOpen(false);
      setCreateRoomName('');
      setCreateRoomDescription('');
    } catch (err) {
      setCreateRoomError(err instanceof ApiError ? err.message : 'Không thể tạo phòng học.');
    } finally {
      setIsCreatingRoom(false);
    }
  }

  async function handleCreateChannel() {
    if (!group || !createChannelName.trim() || isCreatingChannel) return;
    setIsCreatingChannel(true);
    setCreateChannelError(null);
    try {
      const newChannel = await createChannel({
        group_id: group.id,
        name: createChannelName.trim(),
        description: createChannelDescription.trim() || null,
        is_private: createChannelIsPrivate,
      });
      // Real, persisted channel returned by the backend -- append and switch to it; a
      // refresh re-fetches from the backend and will show the same channel.
      setChannels((prev) => [...prev, newChannel]);
      setActiveChannel(newChannel.id);
      setMainView('chat');
      setIsCreateChannelModalOpen(false);
      setCreateChannelName('');
      setCreateChannelDescription('');
      setCreateChannelIsPrivate(false);
    } catch (err) {
      setCreateChannelError(err instanceof ApiError ? err.message : 'Không thể tạo kênh chat.');
    } finally {
      setIsCreatingChannel(false);
    }
  }

  // Mock data for chat messages across channels — chat/messages integration is a separate
  // task, so this stays purely local; only the channel *list* above is real.
  const [messages, setMessages] = useState<Record<string, any[]>>({});

  // Auto-scroll chat to bottom on new message or channel change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel, mainView]);

  // Study Rooms that can still be joined/watched (mirrors the backend's can_join_room lifecycle gate).
  const openRooms = studyRooms.filter((r) => r.status !== 'ended');

  const handleJoinRoom = (roomId: string) => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    navigate(`/room/${roomId}`);
  };

  const handleSendMessage = () => {
    if (!chatInput.trim() || !activeChannel) return;

    const newMessage = {
      id: Date.now(),
      sender: `${currentUser.name} (Bạn)`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: chatInput,
      avatar: null,
    };

    setMessages(prev => ({
      ...prev,
      [activeChannel]: [...(prev[activeChannel] || []), newMessage]
    }));

    setChatInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const activeChannelObj = channels.find((c) => c.id === activeChannel) ?? null;

  const memberDisplay = (member: GroupMember) => {
    const isSelf = member.user_id === currentUserId;
    const name = isSelf ? `${currentUser.name} (Bạn)` : `Người dùng #${member.user_id.slice(0, 4).toUpperCase()}`;
    return {
      name,
      initials: isSelf ? currentUser.initials : getAvatarInitials(member.user_id),
      color: isSelf ? currentUser.color : getAvatarColor(member.user_id),
    };
  };

  // --- Loading / error states (real backend data drives all of these) ---

  if (!groupId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)', gap: 12, color: '#64748B' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#0F172A' }}>Thiếu mã nhóm học</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)', color: '#64748B', fontSize: 15 }}>
        Đang tải nhóm học...
      </div>
    );
  }

  if (loadError || !group) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)', gap: 12, textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#0F172A' }}>
          {loadError?.status === 404 ? 'Không tìm thấy nhóm học' : 'Không thể tải nhóm học'}
        </div>
        {loadError?.message && <div style={{ color: '#64748B', fontSize: 14, maxWidth: 420 }}>{loadError.message}</div>}
        <button
          onClick={() => navigate('/groups')}
          style={{ marginTop: 8, padding: '10px 18px', background: '#00236F', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          Quay lại danh sách nhóm
        </button>
      </div>
    );
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', width: '100%', overflow: 'hidden'}}>
        {/* Main Content - Discord-like 3-pane layout */}
        <div style={{display: 'flex', flex: 1, overflow: 'hidden', background: 'white', width: '100%'}}>

            {/* Left Sidebar - Channels & Rooms */}
            <div style={{width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#F8FAFC', borderRight: '1px solid #E2E8F0'}}>
                {/* Group Info Header with Discord-style Menu */}
                <div style={{position: 'relative', borderBottom: '1px solid #E2E8F0'}}>
                    <div
                        onClick={() => setShowGroupMenu(!showGroupMenu)}
                        style={{
                            padding: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: showGroupMenu ? '#F1F5F9' : 'transparent',
                            transition: 'background 0.2s'
                        }}
                    >
                        <div style={{flex: 1, minWidth: 0, paddingRight: 8}}>
                            <div style={{color: '#0B1C30', fontSize: 16, fontFamily: 'Inter', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                {group.name}
                            </div>
                            <div style={{color: '#64748B', fontSize: 12, fontFamily: 'Inter', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6}}>
                                <span style={{padding: '2px 6px', background: group.is_public ? '#DCFCE7' : '#FEF3C7', color: group.is_public ? '#15803D' : '#B45309', borderRadius: 4, fontSize: 10, fontWeight: '700'}}>
                                    {group.is_public ? 'Public' : 'Private'}
                                </span>
                                <span>• {activeMembers.length} thành viên</span>
                            </div>
                        </div>
                        <ChevronDown size={18} color="#64748B" style={{transform: showGroupMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}} />
                    </div>

                    {/* Discord-style Dropdown Menu */}
                    {showGroupMenu && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 8,
                                right: 8,
                                zIndex: 50,
                                background: 'white',
                                borderRadius: 8,
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                border: '1px solid #E2E8F0',
                                padding: '6px',
                                marginTop: 4,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2
                            }}
                        >
                            <div
                                onClick={() => { alert('Mở bảng Cài đặt nhóm học'); setShowGroupMenu(false); }}
                                style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#1E293B', cursor: 'pointer'}}
                                onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <Settings size={16} color="#475569" /> Cài đặt nhóm
                            </div>

                            {isOwner && (
                                <>
                                    <div
                                        onClick={() => { alert('Phân quyền và quản lý danh sách vai trò'); setShowGroupMenu(false); }}
                                        style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#1E293B', cursor: 'pointer'}}
                                        onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <Shield size={16} color="#475569" /> Phân quyền & Vai trò
                                    </div>

                                    <div
                                        onClick={() => {
                                            if (isTogglingPublic) return;
                                            setShowGroupMenu(false);
                                            handleTogglePublic();
                                        }}
                                        style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: isTogglingPublic ? '#94A3B8' : '#1E293B', cursor: isTogglingPublic ? 'not-allowed' : 'pointer'}}
                                        onMouseOver={e => !isTogglingPublic && (e.currentTarget.style.background = '#F1F5F9')}
                                        onMouseOut={e => !isTogglingPublic && (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {group.is_public ? <Lock size={16} color="#475569" /> : <Globe size={16} color="#475569" />}
                                        {isTogglingPublic ? 'Đang cập nhật...' : group.is_public ? 'Chuyển sang Riêng tư' : 'Chuyển sang Công khai'}
                                    </div>
                                </>
                            )}

                            <div
                                onClick={() => { alert('Đã sao chép liên kết mời tham gia nhóm học!'); setShowGroupMenu(false); }}
                                style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#1E293B', cursor: 'pointer'}}
                                onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <UserPlus size={16} color="#475569" /> Mời thêm người
                            </div>

                            <div style={{height: 1, background: '#E2E8F0', margin: '4px 0'}} />

                            <div
                                onClick={() => {
                                    if (isLeaving) return;
                                    setShowGroupMenu(false);
                                    handleLeaveGroup();
                                }}
                                style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: isLeaving ? '#F1A9A0' : '#DC2626', cursor: isLeaving ? 'not-allowed' : 'pointer'}}
                                onMouseOver={e => !isLeaving && (e.currentTarget.style.background = '#FEF2F2')}
                                onMouseOut={e => !isLeaving && (e.currentTarget.style.background = 'transparent')}
                            >
                                <LogOut size={16} color={isLeaving ? '#F1A9A0' : '#DC2626'} /> {isLeaving ? 'Đang rời nhóm...' : 'Rời nhóm học'}
                            </div>
                        </div>
                    )}
                </div>

                {(leaveError || toggleError) && (
                    <div style={{ margin: '12px 12px 0 12px', padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 12.5 }}>
                        {leaveError || toggleError}
                    </div>
                )}

                {/* Owner Note / Announcement Banner (local-only placeholder; no backend concept for this yet) */}
                <div style={{
                    margin: '12px 12px 4px 12px',
                    padding: '12px 14px',
                    background: '#F0F9FF',
                    borderRadius: '8px',
                    border: '1px solid #BAE6FD',
                    borderLeft: '4px solid #0284C7',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                }}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6}}>
                        <span style={{fontSize: 11, fontWeight: '700', color: '#0369A1', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
                            Ghi chú
                        </span>
                        {isOwner && (
                            <span
                                onClick={(e) => { e.stopPropagation(); setIsEditingNote(!isEditingNote); }}
                                style={{fontSize: 11, fontWeight: '600', color: '#0284C7', cursor: 'pointer', textDecoration: 'underline'}}
                            >
                                {isEditingNote ? 'Hủy' : 'Sửa'}
                            </span>
                        )}
                    </div>
                    {isEditingNote ? (
                        <div style={{marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6}}>
                            <textarea
                                value={newNote}
                                onChange={e => setNewNote(e.target.value)}
                                style={{
                                    padding: '6px 8px',
                                    fontSize: 12,
                                    borderRadius: 6,
                                    border: '1px solid #7DD3FC',
                                    outline: 'none',
                                    resize: 'vertical',
                                    minHeight: '54px',
                                    fontFamily: 'inherit'
                                }}
                            />
                            <button
                                onClick={() => { setOwnerNote(newNote); setIsEditingNote(false); }}
                                style={{
                                    padding: '4px 12px',
                                    background: '#0284C7',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    alignSelf: 'flex-end',
                                    transition: 'background 0.2s'
                                }}
                            >
                                Lưu
                            </button>
                        </div>
                    ) : (
                        <div style={{fontSize: 12.5, color: '#0F172A', lineHeight: '1.5', fontWeight: '450'}}>
                            {ownerNote}
                        </div>
                    )}
                </div>

                {/* Scrollable Channels List */}
                <div style={{flex: 1, overflowY: 'auto', padding: '16px 8px'}}>

                    {/* Text Channels */}
                    <div style={{marginBottom: 24}}>
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 8, paddingRight: 4}}>
                            <div style={{color: '#64748B', fontSize: 12, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase'}}>Kênh Chat</div>
                            {isGroupManager && (
                                <button
                                    onClick={() => { setCreateChannelError(null); setIsCreateChannelModalOpen(true); }}
                                    title="Tạo kênh chat mới"
                                    style={{width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#64748B'}}
                                    onMouseOver={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0B1C30'; }}
                                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B'; }}
                                >
                                    <Plus size={14} />
                                </button>
                            )}
                        </div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                            {channels.length === 0 && (
                                <div style={{padding: '8px 12px', color: '#94A3B8', fontSize: 13}}>Chưa có kênh nào.</div>
                            )}
                            {channels.map((channel) => {
                                const isActive = activeChannel === channel.id && mainView === 'chat';
                                return (
                                    <div
                                        key={channel.id}
                                        onClick={() => { setActiveChannel(channel.id); setMainView('chat'); }}
                                        style={{padding: '8px 12px', background: isActive ? '#E2E8F0' : 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, color: isActive ? '#0F172A' : '#475569', fontWeight: isActive ? '600' : '500', cursor: 'pointer'}}
                                        onMouseOver={e => !isActive && (e.currentTarget.style.background = '#F1F5F9')}
                                        onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {channel.is_private ? <Lock size={16} color={isActive ? '#64748B' : '#94A3B8'} /> : <Hash size={18} color={isActive ? '#64748B' : '#94A3B8'} />}
                                        {channel.name}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Voice / Video Rooms */}
                    <div style={{marginBottom: 24}}>
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 8, paddingRight: 4}}>
                            <div style={{color: '#64748B', fontSize: 12, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase'}}>Phòng học</div>
                            {isActiveMember && (
                                <button
                                    onClick={() => { setCreateRoomError(null); setIsCreateRoomModalOpen(true); }}
                                    title="Tạo phòng học mới"
                                    style={{width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#64748B'}}
                                    onMouseOver={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0B1C30'; }}
                                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B'; }}
                                >
                                    <Plus size={14} />
                                </button>
                            )}
                        </div>

                        <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                            {openRooms.length === 0 && (
                                <div style={{padding: '8px', color: '#94A3B8', fontSize: 13}}>Chưa có phòng học nào đang mở.</div>
                            )}
                            {/* Limit rooms to top 2 for Sidebar */}
                            {openRooms.slice(0, 2).map(room => (
                                <div key={room.id} style={{padding: '10px 12px', background: '#E0E7FF', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', border: '1px solid #C7D2FE'}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                        <div style={{display: 'flex', alignItems: 'center', gap: 8, color: '#4338CA', fontWeight: '600'}}>
                                            <Video size={16} /> {room.name}
                                        </div>
                                        <div style={{background: room.status === 'active' ? '#10B981' : '#F59E0B', color: 'white', fontSize: 10, fontWeight: '700', padding: '2px 6px', borderRadius: 4}}>
                                            {room.status === 'active' ? 'LIVE' : 'CHỜ'}
                                        </div>
                                    </div>
                                    {room.description && (
                                        <div style={{fontSize: 12, color: '#475569', paddingLeft: 24}}>
                                            {room.description}
                                        </div>
                                    )}
                                    <div
                                      onClick={() => handleJoinRoom(room.id)}
                                      style={{padding: '8px 0', background: 'white', borderRadius: 6, textAlign: 'center', color: '#4338CA', fontSize: 12, fontWeight: '600', border: '1px solid #C7D2FE', cursor: 'pointer', transition: 'all 0.2s'}}
                                      onMouseOver={e => e.currentTarget.style.background = '#EEF2FF'}
                                      onMouseOut={e => e.currentTarget.style.background = 'white'}
                                    >
                                        Tham gia ngay
                                    </div>
                                </div>
                            ))}

                            {/* View All rooms Button */}
                            {openRooms.length > 2 && (
                                <div
                                    onClick={() => setMainView('rooms')}
                                    style={{padding: '8px', textAlign: 'center', color: '#4338CA', fontSize: 13, fontWeight: '600', cursor: 'pointer', borderRadius: 6, background: '#EEF2FF', border: '1px dashed #C7D2FE', transition: 'all 0.2s'}}
                                    onMouseOver={e => e.currentTarget.style.background = '#E0E7FF'}
                                    onMouseOut={e => e.currentTarget.style.background = '#EEF2FF'}
                                >
                                    Xem tất cả {openRooms.length} phòng học
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Resources — placeholder until Resources API integration (separate task) */}
                    <div>
                        <div style={{color: '#64748B', fontSize: 12, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8}}>Tài liệu đính kèm</div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                            <div style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer'}} onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                <FileText size={18} color="#3B82F6" style={{marginTop: 2}} />
                                <div>
                                    <div style={{color: '#334155', fontSize: 13, fontWeight: '500', marginBottom: 2}}>Bai_Giang_Chuong_1.pdf</div>
                                    <div style={{color: '#94A3B8', fontSize: 11}}>2.4 MB • Tải xuống</div>
                                </div>
                            </div>
                            <div style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer'}} onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                <FileText size={18} color="#10B981" style={{marginTop: 2}} />
                                <div>
                                    <div style={{color: '#334155', fontSize: 13, fontWeight: '500', marginBottom: 2}}>Ghi_chep_nhom.docx</div>
                                    <div style={{color: '#94A3B8', fontSize: 11}}>Đang cùng chỉnh sửa</div>
                                </div>
                            </div>
                        </div>
                        {/* Nút Xem tất cả tài liệu đính kèm */}
                        <div style={{marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 12}}>
                            <div
                                onClick={() => setMainView('documents')}
                                style={{padding: '8px', textAlign: 'center', color: '#4338CA', fontSize: 13, fontWeight: '600', cursor: 'pointer', borderRadius: 6, background: '#EEF2FF', border: '1px dashed #C7D2FE', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6}}
                                onMouseOver={e => e.currentTarget.style.background = '#E0E7FF'}
                                onMouseOut={e => e.currentTarget.style.background = '#EEF2FF'}
                            >
                                Xem tất cả tài liệu
                            </div>
                        </div>
                    </div>

                </div>


            </div>

            {/* Center - Main Area */}
            {mainView === 'chat' ? (
                <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'white'}}>

                    {/* Chat Header */}
                    <div style={{height: 60, padding: '0 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 8, color: '#0F172A', fontSize: 18, fontWeight: '700'}}>
                            <Hash size={24} color="#64748B" /> {activeChannelObj?.name ?? 'Chưa chọn kênh'}
                        </div>
                        <div style={{display: 'flex', gap: 16, color: '#64748B'}}>
                        </div>
                    </div>

                    {/* Messages List */}
                    <div style={{flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20}}>

                        {/* Welcome Message */}
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '32px 0', color: '#94A3B8'}}>
                            <Hash size={48} color="#CBD5E1" style={{marginBottom: 16}} />
                            <div style={{fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 8}}>
                                {activeChannelObj ? `Chào mừng đến với #${activeChannelObj.name}!` : 'Nhóm học chưa có kênh chat nào'}
                            </div>
                            {activeChannelObj && <div style={{fontSize: 14}}>Đây là sự khởi đầu của kênh #{activeChannelObj.name}.</div>}
                        </div>

                        {/* Map through active channel messages (local-only mock; chat integration is a separate task) */}
                        {(messages[activeChannel] || []).map((msg) => (
                            <div key={msg.id} style={{display: 'flex', gap: 16}}>
                                <div style={{width: 40, height: 40, borderRadius: '50%', background: '#00236F', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0}}>
                                    {getAvatarInitials(msg.sender)}
                                </div>
                                <div>
                                    <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4}}>
                                        <span style={{color: '#0F172A', fontSize: 15, fontWeight: '600'}}>{msg.sender}</span>
                                        <span style={{color: '#94A3B8', fontSize: 12}}>{msg.time}</span>
                                    </div>
                                    <div style={{color: '#334155', fontSize: 15, lineHeight: '1.5', wordBreak: 'break-word'}}>
                                        {msg.text}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div style={{padding: '0 24px 24px 24px'}}>
                        <div style={{background: '#F1F5F9', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '12px 16px', border: '1px solid #E2E8F0', transition: 'border-color 0.2s'}}>
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                disabled={!activeChannel}
                                placeholder={activeChannelObj ? `Nhắn tin cho #${activeChannelObj.name}...` : 'Chọn một kênh để bắt đầu'}
                                style={{border: 'none', background: 'transparent', flex: 1, outline: 'none', fontSize: 15, color: '#0F172A'}}
                            />
                            <button onClick={handleSendMessage} style={{background: 'transparent', border: 'none', padding: 0, display: 'flex', cursor: chatInput.trim() ? 'pointer' : 'not-allowed', opacity: chatInput.trim() ? 1 : 0.5}}>
                              <Send size={20} color="#00236F" />
                            </button>
                        </div>
                    </div>
                </div>
            ) : mainView === 'rooms' ? (
                <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#F8FAFC'}}>
                    <div style={{height: 60, padding: '0 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', color: '#0F172A', fontSize: 18, fontWeight: '700', background: 'white'}}>
                        Danh sách Phòng học ({openRooms.length})
                    </div>
                    <div style={{flex: 1, overflowY: 'auto', padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24, alignContent: 'flex-start'}}>
                        {openRooms.map(room => (
                            <div key={room.id} style={{background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column'}}>
                                <div style={{height: 100, background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #E2E8F0'}}>
                                    <Video size={36} color="#60A5FA" />
                                    <div style={{position: 'absolute', top: 12, right: 12, background: room.status === 'active' ? '#10B981' : '#F59E0B', color: 'white', fontSize: 10, fontWeight: '700', padding: '4px 8px', borderRadius: 4, letterSpacing: 0.5}}>
                                        {room.status === 'active' ? 'LIVE' : 'CHỜ BẮT ĐẦU'}
                                    </div>
                                </div>
                                <div style={{padding: 20, flex: 1, display: 'flex', flexDirection: 'column'}}>
                                    <div style={{fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 6}}>{room.name}</div>
                                    <div style={{fontSize: 14, color: '#64748B', marginBottom: 20, flex: 1}}>{room.description || 'Chưa có mô tả.'}</div>
                                    <button
                                        onClick={() => handleJoinRoom(room.id)}
                                        style={{width: '100%', padding: '12px 0', background: '#3B82F6', color: 'white', borderRadius: 8, border: 'none', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s'}}
                                        onMouseOver={e => e.currentTarget.style.background = '#2563EB'}
                                        onMouseOut={e => e.currentTarget.style.background = '#3B82F6'}
                                    >
                                        Tham gia phòng
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'white'}}>
                    <div style={{height: 60, padding: '0 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', color: '#0F172A', fontSize: 18, fontWeight: '700', background: 'white'}}>
                        Tất cả dữ liệu đính kèm
                    </div>
                    {/* Bảng danh sách tài liệu (Zalo Style) */}
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 100px 120px', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', fontSize: 13, color: '#64748B', fontWeight: '500', background: '#F8FAFC'}}>
                        <div>Tên</div>
                        <div>Kích thước</div>
                        <div>Ngày gửi</div>
                    </div>
                    {/* Danh sách file */}
                    <div style={{flex: 1, overflowY: 'auto'}}>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 100px 120px', padding: '16px 24px', borderBottom: '1px solid #F1F5F9', alignItems: 'center', transition: 'background 0.2s', cursor: 'pointer'}} onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                <div style={{width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                                    <FileText size={20} color="#3B82F6" />
                                </div>
                                <div style={{color: '#0F172A', fontSize: 14, fontWeight: '500'}}>Bai_Giang_Chuong_1.pdf</div>
                            </div>
                            <div style={{color: '#64748B', fontSize: 13}}>2.4 MB</div>
                            <div style={{color: '#64748B', fontSize: 13}}>22/07/2026</div>
                        </div>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 100px 120px', padding: '16px 24px', borderBottom: '1px solid #F1F5F9', alignItems: 'center', transition: 'background 0.2s', cursor: 'pointer'}} onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                <div style={{width: 36, height: 36, borderRadius: 8, background: '#ECFDF5', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                                    <FileText size={20} color="#10B981" />
                                </div>
                                <div style={{color: '#0F172A', fontSize: 14, fontWeight: '500'}}>Ghi_chep_nhom.docx</div>
                            </div>
                            <div style={{color: '#64748B', fontSize: 13}}>261 KB</div>
                            <div style={{color: '#64748B', fontSize: 13}}>22/07/2026</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Right Sidebar - Members (real backend group members) */}
            <div style={{width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#F8FAFC', borderLeft: '1px solid #E2E8F0'}}>

                {/* Header */}
                <div style={{padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white'}}>
                    <div style={{color: '#0F172A', fontWeight: '700', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%'}}>
                        <Users size={18} color="#00236F" /> Thành viên ({activeMembers.length})
                    </div>
                </div>

                {/* Members List */}
                <div style={{flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 24}}>

                    {/* Role Group: Owner */}
                    <div>
                        <div style={{color: '#64748B', fontSize: 11, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase', marginBottom: 12}}>Trưởng nhóm</div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                            {activeMembers.filter(m => m.role === 'owner').map((member) => {
                                const display = memberDisplay(member);
                                return (
                                    <div key={member.id} style={{display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6, cursor: 'default'}} onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <div style={{width: 36, height: 36, borderRadius: '50%', background: display.color, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700', fontSize: 13}}>
                                            {display.initials}
                                        </div>
                                        <div style={{flex: 1}}>
                                            <div style={{color: '#0F172A', fontSize: 14, fontWeight: '600'}}>{display.name}</div>
                                            <div style={{color: '#64748B', fontSize: 12}}>Host</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Role Group: Members */}
                    <div>
                        <div style={{color: '#64748B', fontSize: 11, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase', marginBottom: 12}}>Thành viên</div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                            {activeMembers.filter(m => m.role !== 'owner').length === 0 && (
                                <div style={{color: '#94A3B8', fontSize: 13, padding: '8px'}}>Chưa có thành viên khác.</div>
                            )}
                            {activeMembers.filter(m => m.role !== 'owner').map((member) => {
                                const display = memberDisplay(member);
                                return (
                                    <div key={member.id} style={{display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6, cursor: 'default'}} onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <div style={{width: 36, height: 36, borderRadius: '50%', background: display.color, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700', fontSize: 13}}>
                                            {display.initials}
                                        </div>
                                        <div style={{flex: 1}}>
                                            <div style={{color: '#0F172A', fontSize: 14, fontWeight: '600'}}>{display.name}</div>
                                            {member.role === 'moderator' && <div style={{color: '#7C3AED', fontSize: 12}}>Điều hành viên</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>

                {/* Invite Button */}
                <div style={{padding: '16px', borderTop: '1px solid #E2E8F0', background: 'white'}}>
                    <button
                        onClick={() => alert('Đã sao chép liên kết mời tham gia nhóm học!')}
                        style={{width: '100%', padding: '10px', background: '#00236F', color: 'white', border: 'none', borderRadius: 6, fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer'}}
                    >
                        <UserPlus size={18} /> Mời thêm người
                    </button>
                </div>
            </div>

        </div>

        {/* Modal: Tạo phòng học mới */}
        {isCreateRoomModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                <div style={{ background: 'white', borderRadius: 12, width: 440, padding: 32, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.1)' }}>
                    <button
                        onClick={() => { if (!isCreatingRoom) { setIsCreateRoomModalOpen(false); setCreateRoomError(null); } }}
                        disabled={isCreatingRoom}
                        style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: isCreatingRoom ? 'not-allowed' : 'pointer', color: '#64748B', fontSize: 18 }}
                    >
                        ✕
                    </button>

                    <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginBottom: 20, fontFamily: 'Inter' }}>Tạo phòng học mới</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', fontFamily: 'Inter' }}>Tên phòng học *</label>
                        <input
                            type="text"
                            value={createRoomName}
                            onChange={(e) => setCreateRoomName(e.target.value)}
                            placeholder="VD: Ôn tập Chương 3"
                            disabled={isCreatingRoom}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter' }}
                            autoFocus
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', fontFamily: 'Inter' }}>Mô tả</label>
                        <textarea
                            value={createRoomDescription}
                            onChange={(e) => setCreateRoomDescription(e.target.value)}
                            placeholder="Mô tả ngắn về nội dung buổi học (không bắt buộc)"
                            disabled={isCreatingRoom}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter', resize: 'vertical', minHeight: 72 }}
                        />
                    </div>

                    {createRoomError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
                            {createRoomError}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => { if (!isCreatingRoom) { setIsCreateRoomModalOpen(false); setCreateRoomError(null); } }}
                            disabled={isCreatingRoom}
                            style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: '#F1F5F9', color: '#475569', border: 'none', fontSize: 14, fontWeight: 600, cursor: isCreatingRoom ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleCreateRoom}
                            disabled={isCreatingRoom || !createRoomName.trim()}
                            style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: (isCreatingRoom || !createRoomName.trim()) ? '#93A4C7' : '#00236F', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: (isCreatingRoom || !createRoomName.trim()) ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                        >
                            {isCreatingRoom ? 'Đang tạo...' : 'Tạo phòng học'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal: Tạo kênh chat mới */}
        {isCreateChannelModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                <div style={{ background: 'white', borderRadius: 12, width: 440, padding: 32, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.1)' }}>
                    <button
                        onClick={() => { if (!isCreatingChannel) { setIsCreateChannelModalOpen(false); setCreateChannelError(null); } }}
                        disabled={isCreatingChannel}
                        style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: isCreatingChannel ? 'not-allowed' : 'pointer', color: '#64748B', fontSize: 18 }}
                    >
                        ✕
                    </button>

                    <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginBottom: 20, fontFamily: 'Inter' }}>Tạo kênh chat mới</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', fontFamily: 'Inter' }}>Tên kênh *</label>
                        <input
                            type="text"
                            value={createChannelName}
                            onChange={(e) => setCreateChannelName(e.target.value)}
                            placeholder="VD: thao-luan-chung"
                            disabled={isCreatingChannel}
                            maxLength={80}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter' }}
                            autoFocus
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', fontFamily: 'Inter' }}>Mô tả</label>
                        <textarea
                            value={createChannelDescription}
                            onChange={(e) => setCreateChannelDescription(e.target.value)}
                            placeholder="Mô tả ngắn về mục đích của kênh (không bắt buộc)"
                            disabled={isCreatingChannel}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter', resize: 'vertical', minHeight: 72 }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                        <input
                            type="checkbox"
                            id="create-channel-private"
                            checked={createChannelIsPrivate}
                            onChange={(e) => setCreateChannelIsPrivate(e.target.checked)}
                            disabled={isCreatingChannel}
                            style={{ width: 16, height: 16, cursor: isCreatingChannel ? 'not-allowed' : 'pointer' }}
                        />
                        <label htmlFor="create-channel-private" style={{ fontSize: 13, color: '#334155', fontFamily: 'Inter', cursor: isCreatingChannel ? 'not-allowed' : 'pointer' }}>
                            Kênh riêng tư (chỉ thành viên được thêm mới xem được)
                        </label>
                    </div>

                    {createChannelError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
                            {createChannelError}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => { if (!isCreatingChannel) { setIsCreateChannelModalOpen(false); setCreateChannelError(null); } }}
                            disabled={isCreatingChannel}
                            style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: '#F1F5F9', color: '#475569', border: 'none', fontSize: 14, fontWeight: 600, cursor: isCreatingChannel ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleCreateChannel}
                            disabled={isCreatingChannel || !createChannelName.trim()}
                            style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: (isCreatingChannel || !createChannelName.trim()) ? '#93A4C7' : '#00236F', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: (isCreatingChannel || !createChannelName.trim()) ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                        >
                            {isCreatingChannel ? 'Đang tạo...' : 'Tạo kênh'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
