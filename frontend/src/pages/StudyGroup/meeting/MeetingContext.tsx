import { createContext, useContext } from 'react';
import type { MeetingTokenError, MeetingTokenStatus } from '../../../hooks/useMeetingToken';

export interface MeetingContextValue {
  /** Status of the backend token request (idle/loading/ready/error) -- see useMeetingToken. */
  status: MeetingTokenStatus;
  error: MeetingTokenError | null;
  retry: () => void;
  /** True once the LiveKit room connection itself is established (after a 'ready' token). */
  connected: boolean;
}

export const MeetingContext = createContext<MeetingContextValue>({
  status: 'idle',
  error: null,
  retry: () => {},
  connected: false,
});

export const useMeetingContext = () => useContext(MeetingContext);
