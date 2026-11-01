// Matriz comercial StartCo (Paquetes_Comerciales_StartCo) y etapas operativas.
// Fuente unica para la app y para scripts/build-seed.mjs. Los cupos de tickets y
// apadrinamientos tambien viven en SQL (tier_ticket_capacity / tier_startup_capacity).

export const TIERS = ['Partner', 'Unicorn', 'Serie B', 'Serie A', 'Seed', 'Preseed', 'Founders'];

export const TIER_VALUES = {
  Partner: 250000000,
  Unicorn: 166000000,
  'Serie B': 90000000,
  'Serie A': 62000000,
  Seed: 45000000,
  Preseed: 30000000,
  Founders: 18000000,
};

export const TIER_COLORS = {
  Partner:   { bg: '#0F1419', fg: '#FFFFFF', soft: '#E8E5DD' },
  Unicorn:   { bg: '#C93D0C', fg: '#FFFFFF', soft: '#FFE4D6' },
  'Serie B': { bg: '#1B4332', fg: '#FFFFFF', soft: '#D4E5DB' },
  'Serie A': { bg: '#2D5A87', fg: '#FFFFFF', soft: '#D6E2EF' },
  Seed:      { bg: '#8B5A3C', fg: '#FFFFFF', soft: '#EAD9CC' },
  Preseed:   { bg: '#7A6E5D', fg: '#FFFFFF', soft: '#E0DBD0' },
  Founders:  { bg: '#A8A29E', fg: '#FFFFFF', soft: '#EDEAE5' },
};

// "v" = incluido, "x" = no incluido, numero = cantidad
const RAW_COMMITMENTS = [
  { cat: 'Espacio y Entradas', name: 'Espacio en m²', vals: [20, 16, 12, 9, 6, 5, 0], unit: 'm²' },
  { cat: 'Espacio y Entradas', name: 'Apadrinamientos de startups', vals: [5, 4, 3, 2, 1, 0, 0], unit: 'startups', kind: 'startups' },
  { cat: 'Espacio y Entradas', name: 'Ingresos generales (tickets 2 días)', vals: [200, 150, 100, 80, 60, 30, 15], unit: 'tickets', kind: 'tickets' },
  { cat: 'Espacio y Entradas', name: 'Patrocinio del espacio de pitch session', vals: ['v','v','x','x','x','x','x'] },
  { cat: 'Branding', name: 'Imagen en pantalla principal (itinerante)', vals: ['v','v','v','v','v','v','v'] },
  { cat: 'Branding', name: 'Imagen en página web del evento', vals: ['v','v','v','v','v','v','v'] },
  { cat: 'Branding', name: 'Valla de agradecimiento', vals: ['v','v','v','v','v','v','x'] },
  { cat: 'Branding', name: 'Marketing digital en redes sociales', vals: ['v','v','v','v','v','v','v'] },
  { cat: 'Branding', name: 'Imagen y nota en Newsletter Starter (mailing masivo)', vals: [3, 2, 1, 'x','x','x','x'], unit: 'envíos' },
  { cat: 'Branding', name: 'Mención en boletín de prensa (+30 medios)', vals: ['v','v','v','v','v','x','x'] },
  { cat: 'Branding', name: 'Imagen en escarapela del evento', vals: ['v','v','x','x','x','x','x'] },
  { cat: 'Branding', name: 'Imagen en networking previo al evento', vals: ['v','v','x','x','x','x','x'] },
  { cat: 'Branding', name: 'Marca en Sala VIP + 5 accesos', vals: ['v','v','x','x','x','x','x'] },
  { cat: 'Branding', name: 'Espacio de marca en talleres de preparación', vals: ['v','v','x','x','x','x','x'] },
  { cat: 'Branding', name: 'Patrocinio con material POP para 270 startups', vals: ['v','v','v','v','x','x','x'] },
  { cat: 'Visibilidad Estratégica', name: 'Cápsula 1 min + contenido colaborativo en redes', vals: ['v','x','x','x','x','x','x'] },
  { cat: 'Visibilidad Estratégica', name: 'Marca en hasta 5 vallas de señalización', vals: ['v','v','x','x','x','x','x'] },
  { cat: 'Visibilidad Estratégica', name: 'Marca en pantallas durante el ranking', vals: ['v','v','x','x','x','x','x'] },
  { cat: 'Visibilidad Estratégica', name: 'Intervención durante el evento (5 min)', vals: ['v','v','x','x','x','x','x'] },
  { cat: 'Visibilidad Estratégica', name: 'Video institucional 30s (1x por día)', vals: ['v','v','v','x','x','x','x'] },
  { cat: 'Visibilidad Estratégica', name: 'Mención en kit de prensa y medios', vals: ['v','v','v','v','x','x','x'] },
  { cat: 'Visibilidad Estratégica', name: 'Webinar a corporativos (post-evento, 6 meses)', vals: ['v','v','v','x','x','x','x'] },
  { cat: 'Visibilidad Estratégica', name: 'Envío exclusivo a comunidad (+27.000 usuarios)', vals: ['v','v','v','x','x','x','x'] },
  { cat: 'Visibilidad Estratégica', name: 'Espacio segundo piso (30 personas)', vals: ['v','v','v','x','x','x','x'] },
  { cat: 'Visibilidad Estratégica', name: 'Intervención noche previa (networking 400 inv.)', vals: ['v','v','v','x','x','x','x'] },
  { cat: 'Bases de Datos', name: 'Base de datos de asistentes generales', vals: ['v','v','v','x','x','x','x'] },
  { cat: 'Bases de Datos', name: 'Base de datos de startups de la muestra', vals: ['v','v','v','v','v','v','x'] },
];

export const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/m²/g, 'm2').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const COMMITMENTS = RAW_COMMITMENTS.map((c) => ({ ...c, key: slug(c.name) }));

export const commitmentsForTier = (tier) => {
  const idx = TIERS.indexOf(tier);
  return COMMITMENTS
    .map((c) => ({ ...c, value: c.vals[idx] }))
    .filter((c) => c.value !== 'x' && c.value !== 0);
};

const capacityOf = (kind) => (tier) => {
  const row = COMMITMENTS.find((c) => c.kind === kind);
  const v = row ? row.vals[TIERS.indexOf(tier)] : 0;
  return typeof v === 'number' ? v : 0;
};
export const ticketCapacity = capacityOf('tickets');
export const startupCapacity = capacityOf('startups');

export const STAGES = [
  { key: 'kickoff',    label: 'Kickoff',         color: '#78716C', desc: 'Onboarding inicial, recolección de datos' },
  { key: 'contract',   label: 'Contrato',        color: '#7A6E5D', desc: 'Negociación y firma del contrato' },
  { key: 'production', label: 'Producción',      color: '#8B5A3C', desc: 'Equipo creando piezas y artes' },
  { key: 'approvals',  label: 'Aprobaciones',    color: '#C93D0C', desc: 'Cliente revisando piezas' },
  { key: 'sponsoring', label: 'Apadrinamientos', color: '#2D5A87', desc: 'Confirmando startups apadrinadas' },
  { key: 'ready',      label: 'Listo p/ evento', color: '#1B4332', desc: 'Todo aprobado, esperando el día' },
  { key: 'post',       label: 'Post-evento',     color: '#0F1419', desc: 'Evidencias, NPS y cierre' },
];

export const CONTRACT_TYPES = ['StartCo', 'Cliente', 'Mixto'];
export const CONTRACT_STATUSES = ['No iniciado', 'Enviado', 'En revisión legal', 'Firmado'];

export const ASSET_STATUS = {
  produccion: { label: 'En producción', bg: '#F1ECDF', fg: '#7A6E5D' },
  pendiente:  { label: 'Pendiente',     bg: '#FFE4D6', fg: '#B33609' },
  aprobado:   { label: 'Aprobado',      bg: '#D4E5DB', fg: '#1B4332' },
  cambios:    { label: 'Cambios pedidos', bg: '#FDE2E2', fg: '#B42318' },
};

export const DAY_LABELS = { d1: 'Día 1', d2: 'Día 2', both: 'Ambos días' };
export const ATTENDEE_STATUS = { confirmado: 'Confirmado', invitado: 'Invitado', sin_abrir: 'Sin abrir' };

export const fmtCOP = (n) => '$' + Math.round(n / 1000000) + 'M';
export const fmtCOPfull = (n) => '$' + Number(n).toLocaleString('es-CO');
export const stripDiacritics = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const initialsOf = (name) => (name || '?').split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
