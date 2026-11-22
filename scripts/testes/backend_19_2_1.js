/* Pacote 19.2.1 — Plano de lembretes: testes em Node do Código.js REAL sobre as planilhas simuladas do arnês
   de backend_18_10a.js (carregado até a linha em que os testes dele começam; nada é copiado).
   Relógio fixo: `Date` entra como parâmetro no arnês e no Código.js — o resultado não depende do dia nem do fuso
   em que a suíte roda (o portão do GitHub roda em UTC; as datas são montadas por componentes locais).
   Blocos: R regra de datas (pura, "agora" por parâmetro) · A aba e ações do profissional · C paciente respondeu ·
   I blocos do Início na lista · P leitura do paciente · E gatilho e e-mail (duas rodadas) · L lembrar agora ·
   X exclusão · G 8.23 (ind_total_auto sem checagem sozinha) · N 19.2.2 (sigla da escala e texto do "Outro" no e-mail) ·
   T trava e crachá.
   Uso: node scripts/testes/backend_19_2_1.js */
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
const erroReal = console.error;
const av = new Function('require', '__dirname', 'Date', fonte.slice(0, fim) + '\nreturn function (__src) { return eval(__src); };')(require, __dirname, DataFixa);
/* O que o Código.js mandar para o console.error fica em `logServidor` (a suíte confere o que espera ver lá). */
const logServidor = [];
console.error = (...a) => { logServidor.push(a.map(String).join(' ')); };
/* O arnês é do 18.10: completa o cache do script (o portão do 18.11 usa getAll/removeAll) e o base64 do logo do e-mail (16.11). */
const CACHE = new Map();
const cacheObj = { get: k => (CACHE.has(k) ? CACHE.get(k) : null), getAll: ks => { const r = {}; (ks || []).forEach(k => { if (CACHE.has(k)) r[k] = CACHE.get(k); }); return r; },
  put: (k, v) => { CACHE.set(k, String(v)); }, putAll: o => { Object.keys(o || {}).forEach(k => CACHE.set(k, String(o[k]))); }, remove: k => { CACHE.delete(k); }, removeAll: ks => { (ks || []).forEach(k => CACHE.delete(k)); } };
global.CacheService = { getScriptCache: () => cacheObj };
global.Utilities.base64Decode = s => Array.from(Buffer.from(String(s), 'base64')).map(x => (x > 127 ? x - 256 : x));
const h = av('({ post: post, cracha: cracha, novoPaciente: novoPaciente, celula: celula, linhaDe: linhaDe, cab: cab, abaPac: abaPac, ctrl: ctrl, sProf: sProf, EMAILS: EMAILS, PROPS: PROPS, TRAVA: TRAVA, registro: registro, escala: escala, memo: _memoZerar_, aceite: _gravarAceitePolitica_, hashProf: hashProf, planilhaDe: planilhaDe, ind: ind })');
const S = nome => av(nome); // função ou constante do Código.js pelo nome

let passo = 0, falhas = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 400) : '')); } };
const tenta = (n, f) => { try { f(); } catch (e) { ok(n + ' (exceção)', false, String(e && e.stack || e).slice(0, 500)); } };
const uuid = () => crypto.randomUUID();
const tokProf = () => h.cracha('profissional', 'NP', 'PROF_NP', h.hashProf);
const tokPac = sigla => h.cracha('paciente', sigla, 'PROF_NP', h.celula(h.abaPac, h.linhaDe(h.abaPac, 'sigla', sigla), 'senha_hash'));
const prof = (acao, extra) => h.post(Object.assign({ acao: acao, token: tokProf() }, extra || {}));
const pac = (sigla, acao, extra) => h.post(Object.assign({ acao: acao, token: tokPac(sigla) }, extra || {}));
const novo = (nome, email, tel) => { const s = h.novoPaciente(nome, email); h.memo(); h.aceite(s, 'PROF_NP'); h.memo(); if (tel) h.abaPac.getRange(h.linhaDe(h.abaPac, 'sigla', s), h.cab(h.abaPac).indexOf('telefone') + 1).setValue("'" + tel); return s; };
const abaLem = () => h.ctrl.getSheetByName('Lembretes');
const linhaLem = id => h.linhaDe(abaLem(), 'id', id);
const celLem = (id, col) => h.celula(abaLem(), linhaLem(id), col);
const salvar = (sigla, d) => prof('profSalvarLembrete', { siglaPaciente: sigla, dados: Object.assign({ id: uuid(), tipo: 'auto', recorrencia: 'recorrente', periodicidade: 'diaria', data_inicio: '2026-11-25', hora: '09:00' }, d || {}) });
const gatilho = d => { h.memo(); return S('enviarLembretes_')(d); };

/* ---------------------------------------------------------------- R */
console.log('R. Regra de datas (funções puras; o "agora" entra por parâmetro)');
tenta('R', () => {
  const ocorre = S('_lembreteOcorre_'), sit = S('_lembreteSituacao_'), vence = S('_lembreteEmailVence_'), agoraDe = S('_lemAgora_');
  const item = (x) => Object.assign({ tipo: 'auto', recorrencia: 'recorrente', periodicidade: 'diaria', data_inicio: '2026-11-25', data_termino: '', hora: '09:00', ativo: 'Sim', dias_semana: '', ultimo_email_em: '', ultimo_cumprido_em: '' }, x || {});
  const dias = (it, lista) => lista.map(d => ocorre(it, d) ? 1 : 0).join('');
  ok('R1 diária: todo dia a partir do início; antes do início não', dias(item(), ['2026-11-24', '2026-11-25', '2026-11-26', '2026-12-31']) === '0111');
  ok('R2 diária com término (inclusive): o dia do término vale, o seguinte não', dias(item({ data_termino: '2026-11-27' }), ['2026-11-27', '2026-11-28']) === '10');
  ok('R3 semanal: mesmo dia da semana do início, a cada 7 dias', dias(item({ periodicidade: 'semanal' }), ['2026-11-25', '2026-11-26', '2026-12-01', '2026-12-02', '2026-12-09']) === '10011');
  ok('R4 quinzenal: a cada 14 dias', dias(item({ periodicidade: 'quinzenal' }), ['2026-11-25', '2026-12-02', '2026-12-09', '2026-12-23']) === '1011');
  ok('R5 mensal: mesmo dia do mês', dias(item({ periodicidade: 'mensal' }), ['2026-12-24', '2026-12-25', '2027-01-25', '2027-01-26']) === '0110');
  ok('R6 mensal no dia 31: em mês mais curto vale o último dia (30/11, 28/02), e só ele', dias(item({ periodicidade: 'mensal', data_inicio: '2026-10-31' }), ['2026-10-31', '2026-11-29', '2026-11-30', '2026-12-30', '2026-12-31', '2027-02-27', '2027-02-28', '2028-02-28', '2028-02-29']) === '101010101');
  ok('R7 dias da semana escolhidos (seg, qua, sex = 1,3,5): 25/11/2026 é quarta', dias(item({ periodicidade: 'dias_semana', dias_semana: '1,3,5' }), ['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30']) === '101001');
  ok('R8 somente uma vez: só na data escolhida — não repete', dias(item({ recorrencia: 'uma_vez', periodicidade: '' }), ['2026-11-24', '2026-11-25', '2026-11-26', '2026-12-02', '2026-12-25']) === '01000');
  ok('R9 lembrar agora: só no dia em que foi enviado', dias(item({ recorrencia: 'agora', periodicidade: '' }), ['2026-11-25', '2026-11-26']) === '10');
  ok('R10 data que não existe (31/02) e texto que não é data não ocorrem', !ocorre(item(), '2027-02-31') && !ocorre(item({ data_inicio: '25/11/2026' }), '2026-11-25') && !ocorre(item(), ''));

  const s = (it, hoje) => sit(it, hoje);
  ok('R11 vence hoje e não está atrasado no primeiro dia', s(item(), '2026-11-25').hoje === true && s(item(), '2026-11-25').atrasado === '');
  ok('R12 diária sem resposta: no dia seguinte, atrasado = ontem (e vence hoje de novo)', s(item(), '2026-11-26').atrasado === '2026-11-25' && s(item(), '2026-11-26').hoje === true);
  ok('R13 respondido na data prevista: não fica atrasado', s(item({ ultimo_cumprido_em: '2026-11-25' }), '2026-11-26').atrasado === '');
  ok('R14 respondido hoje cobre o atraso de ontem e marca respondido_hoje', s(item({ ultimo_cumprido_em: '2026-11-26' }), '2026-11-26').atrasado === '' && s(item({ ultimo_cumprido_em: '2026-11-26' }), '2026-11-26').respondido_hoje === true);
  ok('R15 semanal: atrasado aponta a última data prevista (25/11) seis dias depois; resposta antiga (24/11) não cobre', s(item({ periodicidade: 'semanal', ultimo_cumprido_em: '2026-11-24' }), '2026-12-01').atrasado === '2026-11-25' && s(item({ periodicidade: 'semanal' }), '2026-12-01').hoje === false);
  ok('R16 mensal: atrasado 25 dias depois ainda aponta a data prevista (item em vigor não some)', s(item({ periodicidade: 'mensal' }), '2026-12-20').atrasado === '2026-11-25');
  ok('R17 uma vez: atrasado por 7 dias, no 8º sai', s(item({ recorrencia: 'uma_vez' }), '2026-12-02').atrasado === '2026-11-25' && s(item({ recorrencia: 'uma_vez' }), '2026-12-03').atrasado === '');
  ok('R18 recorrente já terminado: atrasado por 7 dias depois da última data, depois sai', s(item({ data_termino: '2026-11-27' }), '2026-12-04').atrasado === '2026-11-27' && s(item({ data_termino: '2026-11-27' }), '2026-12-05').atrasado === '');
  ok('R19 "Outro" nunca fica atrasado; encerrado não aparece em nada', s(item({ tipo: 'outro' }), '2026-11-26').atrasado === '' && s(item({ tipo: 'outro' }), '2026-11-26').hoje === true && s(item({ ativo: 'Nao' }), '2026-11-26').hoje === false && s(item({ ativo: 'Nao' }), '2026-11-26').atrasado === '');
  ok('R20 virada do mês: diária de 30/11 para 01/12 — atrasado = 30/11', s(item(), '2026-12-01').atrasado === '2026-11-30');
  ok('R21 e-mail de hoje aparece com a hora (e só o de hoje)', s(item({ ultimo_email_em: '2026-11-26 09:14' }), '2026-11-26').email_hoje === '09:14' && s(item({ ultimo_email_em: '2026-11-25 09:14' }), '2026-11-26').email_hoje === '');

  ok('R22 e-mail vence: hora já passou e ainda não foi hoje', vence(item(), '2026-11-25', '09:00') === true && vence(item(), '2026-11-25', '23:59') === true);
  ok('R23 e-mail não vence antes da hora', vence(item(), '2026-11-25', '08:59') === false);
  ok('R24 e-mail não vence duas vezes no dia; vence de novo no dia seguinte', vence(item({ ultimo_email_em: '2026-11-25 09:10' }), '2026-11-25', '15:00') === false && vence(item({ ultimo_email_em: '2026-11-25 09:10' }), '2026-11-26', '09:00') === true);
  ok('R25 e-mail não vence fora da data, depois do término, encerrado, nem se o paciente já respondeu hoje',
    vence(item({ periodicidade: 'semanal' }), '2026-11-26', '10:00') === false && vence(item({ data_termino: '2026-11-25' }), '2026-11-26', '10:00') === false &&
    vence(item({ ativo: 'Nao' }), '2026-11-25', '10:00') === false && vence(item({ ultimo_cumprido_em: '2026-11-25' }), '2026-11-25', '10:00') === false);

  const a1 = agoraDe(quando(2026, 11, 25, 23, 50)), a2 = agoraDe(quando(2026, 11, 26, 0, 10)), a3 = agoraDe(quando(2026, 11, 30, 23, 59)), a4 = agoraDe(quando(2026, 12, 1, 0, 1));
  ok('R26 virada do dia: 23:50 ainda é o dia 25; 00:10 já é o dia 26', a1.data === '2026-11-25' && a1.hora === '23:50' && a2.data === '2026-11-26' && a2.hora === '00:10', [a1, a2]);
  ok('R27 virada do mês: 30/11 23:59 e 01/12 00:01', a3.data === '2026-11-30' && a4.data === '2026-12-01' && a4.carimbo === '2026-12-01 00:01', [a3, a4]);
});

/* ---------------------------------------------------------------- A */
let P1, P2, P3, idDiario, idSemanal, idOutro;
console.log('A. Aba Lembretes e ações do profissional');
tenta('A', () => {
  irPara(2026, 11, 25, 14, 0);
  P1 = novo('Paciente Um do Plano', 'p1@exemplo.test', '11999990001');
  P2 = novo('Paciente Dois Sem Plano', 'p2@exemplo.test', '11999990002');
  P3 = novo('Paciente Três do Plano', 'p3@exemplo.test', '');
  const cabAntes = h.cab(h.abaPac).slice();
  ok('A1 antes do primeiro item a aba Lembretes não existe; a leitura não a cria', abaLem() === null && prof('profLerDadosPaciente', { siglaPaciente: P1 }).lembretes.length === 0 && abaLem() === null);
  idDiario = uuid();
  let r = salvar(P1, { id: idDiario });
  ok('A2 primeiro item: a aba nasce só pelo cabeçalho, com as 18 colunas, e o item volta na resposta', r.ok && abaLem() !== null && JSON.stringify(h.cab(abaLem())) === JSON.stringify(S('COLUNAS_LEMBRETES')) && h.cab(abaLem()).length === 18 && r.lembretes.length === 1 && r.lembretes[0].id === idDiario, r);
  ok('A3 nenhuma coluna existente da aba Pacientes mudou (mesmo cabeçalho, na mesma ordem)', JSON.stringify(h.cab(h.abaPac).slice(0, cabAntes.length)) === JSON.stringify(cabAntes));
  ok('A4 item lido por coluna: data e hora são TEXTO na célula (não viram Date)', celLem(idDiario, 'data_inicio') === '2026-11-25' && celLem(idDiario, 'hora') === '09:00' && celLem(idDiario, 'sigla') === P1 && celLem(idDiario, 'tipo') === 'auto' && celLem(idDiario, 'periodicidade') === 'diaria' && celLem(idDiario, 'ativo') === 'Sim' && celLem(idDiario, 'criado_em') === '2026-11-25 14:00' && celLem(idDiario, 'criado_por') === 'Dra. Nova de Prova', [celLem(idDiario, 'data_inicio'), celLem(idDiario, 'hora'), celLem(idDiario, 'criado_em')]);
  r = salvar(P1, { id: idDiario, hora: '20:30', data_termino: '2026-12-20' });
  ok('A5 salvar de novo o mesmo id edita (não duplica) e não toca em criado_em', r.ok && abaLem().getLastRow() === 2 && celLem(idDiario, 'hora') === '20:30' && celLem(idDiario, 'data_termino') === '2026-12-20' && celLem(idDiario, 'criado_em') === '2026-11-25 14:00' && r.lembretes[0].hora === '20:30');
  salvar(P1, { id: idDiario, hora: '09:00', data_termino: '' });
  idSemanal = uuid();
  r = salvar(P1, { id: idSemanal, tipo: 'escala', instrumento: 'PHQ-9', periodicidade: 'semanal', data_inicio: '2026-11-18', hora: '08:00' });
  ok('A6 lembrete de escala abre a escala para o paciente (escala_aberta) e grava o código', r.ok && r.escala_aberta === true && r.escalas_liberadas.indexOf('phq9') !== -1 && celLem(idSemanal, 'instrumento') === 'PHQ-9', r);
  r = salvar(P1, { tipo: 'escala', instrumento: 'PHQ-9', recorrencia: 'uma_vez', data_inicio: '2026-11-30', hora: '10:00' });
  ok('A7 escala que já estava aberta: escala_aberta = false', r.ok && r.escala_aberta === false);
  idOutro = uuid();
  r = salvar(P1, { id: idOutro, tipo: 'outro', texto: '  =SOMA(1;2)  treino de\nrespiração  ', periodicidade: 'dias_semana', dias_semana: [5, 1, 3, 3, 9], hora: '7:05' });
  ok('A8 "Outro": texto limpo, gravado como texto literal (fórmula não vira fórmula); dias em ordem; hora 07:05', r.ok && celLem(idOutro, 'texto') === '=SOMA(1;2) treino de respiração' && celLem(idOutro, 'dias_semana') === '1,3,5' && celLem(idOutro, 'hora') === '07:05', [celLem(idOutro, 'texto'), celLem(idOutro, 'dias_semana'), celLem(idOutro, 'hora')]);
  const erro = d => salvar(P1, d).erro;
  ok('A9 obrigatórios com as mensagens aprovadas', erro({ tipo: '' }) === 'Escolha o que lembrar.' && erro({ tipo: 'escala', instrumento: 'NAO-EXISTE' }) === 'Escolha o que lembrar.' && erro({ tipo: 'outro', texto: '   ' }) === 'Escreva o que foi combinado.' && erro({ data_inicio: '' }) === 'Escolha a data.' && erro({ data_inicio: '2027-02-31' }) === 'Escolha a data.' && erro({ hora: '' }) === 'Escolha o horário.' && erro({ hora: '25:00' }) === 'Escolha o horário.' && erro({ periodicidade: 'dias_semana', dias_semana: [] }) === 'Escolha pelo menos um dia da semana.' && erro({ data_termino: '2026-11-24' }) === 'A data de término não pode ser antes do início.');
  ok('A10 nada do que foi recusado virou linha', abaLem().getLastRow() === 5, abaLem().getLastRow());
  ok('A11 paciente que não existe é recusado', salvar('ZZZ9', {}).ok === false);
  const idFim = uuid();
  salvar(P1, { id: idFim, recorrencia: 'uma_vez', data_inicio: '2026-11-26', hora: '10:00' });
  r = prof('profEncerrarLembrete', { siglaPaciente: P1, id: idFim });
  ok('A12 encerrar: ativo = Nao, encerrado_em gravado, a linha fica; o item volta marcado', r.ok && celLem(idFim, 'ativo') === 'Nao' && celLem(idFim, 'encerrado_em') === '2026-11-25 14:00' && r.lembretes.filter(i => i.id === idFim)[0].ativo === 'Nao' && abaLem().getLastRow() === 6);
  ok('A13 item encerrado não se edita; encerrar item de outro paciente é recusado', salvar(P1, { id: idFim }).ok === false && prof('profEncerrarLembrete', { siglaPaciente: P2, id: idDiario }).ok === false && celLem(idDiario, 'ativo') === 'Sim');
  const plano = prof('profLerDadosPaciente', { siglaPaciente: P1 }).lembretes;
  ok('A14 o plano vem dentro de profLerDadosPaciente: ativos primeiro, por hora; o do outro paciente fica vazio', plano.length === 5 && plano[0].hora === '07:05' && plano[plano.length - 1].ativo === 'Nao' && prof('profLerDadosPaciente', { siglaPaciente: P2 }).lembretes.length === 0, plano.map(i => i.hora + ' ' + i.ativo));
});

/* ---------------------------------------------------------------- C */
console.log('C. O paciente respondeu');
tenta('C', () => {
  irPara(2026, 11, 25, 15, 0);
  let r = pac(P1, 'salvarAutomonitoramento', { dados: h.registro({ neg_preenchido: '', pos_preenchido: '', id_envio: uuid() }) });
  ok('C1 checagem de humor sozinha NÃO marca o lembrete de automonitoramento', r.ok && celLem(idDiario, 'ultimo_cumprido_em') === '', celLem(idDiario, 'ultimo_cumprido_em'));
  r = pac(P1, 'salvarAutomonitoramento', { dados: h.registro({ id_envio: uuid() }) });
  ok('C2 registro completo marca o item de automonitoramento com a data de hoje (texto) e não toca no da escala', r.ok && celLem(idDiario, 'ultimo_cumprido_em') === '2026-11-25' && celLem(idSemanal, 'ultimo_cumprido_em') === '');
  r = pac(P1, 'salvarEscala', { dados: h.escala({ instrumento: 'GAD-7', id_envio: uuid() }) });
  ok('C3 escala de outro instrumento não marca o lembrete do PHQ-9', r.ok && celLem(idSemanal, 'ultimo_cumprido_em') === '');
  r = pac(P1, 'salvarEscala', { dados: h.escala({ id_envio: uuid() }) });
  ok('C4 a escala do lembrete marca o item dela', r.ok && celLem(idSemanal, 'ultimo_cumprido_em') === '2026-11-25');
  const idP3 = uuid();
  salvar(P3, { id: idP3 });
  r = prof('profCriarAutomonitoramento', { siglaPaciente: P3, dados: h.registro({ id_envio: uuid() }) });
  ok('C5 registro criado pelo profissional em nome do paciente também marca; "Outro" nunca é marcado', r.ok && celLem(idP3, 'ultimo_cumprido_em') === '2026-11-25' && celLem(idOutro, 'ultimo_cumprido_em') === '', r);
});

/* ---------------------------------------------------------------- I */
console.log('I. Blocos do Início (lista do profissional)');
tenta('I', () => {
  irPara(2026, 11, 26, 10, 0); // quinta-feira: diário vence hoje; o semanal (quartas) foi ontem e está respondido
  const idAtr = uuid();
  salvar(P1, { id: idAtr, tipo: 'escala', instrumento: 'GAD-7', recorrencia: 'uma_vez', data_inicio: '2026-11-25', hora: '08:00' });
  const lista = prof('profListarPacientes').pacientes;
  const de = s => lista.filter(p => p.sigla === s)[0];
  const l1 = de(P1).lembretes;
  ok('I1 paciente com plano: o diário vence hoje; a escala de data única de ontem está atrasada; o semanal respondido não aparece', l1.filter(i => i.id === idDiario)[0].hoje === true && l1.filter(i => i.id === idDiario)[0].atrasado === '' && l1.filter(i => i.id === idAtr)[0].atrasado === '2026-11-25' && l1.filter(i => i.id === idAtr)[0].hoje === false && l1.filter(i => i.id === idSemanal).length === 0, l1);
  ok('I2 o paciente com lembrete leva o telefone do cadastro e tem_email', de(P1).telefone === '11999990001' && de(P1).tem_email === true);
  ok('I3 paciente sem plano não aparece: lembretes vazio e sem telefone na lista', de(P2).lembretes.length === 0 && de(P2).telefone === undefined && de(P2).tem_email === undefined);
  ok('I4 a lista que vai no login traz o mesmo', (() => { const a = h.post({ acao: 'profListarPacientes', token: tokProf() }); return JSON.stringify(a.pacientes) === JSON.stringify(lista); })());
  prof('profDesativarPaciente', { siglaPaciente: P3 });
  ok('I5 paciente desativado sai dos blocos', prof('profListarPacientes').pacientes.filter(p => p.sigla === P3)[0].lembretes.length === 0);
  prof('profReativarPaciente', { siglaPaciente: P3 });
});

/* ---------------------------------------------------------------- P */
console.log('P. Leitura do paciente (só leitura)');
tenta('P', () => {
  irPara(2026, 11, 26, 10, 0);
  const r = pac(P1, 'lerMeusLembretes', {});
  const datas = r.lembretes.map(i => i.data + ' ' + i.hora + ' ' + i.tipo);
  ok('P1 uma linha por item ativo, com a próxima data nos 7 dias, em ordem', r.ok && r.hoje === '2026-11-26' && JSON.stringify(datas) === JSON.stringify(['2026-11-26 09:00 auto', '2026-11-27 07:05 outro', '2026-11-30 10:00 escala', '2026-12-02 08:00 escala']), datas);
  ok('P2 o texto do "Outro" e o código da escala vão para a tela do paciente; item encerrado e data única que passou não', r.lembretes[1].texto === '=SOMA(1;2) treino de respiração' && r.lembretes[3].instrumento === 'PHQ-9' && r.lembretes.length === 4);
  pac(P1, 'salvarAutomonitoramento', { dados: h.registro({ id_envio: uuid() }) });
  ok('P3 respondido hoje: a linha do item passa para a data seguinte', pac(P1, 'lerMeusLembretes', {}).lembretes.filter(i => i.tipo === 'auto')[0].data === '2026-11-27');
  ok('P4 outro paciente não vê nada disso; crachá de profissional não lê', pac(P2, 'lerMeusLembretes', {}).lembretes.length === 0 && prof('lerMeusLembretes').ok === false);
  ok('P5 a leitura do paciente não grava nada', (() => { const antes = JSON.stringify(abaLem().dados); pac(P1, 'lerMeusLembretes', {}); return JSON.stringify(abaLem().dados) === antes; })());
});

/* ---------------------------------------------------------------- E */
console.log('E. Gatilho e e-mail');
tenta('E', () => {
  // dia 27/11 (sexta): P1 diário 09:00 + "Outro" 07:05 (seg, qua, sex); P3 diário 09:00
  h.EMAILS.length = 0;
  let r = gatilho(quando(2026, 11, 27, 6, 30));
  ok('E1 antes da hora de todos: nenhum e-mail', r.ok && r.enviados === 0 && h.EMAILS.length === 0, r);
  r = gatilho(quando(2026, 11, 27, 7, 30));
  ok('E2 07:30: só o item das 07:05', r.enviados === 1 && h.EMAILS.length === 1 && h.EMAILS[0].to === 'p1@exemplo.test' && h.EMAILS[0].subject === 'Lembrete do COGNIATIVO', r);
  r = gatilho(quando(2026, 11, 27, 9, 20));
  ok('E3 09:20: os dois diários (um e-mail por item); o das 07:05 não repete', r.enviados === 2 && r.ja_enviados === 0 && h.EMAILS.length === 3 && h.EMAILS.filter(m => m.subject === 'Hora do seu registro no COGNIATIVO').length === 2, r);
  ok('E4 data do envio gravada como texto, lida por coluna', celLem(idDiario, 'ultimo_email_em') === '2026-11-27 09:20' && celLem(idOutro, 'ultimo_email_em') === '2026-11-27 07:30');
  r = gatilho(quando(2026, 11, 27, 9, 25));
  const r3 = gatilho(quando(2026, 11, 27, 23, 55));
  ok('E5 segunda rodada no mesmo dia: ZERO e-mail (e a terceira também)', r.enviados === 0 && r3.enviados === 0 && h.EMAILS.length === 3, [r, r3]);
  const corpo = h.EMAILS.map(m => m.body + ' ' + m.htmlBody + ' ' + m.subject).join(' ');
  // 19.2.2 (decisão do usuário, 22/11/2026): o texto do "Outro" passou a aparecer no corpo do e-mail; o assunto continua genérico
  ok('E6 o texto do "Outro" aparece no corpo do e-mail dele e em nenhum assunto', corpo.indexOf('Combinado de hoje: =SOMA(1;2) treino de respiração') !== -1 && h.EMAILS.every(m => !/respira|SOMA|PHQ|GAD/.test(m.subject)));
  const m = h.EMAILS.filter(x => x.subject === 'Hora do seu registro no COGNIATIVO' && x.to === 'p1@exemplo.test')[0];
  ok('E7 texto aprovado, primeiro nome do paciente, assinatura do profissional, link do site e a linha sob o botão', m.body.indexOf('Olá, Paciente.') !== -1 && m.body.indexOf('Este é o lembrete que combinamos para hoje. Quando puder, registre como foi o seu dia: leva poucos minutos e ajuda a próxima sessão.') !== -1 && m.body.indexOf('Este lembrete faz parte do plano combinado nas sessões. Para mudar o horário ou parar de receber, é só avisar.') !== -1 && m.body.indexOf('Dra. Nova de Prova') !== -1 && m.body.indexOf(S('SITE_URL')) !== -1 && m.htmlBody.indexOf('Fazer o registro de hoje') !== -1 && m.htmlBody.indexOf('Abre o COGNIATIVO; se a sessão tiver expirado, é só entrar de novo.') !== -1 && m.name === 'COGNIATIVO', m.body);
  h.EMAILS.length = 0;
  r = gatilho(quando(2026, 11, 28, 9, 30)); // sábado: só os dois diários
  ok('E8 no dia seguinte os diários saem de novo (um por item por dia)', r.enviados === 2 && h.EMAILS.length === 2, r);

  // escala semanal (quartas 08:00) em 02/12, com o paciente já tendo respondido naquele dia
  h.EMAILS.length = 0;
  irPara(2026, 12, 2, 7, 0);
  pac(P1, 'salvarEscala', { dados: h.escala({ id_envio: uuid() }) });
  r = gatilho(quando(2026, 12, 2, 8, 30));
  ok('E9 o paciente já respondeu hoje antes da hora: o e-mail da escala não sai (o "Outro" das quartas sai)', h.EMAILS.filter(x => x.subject === 'Há uma escala para você no COGNIATIVO').length === 0 && h.EMAILS.filter(x => x.subject === 'Lembrete do COGNIATIVO').length === 1, r);

  // sem e-mail, desativado, encerrado
  h.EMAILS.length = 0;
  const linhaP3 = h.linhaDe(h.abaPac, 'sigla', P3), colEmail = h.cab(h.abaPac).indexOf('email') + 1;
  const emailP3 = h.abaPac.getRange(linhaP3, colEmail).getValue();
  h.abaPac.getRange(linhaP3, colEmail).setValue('');
  r = gatilho(quando(2026, 12, 3, 9, 30));
  ok('E10 paciente sem e-mail no cadastro: não envia e conta como sem_email (o de P1 sai)', r.sem_email === 1 && r.enviados === 1 && h.EMAILS.every(x => x.to === 'p1@exemplo.test'), r);
  h.abaPac.getRange(linhaP3, colEmail).setValue("'" + emailP3);
  prof('profDesativarPaciente', { siglaPaciente: P3 });
  r = gatilho(quando(2026, 12, 4, 9, 30));
  ok('E11 paciente desativado não recebe', r.inativos === 1 && h.EMAILS.filter(x => x.to === emailP3).length === 0, r);
  prof('profReativarPaciente', { siglaPaciente: P3 });

  // falha no envio: a marca é desfeita e a rodada seguinte manda
  h.EMAILS.length = 0;
  const mailReal = global.MailApp;
  global.MailApp = { sendEmail: () => { throw new Error('servico fora'); } };
  r = gatilho(quando(2026, 12, 5, 9, 30));
  global.MailApp = mailReal;
  ok('E12 envio que falha: conta a falha e a marca do dia é desfeita', r.falhas === 2 && r.enviados === 0 && celLem(idDiario, 'ultimo_email_em').slice(0, 10) !== '2026-12-05', [r, celLem(idDiario, 'ultimo_email_em')]);
  r = gatilho(quando(2026, 12, 5, 10, 30));
  ok('E13 a rodada seguinte manda o que falhou — uma vez', r.enviados === 2 && h.EMAILS.length === 2 && gatilho(quando(2026, 12, 5, 11, 30)).enviados === 0, r);

  // cota própria
  h.EMAILS.length = 0;
  irPara(2026, 12, 6, 9, 30);
  h.PROPS['lembretes:2026-12-06'] = String(S('LEMBRETES_DIA_MAX'));
  r = gatilho(quando(2026, 12, 6, 9, 30));
  ok('E14 cota do dia esgotada (60): nada sai, nada é marcado; a cota dos convites não foi tocada', r.sem_cota === 2 && r.enviados === 0 && h.EMAILS.length === 0 && celLem(idDiario, 'ultimo_email_em').slice(0, 10) === '2026-12-05' && h.PROPS['emails:2026-12-06'] === undefined, r);

  // item encerrado e término
  const idT = uuid();
  irPara(2026, 12, 7, 6, 0);
  salvar(P2, { id: idT, data_inicio: '2026-12-07', data_termino: '2026-12-08', hora: '06:30' });
  h.EMAILS.length = 0;
  const d7 = gatilho(quando(2026, 12, 7, 7, 0)), d8 = gatilho(quando(2026, 12, 8, 7, 0)), d9 = gatilho(quando(2026, 12, 9, 7, 0));
  const paraP2 = h.EMAILS.filter(x => x.to === 'p2@exemplo.test').length;
  ok('E15 término respeitado: sai nos dias 7 e 8 e não sai no dia 9', paraP2 === 2 && d9.enviados === 0, [d7, d8, d9, paraP2]);
  irPara(2026, 12, 10, 6, 0);
  prof('profEncerrarLembrete', { siglaPaciente: P1, id: idDiario });
  h.EMAILS.length = 0;
  r = gatilho(quando(2026, 12, 10, 9, 30));
  ok('E16 item encerrado não manda mais e-mail (o de P3 continua)', r.enviados === 1 && h.EMAILS.length === 1 && h.EMAILS[0].to === 'p3@exemplo.test', r);
  ok('E17 o resumo do gatilho só tem contagens (nenhuma sigla, nenhum e-mail)', Object.keys(r).every(k => typeof r[k] === 'number' || typeof r[k] === 'boolean' || k === 'data' || k === 'hora' || (k === 'sessoes' && Object.keys(r.sessoes).every(q => typeof r.sessoes[q] === 'number'))) && JSON.stringify(r).indexOf('@') === -1);
  ok('E18 o invólucro rodarLembretesAgora existe e roda o mesmo gatilho', (() => { h.memo(); const x = S('rodarLembretesAgora')(); return x.ok === true && typeof x.enviados === 'number'; })());
});

/* ---------------------------------------------------------------- L */
console.log('L. Lembrar agora');
tenta('L', () => {
  irPara(2026, 12, 11, 16, 45);
  h.EMAILS.length = 0;
  const id = uuid();
  let r = prof('profLembrarAgora', { siglaPaciente: P2, dados: { id: id, tipo: 'escala', instrumento: 'BAI' } });
  ok('L1 manda o e-mail na hora e grava o item (hoje, hora de agora, e-mail enviado)', r.ok && r.email_enviado === true && r.motivo === '' && h.EMAILS.length === 1 && h.EMAILS[0].to === 'p2@exemplo.test' && h.EMAILS[0].subject === 'Há uma escala para você no COGNIATIVO' && celLem(id, 'recorrencia') === 'agora' && celLem(id, 'data_inicio') === '2026-12-11' && celLem(id, 'hora') === '16:45' && celLem(id, 'ultimo_email_em') === '2026-12-11 16:45', r);
  ok('L2 a escala foi aberta para o paciente', r.escala_aberta === true && r.escalas_liberadas.indexOf('bai') !== -1);
  r = prof('profLembrarAgora', { siglaPaciente: P2, dados: { id: id, tipo: 'escala', instrumento: 'BAI' } });
  ok('L3 repetir o mesmo id não manda de novo nem duplica a linha', r.ok && r.duplicado === true && h.EMAILS.length === 1 && abaLem().dados.filter(l => l[0] === id).length === 1);
  ok('L4 o gatilho do mesmo dia não manda o e-mail outra vez', gatilho(quando(2026, 12, 11, 17, 30)).enviados === 0 || h.EMAILS.filter(x => x.to === 'p2@exemplo.test').length === 1);
  const semEmail = novo('Paciente Sem Email', 'tmp@exemplo.test', '11999990009');
  h.abaPac.getRange(h.linhaDe(h.abaPac, 'sigla', semEmail), h.cab(h.abaPac).indexOf('email') + 1).setValue('');
  const id2 = uuid();
  r = prof('profLembrarAgora', { siglaPaciente: semEmail, dados: { id: id2, tipo: 'auto' } });
  ok('L5 paciente sem e-mail: o item é gravado, o e-mail não sai e o motivo é sem_email', r.ok && r.email_enviado === false && r.motivo === 'sem_email' && celLem(id2, 'ultimo_email_em') === '' && celLem(id2, 'recorrencia') === 'agora', r);
  const lista = prof('profListarPacientes').pacientes.filter(p => p.sigla === semEmail)[0];
  ok('L6 o "lembrar agora" aparece em Lembretes de hoje, com o telefone e tem_email = false', lista.lembretes.length === 1 && lista.lembretes[0].hoje === true && lista.telefone === '11999990009' && lista.tem_email === false, lista);
  ok('L7 a resposta da gravação já traz o que o Início mostra (mesmos itens e contato da lista): nenhuma chamada nova', JSON.stringify(r.inicio) === JSON.stringify({ lembretes: lista.lembretes, telefone: lista.telefone, tem_email: lista.tem_email }), r.inicio);
  const rS = salvar(P2, { recorrencia: 'uma_vez', data_inicio: '2026-12-11', hora: '18:00' }), lP2 = prof('profListarPacientes').pacientes.filter(p => p.sigla === P2)[0];
  ok('L8 o mesmo em profSalvarLembrete e em profEncerrarLembrete', JSON.stringify(rS.inicio.lembretes) === JSON.stringify(lP2.lembretes) && rS.inicio.telefone === lP2.telefone && (() => { const e = prof('profEncerrarLembrete', { siglaPaciente: P2, id: rS.lembretes.filter(i => i.hora === '18:00')[0].id }); return JSON.stringify(e.inicio.lembretes) === JSON.stringify(prof('profListarPacientes').pacientes.filter(p => p.sigla === P2)[0].lembretes) && e.inicio.lembretes.length === rS.inicio.lembretes.length - 1; })(), rS.inicio);
});

/* ---------------------------------------------------------------- X */
console.log('X. Exclusão do paciente');
tenta('X', () => {
  const antes = abaLem().dados.filter(l => l[1] === P3).length;
  const outros = abaLem().dados.filter(l => l[1] !== P3).length;
  prof('profDesativarPaciente', { siglaPaciente: P3 });
  const arquivoReal = global.DriveApp.getFileById;
  global.DriveApp.getFileById = id => ({ setTrashed: () => {} }); // o arnês não simula a lixeira do Drive
  const r = prof('profExcluirPaciente', { siglaPaciente: P3, confirmacaoSigla: P3 });
  global.DriveApp.getFileById = arquivoReal;
  ok('X1 excluir o paciente apaga os itens dele da aba e não toca nos dos outros', r.ok && antes >= 1 && abaLem().dados.filter(l => l[1] === P3).length === 0 && abaLem().dados.filter(l => l[1] !== P3).length === outros, r);
});

/* ---------------------------------------------------------------- G */
console.log('G. 8.23 — ind_total_auto sem checagens sozinhas');
tenta('G', () => {
  irPara(2026, 12, 12, 10, 0);
  const s = novo('Paciente dos Contadores', 'g@exemplo.test', '');
  pac(s, 'salvarAutomonitoramento', { dados: h.registro({ id_envio: uuid() }) });
  pac(s, 'salvarAutomonitoramento', { dados: h.registro({ neg_preenchido: '', pos_preenchido: 'sim', id_envio: uuid() }) });
  ok('G1 dois registros completos (um Negativo, um Positivo): total 2', h.ind(s, 'ind_total_auto') === 2, h.ind(s, 'ind_total_auto'));
  pac(s, 'salvarAutomonitoramento', { dados: h.registro({ neg_preenchido: '', pos_preenchido: '', humor_nivel: 5, data_registro: '2026-12-12', id_envio: uuid() }) });
  const ult = JSON.parse(h.ind(s, 'ind_ultimo_auto'));
  ok('G2 mais uma checagem sozinha: o total continua 2; o "último" é a checagem (data e humor), com a data certa', h.ind(s, 'ind_total_auto') === 2 && ult.humor === 5 && ult.data === '12/12/2026', [h.ind(s, 'ind_total_auto'), ult]);
  const so = novo('Paciente Só Checagem', 'g2@exemplo.test', '');
  pac(so, 'salvarAutomonitoramento', { dados: h.registro({ neg_preenchido: '', pos_preenchido: '', id_envio: uuid() }) });
  ok('G3 paciente só com checagens: total 0', h.ind(so, 'ind_total_auto') === 0 && h.ind(so, 'ind_ultimo_auto') !== '');
  const naLista = prof('profListarPacientes').pacientes;
  ok('G4 a lista do profissional devolve os mesmos números', naLista.filter(p => p.sigla === s)[0].ind_total_auto === 2 && naLista.filter(p => p.sigla === so)[0].ind_total_auto === 0);
  const calc = S('_calcularIndicadores_')(h.planilhaDe(s));
  ok('G5 recálculo direto (o que a função temporária do pacote roda em todos): 3 linhas na aba, total 2', calc.ind_total_auto === 2 && h.planilhaDe(s).getSheetByName('Automonitoramento').getLastRow() - 1 === 3, calc);
});

/* ---------------------------------------------------------------- N */
console.log('N. 19.2.2 — a sigla da escala e o texto do "Outro" no e-mail');
tenta('N', () => {
  const montar = S('montarEmailLembrete'), detalhe = S('_lembreteDetalhe_');
  const ass = ['Dra. Nova de Prova', 'Psicóloga — CRP 06/999999'];
  const esc = montar('escala', 'Ana', ass, 'URICA-A');
  ok('N1 escala: "Há uma escala aberta para você: URICA-A. Quando puder, responda." no texto e no HTML', esc.texto.indexOf('Este é o lembrete que combinamos para hoje. Há uma escala aberta para você: URICA-A. Quando puder, responda.') !== -1 && esc.html.indexOf('Há uma escala aberta para você: URICA-A. Quando puder, responda.') !== -1, esc.texto);
  ok('N2 assunto, título e prévia da escala não mudaram (genéricos: é o que aparece na tela bloqueada)', esc.assunto === 'Há uma escala para você no COGNIATIVO' && esc.html.indexOf('>Uma escala para responder</h1>') !== -1 && esc.html.indexOf('Quando puder, responda à escala combinada.') !== -1 && esc.assunto.indexOf('URICA') === -1);
  const cru = 'Chá & <b>pausa</b> "leve" d\'água';
  const out = montar('outro', 'Ana', ass, cru);
  ok('N3 "Outro": "Este é o lembrete que combinamos. Combinado de hoje: <texto>" — no texto puro vai como foi digitado', out.texto.indexOf('Este é o lembrete que combinamos. Combinado de hoje: ' + cru + '\n') !== -1, out.texto);
  ok('N4 "Outro" no HTML: & < > " \' passam pelo escapador único (nenhuma marcação do texto digitado vira HTML)', out.html.indexOf('Combinado de hoje: Chá &amp; &lt;b&gt;pausa&lt;/b&gt; &quot;leve&quot; d&#39;água') !== -1 && out.html.indexOf('<b>pausa</b>') === -1 && out.html.indexOf(cru) === -1, out.html.slice(out.html.indexOf('Combinado de hoje'), out.html.indexOf('Combinado de hoje') + 120));
  ok('N5 assunto, título e prévia do "Outro" não mudaram', out.assunto === 'Lembrete do COGNIATIVO' && out.html.indexOf('>Lembrete de hoje</h1>') !== -1 && out.html.indexOf('Há um combinado para hoje.') !== -1);
  const auto = montar('auto', 'Ana', ass, 'qualquer coisa');
  ok('N6 automonitoramento não muda (o detalhe é ignorado)', auto.texto.indexOf('Quando puder, registre como foi o seu dia: leva poucos minutos e ajuda a próxima sessão.') !== -1 && auto.texto.indexOf('qualquer coisa') === -1 && auto.assunto === 'Hora do seu registro no COGNIATIVO');
  const vazios = [montar('escala', 'Ana', ass), montar('escala', 'Ana', ass, ''), montar('escala', 'Ana', ass, null), montar('outro', 'Ana', ass, '   '), montar('outro', 'Ana', ass, undefined)];
  ok('N7 sem sigla ou sem texto: frase genérica de antes, sem "undefined" nem "null" na mensagem', vazios[0].texto.indexOf('Há uma escala aberta para você em Escalas e Inventários; quando puder, responda.') !== -1 && vazios[3].texto.indexOf('O que foi combinado está no Início do COGNIATIVO.') !== -1 && vazios.every(e => !/undefined|null|: \.|: $/m.test(e.texto) && !/undefined|null/.test(e.html)), vazios.map(e => e.texto.split('\n')[4]));
  ok('N8 _lembreteDetalhe_: sigla só se for do catálogo; texto do "Outro" aparado; automonitoramento vazio', detalhe({ tipo: 'escala', instrumento: 'PHQ-9' }) === 'PHQ-9' && detalhe({ tipo: 'escala', instrumento: 'URICA-A' }) === 'URICA-A' && detalhe({ tipo: 'escala', instrumento: 'NAO-EXISTE' }) === '' && detalhe({ tipo: 'escala' }) === '' && detalhe({ tipo: 'outro', texto: '  x  ' }) === 'x' && detalhe({ tipo: 'outro' }) === '' && detalhe({ tipo: 'auto', texto: 'x', instrumento: 'PHQ-9' }) === '' && detalhe(null) === '');

  // de ponta a ponta: o gatilho e o "lembrar agora" mandam o e-mail com o detalhe
  irPara(2026, 12, 14, 6, 0);
  const pN = novo('Paciente do Detalhe', 'detalhe@exemplo.test', '');
  salvar(pN, { tipo: 'escala', instrumento: 'URICA-A', recorrencia: 'uma_vez', data_inicio: '2026-12-14', hora: '06:30' });
  salvar(pN, { tipo: 'outro', texto: cru, recorrencia: 'uma_vez', data_inicio: '2026-12-14', hora: '06:30' });
  h.EMAILS.length = 0;
  const r = gatilho(quando(2026, 12, 14, 7, 0));
  const meus = h.EMAILS.filter(m => m.to === 'detalhe@exemplo.test');
  const mEsc = meus.filter(m => m.subject === 'Há uma escala para você no COGNIATIVO')[0], mOut = meus.filter(m => m.subject === 'Lembrete do COGNIATIVO')[0];
  ok('N9 gatilho: o e-mail da escala leva a sigla e o do "Outro" leva o texto (cru no texto, escapado no HTML)', meus.length === 2 && !!mEsc && !!mOut && mEsc.body.indexOf('Há uma escala aberta para você: URICA-A. Quando puder, responda.') !== -1 && mOut.body.indexOf('Combinado de hoje: ' + cru) !== -1 && mOut.htmlBody.indexOf('d&#39;água') !== -1 && mOut.htmlBody.indexOf('<b>pausa</b>') === -1, [r, meus.map(m => m.subject)]);
  h.EMAILS.length = 0;
  const ag = prof('profLembrarAgora', { siglaPaciente: pN, dados: { id: uuid(), tipo: 'escala', instrumento: 'BSS' } });
  ok('N10 "lembrar agora" de escala: o e-mail sai na hora com a sigla', ag.ok && ag.email_enviado === true && h.EMAILS.length === 1 && h.EMAILS[0].body.indexOf('Há uma escala aberta para você: BSS. Quando puder, responda.') !== -1, ag);
});

/* ---------------------------------------------------------------- O */
console.log('O. 19.2.3 — botão "E-mail" de um item do plano (enviar_id)');
tenta('O', () => {
  const para = e => h.EMAILS.filter(m => m.to === e);
  irPara(2026, 12, 20, 8, 0);
  const pO = novo('Paciente do Botão', 'botao@exemplo.test', '');
  const pOutro = novo('Outro Paciente', 'outro@exemplo.test', '');
  const idO = uuid(), idH = uuid(), idAlheio = uuid();
  salvar(pO, { id: idO, tipo: 'escala', instrumento: 'URICA-A', recorrencia: 'uma_vez', data_inicio: '2026-12-23', hora: '18:00' }); // marcado para outro dia
  salvar(pOutro, { id: idAlheio, tipo: 'auto', recorrencia: 'uma_vez', data_inicio: '2026-12-23', hora: '18:00' });
  const linhasAntes = abaLem().getLastRow();
  h.EMAILS.length = 0;
  let r = prof('profLembrarAgora', { siglaPaciente: pO, dados: { enviar_id: idO } });
  ok('O1 item marcado para outro dia: o e-mail sai agora, para o paciente, com a sigla da escala', r.ok && r.email_enviado === true && r.motivo === '' && h.EMAILS.length === 1 && h.EMAILS[0].to === 'botao@exemplo.test' && h.EMAILS[0].body.indexOf('Há uma escala aberta para você: URICA-A. Quando puder, responda.') !== -1, r);
  ok('O2 nenhuma linha nova na aba; ultimo_email_em = agora, em texto', abaLem().getLastRow() === linhasAntes && celLem(idO, 'ultimo_email_em') === '2026-12-20 08:00' && celLem(idO, 'recorrencia') === 'uma_vez' && celLem(idO, 'data_inicio') === '2026-12-23', [abaLem().getLastRow(), linhasAntes, celLem(idO, 'ultimo_email_em')]);
  const doPlano = (r.lembretes || []).filter(l => l.id === idO)[0];
  ok('O3 a resposta traz o plano (com o último e-mail) e os itens do Início, como as outras ações', !!doPlano && doPlano.ultimo_email_em === '2026-12-20 08:00' && doPlano.ativo === 'Sim' && !!r.inicio && Array.isArray(r.inicio.lembretes) && r.inicio.tem_email === true, r);

  salvar(pO, { id: idH, tipo: 'auto', recorrencia: 'uma_vez', data_inicio: '2026-12-20', hora: '09:00' }); // vence hoje, às 9h
  h.EMAILS.length = 0;
  r = prof('profLembrarAgora', { siglaPaciente: pO, dados: { enviar_id: idH } });
  const g = gatilho(quando(2026, 12, 20, 9, 30));
  ok('O4 enviado pelo botão, o gatilho do mesmo dia não manda de novo', r.email_enviado === true && para('botao@exemplo.test').length === 1 && celLem(idH, 'ultimo_email_em') === '2026-12-20 08:00', [r.motivo, g, para('botao@exemplo.test').length]);
  h.EMAILS.length = 0;
  const g2 = gatilho(quando(2026, 12, 23, 18, 30));
  ok('O5 no dia marcado o gatilho manda normalmente (o envio pelo botão foi em outro dia)', para('botao@exemplo.test').length === 1 && celLem(idO, 'ultimo_email_em') === '2026-12-23 18:30', [g2, celLem(idO, 'ultimo_email_em')]);

  irPara(2026, 12, 24, 8, 0);
  h.EMAILS.length = 0;
  const marcaAlheio = celLem(idAlheio, 'ultimo_email_em');
  const nao = id => { const x = prof('profLembrarAgora', { siglaPaciente: pO, dados: { enviar_id: id } }); return x.ok === false && x.erro === 'Lembrete não encontrado.'; };
  prof('profEncerrarLembrete', { siglaPaciente: pO, id: idH });
  ok('O6 id que não existe, item de outro paciente e item encerrado: "Lembrete não encontrado." e nenhum e-mail', nao(uuid()) && nao(idAlheio) && nao(idH) && h.EMAILS.length === 0 && celLem(idAlheio, 'ultimo_email_em') === marcaAlheio);

  const linhaO = h.linhaDe(h.abaPac, 'sigla', pO), colEmail = h.cab(h.abaPac).indexOf('email') + 1;
  h.abaPac.getRange(linhaO, colEmail).setValue('');
  h.memo();
  r = prof('profLembrarAgora', { siglaPaciente: pO, dados: { enviar_id: idO } });
  ok('O7 paciente sem e-mail no cadastro: não envia, motivo sem_email, a marca não muda', r.ok && r.email_enviado === false && r.motivo === 'sem_email' && h.EMAILS.length === 0 && celLem(idO, 'ultimo_email_em') === '2026-12-23 18:30', r);
  h.abaPac.getRange(linhaO, colEmail).setValue("'botao@exemplo.test");
  h.memo();
  h.PROPS['lembretes:2026-12-24'] = String(S('LEMBRETES_DIA_MAX'));
  r = prof('profLembrarAgora', { siglaPaciente: pO, dados: { enviar_id: idO } });
  ok('O8 cota do dia esgotada: não envia, motivo cota, a marca não muda', r.ok && r.email_enviado === false && r.motivo === 'cota' && h.EMAILS.length === 0 && celLem(idO, 'ultimo_email_em') === '2026-12-23 18:30', r);
  delete h.PROPS['lembretes:2026-12-24'];
  r = prof('profLembrarAgora', { siglaPaciente: pO, dados: { enviar_id: idO } });
  ok('O9 clicar de novo manda de novo (é um pedido do profissional) e a marca passa para agora', r.email_enviado === true && h.EMAILS.length === 1 && celLem(idO, 'ultimo_email_em') === '2026-12-24 08:00', r);
  const id2 = uuid();
  r = prof('profLembrarAgora', { siglaPaciente: pO, dados: { id: id2, tipo: 'auto' } });
  ok('O10 o "Lembrar agora" de antes (sem enviar_id) continua criando o item e mandando o e-mail', r.ok && r.email_enviado === true && celLem(id2, 'recorrencia') === 'agora' && h.EMAILS.length === 2, r);
});

/* ---------------------------------------------------------------- T */
console.log('T. Trava e crachá');
tenta('T', () => {
  const fonteJs = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  const comTrava = S('ACOES_COM_TRAVA');
  ok('T1 as três ações que gravam estão em ACOES_COM_TRAVA; lerMeusLembretes está nas leituras', ['profSalvarLembrete', 'profEncerrarLembrete', 'profLembrarAgora'].every(a => comTrava.indexOf(a) !== -1) && comTrava.indexOf('lerMeusLembretes') === -1 && S('ACOES_SO_LEITURA').indexOf('lerMeusLembretes') !== -1);
  h.TRAVA.ocupada = true;
  const linhas = abaLem().getLastRow();
  const r = salvar(P1, {});
  h.TRAVA.ocupada = false;
  ok('T2 com a trava ocupada o item não é gravado e a resposta é "ocupado"', r.ok === false && r.codigo === 'ocupado' && abaLem().getLastRow() === linhas, r);
  ok('T3 sem crachá nenhuma das quatro ações responde; crachá de paciente não grava plano', ['profSalvarLembrete', 'profEncerrarLembrete', 'profLembrarAgora', 'lerMeusLembretes'].every(a => h.post({ acao: a, token: 'cracha-inventado', siglaPaciente: P1 }).ok === false) && pac(P1, 'profSalvarLembrete', { siglaPaciente: P1, dados: { id: uuid(), tipo: 'auto', recorrencia: 'uma_vez', data_inicio: '2026-12-20', hora: '10:00' } }).ok === false && abaLem().getLastRow() === linhas);
  ok('T4 o gatilho, o invólucro e a remoção do gatilho existem; instalarGatilhos cria o de 5 em 5 minutos (19.2.3; era de hora em hora)', /function enviarLembretes_\(/.test(fonteJs) && /function rodarLembretesAgora\(/.test(fonteJs) && /function removerGatilhoLembretes\(/.test(fonteJs) && /newTrigger\('enviarLembretes_'\)\s*\.timeBased\(\)\s*\.everyMinutes\(5\)/.test(fonteJs) && !/everyHours/.test(fonteJs));
  ok('T5 VERSAO_PACOTE do 19.2.1 em diante, ou pacote de escalas publicado depois dele (17.8+; o número exato é conferido em backend_16_11.js)', /^(19\.2\.[1-9]\d*|19\.[3-9]|[2-9]\d\.|17\.([89]|\d{2})|14\.[3-9])/.test(S('VERSAO_PACOTE')), S('VERSAO_PACOTE')); // 17.8: as séries 17.x (escalas) e 19.x (profissional) alternam no deploy
  const inesperados = logServidor.filter(l => !/^_enviarEmail_: servico fora/.test(l) && !/^trava de gravacao: nao obtida/.test(l));
  ok('T6 o servidor não registrou nenhum erro além dos dois provocados (envio que falha, trava ocupada)', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
