/* Pacote 14.29 — ordem dos horários ao reagendar: as sugestões logo depois da sessão, pela frequência do paciente.
   Blocos: A regra pura · B paciente semanal · C quinzenal e avulso · D limites · E frequência no cadastro · T estrutura.
   Agora simulado: quarta, 25/11/2026, 14:00. A grade da prova atende de segunda a sexta, das 8h às 18h.
   Uso: node scripts/testes/backend_14_29.js */
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

const ler = (sig, extra) => pac(sig, 'lerHorariosLivres', Object.assign({ de: '2026-11-26' }, extra || {}));
const recorrente = (sig, id, data, cada, hora) => prof('profSalvarSessao', { periodo: PER, dados: { id: id, sigla: sig, data: data, hora: hora || '10:00', duracao_min: 60, modalidade: 'presencial', valor: '300', notas: '', avisos: TODAS,
  repeticao: { cada: cada, unidade: 'semana', dias_semana: [4], fim_tipo: 'n', fim_n: 4 } } });

/* ---------------------------------------------------------------- A */
console.log('A. A regra da janela');
tenta('A', () => {
  const J = S('_ageJanelaReagendar_');
  ok('A1 sessão avulsa não tem janela', J(null) === 0 && J(undefined) === 0);
  ok('A2 semanal: 3 dias; quinzenal: 7; a cada três ou quatro semanas e mensal: 14', J({ cada: '1', unidade: 'semana' }) === 3 && J({ cada: '2', unidade: 'semana' }) === 7 && J({ cada: '3', unidade: 'semana' }) === 14 && J({ cada: '4', unidade: 'semana' }) === 14 && J({ cada: '1', unidade: 'mes' }) === 14);
});

/* ---------------------------------------------------------------- B */
console.log('B. Paciente semanal');
const sSem = uuid();
tenta('B', () => {
  const r0 = recorrente(P1, sSem, '2026-12-03', 1);
  ok('B0 quatro sessões semanais às quintas, a partir de 03/12', r0.ok === true && cel('Sessoes', sSem, 'serie_id') !== '', r0.erro);
  let r = ler(P1, { sessao: sSem });
  ok('B1 ao reagendar a sessão de quinta, 03/12, a leitura traz a janela de 3 dias', r.ok === true && r.janela_dias === 3, r.janela_dias);
  ok('B2 as sugestões são os horários livres de sexta, 04/12 (sábado e domingo não têm atendimento)', r.sugeridos.length > 0 && r.sugeridos.every(x => x.data === '2026-12-04'), r.sugeridos.map(x => x.data + ' ' + x.hora).slice(0, 4));
  ok('B3 a lista comum continua igual (a semana pedida, a partir de hoje)', JSON.stringify(r.livres) === JSON.stringify(ler(P1).livres) && r.livres.length > 0);
  ok('B4 sem dizer qual sessão, a leitura não traz sugestões (agendar e repor ficam como antes)', ler(P1).sugeridos === undefined && ler(P1).janela_dias === undefined);
  sessao(P2, { data: '2026-12-04', hora: '09:00' });
  r = ler(P1, { sessao: sSem });
  ok('B5 horário ocupado por outro paciente não é sugerido', r.sugeridos.every(x => !(x.data === '2026-12-04' && x.hora === '09:00')) && r.sugeridos.length > 0);
  ok('B6 a sessão de outro paciente não gera sugestões para quem pergunta', ler(P2, { sessao: sSem }).sugeridos === undefined);
  ok('B7 a resposta não leva nada do profissional além dos horários', Object.keys(r).sort().join(',') === 'agenda_ate,de,hoje,janela_dias,livres,ok,sugeridos', Object.keys(r));
});

/* ---------------------------------------------------------------- C */
console.log('C. Quinzenal e sessão avulsa');
tenta('C', () => {
  const sQ = uuid(), sAv = uuid();
  recorrente(P2, sQ, '2026-12-10', 2, '14:00'); // outro horário: às 10h as quintas já são do paciente semanal
  let r = ler(P2, { sessao: sQ });
  ok('C1 quinzenal: janela de 7 dias, de 11/12 a 17/12', r.janela_dias === 7 && r.sugeridos.length > 0 && r.sugeridos.every(x => x.data >= '2026-12-11' && x.data <= '2026-12-17') && r.sugeridos.some(x => x.data > '2026-12-13'), [r.janela_dias, r.sugeridos.length, Array.from(new Set(r.sugeridos.map(x => x.data)))]);
  sessao(P1, { id: sAv, data: '2026-12-01', hora: '15:00' });
  r = ler(P1, { sessao: sAv });
  ok('C2 sessão avulsa: sem janela e sem sugestões', r.janela_dias === 0 && r.sugeridos.length === 0, r.janela_dias);
});

/* ---------------------------------------------------------------- D */
console.log('D. Limites');
tenta('D', () => {
  grade({ agendar_ultimo: '1s' });
  let r = ler(P1, { sessao: sSem });
  ok('D1 com a agenda aberta só por uma semana (até 02/12), os dias depois de 03/12 ainda não estão abertos: sem sugestões', r.janela_dias === 3 && r.sugeridos.length === 0, r.sugeridos.length);
  grade({ agendar_ultimo: '24s' });
  ok('D2 de volta ao período largo, as sugestões voltam', ler(P1, { sessao: sSem }).sugeridos.length > 0);
  pac(P1, 'pacienteCancelarSessao', { id: sSem });
  ok('D3 sessão já cancelada não gera sugestões', ler(P1, { sessao: sSem }).sugeridos === undefined);
});

/* ---------------------------------------------------------------- E */
console.log('E. Frequência das sessões no cadastro do paciente');
tenta('E', () => {
  const P3 = novo('Carla Terceira', 'p3@exemplo.test');
  const sE = uuid();
  sessao(P3, { id: sE, data: '2026-12-08', hora: '15:00' });   // sessão avulsa, terça
  const cad = () => prof('profEditarPaciente', { siglaPaciente: P3 }).cadastro;
  const salvar = f => prof('profEditarPaciente', { siglaPaciente: P3, id_envio: uuid(), dados: { nome: 'Carla Terceira', email: 'p3@exemplo.test', telefone: '', cpf: '', frequencia: f } });
  ok('E1 paciente sem escolha e sem sessões recorrentes: frequência vazia, nenhuma sugerida, sem sugestões', cad().frequencia === '' && cad().frequencia_sugerida === '' && ler(P3, { sessao: sE }).janela_dias === 0);
  let r = salvar('semanal');
  ok('E2 o profissional escolhe "Semanal": grava no cadastro e a resposta devolve', r.ok === true && r.cadastro.frequencia === 'semanal' && cad().frequencia === 'semanal', r.erro);
  let l = ler(P3, { sessao: sE });
  ok('E3 a sessão avulsa passa a ter sugestões: os três dias depois de 08/12', l.janela_dias === 3 && l.sugeridos.length > 0 && l.sugeridos.every(x => x.data >= '2026-12-09' && x.data <= '2026-12-11'), [l.janela_dias, l.sugeridos.length]);
  salvar('quinzenal');
  ok('E4 "Quinzenal": janela de 7 dias', ler(P3, { sessao: sE }).janela_dias === 7);
  salvar('mensal');
  ok('E5 "Mensal": janela de 14 dias', ler(P3, { sessao: sE }).janela_dias === 14);
  salvar('livre');
  ok('E6 "Sem frequência fixa": sem sugestões', ler(P3, { sessao: sE }).janela_dias === 0 && ler(P3, { sessao: sE }).sugeridos.length === 0);
  r = salvar('toda hora');
  ok('E7 valor que não existe não é gravado (continua o anterior)', r.ok === true && cad().frequencia === 'livre');
  r = prof('profEditarPaciente', { siglaPaciente: P3, id_envio: uuid(), dados: { nome: 'Carla Terceira', email: 'p3@exemplo.test', telefone: '', cpf: '' } });
  ok('E8 salvar sem o campo (página antiga) não apaga a frequência', r.ok === true && cad().frequencia === 'livre');
  const sR = uuid();
  recorrente(P3, sR, '2027-01-07', 2, '16:00');
  salvar('livre');
  ok('E9 a escolha do cadastro vale sobre a recorrência: quinzenal na agenda, "sem frequência fixa" no cadastro, sem sugestões', ler(P3, { sessao: sR }).janela_dias === 0 && cad().frequencia_sugerida === 'quinzenal', cad());
  ok('E10 paciente não lê nem grava a frequência', pac(P3, 'profEditarPaciente', { siglaPaciente: P3 }).ok === false && !/frequencia/.test(JSON.stringify(pac(P3, 'lerMinhasSessoes', {}))));
  const outra = h.post({ acao: 'profEditarPaciente', siglaPaciente: P3 });
  ok('E11 sem crachá não lê', outra.ok === false);
});

/* ---------------------------------------------------------------- T */
console.log('T. Estrutura');
tenta('T', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('T1 VERSAO_PACOTE = 14.29', S('VERSAO_PACOTE') === '14.29');
  ok('T2 nenhuma ação, aba ou coluna nova', (src.match(/\n      case '/g) || []).length === 101 && S('COLUNAS_SERIES').length === 12);
  const p = prof('profLerHorariosLivres', { de: '2026-11-26' });
  ok('T3 a leitura do profissional não mudou: sem sugestões e sem janela', p.ok === true && p.sugeridos === undefined && p.janela_dias === undefined);
  ok('T4 nada foi gravado pela leitura das sugestões', (src.match(/_ageSugestoes_\(/g) || []).length === 2);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T5 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
