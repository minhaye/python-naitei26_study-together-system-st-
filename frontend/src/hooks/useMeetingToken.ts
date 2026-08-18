import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/apiClient';
import { createMeetingToken } from '../lib/meeting.api';
import type { MeetingTokenResponse } from '../lib/meeting.types';

export interface MeetingTokenError {
  status: number | null;
  message: string;
}

function toMeetingTokenError(err: unknown): MeetingTokenError {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { status: 401, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };
    }
    if (err.status === 403) {
      return { status: 403, message: 'Bạn không có quyền tham gia cuộc gọi của phòng học này.' };
    }
    if (err.status === 404) {
      return { status: 404, message: 'Phòng học không tồn tại hoặc không còn khả dụng.' };
    }
    return { status: err.status, message: err.message };
  }
  return { status: null, message: 'Không thể kết nối tới máy chủ cuộc gọi. Vui lòng thử lại.' };
}

export type MeetingTokenStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Fetches a fresh LiveKit participant token from the backend whenever `enabled` is true.
 * The backend (`can_join_room_meeting`) is the sole authority on whether the current user may
 * join the meeting -- this hook only relays its response or rejection, never second-guesses it.
 */
export function useMeetingToken(roomId: string | undefined, enabled: boolean) {
  const [status, setStatus] = useState<MeetingTokenStatus>('idle');
  const [data, setData] = useState<MeetingTokenResponse | null>(null);
  const [error, setError] = useState<MeetingTokenError | null>(null);
  const requestIdRef = useRef(0);

  const fetchToken = useCallback(async () => {
    if (!roomId) return;
    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setError(null);
    try {
      const token = await createMeetingToken(roomId);
      if (requestIdRef.current !== requestId) return;
      setData(token);
      setStatus('ready');
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setData(null);
      setError(toMeetingTokenError(err));
      setStatus('error');
    }
  }, [roomId]);

  useEffect(() => {
    if (!enabled) {
      // Invalidates any in-flight request so a late response can't resurrect a stale token
      // after the meeting was disabled (e.g. the user left the room mid-fetch).
      requestIdRef.current++;
      setStatus('idle');
      setData(null);
      setError(null);
      return;
    }
    fetchToken();
  }, [enabled, fetchToken]);

  return { status, data, error, retry: fetchToken };
}
