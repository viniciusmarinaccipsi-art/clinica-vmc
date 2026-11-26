/* Pacote 14.26 — lembrete do profissional na Agenda (aba `Lembretes_Agenda` na Controle).
   Anotação do profissional para ele mesmo: não ocupa horário, nunca vai ao paciente, não gera e-mail.
   Blocos: A criar e ler · B editar, feito e apagar · C recusas · D não ocupa horário nem vaza · E Início e paciente excluído · T estrutura.
   Agora simulado: quarta, 25/11/2026, 14:00.
   Uso: node scripts/testes/backend_14_26.js */
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

const lem = (d, per) => prof('profSalvarLembreteAgenda', { dados: d, periodo: per || PER });
const lems = () => prof('profLerAgenda', PER).lembretes || [];
const linhasLem = () => { const a = aba('Lembretes_Agenda'); return a ? Math.max(a.getLastRow() - 1, 0) : -1; };
const celL = (id, col) => h.celula(aba('Lembretes_Agenda'), h.linhaDe(aba('Lembretes_Agenda'), 'id', id), col);

/* ---------------------------------------------------------------- A */
console.log('A. Criar e ler');
const L1 = uuid(), L2 = uuid();
tenta('A', () => {
  ok('A1 antes do primeiro lembrete a aba não existe e a leitura devolve lista vazia', linhasLem() === -1 && Array.isArray(prof('profLerAgenda', PER).lembretes) && lems().length === 0);
  const emails = h.EMAILS.length;
  let r = lem({ id: L1, nome: '  Ligar para a   secretária ', data: '2026-11-28', hora: '08:00', comentario: 'Pedir os exames', sigla: P1 });
  ok('A2 criado: a aba nasce, uma linha, e a resposta traz a agenda com o lembrete', r.ok === true && linhasLem() === 1 && r.agenda.lembretes.length === 1, { ok: r.ok, erro: r.erro });
  const x = r.agenda.lembretes[0];
  ok('A3 o que a tela recebe: nome limpo, dia, hora, comentário, o paciente pelo nome, e não feito', x.id === L1 && x.nome === 'Ligar para a secretária' && x.data === '2026-11-28' && x.hora === '08:00' && x.comentario === 'Pedir os exames' && x.paciente === 'Paula Primeira' && x.sigla === P1 && x.feito === false, x);
  ok('A4 cada lembrete traz só esses campos', Object.keys(x).sort().join() === 'comentario,data,feito,hora,id,nome,paciente,sigla');
  ok('A5 na planilha tudo é texto: a hora e a data ficam como foram escritas', celL(L1, 'hora') === '08:00' && celL(L1, 'data') === '2026-11-28' && celL(L1, 'criado_em') !== '' && celL(L1, 'feito_em') === '');
  r = lem({ id: L2, nome: '=SOMA(1;2)', data: '2026-11-27', hora: '09:30' });
  ok('A6 sem paciente e com nome que começa por "=": aceito, gravado como texto', r.ok === true && lems().filter(y => y.id === L2)[0].nome === '=SOMA(1;2)' && lems().filter(y => y.id === L2)[0].paciente === '');
  ok('A7 vêm em ordem de dia e hora', lems().map(y => y.id).join() === [L2, L1].join());
  ok('A8 fora do período pedido não vem', (prof('profLerAgenda', { de: '2026-12-01', ate: '2026-12-31' }).lembretes || []).length === 0);
  ok('A9 nenhum e-mail saiu', h.EMAILS.length === emails);
});

/* ---------------------------------------------------------------- B */
console.log('B. Editar, marcar como feito e apagar');
tenta('B', () => {
  let r = lem({ id: L1, nome: 'Ligar para a secretária', data: '2026-11-30', hora: '10:15', comentario: '', sigla: '' });
  let x = lems().filter(y => y.id === L1)[0];
  ok('B1 editar: mesma linha, dia e hora novos, vínculo e comentário tirados', r.ok === true && linhasLem() === 2 && x.data === '2026-11-30' && x.hora === '10:15' && x.paciente === '' && x.comentario === '', x);
  r = lem({ id: L1, so_feito: true, feito: true });
  x = lems().filter(y => y.id === L1)[0];
  const feitoEm = celL(L1, 'feito_em');
  ok('B2 feito: só a marca muda', r.ok === true && x.feito === true && feitoEm !== '' && x.data === '2026-11-30' && x.nome === 'Ligar para a secretária');
  lem({ id: L1, so_feito: true, feito: true });
  ok('B3 marcar feito de novo não troca a data da marca', celL(L1, 'feito_em') === feitoEm);
  r = lem({ id: L1, so_feito: true, feito: false });
  ok('B4 reabrir: a marca sai', r.ok === true && lems().filter(y => y.id === L1)[0].feito === false && celL(L1, 'feito_em') === '');
  r = prof('profApagarLembreteAgenda', { id: L2, periodo: PER });
  ok('B5 apagar: a linha sai e a resposta já vem sem ele', r.ok === true && linhasLem() === 1 && r.agenda.lembretes.every(y => y.id !== L2));
  ok('B6 apagar de novo (ou id que não existe): ok, nada muda', prof('profApagarLembreteAgenda', { id: L2, periodo: PER }).ok === true && linhasLem() === 1);
  ok('B7 marcar como feito um lembrete que não existe: recusado', lem({ id: uuid(), so_feito: true, feito: true }).ok === false);
});

/* ---------------------------------------------------------------- C */
console.log('C. Recusas');
tenta('C', () => {
  ok('C1 sem nome', lem({ id: uuid(), nome: '   ', data: '2026-11-28', hora: '08:00' }).codigo === 'sem_nome');
  ok('C2 sem dia ou sem hora', lem({ id: uuid(), nome: 'x', data: '', hora: '08:00' }).codigo === 'sem_horario' && lem({ id: uuid(), nome: 'x', data: '2026-11-28', hora: '' }).codigo === 'sem_horario' && lem({ id: uuid(), nome: 'x', data: '2026-02-30', hora: '08:00' }).ok === false);
  ok('C3 id inválido', lem({ id: 'x', nome: 'x', data: '2026-11-28', hora: '08:00' }).ok === false);
  ok('C4 paciente que não é do profissional', lem({ id: uuid(), nome: 'x', data: '2026-11-28', hora: '08:00', sigla: 'ZZZ999' }).ok === false);
  ok('C5 crachá de paciente não cria nem apaga lembrete', pac(P1, 'profSalvarLembreteAgenda', { dados: { id: uuid(), nome: 'x', data: '2026-11-28', hora: '08:00' } }).ok === false && pac(P1, 'profApagarLembreteAgenda', { id: L1 }).ok === false);
  ok('C6 sem crachá também não', h.post({ acao: 'profSalvarLembreteAgenda', dados: { id: uuid(), nome: 'x', data: '2026-11-28', hora: '08:00' } }).ok === false);
  ok('C7 nenhuma recusa gravou linha', linhasLem() === 1);
  const longo = uuid(); lem({ id: longo, nome: 'n'.repeat(300), data: '2026-11-28', hora: '08:00', comentario: 'c'.repeat(900) });
  const xl = lems().filter(y => y.id === longo)[0];
  ok('C8 nome e comentário longos são cortados (120 e 500)', xl.nome.length === 120 && xl.comentario.length === 500);
  prof('profApagarLembreteAgenda', { id: longo, periodo: PER });
});

/* ---------------------------------------------------------------- D */
console.log('D. Não ocupa o horário e o paciente não vê');
tenta('D', () => {
  const lh = uuid(); lem({ id: lh, nome: 'No mesmo horário', data: '2026-12-02', hora: '10:00', sigla: P1 });
  ok('D1 uma sessão entra no horário do lembrete', sessao(P2, { data: '2026-12-02', hora: '10:00' }).ok === true);
  const livres = pac(P2, 'lerHorariosLivres', { de: '2026-12-02', ate: '2026-12-02' });
  ok('D2 o horário vizinho continua livre para o paciente (o lembrete não fecha horário)', (livres.livres || []).some(y => y.data === '2026-12-02' && y.hora === '11:00'), (livres.livres || []).length);
  const minhas = JSON.stringify(pac(P1, 'lerMinhasSessoes', {}));
  ok('D3 o paciente vinculado não recebe nada do lembrete', minhas.indexOf('No mesmo horário') === -1 && minhas.indexOf('lembretes') === -1);
  ok('D4 o lembrete não vira evento do sino', (prof('profLerAgenda', PER).eventos || []).every(e => e.sessao !== lh));
});

/* ---------------------------------------------------------------- E */
console.log('E. Início e paciente excluído');
tenta('E', () => {
  const hj = uuid(); lem({ id: hj, nome: 'Hoje cedo', data: '2026-11-25', hora: '16:00', sigla: P2 });
  const ini = prof('profLerFinanceiro', { so: 'inicio' });
  const bloco = (ini.inicio || ini).lembretes_hoje;
  ok('E1 o Início recebe os lembretes de hoje, com o paciente pelo nome', Array.isArray(bloco) && bloco.length === 1 && bloco[0].id === hj && bloco[0].paciente === 'Pedro Segundo', bloco);
  const antes = linhasLem();
  av("(function (sig) { _agendaApagarDoPaciente_(ctrl, sig, {}); _memoZerar_(); })")(P2);
  ok('E2 paciente excluído: os lembretes vinculados a ele saem; os outros ficam', linhasLem() === antes - 1 && lems().every(y => y.id !== hj) && lems().some(y => y.id === L1), [antes, linhasLem()]);
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura e versão');
tenta('T', () => {
  ok('T1 VERSAO_PACOTE do 14.26 em diante (o número exato é conferido em backend_16_11.js)', /^(14\.(2[6-9]|[3-9]\d)|[12]\d\.)/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE'));
  const novas = ['profSalvarLembreteAgenda', 'profApagarLembreteAgenda'];
  ok('T2 as duas ações novas exigem crachá, estão na trava e não são leitura', novas.every(a => S('ACOES_COM_TRAVA').indexOf(a) !== -1 && S('ACOES_PUBLICAS').indexOf(a) === -1 && S('ACOES_SO_LEITURA').indexOf(a) === -1 && S('ACOES_DA_AGENDA').indexOf(a) !== -1));
  ok('T3 a aba é outra: não é a dos lembretes do paciente (Fase 19)', S('ABA_LEMBRETES_AGENDA') === 'Lembretes_Agenda' && S('ABA_LEMBRETES_AGENDA') !== S('ABA_LEMBRETES'));
  ok('T4 nenhuma coluna nova em Sessoes', S('COLUNAS_SESSOES').slice(-1)[0] === 'reagendada_para');
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T5 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
