import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// In dev, the web app talks to the party server through Vite's proxy,
// so there are no cross-origin headaches.
export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/snapshots': 'http://localhost:8787',
      '/party': { target: 'ws://localhost:8787', ws: true }
    }
  }
});
