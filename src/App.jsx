import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Users, ClipboardCheck, ExternalLink, Settings, Search, Plus, Layers, Sparkles, LogOut, Menu, X, Loader2, AlertCircle,
} from 'lucide-react';
import { supabase, configured } from './lib/supabase.js';
import { StoreProvider, useStore } from './lib/store.jsx';
import { stripDiacritics } from './lib/catalog.js';
import { Button, Input, SponsorLogo, Toast } from './ui.jsx';
import Dashboard from './views/Dashboard.jsx';
import PipelineKanban from './views/Pipeline.jsx';
import SponsorsList from './views/SponsorsList.jsx';
import SponsorDetail from './views/SponsorDetail.jsx';
import ApprovalsView from './views/Approvals.jsx';
import ClientPortal from './views/Portal.jsx';
import SettingsView from './views/Settings.jsx';
import NewSponsorModal from './views/NewSponsor.jsx';

/* ---------- Navegacion por hash (#/sponsor/<id>) para que recargar no pierda la vista ---------- */
const parseHash = () => {
  const [name = 'dashboard', id, tab] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { name: name || 'dashboard', id, tab };
};
function useHashView() {
  const [view, setViewState] = useState(parseHash);
  useEffect(() => {
    const on = () => setViewState(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const setView = (v, { keepScroll = false } = {}) => {
    window.location.hash = `/${v.name}${v.id ? `/${v.id}` : ''}${v.id && v.tab ? `/${v.tab}` : ''}`;
    if (!keepScroll) window.scrollTo(0, 0);
  };
  return [view, setView];
}

/* ---------- Login ---------- */
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(/invalid/i.test(err.message) ? 'Email o clave incorrectos.' : 'No se pudo entrar. Intenta de nuevo.');
  };
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 font-body" style={{ background: '#F5F2EC' }}>
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border cream-border p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 accent-bg rounded-md flex items-center justify-center"><Sparkles size={16} className="text-white" strokeWidth={2.4} /></div>
          <div>
            <div className="font-display text-xl leading-tight ink">StartCo</div>
            <div className="text-[13px] text-stone-500">Patrocinios 2026</div>
          </div>
        </div>
        <div>
          <h1 className="font-display text-2xl ink">Inicia sesión</h1>
          <p className="text-sm text-stone-600 mt-1">Usa el email y la clave que te dio StartCo.</p>
        </div>
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Clave" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-sm text-red-700 flex items-center gap-1.5"><AlertCircle size={14} /> {error}</div>}
        <button type="submit" disabled={busy} className="w-full accent-bg text-white rounded-full py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy && <Loader2 size={14} className="animate-spin" />} Entrar
        </button>
        <p className="text-xs text-stone-500">¿No tienes acceso? Escríbele a tu contacto en StartCo.</p>
      </form>
    </div>
  );
}

const Centered = ({ children }) => (
  <div className="min-h-dvh flex items-center justify-center p-6 font-body text-center" style={{ background: '#F5F2EC' }}>
    <div className="max-w-md space-y-3">{children}</div>
  </div>
);

/* ---------- Sidebar (fijo en escritorio, cajon en movil) ---------- */
function Sidebar({ view, setView, open, onClose }) {
  const { data, me } = useStore();
  const pending = data.sponsors.reduce((n, s) => n + s.pendingApprovals, 0);
  const items = [
    { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { key: 'pipeline', label: 'Pipeline', Icon: Layers },
    { key: 'sponsors', label: 'Patrocinadores', Icon: Users },
    { key: 'approvals', label: 'Aprobaciones', Icon: ClipboardCheck, badge: pending || null },
    { key: 'portal', label: 'Portal del cliente', Icon: ExternalLink },
  ];
  const go = (name) => { setView({ name }); onClose(); };
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside className={`w-64 lg:w-60 ink-bg text-stone-200 flex flex-col h-dvh fixed lg:sticky top-0 left-0 z-50 lg:z-auto transition-transform
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="px-5 pt-6 pb-4 border-b border-white/5 flex items-center gap-2">
          <div className="w-8 h-8 accent-bg rounded-md flex items-center justify-center"><Sparkles size={16} className="text-white" strokeWidth={2.4} /></div>
          <div className="flex-1">
            <div className="font-display text-lg leading-tight text-white">StartCo</div>
            <div className="text-[13px] text-stone-400">Patrocinios 2026</div>
          </div>
          <button className="lg:hidden text-stone-400 hover:text-white p-1" onClick={onClose} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
          {items.map(({ key, label, Icon, badge }) => (
            <button key={key} onClick={() => go(key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${view.name === key || (key === 'sponsors' && view.name === 'sponsor') ? 'bg-white/10 text-white' : 'text-stone-400 hover:bg-white/5 hover:text-white'}`}>
              <Icon size={16} strokeWidth={1.8} />
              <span className="flex-1 text-left">{label}</span>
              {badge && <span className="text-xs accent-bg text-white px-1.5 rounded-full font-semibold min-w-[18px] text-center">{badge}</span>}
            </button>
          ))}
          <button onClick={() => go('settings')}
            className={`mt-4 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${view.name === 'settings' ? 'bg-white/10 text-white' : 'text-stone-400 hover:bg-white/5 hover:text-white'}`}>
            <Settings size={16} strokeWidth={1.8} /><span>Configuración</span>
          </button>
        </nav>
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full accent-bg flex items-center justify-center text-white text-xs font-semibold">
              {me.full_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{me.full_name}</div>
              <div className="text-xs text-stone-400 truncate">{me.title}</div>
            </div>
            <button onClick={() => supabase.auth.signOut()} title="Salir" aria-label="Salir"
              className="w-8 h-8 rounded-full hover:bg-white/10 inline-flex items-center justify-center"><LogOut size={16} className="text-stone-300" /></button>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ---------- Topbar con busqueda real de patrocinadores ---------- */
function Topbar({ title, subtitle, actions, setView, onMenu }) {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const n = stripDiacritics(q.trim());
    if (!n) return [];
    return data.sponsors.filter((s) => [s.name, s.contact_name, s.sector, s.tier].some((f) => stripDiacritics(f).includes(n))).slice(0, 6);
  }, [q, data.sponsors]);
  return (
    <header className="bg-white/80 backdrop-blur sticky top-0 z-30 border-b cream-border">
      <div className="px-4 sm:px-8 py-4 sm:py-5 flex flex-wrap items-center gap-3 sm:gap-6">
        <button className="lg:hidden -ml-1 p-1.5 rounded-md hover:bg-stone-100" onClick={onMenu} aria-label="Abrir menú"><Menu size={20} /></button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl ink leading-none">{title}</h1>
          {subtitle && <div className="text-sm text-stone-600 mt-1">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar patrocinador, contacto…" aria-label="Buscar"
              onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) { setView({ name: 'sponsor', id: results[0].id }); setQ(''); } if (e.key === 'Escape') setQ(''); }}
              className="pl-9 pr-4 py-2 bg-stone-100 rounded-full text-sm w-full md:w-72 outline-none focus:bg-white focus:ring-2 focus:ring-stone-900/10 transition-colors" />
            {q.trim() && (
              <div className="absolute right-0 left-0 mt-2 bg-white border cream-border rounded-xl shadow-lg overflow-hidden z-40">
                {results.length === 0 && <div className="px-4 py-3 text-sm text-stone-500">Sin resultados</div>}
                {results.map((s) => (
                  <button key={s.id} onClick={() => { setView({ name: 'sponsor', id: s.id }); setQ(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-stone-50 flex items-center gap-2.5">
                    <SponsorLogo sponsor={s} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm ink truncate">{s.name}</div>
                      <div className="text-xs text-stone-500 truncate">{s.contact_name} · {s.tier}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {actions}
        </div>
      </div>
    </header>
  );
}

/* ---------- Shell del equipo ---------- */
function TeamApp() {
  const { data } = useStore();
  const [view, setView] = useHashView();
  const [menu, setMenu] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const ev = data.event;

  if (view.name === 'portal') {
    const id = view.id && data.byId[view.id] ? view.id : data.sponsors[0]?.id;
    return <ClientPortal id={id} preview setView={setView} />;
  }
  const fmtRange = ev ? `${new Date(`${ev.start_date}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric' })} y ${new Date(`${ev.end_date}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '')} · ${ev.city}` : '';
  const titles = {
    dashboard: { title: 'Dashboard', sub: `${ev?.name || 'Evento'} · ${data.sponsors.length} patrocinadores confirmados · ${fmtRange}` },
    pipeline: { title: 'Pipeline', sub: 'En qué etapa va cada patrocinador confirmado' },
    sponsors: { title: 'Patrocinadores', sub: 'Todos los patrocinadores y su estado actual' },
    approvals: { title: 'Aprobaciones', sub: 'Piezas esperando la aprobación del cliente y cambios pedidos' },
    settings: { title: 'Configuración', sub: 'Evento, equipo e integraciones' },
  };
  const t = titles[view.name];
  const newBtn = ['sponsors', 'pipeline'].includes(view.name) && (
    <Button kind="primary" size="sm" Icon={Plus} onClick={() => setNewOpen(true)} className="flex-shrink-0">Nuevo patrocinador</Button>
  );
  return (
    <div className="flex min-h-dvh font-body" style={{ background: '#F5F2EC' }}>
      <Sidebar view={view} setView={setView} open={menu} onClose={() => setMenu(false)} />
      <div className="flex-1 min-w-0">
        {t
          ? <Topbar title={t.title} subtitle={t.sub} actions={newBtn} setView={setView} onMenu={() => setMenu(true)} />
          : (
            <div className="lg:hidden bg-white border-b cream-border px-4 py-3 flex items-center gap-2 sticky top-0 z-30">
              <button className="p-1.5 -ml-1 rounded-md hover:bg-stone-100" onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu size={20} /></button>
              <span className="font-display ink">StartCo Patrocinios</span>
            </div>
          )}
        {view.name === 'dashboard' && <Dashboard setView={setView} />}
        {view.name === 'pipeline' && <PipelineKanban setView={setView} />}
        {view.name === 'sponsors' && <SponsorsList setView={setView} />}
        {view.name === 'sponsor' && <SponsorDetail key={view.id} id={view.id} tab={view.tab} setView={setView} />}
        {view.name === 'approvals' && <ApprovalsView setView={setView} />}
        {view.name === 'settings' && <SettingsView />}
        {!t && view.name !== 'sponsor' && <Dashboard setView={setView} />}
      </div>
      {newOpen && <NewSponsorModal onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); setView({ name: 'sponsor', id }); }} />}
    </div>
  );
}

function Gate() {
  const { loading, error, data, me, isTeam, reload } = useStore();
  if (loading) return <Centered><Loader2 className="animate-spin mx-auto text-stone-500" /><p className="text-sm text-stone-600">Cargando…</p></Centered>;
  if (error) return (
    <Centered>
      <h1 className="font-display text-2xl ink">No se pudieron cargar los datos</h1>
      <p className="text-sm text-stone-600">Revisa tu conexión a internet e intenta de nuevo.</p>
      <div className="flex justify-center gap-2"><Button kind="dark" onClick={reload}>Reintentar</Button><Button onClick={() => supabase.auth.signOut()}>Salir</Button></div>
    </Centered>
  );
  if (!me) return (
    <Centered>
      <h1 className="font-display text-2xl ink">Tu cuenta todavía no tiene acceso</h1>
      <p className="text-sm text-stone-600">Tu cuenta todavía no está asociada a un patrocinio. Escríbele a tu contacto en StartCo para activarla.</p>
      <Button onClick={() => supabase.auth.signOut()}>Salir</Button>
    </Centered>
  );
  if (isTeam) return <TeamApp />;
  const sponsor = data.byId[me.sponsor_id];
  if (!sponsor) return (
    <Centered>
      <h1 className="font-display text-2xl ink">No encontramos tu patrocinio</h1>
      <p className="text-sm text-stone-600">Escríbele a tu contacto en StartCo para revisarlo.</p>
      <Button onClick={() => supabase.auth.signOut()}>Salir</Button>
    </Centered>
  );
  return <ClientPortal id={sponsor.id} />;
}

export default function App() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!configured) return (
    <Centered>
      <h1 className="font-display text-2xl ink">Falta configurar Supabase</h1>
      <p className="text-sm text-stone-600">Define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (ver README) y vuelve a compilar.</p>
    </Centered>
  );
  if (session === undefined) return <Centered><Loader2 className="animate-spin mx-auto text-stone-500" /></Centered>;
  if (!session) return <Login />;
  return (
    <StoreProvider key={session.user.id} session={session}>
      <Gate />
      <Toast />
    </StoreProvider>
  );
}
