/* Pacote 14.30 — tela "Mensagens": texto, assunto e título de cada e-mail de sessão, e a antecedência dos lembretes, por profissional.
   Blocos: A padrão · B editar e voltar ao padrão · C o e-mail sai com o texto dele · D antecedência e liga/desliga · E madrugada · T estrutura.
   Agora simulado: quarta, 25/11/2026, 14:00.
   Uso: node scripts/testes/backend_14_30.js */
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

const aoPaciente = () => h.EMAILS.filter(x => /p[12]@exemplo\.test/.test(String(x.to)));
const msgs = () => prof('profLerMensagens', {});
const msg = id => msgs().mensagens.filter(m => m.id === id)[0];
const salvar = (id, d) => prof('profSalvarMensagem', { id: id, dados: d });
const abaM = () => aba('Mensagens');
const quandoG = (a, m, d, hh, mm) => { irPara(a, m, d, hh, mm); return new Real(a, m - 1, d, hh, mm || 0, 0); };

/* ---------------------------------------------------------------- A */
console.log('A. O padrão');
tenta('A', () => {
  const r = msgs();
  ok('A1 a leitura traz os oito e-mails de sessão, na ordem, e as antecedências que dá para escolher', r.ok === true && r.mensagens.map(m => m.id).join(',') === 'confirmacao,serie,lembrete48,lembrete,cancelamento,remarcacao,pedido_aprovado,pedido_recusado' && r.horas.join(',') === '72,48,36,24,12,6,3', r.mensagens && r.mensagens.map(m => m.id));
  ok('A2 só os dois lembretes são automáticos: 48 horas e 36 horas, ligados', r.mensagens.filter(m => m.auto).map(m => m.id + ':' + m.horas + ':' + m.ligado).join(',') === 'lembrete48:48:true,lembrete:36:true');
  ok('A3 nada mudado ainda: nenhuma marca de alteração e a aba não existe', r.mensagens.every(m => m.mudou === false) && abaM() === null);
  const sA = uuid();
  sessao(P1, { id: sA, data: '2026-12-08', hora: '10:00', modalidade: 'online' });
  h.EMAILS.length = 0;
  avisar(sA);
  const e = aoPaciente()[0];
  ok('A4 sem mexer em nada, o e-mail do agendamento sai com o texto de sempre', !!e && e.subject === 'Sessão agendada — COGNIATIVO' && e.body.indexOf('Sua sessão com Dra. Nova de Prova está marcada para terça, 08/12/2026, às 10:00 (On-line).') !== -1, e && e.body.slice(0, 300));
  ok('A5 a frase antiga das horas de antecedência saiu', !!e && e.body.indexOf('horas ou mais de antecedência') === -1 && html(e).indexOf('horas ou mais de antecedência') === -1);
});

/* ---------------------------------------------------------------- B */
console.log('B. Editar e voltar ao padrão');
tenta('B', () => {
  let r = salvar('confirmacao', { assunto: '  Sua   sessão comigo ', titulo: 'Tudo certo, {paciente}', texto: 'Olá! Marcamos para {dia}. {onde} Se precisar mudar, o prazo vai até {prazo}.' });
  ok('B1 salvar grava uma linha na aba Mensagens, com os espaços arrumados', r.ok === true && abaM().getLastRow() - 1 === 1 && msg('confirmacao').assunto === 'Sua sessão comigo' && msg('confirmacao').mudou === true, r.erro);
  ok('B2 os outros e-mails continuam no padrão', msg('lembrete').mudou === false && msg('lembrete').texto === 'Lembrete da sua sessão com {profissional}: {dia}.');
  r = salvar('confirmacao', { assunto: '', titulo: 'x', texto: 'y' });
  ok('B3 assunto vazio é recusado e nada muda', r.ok === false && r.erro === 'Escreva o assunto.' && msg('confirmacao').assunto === 'Sua sessão comigo', r);
  ok('B4 título e texto vazios também', salvar('confirmacao', { assunto: 'a', titulo: '', texto: 'y' }).erro === 'Escreva o título.' && salvar('confirmacao', { assunto: 'a', titulo: 'b', texto: '   ' }).erro === 'Escreva o texto.');
  ok('B5 e-mail que não existe é recusado', salvar('inventado', { assunto: 'a', titulo: 'b', texto: 'c' }).ok === false);
  r = salvar('confirmacao', { assunto: '=SOMA(1;2)', titulo: 'T', texto: 'Texto' });
  ok('B6 texto que começa com sinal de fórmula é gravado como texto', r.ok === true && msg('confirmacao').assunto === '=SOMA(1;2)');
  r = salvar('confirmacao', { restaurar: true });
  ok('B7 "voltar ao texto padrão" apaga a linha e o e-mail volta ao padrão', r.ok === true && r.restaurada === true && abaM().getLastRow() - 1 === 0 && msg('confirmacao').mudou === false && msg('confirmacao').titulo === 'Sua sessão está agendada');
  ok('B8 paciente não lê nem grava as mensagens', pac(P1, 'profLerMensagens', {}).ok === false && pac(P1, 'profSalvarMensagem', { id: 'confirmacao', dados: { restaurar: true } }).ok === false);
});

/* ---------------------------------------------------------------- C */
console.log('C. O e-mail sai com o texto do profissional');
tenta('C', () => {
  grade({ endereco: 'Rua de Exemplo, 100 - Campinas', prazo_cancelar_horas: 24 });
  salvar('confirmacao', { assunto: 'Sessão marcada com {profissional}', titulo: 'Tudo certo, {paciente}', texto: 'Marcamos para {dia}. {onde} Para mudar, o prazo vai até {prazo}.' });
  const sC = uuid();
  sessao(P1, { id: sC, data: '2026-12-10', hora: '10:00', modalidade: 'presencial' });
  h.EMAILS.length = 0;
  avisar(sC);
  let e = aoPaciente()[0];
  ok('C1 assunto e título com os marcadores preenchidos', !!e && e.subject === 'Sessão marcada com Dra. Nova de Prova' && html(e).indexOf('Tudo certo, Paula') !== -1, e && e.subject);
  ok('C2 o texto leva o dia, o endereço onde ele pôs o marcador e o prazo por extenso', !!e && e.body.indexOf('Marcamos para quinta, 10/12/2026, às 10:00 (Presencial). Endereço: Rua de Exemplo, 100 - Campinas. Para mudar, o prazo vai até quarta, 09/12, às 10:00.') !== -1, e && e.body.slice(0, 400));
  ok('C3 os botões continuam os do sistema (o mapa e o do COGNIATIVO)', !!e && html(e).indexOf('Abrir o endereço no mapa') !== -1 && html(e).indexOf('Ver minhas sessões') !== -1);
  salvar('confirmacao', { assunto: 'A', titulo: '<b>Negrito</b>', texto: 'Texto com <script>alert(1)</script> e {inventado} marcador.' });
  h.EMAILS.length = 0;
  avisar(sC);
  e = aoPaciente()[0];
  ok('C4 o que ele escreve é escapado no e-mail, e marcador que não existe some', !!e && html(e).indexOf('<script>alert') === -1 && html(e).indexOf('&lt;b&gt;Negrito&lt;/b&gt;') !== -1 && e.body.indexOf('{inventado}') === -1, e && e.body.slice(0, 300));
  salvar('confirmacao', { restaurar: true });
  salvar('cancelamento', { assunto: 'Sessão cancelada', titulo: 'Cancelamos', texto: 'A sessão de {quando} foi cancelada, {paciente}.' });
  prof('profCancelarSessao', { id: sC, opcoes: { quem: 'profissional' }, periodo: PER });
  h.EMAILS.length = 0;
  avisar(sC, { tipo: 'cancelamento' });
  e = aoPaciente()[0];
  ok('C5 o e-mail de cancelamento também usa o texto dele', !!e && e.subject === 'Sessão cancelada' && e.body.indexOf('A sessão de 10/12/2026 às 10:00 foi cancelada, Paula.') !== -1, e && e.body.slice(0, 300));
  salvar('cancelamento', { restaurar: true });
});

/* ---------------------------------------------------------------- D */
console.log('D. Antecedência e liga/desliga dos lembretes');
tenta('D', () => {
  grade({ avisos_sessao: 'Sim' });
  const sD = uuid();
  sessao(P2, { id: sD, data: '2026-12-04', hora: '15:00' });          // sexta, 15h
  ok('D1 a sessão nasce sem marca de lembrete (falta mais de 48 h)', cel('Sessoes', sD, 'lembrete48_em') === '' && cel('Sessoes', sD, 'ultimo_aviso_em') === '');
  h.EMAILS.length = 0;
  let g = gatilho(quandoG(2026, 12, 2, 14, 55));
  ok('D2 cinco minutos antes das 48 horas, nada sai', aoPaciente().length === 0);
  g = gatilho(quandoG(2026, 12, 2, 15, 0));
  ok('D3 nas 48 horas sai o primeiro lembrete', aoPaciente().length === 1 && html(aoPaciente()[0]).indexOf('Sua sessão é em dois dias') !== -1, g);
  h.EMAILS.length = 0;
  g = gatilho(quandoG(2026, 12, 2, 19, 55));
  const antes20 = aoPaciente().length;
  g = gatilho(quandoG(2026, 12, 2, 20, 0));
  ok('D4 o segundo lembrete cairia às 3h da manhã de quinta (36 horas antes): sai às 20h de quarta, nem antes nem de madrugada', antes20 === 0 && aoPaciente().length === 1 && html(aoPaciente()[0]).indexOf('Sua sessão está chegando') !== -1, g);
  ok('D5 a regra: 36 horas antes de sexta 15h é quinta 3h, e o envio vai para quarta às 20h', S('_msgEnvia_')('2026-12-04', '15:00', 36) === '2026-12-02 20:00' && S('_msgEnvia_')('2026-12-04', '15:00', 48) === '2026-12-02 15:00');
  const sD2 = uuid();
  irPara(2026, 12, 3, 9, 0);
  sessao(P1, { id: sD2, data: '2026-12-07', hora: '09:00' });         // segunda, 9h
  h.EMAILS.length = 0;
  g = gatilho(quandoG(2026, 12, 5, 9, 0));
  ok('D6 outra sessão: primeiro lembrete nas 48 horas', aoPaciente().filter(x => x.to === 'p1@exemplo.test').length === 1);
  h.EMAILS.length = 0;
  g = gatilho(quandoG(2026, 12, 5, 21, 0));
  ok('D7 e o segundo, 36 horas antes (sábado, 21h)', aoPaciente().filter(x => x.to === 'p1@exemplo.test' && html(x).indexOf('Sua sessão está chegando') !== -1).length === 1, g);
  irPara(2026, 11, 25, 14, 0);
  let r = salvar('lembrete', { ligado: true, horas: 24, assunto: 'Lembrete', titulo: 'Amanhã tem sessão', texto: 'Sua sessão é {dia}.' });
  ok('D8 o profissional muda o segundo lembrete para 24 horas', r.ok === true && msg('lembrete').horas === 24 && prof('profLerAgenda', PER).mensagens.lembrete.horas === 24, r.erro);
  ok('D9 antecedência que não está na lista é recusada', salvar('lembrete', { horas: 5, assunto: 'a', titulo: 'b', texto: 'c' }).ok === false && msg('lembrete').horas === 24);
  const sD3 = uuid();
  sessao(P2, { id: sD3, data: '2026-12-16', hora: '16:00' });
  h.EMAILS.length = 0;
  gatilho(quandoG(2026, 12, 15, 4, 0));
  ok('D10 com 24 horas escolhidas, às 36 horas nada sai', aoPaciente().filter(x => html(x).indexOf('Amanhã tem sessão') !== -1).length === 0);
  gatilho(quandoG(2026, 12, 15, 16, 0));
  ok('D11 e às 24 horas sai, com o título dele', aoPaciente().filter(x => html(x).indexOf('Amanhã tem sessão') !== -1).length === 1);
  irPara(2026, 11, 25, 14, 0);
  r = salvar('lembrete48', { ligado: false, horas: 48, assunto: 'Lembrete de sessão — COGNIATIVO', titulo: 'Sua sessão é em dois dias', texto: 'Lembrete da sua sessão com {profissional}: {dia}.' });
  ok('D12 desligar o primeiro lembrete grava e a Agenda fica sabendo', r.ok === true && msg('lembrete48').ligado === false && prof('profLerAgenda', PER).mensagens.lembrete48.ligado === false);
  const sD4 = uuid();
  sessao(P1, { id: sD4, data: '2026-12-22', hora: '16:00' });
  h.EMAILS.length = 0;
  gatilho(quandoG(2026, 12, 20, 16, 0));
  ok('D13 desligado, o primeiro lembrete não sai', aoPaciente().length === 0);
  irPara(2026, 11, 25, 14, 0);
  salvar('lembrete48', { restaurar: true }); salvar('lembrete', { restaurar: true });
  ok('D14 e-mail que só sai com o clique não aceita ser desligado nem ter antecedência', (() => { salvar('confirmacao', { ligado: false, horas: 48, assunto: 'a', titulo: 'b', texto: 'c' }); const m = msg('confirmacao'); salvar('confirmacao', { restaurar: true }); return m.ligado === true && m.horas === 0; })());
});

/* ---------------------------------------------------------------- E */
console.log('E. Nenhum e-mail automático de madrugada');
tenta('E', () => {
  const E = S('_msgEnvia_');
  ok('E1 horário entre 7h e 21h59 fica como está', E('2026-12-10', '19:00', 48) === '2026-12-08 19:00' && E('2026-12-10', '07:00', 48) === '2026-12-08 07:00');
  ok('E2 antes das 7h: vai para as 20h da véspera', E('2026-12-10', '06:30', 48) === '2026-12-07 20:00');
  ok('E3 das 22h em diante: vai para as 20h do mesmo dia', E('2026-12-10', '22:30', 48) === '2026-12-08 20:00');
  ok('E4 sessão criada depois do horário do lembrete nasce com ele dispensado', (() => { const id = uuid(); irPara(2026, 12, 9, 8, 0); sessao(P2, { id: id, data: '2026-12-10', hora: '18:00' }); const r = cel('Sessoes', id, 'lembrete48_em') === 'dispensado' && cel('Sessoes', id, 'ultimo_aviso_em') === 'dispensado'; irPara(2026, 11, 25, 14, 0); return r; })());
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura');
tenta('T', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('T1 o segundo lembrete nasce em 36 horas', S('MSG_PADRAO').lembrete.horas === 36);
  ok('T2 duas ações novas, as duas com crachá; só a que grava está na trava', (src.match(/\n      case '/g) || []).length === 103 && S('ACOES_COM_TRAVA').indexOf('profSalvarMensagem') !== -1 && S('ACOES_COM_TRAVA').indexOf('profLerMensagens') === -1 && S('ACOES_PUBLICAS').indexOf('profLerMensagens') === -1 && S('ACOES_PUBLICAS').indexOf('profSalvarMensagem') === -1);
  ok('T3 o padrão do segundo lembrete é 36 horas e a frase antiga saiu do código', /lembrete: \{ nome: 'Segundo lembrete', auto: true, horas: 36/.test(src) && !/horas ou mais de antecedência\.'/.test(src));
  ok('T4 todo e-mail ao paciente continua levando o profissional', (src.match(/_enviarEmail_\(pac\.email, email, profId\)/g) || []).length === 1);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T5 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
