/* Pacote 14.12 — Lentidão: o servidor lê cada coisa uma vez por ação (memória da chamada, só dentro do doPost): as abas da
   Agenda, a configuração, a lista de pacientes, os cabeçalhos e o cadastro do profissional. Nada muda na tela nem nas regras.
   A prova central: depois de CADA gravação, a agenda devolvida (montada com a memória) é igual à planilha lida de novo.
   Blocos: A uma leitura por ação · B a memória acompanha toda gravação · C fora do doPost · T estrutura.
   Uso: node scripts/testes/backend_14_12.js */
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

/* ---------- contadores de leitura (a memória da chamada só vale dentro do doPost) ---------- */
global.__LEU = [];
av("_lembretesLer_ = (function (o) { return function (a) { try { __LEU.push('aba:' + a.getName()); } catch (e) {} return o(a); }; })(_lembretesLer_)");
av("_ageConfigLer_ = (function (o) { return function (c) { __LEU.push('config'); return o(c); }; })(_ageConfigLer_)");
av("lerAbaComoObjetos = (function (o) { return function (p, n) { __LEU.push('objetos:' + n); return o(p, n); }; })(lerAbaComoObjetos)");
const leu = nome => global.__LEU.filter(x => x === nome).length;
const zerar = () => { global.__LEU.length = 0; };
const limpa = a => JSON.stringify((a.sessoes || []).map(x => Object.assign({}, x)).sort((x, y) => (x.id < y.id ? -1 : 1))) + JSON.stringify(a.bloqueios) + JSON.stringify(a.pedidos) + JSON.stringify(a.series);
/** A agenda devolvida pela gravação (montada com a memória da chamada) tem de ser igual à lida de novo da planilha. */
const igualAPlanilha = r => { const nova = prof('profLerAgenda', PER); return !!r.agenda && limpa(r.agenda) === limpa(nova); };
const UMA = () => ['aba:Sessoes', 'aba:Series', 'aba:Bloqueios', 'aba:Pedidos_Agenda', 'config'].every(n => leu(n) === 1);

const P1 = novo('Paula Primeira', 'p1@exemplo.test');
const P2 = novo('Pedro Segundo', 'p2@exemplo.test');
prof('profSalvarGrade', { config: { duracao_slot_min: 60, antecedencia_min_horas: 24, avisos_sessao: 'Sim' }, grade: GRADE });
prof('profAgendaConectar', { periodo: PER });

/* ---------------------------------------------------------------- A */
console.log('A. Cada coisa é lida uma vez por ação');
const id1 = uuid(), id2 = uuid(), idS = uuid();
tenta('A', () => {
  sessao(P1, { id: uuid(), data: '2026-12-01', hora: '09:00' }); // a primeira cria as abas
  zerar();
  let r = sessao(P1, { id: id1, data: '2026-12-02', hora: '10:00' });
  ok('A1 criar uma sessão: Sessões, Séries, Bloqueios, Pedidos e a configuração são lidas uma vez cada (eram 2 a 3)', r.ok === true && UMA(), global.__LEU.slice());
  ok('A2 a lista de pacientes da Agenda é lida uma vez (eram 3)', leu('objetos:Pacientes') <= 1, leu('objetos:Pacientes'));
  ok('A3 a agenda devolvida é igual à planilha lida de novo', igualAPlanilha(r));
  zerar();
  r = sessao(P1, { id: id1, data: '2026-12-02', hora: '15:00' });
  ok('A4 mudar a hora: uma leitura de cada, e a resposta já traz a hora nova', r.ok === true && UMA() && r.agenda.sessoes.filter(x => x.id === id1)[0].hora === '15:00', global.__LEU.slice());
  ok('A5 e continua igual à planilha', igualAPlanilha(r) && cel('Sessoes', id1, 'hora_inicio') === '15:00');
  zerar();
  r = sessao(P2, { id: idS, data: '2026-12-03', hora: '10:00', repeticao: { cada: 1, unidade: 'semana', dias_semana: [4], fim_tipo: 'n', fim_n: 4 } });
  const daSerie = r.agenda.sessoes.filter(x => x.serie_id && x.sigla === P2);
  ok('A6 criar quatro sessões recorrentes: uma leitura de cada aba e as quatro na resposta', r.ok === true && UMA() && daSerie.length === 4, { leu: global.__LEU.slice(), n: daSerie.length });
  ok('A7 as quatro iguais à planilha', igualAPlanilha(r));
  zerar();
  const s0 = daSerie.sort((a, b) => (a.data < b.data ? -1 : 1))[0];
  r = sessao(P2, { id: s0.id, data: s0.data, hora: '16:00', escopo: 'seguintes' });
  ok('A8 mudar a hora das recorrentes: uma leitura de cada, todas às 16:00 e igual à planilha', r.ok === true && UMA() && r.agenda.sessoes.filter(x => x.serie_id && x.sigla === P2).every(x => x.hora === '16:00') && igualAPlanilha(r), global.__LEU.slice());
});

/* ---------------------------------------------------------------- B */
console.log('B. A memória acompanha toda gravação');
tenta('B', () => {
  let r = prof('profMarcarSituacao', { id: id1, situacao: 'realizada', periodo: PER });
  ok('B1 informar o status: a resposta traz o status e é igual à planilha', r.ok === true && r.agenda.sessoes.filter(x => x.id === id1)[0].estado === 'realizada' && igualAPlanilha(r));
  sessao(P1, { id: id2, data: '2026-12-09', hora: '09:00', modalidade: 'online' });
  r = prof('profCancelarSessao', { id: id2, opcoes: { quem: 'profissional', avisar: false }, periodo: PER });
  ok('B2 cancelar: a sessão sai da resposta e a planilha diz cancelada', r.ok === true && !r.agenda.sessoes.some(x => x.id === id2 && x.estado !== 'cancelada') && cel('Sessoes', id2, 'estado') === 'cancelada' && igualAPlanilha(r));
  const idB = uuid(), idB2 = uuid();
  r = prof('profSalvarBloqueio', { periodo: PER, dados: { id: idB, data_inicio: '2026-12-14', data_fim: '2026-12-15', dia_todo: true, nome: 'Congresso' } });
  const r2 = prof('profSalvarBloqueio', { periodo: PER, dados: { id: idB2, data_inicio: '2026-12-16', hora_inicio: '12:00', hora_fim: '14:00', dia_todo: false, nome: '' } });
  ok('B3 criar bloqueios: aparecem na resposta, igual à planilha', r.ok && r2.ok && r2.agenda.bloqueios.length === 2 && igualAPlanilha(r2));
  r = prof('profApagarBloqueio', { id: idB, periodo: PER });
  ok('B4 apagar um bloqueio (linha apagada): a resposta fica só com o outro, igual à planilha', r.ok === true && r.agenda.bloqueios.length === 1 && r.agenda.bloqueios[0].id === idB2 && igualAPlanilha(r), r.agenda && r.agenda.bloqueios);
  const uP = uuid();
  const rp = pac(P1, 'pacienteAgendarSessao', { dados: { id: uP, data: '2026-12-10', hora: '08:00', modalidade: 'presencial' } });
  zerar();
  r = prof('profDecidirPedido', { id: uP, aprovar: true, periodo: PER });
  ok('B5 aprovar um pedido: a sessão nasce, o pedido sai dos pendentes, tudo igual à planilha', rp.ok !== false && r.ok === true && r.agenda.sessoes.some(x => x.id === 'ag-' + uP) && !r.agenda.pedidos.some(p => p.id === uP) && igualAPlanilha(r), r.erro);
  ok('B6 e, nessa ação, o cadastro do profissional não é relido a cada passo (a aba Profissionais é lida no máximo duas vezes)', leu('objetos:Profissionais') <= 2, leu('objetos:Profissionais'));
  const v = prof('profSalvarValorSessao', { siglaPaciente: P2, valor: '250' });
  const uQ = uuid();
  pac(P2, 'pacienteAgendarSessao', { dados: { id: uQ, data: '2026-12-11', hora: '08:00', modalidade: 'presencial' } });
  r = prof('profDecidirPedido', { id: uQ, aprovar: true, periodo: PER });
  ok('B7 valor da sessão mudado no cadastro: a sessão aprovada em seguida nasce com o valor novo', v.ok === true && r.ok === true && /^250/.test(cel('Sessoes', 'ag-' + uQ, 'valor')), { v: v, valor: cel('Sessoes', 'ag-' + uQ, 'valor') });
  r = pac(P1, 'pacienteConfirmarSessao', { id: 'ag-' + uP });
  ok('B8 confirmação do paciente: a resposta dele já vem confirmada e a planilha também', r.ok !== false && cel('Sessoes', 'ag-' + uP, 'confirmada_em') !== '' && (r.sessoes || []).filter(x => x.id === 'ag-' + uP)[0].confirmada === true, r.erro);
});

/* ---------------------------------------------------------------- C */
console.log('C. Gatilho e chamada direta');
tenta('C', () => {
  h.memo(); zerar();
  const g1 = S('enviarLembretes_')(quando(2026, 11, 25, 14, 5)).sessoes;
  ok('C1 o gatilho dos lembretes continua rodando e lendo as sessões, sem falhas', typeof g1.sessoes === 'number' && g1.falhas === 0 && leu('aba:Sessoes') >= 1, { g: g1 });
  const E = S('_ageLer_');
  const aS = aba('Sessoes');
  const a = E(aS), b = E(aS);
  ok('C2 chamada direta de _ageLer_ (sem doPost) lê a planilha a cada vez', a.length === b.length && a !== b && a.length > 0);
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura e versão');
tenta('T', () => {
  ok('T1 VERSAO_PACOTE do 14.12 em diante (o número exato é conferido em backend_16_11.js)', /^(14\.(1[2-9]|[2-9]\d)|[12]\d\.)/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE'));
  ok('T2 nenhuma ação nova; as gravações da Agenda estão na lista da memória do profissional', S('ACOES_DA_AGENDA').every(a => S('ACOES_COM_TRAVA').indexOf(a) !== -1 || a === 'confirmarSessaoPorLink' || S('ACOES_PUBLICAS').indexOf(a) !== -1), S('ACOES_DA_AGENDA').filter(a => S('ACOES_COM_TRAVA').indexOf(a) === -1));
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T3 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
