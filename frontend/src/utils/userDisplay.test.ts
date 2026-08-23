import { describe, it, expect } from 'vitest';
import { getDisplayName, getDisplayNameWithSelfSuffix, GENERIC_USER_LABEL } from './userDisplay';
import type { UserSummary } from '../lib/profile.types';

function user(overrides: Partial<UserSummary> = {}): UserSummary {
  return { id: 'user-1000', username: null, display_name: null, avatar_url: null, role: 'user', ...overrides };
}

describe('getDisplayName', () => {
  it('prefers display_name when present', () => {
    expect(getDisplayName(user({ display_name: 'Minh Anh', username: 'minh_a' }))).toBe('Minh Anh');
  });

  it('falls back to username when display_name is missing', () => {
    expect(getDisplayName(user({ username: 'minh_a' }))).toBe('minh_a');
  });

  it('falls back to the generic label when both are missing', () => {
    expect(getDisplayName(user())).toBe(GENERIC_USER_LABEL);
  });

  it('falls back to the generic label for null/undefined input', () => {
    expect(getDisplayName(null)).toBe(GENERIC_USER_LABEL);
    expect(getDisplayName(undefined)).toBe(GENERIC_USER_LABEL);
  });

  it('never derives a label from the raw id/UUID', () => {
    const result = getDisplayName(user({ id: 'a1b2c3d4-0000-0000-0000-000000000000' }));
    expect(result).not.toMatch(/#/);
    expect(result).not.toContain('a1b2');
  });
});

describe('getDisplayNameWithSelfSuffix', () => {
  it('uses the provided self name with a "(Bạn)" suffix when isSelf is true', () => {
    expect(getDisplayNameWithSelfSuffix(user({ display_name: 'Someone Else' }), true, 'Minh Anh')).toBe(
      'Minh Anh (Bạn)'
    );
  });

  it('uses the resolved profile name when isSelf is false', () => {
    expect(getDisplayNameWithSelfSuffix(user({ display_name: 'Someone Else' }), false, 'Minh Anh')).toBe(
      'Someone Else'
    );
  });
});
