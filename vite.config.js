import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En local (npm run dev con VITE_SUPABASE_URL=http://localhost:5173) el proxy imita el
// gateway de Supabase: /rest/v1 a PostgREST, /auth/v1 a GoTrue y
// /storage/v1 a local/storage.mjs. Ver local/README.md.
const local = {
  '/rest/v1': { target: 'http://localhost:3011', rewrite: (p) => p.replace(/^\/rest\/v1/, '') },
  '/auth/v1': { target: 'http://localhost:9999', rewrite: (p) => p.replace(/^\/auth\/v1/, '') },
  '/storage/v1': { target: 'http://localhost:5002' },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: local },
  preview: { port: 4173, strictPort: true, proxy: local },
  build: {
    sourcemap: false,
    target: 'es2020',
    rollupOptions: { output: { banner: '/*! (c) 2026 EventPlus. All rights reserved. */' } },
  },
});
