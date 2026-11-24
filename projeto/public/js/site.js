/* Agnus Tour — site, formulários de qualificação, avaliações e Instagram */
(function () {
  'use strict';

  // Versão em arquivo único (sem servidor): dados embutidos e envio direto para a planilha Google.
  var STATIC = window.AGNUS_STATIC || null;
  var CONFIG = null;
  var TRIPS = {};
  var forms = {}; // estado independente por viagem
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function img(p) { return (STATIC && STATIC.images[p]) || '/' + p; }
  var PRIVACY_URL = STATIC ? '#privacidade' : '/privacidade';
  function icon(id, cls) { return '<svg class="' + (cls || 'ic') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  /* ---------- Origem do lead (UTM) — primeiro toque, 30 dias ---------- */
  var SOURCE = (function () {
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
    var params = new URLSearchParams(location.search);
    var now = {};
    keys.forEach(function (k) { if (params.get(k)) now[k] = params.get(k).slice(0, 200); });
    var saved = store('agnus_src');
    var fresh = saved && saved.at && Date.now() - saved.at < 30 * 864e5;
    if (Object.keys(now).length || !fresh) {
      var external = document.referrer && document.referrer.indexOf(location.host) === -1 ? document.referrer : '';
      saved = { at: Date.now(), data: Object.assign(now, { referrer: external, landingPage: location.href.slice(0, 500) }) };
      store('agnus_src', saved);
    }
    return saved.data;
  })();

  /* ---------- Menu mobile ---------- */
  var toggle = $('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var ul = $('#menu');
      var open = ul.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
    $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { $('#menu').classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }); });
  }

  /* ---------- Filtro das viagens ---------- */
  $$('[data-filter]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-filter');
      $$('[data-filter]').forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); });
      $$('.trip-card').forEach(function (c) { c.hidden = f !== 'all' && c.getAttribute('data-scope') !== f; });
    });
  });

  /* ---------- Modais (dialog nativo) ---------- */
  var leadModal = $('#lead-modal');
  var itModal = $('#itinerary-modal');
  var lastFocus = null;
  var lastRenderAt = 0;

  function openModal(dlg) {
    lastFocus = document.activeElement;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.body.classList.add('modal-open');
  }
  function closeModal(dlg) {
    if (dlg.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
  }
  [leadModal, itModal].forEach(function (dlg) {
    dlg.addEventListener('close', function () {
      document.body.classList.remove('modal-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    });
    // Clique fora fecha, mas só se o clique começou fora e não logo após uma troca de tela
    // (evita que o 2º clique de um clique duplo feche a tela de sucesso, que é menor).
    var downOutside = false;
    dlg.addEventListener('pointerdown', function (e) { downOutside = e.target === dlg; });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg && downOutside && Date.now() - lastRenderAt > 600) closeModal(dlg);
    });
  });

  function waLink(text) {
    var n = (CONFIG && CONFIG.whatsappNumber) || '556530523834';
    return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  /* ---------- Roteiro ---------- */
  function mediaHtml(t) {
    if (t.video) {
      return '<div class="art art-' + esc(t.visual.icon) + '"><video class="trip-video on" muted loop playsinline' + (videosAllowed() ? ' autoplay' : '') + ' aria-hidden="true" src="' + esc(t.video.src) + '"' + (t.video.poster ? ' poster="' + esc(t.video.poster) + '"' : '') + '></video></div>';
    }
    if (t.images && t.images.length) {
      return '<div class="collage">' + t.images.map(function (s) { return '<img src="' + esc(img(s)) + '" alt="">'; }).join('') + '</div>';
    }
    return '<div class="art art-' + esc(t.visual.icon) + '">' + icon(t.visual.icon, 'art-icon') + '<span class="art-word">' + esc(t.visual.word) + '</span></div>';
  }

  /* ---------- Vídeos dos destinos (sem som) ---------- */
  // Quem pediu menos movimento ou está economizando dados continua vendo só as fotos.
  function videosAllowed() {
    try {
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      if (navigator.connection && navigator.connection.saveData) return false;
    } catch (e) {}
    return true;
  }
  function dropVideo(v) { if (v.parentNode) v.parentNode.removeChild(v); }
  // Mostra o vídeo (fade) só quando ele realmente começa a tocar; se falhar, some e ficam as fotos.
  document.addEventListener('playing', function (e) { var v = e.target; if (v.classList && v.classList.contains('trip-video')) v.classList.add('on'); }, true);
  document.addEventListener('error', function (e) { var v = e.target; if (v.classList && v.classList.contains('trip-video')) dropVideo(v); }, true);
  (function initCardVideos() {
    var vids = $$('video.trip-video[data-src]');
    if (!vids.length) return;
    if (!videosAllowed() || !('IntersectionObserver' in window)) {
      vids.forEach(function (v) { if (v.poster) v.classList.add('on'); else dropVideo(v); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
          if (!v.getAttribute('src')) { v.muted = true; v.src = v.getAttribute('data-src'); }
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else if (v.getAttribute('src')) v.pause();
      });
    }, { rootMargin: '150px 0px', threshold: 0.15 });
    vids.forEach(function (v) { io.observe(v); });
  })();
  function priceHtml(t) {
    return t.priceLabel
      ? '<div class="price"><span class="price-label">' + esc(t.pricePrefix || 'Investimento') + '</span><strong>' + esc(t.priceLabel) + '</strong>' + (t.priceNote ? '<span class="price-note">' + esc(t.priceNote) + '</span>' : '') + '</div>'
      : '<div class="price"><span class="price-label">Investimento</span><strong class="price-consult">' + esc(t.priceNote) + '</strong></div>';
  }

  function openItinerary(id) {
    var t = TRIPS[id];
    if (!t) return;
    var html = '<button class="m-close" type="button" data-close aria-label="Fechar">' + icon('close') + '</button>' +
      '<div class="it-hero">' + mediaHtml(t) + '<div class="it-hero-text"><p>' + esc(t.scope) + ' · ' + esc(t.transport) + '</p><h2 id="it-title">' + esc(t.name) + '</h2><p>' + esc(t.dateLabel) + ' · ' + esc(t.duration) + '</p></div></div>' +
      '<div class="it-body"><div class="it-route">' + icon('route') + '<span>' + esc(t.route) + '</span></div>' +
      (t.leader ? '<div class="it-route it-guide">' + icon('cross') + '<span>Diretor espiritual: <strong>' + esc(t.leader) + '</strong></span></div>' : '');
    if (t.itinerary && t.highlights) {
      html += '<h3 style="margin-top:22px">Destaques</h3><ul class="it-list it-list-1">' + t.highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul><h3>Dia a dia</h3>';
    }
    if (t.itinerary) {
      html += '<ol class="days">' + t.itinerary.map(function (d) {
        return '<li class="day"><span class="day-n" aria-label="Dia ' + d.day + '">' + d.day + 'º</span><div>' +
          (d.date ? '<span class="d-date">' + esc(d.date) + '</span>' : '') + '<h3>' + esc(d.title) + '</h3><p>' + esc(d.text) + '</p>' +
          (d.image ? '<img src="' + esc(img(d.image)) + '" alt="" loading="lazy">' : '') + '</div></li>';
      }).join('') + '</ol>';
      if (t.itineraryNote) html += '<p class="it-note">' + esc(t.itineraryNote) + '</p>';
    } else {
      if (t.highlights) html += '<h3 style="margin-top:22px">Destaques</h3><ul class="it-list">' + t.highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>';
      if (t.includes) html += '<h3>O pacote inclui</h3><ul class="it-list">' + t.includes.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>';
      html += '<p class="it-note">O roteiro dia a dia é enviado pela nossa equipe junto com as condições da viagem.</p>';
    }
    html += '</div><div class="it-cta">' + priceHtml(t) + '<button type="button" class="btn btn-primary" data-open-form="' + esc(t.id) + '">Tenho interesse</button></div>';
    var root = $('[data-itinerary-root]');
    root.innerHTML = html;
    openModal(itModal);
    root.scrollTop = 0;
    $('[data-close]', root).focus();
  }

  /* ---------- Formulário de qualificação ---------- */
  function getState(id) {
    if (!forms[id]) forms[id] = { step: 0, answers: {}, contact: { name: '', city: '', state: 'MT', consent: false }, submissionId: uuid(), protocol: '', waUrl: '', done: false, error: '', fieldErrors: {} };
    return forms[id];
  }

  function openForm(id) {
    var t = TRIPS[id];
    if (!t) return;
    if (itModal.open) closeModal(itModal);
    currentTrip = id;
    renderForm();
    openModal(leadModal);
    var first = $('input:checked, input, button.btn', $('[data-form-root]'));
    if (first) first.focus();
  }

  var currentTrip = null;

  function renderForm() {
    var t = TRIPS[currentTrip];
    var st = getState(currentTrip);
    var qs = t.form.questions;
    var total = qs.length + 1; // perguntas + dados
    var root = $('[data-form-root]');
    var close = '<button class="m-close" type="button" data-close aria-label="Fechar formulário">' + icon('close') + '</button>';

    if (st.done) {
      lastRenderAt = Date.now();
      root.innerHTML = close + '<div class="lf-success" role="status">' +
        '<div class="ok ok-wa">' + icon('whatsapp') + '</div>' +
        '<h2 id="lead-title" tabindex="-1">Sua mensagem está pronta!</h2>' +
        '<p>Abrimos o WhatsApp da Agnus Tour com as suas respostas. <strong>É só tocar em enviar</strong> para falar com um especialista e receber o roteiro completo, as condições de pagamento e a disponibilidade de vagas.</p>' +
        '<a class="btn btn-wa btn-lg" href="' + esc(st.waUrl) + '" target="_blank" rel="noopener" data-wa-final>' + icon('whatsapp') + 'Abrir o WhatsApp</a>' +
        '<p class="lf-hint">O WhatsApp não abriu? Toque no botão acima.</p></div>';
      $('#lead-title').focus();
      return;
    }

    var head = '<div class="lf-head"><p class="lf-trip">' + esc(t.name) + ' · ' + esc(t.dateLabel) + '</p>' +
      '<h2 id="lead-title">' + esc(t.form.title) + '</h2>' + (st.step === 0 ? '<p>' + esc(t.form.description) + '</p>' : '') + '</div>';
    var pct = Math.round(((st.step) / total) * 100);
    var progress = '<div class="lf-progress"><div class="lf-progress-top"><span>Etapa ' + (st.step + 1) + ' de ' + total + '</span><span>' + pct + '%</span></div>' +
      '<div class="lf-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Progresso do formulário"><span style="width:' + Math.max(pct, 4) + '%"></span></div></div>';
    var err = st.error ? '<p class="lf-error" role="alert">' + esc(st.error) + '</p>' : '';
    var body;

    if (st.step < qs.length) {
      var q = qs[st.step];
      body = '<form class="lf-body" data-q-form novalidate>' + err + '<fieldset class="lf-step"><legend>' + esc(q.text) + '</legend><div class="opts">' +
        q.options.map(function (o) {
          var checked = st.answers[q.id] === o.id ? ' checked' : '';
          return '<label class="opt"><input type="radio" name="' + q.id + '" value="' + o.id + '"' + checked + ' required><span class="dot">' + icon('check') + '</span><span>' + esc(o.label) + '</span></label>';
        }).join('') + '</div></fieldset>' +
        '<div class="lf-nav">' + (st.step > 0 ? '<button type="button" class="lf-back" data-back>' + icon('back') + 'Voltar</button>' : '') +
        '<button type="submit" class="btn btn-primary">Continuar</button></div></form>';
    } else {
      var c = st.contact, fe = st.fieldErrors;
      var f = function (name, label, input, optional) {
        return '<div class="field' + (fe[name] ? ' invalid' : '') + '"><label for="lf-' + name + '">' + label + (optional ? ' <span class="opt-l">(opcional)</span>' : '') + '</label>' + input +
          '<span class="msg" id="lf-' + name + '-msg">' + esc(fe[name] || '') + '</span></div>';
      };
      var aria = function (name) { return ' aria-describedby="lf-' + name + '-msg"' + (fe[name] ? ' aria-invalid="true"' : ''); };
      body = '<form class="lf-body" data-contact-form novalidate>' + err +
        '<p class="lf-q">Para finalizar, como podemos te chamar?</p>' +
        f('name', 'Nome completo', '<input id="lf-name" name="name" autocomplete="name" required maxlength="120" value="' + esc(c.name) + '"' + aria('name') + '>') +
        '<div class="row2">' +
        f('city', 'Cidade', '<input id="lf-city" name="city" autocomplete="address-level2" required maxlength="80" value="' + esc(c.city) + '"' + aria('city') + '>') +
        f('state', 'Estado', '<select id="lf-state" name="state" autocomplete="address-level1" required' + aria('state') + '><option value="">UF</option>' +
          UFS.map(function (u) { return '<option' + (c.state === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select>') +
        '</div>' +
        '<div class="hp" aria-hidden="true"><label>Não preencha<input name="website" tabindex="-1" autocomplete="off"></label></div>' +
        '<label class="consent' + (fe.consent ? ' invalid' : '') + '"><input type="checkbox" name="consent" id="lf-consent"' + (c.consent ? ' checked' : '') + ' required>' +
        '<span data-consent-text>Autorizo a Agnus Tour a usar estas informações para me atender pelo WhatsApp sobre esta viagem, conforme a <a href="' + PRIVACY_URL + '"' + (STATIC ? '' : ' target="_blank" rel="noopener"') + '>Política de Privacidade</a>.</span></label>' +
        (fe.consent ? '<span class="msg" style="color:#b42323;font-size:.85rem">' + esc(fe.consent) + '</span>' : '') +
        '<p class="lf-privacy-note">' + icon('whatsapp') + 'Ao tocar no botão, abrimos o WhatsApp da Agnus Tour com as suas respostas prontas para enviar.</p>' +
        '<div class="lf-nav"><button type="button" class="lf-back" data-back>' + icon('back') + 'Voltar</button>' +
        '<button type="submit" class="btn btn-wa btn-lg" data-submit>' + icon('whatsapp') + 'Enviar pelo WhatsApp</button></div></form>';
    }
    lastRenderAt = Date.now();
    root.innerHTML = close + head + progress + body;
    root.scrollTop = 0;
  }

  function maskPhone(v) {
    var d = v.replace(/\D/g, '');
    if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
    d = d.slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  var DDD = /^(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9])$/;
  function validateContact(c) {
    var e = {};
    var name = c.name.trim().replace(/\s+/g, ' ');
    if (name.length < 5 || name.indexOf(' ') < 0) e.name = 'Informe seu nome completo (nome e sobrenome).';
    if (c.city.trim().length < 2) e.city = 'Informe sua cidade.';
    if (!c.state) e.state = 'Selecione o estado.';
    if (!c.consent) e.consent = 'Marque a autorização para continuar.';
    return e;
  }

  function readContact(form) {
    var st = getState(currentTrip);
    st.contact = { name: form.name.value, city: form.city.value, state: form.state.value, consent: form.consent.checked };
    return st.contact;
  }

  /*
   * Finaliza no WhatsApp: calcula o termômetro, gera o protocolo, monta a mensagem e abre o WhatsApp
   * imediatamente (dentro do clique, para o navegador não bloquear). O registro na planilha/servidor
   * acontece em paralelo e não atrasa o cliente.
   */
  function finalize(form) {
    var st = getState(currentTrip);
    if (st.done) return; // evita abrir duas vezes
    if (form.website && form.website.value) return;
    var c = readContact(form);
    var errs = validateContact(c);
    st.fieldErrors = errs;
    st.error = Object.keys(errs).length ? 'Confira os campos destacados.' : '';
    if (st.error) {
      renderForm();
      var firstBad = $('[aria-invalid="true"], .consent.invalid input', $('[data-form-root]'));
      if (firstBad) firstBad.focus();
      return;
    }
    var t = TRIPS[currentTrip];
    var S = window.AgnusScoring;
    var score = S.scoreAnswers(t, st.answers, CONFIG.scoring);
    st.protocol = st.protocol || S.protocol(t.code, score.total, score.classification);
    var contact = { name: c.name.trim().replace(/\s+/g, ' '), city: c.city.trim(), state: c.state };
    st.waUrl = waLink(S.whatsappMessage(t, st.answers, contact, st.protocol));
    st.done = true;

    saveLead({
      tripId: currentTrip, submissionId: st.submissionId, answers: st.answers,
      name: contact.name, city: contact.city, state: contact.state,
      consent: true, consentText: ($('[data-consent-text]') || {}).textContent || '',
      protocol: st.protocol, score: { total: score.total, classification: score.classification, byCategory: score.byCategory },
      source: Object.assign({}, SOURCE, { page: location.href.slice(0, 500) }),
    }, t);

    var w = null;
    try { w = window.open(st.waUrl, '_blank'); } catch (e) { w = null; }
    if (w) { try { w.opener = null; } catch (e) {} }
    renderForm();
    if (window.dataLayer) window.dataLayer.push({ event: 'lead_whatsapp', trip: t.name });
    // Navegadores que bloqueiam nova aba (ex.: navegador interno do Instagram): abre na mesma aba
    if (!w) setTimeout(function () { location.href = st.waUrl; }, 700);
  }

  /** Registra o lead (servidor ou planilha) sem bloquear o cliente. */
  function saveLead(payload, trip) {
    if (!STATIC) {
      fetch('/api/leads', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .catch(function (e) { console.warn('[Agnus Tour] lead não registrado no servidor', e); });
      return;
    }
    var body = Object.assign({}, payload, {
      event: 'lead.site',
      tripName: trip.name,
      tripDates: trip.dateLabel + ' · ' + trip.duration,
      answersDetailed: trip.form.questions.map(function (q) {
        var o = q.options.filter(function (x) { return x.id === payload.answers[q.id]; })[0] || {};
        return { questionId: q.id, role: q.role, question: q.text, answerId: o.id, answer: o.label };
      }),
      userAgent: navigator.userAgent.slice(0, 300),
    });
    var url = window.AGNUS_PLANILHA_URL || STATIC.sheetsUrl;
    if (!url) {
      console.warn('[Agnus Tour] URL da planilha não configurada: lead não registrado (demonstração).', body);
      return;
    }
    // text/plain evita preflight de CORS no Apps Script
    fetch(url, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' })
      .catch(function (e) { console.warn('[Agnus Tour] lead não registrado na planilha', e); });
  }

  // Eventos do formulário (delegação)
  var formRoot = $('[data-form-root]');
  var pointerPick = false;
  formRoot.addEventListener('pointerdown', function (e) { pointerPick = !!e.target.closest('.opt'); });
  formRoot.addEventListener('change', function (e) {
    var st = getState(currentTrip);
    if (e.target.name === 'consent' && e.target.checked) {
      var box = e.target.closest('.consent');
      box.classList.remove('invalid');
      if (box.nextElementSibling && box.nextElementSibling.classList.contains('msg')) box.nextElementSibling.remove();
      delete st.fieldErrors.consent;
    }
    if (e.target.type === 'radio') {
      st.answers[e.target.name] = e.target.value;
      st.error = '';
      var err = $('.lf-error', formRoot); if (err) err.remove();
      if (pointerPick) { // avanço automático só no toque/clique; teclado usa "Continuar"
        pointerPick = false;
        setTimeout(function () { if (!st.done && st.step < TRIPS[currentTrip].form.questions.length) { st.step++; renderForm(); focusStep(); } }, 260);
      }
    }
  });
  formRoot.addEventListener('input', function (e) {
    if (e.target.name === 'whatsapp') {
      var pos = e.target.value.length;
      e.target.value = maskPhone(e.target.value);
      if (pos === e.target.value.length) { /* cursor no fim */ }
    }
    if (e.target.closest('.field.invalid')) {
      e.target.closest('.field').classList.remove('invalid');
      e.target.removeAttribute('aria-invalid');
      var m = $('.msg', e.target.closest('.field')); if (m) m.textContent = '';
    }
  });
  formRoot.addEventListener('submit', function (e) {
    e.preventDefault();
    var st = getState(currentTrip);
    var form = e.target;
    if (form.hasAttribute('data-q-form')) {
      var q = TRIPS[currentTrip].form.questions[st.step];
      if (!st.answers[q.id]) { st.error = 'Selecione uma opção para continuar.'; renderForm(); var r = $('input[type=radio]', formRoot); if (r) r.focus(); return; }
      st.error = ''; st.step++; renderForm(); focusStep();
    } else if (form.hasAttribute('data-contact-form')) {
      finalize(form);
    }
  });
  formRoot.addEventListener('click', function (e) {
    var st = currentTrip && getState(currentTrip);
    if (e.target.closest('[data-back]')) {
      var cf = $('[data-contact-form]', formRoot); if (cf) readContact(cf);
      st.error = ''; st.fieldErrors = {}; st.step = Math.max(0, st.step - 1); renderForm(); focusStep();
    }
    if (e.target.closest('[data-close]')) closeModal(leadModal);
  });
  function focusStep() {
    var el = $('input:checked', formRoot) || $('input[type=radio]', formRoot) || $('#lf-name', formRoot);
    if (el) el.focus({ preventScroll: true });
  }
  $('[data-itinerary-root]').addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeModal(itModal);
  });

  // Botões dos cards (e do roteiro)
  document.addEventListener('click', function (e) {
    var f = e.target.closest('[data-open-form]');
    if (f) { e.preventDefault(); whenReady(function () { openForm(f.getAttribute('data-open-form')); }); return; }
    var it = e.target.closest('[data-open-itinerary]');
    if (it) { e.preventDefault(); whenReady(function () { openItinerary(it.getAttribute('data-open-itinerary')); }); }
  });

  /* ---------- Política de privacidade em janela (arquivo único) ---------- */
  var privacy = $('#privacy-modal');
  if (privacy) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href="#privacidade"]');
      if (a) { e.preventDefault(); privacy.showModal(); }
      if (e.target.closest('[data-close-privacy]') || e.target === privacy) privacy.close();
    });
    if (location.hash === '#privacidade') privacy.showModal();
  }

  /* ---------- Carrega configuração ---------- */
  var ready = [];
  function whenReady(fn) { if (CONFIG) fn(); else ready.push(fn); }
  function applyConfig(cfg) {
    CONFIG = cfg;
    cfg.trips.forEach(function (t) { TRIPS[t.id] = t; });
    $$('[data-wa]').forEach(function (a) { a.href = waLink('Olá, gostaria de falar com um consultor sobre as peregrinações.'); });
    ready.splice(0).forEach(function (fn) { fn(); });
  }
  function loadConfig(attempt) {
    if (STATIC) return applyConfig(STATIC.config);
    fetch('/api/config').then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(applyConfig).catch(function () {
      if ((attempt || 0) < 3) setTimeout(function () { loadConfig((attempt || 0) + 1); }, 1500);
      else alert('Não foi possível carregar o formulário. Atualize a página ou fale conosco pelo WhatsApp.');
    });
  }
  loadConfig(0);

  /* ---------- Avaliações do Google ---------- */
  function initials(n) { return String(n || '?').split(' ').map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase(); }
  (STATIC ? Promise.resolve(STATIC.reviews) : fetch('/api/reviews').then(function (r) { return r.json(); })).then(function (g) {
    var track = $('[data-review-track]');
    if (!track) return;
    if (g.rating) $('[data-rating]').textContent = Number(g.rating).toFixed(1).replace('.', ',');
    if (g.reviewCount) $('[data-count]').textContent = g.reviewCount;
    if (g.mapsUrl) $$('[data-maps]').forEach(function (a) { a.href = g.mapsUrl; });
    if (g.reviews && g.reviews.length) {
      track.innerHTML = g.reviews.map(function (r) {
        var stars = ''; for (var i = 0; i < 5; i++) stars += '<svg style="opacity:' + (i < r.rating ? 1 : .25) + '"><use href="#i-star"/></svg>';
        var avatar = r.photo ? '<img src="' + esc(r.photo) + '" alt="" referrerpolicy="no-referrer" loading="lazy">' : '<span class="avatar">' + esc(initials(r.author)) + '</span>';
        var name = r.authorUrl ? '<a href="' + esc(r.authorUrl) + '" target="_blank" rel="noopener">' + esc(r.author) + '</a>' : esc(r.author);
        return '<article class="review"><div class="review-head">' + avatar + '<div><strong>' + name + '</strong><span class="review-when">' + esc(r.when) + '</span></div></div>' +
          '<span class="stars" aria-label="' + r.rating + ' de 5 estrelas">' + stars + '</span><p class="clamp">' + esc(r.text) + '</p></article>';
      }).join('') + '<p class="review-src">' + icon('google', 'ic-sm') + 'Avaliações publicadas no Google.</p>';
    } else {
      track.innerHTML = '<div class="review-empty"><h3>Nota máxima de quem já viajou com a gente</h3>' +
        '<p>Nossos peregrinos avaliam a Agnus Tour com ' + esc(Number(g.rating).toFixed(1).replace('.', ',')) + ' estrelas no Google. Leia os depoimentos completos de quem já viveu essa experiência.</p>' +
        '<p><a class="btn btn-primary" href="' + esc(g.mapsUrl) + '" target="_blank" rel="noopener">' + icon('google') + 'Ler avaliações no Google</a></p></div>';
    }
  }).catch(function () {});

  /* ---------- Instagram ---------- */
  (STATIC ? Promise.resolve(STATIC.instagram) : fetch('/api/instagram').then(function (r) { return r.json(); })).then(function (ig) {
    var box = $('[data-instagram]');
    if (!box) return;
    if (ig.source === 'api' && ig.posts.length) {
      box.innerHTML = ig.posts.map(function (p) {
        return '<a class="ig-post" href="' + esc(p.url) + '" target="_blank" rel="noopener" aria-label="Ver publicação no Instagram"><img src="' + esc(p.image) + '" alt="' + esc(p.caption.slice(0, 120)) + '" loading="lazy"><span class="ig-cap">' + esc(p.caption) + '</span></a>';
      }).join('');
    } else if (ig.embeds && ig.embeds.length) {
      box.classList.add('embeds');
      box.innerHTML = ig.embeds.map(function (u) {
        return '<blockquote class="instagram-media" data-instgrm-permalink="' + esc(u) + '?utm_source=ig_embed" data-instgrm-version="14"><a href="' + esc(u) + '" target="_blank" rel="noopener">Ver esta publicação no Instagram</a></blockquote>';
      }).join('');
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.instagram.com/embed.js'; document.body.appendChild(s);
    } else {
      box.innerHTML = '<div class="ig-card"><span class="ig-ring"><img src="' + esc(img('img/logo.png')) + '" alt=""></span><div><h3 style="margin:0 0 4px">@' + esc(ig.username) + '</h3>' +
        '<p>Fotos dos grupos, novidades das peregrinações e momentos de fé de quem viaja com a Agnus Tour.</p></div></div>';
      $('.center', box.parentNode).style.display = 'none';
      box.querySelector('.ig-card').insertAdjacentHTML('beforeend', '<a class="btn btn-ig" href="' + esc(ig.profileUrl) + '" target="_blank" rel="noopener" style="margin-left:auto;flex:none">' + icon('instagram') + 'Seguir</a>');
    }
  }).catch(function () {});
})();
