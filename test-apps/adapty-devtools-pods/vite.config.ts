import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// src/ is a symlink to examples/adapty-devtools/src. preserveSymlinks resolves its imports from
// this app — its node_modules and its .adapty-credentials.json — instead of the devtools'.
export default defineConfig({
  plugins: [react()],
  root: './src',
  resolve: { preserveSymlinks: true },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    minify: false,
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '!**/node_modules/@adapty/capacitor/**'],
    },
  },
  optimizeDeps: {
    exclude: ['@adapty/capacitor'],
  },
});
