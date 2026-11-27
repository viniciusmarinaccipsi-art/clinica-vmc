/* Pacote 14.28 — crédito do paciente, pedido sem resposta que vence e pedido com o dia e a hora preferidos.
   Blocos: A pedido com horário que vence · B pedido só com texto (7 dias) · C dia e hora preferidos · D crédito · T estrutura.
   Agora simulado: quarta, 25/11/2026, 14:00.
   Uso: node scripts/testes/backend_14_28.js */
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

const decidir = (id, aprovar, quando) => prof('profDecidirPedido', { id: id, aprovar: aprovar, periodo: PER, quando: quando });
const pendentes = () => prof('profLerAgenda', PER).pedidos || [];
const eventos = () => prof('profLerAgenda', PER).eventos || [];
const meus = sig => pac(sig, 'lerMinhasSessoes', {});
const livres = (sig, de) => (pac(sig, 'lerHorariosLivres', { de: de }).livres || []).map(x => x.data + ' ' + x.hora);
const fin = () => prof('profLerFinanceiro', { periodo: 'personalizado', de: '2026-11-01', ate: '2026-12-31' }).financeiro;
const doPac = (f, sigla) => f.pacientes.filter(p => p.sigla === sigla)[0];
const pagar = (sigla, dados) => prof('profSalvarPagamento', { siglaPaciente: sigla, periodo: 'mes', dados: Object.assign({ id: uuid(), data: '2026-11-25', forma: 'Pix', quem: '', obs: '' }, dados) });

/* ---------------------------------------------------------------- A */
console.log('A. Pedido com horário: vence quando o horário chega');
const sA = uuid();
let pA;
tenta('A', () => {
  sessao(P1, { id: sA, data: '2026-12-01', hora: '10:00' });
  pA = pedir(P1, sA, { data: '2026-11-27', hora: '09:00' });
  ok('A1 o pedido entra como pendente e reserva o horário (some dos livres do outro paciente)', pA.r.ok === true && pendentes().some(p => p.id === pA.id) && livres(P2, '2026-11-26').indexOf('2026-11-27 09:00') === -1, pendentes().length);
  irPara(2026, 11, 27, 8, 59);
  ok('A2 um minuto antes do horário pedido ainda está pendente', pendentes().some(p => p.id === pA.id));
  irPara(2026, 11, 27, 9, 0);
  ok('A3 na hora pedida, sem resposta, o pedido vence: sai da lista do profissional', !pendentes().some(p => p.id === pA.id), pendentes().map(p => p.id));
  ok('A4 nada foi gravado: na planilha o pedido continua pendente (o vencimento é calculado)', cel('Pedidos_Agenda', pA.id, 'estado') === 'pendente');
  const ev = eventos().filter(e => e.tipo === 'venceu');
  ok('A5 o vencimento aparece no sino, com a hora em que venceu', ev.length === 1 && ev[0].em === '2026-11-27 09:00' && ev[0].sigla === P1, ev);
  h.EMAILS.length = 0;
  const r = decidir(pA.id, true);
  ok('A6 responder um pedido vencido é recusado com a frase, e nenhuma sessão nasce', r.ok === false && r.codigo === 'vencido' && r.erro === 'Este pedido venceu.' && !aba('Sessoes').getDataRange().getValues().some(l => String(l[0]).indexOf('rg-') === 0), r);
  ok('A7 nenhum e-mail sai pelo vencimento', h.EMAILS.length === 0, h.EMAILS.length);
  const m = minha(P1, sA);
  ok('A8 a sessão original continua cancelada, sem a marca de pedido pendente; o paciente vê o pedido como vencido', cel('Sessoes', sA, 'estado') === 'cancelada' && naAgenda(sA).pedido_reagendar === false && !!m.pedido && m.pedido.estado === 'vencido', m && m.pedido);
  const sA2 = uuid();
  sessao(P1, { id: sA2, data: '2026-12-09', hora: '10:00' });
  const outro = pedir(P1, sA2, { data: '2026-12-03', hora: '11:00' });
  ok('A9 o pedido vencido não impede um pedido novo', outro.r.ok === true && pendentes().some(p => p.id === outro.id), outro.r);
  ok('A10 o histórico da sessão conta o pedido e o vencimento', (prof('profLerHistoricoSessao', { id: sA }).eventos || []).some(e => e.texto === 'O pedido de reagendamento venceu sem resposta.' && e.erro === true));
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- B */
console.log('B. Pedido só com texto: vence em 7 dias');
tenta('B', () => {
  const sB = uuid();
  sessao(P2, { id: sB, data: '2026-12-10', hora: '15:00' });
  const p = pedir(P2, sB, { sugestao: 'Qualquer tarde da outra semana' });
  ok('B1 pedido só com texto entra como pendente, sem data', p.r.ok === true && cel('Pedidos_Agenda', p.id, 'data') === '' && pendentes().some(x => x.id === p.id));
  ok('B2 a regra: vence 7 dias depois de feito, na mesma hora', S('_agePedidoVenceEm_')({ data: '', hora: '', criado_em: '2026-11-25 14:00' }) === '2026-12-02 14:00' && S('PEDIDO_SEM_DATA_DIAS') === 7);
  irPara(2026, 12, 2, 13, 59);
  ok('B3 no sétimo dia, um minuto antes, ainda pendente', pendentes().some(x => x.id === p.id));
  irPara(2026, 12, 2, 14, 0);
  ok('B4 completados os 7 dias, vence', !pendentes().some(x => x.id === p.id) && eventos().some(e => e.tipo === 'venceu' && e.em === '2026-12-02 14:00'));
  irPara(2026, 11, 25, 14, 0);
  const u = uuid();
  pac(P2, 'pacienteAgendarSessao', { dados: { id: u, data: '2026-11-26', hora: '16:00', modalidade: 'presencial' } });
  irPara(2026, 11, 26, 16, 0);
  let lista = meus(P2).pedidos_agendar;
  ok('B5 pedido de agendamento vencido: o paciente o vê como vencido', lista.some(x => x.id === u && x.estado === 'vencido'), lista);
  irPara(2026, 12, 4, 16, 0);
  ok('B6 passados 7 dias do vencimento, ele some da tela do paciente', !meus(P2).pedidos_agendar.some(x => x.id === u));
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- C */
console.log('C. Dia e hora preferidos');
tenta('C', () => {
  const sC = uuid(), sOcup = uuid();
  sessao(P1, { id: sC, data: '2026-12-15', hora: '10:00' });
  sessao(P2, { id: sOcup, data: '2026-12-16', hora: '18:30' });   // horário fora dos livres: ocupado por outro paciente
  let p = pedir(P1, sC, { data: '2026-12-16', hora: '18:30', preferido: true });
  ok('C1 o paciente pede o dia e a hora que prefere, mesmo sem horário livre ali: o pedido entra com a data e a sessão é cancelada na hora', p.r.ok === true && cel('Pedidos_Agenda', p.id, 'data') === '2026-12-16' && cel('Pedidos_Agenda', p.id, 'hora') === '18:30' && cel('Sessoes', sC, 'estado') === 'cancelada', p.r);
  ok('C2 sem "preferido", o mesmo horário é recusado como ocupado (regra de antes)', (() => { const s2 = uuid(); sessao(P1, { id: s2, data: '2026-12-17', hora: '10:00' }); return pedir(P1, s2, { data: '2026-12-16', hora: '18:30' }).r.codigo === 'ocupado'; })());
  let r = decidir(p.id, true);
  ok('C3 aprovar no horário preferido que está ocupado é recusado; o pedido continua pendente', r.ok === false && cel('Pedidos_Agenda', p.id, 'estado') === 'pendente', r);
  r = decidir(p.id, true, { data: '2026-12-18', hora: '09:00' });
  ok('C4 aprovar em outro horário cria a sessão nova e fecha o pedido', r.ok === true && cel('Pedidos_Agenda', p.id, 'estado') === 'aprovado', r.erro);
  const sC2 = uuid();
  sessao(P1, { id: sC2, data: '2026-12-22', hora: '10:00' });
  r = pedir(P1, sC2, { data: '2026-11-20', hora: '10:00', preferido: true }).r;
  ok('C5 dia que já passou é recusado e a sessão não é cancelada', r.ok === false && cel('Sessoes', sC2, 'estado') !== 'cancelada', r);
  p = pedir(P1, sC2, { data: '2026-12-23', hora: '07:15', preferido: true, sugestao: 'Antes do trabalho' });
  ok('C6 o texto continua opcional e vai junto', p.r.ok === true && cel('Pedidos_Agenda', p.id, 'sugestao') === 'Antes do trabalho');
});

/* ---------------------------------------------------------------- D */
console.log('D. Crédito');
tenta('D', () => {
  const P3 = novo('Carla Terceira', 'p3@exemplo.test');
  const s1 = uuid(), s2 = uuid(), s3 = uuid();
  // paga o mês: as sessões de novembro já podem receber pagamento antes de acontecer
  prof('profSalvarCadastroFinanceiro', { siglaPaciente: P3, dados: { valor: 30000, modo: 'mensal', n: '', quando: '', pagador: 'paciente', pagadores: [], recibo: 'Nao', titular: 'paciente', canal: 'ambos', encaminhamento: '' } });
  sessao(P3, { id: s1, data: '2026-11-27', hora: '17:00', valor: '300' });
  sessao(P3, { id: s2, data: '2026-11-30', hora: '08:00', valor: '300' });
  sessao(P3, { id: s3, data: '2026-11-26', hora: '08:00', valor: '300' });
  let r = pagar(P3, { valor: 60000, sessoes: [{ sessao: s1, valor: 30000 }, { sessao: s3, valor: 30000 }] });
  ok('D0 pagamento de duas sessões lançado; crédito zero', r.ok === true && doPac(fin(), P3).credito === 0, r.erro);
  prof('profCancelarSessao', { id: s1, opcoes: { quem: 'profissional' }, periodo: PER });
  let f = fin();
  ok('D1 a sessão paga, cancelada sem cobrança, devolve o valor: crédito de 300', cel('Sessoes', s1, 'cobrada') !== 'Sim' && doPac(f, P3).credito === 30000, doPac(f, P3));
  ok('D2 nada foi apagado: as linhas do pagamento e das alocações continuam na planilha', aba('Fin_Pagamentos').getLastRow() - 1 === 1 && aba('Fin_Alocacoes').getLastRow() - 1 === 2);
  ok('D3 na Agenda, a cancelada leva a marca de crédito; a sessão comum, não', naAgenda(s1).credito === true && naAgenda(s2).credito === false, [naAgenda(s1).credito, naAgenda(s2).credito]);
  r = pagar(P3, { credito: true, sessoes: [{ sessao: s2, valor: 30000 }] });
  f = fin();
  ok('D4 o crédito é usado em outra sessão pela tela de pagamento: ela fica paga e o crédito zera', r.ok === true && doPac(f, P3).credito === 0 && aba('Fin_Pagamentos').getLastRow() - 1 === 1, r.erro);
  pac(P3, 'pacienteCancelarSessao', { id: s3 });
  f = fin();
  ok('D5 sessão paga cancelada FORA do prazo continua cobrada: não vira crédito', cel('Sessoes', s3, 'cobrada') === 'Sim' && doPac(f, P3).credito === 0 && naAgenda(s3).credito === false, doPac(f, P3));
  const s4 = uuid();
  sessao(P3, { id: s4, data: '2026-11-30', hora: '17:00', valor: '300' });
  prof('profCancelarSessao', { id: s4, opcoes: { quem: 'profissional' }, periodo: PER });
  ok('D6 cancelada sem cobrança que nunca foi paga: sem marca de crédito', naAgenda(s4).credito === false && doPac(fin(), P3).credito === 0);
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura');
tenta('T', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('T1 o pedido só com texto vence em 7 dias', S('PEDIDO_SEM_DATA_DIAS') === 7);
  ok('T2 nenhuma ação nova, nenhuma aba e nenhuma coluna nova', (src.match(/\n      case '/g) || []).length === 101 && S('COLUNAS_PEDIDOS_AGENDA').join(',') === 'id,sigla,tipo,sessao_id,data,hora,estado,criado_em,decidido_em,sugestao,modalidade' && S('COLUNAS_SESSOES').slice(-1)[0] === 'aviso_ultimo');
  ok('T3 o vencimento não é gravado por robô: o gatilho não escreve em Pedidos_Agenda', !/venceu_em:/.test(src.replace(/p\.venceu_em = v/, '')));
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T4 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
