import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, configured, SUPABASE_URL, ORG_LOGOS_BUCKET } from './supabase.js';

// Identidad visual por organizacion. Se resuelve por el primer segmento del path
// (ej. /acme-eventos/#/dashboard -> slug "acme-eventos"), nunca decide permisos -- eso
// lo sigue haciendo RLS con el organization_id real del usuario logueado. Sin prefijo, o
// un slug que no existe, se queda con los valores de siempre (StartCo).
const DEFAULT_FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="#C93D0C"/></svg>')}`;
const DEFAULT = { name: 'StartCo', logoUrl: null, faviconUrl: null, colorPrimary: '#0F1419', colorAccent: '#C93D0C' };
const Ctx = createContext(DEFAULT);
export const useTenant = () => useContext(Ctx);

const slugFromPath = () => window.location.pathname.split('/').filter(Boolean)[0] || null;
const assetUrl = (path) => (path ? `${SUPABASE_URL}/storage/v1/object/public/${ORG_LOGOS_BUCKET}/${path}` : null);

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(DEFAULT);

  useEffect(() => {
    const slug = slugFromPath();
    if (!configured || !slug) return;
    let alive = true;
    supabase.from('organizations_public').select('*').eq('slug', slug).maybeSingle().then(({ data }) => {
      if (!alive || !data) return;
      setTenant({
        name: data.name,
        logoUrl: assetUrl(data.logo_path),
        faviconUrl: assetUrl(data.favicon_path),
        colorPrimary: data.color_primary || DEFAULT.colorPrimary,
        colorAccent: data.color_accent || DEFAULT.colorAccent,
      });
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--tenant-ink', tenant.colorPrimary);
    document.documentElement.style.setProperty('--tenant-accent', tenant.colorAccent);
  }, [tenant.colorPrimary, tenant.colorAccent]);

  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = tenant.faviconUrl || DEFAULT_FAVICON;
  }, [tenant.faviconUrl]);

  return <Ctx.Provider value={tenant}>{children}</Ctx.Provider>;
}
