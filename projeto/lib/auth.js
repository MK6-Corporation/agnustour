'use strict';
/*
 * Autenticação do painel administrativo.
 * Usuário/senha definidos em ADMIN_USER / ADMIN_PASSWORD (variáveis de ambiente).
 * Se ADMIN_PASSWORD não existir, uma senha aleatória é gerada no primeiro uso,
 * gravada em data/.admin-password (permissão 600) e exibida no console.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./settings');

const SESSION_HOURS = 8;
const sessions = new Map(); // token -> { user, expires }
const attempts = new Map(); // ip -> { count, until }

function credentials() {
  const user = process.env.ADMIN_USER || 'admin';
  let pass = process.env.ADMIN_PASSWORD;
  if (!pass) {
    const file = path.join(DATA_DIR, '.admin-password');
    try {
      pass = fs.readFileSync(file, 'utf8').trim();
    } catch (_) {
      pass = crypto.randomBytes(12).toString('base64url');
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(file, pass + '\n', { mode: 0o600 });
      console.log(`\n[admin] Senha gerada para o usuário "${user}": ${pass}\n[admin] (salva em ${file}; defina ADMIN_PASSWORD para trocar)\n`);
    }
  }
  return { user, pass };
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function login(ip, user, pass) {
  const now = Date.now();
  const a = attempts.get(ip) || { count: 0, until: 0 };
  if (a.until > now) return { ok: false, error: 'Muitas tentativas. Aguarde alguns minutos.' };
  const c = credentials();
  if (safeEqual(user, c.user) && safeEqual(pass, c.pass)) {
    attempts.delete(ip);
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, { user: c.user, expires: now + SESSION_HOURS * 3600 * 1000 });
    return { ok: true, token, maxAge: SESSION_HOURS * 3600 };
  }
  a.count += 1;
  if (a.count >= 5) { a.until = now + 15 * 60 * 1000; a.count = 0; }
  attempts.set(ip, a);
  return { ok: false, error: 'Usuário ou senha incorretos.' };
}

function session(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(token); return null; }
  return s;
}

function logout(token) {
  sessions.delete(token);
}

module.exports = { login, session, logout, credentials };
