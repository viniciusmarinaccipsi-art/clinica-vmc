/* Pacote 14.26.1 — "Confirmar presença" só abre perto da sessão (padrão 48 horas; `confirmar_abre_horas` na Config_Agenda).
   Blocos: A perfil do paciente · B link sem senha · C e-mails · D configuração por profissional · T estrutura.
   Agora simulado: quarta, 25/11/2026, 14:00.
   Uso: node scripts/testes/backend_14_26_1.js */
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

/* ---------------------------------------------------------------- A */
console.log('A. Perfil do paciente');
const sLonge = uuid(), sPerto = uuid(), sBorda = uuid(), sFora = uuid();
tenta('A', () => {
  sessao(P1, { id: sLonge, data: '2026-12-02', hora: '10:00' });           // daqui a 7 dias
  sessao(P1, { id: sPerto, data: '2026-11-26', hora: '16:00' });           // daqui a 26 horas
  sessao(P1, { id: sBorda, data: '2026-11-27', hora: '14:00' });           // daqui a 48 horas exatas
  sessao(P2, { id: sFora, data: '2026-11-27', hora: '15:00' });            // daqui a 49 horas
  const r = pac(P1, 'lerMinhasSessoes', {});
  ok('A1 a leitura do paciente diz o número de horas (48, padrão)', r.confirmar_abre_horas === 48, r.confirmar_abre_horas);
  let m = minha(P1, sLonge);
  ok('A2 sessão a 7 dias: sem "Confirmar presença", com o dia e a hora em que abre (30/11, 10:00); cancelar e reagendar continuam', m.pode_confirmar === false && !!m.confirma_abre && m.confirma_abre.data === '2026-11-30' && m.confirma_abre.hora === '10:00' && m.pode_cancelar === true && m.pode_remarcar === true, m);
  m = minha(P1, sPerto);
  ok('A3 sessão a 26 horas: "Confirmar presença" aparece e não há aviso de abertura', m.pode_confirmar === true && m.confirma_abre === null, m);
  m = minha(P1, sBorda);
  ok('A4 sessão a 48 horas exatas: já pode confirmar', m.pode_confirmar === true && m.confirma_abre === null, m);
  m = minha(P2, sFora);
  ok('A5 sessão a 49 horas: ainda não (abre 25/11, 15:00)', m.pode_confirmar === false && m.confirma_abre.data === '2026-11-25' && m.confirma_abre.hora === '15:00', m);
  let c = pac(P1, 'pacienteConfirmarSessao', { id: sLonge });
  ok('A6 o servidor recusa a confirmação antes da hora, com a frase de quando abre, e nada é gravado', c.ok === false && c.erro === 'A confirmação abre em 30/11/2026, às 10:00.' && cel('Sessoes', sLonge, 'confirmada_em') === '', c);
  c = pac(P1, 'pacienteConfirmarSessao', { id: sPerto });
  ok('A7 dentro da janela a confirmação grava e a sessão volta confirmada', c.ok === true && cel('Sessoes', sPerto, 'confirmada_em') !== '' && minha(P1, sPerto).confirmada === true, c.ok);
  irPara(2026, 11, 30, 10, 0);
  m = minha(P1, sLonge);
  ok('A8 no dia 30/11 às 10:00 a mesma sessão passa a oferecer a confirmação', m.pode_confirmar === true && m.confirma_abre === null, m);
  c = pac(P1, 'pacienteConfirmarSessao', { id: sLonge });
  ok('A9 e aí o servidor aceita', c.ok === true && cel('Sessoes', sLonge, 'confirmada_em') !== '', c.ok);
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- B */
console.log('B. Link sem senha');
const sLink = uuid(), sLinkOn = uuid();
tenta('B', () => {
  sessao(P2, { id: sLink, data: '2026-12-03', hora: '09:00' });
  sessao(P2, { id: sLinkOn, data: '2026-12-04', hora: '09:00', modalidade: 'online' });
  const t = tokenDe(sLink);
  let r = pub({ t: t });
  ok('B1 link tocado antes da hora: não confirma, código "cedo", frase de quando abre', r.ok === false && r.codigo === 'cedo' && r.erro === 'A confirmação abre em 01/12/2026, às 09:00.' && r.abre.data === '2026-12-01' && r.abre.hora === '09:00' && cel('Sessoes', sLink, 'confirmada_em') === '', r);
  ok('B2 a resposta continua sem nome, sigla ou telefone (só dia, hora, modalidade e onde)', Object.keys(r).sort().join(',') === 'abre,codigo,data,endereco,erro,estado,hora,mapa,meet_link,modalidade,ok', Object.keys(r));
  irPara(2026, 12, 1, 9, 0);
  r = pub({ t: t });
  ok('B3 o MESMO link, dentro da janela, confirma', r.ok === true && r.ja_confirmada === false && cel('Sessoes', sLink, 'confirmada_em') !== '', r);
  r = pub({ t: t });
  ok('B4 aberto de novo: já estava confirmada', r.ok === true && r.ja_confirmada === true, r);
  irPara(2026, 11, 25, 14, 0);
  // sessão confirmada antes do pacote (a planilha já tem a marca): continua confirmada, e o link diz isso mesmo longe da data
  h.memo();
  const a = aba('Sessoes');
  a.getRange(h.linhaDe(a, 'id', sLinkOn), a.getRange(1, 1, 1, a.getLastColumn()).getValues()[0].indexOf('confirmada_em') + 1).setValue("'2026-11-20 10:00");
  h.memo();
  r = pub({ t: tokenDe(sLinkOn) });
  ok('B5 sessão que já estava confirmada cedo continua confirmada (link e perfil)', r.ok === true && r.ja_confirmada === true && minha(P2, sLinkOn).confirmada === true && minha(P2, sLinkOn).confirma_abre === null, r);
});

/* ---------------------------------------------------------------- C */
console.log('C. E-mails');
tenta('C', () => {
  const sE1 = uuid(), sE2 = uuid();
  sessao(P1, { id: sE1, data: '2026-12-08', hora: '10:00' });
  sessao(P1, { id: sE2, data: '2026-11-27', hora: '10:00' });
  h.EMAILS.length = 0;
  let r = avisar(sE1);
  let e = aoPaciente()[0];
  ok('C1 e-mail do agendamento com mais de 48 horas: sai, com o botão "Ver minhas sessões" e sem link de confirmar', r.ok === true && r.enviado === true && !!e && html(e).indexOf('Ver minhas sessões') !== -1 && html(e).indexOf('Confirmar presença') === -1 && html(e).indexOf('?confirmar=') === -1 && String(e.body).indexOf('?confirmar=') === -1, r);
  h.EMAILS.length = 0;
  r = avisar(sE2);
  e = aoPaciente()[0];
  ok('C2 e-mail do agendamento com menos de 48 horas: botão "Confirmar presença" com o link', r.ok === true && !!e && html(e).indexOf('Confirmar presença') !== -1 && html(e).indexOf('?confirmar=') !== -1, r);
  h.EMAILS.length = 0;
  irPara(2026, 12, 6, 11, 0);
  const g = gatilho(new Real(2026, 11, 6, 11, 0, 0));
  e = aoPaciente().filter(x => html(x).indexOf('08/12/2026') !== -1)[0];
  ok('C3 o lembrete de 48 horas (47 h antes) leva o botão "Confirmar presença" com o link', !!e && html(e).indexOf('Confirmar presença') !== -1 && html(e).indexOf('?confirmar=') !== -1, g);
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- D */
console.log('D. Configuração por profissional');
tenta('D', () => {
  const sD = uuid();
  sessao(P2, { id: sD, data: '2026-11-27', hora: '08:00' });               // daqui a 42 horas
  ok('D1 com 48 horas (padrão) a sessão a 42 horas pode ser confirmada', minha(P2, sD).pode_confirmar === true);
  let r = grade({ confirmar_abre_horas: 36 });
  ok('D2 o profissional muda para 36 horas: grava na Config_Agenda e a leitura devolve', r.ok === true && S('_ageConfigLer_')(h.ctrl).confirmar_abre_horas === 36 && pac(P2, 'lerMinhasSessoes', {}).confirmar_abre_horas === 36, r.ok);
  let m = minha(P2, sD);
  ok('D3 com 36 horas a mesma sessão ainda não abre (abre 25/11, 20:00)', m.pode_confirmar === false && m.confirma_abre.data === '2026-11-25' && m.confirma_abre.hora === '20:00', m);
  r = grade({ confirmar_abre_horas: 0 });
  ok('D4 valor fora da faixa não é gravado (continua 36)', S('_ageConfigLer_')(h.ctrl).confirmar_abre_horas === 36);
  grade({ confirmar_abre_horas: 48 });
  ok('D5 de volta a 48 horas', S('_ageConfigLer_')(h.ctrl).confirmar_abre_horas === 48 && minha(P2, sD).pode_confirmar === true);
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura');
tenta('T', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('T1 o padrão é 48', /var CONFIRMAR_ABRE_PADRAO = 48;/.test(src));
  ok('T2 nenhuma ação nova e nenhuma ação pública nova', S('ACOES_PUBLICAS').join(',') === 'ping,autenticar,pedirRedefinicao,definirSenha,confirmarSessaoPorLink,concluirConexaoAgenda' && (src.match(/\n      case '/g) || []).length === 101, [S('ACOES_PUBLICAS'), (src.match(/\n      case '/g) || []).length]);
  ok('T3 as três portas da confirmação passam pela mesma regra', (src.match(/_ageConfirmaAberta_\(/g) || []).length >= 6);
  const A = S('_ageConfirmaAberta_'), E = S('_ageConfirmaAbreEm_');
  const ag = { data: '2026-11-25', hora: '14:00' };
  ok('T4 regra pura: 48 h exatas abre; 48 h e 1 min não; sessão que já começou não', A('2026-11-27', '14:00', ag, { confirmar_abre_horas: 48 }) === true && A('2026-11-27', '14:01', ag, { confirmar_abre_horas: 48 }) === false && A('2026-11-25', '14:00', ag, { confirmar_abre_horas: 48 }) === false);
  ok('T5 quando abre: atravessa o dia e o mês', JSON.stringify(E('2026-12-01', '08:30', { confirmar_abre_horas: 48 })) === '{"data":"2026-11-29","hora":"08:30"}' && JSON.stringify(E('2026-12-01', '08:30', { confirmar_abre_horas: 36 })) === '{"data":"2026-11-29","hora":"20:30"}');
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T6 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
