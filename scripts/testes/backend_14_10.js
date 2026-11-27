/* Pacote 14.10 — E-mails aos pacientes pela conta do Google que o profissional conectou (decisões do usuário, 23/11/2026).
   Blocos: A quem não conectou (só WhatsApp) · B conectou e permitiu · C as caixas da tela do Google (só agenda, só e-mail, nenhuma) ·
   D permissão caída · E dono do script · M a mensagem que vai ao Gmail · T listas.
   Código.js real sobre planilhas simuladas, relógio fixo em 25/11/2026 14:00, Google de mentira (permissão, token, Calendar e Gmail).
   Uso: node scripts/testes/backend_14_10.js */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { decodificar, fetchComGmail } = require('./_gmail_de_mentira.js');
const GMAIL = [];

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
av("AGENDAR_ULTIMO_PADRAO = '24s'"); // 14.20: esta suíte pede horários a semanas de distância; o padrão de quem nunca escolheu é uma semana
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
const G = { chamadas: [], contas: {}, seq: 0, revogados: [], caidos: [], scriptToken: 0, gmailFora: false, calAntes: 0 };
const conta = nome => (G.contas[nome] = G.contas[nome] || { agendas: [], eventos: {}, ocupado: [] });
let DONO = 'dono@exemplo.test';
global.Session = { getEffectiveUser: () => ({ getEmail: () => DONO }) };
global.ScriptApp.getOAuthToken = () => { G.scriptToken++; return 'tok'; };
const resp = (codigo, dados) => ({ getResponseCode: () => codigo, getContentText: () => JSON.stringify(dados === undefined ? {} : dados) });
const fetchCalendar = (url, o) => {
  const u0 = String(url), metodo = String((o && o.method) || 'get').toLowerCase();
  if (u0 === 'https://oauth2.googleapis.com/token') {
    const p = o.payload || {};
    G.chamadas.push({ metodo, u: '/token', tipo: p.grant_type, segredo: p.client_secret, cliente: p.client_id, redirect: p.redirect_uri });
    if (p.grant_type === 'authorization_code') {
      const m = /^cod:([^:]+):([aeo]*)$/.exec(String(p.code));
      if (!m) return resp(400, { error: 'invalid_grant' });
      return resp(200, { access_token: 'at-' + m[1] + '-' + (++G.seq), refresh_token: 'rt-' + m[1] + '-' + G.seq, expires_in: 3600,
        scope: 'openid https://www.googleapis.com/auth/userinfo.email' + (m[2].indexOf('a') !== -1 ? ' https://www.googleapis.com/auth/calendar.app.created' : '') + (m[2].indexOf('e') !== -1 ? ' https://www.googleapis.com/auth/gmail.send' : '') + (m[2].indexOf('o') !== -1 ? ' https://www.googleapis.com/auth/calendar.freebusy' : ''),
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
    if (metodo === 'get' && !m[2]) return resp(200, { items: Object.keys(evs).map(k => ({ id: k, status: evs[k].status })) }); // 14.11: a lista dos eventos (evento apagado volta)
    const id = decodeURIComponent(m[2] || '');
    if (!evs[id]) return resp(404, {});
    if (metodo === 'delete') { delete evs[id]; return resp(204, null); }
    if (metodo === 'patch') { Object.assign(evs[id], corpo); return resp(200, evs[id]); }
  }
  return resp(400, {});
};
global.UrlFetchApp = { fetch: fetchComGmail(GMAIL, fetchCalendar, { recusar: () => G.gmailFora }) };
const eventosDe = nome => [].concat.apply([], Object.keys(conta(nome).eventos).map(k => Object.values(conta(nome).eventos[k])));
const doCalendar = () => G.chamadas.filter(c => c.u !== '/token' && c.u !== '/revoke');

const h = av('({ post: post, cracha: cracha, novoPaciente: novoPaciente, celula: celula, linhaDe: linhaDe, cab: cab, abaPac: abaPac, ctrl: ctrl, EMAILS: EMAILS, memo: _memoZerar_, aceite: _gravarAceitePolitica_, hashProf: hashProf, PROPS: PROPS })');
const S = nome => av(nome);
av('CONFIRMAR_ABRE_PADRAO = 100000'); // 14.26.1: esta suíte confirma a presença com muita antecedência (regra de antes); a janela de 48 horas é provada em backend_14_26_1.js
av('MSG_PADRAO.lembrete.horas = 24'); // 14.30: esta suíte foi escrita com o segundo lembrete 24 horas antes; o padrão passou a 36 (provado em backend_14_30.js)
av('AGE_EMAIL_AUTOMATICO = true'); // 14.13: esta suíte confere o conteúdo dos e-mails pelo caminho de antes (envio na própria gravação); em produção a chave é false
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
const VOLTA = 'https://viniciusmarinaccipsi-art.github.io/clinica-vmc/conectar.html'; // 14.8.1: a página do site, não mais o /exec
const volta = par => { h.memo(); return h.post(Object.assign({ acao: 'concluirConexaoAgenda' }, par)); }; // sem crachá: quem protege é o state
const estadoDa = url => decodeURIComponent((/[?&]state=([^&]+)/.exec(url) || [])[1] || '');
const par = url => { const o = {}; String(url).split('?')[1].split('&').forEach(kv => { const i = kv.indexOf('='); o[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); }); return o; };
const livres = (sigla, de) => pac(sigla, 'lerHorariosLivres', { de: de }).livres.map(x => x.data + ' ' + x.hora);

const P1 = novo('Paula Primeira', 'p1@exemplo.test');
const P2 = novo('Pedro Segundo', 'p2@exemplo.test');
grade({ avisos_sessao: 'Sim' });
h.PROPS.GOOGLE_OAUTH_CLIENT_ID = 'cliente-1.apps.exemplo';
h.PROPS.GOOGLE_OAUTH_CLIENT_SECRET = 'SEGREDO-DE-TESTE';
const FRASE = 'Para enviar e-mails aos seus pacientes, conecte a sua conta do Google na Agenda.';
const CONTA = 'paula.consultorio@gmail.test';
const zera = () => { h.EMAILS.length = 0; GMAIL.length = 0; };
const lista = () => prof('profListarPacientes');
const aSessao = (sigla, d) => sessao(sigla, Object.assign({ avisos: ['confirmacao', 'lembrete', 'cancelamento'] }, d || {}));
const conectar = como => { const r = prof('profAgendaConectar', { periodo: PER }); return volta({ state: par(r.url).state, code: 'cod:' + CONTA + ':' + como }); };
const linksDe = sigla => S('_abaTokens_')().getDataRange().getValues().filter(l => l.indexOf(sigla) !== -1).length;

/* ---------------------------------------------------------------- A */
console.log('A. Quem não conectou a conta não manda e-mail aos pacientes (só WhatsApp)');
tenta('A', () => {
  const e = externa();
  ok('A1 a tela sabe: e-mails aos pacientes não permitidos (na Agenda e na lista do login)', e.email === false && e.email_conta === '' && e.ligada === false && lista().email_pacientes === false, e);
  zera();
  let r = aSessao(P1, { id: uuid(), data: '2026-12-03', hora: '10:00' });
  ok('A2 marcar sessão com a caixa de confirmação: a sessão nasce, o aviso diz "sem_conexao" e nenhum e-mail sai (nem pela conta do dono do script)', r.ok === true && r.aviso === 'sem_conexao' && h.EMAILS.length === 0 && GMAIL.length === 0, [r.aviso, h.EMAILS.length]);
  const antes = linksDe(P1);
  r = prof('profEnviarConvite', { siglaPaciente: P1, canal: 'email' });
  ok('A3 convite por e-mail: recusado com a frase única; nenhum link fica', r.ok === false && r.codigo === 'sem_conexao' && r.erro === FRASE && linksDe(P1) === antes && h.EMAILS.length === 0, r);
  r = prof('profEnviarConvite', { siglaPaciente: P1, canal: 'whatsapp' });
  ok('A4 convite pelo WhatsApp continua: devolve o link e o telefone, sem e-mail', r.ok === true && /^https:/.test(r.link) && r.enviado === false && h.EMAILS.length === 0, r);
  const idL = uuid();
  r = prof('profLembrarAgora', { siglaPaciente: P1, dados: { id: idL, tipo: 'auto' } });
  ok('A5 "Lembrar agora": o item é gravado, o e-mail não sai e o motivo é "sem_conexao"', r.ok === true && r.email_enviado === false && r.motivo === 'sem_conexao' && h.EMAILS.length === 0 && GMAIL.length === 0, [r.email_enviado, r.motivo]);
  const antesR = linksDe(P1);
  CACHE.clear();
  r = h.post({ acao: 'pedirRedefinicao', tipo: 'paciente', email: 'p1@exemplo.test' });
  ok('A6 senha esquecida pelo paciente: a resposta é a de sempre, mas nenhum e-mail sai e nenhum link fica', r.ok === true && h.EMAILS.length === 0 && GMAIL.length === 0 && linksDe(P1) === antesR, r);
  CACHE.clear();
  r = h.post({ acao: 'pedirRedefinicao', tipo: 'profissional', email: 'np@exemplo.test' });
  ok('A7 senha esquecida pela própria profissional: sai pela conta do sistema, com o nome "COGNIATIVO"', h.EMAILS.length === 1 && h.EMAILS[0].to === 'np@exemplo.test' && h.EMAILS[0].name === 'COGNIATIVO' && GMAIL.length === 0, h.EMAILS.map(x => x.to + ' · ' + x.name));
  zera();
  irPara(2026, 12, 2, 14, 0);
  const g = gatilho();
  ok('A8 gatilho: o lembrete de sessão e o do plano contam como "sem_conexao", nada sai e nenhuma marca é gravada', g.sessoes.sem_conexao >= 1 && g.sessoes.enviados === 0 && g.sessoes.falhas === 0 && g.sem_conexao >= 0 && g.enviados === 0 && h.EMAILS.length === 0 && GMAIL.length === 0 && aba('Sessoes').getDataRange().getDisplayValues().every(l => l.join('|').indexOf('2026-12-02 14:00') === -1), g);
  r = pac(P2, 'pacienteAgendarSessao', { dados: { id: uuid(), data: '2026-12-11', hora: '10:00' } });
  ok('A9 o aviso à profissional (paciente pediu sessão) também não sai da conta do dono do script', r.ok === true && h.EMAILS.length === 0 && GMAIL.length === 0, h.EMAILS.map(x => x.to));
  ok('A10 os dois e-mails do sistema à profissional (fim de dia e véspera) seguem fechados para ela', S('_stpDisponivel_')('PROF_NP') === false);
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- B */
console.log('B. Conectou e permitiu: tudo o que vai aos pacientes sai da conta dela');
let idB;
tenta('B', () => {
  let pg = conectar('ae');
  const e = externa();
  ok('B1 a volta do Google conecta; a tela mostra a agenda conectada e os e-mails saindo da conta dela', pg.ok === true && pg.resultado === 'conectada' && e.conectada === true && e.email === true && e.email_conta === CONTA && e.conta === CONTA && e.ligada === true && lista().email_pacientes === true, e);
  ok('B2 a resposta e a leitura não levam a permissão guardada', JSON.stringify(pg).indexOf('rt-') === -1 && JSON.stringify(prof('profLerAgenda', PER)).indexOf('rt-') === -1 && JSON.stringify(lista()).indexOf('rt-') === -1);
  zera();
  idB = uuid();
  let r = aSessao(P1, { id: idB, data: '2026-12-04', hora: '10:00' });
  const m = GMAIL[0] || {};
  ok('B3 confirmação da sessão: um e-mail, pelo Gmail da conta conectada, nenhum pelo sistema', r.ok === true && r.aviso === '' && GMAIL.length === 1 && h.EMAILS.length === 0 && /^at-paula\.consultorio@gmail\.test-/.test(m.bearer), [r.aviso, GMAIL.length, h.EMAILS.length]);
  ok('B4 quem envia: o nome do cadastro e o endereço da conta conectada; para o paciente certo, com o assunto de sempre', m.name === 'Dra. Nova de Prova' && m.de === CONTA && m.to === 'p1@exemplo.test' && m.subject === 'Sessão agendada — COGNIATIVO', [m.name, m.de, m.to, m.subject]);
  ok('B5 o conteúdo é o mesmo e-mail: texto, HTML com o botão, logo embutido e o evento em anexo (.ics)', m.body.indexOf('sexta, 04/12/2026, às 10:00 (Presencial)') !== -1 && m.htmlBody.indexOf('Confirmar presença') !== -1 && m.htmlBody.indexOf('cid:logo') !== -1 && m.logo === true && m.anexos.length === 1 && m.anexos[0].nome === 'sessao.ics' && m.anexos[0].tipo === 'text/calendar' && m.anexos[0].texto.indexOf('BEGIN:VCALENDAR') === 0, [m.logo, m.anexos && m.anexos.map(a => a.nome)]);
  ok('B6 a mensagem só tem os cabeçalhos necessários (sem cópia oculta, sem "responder para") e nenhuma linha passa de 76 caracteres no corpo', JSON.stringify(m.cabecalhos) === JSON.stringify(['From', 'To', 'Subject', 'MIME-Version', 'Content-Type']) && !m.linhaLonga, m.cabecalhos);
  zera();
  r = prof('profEnviarConvite', { siglaPaciente: P1, canal: 'email' });
  ok('B7 convite de acesso do paciente: sai da conta dela', r.ok === true && r.enviado === true && GMAIL.length === 1 && GMAIL[0].de === CONTA && GMAIL[0].to === 'p1@exemplo.test' && h.EMAILS.length === 0, r);
  zera(); CACHE.clear();
  r = h.post({ acao: 'pedirRedefinicao', tipo: 'paciente', email: 'p1@exemplo.test' });
  ok('B8 senha esquecida pelo paciente: o link sai da conta dela', GMAIL.length === 1 && GMAIL[0].de === CONTA && GMAIL[0].name === 'Dra. Nova de Prova' && /definir=|token=|\?/.test(GMAIL[0].body) && h.EMAILS.length === 0, GMAIL.map(x => x.subject));
  zera();
  r = prof('profLembrarAgora', { siglaPaciente: P1, dados: { id: uuid(), tipo: 'auto' } });
  ok('B9 "Lembrar agora": o e-mail sai da conta dela', r.email_enviado === true && r.motivo === '' && GMAIL.length === 1 && GMAIL[0].de === CONTA && h.EMAILS.length === 0, [r.motivo, GMAIL.length]);
  zera();
  r = pac(P2, 'pacienteAgendarSessao', { dados: { id: uuid(), data: '2026-12-14', hora: '10:00' } });
  ok('B10 aviso à profissional (paciente pediu sessão): sai da conta dela para o e-mail do cadastro dela', r.ok === true && GMAIL.length === 1 && GMAIL[0].de === CONTA && GMAIL[0].to === 'np@exemplo.test' && GMAIL[0].subject === 'Agenda — movimento de paciente' && h.EMAILS.length === 0, GMAIL.map(x => x.to + ' · ' + x.subject));
  zera();
  irPara(2026, 12, 3, 14, 0);
  const g = gatilho();
  ok('B11 gatilho: o lembrete da sessão de amanhã sai da conta dela e a marca fica gravada', g.sessoes.enviados >= 1 && g.sessoes.sem_conexao === 0 && GMAIL.some(x => x.to === 'p1@exemplo.test' && x.subject === 'Lembrete de sessão — COGNIATIVO' && x.de === CONTA) && h.EMAILS.length === 0 && cel('Sessoes', idB, 'ultimo_aviso_em') === '2026-12-03 14:00', g.sessoes);
  ok('B12 os dois e-mails do sistema à profissional passam a existir para ela', S('_stpDisponivel_')('PROF_NP') === true);
  zera();
  G.gmailFora = true;
  r = prof('profAvisarSessao', { id: idB, dados: { tipo: 'confirmacao' } });
  G.gmailFora = false;
  ok('B13 o Gmail recusou o envio: a tela recebe "falha", nada sai por outro caminho e o erro vai para o log sem endereço nem conteúdo', r.enviado === false && r.motivo === 'falha' && GMAIL.length === 0 && h.EMAILS.length === 0 && logServidor.some(l => /e-mail pela conta conectada: o Google respondeu 403/.test(l)) && logServidor.every(l => l.indexOf('p1@exemplo.test') === -1), [r, logServidor.slice(-2)]);
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- C */
console.log('C. A tela do Google tem caixas: a profissional escolhe o que permite');
tenta('C', () => {
  prof('profAgendaDesconectar', { periodo: PER });
  let e = externa();
  ok('C1 desconectar retira tudo: agenda e e-mails', e.conectada === false && e.email === false && e.ligada === false && h.PROPS['gcal:PROF_NP'] === undefined && lista().email_pacientes === false, e);
  let pg = conectar('a');
  e = externa();
  zera();
  let r = aSessao(P1, { id: uuid(), data: '2026-12-07', hora: '10:00' });
  ok('C2 permitiu só a agenda: agenda conectada, e-mails não permitidos, e a confirmação não sai', pg.resultado === 'conectada' && e.conectada === true && e.email === false && e.email_conta === '' && r.aviso === 'sem_conexao' && GMAIL.length === 0 && h.EMAILS.length === 0, [e, r.aviso]);
  r = prof('profAgendaConectar', { periodo: PER });
  ok('C3 "Permitir e-mails" é o mesmo pedido: a tela do Google pede de novo, com o envio', r.ok === true && par(r.url).scope.indexOf('https://www.googleapis.com/auth/gmail.send') !== -1 && par(r.url).include_granted_scopes === 'true', r.url);
  pg = volta({ state: par(r.url).state, code: 'cod:' + CONTA + ':ae' });
  ok('C4 depois de permitir, os e-mails passam a sair e a agenda continua conectada', pg.resultado === 'conectada' && externa().email === true && externa().conectada === true);
  prof('profAgendaDesconectar', { periodo: PER });
  G.calAntes = doCalendar().filter(c => /\/calendars/.test(c.u)).length;
  pg = conectar('e');
  e = externa();
  zera();
  r = aSessao(P1, { id: uuid(), data: '2026-12-08', hora: '10:00' });
  ok('C5 permitiu só os e-mails: os e-mails saem da conta dela, a agenda do Google fica desligada e nada vai ao Calendar', pg.resultado === 'conectada' && e.conectada === false && e.email === true && e.email_conta === CONTA && e.ligada === true && cfg().google_calendar === 'Nao' && r.aviso === '' && GMAIL.length === 1 && doCalendar().filter(c => /\/calendars/.test(c.u)).length === G.calAntes, [e, r.aviso, GMAIL.length]);
  prof('profAgendaDesconectar', { periodo: PER });
  const revAntes = G.revogados.length;
  pg = conectar('');
  ok('C6 não marcou nenhuma das duas: "negada", nada é guardado e a permissão recebida é devolvida ao Google', pg.ok === false && pg.resultado === 'negada' && h.PROPS['gcal:PROF_NP'] === undefined && G.revogados.length === revAntes + 1 && externa().email === false, pg);
});

/* ---------------------------------------------------------------- D */
console.log('D. A permissão caiu no Google');
tenta('D', () => {
  conectar('ae');
  const rt = JSON.parse(h.PROPS['gcal:PROF_NP']).rt;
  G.caidos.push(rt); CACHE.clear();
  zera();
  const r = aSessao(P1, { id: uuid(), data: '2026-12-09', hora: '10:00' });
  const e = externa();
  ok('D1 a profissional retirou a permissão lá no Google: o e-mail não sai, nada vai pela conta do dono e a tela passa a mostrar a conta como desconectada, com o aviso', r.ok === true && r.aviso !== '' && GMAIL.length === 0 && h.EMAILS.length === 0 && e.email === false && e.conectada === false && e.aviso === 'caiu' && h.PROPS['gcal:PROF_NP'] === undefined, [r.aviso, e]);
});

/* ---------------------------------------------------------------- E */
console.log('E. O dono do script não precisa conectar');
tenta('E', () => {
  DONO = 'np@exemplo.test';
  const e = externa();
  ok('E1 para o dono, os e-mails aos pacientes já saem da conta dele', e.email === true && e.email_conta === 'np@exemplo.test' && e.ligada === false && lista().email_pacientes === true, e);
  zera();
  const r = aSessao(P1, { id: uuid(), data: '2026-12-10', hora: '10:00' });
  ok('E2 a confirmação sai pelo próprio script (como antes), agora com o nome do cadastro em vez de "COGNIATIVO"', r.aviso === '' && h.EMAILS.length === 1 && h.EMAILS[0].to === 'p1@exemplo.test' && h.EMAILS[0].name === 'Dra. Nova de Prova' && GMAIL.length === 0, h.EMAILS.map(x => x.name));
  zera(); CACHE.clear();
  h.post({ acao: 'pedirRedefinicao', tipo: 'profissional', email: 'np@exemplo.test' });
  ok('E3 o que é do sistema (senha da própria profissional) segue com o nome "COGNIATIVO"', h.EMAILS.length === 1 && h.EMAILS[0].name === 'COGNIATIVO');
  DONO = 'dono@exemplo.test';
});

/* ---------------------------------------------------------------- M */
console.log('M. A mensagem que vai ao Gmail');
tenta('M', () => {
  const de = { modo: 'gmail', nome: 'José "Zé" Ação\r\nBcc: x@y.test', conta: CONTA };
  const cru = S('_mimeMontar_')(de, 'p1@exemplo.test\r\nBcc: fora@exemplo.test', { assunto: 'Olá — ação\r\nBcc: z@y.test', texto: 'Olá, coração.', html: '<p>Olá, coração.</p>' });
  const lido = decodificar(Buffer.from(cru, 'utf8').toString('base64'));
  ok('M1 quebra de linha em nome, destinatário ou assunto não cria cabeçalho (nenhum "Bcc" entra)', lido.cabecalhos.indexOf('Bcc') === -1 && JSON.stringify(lido.cabecalhos) === JSON.stringify(['From', 'To', 'Subject', 'MIME-Version', 'Content-Type']), lido.cabecalhos);
  ok('M2 acentos chegam inteiros no nome, no assunto, no texto e no HTML', lido.name.indexOf('Ação') !== -1 && lido.subject.indexOf('Olá — ação') === 0 && lido.body === 'Olá, coração.' && lido.htmlBody === '<p>Olá, coração.</p>', [lido.name, lido.subject]);
  ok('M3 sem anexo, a mensagem não leva parte de anexo; o cabeçalho é só ASCII', lido.anexos.length === 0 && /^[\x00-\x7F]*$/.test(cru.split('\r\n\r\n')[0]));
  ok('M4 sem profissional (e-mail do sistema), _enviarEmail_ continua pelo script com o nome "COGNIATIVO"', (() => { zera(); const foi = S('_enviarEmail_')('x@exemplo.test', { assunto: 'a', texto: 'b', html: 'c' }); return foi === true && h.EMAILS.length === 1 && h.EMAILS[0].name === 'COGNIATIVO' && GMAIL.length === 0; })());
  ok('M5 com profissional sem permissão, _enviarEmail_ devolve falso e nada sai', (() => { zera(); h.memo(); const foi = S('_enviarEmail_')('x@exemplo.test', { assunto: 'a', texto: 'b', html: 'c' }, 'PROF_NP'); return foi === false && h.EMAILS.length === 0 && GMAIL.length === 0; })());
});

/* ---------------------------------------------------------------- T */
console.log('T. Listas e versão');
tenta('T', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('T1 VERSAO_PACOTE do 14.10 em diante (o número exato é conferido em backend_16_11.js)', /^(14\.\d{2}|[12]\d\.)/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE'));
  ok('T2 MailApp só em três lugares: _enviarEmail_ e os dois alertas ao dono (backup e monitor)', (src.match(/MailApp\.sendEmail\(/g) || []).length === 3);
  ok('T3 o Gmail só é chamado em _gmailEnviar_, e só para enviar', (src.match(/gmail\.googleapis\.com/g) || []).length === 1 && src.indexOf('gmail/v1/users/me/messages/send') !== -1);
  ok('T4 a permissão pedida ao Google não inclui ler nem apagar e-mails', src.indexOf('gmail.readonly') === -1 && src.indexOf('gmail.modify') === -1 && src.indexOf('mail.google.com') === -1 && src.indexOf('gmail.compose') === -1);
  ok('T5 todo e-mail a paciente passa o profissional a _enviarEmail_ (convite, senha, lembretes, sessão, cobrança)', ['_assinaturaDoProfissional_(s.profissional_id)), s.profissional_id)', "t === 'paciente' ? ativas[j].profissional_id : undefined)", '_lembreteDestino_(item)), alvo.profissionalId)', '_lembreteDestino_(item)), prof.profissional_id)', '_enviarEmail_(pac.email, email, profId)', '_assinaturaDoProfissional_(alvo.profissionalId)), alvo.profissionalId)'].every(t => src.indexOf(t) !== -1));
  ok('T6 nenhuma ação nova no servidor (a conexão e o envio usam as que já existiam)', (src.match(/\n      case '/g) || []).length === 103, (src.match(/\n      case '/g) || []).length);
  ok('T7 o servidor não registrou erro fora dos provocados (Gmail recusando e permissão caída)', logServidor.every(l => /e-mail pela conta conectada|agenda externa/.test(l)), logServidor);
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
