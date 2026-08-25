const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

/** Pure hostname check so it can be unit-tested without touching `window`. */
export function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname);
}

/** Whether the frontend is currently being served from localhost (used to gate
 * features restricted by third-party licensing, e.g. the Tldraw whiteboard). */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  return isLocalHostname(window.location.hostname);
}
