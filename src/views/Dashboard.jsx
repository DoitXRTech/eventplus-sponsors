import React from 'react';
import {
  ClipboardCheck, FileSignature, Calendar, Ticket, ArrowRight, MessageSquare, Upload, CheckCircle2, Layers, Image as ImageIcon, Trophy, Info,
} from 'lucide-react';
import { STAGES, TIERS, TIER_COLORS, fmtCOP } from '../lib/catalog.js';
import { useStore, daysUntil, fmtDate, ago, daysSince } from '../lib/store.jsx';
import { Card, Pill, SponsorLogo } from '../ui.jsx';

export const ACTIVITY_ICON = {
  comment: { Icon: MessageSquare, color: '#FF5A1F' },
  asset: { Icon: ImageIcon, color: '#8B5A3C' },
  startup: { Icon: Trophy, color: '#2D5A87' },
  contract: { Icon: FileSignature, color: '#1B4332' },
  stage: { Icon: Layers, color: '#7A6E5D' },
  logo: { Icon: Upload, color: '#8B5A3C' },
};

export const atRiskTickets = (s) => s.ticketCap > 0 && s.inscritos / s.ticketCap < 0.6 && !['post', 'kickoff'].includes(s.stage);

export default function Dashboard({ setView }) {
  const { data } = useStore();
  const S = data.sponsors;
  const ev = data.event;
  const totalValue = S.reduce((a, x) => a + Number(x.value_cop), 0);
  const pendingApproval = S.reduce((a, x) => a + x.pendingApprovals, 0);
  const inProcess = S.filter((s) => s.stage !== 'post').length;
  const toEvent = daysUntil(ev?.start_date);
  const funnel = STAGES.map((st) => {
    const inStage = S.filter((s) => s.stage === st.key);
    return { stage: st, count: inStage.length, avgDays: Math.round(inStage.reduce((a, b) => a + b.daysInStage, 0) / Math.max(inStage.length, 1)) };
  });
  const maxCount = Math.max(...funnel.map((f) => f.count), 1);
  const atRisk = S.filter(atRiskTickets);
  const feed = S.flatMap((s) => s.activity.map((a) => ({ ...a, sponsor: s })))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 7);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-12 gap-4">
        <Card className="col-span-2 lg:col-span-5 p-6 sm:p-7 ink-bg text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,90,31,0.4), transparent 70%)' }} />
          <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400 mb-3">Patrocinadores confirmados · {ev?.name}</div>
          <div className="font-display text-5xl mb-2">{S.length}</div>
          <div className="text-sm text-stone-300">{inProcess} en proceso operativo · {fmtCOP(totalValue)} en valor total</div>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Listos <b className="text-white ml-1">{S.filter((s) => s.stage === 'ready' || s.stage === 'post').length}</b></span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#FF5A1F' }} />En curso <b className="text-white ml-1">{S.filter((s) => s.stage !== 'ready' && s.stage !== 'post').length}</b></span>
          </div>
        </Card>
        <Card className="col-span-2 sm:col-span-1 lg:col-span-3 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Aprobaciones</div>
            <ClipboardCheck size={18} className="accent-text" />
          </div>
          <div className="font-display text-4xl ink">{pendingApproval}</div>
          <div className="text-sm text-stone-600 mt-1">{pendingApproval === 1 ? 'pieza esperando aprobación' : 'piezas esperando aprobación'}</div>
          <button onClick={() => setView({ name: 'approvals' })} className="mt-3 min-h-[32px] text-xs accent-text font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">
            Ver bandeja <ArrowRight size={12} />
          </button>
        </Card>
        <Card className="col-span-1 lg:col-span-2 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Contratos</div>
            <FileSignature size={18} className="text-stone-700" />
          </div>
          <div className="font-display text-4xl ink">{S.filter((s) => s.contract_status === 'Firmado').length}<span className="text-xl text-stone-400">/{S.length}</span></div>
          <div className="text-sm text-stone-600 mt-1">firmados</div>
        </Card>
        <Card className="col-span-1 lg:col-span-2 p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">Días al evento</div>
            <Calendar size={18} className="text-stone-700" />
          </div>
          <div className="font-display text-4xl ink">{toEvent === null ? '?' : Math.max(toEvent, 0)}</div>
          <div className="text-sm text-stone-600 mt-1">{ev ? `${fmtDate(ev.start_date)} · ${ev.city}` : 'Sin fecha'}</div>
        </Card>
      </div>

      {atRisk.length > 0 && (
        <Card className="p-5 sm:p-6 border-orange-200 bg-orange-50/30">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg accent-bg items-center justify-center flex-shrink-0 hidden sm:flex"><Ticket size={18} className="text-white" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-display text-lg ink">{atRisk.length} {atRisk.length === 1 ? 'patrocinador' : 'patrocinadores'} con cupos por debajo del 60%</div>
                <Pill bg="#FFE4D6" color="#B33609">Atención</Pill>
              </div>
              <p className="text-sm text-stone-700 mt-1">Recordemos a estos clientes que llenen sus cupos antes del evento. Cada cupo no usado es valor desperdiciado del paquete.</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {atRisk.map((s) => (
                  <button key={s.id} onClick={() => setView({ name: 'sponsor', id: s.id })}
                    className="text-left bg-white rounded-lg border cream-border p-3 hover:shadow-sm hover:border-stone-300 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <SponsorLogo sponsor={s} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium ink truncate">{s.name}</div>
                        <div className="text-[10px] text-stone-500">{s.tier}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full accent-bg rounded-full" style={{ width: `${(s.inscritos / s.ticketCap) * 100}%` }} />
                      </div>
                      <div className="text-[11px] font-mono text-stone-700">{s.inscritos}/{s.ticketCap}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-7 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <div className="font-display text-xl ink">Embudo de procesos</div>
              <div className="text-sm text-stone-600">Estado operativo de cada patrocinador (post-venta)</div>
            </div>
            <button onClick={() => setView({ name: 'pipeline' })} className="min-h-[32px] text-xs font-medium text-stone-700 hover:ink inline-flex items-center gap-1 whitespace-nowrap">
              Ver kanban <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3 mt-5">
            {funnel.map((f) => (
              <div key={f.stage.key} className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-5 sm:col-span-3 flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.stage.color }} />
                  <div className="min-w-0">
                    <div className="text-sm text-stone-800 truncate">{f.stage.label}</div>
                    <div className="text-[10px] text-stone-500 hidden sm:block">{f.stage.desc}</div>
                  </div>
                </div>
                <div className="col-span-4 sm:col-span-7 h-8 bg-stone-100 rounded-md overflow-hidden">
                  <div className="h-full transition-all rounded-md flex items-center px-3"
                    style={{ width: `${(f.count / maxCount) * 100}%`, minWidth: f.count > 0 ? '32px' : '0', background: f.stage.color }}>
                    {f.count > 0 && <span className="text-xs font-semibold text-white">{f.count}</span>}
                  </div>
                </div>
                <div className="col-span-3 sm:col-span-2 text-right">
                  <div className="text-sm ink font-medium">{f.count} <span className="hidden sm:inline">{f.count === 1 ? 'cliente' : 'clientes'}</span></div>
                  {f.count > 0 && <div className="text-[10px] text-stone-500">~{f.avgDays} d en etapa</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5 p-5 sm:p-7">
          <div className="font-display text-xl ink mb-1">Actividad reciente</div>
          <div className="text-sm text-stone-600 mb-5">Lo último que pasó en todos los patrocinios</div>
          <div className="space-y-4">
            {feed.length === 0 && <div className="text-sm text-stone-500">Todavía no hay actividad.</div>}
            {feed.map((a) => {
              const k = ACTIVITY_ICON[a.kind] || { Icon: CheckCircle2, color: '#7A6E5D' };
              return (
                <button key={a.id} onClick={() => setView({ name: 'sponsor', id: a.sponsor_id })} className="w-full text-left flex items-start gap-3 group">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${k.color}15` }}>
                    <k.Icon size={14} style={{ color: k.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-stone-800 group-hover:underline">{a.text}</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">{ago(a.created_at)}{a.actor_name ? ` · ${a.actor_name}` : ''}{a.internal ? ' · interno' : ''}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-4 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="font-display text-xl ink">Prospectos</div>
            <Pill bg="#F1ECDF" color="#7A6E5D">Datos de ejemplo</Pill>
          </div>
          <div className="text-sm text-stone-600 mb-5">{data.prospects.length} en negociación (el pipeline de ventas vive en HubSpot)</div>
          <div className="space-y-2">
            {data.prospects.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50">
                <div className="w-8 h-8 rounded-md text-[10px] font-semibold flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: (TIER_COLORS[p.tier] || TIER_COLORS.Founders).bg }}>
                  {p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium ink truncate">{p.name}</div>
                  <div className="text-[11px] text-stone-500 truncate">{p.contact} · {daysSince(p.stage_since)} d</div>
                </div>
                <Pill bg="#F1ECDF" color="#7A6E5D">{p.stage}</Pill>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[11px] text-stone-500 flex items-start gap-1.5"><Info size={12} className="mt-0.5 flex-shrink-0" /> HubSpot no está conectado en este demo.</div>
        </Card>

        <Card className="lg:col-span-8 p-5 sm:p-7">
          <div className="font-display text-xl ink mb-1">Distribución por paquete</div>
          <div className="text-sm text-stone-600 mb-6">Patrocinadores confirmados por tier · valor sin IVA</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-7 gap-3">
            {TIERS.map((t) => {
              const arr = S.filter((s) => s.tier === t);
              const c = TIER_COLORS[t];
              return (
                <div key={t} className="rounded-xl p-4 border cream-border" style={{ background: c.soft }}>
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.bg }}>{t}</div>
                  <div className="font-display text-3xl ink mt-2">{arr.length}</div>
                  <div className="text-[11px] text-stone-700 mt-1 font-mono">{fmtCOP(arr.reduce((a, b) => a + Number(b.value_cop), 0))}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
