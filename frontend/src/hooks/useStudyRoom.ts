import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { ApiError } from '../lib/apiClient';
import {
  endStudyRoom,
  getStudyRoom,
  joinStudyRoom,
  leaveStudyRoom,
  listStudyRoomMembers,
  listStudyRoomModeration,
  logStudyRoomModeration,
  startStudyRoom,
  updateStudyRoomMemberRole,
} from '../lib/studyRoom.api';
import type {
  ModerationAction,
  RoomModerationAction,
  StudyRoom,
  StudyRoomMember,
  StudyRoomMemberRole,
} from '../lib/studyRoom.types';

export interface StudyRoomError {
  status: number | null;
  message: string;
}

function toStudyRoomError(err: unknown): StudyRoomError {
  if (err instanceof ApiError) {
    return { status: err.status, message: err.message };
  }
  return { status: null, message: 'Đã xảy ra lỗi không xác định.' };
}

/** Derives, per user, the outcome of the most recent action in `pair` from the (newest-first) moderation log. */
function latestActionUserSet(
  actions: RoomModerationAction[],
  pair: [ModerationAction, ModerationAction]
): Set<string> {
  const [onAction] = pair;
  const seen = new Set<string>();
  const on = new Set<string>();
  for (const action of actions) {
    if (action.action !== pair[0] && action.action !== pair[1]) continue;
    if (seen.has(action.target_user_id)) continue;
    seen.add(action.target_user_id);
    if (action.action === onAction) on.add(action.target_user_id);
  }
  return on;
}

export function useStudyRoom(roomId: string | undefined) {
  const { user, isLoggedIn } = useAuth();
  const currentUserId = user?.id ?? null;

  const [room, setRoom] = useState<StudyRoom | null>(null);
  const [members, setMembers] = useState<StudyRoomMember[]>([]);
  const [moderationActions, setModerationActions] = useState<RoomModerationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomError, setRoomError] = useState<StudyRoomError | null>(null);
  const [membersError, setMembersError] = useState<StudyRoomError | null>(null);
  const [actionError, setActionError] = useState<StudyRoomError | null>(null);

  const loadRoom = useCallback(async () => {
    if (!roomId) {
      setRoom(null);
      setRoomError({ status: null, message: 'Thiếu mã phòng học.' });
      setLoading(false);
      return;
    }
    setLoading(true);
    setRoomError(null);
    try {
      const data = await getStudyRoom(roomId);
      setRoom(data);
    } catch (err) {
      setRoom(null);
      setRoomError(toStudyRoomError(err));
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const loadMembers = useCallback(async () => {
    if (!roomId || !isLoggedIn) return;
    try {
      const data = await listStudyRoomMembers(roomId, true);
      setMembers(data);
      setMembersError(null);
    } catch (err) {
      // A 403 here just means "not currently an active member/host" — that's an
      // expected pre-join state, not a failure to surface loudly.
      setMembers([]);
      setMembersError(toStudyRoomError(err));
    }
  }, [roomId, isLoggedIn]);

  const loadModeration = useCallback(async () => {
    if (!roomId || !isLoggedIn) return;
    try {
      const data = await listStudyRoomModeration(roomId);
      setModerationActions(data);
    } catch {
      // Supplementary data only (hand-raise / moderation-mute indicators); safe to ignore.
    }
  }, [roomId, isLoggedIn]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!room) return;
    loadMembers();
    loadModeration();
  }, [room, loadMembers, loadModeration]);

  const currentMember = useMemo(
    () => members.find((m) => m.user_id === currentUserId) ?? null,
    [members, currentUserId]
  );

  const isCurrentUserHost = !!room && !!currentUserId && room.host_id === currentUserId;
  const isCurrentUserModerator = currentMember?.role === 'moderator';
  const isCurrentUserMember = isCurrentUserHost || (!!currentMember && !currentMember.left_at);
  const canModerate = isCurrentUserHost || isCurrentUserModerator;

  // Derived, real-data-backed indicators from the moderation audit log (latest action per user wins).
  // These are NOT LiveKit/media state — see studyRoom.types.ts ModerationAction.
  const handRaisedUserIds = useMemo(
    () => latestActionUserSet(moderationActions, ['raise_hand', 'lower_hand']),
    [moderationActions]
  );
  const moderationMutedUserIds = useMemo(
    () => latestActionUserSet(moderationActions, ['mute', 'unmute']),
    [moderationActions]
  );

  const join = useCallback(async () => {
    if (!roomId) return;
    setActionError(null);
    try {
      await joinStudyRoom(roomId);
      await loadMembers();
    } catch (err) {
      setActionError(toStudyRoomError(err));
      throw err;
    }
  }, [roomId, loadMembers]);

  const leave = useCallback(async () => {
    if (!roomId) return;
    setActionError(null);
    try {
      await leaveStudyRoom(roomId);
      await loadMembers();
    } catch (err) {
      setActionError(toStudyRoomError(err));
      throw err;
    }
  }, [roomId, loadMembers]);

  const start = useCallback(async () => {
    if (!roomId) return;
    setActionError(null);
    try {
      await startStudyRoom(roomId);
      await loadRoom();
    } catch (err) {
      setActionError(toStudyRoomError(err));
      throw err;
    }
  }, [roomId, loadRoom]);

  const end = useCallback(async () => {
    if (!roomId) return;
    setActionError(null);
    try {
      await endStudyRoom(roomId);
      await loadRoom();
    } catch (err) {
      setActionError(toStudyRoomError(err));
      throw err;
    }
  }, [roomId, loadRoom]);

  const moderate = useCallback(
    async (targetUserId: string, action: ModerationAction) => {
      if (!roomId || !currentUserId) return;
      setActionError(null);
      try {
        await logStudyRoomModeration(roomId, currentUserId, targetUserId, action);
        await Promise.all([loadMembers(), loadModeration()]);
      } catch (err) {
        setActionError(toStudyRoomError(err));
        throw err;
      }
    },
    [roomId, currentUserId, loadMembers, loadModeration]
  );

  const changeMemberRole = useCallback(
    async (userId: string, role: StudyRoomMemberRole) => {
      if (!roomId) return;
      setActionError(null);
      try {
        await updateStudyRoomMemberRole(roomId, userId, role);
        await loadMembers();
      } catch (err) {
        setActionError(toStudyRoomError(err));
        throw err;
      }
    },
    [roomId, loadMembers]
  );

  return {
    room,
    members,
    loading,
    roomError,
    membersError,
    actionError,
    clearActionError: () => setActionError(null),
    currentUserId,
    currentMember,
    isCurrentUserHost,
    isCurrentUserModerator,
    isCurrentUserMember,
    canModerate,
    handRaisedUserIds,
    moderationMutedUserIds,
    join,
    leave,
    start,
    end,
    moderate,
    changeMemberRole,
    refetchMembers: loadMembers,
  };
}
