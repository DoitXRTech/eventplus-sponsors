import React, { useCallback, useEffect, useState } from 'react';
import { LogOut, Sparkles, AlertCircle, CheckCircle2, Pencil, LogIn } from 'lucide-react';
import { supabase, SUPABASE_URL, ORG_LOGOS_BUCKET } from '../lib/supabase.js';
import { humanEdgeError, invokeEdge, leaveOrg } from '../lib/store.jsx';
import { DEFAULT_COLORS } from '../lib/tenant.jsx';
import { Card, Button, Input, FileButton, IconButton, useBusy, CredentialsModal, ColorHint } from '../ui.jsx';
import { isHex, onColor } from '../lib/color.js';
import ChangePasswordCard from './ChangePassword.jsx';

// Panel del admin de plataforma: no pertenece a ninguna organizacion (no tiene fila en
// profiles), asi que vive fuera de StoreProvider/Gate. Las dos acciones (crear organizacion,
// sumar otro admin) pegan a la Edge Function admin-console -- nunca directo a auth.users,
// porque eso necesita la service_role key, que no puede llegar al navegador.

function Banner({ banner }) {
  if (!banner) return null;
  const err = banner.kind === 'error';
  return (
    <div className={`px-4 py-3 rounded-xl text-sm flex items-start gap-2.5 ${err ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
      {err ? <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />}
      <div className="whitespace-pre-line">{banner.text}</div>
    </div>
  );
}

function OrgLogo({ org }) {
  const accent = isHex(org.color_accent) ? org.color_accent : DEFAULT_COLORS.colorAccent;
  if (org.logo_path) return <img src={`${SUPABASE_URL}/storage/v1/object/public/${ORG_LOGOS_BUCKET}/${org.logo_path}`} alt={org.name} className="w-10 h-10 rounded-lg object-contain border cream-border bg-white flex-shrink-0" />;
  return (
    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-display flex-shrink-0" style={{ background: accent, color: onColor(accent) }}>
      {org.name[0]}
    </div>
  );
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

function FaviconPreview({ url, name }) {
  if (url) return <img src={url} alt={`Favicon de ${name}`} className="w-6 h-6 rounded border cream-border bg-white flex-shrink-0" />;
  return <div className="w-6 h-6 rounded border cream-border bg-stone-100 flex-shrink-0" />;
}

function OrgEditForm({ org, onCancel, onSaved }) {
  const [f, setF] = useState({ name: org.name, slug: org.slug, color_primary: org.color_primary || DEFAULT_COLORS.colorPrimary, color_accent: org.color_accent || DEFAULT_COLORS.colorAccent });
  const [logoPath, setLogoPath] = useState(org.logo_path);
  const [faviconPath, setFaviconPath] = useState(org.favicon_path);
  const [busy, wrap] = useBusy();
  const [logoBusy, wrapLogo] = useBusy();
  const [faviconBusy, wrapFavicon] = useBusy();
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = wrap(async () => {
    setError('');
    if (!f.name.trim() || !f.slug.trim()) { setError('Nombre y slug no pueden quedar vacíos.'); return; }
    const { error: err } = await invokeEdge('admin-console', { action: 'update_org', id: org.id, name: f.name.trim(), slug: f.slug.trim(), color_primary: f.color_primary, color_accent: f.color_accent });
    if (err) { setError(humanEdgeError(err)); return; }
    onSaved();
  });

  const uploadAsset = (action, onPath) => async (file) => {
    setError('');
    if (file.size > 5 * 1024 * 1024) { setError('El archivo pesa más de 5 MB.'); return; }
    const dataBase64 = await fileToBase64(file);
    const { data, error: err } = await invokeEdge('admin-console', { action, id: org.id, filename: file.name, contentType: file.type, dataBase64 });
    if (err) { setError(humanEdgeError(err)); return; }
    onPath(action === 'upload_org_logo' ? data.organization.logo_path : data.organization.favicon_path);
  };
  const uploadLogo = wrapLogo(uploadAsset('upload_org_logo', setLogoPath));
  const uploadFavicon = wrapFavicon(uploadAsset('upload_org_favicon', setFaviconPath));

  const logoUrl = logoPath ? `${SUPABASE_URL}/storage/v1/object/public/${ORG_LOGOS_BUCKET}/${logoPath}` : null;
  const faviconUrl = faviconPath ? `${SUPABASE_URL}/storage/v1/object/public/${ORG_LOGOS_BUCKET}/${faviconPath}` : null;

  return (
    <div className="py-3 space-y-3 border-b cream-border">
      <div className="flex items-center gap-2.5">
        <OrgLogo org={{ ...org, logo_path: logoPath }} />
        <div className="text-sm ink">Editando <b>{org.name}</b></div>
      </div>
      {error && <div className="text-xs text-red-700 flex items-center gap-1.5"><AlertCircle size={12} /> {error}</div>}
      <div className="flex flex-wrap gap-4">
        <div>
          <span className="block text-xs font-medium text-stone-600 mb-1">Logo</span>
          <FileButton accept="image/*" busy={logoBusy} size="sm" onFile={uploadLogo}>{logoUrl ? 'Cambiar logo' : 'Subir logo'}</FileButton>
        </div>
        <div>
          <span className="block text-xs font-medium text-stone-600 mb-1">Favicon</span>
          <div className="flex items-center gap-2">
            <FaviconPreview url={faviconUrl} name={org.name} />
            <FileButton accept="image/*" busy={faviconBusy} size="sm" onFile={uploadFavicon}>{faviconUrl ? 'Cambiar' : 'Subir'}</FileButton>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Input label="Nombre" value={f.name} onChange={set('name')} />
        <Input label="Slug" value={f.slug} onChange={set('slug')} />
      </div>
      <div className="grid grid-cols-2 gap-2.5 max-w-xs">
        <label className="block">
          <span className="block text-xs font-medium text-stone-600 mb-1">Color principal</span>
          <input type="color" value={f.color_primary} onChange={set('color_primary')} className="w-full h-8 rounded-lg border cream-border" />
          <ColorHint color={f.color_primary} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-stone-600 mb-1">Color de acento</span>
          <input type="color" value={f.color_accent} onChange={set('color_accent')} className="w-full h-8 rounded-lg border cream-border" />
          <ColorHint color={f.color_accent} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button kind="primary" size="sm" busy={busy} onClick={save}>Guardar</Button>
        <Button size="sm" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

const goToOrg = (org) => window.location.assign(`/${org.slug}/`);

// La cuenta del admin tiene UN solo perfil temporal (start_impersonation hace upsert por id):
// si entrara a una segunda organizacion, cualquier pestaña que siguiera en la primera
// empezaria a cargar los datos de la segunda. Por eso: una organizacion a la vez, en esta
// misma pestaña, y para entrar a otra primero hay que salir de la actual.
function ActiveOrgCard({ org, userId, onLeft }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const leave = async () => {
    setBusy(true); setError('');
    const err = await leaveOrg(userId);
    setBusy(false);
    if (err) { setError('No se pudo salir de la organización. Intenta de nuevo.'); return; }
    onLeft();
  };
  return (
    <Card className="p-5 border-amber-200 bg-amber-50/60 space-y-3">
      <div className="flex items-center gap-3">
        <OrgLogo org={org} />
        <div className="min-w-0 flex-1">
          <div className="text-sm ink">Estás dentro de <b>{org.name}</b></div>
          <div className="text-xs text-stone-600">Para entrar a otra organización, primero sal de esta.</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button kind="dark" size="sm" Icon={LogIn} onClick={() => goToOrg(org)}>Volver a {org.name}</Button>
        <Button size="sm" busy={busy} onClick={leave}>Salir de {org.name}</Button>
      </div>
      {error && <div className="text-xs text-red-700 flex items-center gap-1.5"><AlertCircle size={12} /> {error}</div>}
    </Card>
  );
}

function OrgsList({ orgs, loading, onChanged, activeOrg, checkActive }) {
  const [editing, setEditing] = useState(null);
  const [impersonating, setImpersonating] = useState(null);
  const [impError, setImpError] = useState(null);

  const impersonate = async (org) => {
    setImpError(null);
    if (activeOrg?.id === org.id) { goToOrg(org); return; }
    // Se vuelve a mirar en el servidor: este panel pudo quedar abierto en otra pestaña
    // mientras el admin entraba a una organizacion.
    const current = await checkActive();
    if (current && current.id !== org.id) {
      setImpError({ id: org.id, text: `Ya estás dentro de ${current.name}. Sal de esa primero.` });
      return;
    }
    const ok = window.confirm(
      `Vas a entrar a "${org.name}" como parte de su equipo, con tu misma cuenta de admin.\nSe abre en esta pestaña. Para volver a este panel, usa "Salir y volver al panel" arriba de todo.\n\n¿Continuar?`,
    );
    if (!ok) return;
    setImpersonating(org.id);
    const { error } = await invokeEdge('admin-console', { action: 'start_impersonation', organization_id: org.id });
    if (error) { setImpersonating(null); setImpError({ id: org.id, text: humanEdgeError(error) }); return; }
    goToOrg(org);
  };

  return (
    <Card className="p-5">
      <div className="font-display text-lg ink mb-3">Organizaciones</div>
      {loading && <div className="text-sm text-stone-500">Cargando…</div>}
      {!loading && orgs.length === 0 && <div className="text-sm text-stone-500">Todavía no hay ninguna.</div>}
      {!loading && orgs.length > 0 && (
        <div>
          {orgs.map((o) => (
            editing === o.id ? (
              <OrgEditForm key={o.id} org={o} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />
            ) : (
              <div key={o.id} className="py-2.5 border-b cream-border last:border-0">
                <div className="flex items-center gap-3">
                  <OrgLogo org={o} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm ink truncate">{o.name}</div>
                    <div className="text-xs text-stone-500 font-mono truncate">/{o.slug}</div>
                    {o.team.length > 0
                      ? <div className="text-xs text-stone-500 truncate mt-0.5">{o.team.map((t) => t.email).join(', ')}</div>
                      : <div className="text-xs text-stone-400 italic mt-0.5">Sin usuarios de equipo</div>}
                  </div>
                  <IconButton Icon={LogIn}
                    label={activeOrg?.id === o.id ? `Volver a ${o.name}` : activeOrg ? `Sal de ${activeOrg.name} para entrar a ${o.name}` : `Entrar a ${o.name}`}
                    disabled={impersonating === o.id || Boolean(activeOrg && activeOrg.id !== o.id)} onClick={() => impersonate(o)} />
                  <button onClick={() => setEditing(o.id)} aria-label={`Editar ${o.name}`} title="Editar"
                    className="w-8 h-8 rounded-full hover:bg-stone-100 inline-flex items-center justify-center flex-shrink-0"><Pencil size={14} className="text-stone-600" /></button>
                </div>
                {impError?.id === o.id && (
                  <div className="text-xs text-red-700 flex items-center gap-1.5 mt-1.5"><AlertCircle size={12} /> {impError.text}</div>
                )}
              </div>
            )
          ))}
        </div>
      )}
    </Card>
  );
}

function NewOrgForm({ onDone }) {
  const [f, setF] = useState({
    name: '', slug: '', eventName: '', city: '', venue: '', start: '', end: '', teamEmail: '', teamName: '',
  });
  const [busy, wrap] = useBusy();
  const [banner, setBanner] = useState(null);
  const [creds, setCreds] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = wrap(async () => {
    setBanner(null);
    if (!f.name.trim() || !f.slug.trim() || !f.eventName.trim() || !f.start || !f.end || !f.teamEmail.trim()) {
      setBanner({ kind: 'error', text: 'Completa nombre, slug, evento, fechas y el email del primer usuario de equipo.' });
      return;
    }
    const { data, error } = await invokeEdge('admin-console', {
      action: 'create_org',
      name: f.name.trim(),
      slug: f.slug.trim(),
      event: { name: f.eventName.trim(), city: f.city.trim(), venue: f.venue.trim(), start: f.start, end: f.end },
      team: { email: f.teamEmail.trim(), name: f.teamName.trim() },
    });
    if (error) {
      setBanner({ kind: 'error', text: `No se pudo crear: ${humanEdgeError(error)}` });
      return;
    }
    setBanner({ kind: 'ok', text: `Organización "${data.organization.name}" creada.` });
    setCreds({ email: data.team.email, password: data.team.password });
    setF({ name: '', slug: '', eventName: '', city: '', venue: '', start: '', end: '', teamEmail: '', teamName: '' });
    onDone();
  });

  return (
    <Card className="p-5 space-y-3">
      <div className="font-display text-lg ink">Nueva organización</div>
      {creds && <CredentialsModal email={creds.email} password={creds.password} onClose={() => setCreds(null)} />}
      <Banner banner={banner} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Nombre de la organización" value={f.name} onChange={set('name')} placeholder="Acme Eventos" />
        <Input label="Slug (único, sin espacios)" value={f.slug} onChange={set('slug')} placeholder="acme-eventos" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="Nombre del evento" value={f.eventName} onChange={set('eventName')} placeholder="Evento 2027" />
        <Input label="Ciudad" value={f.city} onChange={set('city')} />
        <Input label="Lugar" value={f.venue} onChange={set('venue')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Fecha de inicio" type="date" value={f.start} onChange={set('start')} />
        <Input label="Fecha de fin" type="date" value={f.end} onChange={set('end')} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Email del primer usuario de equipo" type="email" value={f.teamEmail} onChange={set('teamEmail')} placeholder="nombre@organizacion.com" />
        <Input label="Nombre de esa persona" value={f.teamName} onChange={set('teamName')} />
      </div>
      <Button kind="primary" busy={busy} onClick={submit}>Crear organización</Button>
    </Card>
  );
}

function NewAdminForm() {
  const [f, setF] = useState({ email: '', name: '' });
  const [busy, wrap] = useBusy();
  const [banner, setBanner] = useState(null);
  const [creds, setCreds] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = wrap(async () => {
    setBanner(null);
    if (!f.email.trim()) { setBanner({ kind: 'error', text: 'Escribe un email.' }); return; }
    const { data, error } = await invokeEdge('admin-console', { action: 'add_platform_admin', email: f.email.trim(), full_name: f.name.trim() });
    if (error) {
      setBanner({ kind: 'error', text: `No se pudo sumar: ${humanEdgeError(error)}` });
      return;
    }
    setBanner({ kind: 'ok', text: `${data.email} ya es admin de plataforma.` });
    setCreds({ email: data.email, password: data.password });
    setF({ email: '', name: '' });
  });

  return (
    <Card className="p-5 space-y-3">
      <div className="font-display text-lg ink">Sumar admin de plataforma</div>
      <p className="text-xs text-stone-500">Ve y crea organizaciones, no pertenece a ninguna. Dale este acceso solo a quien de verdad lo necesite.</p>
      {creds && <CredentialsModal email={creds.email} password={creds.password} onClose={() => setCreds(null)} />}
      <Banner banner={banner} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Email" type="email" value={f.email} onChange={set('email')} />
        <Input label="Nombre" value={f.name} onChange={set('name')} />
      </div>
      <Button kind="dark" busy={busy} onClick={submit}>Sumar admin</Button>
    </Card>
  );
}

export default function AdminConsole({ email, userId }) {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeOrg, setActiveOrg] = useState(null);

  // En que organizacion esta "dentro" el admin ahora (su perfil temporal), o null.
  const checkActive = useCallback(async () => {
    const { data: prof } = await supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
    let org = null;
    if (prof?.organization_id) {
      const { data } = await supabase.from('organizations').select('id, name, slug, logo_path, color_accent').eq('id', prof.organization_id).maybeSingle();
      org = data;
    }
    setActiveOrg(org);
    return org;
  }, [userId]);
  useEffect(() => {
    checkActive();
    // Si sale (o entra) desde otra pestaña, al volver a esta se entera.
    const onFocus = () => document.visibilityState === 'visible' && checkActive();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => { document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('focus', onFocus); };
  }, [checkActive]);

  const loadOrgs = async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await invokeEdge('admin-console', { action: 'list_orgs' });
    if (error) setLoadError(error);
    setOrgs(data?.organizations || []);
    setLoading(false);
  };
  useEffect(() => { loadOrgs(); }, []);

  return (
    <div className="min-h-dvh font-body" style={{ background: '#F5F2EC' }}>
      <header className="bg-white/80 backdrop-blur sticky top-0 z-30 border-b cream-border px-4 sm:px-8 py-4 flex items-center gap-3">
        <div className="w-8 h-8 accent-bg rounded-md flex items-center justify-center"><Sparkles size={16} strokeWidth={2.4} /></div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg leading-tight ink">Admin de plataforma</div>
          <div className="text-[13px] text-stone-500 truncate">{email ? `Conectado como ${email}` : 'Alta de organizaciones'}</div>
        </div>
        <Button Icon={LogOut} onClick={() => supabase.auth.signOut()}>Salir</Button>
      </header>
      <main className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
        {loadError && <Banner banner={{ kind: 'error', text: `No se pudieron cargar las organizaciones: ${humanEdgeError(loadError)}` }} />}
        {activeOrg && <ActiveOrgCard org={activeOrg} userId={userId} onLeft={() => setActiveOrg(null)} />}
        <OrgsList orgs={orgs} loading={loading} onChanged={loadOrgs} activeOrg={activeOrg} checkActive={checkActive} />
        <NewOrgForm onDone={loadOrgs} />
        <NewAdminForm />
        <ChangePasswordCard />
      </main>
    </div>
  );
}
