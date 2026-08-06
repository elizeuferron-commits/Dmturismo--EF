import { defineConfig } from 'vite';
import { builtinModules } from 'module';

export default defineConfig({
  build: {
    ssr: 'server.ts',
    outDir: 'dist',
    emptyOutDir: false, // Maintain the client static assets
    rollupOptions: {
      output: {
        entryFileNames: 'server.cjs',
        format: 'cjs',
      },
      external: [
        'express',
        'path',
        'fs',
        'url',
        'vite',
        'firebase-admin',
        'firebase-admin/firestore',
        '@google/genai',
        'ws',
        'dotenv',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
    },
    minify: false,
    sourcemap: true,
  },
});
