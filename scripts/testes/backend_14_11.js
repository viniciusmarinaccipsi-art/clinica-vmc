/* Pacote 14.11 — Agenda: a confirmação do paciente aparece no evento do Google Calendar do profissional e o evento
   apagado direto no Google volta sozinho (decisões do usuário, 24/11/2026). O COGNIATIVO é a fonte; o Google só recebe.
   Testes em Node do Código.js REAL sobre as planilhas simuladas do arnês de backend_18_10a.js; relógio fixo e um
   Google Calendar de mentira que guarda agendas e eventos, com lixeira (evento apagado fica "cancelled").
   Blocos: A a confirmação no evento · B evento apagado volta · C o que NÃO acontece · T estrutura e versão.
   Uso: node scripts/testes/backend_14_11.js */
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

/* ---------------------------------------------------------------- A */
console.log('A. A confirmação do paciente aparece no evento do Google');
const idA1 = uuid(), idA2 = uuid(), idOn = uuid();
tenta('A', () => {
  sessao(P1, { id: idA1, data: '2026-12-02', hora: '10:00' });
  sessao(P2, { id: idA2, data: '2026-12-03', hora: '11:00' });
  sessao(P1, { id: idOn, data: '2026-12-04', hora: '09:00', modalidade: 'online' });
  gatilho(quando(2026, 11, 25, 14, 5));
  const e1 = () => evento(cel('Sessoes', idA1, 'gcal_evento')), e2 = () => evento(cel('Sessoes', idA2, 'gcal_evento'));
  ok('A1 sessão ainda não confirmada: a descrição do evento é só "Criado pelo COGNIATIVO."', e1().description === 'Criado pelo COGNIATIVO.' && e2().description === 'Criado pelo COGNIATIVO.', e1().description);
  let n = G.chamadas.length;
  const r = pub({ t: tokenDe(idA1) });
  ok('A2 confirmar pelo link não fala com o Google na hora (o toque do paciente não espera) e deixa a sessão na fila', r.ok === true && G.chamadas.length === n && cel('Sessoes', idA1, 'gcal_sinc') === 'pendente' && cel('Sessoes', idA1, 'confirmada_em') !== '', r);
  const evAntes = cel('Sessoes', idA1, 'gcal_evento');
  let g = gatilho(quando(2026, 11, 25, 14, 10));
  ok('A3 na rodada seguinte a descrição do evento passa a dizer a frase aprovada, no MESMO evento', e1().description === FRASE && cel('Sessoes', idA1, 'gcal_evento') === evAntes && cel('Sessoes', idA1, 'gcal_sinc') === '' && g.calendar === 1, { d: e1().description, g: g });
  ok('A4 a outra sessão, não confirmada, continua sem a frase', e2().description === 'Criado pelo COGNIATIVO.');
  n = G.chamadas.length;
  pub({ t: tokenDe(idA1) });
  ok('A5 tocar de novo no link (já confirmada) não põe a sessão na fila outra vez', cel('Sessoes', idA1, 'gcal_sinc') === '' && G.chamadas.length === n);
  const r2 = pac(P2, 'pacienteConfirmarSessao', { id: idA2 });
  ok('A6 confirmar pela tela "Minhas sessões" também põe a sessão na fila', r2.ok !== false && cel('Sessoes', idA2, 'gcal_sinc') === 'pendente', r2.erro);
  gatilho(quando(2026, 11, 25, 14, 15));
  ok('A7 e a frase chega ao evento na rodada seguinte', e2().description === FRASE && cel('Sessoes', idA2, 'gcal_sinc') === '');
  const meet = cel('Sessoes', idOn, 'meet_link');
  pac(P1, 'pacienteConfirmarSessao', { id: idOn });
  gatilho(quando(2026, 11, 25, 14, 20));
  const eOn = evento(cel('Sessoes', idOn, 'gcal_evento'));
  ok('A8 sessão on-line confirmada: a frase entra e a sala do Meet continua a mesma', eOn.description === FRASE && /^https:\/\/meet/.test(meet) && eOn.hangoutLink === meet && cel('Sessoes', idOn, 'meet_link') === meet, { d: eOn.description, meet: meet, h: eOn.hangoutLink });
  sessao(P1, { id: idA1, data: '2026-12-02', hora: '15:00' });
  ok('A9 remarcada, a confirmação zera (regra do 14.5.4) e a frase sai do evento até o paciente confirmar de novo', cel('Sessoes', idA1, 'confirmada_em') === '' && e1().description === 'Criado pelo COGNIATIVO.' && e1().start.dateTime === '2026-12-02T15:00:00', { c: cel('Sessoes', idA1, 'confirmada_em'), d: e1().description });
  const E = S('_calEvento_'), cfg = { duracao_slot_min: 60 }, base = { id: 'x', sigla: P1, data: '2026-12-02', hora_inicio: '10:00', duracao_min: '60', modalidade: 'presencial' };
  ok('A10 reposição confirmada: "Criado pelo COGNIATIVO. Reposição. Presença confirmada pelo paciente."', E(Object.assign({ reposicao_de: 'f1', confirmada_em: '2026-11-25 14:00' }, base), null, cfg).description === 'Criado pelo COGNIATIVO. Reposição. Presença confirmada pelo paciente.' && E(Object.assign({ reposicao_de: 'f1' }, base), null, cfg).description === 'Criado pelo COGNIATIVO. Reposição.');
});

/* ---------------------------------------------------------------- B */
console.log('B. Evento apagado direto no Google volta sozinho');
tenta('B', () => {
  gatilho(quando(2026, 11, 25, 14, 25));
  let n = escritas().length;
  let g = gatilho(quando(2026, 11, 25, 14, 30));
  ok('B1 com tudo no lugar, a rodada só lê a lista dos eventos: nada é escrito no Google nem na fila', escritas().length === n && g.recolocados === 0 && g.calendar === 0, g);
  const ev2 = cel('Sessoes', idA2, 'gcal_evento');
  apagarNoGoogle(ev2);
  h.EMAILS.length = 0;
  const antes = JSON.stringify(estadoDe(idA2));
  g = gatilho(quando(2026, 11, 25, 14, 35));
  ok('B2 evento apagado no Google: a rodada seguinte o recoloca (o mesmo evento volta, com a frase da confirmação)', g.recolocados === 1 && g.calendar === 1 && evento(ev2).status === 'confirmed' && evento(ev2).description === FRASE && cel('Sessoes', idA2, 'gcal_evento') === ev2 && cel('Sessoes', idA2, 'gcal_sinc') === '', { g: g, ev: evento(ev2) });
  ok('B3 apagar no Google não cancela a sessão, não mexe na confirmação nem na cobrança e não avisa o paciente', JSON.stringify(estadoDe(idA2)) === antes && estadoDe(idA2).estado === 'agendada' && h.EMAILS.length === 0 && lida(idA2).estado === 'agendada', { e: estadoDe(idA2), emails: h.EMAILS.length });
  G.revive = false; // o Google não deixa o evento apagado voltar: nasce outro
  apagarNoGoogle(ev2);
  g = gatilho(quando(2026, 11, 25, 14, 40));
  const ev2b = cel('Sessoes', idA2, 'gcal_evento');
  ok('B4 se o evento apagado não volta, nasce outro evento para a mesma sessão', g.recolocados === 1 && ev2b !== ev2 && evento(ev2b) && evento(ev2b).description === FRASE && evento(ev2b).start.dateTime === '2026-12-03T11:00:00' && cel('Sessoes', idA2, 'gcal_sinc') === '', { g: g, ev2b: ev2b });
  G.revive = true;
  const evOn = cel('Sessoes', idOn, 'gcal_evento'), meet = cel('Sessoes', idOn, 'meet_link');
  sumirDoGoogle(evOn); // saiu até da lixeira
  g = gatilho(quando(2026, 11, 25, 14, 45));
  const evOnB = cel('Sessoes', idOn, 'gcal_evento'), eOn = evento(evOnB);
  ok('B5 sessão on-line recolocada: o link que o paciente já recebeu continua o mesmo e o evento novo não pede sala nova', g.recolocados === 1 && evOnB !== evOn && cel('Sessoes', idOn, 'meet_link') === meet && lida(idOn).meet_link === meet && eOn.location === meet && !eOn.conferenceData && !eOn.hangoutLink, { g: g, eOn: eOn, meet: meet });
  n = vivosNoGoogle().length;
  g = gatilho(quando(2026, 11, 25, 14, 50));
  ok('B6 recolocado, a rodada seguinte não cria evento em dobro', g.recolocados === 0 && g.calendar === 0 && vivosNoGoogle().length === n && n === 3, { g: g, n: n });
  G.paginar = true;
  apagarNoGoogle(cel('Sessoes', idA1, 'gcal_evento'));
  g = gatilho(quando(2026, 11, 25, 14, 55));
  ok('B7 lista do Google em mais de uma página: só o que sumiu volta', g.recolocados === 1 && g.calendar === 1 && vivosNoGoogle().length === 3, g);
  G.paginar = false;
  const velha = calId();
  delete G.eventos[velha]; G.agendas = G.agendas.filter(a => a.id !== velha); // a agenda inteira foi apagada no Google
  g = gatilho(quando(2026, 11, 25, 15, 0));
  const g2 = gatilho(quando(2026, 11, 25, 15, 5));
  ok('B8 agenda inteira apagada: o sistema cria outra e recoloca as três sessões futuras', g.recolocados === 3 && calId() !== velha && vivosNoGoogle().length === 3 && [idA1, idA2, idOn].every(i => cel('Sessoes', i, 'gcal_sinc') === '' && evento(cel('Sessoes', i, 'gcal_evento'))) && cel('Sessoes', idOn, 'meet_link') === meet, { g: g, g2: g2, v: G.eventos[calId()] && vivosNoGoogle().length });
});

/* ---------------------------------------------------------------- C */
console.log('C. O que não acontece');
tenta('C', () => {
  const idCanc = uuid(), idReal = uuid();
  sessao(P2, { id: idCanc, data: '2026-12-07', hora: '10:00' });
  sessao(P2, { id: idReal, data: '2026-12-08', hora: '10:00' });
  gatilho(quando(2026, 11, 25, 15, 10));
  prof('profCancelarSessao', { id: idCanc, escopo: 'esta', por: 'profissional', periodo: PER });
  gatilho(quando(2026, 11, 25, 15, 15));
  let n = vivosNoGoogle().length;
  let g = gatilho(quando(2026, 11, 25, 15, 20));
  ok('C1 sessão cancelada no COGNIATIVO não volta para o Google', cel('Sessoes', idCanc, 'estado') === 'cancelada' && cel('Sessoes', idCanc, 'gcal_evento') === '' && g.recolocados === 0 && vivosNoGoogle().length === n, { g: g, ev: cel('Sessoes', idCanc, 'gcal_evento') });
  const evReal = cel('Sessoes', idReal, 'gcal_evento');
  agoraMs = new Real(2026, 11, 8, 12, 0, 0).getTime(); // 08/12/2026, 12:00: a sessão das 10:00 já passou
  apagarNoGoogle(evReal);
  n = escritas().length;
  g = gatilho(quando(2026, 12, 8, 12, 0));
  ok('C2 evento de sessão que já passou, apagado no Google, não é recolocado', g.recolocados === 0 && evento(evReal).status === 'cancelled' && cel('Sessoes', idReal, 'gcal_sinc') === '', g);
  agoraMs = new Real(2026, 10, 25, 15, 30, 0).getTime();
  evento(evReal).status = 'confirmed';
  G.listaFalha = true;
  apagarNoGoogle(evReal);
  n = escritas().length;
  g = gatilho(quando(2026, 11, 25, 15, 30));
  ok('C3 se o Google não responde a lista, ninguém mexe em nada (nenhuma sessão vai para a fila)', g.recolocados === 0 && escritas().length === n && cel('Sessoes', idReal, 'gcal_sinc') === '', g);
  G.listaFalha = false;
  g = gatilho(quando(2026, 11, 25, 15, 35));
  ok('C4 e, quando o Google volta a responder, o evento é recolocado', g.recolocados === 1 && evento(evReal).status === 'confirmed', g);
  apagarNoGoogle(evReal);
  prof('profAgendaDesconectar', { periodo: PER });
  n = G.chamadas.length;
  g = gatilho(quando(2026, 11, 25, 15, 40));
  ok('C5 com o espelho desligado, a rodada não fala com o Google', g.recolocados === 0 && G.chamadas.length === n, { g: g, novas: G.chamadas.slice(n).map(c => c.metodo + ' ' + c.u) });
  ok('C6 um evento que o profissional mudou de horário direto no Google não é desfeito (o sistema só recoloca o apagado)', (() => {
    prof('profAgendaConectar', { periodo: PER });
    gatilho(quando(2026, 11, 25, 15, 45));
    const ev = evento(cel('Sessoes', idA2, 'gcal_evento'));
    ev.start.dateTime = '2026-12-03T16:00:00';
    const k = escritas().length;
    const gg = gatilho(quando(2026, 11, 25, 15, 50));
    return gg.recolocados === 0 && escritas().length === k && ev.start.dateTime === '2026-12-03T16:00:00' && cel('Sessoes', idA2, 'hora_inicio') === '11:00';
  })());
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura e versão');
tenta('T', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('T1 VERSAO_PACOTE do 14.11 em diante (o número exato é conferido em backend_16_11.js)', /^(14\.(1[1-9]|[2-9]\d)|[12]\d\.)/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE'));
  ok('T2 nenhuma ação nova e nenhuma ação pública nova', S('ACOES_PUBLICAS').join(',') === 'ping,autenticar,pedirRedefinicao,definirSenha,confirmarSessaoPorLink,concluirConexaoAgenda');
  ok('T3 a conferência do Google roda no gatilho, antes do espelho, e só lê o Google (nenhum envio, nenhum cancelamento)', /r\.recolocados \+= _calRecolocar_\(controle, prof\.profissional_id, agora\);[^\n]*\n\s*r\.calendar \+= /.test(src) && (() => { const f = src.slice(src.indexOf('function _calRecolocar_('), src.indexOf('/** Ao ligar o espelho')); return !/_enviarEmail_|_ageAvisar|estado:|cancelada/.test(f) && /_calApi_\('get'/.test(src.slice(src.indexOf('function _calEventosVivos_('), src.indexOf('function _calRecolocar_('))); })());
  ok('T4 a resposta do link público continua sem nada do Google (só dia, hora, modalidade e onde)', (() => { const r = pub({ t: tokenDe(idA2) }); return Object.keys(r).sort().join(',') === 'data,endereco,estado,hora,ja_confirmada,mapa,meet_link,modalidade,ok'; })());
  ok('T5 o token do Google nunca vai para o log', logServidor.join(' ').indexOf('tok') === -1);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T6 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
