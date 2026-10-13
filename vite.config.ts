/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds to a single self-contained dist/index.html that can be opened offline
// by double-clicking — no server needed, and no data ever leaves the browser.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  test: { environment: 'node' },
});
