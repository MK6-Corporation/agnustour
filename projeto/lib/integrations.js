'use strict';
/*
 * Integrações externas. Nenhuma URL ou credencial é inventada:
 *  - Webhook/CRM: URL e segredo definidos pela equipe no painel /admin.
 *  - Google (Places API): variáveis GOOGLE_PLACES_API_KEY e GOOGLE_PLACE_ID.
 *  - Instagram (API oficial): variável INSTAGRAM_ACCESS_TOKEN.
 */
const crypto = require('crypto');

/* ---------------- Webhook / CRM ---------------- */
async function sendWebhook(lead, settings, { test = false } = {}) {
  const wh = settings.webhook || {};
  if (!wh.enabled || !wh.url) return { status: 'desativado' };
  // O Google Apps Script não lê cabeçalhos HTTP: a chave vai também no corpo (campo "token").
  const body = JSON.stringify({ event: test ? 'lead.test' : 'lead.created', sentAt: new Date().toISOString(), token: wh.secret || undefined, lead });
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'AgnusTour-Leads/1.0' };
  if (wh.secret) headers['X-Agnus-Signature'] = 'sha256=' + crypto.createHmac('sha256', wh.secret).update(body).digest('hex');

  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(wh.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        // Apps Script responde 200 mesmo com erro interno: confere o JSON de retorno
        const txt = await res.text();
        let j = null;
        try { j = JSON.parse(txt); } catch (_) { /* resposta não-JSON de outros CRMs */ }
        if (j && j.ok === false) { last = j.error || 'recusado pela planilha'; break; }
        return { status: 'enviado', httpStatus: res.status, attempts: attempt, at: new Date().toISOString() };
      }
      last = `HTTP ${res.status}`;
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) {
      last = e.name === 'TimeoutError' ? 'tempo esgotado' : e.message;
    }
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  return { status: 'falhou', error: last, at: new Date().toISOString() };
}

/* ---------------- Cache simples ---------------- */
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  try {
    const value = await fn();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    console.error(`[${key}]`, e.message);
    if (hit) return hit.value; // serve o último resultado bom
    return null;
  }
}

/* ---------------- Google Meu Negócio (Places API New) ---------------- */
// Avaliações reais copiadas do Google (lib/reviews.json): [{ author, rating, when, text }]
function manualReviews() {
  try { return require('./reviews.json').filter((r) => r.author && r.text); } catch (_) { return []; }
}

async function googleReviews(settings) {
  const g = settings.google;
  const fallback = { source: 'manual', rating: g.rating, reviewCount: g.reviewCount, mapsUrl: g.mapsUrl, reviews: manualReviews() };
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!key || !placeId) return fallback;

  const data = await cached('google', 6 * 3600 * 1000, async () => {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Places API HTTP ${res.status}`);
    return res.json();
  });
  if (!data) return fallback;
  const min = g.minRatingToShow || 1;
  return {
    source: 'google',
    rating: data.rating ?? g.rating,
    reviewCount: data.userRatingCount ?? g.reviewCount,
    mapsUrl: data.googleMapsUri || g.mapsUrl,
    reviews: (data.reviews || [])
      .filter((r) => (r.rating || 0) >= min && ((r.text && r.text.text) || (r.originalText && r.originalText.text)))
      .map((r) => ({
        author: r.authorAttribution ? r.authorAttribution.displayName : 'Cliente Google',
        authorUrl: r.authorAttribution ? r.authorAttribution.uri : null,
        photo: r.authorAttribution ? r.authorAttribution.photoUri : null,
        rating: r.rating,
        when: r.relativePublishTimeDescription || '',
        text: (r.text && r.text.text) || r.originalText.text,
      })),
  };
}

/* ---------------- Instagram ---------------- */
async function instagramFeed(settings) {
  const ig = settings.instagram;
  const base = { username: ig.username, profileUrl: `https://www.instagram.com/${ig.username}/`, posts: [], embeds: ig.posts || [] };
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return { ...base, source: ig.posts && ig.posts.length ? 'embeds' : 'link' };

  const data = await cached('instagram', 3600 * 1000, async () => {
    const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=12&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Instagram API HTTP ${res.status}`);
    return res.json();
  });
  if (!data || !Array.isArray(data.data)) return { ...base, source: ig.posts && ig.posts.length ? 'embeds' : 'link' };
  return {
    ...base,
    source: 'api',
    posts: data.data.slice(0, 8).map((p) => ({
      url: p.permalink,
      image: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
      caption: (p.caption || '').slice(0, 220),
      video: p.media_type === 'VIDEO',
    })).filter((p) => p.image),
  };
}

module.exports = { sendWebhook, googleReviews, instagramFeed, manualReviews };
