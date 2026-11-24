'use strict';
// Testes de ponta a ponta da API: 4 formulários, salvamento, classificação,
// painel (filtros + CSV), configurações e envio para a planilha (mock do Apps Script).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'agnus-test-'));
process.env.DATA_DIR = DATA;
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'senha-de-teste-123';
process.env.ALLOW_HTTP_WEBHOOK = '1';
process.env.LEAD_RATE_LIMIT = '1000';

const { server } = require('../server');
const { TRIPS } = require('../lib/trips');
let base;
let cookie = '';
const received = [];
let sheet;

const req = async (p, opts = {}) => {
  const res = await fetch(base + p, {
    ...opts,
    headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, json, text, headers: res.headers };
};

const lead = (tripId, answers, extra = {}) => ({
  tripId,
  submissionId: 'sub-' + Math.random().toString(36).slice(2) + Date.now(),
  answers,
  name: 'Maria das Graças',
  whatsapp: '(65) 99876-5432',
  city: 'Cuiabá',
  state: 'MT',
  email: '',
  consent: true,
  source: { utm_source: 'instagram', utm_campaign: 'peregrinacoes-2027', landingPage: 'https://exemplo/?utm_source=instagram' },
  ...extra,
});
const all = (trip, idx) => Object.fromEntries(trip.form.questions.map((q) => [q.id, q.options[Math.min(idx, q.options.length - 1)].id]));

test.before(async () => {
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  sheet = http.createServer((rq, rs) => {
    let b = '';
    rq.on('data', (c) => (b += c));
    rq.on('end', () => { received.push(JSON.parse(b)); rs.writeHead(200, { 'Content-Type': 'application/json' }); rs.end('{"ok":true}'); });
  });
  await new Promise((r) => sheet.listen(0, r));
});
test.after(() => { server.close(); sheet.close(); fs.rmSync(DATA, { recursive: true, force: true }); });

test('página inicial traz os 4 cards com botão "Tenho interesse"', async () => {
  const r = await req('/');
  assert.equal(r.status, 200);
  for (const t of TRIPS) {
    assert.ok(r.text.includes(`data-open-form="${t.id}"`), t.id);
    assert.ok(r.text.includes(`data-open-itinerary="${t.id}"`), t.id);
  }
  assert.ok(r.text.includes('wa.me/556530523834'));
  assert.ok(!r.text.includes('{{'), 'placeholders substituídos');
});

test('config pública traz viagens e pontuação para o termômetro da mensagem', async () => {
  const r = await req('/api/config');
  assert.equal(r.json.trips.length, 4);
  assert.equal(r.json.scoring.thresholds.hot, 75);
  assert.ok(r.json.trips.every((t) => t.code && t.form.questions.every((q) => q.short)));
  assert.ok(!JSON.stringify(r.json).includes('"secret"'), 'segredo do webhook não vaza');
});

test('protocolo e mensagem do WhatsApp (mesmo cálculo do navegador)', async () => {
  const sc = require('../public/js/scoring.js');
  const { scoreLead } = require('../lib/scoring');
  const settings = require('../lib/settings').defaults();
  for (const t of TRIPS) {
    const ans = all(t, 0);
    const a = sc.scoreAnswers(t, ans, settings);
    assert.equal(a.total, scoreLead(t, ans, settings).total);
    const p = sc.protocol(t.code, a.total, a.classification, 38);
    assert.match(p, /^AG-[A-Z]{2}-\d{5}$/);
    assert.deepEqual(sc.decodeProtocol(p), { trip: t.code, score: Math.min(99, a.total), classification: a.classification });
    const msg = sc.whatsappMessage(t, ans, { name: 'Maria das Graças', city: 'Cuiabá', state: 'MT' }, p);
    assert.ok(msg.includes('*' + t.name + '*'));
    assert.ok(msg.includes('Nome: Maria das Graças'));
    assert.ok(msg.includes('Cidade: Cuiabá/MT'));
    assert.equal((msg.match(/^\d\. /gm) || []).length, t.form.questions.length, 'todas as respostas');
    assert.ok(msg.endsWith('Protocolo: ' + p));
    assert.ok(!/quente|morno|frio/i.test(msg), 'termômetro não aparece por extenso');
  }
  assert.equal(sc.protocol('TS', 45, 'morno', 10), 'AG-TS-10454');
  assert.equal(sc.protocol('MX', 12, 'frio', 99), 'AG-MX-99121');
  assert.equal(sc.decodeProtocol('AG-TS-12345'), null, 'dígito final inválido');
});

test('os 4 formulários salvam e classificam de forma independente', async () => {
  for (const t of TRIPS) {
    const hot = await req('/api/leads', { method: 'POST', body: lead(t.id, { ...all(t, 0), ...(t.international ? { q5: 'd' } : {}) }) });
    assert.equal(hot.status, 201, t.id + ' ' + hot.text);
    const cold = await req('/api/leads', { method: 'POST', body: lead(t.id, all(t, 3), { name: 'José Frio' }) });
    assert.equal(cold.status, 201);
  }
  const file = JSON.parse(fs.readFileSync(path.join(DATA, 'leads.json'), 'utf8'));
  assert.equal(file.length, 8);
  for (const t of TRIPS) {
    const ls = file.filter((l) => l.trip.id === t.id);
    assert.equal(ls.length, 2);
    const h = ls.find((l) => l.contact.name === 'Maria das Graças');
    assert.equal(h.score.total, 100);
    assert.equal(h.score.classification, 'quente');
    assert.equal(h.answers.length, t.form.questions.length);
    assert.equal(h.travelers.count, 1);
    assert.ok(h.purchaseTiming.startsWith('Nos próximos 7 dias'));
    assert.equal(h.contact.whatsapp, '5565998765432');
    assert.equal(h.source.utm_source, 'instagram');
    assert.ok(h.createdAt);
    const c = ls.find((l) => l.contact.name === 'José Frio');
    assert.notEqual(c.score.classification, 'quente');
  }
});

test('lead frio também é aceito (classificação não bloqueia)', async () => {
  const t = TRIPS[2];
  const r = await req('/api/leads', { method: 'POST', body: lead(t.id, { q1: 'c', q2: 'c', q3: 'a', q4: 'd', q5: 'c', q6: 'd' }) });
  assert.equal(r.status, 201);
  const l = JSON.parse(fs.readFileSync(path.join(DATA, 'leads.json'), 'utf8')).pop();
  assert.equal(l.score.classification, 'frio');
  assert.ok(l.score.total < 45);
});

test('envio duplicado (mesmo submissionId) não cria segundo registro', async () => {
  const body = lead(TRIPS[0].id, all(TRIPS[0], 1));
  const [a, b] = await Promise.all([req('/api/leads', { method: 'POST', body }), req('/api/leads', { method: 'POST', body })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 201]);
  assert.equal(a.json.id, b.json.id);
});

test('validações dos campos obrigatórios', async () => {
  const t = TRIPS[1];
  const r = await req('/api/leads', { method: 'POST', body: lead(t.id, { q1: 'a' }, { name: 'Ana', whatsapp: '123', city: '', state: 'XX', email: 'x@', consent: false }) });
  assert.equal(r.status, 422);
  for (const k of ['q2', 'name', 'whatsapp', 'city', 'state', 'email', 'consent']) assert.ok(r.json.fields[k], k);
  const bad = await req('/api/leads', { method: 'POST', body: lead('nao-existe', {}) });
  assert.equal(bad.status, 422);
  const ddd = await req('/api/leads', { method: 'POST', body: lead(t.id, all(t, 0), { whatsapp: '(20) 99999-1234' }) });
  assert.equal(ddd.json.fields.whatsapp ? true : false, true);
});

test('painel exige autenticação', async () => {
  assert.equal((await req('/api/admin/leads')).status, 401);
  assert.equal((await req('/api/admin/leads.csv')).status, 401);
  const wrong = await req('/api/admin/login', { method: 'POST', body: { user: 'admin', password: 'errada' } });
  assert.equal(wrong.status, 401);
  const ok = await req('/api/admin/login', { method: 'POST', body: { user: 'admin', password: 'senha-de-teste-123' } });
  assert.equal(ok.status, 200);
  const sc = ok.headers.get('set-cookie');
  assert.match(sc, /HttpOnly/);
  cookie = sc.split(';')[0];
});

test('painel lista, filtra e exporta CSV', async () => {
  const r = await req('/api/admin/leads');
  assert.equal(r.json.counts.total, 10);
  const f = await req('/api/admin/leads?trip=terra-santa-roma&classification=quente');
  assert.ok(f.json.leads.length >= 1);
  assert.ok(f.json.leads.every((l) => l.trip.id === 'terra-santa-roma' && l.score.classification === 'quente'));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' });
  assert.equal((await req(`/api/admin/leads?from=${today}&to=${today}`)).json.counts.total, 10);
  assert.equal((await req('/api/admin/leads?from=2020-01-01&to=2020-01-02')).json.counts.total, 0);
  const csv = await req('/api/admin/leads.csv?trip=mexico-cancun');
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.ok(csv.text.replace(/^\uFEFF/, '').startsWith('Data/hora;Viagem;Protocolo;Nome'));
  const raw = Buffer.from(await (await fetch(base + '/api/admin/leads.csv', { headers: { Cookie: cookie } })).arrayBuffer());
  assert.deepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM UTF-8 para o Excel');
  assert.equal(csv.text.trim().split('\r\n').length, 1 + 3);
});

test('valor de referência e pontos editáveis alteram a classificação', async () => {
  const mx = TRIPS[0];
  const body = { ...all(mx, 0), q5: 'a' }; // orçamento até R$ 15.000
  // padrão: referência = preço oficial R$ 22.000 → 15.000/22.000 = 0,68 → 10% de 30 = 3
  const def = await req('/api/leads', { method: 'POST', body: lead(mx.id, body) });
  let d0 = (await req('/api/admin/leads?trip=mexico-cancun')).json.leads.find((x) => x.id === def.json.id);
  assert.equal(d0.score.byCategory.financial, 3);
  assert.equal(d0.financial.referencePrice, 22000);
  await req('/api/admin/settings', { method: 'PUT', body: { referencePrices: { 'mexico-cancun': null } } });
  const before = await req('/api/leads', { method: 'POST', body: lead(mx.id, body) });
  let l = (await req('/api/admin/leads?trip=mexico-cancun')).json.leads.find((x) => x.id === before.json.id);
  assert.equal(l.score.byCategory.financial, 10); // pontos fixos padrão

  const s = await req('/api/admin/settings', { method: 'PUT', body: { referencePrices: { 'mexico-cancun': 14000 } } });
  assert.equal(s.status, 200);
  const after = await req('/api/leads', { method: 'POST', body: lead(mx.id, body) });
  l = (await req('/api/admin/leads?trip=mexico-cancun')).json.leads.find((x) => x.id === after.json.id);
  assert.equal(l.score.byCategory.financial, 30); // faixa cobre o valor de referência
  assert.equal(l.financial.referencePrice, 14000);

  await req('/api/admin/settings', { method: 'PUT', body: { referencePrices: { 'mexico-cancun': 30000 }, thresholds: { hot: 90, warm: 50 } } });
  const third = await req('/api/leads', { method: 'POST', body: lead(mx.id, body) });
  l = (await req('/api/admin/leads?trip=mexico-cancun')).json.leads.find((x) => x.id === third.json.id);
  assert.equal(l.score.byCategory.financial, 3); // 15000/30000 = 0,5 → 10% de 30
  assert.equal(l.score.classification, 'morno'); // 25+15+30+3 = 73 → morno com corte em 90

  const invalid = await req('/api/admin/settings', { method: 'PUT', body: { thresholds: { hot: 40, warm: 60 } } });
  assert.equal(invalid.status, 400);
  await req('/api/admin/settings', { method: 'PUT', body: { referencePrices: { 'mexico-cancun': 22000 }, thresholds: { hot: 75, warm: 45 } } });
});

test('envia lead completo para a planilha com token', async () => {
  const url = `http://127.0.0.1:${sheet.address().port}/exec`;
  const s = await req('/api/admin/settings', { method: 'PUT', body: { webhook: { enabled: true, url, secret: 'token-planilha' } } });
  assert.equal(s.status, 200);
  assert.equal(s.json.settings.webhook.secret, '', 'segredo não volta para o navegador');
  const t = (await req('/api/admin/webhook-test', { method: 'POST' })).json;
  assert.equal(t.status, 'enviado');
  const r = await req('/api/leads', { method: 'POST', body: lead('aparecida-pe-welinton', all(TRIPS[3], 0)) });
  for (let i = 0; i < 50 && !received.some((x) => x.lead && x.lead.id === r.json.id); i++) await new Promise((ok) => setTimeout(ok, 50));
  const got = received.find((x) => x.lead && x.lead.id === r.json.id);
  assert.ok(got, 'planilha recebeu');
  assert.equal(got.token, 'token-planilha');
  assert.equal(got.lead.trip.name, 'Aparecida e Canção Nova com Pe. Welinton');
  assert.equal(got.lead.score.classification, 'quente');
  assert.equal(got.lead.answers.length, 6);
  // status do envio gravado no lead
  for (let i = 0; i < 40; i++) {
    const l = (await req('/api/admin/leads')).json.leads.find((x) => x.id === r.json.id);
    if (l.webhook) { assert.equal(l.webhook.status, 'enviado'); return; }
    await new Promise((ok) => setTimeout(ok, 50));
  }
  assert.fail('status do webhook não gravado');
});

test('proteções: JSON obrigatório, honeypot, path traversal', async () => {
  const r = await fetch(base + '/api/leads', { method: 'POST', body: 'a=1', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(r.status, 415);
  const n = JSON.parse(fs.readFileSync(path.join(DATA, 'leads.json'), 'utf8')).length;
  await req('/api/leads', { method: 'POST', body: { ...lead(TRIPS[0].id, all(TRIPS[0], 0)), website: 'spam' } });
  assert.equal(JSON.parse(fs.readFileSync(path.join(DATA, 'leads.json'), 'utf8')).length, n);
  assert.notEqual((await req('/..%2f..%2fserver.js')).status, 200);
});

test('lead sem WhatsApp (fluxo pelo WhatsApp) é aceito e guarda o protocolo', async () => {
  const t = TRIPS[2];
  const body = lead(t.id, all(t, 0), { whatsapp: undefined, protocol: 'AG-AI-55997' });
  const r = await req('/api/leads', { method: 'POST', body });
  assert.equal(r.status, 201, r.text);
  const l = JSON.parse(fs.readFileSync(path.join(DATA, 'leads.json'), 'utf8')).find((x) => x.id === r.json.id);
  assert.equal(l.protocol, 'AG-AI-55997');
  assert.equal(l.contact.whatsapp, null);
  const bad = await req('/api/leads', { method: 'POST', body: lead(t.id, all(t, 0), { whatsapp: undefined, protocol: 'AG-MX-11111' }) });
  const l2 = JSON.parse(fs.readFileSync(path.join(DATA, 'leads.json'), 'utf8')).find((x) => x.id === bad.json.id);
  assert.match(l2.protocol, /^AG-AI-\d{5}$/, 'protocolo de outra viagem é substituído');
});
