import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(here, 'index.html'),        // redirects to ./leaderboard.html
        form: resolve(here, 'form.html'),          // retired group-stage form (locked)
        leaderboard: resolve(here, 'leaderboard.html'),
        bracket: resolve(here, 'bracket.html'),
      },
    },
  },
});
