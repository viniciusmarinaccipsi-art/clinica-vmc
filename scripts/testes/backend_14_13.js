/* Pacote 14.13 — o e-mail de criar, mudar, cancelar e responder pedido só sai com o clique do profissional
   (decisão do usuário, 24 e 25/11/2026). As gravações devolvem aviso = 'clique' e não enviam nada; profAvisarSessao envia
   (sessão avulsa, remarcação, cancelamento, sessões recorrentes com a lista das datas, pedido aprovado e pedido recusado).
   Os lembretes do gatilho continuam automáticos.
   Blocos: A sessões · B pedidos · C o que continua automático e a proteção · T estrutura.
   Uso: node scripts/testes/backend_14_13.js */
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
const html = e => String(e.htmlBody || '');
const avisar = (id, dados) => prof('profAvisarSessao', { id: id, dados: dados || {} });

/* ---------------------------------------------------------------- A */
console.log('A. Criar, mudar e cancelar não enviam e-mail; o clique envia');
const id1 = uuid(), idS = uuid();
tenta('A', () => {
  h.EMAILS.length = 0;
  let r = sessao(P1, { id: id1, data: '2026-12-02', hora: '10:00' });
  ok('A1 criar uma sessão (avisos ligados, todas as caixas marcadas): nenhum e-mail sai e a resposta diz "clique"', r.ok === true && r.aviso === 'clique' && h.EMAILS.length === 0, { aviso: r.aviso, n: h.EMAILS.length });
  r = avisar(id1, { tipo: 'confirmacao' });
  ok('A2 com o clique, o e-mail "Sessão agendada" sai para o paciente, com a hora do envio', r.ok === true && r.enviado === true && /^\d\d:\d\d$/.test(r.hora) && h.EMAILS.length === 1 && h.EMAILS[0].to === 'p1@exemplo.test' && h.EMAILS[0].body.indexOf('02/12/2026') !== -1, { r: r, n: h.EMAILS.length });
  r = avisar(id1, { tipo: 'confirmacao' });
  ok('A3 clicar de novo reenvia (é o "Reenviar e-mail")', r.enviado === true && h.EMAILS.length === 2);
  h.EMAILS.length = 0;
  r = sessao(P1, { id: id1, data: '2026-12-02', hora: '15:00' });
  ok('A4 mudar a hora: nenhum e-mail sai e a resposta diz "clique"', r.ok === true && r.aviso === 'clique' && h.EMAILS.length === 0, r.aviso);
  r = avisar(id1, { tipo: 'remarcacao', anterior: { data: '2026-12-02', hora: '10:00' } });
  ok('A5 com o clique, sai o e-mail da remarcação, de 10:00 para 15:00', r.enviado === true && h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('10:00') !== -1 && h.EMAILS[0].body.indexOf('15:00') !== -1, h.EMAILS[0] && h.EMAILS[0].body.slice(0, 300));
  h.EMAILS.length = 0;
  r = sessao(P2, { id: idS, data: '2026-12-03', hora: '10:00', repeticao: { cada: 1, unidade: 'semana', dias_semana: [4], fim_tipo: 'n', fim_n: 4 } });
  ok('A6 criar quatro sessões recorrentes: nenhum e-mail sai', r.ok === true && r.criadas === 4 && r.aviso === 'clique' && h.EMAILS.length === 0, { aviso: r.aviso, n: h.EMAILS.length });
  r = avisar(idS, { tipo: 'serie' });
  const e = h.EMAILS[0] || {};
  ok('A7 com o clique, UM e-mail só para as quatro sessões (o texto de hoje: "Foram marcadas 4 sessões", a partir de 03/12)', r.enviado === true && r.tipo === 'serie' && h.EMAILS.length === 1 && e.to === 'p2@exemplo.test' && String(e.body).indexOf('Foram marcadas 4 sessões') !== -1 && String(e.body).indexOf('03/12/2026') !== -1, String(e.body).slice(0, 300));
  h.EMAILS.length = 0;
  r = prof('profCancelarSessao', { id: id1, opcoes: { quem: 'profissional', avisar: true }, periodo: PER });
  ok('A8 cancelar (mesmo com o pedido antigo de avisar): nenhum e-mail sai', r.ok === true && r.aviso === 'clique' && h.EMAILS.length === 0, r.aviso);
  r = avisar(id1, { tipo: 'cancelamento' });
  ok('A9 com o clique, sai o e-mail "Sessão cancelada"', r.enviado === true && r.tipo === 'cancelamento' && h.EMAILS.length === 1 && /cancelada/.test(h.EMAILS[0].body));
});

/* ---------------------------------------------------------------- B */
console.log('B. Responder a um pedido não envia e-mail; o clique envia');
tenta('B', () => {
  const u1 = uuid(), u2 = uuid();
  pac(P1, 'pacienteAgendarSessao', { dados: { id: u1, data: '2026-12-09', hora: '08:00', modalidade: 'presencial' } });
  pac(P2, 'pacienteAgendarSessao', { dados: { id: u2, data: '2026-12-09', hora: '09:00', modalidade: 'presencial' } });
  h.EMAILS.length = 0;
  let r = prof('profDecidirPedido', { id: u1, aprovar: true, periodo: PER });
  const aoPaciente = () => h.EMAILS.filter(x => /p[12]@exemplo\.test/.test(String(x.to)));
  ok('B1 aprovar: a sessão nasce, nenhum e-mail vai ao paciente e a resposta traz o pedido', r.ok === true && r.aprovado === true && r.aviso === 'clique' && r.pedido === u1 && aoPaciente().length === 0 && cel('Sessoes', 'ag-' + u1, 'estado') === 'agendada', { aviso: r.aviso, n: aoPaciente().length });
  r = prof('profAvisarSessao', { id: '', dados: { pedido: u1 } });
  ok('B2 com o clique, sai o "Pedido aprovado" com o botão de confirmar presença', r.ok === true && r.enviado === true && r.tipo === 'pedido_aprovado' && aoPaciente().length === 1 && aoPaciente()[0].to === 'p1@exemplo.test' && html(aoPaciente()[0]).indexOf('Confirmar presença') !== -1, r);
  h.EMAILS.length = 0;
  r = prof('profDecidirPedido', { id: u2, aprovar: false, periodo: PER });
  ok('B3 recusar: nenhum e-mail vai ao paciente', r.ok === true && r.aprovado === false && r.aviso === 'clique' && r.pedido === u2 && aoPaciente().length === 0, r.aviso);
  r = prof('profAvisarSessao', { id: '', dados: { pedido: u2 } });
  ok('B4 com o clique, sai o e-mail da recusa para o paciente certo', r.ok === true && r.enviado === true && r.tipo === 'pedido_recusado' && aoPaciente().length === 1 && aoPaciente()[0].to === 'p2@exemplo.test', r);
  r = prof('profAvisarSessao', { id: '', dados: { pedido: uuid() } });
  ok('B5 pedido que não existe: recusa, sem e-mail', r.ok === false && aoPaciente().length === 1, r);
  const u3 = uuid();
  pac(P1, 'pacienteAgendarSessao', { dados: { id: u3, data: '2026-12-10', hora: '08:00', modalidade: 'presencial' } });
  r = prof('profAvisarSessao', { id: '', dados: { pedido: u3 } });
  ok('B6 pedido ainda sem resposta: não há o que avisar', r.ok === false && aoPaciente().length === 1, r);
});

/* ---------------------------------------------------------------- C */
console.log('C. O que continua automático e o que protege o paciente');
tenta('C', () => {
  const idL = uuid();
  sessao(P1, { id: idL, data: '2026-11-27', hora: '14:30' }); // sexta, a 48 h de 25/11 14:00
  h.EMAILS.length = 0; h.memo();
  const g = S('enviarLembretes_')(quando(2026, 11, 25, 14, 35)).sessoes;
  ok('C1 os lembretes continuam saindo sozinhos pelo gatilho (48 horas antes)', g.enviados === 1 && h.EMAILS.filter(x => x.to === 'p1@exemplo.test').length === 1, g);
  const outro = uuid();
  ok('C2 um paciente não consegue usar o envio com clique', pac(P1, 'profAvisarSessao', { id: idL, dados: {} }).ok === false);
  ok('C3 sem crachá, o envio com clique é recusado', h.post({ acao: 'profAvisarSessao', id: idL, dados: {} }).ok === false);
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('C4 em produção a chave do envio automático é false e nenhuma ação a liga', /var AGE_EMAIL_AUTOMATICO = false;/.test(src) && (src.match(/AGE_EMAIL_AUTOMATICO\s*=[^=]/g) || []).length === 1 && S('AGE_EMAIL_AUTOMATICO') === false);
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura e versão');
tenta('T', () => {
  ok('T1 VERSAO_PACOTE do 14.13 em diante (o número exato é conferido em backend_16_11.js)', /^(14\.(1[3-9]|[2-9]\d)|[12]\d\.)/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE'));
  ok('T2 nenhuma ação nova; o envio com clique continua na trava e exige crachá', S('ACOES_COM_TRAVA').indexOf('profAvisarSessao') !== -1 && S('ACOES_PUBLICAS').indexOf('profAvisarSessao') === -1);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T3 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
