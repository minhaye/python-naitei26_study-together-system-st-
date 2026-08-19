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
      <button
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
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
        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
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
