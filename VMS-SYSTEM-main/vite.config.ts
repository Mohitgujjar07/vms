import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Expose to LAN for mobile access (192.168.x.x)
    strictPort: false,
    watch: {
      ignored: ['**/android/**', '**/dist/**']
    },
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-XSS-Protection': '1; mode=block',
      'Permissions-Policy': 'camera=(self), microphone=()',
    },
  },
  build: {
    // Split stable vendor libraries into cacheable chunks so app-code
    // redeployments don't re-download them.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('qrcode')) return 'vendor-qrcode';
          return undefined;
        },
      },
    },
  },
});
