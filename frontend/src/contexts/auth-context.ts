import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthProfile {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
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
