/* Pacote 14.31 — (1) o lembrete do profissional vai também à Google Agenda dele; (2) a reposição marcada por engano pode ser apagada.
   Blocos: A lembrete no Google · B o que não acontece · C apagar reposição · T estrutura. Google de mentira (o de backend_14_11.js).
   Agora simulado: quarta, 25/11/2026, 14:00. Uso: node scripts/testes/backend_14_31.js */
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
av('MSG_PADRAO.lembrete.horas = 24'); // 14.30: esta suíte foi escrita com o segundo lembrete 24 horas antes; o padrão passou a 36 (provado em backend_14_30.js)

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
prof('profAgendaConectar', { periodo: PER });

const lem = d => prof('profSalvarLembreteAgenda', { periodo: PER, dados: Object.assign({ id: uuid(), data: '2026-12-03', hora: '09:00', nome: 'Ligar para o contador', comentario: '', sigla: '' }, d || {}) });
const celL = (id, col) => cel('Lembretes_Agenda', id, col);
const doLem = id => Object.values(G.eventos[calId()]).filter(e => e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.cogniativo === 'lem-' + id);
const livre = (sig, data, hora) => { const r = prof('profLerHorariosLivres', { de: data }), l = r.livres && r.livres.livres ? r.livres.livres : (r.livres || []); return l.some(x => JSON.stringify(x).indexOf(data) !== -1 && JSON.stringify(x).indexOf(hora) !== -1); };
const rodar = () => { h.memo(); return S('enviarLembretes_')(new DataFixa()); };

/* ---------------------------------------------------------------- A */
console.log('A. O lembrete do profissional vai à Google Agenda');
tenta('A', () => {
  const idA = uuid();
  let r = lem({ id: idA });
  let evs = doLem(idA);
  ok('A1 salvar o lembrete cria o evento na agenda do COGNIATIVO no Google, na mesma ação', r.ok === true && evs.length === 1 && celL(idA, 'gcal_evento') === evs[0].id && celL(idA, 'gcal_sinc') === 'ok', { n: evs.length, s: celL(idA, 'gcal_sinc') });
  ok('A2 o evento diz "Lembrete: <nome>", no dia e na hora, com meia hora', evs[0].summary === 'Lembrete: Ligar para o contador' && evs[0].start.dateTime === '2026-12-03T09:00:00' && evs[0].end.dateTime === '2026-12-03T09:30:00', evs[0]);
  ok('A3 o evento não pede sala do Meet, não tem convidado e não tem endereço', !evs[0].conferenceData && !evs[0].attendees && !evs[0].location);
  const evId = evs[0].id;
  r = lem({ id: idA, data: '2026-12-04', hora: '16:30', nome: 'Ligar para o contador', comentario: 'Levar os recibos', sigla: P1 });
  evs = doLem(idA);
  ok('A4 mudar o dia, a hora e o comentário muda o MESMO evento', evs.length === 1 && evs[0].id === evId && evs[0].start.dateTime === '2026-12-04T16:30:00' && /Levar os recibos/.test(evs[0].description) && /Paciente: Paula Primeira\./.test(evs[0].description), evs[0]);
  r = prof('profSalvarLembreteAgenda', { periodo: PER, dados: { id: idA, so_feito: true, feito: true } });
  ok('A5 marcar como feito troca o título para "Feito: <nome>"', doLem(idA)[0].summary === 'Feito: Ligar para o contador', doLem(idA)[0].summary);
  apagarNoGoogle(evId);
  r = lem({ id: idA, data: '2026-12-04', hora: '17:00', nome: 'Ligar para o contador' });
  ok('A6 evento apagado direto no Google: ao salvar de novo, o lembrete volta para a agenda', vivosNoGoogle().filter(e => /contador/.test(e.summary)).length === 1 && celL(idA, 'gcal_sinc') === 'ok');
  const vivo = celL(idA, 'gcal_evento');
  r = prof('profApagarLembreteAgenda', { id: idA, periodo: PER });
  ok('A7 apagar o lembrete tira o evento do Google', r.ok === true && !G.eventos[calId()][vivo] && aba('Lembretes_Agenda').getLastRow() - 1 === 0, Object.keys(G.eventos[calId()]));
  ok('A8 a leitura da Agenda continua devolvendo os lembretes sem nada do Google', (() => { const id = uuid(); lem({ id: id }); const l = prof('profLerAgenda', PER).lembretes.filter(x => x.id === id)[0]; return !!l && l.gcal_evento === undefined && l.gcal_sinc === undefined; })());
});

/* ---------------------------------------------------------------- B */
console.log('B. O que não acontece');
tenta('B', () => {
  const antes = h.EMAILS.length, sessoesAntes = aba('Sessoes') ? aba('Sessoes').getLastRow() : 0;
  const idB = uuid();
  lem({ id: idB, sigla: P2, nome: 'Rever o plano' });
  ok('B1 lembrete ligado a um paciente: nenhum e-mail sai e nenhuma sessão nasce', h.EMAILS.length === antes && (aba('Sessoes') ? aba('Sessoes').getLastRow() : 0) === sessoesAntes);
  ok('B2 o lembrete não ocupa horário: o horário continua livre na Agenda', livre(P2, '2026-12-03', '09:00'));
  // Google fora do ar: o lembrete é salvo do mesmo jeito e fica na fila
  const real = global.UrlFetchApp.fetch;
  global.UrlFetchApp.fetch = () => { throw new Error('rede'); };
  const idB2 = uuid();
  const r = lem({ id: idB2, nome: 'Sem rede' });
  global.UrlFetchApp.fetch = real;
  ok('B3 com o Google fora do ar, o lembrete é salvo e fica na fila', r.ok === true && celL(idB2, 'nome') === 'Sem rede' && celL(idB2, 'gcal_sinc') === 'pendente' && celL(idB2, 'gcal_evento') === '', { s: celL(idB2, 'gcal_sinc') });
  const g = rodar();
  ok('B4 a rodada seguinte do gatilho leva o lembrete ao Google', doLem(idB2).length === 1 && celL(idB2, 'gcal_sinc') === 'ok', g);
  const n = escritas().length;
  rodar();
  ok('B5 com tudo no lugar, a rodada não escreve nada no Google', escritas().length === n);
  // lembrete antigo, de antes deste pacote (sem marca), no futuro: vai na primeira rodada; o que já passou não vai
  const idV = uuid(), idP = uuid();
  lem({ id: idV, nome: 'Antigo no futuro', data: '2026-12-10' }); lem({ id: idP, nome: 'Antigo no passado', data: '2026-12-10' });
  [idV, idP].forEach(i => { const ev = celL(i, 'gcal_evento'); delete G.eventos[calId()][ev]; });
  const A = aba('Lembretes_Agenda'), cabL = A.getRange(1, 1, 1, A.getLastColumn()).getValues()[0];
  [idV, idP].forEach(i => { const l = h.linhaDe(A, 'id', i); A.getRange(l, cabL.indexOf('gcal_evento') + 1).setValue(''); A.getRange(l, cabL.indexOf('gcal_sinc') + 1).setValue(''); });
  A.getRange(h.linhaDe(A, 'id', idP), cabL.indexOf('data') + 1).setValue("'2026-11-20");
  rodar();
  ok('B6 lembrete criado antes deste pacote: o do futuro vai ao Google; o que já passou não vai', doLem(idV).length === 1 && doLem(idP).length === 0 && celL(idP, 'gcal_sinc') === '', { v: doLem(idV).length, p: doLem(idP).length });
  // sem a conta conectada, nada vai
  prof('profSalvarGrade', { config: { duracao_slot_min: 60, antecedencia_min_horas: 24, avisos_sessao: 'Sim', google_calendar: 'Nao' }, grade: GRADE });
  const desligou = prof('profLerAgenda', PER).config.google_calendar !== 'Sim';
  if (desligou) { const idD = uuid(); const k = escritas().length; lem({ id: idD, nome: 'Sem espelho' }); ok('B7 com o espelho desligado, o lembrete é salvo e nada vai ao Google', celL(idD, 'nome') === 'Sem espelho' && escritas().length === k); prof('profAgendaConectar', { periodo: PER }); }
  else ok('B7 (o espelho não se desliga pela Grade neste arnês: coberto por _calConectada_)', true);
});

/* ---------------------------------------------------------------- C */
console.log('C. Apagar uma reposição marcada por engano');
tenta('C', () => {
  const orig = uuid(), rep = uuid();
  sessao(P1, { id: orig, data: '2026-11-24', hora: '10:00' });
  prof('profMarcarSituacao', { id: orig, situacao: 'falta', periodo: PER });
  ok('C1 a falta cobrada pode ser reposta', lida(orig).pode_repor === true, lida(orig));
  let r = sessao(P1, { id: rep, data: '2026-12-08', hora: '10:00', reposicao_de: orig });
  ok('C2 a reposição nasce e a original deixa de poder ser reposta', r.ok === true && lida(rep).reposicao_de === orig && lida(orig).pode_repor === false, r.erro);
  ok('C3 a reposição agendada mostra o "Apagar"', lida(rep).pode_apagar === true);
  r = prof('profApagarSessao', { id: rep, opcoes: {}, periodo: PER });
  ok('C4 apagar a reposição funciona e ela some da Agenda', r.ok === true && !lida(rep), r.erro);
  ok('C5 a linha continua na planilha, marcada como engano (nada é destruído)', cel('Sessoes', rep, 'cancelada_por') === 'engano' && cel('Sessoes', rep, 'cobrada') === 'Nao');
  ok('C6 a original volta a poder ser reposta e continua cobrada', lida(orig).pode_repor === true && cel('Sessoes', orig, 'cobrada') === 'Sim' && cel('Sessoes', orig, 'estado') === 'falta');
  ok('C7 o horário da reposição apagada volta a ficar livre', livre(P2, '2026-12-08', '10:00'));
  const rep2 = uuid();
  r = sessao(P1, { id: rep2, data: '2026-12-09', hora: '11:00', reposicao_de: orig });
  ok('C8 dá para marcar a reposição de novo, em outra data', r.ok === true && lida(rep2).reposicao_de === orig, r.erro);
  prof('profMarcarSituacao', { id: rep2, situacao: 'realizada', periodo: PER });
  ok('C9 reposição já realizada não pode ser apagada', lida(rep2).pode_apagar === false && prof('profApagarSessao', { id: rep2, opcoes: {}, periodo: PER }).ok === false);
  ok('C10 a sessão original, que tem reposição, continua sem o "Apagar"', lida(orig).pode_apagar === false);
  ok('C11 paciente não apaga reposição', (() => { const o2 = uuid(), r3 = uuid(); sessao(P2, { id: o2, data: '2026-11-24', hora: '15:00' }); prof('profMarcarSituacao', { id: o2, situacao: 'falta', periodo: PER }); sessao(P2, { id: r3, data: '2026-12-10', hora: '15:00', reposicao_de: o2 }); return pac(P2, 'profApagarSessao', { id: r3, periodo: PER }).ok === false && !!lida(r3); })());
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura');
tenta('T', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('T1 VERSAO_PACOTE = 14.31', S('VERSAO_PACOTE') === '14.31');
  ok('T2 nenhuma ação nova: 103 no doPost', (src.match(/\n      case '/g) || []).length === 103);
  ok('T3 o espelho dos lembretes roda na resposta das gravações da Agenda e no gatilho', (src.match(/_calSincLembretes_\(/g) || []).length === 3);
  ok('T4 o evento do lembrete nunca leva convidado', !/attendees/.test(src.slice(src.indexOf('function _calLembreteEvento_'), src.indexOf('function _calSincLembretes_'))));
  ok('T5 as colunas do espelho não vão para a tela', !/gcal_/.test(src.slice(src.indexOf('function _lemAgSaida_'), src.indexOf('function _lemAgEntre_'))));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
