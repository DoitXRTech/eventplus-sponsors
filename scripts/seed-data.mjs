// Datos de ejemplo del prototipo original (artefacto de Claude, OPA-572), ajustados:
// fechas relativas a hoy, sin guiones largos, y piezas con estados coherentes.
// Los ids son fijos para que scripts/create-users.mjs pueda ligar cada usuario a su patrocinador.

export const EVENT = {
  id: '00000000-0000-4000-8000-000000000001',
  // Id fijo de la organizacion StartCo (0005_multitenant.sql). events.organization_id
  // es NOT NULL: sin este valor el insert falla antes de llegar al "on conflict".
  organizationId: '00000000-0000-4000-8000-000000000001',
  name: 'StartCo 2026',
  city: 'Medellín',
  venue: 'Plaza Mayor Medellín',
  startInDays: 47, // el prototipo hablaba de "a 47 días del evento"
  lengthDays: 2,
};

const sid = (n) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;

export const TEAM = [
  { key: 'juanga',   full_name: 'JuanGa',            title: 'Lead Comercial', email: 'juanga@startco.example' },
  { key: 'carolina', full_name: 'Carolina (Diseño)', title: 'Diseño',         email: 'carolina@startco.example' },
  { key: 'mariana',  full_name: 'Mariana (Producción)', title: 'Producción',  email: 'mariana@startco.example' },
];

// c: [autor ('juanga'|'carolina'|'sponsor'), dias atras, hora, texto, contexto?, adjunto?]
export const SPONSORS = [
  {
    id: sid(1), name: 'Bancolombia', initials: 'BC', tier: 'Partner', stage: 'approvals', daysInStage: 4,
    sector: 'Servicios Financieros',
    contact: { name: 'María Camila Restrepo', role: 'Directora Innovación', email: 'mcamila.restrepo@bancolombia.example', phone: '+57 300 555 1122' },
    legal: { razon: 'Bancolombia S.A.', rut: '890.903.938-8', domicilio: 'Medellín', cc: 'Vigente' },
    hubspot: { contacts: 7, segments: ['Marca', 'Patrocinios', 'Innovación'] },
    proposalVersions: 3, contract: { type: 'Cliente', status: 'Firmado', signedDaysAgo: 30 }, logo: true,
    assets: [
      ['Pieza redes sociales: Día 1', 'aprobado', 6],
      ['Render stand 20 m²', 'pendiente', 2],
      ['Cápsula video colaborativo', 'pendiente', 1],
      ['Imagen escarapela', 'aprobado', 9],
    ],
    startups: [['Truora', 'KYC'], ['Habi', 'PropTech'], ['Frubana', 'AgriFood'], ['Liftit', 'Logística'], ['Merqueo', 'eGrocery']],
    attendees: 16,
    comments: [
      ['juanga', 3, '10:14', '¡Hola, María Camila! Subimos el render del stand de 20 m². Cuando puedas, échale un ojo y nos confirmas para mandarlo a producción.', ['arte', 'Render stand 20 m²']],
      ['sponsor', 3, '14:32', 'Recibido, Juan, lo veo hoy mismo. Una pregunta rápida: ¿el área de la barra de café está incluida en los 20 m² o es aparte?'],
      ['carolina', 3, '14:48', 'Hola, María Camila: la barra está incluida. Te dejo el plano en alta resolución para que lo veas con el equipo.', null, ['plano_stand_v2.pdf', 1258291]],
      ['sponsor', 2, '09:05', 'Perfecto. La pieza de redes del Día 1 ya quedó aprobada. Reviso el render con el equipo y lo apruebo desde el portal. Sigo esperando el guion de la cápsula.'],
      ['juanga', 2, '09:12', 'Listo, hoy en la tarde te paso el guion de la cápsula y la pieza de redes del Día 2. Gracias por la rapidez.'],
    ],
  },
  {
    id: sid(2), name: 'Grupo Energía Bogotá', initials: 'GEB', tier: 'Unicorn', stage: 'sponsoring', daysInStage: 5,
    sector: 'Energía',
    contact: { name: 'Andrés Felipe Cárdenas', role: 'Gerente de Innovación', email: 'afcardenas@geb.example', phone: '+57 310 222 8899' },
    legal: { razon: 'Grupo Energía Bogotá S.A. ESP', rut: '899.999.082-3', domicilio: 'Bogotá', cc: 'Vigente' },
    hubspot: { contacts: 5, segments: ['Energytech', 'Patrocinios'] },
    proposalVersions: 2, contract: { type: 'StartCo', status: 'Firmado', signedDaysAgo: 35 }, logo: true,
    assets: [
      ['Pieza redes: convocatoria Stars Up', 'aprobado', 14],
      ['Render stand 16 m²', 'aprobado', 12],
      ['Pieza Newsletter #1', 'aprobado', 10],
    ],
    startups: [['SPACE AG', 'AgriEnergy'], ['Hooil', 'CleanTech'], ['Volt', 'Movilidad'], ['EcoSmart', 'Eficiencia']],
    attendees: 78,
    comments: [
      ['juanga', 10, '11:00', 'Andrés, las 3 piezas de la convocatoria Stars Up x StartCo están aprobadas. Excelente trabajo.'],
      ['sponsor', 8, '16:21', 'Equipo, ¿la pieza de redes para la convocatoria está alineada con la fecha de cierre de aplicaciones?'],
      ['juanga', 8, '17:02', 'Sí, todo cuadrado. El martes te paso el reporte de tracción.'],
      ['sponsor', 5, '08:45', 'Para los 4 apadrinamientos confirmamos: SPACE AG, Hooil, Volt y EcoSmart. ¿Necesitan algo adicional de nosotros?'],
      ['juanga', 5, '09:30', 'Confirmadas las 4 en el sistema. Solo falta cargar los logos de cada una para los stands. Te paso el formato hoy.', ['apadrinamiento', '4 apadrinamientos']],
    ],
  },
  {
    id: sid(3), name: 'Sura', initials: 'SU', tier: 'Partner', stage: 'production', daysInStage: 8,
    sector: 'Seguros',
    contact: { name: 'Juliana Posada', role: 'Directora Brand & Comms', email: 'juliana.posada@sura.example', phone: '+57 315 888 4400' },
    legal: { razon: 'Suramericana S.A.', rut: '811.012.271-9', domicilio: 'Medellín', cc: 'Vigente' },
    hubspot: { contacts: 6, segments: ['Marca', 'Patrocinios', 'Insurtech'] },
    proposalVersions: 2, contract: { type: 'Cliente', status: 'Firmado', signedDaysAgo: 40 }, logo: true,
    assets: [
      ['Pieza redes: Día 1', 'produccion', null],
      ['Pieza redes: Día 2', 'produccion', null],
      ['Render stand 20 m²', 'produccion', null],
      ['Cápsula 1 min colaborativa', 'produccion', null],
    ],
    startups: [],
    attendees: 0,
    comments: [
      ['juanga', 38, '09:00', '¡Bienvenidos al equipo StartCo! Esta semana arrancamos producción de las piezas. Te paso el brief el miércoles.'],
      ['sponsor', 37, '14:18', 'Perfecto, Juan. Atentos. Una nota: para la cápsula colaborativa nos gustaría tocar el ángulo de insurtech y microseguros. Hablamos.'],
      ['carolina', 6, '10:30', 'Hola, Juliana: ya estamos en bocetos de las 4 piezas. La próxima semana subimos la primera ronda para tu revisión.'],
    ],
  },
  {
    id: sid(4), name: 'Celsia', initials: 'CL', tier: 'Serie B', stage: 'contract', daysInStage: 2,
    sector: 'Energía',
    contact: { name: 'Laura Hincapié', role: 'Líder Open Innovation', email: 'laura.hincapie@celsia.example', phone: '+57 304 998 1100' },
    legal: { razon: 'Celsia S.A. E.S.P.', rut: '811.000.231-1', domicilio: 'Medellín', cc: 'Vigente' },
    hubspot: { contacts: 4, segments: ['Energytech', 'Spinoffs'] },
    proposalVersions: 2, contract: { type: 'StartCo', status: 'En revisión legal' }, logo: false,
    assets: [],
    startups: [['Enerbit', 'Energía'], ['Solenium', 'Solar'], ['WattCo', 'Smart Grid']],
    attendees: 0,
    comments: [
      ['juanga', 6, '15:40', 'Laura, te paso el contrato en su versión final. Cuando puedan, revísenlo con legal y nos confirman.', ['contrato', 'Contrato Serie B v2'], ['contrato_celsia_v2.pdf', 430080]],
      ['sponsor', 3, '10:12', 'Recibido. Legal lo está revisando. Probablemente nos pidan ajustar la cláusula de exclusividad sectorial. Te confirmo esta semana.'],
      ['juanga', 2, '09:00', 'Sin problema. Quedo atento.'],
    ],
  },
  {
    id: sid(5), name: 'Bavaria', initials: 'BV', tier: 'Serie A', stage: 'kickoff', daysInStage: 1,
    sector: 'Consumo Masivo',
    contact: { name: 'Sebastián Ortiz', role: 'Brand Manager', email: 'sebastian.ortiz@bavaria.example', phone: '+57 320 444 5566' },
    legal: { razon: 'Bavaria S.A.', rut: '860.005.224-6', domicilio: 'Bogotá', cc: 'Por validar' },
    hubspot: { contacts: 3, segments: ['Marca', 'Eventos'] },
    proposalVersions: 1, proposalPending: true, contract: { type: 'Pendiente', status: 'No iniciado' }, logo: false,
    noLegalDocs: true,
    assets: [],
    startups: [['Pibox', 'Logística'], ['Bemtevi', 'B2B Sales']],
    attendees: 0,
    comments: [
      ['juanga', 1, '11:20', 'Hola, Sebastián: gracias por confirmar StartCo 2026. En el portal puedes cargar el RUT y la Cámara de Comercio para arrancar, y revisar la propuesta.'],
      ['sponsor', 1, '12:05', 'Listo, Juan, hoy mismo te paso todo. Los apadrinamientos los manejamos con mi equipo; te aviso para una llamada.'],
    ],
  },
  {
    id: sid(6), name: 'EPM', initials: 'EM', tier: 'Serie B', stage: 'ready', daysInStage: 3,
    sector: 'Servicios Públicos',
    contact: { name: 'Mateo Gómez', role: 'Líder de Innovación Abierta', email: 'mateo.gomez@epm.example', phone: '+57 310 555 9911' },
    legal: { razon: 'Empresas Públicas de Medellín E.S.P.', rut: '890.904.996-1', domicilio: 'Medellín', cc: 'Vigente' },
    hubspot: { contacts: 4, segments: ['Energytech', 'Innovación'] },
    proposalVersions: 1, contract: { type: 'Cliente', status: 'Firmado', signedDaysAgo: 45 }, logo: true,
    assets: [
      ['Pieza redes: Día 1', 'aprobado', 9],
      ['Render stand 12 m²', 'aprobado', 8],
      ['Pieza Newsletter', 'aprobado', 7],
    ],
    startups: [['EnerVerse', 'Smart Grid'], ['AquaBot', 'AguaTech'], ['GridSense', 'IoT Energía']],
    attendees: 12,
    comments: [
      ['sponsor', 4, '17:00', 'Equipo, ya tenemos todo aprobado de nuestro lado. Avisen cuándo cargan inscritos para empezar a movilizar al equipo.'],
      ['juanga', 3, '08:40', 'Mateo, ya puedes cargar inscritos desde tu portal. Te avisamos en cuanto el contador supere 50.'],
    ],
  },
  {
    id: sid(7), name: 'Rappi', initials: 'RP', tier: 'Unicorn', stage: 'post', daysInStage: 0,
    sector: 'Tech / Delivery',
    contact: { name: 'Andrea Salcedo', role: 'Head of B2B Marketing', email: 'andrea.salcedo@rappi.example', phone: '+57 311 999 4422' },
    legal: { razon: 'Rappi S.A.S.', rut: '901.220.000-1', domicilio: 'Bogotá', cc: 'Vigente' },
    hubspot: { contacts: 8, segments: ['Marca', 'Tech', 'Patrocinios'] },
    proposalVersions: 1, contract: { type: 'Cliente', status: 'Firmado', signedDaysAgo: 60 }, logo: true,
    assets: [
      ['Pieza redes: Día 1', 'aprobado', 20],
      ['Pieza redes: Día 2', 'aprobado', 20],
      ['Render stand 16 m²', 'aprobado', 18],
      ['Newsletter #1', 'aprobado', 16],
      ['Newsletter #2', 'aprobado', 15],
      ['Imagen escarapela', 'aprobado', 14],
    ],
    startups: [['Robinfood', 'CloudKitchen'], ['Chiper', 'B2B Retail'], ['Treble', 'WhatsApp'], ['Foodology', 'CloudKitchen']],
    attendees: 145,
    post: { nps: 9.4, quote: 'Volveríamos sin pensarlo. Las apadrinadas fueron oro y la pieza en redes superó nuestras métricas del trimestre.', views: 480000 },
    comments: [
      ['juanga', 3, '08:00', '¡Andrea, qué evento! Subimos las evidencias de los dos días. Aviso cuando completemos las métricas finales.'],
      ['sponsor', 3, '19:30', 'Volveríamos sin pensarlo. Las apadrinadas fueron oro y la pieza en redes superó nuestras métricas del trimestre. Encuesta llenada.'],
      ['juanga', 1, '10:15', 'NPS 9,4: el más alto del evento. Compartimos casos de éxito en LinkedIn esta semana.'],
    ],
  },
];

export const PROSPECTS = [
  ['Tigo Une', 'Negociación', 'Serie A', 'Diana Marcela Pérez', 6],
  ['Davivienda', 'Propuesta', 'Seed', 'Carolina Mejía', 3],
  ['Postobón', 'Prospección', 'Preseed', 'Juan Pablo Vélez', 11],
];

export const PROPOSAL_NOTES = [
  'Propuesta inicial enviada al cliente.',
  'Ajuste: apadrinamientos extra solicitados por el cliente.',
  'Versión final con descuento del 15%.',
];

// Generador deterministico de inscritos (mismo algoritmo que el prototipo).
const FIRST = ['Andrés','María','Carlos','Laura','Juan','Ana','Diego','Camila','Felipe','Valentina','Sebastián','Daniela','Mateo','Sofía','Santiago','Isabela','Nicolás','Mariana','Alejandro','Catalina','Esteban','Paula','Tomás','Manuela','David','Luisa','Samuel','Natalia','Daniel','Sara','Gabriel','Ximena','Pablo','Verónica','Ricardo','Adriana'];
const LAST = ['Restrepo','Gómez','García','Martínez','Rodríguez','Hernández','López','Pérez','Sánchez','Ramírez','Torres','Flores','Rivera','Cárdenas','Mejía','Posada','Hincapié','Ortiz','Vélez','Jaramillo','Ospina','Henao','Arango','Echavarría','Salazar','Castaño','Quintero','Álvarez','Moreno','Correa'];
const ROLES = ['Innovation Lead','Brand Manager','Marketing Director','Product Manager','BD Manager','Strategy Lead','CFO','CMO','Digital Lead','Partnerships','Operations','Sales Director','Open Innovation Lead','Data Lead','UX Lead','Platform Lead','VP Engineering','Head of Growth','Customer Success','Finance Director'];
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function generateAttendees(sponsor, index) {
  const seed = index + 1 + 48; // el prototipo usaba charCodeAt(1) de "s1".."s7"
  const domain = plain(sponsor.name).replace(/\s+/g, '') + '.example';
  const out = [];
  const seen = new Set();
  for (let i = 0; i < sponsor.attendees; i++) {
    const f = FIRST[(seed * 7 + i * 13) % FIRST.length];
    const l = LAST[(seed * 11 + i * 17) % LAST.length];
    let email = `${plain(f)}.${plain(l)}@${domain}`;
    for (let k = 2; seen.has(email); k++) email = `${plain(f)}.${plain(l)}${k}@${domain}`;
    seen.add(email);
    const d = (seed * 3 + i * 23) % 10;
    out.push({
      name: `${f} ${l}`,
      email,
      role: ROLES[(seed * 5 + i * 19) % ROLES.length],
      day: d < 3 ? 'd1' : d < 6 ? 'd2' : 'both',
      status: i < sponsor.attendees * 0.78 ? 'confirmado' : i < sponsor.attendees * 0.95 ? 'invitado' : 'sin_abrir',
      daysAgo: [0, 0, 1, 2, 4, 7, 14, 21][(i + seed) % 8],
    });
  }
  return out;
}
