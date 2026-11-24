'use strict';
/*
 * Agnus Tour — site de peregrinações + captação e qualificação de leads.
 * Node.js 18+ sem dependências externas.  Iniciar:  node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const settings = require('./lib/settings');
const store = require('./lib/store');
const auth = require('./lib/auth');
const { publicTrips } = require('./lib/trips');
const { tripCards, partnerLogo, photoCredits, gallery, heroVideos } = require('./lib/render');
const { buildLead, ValidationError, toCsv, filterLeads } = require('./lib/leads');
const { sendWebhook, googleReviews, instagramFeed } = require('./lib/integrations');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const COOKIE = 'agnus_admin';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.instagram.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://*.googleusercontent.com https://*.cdninstagram.com https://*.fbcdn.net https://www.instagram.com",
  "media-src 'self'",
  "frame-src https://www.instagram.com",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

function baseHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
  res.end(data);
}

function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isHttps(req) {
  return req.socket.encrypted || (TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https') || process.env.COOKIE_SECURE === '1';
}

function readJson(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    if (!String(req.headers['content-type'] || '').includes('application/json')) {
      return reject(Object.assign(new Error('Content-Type deve ser application/json'), { status: 415 }));
    }
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Requisição muito grande'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (_) {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/* ---------- Limite de envios por IP (anti-spam) ---------- */
const hits = new Map();
function rateLimited(ip, max = Number(process.env.LEAD_RATE_LIMIT || 12), windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (!list.some((t) => now - t < 10 * 60 * 1000)) hits.delete(ip);
}, 60 * 1000).unref();

/* ---------- Arquivos estáticos ---------- */
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Proibido', 'text/plain');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (!path.extname(rel)) {
        // /privacidade -> /privacidade.html
        return fs.stat(file + '.html', (e2, st2) => (e2 || !st2.isFile() ? notFound(res) : stream(res, file + '.html', st2)));
      }
      return notFound(res);
    }
    stream(res, file, st);
  });
}
function stream(res, file, st) {
  const ext = path.extname(file).toLowerCase();
  const cache = ext === '.html' ? 'no-cache' : 'public, max-age=86400';
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache, 'Accept-Ranges': 'bytes' };
  // Safari/iPhone só toca vídeo se o servidor aceitar pedidos parciais (Range)
  const m = /^bytes=(\d*)-(\d*)$/.exec((res.req && res.req.headers.range) || '');
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
    let end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  fs.createReadStream(file).pipe(res);
}
/** Página inicial com os cards das viagens renderizados no servidor (SEO). */
let homeTpl = null;
function serveHome(res) {
  if (!homeTpl || process.env.NODE_ENV !== 'production') homeTpl = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const s = settings.load();
  const html = homeTpl
    .replace('<!--TRIP_CARDS-->', tripCards())
    .replace('{{PARTNER_LOGO}}', partnerLogo((rel) => '/' + rel))
    .replace('{{GALLERY}}', gallery())
    .replace('{{HERO_VIDEOS}}', heroVideos())
    .replace('{{PHOTO_CREDITS}}', photoCredits())
    .replace(/\{\{WHATSAPP\}\}/g, s.whatsappNumber)
    .replace(/\{\{GOOGLE_RATING\}\}/g, Number(s.google.rating).toFixed(1).replace('.', ','))
    .replace(/\{\{GOOGLE_COUNT\}\}/g, String(s.google.reviewCount))
    .replace(/\{\{GOOGLE_URL\}\}/g, s.google.mapsUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;'));
  send(res, 200, html, 'text/html; charset=utf-8', { 'Cache-Control': 'no-cache' });
}

function notFound(res) {
  const f = path.join(PUBLIC, '404.html');
  fs.readFile(f, (e, data) => send(res, 404, e ? 'Página não encontrada' : data, 'text/html; charset=utf-8'));
}

/* ---------- Rotas ---------- */
async function handle(req, res) {
  baseHeaders(res);
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const method = req.method;

  // ----- API pública -----
  if (p === '/api/config' && method === 'GET') {
    const s = settings.load();
    return send(res, 200, {
      whatsappNumber: s.whatsappNumber,
      trips: publicTrips(true),
      scoring: { points: s.points, categoryMax: s.categoryMax, thresholds: s.thresholds, referencePrices: s.referencePrices, budgetTiers: s.budgetTiers },
    });
  }

  if (p === '/api/leads' && method === 'POST') {
    const ip = clientIp(req);
    if (rateLimited(ip)) return send(res, 429, { error: 'Muitos envios em sequência. Aguarde alguns minutos e tente novamente.' });
    let body;
    try {
      body = await readJson(req);
    } catch (e) {
      return send(res, e.status || 400, { error: e.message });
    }
    // Honeypot anti-robô: campo invisível para pessoas
    if (body.website) return send(res, 200, { ok: true });
    const s = settings.load();
    let lead;
    try {
      lead = buildLead(body, s, { userAgent: req.headers['user-agent'] });
    } catch (e) {
      if (e instanceof ValidationError) return send(res, 422, { error: e.message, fields: e.fields });
      throw e;
    }
    // 1) Salva em disco ANTES de responder
    const { lead: saved, duplicate } = await store.insert(lead);
    send(res, duplicate ? 200 : 201, {
      ok: true,
      id: saved.id,
      duplicate,
      tripName: saved.trip.name,
    });
    // 2) Envia ao CRM/webhook depois (não bloqueia o visitante)
    if (!duplicate && s.webhook.enabled) {
      sendWebhook(saved, s)
        .then((r) => store.update(saved.id, { webhook: r }))
        .catch((e) => console.error('[webhook]', e.message));
    }
    return;
  }

  if (p === '/api/reviews' && method === 'GET') {
    return send(res, 200, await googleReviews(settings.load()));
  }
  if (p === '/api/instagram' && method === 'GET') {
    return send(res, 200, await instagramFeed(settings.load()));
  }

  // ----- Painel administrativo -----
  if (p === '/api/admin/login' && method === 'POST') {
    let body;
    try {
      body = await readJson(req, 4096);
    } catch (e) {
      return send(res, e.status || 400, { error: e.message });
    }
    const r = auth.login(clientIp(req), String(body.user || ''), String(body.password || ''));
    if (!r.ok) return send(res, 401, { error: r.error });
    const secure = isHttps(req) ? '; Secure' : '';
    return send(res, 200, { ok: true }, undefined, {
      'Set-Cookie': `${COOKIE}=${r.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${r.maxAge}${secure}`,
    });
  }

  if (p.startsWith('/api/admin/')) {
    const token = cookies(req)[COOKIE];
    const sess = auth.session(token);
    if (!sess) return send(res, 401, { error: 'Sessão expirada. Faça login novamente.' });

    if (p === '/api/admin/logout' && method === 'POST') {
      auth.logout(token);
      return send(res, 200, { ok: true }, undefined, { 'Set-Cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
    }
    if (p === '/api/admin/me' && method === 'GET') return send(res, 200, { user: sess.user });

    const query = Object.fromEntries(url.searchParams);
    if (p === '/api/admin/leads' && method === 'GET') {
      const all = store.all();
      const list = filterLeads(all, query);
      const counts = { total: list.length, quente: 0, morno: 0, frio: 0 };
      for (const l of list) counts[l.score.classification]++;
      return send(res, 200, { counts, leads: list, trips: publicTrips().map((t) => ({ id: t.id, name: t.name })) });
    }
    if (p === '/api/admin/leads.csv' && method === 'GET') {
      const list = filterLeads(store.all(), query);
      const stamp = new Date().toISOString().slice(0, 10);
      return send(res, 200, toCsv(list), 'text/csv; charset=utf-8', {
        'Content-Disposition': `attachment; filename="leads-agnus-tour-${stamp}.csv"`,
      });
    }
    const resend = p.match(/^\/api\/admin\/leads\/([0-9a-f-]{36})\/webhook$/);
    if (resend && method === 'POST') {
      const lead = store.all().find((l) => l.id === resend[1]);
      if (!lead) return send(res, 404, { error: 'Lead não encontrado.' });
      const r = await sendWebhook(lead, settings.load());
      await store.update(lead.id, { webhook: r });
      return send(res, 200, r);
    }
    if (p === '/api/admin/settings' && method === 'GET') {
      return send(res, 200, { settings: settings.forAdmin(), defaults: settings.defaults(), trips: require('./lib/trips').TRIPS, categories: require('./lib/trips').CATEGORIES, env: {
        googlePlaces: Boolean(process.env.GOOGLE_PLACES_API_KEY && process.env.GOOGLE_PLACE_ID),
        instagramApi: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN),
      } });
    }
    if (p === '/api/admin/settings' && method === 'PUT') {
      let body;
      try {
        body = await readJson(req, 64 * 1024);
        await settings.save(body);
      } catch (e) {
        return send(res, e.status || 400, { error: e.message });
      }
      return send(res, 200, { ok: true, settings: settings.forAdmin() });
    }
    if (p === '/api/admin/webhook-test' && method === 'POST') {
      const s = settings.load();
      if (!s.webhook.enabled) return send(res, 400, { error: 'Ative e salve o webhook antes de testar.' });
      const sample = { id: 'teste', trip: { id: 'teste', name: 'Teste de integração' }, score: { total: 0, classification: 'frio' } };
      return send(res, 200, await sendWebhook(sample, s, { test: true }));
    }
    return send(res, 404, { error: 'Rota não encontrada.' });
  }

  if (p.startsWith('/api/')) return send(res, 404, { error: 'Rota não encontrada.' });
  if (method !== 'GET' && method !== 'HEAD') return send(res, 405, 'Método não permitido', 'text/plain');
  if (p === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
  if (p === '/' || p === '/index.html') return serveHome(res);
  return serveStatic(req, res, p);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error('[erro]', e);
    if (!res.headersSent) send(res, 500, { error: 'Erro interno. Tente novamente em instantes.' });
  });
});

if (require.main === module) {
  auth.credentials(); // garante senha do painel
  store.all(); // valida o arquivo de leads na inicialização
  server.listen(PORT, () => console.log(`Agnus Tour rodando em http://localhost:${PORT}  ·  painel: /admin/`));
}

module.exports = { server };
