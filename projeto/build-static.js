'use strict';
/*
 * Gera a versão em ARQUIVO ÚNICO do site:  node build-static.js
 *   → dist/agnus-tour.html  (CSS, JavaScript, imagens e política de privacidade embutidos)
 *
 * Opcional:  SHEETS_URL='https://script.google.com/macros/s/.../exec' node build-static.js
 */
const fs = require('fs');
const path = require('path');
const { TRIPS, publicTrips } = require('./lib/trips');
const { tripCards, partnerLogo, partnerLogoPath, photoCredits, gallery, GALLERY, heroVideos } = require('./lib/render');
const settings = require('./lib/settings').defaults();

const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const dataUri = (rel) => {
  const file = path.join(PUB, rel);
  return `data:${MIME[path.extname(file).toLowerCase()]};base64,${fs.readFileSync(file).toString('base64')}`;
};
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
// Evita que "</script>" dentro de textos feche a tag ao embutir JSON
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');

/* ---------------- 2. HTML em arquivo único ---------------- */
const images = {};
const usedImages = new Set(['img/logo.png', 'img/selo.png', ...GALLERY.map((g) => g[0])]);
for (const t of TRIPS) {
  (t.images || []).forEach((i) => usedImages.add(i));
  (t.itinerary || []).forEach((d) => d.image && usedImages.add(d.image));
}
if (partnerLogoPath()) usedImages.add(partnerLogoPath());
for (const rel of usedImages) images[rel] = dataUri(rel);

const STATIC = {
  sheetsUrl: process.env.SHEETS_URL || '',
  config: {
    whatsappNumber: settings.whatsappNumber,
    trips: publicTrips(true),
    scoring: { points: settings.points, categoryMax: settings.categoryMax, thresholds: settings.thresholds, referencePrices: settings.referencePrices, budgetTiers: settings.budgetTiers },
  },
  images,
  reviews: { source: 'manual', rating: settings.google.rating, reviewCount: settings.google.reviewCount, mapsUrl: settings.google.mapsUrl, reviews: require('./lib/integrations').manualReviews() },
  instagram: { username: settings.instagram.username, profileUrl: `https://www.instagram.com/${settings.instagram.username}/`, posts: [], embeds: settings.instagram.posts, source: 'link' },
};

let cards = tripCards();
for (const [rel, uri] of Object.entries(images)) cards = cards.split(`src="${rel}"`).join(`src="${uri}"`);

const privacyHtml = read('public/privacidade.html').match(/<main class="wrap doc">([\s\S]*?)<\/main>/)[1];
const privacyDialog = `
<dialog class="modal modal-wide" id="privacy-modal" aria-label="Política de Privacidade">
  <div class="modal-box">
    <button class="m-close" type="button" data-close-privacy aria-label="Fechar"><svg class="ic" aria-hidden="true"><use href="#i-close"/></svg></button>
    <div class="it-body doc">${privacyHtml}</div>
  </div>
</dialog>`;

let html = read('public/index.html');
const css = read('public/css/site.css') + `
.doc h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); padding-right: 40px; }
.doc h2 { font-size: 1.15rem; margin-top: 1.6em; }
.doc p, .doc li { color: var(--ink-2); }
.doc .updated { color: var(--muted); font-size: .9rem; }`;
const g = settings.google;

html = html
  .replace('<head>', `<head>
  <script>
    /* ======================================================================
       COLE AQUI A URL DO APP DA WEB DO GOOGLE APPS SCRIPT (termina em /exec).
       Sem a URL, o formulário funciona em modo demonstração (não grava).
       ====================================================================== */
    window.AGNUS_PLANILHA_URL = ${JSON.stringify(STATIC.sheetsUrl)};
  </script>`)
  .replace('<link rel="stylesheet" href="/css/site.css">', `<style>\n${css}\n</style>`)
  .replace(/\s*<meta property="og:image"[^>]*>/, '')
  .replace('<link rel="icon" href="/img/logo.png">', `<link rel="icon" href="${images['img/logo.png']}">`)
  .replace(/src="\/(img\/[^"]+)"/g, (m, rel) => {
    if (!images[rel]) throw new Error('Imagem não embutida: ' + rel);
    return `src="${images[rel]}"`;
  })
  .replace('href="/" aria-label', 'href="#topo" aria-label')
  .replace(/href="\/privacidade"/g, 'href="#privacidade"')
  .replace('<!--TRIP_CARDS-->', cards)
  .replace('{{PARTNER_LOGO}}', () => partnerLogo((rel) => images[rel]))
  .replace('{{GALLERY}}', () => gallery((rel) => images[rel]))
  .replace('{{HERO_VIDEOS}}', () => heroVideos())
  .replace('{{PHOTO_CREDITS}}', () => photoCredits())
  .replace(/\{\{WHATSAPP\}\}/g, settings.whatsappNumber)
  .replace(/\{\{GOOGLE_RATING\}\}/g, Number(g.rating).toFixed(1).replace('.', ','))
  .replace(/\{\{GOOGLE_COUNT\}\}/g, String(g.reviewCount))
  .replace(/\{\{GOOGLE_URL\}\}/g, escAttr(g.mapsUrl))
  .replace('<script src="/js/scoring.js" defer></script>\n', () => `<script>\n${read('public/js/scoring.js')}\n</script>\n`)
  .replace('<script src="/js/site.js" defer></script>', () => `${privacyDialog}
<script>window.AGNUS_STATIC = ${safeJson(STATIC)};</script>
<script>
${read('public/js/site.js')}
</script>`);

if (/\{\{|\/img\/|\/css\/|\/js\/site|\/js\/scoring/.test(html)) throw new Error('Sobrou referência a arquivo externo no HTML');
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'agnus-tour.html');
fs.writeFileSync(out, html);

// Vídeos: grandes demais para embutir no HTML. Vão na pasta video/ ao lado do arquivo.
const { VIDEO_DIR } = require('./lib/videos');
let nVideos = 0;
if (fs.existsSync(VIDEO_DIR)) {
  const dest = path.join(ROOT, 'dist', 'video');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(VIDEO_DIR)) {
    if (!/\.(mp4|jpg)$/.test(f)) continue;
    fs.copyFileSync(path.join(VIDEO_DIR, f), path.join(dest, f));
    if (f.endsWith('.mp4')) nVideos++;
  }
}
console.log(`OK → ${path.relative(ROOT, out)} (${(html.length / 1024).toFixed(0)} KB, ${Object.keys(images).length} imagens embutidas, ${nVideos} vídeos em dist/video/)`);
