// Solo local: firma las llaves anon y service_role con el JWT_SECRET de local/local.env.
// Uso: node local/keys.mjs anon|service
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('./local.env', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const role = process.argv[2] === 'service' ? 'service_role' : 'anon';
const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, iss: 'local', iat: 1700000000, exp: 2000000000 })}`;
process.stdout.write(`${body}.${createHmac('sha256', env.JWT_SECRET).update(body).digest('base64url')}`);
