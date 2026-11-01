import React, { useState } from 'react';
import { Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { STAGES, TIERS, fmtCOP } from '../lib/catalog.js';
import { useStore } from '../lib/store.jsx';
import { supabase } from '../lib/supabase.js';
import { Pill, TierPill, SponsorLogo } from '../ui.jsx';

export default function PipelineKanban({ setView }) {
  const { data, run } = useStore();
  const [tier, setTier] = useState('');
  const S = data.sponsors.filter((s) => !tier || s.tier === tier);
  const move = (s, dir) => {
    const i = STAGES.findIndex((x) => x.key === s.stage) + dir;
    if (i < 0 || i >= STAGES.length) return;
    run(() => supabase.from('sponsors').update({ stage: STAGES[i].key }).eq('id', s.id), `${s.name} pasó a ${STAGES[i].label}`);
  };
  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="text-sm text-stone-600">{S.length} patrocinadores {tier ? `en ${tier}` : 'confirmados'}</div>
        <Pill bg="#FFE4D6" color="#FF5A1F">Operativo · post-venta</Pill>
        <label className="ml-auto inline-flex items-center gap-2 text-xs text-stone-600">
          Paquete
          <select value={tier} onChange={(e) => setTier(e.target.value)} className="px-3 py-1.5 text-xs border cream-border rounded-full bg-white outline-none">
            <option value="">Todos</option>
            {TIERS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto pb-4 scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3 min-w-max">
          {STAGES.map((stage, si) => {
            const inStage = S.filter((s) => s.stage === stage.key);
            return (
              <div key={stage.key} className="w-64 sm:w-72 flex-shrink-0">
                <div className="px-1 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    <span className="font-display text-sm ink">{stage.label}</span>
                    <span className="text-xs text-stone-500">· {inStage.length}</span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-500">{fmtCOP(inStage.reduce((a, b) => a + Number(b.value_cop), 0))}</span>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {inStage.map((s) => (
                    <div key={s.id} className="bg-white rounded-xl border cream-border hover:shadow-sm hover:border-stone-300 transition-all">
                      <button onClick={() => setView({ name: 'sponsor', id: s.id })} className="w-full text-left p-3 pb-2">
                        <div className="flex items-center gap-2 mb-2 min-w-0">
                          <SponsorLogo sponsor={s} size="sm" />
                          <div className="font-medium text-sm ink truncate">{s.name}</div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-stone-600">
                          <TierPill tier={s.tier} />
                          <span className="font-mono">{fmtCOP(s.value_cop)}</span>
                        </div>
                      </button>
                      <div className="mx-3 py-2 border-t cream-border flex items-center justify-between text-[11px] text-stone-500">
                        <span className="inline-flex items-center gap-1"><Clock size={10} /> {s.daysInStage} d en etapa</span>
                        <span className="inline-flex items-center gap-1">
                          {s.pendingApprovals > 0 && <span className="inline-flex items-center gap-1 accent-text font-medium mr-1"><AlertCircle size={10} /> {s.pendingApprovals}</span>}
                          <button disabled={si === 0} onClick={() => move(s, -1)} title="Mover a la etapa anterior" aria-label="Mover a la etapa anterior"
                            className="w-6 h-6 rounded-full hover:bg-stone-100 inline-flex items-center justify-center disabled:opacity-30"><ChevronLeft size={12} /></button>
                          <button disabled={si === STAGES.length - 1} onClick={() => move(s, 1)} title="Mover a la etapa siguiente" aria-label="Mover a la etapa siguiente"
                            className="w-6 h-6 rounded-full hover:bg-stone-100 inline-flex items-center justify-center disabled:opacity-30"><ChevronRight size={12} /></button>
                        </span>
                      </div>
                    </div>
                  ))}
                  {inStage.length === 0 && (
                    <div className="text-[11px] text-stone-400 text-center py-6 border border-dashed rounded-xl cream-border">Sin patrocinadores</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
