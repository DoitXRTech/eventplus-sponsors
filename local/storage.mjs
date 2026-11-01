// Solo local: imita los 4 endpoints de Supabase Storage que usa la app (subir, firmar URL,
// descargar firmado, borrar). Cada operacion corre en Postgres con el rol y el JWT del
// usuario, asi que las politicas reales de 0002_storage.sql deciden. Archivos en /tmp.
// Uso: node local/storage.mjs (puerto 5002; vite.config.js lo expone en /storage/v1).
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const env = Object.fromEntries(readFileSync(new URL('./local.env', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const SECRET = env.JWT_SECRET;
const DB = process.env.LOCAL_DB || 'sponsors_local';
const ROOT = '/tmp/sponsors-local-storage';
const PORT = Number(process.env.STORAGE_PORT || 5002);

const sign = (s) => createHmac('sha256', SECRET).update(s).digest('base64url');
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
function claimsOf(req) {
  const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
  const [h, p, s] = tok.split('.');
  if (!s || !same(sign(`${h}.${p}`), s)) return null;
  const c = JSON.parse(Buffer.from(p, 'base64url').toString());
  return c.exp * 1000 > Date.now() ? c : null;
}
const lit = (v) => { if (String(v).includes('$q$')) throw new Error('bad input'); return `$q$${v}$q$`; };
// Corre SQL como el usuario del JWT; un error de RLS sale como excepcion.
function asUser(claims, sql) {
  const role = claims.role === 'service_role' ? 'service_role' : 'authenticated';
  const script = `begin; set local role ${role}; select set_config('request.jwt.claims', ${lit(JSON.stringify(claims))}, true) \\g /dev/null
${sql}; commit;`;
  return execFileSync('psql', ['-h', '/tmp', '-d', DB, '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: script, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}
const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'access-control-allow-origin': '*' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};
const fail = (res, code, message) => send(res, code, { statusCode: String(code), error: code === 403 ? 'Unauthorized' : 'Error', message });
const readBody = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });
const filePath = (bucket, name) => join(ROOT, bucket, name);

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ''));
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }); return res.end(); }
    // Descarga firmada: no lleva JWT, la firma es la llave.
    let m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/);
    if (req.method === 'GET' && m) {
      const [bucket, name] = [m[1], m[2]];
      const [exp, sig] = (url.searchParams.get('token') || '').split('.');
      if (!sig || !same(sign(`${bucket}/${name}:${exp}`), sig) || Number(exp) < Date.now()) return fail(res, 400, 'invalid signature');
      if (!existsSync(filePath(bucket, name))) return fail(res, 404, 'Object not found');
      const meta = JSON.parse(readFileSync(filePath(bucket, name) + '.meta'));
      return send(res, 200, readFileSync(filePath(bucket, name)), meta.type || 'application/octet-stream');
    }
    const claims = claimsOf(req);
    if (!claims) return fail(res, 403, 'invalid jwt');
    if (req.method === 'POST' && m) {
      const [bucket, name] = [m[1], m[2]];
      const { expiresIn } = JSON.parse((await readBody(req)).toString() || '{}');
      const seen = asUser(claims, `select count(*) from storage.objects where bucket_id = ${lit(bucket)} and name = ${lit(name)}`);
      if (seen !== '1') return fail(res, 404, 'Object not found');
      const exp = Date.now() + Number(expiresIn || 60) * 1000;
      return send(res, 200, { signedURL: `/object/sign/${bucket}/${name}?token=${exp}.${sign(`${bucket}/${name}:${exp}`)}` });
    }
    m = p.match(/^\/object\/([^/]+)\/(.+)$/);
    if (req.method === 'POST' && m) {
      const [bucket, name] = [m[1], m[2]];
      const raw = await readBody(req);
      const form = await new Request('http://x', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: raw }).formData();
      const file = [...form.values()].find((v) => typeof v !== 'string');
      if (!file) return fail(res, 400, 'no file');
      if (file.size > 26214400) return fail(res, 413, 'Payload too large');
      try {
        asUser(claims, `insert into storage.objects (bucket_id, name) values (${lit(bucket)}, ${lit(name)})`);
      } catch (e) {
        const msg = e.stderr?.toString() || '';
        if (msg.includes('row-level security')) return fail(res, 403, 'new row violates row-level security policy');
        if (msg.includes('duplicate')) return fail(res, 409, 'The resource already exists');
        throw e;
      }
      mkdirSync(dirname(filePath(bucket, name)), { recursive: true });
      writeFileSync(filePath(bucket, name), Buffer.from(await file.arrayBuffer()));
      writeFileSync(filePath(bucket, name) + '.meta', JSON.stringify({ type: file.type }));
      return send(res, 200, { Key: `${bucket}/${name}` });
    }
    m = p.match(/^\/object\/([^/]+)$/);
    if (req.method === 'DELETE' && m) {
      const bucket = m[1];
      const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || '{}');
      const gone = prefixes.length ? asUser(claims, `delete from storage.objects where bucket_id = ${lit(bucket)} and name in (${prefixes.map(lit).join(',')}) returning name`).split('\n').filter(Boolean) : [];
      for (const name of gone) { try { unlinkSync(filePath(bucket, name)); unlinkSync(filePath(bucket, name) + '.meta'); } catch { /* ya no estaba */ } }
      return send(res, 200, gone.map((name) => ({ name })));
    }
    return fail(res, 404, 'not found');
  } catch (e) {
    console.error(e.stderr?.toString() || e.message);
    return fail(res, 500, 'internal');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`storage local en :${PORT}`));
