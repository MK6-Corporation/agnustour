/**
 * AGNUS TOUR · Registro dos leads do site no Google Sheets
 * --------------------------------------------------------
 * O cliente responde o formulário e finaliza no WhatsApp com uma mensagem pronta.
 * Em paralelo, o site envia uma cópia para esta planilha com as respostas,
 * a pontuação, o termômetro (Quente/Morno/Frio) e o protocolo que foi na mensagem.
 *
 * INSTALAÇÃO (5 minutos)
 *  1. Abra a planilha → Extensões → Apps Script. Apague tudo, cole este arquivo e salve.
 *  2. Escolha a função "configurar" → Executar (autorize quando o Google pedir).
 *  3. Implantar → Nova implantação → tipo "App da Web"
 *       • Executar como: Eu      • Quem pode acessar: Qualquer pessoa
 *     Copie a URL que termina em /exec e cole no agnus-tour.html (AGNUS_PLANILHA_URL).
 *
 * Ao alterar ESTE CÓDIGO depois: Implantar → Gerenciar implantações → editar (lápis) →
 * Versão: "Nova versão" → Implantar. A URL continua a mesma.
 *
 * COMO LER O PROTOCOLO  (ex.: AG-TS-38857)
 *   AG-TS → viagem (MX México · TS Terra Santa · AI Aparecida Pe. Idlain · AW Aparecida Pe. Welinton)
 *   38    → dígitos aleatórios (disfarce)
 *   85    → pontuação (0 a 99)
 *   7     → termômetro: 7 = QUENTE · 4 = MORNO · 1 = FRIO
 */

// ===================== CONFIGURAÇÃO =====================
var TOKEN = '';                   // Só para a versão com servidor (painel /admin). Deixe vazio na versão HTML.
var ABAS_POR_VIAGEM = true;       // também copia cada lead para uma aba com o nome da viagem
var FUSO = 'America/Cuiaba';
var EMAIL_ALERTA_QUENTE = '';     // ex.: 'comercial@agnustour.com.br' (vazio = sem e-mail)
// ========================================================

var ABA_LEADS = 'Leads';
var ABA_LEGENDA = 'Legenda';
var COLUNAS = [
  'Data/hora', 'Viagem', 'Protocolo', 'Nome', 'Cidade', 'UF', 'WhatsApp',
  'Pontuação', 'Termômetro',
  'Disponibilidade (pts)', 'Financeiro (pts)', 'Prazo (pts)', 'Preparo (pts)',
  'Viajantes', 'Orçamento / investimento', 'Prazo de compra',
  'Pergunta 1', 'Resposta 1', 'Pergunta 2', 'Resposta 2', 'Pergunta 3', 'Resposta 3',
  'Pergunta 4', 'Resposta 4', 'Pergunta 5', 'Resposta 5', 'Pergunta 6', 'Resposta 6',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid',
  'Página de entrada', 'Referência', 'Consentimento LGPD', 'Status do atendimento', 'ID do lead'
];
var COL_PONTOS = COLUNAS.indexOf('Pontuação') + 1;
var CORES = { quente: '#F8D7D8', morno: '#FCEFC7', frio: '#DCE9F5' };
var ROTULOS = { quente: 'Quente – Alta prioridade', morno: 'Morno – Média prioridade', frio: 'Frio – Baixa prioridade' };
var DIGITO = { 7: 'quente', 4: 'morno', 1: 'frio' };

/* ============================ ENTRADA ============================ */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // evita linhas sobrepostas em envios simultâneos
    var dados = lerCorpo_(e);
    if (dados.website) return json_({ ok: true }); // honeypot anti-robô

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('Script não está ligado a uma planilha. Abra pela planilha: Extensões → Apps Script.');
    garantirAbas_(ss);

    var lead;
    if (dados.event === 'lead.site') {
      lead = montarLeadDoSite_(dados);                // versão HTML
    } else {
      if (TOKEN && dados.token !== TOKEN) return json_({ ok: false, error: 'token inválido' });
      if (dados.event === 'lead.test') return json_({ ok: true, test: true, planilha: ss.getName() });
      lead = dados.lead;                              // versão com servidor
    }
    if (!lead || !lead.id) return json_({ ok: false, error: 'lead sem ID' });

    var aba = ss.getSheetByName(ABA_LEADS);
    if (idJaExiste_(aba, lead.id)) return json_({ ok: true, duplicate: true, id: lead.id });

    var linha = montarLinha_(lead);
    gravar_(aba, linha, lead);
    if (ABAS_POR_VIAGEM && lead.trip && lead.trip.name) gravar_(obterAbaLeads_(ss, nomeAba_(lead.trip.name)), linha, lead);
    if (EMAIL_ALERTA_QUENTE && lead.score && lead.score.classification === 'quente') alertar_(lead);

    return json_({ ok: true, id: lead.id });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, servico: 'Agnus Tour · recebimento de leads', hora: new Date().toISOString() });
}

/** Rode uma vez: cria as abas Leads e Legenda. */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abra este script pela planilha: Extensões → Apps Script.');
  garantirAbas_(ss);
  console.log('Planilha pronta: ' + ss.getUrl());
}

/**
 * TESTE: grava um lead de exemplo exatamente como o site envia.
 * No editor: escolha "testarGravacao" → Executar → veja a aba Leads.
 */
function testarGravacao() {
  var exemplo = {
    event: 'lead.site', tripId: 'terra-santa-roma', tripName: 'Terra Santa e Roma',
    submissionId: 'teste-' + new Date().getTime() + '-agnus', name: 'Lead de Teste', city: 'Cuiabá', state: 'MT',
    consent: true, protocol: 'AG-TS-12857',
    score: { total: 85, classification: 'quente', byCategory: { availability: 25, financial: 30, timing: 22, preparation: 8 } },
    answersDetailed: [
      { questionId: 'q1', role: 'availability', question: 'Você tem disponibilidade para viajar de 04 a 16 de novembro de 2027?', answerId: 'a', answer: 'Sim, tenho disponibilidade confirmada.' },
      { questionId: 'q3', role: 'travelers', question: 'Quantas pessoas pretendem participar da peregrinação?', answerId: 'b', answer: '2 pessoas.' },
      { questionId: 'q5', role: 'budget', question: 'Qual faixa de investimento por pessoa está dentro do seu planejamento?', answerId: 'c', answer: 'De R$ 20.001 a R$ 25.000.' },
      { questionId: 'q6', role: 'timing', question: 'Se as condições atenderem às suas expectativas, quando pretende confirmar sua participação?', answerId: 'b', answer: 'Nos próximos 15 dias.' }
    ],
    source: { utm_source: 'teste' }
  };
  var r = doPost({ postData: { contents: JSON.stringify(exemplo) } }).getContent();
  console.log(r);
  if (JSON.parse(r).ok !== true) throw new Error('Falhou: ' + r);
}

/* ======================= LEAD VINDO DO HTML ======================= */

function montarLeadDoSite_(d) {
  var nome = limpar_(d.name, 120);
  if (nome.length < 5 || nome.indexOf(' ') < 0) throw new Error('nome inválido');
  if (d.consent !== true) throw new Error('consentimento ausente');
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(String(d.submissionId || ''))) throw new Error('envio inválido');

  var zap = String(d.whatsapp || '').replace(/\D/g, '');
  if (zap.length >= 12 && zap.indexOf('55') === 0) zap = zap.slice(2);
  if (zap && zap.length !== 10 && zap.length !== 11) zap = '';

  var respostas = (d.answersDetailed || []).slice(0, 6).map(function (a) {
    return { questionId: limpar_(a.questionId, 10), role: limpar_(a.role, 20), question: limpar_(a.question, 300), answerId: limpar_(a.answerId, 5), answer: limpar_(a.answer, 200) };
  });
  var porPapel = function (r) { return respostas.filter(function (a) { return a.role === r; })[0]; };

  // Termômetro: o mesmo que foi no protocolo da mensagem do WhatsApp
  var proto = limpar_(d.protocol, 20).toUpperCase();
  var m = /^AG-[A-Z]{2}-\d{2}(\d{2})([147])$/.exec(proto);
  var sc = d.score || {};
  var total = Math.max(0, Math.min(100, Math.round(Number(sc.total))));
  var cls = DIGITO[m ? m[2] : ''] || (/^(quente|morno|frio)$/.test(sc.classification) ? sc.classification : '');
  if (!isFinite(total)) total = m ? Number(m[1]) : '';
  var bc = sc.byCategory || {};

  var src = d.source || {};
  var origem = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'referrer', 'landingPage', 'page'].forEach(function (k) { if (src[k]) origem[k] = limpar_(src[k], 500); });

  return {
    id: String(d.submissionId),
    createdAt: new Date().toISOString(),
    protocol: m ? proto : '',
    trip: { id: limpar_(d.tripId, 60), name: limpar_(d.tripName, 120) },
    contact: {
      name: nome, city: limpar_(d.city, 80), state: limpar_(d.state, 2).toUpperCase(),
      whatsapp: zap ? '55' + zap : '', whatsappFormatted: zap ? '(' + zap.slice(0, 2) + ') ' + zap.slice(2) : ''
    },
    answers: respostas,
    travelers: porPapel('travelers') ? { label: porPapel('travelers').answer } : null,
    financial: porPapel('budget') ? { answer: porPapel('budget').answer } : null,
    purchaseTiming: porPapel('timing') ? porPapel('timing').answer : '',
    score: {
      total: total, classification: cls, label: ROTULOS[cls] || '',
      byCategory: { availability: num_(bc.availability), financial: num_(bc.financial), timing: num_(bc.timing), preparation: num_(bc.preparation) }
    },
    consent: { accepted: true, at: new Date().toISOString(), policyVersion: '2026-11' },
    source: origem
  };
}

/* ============================ PLANILHA ============================ */

function garantirAbas_(ss) {
  obterAbaLeads_(ss, ABA_LEADS);
  if (!ss.getSheetByName(ABA_LEGENDA)) {
    var a = ss.insertSheet(ABA_LEGENDA);
    var linhas = [
      ['Como ler o protocolo (ex.: AG-TS-38857)', ''],
      ['AG-TS', 'Viagem: MX México e Cancún · TS Terra Santa e Roma · AI Aparecida Pe. Idlain · AW Aparecida Pe. Welinton'],
      ['38', 'Dígitos aleatórios (disfarce)'],
      ['85', 'Pontuação do lead (0 a 99)'],
      ['Último dígito', '7 = QUENTE (alta prioridade) · 4 = MORNO (média) · 1 = FRIO (baixa)'],
      ['', ''],
      ['Termômetro', 'Quente: 75 a 100 pontos · Morno: 45 a 74 · Frio: 0 a 44'],
      ['Critérios', 'Disponibilidade (até 25) · Financeiro (até 30) · Prazo de reserva (até 30) · Documentação/embarque/preparo (até 15)'],
      ['Observação', 'O protocolo aparece na mensagem do cliente no WhatsApp. Não explique o código ao cliente.']
    ];
    a.getRange(1, 1, linhas.length, 2).setValues(linhas);
    a.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#009BDC').setFontColor('#FFFFFF');
    a.getRange(2, 1, linhas.length - 1, 1).setFontWeight('bold');
    a.setColumnWidth(1, 220);
    a.setColumnWidth(2, 720);
  }
}

function obterAbaLeads_(ss, nome) {
  var aba = ss.getSheetByName(nome);
  if (!aba) aba = ss.insertSheet(nome, 0);
  if (aba.getLastRow() === 0) {
    aba.appendRow(COLUNAS);
    aba.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold').setBackground('#009BDC').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    aba.setFrozenColumns(4);
    var status = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Novo', 'Em atendimento', 'Proposta enviada', 'Reservou', 'Sem interesse'], true).build();
    aba.getRange(2, COLUNAS.indexOf('Status do atendimento') + 1, aba.getMaxRows() - 1, 1).setDataValidation(status);
  }
  return aba;
}

function montarLinha_(l) {
  var c = l.contact || {}, s = l.score || {}, b = s.byCategory || {}, o = l.source || {};
  var qa = [];
  for (var i = 0; i < 6; i++) {
    var a = (l.answers || [])[i];
    qa.push(a ? a.question : '', a ? a.answer : '');
  }
  var data = l.createdAt ? new Date(l.createdAt) : new Date();
  return [
    Utilities.formatDate(data, FUSO, 'dd/MM/yyyy HH:mm:ss'),
    (l.trip && l.trip.name) || '', l.protocol || '', c.name || '', c.city || '', c.state || '', c.whatsappFormatted || '',
    s.total, s.label || '',
    val_(b.availability), val_(b.financial), val_(b.timing), val_(b.preparation),
    l.travelers ? l.travelers.label : '', l.financial ? l.financial.answer : '', l.purchaseTiming || ''
  ].concat(qa).concat([
    o.utm_source || '', o.utm_medium || '', o.utm_campaign || '', o.utm_term || '', o.utm_content || '', o.gclid || '', o.fbclid || '',
    o.landingPage || o.page || '', o.referrer || '',
    l.consent && l.consent.accepted ? 'Aceito em ' + Utilities.formatDate(new Date(l.consent.at || data), FUSO, 'dd/MM/yyyy HH:mm') : 'Não',
    'Novo', l.id
  ]).map(seguro_);
}

function gravar_(aba, linha, lead) {
  aba.appendRow(linha);
  var cor = CORES[(lead.score && lead.score.classification) || ''];
  if (cor) aba.getRange(aba.getLastRow(), COL_PONTOS, 1, 2).setBackground(cor).setFontWeight('bold');
}

function idJaExiste_(aba, id) {
  var n = aba.getLastRow() - 1;
  if (n < 1) return false;
  return aba.getRange(2, COLUNAS.length, n, 1).createTextFinder(String(id)).matchEntireCell(true).findNext() !== null;
}

/* ============================ UTILITÁRIOS ============================ */

function lerCorpo_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (_) { /* segue */ }
  }
  return (e && e.parameter) || {};
}
function limpar_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function num_(v) { var n = Number(v); return isFinite(n) && v !== '' && v !== null && v !== undefined ? n : ''; }
function val_(v) { return v === undefined || v === null ? '' : v; }
function nomeAba_(nome) { return String(nome).replace(/[\[\]\*\/\\\?:]/g, ' ').slice(0, 90); }
/** Impede que textos começando com = + - @ virem fórmulas na planilha. */
function seguro_(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function alertar_(l) {
  try {
    MailApp.sendEmail({
      to: EMAIL_ALERTA_QUENTE,
      subject: '🔥 Lead quente: ' + l.contact.name + ' — ' + l.trip.name + ' (' + (l.protocol || '') + ')',
      htmlBody: '<p><b>' + l.contact.name + '</b> · ' + l.contact.city + '/' + l.contact.state + '</p>' +
        '<p>Viagem: ' + l.trip.name + '<br>Protocolo: ' + (l.protocol || '-') + '<br>Pontuação: ' + l.score.total + ' — ' + l.score.label + '</p>' +
        '<p>O cliente foi direcionado ao WhatsApp da Agnus Tour com a mensagem pronta.</p>'
    });
  } catch (err) { console.error('Falha no e-mail de alerta: ' + err); }
}
