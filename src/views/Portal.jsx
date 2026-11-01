import React, { useState } from 'react';
import { LogOut, ArrowLeft, Eye, ClipboardCheck, CheckCircle2, MessageSquare, FileText, Image as ImageIcon, Calendar } from 'lucide-react';
import { ASSET_STATUS } from '../lib/catalog.js';
import { useStore, daysUntil, fmtDate, daysSince } from '../lib/store.jsx';
import { supabase } from '../lib/supabase.js';
import { Card, Pill, TierPill, Button, Textarea, DownloadButton, Empty, useBusy } from '../ui.jsx';
import { Conversation, AttendeesPanel, StartupsPanel, CommitmentsList } from './panels.jsx';
import { DocumentList } from './docs.jsx';
import { LogoUploader } from './SponsorDetail.jsx';

// Aprobar o pedir cambios (piezas y propuesta). Pedir cambios exige la nota.
function Decision({ onDecide, readOnly, approveLabel = 'Aprobar', approveValue = 'aprobado' }) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, wrap] = useBusy();
  if (readOnly) return <span className="text-[11px] text-stone-500">El cliente decide desde aquí.</span>;
  const decide = wrap(async (d) => { const ok = await onDecide(d, note.trim()); if (ok) { setAsking(false); setNote(''); } });
  if (asking) return (
    <div className="w-full space-y-2">
      <Textarea placeholder="Cuéntanos qué hay que cambiar" aria-label="Qué hay que cambiar" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
      <div className="flex gap-2 justify-end">
        <Button size="sm" onClick={() => setAsking(false)}>Cancelar</Button>
        <Button size="sm" kind="dark" busy={busy} disabled={!note.trim()} onClick={() => decide('cambios')}>Enviar cambios</Button>
      </div>
    </div>
  );
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => setAsking(true)}>Pedir cambios</Button>
      <Button size="sm" kind="primary" Icon={CheckCircle2} busy={busy} onClick={() => decide(approveValue)}>{approveLabel}</Button>
    </div>
  );
}

const Section = ({ id, title, sub, children, className = '' }) => (
  <Card id={id} className={`p-5 sm:p-6 scroll-mt-20 ${className}`}>
    <div className="font-display text-lg ink">{title}</div>
    {sub && <div className="text-sm text-stone-600 mb-4">{sub}</div>}
    {!sub && <div className="mb-3" />}
    {children}
  </Card>
);

export default function ClientPortal({ id, preview = false, setView }) {
  const { data, me, run } = useStore();
  const s = data.byId[id];
  const ev = data.event;
  if (!s) return <div className="p-8"><Empty>No encontramos este patrocinio.</Empty></div>;
  const toEvent = daysUntil(ev?.start_date);
  const visible = s.assets.filter((a) => a.status !== 'produccion'); // igual que la regla de acceso del cliente
  const pending = visible.filter((a) => a.status === 'pendiente');
  const approved = visible.filter((a) => a.status === 'aprobado').length;
  const p = s.proposal;
  const firstName = (preview ? s.contact_name : me.full_name).split(' ')[0] || '';
  const reviewAsset = (a) => (d, note) => run(() => supabase.rpc('review_asset', { p_asset: a.id, p_decision: d, p_note: note || null }), d === 'aprobado' ? `Aprobaste "${a.name}"` : 'Enviamos tus cambios al equipo');
  const reviewProposal = (d, note) => run(() => supabase.rpc('review_proposal', { p_proposal: p.id, p_decision: d, p_note: note || null }), d === 'aprobada' ? `Aprobaste la propuesta v${p.version}` : 'Enviamos tus cambios al equipo');
  const scrollTo = (k) => document.getElementById(k)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const PROP = { enviada: 'Por revisar', aprobada: 'Aprobada', cambios: 'Cambios pedidos' };

  return (
    <div className="min-h-screen font-body" style={{ background: '#F5F2EC' }}>
      {preview && (
        <div className="ink-bg text-white px-4 sm:px-8 py-2.5 text-xs flex flex-wrap items-center gap-x-3 gap-y-2">
          <Eye size={14} /> <span className="flex-1 min-w-[180px]">Vista previa del portal de {s.name}: así lo ve el cliente. Solo lectura.</span>
          <select value={s.id} onChange={(e) => setView({ name: 'portal', id: e.target.value })} aria-label="Ver otro patrocinador" className="text-stone-900 px-2 py-1 rounded-full text-xs max-w-[180px]">
            {data.sponsors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button onClick={() => setView({ name: 'sponsor', id: s.id })} className="inline-flex items-center gap-1 underline"><ArrowLeft size={12} /> Volver al panel</button>
        </div>
      )}
      <header className="bg-white border-b cream-border px-4 sm:px-8 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg accent-bg flex items-center justify-center text-white font-display">S</div>
        <div className="flex-1 min-w-0"><div className="font-display ink leading-tight">StartCo</div><div className="text-[11px] text-stone-500 truncate">Portal de {s.name}</div></div>
        {!preview && <Button size="sm" Icon={LogOut} onClick={() => supabase.auth.signOut()}>Salir</Button>}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-4">
        <Card className="p-6 sm:p-8 ink-bg text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,90,31,0.35), transparent 70%)' }} />
          <div className="relative">
            <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-2">{ev?.name}</div>
            <h1 className="font-display text-3xl sm:text-4xl">Hola{firstName ? `, ${firstName}` : ''}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-stone-300">
              <TierPill tier={s.tier} size="lg" />
              {ev && <span className="inline-flex items-center gap-1.5"><Calendar size={14} /> {fmtDate(ev.start_date, { day: 'numeric', month: 'long' })} y {fmtDate(ev.end_date, { day: 'numeric', month: 'long' })} · {ev.venue || ev.city}</span>}
              {toEvent !== null && toEvent >= 0 && <span>Faltan {toEvent} días</span>}
            </div>
          </div>
        </Card>

        {(pending.length > 0 || p?.status === 'enviada') && (
          <Card className="p-5 border-orange-200 bg-orange-50/40 flex flex-col sm:flex-row sm:items-center gap-3">
            <ClipboardCheck size={20} className="accent-text flex-shrink-0" />
            <div className="flex-1 text-sm ink">
              {pending.length > 0 && <span>{pending.length === 1 ? 'Tienes 1 pieza esperando tu aprobación' : `Tienes ${pending.length} piezas esperando tu aprobación`}{p?.status === 'enviada' ? ' y ' : '.'}</span>}
              {p?.status === 'enviada' && <span>{pending.length ? 'una propuesta por revisar.' : 'Tienes una propuesta por revisar.'}</span>}
            </div>
            <Button size="sm" onClick={() => scrollTo(pending.length ? 'aprobaciones' : 'propuesta')}>Revisar ahora</Button>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
          {[
            ['Contrato', s.contract_status],
            ['Propuesta', p ? `v${p.version} · ${PROP[p.status]}` : 'Sin enviar'],
            ['Piezas aprobadas', `${approved} de ${visible.length}`],
            ['Inscritos', `${s.inscritos} de ${s.ticketCap}`],
            ['Startups', s.startupCap ? `${s.startups.length} de ${s.startupCap}` : 'No incluye'],
          ].map(([l, v]) => (
            <div key={l} className="bg-white rounded-xl border cream-border p-3 sm:p-4 min-w-0 last:col-span-2 md:last:col-span-1">
              <div className="text-[10px] uppercase tracking-wider text-stone-500">{l}</div>
              <div className="text-sm ink font-medium mt-1 truncate">{v}</div>
            </div>
          ))}
        </div>

        <Section id="aprobaciones" title="Piezas para aprobar" sub="Lo que nuestro equipo produjo con tu marca. Aprueba o cuéntanos qué cambiar.">
          {visible.length === 0 ? <Empty>Todavía no hay piezas para revisar.</Empty> : (
            <div className="divide-y divide-stone-100">
              {[...pending, ...visible.filter((a) => a.status !== 'pendiente')].map((a) => (
                <div key={a.id} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <ImageIcon size={16} className="text-stone-500 flex-shrink-0" />
                  <div className="flex-1 min-w-[150px]">
                    <div className="text-sm ink">{a.name}</div>
                    <div className="text-[11px] text-stone-500">{a.status === 'pendiente' && a.sent_at ? `Enviada hace ${daysSince(a.sent_at)} d` : a.reviewed_at ? `Revisada el ${fmtDate(a.reviewed_at)}` : ''}</div>
                  </div>
                  <Pill bg={ASSET_STATUS[a.status].bg} color={ASSET_STATUS[a.status].fg}>{ASSET_STATUS[a.status].label}</Pill>
                  <DownloadButton path={a.file_path} label="Ver pieza" />
                  {a.status === 'pendiente' && <Decision readOnly={preview} onDecide={reviewAsset(a)} />}
                  {a.status === 'cambios' && a.review_note && <div className="w-full text-xs text-stone-600 pl-7">Pediste: {a.review_note}</div>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {p && (
          <Section id="propuesta" title={`Propuesta v${p.version}`} sub={`Enviada el ${fmtDate(p.created_at)}${p.author_name ? ` por ${p.author_name}` : ''}`}>
            {p.note && <p className="text-sm text-stone-800 whitespace-pre-wrap mb-3">{p.note}</p>}
            <div className="flex flex-wrap items-center gap-3">
              {p.file_path && <span className="inline-flex items-center gap-1.5 text-sm text-stone-700"><FileText size={14} /> {p.file_name} <DownloadButton path={p.file_path} /></span>}
              {p.status === 'enviada'
                ? <div className="ml-auto"><Decision readOnly={preview} approveLabel="Aprobar propuesta" approveValue="aprobada" onDecide={reviewProposal} /></div>
                : <Pill bg={p.status === 'aprobada' ? '#D4E5DB' : '#FDE2E2'} color={p.status === 'aprobada' ? '#1B4332' : '#B42318'}>{PROP[p.status]}</Pill>}
            </div>
          </Section>
        )}

        <Section id="inscritos" title="Tus invitados al evento" sub={`Tu paquete incluye ${s.ticketCap} entradas de dos días.`}>
          <AttendeesPanel sponsor={s} readOnly={preview} quiet />
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {s.startupCap > 0 && <Section title="Startups que apadrinas"><StartupsPanel sponsor={s} readOnly={preview} /></Section>}
          <Section title="Lo que incluye tu paquete"><CommitmentsList sponsor={s} limit={6} /></Section>
          <Section title="Tu logo"><LogoUploader s={s} readOnly={preview} /></Section>
          <Section title="Documentos legales" sub="RUT y cámara de comercio para el contrato y la factura.">
            <DocumentList sponsor={s} kind="legal" folder="legal" canUpload readOnly={preview} uploadLabel="Subir documento" empty="Todavía no subiste documentos." />
          </Section>
        </div>

        <Section id="conversacion" title="Conversación con StartCo" sub="Escríbenos aquí: el equipo lo ve en su panel.">
          <Conversation sponsor={s} readOnly={preview} maxHeight="max-h-[60vh]" quiet />
        </Section>

        <div className="text-center text-[11px] text-stone-500 py-4 inline-flex w-full justify-center items-center gap-1.5"><MessageSquare size={12} /> ¿Dudas? Escríbenos en la conversación.</div>
      </main>
    </div>
  );
}
