import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, configured, SUPABASE_URL, ORG_LOGOS_BUCKET } from './supabase.js';
import { isHex, isLight, onColor, readableText, mutedOn, shadeOn } from './color.js';

// Identidad visual por organizacion. Antes de loguearse se resuelve por el primer segmento
// del path (ej. /acme-eventos/#/dashboard -> slug "acme-eventos"); despues del login manda
// la organizacion real del usuario (StoreProvider llama a applyOrg con su fila), aunque la
// URL diga otra cosa. Nunca decide permisos -- eso lo sigue haciendo RLS.
//
// Sin prefijo, o con un slug que no existe, no hay organizacion: name queda en null y la
// UI usa textos genericos ("tu compañía") y una paleta neutra. Ninguna organizacion es
// la de por defecto.
export const DEFAULT_COLORS = { colorPrimary: '#0F1419', colorAccent: '#475569' };
const DEFAULT = { name: null, slug: null, logoUrl: null, faviconUrl: null, ...DEFAULT_COLORS };
const defaultFavicon = (color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="${color}"/></svg>`)}`;

const Ctx = createContext(DEFAULT);
const ApplyCtx = createContext(() => {});
export const useTenant = () => useContext(Ctx);
export const useApplyOrg = () => useContext(ApplyCtx);

export const slugFromPath = () => window.location.pathname.split('/').filter(Boolean)[0] || null;
const assetUrl = (path) => (path ? `${SUPABASE_URL}/storage/v1/object/public/${ORG_LOGOS_BUCKET}/${path}` : null);
const fromRow = (row) => ({
  name: row.name,
  slug: row.slug,
  logoUrl: assetUrl(row.logo_path),
  faviconUrl: assetUrl(row.favicon_path),
  colorPrimary: isHex(row.color_primary) ? row.color_primary.trim() : DEFAULT.colorPrimary,
  colorAccent: isHex(row.color_accent) ? row.color_accent.trim() : DEFAULT.colorAccent,
});

// Variables CSS de marca (las usa src/index.css). Los colores elegidos se usan tal cual como
// fondo; el texto encima y la version "para leer" sobre fondos claros se calculan por
// contraste, para que un color claro (ej. celeste) no deje textos ilegibles.
export function brandVars(ink, accent) {
  const inkLight = isLight(ink);
  return {
    '--tenant-ink': ink,
    // 7:1 y no 4.5: es el color de titulos y nombres en toda la app, que el diseño pensó casi negros.
    '--tenant-ink-text': readableText(ink, undefined, 7),
    '--tenant-on-ink': onColor(ink),
    '--tenant-on-ink-muted': mutedOn(ink),
    '--tenant-on-ink-line': inkLight ? 'rgba(15,20,25,.10)' : 'rgba(255,255,255,.06)',
    '--tenant-on-ink-overlay': shadeOn(ink, 0.1),
    '--tenant-on-ink-overlay-soft': shadeOn(ink, 0.05),
    '--tenant-accent': accent,
    '--tenant-accent-text': readableText(accent),
    '--tenant-on-accent': onColor(accent),
  };
}
const same = (a, b) => Object.keys(DEFAULT).every((k) => a[k] === b[k]);

// Deja la URL apuntando a la organizacion del usuario (solo cambia el primer segmento,
// conserva hash y query) para que recargar o cerrar sesion muestre su marca y no la del
// link por el que entro.
function syncPathSlug(slug) {
  if (!slug || slugFromPath() === slug) return;
  const rest = window.location.pathname.split('/').filter(Boolean).slice(1);
  const path = `/${[slug, ...rest].join('/')}/`;
  window.history.replaceState(window.history.state, '', `${path}${window.location.search}${window.location.hash}`);
}

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(DEFAULT);

  useEffect(() => {
    const slug = slugFromPath();
    if (!configured || !slug) return;
    let alive = true;
    supabase.from('organizations_public').select('*').eq('slug', slug).maybeSingle().then(({ data }) => {
      if (!alive || !data) return;
      setTenant((t) => (t.slug && t.slug !== slug ? t : fromRow(data)));
    });
    return () => { alive = false; };
  }, []);

  // La organizacion del usuario logueado pisa a la de la URL. Se llama en cada recarga
  // de datos: si nada cambio no re-renderiza; si cambio (otra org, o editaron la marca en
  // Configuracion) se actualiza sola.
  const applyOrg = useCallback((row) => {
    if (!row) return;
    const next = fromRow(row);
    setTenant((t) => (same(t, next) ? t : next));
    syncPathSlug(row.slug);
  }, []);

  useEffect(() => {
    const vars = brandVars(tenant.colorPrimary, tenant.colorAccent);
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }, [tenant.colorPrimary, tenant.colorAccent]);

  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = tenant.faviconUrl || defaultFavicon(tenant.colorAccent);
  }, [tenant.faviconUrl, tenant.colorAccent]);

  useEffect(() => {
    document.title = tenant.name ? `${tenant.name} Patrocinios` : 'Patrocinios';
  }, [tenant.name]);

  return (
    <ApplyCtx.Provider value={applyOrg}>
      <Ctx.Provider value={tenant}>{children}</Ctx.Provider>
    </ApplyCtx.Provider>
  );
}
