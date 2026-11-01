import React, { useState } from 'react';
import { TIERS, TIER_VALUES, fmtCOPfull, initialsOf } from '../lib/catalog.js';
import { useStore } from '../lib/store.jsx';
import { supabase } from '../lib/supabase.js';
import { Modal, Input, Select, Button, useBusy } from '../ui.jsx';

export default function NewSponsorModal({ onClose, onCreated }) {
  const { data, run, notify } = useStore();
  const [f, setF] = useState({ name: '', tier: 'Seed', sector: '', contact_name: '', contact_role: '', contact_email: '', contact_phone: '' });
  const [busy, wrap] = useBusy();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = wrap(async () => {
    if (!f.name.trim()) { notify('Escribe el nombre del patrocinador.', 'error'); return; }
    if (f.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contact_email.trim())) { notify('Revisa el email del contacto.', 'error'); return; }
    const row = await run(() => supabase.from('sponsors').insert({
      ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()])),
      event_id: data.event.id, initials: initialsOf(f.name), value_cop: TIER_VALUES[f.tier],
    }).select('id').single(), `${f.name.trim()} quedó creado en Kickoff`);
    if (row?.id) onCreated(row.id);
  });
  return (
    <Modal title="Nuevo patrocinador" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button kind="primary" busy={busy} onClick={save}>Crear patrocinador</Button></>}>
      <Input label="Nombre" value={f.name} onChange={set('name')} autoFocus maxLength={120} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select label="Paquete" value={f.tier} onChange={set('tier')} options={TIERS} />
        <Input label="Sector" value={f.sector} onChange={set('sector')} />
      </div>
      <div className="text-xs text-stone-600">Valor del paquete: <b className="font-mono">{fmtCOPfull(TIER_VALUES[f.tier])}</b> COP sin IVA</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Contacto" value={f.contact_name} onChange={set('contact_name')} />
        <Input label="Cargo" value={f.contact_role} onChange={set('contact_role')} />
        <Input label="Email" type="email" value={f.contact_email} onChange={set('contact_email')} />
        <Input label="Teléfono" value={f.contact_phone} onChange={set('contact_phone')} />
      </div>
      <p className="text-[11px] text-stone-500">El acceso al portal del cliente se crea aparte, con el script de usuarios del README.</p>
    </Modal>
  );
}
