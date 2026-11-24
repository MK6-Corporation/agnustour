/*
 * Agnus Tour · pontuação dos leads, protocolo e mensagem do WhatsApp.
 * Arquivo único usado pelo navegador (window.AgnusScoring) e pelo servidor (require).
 *
 * PROTOCOLO (só a equipe sabe ler):  AG-TS-38857
 *   AG-TS  → viagem (MX México · TS Terra Santa · AI Aparecida Pe. Idlain · AW Aparecida Pe. Welinton)
 *   38     → dois dígitos aleatórios (disfarce)
 *   85     → pontuação (00–99; 100 aparece como 99)
 *   7      → termômetro: 7 = QUENTE · 4 = MORNO · 1 = FRIO
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AgnusScoring = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CATS = ['availability', 'financial', 'timing', 'preparation'];
  var CLASS_DIGIT = { quente: 7, morno: 4, frio: 1 };

  /** Pontos financeiros de uma faixa de orçamento comparada ao valor de referência. */
  function budgetPoints(option, referencePrice, categoryMax, tiers) {
    if (option.max === null || option.max === undefined || option.max >= referencePrice) return categoryMax;
    var ratio = option.max / referencePrice;
    var sorted = tiers.slice().sort(function (a, b) { return b.minRatio - a.minRatio; });
    var tier = null;
    for (var i = 0; i < sorted.length; i++) if (ratio >= sorted[i].minRatio) { tier = sorted[i]; break; }
    return Math.round(((tier ? tier.pct : 0) / 100) * categoryMax * 10) / 10;
  }

  /**
   * @param trip    viagem com perguntas (category, budgetBands, options[{id, points, max}])
   * @param answers { q1: 'a', ... }
   * @param cfg     { points, categoryMax, thresholds, referencePrices, budgetTiers }
   */
  function scoreAnswers(trip, answers, cfg) {
    var byCategory = { availability: 0, financial: 0, timing: 0, preparation: 0 };
    var detail = [];
    var ref = cfg.referencePrices ? cfg.referencePrices[trip.id] : null;
    trip.form.questions.forEach(function (q) {
      var opt = null;
      for (var i = 0; i < q.options.length; i++) if (q.options[i].id === answers[q.id]) opt = q.options[i];
      var pts = 0;
      if (q.category && opt) {
        if (q.budgetBands && ref) pts = budgetPoints(opt, ref, cfg.categoryMax.financial, cfg.budgetTiers);
        else {
          var tp = (cfg.points && cfg.points[trip.id] && cfg.points[trip.id][q.id]) || {};
          pts = Number(tp[opt.id] !== undefined ? tp[opt.id] : opt.points || 0);
        }
        byCategory[q.category] += pts;
      }
      detail.push({ questionId: q.id, category: q.category, points: pts });
    });
    var total = 0;
    CATS.forEach(function (k) {
      var max = Number(cfg.categoryMax[k]);
      byCategory[k] = Math.max(0, Math.min(max, Math.round(byCategory[k] * 10) / 10));
      total += byCategory[k];
    });
    total = Math.min(100, Math.round(total));
    var cls = total >= cfg.thresholds.hot ? 'quente' : total >= cfg.thresholds.warm ? 'morno' : 'frio';
    return { total: total, byCategory: byCategory, classification: cls, detail: detail };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** Protocolo com o termômetro disfarçado. rnd opcional (0–99) para testes. */
  function protocol(tripCode, total, classification, rnd) {
    var r = rnd === undefined ? Math.floor(Math.random() * 90) + 10 : rnd;
    return 'AG-' + tripCode + '-' + pad2(r) + pad2(Math.min(99, Math.max(0, total))) + CLASS_DIGIT[classification];
  }

  /** Lê um protocolo (para o painel/planilha). */
  function decodeProtocol(p) {
    var m = /^AG-([A-Z]{2})-(\d{2})(\d{2})([147])$/.exec(String(p || '').trim());
    if (!m) return null;
    return { trip: m[1], score: Number(m[3]), classification: { 7: 'quente', 4: 'morno', 1: 'frio' }[m[4]] };
  }

  /** Mensagem pronta para o WhatsApp (formatação do WhatsApp: *negrito*). */
  function whatsappMessage(trip, answers, contact, proto) {
    var lines = [
      'Olá! Quero receber o roteiro completo e as condições da viagem *' + trip.name + '* (' + trip.dateLabel + ' · ' + trip.duration + ').',
      '',
      '*Meus dados*',
      'Nome: ' + contact.name,
      'Cidade: ' + contact.city + '/' + contact.state,
      '',
      '*Minhas respostas*',
    ];
    trip.form.questions.forEach(function (q, i) {
      var opt = null;
      for (var j = 0; j < q.options.length; j++) if (q.options[j].id === answers[q.id]) opt = q.options[j];
      lines.push((i + 1) + '. ' + (q.short || q.text) + ': ' + (opt ? opt.label.replace(/\.$/, '') : '-'));
    });
    lines.push('', 'Protocolo: ' + proto);
    return lines.join('\n');
  }

  return { scoreAnswers: scoreAnswers, budgetPoints: budgetPoints, protocol: protocol, decodeProtocol: decodeProtocol, whatsappMessage: whatsappMessage, CLASS_DIGIT: CLASS_DIGIT };
});
