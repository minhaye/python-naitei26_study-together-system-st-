import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setAccessTokenProvider } from '../lib/apiClient';
import { fetchCurrentUser } from '../lib/auth.api';
import { fetchProfile } from '../lib/profile.api';
import { moderationApi } from '../lib/moderation.api';
import type { BanResponse } from '../lib/moderation.types';
import { AuthContext } from './auth-context';
import type { AuthProfile } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [bans, setBans] = useState<BanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const verifiedUserIdRef = useRef<string | null>(null);

  const refreshProfile = async (): Promise<AuthProfile | null> => {
    const activeSession = sessionRef.current;
    const userId = activeSession?.user.id;
    if (!userId) {
      setProfile(null);
      return null;
    }
    try {
      const data = await fetchProfile(userId);
      if (sessionRef.current?.user.id !== userId) return null;
      const nextProfile: AuthProfile = {
        id: data.id,
        username: data.username,
        displayName: data.display_name || data.username || activeSession.user.email || 'Người dùng',
        avatarUrl: data.avatar_url,
        bio: data.bio,
        organization: data.organization,
        role: data.role,
      };
      setProfile(nextProfile);
      return nextProfile;
    } catch (err) {
      // A newly registered account may not have a profile row yet.
      console.error('Failed to fetch profile from the backend', err);
      setProfile(null);
      return null;
    }
  };

  const refreshBans = async (): Promise<void> => {
    if (!sessionRef.current?.user.id) {
      setBans([]);
      return;
    }
    try {
      setBans(await moderationApi.listMyBans());
    } catch (err) {
      // Non-critical: proactive restriction banners just won't show; the backend still
      // enforces bans at action time regardless of this fetch's outcome.
      console.error('Failed to fetch own restrictions', err);
    }
  };

  useEffect(() => {
    setAccessTokenProvider(() => sessionRef.current?.access_token ?? null);
    const applySession = async (nextSession: Session | null) => {
      sessionRef.current = nextSession;
      setSession(nextSession);
      const userId = nextSession?.user?.id ?? null;
      if (userId) {
        await Promise.all([refreshProfile(), refreshBans()]);
        if (verifiedUserIdRef.current !== userId) {
          verifiedUserIdRef.current = userId;
          fetchCurrentUser().catch((err) => console.error('Failed to verify session with GET /auth/me', err));
        }
      } else {
        setProfile(null);
        setBans([]);
        verifiedUserIdRef.current = null;
      }
    };
    const getDevSession = (): Session | null => {
      const stored = localStorage.getItem('dev_session');
      if (!stored) return null;
      try { return JSON.parse(stored) as Session; } catch { return null; }
    };
    supabase.auth.getSession().then(({ data }) => {
      void applySession(data.session ?? getDevSession()).finally(() => setLoading(false));
    }).catch(() => {
      void applySession(getDevSession()).finally(() => setLoading(false));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) localStorage.removeItem('dev_session');
      void applySession(nextSession ?? getDevSession());
    });
    const handleDevAuthChange = () => { void applySession(getDevSession()); };
    window.addEventListener('dev_auth_changed', handleDevAuthChange);
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener('dev_auth_changed', handleDevAuthChange);
    };
  }, []);

  const setDevSession = (nextSession: Session | null) => {
    if (nextSession) localStorage.setItem('dev_session', JSON.stringify(nextSession));
    else localStorage.removeItem('dev_session');
    sessionRef.current = nextSession;
    setSession(nextSession);
    if (!nextSession) {
      setProfile(null);
      setBans([]);
    }
  };

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, bans, loading, setDevSession, refreshProfile }}>{children}</AuthContext.Provider>;
}
