import React, { useState } from 'react';
import { Search, AlertCircle, Ticket, ChevronRight } from 'lucide-react';
import { fmtCOP, stripDiacritics } from '../lib/catalog.js';
import { useStore } from '../lib/store.jsx';
import { Card, Pill, TierPill, StageDot, SponsorLogo, Empty } from '../ui.jsx';
import { atRiskTickets } from './Dashboard.jsx';

const FILTERS = [
  { key: 'all', label: 'Todos', test: () => true },
  { key: 'active', label: 'Activos', test: (s) => s.stage !== 'post' },
  { key: 'risk', label: 'En riesgo', test: (s) => atRiskTickets(s) || s.assets.some((a) => a.status === 'cambios') },
  { key: 'closed', label: 'Cerrados', test: (s) => s.stage === 'post' },
];

function TicketBar({ s }) {
  const pct = s.ticketCap ? (s.inscritos / s.ticketCap) * 100 : 0;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct < 60 ? '#FF5A1F' : '#1B4332' }} />
      </div>
      <span className="text-[11px] font-mono text-stone-700 whitespace-nowrap">{s.inscritos}/{s.ticketCap}</span>
    </div>
  );
}

export default function SponsorsList({ setView }) {
  const { data } = useStore();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const f = FILTERS.find((x) => x.key === filter);
  const nq = stripDiacritics(q.trim());
  const list = data.sponsors.filter(f.test).filter((s) => !nq || stripDiacritics(`${s.name} ${s.contact_name} ${s.sector}`).includes(nq));
  const flags = (s) => (
    <span className="inline-flex flex-wrap gap-1">
      {s.pendingApprovals > 0 && <Pill bg="#FFE4D6" color="#B33609"><AlertCircle size={10} /> {s.pendingApprovals} por aprobar</Pill>}
      {atRiskTickets(s) && <Pill bg="#FDE2E2" color="#B42318"><Ticket size={10} /> Cupos bajos</Pill>}
    </span>
  );

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin">
          {FILTERS.map((x) => (
            <button key={x.key} onClick={() => setFilter(x.key)}
              className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap ${filter === x.key ? 'ink-bg text-white' : 'bg-white border cream-border text-stone-700 hover:bg-stone-50'}`}>
              {x.label} <span className="opacity-60">{data.sponsors.filter(x.test).length}</span>
            </button>
          ))}
        </div>
        <label className="sm:ml-auto relative block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nombre, contacto o sector"
            className="w-full sm:w-72 pl-9 pr-3 py-2 text-sm bg-white border cream-border rounded-full outline-none focus:border-stone-400" />
        </label>
      </div>

      {list.length === 0 && <Empty>No hay patrocinadores con este filtro.</Empty>}

      <div className="md:hidden space-y-2">
        {list.map((s) => (
          <button key={s.id} onClick={() => setView({ name: 'sponsor', id: s.id })} className="w-full text-left bg-white rounded-xl border cream-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <SponsorLogo sponsor={s} />
              <div className="flex-1 min-w-0">
                <div className="font-medium ink truncate">{s.name}</div>
                <div className="text-[11px] text-stone-500 truncate">{s.contact_name}</div>
              </div>
              <ChevronRight size={16} className="text-stone-400" />
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3"><TierPill tier={s.tier} /><StageDot stage={s.stage} /><span className="text-[11px] font-mono text-stone-600 ml-auto">{fmtCOP(s.value_cop)}</span></div>
            <TicketBar s={s} />
            <div className="mt-2">{flags(s)}</div>
          </button>
        ))}
      </div>

      {list.length > 0 && (
        <Card className="hidden md:block overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-stone-500 border-b cream-border">
                <th className="px-5 py-3 font-medium">Patrocinador</th>
                <th className="px-3 py-3 font-medium">Paquete</th>
                <th className="px-3 py-3 font-medium">Etapa</th>
                <th className="px-3 py-3 font-medium w-44">Cupos</th>
                <th className="px-3 py-3 font-medium hidden xl:table-cell">Contrato</th>
                <th className="px-3 py-3 font-medium">Alertas</th>
                <th className="px-5 py-3 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} onClick={() => setView({ name: 'sponsor', id: s.id })} className="border-b cream-border last:border-0 hover:bg-stone-50 cursor-pointer">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <SponsorLogo sponsor={s} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium ink truncate">{s.name}</div>
                        <div className="text-[11px] text-stone-500 truncate">{s.contact_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><TierPill tier={s.tier} /></td>
                  <td className="px-3 py-3"><StageDot stage={s.stage} /></td>
                  <td className="px-3 py-3"><TicketBar s={s} /></td>
                  <td className="px-3 py-3 text-xs text-stone-700 hidden xl:table-cell">{s.contract_status}</td>
                  <td className="px-3 py-3">{flags(s)}</td>
                  <td className="px-5 py-3 text-right font-mono text-xs">{fmtCOP(s.value_cop)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
