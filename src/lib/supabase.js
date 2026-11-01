import { createClient } from '@supabase/supabase-js';

// Solo la llave publica (publishable/anon) llega al navegador. Los permisos los ponen las
// politicas RLS de supabase/migrations; la llave secreta nunca se usa en el cliente.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;
export const BUCKET = 'sponsor-files';
