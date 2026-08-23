import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement matchMedia -- tldraw's environment detection (color-scheme /
// reduced-motion queries) calls it at module load time, so any test importing `tldraw`
// (even indirectly, e.g. useWhiteboardSync.ts) fails without this stub.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}
