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
    Lock,
    LogOut,
    Plus,
    MoreVertical,
    Trash2,
    Ticket,
    Download,
    Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useChannelMessagesRealtime } from '../../hooks/useChannelMessagesRealtime';
import { useMessageReactionsRealtime } from '../../hooks/useMessageReactionsRealtime';
import { useMessageReactionActions } from '../../hooks/useMessageReactionActions';
import { useMessageImageAttachment, ALLOWED_IMAGE_ACCEPT } from '../../hooks/useMessageImageAttachment';
import { MessageAttachmentImage } from '../../components/chat/MessageAttachmentImage';
import { MessageReactions } from '../../components/chat/MessageReactions';
import { SelectedImagePreview } from '../../components/chat/SelectedImagePreview';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { useGroupTableRealtime } from '../../hooks/useGroupTableRealtime';
import { useGroupResources } from '../../hooks/useGroupResources';
import { useGroupNotes } from '../../hooks/useGroupNotes';
import { NotesStackPanel } from './NotesStackPanel';
import { ApiError } from '../../lib/apiClient';
import { getGroup, listGroupMembers, leaveGroup, removeMember, updateMemberRole } from '../../lib/group.api';
import { InviteModal } from '../../components/invitations/InviteModal';
import { JoinByCodeModal } from '../../components/invitations/JoinByCodeModal';
import { GroupSettingsModal } from '../../components/groups/GroupSettingsModal';
import { GroupMembersPanel } from '../../components/groups/GroupMembersPanel';
import { MessageUserTrigger } from '../../components/messages/MessageUserTrigger';
import { createChannel, deleteChannel, getChannel, listChannelsByGroup } from '../../lib/channel.api';
import { createStudyRoom, deleteStudyRoom, getStudyRoom, listStudyRoomsByGroup } from '../../lib/studyRoom.api';
import { listConversationMessages, sendConversationMessage } from '../../lib/message.api';
import type { Group, GroupMember } from '../../lib/group.types';
import type { Channel } from '../../lib/channel.types';
import type { StudyRoom } from '../../lib/studyRoom.types';
import type { Message, MessageReactionSummary } from '../../lib/message.types';
import { getAvatarInitials, getAvatarColor } from '../../utils/avatarUtils';
import { getDisplayName } from '../../utils/userDisplay';

/** Appends `message` unless a message with the same id is already present. REST send
 * responses and Realtime INSERT events for the sender's own message both resolve to the
 * same persisted row, so both paths must go through this to avoid rendering it twice --
 * regardless of which of the two arrives first. */
function appendMessageDeduped(prev: Message[], message: Message): Message[] {
  return prev.some((m) => m.id === message.id) ? prev : [...prev, message];
}

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

  // Group Notes: shared content maintained by the Group Owner/Moderator (real, group-scoped,
  // persisted via backend -- see note_router.py). Displayed as a paper stack (see
  // NotesStackPanel): exactly one Note focused/visible at a time, navigated via Previous/Next.
  // All stack/composer/editor state lives in the hook -- this page only wires it to the panel.
  const groupNotesController = useGroupNotes(groupId);

  // Real Group/Channel/Study Room domain state (replaces the previous hard-coded mock group).
  const [group, setGroup] = useState<Group | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [studyRooms, setStudyRooms] = useState<StudyRoom[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status: number | null; message: string } | null>(null);

  // Leave-group mutation state
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  // Group Settings modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Member role-change / removal mutation state -- a single pending action at a time,
  // mirrors the single-flag pattern used by isDeletingChannel/isDeletingRoom below.
  const [memberActionPendingId, setMemberActionPendingId] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);

  // Create Study Room modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [channelToInvite, setChannelToInvite] = useState<Channel | null>(null);
  // Dedicated Join Study Room / Join Private Channel entry points (see JoinByCodeModal) --
  // distinct from the group-level "Mời thêm người" (create invitation) flow above.
  const [isJoinRoomModalOpen, setIsJoinRoomModalOpen] = useState(false);
  const [isJoinChannelModalOpen, setIsJoinChannelModalOpen] = useState(false);

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

  // Delete Channel: per-row "⋮" menu + confirmation modal state
  const [openChannelMenuId, setOpenChannelMenuId] = useState<string | null>(null);
  const [channelPendingDelete, setChannelPendingDelete] = useState<Channel | null>(null);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);
  const [deleteChannelError, setDeleteChannelError] = useState<string | null>(null);

  // Delete Study Room: per-row "⋮" menu + confirmation modal state (mirrors Delete Channel above)
  const [openRoomMenuId, setOpenRoomMenuId] = useState<string | null>(null);
  const [roomPendingDelete, setRoomPendingDelete] = useState<StudyRoom | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [deleteRoomError, setDeleteRoomError] = useState<string | null>(null);

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

  // Live-syncs Channels/Study Rooms as other Group members create/rename/edit them, on top of
  // the REST load above (see useGroupTableRealtime.ts). Both hydrate every INSERT/UPDATE via
  // GET /channels/{id} / GET /study-rooms/{id}: `conversation_id` on both Channel and StudyRoom
  // is a backend-computed field (a Python @property joined from the row's related Conversation,
  // not a real `channels`/`study_rooms` column), so the raw Realtime row can never be cast
  // directly to these types -- same reason Group Notes (useGroupNotesRealtime.ts) and messages
  // (useChannelMessagesRealtime.ts) hydrate instead of using the raw row. INSERT/UPDATE only:
  // both tables are soft-deleted via UPDATE, and Realtime does not reliably deliver an UPDATE
  // that flips a row from visible to invisible under RLS -- see useGroupTableRealtime.ts's
  // header for why that gap is deliberately not worked around here. The `deleted_at` branches
  // below are defense in depth for the rare case such an event *does* arrive and *does*
  // hydrate, not the primary removal path.
  useGroupTableRealtime<Channel>('channels', group?.id ?? null, getChannel, {
    onInsert: (channel) => {
      if (channel.deleted_at) return;
      setChannels((prev) => (prev.some((c) => c.id === channel.id) ? prev : [...prev, channel]));
    },
    onUpdate: (channel) => {
      setChannels((prev) => {
        if (channel.deleted_at) return prev.filter((c) => c.id !== channel.id);
        const idx = prev.findIndex((c) => c.id === channel.id);
        if (idx === -1) return [...prev, channel]; // e.g. newly visible: is_private flipped to false
        const next = [...prev];
        next[idx] = channel;
        return next;
      });
      if (channel.deleted_at) {
        setActiveChannel((prev) => (prev === channel.id ? '' : prev));
      }
    },
  });

  useGroupTableRealtime<StudyRoom>('study_rooms', group?.id ?? null, getStudyRoom, {
    onInsert: (room) => {
      if (room.deleted_at) return;
      setStudyRooms((prev) => (prev.some((r) => r.id === room.id) ? prev : [...prev, room]));
    },
    onUpdate: (room) => {
      setStudyRooms((prev) => {
        if (room.deleted_at) return prev.filter((r) => r.id !== room.id);
        const idx = prev.findIndex((r) => r.id === room.id);
        if (idx === -1) return [...prev, room];
        const next = [...prev];
        next[idx] = room;
        return next;
      });
    },
  });

  const activeMembers = groupMembers.filter((m) => m.status === 'active');
  const isOwner = !!group && !!currentUserId && group.owner_id === currentUserId;
  // Backend rule (POST /channels/ and POST /study-rooms/, both via is_group_manager): only
  // the group owner or an active moderator may create a channel or a study room -- a plain
  // member cannot (changed 2026-08-18: study room creation used to be open to any active
  // member, see STUDY_PLATFORM_DATABASE_SPEC.md §16).
  const isGroupManager =
    isOwner || (!!currentUserId && activeMembers.some((m) => m.user_id === currentUserId && m.role === 'moderator'));
  // Backend rule (DELETE /study-rooms/{id}): only an active group owner/moderator may delete
  // a room -- being its host is not sufficient on its own (2026-08-18 policy change: host_id
  // is creator metadata, not an independent authorization grant). This is UX-only; the
  // backend independently re-checks the same rule (study_room_router.delete_room).
  const canDeleteRoom = isGroupManager;

  const {
    resources,
    loading: resourcesLoading,
    listError: resourcesListError,
    uploadError: resourceUploadError,
    isUploading: isUploadingResource,
    pendingDeleteId: pendingDeleteResourceId,
    deleteError: resourceDeleteError,
    downloadError: resourceDownloadError,
    pendingDownloadId: pendingDownloadResourceId,
    upload: uploadResource,
    remove: removeResource,
    open: openResourceFile,
    download: downloadResourceFile,
    canDelete: canDeleteResource,
  } = useGroupResources(group?.id);
  const resourceFileInputRef = useRef<HTMLInputElement | null>(null);
  const [resourcePendingDelete, setResourcePendingDelete] = useState<{ id: string; name: string } | null>(null);

  function formatFileSize(bytes: number | null): string {
    if (bytes === null) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleResourceFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await uploadResource(file);
    } catch {
      // uploadError state already surfaces this in the UI
    }
  }

  async function handleConfirmDeleteResource() {
    if (!resourcePendingDelete) return;
    try {
      await removeResource(resourcePendingDelete.id);
      setResourcePendingDelete(null);
    } catch {
      // deleteError state already surfaces this in the UI; keep the dialog open
    }
  }

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

  // Owner-only; backend independently re-checks owner authority on both endpoints
  // (group_router.update_member_role / remove_member) -- these UI gates are UX-only.
  async function handlePromoteMember(member: GroupMember) {
    if (!group || memberActionPendingId) return;
    setMemberActionPendingId(member.id);
    setMemberActionError(null);
    try {
      const updated = await updateMemberRole(group.id, member.user_id, 'moderator');
      setGroupMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    } catch (err) {
      setMemberActionError(err instanceof ApiError ? err.message : 'Không thể thăng cấp thành viên.');
    } finally {
      setMemberActionPendingId(null);
    }
  }

  async function handleDemoteMember(member: GroupMember) {
    if (!group || memberActionPendingId) return;
    setMemberActionPendingId(member.id);
    setMemberActionError(null);
    try {
      const updated = await updateMemberRole(group.id, member.user_id, 'member');
      setGroupMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    } catch (err) {
      setMemberActionError(err instanceof ApiError ? err.message : 'Không thể hạ cấp điều hành viên.');
    } finally {
      setMemberActionPendingId(null);
    }
  }

  async function handleRemoveMember(member: GroupMember) {
    if (!group || memberActionPendingId) return;
    const display = memberDisplay(member);
    if (!window.confirm(`Bạn có chắc muốn xóa "${display.name}" khỏi nhóm học?`)) return;
    setMemberActionPendingId(member.id);
    setMemberActionError(null);
    try {
      await removeMember(group.id, member.user_id);
      setGroupMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      setMemberActionError(err instanceof ApiError ? err.message : 'Không thể xóa thành viên.');
    } finally {
      setMemberActionPendingId(null);
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

  async function handleConfirmDeleteChannel() {
    if (!channelPendingDelete || isDeletingChannel) return;
    const deletedId = channelPendingDelete.id;
    setIsDeletingChannel(true);
    setDeleteChannelError(null);
    try {
      await deleteChannel(deletedId);
      // Only touch local state after the backend confirms the delete -- no optimistic/fake
      // success. Removing it from `channels` also makes `activeChannelObj` resolve to null
      // if this was the active channel, which in turn clears its conversation_id and lets
      // the messages-loading effect and useChannelMessagesRealtime (both keyed off
      // activeChannelObj?.conversation_id) reset/unsubscribe on their own -- no separate
      // cleanup call needed here.
      setChannels((prev) => prev.filter((c) => c.id !== deletedId));
      setActiveChannel((prev) => (prev === deletedId ? '' : prev));
      setChannelPendingDelete(null);
    } catch (err) {
      // Keep the channel in the list and the modal open so the user can see the error and retry.
      setDeleteChannelError(err instanceof ApiError ? err.message : 'Không thể xóa kênh chat.');
    } finally {
      setIsDeletingChannel(false);
    }
  }

  async function handleConfirmDeleteRoom() {
    if (!roomPendingDelete || isDeletingRoom) return;
    const deletedId = roomPendingDelete.id;
    setIsDeletingRoom(true);
    setDeleteRoomError(null);
    try {
      await deleteStudyRoom(deletedId);
      // Only touch local state after the backend confirms the delete -- no optimistic/fake
      // success (mirrors handleConfirmDeleteChannel).
      setStudyRooms((prev) => prev.filter((r) => r.id !== deletedId));
      setRoomPendingDelete(null);
    } catch (err) {
      // Keep the room in the list and the modal open so the user can see the error and retry.
      setDeleteRoomError(err instanceof ApiError ? err.message : 'Không thể xóa phòng học.');
    } finally {
      setIsDeletingRoom(false);
    }
  }

  // Real persisted messages for the currently active channel. Channel messages are
  // addressed via the channel's conversation_id (GET/POST /conversations/{id}/messages),
  // not a /channels/{id}/messages route.
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [sendMessageError, setSendMessageError] = useState<string | null>(null);
  const imageAttachment = useMessageImageAttachment();
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);
  // Tracks the channel each in-flight request belongs to, so a response for a channel the
  // user has since navigated away from is discarded instead of leaking into the new view.
  const activeChannelRef = useRef(activeChannel);
  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  const activeChannelObj = channels.find((c) => c.id === activeChannel) ?? null;

  useEffect(() => {
    const conversationId = activeChannelObj?.conversation_id ?? null;
    const channelId = activeChannel;
    setMessages([]);
    setMessagesError(null);
    setSendMessageError(null);
    if (!channelId || !conversationId) {
      setIsMessagesLoading(false);
      return;
    }
    let cancelled = false;
    setIsMessagesLoading(true);
    listConversationMessages(conversationId)
      .then((res) => {
        if (cancelled || activeChannelRef.current !== channelId) return;
        // Backend returns newest-first; reverse for standard oldest-to-newest chat display.
        setMessages([...res.items].reverse());
      })
      .catch((err) => {
        if (cancelled || activeChannelRef.current !== channelId) return;
        setMessagesError(err instanceof ApiError ? err.message : 'Không thể tải tin nhắn.');
      })
      .finally(() => {
        if (cancelled || activeChannelRef.current !== channelId) return;
        setIsMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeChannel, activeChannelObj?.conversation_id]);

  // Live-appends new Channel messages (from any sender) as they're persisted, on top of
  // the REST history load above. Scoped to the active channel's conversation only -- see
  // useChannelMessagesRealtime for the RLS-backed access control this relies on.
  useChannelMessagesRealtime(activeChannelObj?.conversation_id ?? null, (incoming) => {
    setMessages((prev) => appendMessageDeduped(prev, incoming));
  });

  const updateMessageReactions = (messageId: string, reactions: MessageReactionSummary[]) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
  };
  useMessageReactionsRealtime(activeChannelObj?.conversation_id ?? null, updateMessageReactions);
  const handleReactionSelect = useMessageReactionActions(updateMessageReactions);

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

  const handleSendMessage = async () => {
    const trimmed = chatInput.trim();
    const conversationId = activeChannelObj?.conversation_id ?? null;
    if ((!trimmed && !imageAttachment.hasImage) || !conversationId || isSendingMessage || imageAttachment.isUploading) return;

    const targetChannelId = activeChannel;
    setIsSendingMessage(true);
    setSendMessageError(null);
    try {
      // Upload first, create the message second -- a failed upload must never produce an
      // orphaned/misleading message record (see useMessageImageAttachment.uploadImage).
      const attachmentPath = imageAttachment.hasImage ? await imageAttachment.uploadImage(conversationId) : null;
      const sent = await sendConversationMessage(conversationId, { content: trimmed || null, attachment_path: attachmentPath });
      // Only reflect it in the visible list if the user hasn't switched channels while
      // the request was in flight; the message is still persisted either way. Deduped
      // against appendMessageDeduped since Realtime may also deliver this same row.
      if (activeChannelRef.current === targetChannelId) {
        setMessages((prev) => appendMessageDeduped(prev, sent));
      }
      setChatInput('');
      imageAttachment.clearImage();
    } catch (err) {
      setSendMessageError(err instanceof ApiError ? err.message : 'Không thể gửi tin nhắn.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleChatImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) imageAttachment.selectImage(picked);
    e.target.value = '';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const memberDisplay = (member: GroupMember) => {
    const isSelf = member.user_id === currentUserId;
    const name = isSelf ? `${currentUser.name} (Bạn)` : getDisplayName(member.user);
    return {
      name,
      initials: isSelf ? currentUser.initials : getAvatarInitials(name),
      color: isSelf ? currentUser.color : getAvatarColor(name),
      avatarUrl: isSelf ? currentUser.avatarUrl : member.user.avatar_url,
    };
  };

  // GroupMemberResponse/MessageResponse now carry a real `user`/`sender` UserSummary (see
  // app/profiles/dto/profile_dto.py) -- resolved server-side via an eager-loaded Profile
  // join, not a per-sender frontend lookup.
  const senderDisplay = (message: Message) => {
    const isSelf = message.sender_id === currentUserId;
    const name = isSelf ? `${currentUser.name} (Bạn)` : getDisplayName(message.sender);
    return {
      name,
      initials: isSelf ? currentUser.initials : getAvatarInitials(name),
      color: isSelf ? currentUser.color : getAvatarColor(name),
      avatarUrl: isSelf ? currentUser.avatarUrl : message.sender.avatar_url,
    };
  };

  const formatMessageTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', width: '100%', overflow: 'hidden' }}>
        {/* Left sidebar skeleton */}
        <div style={{ width: 280, flexShrink: 0, background: '#F8FAFC', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Group header */}
          <div style={{ padding: 16, borderBottom: '1px solid #E2E8F0' }}>
            <div className="skeleton-pulse" style={{ height: 18, borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton-pulse" style={{ width: '60%', height: 12, borderRadius: 4 }} />
          </div>
          {/* Channels */}
          <div style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton-pulse" style={{ width: '50%', height: 11, borderRadius: 4, marginBottom: 4 }} />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton-pulse" style={{ height: 32, borderRadius: 6 }} />
            ))}
            <div className="skeleton-pulse" style={{ width: '50%', height: 11, borderRadius: 4, marginTop: 12, marginBottom: 4 }} />
            {[...Array(2)].map((_, i) => (
              <div key={i} className="skeleton-pulse" style={{ height: 80, borderRadius: 8 }} />
            ))}
          </div>
        </div>
        {/* Center chat area skeleton */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
          <div style={{ height: 60, borderBottom: '1px solid #E2E8F0', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="skeleton-pulse" style={{ width: 24, height: 24, borderRadius: 4 }} />
            <div className="skeleton-pulse" style={{ width: 120, height: 18, borderRadius: 6 }} />
          </div>
          <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[false, true, false, true, false].map((isSelf, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, flexDirection: isSelf ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                <div className="skeleton-pulse" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                <div className="skeleton-pulse" style={{ width: 140 + i * 20, height: 40, borderRadius: 12 }} />
              </div>
            ))}
          </div>
        </div>
        {/* Right sidebar skeleton */}
        <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid #E2E8F0', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton-pulse" style={{ width: '60%', height: 12, borderRadius: 4 }} />
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="skeleton-pulse" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
              <div className="skeleton-pulse" style={{ flex: 1, height: 14, borderRadius: 4 }} />
            </div>
          ))}
        </div>
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
                            background: group.background_url
                                ? `linear-gradient(180deg, rgba(15,23,42,0.15), rgba(15,23,42,0.55)), url(${group.background_url})`
                                : showGroupMenu ? '#F1F5F9' : 'transparent',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            transition: 'background 0.2s'
                        }}
                    >
                        <div style={{flex: 1, minWidth: 0, paddingRight: 8}}>
                            <div style={{color: group.background_url ? '#FFFFFF' : '#0B1C30', fontSize: 16, fontFamily: 'Inter', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                {group.name}
                            </div>
                            <div style={{color: group.background_url ? '#E2E8F0' : '#64748B', fontSize: 12, fontFamily: 'Inter', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6}}>
                                <span style={{padding: '2px 6px', background: group.is_public ? '#DCFCE7' : '#FEF3C7', color: group.is_public ? '#15803D' : '#B45309', borderRadius: 4, fontSize: 10, fontWeight: '700'}}>
                                    {group.is_public ? 'Public' : 'Private'}
                                </span>
                                <span>• {activeMembers.length} thành viên</span>
                            </div>
                        </div>
                        <ChevronDown size={18} color={group.background_url ? '#FFFFFF' : '#64748B'} style={{transform: showGroupMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}} />
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
                            {/* Group settings modal is reachable by owner OR active moderator -- the
                                background-image section inside it is owner-or-moderator (POST/DELETE
                                /groups/{id}/background), while name/description/visibility stay
                                owner-only (backend rejects PUT /groups/{id} for anyone else,
                                is_group_owner) and are disabled inside the modal for a non-owner. */}
                            {isGroupManager && (
                                <div
                                    onClick={() => { setIsSettingsModalOpen(true); setShowGroupMenu(false); }}
                                    style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#1E293B', cursor: 'pointer'}}
                                    onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <Settings size={16} color="#475569" /> Cài đặt nhóm
                                </div>
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

                {leaveError && (
                    <div style={{ margin: '12px 12px 0 12px', padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 12.5 }}>
                        {leaveError}
                    </div>
                )}

                {/* Group Notes -- paper stack, one focused Note at a time (see
                    NotesStackPanel); real, group-scoped, persisted via backend */}
                <NotesStackPanel {...groupNotesController} isGroupManager={isGroupManager} />

                {/* Scrollable Channels List */}
                <div style={{flex: 1, overflowY: 'auto', padding: '16px 8px'}}>

                    {/* Text Channels */}
                    <div style={{marginBottom: 24}}>
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 8, paddingRight: 4}}>
                            <div style={{color: '#64748B', fontSize: 12, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase'}}>Kênh Chat</div>
                            <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                                <button
                                    onClick={() => setIsJoinChannelModalOpen(true)}
                                    title="Tham gia kênh riêng tư bằng mã"
                                    style={{width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#64748B'}}
                                    onMouseOver={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0B1C30'; }}
                                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B'; }}
                                >
                                    <Ticket size={14} />
                                </button>
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
                        </div>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                            {channels.length === 0 && (
                                <div style={{padding: '8px 12px', color: '#94A3B8', fontSize: 13}}>Chưa có kênh nào.</div>
                            )}
                            {channels.map((channel) => {
                                const isActive = activeChannel === channel.id && mainView === 'chat';
                                const isMenuOpen = openChannelMenuId === channel.id;
                                return (
                                    <div key={channel.id} style={{position: 'relative'}}>
                                        <div
                                            onClick={() => { setActiveChannel(channel.id); setMainView('chat'); }}
                                            style={{padding: '8px 8px 8px 12px', background: isActive ? '#E2E8F0' : 'transparent', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, color: isActive ? '#0F172A' : '#475569', fontWeight: isActive ? '600' : '500', cursor: 'pointer'}}
                                            onMouseOver={e => !isActive && (e.currentTarget.style.background = '#F1F5F9')}
                                            onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
                                        >
                                            {channel.is_private ? <Lock size={16} color={isActive ? '#64748B' : '#94A3B8'} /> : <Hash size={18} color={isActive ? '#64748B' : '#94A3B8'} />}
                                            <span style={{flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{channel.name}</span>
                                            {isGroupManager && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setOpenChannelMenuId(isMenuOpen ? null : channel.id); }}
                                                    title="Tùy chọn kênh"
                                                    style={{width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isMenuOpen ? '#E2E8F0' : 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#64748B'}}
                                                >
                                                    <MoreVertical size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {isMenuOpen && (
                                            <div
                                                style={{position: 'absolute', top: '100%', right: 4, zIndex: 60, background: 'white', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', border: '1px solid #E2E8F0', padding: '6px', marginTop: 2, minWidth: 160}}
                                            >
                                                {channel.is_private && (
                                                    <div
                                                        onClick={() => { setOpenChannelMenuId(null); setChannelToInvite(channel); }}
                                                        style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#0F172A', cursor: 'pointer'}}
                                                        onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <UserPlus size={16} color="#00236F" /> Mời vào kênh
                                                    </div>
                                                )}
                                                <div
                                                    onClick={() => { setOpenChannelMenuId(null); setDeleteChannelError(null); setChannelPendingDelete(channel); }}
                                                    style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#DC2626', cursor: 'pointer'}}
                                                    onMouseOver={e => e.currentTarget.style.background = '#FEF2F2'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <Trash2 size={16} color="#DC2626" /> Xóa kênh
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Voice / Video Rooms */}
                    <div style={{marginBottom: 24}}>
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 8, paddingRight: 4}}>
                            <div style={{color: '#64748B', fontSize: 12, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase'}}>Phòng học</div>
                            <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                                <button
                                    onClick={() => setIsJoinRoomModalOpen(true)}
                                    title="Tham gia phòng học bằng mã"
                                    style={{width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#64748B'}}
                                    onMouseOver={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0B1C30'; }}
                                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B'; }}
                                >
                                    <Ticket size={14} />
                                </button>
                                {isGroupManager && (
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
                        </div>

                        <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                            {openRooms.length === 0 && (
                                <div style={{padding: '8px', color: '#94A3B8', fontSize: 13}}>Chưa có phòng học nào đang mở.</div>
                            )}
                            {/* Limit rooms to top 2 for Sidebar */}
                            {openRooms.slice(0, 2).map(room => {
                                const isRoomMenuOpen = openRoomMenuId === room.id;
                                return (
                                <div key={room.id} style={{padding: '10px 12px', background: '#E0E7FF', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', border: '1px solid #C7D2FE', position: 'relative'}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                        <div style={{display: 'flex', alignItems: 'center', gap: 8, color: '#4338CA', fontWeight: '600'}}>
                                            <Video size={16} /> {room.name}
                                        </div>
                                        <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                                            <div style={{background: room.status === 'active' ? '#10B981' : '#F59E0B', color: 'white', fontSize: 10, fontWeight: '700', padding: '2px 6px', borderRadius: 4}}>
                                                {room.status === 'active' ? 'LIVE' : 'CHỜ'}
                                            </div>
                                            {canDeleteRoom && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setOpenRoomMenuId(isRoomMenuOpen ? null : room.id); }}
                                                    title="Tùy chọn phòng học"
                                                    style={{width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isRoomMenuOpen ? 'white' : 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#4338CA'}}
                                                >
                                                    <MoreVertical size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {isRoomMenuOpen && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            style={{position: 'absolute', top: 36, right: 8, zIndex: 60, background: 'white', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', border: '1px solid #E2E8F0', padding: '6px', minWidth: 160}}
                                        >
                                            <div
                                                onClick={() => { setOpenRoomMenuId(null); setDeleteRoomError(null); setRoomPendingDelete(room); }}
                                                style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: '500', color: '#DC2626', cursor: 'pointer'}}
                                                onMouseOver={e => e.currentTarget.style.background = '#FEF2F2'}
                                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <Trash2 size={16} color="#DC2626" /> Xóa phòng học
                                            </div>
                                        </div>
                                    )}
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
                                );
                            })}

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

                    {/* Resources — real backend data (app/resources) */}
                    <div>
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 8, paddingRight: 4}}>
                            <div style={{color: '#64748B', fontSize: 12, fontFamily: 'Inter', fontWeight: '700', textTransform: 'uppercase'}}>Tài liệu đính kèm</div>
                            <button
                                onClick={() => resourceFileInputRef.current?.click()}
                                disabled={isUploadingResource}
                                title="Tải tài liệu lên"
                                style={{width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, cursor: isUploadingResource ? 'not-allowed' : 'pointer', color: '#4338CA', opacity: isUploadingResource ? 0.5 : 1}}
                            >
                                <Plus size={16} />
                            </button>
                            <input
                                ref={resourceFileInputRef}
                                type="file"
                                style={{display: 'none'}}
                                onChange={handleResourceFileSelected}
                                disabled={isUploadingResource}
                            />
                        </div>

                        {isUploadingResource && (
                            <div style={{padding: '4px 8px', fontSize: 12, color: '#4338CA'}}>Đang tải lên...</div>
                        )}
                        {resourceUploadError && (
                            <div style={{padding: '4px 8px', fontSize: 12, color: '#DC2626'}}>{resourceUploadError.message}</div>
                        )}

                        {resourcesLoading ? (
                            <div style={{padding: '8px', fontSize: 12, color: '#94A3B8'}}>Đang tải...</div>
                        ) : resourcesListError ? (
                            <div style={{padding: '8px', fontSize: 12, color: '#DC2626'}}>{resourcesListError.message}</div>
                        ) : resources.length === 0 ? (
                            <div style={{padding: '8px', fontSize: 12, color: '#94A3B8'}}>Chưa có tài liệu nào.</div>
                        ) : (
                            <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                                {resources.slice(0, 2).map((resource) => (
                                    <div
                                        key={resource.id}
                                        onClick={() => openResourceFile(resource.id)}
                                        style={{padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer'}}
                                        onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <FileText size={18} color="#3B82F6" style={{marginTop: 2, flexShrink: 0}} />
                                        <div style={{minWidth: 0}}>
                                            <div style={{color: '#334155', fontSize: 13, fontWeight: '500', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{resource.name}</div>
                                            <div style={{color: '#94A3B8', fontSize: 11}}>{formatFileSize(resource.file_size)} • {getDisplayName(resource.uploader)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

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

                        {!activeChannelObj ? (
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '32px 0', color: '#94A3B8'}}>
                                <Hash size={48} color="#CBD5E1" style={{marginBottom: 16}} />
                                <div style={{fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 8}}>
                                    Nhóm học chưa có kênh chat nào
                                </div>
                            </div>
                        ) : isMessagesLoading ? (
                            <div style={{display: 'flex', justifyContent: 'center', margin: '32px 0', color: '#94A3B8', fontSize: 14}}>
                                Đang tải tin nhắn...
                            </div>
                        ) : messagesError ? (
                            <div style={{margin: '16px 0', padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13.5}}>
                                {messagesError}
                            </div>
                        ) : messages.length === 0 ? (
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '32px 0', color: '#94A3B8'}}>
                                <Hash size={48} color="#CBD5E1" style={{marginBottom: 16}} />
                                <div style={{fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 8}}>
                                    Chào mừng đến với #{activeChannelObj.name}!
                                </div>
                                <div style={{fontSize: 14}}>Đây là sự khởi đầu của kênh #{activeChannelObj.name}.</div>
                            </div>
                        ) : (
                            // Keyed by channel so a crash here (and the boundary it trips) resets
                            // on channel change instead of showing the fallback forever -- see
                            // ErrorBoundary.tsx.
                            <ErrorBoundary
                                key={activeChannelObj.conversation_id ?? activeChannel}
                                fallback={
                                    <div style={{margin: '16px 0', padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13.5}}>
                                        Không thể hiển thị tin nhắn trong kênh này.
                                    </div>
                                }
                            >
                                {messages.map((msg) => {
                                    const display = senderDisplay(msg);
                                    const isSelf = msg.sender_id === currentUserId;
                                    return (
                                        <div key={msg.id} style={{display: 'flex', gap: 16}}>
                                            <MessageUserTrigger userId={msg.sender_id} isSelf={isSelf}>
                                                {display.avatarUrl ? (
                                                    <img src={display.avatarUrl} alt={display.name} style={{width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0}} />
                                                ) : (
                                                    <div style={{width: 40, height: 40, borderRadius: '50%', background: display.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0}}>
                                                        {display.initials}
                                                    </div>
                                                )}
                                            </MessageUserTrigger>
                                            <div>
                                                <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4}}>
                                                    <span style={{color: '#0F172A', fontSize: 15, fontWeight: '600'}}>{display.name}</span>
                                                    <span style={{color: '#94A3B8', fontSize: 12}}>{formatMessageTime(msg.created_at)}</span>
                                                </div>
                                                {msg.content && (
                                                    <div style={{color: '#334155', fontSize: 15, lineHeight: '1.5', wordBreak: 'break-word', marginBottom: msg.attachment_path ? 8 : 0}}>
                                                        {msg.content}
                                                    </div>
                                                )}
                                                {msg.attachment_path && <MessageAttachmentImage messageId={msg.id} />}
                                                <MessageReactions
                                                    reactions={msg.reactions}
                                                    isSelf={isSelf}
                                                    onSelect={(emoji) => handleReactionSelect(msg, emoji)}
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
                    <div style={{padding: '0 24px 24px 24px'}}>
                        {(sendMessageError || imageAttachment.uploadError || imageAttachment.pickError) && (
                            <div style={{marginBottom: 8, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 12.5}}>
                                {sendMessageError || imageAttachment.uploadError?.message || imageAttachment.pickError}
                            </div>
                        )}
                        {imageAttachment.previewUrl && (
                            <SelectedImagePreview
                                previewUrl={imageAttachment.previewUrl}
                                onRemove={imageAttachment.clearImage}
                                disabled={isSendingMessage || imageAttachment.isUploading}
                            />
                        )}
                        <div style={{background: '#F1F5F9', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '12px 16px', border: '1px solid #E2E8F0', transition: 'border-color 0.2s', gap: 8}}>
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
                                disabled={!activeChannelObj?.conversation_id || isSendingMessage}
                                style={{background: 'transparent', border: 'none', padding: 0, display: 'flex', cursor: (!activeChannelObj?.conversation_id || isSendingMessage) ? 'not-allowed' : 'pointer', opacity: (!activeChannelObj?.conversation_id || isSendingMessage) ? 0.5 : 1}}
                                aria-label="Đính kèm ảnh"
                            >
                              <ImageIcon size={20} color="#64748B" />
                            </button>
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                disabled={!activeChannelObj?.conversation_id || isSendingMessage}
                                placeholder={activeChannelObj ? `Nhắn tin cho #${activeChannelObj.name}...` : 'Chọn một kênh để bắt đầu'}
                                style={{border: 'none', background: 'transparent', flex: 1, outline: 'none', fontSize: 15, color: '#0F172A'}}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={(!chatInput.trim() && !imageAttachment.hasImage) || !activeChannelObj?.conversation_id || isSendingMessage || imageAttachment.isUploading}
                                style={{background: 'transparent', border: 'none', padding: 0, display: 'flex', cursor: ((chatInput.trim() || imageAttachment.hasImage) && !isSendingMessage && !imageAttachment.isUploading) ? 'pointer' : 'not-allowed', opacity: ((chatInput.trim() || imageAttachment.hasImage) && !isSendingMessage && !imageAttachment.isUploading) ? 1 : 0.5}}
                            >
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
                                    <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6}}>
                                        <div style={{fontSize: 18, fontWeight: '700', color: '#0F172A'}}>{room.name}</div>
                                        {canDeleteRoom && (
                                            <button
                                                onClick={() => { setOpenRoomMenuId(null); setDeleteRoomError(null); setRoomPendingDelete(room); }}
                                                title="Xóa phòng học"
                                                style={{flexShrink: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#94A3B8'}}
                                                onMouseOver={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; }}
                                                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
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
                    <div style={{height: 60, padding: '0 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0F172A', fontSize: 18, fontWeight: '700', background: 'white'}}>
                        Tất cả dữ liệu đính kèm
                        <button
                            onClick={() => resourceFileInputRef.current?.click()}
                            disabled={isUploadingResource}
                            style={{display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: isUploadingResource ? '#93C5FD' : '#3B82F6', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: isUploadingResource ? 'not-allowed' : 'pointer'}}
                        >
                            <Plus size={16} /> {isUploadingResource ? 'Đang tải lên...' : 'Tải tài liệu lên'}
                        </button>
                    </div>

                    {resourceUploadError && (
                        <div style={{padding: '10px 24px', fontSize: 13, color: '#B91C1C', background: '#FEF2F2', borderBottom: '1px solid #FECACA'}}>
                            {resourceUploadError.message}
                        </div>
                    )}
                    {resourceDeleteError && (
                        <div style={{padding: '10px 24px', fontSize: 13, color: '#B91C1C', background: '#FEF2F2', borderBottom: '1px solid #FECACA'}}>
                            {resourceDeleteError.message}
                        </div>
                    )}
                    {resourceDownloadError && (
                        <div style={{padding: '10px 24px', fontSize: 13, color: '#B91C1C', background: '#FEF2F2', borderBottom: '1px solid #FECACA'}}>
                            {resourceDownloadError.message}
                        </div>
                    )}

                    {/* Bảng danh sách tài liệu (Zalo Style) */}
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 140px 140px 120px 76px', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', fontSize: 13, color: '#64748B', fontWeight: '500', background: '#F8FAFC'}}>
                        <div>Tên</div>
                        <div>Người tải lên</div>
                        <div>Kích thước</div>
                        <div>Ngày gửi</div>
                        <div />
                    </div>
                    {/* Danh sách file */}
                    <div style={{flex: 1, overflowY: 'auto'}}>
                        {resourcesLoading ? (
                            <div style={{padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 14}}>Đang tải danh sách tài liệu...</div>
                        ) : resourcesListError ? (
                            <div style={{padding: 32, textAlign: 'center', color: '#DC2626', fontSize: 14}}>{resourcesListError.message}</div>
                        ) : resources.length === 0 ? (
                            <div style={{padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 14}}>Chưa có tài liệu nào trong nhóm này.</div>
                        ) : (
                            resources.map((resource) => (
                                <div
                                    key={resource.id}
                                    style={{display: 'grid', gridTemplateColumns: '1fr 140px 140px 120px 76px', padding: '16px 24px', borderBottom: '1px solid #F1F5F9', alignItems: 'center', transition: 'background 0.2s'}}
                                    onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'}
                                    onMouseOut={e => e.currentTarget.style.background = 'white'}
                                >
                                    <div onClick={() => openResourceFile(resource.id)} style={{display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 0}}>
                                        <div style={{width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0}}>
                                            <FileText size={20} color="#3B82F6" />
                                        </div>
                                        <div style={{color: '#0F172A', fontSize: 14, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{resource.name}</div>
                                    </div>
                                    <div style={{color: '#64748B', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{getDisplayName(resource.uploader)}</div>
                                    <div style={{color: '#64748B', fontSize: 13}}>{formatFileSize(resource.file_size)}</div>
                                    <div style={{color: '#64748B', fontSize: 13}}>{new Date(resource.created_at).toLocaleDateString('vi-VN')}</div>
                                    <div style={{display: 'flex', gap: 4}}>
                                        <button
                                            onClick={() => downloadResourceFile(resource.id)}
                                            disabled={pendingDownloadResourceId === resource.id}
                                            title="Tải xuống"
                                            style={{width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, cursor: pendingDownloadResourceId === resource.id ? 'not-allowed' : 'pointer', color: pendingDownloadResourceId === resource.id ? '#CBD5E1' : '#94A3B8'}}
                                            onMouseOver={e => { if (pendingDownloadResourceId !== resource.id) { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#3B82F6'; } }}
                                            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = pendingDownloadResourceId === resource.id ? '#CBD5E1' : '#94A3B8'; }}
                                        >
                                            <Download size={16} />
                                        </button>
                                        {canDeleteResource(resource, isGroupManager) && (
                                            <button
                                                onClick={() => setResourcePendingDelete({ id: resource.id, name: resource.name })}
                                                disabled={pendingDeleteResourceId === resource.id}
                                                title="Xóa tài liệu"
                                                style={{width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, cursor: pendingDeleteResourceId === resource.id ? 'not-allowed' : 'pointer', color: '#94A3B8'}}
                                                onMouseOver={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; }}
                                                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Right Sidebar - Members (real backend group members) */}
            <GroupMembersPanel
                members={activeMembers}
                currentUserId={currentUserId}
                currentUser={currentUser}
                isOwner={isOwner}
                isGroupManager={isGroupManager}
                pendingMemberId={memberActionPendingId}
                error={memberActionError}
                onPromote={handlePromoteMember}
                onDemote={handleDemoteMember}
                onRemove={handleRemoveMember}
                onInviteClick={() => setIsInviteModalOpen(true)}
            />

        </div>

        {group && (
            <InviteModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                target={{ groupId: group.id }}
                targetLabel={group.name}
            />
        )}

        {group && isGroupManager && (
            <GroupSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                group={group}
                isOwner={isOwner}
                onUpdated={(updated) => setGroup(updated)}
            />
        )}

        {channelToInvite && (
            <InviteModal
                isOpen={!!channelToInvite}
                onClose={() => setChannelToInvite(null)}
                target={{ channelId: channelToInvite.id }}
                targetLabel={channelToInvite.name}
            />
        )}

        {/* Dedicated Join Study Room / Join Private Channel entry points -- same reusable
            flow as Join Group on the Groups list page, just target-aware (see
            JoinByCodeModal). A Group/Channel code entered here is rejected with a clear
            mismatch message rather than silently mishandled. */}
        <JoinByCodeModal
            isOpen={isJoinRoomModalOpen}
            onClose={() => setIsJoinRoomModalOpen(false)}
            expectedTarget="study_room"
        />
        <JoinByCodeModal
            isOpen={isJoinChannelModalOpen}
            onClose={() => setIsJoinChannelModalOpen(false)}
            expectedTarget="private_channel"
        />

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

        {/* Modal: Xác nhận xóa kênh chat */}
        {channelPendingDelete && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                <div style={{ background: 'white', borderRadius: 12, width: 420, padding: 32, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.1)' }}>
                    <button
                        onClick={() => { if (!isDeletingChannel) { setChannelPendingDelete(null); setDeleteChannelError(null); } }}
                        disabled={isDeletingChannel}
                        style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: isDeletingChannel ? 'not-allowed' : 'pointer', color: '#64748B', fontSize: 18 }}
                    >
                        ✕
                    </button>

                    <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginBottom: 12, fontFamily: 'Inter' }}>
                        Xóa "{channelPendingDelete.name}"?
                    </h2>

                    <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.5, marginBottom: 8, fontFamily: 'Inter' }}>
                        Kênh này sẽ không còn truy cập được nữa.
                    </p>
                    <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5, marginBottom: 24, fontFamily: 'Inter' }}>
                        Thao tác này hiện chưa thể hoàn tác.
                    </p>

                    {deleteChannelError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
                            {deleteChannelError}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => { if (!isDeletingChannel) { setChannelPendingDelete(null); setDeleteChannelError(null); } }}
                            disabled={isDeletingChannel}
                            style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: '#F1F5F9', color: '#475569', border: 'none', fontSize: 14, fontWeight: 600, cursor: isDeletingChannel ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleConfirmDeleteChannel}
                            disabled={isDeletingChannel}
                            style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: isDeletingChannel ? '#F1A9A0' : '#DC2626', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: isDeletingChannel ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                        >
                            {isDeletingChannel ? 'Đang xóa...' : 'Xóa kênh'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal: Xác nhận xóa phòng học */}
        {roomPendingDelete && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                <div style={{ background: 'white', borderRadius: 12, width: 420, padding: 32, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.1)' }}>
                    <button
                        onClick={() => { if (!isDeletingRoom) { setRoomPendingDelete(null); setDeleteRoomError(null); } }}
                        disabled={isDeletingRoom}
                        style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: isDeletingRoom ? 'not-allowed' : 'pointer', color: '#64748B', fontSize: 18 }}
                    >
                        ✕
                    </button>

                    <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginBottom: 12, fontFamily: 'Inter' }}>
                        Xóa "{roomPendingDelete.name}"?
                    </h2>

                    <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.5, marginBottom: 8, fontFamily: 'Inter' }}>
                        Phòng học này sẽ không còn truy cập được nữa.
                    </p>
                    <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5, marginBottom: 24, fontFamily: 'Inter' }}>
                        Dữ liệu lịch sử (tin nhắn, thành viên, lịch sử kiểm duyệt) vẫn được lưu giữ. Thao tác này hiện chưa thể hoàn tác.
                    </p>

                    {deleteRoomError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
                            {deleteRoomError}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => { if (!isDeletingRoom) { setRoomPendingDelete(null); setDeleteRoomError(null); } }}
                            disabled={isDeletingRoom}
                            style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: '#F1F5F9', color: '#475569', border: 'none', fontSize: 14, fontWeight: 600, cursor: isDeletingRoom ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleConfirmDeleteRoom}
                            disabled={isDeletingRoom}
                            style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: isDeletingRoom ? '#F1A9A0' : '#DC2626', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: isDeletingRoom ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                        >
                            {isDeletingRoom ? 'Đang xóa...' : 'Xóa phòng học'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal: Xác nhận xóa tài liệu */}
        {resourcePendingDelete && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                <div style={{ background: 'white', borderRadius: 12, width: 420, padding: 32, display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.1)' }}>
                    <button
                        onClick={() => { if (!pendingDeleteResourceId) setResourcePendingDelete(null); }}
                        disabled={!!pendingDeleteResourceId}
                        style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: pendingDeleteResourceId ? 'not-allowed' : 'pointer', color: '#64748B', fontSize: 18 }}
                    >
                        ✕
                    </button>

                    <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginBottom: 12, fontFamily: 'Inter' }}>
                        Xóa "{resourcePendingDelete.name}"?
                    </h2>

                    <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.5, marginBottom: 24, fontFamily: 'Inter' }}>
                        Tài liệu này sẽ bị xóa vĩnh viễn khỏi nhóm. Thao tác này không thể hoàn tác.
                    </p>

                    {resourceDeleteError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
                            {resourceDeleteError.message}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => { if (!pendingDeleteResourceId) setResourcePendingDelete(null); }}
                            disabled={!!pendingDeleteResourceId}
                            style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: '#F1F5F9', color: '#475569', border: 'none', fontSize: 14, fontWeight: 600, cursor: pendingDeleteResourceId ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleConfirmDeleteResource}
                            disabled={!!pendingDeleteResourceId}
                            style={{ padding: '10px 16px', borderRadius: 6, backgroundColor: pendingDeleteResourceId ? '#F1A9A0' : '#DC2626', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: pendingDeleteResourceId ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}
                        >
                            {pendingDeleteResourceId ? 'Đang xóa...' : 'Xóa tài liệu'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
