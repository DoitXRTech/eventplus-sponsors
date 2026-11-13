import React, { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { Card, Input, Button, useBusy } from '../ui.jsx';

// Cambiar la clave propia: supabase.auth.updateUser() actua sobre la sesion actual, ningun
// backend propio hace falta (GoTrue ya expone esto para cualquier usuario autenticado).
// Lo usan los 3 tipos de cuenta (equipo, patrocinador, admin de plataforma) por igual.
export default function ChangePasswordCard({ className = '' }) {
  const [f, setF] = useState({ password: '', confirm: '' });
  const [busy, wrap] = useBusy();
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = wrap(async () => {
    setMsg(null);
    if (f.password.length < 8) { setMsg({ kind: 'error', text: 'La clave necesita al menos 8 caracteres.' }); return; }
    if (f.password !== f.confirm) { setMsg({ kind: 'error', text: 'Las dos claves no coinciden.' }); return; }
    const { error } = await supabase.auth.updateUser({ password: f.password });
    if (error) { setMsg({ kind: 'error', text: 'No se pudo cambiar la clave. Intenta de nuevo.' }); return; }
    setMsg({ kind: 'ok', text: 'Clave actualizada.' });
    setF({ password: '', confirm: '' });
  });

  return (
    <Card className={`p-5 sm:p-6 space-y-3 ${className}`}>
      <div className="font-display text-lg ink">Mi clave</div>
      {msg && (
        <div className={`text-xs flex items-center gap-1.5 ${msg.kind === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
          {msg.kind === 'error' ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />} {msg.text}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Clave nueva" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />
        <Input label="Repetir clave nueva" type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} />
      </div>
      <Button kind="primary" size="sm" busy={busy} onClick={save}>Cambiar clave</Button>
    </Card>
  );
}
