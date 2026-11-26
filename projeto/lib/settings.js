'use strict';
const fs = require('fs');
const path = require('path');
const { TRIPS, CATEGORIES } = require('./trips');
const { writeJsonAtomic } = require('./fsutil');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'settings.json');

function defaultPoints() {
  const out = {};
  for (const t of TRIPS) {
    out[t.id] = {};
    for (const q of t.form.questions) {
      if (!q.category) continue;
      out[t.id][q.id] = {};
      for (const o of q.options) out[t.id][q.id][o.id] = o.points || 0;
    }
  }
  return out;
}

function defaults() {
  const categoryMax = {};
  for (const [k, v] of Object.entries(CATEGORIES)) categoryMax[k] = v.max;
  return {
    // Número oficial do botão de WhatsApp do site agnustour.com.br
    whatsappNumber: '556530523834',
    pixelId: process.env.META_PIXEL_ID || '1139506635353572',
    thresholds: { hot: 75, warm: 45 },
    categoryMax,
    // Valor de referência por pessoa (R$) das viagens internacionais — padrão = preço oficial.
    // null = usar pontos fixos por faixa.
    referencePrices: Object.fromEntries(TRIPS.filter((t) => t.international).map((t) => [t.id, t.referencePrice ?? null])),
    // % dos pontos financeiros conforme (teto da faixa ÷ valor de referência)
    budgetTiers: [
      { minRatio: 1, pct: 100 },
      { minRatio: 0.9, pct: 70 },
      { minRatio: 0.8, pct: 40 },
      { minRatio: 0, pct: 10 },
    ],
    points: defaultPoints(),
    webhook: { enabled: false, url: '', secret: '' },
    google: {
      rating: 5.0,
      reviewCount: 131,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Agnus+Tour+Agencia+de+Viagens+Cuiab%C3%A1',
      minRatingToShow: 4,
    },
    instagram: { username: 'agnustouroficial', posts: [] },
  };
}

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}
function merge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = k in base ? merge(base[k], over[k]) : over[k];
  return out;
}

let cache = null;
function load() {
  if (cache) return cache;
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('[settings] erro ao ler settings.json:', e.message);
  }
  cache = merge(defaults(), saved);
  return cache;
}

const num = (v, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
};

/** Valida e normaliza o que vem do painel. Lança Error com mensagem amigável. */
function sanitize(input) {
  const cur = load();
  const next = JSON.parse(JSON.stringify(cur));
  if (!isObj(input)) throw new Error('Formato inválido.');

  if (input.whatsappNumber !== undefined) {
    const d = String(input.whatsappNumber).replace(/\D/g, '');
    if (d.length < 12 || d.length > 13) throw new Error('WhatsApp deve ter DDI + DDD + número (ex.: 5565999999999).');
    next.whatsappNumber = d;
  }
  if (isObj(input.thresholds)) {
    const hot = num(input.thresholds.hot, 1, 100);
    const warm = num(input.thresholds.warm, 0, 100);
    if (hot === null || warm === null || warm >= hot) throw new Error('Faixas: "Morno" deve ser menor que "Quente".');
    next.thresholds = { hot, warm };
  }
  if (isObj(input.categoryMax)) {
    for (const k of Object.keys(CATEGORIES)) {
      if (input.categoryMax[k] !== undefined) {
        const v = num(input.categoryMax[k], 0, 100);
        if (v === null) throw new Error('Máximo por critério inválido.');
        next.categoryMax[k] = v;
      }
    }
  }
  if (isObj(input.referencePrices)) {
    for (const id of Object.keys(next.referencePrices)) {
      if (!(id in input.referencePrices)) continue;
      const raw = input.referencePrices[id];
      if (raw === null || raw === '') next.referencePrices[id] = null;
      else {
        const v = num(raw, 1, 10000000);
        if (v === null) throw new Error('Valor de referência inválido.');
        next.referencePrices[id] = v;
      }
    }
  }
  if (Array.isArray(input.budgetTiers)) {
    const tiers = input.budgetTiers
      .map((t) => ({ minRatio: num(t.minRatio, 0, 10), pct: num(t.pct, 0, 100) }))
      .filter((t) => t.minRatio !== null && t.pct !== null)
      .sort((a, b) => b.minRatio - a.minRatio);
    if (!tiers.length) throw new Error('Informe ao menos uma faixa de compatibilidade.');
    next.budgetTiers = tiers;
  }
  if (isObj(input.points)) {
    for (const t of TRIPS) {
      const tp = input.points[t.id];
      if (!isObj(tp)) continue;
      for (const q of t.form.questions) {
        if (!q.category || !isObj(tp[q.id])) continue;
        for (const o of q.options) {
          if (tp[q.id][o.id] === undefined) continue;
          const v = num(tp[q.id][o.id], 0, 100);
          if (v === null) throw new Error(`Pontuação inválida em "${t.name}".`);
          next.points[t.id][q.id][o.id] = v;
        }
      }
    }
  }
  if (isObj(input.webhook)) {
    const url = String(input.webhook.url || '').trim();
    const okUrl = /^https:\/\/[^\s]+$/i.test(url) || (process.env.ALLOW_HTTP_WEBHOOK === '1' && /^http:\/\/[^\s]+$/i.test(url));
    if (url && !okUrl) throw new Error('A URL do webhook deve começar com https://');
    next.webhook = {
      enabled: Boolean(input.webhook.enabled) && Boolean(url),
      url,
      // segredo vazio vindo do painel = manter o atual
      secret: input.webhook.secret === undefined || input.webhook.secret === '__keep__' ? cur.webhook.secret : String(input.webhook.secret).slice(0, 200),
    };
  }
  if (isObj(input.google)) {
    const g = input.google;
    if (g.rating !== undefined) next.google.rating = num(g.rating, 0, 5);
    if (g.reviewCount !== undefined) next.google.reviewCount = num(g.reviewCount, 0, 1e7);
    if (g.mapsUrl !== undefined) {
      const u = String(g.mapsUrl).trim();
      if (u && !/^https:\/\//i.test(u)) throw new Error('Link do Google deve começar com https://');
      next.google.mapsUrl = u;
    }
    if (g.minRatingToShow !== undefined) next.google.minRatingToShow = num(g.minRatingToShow, 1, 5);
  }
  if (isObj(input.instagram)) {
    const ig = input.instagram;
    if (ig.username !== undefined) next.instagram.username = String(ig.username).replace(/[^a-z0-9._]/gi, '').slice(0, 30);
    if (Array.isArray(ig.posts)) {
      next.instagram.posts = ig.posts
        .map((u) => String(u).trim())
        .filter(Boolean)
        .slice(0, 12)
        .map((u) => {
          const m = u.match(/^https:\/\/(www\.)?instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)/);
          if (!m) throw new Error(`Link de post inválido: ${u}`);
          return `https://www.instagram.com/${m[2]}/${m[3]}/`;
        });
    }
  }
  return next;
}

async function save(input) {
  const next = sanitize(input);
  await writeJsonAtomic(FILE, next);
  cache = next;
  return next;
}

/** Versão para o painel (sem expor o segredo do webhook). */
function forAdmin() {
  const s = JSON.parse(JSON.stringify(load()));
  s.webhook.hasSecret = Boolean(s.webhook.secret);
  s.webhook.secret = '';
  return s;
}

module.exports = { load, save, forAdmin, defaults, DATA_DIR };
