import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En local (npm run dev con VITE_SUPABASE_URL=http://localhost:5173) el proxy imita el
// gateway de Supabase: /rest/v1 a PostgREST y /auth/v1 a GoTrue. Ver local/README.md.
const local = {
  '/rest/v1': { target: 'http://localhost:3011', rewrite: (p) => p.replace(/^\/rest\/v1/, '') },
  '/auth/v1': { target: 'http://localhost:9999', rewrite: (p) => p.replace(/^\/auth\/v1/, '') },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: local },
  preview: { port: 4173, strictPort: true, proxy: local },
  build: { sourcemap: false, target: 'es2020' },
});
