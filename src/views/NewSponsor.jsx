import React, { useState } from 'react';
import { TIERS, TIER_VALUES, fmtCOPfull, initialsOf } from '../lib/catalog.js';
import { useStore, invokeEdge, humanEdgeError } from '../lib/store.jsx';
import { supabase } from '../lib/supabase.js';
import { Modal, Input, Select, Button, useBusy, CredentialsModal } from '../ui.jsx';

export default function NewSponsorModal({ onClose, onCreated }) {
  const { data, run, notify } = useStore();
  const [f, setF] = useState({ name: '', tier: 'Seed', sector: '', contact_name: '', contact_role: '', contact_email: '', contact_phone: '' });
  const [busy, wrap] = useBusy();
  const [creds, setCreds] = useState(null);
  const [createdId, setCreatedId] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = wrap(async () => {
    if (!f.name.trim()) { notify('Escribe el nombre del patrocinador.', 'error'); return; }
    if (f.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contact_email.trim())) { notify('El email del contacto no tiene un formato válido.', 'error'); return; }
    const row = await run(() => supabase.rpc('create_sponsor', {
      p_event_id: data.event.id, p_name: f.name.trim(), p_initials: initialsOf(f.name), p_tier: f.tier, p_value_cop: TIER_VALUES[f.tier],
      p_sector: f.sector.trim(), p_contact_name: f.contact_name.trim(), p_contact_role: f.contact_role.trim(),
      p_contact_email: f.contact_email.trim(), p_contact_phone: f.contact_phone.trim(),
    }), `${f.name.trim()} quedó creado en Kickoff`);
    if (!row?.id) return;
    // El email de contacto arriba es solo un dato del formulario -- para que esa persona
    // pueda entrar al portal hace falta darle acceso de verdad (crear su login), asi que si
    // cargaron un email se lo damos de una en vez de obligar a un segundo paso aparte.
    if (!f.contact_email.trim()) { onCreated(row.id); return; }
    const { data: res, error } = await invokeEdge('org-console', {
      action: 'add_sponsor_contact', sponsor_id: row.id, email: f.contact_email.trim(), full_name: f.contact_name.trim(), title: f.contact_role.trim(),
    });
    if (error) {
      notify(`El patrocinador quedó creado, pero no se pudo dar acceso al portal: ${humanEdgeError(error)}`, 'error');
      onCreated(row.id);
      return;
    }
    setCreatedId(row.id);
    setCreds({ email: res.email, password: res.password });
  });

  if (creds) {
    return (
      <CredentialsModal title="Patrocinador creado" email={creds.email} password={creds.password}
        onClose={() => { setCreds(null); onCreated(createdId); }} />
    );
  }

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
      <p className="text-xs text-stone-500">Si cargas el email, esa persona queda con acceso al portal y vas a ver su clave al crear.</p>
    </Modal>
  );
}
