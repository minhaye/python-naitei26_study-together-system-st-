import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setAccessTokenProvider } from '../lib/apiClient';
import { fetchCurrentUser } from '../lib/auth.api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const verifiedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Registered once; always reads sessionRef.current, so refreshed tokens are never stale.
    setAccessTokenProvider(() => sessionRef.current?.access_token ?? null);

    const applySession = (nextSession: Session | null) => {
      sessionRef.current = nextSession;
      setSession(nextSession);

      const userId = nextSession?.user?.id ?? null;
      if (userId && verifiedUserIdRef.current !== userId) {
        verifiedUserIdRef.current = userId;
        // One-off sanity check that the backend resolves the same identity as the Supabase session.
        fetchCurrentUser().catch((err) => {
          console.error('Failed to verify session with GET /auth/me', err);
        });
      } else if (!userId) {
        verifiedUserIdRef.current = null;
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
