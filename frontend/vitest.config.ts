import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // `@testing-library/react` only auto-registers its post-test DOM cleanup when it finds a
    // global `afterEach` -- without this, unmounted trees from earlier tests pile up in the DOM.
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
