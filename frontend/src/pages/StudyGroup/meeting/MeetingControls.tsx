import { useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Mic, MicOff, ScreenShare, ScreenShareOff, Video as VideoIcon, VideoOff } from 'lucide-react';
import { useMeetingContext } from './MeetingContext';

const buttonBaseStyle = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  border: 'none',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s',
} as const;

interface MeetingControlsProps {
  /** e.g. the room has ended -- keeps the buttons visually consistent with other footer controls. */
  disabled: boolean;
}

/**
 * Mic/camera toggle buttons. Renders disabled placeholders until the LiveKit room connection is
 * actually established (`useMeetingContext().connected`) since `useLocalParticipant` requires a
 * live room context; once connected it reflects and drives the real LiveKit track state.
 */
export function MeetingControls({ disabled }: MeetingControlsProps) {
  const { connected } = useMeetingContext();

  if (!connected) {
    return (
      <>
        <button
          disabled
          style={{ ...buttonBaseStyle, background: '#334155', opacity: 0.5, cursor: 'default' }}
          title="Đang kết nối cuộc gọi..."
        >
          <Mic size={20} />
        </button>
        <button
          disabled
          style={{ ...buttonBaseStyle, background: '#334155', opacity: 0.5, cursor: 'default' }}
          title="Đang kết nối cuộc gọi..."
        >
          <VideoIcon size={20} />
        </button>
        <button
          disabled
          style={{ ...buttonBaseStyle, background: '#334155', opacity: 0.5, cursor: 'default' }}
          title="Đang kết nối cuộc gọi..."
        >
          <ScreenShare size={20} />
        </button>
      </>
    );
  }

  return <ConnectedControls disabled={disabled} />;
}

function ConnectedControls({ disabled }: MeetingControlsProps) {
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled, localParticipant } = useLocalParticipant();
  // Guards against a second click firing while `setScreenShareEnabled` (which awaits the
  // browser's native picker) is still in flight -- `isScreenShareEnabled` only flips once the
  // track publish/unpublish actually resolves, so without this a fast double-click could
  // trigger two concurrent picker prompts.
  const [isScreenSharePending, setIsScreenSharePending] = useState(false);
  // Surfaces a denied permission / unavailable device for mic or camera -- LiveKit's own
  // `setMicrophoneEnabled`/`setCameraEnabled` reject in that case (see livekit-client's
  // `setTrackEnabled`, which already serializes concurrent calls to the same source
  // internally, so this only needs to catch the rejection, not guard against races). Without
  // this the rejection was unhandled and the user got no feedback at all -- the button itself
  // never gets stuck since it reflects the real (unchanged) LiveKit track state either way.
  const [mediaError, setMediaError] = useState<string | null>(null);

  const handleToggleMicrophone = async () => {
    setMediaError(null);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      setMediaError('Không thể truy cập micro. Vui lòng kiểm tra quyền truy cập thiết bị.');
    }
  };

  const handleToggleCamera = async () => {
    setMediaError(null);
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch {
      setMediaError('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập thiết bị.');
    }
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharePending) return;
    setIsScreenSharePending(true);
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled, { audio: true });
    } catch {
      // Expected for a cancelled/denied browser picker or a failed publish -- LiveKit already
      // leaves `isScreenShareEnabled` false in that case, so there's nothing else to reset here.
      // Surfacing this as a blocking error would be misleading since cancelling the picker is a
      // normal, non-exceptional user action.
    } finally {
      setIsScreenSharePending(false);
    }
  };

  return (
    <>
      {mediaError && (
        <div
          onClick={() => setMediaError(null)}
          title="Bấm để ẩn thông báo"
          style={{
            position: 'fixed',
            bottom: 88,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#450A0A',
            border: '1px solid #7F1D1D',
            color: '#FCA5A5',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 12.5,
            cursor: 'pointer',
            zIndex: 50,
            whiteSpace: 'nowrap',
          }}
        >
          {mediaError}
        </div>
      )}

      <button
        onClick={handleToggleMicrophone}
        disabled={disabled}
        style={{
          ...buttonBaseStyle,
          background: !isMicrophoneEnabled ? '#EF4444' : '#334155',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          boxShadow: !isMicrophoneEnabled ? '0 0 12px rgba(239, 68, 68, 0.4)' : 'none',
        }}
        title={isMicrophoneEnabled ? 'Tắt micro' : 'Bật micro'}
      >
        {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      <button
        onClick={handleToggleCamera}
        disabled={disabled}
        style={{
          ...buttonBaseStyle,
          background: !isCameraEnabled ? '#EF4444' : '#334155',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          boxShadow: !isCameraEnabled ? '0 0 12px rgba(239, 68, 68, 0.4)' : 'none',
        }}
        title={isCameraEnabled ? 'Tắt camera' : 'Bật camera'}
      >
        {isCameraEnabled ? <VideoIcon size={20} /> : <VideoOff size={20} />}
      </button>

      <button
        onClick={handleToggleScreenShare}
        disabled={disabled || isScreenSharePending}
        style={{
          ...buttonBaseStyle,
          background: isScreenShareEnabled ? '#2563EB' : '#334155',
          cursor: disabled || isScreenSharePending ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : isScreenSharePending ? 0.7 : 1,
          boxShadow: isScreenShareEnabled ? '0 0 12px rgba(37, 99, 235, 0.5)' : 'none',
        }}
        title={isScreenShareEnabled ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
      >
        {isScreenShareEnabled ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
      </button>
    </>
  );
}
