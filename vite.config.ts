import path from 'path';
import { defineConfig } from 'vite';

/**
 * AI Studio Full-Stack Vite Configuration
 *
 * Note: Do NOT expose process.env.GEMINI_API_KEY in a client `define` block.
 * All Gemini Managed Agent calls (/v1beta/interactions) run server-side via
 * server.ts and server/agent-client.js using phantom-gdemo-1.
 */
export default defineConfig({
  base: './',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true'
  }
});
