import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['tests/helpers/env.ts'],
    // Integration tests share one database; run files one at a time.
    fileParallelism: false,
  },
});
