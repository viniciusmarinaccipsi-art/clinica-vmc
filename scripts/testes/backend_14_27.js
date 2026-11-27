/* Pacote 14.27 — histórico de eventos da sessão (aba `Eventos_Sessoes` na Controle) e dados do balão da grade.
   Blocos: A o que é registrado · B o histórico lido · C e-mails e WhatsApp · D balão · E sessão antiga, sem registro · T estrutura.
   Agora simulado: quarta, 25/11/2026, 14:00.
   Uso: node scripts/testes/backend_14_27.js */
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
const abaEv = () => aba('Eventos_Sessoes');
const evs = id => { const a = abaEv(); if (!a) return []; const v = a.getDataRange().getValues(); return v.slice(1).filter(l => String(l[1]).replace(/^'/, '') === id).map(l => ({ em: String(l[2]).replace(/^'/, ''), tipo: String(l[3]).replace(/^'/, ''), quem: String(l[4]).replace(/^'/, ''), det: String(l[5]).replace(/^'/, '') })); };
const hist = id => prof('profLerHistoricoSessao', { id: id });
const textos = id => (hist(id).eventos || []).map(e => e.texto);

/* ---------------------------------------------------------------- A */
console.log('A. O que é registrado');
const s1 = uuid(), s2 = uuid();
tenta('A', () => {
  ok('A0 antes do primeiro evento a aba não existe', abaEv() === null);
  sessao(P1, { id: s1, data: '2026-11-26', hora: '16:00' });
  ok('A1 criar uma sessão não escreve no registro (a criação sai da própria sessão) e não cria a aba', abaEv() === null && evs(s1).length === 0);
  prof('profSalvarSessao', { periodo: PER, dados: { id: s1, sigla: P1, data: '2026-11-26', hora: '17:00', duracao_min: 60, modalidade: 'presencial', valor: '300', notas: '', avisos: TODAS } });
  let e = evs(s1);
  ok('A2 mudar a hora registra "mudou", por quem e de quando para quando; a aba nasce aqui', e.length === 1 && e[0].tipo === 'mudou' && e[0].quem === 'profissional' && e[0].det === '2026-11-26 16:00>2026-11-26 17:00' && e[0].em === '2026-11-25 14:00', e);
  prof('profSalvarSessao', { periodo: PER, dados: { id: s1, sigla: P1, data: '2026-11-26', hora: '17:00', duracao_min: 60, modalidade: 'presencial', valor: '300', notas: 'só a nota', avisos: TODAS } });
  ok('A3 salvar sem mudar dia, hora nem status não registra nada', evs(s1).length === 1, evs(s1));
  pac(P1, 'pacienteConfirmarSessao', { id: s1 });
  e = evs(s1);
  ok('A4 a confirmação do paciente é registrada como dele', e.length === 2 && e[1].tipo === 'confirmou' && e[1].quem === 'paciente', e);
  pac(P1, 'pacienteConfirmarSessao', { id: s1 });
  ok('A5 confirmar de novo não repete o evento', evs(s1).length === 2);
  irPara(2026, 11, 26, 18, 30);
  prof('profMarcarSituacao', { id: s1, situacao: 'realizada', periodo: PER });
  e = evs(s1);
  ok('A6 marcar o status registra "status: realizada"', e.length === 3 && e[2].tipo === 'status' && e[2].det === 'realizada' && e[2].em === '2026-11-26 18:30', e);
  irPara(2026, 11, 25, 14, 0);
  sessao(P2, { id: s2, data: '2026-11-26', hora: '09:00' });
  pac(P2, 'pacienteCancelarSessao', { id: s2 });
  e = evs(s2);
  ok('A7 cancelamento do paciente fora do prazo: registrado com quem, cobrança e prazo', e.length === 1 && e[0].tipo === 'cancelada' && e[0].quem === 'paciente' && e[0].det === 'paciente|Sim|Nao', e);
});

/* ---------------------------------------------------------------- B */
console.log('B. O histórico lido');
tenta('B', () => {
  const r = hist(s1);
  ok('B1 a leitura responde com a lista do mais novo ao mais antigo', r.ok === true && r.id === s1 && r.eventos.length === 4 && r.eventos.every((e, i) => i === 0 || r.eventos[i - 1].em >= e.em), r);
  const t = r.eventos.map(e => e.texto);
  ok('B2 os textos: status, confirmação, mudança de hora e criação', t[0] === 'Status marcado por você: Realizada.' && t.indexOf('O paciente confirmou a presença.') !== -1 && t.indexOf('Dia ou hora alterados por você: de 26/11 às 16:00 para 26/11 às 17:00.') !== -1 && t.indexOf('Sessão criada por você.') !== -1, t);
  ok('B3 nenhum evento marcado como falha', r.eventos.every(e => e.erro === false));
  ok('B4 a sessão cancelada pelo paciente conta quem cancelou, o prazo e a cobrança', textos(s2).indexOf('Sessão cancelada pelo paciente, fora do prazo, cobrada.') !== -1, textos(s2));
  ok('B5 sessão que não existe: recusa', hist('nao-existe').ok === false);
  const outro = h.post({ acao: 'profLerHistoricoSessao', id: s1 });
  ok('B6 sem crachá não lê', outro.ok === false, outro);
  ok('B7 a leitura não traz nome, sigla, telefone nem e-mail do paciente', !/Paula|Pedro|exemplo\.test/.test(JSON.stringify(r)), r);
});

/* ---------------------------------------------------------------- C */
console.log('C. E-mails e WhatsApp');
const s3 = uuid(), s4 = uuid();
tenta('C', () => {
  sessao(P1, { id: s3, data: '2026-12-08', hora: '10:00' });
  h.EMAILS.length = 0;
  let r = avisar(s3);
  ok('C1 e-mail pelo clique: sai, entra no histórico como "pelo seu clique" e vira o último aviso da sessão', r.enviado === true && aoPaciente().length === 1 && textos(s3)[0] === 'E-mail do agendamento enviado, pelo seu clique.' && /^confirmacao\|2026-11-25 14:00$/.test(cel('Sessoes', s3, 'aviso_ultimo')), [textos(s3), cel('Sessoes', s3, 'aviso_ultimo')]);
  const SP = novo('Sem Email', 'sem@exemplo.test'); h.abaPac.getRange(h.linhaDe(h.abaPac, 'sigla', SP), h.abaPac.getRange(1, 1, 1, h.abaPac.getLastColumn()).getValues()[0].indexOf('email') + 1).setValue(''); h.memo();
  sessao(SP, { id: s4, data: '2026-12-09', hora: '10:00' });
  r = avisar(s4);
  const hs = hist(s4).eventos;
  ok('C2 paciente sem e-mail: não sai, e o histórico diz por quê, marcado como falha', r.enviado === false && hs[0].texto === 'E-mail do agendamento não foi enviado: paciente sem e-mail.' && hs[0].erro === true && cel('Sessoes', s4, 'aviso_ultimo') === '', hs);
  r = prof('profRegistrarWhatsApp', { id: s3 });
  ok('C3 o toque no WhatsApp é registrado', r.ok === true && textos(s3)[0] === 'WhatsApp aberto por você, com a mensagem da sessão.', textos(s3));
  ok('C4 WhatsApp de sessão que não existe: recusa, nada gravado', prof('profRegistrarWhatsApp', { id: 'nao-existe' }).ok === false);
  h.EMAILS.length = 0;
  irPara(2026, 12, 6, 11, 0);
  gatilho(new Real(2026, 11, 6, 11, 0, 0));
  const t = textos(s3);
  ok('C5 o lembrete de 48 horas do gatilho entra no histórico como "sozinho" e vira o último aviso', aoPaciente().length >= 1 && t[0] === 'Lembrete de 48 horas enviado, sozinho.' && /^lembrete48\|2026-12-06 11:00$/.test(cel('Sessoes', s3, 'aviso_ultimo')), [t, cel('Sessoes', s3, 'aviso_ultimo')]);
  ok('C6 o lembrete não aparece duas vezes (registro e marca)', t.filter(x => /Lembrete de 48 horas/.test(x)).length === 1, t);
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- D */
console.log('D. Balão da grade');
tenta('D', () => {
  const sA = uuid(), sB = uuid(), sC = uuid();
  sessao(P2, { id: sA, data: '2026-12-10', hora: '10:00' });
  sessao(P2, { id: sB, data: '2026-12-17', hora: '10:00' });
  sessao(P2, { id: sC, data: '2026-11-26', hora: '15:00' });
  let a = lida(sA), b = lida(sB), c = lida(sC);
  ok('D1 "próxima sessão": a de 10/12 aponta 17/12; a última não aponta nenhuma', a.proxima === '2026-12-17' && b.proxima === '', [a.proxima, b.proxima]);
  ok('D2 longe da data, a leitura diz quando a confirmação abre; dentro das 48 horas, não', !!a.confirma_abre && a.confirma_abre.data === '2026-12-08' && a.confirma_abre.hora === '10:00' && c.confirma_abre === null, [a.confirma_abre, c.confirma_abre]);
  ok('D3 sem aviso enviado, o último aviso vem vazio; o telefone do paciente vem na sessão', a.aviso_ultimo === null && typeof a.telefone === 'string');
  ok('D4 a sessão com e-mail enviado traz o último aviso', lida(s3).aviso_ultimo && lida(s3).aviso_ultimo.tipo === 'lembrete48' && lida(s3).aviso_ultimo.em === '2026-12-06 11:00', lida(s3).aviso_ultimo);
  pac(P2, 'pacienteConfirmarSessao', { id: sC });
  c = lida(sC);
  ok('D5 confirmada: a leitura traz quando', c.confirmada === true && c.confirmada_em === '2026-11-25 14:00' && c.confirma_abre === null, c.confirmada_em);
});

/* ---------------------------------------------------------------- E */
console.log('E. Sessão antiga, sem registro');
tenta('E', () => {
  const sV = uuid();
  sessao(P1, { id: sV, data: '2026-12-15', hora: '08:00' });
  h.memo();
  const a = aba('Sessoes'), cab = a.getRange(1, 1, 1, a.getLastColumn()).getValues()[0], ln = h.linhaDe(a, 'id', sV);
  const por = (col, v) => a.getRange(ln, cab.indexOf(col) + 1).setValue("'" + v);
  por('criado_em', '2026-11-10 09:00'); por('confirmada_em', '2026-11-12 08:00'); por('lembrete48_em', '2026-11-13 08:00'); por('ultimo_aviso_em', 'dispensado');
  h.memo();
  const r = hist(sV), t = r.eventos.map(e => e.texto);
  ok('E1 sessão anterior ao primeiro registro: o histórico avisa que pode estar incompleto e diz desde quando há registro', r.incompleto === true && r.desde === '2026-11-25', [r.incompleto, r.desde]);
  ok('E2 o que as marcas da sessão contam aparece: criação, confirmação e o lembrete de 48 horas; "dispensado" não vira evento', t.length === 3 && t[0] === 'Lembrete de 48 horas enviado, sozinho.' && t[1] === 'O paciente confirmou a presença.' && t[2] === 'Sessão criada por você.', t);
  ok('E3 sessão criada depois do primeiro registro não é incompleta', hist(s3).incompleto === false);
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura');
tenta('T', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('T1 VERSAO_PACOTE = 14.27', S('VERSAO_PACOTE') === '14.27');
  ok('T2 duas ações novas, as duas com crachá; só a que grava está na trava', (src.match(/\n      case '/g) || []).length === 101 && S('ACOES_COM_TRAVA').indexOf('profRegistrarWhatsApp') !== -1 && S('ACOES_COM_TRAVA').indexOf('profLerHistoricoSessao') === -1 && S('ACOES_PUBLICAS').indexOf('profLerHistoricoSessao') === -1 && S('ACOES_PUBLICAS').indexOf('profRegistrarWhatsApp') === -1);
  ok('T3 a aba nova tem as seis colunas', S('COLUNAS_EVENTOS_SESSOES').join(',') === 'id,sessao_id,em,tipo,quem,detalhe' && abaEv().getRange(1, 1, 1, 6).getValues()[0].join(',') === 'id,sessao_id,em,tipo,quem,detalhe');
  ok('T4 nenhum evento guarda nome, e-mail ou telefone', !/Paula|Pedro|exemplo\.test|@/.test(JSON.stringify(abaEv().getDataRange().getValues())));
  ok('T5 uma coluna nova no fim de Sessoes', S('COLUNAS_SESSOES').slice(-1)[0] === 'aviso_ultimo');
  ok('T6 nenhuma regra de ocupação ou de cobrança lê o registro', (src.match(/ABA_EVENTOS_SESSOES/g) || []).length === 3);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T7 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
