import React, { useState } from 'react';
import {
  ArrowLeft, ExternalLink, CheckCircle2, Circle, MessageSquare, Upload, Send, Trash2, Plus, FileText, Image as ImageIcon, Info, ChevronRight,
} from 'lucide-react';
import { STAGES, CONTRACT_TYPES, CONTRACT_STATUSES, ASSET_STATUS, fmtCOPfull } from '../lib/catalog.js';
import { useStore, uploadFile, removeFile, daysSince, daysUntil, fmtDate, ago, humanError } from '../lib/store.jsx';
import { supabase } from '../lib/supabase.js';
import { Card, Pill, TierPill, SponsorLogo, Button, Input, Select, Textarea, Modal, FileButton, DownloadButton, IconButton, Field, Label, Empty, useBusy } from '../ui.jsx';
import { Conversation, AttendeesPanel, StartupsPanel, CommitmentsList } from './panels.jsx';
import { DocumentList } from './docs.jsx';
import { ACTIVITY_ICON } from './Dashboard.jsx';

const TABS = [
  { key: 'overview', label: 'Resumen' },
  { key: 'comments', label: 'Conversación' },
  { key: 'assets', label: 'Activación' },
  { key: 'attendees', label: 'Inscritos y startups' },
  { key: 'contract', label: 'Contrato' },
  { key: 'proposal', label: 'Propuesta' },
  { key: 'commitments', label: 'Compromisos' },
  { key: 'legal', label: 'Datos legales' },
  { key: 'post', label: 'Post-evento' },
];

const Check = ({ ok, label, detail }) => (
  <div className="flex items-start gap-2.5 py-1.5">
    {ok ? <CheckCircle2 size={16} className="text-emerald-700 flex-shrink-0 mt-0.5" /> : <Circle size={16} className="text-stone-300 flex-shrink-0 mt-0.5" />}
    <div className="min-w-0"><div className={`text-sm ${ok ? 'text-stone-500' : 'ink'}`}>{label}</div>{detail && <div className="text-[11px] text-stone-500">{detail}</div>}</div>
  </div>
);

/* ---------- Encabezado ---------- */
function Header({ s, setView }) {
  const { run } = useStore();
  const idx = STAGES.findIndex((x) => x.key === s.stage);
  const next = STAGES[idx + 1];
  const setStage = (key) => run(() => supabase.from('sponsors').update({ stage: key }).eq('id', s.id), `${s.name} pasó a ${STAGES.find((x) => x.key === key).label}`);
  return (
    <div className="bg-white border-b cream-border px-4 sm:px-8 pt-4 sm:pt-6 pb-5">
      <button onClick={() => setView({ name: 'sponsors' })} className="text-xs text-stone-600 hover:ink inline-flex items-center gap-1 mb-4"><ArrowLeft size={12} /> Patrocinadores</button>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <SponsorLogo sponsor={s} size="xl" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl ink truncate">{s.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-stone-600">
              <TierPill tier={s.tier} /> <span className="font-mono">{fmtCOPfull(s.value_cop)} COP</span> {s.sector && <span>· {s.sector}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={s.stage} onChange={(e) => setStage(e.target.value)} aria-label="Etapa" className="px-3 py-2 text-sm border cream-border rounded-full bg-white outline-none">
            {STAGES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
          </select>
          {next && <Button kind="dark" size="sm" Icon={ChevronRight} onClick={() => setStage(next.key)}>Avanzar a {next.label}</Button>}
          <Button size="sm" Icon={ExternalLink} onClick={() => setView({ name: 'portal', id: s.id })}>Ver portal</Button>
        </div>
      </div>
      <div className="mt-5 flex gap-1" aria-label={`Etapa ${idx + 1} de ${STAGES.length}`}>
        {STAGES.map((st, i) => (
          <div key={st.key} className="flex-1 min-w-0">
            <div className="h-1.5 rounded-full" style={{ background: i <= idx ? st.color : '#E7E2D8' }} />
            <div className={`text-[10px] mt-1.5 truncate hidden sm:block ${i === idx ? 'ink font-medium' : 'text-stone-400'}`}>{st.label}</div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-stone-500 mt-2 sm:hidden">{STAGES[idx]?.label} · {s.daysInStage} d en etapa</div>
    </div>
  );
}

/* ---------- Resumen ---------- */
function Overview({ s, data, go }) {
  const approved = s.assets.filter((a) => a.status === 'aprobado').length;
  const toEvent = daysUntil(data.event?.start_date);
  const last = s.comments.filter((c) => c.team !== 'system').slice(-2);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <Card className="lg:col-span-7 p-5 sm:p-6">
        <div className="font-display text-lg ink mb-3">Hitos</div>
        <Check ok={Boolean(s.logo_path)} label="Logo recibido" />
        <Check ok={s.contract_status === 'Firmado'} label="Contrato firmado" detail={s.contract_signed_at ? `el ${fmtDate(s.contract_signed_at)}` : s.contract_status} />
        <Check ok={s.assets.length > 0 && approved === s.assets.length} label="Piezas aprobadas" detail={`${approved} de ${s.assets.length}`} />
        {s.startupCap > 0 && <Check ok={s.startups.length >= s.startupCap} label="Apadrinamientos completos" detail={`${s.startups.length} de ${s.startupCap}`} />}
        <Check ok={s.inscritos >= s.ticketCap} label="Cupos inscritos" detail={`${s.inscritos} de ${s.ticketCap}`} />
        <Check ok={toEvent !== null && toEvent < 0} label="Evento" detail={toEvent === null ? '' : toEvent >= 0 ? `${fmtDate(data.event.start_date)} · faltan ${toEvent} días` : `fue el ${fmtDate(data.event.start_date)}`} />
      </Card>
      <Card className="lg:col-span-5 p-5 sm:p-6 space-y-4">
        <div className="font-display text-lg ink">Contacto</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nombre" value={s.contact_name} />
          <Field label="Cargo" value={s.contact_role} />
          <Field label="Email" value={s.contact_email} />
          <Field label="Teléfono" value={s.contact_phone} mono />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" Icon={MessageSquare} onClick={() => go('comments')}>Escribir</Button>
          <Button size="sm" Icon={Upload} onClick={() => go('assets')}>Subir pieza</Button>
        </div>
      </Card>
      <Card className="lg:col-span-7 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3"><div className="font-display text-lg ink">Última conversación</div>
          <button onClick={() => go('comments')} className="text-xs accent-text font-medium">Ver todo</button></div>
        {last.length === 0 ? <Empty>Todavía no hay mensajes.</Empty> : last.map((c) => (
          <div key={c.id} className="py-2 border-b cream-border last:border-0">
            <div className="text-[11px] text-stone-500">{c.author_name} · {ago(c.created_at)}{c.internal ? ' · nota interna' : ''}</div>
            <div className="text-sm text-stone-800 line-clamp-3">{c.body}</div>
          </div>
        ))}
      </Card>
      <Card className="lg:col-span-5 p-5 sm:p-6">
        <div className="font-display text-lg ink mb-3">Actividad</div>
        {s.activity.length === 0 ? <Empty>Sin actividad todavía.</Empty> : (
          <div className="space-y-3">
            {s.activity.slice(0, 6).map((a) => {
              const k = ACTIVITY_ICON[a.kind] || { Icon: CheckCircle2, color: '#7A6E5D' };
              return (
                <div key={a.id} className="flex items-start gap-2.5">
                  <k.Icon size={14} style={{ color: k.color }} className="mt-0.5 flex-shrink-0" />
                  <div className="min-w-0"><div className="text-sm text-stone-800">{a.text}</div><div className="text-[11px] text-stone-500">{ago(a.created_at)}{a.actor_name ? ` · ${a.actor_name}` : ''}</div></div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Activacion: piezas y logo ---------- */
function NewAssetModal({ s, onClose }) {
  const { me, run, notify } = useStore();
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [sendNow, setSendNow] = useState(true);
  const [busy, wrap] = useBusy();
  const save = wrap(async () => {
    if (!name.trim()) { notify('Ponle un nombre a la pieza.', 'error'); return; }
    if (sendNow && !file) { notify('Para enviarla a aprobación hace falta el archivo.', 'error'); return; }
    let path = null;
    if (file) { try { path = await uploadFile(s.id, 'piezas', file); } catch (e) { notify(humanError(e), 'error'); return; } }
    const ok = await run(() => supabase.from('assets').insert({
      sponsor_id: s.id, name: name.trim().slice(0, 160), file_path: path, file_name: file?.name || null, created_by: me.id,
      status: sendNow ? 'pendiente' : 'produccion', sent_at: sendNow ? new Date().toISOString() : null,
    }), sendNow ? 'Pieza enviada al cliente para aprobación' : 'Pieza guardada en producción');
    if (ok) onClose();
  });
  return (
    <Modal title="Nueva pieza" onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button kind="primary" busy={busy} onClick={save}>{sendNow ? 'Subir y enviar' : 'Guardar'}</Button></>}>
      <Input label="Nombre de la pieza" placeholder="Ej.: Valla de agradecimiento 3x2 m" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div className="flex items-center gap-2 flex-wrap">
        <FileButton size="sm" Icon={Upload} onFile={setFile}>{file ? 'Cambiar archivo' : 'Elegir archivo'}</FileButton>
        <span className="text-xs text-stone-600 truncate">{file ? file.name : 'Ningún archivo'}</span>
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} /> Enviar al cliente para aprobación ahora</label>
    </Modal>
  );
}

function AssetRow({ a, s }) {
  const { run, notify } = useStore();
  const [busy, wrap] = useBusy();
  const st = ASSET_STATUS[a.status];
  const send = () => {
    if (!a.file_path) { notify('Sube el archivo antes de enviarla.', 'error'); return; }
    run(() => supabase.from('assets').update({ status: 'pendiente', sent_at: new Date().toISOString() }).eq('id', a.id), 'Pieza enviada al cliente');
  };
  const resubmit = wrap(async (file) => {
    let path;
    try { path = await uploadFile(s.id, 'piezas', file); } catch (e) { notify(humanError(e), 'error'); return; }
    await run(() => supabase.from('assets').update({ file_path: path, file_name: file.name, status: a.status === 'cambios' ? 'pendiente' : a.status, sent_at: a.status === 'cambios' ? new Date().toISOString() : a.sent_at }).eq('id', a.id),
      a.status === 'cambios' ? 'Corrección enviada al cliente' : 'Archivo reemplazado');
  });
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ImageIcon size={16} className="text-stone-500 flex-shrink-0" />
        <div className="flex-1 min-w-[150px]">
          <div className="text-sm ink truncate">{a.name}</div>
          <div className="text-[11px] text-stone-500 truncate">
            {a.file_name || 'Sin archivo'}
            {a.status === 'pendiente' && a.sent_at && ` · esperando hace ${daysSince(a.sent_at)} d`}
            {a.status === 'aprobado' && a.reviewed_at && ` · aprobada el ${fmtDate(a.reviewed_at)}`}
          </div>
        </div>
        <Pill bg={st.bg} color={st.fg}>{st.label}</Pill>
        <DownloadButton path={a.file_path} />
        {a.status === 'produccion' && <Button size="sm" Icon={Send} onClick={send}>Enviar a aprobación</Button>}
        {(a.status === 'produccion' || a.status === 'cambios') && <FileButton size="sm" Icon={Upload} busy={busy} onFile={resubmit}>{a.status === 'cambios' ? 'Subir corrección' : 'Subir archivo'}</FileButton>}
        {a.status === 'produccion' && <IconButton Icon={Trash2} label={`Borrar ${a.name}`} onClick={async () => window.confirm(`¿Borrar la pieza ${a.name}?`) && await run(() => supabase.from('assets').delete().eq('id', a.id), 'Pieza borrada') && removeFile(a.file_path)} />}
      </div>
      {a.status === 'cambios' && a.review_note && <div className="mt-2 ml-7 px-3 py-2 rounded-lg bg-red-50 text-xs text-red-900">Cambios pedidos: {a.review_note}</div>}
    </div>
  );
}

export function LogoUploader({ s, readOnly = false }) {
  const { run, notify } = useStore();
  const [busy, wrap] = useBusy();
  const upload = wrap(async (file) => {
    if (!/^image\/(png|svg\+xml|jpeg|webp)$/.test(file.type)) { notify('El logo tiene que ser PNG, SVG, JPG o WebP.', 'error'); return; }
    let path;
    try { path = await uploadFile(s.id, 'logo', file); } catch (e) { notify(humanError(e), 'error'); return; }
    await run(() => supabase.rpc('set_sponsor_logo', { p_sponsor: s.id, p_path: path }), 'Logo actualizado');
  });
  return (
    <div className="flex items-center gap-4">
      <SponsorLogo sponsor={s} size="xl" />
      <div className="min-w-0 space-y-2">
        <div className="text-sm ink">{s.logo_path ? 'Logo recibido' : 'Falta el logo'}</div>
        <div className="text-[11px] text-stone-500">PNG o SVG con fondo transparente, idealmente de 1000 px o más.</div>
        {!readOnly && <FileButton size="sm" Icon={Upload} busy={busy} accept="image/png,image/svg+xml,image/jpeg,image/webp" onFile={upload}>{s.logo_path ? 'Reemplazar logo' : 'Subir logo'}</FileButton>}
      </div>
    </div>
  );
}

function Assets({ s }) {
  const [adding, setAdding] = useState(false);
  const order = { cambios: 0, pendiente: 1, produccion: 2, aprobado: 3 };
  const list = [...s.assets].sort((x, y) => order[x.status] - order[y.status]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <Card className="lg:col-span-8 overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b cream-border flex items-center gap-2">
          <div className="font-display text-lg ink flex-1">Piezas</div>
          <Button kind="primary" size="sm" Icon={Plus} onClick={() => setAdding(true)}>Nueva pieza</Button>
        </div>
        {list.length === 0 ? <div className="p-5"><Empty>Todavía no hay piezas.</Empty></div> : <div className="divide-y divide-stone-100">{list.map((a) => <AssetRow key={a.id} a={a} s={s} />)}</div>}
      </Card>
      <div className="lg:col-span-4 space-y-4">
        <Card className="p-5"><div className="font-display text-lg ink mb-3">Logo</div><LogoUploader s={s} /></Card>
        <Card className="p-5">
          <div className="font-display text-lg ink mb-2">Antes de enviar</div>
          <ul className="text-xs text-stone-700 space-y-1.5 list-disc pl-4">
            <li>Logo en la versión que aprobó el cliente.</li>
            <li>Medidas finales del soporte (valla, pantalla, escarapela).</li>
            <li>Textos revisados contra el contrato.</li>
          </ul>
          <p className="text-[11px] text-stone-500 mt-2">Lista de referencia para el equipo; no se valida sola.</p>
        </Card>
      </div>
      {adding && <NewAssetModal s={s} onClose={() => setAdding(false)} />}
    </div>
  );
}

/* ---------- Contrato ---------- */
function Contract({ s }) {
  const { run } = useStore();
  const upd = (patch, ok) => run(() => supabase.from('sponsors').update(patch).eq('id', s.id), ok);
  const contractDocs = s.documents.filter((d) => d.kind === 'contrato');
  const legalOk = Boolean(s.legal_razon && s.legal_rut && s.legal_domicilio);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <Card className="lg:col-span-7 p-5 sm:p-6 space-y-4">
        <div className="font-display text-lg ink">Contrato</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Modalidad" value={s.contract_type} onChange={(e) => upd({ contract_type: e.target.value }, 'Modalidad actualizada')}
            options={[{ value: 'Pendiente', label: 'Pendiente' }, ...CONTRACT_TYPES]} />
          <Select label="Estado" value={s.contract_status} onChange={(e) => upd({ contract_status: e.target.value }, 'Estado del contrato actualizado')} options={CONTRACT_STATUSES} />
        </div>
        {s.contract_status !== 'Firmado'
          ? <Button kind="dark" size="sm" Icon={CheckCircle2} onClick={() => upd({ contract_status: 'Firmado' }, 'Contrato marcado como firmado')}>Marcar como firmado</Button>
          : <div className="text-sm text-emerald-800 inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> Firmado {s.contract_signed_at ? `el ${fmtDate(s.contract_signed_at)}` : ''}</div>}
        <div>
          <Label>Archivos del contrato</Label>
          <div className="mt-2"><DocumentList sponsor={s} kind="contrato" folder="contrato" canUpload uploadLabel="Subir contrato" empty="Todavía no hay un contrato subido." /></div>
        </div>
      </Card>
      <Card className="lg:col-span-5 p-5 sm:p-6">
        <div className="font-display text-lg ink mb-2">Requisitos</div>
        <Check ok={legalOk} label="Razón social, NIT y domicilio completos" detail={legalOk ? '' : 'Complétalos en Datos legales'} />
        <Check ok={/vigente/i.test(s.legal_cc_status)} label="Cámara de comercio vigente" detail={s.legal_cc_status || 'Sin dato'} />
        <Check ok={contractDocs.length > 0} label="Contrato subido" />
        <Check ok={s.contract_status !== 'No iniciado'} label="Enviado al cliente" />
        <Check ok={s.contract_status === 'Firmado'} label="Firmado" />
        <p className="text-[11px] text-stone-500 mt-3">El contenido del contrato se revisa a mano; esta lista solo mira los datos cargados.</p>
      </Card>
    </div>
  );
}

/* ---------- Propuesta ---------- */
const PROPOSAL_STATUS = { enviada: ['Esperando al cliente', '#FFE4D6', '#FF5A1F'], aprobada: ['Aprobada', '#D4E5DB', '#1B4332'], cambios: ['Cambios pedidos', '#FDE2E2', '#B42318'] };

function NewProposalModal({ s, onClose }) {
  const { me, run, notify } = useStore();
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [busy, wrap] = useBusy();
  const version = (s.proposal?.version || 0) + 1;
  const save = wrap(async () => {
    if (!note.trim() && !file) { notify('Cuenta qué cambia en esta versión o adjunta el archivo.', 'error'); return; }
    let path = null;
    if (file) { try { path = await uploadFile(s.id, 'propuesta', file); } catch (e) { notify(humanError(e), 'error'); return; } }
    const ok = await run(() => supabase.from('proposals').insert({ sponsor_id: s.id, version, note: note.trim().slice(0, 2000), status: 'enviada', file_path: path, file_name: file?.name || null, author_name: me.full_name }),
      `Propuesta v${version} enviada al cliente`);
    if (ok) onClose();
  });
  return (
    <Modal title={`Propuesta v${version}`} onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button kind="primary" busy={busy} onClick={save}>Enviar al cliente</Button></>}>
      <Textarea label="Qué cambia en esta versión" value={note} onChange={(e) => setNote(e.target.value)} rows={4} autoFocus />
      <div className="flex items-center gap-2 flex-wrap">
        <FileButton size="sm" Icon={Upload} onFile={setFile}>{file ? 'Cambiar archivo' : 'Adjuntar archivo'}</FileButton>
        <span className="text-xs text-stone-600 truncate">{file ? file.name : 'Opcional'}</span>
      </div>
    </Modal>
  );
}

function Proposal({ s }) {
  const [adding, setAdding] = useState(false);
  const p = s.proposal;
  const st = p && PROPOSAL_STATUS[p.status];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <Card className="lg:col-span-5 p-5 sm:p-6 space-y-3">
        <div className="font-display text-lg ink">Versión actual</div>
        {p ? (
          <>
            <div className="flex items-center gap-2 flex-wrap"><span className="font-display text-3xl ink">v{p.version}</span><Pill bg={st[1]} color={st[2]}>{st[0]}</Pill></div>
            <div className="text-[11px] text-stone-500">Enviada el {fmtDate(p.created_at)}{p.author_name ? ` por ${p.author_name}` : ''}{p.reviewed_at ? ` · revisada el ${fmtDate(p.reviewed_at)}` : ''}</div>
            {p.note && <p className="text-sm text-stone-800 whitespace-pre-wrap">{p.note}</p>}
          </>
        ) : <Empty>Todavía no se envió una propuesta.</Empty>}
        <Button kind="primary" size="sm" Icon={Plus} onClick={() => setAdding(true)}>Nueva versión</Button>
        <p className="text-[11px] text-stone-500">El cliente la aprueba o pide cambios desde su portal.</p>
      </Card>
      <Card className="lg:col-span-7 p-5 sm:p-6">
        <div className="font-display text-lg ink mb-3">Historial</div>
        {s.proposals.length === 0 ? <Empty>Sin versiones.</Empty> : (
          <div className="divide-y divide-stone-100">
            {s.proposals.map((v) => (
              <div key={v.id} className="py-3 flex items-start gap-3">
                <FileText size={16} className="text-stone-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm ink">v{v.version} <span className="text-[11px] text-stone-500">· {fmtDate(v.created_at)}</span></div>
                  {v.note && <div className="text-xs text-stone-600 line-clamp-2">{v.note}</div>}
                </div>
                <Pill bg={PROPOSAL_STATUS[v.status][1]} color={PROPOSAL_STATUS[v.status][2]}>{PROPOSAL_STATUS[v.status][0]}</Pill>
                <DownloadButton path={v.file_path} />
              </div>
            ))}
          </div>
        )}
      </Card>
      {adding && <NewProposalModal s={s} onClose={() => setAdding(false)} />}
    </div>
  );
}

/* ---------- Datos legales ---------- */
const LEGAL_FIELDS = [
  ['legal_razon', 'Razón social'], ['legal_rut', 'NIT'], ['legal_domicilio', 'Domicilio'], ['legal_cc_status', 'Cámara de comercio'],
  ['contact_name', 'Contacto'], ['contact_role', 'Cargo'], ['contact_email', 'Email'], ['contact_phone', 'Teléfono'], ['sector', 'Sector'],
];

function Legal({ s }) {
  const { run, notify } = useStore();
  const [f, setF] = useState(() => Object.fromEntries(LEGAL_FIELDS.map(([k]) => [k, s[k] || ''])));
  const [busy, wrap] = useBusy();
  const save = wrap(async () => {
    if (f.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contact_email.trim())) { notify('Revisa el email del contacto.', 'error'); return; }
    await run(() => supabase.from('sponsors').update(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]))).eq('id', s.id), 'Datos guardados');
  });
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <Card className="lg:col-span-7 p-5 sm:p-6 space-y-3">
        <div className="font-display text-lg ink">Datos de facturación y contacto</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LEGAL_FIELDS.map(([k, l]) => <Input key={k} label={l} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
        </div>
        <Button kind="primary" size="sm" busy={busy} onClick={save}>Guardar</Button>
      </Card>
      <div className="lg:col-span-5 space-y-4">
        <Card className="p-5 sm:p-6">
          <div className="font-display text-lg ink mb-3">Documentos legales</div>
          <DocumentList sponsor={s} kind="legal" folder="legal" canUpload empty="El cliente todavía no subió documentos (RUT, cámara de comercio)." />
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-2"><div className="font-display text-lg ink flex-1">Contactos en HubSpot</div><Pill bg="#F1ECDF" color="#7A6E5D">Datos de ejemplo</Pill></div>
          <div className="text-sm text-stone-700">{s.hubspot_contacts} contactos</div>
          <div className="flex flex-wrap gap-1 mt-2">{s.hubspot_segments.map((x) => <Pill key={x} bg="#F1ECDF" color="#7A6E5D">{x}</Pill>)}</div>
          <div className="mt-3 text-[11px] text-stone-500 flex items-start gap-1.5"><Info size={12} className="mt-0.5 flex-shrink-0" /> HubSpot no está conectado en este demo.</div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Post-evento ---------- */
function Post({ s }) {
  const { run, notify } = useStore();
  const [f, setF] = useState({ nps: s.nps ?? '', nps_quote: s.nps_quote || '', social_views: s.social_views ?? '' });
  const [busy, wrap] = useBusy();
  const save = wrap(async () => {
    const nps = f.nps === '' ? null : Number(f.nps);
    const views = f.social_views === '' ? null : Number(f.social_views);
    if (nps !== null && !(nps >= 0 && nps <= 10)) { notify('El NPS va de 0 a 10.', 'error'); return; }
    if (views !== null && !(Number.isInteger(views) && views >= 0)) { notify('Las vistas tienen que ser un número entero.', 'error'); return; }
    await run(() => supabase.from('sponsors').update({ nps, nps_quote: f.nps_quote.trim() || null, social_views: views }).eq('id', s.id), 'Cierre guardado');
  });
  return (
    <div className="space-y-4">
      {s.stage !== 'post' && <div className="text-xs text-stone-600 flex items-start gap-2 px-1"><Info size={14} className="mt-0.5 flex-shrink-0" /> Esta sección se usa cuando el patrocinador pasa a Post-evento. Se puede llenar antes.</div>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-6 p-5 sm:p-6 space-y-3">
          <div className="font-display text-lg ink">Resultados</div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="NPS (0 a 10)" type="number" min="0" max="10" step="0.1" value={f.nps} onChange={(e) => setF({ ...f, nps: e.target.value })} />
            <Input label="Vistas en redes" type="number" min="0" step="1" value={f.social_views} onChange={(e) => setF({ ...f, social_views: e.target.value })} />
          </div>
          <Textarea label="Cita del cliente" value={f.nps_quote} onChange={(e) => setF({ ...f, nps_quote: e.target.value })} />
          <Button kind="primary" size="sm" busy={busy} onClick={save}>Guardar</Button>
        </Card>
        <Card className="lg:col-span-6 p-5 sm:p-6">
          <div className="font-display text-lg ink mb-3">Evidencias</div>
          <DocumentList sponsor={s} kind="evidencia" folder="evidencia" canUpload uploadLabel="Subir evidencia" empty="Fotos, reportes de alcance y menciones del evento." />
        </Card>
      </div>
    </div>
  );
}

/* ---------- Pantalla ---------- */
export default function SponsorDetail({ id, tab: hashTab, setView }) {
  const { data } = useStore();
  // La pestana vive en el hash: recargar, atras/adelante y links directos la respetan.
  const tab = TABS.some((t) => t.key === hashTab) ? hashTab : 'overview';
  const setTab = (key) => setView({ name: 'sponsor', id, tab: key }, { keepScroll: true });
  const s = data.byId[id];
  if (!s) return <div className="p-8"><Empty>Este patrocinador no existe o fue borrado.</Empty></div>;
  const badge = { comments: s.comments.length, assets: s.pendingApprovals + s.assets.filter((a) => a.status === 'cambios').length, attendees: s.inscritos };
  return (
    <div>
      <Header s={s} setView={setView} />
      <div className="bg-white border-b cream-border px-4 sm:px-8 sticky top-0 lg:top-0 z-20">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin -mb-px" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-3 text-sm whitespace-nowrap border-b-2 ${tab === t.key ? 'border-[#FF5A1F] ink font-medium' : 'border-transparent text-stone-600 hover:ink'}`}>
              {t.label}{badge[t.key] ? <span className="ml-1.5 text-[10px] text-stone-500">{badge[t.key]}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 sm:px-8 py-6">
        {tab === 'overview' && <Overview s={s} data={data} go={setTab} />}
        {tab === 'comments' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Card className="lg:col-span-8 p-4 sm:p-6"><Conversation sponsor={s} maxHeight="max-h-[60vh]" /></Card>
            <Card className="lg:col-span-4 p-5 space-y-4 self-start">
              <div className="font-display text-lg ink">Participantes</div>
              {data.profiles.filter((p) => p.kind === 'team' || p.sponsor_id === s.id).map((p) => (
                <div key={p.id} className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${p.kind === 'team' ? 'bg-stone-900' : 'accent-bg'}`} />
                  <div className="min-w-0"><div className="text-sm ink truncate">{p.full_name}</div><div className="text-[11px] text-stone-500 truncate">{p.kind === 'team' ? 'StartCo' : s.name}{p.title ? ` · ${p.title}` : ''}</div></div>
                </div>
              ))}
              <div className="text-[11px] text-stone-500 border-t cream-border pt-3">El cliente ve todo menos las notas internas. Este demo no envía correos: los mensajes se leen en el portal.</div>
            </Card>
          </div>
        )}
        {tab === 'assets' && <Assets s={s} />}
        {tab === 'attendees' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8"><AttendeesPanel sponsor={s} /></div>
            <Card className="lg:col-span-4 p-5 self-start"><div className="font-display text-lg ink mb-3">Startups apadrinadas</div><StartupsPanel sponsor={s} /></Card>
          </div>
        )}
        {tab === 'contract' && <Contract s={s} />}
        {tab === 'proposal' && <Proposal s={s} />}
        {tab === 'commitments' && <Card className="p-5 sm:p-6 max-w-3xl"><div className="font-display text-lg ink mb-1">Compromisos del paquete {s.tier}</div><CommitmentsList sponsor={s} canEdit /></Card>}
        {tab === 'legal' && <Legal s={s} />}
        {tab === 'post' && <Post s={s} />}
      </div>
    </div>
  );
}
