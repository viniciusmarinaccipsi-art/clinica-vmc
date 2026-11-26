/* Pacote 14.20 — política de cobrança configurável (etapa 3 do plano de correções, parte 3 de 5).
   No servidor: o prazo para cancelar ou reagendar sem cobrança (`prazo_cancelar_horas`) deixa de ser a antecedência
   mínima para agendar; o que é cobrado (falta, cancelamento fora do prazo, cancelamento dentro do prazo) é configurável.
   Sem configuração, vale a tabela de sempre.
   Blocos: A o padrão · B a política trocada · C o que não muda · D primeiro e último agendamento · T estrutura.
   Agora simulado: quarta, 25/11/2026, 14:00.
   Uso: node scripts/testes/backend_14_20.js */
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

const simular = (id, opcoes) => prof('profCancelarSessao', { id: id, opcoes: Object.assign({ simular: true }, opcoes) }).simulacao;
const grade = config => prof('profSalvarGrade', { config: Object.assign({ duracao_slot_min: 60, antecedencia_min_horas: 24 }, config), grade: GRADE });
const cfg = () => prof('profLerAgenda', PER).config;

/* ---------------------------------------------------------------- A */
console.log('A. Sem configurar nada, vale a tabela de sempre');
const id40 = uuid(), idSem = uuid();
tenta('A', () => {
  sessao(P1, { id: id40, data: '2026-11-27', hora: '06:00' });   // faltam 40 horas
  sessao(P1, { id: idSem, data: '2026-12-02', hora: '10:00' });  // falta uma semana
  const c = cfg();
  ok('A1 a política nasce: prazo igual à antecedência (24), falta cobrada, fora do prazo cobrado, dentro não', c.prazo_cancelar_horas === 24 && c.antecedencia_min_horas === 24 && c.cobrar_falta === 'Sim' && c.cobrar_cancel_fora === 'Sim' && c.cobrar_cancel_dentro === 'Nao', c);
  let s = simular(id40, { quem: 'paciente' });
  ok('A2 cancelar com 40 horas: no prazo (24), não cobrar', s.horas === 24 && s.no_prazo === true && s.proposta === 'Nao', s);
  ok('A3 a Config_Agenda não ganhou linha nenhuma só por ler', !aba('Config_Agenda') || h.cab(aba('Config_Agenda')).length === 2);
});

/* ---------------------------------------------------------------- B */
console.log('B. A política trocada pelo profissional');
tenta('B', () => {
  let r = grade({ prazo_cancelar_horas: 48, cobrar_falta: 'Nao', cobrar_cancel_fora: 'Nao', cobrar_cancel_dentro: 'Sim' });
  const c = cfg();
  ok('B1 salvar a política: prazo de 48 horas e as três escolhas; a antecedência para agendar continua 24', r.ok === true && c.prazo_cancelar_horas === 48 && c.antecedencia_min_horas === 24 && c.cobrar_falta === 'Nao' && c.cobrar_cancel_fora === 'Nao' && c.cobrar_cancel_dentro === 'Sim', c);
  let s = simular(id40, { quem: 'paciente' });
  ok('B2 a mesma sessão de 40 horas agora está fora do prazo (48); com "fora do prazo: não cobrar", a regra propõe não cobrar', s.horas === 48 && s.no_prazo === false && s.proposta === 'Nao', s);
  s = simular(idSem, { quem: 'paciente' });
  ok('B3 sessão de daqui a uma semana: no prazo; com "dentro do prazo: cobrar", a regra propõe cobrar', s.no_prazo === true && s.proposta === 'Sim' && s.pode_trocar === true, s);
  s = simular(idSem, { quem: 'profissional' });
  ok('B4 cancelada por mim: nunca cobrada, qualquer que seja a política', s.proposta === 'Nao' && s.pode_trocar === false, s);
  r = prof('profCancelarSessao', { id: idSem, opcoes: { quem: 'paciente' }, periodo: PER });
  ok('B5 gravando: cancelamento dentro do prazo fica cobrado, como a política manda', r.cobrada === 'Sim' && cel('Sessoes', idSem, 'cobrada') === 'Sim', estadoDe(idSem));
  const idF = uuid(), idL = uuid(), idR = uuid();
  sessao(P1, { id: idF, data: '2026-11-24', hora: '09:00' });
  r = sessao(P1, { id: idF, data: '2026-11-24', hora: '09:00', situacao: 'falta' });
  ok('B6 falta com "cobrar a falta: não": não cobrada', r.ok === true && cel('Sessoes', idF, 'estado') === 'falta' && cel('Sessoes', idF, 'cobrada') === 'Nao', estadoDe(idF));
  r = sessao(P1, { id: idF, data: '2026-11-24', hora: '09:00', situacao: 'falta', cobrar: true });
  ok('B7 e o clique "Cobrar" na sessão vale sobre a política', cel('Sessoes', idF, 'cobrada') === 'Sim');
  sessao(P2, { id: idL, data: '2026-11-24', hora: '11:00' });
  r = prof('profMarcarStatusLote', { ids: [idL], situacao: 'falta' });
  ok('B8 falta marcada pelo bloco do Início segue a mesma política: não cobrada', r.ok === true && cel('Sessoes', idL, 'estado') === 'falta' && cel('Sessoes', idL, 'cobrada') === 'Nao', { r: r.erro, e: estadoDe(idL) });
  sessao(P2, { id: idR, data: '2026-11-24', hora: '13:00' });
  r = sessao(P2, { id: idR, data: '2026-11-24', hora: '13:00', situacao: 'realizada' });
  ok('B9 sessão realizada é sempre cobrada', cel('Sessoes', idR, 'cobrada') === 'Sim');
  r = pac(P1, 'pacienteCancelarSessao', { id: id40 });
  ok('B10 o paciente tenta cancelar pelo sistema com 40 horas, prazo de 48: recusado pelo prazo, e a mensagem fala em 48 horas', r.ok === false && r.codigo === 'prazo' && /48/.test(r.erro), r);
  const m = pac(P1, 'lerMinhasSessoes', {});
  ok('B11 a tela do paciente recebe o prazo novo (48 horas)', m.antecedencia_horas === 48, m.antecedencia_horas);
});

/* ---------------------------------------------------------------- C */
console.log('C. O que não muda');
tenta('C', () => {
  let r = grade({});
  let c = cfg();
  ok('C1 salvar a Grade sem mandar a política não mexe nela', r.ok === true && c.prazo_cancelar_horas === 48 && c.cobrar_falta === 'Nao' && c.cobrar_cancel_dentro === 'Sim', c);
  grade({ prazo_cancelar_horas: 0 }); grade({ prazo_cancelar_horas: 500 }); grade({ prazo_cancelar_horas: 'abc' });
  ok('C2 prazo fora de 1 a 168 horas é ignorado', cfg().prazo_cancelar_horas === 48, cfg().prazo_cancelar_horas);
  grade({ cobrar_falta: 'talvez' });
  ok('C3 escolha que não é Sim vira Não', cfg().cobrar_falta === 'Nao');
  r = grade({ antecedencia_min_horas: 6 });
  c = cfg();
  ok('C4 mudar a antecedência para agendar (6 horas) não mexe no prazo de cancelar (48)', c.antecedencia_min_horas === 6 && c.prazo_cancelar_horas === 48, c);
  const livres = pac(P1, 'lerHorariosLivres', { de: '2026-11-25', ate: '2026-11-26' });
  ok('C5 os horários livres do paciente seguem a antecedência para agendar: hoje às 16:00 não aparece (faltam 2 horas), amanhã às 08:00 aparece (18 horas)', !(livres.livres || []).some(x => x.data === '2026-11-25' && x.hora === '16:00') && (livres.livres || []).some(x => x.data === '2026-11-26' && x.hora === '08:00'), (livres.livres || []).slice(0, 6));
  grade({ prazo_cancelar_horas: 24, cobrar_falta: 'Sim', cobrar_cancel_fora: 'Sim', cobrar_cancel_dentro: 'Nao', antecedencia_min_horas: 24 });
  const s = simular(id40, { quem: 'paciente' });
  ok('C6 de volta ao padrão, a sessão de 40 horas volta a estar no prazo e sem cobrança', s.horas === 24 && s.no_prazo === true && s.proposta === 'Nao', s);
});

/* ---------------------------------------------------------------- D */
console.log('D. Primeiro e último agendamento disponível (só para o paciente)');
tenta('D', () => {
  const L = S('_ageAgendarLimites_'), AG = { data: '2026-11-25', hora: '14:00' };
  ok('D1 a regra, sem configurar: a antecedência de antes (24 horas), a partir de hoje, e a agenda aberta por uma semana', JSON.stringify(L({ antecedencia_min_horas: 24 }, AG)) === JSON.stringify({ horas: 24, de: '2026-11-25', ate: '2026-12-02' }), L({ antecedencia_min_horas: 24 }, AG));
  ok('D2 "Nesse instante", "6 horas", "Dia seguinte" e "3 dias de margem"', L({ agendar_primeiro: '0h' }, AG).horas === 0 && L({ agendar_primeiro: '6h' }, AG).horas === 6 && L({ agendar_primeiro: 'amanha' }, AG).de === '2026-11-26' && L({ agendar_primeiro: 'amanha' }, AG).horas === 0 && L({ agendar_primeiro: '3d' }, AG).de === '2026-11-28');
  ok('D3 "No prazo de 1 dia", "Em 5 dias", "Dentro de 2 semanas" e "Dentro de 24 semanas"', L({ agendar_ultimo: '1d' }, AG).ate === '2026-11-26' && L({ agendar_ultimo: '5d' }, AG).ate === '2026-11-30' && L({ agendar_ultimo: '2s' }, AG).ate === '2026-12-09' && L({ agendar_ultimo: '24s' }, AG).ate === '2027-05-12', [L({ agendar_ultimo: '2s' }, AG), L({ agendar_ultimo: '24s' }, AG)]);
  ok('D4 código mal escrito não vale: volta a antecedência de antes e a uma semana', L({ agendar_primeiro: '9d', agendar_ultimo: '30s', antecedencia_min_horas: 12 }, AG).horas === 12 && L({ agendar_primeiro: '9d', agendar_ultimo: '', antecedencia_min_horas: 12 }, AG).ate === '2026-12-02' && L({ agendar_ultimo: '30s' }, AG).ate === '2026-12-02');
  const livres = de => (pac(P1, 'lerHorariosLivres', { de: de }).livres || []);
  const resp = de => pac(P1, 'lerHorariosLivres', { de: de });
  let r = grade({ agendar_primeiro: 'amanha', agendar_ultimo: '1s' });
  let c = cfg();
  ok('D5 salvar: "Dia seguinte" e "Dentro de 1 semana" ficam gravados', r.ok === true && c.agendar_primeiro === 'amanha' && c.agendar_ultimo === '1s', c);
  let l = livres('2026-11-25');
  ok('D6 "Dia seguinte": nada hoje; amanhã já aparece desde o primeiro horário (08:00), mesmo faltando menos de 24 horas', !l.some(x => x.data === '2026-11-25') && l.some(x => x.data === '2026-11-26' && x.hora === '08:00'), l.slice(0, 4));
  ok('D7 "Dentro de 1 semana": a resposta diz até quando a agenda está aberta (02/12)', resp('2026-11-25').agenda_ate === '2026-12-02', resp('2026-11-25').agenda_ate);
  l = livres('2026-11-30');
  ok('D8 pedindo a semana seguinte: aparecem os horários até 02/12 e nenhum depois', l.some(x => x.data === '2026-12-02') && !l.some(x => x.data > '2026-12-02'), l.map(x => x.data).filter((v, i, a) => a.indexOf(v) === i));
  ok('D9 pedindo depois do limite: nenhum horário', livres('2026-12-07').length === 0);
  const idP = uuid();
  r = pac(P1, 'pacienteAgendarSessao', { dados: { id: idP, data: '2026-12-10', hora: '10:00', modalidade: 'presencial' } });
  ok('D10 o paciente tenta pedir um horário além do limite: recusado, e nenhum pedido é criado', r.ok === false && !aba('Pedidos_Agenda') || (r.ok === false && h.linhaDe(aba('Pedidos_Agenda'), 'id', idP) < 1), r);
  const lp = prof('profLerHorariosLivres', { de: '2026-12-07' });
  ok('D11 o profissional não tem limite: vê os horários livres de qualquer data', (lp.livres || []).some(x => x.data >= '2026-12-07'), (lp.livres || []).length);
  r = sessao(P2, { id: uuid(), data: '2026-12-21', hora: '10:00' });
  ok('D12 e marca sessão além do limite do paciente', r.ok === true, r.erro);
  grade({ agendar_primeiro: '0h', agendar_ultimo: '24s' });
  l = livres('2026-11-25');
  ok('D13 "Nesse instante" e "Dentro de 24 semanas": hoje às 15:00 aparece (falta 1 hora) e a agenda vai até 12/05/2027', l.some(x => x.data === '2026-11-25' && x.hora === '15:00') && resp('2026-11-25').agenda_ate === '2027-05-12' && livres('2026-12-28').length > 0, l.slice(0, 3));
  grade({ agendar_primeiro: 'xx', agendar_ultimo: '99s' }); grade({ agendar_ultimo: '' });
  c = cfg();
  ok('D14 valores fora da lista (e o vazio) são ignorados ao salvar', c.agendar_primeiro === '0h' && c.agendar_ultimo === '24s', c);
  grade({ agendar_primeiro: '24h', agendar_ultimo: '1s' });
});

/* ---------------------------------------------------------------- E */
console.log('E. Antecedência trocada pelo profissional (o paciente avisou por fora)');
tenta('E', () => {
  const idA = uuid(), idB = uuid(), idC = uuid(), idD = uuid(), idE = uuid();
  [[idA, '09:00'], [idB, '10:00'], [idC, '11:00'], [idD, '13:00']].forEach(x => sessao(P2, { id: x[0], data: '2026-11-26', hora: x[1] })); // amanhã: menos de 24 horas
  sessao(P2, { id: idE, data: '2026-12-03', hora: '09:00' }); // daqui a oito dias: dentro do prazo
  let s = simular(idA, { quem: 'paciente' });
  ok('E1 o relógio diz: sessão de amanhã cedo, fora do prazo (24), cobrada', s.no_prazo === false && s.proposta === 'Sim', s);
  let r = prof('profCancelarSessao', { id: idA, opcoes: { quem: 'paciente', no_prazo: true }, periodo: PER });
  ok('E2 o profissional diz "com 24 horas ou mais": fica dentro do prazo, não cobrada, e a antecedência fica gravada', r.ok === true && cel('Sessoes', idA, 'cobrada') === 'Nao' && cel('Sessoes', idA, 'cancel_no_prazo') === 'Sim', estadoDe(idA));
  r = prof('profCancelarSessao', { id: idB, opcoes: { quem: 'paciente', no_prazo: true, cobrar: true }, periodo: PER });
  ok('E3 e o clique de cobrança vale por cima: dentro do prazo, cobrada', r.ok === true && cel('Sessoes', idB, 'cobrada') === 'Sim' && cel('Sessoes', idB, 'cancel_no_prazo') === 'Sim', estadoDe(idB));
  r = prof('profCancelarSessao', { id: idE, opcoes: { quem: 'paciente', no_prazo: false }, periodo: PER });
  ok('E4 o contrário: sessão de daqui a oito dias marcada como "com menos de 24 horas" fica fora do prazo e cobrada', r.ok === true && cel('Sessoes', idE, 'cobrada') === 'Sim' && cel('Sessoes', idE, 'cancel_no_prazo') === 'Nao', estadoDe(idE));
  r = prof('profCancelarSessao', { id: idC, opcoes: { quem: 'profissional', no_prazo: false, cobrar: true }, periodo: PER });
  ok('E5 cancelada por mim: a antecedência não se aplica (fica em branco) e nunca é cobrada, mande o que mandar', r.ok === true && cel('Sessoes', idC, 'cobrada') === 'Nao' && cel('Sessoes', idC, 'cancel_no_prazo') === '', estadoDe(idC));
  r = prof('profCancelarSessao', { id: idD, opcoes: { quem: 'paciente' }, periodo: PER });
  ok('E6 sem trocar nada, vale o relógio: fora do prazo, cobrada', r.ok === true && cel('Sessoes', idD, 'cobrada') === 'Sim' && cel('Sessoes', idD, 'cancel_no_prazo') === 'Nao', estadoDe(idD));
  const lida = (prof('profLerAgenda', PER).sessoes || []).filter(x => x.id === idA)[0];
  ok('E7 a leitura do profissional devolve a antecedência gravada', !!lida && lida.cancel_no_prazo === 'Sim', lida && lida.cancel_no_prazo);
  const idP = uuid();
  sessao(P1, { id: idP, data: '2026-12-01', hora: '09:00' });
  r = pac(P1, 'pacienteCancelarSessao', { id: idP });
  ok('E8 cancelamento feito pelo paciente no sistema grava "dentro do prazo" (fora do prazo o sistema recusa)', r.ok === true && cel('Sessoes', idP, 'cancel_no_prazo') === 'Sim' && cel('Sessoes', idP, 'cancelada_por') === 'paciente', { r: r.erro, e: estadoDe(idP) });
  const m = (pac(P2, 'lerMinhasSessoes', {}).sessoes || []);
  ok('E9 a tela do paciente não recebe a coluna nova', m.every(x => !('cancel_no_prazo' in x)), m.slice(0, 1));
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura e versão');
tenta('T', () => {
  ok('T1 VERSAO_PACOTE do 14.20 em diante (o número exato é conferido em backend_16_11.js)', /^(14\.([2-9]\d)|[12]\d\.)/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE'));
  ok('T2 a regra sem configuração continua a tabela de sempre', S('_ageCobrada_')('falta', true, false) === 'Sim' && S('_ageCobrada_')('cancel_paciente', false, false) === 'Sim' && S('_ageCobrada_')('cancel_paciente', true, false) === 'Nao' && S('_ageCobrada_')('cancel_profissional', false, false) === 'Nao' && S('_ageCobrada_')('falta', true, true) === 'Nao' && S('_ageCobrada_')('realizada', true, false, { cobrar_falta: 'Nao' }) === 'Sim');
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T3 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
