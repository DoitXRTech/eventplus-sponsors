import React from 'react';
import { Bell, Clock, Info, MessageSquare } from 'lucide-react';
import { useStore, daysSince, fmtDate } from '../lib/store.jsx';
import { supabase } from '../lib/supabase.js';
import { Card, Pill, TierPill, SponsorLogo, Button, DownloadButton, Empty, useBusy } from '../ui.jsx';

function ReminderButton({ asset, sponsor }) {
  const { run, me } = useStore();
  const [busy, wrap] = useBusy();
  const send = wrap(() => run(() => supabase.from('comments').insert({
    sponsor_id: sponsor.id, author_id: me.id, author_name: me.full_name, author_role: me.title, team: 'startco',
    body: `Recordatorio: la pieza "${asset.name}" sigue esperando su aprobación desde el ${fmtDate(asset.sent_at)}. La pueden revisar en su portal.`,
    context_kind: 'arte', context_label: asset.name,
  }), `Recordatorio publicado en la conversación de ${sponsor.name}`));
  return <Button size="sm" Icon={Bell} busy={busy} onClick={send}>Recordar</Button>;
}

export default function ApprovalsView({ setView }) {
  const { data } = useStore();
  const rows = data.sponsors.flatMap((s) => s.assets.map((a) => ({ a, s })));
  const pending = rows.filter((r) => r.a.status === 'pendiente').sort((x, y) => new Date(x.a.sent_at) - new Date(y.a.sent_at));
  const changes = rows.filter((r) => r.a.status === 'cambios').sort((x, y) => new Date(y.a.reviewed_at) - new Date(x.a.reviewed_at));

  const Row = ({ a, s, children }) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b cream-border last:border-0">
      <button onClick={() => setView({ name: 'sponsor', id: s.id, tab: 'assets' })} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <SponsorLogo sponsor={s} />
        <div className="min-w-0">
          <div className="text-sm font-medium ink truncate">{a.name}</div>
          <div className="text-xs text-stone-500 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5"><span className="truncate">{s.name}</span> <TierPill tier={s.tier} /></div>
        </div>
      </button>
      <div className="flex items-center gap-2 flex-wrap sm:justify-end">{children}</div>
    </div>
  );

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6 max-w-5xl">
      <Card>
        <div className="px-5 py-4 border-b cream-border flex items-center gap-2">
          <div className="font-display text-lg ink flex-1">Esperando al cliente</div>
          <Pill bg="#FFE4D6" color="#B33609">{pending.length}</Pill>
        </div>
        {pending.length === 0 ? <div className="p-5"><Empty>No hay piezas esperando aprobación.</Empty></div> : pending.map(({ a, s }) => {
          const d = daysSince(a.sent_at);
          return (
            <Row key={a.id} a={a} s={s}>
              <span className={`text-xs inline-flex items-center gap-1 ${d >= 3 ? 'text-red-700 font-medium' : 'text-stone-600'}`}>
                <Clock size={11} /> {d === 0 ? 'enviada hoy' : `${d} ${d === 1 ? 'día' : 'días'} esperando`}
              </span>
              <DownloadButton path={a.file_path} label="Ver archivo" />
              <ReminderButton asset={a} sponsor={s} />
            </Row>
          );
        })}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b cream-border flex items-center gap-2">
          <div className="font-display text-lg ink flex-1">Cambios pedidos</div>
          <Pill bg="#FDE2E2" color="#B42318">{changes.length}</Pill>
        </div>
        {changes.length === 0 ? <div className="p-5"><Empty>Ningún cliente pidió cambios.</Empty></div> : changes.map(({ a, s }) => (
          <div key={a.id}>
            <Row a={a} s={s}>
              <span className="text-xs text-stone-600">{a.reviewed_at ? `pedido el ${fmtDate(a.reviewed_at)}` : ''}</span>
              <Button size="sm" onClick={() => setView({ name: 'sponsor', id: s.id, tab: 'assets' })}>Subir corrección</Button>
            </Row>
            {a.review_note && (
              <div className="mx-4 -mt-2 mb-4 px-3 py-2 rounded-lg bg-red-50 text-xs text-red-900 flex items-start gap-2">
                <MessageSquare size={12} className="mt-0.5 flex-shrink-0" /> {a.review_note}
              </div>
            )}
          </div>
        ))}
      </Card>

      <div className="text-xs text-stone-600 flex items-start gap-2 px-1">
        <Info size={14} className="mt-0.5 flex-shrink-0" />
        <span>Las piezas pendientes aparecen en el portal del patrocinador, que las aprueba o pide cambios desde ahí. Este demo no envía correos: el botón Recordar deja el aviso en la conversación del patrocinador.</span>
      </div>
    </div>
  );
}
