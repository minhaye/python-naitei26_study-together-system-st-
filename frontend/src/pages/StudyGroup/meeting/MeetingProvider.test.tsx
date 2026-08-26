import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import type { LiveKitRoomProps } from '@livekit/components-react';
import { ApiError } from '../../../lib/apiClient';
import { createMeetingToken } from '../../../lib/meeting.api';
import { MeetingProvider } from './MeetingProvider';
import { useMeetingContext } from './MeetingContext';

vi.mock('../../../lib/meeting.api', () => ({
  createMeetingToken: vi.fn(),
}));

let lastLiveKitRoomProps: LiveKitRoomProps | null = null;

// LiveKit's real Room/WebRTC connection is out of scope for a unit test -- this fake stands in
// for `<LiveKitRoom>`, calling the same lifecycle callbacks the real component would, so
// MeetingProvider's own wiring (props passed through, context updated) is what gets tested.
vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: (props: LiveKitRoomProps) => {
    lastLiveKitRoomProps = props;
    useEffect(() => {
      props.onConnected?.();
      return () => {
        props.onDisconnected?.();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.token, props.serverUrl]);
    return <div data-testid="livekit-room">{props.children}</div>;
  },
  RoomAudioRenderer: () => null,
  StartAudio: () => null,
}));

const mockedCreateMeetingToken = vi.mocked(createMeetingToken);

function StatusProbe() {
  const { status, connected, error } = useMeetingContext();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="connected">{String(connected)}</span>
      <span data-testid="error">{error?.message ?? ''}</span>
    </div>
  );
}

describe('MeetingProvider', () => {
  beforeEach(() => {
    mockedCreateMeetingToken.mockReset();
    lastLiveKitRoomProps = null;
  });

  it('exposes a loading status while the token request is in flight, without connecting yet', async () => {
    mockedCreateMeetingToken.mockReturnValue(new Promise(() => {}));

    render(
      <MeetingProvider roomId="room-1" enabled>
        <StatusProbe />
      </MeetingProvider>
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('loading'));
    expect(screen.getByTestId('connected').textContent).toBe('false');
    expect(screen.queryByTestId('livekit-room')).not.toBeInTheDocument();
  });

  it('connects to the LiveKit room with the token issued by the backend', async () => {
    mockedCreateMeetingToken.mockResolvedValue({ server_url: 'wss://livekit.example.com', participant_token: 'tok-123' });

    render(
      <MeetingProvider roomId="room-1" enabled>
        <StatusProbe />
      </MeetingProvider>
    );

    await waitFor(() => expect(screen.getByTestId('connected').textContent).toBe('true'));
    expect(lastLiveKitRoomProps?.serverUrl).toBe('wss://livekit.example.com');
    expect(lastLiveKitRoomProps?.token).toBe('tok-123');
  });

  it('surfaces a 403 rejection as an error and never renders the LiveKit room', async () => {
    mockedCreateMeetingToken.mockRejectedValue(new ApiError(403, 'Forbidden'));

    render(
      <MeetingProvider roomId="room-1" enabled>
        <StatusProbe />
      </MeetingProvider>
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toContain('không có quyền');
    expect(screen.queryByTestId('livekit-room')).not.toBeInTheDocument();
  });

  it('disconnects (stops rendering the LiveKit room) once disabled', async () => {
    mockedCreateMeetingToken.mockResolvedValue({ server_url: 'wss://x', participant_token: 'tok' });

    const { rerender } = render(
      <MeetingProvider roomId="room-1" enabled>
        <StatusProbe />
      </MeetingProvider>
    );
    await waitFor(() => expect(screen.getByTestId('connected').textContent).toBe('true'));

    rerender(
      <MeetingProvider roomId="room-1" enabled={false}>
        <StatusProbe />
      </MeetingProvider>
    );

    await waitFor(() => expect(screen.queryByTestId('livekit-room')).not.toBeInTheDocument());
    expect(screen.getByTestId('connected').textContent).toBe('false');
  });

  it('calls onSessionEnded when the LiveKit connection disconnects, so the caller can refetch room status (kick/end/delete)', async () => {
    mockedCreateMeetingToken.mockResolvedValue({ server_url: 'wss://x', participant_token: 'tok' });
    const onSessionEnded = vi.fn();

    const { rerender } = render(
      <MeetingProvider roomId="room-1" enabled onSessionEnded={onSessionEnded}>
        <StatusProbe />
      </MeetingProvider>
    );
    await waitFor(() => expect(screen.getByTestId('connected').textContent).toBe('true'));
    expect(onSessionEnded).not.toHaveBeenCalled();

    // Disabling tears down the LiveKit room (mirrors what the real component does once the
    // room ends/the caller is kicked and `enabled` flips false) -- the fake LiveKitRoom above
    // fires onDisconnected from its cleanup effect.
    rerender(
      <MeetingProvider roomId="room-1" enabled={false} onSessionEnded={onSessionEnded}>
        <StatusProbe />
      </MeetingProvider>
    );

    await waitFor(() => expect(onSessionEnded).toHaveBeenCalledTimes(1));
  });
});
