/* Pacote 20.2 — Status das sessões: o `Código.js` real sobre planilhas simuladas, relógio fixo (começa em 25/11/2026, quarta, 14:00).
   Blocos: A regras puras (status pendente, quando cada e-mail vence, textos) · B o bloco do Início e a ação que informa o status ·
   C as chaves na Grade e a trava da conta · D o gatilho e os dois e-mails ao profissional · T listas, trava e fonte.
   Dados inventados. Sem argumento, roda duas vezes: no fuso de São Paulo e em UTC.
   Uso: node scripts/testes/backend_20_2.js */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

if (!process.env.VMC_FUSO_20_2) {
  const partes = ['America/Sao_Paulo', 'UTC'].map(tz => {
    const r = spawnSync(process.execPath, [__filename], { stdio: 'inherit', env: Object.assign({}, process.env, { TZ: tz, VMC_FUSO_20_2: tz }) });
    return { tz: tz, saida: r.status };
  });
  const ruim = partes.some(p => p.saida !== 0);
  console.log('\nRESULTADO: ' + (ruim ? 'FALHA' : 'OK') + ' — ' + partes.map(p => p.tz + ': ' + (p.saida === 0 ? 'ok' : 'falhou')).join(' · '));
  process.exit(ruim ? 1 : 0);
}
console.log('=== fuso ' + process.env.VMC_FUSO_20_2 + ' ===');

const ARNES = path.join(__dirname, 'backend_18_10a.js');
const MARCA = "console.log('C. controle_id');";
const Real = Date;
let AGORA = new Real(2026, 10, 25, 14, 0, 0).getTime();
class DataFixa extends Real {
  constructor(...a) { if (a.length) super(...a); else super(AGORA); }
  static now() { return AGORA; }
}
const irPara = (ano, mes, dia, hh, mm) => { AGORA = new Real(ano, mes - 1, dia, hh || 0, mm || 0, 0).getTime(); };
const fonte = fs.readFileSync(ARNES, 'utf8');
const fim = fonte.indexOf(MARCA);
if (fim === -1) { console.log('RESULTADO: FALHA — não achei o fim do arnês'); process.exit(1); }
const av = new Function('require', '__dirname', 'Date', fonte.slice(0, fim) + '\nreturn function (__src) { return eval(__src); };')(require, __dirname, DataFixa);
const logServidor = [];
console.error = (...a) => { logServidor.push(a.map(String).join(' ')); };
const CACHE = new Map();
const cacheObj = { get: k => (CACHE.has(k) ? CACHE.get(k) : null), getAll: ks => { const r = {}; (ks || []).forEach(k => { if (CACHE.has(k)) r[k] = CACHE.get(k); }); return r; },
  put: (k, v) => { CACHE.set(k, String(v)); }, putAll: o => { Object.keys(o || {}).forEach(k => CACHE.set(k, String(o[k]))); }, remove: k => { CACHE.delete(k); }, removeAll: ks => { (ks || []).forEach(k => CACHE.delete(k)); } };
global.CacheService = { getScriptCache: () => cacheObj };
// o que o arnês não simula e o envio de e-mail usa: o logo embutido
global.Utilities.base64Decode = s => Array.from(Buffer.from(String(s), 'base64')).map(x => (x > 127 ? x - 256 : x));
let DONO = 'np@exemplo.test'; // o profissional do arnês é o dono do script (a trava dos e-mails olha isso)
global.Session = { getEffectiveUser: () => ({ getEmail: () => DONO }) };

const h = av('({ post: post, cracha: cracha, novoPaciente: novoPaciente, celula: celula, linhaDe: linhaDe, cab: cab, abaPac: abaPac, ctrl: ctrl, EMAILS: EMAILS, memo: _memoZerar_, aceite: _gravarAceitePolitica_, hashProf: hashProf })');
const S = nome => av(nome);
let falhas = 0, passo = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 900) : '')); } };
const tenta = (n, f) => { try { f(); } catch (e) { ok(n + ' (exceção)', false, String(e && e.stack || e).slice(0, 900)); } };
const uuid = () => crypto.randomUUID();
const tokProf = () => h.cracha('profissional', 'NP', 'PROF_NP', h.hashProf);
const tokPac = sigla => h.cracha('paciente', sigla, 'PROF_NP', h.celula(h.abaPac, h.linhaDe(h.abaPac, 'sigla', sigla), 'senha_hash'));
const prof = (acao, extra) => { h.memo(); return h.post(Object.assign({ acao: acao, token: tokProf() }, extra || {})); };
const pac = (sigla, acao, extra) => { h.memo(); return h.post(Object.assign({ acao: acao, token: tokPac(sigla) }, extra || {})); };
const novo = (nome, email) => { const s = h.novoPaciente(nome, email); h.memo(); h.aceite(s, 'PROF_NP'); h.memo(); return s; };
const aba = nome => h.ctrl.getSheetByName(nome);
const cel = (nomeAba, id, col) => h.celula(aba(nomeAba), h.linhaDe(aba(nomeAba), 'id', id), col);
const por = (nomeAba, id, col, valor) => aba(nomeAba).getRange(h.linhaDe(aba(nomeAba), 'id', id), h.cab(aba(nomeAba)).indexOf(col) + 1).setValue(valor);
const PER = { de: '2026-09-01', ate: '2027-03-31' };
const sessao = (sigla, data, hora, d) => { const id = uuid(); const r = prof('profSalvarSessao', { periodo: PER, dados: Object.assign({ id: id, sigla: sigla, data: data, hora: hora || '10:00', duracao_min: 60, modalidade: 'presencial', valor: '', notas: '', avisos: [] }, d || {}) }); if (!r.ok) throw new Error('profSalvarSessao ' + data + ': ' + r.erro); return id; };
const inicio = () => prof('profLerFinanceiro', { so: 'inicio' }).inicio;
const lote = (ids, situacao) => prof('profMarcarStatusLote', { ids: ids, situacao: situacao });
const gatilho = () => { h.memo(); return S('enviarLembretes_')().agenda_prof; };
const GRADE = [1, 2, 3, 4, 5].map(d => ({ dia_semana: d, hora_inicio: '08:00', hora_fim: '20:00', modalidade: 'ambas', ativo: 'sim' }));
const grade = cfg => prof('profSalvarGrade', { config: Object.assign({ duracao_slot_min: 60, antecedencia_min_horas: 24, avisos_sessao: 'Nao' }, cfg || {}), grade: GRADE });
grade();

const ANA = novo('Ana Souza Lima', 'ana@exemplo.test');
const BRUNO = novo('Bruno & <b>"Reis"</b> O\'Costa', 'bruno@exemplo.test'); // nome com & < > " '
const CARLA = novo('Carla Mendes Dias', 'carla@exemplo.test');

/* ---------------------------------------------------------------- A */
console.log('A. Regras puras');
tenta('A', () => {
  const curta = S('_stpHoraCurta_'), pend = S('_stpPendentes_'), venceP = S('_stpEmailPendenteVence_'), venceA = S('_stpEmailAmanhaVence_'), montar = S('montarEmailAgendaProfissional');
  ok('A1 hora curta: 09:00 → 9h · 10:30 → 10h30 · 20:00 → 20h · vazio → vazio', [curta('09:00'), curta('10:30'), curta('20:00'), curta('')].join('|') === '9h|10h30|20h|');
  const x = (id, data, hora, o) => Object.assign({ id: id, sigla: 'X', data: data, hora_inicio: hora, duracao_min: '60', estado: 'agendada', reposicao_de: '', confirmada_em: '', modalidade: 'presencial' }, o || {});
  const lista = [x('ontem2', '2026-11-24', '15:00'), x('ontem1', '2026-11-24', '09:00'), x('antiga', '2026-11-10', '10:00'), x('feita', '2026-11-24', '10:00', { estado: 'realizada' }), x('falta', '2026-11-24', '11:00', { estado: 'falta' }),
    x('cancelada', '2026-11-24', '12:00', { estado: 'cancelada' }), x('hoje1', '2026-11-25', '09:00'), x('hoje2', '2026-11-25', '18:00'), x('amanha', '2026-11-26', '10:00'), x('semdata', '', '10:00')];
  const ids = (agora, l) => pend(l || lista, agora, 60).map(s => s.id).join(',');
  ok('A2 de dia anterior: só a que continua "agendada" (realizada, falta e cancelada não); mais antigas primeiro, depois por hora', ids({ data: '2026-11-25', hora: '14:00' }) === 'antiga,ontem1,ontem2', ids({ data: '2026-11-25', hora: '14:00' }));
  ok('A3 a de hoje só vira pendência quando a ÚLTIMA sessão do dia termina (18:00 + 60 min): 18:59 não, 19:00 sim, as duas de uma vez',
    ids({ data: '2026-11-25', hora: '18:59' }) === 'antiga,ontem1,ontem2' && ids({ data: '2026-11-25', hora: '19:00' }) === 'antiga,ontem1,ontem2,hoje1,hoje2');
  ok('A4 a sessão de amanhã nunca é pendência; no dia seguinte, a de hoje é pendência desde cedo', ids({ data: '2026-11-25', hora: '23:59' }).indexOf('amanha') === -1 && ids({ data: '2026-11-26', hora: '00:05' }).indexOf('hoje1,hoje2') !== -1 && ids({ data: '2026-11-26', hora: '00:05' }).indexOf('amanha') === -1);
  const comCancelada = lista.filter(s => s.id !== 'hoje2').concat([x('hoje2', '2026-11-25', '18:00', { estado: 'cancelada' })]);
  ok('A5 sessão cancelada não segura o dia: com a das 18h cancelada, o dia termina às 10:00', ids({ data: '2026-11-25', hora: '10:00' }, comCancelada).indexOf('hoje1') !== -1 && ids({ data: '2026-11-25', hora: '09:59' }, comCancelada).indexOf('hoje1') === -1);
  ok('A6 sessão sem duração válida usa a duração padrão', pend([x('h', '2026-11-25', '09:00', { duracao_min: '' })], { data: '2026-11-25', hora: '09:50' }, 50).length === 1 && pend([x('h', '2026-11-25', '09:00', { duracao_min: '' })], { data: '2026-11-25', hora: '09:49' }, 50).length === 0);

  const cfg = o => Object.assign({ email_status_pendente: 'Sim', email_agenda_amanha: 'Sim', email_agenda_hora: '20:00', email_status_enviado_em: '', email_agenda_enviado_em: '' }, o || {});
  const vp = (hora, c, l, data) => venceP(l || lista, cfg(c), { data: data || '2026-11-25', hora: hora }, 60);
  ok('A7 e-mail de fim de dia: uma hora depois do fim da última sessão (19:00 → 20:00); 19:59 não', vp('19:59') === null && vp('20:00') !== null && vp('20:00').hoje.length === 2 && vp('20:00').antigas === 3, vp('20:00'));
  ok('A8 e-mail de fim de dia: desligado não sai; já enviado hoje não sai de novo; enviado ontem não impede', vp('21:00', { email_status_pendente: 'Nao' }) === null && vp('21:00', { email_status_enviado_em: '2026-11-25' }) === null && vp('21:00', { email_status_enviado_em: '2026-11-24' }) !== null);
  ok('A9 e-mail de fim de dia: dia sem sessão não envia (mesmo com pendência antiga); com as de hoje já com status, também não',
    vp('21:00', null, lista.filter(s => s.data !== '2026-11-25')) === null && vp('21:00', null, lista.map(s => (s.data === '2026-11-25' ? Object.assign({}, s, { estado: 'realizada' }) : s))) === null);
  const tarde = [x('t', '2026-11-25', '22:30')];
  ok('A10 última sessão tarde da noite (22:30–23:30): o e-mail sai às 23:55, não antes', vp('23:54', null, tarde) === null && vp('23:55', null, tarde) !== null);

  const amanha = [x('b', '2026-11-26', '14:00', { modalidade: 'online', confirmada_em: '2026-11-24 10:00' }), x('a', '2026-11-26', '09:00'), x('c', '2026-11-26', '16:00', { estado: 'cancelada' }), x('d', '2026-11-27', '09:00'), x('e', '2026-11-25', '09:00')];
  const va = (hora, c, l) => venceA(l || amanha, cfg(c), { data: '2026-11-25', hora: hora });
  ok('A11 e-mail da véspera: a partir do horário escolhido, com as sessões de amanhã por hora, sem as canceladas e sem as de outros dias',
    va('19:59') === null && va('20:00') !== null && va('20:00').data === '2026-11-26' && va('20:00').sessoes.map(s => s.id).join(',') === 'a,b', va('20:00'));
  ok('A12 e-mail da véspera: desligado não sai; já enviado hoje não sai; sem sessão amanhã não sai; horário 18:00 vale às 18:00',
    va('21:00', { email_agenda_amanha: 'Nao' }) === null && va('21:00', { email_agenda_enviado_em: '2026-11-25' }) === null && va('21:00', null, amanha.filter(s => s.data !== '2026-11-26')) === null && va('18:00', { email_agenda_hora: '18:00' }) !== null && va('17:59', { email_agenda_hora: '18:00' }) === null);

  const linha = (hora, nome, o) => Object.assign({ data: '2026-11-25', hora: hora, paciente: nome, modalidade: 'presencial', confirmada: false }, o || {});
  const e1 = montar('pendente', { nome: 'Nova', sessoes: [linha('09:00', 'Ana Souza Lima')], antigas: 0 });
  const e3 = montar('pendente', { nome: 'Nova', sessoes: [linha('09:00', 'Ana Souza Lima'), linha('10:30', 'Bruno & <b>"Reis"</b> O\'Costa'), linha('19:00', 'Carla Mendes Dias')], antigas: 2 });
  ok('A13 e-mail de fim de dia: assunto e título aprovados, sem nome de paciente', e3.assunto === 'Sessões com status pendente — COGNIATIVO' && /<h1[^>]*>Sessões com status pendente<\/h1>/.test(e3.html) && e3.assunto.indexOf('Ana') === -1);
  ok('A14 e-mail de fim de dia: singular e plural, com o número por extenso; as de dias anteriores entram na frase dizendo o que são', e1.texto.indexOf('Uma sessão de hoje ainda está sem status.') !== -1 && e1.texto.indexOf('dias anteriores') === -1 && e3.texto.indexOf('Três sessões de hoje ainda estão sem status. Além dessas, duas sessões de dias anteriores também estão sem status.') !== -1);
  const ext = (n, antigas) => montar('pendente', { nome: 'Nova', sessoes: Array.from({ length: n }, () => linha('09:00', 'Ana Souza Lima')), antigas: antigas }).texto;
  ok('A14b variações: uma de hoje e uma antiga ("Além dessa, uma sessão… está"); vinte por extenso e vinte e uma em algarismos',
    ext(1, 1).indexOf('Uma sessão de hoje ainda está sem status. Além dessa, uma sessão de dias anteriores também está sem status.') !== -1 && ext(20, 0).indexOf('Vinte sessões de hoje ainda estão sem status.') !== -1 && ext(21, 21).indexOf('21 sessões de hoje ainda estão sem status. Além dessas, 21 sessões de dias anteriores também estão sem status.') !== -1, ext(1, 1).split('\n')[4]);
  ok('A15 e-mail de fim de dia: grade com Data, Hora e Paciente (nome completo), botão "Informar o status"', /<th[^>]*>Data<\/th><th[^>]*>Hora<\/th><th[^>]*>Paciente<\/th>/.test(e3.html) && />25\/11<\/td><td[^>]*>9h<\/td><td[^>]*>Ana Souza Lima<\/td>/.test(e3.html) && />10h30<\/td>/.test(e3.html) && e3.html.indexOf('Informar o status') !== -1 && e3.texto.indexOf('25/11 · 9h · Ana Souza Lima') !== -1);
  ok('A16 nome com & < > " \' sai escapado na grade', e3.html.indexOf('<b>"Reis"') === -1 && e3.html.indexOf('Bruno &amp; &lt;b&gt;&quot;Reis&quot;&lt;/b&gt; O&#39;Costa') !== -1, (e3.html.match(/Bruno[^<]{0,80}/) || [''])[0]);
  const am = (ls, pedidos) => montar('amanha', { nome: 'Nova', data: '2026-11-26', sessoes: ls, pedidos: pedidos || 0 });
  const quatro = [linha('09:00', 'Ana Souza Lima', { modalidade: 'online', confirmada: true }), linha('10:00', 'Bruno Reis Costa'), linha('14:00', 'Carla Mendes Dias', { confirmada: true }), linha('15:00', 'Davi Lopes Nunes', { modalidade: 'online', confirmada: true })].map(l => Object.assign(l, { data: '2026-11-26' }));
  const e4 = am(quatro, 1);
  ok('A17 e-mail da véspera: assunto, título e a frase com o dia da semana, a data e a conta das confirmações', e4.assunto === 'Sua agenda de amanhã — COGNIATIVO' && /<h1[^>]*>Sua agenda de amanhã<\/h1>/.test(e4.html) && e4.texto.indexOf('Quinta-feira, 26/11/2026: quatro sessões, três confirmadas e uma a confirmar.') !== -1, e4.texto.slice(0, 300));
  ok('A18 e-mail da véspera: grade com Data, Hora, Paciente (a modalidade sob o nome) e Presença; no texto puro, as cinco em linha; botão "Abrir a Agenda"',
    /<th[^>]*>Data<\/th><th[^>]*>Hora<\/th><th[^>]*>Paciente<\/th><th[^>]*>Presença<\/th>/.test(e4.html) && />26\/11<\/td><td[^>]*>9h<\/td><td[^>]*>Ana Souza Lima<br><span[^>]*>On-line<\/span><\/td><td[^>]*>Confirmada<\/td>/.test(e4.html) && />Presencial<\/span><\/td><td[^>]*>A confirmar<\/td>/.test(e4.html) &&
    e4.texto.indexOf('Data · Hora · Paciente · Modalidade · Presença') !== -1 && e4.texto.indexOf('26/11 · 9h · Ana Souza Lima · On-line · Confirmada') !== -1 && e4.html.indexOf('Abrir a Agenda') !== -1);
  ok('A19 e-mail da véspera: variações da frase (todas, nenhuma, uma só) e a linha dos pedidos no singular e no plural',
    am(quatro.map(l => Object.assign({}, l, { confirmada: true }))).texto.indexOf('quatro sessões, todas confirmadas.') !== -1 && am(quatro.map(l => Object.assign({}, l, { confirmada: false }))).texto.indexOf('quatro sessões, nenhuma confirmada ainda.') !== -1 &&
    am([quatro[0]]).texto.indexOf('uma sessão, confirmada.') !== -1 && am([quatro[1]]).texto.indexOf('uma sessão, a confirmar.') !== -1 &&
    e4.texto.indexOf('Um pedido de paciente aguarda a sua resposta.') !== -1 && am(quatro, 3).texto.indexOf('Três pedidos de pacientes aguardam a sua resposta.') !== -1 && am(quatro, 0).texto.indexOf('pedido') === -1 && am(quatro, 2).texto.indexOf('Dois pedidos de pacientes aguardam a sua resposta.') !== -1 &&
    am(Array.from({ length: 21 }, () => quatro[0])).texto.indexOf('21 sessões, todas confirmadas.') !== -1);
});

/* ---------------------------------------------------------------- B */
console.log('B. O bloco do Início e a ação que informa o status');
let s1, s2, s3, s4, s5, s6, s7;
tenta('B', () => {
  s1 = sessao(ANA, '2026-11-23', '10:00');
  s2 = sessao(BRUNO, '2026-11-24', '09:00');
  s3 = sessao(CARLA, '2026-11-24', '15:00');
  s4 = sessao(ANA, '2026-11-25', '09:00');
  s5 = sessao(BRUNO, '2026-11-25', '18:00');
  s6 = sessao(CARLA, '2026-11-26', '10:00');
  s7 = sessao(ANA, '2026-11-26', '14:00', { modalidade: 'online' });
  let sp = inicio().status_pendente;
  ok('B1 quarta, 14:00: três pendentes (as de segunda e de terça), mais antigas primeiro, com nome completo, data e hora; as de hoje ainda não',
    sp.total === 3 && sp.itens.map(x => x.id).join() === [s1, s2, s3].join() && sp.itens[0].nome === 'Ana Souza Lima' && sp.itens[0].data === '2026-11-23' && sp.itens[0].hora === '10:00', sp);
  irPara(2026, 11, 25, 18, 59);
  const antes = inicio().status_pendente.total;
  irPara(2026, 11, 25, 19, 0);
  sp = inicio().status_pendente;
  ok('B2 às 18:59 continuam três; às 19:00 (fim da última sessão do dia) entram as duas de hoje', antes === 3 && sp.total === 5 && sp.itens.slice(3).map(x => x.id).join() === [s4, s5].join(), [antes, sp.total]);
  let r = lote([s1], 'realizada');
  ok('B3 "Realizada" em uma sessão: grava o mesmo que a Agenda (realizada, cobrada Sim) e devolve o Início já com quatro', r.ok === true && r.marcadas === 1 && cel('Sessoes', s1, 'estado') === 'realizada' && cel('Sessoes', s1, 'cobrada') === 'Sim' && r.inicio.status_pendente.total === 4 && Array.isArray(r.inicio.comprovantes), r);
  r = lote([s2], 'falta');
  ok('B4 "Não compareceu": falta, cobrada Sim', r.ok === true && r.marcadas === 1 && cel('Sessoes', s2, 'estado') === 'falta' && cel('Sessoes', s2, 'cobrada') === 'Sim' && r.inicio.status_pendente.total === 3);
  por('Sessoes', s3, 'reposicao_de', s2);
  r = lote([s3], 'realizada');
  ok('B5 sessão de reposição: realizada, mas não gera cobrança nova (cobrada Nao)', r.marcadas === 1 && cel('Sessoes', s3, 'estado') === 'realizada' && cel('Sessoes', s3, 'cobrada') === 'Nao', [cel('Sessoes', s3, 'estado'), cel('Sessoes', s3, 'cobrada')]);
  r = lote([s4, s5, s4], 'realizada');
  ok('B6 "Todas realizadas" no dia: as duas de hoje numa chamada (id repetido não conta duas vezes); o bloco fica vazio', r.ok === true && r.marcadas === 2 && cel('Sessoes', s4, 'estado') === 'realizada' && cel('Sessoes', s5, 'estado') === 'realizada' && r.inicio.status_pendente.total === 0 && r.inicio.status_pendente.itens.length === 0, r);
  r = lote([s6, s1, uuid()], 'realizada');
  ok('B7 só vale para sessão com status pendente: a de amanhã, a já marcada e um id que não existe não mudam nada', r.ok === true && r.marcadas === 0 && cel('Sessoes', s6, 'estado') === 'agendada' && cel('Sessoes', s1, 'estado') === 'realizada');
  ok('B8 pedido malformado é recusado: status que não existe, lista vazia, lista que não é lista, mais de 60 ids', lote([s6], 'cancelada').ok === false && lote([s6], '').ok === false && lote([], 'realizada').ok === false && lote('x', 'realizada').ok === false && lote(Array.from({ length: 61 }, uuid), 'realizada').ok === false);
  ok('B9 paciente não informa status de sessão', pac(ANA, 'profMarcarStatusLote', { ids: [s6], situacao: 'realizada' }).ok === false && cel('Sessoes', s6, 'estado') === 'agendada');
  const ag = prof('profLerAgenda', PER);
  ok('B10 a Agenda mostra o que o bloco gravou', ag.ok === true && ag.sessoes.filter(x => x.id === s1)[0].estado === 'realizada' && ag.sessoes.filter(x => x.id === s2)[0].estado === 'falta');
});

/* ---------------------------------------------------------------- C */
console.log('C. As chaves na Grade e a trava da conta');
tenta('C', () => {
  const cfg = () => S('_stpConfig_')(h.ctrl);
  ok('C1 nascem desligadas, com o horário padrão das 20:00', cfg().email_status_pendente === 'Nao' && cfg().email_agenda_amanha === 'Nao' && cfg().email_agenda_hora === '20:00');
  DONO = 'outro@exemplo.test';
  const g1 = prof('profLerGrade');
  const r1 = grade({ email_status_pendente: 'Sim', email_agenda_amanha: 'Sim', email_agenda_hora: '19:00' });
  ok('C2 conta que ainda não pode receber: a tela é avisada (emails_prof_disponivel false) e ligar não liga', g1.emails_prof_disponivel === false && r1.ok === true && cfg().email_status_pendente === 'Nao' && cfg().email_agenda_amanha === 'Nao', cfg());
  DONO = 'np@exemplo.test';
  const r2 = grade({ email_status_pendente: 'Sim', email_agenda_amanha: 'Sim', email_agenda_hora: '19:00' });
  const g2 = prof('profLerGrade');
  ok('C3 a conta do dono liga os dois e escolhe o horário; a Grade lê de volta', r2.ok === true && g2.emails_prof_disponivel === true && cfg().email_status_pendente === 'Sim' && cfg().email_agenda_amanha === 'Sim' && cfg().email_agenda_hora === '19:00' && g2.config.email_status_pendente === 'Sim' && String(g2.config.email_agenda_hora) === '19:00', [cfg(), g2.config]);
  grade({ email_agenda_hora: '25:99' });
  grade();
  ok('C4 horário inválido é ignorado; salvar a Grade sem as chaves (tela antiga) não mexe nelas', cfg().email_agenda_hora === '19:00' && cfg().email_status_pendente === 'Sim' && cfg().email_agenda_amanha === 'Sim');
  grade({ email_status_pendente: 'Nao', email_agenda_amanha: 'Nao', email_agenda_hora: '20:00' });
  ok('C5 desligar desliga', cfg().email_status_pendente === 'Nao' && cfg().email_agenda_amanha === 'Nao' && cfg().email_agenda_hora === '20:00');
});

/* ---------------------------------------------------------------- D */
console.log('D. O gatilho e os dois e-mails ao profissional');
tenta('D', () => {
  const E = h.EMAILS, cfg = () => S('_stpConfig_')(h.ctrl);
  const s8 = sessao(BRUNO, '2026-11-27', '09:00');
  const s9 = sessao(CARLA, '2026-11-27', '11:00', { modalidade: 'online' });
  const s10 = sessao(ANA, '2026-11-27', '16:00');
  por('Sessoes', s9, 'confirmada_em', "'2026-11-26 08:00");
  prof('profCancelarSessao', { id: s10, opcoes: { escopo: 'esta', quem: 'profissional', avisar: false }, periodo: PER });
  E.length = 0;
  irPara(2026, 11, 26, 21, 0); // quinta: sessões às 10:00 e às 14:00 (termina 15:00); amanhã, duas
  let r = gatilho();
  ok('D1 com as duas chaves desligadas, o gatilho não envia nada', E.length === 0 && r.pendente === 0 && r.amanha === 0 && r.falhas === 0, r);
  grade({ email_status_pendente: 'Sim', email_agenda_amanha: 'Sim', email_agenda_hora: '20:00' });
  irPara(2026, 11, 26, 15, 59);
  r = gatilho();
  ok('D2 quinta, 15:59 (a última terminou às 15:00): ainda não é hora de nenhum dos dois', E.length === 0 && r.pendente === 0 && r.amanha === 0, r);
  irPara(2026, 11, 26, 16, 0);
  r = gatilho();
  const e1 = E[0] || {};
  ok('D3 16:00: sai o e-mail de fim de dia, só para o profissional, com as duas sessões de hoje', E.length === 1 && r.pendente === 1 && e1.to === 'np@exemplo.test' && e1.subject === 'Sessões com status pendente — COGNIATIVO' && String(e1.body).indexOf('Duas sessões de hoje ainda estão sem status.') !== -1 &&
    String(e1.body).indexOf('26/11 · 10h · Carla Mendes Dias') !== -1 && String(e1.body).indexOf('26/11 · 14h · Ana Souza Lima') !== -1 && String(e1.htmlBody).indexOf('Informar o status') !== -1, [E.length, r, String(e1.body).slice(0, 400)]);
  ok('D4 a marca do dia fica na Config_Agenda como texto', cfg().email_status_enviado_em === '2026-11-26');
  irPara(2026, 11, 26, 16, 5);
  r = gatilho();
  ok('D5 a rodada seguinte não repete o e-mail', E.length === 1 && r.pendente === 0);
  irPara(2026, 11, 26, 20, 0);
  r = gatilho();
  const e2 = E[1] || {};
  ok('D6 20:00: sai a agenda de amanhã, com as duas sessões de sexta (a cancelada fora), modalidade e presença', E.length === 2 && r.amanha === 1 && e2.to === 'np@exemplo.test' && e2.subject === 'Sua agenda de amanhã — COGNIATIVO' &&
    String(e2.body).indexOf('Sexta-feira, 27/11/2026: duas sessões, uma confirmada e uma a confirmar.') !== -1 && String(e2.body).indexOf("27/11 · 9h · Bruno & <b>\"Reis\"</b> O'Costa · Presencial · A confirmar") !== -1 &&
    String(e2.body).indexOf('27/11 · 11h · Carla Mendes Dias · On-line · Confirmada') !== -1 && String(e2.body).indexOf('16h') === -1 && String(e2.htmlBody).indexOf('<b>"Reis"') === -1, [E.length, r, String(e2.body).slice(0, 500)]);
  irPara(2026, 11, 26, 20, 5);
  r = gatilho();
  ok('D7 a rodada seguinte não repete a agenda de amanhã', E.length === 2 && r.amanha === 0 && cfg().email_agenda_enviado_em === '2026-11-26');
  ok('D8 nenhum paciente recebeu e-mail (os avisos de sessão continuam desligados)', E.every(m => m.to === 'np@exemplo.test'));

  // sexta: tudo com status → nenhum e-mail de fim de dia
  irPara(2026, 11, 27, 12, 0);
  lote([s6, s7, s8, s9], 'realizada');
  irPara(2026, 11, 27, 13, 0);
  r = gatilho();
  ok('D9 sexta: com todas as sessões do dia já com status, o e-mail de fim de dia não sai', E.length === 2 && r.pendente === 0, r);

  // segunda, 30/11: a trava da conta e a cota
  const s11 = sessao(ANA, '2026-11-30', '09:00'), s12 = sessao(CARLA, '2026-12-01', '09:00');
  irPara(2026, 11, 30, 20, 30);
  DONO = 'outro@exemplo.test';
  r = gatilho();
  ok('D10 conta que não pode receber: com as chaves ligadas na planilha, o gatilho nem olha para ela', E.length === 2 && r.profissionais === 0 && r.pendente === 0 && r.amanha === 0, r);
  DONO = 'np@exemplo.test';
  S("PropertiesService.getScriptProperties().setProperty('sessoes:2026-11-30', String(SESSOES_EMAIL_DIA_MAX))");
  r = gatilho();
  ok('D11 cota do dia esgotada: nenhum e-mail sai e a marca é desfeita para a rodada seguinte tentar', E.length === 2 && r.sem_cota === 2 && cfg().email_status_enviado_em !== '2026-11-30' && cfg().email_agenda_enviado_em !== '2026-11-30', [r, cfg()]);
  S("PropertiesService.getScriptProperties().setProperty('sessoes:2026-11-30', '0')");
  r = gatilho();
  ok('D12 com a cota livre, os dois saem na mesma rodada', E.length === 4 && r.pendente === 1 && r.amanha === 1 && E[2].subject.indexOf('status pendente') !== -1 && E[3].subject.indexOf('agenda de amanhã') !== -1 && String(E[2].body).indexOf('Uma sessão de hoje ainda está sem status.') !== -1, [E.length, r]);
  ok('D13 falha no envio desfaz a marca', (() => {
    irPara(2026, 12, 1, 21, 0);
    sessao(ANA, '2026-12-02', '09:00');
    const real = global.MailApp.sendEmail; let tentou = 0;
    global.MailApp.sendEmail = () => { tentou++; throw new Error('falha simulada'); };
    const rr = gatilho();
    global.MailApp.sendEmail = real;
    return tentou === 2 && rr.falhas === 2 && cfg().email_status_enviado_em !== '2026-12-01' && cfg().email_agenda_enviado_em !== '2026-12-01';
  })());
  void s11; void s12;
});

/* ---------------------------------------------------------------- T */
console.log('T. Listas, trava e fonte');
tenta('T', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  const bloco = js.slice(js.indexOf('// PACOTE 20.2 — STATUS DAS SESSOES'), js.indexOf('// Auxiliares do ping (Pacote E3'));
  ok('T1 a ação nova está no despachante e na lista das que gravam com trava', /case 'profMarcarStatusLote':/.test(js) && S('ACOES_COM_TRAVA').indexOf('profMarcarStatusLote') !== -1);
  ok('T2 o bloco não envia e-mail por fora: nenhum MailApp direto; tudo passa por _reservarEmail_ e _enviarEmail_', bloco.length > 2000 && bloco.indexOf('MailApp') === -1 && /_reservarEmail_\('sessoes'\)/.test(bloco) && /_enviarEmail_\(para, email, prof\.profissional_id\)/.test(bloco));
  ok('T3 o gatilho dos lembretes chama os e-mails do profissional dentro de try/catch, depois dos avisos de sessão', /r\.sessoes = enviarAvisosSessao_\(quando\);[\s\S]{0,400}try \{\s*r\.agenda_prof = enviarEmailsProfissional_\(quando\);\s*\} catch \(erroProf\)/.test(js));
  ok('T4 a trava da conta é uma função só, usada na Grade (ler e salvar) e no gatilho', (js.match(/_stpDisponivel_\(/g) || []).length === 4);
  const ind = js.indexOf("case 'profMarcarStatusLote':");
  ok('T5 a ação nova fica entre as do profissional (exige crachá de profissional pelo _ageProf_)', ind > 0 && /function profMarcarStatusLote\(s, ids, situacao\) \{\s*var alvo = _ageProf_\(s\);\s*if \(!alvo\.ok\) return alvo;/.test(js));
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l) && !/_enviarEmail_: falha simulada/.test(l));
  ok('T6 o servidor não registrou nenhum erro fora da falha simulada', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO (' + process.env.VMC_FUSO_20_2 + '): ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
