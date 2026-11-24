'use strict';
const { TRIPS } = require('./trips');
const { tripVideo } = require('./videos');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

// Vídeo sem som por cima das fotos: só começa a carregar quando o card aparece na tela (site.js).
function videoTag(t) {
  const v = tripVideo(t.id);
  return v ? `<video class="trip-video" muted loop playsinline preload="none" aria-hidden="true" data-src="${esc(v.src)}"${v.poster ? ` poster="${esc(v.poster)}"` : ''}></video>` : '';
}

function media(t) {
  return `<div class="card-media art art-${esc(t.visual.icon)}">
      ${icon(t.visual.icon, 'art-icon')}
      <span class="art-word">${esc(t.visual.word)}</span>
      <span class="art-leader">com ${esc(t.leader)}</span>${videoTag(t)}
    </div>`;
}

function card(t) {
  const title = t.shortName || t.name;
  const price = t.priceLabel
    ? `<div class="price"><span class="price-label">${esc(t.pricePrefix || 'Investimento')}</span><strong>${esc(t.priceLabel)}</strong>${t.priceNote ? `<span class="price-note">${esc(t.priceNote)}</span>` : ''}</div>`
    : `<div class="price"><span class="price-label">Investimento</span><strong class="price-consult">${esc(t.priceNote)}</strong></div>`;
  return `
<article class="trip-card" data-trip="${esc(t.id)}" data-scope="${esc(t.scope.toLowerCase())}">
  <div class="media-wrap">${media(t)}
  <div class="card-tags media-tags"><span class="tag tag-${t.international ? 'intl' : 'nac'}">${esc(t.scope)}</span><span class="tag tag-transport tag-${t.transport === 'Ônibus' ? 'bus' : 'plane'}">${icon(t.transport === 'Ônibus' ? 'bus' : 'plane', 'ic-sm')}${t.transport === 'Ônibus' ? 'De ônibus' : 'De avião'}</span></div></div>
  <div class="card-body">
    <h3>${esc(title)}${t.leader ? `<span class="leader">com ${esc(t.leader)}</span>` : ''}</h3>
    <ul class="facts">
      <li>${icon('calendar')}<span>${esc(t.dateLabel)} · ${esc(t.duration)}</span></li>
      <li>${icon('route')}<span>${esc(t.route)}</span></li>
    </ul>
    <p class="summary">${esc(t.summary)}</p>
    <div class="card-foot">
      ${price}
      <div class="card-actions">
        <button type="button" class="btn btn-ghost" data-open-itinerary="${esc(t.id)}">Ver roteiro</button>
        <button type="button" class="btn btn-primary" data-open-form="${esc(t.id)}">Tenho interesse</button>
      </div>
    </div>
  </div>
</article>`;
}

function tripCards() {
  return TRIPS.map(card).join('\n');
}

/**
 * Logo da Canção Nova Cuiabá: usa public/img/cancao-nova-cuiaba.(svg|png|webp|jpg) se existir.
 * Sem o arquivo, mostra o nome em texto (nunca uma logo improvisada).
 * @param resolve função que transforma 'img/arquivo' no src final (URL ou data URI)
 */
const PARTNER_FILES = ['svg', 'png', 'webp', 'jpg'].map((e) => `img/cancao-nova-cuiaba.${e}`);
function partnerLogoPath() {
  const fs = require('fs');
  const path = require('path');
  return PARTNER_FILES.find((f) => fs.existsSync(path.join(__dirname, '..', 'public', f))) || null;
}
function partnerLogo(resolve) {
  const p = partnerLogoPath();
  if (p) return `<img src="${esc(resolve(p))}" alt="Canção Nova Cuiabá" width="180" height="80">`;
  return '<span class="partner-name">Canção Nova<small>Cuiabá</small></span>';
}

/** Créditos dos vídeos de licença livre (lib/credits.json), exigidos pelas licenças CC. */
// Galeria "Lugares que você vai visitar" (fotos dos roteiros enviados pela agência)
// Fotos em ALTA resolução (mín. 1600 px de largura) em public/img/galeria/. Lista vazia = seção some.
const GALLERY = [];
function gallery(resolve = (rel) => '/' + rel) {
  if (!GALLERY.length) return '';
  const items = GALLERY.map(([src, title, place], i) => `<figure class="g-item g${i}"><img src="${esc(resolve(src))}" alt="${esc(title)}" loading="lazy" decoding="async"><figcaption><strong>${esc(title)}</strong><span>${esc(place)}</span></figcaption></figure>`).join('');
  return `<section class="section section-tint gallery-sec" id="destinos" aria-labelledby="gallery-title">
    <div class="wrap">
      <header class="sec-head">
        <p class="script">Lugares sagrados</p>
        <h2 id="gallery-title">Onde a sua fé vai caminhar</h2>
        <p>Santuários, cidades e paisagens que fazem parte dos nossos roteiros.</p>
      </header>
      <div class="gallery">${items}</div>
    </div>
  </section>`;
}

// Topo do site: 3 vídeos verticais dos destinos (sem som)
function heroVideos() {
  return ['terra-santa-roma', 'mexico-cancun', 'aparecida-pe-idlain']
    .map((id, i) => {
      const v = tripVideo(id);
      if (!v) return '';
      return `<div class="hv hv${i + 1}"><video class="trip-video on" muted loop playsinline preload="none" aria-hidden="true" data-src="${esc(v.src)}"${v.poster ? ` poster="${esc(v.poster)}"` : ''}></video></div>`;
    })
    .join('');
}

function photoCredits() {
  let list = [];
  try { list = require('./credits.json'); } catch (_) { return ''; }
  if (!list.length) return '';
  return `<details class="credits"><summary>Créditos das fotos</summary><ul>${list
    .map((c) => `<li>${esc(c.subject)}: <a href="${esc(c.page)}" target="_blank" rel="noopener">${esc(c.author || 'Wikimedia Commons')}</a>, ${esc(c.license)}</li>`)
    .join('')}</ul></details>`;
}

module.exports = { tripCards, partnerLogo, partnerLogoPath, photoCredits, gallery, GALLERY, heroVideos };
