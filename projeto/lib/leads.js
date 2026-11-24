'use strict';
const crypto = require('crypto');
const { getTrip, CATEGORIES } = require('./trips');
const { scoreLead, protocol: makeProtocol, decodeProtocol } = require('./scoring');

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const DDDS = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
const POLICY_VERSION = '2026-11';

class ValidationError extends Error {
  constructor(fields) {
    super('Verifique os campos destacados.');
    this.fields = fields;
  }
}

/** Valida WhatsApp brasileiro com DDD. Retorna só dígitos (com 55) ou null. */
function normalizeWhatsapp(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  if (!DDDS.has(Number(d.slice(0, 2)))) return null;
  if (d.length === 11 && d[2] !== '9') return null;
  if (/^(\d)\1+$/.test(d.slice(2))) return null;
  return '55' + d;
}

function formatWhatsapp(d) {
  const n = d.startsWith('55') ? d.slice(2) : d;
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
}

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function cleanSource(src) {
  const s = src && typeof src === 'object' ? src : {};
  const out = {};
  for (const k of UTM_KEYS) if (s[k]) out[k] = clean(s[k], 200);
  for (const k of ['referrer', 'landingPage', 'page']) if (s[k]) out[k] = clean(s[k], 500);
  return out;
}

/**
 * Valida o corpo enviado pelo formulário e monta o registro completo do lead.
 * Lança ValidationError com { campo: mensagem }.
 */
function buildLead(body, settings, meta = {}) {
  const errors = {};
  const b = body && typeof body === 'object' ? body : {};
  const trip = getTrip(String(b.tripId || ''));
  if (!trip) throw new ValidationError({ tripId: 'Viagem inválida.' });

  const submissionId = String(b.submissionId || '');
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(submissionId)) errors.submissionId = 'Envio inválido. Recarregue a página.';

  const answersIn = b.answers && typeof b.answers === 'object' ? b.answers : {};
  const answers = {};
  for (const q of trip.form.questions) {
    const v = String(answersIn[q.id] || '');
    if (!q.options.some((o) => o.id === v)) errors[q.id] = 'Selecione uma opção.';
    else answers[q.id] = v;
  }

  const name = clean(b.name, 120);
  if (name.length < 5 || !/\s/.test(name) || !/^[\p{L}\s'.-]+$/u.test(name)) errors.name = 'Informe seu nome completo.';
  // WhatsApp é opcional: no fluxo atual o cliente envia a mensagem do próprio WhatsApp
  const whatsapp = b.whatsapp ? normalizeWhatsapp(b.whatsapp) : null;
  if (b.whatsapp && !whatsapp) errors.whatsapp = 'Informe um WhatsApp válido com DDD.';
  const city = clean(b.city, 80);
  if (city.length < 2) errors.city = 'Informe sua cidade.';
  const state = String(b.state || '').toUpperCase();
  if (!UFS.includes(state)) errors.state = 'Selecione o estado.';
  const email = clean(b.email, 160).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'E-mail inválido.';
  if (b.consent !== true) errors.consent = 'É necessário autorizar o contato para enviar.';

  if (Object.keys(errors).length) throw new ValidationError(errors);

  const score = scoreLead(trip, answers, settings);
  // Protocolo enviado na mensagem do WhatsApp (gerado no navegador). Se faltar ou for inválido, gera um aqui.
  const sent = decodeProtocol(b.protocol);
  const protocol = sent && sent.trip === trip.code ? String(b.protocol).trim() : makeProtocol(trip.code, score.total, score.classification);
  const qa = trip.form.questions.map((q) => {
    const o = q.options.find((x) => x.id === answers[q.id]);
    const d = score.detail.find((x) => x.questionId === q.id);
    return {
      questionId: q.id,
      role: q.role,
      question: q.text,
      answerId: o.id,
      answer: o.label,
      category: q.category,
      categoryLabel: q.category ? CATEGORIES[q.category].label : null,
      points: d ? d.points : 0,
    };
  });
  const byRole = (r) => qa.find((x) => x.role === r);
  const travQ = trip.form.questions.find((q) => q.role === 'travelers');
  const travOpt = travQ && travQ.options.find((o) => o.id === answers[travQ.id]);
  const refPrice = trip.international ? settings.referencePrices[trip.id] : null;

  return {
    id: crypto.randomUUID(),
    submissionId,
    createdAt: new Date().toISOString(),
    trip: { id: trip.id, name: trip.name, dates: `${trip.dateLabel} · ${trip.duration}` },
    protocol,
    contact: { name, whatsapp, whatsappFormatted: whatsapp ? formatWhatsapp(whatsapp) : null, city, state, email: email || null },
    answers: qa,
    travelers: travOpt ? { label: travOpt.label, count: travOpt.travelers, plus: Boolean(travOpt.travelersPlus) } : null,
    financial: byRole('budget') ? { answer: byRole('budget').answer, points: score.byCategory.financial, referencePrice: refPrice } : null,
    purchaseTiming: byRole('timing') ? byRole('timing').answer : null,
    score: { total: score.total, byCategory: score.byCategory, classification: score.classification, label: score.label },
    consent: { accepted: true, at: new Date().toISOString(), policyVersion: POLICY_VERSION, text: clean(b.consentText, 400) },
    source: cleanSource(b.source),
    userAgent: clean(meta.userAgent, 300),
    webhook: null,
  };
}

/* ---------- CSV ---------- */
function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita injeção de fórmulas no Excel
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(list) {
  const header = [
    'Data/hora', 'Viagem', 'Protocolo', 'Nome', 'WhatsApp', 'Cidade', 'UF', 'E-mail', 'Pontuação', 'Classificação',
    'Disponibilidade', 'Financeiro', 'Prazo', 'Preparo', 'Viajantes', 'Orçamento/compatibilidade', 'Prazo de compra',
    'P1', 'R1', 'P2', 'R2', 'P3', 'R3', 'P4', 'R4', 'P5', 'R5', 'P6', 'R6',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'Página de origem', 'Referência', 'Webhook', 'ID',
  ];
  const rows = list.map((l) => {
    const qa = [];
    for (let i = 0; i < 6; i++) qa.push(l.answers[i] ? l.answers[i].question : '', l.answers[i] ? l.answers[i].answer : '');
    const s = l.source || {};
    return [
      new Date(l.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' }),
      l.trip.name, l.protocol || '', l.contact.name, l.contact.whatsappFormatted || '', l.contact.city, l.contact.state, l.contact.email || '',
      l.score.total, l.score.label,
      l.score.byCategory.availability, l.score.byCategory.financial, l.score.byCategory.timing, l.score.byCategory.preparation,
      l.travelers ? l.travelers.label : '', l.financial ? l.financial.answer : '', l.purchaseTiming || '',
      ...qa,
      s.utm_source, s.utm_medium, s.utm_campaign, s.utm_term, s.utm_content, s.gclid, s.fbclid, s.landingPage, s.referrer,
      l.webhook ? l.webhook.status : '', l.id,
    ];
  });
  // BOM + ponto e vírgula: abre corretamente no Excel em português
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}

/* ---------- Filtros do painel ---------- */
function filterLeads(list, q) {
  const from = q.from ? new Date(`${q.from}T00:00:00-04:00`) : null;
  const to = q.to ? new Date(`${q.to}T23:59:59.999-04:00`) : null;
  const term = String(q.q || '').trim().toLowerCase();
  return list
    .filter((l) => !q.trip || l.trip.id === q.trip)
    .filter((l) => !q.classification || l.score.classification === q.classification)
    .filter((l) => !from || new Date(l.createdAt) >= from)
    .filter((l) => !to || new Date(l.createdAt) <= to)
    .filter((l) => !term || [l.contact.name, l.contact.whatsapp, l.contact.city, l.contact.email, l.protocol].join(' ').toLowerCase().includes(term))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

module.exports = { buildLead, ValidationError, normalizeWhatsapp, toCsv, filterLeads, UFS };
