'use strict';
// A lógica fica em public/js/scoring.js, compartilhada com o navegador (mesmo termômetro nos dois lados).
const core = require('../public/js/scoring.js');

const CLASS_LABELS = {
  quente: 'Lead Quente – Alta prioridade',
  morno: 'Lead Morno – Média prioridade',
  frio: 'Lead Frio – Baixa prioridade',
};

function scoreLead(trip, answers, settings) {
  const r = core.scoreAnswers(trip, answers, settings);
  return { ...r, label: CLASS_LABELS[r.classification] };
}

module.exports = { scoreLead, budgetPoints: core.budgetPoints, protocol: core.protocol, decodeProtocol: core.decodeProtocol, whatsappMessage: core.whatsappMessage, CLASS_LABELS };
