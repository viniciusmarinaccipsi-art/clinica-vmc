/* Pacote 14.8 — Agenda: cada profissional conecta a própria conta do Google (decisões do usuário, 23/11/2026).
   Blocos: A sem a chave do botão · B conectar (ida ao Google e volta pelo doGet) · C espelho na conta conectada ·
   D opção dos compromissos pessoais · E desconectar e conexão caída · F dono do script · G segredos · T listas.
   Código.js real sobre planilhas simuladas, relógio fixo em 25/11/2026 14:00, Google de mentira (permissão, token, Calendar).
   Uso: node scripts/testes/backend_14_8.js */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARNES = path.join(__dirname, 'backend_18_10a.js');
const MARCA = "console.log('C. controle_id');";
const Real = Date;
let AGORA = new Real(2026, 10, 25, 14, 0, 0).getTime();
class DataFixa extends Real {
  constructor(...a) { if (a.length) super(...a); else super(AGORA); }
  static now() { return AGORA; }
}
const irPara = (ano, mes, dia, hh, mm) => { AGORA = new Real(ano, mes - 1, dia, hh || 0, mm || 0, 0).getTime(); };
const fonte = fs.readFileSync(ARNES, 'utf8');
const fim = fonte.indexOf(MARCA);
if (fim === -1) { console.log('RESULTADO: FALHA — não achei o fim do arnês'); process.exit(1); }
const av = new Function('require', '__dirname', 'Date', fonte.slice(0, fim) + '\nreturn function (__src) { return eval(__src); };')(require, __dirname, DataFixa);
const logServidor = [];
console.error = (...a) => { logServidor.push(a.map(String).join(' ')); };
const CACHE = new Map();
const cacheObj = { get: k => (CACHE.has(k) ? CACHE.get(k) : null), getAll: ks => { const r = {}; (ks || []).forEach(k => { if (CACHE.has(k)) r[k] = CACHE.get(k); }); return r; },
  put: (k, v) => { CACHE.set(k, String(v)); }, putAll: o => { Object.keys(o || {}).forEach(k => CACHE.set(k, String(o[k]))); }, remove: k => { CACHE.delete(k); }, removeAll: ks => { (ks || []).forEach(k => CACHE.delete(k)); } };
global.CacheService = { getScriptCache: () => cacheObj };
global.Utilities.base64Decode = s => Array.from(Buffer.from(String(s), 'base64')).map(x => (x > 127 ? x - 256 : x));
global.HtmlService = { createHtmlOutput: html => ({ html: html, titulo: '', setTitle(t) { this.titulo = t; return this; } }) };

// ---------- Google de mentira: permissão (OAuth), token e Calendar, uma "conta" por token ----------
const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const G = { chamadas: [], contas: {}, seq: 0, revogados: [], caidos: [], scriptToken: 0 };
const conta = nome => (G.contas[nome] = G.contas[nome] || { agendas: [], eventos: {}, ocupado: [] });
let DONO = 'dono@exemplo.test';
global.Session = { getEffectiveUser: () => ({ getEmail: () => DONO }) };
global.ScriptApp.getOAuthToken = () => { G.scriptToken++; return 'tok'; };
const resp = (codigo, dados) => ({ getResponseCode: () => codigo, getContentText: () => JSON.stringify(dados === undefined ? {} : dados) });
global.UrlFetchApp = { fetch: (url, o) => {
  const u0 = String(url), metodo = String((o && o.method) || 'get').toLowerCase();
  if (u0 === 'https://oauth2.googleapis.com/token') {
    const p = o.payload || {};
    G.chamadas.push({ metodo, u: '/token', tipo: p.grant_type, segredo: p.client_secret, cliente: p.client_id, redirect: p.redirect_uri });
    if (p.grant_type === 'authorization_code') {
      const m = /^cod:([^:]+):(occ|base)$/.exec(String(p.code));
      if (!m) return resp(400, { error: 'invalid_grant' });
      return resp(200, { access_token: 'at-' + m[1] + '-' + (++G.seq), refresh_token: 'rt-' + m[1] + '-' + G.seq, expires_in: 3600,
        scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.app.created' + (m[2] === 'occ' ? ' https://www.googleapis.com/auth/calendar.freebusy' : ''),
        id_token: 'cab.' + b64u({ email: m[1], sub: '1' }) + '.assin' });
    }
    if (p.grant_type === 'refresh_token') {
      if (G.revogados.indexOf(p.refresh_token) !== -1 || G.caidos.indexOf(p.refresh_token) !== -1) return resp(400, { error: 'invalid_grant' });
      const m2 = /^rt-(.+)-\d+$/.exec(String(p.refresh_token));
      return m2 ? resp(200, { access_token: 'at-' + m2[1] + '-' + (++G.seq), expires_in: 3600 }) : resp(400, { error: 'invalid_grant' });
    }
    return resp(400, { error: 'unsupported_grant_type' });
  }
  if (u0 === 'https://oauth2.googleapis.com/revoke') { G.chamadas.push({ metodo, u: '/revoke' }); G.revogados.push(o.payload.token); return resp(200, {}); }
  const u = u0.replace('https://www.googleapis.com/calendar/v3', '');
  const bearer = String((o && o.headers && o.headers.Authorization) || '').replace(/^Bearer /, '');
  const mt = /^at-(.+)-\d+$/.exec(bearer);
  const quem = bearer === 'tok' ? 'SCRIPT' : (mt ? mt[1] : '');
  const corpo = o && o.payload ? JSON.parse(o.payload) : null;
  G.chamadas.push({ metodo, u, corpo, quem });
  if (!quem) return resp(401, { error: { status: 'UNAUTHENTICATED' } });
  const c = conta(quem);
  if (metodo === 'get' && u.indexOf('/users/me/calendarList') === 0) return quem === 'SCRIPT' ? resp(200, { items: c.agendas }) : resp(403, { error: { status: 'PERMISSION_DENIED' } });
  if (metodo === 'post' && u === '/calendars') { const a = { id: 'cal' + (++G.seq), summary: corpo.summary }; c.agendas.push(a); c.eventos[a.id] = {}; return resp(200, a); }
  if (metodo === 'post' && u === '/freeBusy') return resp(200, { calendars: { primary: { busy: c.ocupado } } });
  const m = u.match(/^\/calendars\/([^/]+)\/events(?:\/([^?]+))?/);
  if (m) {
    const evs = c.eventos[decodeURIComponent(m[1])];
    if (!evs) return resp(404, {});
    if (metodo === 'post') { const id = 'ev' + (++G.seq); const ev = Object.assign({}, corpo, { id }); if (corpo.conferenceData && corpo.conferenceData.createRequest) ev.hangoutLink = 'https://meet.google.com/sala-' + G.seq; evs[id] = ev; return resp(200, ev); }
    const id = decodeURIComponent(m[2] || '');
    if (!evs[id]) return resp(404, {});
    if (metodo === 'delete') { delete evs[id]; return resp(204, null); }
    if (metodo === 'patch') { Object.assign(evs[id], corpo); return resp(200, evs[id]); }
  }
  return resp(400, {});
} };
const eventosDe = nome => [].concat.apply([], Object.keys(conta(nome).eventos).map(k => Object.values(conta(nome).eventos[k])));
const doCalendar = () => G.chamadas.filter(c => c.u !== '/token' && c.u !== '/revoke');

const h = av('({ post: post, cracha: cracha, novoPaciente: novoPaciente, celula: celula, linhaDe: linhaDe, cab: cab, abaPac: abaPac, ctrl: ctrl, EMAILS: EMAILS, memo: _memoZerar_, aceite: _gravarAceitePolitica_, hashProf: hashProf, PROPS: PROPS })');
const S = nome => av(nome);
let falhas = 0, passo = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 700) : '')); } };
const tenta = (n, f) => { try { f(); } catch (e) { ok(n + ' (exceção)', false, String(e && e.stack || e).slice(0, 700)); } };
const uuid = () => crypto.randomUUID();
const tokProf = () => h.cracha('profissional', 'NP', 'PROF_NP', h.hashProf);
const tokPac = sigla => h.cracha('paciente', sigla, 'PROF_NP', h.celula(h.abaPac, h.linhaDe(h.abaPac, 'sigla', sigla), 'senha_hash'));
const prof = (acao, extra) => { h.memo(); return h.post(Object.assign({ acao: acao, token: tokProf() }, extra || {})); };
const pac = (sigla, acao, extra) => { h.memo(); return h.post(Object.assign({ acao: acao, token: tokPac(sigla) }, extra || {})); };
const novo = (nome, email) => { const s = h.novoPaciente(nome, email); h.memo(); h.aceite(s, 'PROF_NP'); h.memo(); return s; };
const aba = nome => h.ctrl.getSheetByName(nome);
const cel = (nomeAba, id, col) => h.celula(aba(nomeAba), h.linhaDe(aba(nomeAba), 'id', id), col);
const PER = { de: '2026-11-20', ate: '2026-12-31' };
const sessao = (sigla, d) => prof('profSalvarSessao', { periodo: PER, dados: Object.assign({ id: uuid(), sigla: sigla, data: '2026-12-02', hora: '10:00', duracao_min: 60, modalidade: 'presencial', valor: '', notas: '', avisos: [] }, d || {}) });
const GRADE = [1, 2, 3, 4, 5].map(d => ({ dia_semana: d, hora_inicio: '08:00', hora_fim: '18:00', modalidade: 'ambas', ativo: 'sim' }));
const grade = cfg => prof('profSalvarGrade', { config: Object.assign({ duracao_slot_min: 60, antecedencia_min_horas: 24 }, cfg || {}), grade: GRADE });
const cfg = () => prof('profLerGrade').config;
const externa = () => prof('profLerAgenda', PER).agenda_externa;
const gatilho = () => { h.memo(); return S('enviarLembretes_')(); };
const volta = par => { h.memo(); return S('doGet')({ parameter: par }); };
const estadoDa = url => decodeURIComponent((/[?&]state=([^&]+)/.exec(url) || [])[1] || '');
const par = url => { const o = {}; String(url).split('?')[1].split('&').forEach(kv => { const i = kv.indexOf('='); o[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); }); return o; };
const livres = (sigla, de) => pac(sigla, 'lerHorariosLivres', { de: de }).livres.map(x => x.data + ' ' + x.hora);

const P1 = novo('Paula Primeira', 'p1@exemplo.test');
grade({ avisos_sessao: 'Nao' });
const idAntes = uuid();
sessao(P1, { id: idAntes, data: '2026-12-01', hora: '09:00' });

/* ---------------------------------------------------------------- A */
console.log('A. Sem a chave do botão "Conectar"');
tenta('A', () => {
  let r = prof('profAgendaConectar', { periodo: PER });
  ok('A1 conectar sem a chave configurada: recusado com a frase, nada vai ao Google', r.ok === false && r.codigo === 'indisponivel' && r.erro === 'A conexão com o Google ainda não está disponível.' && G.chamadas.length === 0, r);
  const e = externa();
  ok('A2 a tela recebe: Google, não disponível, não conectada, sem conta, opção desligada', e.servico === 'google' && e.direta === false && e.disponivel === false && e.conectada === false && e.conta === '' && e.ocupado === false && e.aviso === '', e);
  ok('A3 a leitura da Grade não traz mais a chave do espelho (saiu para o quadro da Agenda)', prof('profLerGrade').calendar_disponivel === undefined);
  grade({ avisos_sessao: 'Nao', google_calendar: 'Sim' });
  ok('A4 e a Grade não liga mais o espelho', cfg().google_calendar === undefined && G.chamadas.length === 0, cfg());
  r = prof('profAgendaOpcao', { dados: { ocupado: true }, periodo: PER });
  ok('A5 a opção dos compromissos pessoais sem conta conectada: "Conecte a sua agenda primeiro."', r.ok === false && r.erro === 'Conecte a sua agenda primeiro.', r);
});

/* ---------------------------------------------------------------- B */
console.log('B. Conectar: ida ao Google e volta');
h.PROPS.GOOGLE_OAUTH_CLIENT_ID = 'cliente-1.apps.exemplo';
h.PROPS.GOOGLE_OAUTH_CLIENT_SECRET = 'SEGREDO-DE-TESTE';
let urlBase;
tenta('B', () => {
  ok('B1 com a chave configurada, a tela vê a conexão como disponível', externa().disponivel === true && externa().conectada === false);
  let r = prof('profAgendaConectar', { periodo: PER });
  urlBase = r.url;
  const q = par(r.url);
  ok('B2 conectar devolve o endereço da tela de permissão do Google, sem gravar nada', r.ok === true && r.conectada === false && r.url.indexOf('https://accounts.google.com/o/oauth2/v2/auth?') === 0 && cfg().google_calendar === undefined && h.PROPS['gcal:PROF_NP'] === undefined, r);
  ok('B3 o pedido leva o cliente, a volta para o próprio servidor, acesso duradouro e a tela de permissão sempre', q.client_id === 'cliente-1.apps.exemplo' && q.redirect_uri === 'https://script.local/exec' && q.response_type === 'code' && q.access_type === 'offline' && q.prompt === 'consent', q);
  ok('B4 a permissão pedida é a menor: só as agendas que o sistema criar (sem ver a agenda pessoal, sem horários ocupados)', q.scope === 'openid email https://www.googleapis.com/auth/calendar.app.created', q.scope);
  ok('B5 o segredo da chave nunca vai no endereço', r.url.indexOf('SEGREDO') === -1 && JSON.stringify(r).indexOf('SEGREDO') === -1);
  ok('B6 o estado é assinado: diz de qual profissional é o pedido e vence', !!S('_gcalLerEstado_')(q.state, AGORA) && S('_gcalLerEstado_')(q.state, AGORA).profId === 'PROF_NP' && S('_gcalLerEstado_')(q.state, AGORA + 21 * 60000) === null && S('_gcalLerEstado_')(q.state.replace(/.$/, c => (c === 'a' ? 'b' : 'a')), AGORA) === null && S('_gcalLerEstado_')('', AGORA) === null);

  let pg = volta({ state: q.state, error: 'access_denied' });
  ok('B7 o profissional não permitiu: a página diz que a conexão não foi concluída e nada é guardado', pg.html.indexOf('data-resultado="negada"') !== -1 && pg.html.indexOf('não foi concluída') !== -1 && h.PROPS['gcal:PROF_NP'] === undefined && cfg().google_calendar === undefined && G.chamadas.length === 0, pg.html.slice(0, 200));
  pg = volta({ state: q.state + 'x', code: 'cod:paula@gmail.test:base' });
  ok('B8 estado adulterado: "erro", o código nem é trocado', pg.html.indexOf('data-resultado="erro"') !== -1 && G.chamadas.length === 0 && h.PROPS['gcal:PROF_NP'] === undefined);
  pg = volta({ state: q.state, code: 'codigo-invalido' });
  ok('B9 código que o Google recusa: "erro", nada guardado', pg.html.indexOf('data-resultado="erro"') !== -1 && h.PROPS['gcal:PROF_NP'] === undefined && cfg().google_calendar === undefined);
  const troca = G.chamadas.filter(c => c.u === '/token')[0];
  ok('B10 a troca do código vai com o segredo e a mesma volta (só entre servidores)', troca && troca.tipo === 'authorization_code' && troca.segredo === 'SEGREDO-DE-TESTE' && troca.cliente === 'cliente-1.apps.exemplo' && troca.redirect === 'https://script.local/exec', troca);

  G.chamadas.length = 0;
  pg = volta({ state: q.state, code: 'cod:paula@gmail.test:base' });
  ok('B11 permitiu: a página só diz "Agenda conectada. Você já pode fechar esta aba e voltar ao COGNIATIVO." (nenhum dado, nenhum link, nenhum script)', pg.html.indexOf('Agenda conectada. Você já pode fechar esta aba e voltar ao COGNIATIVO.') !== -1 && pg.html.indexOf('data-resultado="conectada"') !== -1 && pg.html.indexOf('<script') === -1 && pg.html.indexOf('href=') === -1 && pg.html.indexOf('rt-') === -1 && pg.html.indexOf('paula@') === -1 && pg.titulo === 'COGNIATIVO', pg.html.slice(0, 300));
  const guardado = JSON.parse(h.PROPS['gcal:PROF_NP'] || '{}');
  ok('B12 a permissão fica no cofre do script (com a conta e o que foi permitido), não em planilha', /^rt-paula@gmail\.test-\d+$/.test(guardado.rt) && guardado.conta === 'paula@gmail.test' && guardado.escopos.indexOf('calendar.app.created') !== -1 && JSON.stringify(aba('Config_Agenda').getDataRange().getDisplayValues()).indexOf('rt-') === -1, Object.keys(guardado));
  const c = cfg();
  ok('B13 a Config_Agenda liga o espelho e guarda só o e-mail da conta; a opção dos compromissos nasce desligada', c.google_calendar === 'Sim' && c.agenda_conta === 'paula@gmail.test' && c.agenda_ocupado === 'Nao', c);
  const e = externa();
  ok('B14 a tela recebe "Conectada: paula@gmail.test"', e.conectada === true && e.conta === 'paula@gmail.test' && e.ocupado === false && e.disponivel === true, e);
  ok('B15 a sessão que já existia entra na fila do espelho, e nada foi ao Calendar ainda', cel('Sessoes', idAntes, 'gcal_sinc') === 'pendente' && doCalendar().length === 0);
  ok('B16 nenhuma resposta ao navegador leva a permissão', JSON.stringify(prof('profLerAgenda', PER)).indexOf('rt-') === -1 && JSON.stringify(prof('profLerGrade')).indexOf('rt-') === -1 && JSON.stringify(prof('profLerAgenda', PER)).indexOf('at-') === -1);
  h.memo();
  const semEstado = S('doGet')({ parameter: {} }), semNada = S('doGet')();
  ok('B17 o doGet sem a volta do Google continua respondendo "Use POST"', JSON.parse(semEstado.conteudo).erro === 'Use POST' && JSON.parse(semNada.conteudo).erro === 'Use POST');
  irPara(2026, 11, 25, 14, 30);
  pg = volta({ state: q.state, code: 'cod:outra@gmail.test:base' });
  ok('B18 pedido vencido (30 minutos depois): "erro", a conta conectada não muda', pg.html.indexOf('data-resultado="erro"') !== -1 && cfg().agenda_conta === 'paula@gmail.test');
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- C */
console.log('C. Espelho na conta conectada');
let idOn;
tenta('C', () => {
  G.chamadas.length = 0;
  gatilho();
  let evs = eventosDe('paula@gmail.test');
  ok('C1 o gatilho cria a agenda "Cogniativo: Agenda Consultório" NA CONTA DELA e espelha a sessão que já existia', conta('paula@gmail.test').agendas.length === 1 && conta('paula@gmail.test').agendas[0].summary === 'Cogniativo: Agenda Consultório' && evs.length === 1 && cel('Sessoes', idAntes, 'gcal_evento') !== '' && cel('Sessoes', idAntes, 'gcal_sinc') === '', { agendas: conta('paula@gmail.test').agendas, n: evs.length });
  ok('C2 sem listar as agendas dela (a permissão não deixa ver a agenda pessoal) e nada na conta do script', !G.chamadas.some(c => /calendarList/.test(c.u)) && doCalendar().every(c => c.quem === 'paula@gmail.test') && G.scriptToken === 0, doCalendar().map(c => c.quem + ' ' + c.metodo + ' ' + c.u));
  idOn = uuid();
  const n = doCalendar().length;
  let r = sessao(P1, { id: idOn, data: '2026-12-03', hora: '11:00', modalidade: 'online' });
  ok('C3 sessão on-line nova: vai na hora para a agenda dela, com a sala do Meet', r.ok === true && doCalendar().length === n + 1 && /^https:\/\/meet/.test(cel('Sessoes', idOn, 'meet_link')) && eventosDe('paula@gmail.test').length === 2, r.erro);
  CACHE.clear();
  const antesRen = G.chamadas.filter(c => c.tipo === 'refresh_token').length;
  r = prof('profSalvarSessao', { periodo: PER, dados: { id: idOn, sigla: P1, data: '2026-12-04', hora: '11:00', duracao_min: 60, modalidade: 'online', valor: '', notas: '', avisos: [] } });
  ok('C4 acesso vencido: o servidor renova com a permissão guardada e muda o evento', r.ok === true && G.chamadas.filter(c => c.tipo === 'refresh_token').length === antesRen + 1 && eventosDe('paula@gmail.test').some(e => e.start.dateTime.indexOf('2026-12-04T11:00') === 0), r.erro);
  r = prof('profCancelarSessao', { id: idOn, opcoes: { quem: 'profissional', avisar: false }, periodo: PER });
  ok('C5 cancelar apaga o evento da agenda dela', r.ok === true && eventosDe('paula@gmail.test').length === 1);

  // outra conta: os eventos nascem de novo na agenda nova
  const idEv = cel('Sessoes', idAntes, 'gcal_evento'), q2 = par(prof('profAgendaConectar', { periodo: PER }).url);
  volta({ state: q2.state, code: 'cod:consultorio@gmail.test:base' });
  ok('C6 conectou outra conta: a agenda do espelho é esquecida e a sessão futura volta para a fila', cfg().agenda_conta === 'consultorio@gmail.test' && cfg().gcal_id === '' && cel('Sessoes', idAntes, 'gcal_evento') === '' && cel('Sessoes', idAntes, 'gcal_sinc') === 'pendente', cfg());
  gatilho();
  ok('C7 e nasce na conta nova (o evento antigo fica na conta antiga)', eventosDe('consultorio@gmail.test').length === 1 && cel('Sessoes', idAntes, 'gcal_evento') !== '' && cel('Sessoes', idAntes, 'gcal_evento') !== idEv && eventosDe('paula@gmail.test').length === 1);
});

/* ---------------------------------------------------------------- D */
console.log('D. Opção: compromissos pessoais fecham horários');
tenta('D', () => {
  conta('consultorio@gmail.test').ocupado = [{ start: '2026-12-16T13:00:00Z', end: '2026-12-16T14:30:00Z' }, { start: '2026-12-18T02:00:00Z', end: '2026-12-18T04:00:00Z' }]; // qua 16/12 10:00–11:30 · qui 17/12 23:00 a sex 18/12 01:00
  G.chamadas.length = 0;
  let L = livres(P1, '2026-12-16');
  let ag = prof('profLerAgenda', PER);
  ok('D1 opção desligada (padrão): o Google não é consultado, o horário continua livre e a Agenda não mostra ocupados', L.indexOf('2026-12-16 10:00') !== -1 && ag.ocupados.length === 0 && !G.chamadas.some(c => c.u === '/freeBusy'));
  let r = prof('profAgendaOpcao', { dados: { ocupado: true }, periodo: PER });
  const q = r.url ? par(r.url) : {};
  ok('D2 ligar sem ter dado essa permissão: devolve a tela do Google pedindo também "ver quando estou ocupado"; a opção ainda não liga', r.ok === true && r.precisa_permissao === true && q.scope === 'openid email https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.freebusy' && cfg().agenda_ocupado === 'Nao', r);
  volta({ state: q.state, code: 'cod:consultorio@gmail.test:occ' });
  ok('D3 na volta, a opção fica ligada e a conta é a mesma (a agenda do espelho não é refeita)', cfg().agenda_ocupado === 'Sim' && cfg().agenda_conta === 'consultorio@gmail.test' && cfg().gcal_id !== '' && externa().ocupado === true, cfg());
  CACHE.clear(); G.chamadas.length = 0;
  L = livres(P1, '2026-12-16');
  ok('D4 ligada: o paciente não vê os horários que batem com o compromisso (10:00 e 11:00) e vê os vizinhos', L.indexOf('2026-12-16 09:00') !== -1 && L.indexOf('2026-12-16 10:00') === -1 && L.indexOf('2026-12-16 11:00') === -1 && L.indexOf('2026-12-16 12:00') !== -1, L.filter(x => x.indexOf('2026-12-16') === 0));
  ok('D5 a consulta ao Google usa a conta conectada e pede só ocupado/livre', G.chamadas.filter(c => c.u === '/freeBusy').length === 1 && G.chamadas.filter(c => c.u === '/freeBusy')[0].quem === 'consultorio@gmail.test');
  ag = prof('profLerAgenda', PER);
  const o16 = ag.ocupados.filter(x => x.data === '2026-12-16'), o17 = ag.ocupados.filter(x => x.data === '2026-12-17'), o18 = ag.ocupados.filter(x => x.data === '2026-12-18');
  ok('D6 a Agenda recebe os blocos "ocupado" só com dia e hora (nenhum título)', o16.length === 1 && o16[0].hora_inicio === '10:00' && o16[0].hora_fim === '11:30' && Object.keys(o16[0]).sort().join(',') === 'data,hora_fim,hora_inicio', ag.ocupados);
  ok('D7 compromisso que atravessa a meia-noite vira um bloco em cada dia', o17.length === 1 && o17[0].hora_inicio === '23:00' && o17[0].hora_fim === '23:59' && o18.length === 1 && o18[0].hora_inicio === '00:00' && o18[0].hora_fim === '01:00', [o17, o18]);
  r = sessao(P1, { data: '2026-12-16', hora: '10:00' });
  ok('D8 o bloco avisa, não trava: o profissional ainda marca uma sessão ali', r.ok === true, r.erro);
  r = prof('profAgendaOpcao', { dados: { ocupado: false }, periodo: PER });
  ok('D9 desligar a opção: os blocos somem da resposta e o horário volta a ser só do COGNIATIVO', r.ok === true && cfg().agenda_ocupado === 'Nao' && r.agenda.ocupados.length === 0 && r.agenda.agenda_externa.ocupado === false && livres(P1, '2026-12-16').indexOf('2026-12-16 11:00') !== -1);
  r = prof('profAgendaOpcao', { dados: { ocupado: true }, periodo: PER });
  ok('D10 ligar de novo, com a permissão já dada: liga na hora, sem voltar ao Google', r.ok === true && !r.url && cfg().agenda_ocupado === 'Sim' && r.agenda.ocupados.length === 3, r.url);
});

/* ---------------------------------------------------------------- E */
console.log('E. Desconectar e conexão caída');
tenta('E', () => {
  const rt = JSON.parse(h.PROPS['gcal:PROF_NP']).rt, nEv = eventosDe('consultorio@gmail.test').length;
  G.chamadas.length = 0;
  let r = prof('profAgendaDesconectar', { periodo: PER });
  ok('E1 desconectar: a permissão é retirada no Google e apagada do cofre', r.ok === true && G.revogados.indexOf(rt) !== -1 && h.PROPS['gcal:PROF_NP'] === undefined, r.erro);
  ok('E2 o espelho e a opção desligam; a tela volta a "não conectada"', cfg().google_calendar === 'Nao' && cfg().agenda_conta === '' && cfg().agenda_ocupado === 'Nao' && r.agenda.agenda_externa.conectada === false && r.agenda.agenda_externa.conta === '' && r.agenda.ocupados.length === 0, cfg());
  ok('E3 o que já estava na agenda do Google continua lá', eventosDe('consultorio@gmail.test').length === nEv && nEv >= 1);
  const n = G.chamadas.length;
  sessao(P1, { data: '2026-12-09', hora: '15:00' });
  gatilho();
  ok('E4 desconectado: sessão nova e gatilho não falam com o Google', G.chamadas.length === n && livres(P1, '2026-12-16').indexOf('2026-12-16 11:00') !== -1);

  // conexão caída: a permissão foi retirada lá no Google
  const q = par(prof('profAgendaConectar', { periodo: PER }).url);
  volta({ state: q.state, code: 'cod:consultorio@gmail.test:base' });
  const rt2 = JSON.parse(h.PROPS['gcal:PROF_NP']).rt;
  G.caidos.push(rt2); CACHE.clear();
  r = sessao(P1, { data: '2026-12-10', hora: '15:00' });
  ok('E5 permissão retirada no Google: a consulta nasce do mesmo jeito (o espelho nunca trava a agenda)', r.ok === true, r.erro);
  ok('E6 o servidor esquece a permissão, desliga o espelho e deixa o aviso para a tela', h.PROPS['gcal:PROF_NP'] === undefined && cfg().google_calendar === 'Nao' && externa().conectada === false && externa().aviso === 'caiu', externa());
  const q3 = par(prof('profAgendaConectar', { periodo: PER }).url);
  volta({ state: q3.state, code: 'cod:consultorio@gmail.test:base' });
  ok('E7 conectar de novo limpa o aviso', externa().conectada === true && externa().aviso === '');
  const rt3 = JSON.parse(h.PROPS['gcal:PROF_NP']).rt;
  h.memo(); S('_gcalDesligar_')('PROF_NP');
  const fonteJs = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('E8 profissional desativado pelo administrador: a permissão é retirada e apagada', G.revogados.indexOf(rt3) !== -1 && h.PROPS['gcal:PROF_NP'] === undefined && /function desativarProfissional\(s, profissionalId\) \{\s+var r = _alterarStatusProfissional\(s, profissionalId, 'nao'\);\s+if \(r && r\.ok\) _gcalDesligar_\(profissionalId\);/.test(fonteJs));
  prof('profAgendaDesconectar', { periodo: PER });
});

/* ---------------------------------------------------------------- F */
console.log('F. O dono do script');
tenta('F', () => {
  DONO = 'np@exemplo.test';
  delete h.PROPS.GOOGLE_OAUTH_CLIENT_ID; delete h.PROPS.GOOGLE_OAUTH_CLIENT_SECRET;
  ok('F1 para o dono a conexão está disponível mesmo sem a chave do botão, e é direta (sem ir ao Google)', externa().disponivel === true && externa().direta === true && externa().conectada === false);
  G.chamadas.length = 0;
  let r = prof('profAgendaConectar', { periodo: PER });
  ok('F2 conectar liga na hora, sem ir ao Google, e a tela mostra a conta do sistema', r.ok === true && r.conectada === true && !r.url && r.agenda.agenda_externa.conectada === true && r.agenda.agenda_externa.conta === 'np@exemplo.test' && G.chamadas.length === 0, r);
  gatilho();
  ok('F3 o espelho usa o token do próprio script e acha a agenda pelo nome', doCalendar().length > 0 && doCalendar().every(c => c.quem === 'SCRIPT') && G.chamadas.some(c => /calendarList/.test(c.u)) && eventosDe('SCRIPT').length >= 1);
  conta('SCRIPT').ocupado = [{ start: '2026-12-16T13:00:00Z', end: '2026-12-16T14:00:00Z' }];
  CACHE.clear();
  ok('F4 também para o dono os compromissos pessoais só entram com a opção ligada (antes era automático)', livres(P1, '2026-12-22').length > 0 && !G.chamadas.some(c => c.u === '/freeBusy') && externa().ocupado === false);
  r = prof('profAgendaOpcao', { dados: { ocupado: true }, periodo: PER });
  ok('F5 o dono liga a opção direto (a permissão dele já cobre)', r.ok === true && !r.url && r.agenda.agenda_externa.ocupado === true && r.agenda.ocupados.some(x => x.data === '2026-12-16' && x.hora_inicio === '10:00'));
  r = prof('profAgendaDesconectar', { periodo: PER });
  ok('F6 desconectar, para o dono, só desliga o espelho (não há permissão guardada para retirar)', r.ok === true && cfg().google_calendar === 'Nao' && !G.chamadas.some(c => c.u === '/revoke') && r.agenda.agenda_externa.conectada === false);
  DONO = 'dono@exemplo.test';
});

/* ---------------------------------------------------------------- G */
console.log('G. Segredos e crachá');
tenta('G', () => {
  const fonteJs = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('G1 o código não traz chave nem segredo: só os nomes das duas propriedades do script', fonteJs.indexOf('SEGREDO-DE-TESTE') === -1 && (fonteJs.match(/GOCSPX-/g) || []).length === 0 && fonteJs.indexOf("var GCAL_PROP_SEGREDO = 'GOOGLE_OAUTH_CLIENT_SECRET';") !== -1 && (fonteJs.match(/\.apps\.googleusercontent\.com/g) || []).length === 0);
  ok('G2 o token do script continua pedido num lugar só', fonteJs.indexOf('getOAuthToken()') === fonteJs.lastIndexOf('getOAuthToken()'));
  ok('G3 nada do que é segredo foi para o log do servidor', logServidor.join(' ').indexOf('rt-') === -1 && logServidor.join(' ').indexOf('at-') === -1 && logServidor.join(' ').indexOf('SEGREDO') === -1, logServidor.slice(0, 4));
  ok('G4 crachá de paciente não conecta, não desconecta nem muda a opção; sem crachá, recusado', pac(P1, 'profAgendaConectar', { periodo: PER }).ok === false && pac(P1, 'profAgendaDesconectar', { periodo: PER }).ok === false && pac(P1, 'profAgendaOpcao', { dados: { ocupado: true } }).ok === false && h.post({ acao: 'profAgendaConectar' }).ok === false);
  ok('G5 o paciente nunca recebe a conta nem o estado da agenda externa', JSON.stringify(pac(P1, 'lerMinhasSessoes')).indexOf('agenda_externa') === -1 && JSON.stringify(pac(P1, 'lerHorariosLivres', { de: '2026-12-16' })).indexOf('gmail') === -1);
});

/* ---------------------------------------------------------------- T */
console.log('T. Listas e versão');
tenta('T', () => {
  const novas = ['profAgendaConectar', 'profAgendaDesconectar', 'profAgendaOpcao'];
  ok('T1 as três ações novas estão na trava, exigem crachá e não são leitura', novas.every(a => S('ACOES_COM_TRAVA').indexOf(a) !== -1 && S('ACOES_PUBLICAS').indexOf(a) === -1 && S('ACOES_SO_LEITURA').indexOf(a) === -1));
  ok('T2 VERSAO_PACOTE = 14.8', S('VERSAO_PACOTE') === '14.8');
  ok('T3 nenhuma coluna nova nas abas da agenda (a conexão mora na Config_Agenda e no cofre do script)', S('COLUNAS_SESSOES').slice(-3).join(',') === 'gcal_evento,gcal_sinc,meet_link' && S('COLUNAS_PEDIDOS_AGENDA').slice(-2).join(',') === 'sugestao,modalidade');
  const esperados = logServidor.filter(l => /agenda externa: o Google nao devolveu a permissao \(400\)/.test(l)).length;
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l) && !/agenda externa: o Google nao devolveu a permissao \(400\)/.test(l));
  ok('T4 o servidor só registrou a recusa provocada do Google (B9)', esperados === 1 && inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
