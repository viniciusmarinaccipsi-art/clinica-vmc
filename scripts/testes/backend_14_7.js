/* Pacote 14.7 — Agenda: o agendamento do paciente passa pela aprovação do profissional (decisão do usuário, 23/11/2026).
   Blocos: A o paciente pede (nenhuma sessão nasce) · B o horário pedido fica reservado · C aprovar, escolher outro horário, recusar ·
   E e-mails · V eventos (sino) · T listas, colunas e versão.
   Mesmo arnês da suíte do 14.6 (Código.js real sobre planilhas simuladas, relógio fixo em 25/11/2026 14:00).
   Uso: node scripts/testes/backend_14_7.js */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
global.Utilities.base64Decode = s => Array.from(Buffer.from(String(s), 'base64')).map(x => (x > 127 ? x - 256 : x)); // o logo do e-mail

const h = av('({ post: post, cracha: cracha, novoPaciente: novoPaciente, celula: celula, linhaDe: linhaDe, cab: cab, abaPac: abaPac, ctrl: ctrl, EMAILS: EMAILS, memo: _memoZerar_, aceite: _gravarAceitePolitica_, hashProf: hashProf })');
const S = nome => av(nome);
let falhas = 0, passo = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 700) : '')); } };
const tenta = (n, f) => { try { f(); } catch (e) { ok(n + ' (exceção)', false, String(e && e.stack || e).slice(0, 700)); } };
const uuid = () => crypto.randomUUID();
const tokProf = () => h.cracha('profissional', 'NP', 'PROF_NP', h.hashProf);
const tokPac = sigla => h.cracha('paciente', sigla, 'PROF_NP', h.celula(h.abaPac, h.linhaDe(h.abaPac, 'sigla', sigla), 'senha_hash'));
const prof = (acao, extra) => { h.memo(); return h.post(Object.assign({ acao: acao, token: tokProf() }, extra || {})); };
const pac = (sigla, acao, extra) => { h.memo(); return h.post(Object.assign({ acao: acao, token: tokPac(sigla) }, extra || {})); };
const novo = (nome, email) => { const s = h.novoPaciente(nome, email); h.memo(); h.aceite(s, 'PROF_NP'); h.memo(); return s; };
const aba = nome => h.ctrl.getSheetByName(nome);
const cel = (nomeAba, id, col) => h.celula(aba(nomeAba), h.linhaDe(aba(nomeAba), 'id', id), col);
const linhas = nomeAba => (aba(nomeAba) ? aba(nomeAba).getLastRow() - 1 : 0);
const PER = { de: '2026-11-01', ate: '2027-03-31' };
const sessao = (sigla, d) => prof('profSalvarSessao', { periodo: PER, dados: Object.assign({ id: uuid(), sigla: sigla, data: '2026-12-02', hora: '10:00', duracao_min: 60, modalidade: 'presencial', valor: '300', notas: '', avisos: [] }, d || {}) });
// segunda a quinta com as duas modalidades; sexta só on-line
const GRADE = [1, 2, 3, 4].map(d => ({ dia_semana: d, hora_inicio: '08:00', hora_fim: '18:00', modalidade: 'ambas', ativo: 'sim' }))
  .concat([{ dia_semana: 5, hora_inicio: '08:00', hora_fim: '12:00', modalidade: 'online', ativo: 'sim' }]);
const grade = cfg => prof('profSalvarGrade', { config: Object.assign({ duracao_slot_min: 60, antecedencia_min_horas: 24 }, cfg || {}), grade: GRADE });
const pedir = (sigla, data, hora, mod, id) => pac(sigla, 'pacienteAgendarSessao', { dados: { id: id || uuid(), data: data, hora: hora, modalidade: mod || 'presencial' } });
const decidir = (id, aprovar, quando) => prof('profDecidirPedido', { id: id, aprovar: aprovar, periodo: PER, quando: quando || null });
const livresPac = (sigla, de) => pac(sigla, 'lerHorariosLivres', { de: de }).livres.map(x => x.data + ' ' + x.hora);
const livresProf = (de, pedido) => prof('profLerHorariosLivres', { de: de, pedido: pedido }).livres.map(x => x.data + ' ' + x.hora);

const P1 = novo('Paula Primeira', 'p1@exemplo.test');
const P2 = novo('Pedro Segundo', 'p2@exemplo.test');
grade({ avisos_sessao: 'Nao' });
prof('profSalvarValorSessao', { siglaPaciente: P1, valor: '280' });
const uA = uuid();

/* ---------------------------------------------------------------- A */
console.log('A. O paciente pede o agendamento (nenhuma sessão nasce)');
tenta('A', () => {
  let r = pedir(P1, '2026-12-03', '10:00', 'online', uA);
  ok('A1 o pedido é aceito e nenhuma linha nasce em Sessoes', r.ok === true && linhas('Sessoes') <= 0 && r.sessoes.length === 0, [r.ok, r.erro, linhas('Sessoes')]);
  ok('A2 a linha do pedido: tipo agendar, pendente, sem sessão, com data, hora e modalidade em texto', cel('Pedidos_Agenda', uA, 'tipo') === 'agendar' && cel('Pedidos_Agenda', uA, 'estado') === 'pendente' && cel('Pedidos_Agenda', uA, 'sessao_id') === '' && cel('Pedidos_Agenda', uA, 'data') === '2026-12-03' && cel('Pedidos_Agenda', uA, 'hora') === '10:00' && cel('Pedidos_Agenda', uA, 'modalidade') === 'online' && cel('Pedidos_Agenda', uA, 'sigla') === P1);
  ok('A3 a tela do paciente recebe o pedido "aguardando resposta" e nada de limite', r.pedidos_agendar.length === 1 && r.pedidos_agendar[0].id === uA && r.pedidos_agendar[0].estado === 'pendente' && r.pedidos_agendar[0].data === '2026-12-03' && r.pedidos_agendar[0].hora === '10:00' && r.pedidos_agendar[0].modalidade === 'online' && r.limite === undefined, r.pedidos_agendar);
  r = pedir(P1, '2026-12-03', '10:00', 'online', uA);
  ok('A4 reenvio do mesmo pedido: duplicado, uma linha só', r.ok === true && r.duplicado === true && linhas('Pedidos_Agenda') === 1);
  r = pedir(P2, '2026-12-04', '09:00', 'presencial', uA);
  ok('A5 o id de um pedido de outro paciente não serve', r.ok === false && linhas('Pedidos_Agenda') === 1, r);
  ok('A6 fora da grade, com menos de 24 h, em feriado ou sem data: recusado, nada gravado', [['2026-12-03', '07:00'], ['2026-11-26', '13:00'], ['2026-12-25', '09:00'], ['', '10:00'], ['2026-12-05', '10:00']].every(x => pedir(P2, x[0], x[1]).ok === false) && linhas('Pedidos_Agenda') === 1);
  sessao(P2, { data: '2026-12-02', hora: '10:00' });
  r = pedir(P1, '2026-12-02', '10:00');
  ok('A7 horário com sessão marcada: recusado com a frase da tela', r.ok === false && r.codigo === 'ocupado' && r.erro === 'Este horário acabou de ser ocupado. Escolha outro.', r);
  const lista = prof('profListarPacientes').pacientes.filter(p => p.sigla === P1)[0];
  const lido = prof('profLerAgenda', PER);
  ok('A8 o pedido chega ao profissional: na lista do login e na leitura da agenda, com o nome, o horário e a modalidade', lista.pedidos_agenda.length === 1 && lista.pedidos_agenda[0].tipo === 'agendar' && lido.pedidos.length === 1 && lido.pedidos[0].id === uA && lido.pedidos[0].nome === 'Paula Primeira' && lido.pedidos[0].data === '2026-12-03' && lido.pedidos[0].hora === '10:00' && lido.pedidos[0].modalidade === 'online' && lido.pedidos[0].sessao_data === '', [lista.pedidos_agenda, lido.pedidos]);
  ok('A9 o pedido não é sessão: a grade do profissional não mostra nada naquele horário', !lido.sessoes.some(x => x.data === '2026-12-03'));
  ok('A10 crachá de profissional não pede; sem crachá, recusado', prof('pacienteAgendarSessao', { dados: { id: uuid(), data: '2026-12-03', hora: '11:00' } }).ok === false && h.post({ acao: 'pacienteAgendarSessao', dados: { id: uuid(), data: '2026-12-03', hora: '11:00' } }).ok === false);
});

/* ---------------------------------------------------------------- B */
console.log('B. O horário pedido fica reservado até a resposta');
let uRem, idS1;
tenta('B', () => {
  ok('B1 outro paciente não vê o horário pedido entre os livres (e vê o vizinho)', livresPac(P2, '2026-12-03').indexOf('2026-12-03 10:00') === -1 && livresPac(P2, '2026-12-03').indexOf('2026-12-03 11:00') !== -1);
  ok('B2 nem quem pediu', livresPac(P1, '2026-12-03').indexOf('2026-12-03 10:00') === -1);
  let r = pedir(P2, '2026-12-03', '10:00');
  ok('B3 pedir o mesmo horário por fora da lista: recusado', r.ok === false && r.codigo === 'ocupado' && linhas('Pedidos_Agenda') === 1, r);
  idS1 = uuid(); uRem = uuid();
  sessao(P2, { id: idS1, data: '2026-12-08', hora: '10:00', duracao_min: 90 });
  r = pac(P2, 'pacientePedirAgenda', { dados: { id: uRem, tipo: 'remarcar', sessao_id: idS1, data: '2026-12-09', hora: '14:00' } });
  ok('B4 pedido de remarcação pendente também reserva o horário pedido (pela duração da sessão: 90 min pegam 14:00 e 15:00)', r.ok === true && livresPac(P1, '2026-12-09').indexOf('2026-12-09 14:00') === -1 && livresPac(P1, '2026-12-09').indexOf('2026-12-09 15:00') === -1 && livresPac(P1, '2026-12-09').indexOf('2026-12-09 16:00') !== -1, livresPac(P1, '2026-12-09').filter(x => x.indexOf('2026-12-09') === 0));
  const lp = livresProf('2026-12-03');
  ok('B5 a lista de livres do profissional também não traz os horários pedidos', lp.indexOf('2026-12-03 10:00') === -1 && lp.indexOf('2026-12-09 14:00') === -1 && lp.indexOf('2026-12-03 11:00') !== -1);
  const lq = livresProf('2026-12-03', uA);
  ok('B6 escolhendo o horário de um pedido, o horário DELE aparece e o dos outros pedidos não', lq.indexOf('2026-12-03 10:00') !== -1 && lq.indexOf('2026-12-09 14:00') === -1);
  const uB = uuid();
  pedir(P2, '2026-12-10', '09:00', 'presencial', uB);
  r = sessao(P1, { data: '2026-12-10', hora: '09:00' });
  ok('B7 a reserva não impede o profissional de marcar ali', r.ok === true, r.erro);
  r = decidir(uB, true);
  ok('B8 e aprovar esse pedido depois é recusado com a frase; o pedido continua pendente', r.ok === false && r.codigo === 'ocupado' && r.erro === 'O horário pedido já foi ocupado. Recuse o pedido ou marque outro horário.' && cel('Pedidos_Agenda', uB, 'estado') === 'pendente', r);
  r = decidir(uB, false);
  ok('B9 recusado, a reserva acaba (o pedido deixa de contar)', r.ok === true && r.aprovado === false && cel('Pedidos_Agenda', uB, 'estado') === 'recusado' && S('_ageReservas_')({ pedidos: S('_lembretesLer_')(aba('Pedidos_Agenda')), sessoes: [], cfg: { duracao_slot_min: 60 } }, { data: '2026-11-25', hora: '14:00' }).every(v => v.data !== '2026-12-10'));
  const uC = uuid();
  pedir(P2, '2026-11-27', '09:00', 'online', uC);
  irPara(2026, 11, 27, 9, 30);
  ok('B10 pedido cujo horário passou sem resposta deixa de reservar', S('_ageReservas_')({ pedidos: S('_lembretesLer_')(aba('Pedidos_Agenda')), sessoes: [], cfg: { duracao_slot_min: 60 } }, { data: '2026-11-27', hora: '09:30' }).every(v => v.data !== '2026-11-27'));
  r = decidir(uC, true);
  ok('B11 e aprová-lo no horário que já passou é recusado com a frase', r.ok === false && r.codigo === 'passou' && r.erro === 'O horário pedido já passou. Recuse o pedido ou escolha outro horário.' && linhas('Sessoes') === 3, [r, linhas('Sessoes')]);
  ok('B12 o paciente não vê mais esse pedido vencido na tela', pac(P2, 'lerMinhasSessoes').pedidos_agendar.every(x => x.id !== uC));
  decidir(uC, false);
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- C */
console.log('C. Aprovar, escolher outro horário, recusar');
const idA = 'ag-' + uA;
tenta('C', () => {
  const antes = linhas('Sessoes');
  let r = decidir(uA, true);
  ok('C1 aprovar: a resposta diz o horário e a agenda já traz a sessão; o pedido sai da lista', r.ok === true && r.aprovado === true && r.data === '2026-12-03' && r.hora === '10:00' && r.agenda.sessoes.some(x => x.id === idA && x.data === '2026-12-03' && x.hora === '10:00') && !r.agenda.pedidos.some(p => p.id === uA), r.erro);
  ok('C2 a sessão nasce agendada, A CONFIRMAR, com origem pedido, a modalidade pedida, a duração do slot, todos os avisos e o valor do cadastro', linhas('Sessoes') === antes + 1 && cel('Sessoes', idA, 'estado') === 'agendada' && cel('Sessoes', idA, 'confirmada_em') === '' && cel('Sessoes', idA, 'origem') === 'pedido' && cel('Sessoes', idA, 'modalidade') === 'online' && cel('Sessoes', idA, 'duracao_min') === '60' && cel('Sessoes', idA, 'avisos') === 'confirmacao,lembrete48,lembrete,cancelamento' && cel('Sessoes', idA, 'valor') === '280' && cel('Sessoes', idA, 'sigla') === P1 && cel('Sessoes', idA, 'gcal_sinc') === 'pendente');
  ok('C3 o pedido fica aprovado e ligado à sessão', cel('Pedidos_Agenda', uA, 'estado') === 'aprovado' && cel('Pedidos_Agenda', uA, 'sessao_id') === idA && cel('Pedidos_Agenda', uA, 'decidido_em') !== '');
  let m = pac(P1, 'lerMinhasSessoes');
  const s = m.sessoes.filter(x => x.id === idA)[0];
  ok('C4 o paciente vê a sessão nas próximas, com "Confirmar presença" e a marca de pedido aprovado; o pedido sai da espera', !!s && s.estado === 'agendada' && s.confirmada === false && s.pode_confirmar === true && s.pedido && s.pedido.estado === 'aprovado' && m.pedidos_agendar.length === 0, [s, m.pedidos_agendar]);
  r = decidir(uA, true);
  ok('C5 decidir de novo o mesmo pedido não cria outra sessão', r.ok === true && r.duplicado === true && linhas('Sessoes') === antes + 1);
  r = pac(P1, 'pacienteConfirmarSessao', { id: idA });
  ok('C6 o paciente confirma a presença depois (14.5.4)', r.ok === true && cel('Sessoes', idA, 'confirmada_em') !== '');
  ok('C7 o horário aprovado passa a estar ocupado para todos', livresPac(P2, '2026-12-03').indexOf('2026-12-03 10:00') === -1 && livresProf('2026-12-03').indexOf('2026-12-03 10:00') === -1);

  // escolher outro horário: o paciente pediu segunda 07/12 às 09:00, presencial; o profissional marca na sexta 11/12 às 10:00 (janela só on-line)
  const uD = uuid(), idD = 'ag-' + uD;
  pedir(P2, '2026-12-07', '09:00', 'presencial', uD);
  r = decidir(uD, true, { data: '2026-12-11', hora: '10:00' });
  ok('C8 "Escolher horário": a sessão nasce no horário que o profissional escolheu, não no pedido', r.ok === true && r.aprovado === true && r.data === '2026-12-11' && r.hora === '10:00' && cel('Sessoes', idD, 'data') === '2026-12-11' && cel('Sessoes', idD, 'hora_inicio') === '10:00' && cel('Sessoes', idD, 'confirmada_em') === '', r.erro);
  ok('C9 o pedido guarda o horário aprovado; a modalidade vira a que a Grade oferece ali (só on-line); sem valor no cadastro, o valor fica vazio', cel('Pedidos_Agenda', uD, 'data') === '2026-12-11' && cel('Pedidos_Agenda', uD, 'hora') === '10:00' && cel('Sessoes', idD, 'modalidade') === 'online' && cel('Sessoes', idD, 'valor') === '');
  ok('C10 o horário que ele tinha pedido volta a ficar livre', livresPac(P1, '2026-12-07').indexOf('2026-12-07 09:00') !== -1);
  const uE = uuid();
  pedir(P2, '2026-12-14', '09:00', 'presencial', uE);
  r = decidir(uE, true, { data: '2026-12-03', hora: '10:00' });
  ok('C11 escolher um horário ocupado: recusado, pedido continua pendente, nenhuma sessão', r.ok === false && r.codigo === 'ocupado' && cel('Pedidos_Agenda', uE, 'estado') === 'pendente' && h.linhaDe(aba('Sessoes'), 'id', 'ag-' + uE) < 1, r);

  // recusar
  const nSes = linhas('Sessoes');
  r = decidir(uE, false);
  ok('C12 recusar: nenhuma sessão nasce, o pedido fica recusado e sai da lista do profissional', r.ok === true && r.aprovado === false && linhas('Sessoes') === nSes && cel('Pedidos_Agenda', uE, 'estado') === 'recusado' && !r.agenda.pedidos.some(p => p.id === uE));
  m = pac(P2, 'lerMinhasSessoes');
  ok('C13 o paciente vê o pedido como recusado', m.pedidos_agendar.some(x => x.id === uE && x.estado === 'recusado' && x.data === '2026-12-14'), m.pedidos_agendar);
  ok('C14 e o horário recusado volta a ficar livre', livresPac(P1, '2026-12-14').indexOf('2026-12-14 09:00') !== -1);
  irPara(2026, 12, 4, 9, 0);
  ok('C15 mais de 7 dias depois da recusa, o aviso some da tela dele', pac(P2, 'lerMinhasSessoes').pedidos_agendar.every(x => x.id !== uE));
  irPara(2026, 11, 25, 14, 0);
  ok('C16 crachá de paciente não decide pedido', pac(P1, 'profDecidirPedido', { id: uE, aprovar: true, periodo: PER }).ok === false);
  ok('C17 vários pedidos do mesmo paciente são aceitos (não há mais limite)', [['2026-12-15', '09:00'], ['2026-12-16', '09:00'], ['2026-12-17', '09:00']].every(x => pedir(P1, x[0], x[1]).ok === true) && pac(P1, 'lerMinhasSessoes').pedidos_agendar.length === 3);
  // remarcação continua como era
  r = decidir(uRem, true);
  ok('C18 pedido de remarcação continua igual: aprovado, a sessão muda e volta a pedir confirmação', r.ok === true && r.aprovado === true && cel('Sessoes', idS1, 'data') === '2026-12-09' && cel('Sessoes', idS1, 'hora_inicio') === '14:00' && cel('Sessoes', idS1, 'confirmada_em') === '', r.erro);
});

/* ---------------------------------------------------------------- E */
console.log('E. E-mails (com os avisos ligados)');
tenta('E', () => {
  grade({ avisos_sessao: 'Sim' });
  const html = e => String(e.htmlBody || '');
  h.EMAILS.length = 0;
  const uF = uuid();
  let r = pedir(P2, '2026-12-21', '10:00', 'presencial', uF);
  ok('E1 pedir: só o aviso ao profissional, com a frase nova; nada ao paciente', r.ok === true && h.EMAILS.length === 1 && h.EMAILS[0].subject === 'Agenda — movimento de paciente' && h.EMAILS[0].to !== 'p2@exemplo.test' && h.EMAILS[0].body.indexOf('Pedro Segundo pediu para agendar uma sessão em 21/12 às 10:00.') !== -1, h.EMAILS.map(e => e.to + ' · ' + e.subject));
  h.EMAILS.length = 0;
  r = decidir(uF, true);
  const e = h.EMAILS[0];
  ok('E2 aprovar: "Pedido aprovado" ao paciente, com o horário e o botão "Confirmar presença" (link que confirma)', r.ok === true && r.aviso === '' && h.EMAILS.length === 1 && e.to === 'p2@exemplo.test' && e.subject === 'Pedido aprovado — COGNIATIVO' && e.body.indexOf('aprovou o seu pedido. A sessão está marcada para segunda, 21/12/2026, às 10:00 (Presencial).') !== -1 && e.body.indexOf('?confirmar=') !== -1 && html(e).indexOf('Confirmar presença') !== -1, e && e.body);
  const tok = (e.body.match(/\?confirmar=([A-Za-z0-9_.-]+)/) || [])[1];
  r = h.post({ acao: 'confirmarSessaoPorLink', t: tok });
  ok('E3 o link do e-mail confirma a sessão que nasceu do pedido', r.ok === true && r.data === '2026-12-21' && r.hora === '10:00' && cel('Sessoes', 'ag-' + uF, 'confirmada_em') !== '', r);
  h.EMAILS.length = 0;
  const uG = uuid();
  pedir(P2, '2026-12-22', '10:00', 'presencial', uG);
  h.EMAILS.length = 0;
  r = decidir(uG, true, { data: '2026-12-23', hora: '11:00' });
  ok('E4 aprovar em outro horário: o e-mail traz o horário escolhido pelo profissional', r.ok === true && h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('quarta, 23/12/2026, às 11:00') !== -1 && h.EMAILS[0].body.indexOf('22/12/2026') === -1, h.EMAILS.map(x => x.body.slice(0, 300)));
  const uH = uuid();
  pedir(P2, '2026-12-28', '10:00', 'presencial', uH);
  h.EMAILS.length = 0;
  r = decidir(uH, false);
  ok('E5 recusar: "Pedido respondido" ao paciente, com o horário que ele pediu', r.ok === true && h.EMAILS.length === 1 && h.EMAILS[0].to === 'p2@exemplo.test' && h.EMAILS[0].subject === 'Pedido respondido — COGNIATIVO' && h.EMAILS[0].body.indexOf('não pôde aprovar o horário pedido (28/12/2026 às 10:00)') !== -1, h.EMAILS.map(x => x.subject + ' · ' + x.body.slice(0, 200)));
  grade({ avisos_sessao: 'Nao' });
  h.EMAILS.length = 0;
  const uI = uuid();
  pedir(P2, '2026-12-29', '10:00', 'presencial', uI);
  r = decidir(uI, true);
  ok('E6 com os avisos desligados nada é enviado, e o pedido e a aprovação funcionam igual', r.ok === true && r.aviso === 'desligado' && h.EMAILS.length === 0 && cel('Sessoes', 'ag-' + uI, 'estado') === 'agendada');
});

/* ---------------------------------------------------------------- V */
console.log('V. Eventos (sino)');
tenta('V', () => {
  const E = prof('profLerAgenda', PER).eventos;
  ok('V1 o pedido de agendamento é evento, com o horário pedido', E.some(e => e.tipo === 'agendar' && e.sigla === P1 && e.data === '2026-12-03' && e.hora === '10:00' && e.nome === 'Paula Primeira'), E.slice(0, 4));
  ok('V2 a sessão que nasce da aprovação não vira "agendou" (quem agendou foi o profissional, ao aprovar)', E.filter(e => e.tipo === 'agendou').length === 0);
  ok('V3 a confirmação de presença dessa sessão continua sendo evento', E.some(e => e.tipo === 'confirmou' && e.sigla === P1 && e.data === '2026-12-03'));
});

/* ---------------------------------------------------------------- T */
console.log('T. Listas, colunas e versão');
tenta('T', () => {
  const fonteJs = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('T1 nenhuma ação nova: as mesmas da trava, e o pedido continua gravando dentro dela', S('ACOES_COM_TRAVA').indexOf('pacienteAgendarSessao') !== -1 && S('ACOES_COM_TRAVA').indexOf('profDecidirPedido') !== -1 && S('ACOES_SO_LEITURA').indexOf('profLerHorariosLivres') !== -1);
  ok('T2 a coluna nova do pedido fica no fim e é criada na planilha', S('COLUNAS_PEDIDOS_AGENDA').slice(-2).join(',') === 'sugestao,modalidade' && h.cab(aba('Pedidos_Agenda')).indexOf('modalidade') !== -1 && S('COLUNAS_SESSOES').slice(-3).join(',') === 'gcal_evento,gcal_sinc,meet_link');
  const bruta = aba('Pedidos_Agenda').getRange(h.linhaDe(aba('Pedidos_Agenda'), 'id', uA), h.cab(aba('Pedidos_Agenda')).indexOf('hora') + 1).getValue();
  ok('T3 as células do pedido são texto literal (a hora não vira número)', String(bruta).replace(/^'/, '') === '10:00', bruta);
  ok('T4 o limite não existe mais no servidor (a versão é conferida em backend_16_11.js)', fonteJs.indexOf('limite_agendamentos') === -1 && fonteJs.indexOf('_ageLimite_') === -1);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T5 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
