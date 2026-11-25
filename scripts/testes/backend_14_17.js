/* Pacote 14.17 — "Iniciar sessão on-line", "Copiar link para o paciente" e o bloco "Sessões de hoje" (etapa 2, parte 4 de 4).
   No servidor: o botão do e-mail passa a "Iniciar sessão on-line"; a leitura do Início devolve `sessoes_hoje`.
   Prova também que a sala certa chega ao e-mail e à tela do paciente, em sessão avulsa e em sessões recorrentes.
   Uso: node scripts/testes/backend_14_17.js */
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
const html = e => String(e.htmlBody || '');
const avisar = (id, dados) => prof('profAvisarSessao', { id: id, dados: dados || {} });

const ini = () => prof('profLerFinanceiro', { so: 'inicio' });
const minhas = sigla => pac(sigla, 'lerMinhasSessoes', {});
const botaoDoEmail = e => { const m = /href="(https:\/\/meet\.google\.com\/[^"]+)"[^>]*>\s*([^<]+)</.exec(html(e)); return m ? { link: m[1], rotulo: m[2].trim() } : null; };

/* ---------------------------------------------------------------- A */
console.log('A. A sala certa chega ao e-mail e à tela do paciente');
const idOn = uuid(), idSerie = uuid();
tenta('A', () => {
  prof('profAgendaConectar', { periodo: PER });
  prof('profSalvarGrade', { config: { duracao_slot_min: 60, antecedencia_min_horas: 24, avisos_sessao: 'Sim', google_calendar: 'Sim' }, grade: GRADE });
  let r = sessao(P1, { id: idOn, data: '2026-12-02', hora: '10:00', modalidade: 'online' });
  const sala1 = cel('Sessoes', idOn, 'meet_link');
  ok('A1 sessão on-line avulsa: a sala nasce com a sessão', r.ok === true && /^https:\/\/meet\.google\.com\//.test(sala1), { erro: r.erro, sala1 });
  h.EMAILS.length = 0;
  avisar(idOn, { tipo: 'confirmacao' });
  let b = botaoDoEmail(h.EMAILS[0] || {});
  ok('A2 e-mail da sessão avulsa: botão "Iniciar sessão on-line" com a sala dessa sessão', !!b && b.rotulo === 'Iniciar sessão on-line' && b.link === sala1 && html(h.EMAILS[0]).indexOf('Entrar na sessão on-line') === -1, b);
  ok('A3 o texto simples do e-mail leva a mesma sala', String(h.EMAILS[0].body).indexOf(sala1) !== -1);
  let m = minhas(P1);
  const s1 = (m.sessoes || []).filter(x => x.id === idOn)[0];
  ok('A4 tela do paciente: a sessão vem com a mesma sala', !!s1 && s1.meet_link === sala1, s1);
  r = sessao(P2, { id: idSerie, data: '2026-12-03', hora: '14:00', modalidade: 'online', repeticao: { cada: 1, unidade: 'semana', dias_semana: [4], fim_tipo: 'n', fim_n: 3 } });
  const daSerie = prof('profLerAgenda', PER).sessoes.filter(x => x.sigla === P2).sort((a, c) => (a.data < c.data ? -1 : 1));
  const salas = daSerie.map(x => x.meet_link);
  ok('A5 três sessões recorrentes on-line: cada uma com a sua sala, todas diferentes entre si e da avulsa', r.ok === true && daSerie.length === 3 && salas.every(l => /^https:\/\/meet\.google\.com\//.test(l)) && new Set(salas.concat([sala1])).size === 4, salas);
  m = minhas(P2);
  ok('A6 tela do paciente: cada sessão recorrente com a sua própria sala', daSerie.every(x => ((m.sessoes || []).filter(y => y.id === x.id)[0] || {}).meet_link === x.meet_link), (m.sessoes || []).map(y => y.meet_link));
  h.EMAILS.length = 0;
  avisar(daSerie[1].id, { tipo: 'confirmacao' });
  b = botaoDoEmail(h.EMAILS[0] || {});
  ok('A7 e-mail de uma sessão do meio das recorrentes: a sala é a dela, não a da primeira', !!b && b.rotulo === 'Iniciar sessão on-line' && b.link === daSerie[1].meet_link && b.link !== daSerie[0].meet_link, b);
  const presencial = uuid();
  sessao(P1, { id: presencial, data: '2026-12-04', hora: '09:00', modalidade: 'presencial' });
  h.EMAILS.length = 0;
  avisar(presencial, { tipo: 'confirmacao' });
  ok('A8 sessão presencial: o e-mail não traz botão de sala', html(h.EMAILS[0] || {}).indexOf('Iniciar sessão on-line') === -1 && html(h.EMAILS[0] || {}).indexOf('meet.google.com') === -1);
});

/* ---------------------------------------------------------------- B */
console.log('B. O bloco "Sessões de hoje" do Início');
tenta('B', () => {
  let r = ini();
  ok('B1 sem sessão hoje, a lista vem vazia', r.ok === true && Array.isArray(r.inicio.sessoes_hoje) && r.inicio.sessoes_hoje.length === 0, r.inicio && r.inicio.sessoes_hoje);
  const idTarde = uuid(), idManha = uuid(), idCanc = uuid(), idAmanha = uuid();
  sessao(P1, { id: idTarde, data: '2026-11-25', hora: '16:00', modalidade: 'online' });
  sessao(P2, { id: idManha, data: '2026-11-25', hora: '09:00', modalidade: 'presencial' }); // 09:00 de hoje já passou (são 14:00)
  sessao(P2, { id: idCanc, data: '2026-11-25', hora: '17:00', modalidade: 'online' });
  sessao(P1, { id: idAmanha, data: '2026-11-26', hora: '10:00', modalidade: 'online' });
  prof('profCancelarSessao', { id: idCanc, opcoes: { quem: 'profissional' }, periodo: PER });
  r = ini();
  const hoje = r.inicio.sessoes_hoje;
  ok('B2 só as de hoje, sem a cancelada e sem a de amanhã, em ordem de hora', hoje.map(x => x.id).join() === [idManha, idTarde].join(), hoje.map(x => x.hora + ' ' + x.nome));
  ok('B3 a on-line traz a sala dela; a presencial não traz sala', hoje[1].modalidade === 'online' && hoje[1].meet_link === cel('Sessoes', idTarde, 'meet_link') && hoje[1].meet_link !== '' && hoje[0].modalidade === 'presencial' && hoje[0].meet_link === '', hoje);
  ok('B4 cada item vem com o nome do paciente, a hora, o status e se o paciente confirmou', hoje[0].nome === 'Pedro Segundo' && hoje[0].hora === '09:00' && hoje[1].nome === 'Paula Primeira' && hoje[1].estado === 'agendada' && hoje[1].confirmada === false, hoje);
  pac(P1, 'pacienteConfirmarSessao', { id: idTarde });
  sessao(P2, { id: idManha, data: '2026-11-25', hora: '09:00', modalidade: 'presencial', situacao: 'realizada' });
  r = ini();
  ok('B5 confirmação do paciente e status informado aparecem na leitura seguinte', r.inicio.sessoes_hoje[1].confirmada === true && r.inicio.sessoes_hoje[0].estado === 'realizada', r.inicio.sessoes_hoje);
  sessao(P1, { id: idTarde, data: '2026-11-25', hora: '16:00', modalidade: 'online', situacao: 'realizada' });
  r = ini();
  ok('B6 sessão on-line já realizada: continua na lista, sem o botão da sala', r.inicio.sessoes_hoje[1].estado === 'realizada' && r.inicio.sessoes_hoje[1].meet_link === '', r.inicio.sessoes_hoje[1]);
  ok('B7 os outros blocos do Início continuam na mesma leitura', !!r.inicio.status_pendente && Array.isArray(r.inicio.comprovantes));
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura e versão');
tenta('T', () => {
  ok('T1 VERSAO_PACOTE do 14.17 em diante (o número exato é conferido em backend_16_11.js)', /^(14\.(1[7-9]|[2-9]\d)|[12]\d\.)/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE'));
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T2 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
