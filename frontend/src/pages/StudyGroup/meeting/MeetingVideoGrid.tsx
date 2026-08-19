import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Track } from 'livekit-client';
import { isTrackReference, useParticipants, useTracks, VideoTrack } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';
import { AlertTriangle, Loader2, Mic, MicOff, VideoOff } from 'lucide-react';
import type { StudyRoomMember } from '../../../lib/studyRoom.types';
import { getAvatarColor, getAvatarInitials } from '../../../utils/avatarUtils';
import { getDisplayName } from '../../../utils/userDisplay';
import { useMeetingContext } from './MeetingContext';

interface MeetingStatusMessageProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

function MeetingStatusMessage({ icon, title, subtitle, action }: MeetingStatusMessageProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#94A3B8', textAlign: 'center', padding: 24 }}>
      {icon}
      <div style={{ color: 'white', fontSize: 15, fontWeight: 600 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, maxWidth: 420 }}>{subtitle}</div>}
      {action && (
        <button
          onClick={action.onClick}
          style={{ marginTop: 4, background: '#2563EB', border: 'none', color: 'white', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface MeetingVideoGridProps {
  members: StudyRoomMember[];
  currentUserId: string | null;
  currentUserName: string;
  /** Set when the meeting is known to be unavailable without asking the backend (room ended) --
   * a UX shortcut only; the backend still independently rejects the token request either way. */
  unavailableReason?: string;
}

export function MeetingVideoGrid({ members, currentUserId, currentUserName, unavailableReason }: MeetingVideoGridProps) {
  const { status, error, retry, connected, liveKitError } = useMeetingContext();

  if (unavailableReason) {
    return <MeetingStatusMessage icon={<VideoOff size={32} />} title={unavailableReason} />;
  }

  if (status === 'idle' || status === 'loading') {
    return <MeetingStatusMessage icon={<Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />} title="Đang kết nối cuộc gọi..." />;
  }

  if (status === 'error') {
    return (
      <MeetingStatusMessage
        icon={<AlertTriangle size={32} color="#F87171" />}
        title="Không thể kết nối cuộc gọi"
        subtitle={error?.message}
        action={{ label: 'Thử lại', onClick: retry }}
      />
    );
  }

  if (liveKitError) {
    return (
      <MeetingStatusMessage
        icon={<AlertTriangle size={32} color="#F87171" />}
        title="Không thể kết nối máy chủ video"
        subtitle={liveKitError.message || 'Lỗi LiveKit. Vui lòng kiểm tra cấu hình hoặc kết nối mạng.'}
        action={{ label: 'Thử lại', onClick: () => window.location.reload() }}
      />
    );
  }

  if (!connected) {
    return <MeetingStatusMessage icon={<Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />} title="Đang thiết lập kết nối..." />;
  }

  return <ConnectedGrid members={members} currentUserId={currentUserId} currentUserName={currentUserName} />;
}

function ConnectedGrid({ members, currentUserId, currentUserName }: Omit<MeetingVideoGridProps, 'unavailableReason'>) {
  const participants = useParticipants();
  const cameraTrackRefs = useTracks([Track.Source.Camera], { onlySubscribed: false });

  const cameraTrackByIdentity = useMemo(() => {
    const map = new Map<string, TrackReference>();
    for (const trackRef of cameraTrackRefs) {
      if (isTrackReference(trackRef)) map.set(trackRef.participant.identity, trackRef);
    }
    return map;
  }, [cameraTrackRefs]);

  const memberByUserId = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  if (participants.length === 0) {
    return <MeetingStatusMessage icon={<Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />} title="Đang tham gia cuộc gọi..." />;
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: participants.length > 4 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
        gap: 16,
        alignContent: 'center',
      }}
    >
      {participants.map((p) => {
        const isSelf = p.identity === currentUserId;
        const member = memberByUserId.get(p.identity);
        // Prefer the real Study Room member's profile (fresh, from the members API) over
        // the LiveKit-embedded `p.name` (only set once, at token creation -- see
        // study_room_router.create_meeting_token); `p.name` is a fallback for the rare case
        // where this participant isn't in our current members list (e.g. a race between
        // joining the call and the member roster refreshing), never a raw UUID fragment.
        const name = isSelf
          ? `${currentUserName} (Bạn)`
          : member
            ? getDisplayName(member.user)
            : p.name || 'Người dùng';
        const initial = getAvatarInitials(name);
        const color = getAvatarColor(name);
        const avatarUrl = isSelf ? null : member?.user.avatar_url ?? null;
        const cameraTrackRef = cameraTrackByIdentity.get(p.identity);
        const isCameraOn = !!cameraTrackRef && !cameraTrackRef.publication.isMuted;
        const isMicOn = p.isMicrophoneEnabled;
        const isHost = member?.role === 'host';

        return (
          <div
            key={p.identity}
            style={{
              position: 'relative',
              aspectRatio: '16/9',
              background: isCameraOn ? '#334155' : '#1E293B',
              borderRadius: 16,
              border: p.isSpeaking ? '3px solid #10B981' : '1px solid #334155',
              boxShadow: p.isSpeaking ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              transition: 'all 0.3s',
            }}
          >
            {isCameraOn && cameraTrackRef ? (
              <VideoTrack
                trackRef={cameraTrackRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isSelf ? 'scaleX(-1)' : undefined }}
              />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt={name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 28, fontWeight: 'bold' }}>
                {initial}
              </div>
            )}

            <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', padding: '4px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'white', fontSize: 13, fontWeight: '500' }}>
              <span>{name}</span>
              {isHost && <span style={{ background: '#3B82F6', color: 'white', fontSize: 10, fontWeight: '700', padding: '2px 6px', borderRadius: 4 }}>HOST</span>}
            </div>

            <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
              <div style={{ background: isMicOn ? '#10B981' : '#EF4444', color: 'white', padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
