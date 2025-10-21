import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  root: './src',
  build: {
    outDir: '../dist',
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
