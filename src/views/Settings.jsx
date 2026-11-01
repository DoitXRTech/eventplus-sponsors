import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { supabase } from '../lib/supabase.js';
import { Card, Input, Button, Avatar, Pill, useBusy } from '../ui.jsx';

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
  const team = data.profiles.filter((p) => p.kind === 'team');
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
      <Card className="p-5 sm:p-6">
        <div className="font-display text-lg ink mb-3">Equipo StartCo</div>
        <div className="space-y-3">
          {team.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <Avatar name={p.full_name} color="#0F1419" />
              <div className="min-w-0"><div className="text-sm ink truncate">{p.full_name}</div><div className="text-xs text-stone-500 truncate">{p.title}</div></div>
            </div>
          ))}
        </div>
      </Card>
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
