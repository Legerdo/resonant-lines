import { defineConfig } from 'vitest/config';

// base './' keeps every asset URL relative so dist/ works on any static HTTP(S) host or sub-path.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2500,
    sourcemap: false,
  },
  server: { port: 5173 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
