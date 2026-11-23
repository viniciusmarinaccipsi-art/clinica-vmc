/* Pacote 14.3 — Agenda completa: testes em Node do Código.js REAL sobre as planilhas simuladas do arnês
   de backend_18_10a.js (carregado até a linha em que os testes dele começam; nada é copiado).
   Relógio fixo, como em backend_19_2_1.js: o resultado não depende do dia nem do fuso (o portão roda em UTC).
   Blocos: R regra de datas (pura) · A sessão avulsa e conflito · S série · C cancelar e cobrança ·
   F situação, falta e reposição · B bloqueio e feriado · P paciente · Q pedidos · V avisos e gatilho ·
   X exclusão · T trava e crachá.
   Uso: node scripts/testes/backend_14_3.js */
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
const irPara = (ano, mes, dia, h, m) => { agoraMs = new Real(ano, mes - 1, dia, h || 0, m || 0, 0).getTime(); };
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
const h = av('({ post: post, cracha: cracha, novoPaciente: novoPaciente, celula: celula, linhaDe: linhaDe, cab: cab, abaPac: abaPac, ctrl: ctrl, sProf: sProf, EMAILS: EMAILS, PROPS: PROPS, TRAVA: TRAVA, memo: _memoZerar_, aceite: _gravarAceitePolitica_, hashProf: hashProf })');
const S = nome => av(nome);

let passo = 0, falhas = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 500) : '')); } };
const tenta = (n, f) => { try { f(); } catch (e) { ok(n + ' (exceção)', false, String(e && e.stack || e).slice(0, 600)); } };
const uuid = () => crypto.randomUUID();
const tokProf = () => h.cracha('profissional', 'NP', 'PROF_NP', h.hashProf);
const tokPac = sigla => h.cracha('paciente', sigla, 'PROF_NP', h.celula(h.abaPac, h.linhaDe(h.abaPac, 'sigla', sigla), 'senha_hash'));
const prof = (acao, extra) => h.post(Object.assign({ acao: acao, token: tokProf() }, extra || {}));
const pac = (sigla, acao, extra) => h.post(Object.assign({ acao: acao, token: tokPac(sigla) }, extra || {}));
const novo = (nome, email) => { const s = h.novoPaciente(nome, email); h.memo(); h.aceite(s, 'PROF_NP'); h.memo(); return s; };
const aba = nome => h.ctrl.getSheetByName(nome);
const cel = (nomeAba, id, col) => h.celula(aba(nomeAba), h.linhaDe(aba(nomeAba), 'id', id), col);
const linhas = nomeAba => (aba(nomeAba) ? aba(nomeAba).getLastRow() - 1 : -1);
const PER = { de: '2026-11-01', ate: '2027-02-08' };
const sessao = (sigla, d) => prof('profSalvarSessao', { periodo: PER, dados: Object.assign({ id: uuid(), sigla: sigla, data: '2026-11-30', hora: '10:00', duracao_min: 60, modalidade: 'presencial', valor: '300', notas: '', avisos: ['confirmacao', 'lembrete', 'cancelamento'] }, d || {}) });
// 14.7: o agendamento do paciente virou pedido. Para as provas que precisam de uma sessao nascida de um pedido do paciente:
// pedir e aprovar (a sessao nasce com o id 'ag-' + id do pedido).
const agendaAprovada = (sigla, d) => { const r = pac(sigla, 'pacienteAgendarSessao', { dados: d }); if (!r.ok) return r; const a = prof('profDecidirPedido', { id: d.id, aprovar: true, periodo: PER }); return a.ok ? pac(sigla, 'lerMinhasSessoes') : a; };
const gatilho = d => { h.memo(); return S('enviarLembretes_')(d); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------------------------------------------------------- R */
console.log('R. Regra de datas (funções puras; o "agora" entra por parâmetro)');
tenta('R', () => {
  const regra = o => { const r = S('_ageRegra_')(Object.assign({ cada: 1, unidade: 'semana', dias_semana: [], fim_tipo: 'n', fim_n: 3 }, o)); if (!r.ok) throw new Error(JSON.stringify(r)); return r.regra; };
  const serie = (o, ini, ocupadas) => S('_ageSerie_')(regra(o), ini, iso => (ocupadas || []).indexOf(iso) !== -1);
  let r = serie({ dias_semana: [4] }, '2026-11-26');
  ok('R1 semanal, após 3 consultas: três quintas seguidas', igual(r.datas, ['2026-11-26', '2026-12-03', '2026-12-10']) && r.puladas.length === 0, r);
  r = serie({ dias_semana: [4] }, '2027-02-11', ['2027-02-18']);
  ok('R2 data ocupada é pulada e a série segue até completar N (conferido no Doctoralia: 11/02, 25/02 e 04/03)', igual(r.datas, ['2027-02-11', '2027-02-25', '2027-03-04']) && igual(r.puladas, ['2027-02-18']), r);
  r = serie({ dias_semana: [1], fim_tipo: 'data', fim_data: '2027-01-28' }, '2026-12-28');
  ok('R3 "em: data" — a data é limite; 28/12 até 28/01 cria até 25/01', igual(r.datas, ['2026-12-28', '2027-01-04', '2027-01-11', '2027-01-18', '2027-01-25']), r);
  r = serie({ dias_semana: [1], fim_tipo: 'data', fim_data: '2027-01-23' }, '2026-11-23');
  ok('R4 "em: data" — fim 23/01 para em 18/01; fim no próprio dia da sessão inclui o dia', r.datas[r.datas.length - 1] === '2027-01-18' && r.datas.length === 9 && igual(serie({ dias_semana: [1], fim_tipo: 'data', fim_data: '2026-11-30' }, '2026-11-23').datas, ['2026-11-23', '2026-11-30']), r);
  r = serie({ dias_semana: [1, 3], fim_n: 4 }, '2026-11-30');
  ok('R5 dois dias da semana: segunda e quarta', igual(r.datas, ['2026-11-30', '2026-12-02', '2026-12-07', '2026-12-09']), r);
  r = serie({ dias_semana: [1, 3], fim_n: 3 }, '2026-12-02');
  ok('R6 começando na quarta, a segunda da mesma semana já passou e não entra', igual(r.datas, ['2026-12-02', '2026-12-07', '2026-12-09']), r);
  r = serie({ cada: 2, dias_semana: [5], fim_n: 3 }, '2026-12-18');
  ok('R7 a cada 2 semanas, atravessando o ano', igual(r.datas, ['2026-12-18', '2027-01-01', '2027-01-15']) && igual(r.feriados, ['2027-01-01']), r);
  r = serie({ dias_semana: [2], fim_n: 2 }, '2026-12-03');
  ok('R8 dia da primeira consulta fora dos dias marcados: ele entra na regra', igual(r.datas, ['2026-12-03', '2026-12-08']), r);
  r = serie({ unidade: 'mes', modo_mes: 'dia_mes', fim_n: 3 }, '2027-01-31');
  ok('R9 mensal no dia do mês: 31 vira o último dia em mês mais curto', igual(r.datas, ['2027-01-31', '2027-02-28', '2027-03-31']), r);
  r = serie({ unidade: 'mes', modo_mes: 'dia_semana', fim_n: 3 }, '2026-11-26');
  ok('R10 mensal no dia da semana: 4ª quinta de cada mês', igual(r.datas, ['2026-11-26', '2026-12-24', '2027-01-28']), r);
  r = serie({ unidade: 'mes', modo_mes: 'dia_semana', fim_n: 2 }, '2026-12-31');
  ok('R11 5ª quinta de dezembro: em janeiro, que só tem quatro, vale a última', igual(r.datas, ['2026-12-31', '2027-01-28']), r);
  r = serie({ unidade: 'mes', cada: 2, fim_n: 3 }, '2026-11-30');
  ok('R12 a cada 2 meses, virando o ano', igual(r.datas, ['2026-11-30', '2027-01-30', '2027-03-30']), r);
  ok('R13 teto: mais de 60 consultas, mais de 12 meses por data, e N que não cabe em 12 meses são recusados com a mensagem', [serie({ dias_semana: [1], fim_n: 61 }, '2026-11-30'), serie({ dias_semana: [1], fim_tipo: 'data', fim_data: '2027-12-06' }, '2026-11-30'), serie({ dias_semana: [1], fim_n: 60 }, '2026-11-30')].every(x => x.ok === false && x.codigo === 'teto' && x.erro === 'A repetição vai até 12 meses ou 60 sessões. Diminua o período.'));
  r = serie({ dias_semana: [1], fim_n: 52 }, '2026-11-30');
  ok('R14 52 semanas cabem no teto; 60 sessões em dois dias por semana também', r.ok && r.datas.length === 52 && serie({ dias_semana: [1, 4], fim_n: 60 }, '2026-11-30').datas.length === 60, r.datas && r.datas.length);
  ok('R15 data final antes do início é recusada', serie({ dias_semana: [1], fim_tipo: 'data', fim_data: '2026-11-29' }, '2026-11-30').ok === false);
  const F26 = S('_ageFeriados_')(2026), F27 = S('_ageFeriados_')(2027);
  ok('R16 feriados móveis pela Páscoa: 2026 (Sexta-feira Santa 03/04, Carnaval 16 e 17/02, Corpus Christi 04/06) e 2027 (26/03, 08 e 09/02, 27/05)', F26['2026-04-03'] === 'Sexta-feira Santa' && F26['2026-02-16'] === 'Carnaval' && F26['2026-02-17'] === 'Carnaval' && F26['2026-06-04'] === 'Corpus Christi' && F27['2027-03-26'] === 'Sexta-feira Santa' && F27['2027-02-08'] === 'Carnaval' && F27['2027-02-09'] === 'Carnaval' && F27['2027-05-27'] === 'Corpus Christi');
  ok('R17 feriados fixos, inclusive 20/11', ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].every(d => !!F26['2026-' + d]) && Object.keys(F26).length === 13);
  r = serie({ dias_semana: [5], fim_n: 3 }, '2026-12-18');
  ok('R18 série aponta a data que cai em feriado (Natal) e a cria se não mandarem pular', igual(r.datas, ['2026-12-18', '2026-12-25', '2027-01-01']) && igual(r.feriados, ['2026-12-25', '2027-01-01']), r);
  r = serie({ dias_semana: [5], fim_n: 3, pular_feriado: true }, '2026-12-18');
  ok('R19 com "pular feriado", as datas em feriado saem e a série segue até completar N', igual(r.datas, ['2026-12-18', '2027-01-08', '2027-01-15']) && igual(r.pulados_feriado, ['2026-12-25', '2027-01-01']), r);
  const sob = S('_ageSobrepoe_');
  ok('R20 conflito por intervalo: encostar não é conflito; 10:40 por 60 min conflita com 11:00', !sob(600, 60, 660, 60) && !sob(660, 60, 600, 60) && sob(640, 60, 660, 60) && sob(600, 60, 600, 60) && sob(600, 120, 630, 30));
  const prazo = (data, hora, ad, ah) => S('_ageNoPrazo_')(data, hora, { data: ad, hora: ah }, 24);
  ok('R21 regra das 24 horas nas bordas: exatamente 24 h vale; um minuto a menos não; virada de mês e de ano', prazo('2026-11-26', '14:00', '2026-11-25', '14:00') && !prazo('2026-11-26', '14:00', '2026-11-25', '14:01') && prazo('2026-12-01', '09:00', '2026-11-30', '09:00') && !prazo('2027-01-01', '09:00', '2026-12-31', '09:30') && !prazo('2026-11-25', '10:00', '2026-11-25', '14:00'));
  const cob = S('_ageCobrada_');
  ok('R22 tabela de cobrança, linha a linha', cob('realizada', true, false) === 'Sim' && cob('falta', true, false) === 'Sim' && cob('cancel_paciente', true, false) === 'Nao' && cob('cancel_paciente', false, false) === 'Sim' && cob('cancel_profissional', false, false) === 'Nao' && cob('cancel_profissional', true, false) === 'Nao');
  ok('R23 reposição nunca gera cobrança', ['realizada', 'falta', 'cancel_paciente', 'cancel_profissional'].every(e => cob(e, false, true) === 'Nao'));
  ok('R24 dia da semana no padrão da Grade: segunda = 1, domingo = 7', S('_ageDow_')(S('_lemDia_')('2026-11-30')) === 1 && S('_ageDow_')(S('_lemDia_')('2026-11-29')) === 7 && S('_ageDow_')(S('_lemDia_')('2026-11-25')) === 3);
});

/* ---------------------------------------------------------------- A */
const P1 = novo('Paula Primeira', 'p1@exemplo.test');
const P2 = novo('Pedro Segundo', 'p2@exemplo.test');
const P3 = novo('Priscila Terceira', 'p3@exemplo.test');
h.abaPac.getRange(h.linhaDe(h.abaPac, 'sigla', P3), h.cab(h.abaPac).indexOf('email') + 1).setValue(''); // sem e-mail no cadastro
h.memo();
const gradeSemana = [1, 2, 3, 4, 5].map(d => ({ dia_semana: d, hora_inicio: '08:00', hora_fim: '18:00', modalidade: d === 5 ? 'online' : 'ambas', ativo: 'sim' }));

console.log('A. Sessão avulsa e conflito');
let idA;
tenta('A', () => {
  let r = prof('profLerAgenda', PER);
  ok('A1 ler a agenda antes de tudo: vazia, com config e feriados, e nenhuma aba é criada pela leitura', r.ok && r.sessoes.length === 0 && r.config.avisos_sessao === 'Nao' && r.config.antecedencia_min_horas === 24 && r.feriados['2026-12-25'] === 'Natal' && !aba('Sessoes') && !aba('Pedidos_Agenda'), r);
  r = prof('profSalvarGrade', { config: { duracao_slot_min: 60, antecedencia_min_horas: 24 }, grade: gradeSemana });
  ok('A2 grade salva sem a chave dos avisos: os avisos continuam desligados', r.ok && prof('profLerAgenda', PER).config.avisos_sessao === 'Nao', r);
  idA = uuid();
  r = sessao(P1, { id: idA, simular: true });
  ok('A3 simular não grava nada', r.ok && igual(r.simulacao.datas, ['2026-11-30']) && r.simulacao.conflito === '' && !aba('Sessoes'), r);
  r = sessao(P1, { id: idA, notas: '=SOMA(1;2)' });
  ok('A4 criar: a sessão volta na agenda da própria resposta, sem marcação', r.ok && r.criadas === 1 && r.agenda.sessoes.length === 1 && r.agenda.sessoes[0].estado === 'agendada' && r.agenda.sessoes[0].nome === 'Paula Primeira' && r.agenda.sessoes[0].cobrada === '', r);
  ok('A5 células gravadas como texto literal (data, hora, valor e nota que parece fórmula)', cel('Sessoes', idA, 'data') === '2026-11-30' && cel('Sessoes', idA, 'hora_inicio') === '10:00' && cel('Sessoes', idA, 'valor') === '300' && cel('Sessoes', idA, 'notas') === '=SOMA(1;2)' && cel('Sessoes', idA, 'origem') === 'profissional' && cel('Sessoes', idA, 'criado_por') !== '', [cel('Sessoes', idA, 'data'), cel('Sessoes', idA, 'notas')]);
  r = sessao(P2, {});
  ok('A6 mesmo horário para outro paciente: recusado com a mensagem', r.ok === false && r.codigo === 'ocupado' && r.erro === 'Este horário já está ocupado. Escolha outro.' && linhas('Sessoes') === 1, r);
  r = sessao(P2, { hora: '10:40' });
  ok('A7 10:40 sobre sessão das 10:00 às 11:00: recusado', r.ok === false && r.codigo === 'ocupado', r);
  r = sessao(P2, { hora: '09:30', duracao_min: 60 });
  ok('A8 09:30 por 60 min invade as 10:00: recusado; 09:00 por 60 min encosta e entra', r.ok === false && sessao(P2, { hora: '09:00' }).ok === true && linhas('Sessoes') === 2, r);
  r = sessao(P2, { hora: '11:00', simular: true });
  ok('A9 simular horário livre que encosta no fim: sem conflito', r.ok && r.simulacao.conflito === '', r);
  r = sessao(P1, { id: idA, valor: '350', notas: 'trazer exames' });
  ok('A10 salvar de novo o mesmo id edita, nunca duplica', r.ok && r.editada === true && r.remarcada === false && linhas('Sessoes') === 2 && cel('Sessoes', idA, 'valor') === '350', r);
  r = sessao(P1, { id: idA, hora: '09:00' });
  ok('A11 remarcar para horário ocupado: recusado e a sessão fica onde estava', r.ok === false && r.codigo === 'ocupado' && cel('Sessoes', idA, 'hora_inicio') === '10:00', r);
  r = sessao(P1, { id: idA, data: '2026-12-01', hora: '07:00' });
  ok('A12 remarcar para horário livre (07:00, fora da grade: o profissional pode)', r.ok && r.remarcada === true && cel('Sessoes', idA, 'data') === '2026-12-01' && cel('Sessoes', idA, 'hora_inicio') === '07:00', r);
  r = sessao(P1, { hora: '07:00', data: '2026-12-05', simular: true });
  ok('A13 simulação avisa fora da grade (sábado) e feriado; data passada avisa passado', r.simulacao.avisos.fora_grade === true && sessao(P1, { data: '2026-12-25', simular: true }).simulacao.avisos.feriado === 'Natal' && sessao(P1, { data: '2026-11-24', simular: true }).simulacao.avisos.passado === true, r);
  r = sessao(P1, { data: '2026-11-24', hora: '10:00' });
  ok('A14 lançar sessão em data passada é permitido ao profissional', r.ok && r.criadas === 1, r);
  ok('A15 sem sigla, com paciente inexistente ou com id inválido: recusado', sessao('', {}).ok === false && sessao('ZZZZ', {}).ok === false && sessao(P1, { id: 'x' }).ok === false);
  ok('A16 hora inválida e data que não existe: recusados', sessao(P1, { hora: '25:00' }).ok === false && sessao(P1, { data: '2026-02-30' }).ok === false);
});

/* ---------------------------------------------------------------- S */
console.log('S. Série');
let idS, serieId;
tenta('S', () => {
  idS = uuid();
  const rep = { cada: 1, unidade: 'semana', dias_semana: [4], fim_tipo: 'n', fim_n: 4 };
  let r = sessao(P2, { data: '2026-12-10', hora: '14:00', simular: true, repeticao: rep });
  const antes = linhas('Sessoes');
  ok('S1 simular a série devolve as datas e não grava', r.ok && igual(r.simulacao.datas, ['2026-12-10', '2026-12-17', '2026-12-24', '2026-12-31']) && r.simulacao.puladas.length === 0 && linhas('Series') === 0 && linhas('Sessoes') === antes, r);
  sessao(P1, { data: '2026-12-17', hora: '14:30' });
  r = sessao(P2, { id: idS, data: '2026-12-10', hora: '14:00', repeticao: rep });
  serieId = cel('Sessoes', idS, 'serie_id');
  ok('S2 criar: data ocupada (17/12) é pulada e listada; a série completa as 4', r.ok && r.criadas === 4 && igual(r.simulacao.datas, ['2026-12-10', '2026-12-24', '2026-12-31', '2027-01-07']) && igual(r.simulacao.puladas, ['2026-12-17']), r);
  const daSerie = r.agenda.sessoes.filter(x => x.serie_id === serieId);
  ok('S3 cada ocorrência é uma sessão própria, ligada à série, com o mesmo valor', daSerie.length === 4 && daSerie.every(x => x.valor === '300' && x.hora === '14:00' && x.sigla === P2) && !!r.agenda.series[serieId] && r.agenda.series[serieId].fim_n === 4 && linhas('Series') === 1, daSerie.length);
  r = sessao(P2, { data: '2026-12-08', hora: '08:00', repeticao: { cada: 1, unidade: 'semana', dias_semana: [2], fim_tipo: 'n', fim_n: 61 } });
  ok('S4 teto recusado pelo servidor com a mensagem', r.ok === false && r.codigo === 'teto' && r.erro === 'A repetição vai até 12 meses ou 60 sessões. Diminua o período.', r);
  const seg = daSerie[1];
  r = sessao(P2, { id: seg.id, data: seg.data, hora: '15:00', escopo: 'seguintes' });
  ok('S5 editar "esta e as seguintes": o horário muda nesta e nas próximas, não na anterior', r.ok && cel('Sessoes', idS, 'hora_inicio') === '14:00' && r.agenda.sessoes.filter(x => x.serie_id === serieId && x.hora === '15:00').length === 3, r.agenda.sessoes.filter(x => x.serie_id === serieId).map(x => x.data + ' ' + x.hora));
  const idE = uuid();
  r = prof('profEditarSerie', { periodo: PER, dados: { id: idE, sessao_id: seg.id, simular: true, repeticao: { cada: 2, unidade: 'semana', dias_semana: [4], fim_tipo: 'n', fim_n: 3 } } });
  ok('S6 editar a repetição, simulação: as seguintes da própria série não contam como ocupadas', r.ok && igual(r.simulacao.datas, ['2026-12-24', '2027-01-07', '2027-01-21']) && r.simulacao.puladas.length === 0, r);
  r = prof('profEditarSerie', { periodo: PER, dados: { id: idE, sessao_id: seg.id, repeticao: { cada: 2, unidade: 'semana', dias_semana: [4], fim_tipo: 'n', fim_n: 3 } } });
  const nova = r.agenda.sessoes.filter(x => x.serie_id && x.serie_id !== serieId && x.sigla === P2);
  ok('S7 editar a repetição: as seguintes saem, as novas entram, a primeira da série antiga fica', r.ok && r.retiradas === 2 && r.criadas === 2 && igual(nova.map(x => x.data), ['2026-12-24', '2027-01-07', '2027-01-21']) && r.agenda.sessoes.filter(x => x.serie_id === serieId).length === 1 && linhas('Series') === 2 && cel('Series', serieId, 'encerrada_em') !== '', r);
  r = prof('profEditarSerie', { periodo: PER, dados: { id: idE, sessao_id: seg.id, repeticao: { cada: 2, unidade: 'semana', dias_semana: [4], fim_tipo: 'n', fim_n: 3 } } });
  ok('S8 repetir o mesmo pedido de editar a repetição não cria nada de novo', r.ok && r.duplicado === true && linhas('Series') === 2, r);
});

/* ---------------------------------------------------------------- C */
console.log('C. Cancelar e cobrança');
tenta('C', () => {
  const lista = () => prof('profLerAgenda', PER).sessoes;
  const criar = (sigla, d) => { const id = uuid(); const r = sessao(sigla, Object.assign({ id: id }, d)); if (!r.ok) throw new Error(JSON.stringify(r)); return id; };
  let id = criar(P1, { data: '2026-12-02', hora: '10:00' });
  let r = prof('profCancelarSessao', { id: id, opcoes: { escopo: 'esta', quem: 'profissional' }, periodo: PER });
  ok('C1 cancelada pelo profissional: não cobrada, some da agenda e fica guardada na aba', r.ok && r.canceladas === 1 && !lista().some(x => x.id === id) && cel('Sessoes', id, 'estado') === 'cancelada' && cel('Sessoes', id, 'cobrada') === 'Nao' && cel('Sessoes', id, 'cancelada_por') === 'profissional', r);
  ok('C2 o horário cancelado volta a ficar livre', sessao(P2, { data: '2026-12-02', hora: '10:00' }).ok === true);
  id = criar(P1, { data: '2026-12-03', hora: '16:00' });
  r = prof('profCancelarSessao', { id: id, opcoes: { quem: 'paciente' }, periodo: PER });
  ok('C3 paciente pediu com 24 h ou mais: não cobrada', r.ok && cel('Sessoes', id, 'cobrada') === 'Nao' && cel('Sessoes', id, 'cancelada_por') === 'paciente', r);
  id = criar(P1, { data: '2026-11-26', hora: '13:00' });
  r = prof('profCancelarSessao', { id: id, opcoes: { quem: 'paciente' }, periodo: PER });
  ok('C4 paciente pediu com menos de 24 h (faltam 23 h): cobrada', r.ok && cel('Sessoes', id, 'cobrada') === 'Sim', cel('Sessoes', id, 'cobrada'));
  const idFora = id;
  id = criar(P1, { data: '2026-11-26', hora: '09:00' });
  r = prof('profCancelarSessao', { id: id, opcoes: { quem: 'profissional' }, periodo: PER });
  ok('C5 profissional cancelou em cima da hora: não cobrada', r.ok && cel('Sessoes', id, 'cobrada') === 'Nao');
  r = prof('profCancelarSessao', { id: id, opcoes: { quem: 'profissional' }, periodo: PER });
  ok('C6 cancelar de novo não muda nada', r.ok && r.duplicado === true && r.canceladas === 0, r);
  const idC = uuid();
  sessao(P3, { id: idC, data: '2026-12-09', hora: '08:00', repeticao: { cada: 1, unidade: 'semana', dias_semana: [3], fim_tipo: 'n', fim_n: 4 } });
  const serie = cel('Sessoes', idC, 'serie_id');
  const segunda = lista().filter(x => x.serie_id === serie)[1];
  r = prof('profCancelarSessao', { id: segunda.id, opcoes: { escopo: 'seguintes', quem: 'profissional' }, periodo: PER });
  ok('C7 "esta consulta e as seguintes": a primeira fica, três saem, a série é encerrada', r.ok && r.canceladas === 3 && lista().filter(x => x.serie_id === serie).length === 1 && cel('Series', serie, 'encerrada_em') !== '', r);
  r = prof('profCancelarSessao', { id: idC, opcoes: { escopo: 'esta', quem: 'profissional' }, periodo: PER });
  ok('C8 "só esta" em sessão de série cancela uma', r.ok && r.canceladas === 1 && lista().filter(x => x.serie_id === serie).length === 0, r);
  ok('C9 cancelar id que não existe: recusado', prof('profCancelarSessao', { id: 'nao-existe-0001', opcoes: {}, periodo: PER }).ok === false);
  globalThis.__idCobradaCancelada = idFora;
});

/* ---------------------------------------------------------------- F */
console.log('F. Situação, falta e reposição');
tenta('F', () => {
  const idR = uuid(), idF = uuid();
  sessao(P1, { id: idR, data: '2026-11-23', hora: '10:00' });
  sessao(P1, { id: idF, data: '2026-11-23', hora: '11:00', valor: '280' });
  let r = prof('profMarcarSituacao', { id: idR, situacao: 'realizada', periodo: PER });
  ok('F1 consulta realizada: cobrada', r.ok && cel('Sessoes', idR, 'estado') === 'realizada' && cel('Sessoes', idR, 'cobrada') === 'Sim', r);
  r = prof('profMarcarSituacao', { id: idF, situacao: 'falta', periodo: PER });
  const f = r.agenda.sessoes.filter(x => x.id === idF)[0];
  ok('F2 não compareceu: cobrada (regra) e pode ser reposta', r.ok && f.estado === 'falta' && f.cobrada === 'Sim' && f.pode_repor === true && r.agenda.sessoes.filter(x => x.id === idR)[0].pode_repor === false, f);
  ok('F3 sessão realizada não pode ser cancelada', prof('profCancelarSessao', { id: idR, opcoes: {}, periodo: PER }).ok === false);
  const idRep = uuid();
  r = sessao(P1, { id: idRep, data: '2026-12-04', hora: '09:00', valor: '999', reposicao_de: idF });
  const rep = r.agenda.sessoes.filter(x => x.id === idRep)[0], orig = r.agenda.sessoes.filter(x => x.id === idF)[0];
  ok('F4 reposição: sessão nova ligada à falta, com o valor da original e sem cobrança; a original mostra "reposta em"', r.ok && rep.reposicao_de === idF && rep.valor === '280' && rep.cobrada === 'Nao' && orig.reposta_em === '2026-12-04' && orig.cobrada === 'Sim' && orig.pode_repor === false, [rep, orig]);
  ok('F5 a mesma falta não ganha segunda reposição; sessão não cobrada não pode ser reposta; paciente diferente não repõe', sessao(P1, { data: '2026-12-04', hora: '11:00', reposicao_de: idF }).ok === false && sessao(P1, { data: '2026-12-04', hora: '11:00', reposicao_de: idA }).ok === false && sessao(P2, { data: '2026-12-04', hora: '11:00', reposicao_de: idF }).ok === false);
  r = prof('profMarcarSituacao', { id: idRep, situacao: 'realizada', periodo: PER });
  ok('F6 reposição realizada continua sem cobrança (a cobrança é uma só, na original)', r.ok && cel('Sessoes', idRep, 'estado') === 'realizada' && cel('Sessoes', idRep, 'cobrada') === 'Nao');
  r = prof('profMarcarSituacao', { id: idF, situacao: '', periodo: PER });
  ok('F7 falta já reposta não volta a "sem marcação"', r.ok === false, r);
  r = prof('profMarcarSituacao', { id: idR, situacao: '', periodo: PER });
  ok('F8 voltar a "sem marcação" limpa a cobrança', r.ok && cel('Sessoes', idR, 'estado') === 'agendada' && cel('Sessoes', idR, 'cobrada') === '');
  const idCob = globalThis.__idCobradaCancelada;
  r = sessao(P1, { data: '2026-12-04', hora: '13:00', reposicao_de: idCob });
  ok('F9 cancelada com menos de 24 h (cobrada) também pode ser reposta, a critério do profissional', r.ok && r.agenda.sessoes.some(x => x.reposicao_de === idCob && x.cobrada === 'Nao'), r);
  ok('F10 série não nasce de reposição (a repetição é ignorada)', (() => { const x = sessao(P1, { data: '2026-12-11', hora: '13:00', reposicao_de: idF, repeticao: { cada: 1, unidade: 'semana', dias_semana: [5], fim_tipo: 'n', fim_n: 3 } }); return x.ok === false; })());
});

/* ---------------------------------------------------------------- B */
console.log('B. Bloqueio e feriado');
tenta('B', () => {
  const idB = uuid();
  let r = prof('profSalvarBloqueio', { periodo: PER, dados: { id: idB, data_inicio: '2026-12-14', data_fim: '2026-12-15', dia_todo: true, nome: 'Congresso' } });
  ok('B1 bloqueio de dois dias inteiros aparece na leitura', r.ok && r.agenda.bloqueios.some(b => b.id === idB && b.dia_todo === true && b.nome === 'Congresso') && cel('Bloqueios', idB, 'dia_todo') === 'Sim', r);
  r = sessao(P1, { data: '2026-12-15', hora: '10:00' });
  ok('B2 sessão em dia bloqueado: recusada com a mensagem do bloqueio', r.ok === false && r.codigo === 'bloqueado' && r.erro === 'Este horário está bloqueado. Escolha outro.', r);
  r = sessao(P1, { data: '2026-12-07', hora: '17:00', simular: true, repeticao: { cada: 1, unidade: 'semana', dias_semana: [1], fim_tipo: 'n', fim_n: 3 } });
  ok('B3 série pula a data bloqueada', igual(r.simulacao.datas, ['2026-12-07', '2026-12-21', '2026-12-28']) && igual(r.simulacao.puladas, ['2026-12-14']), r);
  const idH = uuid();
  r = prof('profSalvarBloqueio', { periodo: PER, dados: { id: idH, data_inicio: '2026-12-16', hora_inicio: '12:00', hora_fim: '14:00', dia_todo: false, nome: '' } });
  ok('B4 bloqueio com hora: 13:00 é recusado; 14:00 encosta e entra; 11:30 por 60 min invade', r.ok && sessao(P1, { data: '2026-12-16', hora: '13:00' }).codigo === 'bloqueado' && sessao(P1, { data: '2026-12-16', hora: '11:30' }).codigo === 'bloqueado' && sessao(P1, { data: '2026-12-16', hora: '14:00' }).ok === true, r);
  r = prof('profSalvarBloqueio', { periodo: PER, dados: { id: uuid(), data_inicio: '2026-12-16', dia_todo: true } });
  ok('B5 bloquear período que já tem sessão: recusado com a mensagem', r.ok === false && r.erro === 'Há sessões neste período. Remarque ou cancele antes de bloquear.', r);
  ok('B6 bloqueio com fim antes do início ou sem hora: recusado', prof('profSalvarBloqueio', { dados: { id: uuid(), data_inicio: '2026-12-20', data_fim: '2026-12-19', dia_todo: true } }).ok === false && prof('profSalvarBloqueio', { dados: { id: uuid(), data_inicio: '2026-12-20', dia_todo: false } }).ok === false);
  r = prof('profApagarBloqueio', { id: idB, periodo: PER });
  ok('B7 apagar o bloqueio libera os dias', r.ok && !r.agenda.bloqueios.some(b => b.id === idB) && sessao(P1, { data: '2026-12-15', hora: '10:00' }).ok === true, r);
  r = prof('profLerAgenda', { de: '2026-12-20', ate: '2027-01-03' });
  ok('B8 feriados do período na leitura (Natal e Confraternização Universal)', r.feriados['2026-12-25'] === 'Natal' && r.feriados['2027-01-01'] === 'Confraternização Universal' && Object.keys(r.feriados).length === 2, r.feriados);
});

/* ---------------------------------------------------------------- P */
console.log('P. Paciente');
let idPac;
tenta('P', () => {
  let r = pac(P1, 'lerMinhasSessoes');
  ok('P1 o paciente só vê as próprias sessões, sem valor e sem notas', r.ok && r.sessoes.length > 0 && r.antecedencia_horas === 24 && r.sessoes.every(x => x.valor === undefined && x.notas === undefined && x.sigla === undefined) && JSON.stringify(r).indexOf('Pedro') === -1, r.sessoes.length);
  r = pac(P1, 'lerHorariosLivres', { de: '2026-11-25' });
  const L = r.livres;
  ok('P2 horários livres: só dias úteis da grade, de hora em hora, a partir de 24 h', r.ok && L.length > 0 && L[0].data === '2026-11-26' && L[0].hora === '14:00' && !L.some(x => x.data === '2026-11-25') && !L.some(x => x.data === '2026-11-28' || x.data === '2026-11-29') && !L.some(x => x.hora < '08:00' || x.hora > '17:00'), L.slice(0, 3));
  ok('P3 horário ocupado não aparece; sexta só on-line; os demais com as duas modalidades', !L.some(x => x.data === '2026-11-30' && x.hora === '09:00') && L.filter(x => x.data === '2026-11-27').every(x => igual(x.modalidades, ['online'])) && L.filter(x => x.data === '2026-11-30').every(x => igual(x.modalidades, ['presencial', 'online'])), L.filter(x => x.data === '2026-11-30').map(x => x.hora));
  r = pac(P1, 'lerHorariosLivres', { de: '2026-12-21' });
  ok('P4 feriado não é oferecido ao paciente', r.ok && !r.livres.some(x => x.data === '2026-12-25') && r.livres.some(x => x.data === '2026-12-24'));
  const uPac = uuid(), u9 = uuid(); idPac = 'ag-' + uPac;
  r = pac(P1, 'pacienteAgendarSessao', { dados: { id: uPac, data: '2026-11-30', hora: '15:00', modalidade: 'online' } });
  ok('P5 o paciente PEDE um horário livre (14.7): nenhuma sessão nasce; o pedido fica pendente, com a modalidade escolhida', r.ok && !r.sessoes.some(x => x.data === '2026-11-30' && x.hora === '15:00') && cel('Pedidos_Agenda', uPac, 'tipo') === 'agendar' && cel('Pedidos_Agenda', uPac, 'estado') === 'pendente' && cel('Pedidos_Agenda', uPac, 'modalidade') === 'online' && r.pedidos_agendar.length === 1 && r.pedidos_agendar[0].data === '2026-11-30' && r.pedidos_agendar[0].hora === '15:00' && r.pedidos_agendar[0].estado === 'pendente', r);
  r = pac(P1, 'pacienteAgendarSessao', { dados: { id: uPac, data: '2026-11-30', hora: '15:00' } });
  ok('P6 reenvio do mesmo pedido não duplica', r.ok && r.duplicado === true && linhas('Pedidos_Agenda') === 1 && r.pedidos_agendar.length === 1, r);
  r = pac(P2, 'pacienteAgendarSessao', { dados: { id: uuid(), data: '2026-11-30', hora: '15:00' } });
  ok('P7 o horário pedido fica reservado: o pedido de outro paciente para ele é recusado', r.ok === false && r.codigo === 'ocupado' && r.erro === 'Este horário acabou de ser ocupado. Escolha outro.', r);
  ok('P8 paciente não pede fora da grade, em menos de 24 h nem em feriado', [['2026-11-30', '07:00'], ['2026-11-28', '10:00'], ['2026-11-26', '13:00'], ['2026-12-25', '10:00']].every(x => pac(P2, 'pacienteAgendarSessao', { dados: { id: uuid(), data: x[0], hora: x[1] } }).ok === false));
  r = pac(P2, 'pacienteAgendarSessao', { dados: { id: u9, data: '2026-11-27', hora: '10:00', modalidade: 'presencial' } });
  ok('P9 modalidade que a janela não oferece vira a da janela', r.ok && cel('Pedidos_Agenda', u9, 'modalidade') === 'online' && r.pedidos_agendar.some(x => x.data === '2026-11-27' && x.modalidade === 'online'), r);
  prof('profDecidirPedido', { id: u9, aprovar: false, periodo: PER });
  r = prof('profDecidirPedido', { id: uPac, aprovar: true, periodo: PER });
  ok('P9b o profissional aprova: a sessão nasce a confirmar, com origem pedido e a modalidade pedida', r.ok && r.aprovado === true && cel('Sessoes', idPac, 'origem') === 'pedido' && cel('Sessoes', idPac, 'confirmada_em') === '' && cel('Sessoes', idPac, 'modalidade') === 'online' && cel('Sessoes', idPac, 'valor') === '' && cel('Pedidos_Agenda', uPac, 'sessao_id') === idPac && !r.agenda.pedidos.some(p => p.id === uPac), r.erro);
  r = pac(P1, 'pacienteConfirmarSessao', { id: idPac });
  ok('P10 confirmar presença', r.ok && r.sessoes.filter(x => x.id === idPac)[0].confirmada === true && cel('Sessoes', idPac, 'confirmada_em') !== '' && prof('profLerAgenda', PER).sessoes.filter(x => x.id === idPac)[0].confirmada === true);
  ok('P11 um paciente não confirma, não cancela nem pede sobre a sessão de outro', pac(P2, 'pacienteConfirmarSessao', { id: idPac }).ok === false && pac(P2, 'pacienteCancelarSessao', { id: idPac }).ok === false && pac(P2, 'pacientePedirAgenda', { dados: { id: uuid(), tipo: 'remarcar', sessao_id: idPac, data: '2026-12-01', hora: '10:00' } }).ok === false);
  const perto = uuid();
  sessao(P1, { id: perto, data: '2026-11-26', hora: '12:00' });
  const m = pac(P1, 'lerMinhasSessoes').sessoes;
  ok('P12 dentro das 24 h a ação não é oferecida; fora, é', m.filter(x => x.id === perto)[0].pode_cancelar === false && m.filter(x => x.id === perto)[0].pode_remarcar === false && m.filter(x => x.id === perto)[0].pode_confirmar === true && m.filter(x => x.id === idPac)[0].pode_cancelar === true, m.filter(x => x.id === perto)[0]);
  r = pac(P1, 'pacienteCancelarSessao', { id: perto });
  ok('P13 cancelar com menos de 24 h é recusado pelo servidor, com a regra', r.ok === false && r.codigo === 'prazo' && r.erro.indexOf('só com 24 horas ou mais de antecedência') !== -1 && cel('Sessoes', perto, 'estado') === 'agendada', r);
  irPara(2026, 11, 25, 12, 0);
  r = pac(P1, 'pacienteCancelarSessao', { id: perto });
  ok('P14 exatamente 24 h antes: cancela, não cobrada', r.ok && cel('Sessoes', perto, 'estado') === 'cancelada' && cel('Sessoes', perto, 'cobrada') === 'Nao' && cel('Sessoes', perto, 'cancelada_por') === 'paciente' && r.sessoes.filter(x => x.id === perto)[0].estado === 'cancelada', r);
  irPara(2026, 11, 25, 14, 0);
  r = pac(P1, 'lerMeusLembretes');
  ok('P15 a próxima sessão vai junto na leitura do Início do paciente', r.ok && r.proxima_sessao && r.proxima_sessao.data === '2026-11-30' && r.proxima_sessao.hora === '15:00' && r.proxima_sessao.modalidade === 'online', r.proxima_sessao);
  ok('P16 paciente sem sessão: próxima = null', pac(P3, 'lerMeusLembretes').proxima_sessao === null && pac(P3, 'lerMinhasSessoes').sessoes.every(x => x.estado === 'cancelada'));
});

/* ---------------------------------------------------------------- Q */
console.log('Q. Pedidos do paciente');
tenta('Q', () => {
  const idQ = uuid();
  let r = pac(P1, 'pacientePedirAgenda', { dados: { id: idQ, tipo: 'remarcar', sessao_id: idPac, data: '2026-12-01', hora: '16:00' } });
  ok('Q1 pedir remarcação: a sessão não muda; o pedido fica pendente', r.ok && cel('Sessoes', idPac, 'data') === '2026-11-30' && cel('Pedidos_Agenda', idQ, 'estado') === 'pendente' && r.sessoes.filter(x => x.id === idPac)[0].pedido.estado === 'pendente' && r.sessoes.filter(x => x.id === idPac)[0].pode_remarcar === false, r);
  ok('Q2 segundo pedido para a mesma sessão enquanto o primeiro aguarda: recusado; reenvio do mesmo id: duplicado', pac(P1, 'pacientePedirAgenda', { dados: { id: uuid(), tipo: 'remarcar', sessao_id: idPac, data: '2026-12-01', hora: '17:00' } }).ok === false && pac(P1, 'pacientePedirAgenda', { dados: { id: idQ, tipo: 'remarcar', sessao_id: idPac, data: '2026-12-01', hora: '16:00' } }).duplicado === true && linhas('Pedidos_Agenda') === 3); // 14.7: + os dois pedidos de agendamento do bloco P
  h.memo();
  const lista = prof('profListarPacientes').pacientes.filter(p => p.sigla === P1)[0];
  const lido = prof('profLerAgenda', PER).pedidos;
  ok('Q3 o pedido chega ao profissional: na lista do login e na leitura da agenda', lista.pedidos_agenda && lista.pedidos_agenda.length === 1 && lista.pedidos_agenda[0].tipo === 'remarcar' && lista.pedidos_agenda[0].sessao_data === '2026-11-30' && lido.length === 1 && lido[0].nome === 'Paula Primeira' && lido[0].data === '2026-12-01' && lido[0].hora === '16:00', [lista.pedidos_agenda, lido]);
  sessao(P2, { data: '2026-12-01', hora: '16:00' });
  r = prof('profDecidirPedido', { id: idQ, aprovar: true, periodo: PER });
  ok('Q4 aprovar quando o horário pedido foi ocupado: recusado com a mensagem, pedido continua pendente', r.ok === false && r.erro === 'O horário pedido já foi ocupado. Recuse o pedido ou marque outro horário.' && cel('Pedidos_Agenda', idQ, 'estado') === 'pendente', r);
  r = prof('profDecidirPedido', { id: idQ, aprovar: false, periodo: PER });
  ok('Q5 recusar: a sessão fica onde estava', r.ok && r.aprovado === false && cel('Pedidos_Agenda', idQ, 'estado') === 'recusado' && cel('Sessoes', idPac, 'data') === '2026-11-30' && r.agenda.pedidos.length === 0, r);
  const idQ2 = uuid();
  pac(P1, 'pacientePedirAgenda', { dados: { id: idQ2, tipo: 'remarcar', sessao_id: idPac, data: '2026-12-02', hora: '16:00' } });
  r = prof('profDecidirPedido', { id: idQ2, aprovar: true, periodo: PER });
  ok('Q6 aprovar: a sessão muda para o horário pedido e a confirmação de presença é zerada (o paciente confirma depois — 14.5.4)', r.ok && r.aprovado === true && cel('Sessoes', idPac, 'data') === '2026-12-02' && cel('Sessoes', idPac, 'hora_inicio') === '16:00' && cel('Sessoes', idPac, 'confirmada_em') === '' && cel('Pedidos_Agenda', idQ2, 'estado') === 'aprovado', r);
  ok('Q7 decidir de novo o mesmo pedido não repete a ação', prof('profDecidirPedido', { id: idQ2, aprovar: true, periodo: PER }).duplicado === true);
  ok('Q8 pedido de remarcação para horário que não está livre ou fora da grade: recusado', pac(P1, 'pacientePedirAgenda', { dados: { id: uuid(), tipo: 'remarcar', sessao_id: idPac, data: '2026-12-01', hora: '16:00' } }).ok === false && pac(P1, 'pacientePedirAgenda', { dados: { id: uuid(), tipo: 'remarcar', sessao_id: idPac, data: '2026-12-05', hora: '10:00' } }).ok === false);
  const idFalta = uuid();
  sessao(P2, { id: idFalta, data: '2026-11-24', hora: '15:00', valor: '250' });
  prof('profMarcarSituacao', { id: idFalta, situacao: 'falta', periodo: PER });
  let m = pac(P2, 'lerMinhasSessoes').sessoes.filter(x => x.id === idFalta)[0];
  ok('Q9 sessão cobrada por falta oferece "pedir reposição"', m.estado === 'falta' && m.pode_repor === true, m);
  const idQ3 = uuid();
  r = pac(P2, 'pacientePedirAgenda', { dados: { id: idQ3, tipo: 'repor', sessao_id: idFalta, data: '2026-12-03', hora: '09:00' } });
  ok('Q10 pedir reposição: pendente, e não oferece pedir de novo', r.ok && r.sessoes.filter(x => x.id === idFalta)[0].pedido.tipo === 'repor' && r.sessoes.filter(x => x.id === idFalta)[0].pode_repor === false, r);
  r = prof('profDecidirPedido', { id: idQ3, aprovar: true, periodo: PER });
  const rep = r.agenda.sessoes.filter(x => x.reposicao_de === idFalta)[0];
  ok('Q11 aprovar a reposição: nasce a sessão ligada à falta, com o valor da original e sem cobrança', r.ok && rep && rep.data === '2026-12-03' && rep.hora === '09:00' && rep.valor === '250' && rep.cobrada === 'Nao' && r.agenda.sessoes.filter(x => x.id === idFalta)[0].reposta_em === '2026-12-03', rep);
  ok('Q12 pedido de reposição para sessão não cobrada: recusado', pac(P1, 'pacientePedirAgenda', { dados: { id: uuid(), tipo: 'repor', sessao_id: idPac, data: '2026-12-03', hora: '10:00' } }).ok === false);
  const idQ4 = uuid(), uX = uuid(), idX = 'ag-' + uX;
  agendaAprovada(P2, { id: uX, data: '2026-12-09', hora: '10:00' });
  pac(P2, 'pacientePedirAgenda', { dados: { id: idQ4, tipo: 'remarcar', sessao_id: idX, data: '2026-12-10', hora: '10:00' } });
  prof('profCancelarSessao', { id: idX, opcoes: { quem: 'profissional' }, periodo: PER });
  ok('Q13 sessão cancelada fecha o pedido pendente dela', cel('Pedidos_Agenda', idQ4, 'estado') === 'recusado');
});

/* ---------------------------------------------------------------- V */
console.log('V. Avisos e gatilho');
tenta('V', () => {
  ok('V1 com a chave desligada, nada do que foi feito até aqui mandou e-mail', h.EMAILS.length === 0, h.EMAILS.map(e => e.subject));
  irPara(2026, 11, 24, 9, 0); // 14.4: a sessão nasce a mais de 48 h (dentro do prazo, o lembrete é dispensado)
  const idL = uuid();
  sessao(P1, { id: idL, data: '2026-11-26', hora: '10:00' });
  irPara(2026, 11, 25, 14, 0);
  let r = gatilho(quando(2026, 11, 25, 14, 30));
  ok('V2 gatilho com a chave desligada: a sessão que vence é contada como desligada e nenhum e-mail sai', r.sessoes && r.sessoes.desligados === 1 && r.sessoes.enviados === 0 && h.EMAILS.length === 0 && cel('Sessoes', idL, 'ultimo_aviso_em') === '', r.sessoes);
  r = prof('profSalvarGrade', { config: { duracao_slot_min: 60, antecedencia_min_horas: 24, avisos_sessao: 'Sim' }, grade: gradeSemana });
  ok('V3 ligar a chave pela Grade', r.ok && prof('profLerAgenda', PER).config.avisos_sessao === 'Sim', r);
  r = gatilho(quando(2026, 11, 25, 14, 30));
  ok('V4 gatilho com a chave ligada: lembrete da sessão que começa em menos de 24 h', r.sessoes.enviados === 1 && h.EMAILS.length === 1 && h.EMAILS[0].to === 'p1@exemplo.test' && h.EMAILS[0].subject === 'Lembrete de sessão — COGNIATIVO' && h.EMAILS[0].body.indexOf('quinta, 26/11/2026, às 10:00 (Presencial)') !== -1 && cel('Sessoes', idL, 'ultimo_aviso_em') === '2026-11-25 14:30', [r.sessoes, h.EMAILS.map(e => e.subject)]);
  r = gatilho(quando(2026, 11, 25, 15, 30));
  ok('V5 segunda rodada não manda de novo', r.sessoes.enviados === 0 && h.EMAILS.length === 1, r.sessoes);
  ok('V6 sessão a mais de 24 h e sessão sem a caixa do lembrete não recebem', (() => { const a = uuid(), b = uuid(); h.EMAILS.length = 0; sessao(P1, { id: a, data: '2026-11-27', hora: '16:00', avisos: [] }); sessao(P1, { id: b, data: '2026-11-26', hora: '17:00', avisos: ['confirmacao'] }); h.EMAILS.length = 0; const g = gatilho(quando(2026, 11, 25, 17, 30)); return g.sessoes.enviados === 0 && h.EMAILS.length === 0; })());
  h.EMAILS.length = 0;
  const idV = uuid();
  r = sessao(P1, { id: idV, data: '2026-12-08', hora: '10:00', modalidade: 'online' });
  ok('V7 criar com a caixa marcada: confirmação ao paciente, com o prazo', r.ok && r.aviso === '' && h.EMAILS.length === 1 && h.EMAILS[0].to === 'p1@exemplo.test' && h.EMAILS[0].subject === 'Sessão agendada — COGNIATIVO' && h.EMAILS[0].body.indexOf('terça, 08/12/2026, às 10:00 (On-line)') !== -1 && h.EMAILS[0].body.indexOf('com 24 horas ou mais de antecedência') !== -1, [r.aviso, h.EMAILS.map(e => e.subject)]);
  h.EMAILS.length = 0;
  r = sessao(P1, { data: '2026-12-08', hora: '11:00', avisos: ['lembrete'] });
  ok('V8 criar sem a caixa da confirmação: nenhum e-mail', r.ok && r.aviso === 'caixa' && h.EMAILS.length === 0, r.aviso);
  r = sessao(P3, { data: '2026-12-08', hora: '12:00' });
  ok('V9 paciente sem e-mail no cadastro: a sessão entra e o motivo volta', r.ok && r.aviso === 'sem_email' && h.EMAILS.length === 0, r.aviso);
  r = sessao(P1, { id: idV, data: '2026-12-08', hora: '13:00', modalidade: 'online' });
  ok('V10 remarcar: e-mail com o antes e o depois', r.ok && h.EMAILS.length === 1 && h.EMAILS[0].subject === 'Sessão remarcada — COGNIATIVO' && h.EMAILS[0].body.indexOf('passou de 08/12/2026 às 10:00 para 08/12/2026 às 13:00 (On-line)') !== -1, h.EMAILS.map(e => e.body.slice(0, 300)));
  h.EMAILS.length = 0;
  r = prof('profCancelarSessao', { id: idV, opcoes: { quem: 'profissional', avisar: true }, periodo: PER });
  ok('V11 cancelar com "avisar o paciente": e-mail de cancelamento; sem marcar, nenhum', r.ok && h.EMAILS.length === 1 && h.EMAILS[0].subject === 'Sessão cancelada — COGNIATIVO' && (() => { h.EMAILS.length = 0; const x = uuid(); sessao(P1, { id: x, data: '2026-12-08', hora: '15:00', avisos: [] }); prof('profCancelarSessao', { id: x, opcoes: { quem: 'profissional', avisar: false }, periodo: PER }); return h.EMAILS.length === 0; })(), h.EMAILS.map(e => e.subject));
  h.EMAILS.length = 0;
  r = sessao(P2, { data: '2027-01-12', hora: '08:00', repeticao: { cada: 1, unidade: 'semana', dias_semana: [2], fim_tipo: 'n', fim_n: 3 } });
  ok('V12 série: um e-mail só, com a quantidade e a primeira data', r.ok && h.EMAILS.length === 1 && h.EMAILS[0].subject === 'Sessões agendadas — COGNIATIVO' && h.EMAILS[0].body.indexOf('Foram marcadas 3 sessões') !== -1 && h.EMAILS[0].body.indexOf('12/01/2027') !== -1, h.EMAILS.map(e => e.subject));
  h.EMAILS.length = 0;
  const uW = uuid(), idW = 'ag-' + uW;
  r = pac(P2, 'pacienteAgendarSessao', { dados: { id: uW, data: '2026-12-11', hora: '10:00' } });
  ok('V13 paciente pede o agendamento: só o aviso ao profissional', r.ok && h.EMAILS.length === 1 && h.EMAILS[0].subject === 'Agenda — movimento de paciente' && h.EMAILS[0].body.indexOf('Pedro Segundo pediu para agendar uma sessão em 11/12 às 10:00.') !== -1 && h.EMAILS[0].to !== 'p2@exemplo.test', h.EMAILS.map(e => e.to + ' · ' + e.subject));
  h.EMAILS.length = 0;
  r = prof('profDecidirPedido', { id: uW, aprovar: true, periodo: PER });
  ok('V13b aprovado: "Pedido aprovado" ao paciente, com o horário', r.ok && h.EMAILS.length === 1 && h.EMAILS[0].to === 'p2@exemplo.test' && h.EMAILS[0].subject === 'Pedido aprovado — COGNIATIVO' && h.EMAILS[0].body.indexOf('11/12/2026, às 10:00') !== -1, h.EMAILS.map(e => e.to + ' · ' + e.subject));
  h.EMAILS.length = 0;
  const idQ = uuid();
  pac(P2, 'pacientePedirAgenda', { dados: { id: idQ, tipo: 'remarcar', sessao_id: idW, data: '2026-12-14', hora: '10:00' } });
  ok('V14 pedido de remarcação: aviso ao profissional com as duas datas', h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('Pedro Segundo pediu remarcação de 11/12 às 10:00 para 14/12 às 10:00.') !== -1, h.EMAILS.map(e => e.body.slice(0, 200)));
  h.EMAILS.length = 0;
  prof('profDecidirPedido', { id: idQ, aprovar: true, periodo: PER });
  ok('V15 pedido aprovado: e-mail ao paciente', h.EMAILS.length === 1 && h.EMAILS[0].to === 'p2@exemplo.test' && h.EMAILS[0].subject === 'Pedido aprovado — COGNIATIVO' && h.EMAILS[0].body.indexOf('14/12/2026, às 10:00') !== -1, h.EMAILS.map(e => e.subject));
  h.EMAILS.length = 0;
  pac(P2, 'pacienteCancelarSessao', { id: idW });
  ok('V16 paciente cancela: aviso ao profissional', h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('Pedro Segundo cancelou a sessão de 14/12 às 10:00.') !== -1, h.EMAILS.map(e => e.body.slice(0, 200)));
  const html = S('montarEmailSessao')('confirmacao', { nome: 'Ana', profissional: 'Dr. <b>X</b>', sessao: { data: '2026-12-08', hora_inicio: '10:00', modalidade: 'online' }, horas: 24, assinatura: [] }).html;
  ok('V17 o HTML do e-mail escapa o que vem de cadastro', html.indexOf('<b>X</b>') === -1 && html.indexOf('&lt;b&gt;X&lt;/b&gt;') !== -1);
  h.EMAILS.length = 0;
  prof('profSalvarGrade', { config: { duracao_slot_min: 60, antecedencia_min_horas: 24, avisos_sessao: 'Nao' }, grade: gradeSemana });
  sessao(P1, { data: '2026-12-18', hora: '10:00' });
  ok('V18 desligar a chave de novo: criar sessão volta a não mandar nada', h.EMAILS.length === 0 && prof('profLerAgenda', PER).config.avisos_sessao === 'Nao');
});

/* ---------------------------------------------------------------- X */
console.log('X. Exclusão de paciente');
tenta('X', () => {
  const antes = linhas('Sessoes');
  const deP3 = prof('profLerAgenda', PER).sessoes.filter(x => x.sigla === P3).length;
  prof('profDesativarPaciente', { siglaPaciente: P3 });
  global.DriveApp.getFileById = id => ({ setTrashed: () => {} }); // o arnês não simula a lixeira do Drive
  const r = prof('profExcluirPaciente', { siglaPaciente: P3, confirmacaoSigla: P3 });
  h.memo();
  const depois = prof('profLerAgenda', PER).sessoes;
  ok('X1 paciente excluído: as sessões, séries e pedidos dele saem; os dos outros ficam', r.ok && deP3 > 0 && !depois.some(x => x.sigla === P3) && linhas('Sessoes') < antes && depois.some(x => x.sigla === P1) && depois.some(x => x.sigla === P2), [r, deP3]);
});

/* ---------------------------------------------------------------- T */
console.log('T. Trava e crachá');
tenta('T', () => {
  const fonteJs = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  const grava = ['profSalvarSessao', 'profEditarSerie', 'profCancelarSessao', 'profMarcarSituacao', 'profSalvarBloqueio', 'profApagarBloqueio', 'profDecidirPedido', 'pacienteAgendarSessao', 'pacienteConfirmarSessao', 'pacienteCancelarSessao', 'pacientePedirAgenda'];
  const le = ['profLerAgenda', 'lerMinhasSessoes', 'lerHorariosLivres'];
  ok('T1 as 11 ações que gravam estão na trava; as 3 leituras, não', grava.every(a => S('ACOES_COM_TRAVA').indexOf(a) !== -1) && le.every(a => S('ACOES_COM_TRAVA').indexOf(a) === -1 && S('ACOES_SO_LEITURA').indexOf(a) !== -1));
  h.TRAVA.ocupada = true;
  const r = sessao(P1, { data: '2026-12-22', hora: '10:00' });
  const r2 = pac(P1, 'pacienteAgendarSessao', { dados: { id: uuid(), data: '2026-12-22', hora: '11:00' } });
  const leitura = prof('profLerAgenda', PER);
  h.TRAVA.ocupada = false;
  ok('T2 com a trava ocupada as gravações recusam ("ocupado" do servidor) e a leitura segue', r.ok === false && r.codigo === 'ocupado' && r2.ok === false && r2.codigo === 'ocupado' && leitura.ok === true, [r, r2]);
  ok('T3 sem crachá nenhuma ação da agenda responde', grava.concat(le).every(a => h.post({ acao: a, token: 'cracha-inventado', dados: {} }).ok === false));
  ok('T4 crachá de paciente não usa ação de profissional; crachá de profissional não usa ação de paciente', pac(P1, 'profLerAgenda', PER).ok === false && pac(P1, 'profSalvarSessao', { dados: { id: uuid(), sigla: P1, data: '2026-12-22', hora: '10:00' } }).ok === false && pac(P1, 'profCancelarSessao', { id: idA }).ok === false && prof('lerMinhasSessoes').ok === false && prof('pacienteAgendarSessao', { dados: { id: uuid(), data: '2026-12-22', hora: '10:00' } }).ok === false);
  ok('T5 o gatilho dos lembretes chama o das sessões dentro de try/catch e o invólucro continua o mesmo', /r\.sessoes = enviarAvisosSessao_\(quando\);/.test(fonteJs) && /function enviarAvisosSessao_\(/.test(fonteJs) && /function rodarLembretesAgora\(/.test(fonteJs));
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T7 o servidor não registrou nenhum erro além da trava ocupada provocada', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
