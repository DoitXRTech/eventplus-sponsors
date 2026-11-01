import React, { useMemo, useState } from 'react';
import { Paperclip, Send, Lock, Trash2, Plus, Upload, Download, Search, CheckCircle2, Circle, Trophy } from 'lucide-react';
import { DAY_LABELS, ATTENDEE_STATUS, stripDiacritics } from '../lib/catalog.js';
import { useStore, uploadFile, relDay, fmtTime, fmtSize, fmtDate, humanError } from '../lib/store.jsx';
import { supabase } from '../lib/supabase.js';
import { Pill, Avatar, Button, IconButton, Input, Select, Modal, FileButton, DownloadButton, Empty, useBusy } from '../ui.jsx';

export const CONTEXTS = [
  { value: '', label: 'Sin contexto' },
  { value: 'arte', label: 'Pieza o arte' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'apadrinamiento', label: 'Apadrinamiento' },
  { value: 'propuesta', label: 'Propuesta' },
  { value: 'compromiso', label: 'Compromiso' },
];

/* ---------- Conversacion ---------- */
export function Conversation({ sponsor, readOnly = false, maxHeight = '' }) {
  const { me, isTeam, run, notify } = useStore();
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [ctx, setCtx] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, wrap] = useBusy();

  const groups = useMemo(() => {
    const out = [];
    for (const c of sponsor.comments) {
      const k = relDay(c.created_at);
      if (!out.length || out[out.length - 1].k !== k) out.push({ k, items: [] });
      out[out.length - 1].items.push(c);
    }
    return out;
  }, [sponsor.comments]);

  const send = wrap(async () => {
    const text = body.trim();
    if (!text) { notify('Escribe un mensaje.', 'error'); return; }
    let attachment = {};
    if (file) {
      try {
        attachment = { attachment_path: await uploadFile(sponsor.id, 'chat', file), attachment_name: file.name, attachment_size: file.size };
      } catch (e) { notify(humanError(e), 'error'); return; }
    }
    const ok = await run(() => supabase.from('comments').insert({
      sponsor_id: sponsor.id, author_id: me.id, author_name: me.full_name, author_role: me.title,
      team: isTeam ? 'startco' : 'sponsor', body: text, internal: isTeam && internal,
      context_kind: ctx || null, context_label: ctx ? CONTEXTS.find((c) => c.value === ctx).label : null, ...attachment,
    }), internal ? 'Nota interna guardada' : 'Mensaje enviado');
    if (ok) { setBody(''); setFile(null); setCtx(''); setInternal(false); }
  });

  return (
    <div className="flex flex-col min-w-0">
      <div className={`space-y-5 ${maxHeight} overflow-y-auto scrollbar-thin pr-1`}>
        {groups.length === 0 && <Empty>Todavía no hay mensajes.</Empty>}
        {groups.map((g) => (
          <div key={g.k}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400 text-center mb-3 first-letter:uppercase">{g.k}</div>
            <div className="space-y-3">
              {g.items.map((c) => {
                const mine = c.author_id === me.id;
                const startco = c.team === 'startco';
                return (
                  <div key={c.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                    <Avatar name={c.author_name} size={8} color={startco ? '#0F1419' : '#FF5A1F'} />
                    <div className={`max-w-[85%] sm:max-w-[75%] min-w-0 ${mine ? 'items-end text-right' : ''}`}>
                      <div className="text-[11px] text-stone-500 mb-1">
                        <span className="font-medium text-stone-700">{c.author_name}</span>{c.author_role ? ` · ${c.author_role}` : ''} · {fmtTime(c.created_at)}
                      </div>
                      <div className={`inline-block text-left px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words
                        ${c.internal ? 'bg-amber-50 border border-amber-200 text-amber-950' : mine ? 'ink-bg text-white' : 'bg-stone-100 text-stone-900'}`}>
                        {c.internal && <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 inline-flex items-center gap-1"><Lock size={10} /> Nota interna</div>}
                        {c.context_label && <div className={`text-[10px] mb-1 ${mine && !c.internal ? 'text-stone-300' : 'text-stone-500'}`}>Sobre: {c.context_label}</div>}
                        <div>{c.body}</div>
                        {c.attachment_path && (
                          <div className={`mt-2 flex items-center gap-2 text-xs rounded-lg px-2 py-1 ${mine && !c.internal ? 'bg-white/10' : 'bg-white'}`}>
                            <Paperclip size={12} /> <span className="truncate flex-1">{c.attachment_name}</span> <span className="opacity-60">{fmtSize(c.attachment_size)}</span>
                            <DownloadButton path={c.attachment_path} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-5 border cream-border rounded-xl bg-white p-3">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={4000}
            placeholder={internal ? 'Nota solo para el equipo StartCo' : 'Escribe un mensaje'} aria-label="Mensaje"
            className="w-full text-sm outline-none resize-y bg-transparent" />
          {file && (
            <div className="text-xs text-stone-700 flex items-center gap-2 mb-2"><Paperclip size={12} /> {file.name} <span className="text-stone-400">{fmtSize(file.size)}</span>
              <button className="text-red-700 hover:underline" onClick={() => setFile(null)}>Quitar</button></div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <FileButton size="sm" Icon={Paperclip} onFile={setFile}>Adjuntar</FileButton>
            <select value={ctx} onChange={(e) => setCtx(e.target.value)} aria-label="Contexto del mensaje" className="px-2 py-1.5 text-xs border cream-border rounded-full bg-white outline-none">
              {CONTEXTS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {isTeam && (
              <label className="inline-flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> <Lock size={11} /> Nota interna
              </label>
            )}
            <Button kind={internal ? 'dark' : 'primary'} size="sm" Icon={Send} busy={busy} onClick={send} className="ml-auto">Enviar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Inscritos ---------- */
const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita que Excel lo ejecute como formula
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  const src = text.replace(/^\uFEFF/, '');
  const sep = (src.split('\n')[0].match(/;/g) || []).length > (src.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

const DAY_FROM_TEXT = (t) => {
  const s = stripDiacritics(t);
  if (/1|uno|primer/.test(s) && !/2|dos|ambos/.test(s)) return 'd1';
  if (/2|dos|segundo/.test(s) && !/1|uno|ambos/.test(s)) return 'd2';
  return 'both';
};

export function rowsToAttendees(rows) {
  if (!rows.length) return [];
  const head = rows[0].map(stripDiacritics);
  const hasHeader = head.some((h) => /email|correo|nombre|name/.test(h));
  const col = (re, def) => { const i = head.findIndex((h) => re.test(h)); return hasHeader ? i : def; };
  const iName = col(/nombre|name/, 0), iEmail = col(/email|correo|mail/, 1), iRole = col(/cargo|rol|role|puesto/, 2), iDay = col(/dia|day/, 3);
  return (hasHeader ? rows.slice(1) : rows).map((r) => ({
    name: (r[iName] || '').slice(0, 120), email: (r[iEmail] || '').toLowerCase(), role: iRole >= 0 ? (r[iRole] || '').slice(0, 120) : '',
    day: iDay >= 0 ? DAY_FROM_TEXT(r[iDay] || '') : 'both',
  }));
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function AddAttendeeModal({ sponsor, onClose }) {
  const { run, notify } = useStore();
  const [f, setF] = useState({ name: '', email: '', role: '', day: 'both' });
  const [busy, wrap] = useBusy();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = wrap(async () => {
    if (!f.name.trim()) { notify('Escribe el nombre.', 'error'); return; }
    if (!EMAIL_RE.test(f.email.trim())) { notify('Revisa el email: no tiene un formato válido.', 'error'); return; }
    const ok = await run(() => supabase.from('attendees').insert({ sponsor_id: sponsor.id, name: f.name.trim(), email: f.email.trim().toLowerCase(), role: f.role.trim(), day: f.day, status: 'invitado' }), `${f.name.trim()} quedó inscrito`);
    if (ok) onClose();
  });
  return (
    <Modal title="Agregar asistente" onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button kind="primary" busy={busy} onClick={save}>Agregar</Button></>}>
      <Input label="Nombre" value={f.name} onChange={set('name')} autoFocus />
      <Input label="Email" type="email" value={f.email} onChange={set('email')} />
      <Input label="Cargo" value={f.role} onChange={set('role')} />
      <Select label="Días" value={f.day} onChange={set('day')} options={Object.entries(DAY_LABELS).map(([value, label]) => ({ value, label }))} />
    </Modal>
  );
}

export function AttendeesPanel({ sponsor, readOnly = false }) {
  const { data, run, notify, reload } = useStore();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, wrap] = useBusy();
  const ev = data.event;
  const left = Math.max(sponsor.ticketCap - sponsor.inscritos, 0);
  const nq = stripDiacritics(q.trim());
  const list = sponsor.attendees.filter((a) => !nq || stripDiacritics(`${a.name} ${a.email} ${a.role}`).includes(nq));
  const d1 = sponsor.attendees.filter((a) => a.day !== 'd2').length;
  const d2 = sponsor.attendees.filter((a) => a.day !== 'd1').length;
  const dayLabel = (d) => {
    if (!ev) return DAY_LABELS[d];
    if (d === 'd1') return `Día 1 · ${fmtDate(ev.start_date)}`;
    if (d === 'd2') return `Día 2 · ${fmtDate(ev.end_date)}`;
    return 'Ambos días';
  };

  const importCsv = wrap(async (file) => {
    let rows;
    try { rows = rowsToAttendees(parseCsv(await file.text())); } catch { notify('No se pudo leer el archivo. Usa un CSV.', 'error'); return; }
    const seen = new Set(sponsor.attendees.map((a) => a.email.toLowerCase()));
    let invalid = 0, dup = 0;
    const fresh = [];
    for (const r of rows) {
      if (!r.name.trim() || !EMAIL_RE.test(r.email)) { invalid++; continue; }
      if (seen.has(r.email)) { dup++; continue; }
      seen.add(r.email); fresh.push({ ...r, sponsor_id: sponsor.id, status: 'invitado' });
    }
    const batch = fresh.slice(0, left);
    const over = fresh.length - batch.length;
    let added = 0, failed = 0;
    if (batch.length) {
      const { error } = await supabase.from('attendees').insert(batch);
      if (!error) added = batch.length;
      else {
        // Si el lote falla (otro usuario inscribio en paralelo, cupo justo), se reintenta fila por fila.
        for (const r of batch) { const { error: e } = await supabase.from('attendees').insert(r); if (e) failed++; else added++; }
      }
    }
    await reload();
    const parts = [`${added} ${added === 1 ? 'inscrito' : 'inscritos'}`];
    if (dup) parts.push(`${dup} ya estaban`);
    if (invalid) parts.push(`${invalid} sin nombre o email válido`);
    if (over) parts.push(`${over} fuera de cupo`);
    if (failed) parts.push(`${failed} con error`);
    notify(parts.join(', '), added ? 'ok' : 'error');
  });

  const exportCsv = () => {
    const lines = [['Nombre', 'Email', 'Cargo', 'Días', 'Estado'], ...sponsor.attendees.map((a) => [a.name, a.email, a.role, DAY_LABELS[a.day], ATTENDEE_STATUS[a.status]])];
    const blob = new Blob(['﻿' + lines.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inscritos-${stripDiacritics(sponsor.name).replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[[`${sponsor.inscritos}/${sponsor.ticketCap}`, 'Inscritos'], [d1, dayLabel('d1')], [d2, dayLabel('d2')]].map(([v, l]) => (
          <div key={l} className="rounded-xl border cream-border bg-white p-3 sm:p-4 min-w-0">
            <div className="font-display text-xl sm:text-2xl ink">{v}</div>
            <div className="text-[11px] text-stone-500 truncate">{l}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar asistente" aria-label="Buscar asistente"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border cream-border rounded-full outline-none focus:border-stone-400" />
        </label>
        {!readOnly && <Button size="sm" kind="primary" Icon={Plus} disabled={left === 0} onClick={() => setAdding(true)}>Agregar</Button>}
        {!readOnly && <FileButton size="sm" Icon={Upload} accept=".csv,text/csv" busy={busy} disabled={left === 0} onFile={importCsv}>Importar CSV</FileButton>}
        <Button size="sm" Icon={Download} disabled={!sponsor.attendees.length} onClick={exportCsv}>Exportar</Button>
      </div>
      {!readOnly && <p className="text-[11px] text-stone-500">{left === 0 ? 'El paquete ya no tiene cupos libres.' : `Quedan ${left} cupos. El CSV lleva columnas nombre, email, cargo y día; los repetidos se saltan.`}</p>}
      {list.length === 0 ? <Empty>{sponsor.attendees.length ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay inscritos.'}</Empty> : (
        <div className="rounded-xl border cream-border bg-white divide-y divide-stone-100">
          {list.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <Avatar name={a.name} size={8} />
              <div className="flex-1 min-w-[140px]">
                <div className="text-sm ink truncate">{a.name}</div>
                <div className="text-[11px] text-stone-500 truncate">{a.email}{a.role ? ` · ${a.role}` : ''}</div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto pl-11 sm:pl-0">
              <span className="text-[11px] text-stone-600 flex-1 sm:flex-none">{DAY_LABELS[a.day]}</span>
              {readOnly ? <Pill bg="#F1ECDF" color="#7A6E5D">{ATTENDEE_STATUS[a.status]}</Pill> : (
                <select value={a.status} aria-label={`Estado de ${a.name}`}
                  onChange={(e) => run(() => supabase.from('attendees').update({ status: e.target.value }).eq('id', a.id), 'Estado actualizado')}
                  className="px-2 py-1 text-xs border cream-border rounded-full bg-white outline-none">
                  {Object.entries(ATTENDEE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
              {!readOnly && <IconButton Icon={Trash2} label={`Quitar a ${a.name}`} onClick={() => window.confirm(`¿Quitar a ${a.name} de los inscritos?`) && run(() => supabase.from('attendees').delete().eq('id', a.id), `${a.name} ya no está inscrito`)} />}
              </div>
            </div>
          ))}
        </div>
      )}
      {adding && <AddAttendeeModal sponsor={sponsor} onClose={() => setAdding(false)} />}
    </div>
  );
}

/* ---------- Startups apadrinadas ---------- */
export function StartupsPanel({ sponsor, readOnly = false }) {
  const { run, notify } = useStore();
  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [busy, wrap] = useBusy();
  const left = sponsor.startupCap - sponsor.startups.length;
  const add = wrap(async () => {
    if (!name.trim()) { notify('Escribe el nombre de la startup.', 'error'); return; }
    const ok = await run(() => supabase.from('sponsored_startups').insert({ sponsor_id: sponsor.id, name: name.trim().slice(0, 120), sector: sector.trim().slice(0, 80) }), `${name.trim()} quedó apadrinada`);
    if (ok) { setName(''); setSector(''); }
  });
  if (sponsor.startupCap === 0) return <p className="text-sm text-stone-600">Este paquete no incluye apadrinamientos.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-stone-700"><Trophy size={14} /> {sponsor.startups.length} de {sponsor.startupCap} startups apadrinadas</div>
      {sponsor.startups.map((s) => (
        <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border cream-border bg-white">
          <div className="flex-1 min-w-0"><div className="text-sm ink truncate">{s.name}</div><div className="text-[11px] text-stone-500">{s.sector || 'Sin sector'}</div></div>
          {!readOnly && <IconButton Icon={Trash2} label={`Quitar ${s.name}`} onClick={() => window.confirm(`¿Dejar de apadrinar a ${s.name}?`) && run(() => supabase.from('sponsored_startups').delete().eq('id', s.id), `${s.name} ya no está apadrinada`)} />}
        </div>
      ))}
      {!readOnly && left > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Input className="flex-1" placeholder="Nombre de la startup" aria-label="Nombre de la startup" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="sm:w-40" placeholder="Sector" aria-label="Sector" value={sector} onChange={(e) => setSector(e.target.value)} />
          <Button kind="primary" Icon={Plus} busy={busy} onClick={add}>Agregar</Button>
        </div>
      )}
    </div>
  );
}

/* ---------- Compromisos del paquete ---------- */
export function CommitmentsList({ sponsor, canEdit = false, limit }) {
  const { run } = useStore();
  const [all, setAll] = useState(!limit);
  const items = sponsor.commitmentList;
  const shown = all ? items : items.slice(0, limit);
  const toggle = (c) => {
    const done = !sponsor.done[c.key];
    run(() => supabase.from('commitment_status').upsert({ sponsor_id: sponsor.id, commitment_key: c.key, done, done_at: done ? new Date().toISOString() : null }, { onConflict: 'sponsor_id,commitment_key' }),
      done ? `"${c.name}" marcado como cumplido` : `"${c.name}" vuelve a pendiente`);
  };
  const doneCount = items.filter((c) => sponsor.done[c.key]).length;
  return (
    <div>
      <div className="text-sm text-stone-600 mb-3">{doneCount} de {items.length} cumplidos</div>
      <div className="space-y-1">
        {shown.map((c) => {
          const done = Boolean(sponsor.done[c.key]);
          const Icon = done ? CheckCircle2 : Circle;
          const inner = (
            <>
              <Icon size={16} className={`flex-shrink-0 mt-0.5 ${done ? 'text-emerald-700' : 'text-stone-300'}`} />
              <span className="flex-1 min-w-0">
                <span className={`text-sm ${done ? 'text-stone-500' : 'ink'}`}>{c.name}</span>
                <span className="block text-[11px] text-stone-500">{c.cat}{typeof c.value === 'number' ? ` · ${c.value} ${c.unit || ''}` : ''}{done ? ` · cumplido el ${fmtDate(sponsor.done[c.key])}` : ''}</span>
              </span>
            </>
          );
          return canEdit
            ? <button key={c.key} onClick={() => toggle(c)} className="w-full text-left flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-stone-50">{inner}</button>
            : <div key={c.key} className="flex items-start gap-2.5 px-2 py-2">{inner}</div>;
        })}
      </div>
      {limit && items.length > limit && (
        <button onClick={() => setAll(!all)} className="mt-2 text-xs accent-text font-medium">{all ? 'Ver menos' : `Ver los ${items.length}`}</button>
      )}
    </div>
  );
}

