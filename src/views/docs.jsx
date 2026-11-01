import React from 'react';
import { FileText, Upload, Trash2, ShieldCheck } from 'lucide-react';
import { useStore, uploadFile, removeFile, fmtSize, fmtDate, humanError } from '../lib/store.jsx';
import { supabase } from '../lib/supabase.js';
import { Pill, FileButton, DownloadButton, IconButton, Empty, useBusy } from '../ui.jsx';

// Sube un archivo y lo registra en documents. Devuelve true si quedo guardado.
export async function addDocument({ sponsor, kind, folder, file, me, run, notify, okText }) {
  let path;
  try { path = await uploadFile(sponsor.id, folder, file); } catch (e) { notify(humanError(e), 'error'); return false; }
  return run(() => supabase.from('documents').insert({ sponsor_id: sponsor.id, kind, name: file.name.slice(0, 200), file_path: path, size_bytes: file.size, created_by: me.id }), okText);
}

export function DocumentList({ sponsor, kind, folder, canUpload, readOnly = false, uploadLabel = 'Subir documento', empty = 'Todavía no hay documentos.', accept }) {
  const { me, isTeam: team, run, notify } = useStore();
  const isTeam = team && !readOnly;
  const [busy, wrap] = useBusy();
  const docs = sponsor.documents.filter((d) => d.kind === kind);
  const upload = wrap((file) => addDocument({ sponsor, kind, folder, file, me, run, notify, okText: `${file.name} quedó subido` }));
  return (
    <div className="space-y-2">
      {docs.length === 0 && <Empty>{empty}</Empty>}
      {docs.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 rounded-lg border cream-border bg-white">
          <FileText size={16} className="text-stone-500 flex-shrink-0" />
          <div className="flex-1 min-w-[140px]">
            <div className="text-sm ink truncate">{d.name}</div>
            <div className="text-xs text-stone-500">{fmtDate(d.created_at)}{d.size_bytes ? ` · ${fmtSize(d.size_bytes)}` : ''}</div>
          </div>
          {kind === 'legal' && (isTeam ? (
            <button onClick={() => run(() => supabase.from('documents').update({ verified: !d.verified }).eq('id', d.id), d.verified ? 'Documento sin verificar' : 'Documento verificado')}
              className="inline-flex items-center min-h-[32px]"><Pill bg={d.verified ? '#D4E5DB' : '#F1ECDF'} color={d.verified ? '#1B4332' : '#6B5F4F'}><ShieldCheck size={10} /> {d.verified ? 'Verificado' : 'Marcar verificado'}</Pill></button>
          ) : <Pill bg={d.verified ? '#D4E5DB' : '#F1ECDF'} color={d.verified ? '#1B4332' : '#6B5F4F'}>{d.verified ? 'Verificado' : 'En revisión'}</Pill>)}
          <DownloadButton path={d.file_path} />
          {isTeam && <IconButton Icon={Trash2} label={`Borrar ${d.name}`} onClick={async () => window.confirm(`¿Borrar ${d.name}?`) && await run(() => supabase.from('documents').delete().eq('id', d.id), 'Documento borrado') && removeFile(d.file_path)} />}
        </div>
      ))}
      {canUpload && !readOnly && <FileButton size="sm" Icon={Upload} busy={busy} accept={accept} onFile={upload}>{uploadLabel}</FileButton>}
    </div>
  );
}
