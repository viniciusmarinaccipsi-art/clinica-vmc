/* Pacote 14.24 — "Apagar sessão" (a marcada por engano) e a etiqueta "Reagendada" do histórico.
   A sessão apagada não é destruída: fica `estado = cancelada` com `cancelada_por = 'engano'` e some de toda leitura
   (profissional, paciente, histórico, sino), como já acontecia com 'edicao_serie'. Não cobra e não avisa o paciente.
   Blocos: A apagar a agendada · B o que não pode ser apagado · C recorrentes · D cancelada · E histórico · T estrutura.
   Agora simulado: quarta, 25/11/2026, 14:00.
   Uso: node scripts/testes/backend_14_24.js */
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
av("AGENDAR_ULTIMO_PADRAO = '24s'"); // 14.20: esta suíte pede horários a semanas de distância; o padrão de quem nunca escolheu é uma semana
const logServidor = [];
console.error = (...a) => { logServidor.push(a.map(String).join(' ')); };
const CACHE = new Map();
const cacheObj = { get: k => (CACHE.has(k) ? CACHE.get(k) : null), getAll: ks => { const r = {}; (ks || []).forEach(k => { if (CACHE.has(k)) r[k] = CACHE.get(k); }); return r; },
  put: (k, v) => { CACHE.set(k, String(v)); }, putAll: o => { Object.keys(o || {}).forEach(k => CACHE.set(k, String(o[k]))); }, remove: k => { CACHE.delete(k); }, removeAll: ks => { (ks || []).forEach(k => CACHE.delete(k)); } };
global.CacheService = { getScriptCache: () => cacheObj };
global.Utilities.base64Decode = s => Array.from(Buffer.from(String(s), 'base64')).map(x => (x > 127 ? x - 256 : x));
const blobAntigo = global.Utilities.newBlob;
global.Utilities.newBlob = (dados, tipo, nome) => (typeof dados === 'string' ? { texto: dados, tipo: tipo, nome: nome } : blobAntigo(dados, tipo, nome));

// ---------- Google Calendar de mentira, com lixeira ----------
// `revive`: o patch com status 'confirmed' traz o evento apagado de volta (true) ou o deixa apagado (false).
const G = { chamadas: [], agendas: [{ id: 'primary', summary: 'pessoal' }], eventos: {}, seq: 0, revive: true, listaFalha: false, paginar: false };
const DONO = 'np@exemplo.test'; // a profissional das provas é a dona do script
global.Session = { getEffectiveUser: () => ({ getEmail: () => DONO }) };
global.ScriptApp.getOAuthToken = () => 'tok';
global.UrlFetchApp = { fetch: (url, o) => {
  const u = String(url).replace('https://www.googleapis.com/calendar/v3', ''), metodo = String((o && o.method) || 'get').toLowerCase();
  const corpo = o && o.payload ? JSON.parse(o.payload) : null;
  G.chamadas.push({ metodo, u, corpo });
  const resp = (codigo, dados) => ({ getResponseCode: () => codigo, getContentText: () => JSON.stringify(dados || {}) });
  if (metodo === 'get' && u.indexOf('/users/me/calendarList') === 0) return resp(200, { items: G.agendas });
  if (metodo === 'post' && u === '/calendars') { const c = { id: 'cal' + (++G.seq), summary: corpo.summary }; G.agendas.push(c); G.eventos[c.id] = {}; return resp(200, c); }
  const m = u.match(/^\/calendars\/([^/]+)\/events(?:\/([^?]+))?(?:\?(.*))?$/);
  if (m) {
    const cal = decodeURIComponent(m[1]), evs = G.eventos[cal];
    if (!evs) return resp(404, {});
    if (metodo === 'get' && !m[2]) {
      if (G.listaFalha) return resp(500, { error: { status: 'INTERNAL' } });
      const vivos = Object.keys(evs).filter(k => evs[k].status !== 'cancelled').map(k => ({ id: k, status: evs[k].status }));
      if (!G.paginar) return resp(200, { items: vivos });
      const pg = /pageToken=p2/.test(m[3] || ''), meio = Math.ceil(vivos.length / 2); // duas páginas
      return resp(200, pg ? { items: vivos.slice(meio) } : { items: vivos.slice(0, meio), nextPageToken: 'p2' });
    }
    if (metodo === 'post') { const id = 'ev' + (++G.seq); const ev = Object.assign({}, corpo, { id }); if (corpo.conferenceData && corpo.conferenceData.createRequest) ev.hangoutLink = 'https://meet.google.com/sala-' + G.seq; evs[id] = ev; return resp(200, ev); }
    const id = decodeURIComponent(m[2] || '');
    if (!evs[id]) return resp(404, {});
    if (metodo === 'delete') { delete evs[id]; return resp(204, null); }
    if (metodo === 'patch') {
      if (evs[id].status === 'cancelled' && !G.revive) return resp(200, evs[id]); // continua na lixeira
      Object.assign(evs[id], corpo);
      return resp(200, evs[id]);
    }
  }
  return resp(400, {});
} };
const NOME_CAL = 'Cogniativo: Agenda Consultório';
const calId = () => G.agendas.filter(a => a.summary === NOME_CAL).slice(-1)[0].id;
const evento = id => G.eventos[calId()][id];
const vivosNoGoogle = () => Object.values(G.eventos[calId()]).filter(e => e.status !== 'cancelled');
const apagarNoGoogle = id => { evento(id).status = 'cancelled'; };          // foi para a lixeira do Google
const sumirDoGoogle = id => { delete G.eventos[calId()][id]; };              // saiu até da lixeira
const escritas = () => G.chamadas.filter(c => c.metodo !== 'get');

const h = av('({ post: post, cracha: cracha, novoPaciente: novoPaciente, celula: celula, linhaDe: linhaDe, cab: cab, abaPac: abaPac, ctrl: ctrl, EMAILS: EMAILS, memo: _memoZerar_, aceite: _gravarAceitePolitica_, hashProf: hashProf })');
const S = nome => av(nome);

let passo = 0, falhas = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 600) : '')); } };
const tenta = (n, f) => { try { f(); } catch (e) { ok(n + ' (exceção)', false, String(e && e.stack || e).slice(0, 700)); } };
const uuid = () => crypto.randomUUID();
const tokProf = () => h.cracha('profissional', 'NP', 'PROF_NP', h.hashProf);
const tokPac = sigla => h.cracha('paciente', sigla, 'PROF_NP', h.celula(h.abaPac, h.linhaDe(h.abaPac, 'sigla', sigla), 'senha_hash'));
const prof = (acao, extra) => { h.memo(); return h.post(Object.assign({ acao: acao, token: tokProf() }, extra || {})); };
const pac = (sigla, acao, extra) => { h.memo(); return h.post(Object.assign({ acao: acao, token: tokPac(sigla) }, extra || {})); };
const pub = extra => { h.memo(); return h.post(Object.assign({ acao: 'confirmarSessaoPorLink' }, extra || {})); };
const novo = (nome, email) => { const s = h.novoPaciente(nome, email); h.memo(); h.aceite(s, 'PROF_NP'); h.memo(); return s; };
const aba = nome => h.ctrl.getSheetByName(nome);
const cel = (nomeAba, id, col) => h.celula(aba(nomeAba), h.linhaDe(aba(nomeAba), 'id', id), col);
const PER = { de: '2026-11-01', ate: '2027-02-08' };
const TODAS = ['confirmacao', 'lembrete48', 'lembrete', 'cancelamento'];
const sessao = (sigla, d) => prof('profSalvarSessao', { periodo: PER, dados: Object.assign({ id: uuid(), sigla: sigla, data: '2026-12-02', hora: '10:00', duracao_min: 60, modalidade: 'presencial', valor: '300', notas: '', avisos: TODAS }, d || {}) });
const gatilho = d => { h.memo(); return S('enviarLembretes_')(d).sessoes; };
const tokenDe = id => String(lida(id).link_confirmar).split('?confirmar=')[1];
const lida = id => prof('profLerAgenda', PER).sessoes.filter(x => x.id === id)[0];
const GRADE = [1, 2, 3, 4, 5].map(d => ({ dia_semana: d, hora_inicio: '08:00', hora_fim: '18:00', modalidade: 'ambas', ativo: 'sim' }));
const FRASE = 'Criado pelo COGNIATIVO. Presença confirmada pelo paciente.';
const estadoDe = id => ({ estado: cel('Sessoes', id, 'estado'), cancelada_em: cel('Sessoes', id, 'cancelada_em'), cobrada: cel('Sessoes', id, 'cobrada'), confirmada_em: cel('Sessoes', id, 'confirmada_em') });

const P1 = novo('Paula Primeira', 'p1@exemplo.test');
const P2 = novo('Pedro Segundo', 'p2@exemplo.test');
prof('profSalvarGrade', { config: { duracao_slot_min: 60, antecedencia_min_horas: 24, avisos_sessao: 'Sim' }, grade: GRADE });
const html = e => String(e.htmlBody || '');
const avisar = (id, dados) => prof('profAvisarSessao', { id: id, dados: dados || {} });

const simular = (id, opcoes) => prof('profCancelarSessao', { id: id, opcoes: Object.assign({ simular: true }, opcoes) });
const grade = config => prof('profSalvarGrade', { config: Object.assign({ duracao_slot_min: 60, antecedencia_min_horas: 24 }, config), grade: GRADE });
const naAgenda = id => (prof('profLerAgenda', PER).sessoes || []).filter(x => x.id === id)[0];
const minha = (sig, id) => (pac(sig, 'lerMinhasSessoes', {}).sessoes || []).filter(x => x.id === id)[0];
const pedir = (sig, sessaoId, d) => { const id = uuid(); const r = pac(sig, 'pacientePedirAgenda', { dados: Object.assign({ id: id, tipo: 'remarcar', sessao_id: sessaoId }, d) }); return { id: id, r: r }; };
const irPara = (ano, mes, dia, hh, mm) => { agoraMs = new Real(ano, mes - 1, dia, hh || 0, mm || 0, 0).getTime(); };
grade({});

const apagar = (id, ops) => prof('profApagarSessao', { id: id, opcoes: ops || {}, periodo: PER });
const naAg = id => (prof('profLerAgenda', PER).sessoes || []).filter(x => x.id === id)[0];
const doPaciente = (sigla, id) => (pac(sigla, 'lerMinhasSessoes', {}).sessoes || []).filter(x => x.id === id)[0];
const noHistorico = (sigla, id) => (prof('profLerAgenda', { siglaPaciente: sigla }).historico || []).filter(x => x.id === id)[0];

/* ---------------------------------------------------------------- A */
console.log('A. Apagar a sessão agendada');
let idA;
tenta('A', () => {
  prof('profSalvarGrade', { config: { duracao_slot_min: 60, antecedencia_min_horas: 24, avisos_sessao: 'Sim', google_calendar: 'Sim' }, grade: GRADE }); // a profissional das provas é a dona do script
  prof('profAgendaConectar', { periodo: PER });
  let r = sessao(P1, { data: '2026-12-02', hora: '10:00', modalidade: 'online' }); idA = r.id || (r.sessao && r.sessao.id);
  if (!idA) idA = prof('profLerAgenda', PER).sessoes.filter(x => x.data === '2026-12-02' && x.hora === '10:00')[0].id;
  ok('A1 a sessão agendada vem com pode_apagar', naAg(idA).pode_apagar === true, naAg(idA));
  const eventosAntes = vivosNoGoogle().length, emailsAntes = h.EMAILS.length;
  r = apagar(idA);
  ok('A2 apagar: aceito, uma sessão apagada, e a resposta traz a agenda do período', r.ok === true && r.apagadas === 1 && !!r.agenda && Array.isArray(r.agenda.sessoes), { ok: r.ok, erro: r.erro, n: r.apagadas });
  ok('A3 a linha continua na planilha, marcada: cancelada, por engano, não cobrada', cel('Sessoes', idA, 'estado') === 'cancelada' && cel('Sessoes', idA, 'cancelada_por') === 'engano' && cel('Sessoes', idA, 'cobrada') === 'Nao', estadoDe(idA));
  ok('A4 some da agenda do profissional', !naAg(idA) && r.agenda.sessoes.every(x => x.id !== idA));
  ok('A5 some de "Minhas sessões" do paciente e do histórico do paciente', !doPaciente(P1, idA) && !noHistorico(P1, idA));
  ok('A6 nenhum e-mail saiu', h.EMAILS.length === emailsAntes, h.EMAILS.length - emailsAntes);
  ok('A7 o evento saiu do Google Calendar', vivosNoGoogle().length === eventosAntes - 1, [eventosAntes, vivosNoGoogle().length]);
  ok('A8 o horário voltou a ficar livre: outra sessão entra no mesmo lugar', sessao(P2, { data: '2026-12-02', hora: '10:00' }).ok === true);
  r = apagar(idA);
  ok('A9 apagar de novo: duplicado, nada muda', r.ok === true && r.duplicado === true && r.apagadas === 0, r.erro);
  ok('A10 o sino não ganha evento de cancelamento', (prof('profLerAgenda', PER).eventos || []).every(e => e.sessao !== idA));
});

/* ---------------------------------------------------------------- B */
console.log('B. O que não pode ser apagado');
tenta('B', () => {
  const pegar = (d, hh) => prof('profLerAgenda', PER).sessoes.filter(x => x.data === d && x.hora === hh && x.estado !== 'cancelada')[0].id;
  sessao(P1, { data: '2026-11-24', hora: '09:00' }); const feita = pegar('2026-11-24', '09:00');
  prof('profMarcarSituacao', { id: feita, situacao: 'realizada', periodo: PER });
  ok('B1 realizada: sem pode_apagar, e o servidor recusa', naAg(feita).pode_apagar === false && apagar(feita).codigo === 'nao_pode');
  sessao(P1, { data: '2026-11-24', hora: '11:00' }); const falta = pegar('2026-11-24', '11:00');
  prof('profMarcarSituacao', { id: falta, situacao: 'falta', periodo: PER });
  ok('B2 falta: recusada', apagar(falta).ok === false && cel('Sessoes', falta, 'estado') === 'falta');
  sessao(P1, { data: '2026-12-03', hora: '09:00' }); const paga = pegar('2026-12-03', '09:00');
  av("(function (id, sig) { var a = _finAba_(ctrl, ABA_FIN_ALOCACOES, true); a.appendRow(['al1', 'pg1', id, sig, '30000', '2026-11-25 14:00']); _memoZerar_(); })")(paga, P1);
  let r = apagar(paga);
  ok('B3 com pagamento lançado: recusada, com a frase que manda cancelar', r.ok === false && r.codigo === 'pagamento' && /pagamento lançado/.test(r.erro) && cel('Sessoes', paga, 'estado') === 'agendada', r);
  sessao(P1, { data: '2026-12-04', hora: '09:00' }); const orig = pegar('2026-12-04', '09:00');
  r = prof('profCancelarSessao', { id: orig, opcoes: { quem: 'profissional', reagendar: { data: '2026-12-07', hora: '09:00' } }, periodo: PER });
  ok('B4 reagendada e a sessão nova dela: nenhuma das duas pode ser apagada', r.ok === true && apagar(orig).ok === false && apagar('rg-' + orig).ok === false && naAg('rg-' + orig).pode_apagar === false, r.erro);
  ok('B5 id que não existe: recusado', apagar(uuid()).ok === false);
  ok('B6 crachá de paciente não apaga', pac(P1, 'profApagarSessao', { id: paga, periodo: PER }).ok === false);
  ok('B7 sem crachá não apaga', h.post({ acao: 'profApagarSessao', id: paga }).ok === false);
});

/* ---------------------------------------------------------------- C */
console.log('C. Sessões recorrentes');
tenta('C', () => {
  const r0 = prof('profSalvarSessao', { periodo: PER, dados: { id: uuid(), sigla: P2, data: '2026-12-08', hora: '15:00', duracao_min: 60, modalidade: 'presencial', valor: '300', notas: '', avisos: TODAS,
    repeticao: { cada: 1, unidade: 'semana', dias_semana: [2], fim_tipo: 'n', fim_n: 4 } } });
  const serie = () => prof('profLerAgenda', PER).sessoes.filter(x => x.sigla === P2 && x.hora === '15:00' && x.estado !== 'cancelada').sort((a, b) => a.data < b.data ? -1 : 1);
  let s = serie();
  ok('C0 as quatro sessões recorrentes nasceram', r0.ok === true && s.length === 4 && s.every(x => !!x.serie_id), [r0.erro, s.length]);
  let r = apagar(s[0].id, { escopo: 'esta' });
  ok('C1 "só esta": uma apagada, as outras três continuam', r.ok === true && r.apagadas === 1 && serie().length === 3, [r.apagadas, serie().length]);
  s = serie();
  r = apagar(s[0].id, { escopo: 'seguintes' });
  ok('C2 "esta e as seguintes": as três saem e a regra é encerrada', r.ok === true && r.apagadas === 3 && serie().length === 0 && cel('Series', s[0].serie_id, 'encerrada_em') !== '', [r.apagadas, serie().length]);
  ok('C3 nenhuma delas aparece para o paciente', (pac(P2, 'lerMinhasSessoes', {}).sessoes || []).every(x => x.hora !== '15:00'));
});

/* ---------------------------------------------------------------- D */
console.log('D. Apagar a sessão já cancelada');
tenta('D', () => {
  const pegar = (d, hh) => prof('profLerAgenda', PER).sessoes.filter(x => x.data === d && x.hora === hh)[0].id;
  sessao(P1, { data: '2026-12-10', hora: '09:00' }); const c1 = pegar('2026-12-10', '09:00');
  prof('profCancelarSessao', { id: c1, opcoes: { quem: 'profissional' }, periodo: PER });
  ok('D1 cancelada por mim, não cobrada: aparece na leitura e pode ser apagada', naAg(c1).estado === 'cancelada' && naAg(c1).pode_apagar === true);
  let r = apagar(c1);
  ok('D2 apagada: some da leitura do profissional e do histórico', r.ok === true && !naAg(c1) && !noHistorico(P1, c1) && cel('Sessoes', c1, 'cancelada_por') === 'engano', r.erro);
  sessao(P1, { data: '2026-11-26', hora: '09:00' }); const c2 = pegar('2026-11-26', '09:00');
  r = prof('profCancelarSessao', { id: c2, opcoes: { quem: 'paciente', cobrar: true }, periodo: PER });
  ok('D3 cancelada e cobrada: não pode ser apagada (é cobrança)', r.ok === true && naAg(c2).cobrada === 'Sim' && naAg(c2).pode_apagar === false && apagar(c2).codigo === 'nao_pode', r.erro);
});

/* ---------------------------------------------------------------- E */
console.log('E. Histórico do paciente');
tenta('E', () => {
  const hist = prof('profLerAgenda', { siglaPaciente: P1 }).historico || [];
  const reag = hist.filter(x => x.estado === 'cancelada' && x.reagendada === true), canc = hist.filter(x => x.estado === 'cancelada' && x.reagendada === false);
  ok('E1 a cancelada que foi reagendada vem marcada, e a cancelada comum não', reag.length === 1 && canc.length >= 1, hist.map(x => [x.data, x.estado, x.reagendada]));
  ok('E2 cada linha traz só o que a tela mostra', hist.every(x => Object.keys(x).sort().join() === 'confirmada,data,estado,hora,id,modalidade,reagendada,reposicao,valor'));
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura e versão');
tenta('T', () => {
  ok('T1 VERSAO_PACOTE do 14.24 em diante (o número exato é conferido em backend_16_11.js)', /^(14\.(2[4-9]|[3-9]\d)|[12]\d\.)/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE'));
  ok('T2 a ação nova exige crachá, está na trava e não é leitura', S('ACOES_COM_TRAVA').indexOf('profApagarSessao') !== -1 && S('ACOES_PUBLICAS').indexOf('profApagarSessao') === -1 && S('ACOES_SO_LEITURA').indexOf('profApagarSessao') === -1 && S('ACOES_DA_AGENDA').indexOf('profApagarSessao') !== -1);
  ok('T3 nenhuma coluna nova em Sessoes', S('COLUNAS_SESSOES').slice(-1)[0] === 'reagendada_para');
  ok('T4 o estado gravado continua sendo um dos quatro de sempre', (prof('profLerAgenda', PER).sessoes || []).every(x => ['agendada', 'realizada', 'falta', 'cancelada'].indexOf(x.estado) !== -1));
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T5 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
