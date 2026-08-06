import tailcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  // Define environment variables to be injected into the client-side build.
  // Note: Sensitive variables (e.g., GEMINI_API_KEY) are intentionally excluded 
  // to maintain server-side security.
  const environmentVars: Record<string, string> = {
    'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || env.GOOGLE_MAPS_PLATFORM_KEY || '')
  };

  Object.keys(env).forEach((key) => {
    if (key.startsWith('VITE_')) {
      environmentVars[`process.env.${key}`] = JSON.stringify(env[key]);
      environmentVars[`import.meta.env.${key}`] = JSON.stringify(env[key]);
    }
  });

  return {
    define: environmentVars,
    plugins: [
      react(), 
      tailcss(),
    ],
    base: '/',
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        { find: '@', replacement: path.resolve(process.cwd(), './src') },
      ],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'recharts'],
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      minify: 'esbuild',
      sourcemap: false,
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 2000,
      reportCompressedSize: false,
      rollupOptions: {
        input: {
          main: 'index.html',
        },
        output: {
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        }
      },
      manifest: true
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
