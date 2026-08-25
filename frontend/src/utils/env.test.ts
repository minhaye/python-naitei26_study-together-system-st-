import { describe, it, expect } from 'vitest';
import { isLocalHostname, isLocalhost } from './env';

describe('isLocalHostname', () => {
  it.each(['localhost', '127.0.0.1', '::1'])('treats %s as local', (hostname) => {
    expect(isLocalHostname(hostname)).toBe(true);
  });

  it.each(['example.com', 'app.study-together.com', 'staging.localhost.com', '192.168.1.10'])(
    'treats %s as not local',
    (hostname) => {
      expect(isLocalHostname(hostname)).toBe(false);
    },
  );
});

describe('isLocalhost', () => {
  it('reflects the current window.location.hostname', () => {
    // jsdom's default test origin is http://localhost:3000.
    expect(window.location.hostname).toBe('localhost');
    expect(isLocalhost()).toBe(true);
  });
});
