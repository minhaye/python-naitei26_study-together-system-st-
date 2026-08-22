import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Loader2 } from 'lucide-react';

export interface MediaJoinChoice {
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}

interface PreJoinLobbyProps {
  roomName: string;
  roomSubtitle?: string;
  userName: string;
  userInitial: string;
  userColor: string;
  userAvatarUrl?: string;
  isJoining?: boolean;
  joinError?: string;
  onJoin: (choice: MediaJoinChoice) => void;
  onBack: () => void;
}

const controlButtonStyle = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  border: 'none',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s',
} as const;

const selectStyle = {
  width: '100%',
  background: '#0F172A',
  border: '1px solid #334155',
  color: 'white',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  outline: 'none',
} as const;

/**
 * Pre-join lobby shown after the user has room membership but before they enter the live
 * LiveKit call -- lets them preview and toggle camera/mic (and pick a device) first, similar to
 * Zoom/Teams/Meet. Acquires its own local `getUserMedia` preview stream, entirely separate from
 * the stream LiveKit itself will acquire once `onJoin` mounts the real call.
 */
export function PreJoinLobby({
  roomName,
  roomSubtitle,
  userName,
  userInitial,
  userColor,
  userAvatarUrl,
  isJoining = false,
  joinError,
  onJoin,
  onBack,
}: PreJoinLobbyProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [camEnabled, setCamEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedMicId, setSelectedMicId] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // (Re)acquires the preview stream whenever a toggle or selected device changes, and tears it
  // down on cleanup -- so the camera/mic hardware is only held while actually needed here, and
  // is fully released before the real LiveKit connection acquires its own tracks.
  useEffect(() => {
    let cancelled = false;
    let localStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let rafId: number | null = null;

    setIsLoadingPreview(true);
    setPermissionError(null);

    (async () => {
      if (!camEnabled && !micEnabled) {
        setIsLoadingPreview(false);
        setAudioLevel(0);
        return;
      }
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: camEnabled ? (selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true) : false,
          audio: micEnabled ? (selectedMicId ? { deviceId: { exact: selectedMicId } } : true) : false,
        });
        if (cancelled) {
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = camEnabled ? localStream : null;
        }

        // Device labels are only populated once permission has been granted, so enumerate here.
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setCameras(allDevices.filter((d) => d.kind === 'videoinput'));
          setMicrophones(allDevices.filter((d) => d.kind === 'audioinput'));
        }

        if (micEnabled && localStream.getAudioTracks().length > 0) {
          audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(localStream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
            setAudioLevel(Math.min(1, avg / 100));
            rafId = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch {
        if (!cancelled) {
          setPermissionError('Không thể truy cập camera/micro. Vui lòng kiểm tra quyền truy cập thiết bị của trình duyệt.');
        }
      } finally {
        if (!cancelled) setIsLoadingPreview(false);
      }
    })();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      audioContext?.close();
      localStream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [camEnabled, micEnabled, selectedCameraId, selectedMicId]);

  const handleJoin = () => {
    onJoin({
      audioEnabled: micEnabled,
      videoEnabled: camEnabled,
      audioDeviceId: selectedMicId || undefined,
      videoDeviceId: selectedCameraId || undefined,
    });
  };

  return (
    <div style={{width: '100vw', height: '100vh', background: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, sans-serif'}}>
      <div style={{display: 'flex', gap: 32, maxWidth: 880, width: '100%', alignItems: 'stretch', flexWrap: 'wrap', justifyContent: 'center'}}>

        {/* Video preview panel */}
        <div style={{flex: '1 1 420px', maxWidth: 480}}>
          <div style={{position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#1E293B', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: camEnabled && !permissionError ? 'block' : 'none',
              }}
            />

            {(!camEnabled || permissionError) && (
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={userName} style={{width: 88, height: 88, borderRadius: '50%', objectFit: 'cover'}} />
                ) : (
                  <div style={{width: 88, height: 88, borderRadius: '50%', background: userColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 28}}>
                    {userInitial}
                  </div>
                )}
                <span style={{color: '#94A3B8', fontSize: 13}}>{userName}</span>
              </div>
            )}

            {isLoadingPreview && !permissionError && (camEnabled || micEnabled) && (
              <div style={{position: 'absolute', top: 12, right: 12, color: '#94A3B8', display: 'flex', alignItems: 'center'}}>
                <Loader2 size={18} style={{animation: 'spin 1s linear infinite'}} />
              </div>
            )}

            {/* Mic level meter */}
            {micEnabled && (
              <div style={{position: 'absolute', bottom: 78, left: 14, right: 14, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 4, overflow: 'hidden'}}>
                <div style={{height: '100%', width: `${Math.round(audioLevel * 100)}%`, background: '#10B981', transition: 'width 0.08s linear'}} />
              </div>
            )}

            {/* Overlay toggle controls */}
            <div style={{position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 14}}>
              <button
                onClick={() => setMicEnabled((v) => !v)}
                style={{...controlButtonStyle, background: micEnabled ? '#334155' : '#EF4444', boxShadow: '0 4px 12px rgba(0,0,0,0.35)'}}
                title={micEnabled ? 'Tắt micro' : 'Bật micro'}
              >
                {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button
                onClick={() => setCamEnabled((v) => !v)}
                style={{...controlButtonStyle, background: camEnabled ? '#334155' : '#EF4444', boxShadow: '0 4px 12px rgba(0,0,0,0.35)'}}
                title={camEnabled ? 'Tắt camera' : 'Bật camera'}
              >
                {camEnabled ? <VideoIcon size={20} /> : <VideoOff size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Info & device settings panel */}
        <div style={{flex: '1 1 320px', maxWidth: 360, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20, paddingTop: 8}}>
          <div>
            <h1 style={{color: 'white', fontSize: 22, fontWeight: '700', margin: 0}}>{roomName}</h1>
            {roomSubtitle && <p style={{color: '#94A3B8', fontSize: 13, margin: '6px 0 0'}}>{roomSubtitle}</p>}
            <p style={{color: '#64748B', fontSize: 13, margin: '10px 0 0'}}>Kiểm tra camera và micro trước khi vào phòng học.</p>
          </div>

          {permissionError && (
            <div style={{background: '#450A0A', border: '1px solid #7F1D1D', borderRadius: 8, padding: '10px 12px', color: '#FCA5A5', fontSize: 12.5}}>
              {permissionError}
            </div>
          )}

          {joinError && (
            <div style={{background: '#450A0A', border: '1px solid #7F1D1D', borderRadius: 8, padding: '10px 12px', color: '#FCA5A5', fontSize: 12.5}}>
              {joinError}
            </div>
          )}

          <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            <div>
              <label style={{color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 6, display: 'block'}}>Micro</label>
              <select
                value={selectedMicId}
                onChange={(e) => setSelectedMicId(e.target.value)}
                disabled={microphones.length === 0}
                style={selectStyle}
              >
                <option value="">Mặc định hệ thống</option>
                {microphones.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Micro ${d.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 6, display: 'block'}}>Camera</label>
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                disabled={cameras.length === 0}
                style={selectStyle}
              >
                <option value="">Mặc định hệ thống</option>
                {cameras.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{display: 'flex', gap: 12, marginTop: 8}}>
            <button
              onClick={onBack}
              disabled={isJoining}
              style={{flex: '0 0 auto', background: '#334155', border: 'none', color: 'white', padding: '12px 18px', borderRadius: 10, cursor: isJoining ? 'default' : 'pointer', fontSize: 14, fontWeight: '500', opacity: isJoining ? 0.7 : 1}}
            >
              Quay lại
            </button>
            <button
              onClick={handleJoin}
              disabled={isJoining}
              style={{flex: 1, background: '#2563EB', border: 'none', color: 'white', padding: '12px 18px', borderRadius: 10, cursor: isJoining ? 'default' : 'pointer', fontSize: 14, fontWeight: '600', opacity: isJoining ? 0.7 : 1}}
            >
              {isJoining ? 'Đang tham gia...' : 'Tham gia phòng học'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
