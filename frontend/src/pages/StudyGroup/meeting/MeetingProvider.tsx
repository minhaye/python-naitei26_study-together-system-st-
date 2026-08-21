import { useState } from 'react';
import type { ReactNode } from 'react';
import { LiveKitRoom, RoomAudioRenderer, StartAudio } from '@livekit/components-react';
import { useMeetingToken } from '../../../hooks/useMeetingToken';
import { MeetingContext } from './MeetingContext';

interface MeetingProviderProps {
  roomId: string;
  /** Whether the caller should currently be attempting to join the meeting -- gated by the
   * page on `isCurrentUserMember && room.status !== 'ended'`. The backend still independently
   * re-checks authorization on every token request regardless of this flag. */
  enabled: boolean;
  /** Initial mic/camera state and device picks, as chosen by the user in the pre-join lobby
   * (see PreJoinLobby.tsx). Defaults to both on with the system default device, matching the
   * previous hardcoded behavior, if the lobby is skipped. */
  initialAudioEnabled?: boolean;
  initialVideoEnabled?: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
  children: ReactNode;
}

/**
 * Owns the meeting-token request and the LiveKit room connection lifecycle. Always renders
 * `children` (video grid / controls read `useMeetingContext()` to know whether a live room is
 * actually available) so the rest of the Study Room page layout never has to branch on it.
 */
export function MeetingProvider({
  roomId,
  enabled,
  initialAudioEnabled = true,
  initialVideoEnabled = true,
  audioDeviceId,
  videoDeviceId,
  children,
}: MeetingProviderProps) {
  const { status, data, error, retry } = useMeetingToken(roomId, enabled);
  const [connected, setConnected] = useState(false);
  const [liveKitError, setLiveKitError] = useState<Error | null>(null);

  if (status !== 'ready' || !data) {
    return (
      <MeetingContext.Provider value={{ status, error, retry, connected: false, liveKitError: null }}>
        {children}
      </MeetingContext.Provider>
    );
  }

  return (
    <MeetingContext.Provider value={{ status, error, retry, connected, liveKitError }}>
      {/* display:contents keeps LiveKitRoom's wrapper <div> out of the page's flex layout. */}
      <LiveKitRoom
        serverUrl={data.server_url}
        token={data.participant_token}
        connect
        audio={initialAudioEnabled}
        video={initialVideoEnabled}
        options={{
          audioCaptureDefaults: audioDeviceId ? { deviceId: audioDeviceId } : undefined,
          videoCaptureDefaults: videoDeviceId ? { deviceId: videoDeviceId } : undefined,
        }}
        onConnected={() => {
          setConnected(true);
          setLiveKitError(null);
        }}
        onDisconnected={() => setConnected(false)}
        onError={(err) => {
          setConnected(false);
          setLiveKitError(err);
        }}
        style={{ display: 'contents' }}
      >
        <RoomAudioRenderer />
        <StartAudio
          label="Bấm để bật âm thanh cuộc gọi"
          style={{
            position: 'fixed',
            top: 76,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: '#2563EB',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        />
        {children}
      </LiveKitRoom>
    </MeetingContext.Provider>
  );
}
