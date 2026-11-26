/* Pacote 14.19 — cancelar pelo campo "Status da sessão" (etapa 3 do plano de correções, parte 2 de 5).
   No servidor: profCancelarSessao aceita quando o paciente avisou, o motivo, o clique de cobrar ou não cobrar e a
   simulação (as três linhas e a mensagem, sem gravar); a sessão cancelada continua na leitura do profissional;
   na falta, cobrar ou não cobrar com um clique.
   Blocos: A a simulação · B cancelar gravando · C a leitura · D a falta · T estrutura.
   Agora simulado: quarta, 25/11/2026, 14:00.
   Uso: node scripts/testes/backend_14_19.js */
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

const cancelar = (id, opcoes) => prof('profCancelarSessao', { id: id, opcoes: opcoes, periodo: PER });
const simular = (id, opcoes) => prof('profCancelarSessao', { id: id, opcoes: Object.assign({ simular: true }, opcoes) }).simulacao;
const linhasS = () => aba('Sessoes').getLastRow();

/* ---------------------------------------------------------------- A */
console.log('A. A simulação: as três linhas e a mensagem, sem gravar');
const idLonge = uuid(), idPerto = uuid(), idSerie = uuid();
tenta('A', () => {
  sessao(P1, { id: idLonge, data: '2026-12-02', hora: '10:00' });           // daqui a uma semana
  sessao(P1, { id: idPerto, data: '2026-11-26', hora: '09:00' });           // amanhã cedo: faltam 19 horas
  const antes = JSON.stringify(estadoDe(idLonge)) + linhasS();
  let s = simular(idLonge, { quem: 'paciente' });
  ok('A1 paciente cancela com mais de 24 horas: no prazo, a regra propõe não cobrar e ele pode trocar', !!s && s.quem === 'paciente' && s.no_prazo === true && s.horas === 24 && s.proposta === 'Nao' && s.cobrada === 'Nao' && s.pode_trocar === true && s.quantas === 1, s);
  ok('A2 a mensagem é o parágrafo do e-mail de cancelamento', s.previa === 'A sessão de 02/12/2026 às 10:00 com Dra. Nova de Prova foi cancelada. Para marcar outra data, acesse Minhas sessões.', s.previa);
  ok('A3 simular não grava nada', JSON.stringify(estadoDe(idLonge)) + linhasS() === antes && cel('Sessoes', idLonge, 'estado') === 'agendada');
  s = simular(idPerto, { quem: 'paciente' });
  ok('A4 paciente cancela com menos de 24 horas: fora do prazo, a regra propõe cobrar', s.no_prazo === false && s.proposta === 'Sim' && s.pode_trocar === true, s);
  s = simular(idPerto, { quem: 'paciente', avisou_em: '2026-11-24 18:00' });
  ok('A5 o paciente avisou anteontem à noite (por fora): conta daquele momento — no prazo, não cobrar', s.no_prazo === true && s.proposta === 'Nao', s);
  s = simular(idPerto, { quem: 'paciente', avisou_em: '2026-11-27 10:00' });
  ok('A6 "quando avisou" no futuro não vale: conta de agora', s.no_prazo === false && s.proposta === 'Sim', s);
  s = simular(idPerto, { quem: 'paciente', avisou_em: 'ontem' });
  ok('A7 "quando avisou" mal escrito: conta de agora', s.no_prazo === false && s.proposta === 'Sim', s);
  s = simular(idPerto, { quem: 'profissional' });
  ok('A8 cancelada por mim: nunca cobrada, e não há o que trocar', s.quem === 'profissional' && s.proposta === 'Nao' && s.pode_trocar === false, s);
  sessao(P2, { id: idSerie, data: '2026-12-03', hora: '14:00', repeticao: { cada: 1, unidade: 'semana', dias_semana: [4], fim_tipo: 'n', fim_n: 4 } });
  s = simular(idSerie, { quem: 'paciente', escopo: 'seguintes' });
  ok('A9 sessão recorrente, "esta e as seguintes": a simulação diz quantas saem (4)', s.quantas === 4, s);
  ok('A10 "só esta": uma', simular(idSerie, { quem: 'paciente', escopo: 'esta' }).quantas === 1);
});

/* ---------------------------------------------------------------- B */
console.log('B. Cancelar gravando');
tenta('B', () => {
  h.EMAILS.length = 0;
  let r = cancelar(idPerto, { quem: 'paciente', motivo: '  Viagem   a trabalho ' });
  ok('B1 fora do prazo, sem clique: cobrada; o motivo é guardado limpo e o momento do aviso é agora', r.ok === true && r.canceladas === 1 && r.cobrada === 'Sim' && cel('Sessoes', idPerto, 'estado') === 'cancelada' && cel('Sessoes', idPerto, 'cobrada') === 'Sim' && cel('Sessoes', idPerto, 'cancelada_por') === 'paciente' && cel('Sessoes', idPerto, 'cancel_motivo') === 'Viagem a trabalho' && cel('Sessoes', idPerto, 'cancel_avisou_em') === '2026-11-25 14:00', { r: r.cobrada, m: cel('Sessoes', idPerto, 'cancel_motivo'), a: cel('Sessoes', idPerto, 'cancel_avisou_em') });
  ok('B2 nenhum e-mail sai sozinho; a resposta diz "clique"', h.EMAILS.length === 0 && r.aviso === 'clique', r.aviso);
  const id2 = uuid(), id3 = uuid(), id4 = uuid(), id5 = uuid();
  [id2, id3, id4, id5].forEach((i, n) => sessao(P1, { id: i, data: '2026-11-26', hora: ['10:00', '11:00', '13:00', '15:00'][n] }));
  r = cancelar(id2, { quem: 'paciente', cobrar: false });
  ok('B3 fora do prazo, com o clique "Não cobrar": não cobrada', r.cobrada === 'Nao' && cel('Sessoes', id2, 'cobrada') === 'Nao' && cel('Sessoes', id2, 'cancelada_por') === 'paciente', estadoDe(id2));
  r = cancelar(idLonge, { quem: 'paciente', cobrar: true });
  ok('B4 no prazo, com o clique "Cobrar": cobrada', r.cobrada === 'Sim' && cel('Sessoes', idLonge, 'cobrada') === 'Sim', estadoDe(idLonge));
  r = cancelar(id3, { quem: 'paciente', avisou_em: '2026-11-24 09:00' });
  ok('B5 avisou antes (com mais de 24 horas): não cobrada, e o momento do aviso fica gravado', r.cobrada === 'Nao' && cel('Sessoes', id3, 'cancel_avisou_em') === '2026-11-24 09:00', estadoDe(id3));
  r = cancelar(id4, { quem: 'profissional', cobrar: true, avisou_em: '2026-11-24 09:00', motivo: 'Congresso' });
  ok('B6 cancelada por mim: não cobrada mesmo com o clique "Cobrar"; sem momento de aviso; motivo guardado', r.cobrada === 'Nao' && cel('Sessoes', id4, 'cobrada') === 'Nao' && cel('Sessoes', id4, 'cancelada_por') === 'profissional' && cel('Sessoes', id4, 'cancel_avisou_em') === '' && cel('Sessoes', id4, 'cancel_motivo') === 'Congresso', estadoDe(id4));
  r = cancelar(id5, { quem: 'paciente', motivo: '=SOMA(A1)' + 'x'.repeat(300) });
  ok('B7 motivo começando por "=" é gravado como texto e cortado em 200 letras', cel('Sessoes', id5, 'cancel_motivo').length <= 201 && /^'?=SOMA\(A1\)x+$/.test(cel('Sessoes', id5, 'cancel_motivo')), cel('Sessoes', id5, 'cancel_motivo').slice(0, 20));
  r = cancelar(idSerie, { quem: 'paciente', escopo: 'seguintes', cobrar: true });
  const serie = prof('profLerAgenda', PER).sessoes.filter(x => x.sigla === P2).sort((a, b) => (a.data < b.data ? -1 : 1));
  ok('B8 recorrentes, "esta e as seguintes" com o clique "Cobrar": o clique vale só para a sessão aberta; as seguintes seguem a regra (não cobradas)', r.canceladas === 4 && serie.length === 4 && serie[0].cobrada === 'Sim' && serie.slice(1).every(x => x.cobrada === 'Nao' && x.estado === 'cancelada'), serie.map(x => x.data + ' ' + x.cobrada));
  r = cancelar(idPerto, { quem: 'paciente' });
  ok('B9 cancelar de novo a mesma sessão: nada muda', r.ok === true && r.duplicado === true && r.canceladas === 0);
  ok('B10 simular sobre sessão já cancelada: recusado', prof('profCancelarSessao', { id: idPerto, opcoes: { simular: true } }).ok === false);
});

/* ---------------------------------------------------------------- C */
console.log('C. A leitura do profissional');
tenta('C', () => {
  const ag = prof('profLerAgenda', PER);
  const de = id => ag.sessoes.filter(x => x.id === id)[0];
  ok('C1 a cancelada sem cobrança continua na leitura, como cancelada, sem poder repor', !!de(idPerto) && ag.sessoes.filter(x => x.estado === 'cancelada' && x.cobrada === 'Nao').length >= 2 && ag.sessoes.filter(x => x.estado === 'cancelada' && x.cobrada === 'Nao').every(x => x.pode_repor === false));
  const p = de(idPerto);
  ok('C2 a cancelada traz quem cancelou, quando avisou, o motivo e a cobrança', p.estado === 'cancelada' && p.cancelada_por === 'paciente' && p.cancel_avisou_em === '2026-11-25 14:00' && p.cancel_motivo === 'Viagem a trabalho' && p.cobrada === 'Sim' && p.pode_repor === true, p);
  const livres = prof('profLerHorariosLivres', { de: '2026-11-26', ate: '2026-11-26' });
  ok('C3 a sessão cancelada não ocupa o horário: 09:00 de amanhã está livre de novo', (livres.livres || []).some(x => x.data === '2026-11-26' && x.hora === '09:00'), (livres.livres || []).map(x => x.hora));
  const nova = uuid();
  const r = sessao(P2, { id: nova, data: '2026-11-26', hora: '09:00' });
  ok('C4 e outra sessão pode ser marcada no mesmo horário', r.ok === true && cel('Sessoes', nova, 'estado') === 'agendada', r.erro);
  const m = pac(P1, 'lerMinhasSessoes', {});
  ok('C5 a tela do paciente não recebe o motivo', JSON.stringify(m).indexOf('Viagem a trabalho') === -1 && JSON.stringify(m).indexOf('cancel_motivo') === -1);
});

/* ---------------------------------------------------------------- D */
console.log('D. Falta: cobrar ou não cobrar com um clique');
tenta('D', () => {
  const idF = uuid();
  const base = { id: idF, data: '2026-11-24', hora: '09:00' };
  sessao(P1, base);
  let r = sessao(P1, Object.assign({}, base, { situacao: 'falta' }));
  ok('D1 falta sem clique: cobrada, como antes', r.ok === true && cel('Sessoes', idF, 'estado') === 'falta' && cel('Sessoes', idF, 'cobrada') === 'Sim');
  r = sessao(P1, Object.assign({}, base, { situacao: 'falta', cobrar: false }));
  ok('D2 a mesma falta com o clique "Não cobrar": não cobrada, e deixa de poder ser reposta', r.ok === true && cel('Sessoes', idF, 'cobrada') === 'Nao' && lida(idF).pode_repor === false, estadoDe(idF));
  r = sessao(P1, Object.assign({}, base, { situacao: 'falta', cobrar: true }));
  ok('D3 e de volta com "Cobrar"', cel('Sessoes', idF, 'cobrada') === 'Sim' && lida(idF).pode_repor === true);
  const idR = uuid();
  sessao(P1, { id: idR, data: '2026-12-09', hora: '09:00', reposicao_de: idF });
  r = sessao(P1, Object.assign({}, base, { situacao: 'falta', cobrar: false }));
  ok('D4 falta já reposta: "Não cobrar" é recusado', r.ok === false && /já foi reposta/.test(r.erro) && cel('Sessoes', idF, 'cobrada') === 'Sim', r.erro);
  r = sessao(P1, Object.assign({}, base, { situacao: 'realizada', cobrar: false }));
  ok('D5 o clique só vale para a falta: em "realizada" é ignorado', r.ok === false || cel('Sessoes', idF, 'cobrada') === 'Sim', estadoDe(idF));
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura e versão');
tenta('T', () => {
  ok('T1 VERSAO_PACOTE do 14.19 em diante (o número exato é conferido em backend_16_11.js)', /^(14\.(19|[2-9]\d)|[12]\d\.)/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE'));
  ok('T2 as duas colunas novas ficam no fim de Sessoes e foram criadas na planilha', S('COLUNAS_SESSOES').indexOf('cancel_avisou_em') === S('COLUNAS_SESSOES').indexOf('cancel_motivo') + 1 && h.cab(aba('Sessoes')).indexOf('cancel_motivo') !== -1 && h.cab(aba('Sessoes')).indexOf('cancel_avisou_em') !== -1);
  ok('T3 nenhuma ação nova; cancelar continua na trava e exige crachá', S('ACOES_COM_TRAVA').indexOf('profCancelarSessao') !== -1 && S('ACOES_PUBLICAS').indexOf('profCancelarSessao') === -1);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T4 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
