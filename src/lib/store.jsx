import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, BUCKET } from './supabase.js';
import { ticketCapacity, startupCapacity, commitmentsForTier } from './catalog.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const DAY = 86400000;
export const daysSince = (ts) => (ts ? Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / DAY)) : 0);
export const daysUntil = (date) => {
  if (!date) return null;
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / DAY);
};
export const fmtDate = (ts, opts = { day: '2-digit', month: 'short' }) => {
  if (!ts) return '';
  const s = String(ts);
  const d = s.length === 10 ? new Date(`${s}T12:00:00`) : new Date(s);
  return d.toLocaleDateString('es-CO', opts).replace('.', '');
};
export const fmtTime = (ts) => new Date(ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
export const fmtSize = (n) => (!n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const relDay = (ts) => {
  const n = daysSince(ts);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Ayer';
  return fmtDate(ts, { weekday: 'long', day: 'numeric', month: 'long' });
};
export const ago = (ts) => {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
};

// Traduce los errores de Postgres/PostgREST a mensajes para la persona.
export function humanError(err) {
  const m = `${err?.message || ''} ${err?.details || ''}`;
  if (m.includes('CUPOS_LLENOS')) return 'Ya están usados todos los cupos del paquete.';
  if (m.includes('APADRINAMIENTOS_LLENOS')) return 'El paquete no incluye más apadrinamientos.';
  if (m.includes('FALTA_NOTA')) return 'Para pedir cambios, cuenta qué hay que cambiar.';
  if (m.includes('NO_ESTA_PENDIENTE')) return 'Esto ya fue revisado. Recarga para ver el estado actual.';
  if (m.includes('VERSION_VIEJA')) return 'Solo se puede revisar la última versión de la propuesta.';
  if (err?.code === '23505' && m.includes('attendees')) return 'Esa persona ya está inscrita (mismo email).';
  if (err?.code === '23505') return 'Ya existe un registro igual.';
  if (err?.code === '23514' && m.includes('email')) return 'Revisa el email: no tiene un formato válido.';
  if (err?.code === '23514') return 'Algún dato no es válido. Revisa el formulario.';
  if (err?.code === '42501' || /row-level security|NO_AUTORIZADO|Unauthorized|not allowed/i.test(m)) return 'No tienes permiso para esta acción.';
  if (/payload too large|exceeded the maximum allowed size/i.test(m)) return 'El archivo pesa más de 25 MB.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión con el servidor. Intenta de nuevo.';
  return 'No se pudo guardar. Intenta de nuevo.';
}

async function fetchAll(table, build = (q) => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(supabase.from(table).select('*')).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const safeName = (name) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);

export async function uploadFile(sponsorId, folder, file) {
  if (file.size > 25 * 1024 * 1024) throw new Error('payload too large');
  const path = `${sponsorId}/${folder}/${Date.now()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return path;
}

// Borra el archivo despues de borrar su fila. Si falla queda huerfano en el bucket, pero
// ninguna pantalla lo referencia: no vale la pena frenar al usuario por eso.
export async function removeFile(path) {
  if (!hasFile(path)) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('No se pudo borrar el archivo', path, error.message);
}

// Los datos de ejemplo traen nombres de archivo pero no archivos: esas rutas no se piden.
export const hasFile = (path) => Boolean(path) && !path.endsWith('/seed-logo');

const urlCache = new Map();
export async function signedUrl(path) {
  const hit = urlCache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error) throw error;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 540000 });
  return data.signedUrl;
}

export function useSignedUrl(path) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (hasFile(path)) signedUrl(path).then((u) => alive && setUrl(u)).catch(() => {});
    return () => { alive = false; };
  }, [path]);
  return url;
}

function shape(raw) {
  const by = (rows) => rows.reduce((m, r) => ((m[r.sponsor_id] ||= []).push(r), m), {});
  const assets = by(raw.assets), startups = by(raw.startups), attendees = by(raw.attendees);
  const comments = by(raw.comments), documents = by(raw.documents), proposals = by(raw.proposals);
  const commitments = by(raw.commitments), activity = by(raw.activity);
  const sponsors = raw.sponsors.map((s) => {
    const sAssets = (assets[s.id] || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const sProposals = (proposals[s.id] || []).sort((a, b) => b.version - a.version);
    const sAttendees = (attendees[s.id] || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return {
      ...s,
      assets: sAssets,
      startups: (startups[s.id] || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
      attendees: sAttendees,
      comments: (comments[s.id] || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
      documents: (documents[s.id] || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      proposals: sProposals,
      proposal: sProposals[0] || null,
      done: Object.fromEntries((commitments[s.id] || []).filter((c) => c.done).map((c) => [c.commitment_key, c.done_at])),
      activity: (activity[s.id] || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      inscritos: sAttendees.length,
      ticketCap: ticketCapacity(s.tier),
      startupCap: startupCapacity(s.tier),
      pending: sAssets.filter((a) => a.status === 'pendiente'),
      pendingApprovals: sAssets.filter((a) => a.status === 'pendiente').length,
      daysInStage: daysSince(s.stage_changed_at),
      commitmentList: commitmentsForTier(s.tier),
    };
  }).sort((a, b) => b.value_cop - a.value_cop || a.name.localeCompare(b.name));
  return { ...raw, sponsors, byId: Object.fromEntries(sponsors.map((s) => [s.id, s])) };
}

export function StoreProvider({ session, children }) {
  const [state, setState] = useState({ loading: true, error: null, data: null, me: null });
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const userId = session.user.id;

  const notify = useCallback((text, kind = 'ok') => {
    clearTimeout(timer.current);
    setToast({ text, kind, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), kind === 'error' ? 6000 : 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      const { data: me, error: meErr } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (meErr) throw meErr;
      if (!me) { setState({ loading: false, error: null, data: null, me: null }); return; }
      const team = me.kind === 'team';
      const [events, sponsors, profiles, assets, startups, attendees, comments, documents, proposals, commitments, activity, prospects] = await Promise.all([
        fetchAll('events'), fetchAll('sponsors'), fetchAll('profiles'), fetchAll('assets'), fetchAll('sponsored_startups'),
        fetchAll('attendees'), fetchAll('comments'), fetchAll('documents'), fetchAll('proposals'), fetchAll('commitment_status'),
        fetchAll('activity', (q) => q.order('created_at', { ascending: false })),
        team ? fetchAll('prospects') : Promise.resolve([]),
      ]);
      const data = shape({ events, sponsors, profiles, assets, startups, attendees, comments, documents, proposals, commitments, activity, prospects });
      data.event = events[0] || null;
      setState({ loading: false, error: null, data, me });
    } catch (error) {
      console.error(error);
      setState((s) => ({ ...s, loading: false, error }));
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Sin tiempo real en el demo: se recarga al volver a la pestana y cada 20 s si esta visible.
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    const iv = setInterval(onFocus, 20000);
    return () => { document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [load]);

  // Ejecuta una accion, muestra el resultado y recarga. Devuelve true si salio bien.
  const run = useCallback(async (fn, okText) => {
    try {
      const res = await fn();
      if (res && res.error) throw res.error;
      if (okText) notify(okText);
      await load();
      return res?.data ?? true;
    } catch (err) {
      console.error(err);
      notify(humanError(err), 'error');
      return false;
    }
  }, [load, notify]);

  const value = useMemo(() => ({ ...state, isTeam: state.me?.kind === 'team', reload: load, run, notify, toast }), [state, load, run, notify, toast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
