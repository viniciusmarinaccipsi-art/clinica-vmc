/* Pacote 14.5 — Agenda: endereço do consultório, Google Calendar (mão única), Meet por sessão, evento em anexo,
   horários ocupados no Google, horários livres do profissional e "horário ideal" do paciente.
   Testes em Node do Código.js REAL sobre as planilhas simuladas do arnês de backend_18_10a.js; relógio fixo e
   um Google Calendar de mentira (UrlFetchApp) que guarda agendas e eventos.
   Blocos: A endereço · C Calendar e Meet · I evento em anexo · O ocupado no Google e horários livres ·
   S horário ideal · T listas e versão.
   Uso: node scripts/testes/backend_14_5.js */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARNES = path.join(__dirname, 'backend_18_10a.js');
const MARCA = "console.log('C. controle_id');";
const Real = Date;
let agoraMs = new Real(2026, 10, 25, 14, 0, 0).getTime(); // quarta-feira, 25/11/2026, 14:00 (hora local)
class DataFixa extends Real {
  constructor(...a) { if (a.length === 0) super(agoraMs); else super(...a); }
  static now() { return agoraMs; }
}
const quando = (ano, mes, dia, h, m) => new DataFixa(ano, mes - 1, dia, h || 0, m || 0, 0);

const fonte = fs.readFileSync(ARNES, 'utf8');
const fim = fonte.indexOf(MARCA);
if (fim === -1) { console.log('FALHA o arnês mudou: não achei ' + MARCA); process.exit(1); }
const av = new Function('require', '__dirname', 'Date', fonte.slice(0, fim) + '\nreturn function (__src) { return eval(__src); };')(require, __dirname, DataFixa);
const logServidor = [];
console.error = (...a) => { logServidor.push(a.map(String).join(' ')); };
const CACHE = new Map();
const cacheObj = { get: k => (CACHE.has(k) ? CACHE.get(k) : null), getAll: ks => { const r = {}; (ks || []).forEach(k => { if (CACHE.has(k)) r[k] = CACHE.get(k); }); return r; },
  put: (k, v) => { CACHE.set(k, String(v)); }, putAll: o => { Object.keys(o || {}).forEach(k => CACHE.set(k, String(o[k]))); }, remove: k => { CACHE.delete(k); }, removeAll: ks => { (ks || []).forEach(k => CACHE.delete(k)); } };
global.CacheService = { getScriptCache: () => cacheObj };
global.Utilities.base64Decode = s => Array.from(Buffer.from(String(s), 'base64')).map(x => (x > 127 ? x - 256 : x));
const blobAntigo = global.Utilities.newBlob;
global.Utilities.newBlob = (dados, tipo, nome) => (typeof dados === 'string' ? { texto: dados, tipo: tipo, nome: nome } : blobAntigo(dados, tipo, nome));

// ---------- Google Calendar de mentira ----------
const G = { chamadas: [], agendas: [{ id: 'primary', summary: 'pessoal' }], eventos: {}, ocupado: [], falhar: 0, seq: 0, token: 0 };
let DONO = 'np@exemplo.test'; // 14.10: a profissional das provas é a dona do script desde o começo (os e-mails aos pacientes saem da conta dela)
global.Session = { getEffectiveUser: () => ({ getEmail: () => DONO }) };
global.ScriptApp.getOAuthToken = () => { G.token++; return 'tok'; };
global.UrlFetchApp = { fetch: (url, o) => {
  const u = String(url).replace('https://www.googleapis.com/calendar/v3', ''), metodo = String((o && o.method) || 'get').toLowerCase();
  const corpo = o && o.payload ? JSON.parse(o.payload) : null;
  G.chamadas.push({ metodo, u, corpo });
  const resp = (codigo, dados) => ({ getResponseCode: () => codigo, getContentText: () => JSON.stringify(dados || {}) });
  if (G.falhar > 0 && /\/events/.test(u)) { G.falhar--; return resp(500, { error: { status: 'INTERNAL' } }); }
  if (metodo === 'get' && u.indexOf('/users/me/calendarList') === 0) return resp(200, { items: G.agendas });
  if (metodo === 'post' && u === '/calendars') { const c = { id: 'cal' + (++G.seq), summary: corpo.summary }; G.agendas.push(c); G.eventos[c.id] = {}; return resp(200, c); }
  if (metodo === 'post' && u === '/freeBusy') return resp(200, { calendars: { primary: { busy: G.ocupado } } });
  const m = u.match(/^\/calendars\/([^/]+)\/events(?:\/([^?]+))?/);
  if (m) {
    const cal = decodeURIComponent(m[1]), evs = G.eventos[cal];
    if (!evs) return resp(404, {});
    if (metodo === 'post') { const id = 'ev' + (++G.seq); const ev = Object.assign({}, corpo, { id }); if (corpo.conferenceData && corpo.conferenceData.createRequest) ev.hangoutLink = 'https://meet.google.com/sala-' + G.seq; evs[id] = ev; return resp(200, ev); }
    if (metodo === 'get' && !m[2]) return resp(200, { items: Object.keys(evs).map(k => ({ id: k, status: evs[k].status })) }); // 14.11: a lista dos eventos (evento apagado volta)
    const id = decodeURIComponent(m[2] || '');
    if (!evs[id]) return resp(404, {});
    if (metodo === 'delete') { delete evs[id]; return resp(204, null); }
    if (metodo === 'patch') { Object.assign(evs[id], corpo); if (corpo.conferenceData === null) delete evs[id].hangoutLink; if (corpo.conferenceData && corpo.conferenceData.createRequest) evs[id].hangoutLink = 'https://meet.google.com/sala-' + (++G.seq); return resp(200, evs[id]); }
  }
  return resp(400, {});
} };
const chamadasEv = () => G.chamadas.filter(c => /\/events/.test(c.u));
const eventosDe = nome => { const c = G.agendas.filter(a => a.summary === nome)[0]; return c ? Object.values(G.eventos[c.id] || {}) : null; };

const h = av('({ post: post, cracha: cracha, novoPaciente: novoPaciente, celula: celula, linhaDe: linhaDe, cab: cab, abaPac: abaPac, ctrl: ctrl, EMAILS: EMAILS, memo: _memoZerar_, aceite: _gravarAceitePolitica_, hashProf: hashProf })');
const S = nome => av(nome);
av('AGE_EMAIL_AUTOMATICO = true'); // 14.13: esta suíte confere o conteúdo dos e-mails pelo caminho de antes (envio na própria gravação); em produção a chave é false

let passo = 0, falhas = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 600) : '')); } };
const tenta = (n, f) => { try { f(); } catch (e) { ok(n + ' (exceção)', false, String(e && e.stack || e).slice(0, 700)); } };
const uuid = () => crypto.randomUUID();
const tokProf = () => h.cracha('profissional', 'NP', 'PROF_NP', h.hashProf);
const tokPac = sigla => h.cracha('paciente', sigla, 'PROF_NP', h.celula(h.abaPac, h.linhaDe(h.abaPac, 'sigla', sigla), 'senha_hash'));
const prof = (acao, extra) => { h.memo(); return h.post(Object.assign({ acao: acao, token: tokProf() }, extra || {})); };
const pac = (sigla, acao, extra) => { h.memo(); return h.post(Object.assign({ acao: acao, token: tokPac(sigla) }, extra || {})); };
const novo = (nome, email) => { const s = h.novoPaciente(nome, email); h.memo(); h.aceite(s, 'PROF_NP'); h.memo(); return s; };
const aba = nome => h.ctrl.getSheetByName(nome);
const cel = (nomeAba, id, col) => h.celula(aba(nomeAba), h.linhaDe(aba(nomeAba), 'id', id), col);
const PER = { de: '2026-11-01', ate: '2027-02-08' };
const TODAS = ['confirmacao', 'lembrete48', 'lembrete', 'cancelamento'];
const sessao = (sigla, d) => prof('profSalvarSessao', { periodo: PER, dados: Object.assign({ id: uuid(), sigla: sigla, data: '2026-12-02', hora: '10:00', duracao_min: 60, modalidade: 'presencial', valor: '300', notas: '', avisos: TODAS }, d || {}) });
const gatilho = d => { h.memo(); return S('enviarLembretes_')(d).sessoes; };
const lida = id => prof('profLerAgenda', PER).sessoes.filter(x => x.id === id)[0];
const minha = (sigla, id) => pac(sigla, 'lerMinhasSessoes').sessoes.filter(x => x.id === id)[0];
const html = e => String(e.htmlBody || '');
const GRADE = [1, 2, 3, 4, 5].map(d => ({ dia_semana: d, hora_inicio: '08:00', hora_fim: '18:00', modalidade: 'ambas', ativo: 'sim' }));
const grade = cfg => prof('profSalvarGrade', { config: Object.assign({ duracao_slot_min: 60, antecedencia_min_horas: 24 }, cfg || {}), grade: GRADE });
const ATUAL = 'R. Helena Steimberg, 645 - Nova Campinas, Campinas - SP, 13092-481';
const NOVO = 'R. José Lins do Rego, 129 (Sala 06) - Parque Alto Taquaral, Campinas - SP, 13087-789';
const NOME_CAL = 'Cogniativo: Agenda Consultório';

const P1 = novo('Paula Primeira', 'p1@exemplo.test');
const P2 = novo('Pedro Segundo', 'p2@exemplo.test');

/* ---------------------------------------------------------------- A */
console.log('A. Endereço do consultório');
tenta('A', () => {
  let r = grade({ avisos_sessao: 'Sim', endereco: '  ' + ATUAL + '  ', endereco_novo: NOVO, endereco_novo_desde: '2026-12-01' });
  ok('A1 a Grade guarda o endereço atual, o novo e a data da mudança', r.ok === true, r);
  r = prof('profLerGrade');
  ok('A2 a leitura devolve os três campos como texto', r.config.endereco === ATUAL && r.config.endereco_novo === NOVO && r.config.endereco_novo_desde === '2026-12-01', r.config);
  const E = S('_ageEndereco_'), cfg = { endereco: ATUAL, endereco_novo: NOVO, endereco_novo_desde: '2026-12-01' };
  ok('A3 até 30/11 vale o atual; de 01/12 em diante, o novo', E(cfg, '2026-11-30') === ATUAL && E(cfg, '2026-12-01') === NOVO && E(cfg, '2027-01-10') === NOVO);
  ok('A4 sem data ou sem endereço novo, vale o atual; sem nenhum, vazio', E({ endereco: ATUAL, endereco_novo: NOVO }, '2027-01-01') === ATUAL && E({ endereco: ATUAL, endereco_novo_desde: '2026-12-01' }, '2027-01-01') === ATUAL && E({}, '2027-01-01') === '');
  ok('A5 o link do mapa leva o endereço escrito', S('_ageMapa_')(ATUAL) === 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ATUAL) && S('_ageMapa_')('') === '');
  h.EMAILS.length = 0;
  const idA = uuid(), idB = uuid();
  sessao(P1, { id: idA, data: '2026-11-30', hora: '09:00' });
  sessao(P1, { id: idB, data: '2026-12-03', hora: '09:00' });
  ok('A6 e-mail da sessão de 30/11 leva o endereço atual e o link do mapa', h.EMAILS.length === 2 && h.EMAILS[0].body.indexOf('Endereço: ' + ATUAL + '.') !== -1 && html(h.EMAILS[0]).indexOf('Abrir o endereço no mapa') !== -1 && html(h.EMAILS[0]).indexOf('maps/search/?api=1&amp;query=' + encodeURIComponent(ATUAL).replace(/'/g, '&#39;')) !== -1, h.EMAILS[0] && h.EMAILS[0].body);
  ok('A7 e-mail da sessão de 03/12 leva o endereço novo', h.EMAILS[1].body.indexOf('Endereço: ' + NOVO + '.') !== -1 && h.EMAILS[1].body.indexOf(ATUAL) === -1);
  ok('A8 a sessão lida pelo profissional e pelo paciente traz endereço e mapa', lida(idA).endereco === ATUAL && lida(idB).endereco === NOVO && lida(idB).mapa.indexOf('maps/search') !== -1 && minha(P1, idB).endereco === NOVO && minha(P1, idB).mapa === lida(idB).mapa);
  h.EMAILS.length = 0;
  const idO = uuid();
  sessao(P1, { id: idO, data: '2026-12-03', hora: '11:00', modalidade: 'online' });
  ok('A9 sessão on-line não leva endereço (e, sem Calendar, não leva link do Meet)', h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('Endereço') === -1 && h.EMAILS[0].body.indexOf('Meet') === -1 && lida(idO).endereco === '' && lida(idO).meet_link === '');
});

/* ---------------------------------------------------------------- C */
console.log('C. Google Calendar em mão única e Meet por sessão');
let idC1, idC2, idC3;
tenta('C', () => {
  DONO = 'dono@exemplo.test'; // C1 e C2: como fica para quem nao e o dono do script
  ok('C1 com a chave desligada nada vai ao Google', G.chamadas.length === 0 && cel('Sessoes', prof('profLerAgenda', PER).sessoes[0].id, 'gcal_sinc') === 'pendente', G.chamadas.length);
  let r = prof('profAgendaConectar', { periodo: PER }); // 14.8: a chave saiu da Grade; quem não é o dono precisa conectar a própria conta
  ok('C2 quem não é o dono do script e não conectou a conta não liga o espelho (sem a chave do botão, a conexão não está disponível)', r.ok === false && r.codigo === 'indisponivel' && prof('profLerAgenda', PER).agenda_externa.conectada === false && prof('profLerAgenda', PER).agenda_externa.disponivel === false && G.chamadas.length === 0, r);
  DONO = 'np@exemplo.test';
  ok('C3 o dono vê o espelho como disponível (o "+marcador" do e-mail não conta)', prof('profLerAgenda', PER).agenda_externa.disponivel === true && prof('profLerAgenda', PER).agenda_externa.conectada === false && (() => { DONO = 'np@exemplo.test'; return true; })());
  r = prof('profAgendaConectar', { periodo: PER });
  ok('C4 ao ligar, as sessões futuras já existentes entram na fila (nada é enviado na hora)', r.ok === true && r.conectada === true && r.agenda.agenda_externa.conectada === true && r.agenda.agenda_externa.conta === 'np@exemplo.test' && prof('profLerGrade').config.google_calendar === 'Sim' && chamadasEv().length === 0, r.erro);
  let g = gatilho(quando(2026, 11, 25, 14, 5));
  let evs = eventosDe(NOME_CAL);
  ok('C5 o gatilho cria a agenda "Cogniativo: Agenda Consultório" e espelha as três sessões', g.calendar === 3 && evs && evs.length === 3 && G.agendas.length === 2 && /^cal/.test(String(prof('profLerGrade').config.gcal_id)), { g: g, n: evs && evs.length });
  const pres = evs.filter(e => e.start.dateTime === '2026-12-03T09:00:00')[0], on = evs.filter(e => e.start.dateTime === '2026-12-03T11:00:00')[0];
  ok('C6 evento presencial: nome do paciente, lilás, endereço da data, horário de São Paulo', pres && pres.summary === 'Sessão de Psicoterapia — Paula Primeira' && pres.colorId === '1' && pres.location === NOVO && pres.end.dateTime === '2026-12-03T10:00:00' && pres.start.timeZone === 'America/Sao_Paulo' && !pres.conferenceData, pres);
  ok('C7 evento on-line: verde, sem endereço, com a sala do Meet', on && on.colorId === '2' && on.location === '' && /^https:\/\/meet\.google\.com\//.test(on.hangoutLink), on);
  const semMarca = prof('profLerAgenda', PER).sessoes.every(x => cel('Sessoes', x.id, 'gcal_sinc') === '' && cel('Sessoes', x.id, 'gcal_evento') !== '');
  ok('C8 as células guardam o id do evento e a marca some; segunda rodada não repete', semMarca && (() => { const esc = () => G.chamadas.filter(c => c.metodo !== 'get').length, n = esc(); gatilho(quando(2026, 11, 25, 14, 10)); return esc() === n; })()); // 14.11: a rodada so le a lista dos eventos
  h.EMAILS.length = 0;
  idC1 = uuid(); idC2 = uuid();
  r = sessao(P1, { id: idC1, data: '2026-12-04', hora: '10:00', modalidade: 'online' });
  const r2 = sessao(P2, { id: idC2, data: '2026-12-04', hora: '11:00', modalidade: 'online' });
  const l1 = cel('Sessoes', idC1, 'meet_link'), l2 = cel('Sessoes', idC2, 'meet_link');
  ok('C9 sessão on-line nova: espelhada na própria ação, com link do Meet', r.ok && r2.ok && /^https:\/\/meet/.test(l1) && /^https:\/\/meet/.test(l2) && lida(idC1).meet_link === l1 && lida(idC1).no_calendar === true);
  ok('C10 um link por sessão, nunca o mesmo (cada evento pede a sua sala)', l1 !== l2 && (() => { const ps = chamadasEv().filter(c => c.metodo === 'post' && c.corpo.conferenceData).map(c => c.corpo.conferenceData.createRequest.requestId); return new Set(ps).size === ps.length; })(), [l1, l2]);
  ok('C11 o e-mail de confirmação da sessão on-line leva o link do Meet daquela sessão', h.EMAILS.length === 2 && h.EMAILS[0].body.indexOf('Iniciar sessão on-line: ' + l1) !== -1 && html(h.EMAILS[0]).indexOf(l1) !== -1 && h.EMAILS[1].body.indexOf(l2) !== -1 && h.EMAILS[0].body.indexOf(l2) === -1, h.EMAILS[0] && h.EMAILS[0].body);
  ok('C12 o paciente vê o link do Meet da própria sessão', minha(P1, idC1).meet_link === l1 && minha(P2, idC2).meet_link === l2);
  let n = chamadasEv().length;
  r = sessao(P1, { id: idC1, data: '2026-12-04', hora: '15:00', modalidade: 'online' });
  let ult = chamadasEv().slice(n);
  ok('C13 remarcar muda o MESMO evento (patch) e mantém a sala', r.remarcada === true && ult.length === 1 && ult[0].metodo === 'patch' && ult[0].corpo.start.dateTime === '2026-12-04T15:00:00' && ult[0].corpo.conferenceData === undefined && cel('Sessoes', idC1, 'meet_link') === l1 && cel('Sessoes', idC1, 'gcal_sinc') === '', ult);
  n = chamadasEv().length;
  r = sessao(P1, { id: idC1, data: '2026-12-04', hora: '15:00', modalidade: 'presencial' });
  ult = chamadasEv().slice(n);
  ok('C14 on-line que vira presencial perde a sala e ganha o endereço e a cor', ult.length === 1 && ult[0].corpo.conferenceData === null && ult[0].corpo.colorId === '1' && ult[0].corpo.location === NOVO && cel('Sessoes', idC1, 'meet_link') === '');
  const evC2 = cel('Sessoes', idC2, 'gcal_evento');
  n = chamadasEv().length;
  r = prof('profCancelarSessao', { id: idC2, opcoes: { quem: 'profissional', avisar: false }, periodo: PER });
  ult = chamadasEv().slice(n);
  ok('C15 cancelar apaga o evento e limpa as células', r.ok && ult.length === 1 && ult[0].metodo === 'delete' && ult[0].u.indexOf(evC2) !== -1 && cel('Sessoes', idC2, 'gcal_evento') === '' && cel('Sessoes', idC2, 'meet_link') === '' && cel('Sessoes', idC2, 'gcal_sinc') === '');
  G.falhar = 1; idC3 = uuid();
  r = sessao(P2, { id: idC3, data: '2026-12-07', hora: '10:00' });
  ok('C16 o Google falhou: a consulta é criada do mesmo jeito e fica pendente', r.ok === true && r.criadas === 1 && cel('Sessoes', idC3, 'gcal_sinc') === 'pendente' && cel('Sessoes', idC3, 'gcal_evento') === '');
  g = gatilho(quando(2026, 11, 25, 14, 15));
  ok('C17 o gatilho seguinte espelha o que ficou pendente', g.calendar === 1 && cel('Sessoes', idC3, 'gcal_evento') !== '' && cel('Sessoes', idC3, 'gcal_sinc') === '', g);
  n = chamadasEv().length;
  const idSer = uuid();
  r = sessao(P2, { id: idSer, data: '2026-12-08', hora: '16:00', repeticao: { cada: 1, unidade: 'semana', dias_semana: [2], fim_tipo: 'n', fim_n: 6 } });
  const naAcao = chamadasEv().length - n;
  g = gatilho(quando(2026, 11, 25, 14, 20));
  ok('C18 série: até três eventos na própria ação, o resto no gatilho — todas espelhadas', r.criadas === 6 && naAcao === 3 && g.calendar === 3 && eventosDe(NOME_CAL).filter(e => /T16:00:00$/.test(e.start.dateTime)).length === 6, { criadas: r.criadas, naAcao: naAcao, g: g.calendar });
  n = chamadasEv().length;
  const idPas = uuid();
  r = sessao(P1, { id: idPas, data: '2026-11-20', hora: '10:00' });
  ok('C19 sessão lançada no passado não vai ao Calendar', r.ok && chamadasEv().length === n && cel('Sessoes', idPas, 'gcal_sinc') === '' && cel('Sessoes', idPas, 'gcal_evento') === '');
  n = chamadasEv().length;
  prof('profMarcarSituacao', { id: idPas, situacao: 'realizada', periodo: PER });
  pac(P1, 'pacienteConfirmarSessao', { id: idC1 });
  ok('C20 marcar situação não mexe no evento; a confirmação não fala com o Google na ação do paciente e fica na fila (14.11)', chamadasEv().length === n && cel('Sessoes', idC1, 'gcal_sinc') === 'pendente');
  const uPac = uuid(), idPac = 'ag-' + uPac; // 14.7: pedido do paciente + aprovação
  n = chamadasEv().length;
  r = pac(P1, 'pacienteAgendarSessao', { dados: { id: uPac, data: '2026-12-09', hora: '08:00', modalidade: 'online' } });
  const nPedido = chamadasEv().length;
  r = prof('profDecidirPedido', { id: uPac, aprovar: true, periodo: PER });
  ok('C21 o pedido não toca o Calendar; aprovado, a sessão é espelhada, com Meet', r.ok === true && nPedido === n && chamadasEv().slice(n).filter(c => c.metodo === 'post').length === 1 && chamadasEv().slice(n).filter(c => c.metodo === 'patch').length === 1 && /^https:\/\/meet/.test(cel('Sessoes', idPac, 'meet_link')) && minha(P1, idPac).meet_link !== '', r.erro);
  n = chamadasEv().length;
  r = pac(P1, 'pacienteCancelarSessao', { id: idPac });
  ok('C22 cancelamento pelo paciente apaga o evento', r.ok === true && chamadasEv().slice(n).length === 1 && chamadasEv().slice(n)[0].metodo === 'delete' && cel('Sessoes', idPac, 'gcal_evento') === '');
  const calId = String(prof('profLerGrade').config.gcal_id);
  delete G.eventos[calId]; G.agendas = G.agendas.filter(a => a.id !== calId);
  const idGone = uuid();
  r = sessao(P1, { id: idGone, data: '2026-12-10', hora: '08:00' });
  const depois = prof('profLerGrade').config.gcal_id;
  g = gatilho(quando(2026, 11, 25, 14, 25));
  ok('C23 agenda apagada no Google: a consulta nasce, o id é esquecido e o gatilho recria a agenda', r.ok === true && depois === '' && cel('Sessoes', idGone, 'gcal_evento') !== '' && eventosDe(NOME_CAL).length >= 1, { depois: depois, g: g.calendar });
  r = prof('profAgendaDesconectar', { periodo: PER });
  n = G.chamadas.length;
  sessao(P1, { id: uuid(), data: '2026-12-10', hora: '09:00' });
  ok('C24 desligado de novo: nada vai ao Google', G.chamadas.length === n);
  prof('profAgendaConectar', { periodo: PER });
  gatilho(quando(2026, 11, 25, 14, 30));
});

/* ---------------------------------------------------------------- I */
console.log('I. Evento em anexo no e-mail (.ics)');
tenta('I', () => {
  h.EMAILS.length = 0;
  const idI = uuid();
  sessao(P1, { id: idI, data: '2026-12-11', hora: '10:00', duracao_min: 50 });
  const a = h.EMAILS[0] && h.EMAILS[0].attachments && h.EMAILS[0].attachments[0];
  ok('I1 a confirmação leva um anexo de calendário', !!a && a.nome === 'sessao.ics' && a.tipo === 'text/calendar' && a.texto.indexOf('BEGIN:VCALENDAR\r\n') === 0 && /END:VCALENDAR\r\n$/.test(a.texto), a);
  const t = a.texto.replace(/\r\n /g, '');
  ok('I2 horário em UTC (10:00 de São Paulo = 13:00Z), 50 minutos, mesmo identificador da sessão', t.indexOf('DTSTART:20261211T130000Z') !== -1 && t.indexOf('DTEND:20261211T135000Z') !== -1 && t.indexOf('UID:' + idI + '@cogniativo') !== -1 && t.indexOf('METHOD:PUBLISH') !== -1, t);
  ok('I3 título neutro, sem o nome do paciente; endereço no local', t.indexOf('SUMMARY:Sessão com Dra. Nova de Prova') !== -1 && t.indexOf('Paula') === -1 && t.indexOf('Psicoterapia') === -1 && t.indexOf('LOCATION:' + NOVO.replace(/,/g, '\\,')) !== -1, t);
  ok('I4 nenhuma linha do anexo passa de 75 caracteres', a.texto.split('\r\n').every(l => l.length <= 75));
  h.EMAILS.length = 0;
  sessao(P1, { id: idI, data: '2026-12-11', hora: '14:00', duracao_min: 50 });
  const b = h.EMAILS[0].attachments[0].texto.replace(/\r\n /g, '');
  ok('I5 a remarcação leva o evento novo com o MESMO identificador', b.indexOf('UID:' + idI + '@cogniativo') !== -1 && b.indexOf('DTSTART:20261211T170000Z') !== -1);
  h.EMAILS.length = 0;
  prof('profCancelarSessao', { id: idI, opcoes: { quem: 'profissional', avisar: true }, periodo: PER });
  const c = h.EMAILS[0].attachments[0].texto.replace(/\r\n /g, '');
  ok('I6 o cancelamento leva o anexo que retira o evento', c.indexOf('METHOD:CANCEL') !== -1 && c.indexOf('STATUS:CANCELLED') !== -1 && c.indexOf('UID:' + idI + '@cogniativo') !== -1);
  h.EMAILS.length = 0;
  const idS = uuid();
  sessao(P1, { id: idS, data: '2026-12-14', hora: '08:00', repeticao: { cada: 1, unidade: 'semana', dias_semana: [1], fim_tipo: 'n', fim_n: 3 } });
  const s = h.EMAILS[0].attachments[0].texto;
  ok('I7 a série leva todas as datas no mesmo anexo', (s.match(/BEGIN:VEVENT/g) || []).length === 3 && s.indexOf('UID:' + idS + '@cogniativo') !== -1 && s.indexOf('DTSTART:20261228T110000Z') !== -1);
  h.EMAILS.length = 0;
  const idO = uuid();
  sessao(P1, { id: idO, data: '2026-12-15', hora: '08:00', modalidade: 'online' });
  const o = h.EMAILS[0].attachments[0].texto.replace(/\r\n /g, '');
  ok('I8 sessão on-line: o local do anexo é a sala do Meet', o.indexOf('LOCATION:' + cel('Sessoes', idO, 'meet_link')) !== -1);
  h.EMAILS.length = 0;
  const idL = uuid();
  sessao(P2, { id: idL, data: '2026-11-27', hora: '15:00' });
  h.EMAILS.length = 0;
  const g = gatilho(quando(2026, 11, 26, 16, 0));
  ok('I9 o lembrete não leva anexo, mas leva o endereço', g.enviados === 1 && h.EMAILS.length === 1 && !h.EMAILS[0].attachments && h.EMAILS[0].body.indexOf('Endereço: ' + ATUAL) !== -1, g);
});

/* ---------------------------------------------------------------- O */
console.log('O. Ocupado na agenda pessoal do Google e horários livres');
tenta('O', () => {
  let semOpcao = pac(P1, 'lerHorariosLivres', { de: '2026-12-16' }).livres.filter(x => x.data === '2026-12-16').length;
  ok('O0 sem a opção ligada, o compromisso pessoal do Google não é lido (14.8: o horário livre vem só do COGNIATIVO)', semOpcao > 0 && G.chamadas.filter(c => c.u === '/freeBusy').length === 0);
  prof('profAgendaOpcao', { dados: { ocupado: true }, periodo: PER });
  CACHE.clear();
  G.ocupado = [{ start: '2026-12-16T13:00:00Z', end: '2026-12-16T14:30:00Z' }]; // 10:00 a 11:30 em São Paulo
  let r = pac(P1, 'lerHorariosLivres', { de: '2026-12-16' });
  const dia = r.livres.filter(x => x.data === '2026-12-16').map(x => x.hora);
  ok('O1 o paciente não vê os horários que batem com um compromisso do Google (10:00 e 11:00)', dia.indexOf('09:00') !== -1 && dia.indexOf('10:00') === -1 && dia.indexOf('11:00') === -1 && dia.indexOf('12:00') !== -1, dia);
  r = pac(P1, 'pacienteAgendarSessao', { dados: { id: uuid(), data: '2026-12-16', hora: '10:00', modalidade: 'presencial' } });
  ok('O2 nem consegue agendar nele por fora da lista', r.ok === false && r.codigo === 'ocupado', r);
  const n = G.chamadas.filter(c => c.u === '/freeBusy').length;
  pac(P1, 'lerHorariosLivres', { de: '2026-12-16' });
  ok('O3 a consulta ao Google fica 5 minutos no cache', G.chamadas.filter(c => c.u === '/freeBusy').length === n);
  r = prof('profLerHorariosLivres', { de: '2026-11-25' });
  const hoje = r.livres.filter(x => x.data === '2026-11-25').map(x => x.hora), d16 = r.livres.filter(x => x.data === '2026-12-08').map(x => x.hora);
  ok('O4 o profissional recebe 14 dias de horários livres, sem o prazo de 24 horas do paciente', r.ok === true && r.dias === 14 && hoje.indexOf('15:00') !== -1 && hoje.indexOf('14:00') === -1 && hoje.indexOf('13:00') === -1 && r.livres.every(x => x.data >= '2026-11-25' && x.data <= '2026-12-08'), hoje);
  ok('O5 a lista do profissional também tira sessões marcadas (terça 08/12 às 16:00 é da série)', d16.indexOf('16:00') === -1 && d16.indexOf('17:00') !== -1, d16);
  CACHE.clear();
  const idX = uuid();
  r = sessao(P2, { id: idX, data: '2026-12-16', hora: '10:00' });
  ok('O6 o profissional pode marcar em cima do próprio compromisso (a decisão é dele)', r.ok === true && r.criadas === 1);
  CACHE.clear();
  DONO = 'outro@exemplo.test';
  r = pac(P1, 'lerHorariosLivres', { de: '2026-12-16' });
  ok('O7 para quem não é o dono, o Google não é consultado', r.livres.filter(x => x.data === '2026-12-16' && x.hora === '11:00').length === 1);
  DONO = 'np@exemplo.test'; G.ocupado = []; CACHE.clear();
});

/* ---------------------------------------------------------------- S */
console.log('S. Horário ideal do paciente e horário escolhido pelo profissional');
tenta('S', () => {
  const idS = uuid();
  sessao(P1, { id: idS, data: '2026-12-17', hora: '09:00' });
  h.EMAILS.length = 0;
  const idPed = uuid();
  let r = pac(P1, 'pacientePedirAgenda', { dados: { id: idPed, tipo: 'remarcar', sessao_id: idS, sugestao: '  Quintas depois das 18h,\n  ou sábado de manhã  ' } });
  const m = r.sessoes.filter(x => x.id === idS)[0];
  ok('S1 o pedido com horário ideal é aceito sem data e fica aguardando', r.ok === true && m.pedido && m.pedido.estado === 'pendente' && m.pedido.data === '' && m.pedido.sugestao === 'Quintas depois das 18h, ou sábado de manhã' && cel('Pedidos_Agenda', idPed, 'sugestao') === 'Quintas depois das 18h, ou sábado de manhã', m && m.pedido);
  ok('S2 o profissional é avisado com a sugestão', h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('pediu remarcação da sessão de 17/12 às 09:00 e sugeriu: Quintas depois das 18h') !== -1, h.EMAILS[0] && h.EMAILS[0].body);
  const ped = prof('profLerAgenda', PER).pedidos.filter(p => p.id === idPed)[0];
  ok('S3 o pedido chega à tela do profissional com a sugestão e sem horário', ped && ped.sugestao.indexOf('Quintas') === 0 && ped.data === '' && ped.hora === '', ped);
  r = prof('profDecidirPedido', { id: idPed, aprovar: true, periodo: PER });
  ok('S4 aprovar sem escolher o horário é recusado', r.ok === false && r.codigo === 'sem_horario', r);
  h.EMAILS.length = 0;
  r = prof('profDecidirPedido', { id: idPed, aprovar: true, periodo: PER, quando: { data: '2026-12-17', hora: '17:00' } });
  ok('S5 aprovar com o horário escolhido muda a sessão e fecha o pedido com esse horário', r.ok === true && r.aprovado === true && r.data === '2026-12-17' && r.hora === '17:00' && cel('Sessoes', idS, 'hora_inicio') === '17:00' && cel('Pedidos_Agenda', idPed, 'estado') === 'aprovado' && cel('Pedidos_Agenda', idPed, 'hora') === '17:00', r);
  ok('S6 o paciente recebe o e-mail do pedido aprovado, com o horário e o evento em anexo', h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('17/12/2026, às 17:00') !== -1 && h.EMAILS[0].attachments && h.EMAILS[0].attachments[0].texto.indexOf('UID:' + idS + '@cogniativo') !== -1, h.EMAILS[0] && h.EMAILS[0].body);
  const idPed2 = uuid();
  pac(P1, 'pacientePedirAgenda', { dados: { id: idPed2, tipo: 'remarcar', sessao_id: idS, sugestao: 'Só à noite' } });
  h.EMAILS.length = 0;
  r = prof('profDecidirPedido', { id: idPed2, aprovar: false, periodo: PER });
  ok('S7 recusar a sugestão avisa o paciente sem citar horário', r.ok === true && r.aprovado === false && h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('não pôde atender ao horário que você sugeriu') !== -1 && h.EMAILS[0].body.indexOf('undefined') === -1 && !/\d\d\/\d\d/.test(h.EMAILS[0].body.split('CRP')[0]), h.EMAILS[0] && h.EMAILS[0].body);
  const idPed3 = uuid();
  r = pac(P1, 'pacientePedirAgenda', { dados: { id: idPed3, tipo: 'remarcar', sessao_id: idS, data: '2026-12-18', hora: '09:00' } });
  r = prof('profDecidirPedido', { id: idPed3, aprovar: true, periodo: PER, quando: { data: '2026-12-18', hora: '11:00' } });
  ok('S8 no pedido com horário, o profissional também pode aprovar em outro horário', r.ok === true && r.hora === '11:00' && cel('Sessoes', idS, 'data') === '2026-12-18' && cel('Sessoes', idS, 'hora_inicio') === '11:00', r);
  const idPed4 = uuid();
  pac(P1, 'pacientePedirAgenda', { dados: { id: idPed4, tipo: 'remarcar', sessao_id: idS, data: '2026-12-21', hora: '09:00' } });
  r = prof('profDecidirPedido', { id: idPed4, aprovar: true, periodo: PER });
  ok('S9 o pedido comum continua aprovado no horário pedido', r.ok === true && r.data === '2026-12-21' && r.hora === '09:00' && cel('Sessoes', idS, 'data') === '2026-12-21');
  const ev = prof('profLerAgenda', PER).eventos.filter(e => e.tipo === 'remarcar' && e.sugestao);
  ok('S10 o evento do sino traz a sugestão', ev.length === 2 && ev.every(e => e.sugestao.length > 0), ev);
  r = pac(P1, 'pacientePedirAgenda', { dados: { id: uuid(), tipo: 'remarcar', sessao_id: idS, sugestao: '   ' } });
  ok('S11 sugestão vazia e sem horário não vira pedido', r.ok === false && r.codigo === 'ocupado', r);
});

/* ---------------------------------------------------------------- U */
console.log('U. 14.5.1 — o link de confirmação diz onde é a sessão');
tenta('U', () => {
  const tok = id => lida(id).link_confirmar.split('?confirmar=')[1];
  const link = id => h.post({ acao: 'confirmarSessaoPorLink', t: tok(id) });
  grade({ avisos_sessao: 'Nao', endereco: ATUAL, endereco_novo: NOVO, endereco_novo_desde: '2026-12-01' });
  const idP = uuid(), idO = uuid();
  let r = sessao(P2, { id: idP, data: '2027-01-20', hora: '16:00', avisos: [] });
  ok('U0 sessão presencial criada', r.ok === true, r);
  r = link(idP);
  ok('U1 presencial: endereço que vale na data e o link do mapa', r.ok === true && r.estado === 'agendada' && r.endereco === NOVO && r.mapa === 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(NOVO) && r.meet_link === '', r);
  ok('U2 a resposta não leva nome, sigla nem telefone', Object.keys(r).sort().join(',') === 'data,endereco,estado,hora,ja_confirmada,mapa,meet_link,modalidade,ok', Object.keys(r));
  grade({ avisos_sessao: 'Nao', endereco: ATUAL, endereco_novo: '', endereco_novo_desde: '' });
  r = link(idP);
  ok('U3 sem endereço novo, vale o atual (e a segunda abertura diz que já estava confirmada)', r.ok === true && r.ja_confirmada === true && r.endereco === ATUAL, r);
  grade({ avisos_sessao: 'Nao', endereco: '', endereco_novo: '', endereco_novo_desde: '' });
  r = link(idP);
  ok('U4 sem endereço na Grade: vazio, sem link de mapa', r.ok === true && r.endereco === '' && r.mapa === '', r);
  r = sessao(P2, { id: idO, data: '2027-01-21', hora: '16:00', modalidade: 'online', avisos: [] });
  ok('U5 sessão on-line criada', r.ok === true, r);
  grade({ avisos_sessao: 'Nao', endereco: ATUAL, endereco_novo: '', endereco_novo_desde: '' });
  r = link(idO);
  ok('U6 on-line: nenhum endereço; a sala do Meet é a da própria sessão', r.ok === true && r.modalidade === 'online' && r.endereco === '' && r.mapa === '' && r.meet_link === String(lida(idO).meet_link || ''), r);
  ok('U7 token inválido continua sem dizer nada', h.post({ acao: 'confirmarSessaoPorLink', t: 'abc.def' }).ok === false && h.post({ acao: 'confirmarSessaoPorLink', t: 'abc.def' }).endereco === undefined);
});

/* ---------------------------------------------------------------- V */
console.log('V. 14.5.4 — o paciente sempre confirma depois (e-mails de remarcação e de pedido aprovado com o botão)');
tenta('V', () => {
  grade({ avisos_sessao: 'Sim', endereco: ATUAL, endereco_novo: '', endereco_novo_desde: '' });
  const SOB = 'Para remarcar ou cancelar, entre no COGNIATIVO com 24 horas ou mais de antecedência.';
  const JA = 'Sua presença já está confirmada.';
  const pede = e => e.body.indexOf('?confirmar=') !== -1 && html(e).indexOf('?confirmar=') !== -1 && html(e).indexOf('Confirmar presença') !== -1 && e.body.indexOf(SOB) !== -1 && html(e).indexOf(SOB) !== -1 && e.body.indexOf(JA) === -1;
  const naoPede = e => e.body.indexOf('?confirmar=') === -1 && html(e).indexOf('?confirmar=') === -1 && html(e).indexOf('Confirmar presença') === -1 && html(e).indexOf('Ver minhas sessões') !== -1 && e.body.indexOf(JA) !== -1 && html(e).indexOf(JA) !== -1 && e.body.indexOf(SOB) === -1;
  const tokDe = e => (e.body.match(/\?confirmar=([A-Za-z0-9_.-]+)/) || [])[1];
  const eventosConf = id => prof('profLerAgenda', PER).eventos.filter(ev => ev.tipo === 'confirmou' && ev.sigla === P1 && ev.data === lida(id).data && ev.hora === lida(id).hora);
  const pedir = (id, d) => { const idP = uuid(); const r = pac(P1, 'pacientePedirAgenda', { dados: Object.assign({ id: idP, tipo: 'remarcar', sessao_id: id }, d) }); if (!r.ok) throw new Error('pedido: ' + JSON.stringify(r).slice(0, 200)); return idP; };

  // 1. paciente pediu, profissional aprovou esse mesmo horário (sem `quando`): MESMO ASSIM o paciente confirma depois
  const idA = uuid();
  sessao(P1, { id: idA, data: '2027-01-26', hora: '09:00' });
  pac(P1, 'pacienteConfirmarSessao', { id: idA });
  let idP = pedir(idA, { data: '2027-01-27', hora: '10:00' });
  h.EMAILS.length = 0;
  let r = prof('profDecidirPedido', { id: idP, aprovar: true, periodo: PER });
  ok('V1 aprovado no horário pedido: a sessão muda e fica A CONFIRMAR (a confirmação antiga cai)', r.ok === true && r.confirmada === undefined && cel('Sessoes', idA, 'data') === '2027-01-27' && cel('Sessoes', idA, 'hora_inicio') === '10:00' && cel('Sessoes', idA, 'confirmada_em') === '', [cel('Sessoes', idA, 'confirmada_em')]);
  let e = h.EMAILS.filter(m => m.subject === 'Pedido aprovado — COGNIATIVO')[0];
  ok('V2 e-mail "Pedido aprovado" com o botão "Confirmar presença", o link e a linha da antecedência (texto puro e HTML)', !!e && e.body.indexOf('27/01/2027, às 10:00') !== -1 && pede(e), e && e.body);
  ok('V3 na tela do paciente a sessão oferece "Confirmar presença"', minha(P1, idA).confirmada === false && minha(P1, idA).pode_confirmar === true, minha(P1, idA));
  ok('V4 nenhum "confirmou" no sino antes de o paciente confirmar; o pedido dele continua lá', eventosConf(idA).length === 0 && prof('profLerAgenda', PER).eventos.some(ev => ev.tipo === 'remarcar' && ev.sigla === P1), eventosConf(idA));
  r = h.post({ acao: 'confirmarSessaoPorLink', t: tokDe(e) });
  ok('V5 o link confirma a data nova e aí o sino mostra a confirmação (mesmo no mesmo minuto da aprovação)', r.ok === true && r.ja_confirmada === false && r.data === '2027-01-27' && r.hora === '10:00' && cel('Sessoes', idA, 'confirmada_em') !== '' && eventosConf(idA).length === 1, [r, eventosConf(idA)]);

  // 2. aprovado em OUTRO horário e pedido só com o horário ideal: iguais
  const idC = uuid();
  sessao(P1, { id: idC, data: '2027-01-26', hora: '13:00' });
  idP = pedir(idC, { data: '2027-01-27', hora: '13:00' });
  h.EMAILS.length = 0;
  r = prof('profDecidirPedido', { id: idP, aprovar: true, periodo: PER, quando: { data: '2027-01-27', hora: '14:00' } });
  e = h.EMAILS.filter(m => m.subject === 'Pedido aprovado — COGNIATIVO')[0];
  ok('V6 aprovado em outro horário: a confirmar, e-mail com o botão', r.ok === true && cel('Sessoes', idC, 'hora_inicio') === '14:00' && cel('Sessoes', idC, 'confirmada_em') === '' && !!e && e.body.indexOf('27/01/2027, às 14:00') !== -1 && pede(e), e && e.body);
  const idD = uuid();
  sessao(P1, { id: idD, data: '2027-01-26', hora: '15:00' });
  idP = pedir(idD, { sugestao: 'De manhã cedo' });
  h.EMAILS.length = 0;
  r = prof('profDecidirPedido', { id: idP, aprovar: true, periodo: PER, quando: { data: '2027-01-28', hora: '08:00' } });
  e = h.EMAILS.filter(m => m.subject === 'Pedido aprovado — COGNIATIVO')[0];
  ok('V7 pedido com horário ideal: a confirmar, e-mail com o botão', r.ok === true && cel('Sessoes', idD, 'confirmada_em') === '' && !!e && pede(e), e && e.body);

  // 3. o profissional remarcou por iniciativa dele
  const idE = uuid();
  sessao(P1, { id: idE, data: '2027-01-28', hora: '10:00' });
  pac(P1, 'pacienteConfirmarSessao', { id: idE });
  h.EMAILS.length = 0;
  r = sessao(P1, { id: idE, data: '2027-01-28', hora: '11:00' });
  e = h.EMAILS.filter(m => m.subject === 'Sessão remarcada — COGNIATIVO')[0];
  ok('V8 profissional remarca: a confirmação cai', r.ok === true && r.remarcada === true && cel('Sessoes', idE, 'confirmada_em') === '', r.remarcada);
  ok('V9 e-mail "Sessão remarcada" com o botão "Confirmar presença", o link e a linha da antecedência', !!e && e.body.indexOf('passou de 28/01/2027 às 10:00 para 28/01/2027 às 11:00') !== -1 && pede(e) && html(e).indexOf('Ver minhas sessões') === -1, e && e.body);
  r = h.post({ acao: 'confirmarSessaoPorLink', t: tokDe(e) });
  ok('V10 o link do e-mail de remarcação confirma a data nova', r.ok === true && r.data === '2027-01-28' && r.hora === '11:00' && cel('Sessoes', idE, 'confirmada_em') !== '', r);
  h.EMAILS.length = 0;
  r = prof('profAvisarSessao', { id: idE, dados: { tipo: 'remarcacao', anterior: { data: '2027-01-28', hora: '10:00' } } });
  ok('V11 "Enviar e-mail agora" com a sessão já confirmada pelo paciente: avisa que está confirmada, sem botão de confirmar', r.ok === true && r.enviado === true && h.EMAILS.length === 1 && naoPede(h.EMAILS[0]), h.EMAILS[0] && h.EMAILS[0].body);

  // 4. reposição pedida pelo paciente e aprovada no horário pedido: também a confirmar
  const idF = uuid();
  sessao(P1, { id: idF, data: '2026-11-24', hora: '08:00', avisos: [] });
  prof('profMarcarSituacao', { id: idF, situacao: 'falta', periodo: PER });
  const idR1 = uuid();
  r = pac(P1, 'pacientePedirAgenda', { dados: { id: idR1, tipo: 'repor', sessao_id: idF, data: '2027-01-29', hora: '09:00' } });
  ok('V12 preparo: pedido de reposição aceito', r.ok === true, r && r.erro);
  h.EMAILS.length = 0;
  r = prof('profDecidirPedido', { id: idR1, aprovar: true, periodo: PER });
  const rep = prof('profLerAgenda', PER).sessoes.filter(x => x.reposicao_de === idF)[0];
  e = h.EMAILS.filter(m => m.subject === 'Pedido aprovado — COGNIATIVO')[0];
  ok('V13 reposição aprovada no horário pedido: nasce a confirmar, sem cobrança, e o e-mail leva o botão', r.ok === true && !!rep && rep.confirmada === false && rep.cobrada === 'Nao' && cel('Sessoes', rep.id, 'confirmada_em') === '' && !!e && pede(e), [rep, e && e.body]);
  r = h.post({ acao: 'confirmarSessaoPorLink', t: tokDe(e) });
  ok('V14 o link confirma a reposição', r.ok === true && r.data === '2027-01-29' && r.hora === '09:00' && cel('Sessoes', rep.id, 'confirmada_em') !== '', r);

  // 5. sessão que o próprio paciente agenda: já nascia a confirmar e continua
  h.EMAILS.length = 0;
  const uAg = uuid(), idAg = 'ag-' + uAg;
  r = pac(P1, 'pacienteAgendarSessao', { dados: { id: uAg, data: '2027-02-02', hora: '10:00', modalidade: 'presencial' } });
  r = prof('profDecidirPedido', { id: uAg, aprovar: true, periodo: PER });
  e = h.EMAILS.filter(m => m.subject === 'Pedido aprovado — COGNIATIVO')[0];
  ok('V15 agendamento pedido pelo paciente e aprovado (14.7): a sessão nasce a confirmar, e o e-mail leva o botão', r.ok === true && cel('Sessoes', idAg, 'confirmada_em') === '' && !!e && pede(e), [r.ok, e && e.body]);
  ok('V16 a coluna do 14.5.2 saiu da lista (nenhuma aba ganha coluna sem função)', S('COLUNAS_PEDIDOS_AGENDA').indexOf('confirmou_sessao') === -1 && S('COLUNAS_PEDIDOS_AGENDA').slice(-2).join(',') === 'sugestao,modalidade');
});

/* ---------------------------------------------------------------- T */
console.log('T. Listas e versão');
tenta('T', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('T1 profLerHorariosLivres é leitura (fora da trava) e exige crachá', S('ACOES_SO_LEITURA').indexOf('profLerHorariosLivres') !== -1 && S('ACOES_COM_TRAVA').indexOf('profLerHorariosLivres') === -1 && S('ACOES_PUBLICAS').indexOf('profLerHorariosLivres') === -1 && h.post({ acao: 'profLerHorariosLivres' }).ok === false);
  ok('T2 um paciente não lê os horários livres do profissional', pac(P1, 'profLerHorariosLivres', {}).ok === false);
  ok('T3 colunas novas no fim e criadas na planilha', S('COLUNAS_SESSOES').indexOf('meet_link') === S('COLUNAS_SESSOES').indexOf('gcal_evento') + 2 && S('COLUNAS_PEDIDOS_AGENDA').slice(-2).join(',') === 'sugestao,modalidade' && h.cab(aba('Sessoes')).indexOf('meet_link') !== -1 && h.cab(aba('Pedidos_Agenda')).indexOf('sugestao') !== -1);
  ok('T5 o manifesto pede o Calendar', JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'appsscript.json'), 'utf8')).oauthScopes.indexOf('https://www.googleapis.com/auth/calendar') !== -1);
  ok('T6 o token do Google nunca vai para o log nem para a resposta', src.indexOf('getOAuthToken()') === src.lastIndexOf('getOAuthToken()') && logServidor.join(' ').indexOf('tok') === -1);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T7 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
