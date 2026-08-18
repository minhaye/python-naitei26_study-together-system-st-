import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setAccessTokenProvider } from '../lib/apiClient';
import { fetchCurrentUser } from '../lib/auth.api';
import { AuthContext } from './auth-context';
import type { AuthProfile } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const verifiedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Registered once; always reads sessionRef.current, so refreshed tokens are never stale.
    setAccessTokenProvider(() => sessionRef.current?.access_token ?? null);

    const applySession = async (nextSession: Session | null) => {
      sessionRef.current = nextSession;
      setSession(nextSession);

      const userId = nextSession?.user?.id ?? null;
      if (userId) {
        // Lấy profile từ CSDL để đồng bộ tên
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name, username, avatar_url')
            .eq('id', userId)
            .single();
            
          if (!error && data) {
            setProfile({
              displayName: data.display_name || data.username || nextSession?.user?.email || 'Người dùng',
              avatarUrl: data.avatar_url,
            });
          }
        } catch (err) {
          console.error('Error fetching profile:', err);
        }

        if (verifiedUserIdRef.current !== userId) {
          verifiedUserIdRef.current = userId;
          fetchCurrentUser().catch((err) => {
            console.error('Failed to verify session with GET /auth/me', err);
          });
        }
      } else {
        setProfile(null);
        verifiedUserIdRef.current = null;
      }
    };

    const getDevSession = (): Session | null => {
      const stored = localStorage.getItem('dev_session');
      if (!stored) return null;
      try {
        return JSON.parse(stored) as Session;
      } catch {
        return null;
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        applySession(data.session).finally(() => setLoading(false));
      } else {
        applySession(getDevSession()).finally(() => setLoading(false));
      }
    }).catch(() => {
      applySession(getDevSession()).finally(() => setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        localStorage.removeItem('dev_session');
        applySession(nextSession);
      } else {
        applySession(getDevSession());
      }
    });

    const handleDevAuthChange = () => {
      const devSess = getDevSession();
      applySession(devSess);
    };
    window.addEventListener('dev_auth_changed', handleDevAuthChange);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener('dev_auth_changed', handleDevAuthChange);
    };
  }, []);

  const setDevSession = (nextSession: Session | null) => {
    if (nextSession) {
      localStorage.setItem('dev_session', JSON.stringify(nextSession));
    } else {
      localStorage.removeItem('dev_session');
    }
    sessionRef.current = nextSession;
    setSession(nextSession);
    
    if (!nextSession) {
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, setDevSession }}>
      {children}
    </AuthContext.Provider>
  );
}
