import React, { useCallback, useEffect, useState } from 'react';
import { Check, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useStore, humanEdgeError, invokeEdge } from '../lib/store.jsx';
import { supabase, SUPABASE_URL, ORG_LOGOS_BUCKET } from '../lib/supabase.js';
import { Card, Input, Button, Avatar, Pill, FileButton, useBusy, CredentialsModal } from '../ui.jsx';
import ChangePasswordCard from './ChangePassword.jsx';

const DEFAULT_COLORS = { color_primary: '#0F1419', color_accent: '#C93D0C' };

function TeamCard() {
  const { data, reload } = useStore();
  const team = data.profiles.filter((p) => p.kind === 'team');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ email: '', full_name: '' });
  const [busy, wrap] = useBusy();
  const [msg, setMsg] = useState(null);
  const [creds, setCreds] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = wrap(async () => {
    setMsg(null);
    if (!f.email.trim()) { setMsg({ kind: 'error', text: 'Escribe un email.' }); return; }
    const { data: res, error } = await invokeEdge('org-console', { action: 'add_team_member', email: f.email.trim(), full_name: f.full_name.trim() });
    if (error) { setMsg({ kind: 'error', text: `No se pudo agregar: ${humanEdgeError(error)}` }); return; }
    setMsg({ kind: 'ok', text: `${res.email} ya es parte del equipo.` });
    setCreds({ email: res.email, password: res.password });
    setF({ email: '', full_name: '' });
    reload();
  });

  return (
    <Card className="p-5 sm:p-6 space-y-3">
      <div className="font-display text-lg ink">Equipo</div>
      {creds && <CredentialsModal email={creds.email} password={creds.password} onClose={() => setCreds(null)} />}
      <div className="space-y-3">
        {team.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <Avatar name={p.full_name} color="#0F1419" />
            <div className="min-w-0"><div className="text-sm ink truncate">{p.full_name}</div><div className="text-xs text-stone-500 truncate">{p.title}</div></div>
          </div>
        ))}
      </div>
      {msg && (
        <div className={`text-xs flex items-start gap-1.5 whitespace-pre-line ${msg.kind === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
          {msg.kind === 'error' ? <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" />} {msg.text}
        </div>
      )}
      {adding ? (
        <div className="space-y-2.5 pt-2 border-t cream-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input label="Email" type="email" value={f.email} onChange={set('email')} autoFocus />
            <Input label="Nombre" value={f.full_name} onChange={set('full_name')} />
          </div>
          <div className="flex gap-2">
            <Button kind="primary" size="sm" busy={busy} onClick={submit}>Agregar</Button>
            <Button size="sm" onClick={() => { setAdding(false); setMsg(null); }}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={() => setAdding(true)}>+ Agregar persona</Button>
      )}
    </Card>
  );
}

function BrandCard() {
  const { me, notify } = useStore();
  const [org, setOrg] = useState(null);
  const [busy, wrap] = useBusy();

  const load = useCallback(async () => {
    const { data } = await supabase.from('organizations').select('*').eq('id', me.organization_id).single();
    setOrg(data);
  }, [me.organization_id]);
  useEffect(() => { load(); }, [load]);
  if (!org) return null;

  const logoUrl = org.logo_path ? `${SUPABASE_URL}/storage/v1/object/public/${ORG_LOGOS_BUCKET}/${org.logo_path}` : null;
  const faviconUrl = org.favicon_path ? `${SUPABASE_URL}/storage/v1/object/public/${ORG_LOGOS_BUCKET}/${org.favicon_path}` : null;

  const uploadAsset = (folder, column, label) => wrap(async (file) => {
    if (file.size > 5 * 1024 * 1024) { notify('El archivo pesa más de 5 MB.', 'error'); return; }
    const path = `${org.id}/${folder}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, '_')}`;
    const { error: upErr } = await supabase.storage.from(ORG_LOGOS_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upErr) { notify(`No se pudo subir el ${label}.`, 'error'); return; }
    const { error } = await supabase.from('organizations').update({ [column]: path }).eq('id', org.id);
    if (error) { notify(`No se pudo guardar el ${label}.`, 'error'); return; }
    notify(`${label[0].toUpperCase()}${label.slice(1)} actualizado`);
    load();
  });
  const uploadLogo = uploadAsset('logo', 'logo_path', 'logo');
  const uploadFavicon = uploadAsset('favicon', 'favicon_path', 'favicon');

  // onChange solo actualiza la vista mientras arrastra el selector; el guardado real pasa
  // en onBlur (una sola escritura cuando cierra el selector), no en cada pixel que mueve.
  const previewColor = (k) => (e) => setOrg({ ...org, [k]: e.target.value });
  const saveColor = (k) => wrap(async (e) => {
    const { error } = await supabase.from('organizations').update({ [k]: e.target.value }).eq('id', org.id);
    if (error) notify('No se pudo guardar el color.', 'error');
  });

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      <div>
        <div className="font-display text-lg ink">Marca</div>
        <div className="text-xs text-stone-500">Logo y colores de {org.name} en el login y el panel.</div>
      </div>
      <div className="flex items-center gap-3">
        {logoUrl
          ? <img src={logoUrl} alt={org.name} className="w-14 h-14 rounded-lg object-contain border cream-border bg-white" />
          : <div className="w-14 h-14 rounded-lg accent-bg flex items-center justify-center text-white font-display text-lg">{org.name[0]}</div>}
        <FileButton accept="image/*" busy={busy} onFile={uploadLogo}>{logoUrl ? 'Cambiar logo' : 'Subir logo'}</FileButton>
      </div>
      <div className="flex items-center gap-3">
        {faviconUrl
          ? <img src={faviconUrl} alt={`Favicon de ${org.name}`} className="w-8 h-8 rounded border cream-border bg-white" />
          : <div className="w-8 h-8 rounded border cream-border bg-stone-100" />}
        <FileButton accept="image/*" busy={busy} onFile={uploadFavicon}>{faviconUrl ? 'Cambiar favicon' : 'Subir favicon'}</FileButton>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-stone-600 mb-1">Color principal</span>
          <input type="color" value={org.color_primary || DEFAULT_COLORS.color_primary} onChange={previewColor('color_primary')} onBlur={saveColor('color_primary')} className="w-full h-9 rounded-lg border cream-border" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-stone-600 mb-1">Color de acento</span>
          <input type="color" value={org.color_accent || DEFAULT_COLORS.color_accent} onChange={previewColor('color_accent')} onBlur={saveColor('color_accent')} className="w-full h-9 rounded-lg border cream-border" />
        </label>
      </div>
      <p className="text-xs text-stone-500">Se ven al entrar por <code className="font-mono">/{org.slug}/</code> delante de la URL.</p>
    </Card>
  );
}

export default function SettingsView() {
  const { data, run, notify } = useStore();
  const ev = data.event;
  const [f, setF] = useState({ name: ev?.name || '', city: ev?.city || '', venue: ev?.venue || '', start_date: ev?.start_date || '', end_date: ev?.end_date || '' });
  const [busy, wrap] = useBusy();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = wrap(async () => {
    if (!f.name.trim() || !f.start_date || !f.end_date) { notify('El evento necesita nombre y fechas.', 'error'); return; }
    if (f.end_date < f.start_date) { notify('La fecha de cierre no puede ser antes del inicio.', 'error'); return; }
    await run(() => supabase.from('events').update({ ...f, name: f.name.trim(), city: f.city.trim(), venue: f.venue.trim() }).eq('id', ev.id), 'Evento actualizado');
  });
  const integrations = [
    { name: 'HubSpot', desc: 'Prospectos y contactos de ventas', ok: false },
    { name: 'Correo', desc: 'Avisos por correo a los patrocinadores', ok: false },
  ];
  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
      <Card className="p-5 sm:p-6 space-y-3 lg:row-span-2">
        <div className="font-display text-lg ink">Evento</div>
        <Input label="Nombre" value={f.name} onChange={set('name')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Ciudad" value={f.city} onChange={set('city')} />
          <Input label="Lugar" value={f.venue} onChange={set('venue')} />
          <Input label="Inicio" type="date" value={f.start_date} onChange={set('start_date')} />
          <Input label="Cierre" type="date" value={f.end_date} onChange={set('end_date')} />
        </div>
        <div className="pt-2"><Button kind="primary" busy={busy} onClick={save}>Guardar evento</Button></div>
      </Card>
      <TeamCard />
      <BrandCard />
      <ChangePasswordCard />
      <Card className="p-5 sm:p-6">
        <div className="font-display text-lg ink mb-3">Integraciones</div>
        <div className="space-y-3">
          {integrations.map((i) => (
            <div key={i.name} className="flex items-start gap-3">
              <div className="flex-1 min-w-0"><div className="text-sm ink">{i.name}</div><div className="text-xs text-stone-500">{i.desc}</div></div>
              {i.ok ? <Pill bg="#D4E5DB" color="#1B4332"><Check size={10} /> Conectado</Pill> : <Pill bg="#F1ECDF" color="#6B5F4F"><X size={10} /> Sin conectar</Pill>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
