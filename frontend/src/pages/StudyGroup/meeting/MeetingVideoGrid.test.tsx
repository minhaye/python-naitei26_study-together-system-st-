import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeetingVideoGrid } from './MeetingVideoGrid';
import { MeetingContext } from './MeetingContext';
import type { MeetingContextValue } from './MeetingContext';
import type { StudyRoomMember } from '../../../lib/studyRoom.types';

interface FakeParticipant {
  identity: string;
  name: string;
  isMicrophoneEnabled: boolean;
  isSpeaking: boolean;
}

const mockParticipants: FakeParticipant[] = [];

vi.mock('@livekit/components-react', () => ({
  useParticipants: () => mockParticipants,
  useTracks: () => [],
  isTrackReference: () => false,
  VideoTrack: () => null,
}));

const members: StudyRoomMember[] = [
  {
    id: 'm1',
    room_id: 'room-1',
    user_id: 'user-1',
    role: 'host',
    joined_at: '2026-01-01T00:00:00Z',
    left_at: null,
    user: { id: 'user-1', username: null, display_name: 'Minh Anh', avatar_url: null },
  },
];

function renderGrid(contextValue: Partial<MeetingContextValue>, unavailableReason?: string) {
  const value: MeetingContextValue = { status: 'idle', error: null, retry: vi.fn(), connected: false, ...contextValue };
  return render(
    <MeetingContext.Provider value={value}>
      <MeetingVideoGrid members={members} currentUserId="user-1" currentUserName="Minh Anh" unavailableReason={unavailableReason} />
    </MeetingContext.Provider>
  );
}

describe('MeetingVideoGrid', () => {
  beforeEach(() => {
    mockParticipants.length = 0;
  });

  it('shows the ended-room message without waiting on a token request', () => {
    renderGrid({}, 'Phòng học này đã kết thúc, cuộc gọi không còn khả dụng.');
    expect(screen.getByText('Phòng học này đã kết thúc, cuộc gọi không còn khả dụng.')).toBeInTheDocument();
  });

  it('shows a loading state while the token request/connection is in progress', () => {
    renderGrid({ status: 'loading' });
    expect(screen.getByText('Đang kết nối cuộc gọi...')).toBeInTheDocument();
  });

  it('shows a retryable error state when the token request is rejected', async () => {
    const retry = vi.fn();
    renderGrid({ status: 'error', error: { status: 403, message: 'Bạn không có quyền tham gia cuộc gọi của phòng học này.' }, retry });

    expect(screen.getByText('Không thể kết nối cuộc gọi')).toBeInTheDocument();
    expect(screen.getByText('Bạn không có quyền tham gia cuộc gọi của phòng học này.')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Thử lại'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('renders the local participant and remote participants once connected', () => {
    mockParticipants.push(
      { identity: 'user-1', name: 'Minh Anh', isMicrophoneEnabled: true, isSpeaking: false },
      { identity: 'user-2', name: 'David Chen', isMicrophoneEnabled: false, isSpeaking: false }
    );

    renderGrid({ status: 'ready', connected: true });

    expect(screen.getByText('Minh Anh (Bạn)')).toBeInTheDocument();
    expect(screen.getByText('David Chen')).toBeInTheDocument();
    expect(screen.getByText('HOST')).toBeInTheDocument();
  });

  it('prefers the real Study Room member profile over the LiveKit-embedded name', () => {
    mockParticipants.push({ identity: 'user-1', name: 'stale-livekit-name', isMicrophoneEnabled: true, isSpeaking: false });

    renderGrid({ status: 'ready', connected: true });

    expect(screen.getByText('Minh Anh (Bạn)')).toBeInTheDocument();
    expect(screen.queryByText('stale-livekit-name')).not.toBeInTheDocument();
  });

  it('falls back to a generic label (never a raw UUID) for an unknown participant with no LiveKit name', () => {
    mockParticipants.push(
      { identity: 'user-1', name: 'Minh Anh', isMicrophoneEnabled: true, isSpeaking: false },
      { identity: 'user-unknown-id-1234', name: '', isMicrophoneEnabled: false, isSpeaking: false }
    );

    renderGrid({ status: 'ready', connected: true });

    expect(screen.getByText('Người dùng')).toBeInTheDocument();
    expect(screen.queryByText(/user-unknown/)).not.toBeInTheDocument();
  });
});
