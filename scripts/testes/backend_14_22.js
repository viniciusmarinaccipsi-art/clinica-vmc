/* Pacote 14.22 — o status "Reagendada" (etapa 3 do plano de correções, parte 4 de 5).
   No dado, a sessão original continua `estado = cancelada` e ganha `reagendada_para` (id da sessão nova).
   O pedido de reagendar do paciente cancela a sessão na hora (decisão do usuário, 25/11/2026); aprovar cria a sessão
   nova; recusar deixa a original cancelada. Fora do prazo o paciente também pede e cancela, com a cobrança da política.
   Blocos: A pedido dentro do prazo · B fora do prazo · C o profissional reagenda pelo campo · D pedido antigo · T estrutura.
   Agora simulado: quarta, 25/11/2026, 14:00.
   Uso: node scripts/testes/backend_14_22.js */
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

const simular = (id, opcoes) => prof('profCancelarSessao', { id: id, opcoes: Object.assign({ simular: true }, opcoes) });
const grade = config => prof('profSalvarGrade', { config: Object.assign({ duracao_slot_min: 60, antecedencia_min_horas: 24 }, config), grade: GRADE });
const naAgenda = id => (prof('profLerAgenda', PER).sessoes || []).filter(x => x.id === id)[0];
const minha = (sig, id) => (pac(sig, 'lerMinhasSessoes', {}).sessoes || []).filter(x => x.id === id)[0];
const pedir = (sig, sessaoId, d) => { const id = uuid(); const r = pac(sig, 'pacientePedirAgenda', { dados: Object.assign({ id: id, tipo: 'remarcar', sessao_id: sessaoId }, d) }); return { id: id, r: r }; };
const irPara = (ano, mes, dia, hh, mm) => { agoraMs = new Real(ano, mes - 1, dia, hh || 0, mm || 0, 0).getTime(); };
grade({});

/* ---------------------------------------------------------------- A */
console.log('A. O paciente pede para reagendar dentro do prazo');
const sA = uuid();
tenta('A', () => {
  sessao(P1, { id: sA, data: '2026-12-01', hora: '10:00', modalidade: 'online', valor: '280' });
  pac(P1, 'pacienteConfirmarSessao', { id: sA });
  let m = minha(P1, sA);
  ok('A1 antes de pedir: a tela do paciente oferece reagendar e diz que está dentro do prazo', m.pode_remarcar === true && m.no_prazo === true && m.cobra_fora === false, m);
  const p = pedir(P1, sA, { data: '2026-12-03', hora: '10:00' });
  ok('A2 ao pedir, a sessão é cancelada na hora: pelo paciente, dentro do prazo, não cobrada; o pedido fica aguardando', p.r.ok === true && cel('Sessoes', sA, 'estado') === 'cancelada' && cel('Sessoes', sA, 'cancelada_por') === 'paciente' && cel('Sessoes', sA, 'cancel_no_prazo') === 'Sim' && cel('Sessoes', sA, 'cobrada') === 'Nao' && cel('Sessoes', sA, 'data') === '2026-12-01' && cel('Pedidos_Agenda', p.id, 'estado') === 'pendente', estadoDe(sA));
  let a = naAgenda(sA);
  ok('A3 na leitura do profissional: cancelada, com a marca "reagendamento pedido" e ainda sem data nova', !!a && a.estado === 'cancelada' && a.pedido_reagendar === true && a.reagendada_para === null, a && { e: a.estado, p: a.pedido_reagendar, r: a.reagendada_para });
  const ev = prof('profLerAgenda', PER).eventos.filter(e => e.sigla === P1);
  ok('A4 no sino aparece o pedido, e não um segundo evento "cancelou" para a mesma sessão', ev.some(e => e.tipo === 'remarcar') && !ev.some(e => e.tipo === 'cancelou'), ev.map(e => e.tipo));
  const outra = sessao(P2, { data: '2026-12-01', hora: '10:00' });
  ok('A5 o horário da sessão original fica livre: outro paciente é marcado nele', outra.ok === true, outra.erro);
  m = minha(P1, sA);
  ok('A6 na tela do paciente: cancelada, com o pedido aguardando, sem oferecer cancelar nem reagendar de novo', m.estado === 'cancelada' && m.pedido && m.pedido.tipo === 'remarcar' && m.pedido.estado === 'pendente' && m.pode_cancelar === false && m.pode_remarcar === false, m);
  const r = prof('profDecidirPedido', { id: p.id, aprovar: true, periodo: PER });
  const nova = naAgenda('rg-' + sA); a = naAgenda(sA);
  ok('A7 aprovar: nasce a sessão nova no horário pedido, a confirmar, com a modalidade e o valor da original', r.ok === true && r.aprovado === true && !!nova && nova.data === '2026-12-03' && nova.hora === '10:00' && nova.estado === 'agendada' && nova.confirmada === false && nova.modalidade === 'online' && nova.valor === '280', nova && { d: nova.data, h: nova.hora, e: nova.estado, c: nova.confirmada, m: nova.modalidade, v: nova.valor });
  ok('A8 a original fica reagendada: continua cancelada no dado, ligada à nova, e as duas se apontam na leitura', cel('Sessoes', sA, 'estado') === 'cancelada' && cel('Sessoes', sA, 'reagendada_para') === 'rg-' + sA && a.reagendada_para.data === '2026-12-03' && a.reagendada_para.hora === '10:00' && a.pedido_reagendar === false && nova.reagendada_de.data === '2026-12-01' && nova.reagendada_de.hora === '10:00');
  ok('A9 dentro do prazo "nada muda": a original não é cobrada e a nova é uma sessão comum (cobrança em branco, sem ser reposição)', cel('Sessoes', sA, 'cobrada') === 'Nao' && cel('Sessoes', 'rg-' + sA, 'cobrada') === '' && cel('Sessoes', 'rg-' + sA, 'reposicao_de') === '');
  ok('A10 decidir de novo o mesmo pedido não cria outra sessão', prof('profDecidirPedido', { id: p.id, aprovar: true, periodo: PER }).duplicado === true && (prof('profLerAgenda', PER).sessoes || []).filter(x => x.id.indexOf('rg-' + sA) === 0).length === 1);
  m = minha(P1, 'rg-' + sA);
  ok('A11 na tela do paciente a sessão nova pede confirmação e diz de onde veio; a original mostra para onde foi', !!m && m.pode_confirmar === true && m.reagendada_de.data === '2026-12-01' && minha(P1, sA).reagendada_para.data === '2026-12-03', m);
  h.EMAILS.length = 0;
  const av = prof('profAvisarSessao', { id: '', dados: { pedido: p.id } });
  ok('A12 o e-mail "Pedido aprovado" (com o clique) fala da sessão nova', av.ok === true && av.tipo === 'pedido_aprovado' && h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('03/12/2026, às 10:00') !== -1, [av, h.EMAILS.map(e => e.subject)]);
});

/* ---------------------------------------------------------------- B */
console.log('B. Fora do prazo: o paciente pede e cancela, com a cobrança da política');
const sB = uuid(), sC = uuid(), sK = uuid();
tenta('B', () => {
  sessao(P1, { id: sB, data: '2026-11-26', hora: '10:00' }); // faltam 20 horas
  let m = minha(P1, sB);
  ok('B1 com 20 horas, prazo de 24: a tela ainda oferece cancelar e reagendar, e avisa que está fora do prazo e será cobrada', m.pode_cancelar === true && m.pode_remarcar === true && m.no_prazo === false && m.cobra_fora === true, m);
  const p = pedir(P1, sB, { data: '2026-11-27', hora: '16:00' });
  ok('B2 pedir fora do prazo: aceito; a sessão é cancelada, fora do prazo, cobrada', p.r.ok === true && cel('Sessoes', sB, 'estado') === 'cancelada' && cel('Sessoes', sB, 'cancel_no_prazo') === 'Nao' && cel('Sessoes', sB, 'cobrada') === 'Sim', { r: p.r.erro, e: estadoDe(sB) });
  let r = prof('profDecidirPedido', { id: p.id, aprovar: true, periodo: PER });
  ok('B3 aprovar: "cobrada uma vez só" — a original continua cobrada e a nova não gera outra cobrança (é a reposição dela)', r.ok === true && cel('Sessoes', sB, 'cobrada') === 'Sim' && cel('Sessoes', 'rg-' + sB, 'cobrada') === 'Nao' && cel('Sessoes', 'rg-' + sB, 'reposicao_de') === sB && naAgenda(sB).reposta_em === '2026-11-27', estadoDe('rg-' + sB));
  irPara(2026, 11, 27, 18, 0);
  r = prof('profMarcarSituacao', { id: 'rg-' + sB, situacao: 'realizada', periodo: PER });
  ok('B4 a sessão nova, marcada como realizada, continua sem cobrança nova', r.ok === true && cel('Sessoes', 'rg-' + sB, 'estado') === 'realizada' && cel('Sessoes', 'rg-' + sB, 'cobrada') === 'Nao', estadoDe('rg-' + sB));
  irPara(2026, 11, 25, 14, 0);
  sessao(P2, { id: sC, data: '2026-11-26', hora: '11:00' });
  const pc = pedir(P2, sC, { sugestao: 'Qualquer dia depois das 17h' });
  ok('B5 pedido só com o horário ideal também cancela a sessão na hora (fora do prazo: cobrada)', pc.r.ok === true && cel('Sessoes', sC, 'estado') === 'cancelada' && cel('Sessoes', sC, 'cobrada') === 'Sim' && cel('Pedidos_Agenda', pc.id, 'data') === '', { r: pc.r.erro, e: estadoDe(sC) });
  r = prof('profDecidirPedido', { id: pc.id, aprovar: false, periodo: PER });
  const a = naAgenda(sC);
  ok('B6 recusar: a sessão continua cancelada e cobrada, sem a marca do pedido e sem data nova', r.ok === true && r.aprovado === false && a.estado === 'cancelada' && a.cobrada === 'Sim' && a.pedido_reagendar === false && a.reagendada_para === null && cel('Sessoes', sC, 'reagendada_para') === '');
  ok('B7 depois da recusa, a sessão cobrada continua podendo ser reposta (como já era)', a.pode_repor === true && minha(P2, sC).pode_repor === true);
  grade({ cobrar_cancel_fora: 'Nao' });
  sessao(P2, { id: sK, data: '2026-11-26', hora: '13:00' });
  m = minha(P2, sK);
  ok('B8 com a política "fora do prazo: não cobrar", a tela do paciente não avisa cobrança', m.no_prazo === false && m.cobra_fora === false, m);
  r = pac(P2, 'pacienteCancelarSessao', { id: sK });
  ok('B9 e cancelar fora do prazo grava: fora do prazo, não cobrada', r.ok === true && cel('Sessoes', sK, 'estado') === 'cancelada' && cel('Sessoes', sK, 'cancel_no_prazo') === 'Nao' && cel('Sessoes', sK, 'cobrada') === 'Nao', estadoDe(sK));
  grade({ cobrar_cancel_fora: 'Sim' });
  const sPas = uuid();
  sessao(P2, { id: sPas, data: '2026-11-24', hora: '08:00' });
  ok('B10 sessão que já passou: o paciente não cancela nem pede reagendamento', pac(P2, 'pacienteCancelarSessao', { id: sPas }).ok === false && pedir(P2, sPas, { data: '2026-11-27', hora: '15:00' }).r.ok === false && cel('Sessoes', sPas, 'estado') === 'agendada');
});

/* ---------------------------------------------------------------- C */
console.log('C. O profissional reagenda pelo campo "Status da sessão"');
const sD = uuid(), sE = uuid(), sF = uuid();
tenta('C', () => {
  sessao(P1, { id: sD, data: '2026-12-04', hora: '10:00', valor: '300' });
  const linhas = aba('Sessoes').getLastRow();
  let r = simular(sD, { quem: 'profissional', reagendar: { data: '2026-12-08', hora: '11:00' } });
  ok('C1 simular: mostra a frase do reagendamento e a cobrança (por mim: não cobrada), sem gravar nada', r.ok === true && /passou de 04\/12\/2026 às 10:00 para 08\/12\/2026 às 11:00\.$/.test(r.simulacao.previa) && r.simulacao.cobrada === 'Nao' && r.simulacao.pode_trocar === false && aba('Sessoes').getLastRow() === linhas && cel('Sessoes', sD, 'estado') === 'agendada', r.simulacao);
  ok('C2 o mesmo horário, horário sem hora e horário ocupado são recusados, e a sessão continua agendada', simular(sD, { reagendar: { data: '2026-12-04', hora: '10:00' } }).codigo === 'mesmo' && simular(sD, { reagendar: { data: '2026-12-08', hora: '' } }).codigo === 'sem_horario' && prof('profCancelarSessao', { id: sD, opcoes: { reagendar: { data: '2026-12-01', hora: '10:00' } }, periodo: PER }).codigo === 'ocupado' && cel('Sessoes', sD, 'estado') === 'agendada');
  r = prof('profCancelarSessao', { id: sD, opcoes: { quem: 'profissional', motivo: 'Congresso', reagendar: { data: '2026-12-08', hora: '11:00' } }, periodo: PER });
  const nova = naAgenda('rg-' + sD), a = naAgenda(sD);
  ok('C3 salvar: a resposta traz a sessão nova; a original fica cancelada por mim, sem cobrança, ligada à nova', r.ok === true && r.reagendada.id === 'rg-' + sD && r.reagendada.data === '2026-12-08' && r.reagendada.de.data === '2026-12-04' && r.aviso === 'clique' && a.estado === 'cancelada' && a.cancelada_por === 'profissional' && a.cobrada === 'Nao' && a.cancel_motivo === 'Congresso' && a.reagendada_para.data === '2026-12-08', { r: r.erro, a: a && a.reagendada_para });
  ok('C4 a sessão nova é comum (cobrança em branco), a confirmar, com o valor da original', !!nova && nova.estado === 'agendada' && nova.confirmada === false && nova.valor === '300' && cel('Sessoes', 'rg-' + sD, 'cobrada') === '' && nova.reagendada_de.data === '2026-12-04', nova && { e: nova.estado, v: nova.valor });
  sessao(P1, { id: sE, data: '2026-11-26', hora: '15:00' }); // faltam 25 horas: dentro do prazo
  r = prof('profCancelarSessao', { id: sE, opcoes: { quem: 'paciente', no_prazo: false, reagendar: { data: '2026-12-09', hora: '09:00' } }, periodo: PER });
  ok('C5 o paciente pediu por fora, com menos horas que o prazo: a original fica cobrada e a nova não gera outra cobrança', r.ok === true && r.cobrada === 'Sim' && cel('Sessoes', sE, 'cobrada') === 'Sim' && cel('Sessoes', sE, 'cancel_no_prazo') === 'Nao' && cel('Sessoes', 'rg-' + sE, 'cobrada') === 'Nao' && cel('Sessoes', 'rg-' + sE, 'reposicao_de') === sE, estadoDe(sE));
  r = sessao(P2, { id: sF, data: '2026-12-07', hora: '09:00', repeticao: { cada: 1, unidade: 'semana', dias_semana: [1], fim_tipo: 'n', fim_n: 3 } });
  r = prof('profCancelarSessao', { id: sF, opcoes: { quem: 'paciente', escopo: 'seguintes', cobrar: false, reagendar: { data: '2026-12-08', hora: '15:00' } }, periodo: PER });
  const irmas = (prof('profLerAgenda', PER).sessoes || []).filter(x => x.sigla === P2 && x.serie_id && x.estado === 'agendada');
  ok('C6 em sessão recorrente, reagendar vale só para a sessão aberta: as seguintes continuam agendadas', r.ok === true && r.canceladas === 1 && irmas.length === 2 && cel('Sessoes', 'rg-' + sF, 'data') === '2026-12-08' && cel('Sessoes', 'rg-' + sF, 'serie_id') === '', { c: r.canceladas, n: irmas.length });
  ok('C7 reagendar uma sessão já reagendada não é possível (ela está cancelada); a nova pode ser reagendada de novo', simular(sD, { reagendar: { data: '2026-12-10', hora: '10:00' } }).ok === false && simular('rg-' + sD, { reagendar: { data: '2026-12-10', hora: '10:00' } }).ok === true);
  const fin = prof('profLerFinanceiro', { periodo: { de: '2026-11-01', ate: '2026-12-31' } });
  ok('C8 o Fluxo de caixa lê sem erro depois dos reagendamentos', fin.ok === true, fin.erro);
});

/* ---------------------------------------------------------------- D */
console.log('D. Pedido antigo (feito antes do 14.22, com a sessão ainda agendada)');
tenta('D', () => {
  const sG = uuid();
  sessao(P1, { id: sG, data: '2026-12-10', hora: '10:00' });
  const p = pedir(P1, sG, { data: '2026-12-11', hora: '10:00' });
  const a = aba('Sessoes'), l = h.linhaDe(a, 'id', sG), c = h.cab(a);
  ['estado', 'cancelada_em', 'cancelada_por', 'cancel_no_prazo', 'cobrada'].forEach(k => a.getRange(l, c.indexOf(k) + 1).setValue(k === 'estado' ? 'agendada' : '')); h.memo();
  const r = prof('profDecidirPedido', { id: p.id, aprovar: true, periodo: PER });
  ok('D1 aprovar o pedido antigo: a sessão é cancelada como dentro do prazo (não cobrada), fica reagendada e nasce a nova', r.ok === true && cel('Sessoes', sG, 'estado') === 'cancelada' && cel('Sessoes', sG, 'cancelada_por') === 'paciente' && cel('Sessoes', sG, 'cobrada') === 'Nao' && cel('Sessoes', sG, 'reagendada_para') === 'rg-' + sG && cel('Sessoes', 'rg-' + sG, 'data') === '2026-12-11', estadoDe(sG));
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura e versão');
tenta('T', () => {
  ok('T1 VERSAO_PACOTE do 14.22 em diante (o número exato é conferido em backend_16_11.js)', /^(14\.(2[2-9]|[3-9]\d)|[12]\d\.)/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE'));
  ok('T2 a coluna nova entra no fim de Sessoes, e o estado gravado continua sendo um dos quatro de sempre', S('COLUNAS_SESSOES').slice(-2)[0] === 'reagendada_para' && (prof('profLerAgenda', PER).sessoes || []).every(x => ['agendada', 'realizada', 'falta', 'cancelada'].indexOf(x.estado) !== -1));
  ok('T3 a tela do paciente não recebe valor, motivo nem cobrança da sessão', (pac(P1, 'lerMinhasSessoes', {}).sessoes || []).every(x => !('valor' in x) && !('cancel_motivo' in x) && !('cobrada' in x)));
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T4 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
