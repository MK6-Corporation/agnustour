'use strict';
/*
 * Armazenamento de leads em arquivo JSON (data/leads.json).
 * Gravações são serializadas em fila e atômicas — o lead está em disco
 * antes de a API responder sucesso ao navegador.
 */
const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('./fsutil');
const { DATA_DIR } = require('./settings');

const FILE = path.join(DATA_DIR, 'leads.json');
let leads = null;
let queue = Promise.resolve();

function load() {
  if (leads) return leads;
  try {
    leads = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!Array.isArray(leads)) throw new Error('leads.json não é uma lista');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      // Não sobrescreve um arquivo corrompido: preserva cópia e interrompe.
      const bak = `${FILE}.corrompido-${Date.now()}`;
      try { fs.copyFileSync(FILE, bak); } catch (_) { /* ignore */ }
      throw new Error(`Falha ao ler ${FILE} (${e.message}). Cópia em ${bak}.`);
    }
    leads = [];
  }
  return leads;
}

function serialize(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

/** Insere o lead; se já existir um com o mesmo submissionId, devolve o existente. */
function insert(lead) {
  return serialize(async () => {
    const list = load();
    const dup = list.find((l) => l.submissionId === lead.submissionId);
    if (dup) return { lead: dup, duplicate: true };
    const next = [...list, lead];
    await writeJsonAtomic(FILE, next);
    leads = next;
    return { lead, duplicate: false };
  });
}

function update(id, patch) {
  return serialize(async () => {
    const list = load();
    const i = list.findIndex((l) => l.id === id);
    if (i < 0) return null;
    const next = list.slice();
    next[i] = { ...next[i], ...patch };
    await writeJsonAtomic(FILE, next);
    leads = next;
    return next[i];
  });
}

function all() {
  return load();
}

module.exports = { insert, update, all, FILE };
