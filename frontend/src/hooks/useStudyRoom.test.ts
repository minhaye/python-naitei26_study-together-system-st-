import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from './useAuth';
import { useStudyRoomMembersRealtime } from './useStudyRoomMembersRealtime';
import { listGroupMembers } from '../lib/group.api';
import {
  getStudyRoom,
  leaveStudyRoomOnUnload,
  listStudyRoomMembers,
  listStudyRoomModeration,
} from '../lib/studyRoom.api';
import { useStudyRoom } from './useStudyRoom';
import type { StudyRoom, StudyRoomMember } from '../lib/studyRoom.types';

vi.mock('./useAuth');
vi.mock('./useStudyRoomMembersRealtime', () => ({
  useStudyRoomMembersRealtime: vi.fn(),
}));
vi.mock('../lib/group.api', () => ({
  listGroupMembers: vi.fn(),
}));
vi.mock('../lib/studyRoom.api', () => ({
  getStudyRoom: vi.fn(),
  listStudyRoomMembers: vi.fn(),
  listStudyRoomModeration: vi.fn(),
  leaveStudyRoomOnUnload: vi.fn(),
  joinStudyRoom: vi.fn(),
  leaveStudyRoom: vi.fn(),
  startStudyRoom: vi.fn(),
  endStudyRoom: vi.fn(),
  deleteStudyRoom: vi.fn(),
  logStudyRoomModeration: vi.fn(),
  updateStudyRoomMemberRole: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseRealtime = vi.mocked(useStudyRoomMembersRealtime);
const mockedListGroupMembers = vi.mocked(listGroupMembers);
const mockedGetStudyRoom = vi.mocked(getStudyRoom);
const mockedListMembers = vi.mocked(listStudyRoomMembers);
const mockedListModeration = vi.mocked(listStudyRoomModeration);
const mockedLeaveOnUnload = vi.mocked(leaveStudyRoomOnUnload);

const CURRENT_USER_ID = 'user-1';

function makeRoom(overrides: Partial<StudyRoom> = {}): StudyRoom {
  return {
    id: 'room-1',
    group_id: 'group-1',
    name: 'Room',
    description: null,
    host_id: 'host-1',
    status: 'active',
    max_participants: 50,
    created_at: '2026-08-19T00:00:00Z',
    started_at: null,
    ended_at: null,
    deleted_at: null,
    deleted_by: null,
    conversation_id: 'conv-1',
    whiteboard_state: null,
    presentation_state: null,
    ...overrides,
  };
}

const summaryUser = { id: CURRENT_USER_ID, username: 'alice', display_name: 'Alice', avatar_url: null, role: 'user' as const };

function makeMember(overrides: Partial<StudyRoomMember> = {}): StudyRoomMember {
  return {
    id: 'member-1',
    room_id: 'room-1',
    user_id: CURRENT_USER_ID,
    role: 'participant',
    joined_at: '2026-08-19T00:00:00Z',
    left_at: null,
    user: summaryUser,
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockedUseAuth.mockReturnValue({
    user: { id: CURRENT_USER_ID },
    isLoggedIn: true,
  } as unknown as ReturnType<typeof useAuth>);
  mockedUseRealtime.mockReset();
  mockedListGroupMembers.mockReset().mockResolvedValue([]);
  mockedGetStudyRoom.mockReset();
  mockedListMembers.mockReset().mockResolvedValue([]);
  mockedListModeration.mockReset().mockResolvedValue([]);
  mockedLeaveOnUnload.mockReset();
});

describe('useStudyRoom -- leave-on-unload cleanup', () => {
  it('fires a beacon leave on pagehide while the caller is an active room member', async () => {
    mockedGetStudyRoom.mockResolvedValue(makeRoom());
    mockedListMembers.mockResolvedValue([makeMember()]);

    const { result } = renderHook(() => useStudyRoom('room-1'));
    await waitFor(() => expect(result.current.isCurrentUserMember).toBe(true));

    window.dispatchEvent(new Event('pagehide'));

    expect(mockedLeaveOnUnload).toHaveBeenCalledWith('room-1');
  });

  it('does not fire a beacon leave on pagehide when the caller has no active membership', async () => {
    mockedGetStudyRoom.mockResolvedValue(makeRoom());
    mockedListMembers.mockResolvedValue([]); // caller never joined

    const { result } = renderHook(() => useStudyRoom('room-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    window.dispatchEvent(new Event('pagehide'));

    expect(mockedLeaveOnUnload).not.toHaveBeenCalled();
  });

  it('fires a best-effort leave on unmount (in-app navigation away) while an active member', async () => {
    mockedGetStudyRoom.mockResolvedValue(makeRoom());
    mockedListMembers.mockResolvedValue([makeMember()]);

    const { result, unmount } = renderHook(() => useStudyRoom('room-1'));
    await waitFor(() => expect(result.current.isCurrentUserMember).toBe(true));

    unmount();

    expect(mockedLeaveOnUnload).toHaveBeenCalledWith('room-1');
  });

  it('does not fire a leave on unmount when the caller was never an active member', async () => {
    mockedGetStudyRoom.mockResolvedValue(makeRoom());
    mockedListMembers.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useStudyRoom('room-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    unmount();

    expect(mockedLeaveOnUnload).not.toHaveBeenCalled();
  });
});
