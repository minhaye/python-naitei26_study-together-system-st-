import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useStudyRoomMembersRealtime } from './useStudyRoomMembersRealtime';
import { ApiError } from '../lib/apiClient';
import { listGroupMembers } from '../lib/group.api';
import {
  deleteStudyRoom,
  endStudyRoom,
  getStudyRoom,
  joinStudyRoom,
  leaveStudyRoom,
  leaveStudyRoomOnUnload,
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
  const [groupManagerIds, setGroupManagerIds] = useState<Set<string>>(new Set());
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

  // Backend rule (app/core/permissions.py::is_group_manager, used by can_manage_room): room
  // MANAGEMENT authority (update/start/end/delete, kick/mute/unmute, member-role changes) is
  // derived entirely from the caller's CURRENT active Group owner/moderator status -- never
  // from study_rooms.host_id or a room-scoped member role (2026-08-18 policy change). This is
  // UX-only; the backend independently re-checks the same rule on every request.
  const loadGroupManagerIds = useCallback(async () => {
    if (!room || !isLoggedIn) return;
    try {
      const data = await listGroupMembers(room.group_id);
      setGroupManagerIds(
        new Set(
          data
            .filter((m) => m.status === 'active' && (m.role === 'owner' || m.role === 'moderator'))
            .map((m) => m.user_id)
        )
      );
    } catch {
      // Non-critical for read access -- only used to gate management-action buttons; the
      // backend is the real authorization boundary regardless of this state.
      setGroupManagerIds(new Set());
    }
  }, [room, isLoggedIn]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!room) return;
    loadMembers();
    loadModeration();
    loadGroupManagerIds();
  }, [room, loadMembers, loadModeration, loadGroupManagerIds]);

  // `members` otherwise only refreshes after the current user's own join/leave/moderate
  // action -- an already-open tab never learns when someone ELSE joins or leaves, so the
  // member count/list silently goes stale (e.g. sidebar stuck showing "(2)" after a 3rd and
  // 4th person join). useStudyRoomMembersRealtime (below) is the primary, near-instant fix
  // once docs/db/migrations/026_enable_study_room_members_realtime.sql has been run live; this
  // poll is a resilience fallback that keeps working even if that Realtime channel is still
  // pending, disconnects, or misses an event (documented gap: Postgres Changes evaluates RLS
  // against an UPDATE's post-image, see 026's header) -- worst case is a 10s-stale count
  // instead of an indefinitely-stale one.
  useEffect(() => {
    if (!room) return;
    const interval = setInterval(loadMembers, 10000);
    return () => clearInterval(interval);
  }, [room, loadMembers]);

  // Near-instant member list refresh on any INSERT/UPDATE to this room's study_room_members
  // rows (join/leave/kick/role-change) -- see useStudyRoomMembersRealtime.ts and 026's header.
  useStudyRoomMembersRealtime(room ? roomId ?? null : null, loadMembers);

  const currentMember = useMemo(
    () => members.find((m) => m.user_id === currentUserId) ?? null,
    [members, currentUserId]
  );

  const isCurrentUserMember = !!currentMember && !currentMember.left_at;
  const isGroupManager = !!currentUserId && groupManagerIds.has(currentUserId);

  // Best-effort membership cleanup for tab close/reload/navigation-away, so a browser
  // departure doesn't leave `study_room_members.left_at` stale/NULL indefinitely (the
  // explicit "Rời phòng" button already calls `leave()` directly -- this only covers the
  // paths that skip it). `left_at` here means "explicitly left this room's membership", not
  // "currently connected to the LiveKit call" (see StudyRoomsService.leave / can_access_room)
  // -- the backend `leave` endpoint is idempotent, so firing this redundantly (e.g. right
  // after an explicit leave, or on every dev-mode double-mount) is harmless, just wasted.
  //
  // Two triggers, covering the two ways this page goes away:
  // - `pagehide`: tab close, reload, or a full browser navigation. `beforeunload` is
  //   deliberately not used -- it isn't reliably fired on mobile and defeats the back/forward
  //   cache, whereas `pagehide` fires in both the unload and bfcache-eligible cases.
  // - the effect's own cleanup: an in-SPA route change away from this room (e.g. clicking a
  //   nav link instead of "Rời phòng") unmounts this hook without ever firing `pagehide`.
  // A ref (not `isCurrentUserMember` in the cleanup's closure) is required for the second
  // case: effect cleanups close over the render they were created in, so without it the
  // cleanup could act on a stale membership flag from whenever the effect last re-ran.
  const isCurrentUserMemberRef = useRef(isCurrentUserMember);
  isCurrentUserMemberRef.current = isCurrentUserMember;

  useEffect(() => {
    if (!roomId) return;
    const handlePageHide = () => {
      if (isCurrentUserMemberRef.current) leaveStudyRoomOnUnload(roomId);
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      if (isCurrentUserMemberRef.current) leaveStudyRoomOnUnload(roomId);
    };
  }, [roomId]);

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

  /** Soft delete (see docs/db/migrations/010_soft_delete_study_rooms.sql). Deliberately does
   * NOT call loadRoom() afterward -- the room is no longer normally accessible, so the caller
   * (StudyRoom.tsx) is responsible for navigating away on success. */
  const deleteRoom = useCallback(async () => {
    if (!roomId) return;
    setActionError(null);
    try {
      await deleteStudyRoom(roomId);
    } catch (err) {
      setActionError(toStudyRoomError(err));
      throw err;
    }
  }, [roomId]);

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
    isCurrentUserMember,
    isGroupManager,
    handRaisedUserIds,
    moderationMutedUserIds,
    join,
    leave,
    start,
    end,
    deleteRoom,
    moderate,
    changeMemberRole,
    refetchMembers: loadMembers,
    refetchRoom: loadRoom,
  };
}
