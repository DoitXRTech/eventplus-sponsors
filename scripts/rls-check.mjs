#!/usr/bin/env node
// Prueba las reglas de acceso por el camino real: login en Auth y consultas por la API REST,
// con la llave publica (la misma que usa el navegador). Modifica datos: correr el seed despues.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/rls-check.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { SPONSORS } from './seed-data.mjs';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const password = process.env.DEMO_PASSWORD || readFileSync('.demo-credentials', 'utf8').split('\n')[0].split(': ')[1];
const BC = SPONSORS[0].id, GEB = SPONSORS[1].id, BAV = SPONSORS[4].id;

let failed = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${name}${extra ? ` (${extra})` : ''}`);
};
const client = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
async function login(email) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

const pub = client();
{
  const { data } = await pub.from('sponsors').select('id');
  check('anonimo no ve patrocinadores', (data || []).length === 0, `${(data || []).length} filas`);
}

const team = await login('juanga@startco.example');
const bc = await login('bc@sponsor.example');
const su = await login('su@sponsor.example');
const bv = await login('bv@sponsor.example');
const { data: { user: bcUser } } = await bc.auth.getUser();
const { data: { user: teamUser } } = await team.auth.getUser();

{
  const { data } = await team.from('sponsors').select('id');
  check('equipo ve los 7 patrocinadores de ejemplo', SPONSORS.every((x) => data?.some((d) => d.id === x.id)), `${data?.length}`);
  const { data: mine } = await bc.from('sponsors').select('id');
  check('Bancolombia ve solo su patrocinio', mine?.length === 1 && mine[0].id === BC);
  const { data: att } = await bc.from('attendees').select('sponsor_id');
  check('Bancolombia ve solo sus inscritos', att.length > 0 && att.every((a) => a.sponsor_id === BC), `${att.length}`);
  const { data: suAssets } = await su.from('assets').select('id');
  check('Sura no ve piezas que siguen en producción interna', suAssets.length === 0, `${suAssets.length}`);
  const { data: prospects } = await bc.from('prospects').select('id');
  check('patrocinador no ve prospectos comerciales', prospects.length === 0);
  const { data: profs } = await bc.from('profiles').select('kind, sponsor_id');
  check('patrocinador no ve contactos de otros patrocinadores', profs.every((p) => p.kind === 'team' || p.sponsor_id === BC));
}

{
  const ins = await team.from('comments').insert({ sponsor_id: BC, author_id: teamUser.id, author_name: 'JuanGa', author_role: 'Comercial', team: 'startco', body: 'Nota interna de prueba', internal: true }).select().single();
  check('equipo crea nota interna', !ins.error, ins.error?.message);
  const { data } = await bc.from('comments').select('id, internal');
  check('patrocinador no ve notas internas', !data.some((c) => c.internal || c.id === ins.data?.id));
  const { data: act } = await bc.from('activity').select('internal');
  check('patrocinador no ve actividad interna', act.every((a) => !a.internal));
}

{
  const fake = await bc.from('comments').insert({ sponsor_id: BC, author_id: bcUser.id, author_name: 'JuanGa', author_role: 'Comercial', team: 'startco', body: 'suplantando' });
  check('patrocinador no puede escribir como el equipo', !!fake.error);
  const internal = await bc.from('comments').insert({ sponsor_id: BC, author_id: bcUser.id, author_name: 'X', team: 'sponsor', body: 'x', internal: true });
  check('patrocinador no puede crear notas internas', !!internal.error);
  const other = await bc.from('comments').insert({ sponsor_id: GEB, author_id: bcUser.id, author_name: 'X', team: 'sponsor', body: 'x' });
  check('patrocinador no escribe en la conversación de otro', !!other.error);
  const ok = await bc.from('comments').insert({ sponsor_id: BC, author_id: bcUser.id, author_name: 'María Camila Restrepo', author_role: 'Bancolombia', team: 'sponsor', body: 'Mensaje de prueba' });
  check('patrocinador escribe en su conversación', !ok.error, ok.error?.message);
}

{
  const up = await bc.from('sponsors').update({ stage: 'ready' }).eq('id', BC).select();
  check('patrocinador no puede mover su etapa', (up.data || []).length === 0);
  const prof = await bc.from('profiles').update({ kind: 'team', sponsor_id: null }).eq('id', bcUser.id).select();
  check('patrocinador no puede volverse equipo', (prof.data || []).length === 0);
  const mv = await team.from('sponsors').update({ stage: 'ready' }).eq('id', BC).select('stage, stage_changed_at').single();
  check('equipo mueve la etapa', mv.data?.stage === 'ready' && Date.now() - new Date(mv.data.stage_changed_at) < 60000, mv.error?.message);
  await team.from('sponsors').update({ stage: 'approvals' }).eq('id', BC);
}

{
  const { data: pend } = await bc.from('assets').select('id, name').eq('status', 'pendiente');
  const noNote = await bc.rpc('review_asset', { p_asset: pend[0].id, p_decision: 'cambios', p_note: '' });
  check('pedir cambios sin nota se rechaza', !!noNote.error);
  const r1 = await bc.rpc('review_asset', { p_asset: pend[0].id, p_decision: 'aprobado', p_note: null });
  check('patrocinador aprueba su pieza', r1.data?.status === 'aprobado', r1.error?.message);
  const r2 = await bc.rpc('review_asset', { p_asset: pend[1].id, p_decision: 'cambios', p_note: 'Logo más grande, por favor' });
  check('patrocinador pide cambios con nota', r2.data?.status === 'cambios', r2.error?.message);
  const again = await bc.rpc('review_asset', { p_asset: pend[0].id, p_decision: 'cambios', p_note: 'x' });
  check('una pieza ya revisada no se vuelve a revisar', !!again.error);
  const { data: auto } = await bc.from('comments').select('body').eq('context_label', pend[1].name).order('created_at', { ascending: false }).limit(1);
  check('la decisión queda en la conversación', auto?.[0]?.body?.startsWith('Pido cambios'));
  const { data: gebAsset } = await team.from('assets').select('id').eq('sponsor_id', GEB).limit(1);
  const cross = await bc.rpc('review_asset', { p_asset: gebAsset[0].id, p_decision: 'aprobado' });
  check('patrocinador no revisa piezas de otro', !!cross.error);
}

{
  const full = await bc.from('sponsored_startups').insert({ sponsor_id: BC, name: 'Sexta', sector: 'X' });
  check('no se pasa el cupo de apadrinamientos', full.error?.message?.includes('APADRINAMIENTOS_LLENOS'), full.error?.message);
  const dup = await bc.from('attendees').insert({ sponsor_id: BC, name: 'Repetido', email: (await bc.from('attendees').select('email').limit(1)).data[0].email.toUpperCase() });
  check('no se repite un inscrito (mismo email)', !!dup.error);
  const add = await bc.from('attendees').insert({ sponsor_id: BC, name: 'Persona Nueva', email: 'nueva@bancolombia.example', day: 'd1' }).select().single();
  check('patrocinador agrega un inscrito', !add.error, add.error?.message);
  const other = await bc.from('attendees').insert({ sponsor_id: GEB, name: 'Intruso', email: 'x@x.example' });
  check('patrocinador no agrega inscritos a otro', !!other.error);
}

{
  const contrato = await bc.from('documents').insert({ sponsor_id: BC, kind: 'contrato', name: 'falso.pdf' });
  check('patrocinador no sube contratos', !!contrato.error);
  const verified = await bc.from('documents').insert({ sponsor_id: BC, kind: 'legal', name: 'rut.pdf', verified: true });
  check('patrocinador no marca documentos como verificados', !!verified.error);
  const legal = await bc.from('documents').insert({ sponsor_id: BC, kind: 'legal', name: 'RUT_actualizado.pdf' });
  check('patrocinador sube documento legal', !legal.error, legal.error?.message);
  const logo = await bc.rpc('set_sponsor_logo', { p_sponsor: GEB, p_path: `${GEB}/logo/x.png` });
  check('patrocinador no cambia el logo de otro', !!logo.error);
  const crossPath = await bc.from('documents').insert({ sponsor_id: BC, kind: 'legal', name: 'ajeno.pdf', file_path: `${GEB}/contrato/x.pdf` });
  check('un documento no apunta al archivo de otro patrocinador', !!crossPath.error);
  const wrongFolder = await bc.from('documents').insert({ sponsor_id: BC, kind: 'legal', name: 'raro.pdf', file_path: `${BC}/contrato/x.pdf` });
  check('un documento no apunta a otra carpeta', !!wrongFolder.error);
  const logoFolder = await bc.rpc('set_sponsor_logo', { p_sponsor: BC, p_path: `${BC}/legal/x.png` });
  check('el logo solo sale de la carpeta logo', !!logoFolder.error);
  const teamCross = await team.from('assets').insert({ sponsor_id: BC, name: 'cruzada', file_path: `${GEB}/piezas/x.png` });
  check('ni el equipo cruza archivos entre patrocinadores', !!teamCross.error);
}

{
  const { data: prop } = await bv.from('proposals').select('id, status').eq('sponsor_id', BAV).order('version', { ascending: false }).limit(1);
  const r = await bv.rpc('review_proposal', { p_proposal: prop[0].id, p_decision: 'aprobada' });
  check('patrocinador aprueba la propuesta vigente', r.data?.status === 'aprobada', r.error?.message);
  const ins = await bv.from('proposals').insert({ sponsor_id: BAV, version: 9, note: 'x' });
  check('patrocinador no crea propuestas', !!ins.error);
}

{
  const c = client();
  const email = `curioso${Date.now()}@example.com`;
  const s = await c.auth.signUp({ email, password: 'Prueba-123456' });
  if (s.error || !s.data.session) {
    check('registro abierto sin perfil no ve nada', true, `sin sesión tras registrarse: ${s.error?.message || 'requiere confirmar email'}`);
  } else {
    const { data } = await c.from('sponsors').select('id');
    const { data: com } = await c.from('comments').select('id');
    check('registro abierto sin perfil no ve nada', data.length === 0 && com.length === 0);
  }
}

console.log(failed ? `\n${failed} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(failed ? 1 : 0);
