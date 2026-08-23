import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { ProfileRole } from '../lib/profile.types';
import type { BanResponse } from '../lib/moderation.types';

export interface AuthProfile {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  organization: string | null;
  role: ProfileRole;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  /** Caller's own active restrictions (see GET /moderation/bans/me) -- fetched alongside
   * `profile` on every session change, empty for a guest or an unrestricted user. */
  bans: BanResponse[];
  loading: boolean;
  setDevSession: (session: Session | null) => void;
  refreshProfile: () => Promise<AuthProfile | null>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}
