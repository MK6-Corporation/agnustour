(function () {
  'use strict';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var CLS = { quente: 'Quente', morno: 'Morno', frio: 'Frio' };
  var state = { leads: [], settings: null, meta: null };

  function api(path, opts) {
    opts = opts || {};
    if (opts.body && typeof opts.body !== 'string') { opts.body = JSON.stringify(opts.body); opts.headers = { 'Content-Type': 'application/json' }; }
    return fetch(path, Object.assign({ credentials: 'same-origin' }, opts)).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && path !== '/api/admin/login') { showLogin(); throw new Error(j.error || 'Sessão expirada'); }
        if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);
        return j;
      });
    });
  }

  /* ---------- Login ---------- */
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#login-form [name=user]').focus(); }
  function showApp() { $('#login').hidden = true; $('#app').hidden = false; loadLeads(); loadSettings(); }
  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target; $('#login-err').textContent = '';
    api('/api/admin/login', { method: 'POST', body: { user: f.user.value, password: f.password.value } })
      .then(function () { f.password.value = ''; showApp(); })
      .catch(function (err) { $('#login-err').textContent = err.message; });
  });
  $('#logout').addEventListener('click', function () { api('/api/admin/logout', { method: 'POST' }).finally(showLogin); });
  api('/api/admin/me').then(showApp).catch(function () {});

  /* ---------- Abas ---------- */
  $$('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      $$('.tab').forEach(function (x) { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', x === t); });
      $$('.panel').forEach(function (p) { p.hidden = p.id !== 'tab-' + t.dataset.tab; });
    });
  });

  /* ---------- Leads ---------- */
  var filters = $('#filters');
  function query() {
    var p = new URLSearchParams();
    ['trip', 'classification', 'from', 'to', 'q'].forEach(function (k) { if (filters[k].value) p.set(k, filters[k].value); });
    return p.toString();
  }
  var debounce;
  filters.addEventListener('input', function () { clearTimeout(debounce); debounce = setTimeout(loadLeads, 250); });
  filters.addEventListener('reset', function () { setTimeout(loadLeads, 0); });
  filters.addEventListener('submit', function (e) { e.preventDefault(); loadLeads(); });

  function fmtDate(iso) { return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  function loadLeads() {
    var q = query();
    $('#csv').href = '/api/admin/leads.csv' + (q ? '?' + q : '');
    api('/api/admin/leads' + (q ? '?' + q : '')).then(function (d) {
      state.leads = d.leads;
      var sel = filters.trip;
      if (sel.options.length === 1) d.trips.forEach(function (t) { sel.add(new Option(t.name, t.id)); });
      var c = d.counts;
      $('#kpis').innerHTML = '<div class="kpi"><strong>' + c.total + '</strong><span>Leads no filtro</span></div>' +
        '<div class="kpi quente"><strong>' + c.quente + '</strong><span>Quentes · alta prioridade</span></div>' +
        '<div class="kpi morno"><strong>' + c.morno + '</strong><span>Mornos · média prioridade</span></div>' +
        '<div class="kpi frio"><strong>' + c.frio + '</strong><span>Frios · baixa prioridade</span></div>';
      $('#rows').innerHTML = d.leads.map(function (l, i) {
        var tr = l.travelers ? l.travelers.label : '—';
        return '<tr><td>' + fmtDate(l.createdAt) + '</td>' +
          '<td><strong>' + esc(l.contact.name) + '</strong>' + (l.contact.whatsapp ? '<a class="wa" href="https://wa.me/' + esc(l.contact.whatsapp) + '" target="_blank" rel="noopener">' + esc(l.contact.whatsappFormatted) + '</a>' : '') + (l.protocol ? '<small>Protocolo ' + esc(l.protocol) + '</small>' : '') + '<small>' + esc(l.contact.city) + '/' + esc(l.contact.state) + (l.contact.email ? ' · ' + esc(l.contact.email) : '') + '</small></td>' +
          '<td>' + esc(l.trip.name) + '</td>' +
          '<td><span class="score">' + l.score.total + '</span><span class="badge ' + l.score.classification + '">' + CLS[l.score.classification] + '</span></td>' +
          '<td>' + esc(tr) + '</td><td>' + esc(l.financial ? l.financial.answer : '—') + '</td><td>' + esc(l.purchaseTiming || '—') + '</td>' +
          '<td><button class="btn ghost small" data-detail="' + i + '">Detalhes</button></td></tr>';
      }).join('');
      $('#empty').hidden = d.leads.length > 0;
    }).catch(function (e) { $('#empty').hidden = false; $('#empty').textContent = e.message; });
  }

  var drawer = $('#lead-detail');
  $('#rows').addEventListener('click', function (e) {
    var b = e.target.closest('[data-detail]');
    if (b) openDetail(state.leads[Number(b.dataset.detail)]);
  });
  drawer.addEventListener('click', function (e) {
    if (e.target === drawer || e.target.closest('.d-close')) drawer.close();
    var rs = e.target.closest('[data-resend]');
    if (rs) {
      rs.disabled = true; rs.textContent = 'Enviando…';
      api('/api/admin/leads/' + rs.dataset.resend + '/webhook', { method: 'POST' })
        .then(function (r) { rs.textContent = r.status === 'enviado' ? 'Enviado ✓' : 'Falhou: ' + (r.error || r.status); loadLeads(); })
        .catch(function (err) { rs.textContent = err.message; });
    }
  });

  function openDetail(l) {
    var cats = (state.meta && state.meta.categories) || {};
    var max = state.settings ? state.settings.categoryMax : {};
    var s = l.source || {};
    var srcRows = Object.keys(s).map(function (k) { return '<dt>' + esc(k) + '</dt><dd>' + esc(s[k]) + '</dd>'; }).join('') || '<dt>Origem</dt><dd>Acesso direto</dd>';
    $('#detail-body').innerHTML =
      '<div class="d-head"><div><h2>' + esc(l.contact.name) + '</h2><span class="score">' + l.score.total + ' pts</span><span class="badge ' + l.score.classification + '">' + esc(l.score.label) + '</span></div><button class="d-close" aria-label="Fechar">×</button></div>' +
      '<div class="d-sec"><dl><dt>Viagem</dt><dd>' + esc(l.trip.name) + '<br><small>' + esc(l.trip.dates) + '</small></dd>' +
      '<dt>Protocolo</dt><dd><strong>' + esc(l.protocol || '—') + '</strong></dd>' +
      '<dt>WhatsApp</dt><dd>' + (l.contact.whatsapp ? '<a href="https://wa.me/' + esc(l.contact.whatsapp) + '" target="_blank" rel="noopener">' + esc(l.contact.whatsappFormatted) + '</a>' : 'Pela conversa iniciada no WhatsApp') + '</dd>' +
      '<dt>Cidade</dt><dd>' + esc(l.contact.city) + '/' + esc(l.contact.state) + '</dd><dt>E-mail</dt><dd>' + esc(l.contact.email || '—') + '</dd>' +
      '<dt>Cadastro</dt><dd>' + fmtDate(l.createdAt) + '</dd><dt>Consentimento</dt><dd>Aceito em ' + fmtDate(l.consent.at) + ' (política ' + esc(l.consent.policyVersion) + ')</dd></dl></div>' +
      '<div class="d-sec"><h3>Pontuação por critério</h3><div class="bars">' + Object.keys(l.score.byCategory).map(function (k) {
        var m = max[k] || 1; var v = l.score.byCategory[k];
        return '<div class="bar"><span>' + esc(cats[k] ? cats[k].label : k) + '</span><span>' + v + ' / ' + m + '</span><i><b style="width:' + Math.min(100, (v / m) * 100) + '%"></b></i></div>';
      }).join('') + '</div></div>' +
      '<div class="d-sec"><h3>Respostas</h3><ol class="qa">' + l.answers.map(function (a) {
        return '<li><span class="p">' + (a.category ? a.points + ' pts' : '') + '</span><b>' + esc(a.question) + '</b>' + esc(a.answer) + '</li>';
      }).join('') + '</ol></div>' +
      '<div class="d-sec"><h3>Origem</h3><dl>' + srcRows + '</dl></div>' +
      '<div class="d-sec"><h3>Planilha / CRM</h3><p>' + (l.webhook ? esc(l.webhook.status) + (l.webhook.error ? ' — ' + esc(l.webhook.error) : '') : 'Não enviado (integração desativada no momento do cadastro)') + '</p>' +
      '<button class="btn ghost small" data-resend="' + esc(l.id) + '">Reenviar para a planilha</button></div>';
    drawer.showModal();
  }

  /* ---------- Configurações ---------- */
  function loadSettings() {
    api('/api/admin/settings').then(function (d) { state.meta = d; state.settings = d.settings; fillScoring(); fillIntegrations(); });
  }

  function fillScoring() {
    var s = state.settings, m = state.meta, f = $('#scoring-form');
    f.hot.value = s.thresholds.hot; f.warm.value = s.thresholds.warm;
    $('#cat-max').innerHTML = Object.keys(m.categories).map(function (k) {
      return '<label>' + esc(m.categories[k].label) + '<input type="number" min="0" max="100" data-cat="' + k + '" value="' + s.categoryMax[k] + '"></label>';
    }).join('');
    updateSum();
    $('#ref-prices').innerHTML = m.trips.filter(function (t) { return t.international; }).map(function (t) {
      var v = s.referencePrices[t.id];
      return '<label>' + esc(t.name) + ' — valor por pessoa (R$)<input type="number" min="1" step="1" data-ref="' + t.id + '" value="' + (v == null ? '' : v) + '" placeholder="Não definido"></label>';
    }).join('');
    $('#tiers').innerHTML = s.budgetTiers.map(function (t, i) {
      return '<div class="tier">Teto ≥ <input type="number" step="0.01" min="0" max="10" data-tier-ratio="' + i + '" value="' + t.minRatio + '"> × ref → <input type="number" min="0" max="100" data-tier-pct="' + i + '" value="' + t.pct + '">%</div>';
    }).join('');
    $('#trip-points').innerHTML = m.trips.map(function (t) {
      return '<div class="card"><h2>' + esc(t.name) + '</h2>' + t.form.questions.filter(function (q) { return q.category; }).map(function (q) {
        var budgetNote = q.budgetBands ? '<span class="note">Usado quando o valor de referência desta viagem está em branco.</span>' : '';
        return '<div class="q-block"><p>' + esc(q.text) + ' <span class="cat">· ' + esc(m.categories[q.category].label) + '</span></p><div class="pts">' +
          q.options.map(function (o) {
            return '<span>' + esc(o.label) + '</span><input type="number" min="0" max="100" step="0.5" aria-label="Pontos" data-pt="' + t.id + '|' + q.id + '|' + o.id + '" value="' + s.points[t.id][q.id][o.id] + '">';
          }).join('') + budgetNote + '</div></div>';
      }).join('') + '<p class="hint">A pergunta sobre a quantidade de viajantes não pontua; ela é registrada no lead.</p></div>';
    }).join('');
  }
  function updateSum() {
    var sum = $$('[data-cat]').reduce(function (a, i) { return a + Number(i.value || 0); }, 0);
    $('#cat-sum').textContent = 'Soma dos máximos: ' + sum + ' pontos' + (sum !== 100 ? ' (o total é limitado a 100)' : '');
  }
  $('#scoring-form').addEventListener('input', function (e) { if (e.target.dataset.cat) updateSum(); });

  function collectScoring() {
    var f = $('#scoring-form');
    var body = { thresholds: { hot: Number(f.hot.value), warm: Number(f.warm.value) }, categoryMax: {}, referencePrices: {}, budgetTiers: [], points: {} };
    $$('[data-cat]').forEach(function (i) { body.categoryMax[i.dataset.cat] = Number(i.value); });
    $$('[data-ref]').forEach(function (i) { body.referencePrices[i.dataset.ref] = i.value === '' ? null : Number(i.value); });
    $$('[data-tier-ratio]').forEach(function (i) { var k = i.dataset.tierRatio; body.budgetTiers.push({ minRatio: Number(i.value), pct: Number($('[data-tier-pct="' + k + '"]').value) }); });
    $$('[data-pt]').forEach(function (i) {
      var p = i.dataset.pt.split('|');
      body.points[p[0]] = body.points[p[0]] || {}; body.points[p[0]][p[1]] = body.points[p[0]][p[1]] || {};
      body.points[p[0]][p[1]][p[2]] = Number(i.value);
    });
    return body;
  }
  function saveWith(body, msgEl) {
    msgEl.className = ''; msgEl.textContent = 'Salvando…';
    return api('/api/admin/settings', { method: 'PUT', body: body }).then(function (d) {
      state.settings = d.settings; msgEl.className = 'ok'; msgEl.textContent = 'Salvo ✓ — vale para os próximos leads.';
    }).catch(function (e) { msgEl.className = 'bad'; msgEl.textContent = e.message; });
  }
  $('#scoring-form').addEventListener('submit', function (e) { e.preventDefault(); saveWith(collectScoring(), $('#scoring-msg')); });
  $('#restore-defaults').addEventListener('click', function () {
    if (!confirm('Restaurar a pontuação padrão? Os valores de referência também serão limpos.')) return;
    var d = state.meta.defaults;
    saveWith({ thresholds: d.thresholds, categoryMax: d.categoryMax, referencePrices: d.referencePrices, budgetTiers: d.budgetTiers, points: d.points }, $('#scoring-msg')).then(fillScoring);
  });

  function fillIntegrations() {
    var s = state.settings, f = $('#int-form'), env = state.meta.env;
    f.whatsappNumber.value = s.whatsappNumber;
    f.whEnabled.checked = s.webhook.enabled; f.whUrl.value = s.webhook.url; f.whSecret.value = '';
    f.whSecret.placeholder = s.webhook.hasSecret ? 'Segredo configurado — deixe em branco para manter' : 'Opcional';
    f.gRating.value = s.google.rating; f.gCount.value = s.google.reviewCount; f.gMin.value = s.google.minRatingToShow; f.gUrl.value = s.google.mapsUrl;
    f.igUser.value = s.instagram.username; f.igPosts.value = (s.instagram.posts || []).join('\n');
    $('#google-status').innerHTML = env.googlePlaces
      ? '<b class="ok">Conectado à API do Google.</b> Nota, total e avaliações são atualizados automaticamente (cache de 6 h).'
      : 'API não configurada: o site mostra a nota e o total abaixo, com link para o Google. Para exibir os depoimentos automaticamente, defina <code>GOOGLE_PLACES_API_KEY</code> e <code>GOOGLE_PLACE_ID</code> no servidor.';
    $('#ig-status').innerHTML = env.instagramApi
      ? '<b class="ok">Conectado à API do Instagram.</b> As últimas publicações aparecem automaticamente (cache de 1 h).'
      : 'API não configurada: o site exibe os posts em destaque listados abaixo (incorporação oficial do Instagram) ou um cartão para seguir o perfil. Para o feed automático, defina <code>INSTAGRAM_ACCESS_TOKEN</code> no servidor.';
  }
  $('#int-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    saveWith({
      whatsappNumber: f.whatsappNumber.value,
      webhook: { enabled: f.whEnabled.checked, url: f.whUrl.value, secret: f.whSecret.value === '' ? '__keep__' : f.whSecret.value },
      google: { rating: f.gRating.value, reviewCount: f.gCount.value, minRatingToShow: f.gMin.value, mapsUrl: f.gUrl.value },
      instagram: { username: f.igUser.value, posts: f.igPosts.value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean) },
    }, $('#int-msg')).then(fillIntegrations);
  });
  $('#wh-test').addEventListener('click', function () {
    var m = $('#wh-test-msg'); m.className = ''; m.textContent = 'Enviando teste…';
    api('/api/admin/webhook-test', { method: 'POST' }).then(function (r) {
      m.className = r.status === 'enviado' ? 'ok' : 'bad';
      m.textContent = r.status === 'enviado' ? 'Recebido pela planilha ✓' : 'Falhou: ' + (r.error || r.status);
    }).catch(function (e) { m.className = 'bad'; m.textContent = e.message; });
  });
})();
