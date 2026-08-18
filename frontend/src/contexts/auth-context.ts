import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  setDevSession: (session: Session | null) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}
