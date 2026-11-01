import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TIER_COLORS, STAGES, initialsOf } from './lib/catalog.js';
import { useStore, useSignedUrl, signedUrl, hasFile } from './lib/store.jsx';

export const Pill = ({ children, color = '#0F1419', bg = '#E4E0D7', className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}
    style={{ color, background: bg }}>{children}</span>
);

export const TierPill = ({ tier, size = 'sm' }) => {
  const c = TIER_COLORS[tier] || TIER_COLORS.Founders;
  const sz = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${sz}`}
      style={{ background: c.bg, color: c.fg }}>{tier}</span>
  );
};

export const StageDot = ({ stage }) => {
  const s = STAGES.find((x) => x.key === stage);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s?.color }} />
      <span className="text-xs text-stone-600">{s?.label}</span>
    </span>
  );
};

export const Card = ({ children, className = '', ...rest }) => (
  <div className={`bg-white rounded-2xl border cream-border min-w-0 ${className}`} {...rest}>{children}</div>
);

export const IconButton = ({ Icon, onClick, label, disabled }) => (
  <button type="button" onClick={onClick} title={label} aria-label={label} disabled={disabled}
    className="w-8 h-8 rounded-full hover:bg-stone-200 inline-flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-40 disabled:hover:bg-transparent">
    <Icon size={16} className="text-stone-700" />
  </button>
);

const BTN = {
  primary: 'accent-bg text-white hover:opacity-90 max-sm:min-h-[44px]',
  dark: 'ink-bg text-white hover:opacity-90',
  ghost: 'border cream-border bg-white hover:bg-stone-50 text-stone-800',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
};
export const Button = ({ kind = 'ghost', size = 'md', Icon, children, className = '', busy, disabled, ...rest }) => (
  <button type="button" disabled={disabled || busy}
    className={`rounded-full font-medium inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
      ${size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${BTN[kind]} ${className}`} {...rest}>
    {busy ? <Loader2 size={size === 'sm' ? 11 : 13} className="animate-spin" /> : Icon && <Icon size={size === 'sm' ? 11 : 13} />}
    {children}
  </button>
);

export const Label = ({ children }) => (
  <div className="text-[13px] text-stone-500">{children}</div>
);

export const Field = ({ label, value, mono }) => (
  <div className="min-w-0">
    <div className="text-[13px] text-stone-500 mb-1">{label}</div>
    <div className={`text-sm ink break-words ${mono ? 'font-mono' : ''}`}>{value || <span className="text-stone-500">Sin dato</span>}</div>
  </div>
);

export const Stat = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-stone-600">{label}</span>
    <span className="font-medium ink text-right">{value}</span>
  </div>
);

export const Input = ({ label, className = '', ...rest }) => (
  <label className={`block ${className}`}>
    {label && <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>}
    <input className="w-full px-3 py-2 bg-white border cream-border rounded-lg text-sm outline-none focus:border-stone-400" {...rest} />
  </label>
);

export const Select = ({ label, options, className = '', ...rest }) => (
  <label className={`block ${className}`}>
    {label && <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>}
    <select className="w-full px-3 py-2 bg-white border cream-border rounded-lg text-sm outline-none focus:border-stone-400" {...rest}>
      {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  </label>
);

export const Textarea = ({ label, className = '', ...rest }) => (
  <label className={`block ${className}`}>
    {label && <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>}
    <textarea className="w-full px-3 py-2 bg-white border cream-border rounded-lg text-sm outline-none focus:border-stone-400 resize-y" rows={3} {...rest} />
  </label>
);

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b cream-border flex items-center gap-3">
          <div className="font-display text-lg ink flex-1">{title}</div>
          <IconButton Icon={X} label="Cerrar" onClick={onClose} />
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-3">{children}</div>
        {footer && <div className="px-5 py-3 border-t cream-border flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  const err = toast.kind === 'error';
  return (
    <div role="status" aria-live="polite" className="fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md">
      <div className={`px-4 py-3 rounded-xl shadow-lg text-sm flex items-start gap-2.5 ${err ? 'bg-red-700 text-white' : 'ink-bg text-white'}`}>
        {err ? <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-300" />}
        <span>{toast.text}</span>
      </div>
    </div>
  );
}

const AV = { 7: 'w-7 h-7', 8: 'w-8 h-8', 9: 'w-9 h-9', 10: 'w-10 h-10' };
export const Avatar = ({ name, size = 8, color, className = '' }) => (
  <div className={`${AV[size]} rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${color ? 'text-white' : 'bg-stone-200 text-stone-700'} ${className}`}
    style={color ? { background: color } : {}}>{initialsOf(name)}</div>
);

// Logo del patrocinador: el archivo real si lo hay, si no las iniciales con el color del tier.
export function SponsorLogo({ sponsor, size = 'md' }) {
  const url = useSignedUrl(sponsor.logo_path);
  const dims = { sm: 'w-7 h-7 text-xs rounded-md', md: 'w-9 h-9 text-xs rounded-md', lg: 'w-12 h-12 text-sm rounded-lg', xl: 'w-16 h-16 text-lg rounded-xl' }[size];
  if (url) return <img src={url} alt={`Logo de ${sponsor.name}`} className={`${dims} object-contain bg-white border cream-border flex-shrink-0`} />;
  return (
    <div className={`${dims} font-semibold flex items-center justify-center text-white flex-shrink-0`}
      style={{ background: (TIER_COLORS[sponsor.tier] || TIER_COLORS.Founders).bg }}>{sponsor.initials}</div>
  );
}

// Boton que abre el selector de archivos y entrega el archivo elegido.
export function FileButton({ onFile, accept, children, ...rest }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
      <Button {...rest} onClick={() => ref.current?.click()}>{children}</Button>
    </>
  );
}

// Descarga por URL firmada (10 min). Sin archivo real (datos de ejemplo) queda deshabilitado.
export function DownloadButton({ path, label = 'Descargar' }) {
  const { notify } = useStore();
  const ok = hasFile(path);
  const open = async () => {
    const w = window.open('', '_blank');
    try {
      const u = await signedUrl(path);
      if (w) w.location.href = u; else window.location.href = u;
    } catch {
      if (w) w.close();
      notify('No se pudo abrir el archivo.', 'error');
    }
  };
  return <IconButton Icon={Download} label={ok ? label : 'Archivo de ejemplo, sin descarga'} onClick={open} disabled={!ok} />;
}

export function useBusy() {
  const [busy, setBusy] = useState(false);
  const wrap = (fn) => async (...args) => {
    if (busy) return;
    setBusy(true);
    try { return await fn(...args); } finally { setBusy(false); }
  };
  return [busy, wrap];
}

export const Empty = ({ children }) => (
  <div className="text-sm text-stone-500 text-center py-10 px-4 border border-dashed cream-border rounded-xl">{children}</div>
);
