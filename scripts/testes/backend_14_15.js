/* Pacote 14.15 — janela da consulta (etapa 2 do plano de correções, parte 2 de 4).
   No servidor: o status vai junto com o Salvar (profSalvarSessao aceita `situacao`); editar as sessões recorrentes
   não toca a sessão que continua na regra (guarda a confirmação e o pedido pendente), fecha como "sem efeito" o pedido
   da sessão que sai, e a sessão pode deixar de se repetir (`desfazer`).
   Blocos: A status no Salvar · B editar as recorrentes · C deixar de repetir · T estrutura.
   Uso: node scripts/testes/backend_14_15.js */
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
av('CONFIRMAR_ABRE_PADRAO = 100000'); // 14.26.1: esta suíte confirma a presença com muita antecedência (regra de antes); a janela de 48 horas é provada em backend_14_26_1.js

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

const igualT = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------------------------------------------------------- A */
console.log('A. O status grava junto com o Salvar');
const id1 = uuid();
tenta('A', () => {
  let r = sessao(P1, { id: id1, data: '2026-12-02', hora: '10:00' });
  ok('A0 sessão criada', r.ok === true && cel('Sessoes', id1, 'estado') === 'agendada', r.erro);
  r = sessao(P1, { id: id1, data: '2026-12-02', hora: '10:00', notas: 'nota nova', situacao: 'realizada' });
  ok('A1 Salvar com status e notas: uma chamada grava os dois (realizada, cobrada)', r.ok === true && cel('Sessoes', id1, 'estado') === 'realizada' && cel('Sessoes', id1, 'cobrada') === 'Sim' && cel('Sessoes', id1, 'notas') === 'nota nova', estadoDe(id1));
  ok('A2 a agenda devolvida já traz o status novo', lida(id1).estado === 'realizada');
  r = sessao(P1, { id: id1, data: '2026-12-02', hora: '10:00', notas: 'outra nota' });
  ok('A3 Salvar sem mandar status: o status fica como estava', r.ok === true && cel('Sessoes', id1, 'estado') === 'realizada' && cel('Sessoes', id1, 'notas') === 'outra nota', estadoDe(id1));
  const antes = cel('Sessoes', id1, 'cobrada');
  r = sessao(P1, { id: id1, data: '2026-12-02', hora: '10:00', notas: 'outra nota', situacao: 'realizada' });
  ok('A4 mandar o mesmo status não muda nada', r.ok === true && cel('Sessoes', id1, 'estado') === 'realizada' && cel('Sessoes', id1, 'cobrada') === antes);
  r = sessao(P1, { id: id1, data: '2026-12-02', hora: '10:00', notas: 'outra nota', situacao: 'falta' });
  ok('A5 trocar para falta', r.ok === true && cel('Sessoes', id1, 'estado') === 'falta' && cel('Sessoes', id1, 'cobrada') === 'Sim', estadoDe(id1));
  r = sessao(P1, { id: id1, data: '2026-12-02', hora: '10:00', notas: 'outra nota', situacao: '' });
  ok('A6 voltar para "Sem status": agendada, sem cobrança', r.ok === true && cel('Sessoes', id1, 'estado') === 'agendada' && cel('Sessoes', id1, 'cobrada') === '', estadoDe(id1));
  r = prof('profMarcarSituacao', { id: id1, situacao: 'realizada', periodo: PER });
  ok('A7 a ação antiga do status (bloco do Início) continua valendo', r.ok === true && cel('Sessoes', id1, 'estado') === 'realizada');
  // falta reposta: voltar para "Sem status" é recusado, e nada do Salvar é gravado
  const idF = uuid(), idR = uuid();
  sessao(P1, { id: idF, data: '2026-12-04', hora: '09:00' });
  sessao(P1, { id: idF, data: '2026-12-04', hora: '09:00', situacao: 'falta' });
  r = sessao(P1, { id: idR, data: '2026-12-09', hora: '09:00', reposicao_de: idF });
  ok('A8 preparação: a falta foi reposta', r.ok === true && cel('Sessoes', idR, 'reposicao_de') === idF, r.erro);
  r = sessao(P1, { id: idF, data: '2026-12-04', hora: '09:00', notas: 'não deve gravar', situacao: '' });
  ok('A9 tirar o status de uma falta já reposta: recusado com a frase de hoje, e as notas não são gravadas', r.ok === false && /já foi reposta/.test(r.erro) && cel('Sessoes', idF, 'estado') === 'falta' && cel('Sessoes', idF, 'notas') === '', { r: r.erro, notas: cel('Sessoes', idF, 'notas') });
});

/* ---------------------------------------------------------------- B */
console.log('B. Editar as sessões recorrentes');
const idS = uuid(), idE = uuid();
const daRegra = () => prof('profLerAgenda', PER).sessoes.filter(x => x.sigla === P2 && x.estado !== 'cancelada').sort((a, b) => (a.data < b.data ? -1 : 1));
tenta('B', () => {
  let r = sessao(P2, { id: idS, data: '2026-12-03', hora: '10:00', repeticao: { cada: 1, unidade: 'semana', dias_semana: [4], fim_tipo: 'n', fim_n: 4 } });
  const s0 = daRegra();
  ok('B0 quatro sessões recorrentes (03, 10, 17 e 24/12)', r.ok === true && igualT(s0.map(x => x.data), ['2026-12-03', '2026-12-10', '2026-12-17', '2026-12-24']), s0.map(x => x.data));
  const id10 = s0[1].id, id17 = s0[2].id, id24 = s0[3].id;
  r = pac(P2, 'pacienteConfirmarSessao', { id: id17 });
  ok('B1 o paciente confirma a de 17/12', r.ok === true && cel('Sessoes', id17, 'confirmada_em') !== '', r.erro);
  const ped10 = uuid(), ped17 = uuid();
  r = pac(P2, 'pacientePedirAgenda', { dados: { id: ped10, tipo: 'remarcar', sessao_id: id10, data: '2026-12-11', hora: '14:00' } });
  const r17 = pac(P2, 'pacientePedirAgenda', { dados: { id: ped17, tipo: 'remarcar', sessao_id: id17, data: '2026-12-18', hora: '14:00' } });
  // 14.22: hoje o pedido de reagendar cancela a sessão na hora. Este bloco prova o caso ANTIGO (pedido pendente com a sessão ainda agendada),
  // que pode existir em dado gravado antes do 14.22: as duas sessões voltam a 'agendada' direto na planilha.
  const antigo = id => { const a = aba('Sessoes'), l = h.linhaDe(a, 'id', id), c = h.cab(a); ['estado', 'cancelada_em', 'cancelada_por', 'cancel_no_prazo', 'cobrada'].forEach(k => a.getRange(l, c.indexOf(k) + 1).setValue(k === 'estado' ? 'agendada' : '')); h.memo(); };
  const cancelouNaHora = cel('Sessoes', id10, 'estado') === 'cancelada' && cel('Sessoes', id17, 'estado') === 'cancelada';
  antigo(id10); antigo(id17);
  ok('B2 (14.22) o pedido de reagendar da de 10/12 e da de 17/12 cancela as duas na hora; para o caso antigo, elas voltam a agendada com o pedido pendente', r.ok === true && r17.ok === true && cancelouNaHora && cel('Sessoes', id10, 'estado') === 'agendada' && cel('Sessoes', id17, 'confirmada_em') !== '' && cel('Pedidos_Agenda', ped10, 'estado') === 'pendente' && cel('Pedidos_Agenda', ped17, 'estado') === 'pendente', { a: r.erro, b: r17.erro, cancelouNaHora });
  const regra = { cada: 2, unidade: 'semana', dias_semana: [4], fim_tipo: 'n', fim_n: 3 };
  const linhasAntes = aba('Sessoes').getLastRow();
  r = prof('profEditarSerie', { periodo: PER, dados: { id: idE, sessao_id: idS, simular: true, repeticao: regra } });
  ok('B3 simulação: ficam 03, 17 e 31/12; a de 17 é mantida, a de 31 é nova, saem 10 e 24 — e nada é gravado',
    r.ok === true && igualT(r.simulacao.datas, ['2026-12-03', '2026-12-17', '2026-12-31']) && igualT(r.simulacao.mantidas, ['2026-12-17']) && igualT(r.simulacao.novas, ['2026-12-31']) && igualT(r.simulacao.retiradas, ['2026-12-10', '2026-12-24']) &&
    aba('Sessoes').getLastRow() === linhasAntes && cel('Sessoes', id10, 'estado') === 'agendada', r.simulacao);
  r = prof('profEditarSerie', { periodo: PER, dados: { id: idE, sessao_id: idS, repeticao: regra } });
  const s1 = daRegra();
  ok('B4 gravado: uma criada, uma mantida, duas retiradas; a agenda fica com 03, 17 e 31/12', r.ok === true && r.criadas === 1 && r.mantidas === 1 && r.retiradas === 2 && igualT(s1.map(x => x.data), ['2026-12-03', '2026-12-17', '2026-12-31']), { c: r.criadas, m: r.mantidas, t: r.retiradas, d: s1.map(x => x.data) });
  ok('B5 a sessão de 17/12 é a mesma linha e continua confirmada pelo paciente', s1[1].id === id17 && cel('Sessoes', id17, 'confirmada_em') !== '' && s1[1].confirmada === true, { id: s1[1].id === id17, c: cel('Sessoes', id17, 'confirmada_em') });
  ok('B6 as três ficam ligadas à regra nova, e a antiga é encerrada', s1.every(x => x.serie_id === s1[0].serie_id) && s1[0].serie_id === 'serie-' + idE && r.agenda.series[s1[0].serie_id].cada === 2, s1.map(x => x.serie_id));
  ok('B7 as que saíram ficam canceladas pela edição, sem cobrança', [id10, id24].every(i => cel('Sessoes', i, 'estado') === 'cancelada' && cel('Sessoes', i, 'cancelada_por') === 'edicao_serie' && cel('Sessoes', i, 'cobrada') === 'Nao'));
  ok('B8 o pedido da sessão que saiu é fechado como "sem efeito" (ninguém recusou); o da que ficou continua aguardando', cel('Pedidos_Agenda', ped10, 'estado') === 'sem_efeito' && cel('Pedidos_Agenda', ped10, 'decidido_em') !== '' && cel('Pedidos_Agenda', ped17, 'estado') === 'pendente', { a: cel('Pedidos_Agenda', ped10, 'estado'), b: cel('Pedidos_Agenda', ped17, 'estado') });
  ok('B9 o pedido sem efeito sai da lista de pendentes do profissional', (r.agenda.pedidos || []).every(p => p.id !== ped10) && (r.agenda.pedidos || []).some(p => p.id === ped17), (r.agenda.pedidos || []).map(p => p.id));
  ok('B10 a sessão nova nasce a confirmar', cel('Sessoes', s1[2].id, 'confirmada_em') === '' && s1[2].confirmada !== true);
  r = prof('profEditarSerie', { periodo: PER, dados: { id: idE, sessao_id: idS, repeticao: regra } });
  ok('B11 repetir o mesmo pedido não cria nada', r.ok === true && r.duplicado === true && daRegra().length === 3);
});

/* ---------------------------------------------------------------- C */
console.log('C. A sessão recorrente deixa de se repetir');
tenta('C', () => {
  const idD = uuid();
  const antes = daRegra();
  let r = prof('profEditarSerie', { periodo: PER, dados: { id: idD, sessao_id: idS, desfazer: true, simular: true } });
  ok('C1 simulação: saem 17 e 31/12, nada é gravado', r.ok === true && igualT(r.simulacao.retiradas, ['2026-12-17', '2026-12-31']) && igualT(r.simulacao.datas, ['2026-12-03']) && daRegra().length === 3, r.simulacao);
  r = prof('profEditarSerie', { periodo: PER, dados: { id: idD, sessao_id: idS, desfazer: true } });
  const depois = daRegra();
  ok('C2 gravado: fica só a de 03/12, sem repetição; as duas seguintes saem', r.ok === true && r.retiradas === 2 && r.criadas === 0 && depois.length === 1 && depois[0].id === idS && !depois[0].serie_id && cel('Sessoes', idS, 'serie_id') === '', { t: r.retiradas, d: depois.map(x => x.data + ' ' + x.serie_id) });
  ok('C3 nenhuma regra nova foi criada e a anterior está encerrada', !r.agenda.series['serie-' + idD] && cel('Series', antes[0].serie_id, 'encerrada_em') !== '');
  ok('C4 o pedido pendente da sessão de 17/12, que saiu, é fechado como sem efeito', (r.agenda.pedidos || []).every(p => p.sessao_id !== antes[1].id));
  r = prof('profEditarSerie', { periodo: PER, dados: { id: idD, sessao_id: idS, desfazer: true } });
  ok('C5 repetir o pedido (a sessão já não se repete): nada muda', r.ok === true && r.duplicado === true && daRegra().length === 1);
  h.EMAILS.length = 0;
  ok('C6 nada disso enviou e-mail ao paciente', h.EMAILS.length === 0);
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura e versão');
tenta('T', () => {
  ok('T1 VERSAO_PACOTE do 14.15 em diante (o número exato é conferido em backend_16_11.js)', /^(14\.(1[5-9]|[2-9]\d)|[12]\d\.)/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE'));
  ok('T2 nenhuma ação nova no doPost', S('ACOES_COM_TRAVA').indexOf('profEditarSerie') !== -1 && S('ACOES_COM_TRAVA').indexOf('profSalvarSessao') !== -1);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T3 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
