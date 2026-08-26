import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { useAuthContext } from './auth-context';
import { supabase } from '../lib/supabase';
import { ApiError } from '../lib/apiClient';
import { createProfile, fetchProfile } from '../lib/profile.api';
import { fetchCurrentUser } from '../lib/auth.api';
import { moderationApi } from '../lib/moderation.api';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../lib/profile.types';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() } },
}));
vi.mock('../lib/profile.api', () => ({ fetchProfile: vi.fn(), createProfile: vi.fn() }));
vi.mock('../lib/auth.api', () => ({ fetchCurrentUser: vi.fn() }));
vi.mock('../lib/moderation.api', () => ({ moderationApi: { listMyBans: vi.fn() } }));

const mockedGetSession = vi.mocked(supabase.auth.getSession);
const mockedOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
const mockedFetchProfile = vi.mocked(fetchProfile);
const mockedCreateProfile = vi.mocked(createProfile);
const mockedFetchCurrentUser = vi.mocked(fetchCurrentUser);
const mockedListMyBans = vi.mocked(moderationApi.listMyBans);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Renders the profile currently in context so tests can observe whether it ends up
 * populated or was clobbered back to null by a losing concurrent request. */
function ProfileProbe() {
  const { profile, loading } = useAuthContext();
  return <div data-testid="probe">{loading ? 'loading' : profile ? `profile:${profile.id}` : 'no-profile'}</div>;
}

const newUserSession = {
  access_token: 'token-new-user',
  user: { id: 'user-new', email: 'new@user.dev', user_metadata: { full_name: 'New User' } },
} as unknown as Session;

const createdProfile: Profile = {
  id: 'user-new',
  username: null,
  display_name: 'New User',
  avatar_url: null,
  bio: null,
  organization: null,
  role: 'user',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  mockedGetSession.mockReset();
  mockedOnAuthStateChange.mockReset();
  mockedFetchProfile.mockReset();
  mockedCreateProfile.mockReset();
  mockedFetchCurrentUser.mockReset().mockResolvedValue({ id: 'user-new', email: 'new@user.dev', role: 'user' });
  mockedListMyBans.mockReset().mockResolvedValue([]);
});

describe('AuthProvider profile auto-create race', () => {
  it('dedupes concurrent refreshProfile calls for the same brand-new user into a single createProfile call', async () => {
    // getSession() and onAuthStateChange's INITIAL_SESSION both fire on mount from the same
    // underlying session -- this reproduces that race by controlling each independently.
    const getSessionDeferred = createDeferred<{ data: { session: Session | null } }>();
    mockedGetSession.mockReturnValue(getSessionDeferred.promise as ReturnType<typeof supabase.auth.getSession>);

    let authStateCallback: ((event: string, session: Session | null) => void) | null = null;
    mockedOnAuthStateChange.mockImplementation((cb) => {
      authStateCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as ReturnType<typeof supabase.auth.onAuthStateChange>;
    });

    const fetchProfileDeferred = createDeferred<Profile>();
    mockedFetchProfile.mockReturnValue(fetchProfileDeferred.promise);
    mockedCreateProfile.mockResolvedValue(createdProfile);

    render(
      <AuthProvider>
        <ProfileProbe />
      </AuthProvider>,
    );

    // Trigger 1: onAuthStateChange's INITIAL_SESSION, fired synchronously on subscribe.
    // Starts refreshProfile() for the new user, which suspends on the still-pending
    // fetchProfile() call below.
    act(() => {
      authStateCallback?.('INITIAL_SESSION', newUserSession);
    });

    // Trigger 2: getSession() resolving with the same session shortly after. Flush
    // microtasks so its applySession -> refreshProfile() call actually runs and hits the
    // in-flight guard, all while trigger 1's fetchProfile() is still unresolved.
    await act(async () => {
      getSessionDeferred.resolve({ data: { session: newUserSession } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedFetchProfile).toHaveBeenCalledTimes(1);

    // Let the single in-flight lookup fail with "not found" (a brand-new account has no
    // profile row yet) and the auto-create fallback resolve.
    await act(async () => {
      fetchProfileDeferred.reject(new ApiError(404, 'Profile not found'));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('profile:user-new'));

    // Only one fetch-or-create cycle should have run in total, and the final state must be
    // the created profile, not null from a second, deduped-away caller.
    expect(mockedFetchProfile).toHaveBeenCalledTimes(1);
    expect(mockedCreateProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('probe').textContent).toBe('profile:user-new');
  });

  it('does not touch createProfile for an existing user whose profile already exists', async () => {
    mockedGetSession.mockResolvedValue({ data: { session: newUserSession } } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    mockedOnAuthStateChange.mockImplementation((cb) => {
      // Fire INITIAL_SESSION synchronously too, mirroring the real client, to make sure the
      // duplicate trigger still doesn't reach createProfile when a profile already exists.
      cb('INITIAL_SESSION', newUserSession);
      return { data: { subscription: { unsubscribe: vi.fn() } } } as ReturnType<typeof supabase.auth.onAuthStateChange>;
    });
    mockedFetchProfile.mockResolvedValue(createdProfile);

    render(
      <AuthProvider>
        <ProfileProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('profile:user-new'));

    expect(mockedCreateProfile).not.toHaveBeenCalled();
  });
});
