import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: './src/index.tsx',
      name: 'AppointmentChatbot',
      formats: ['iife'],
      fileName: () => 'chatbot.js',
    },
    rollupOptions: {
      output: {
        globals: {},
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
    minify: 'esbuild',
  },
});
