/* Pacote 14.6 — Agenda: quatro ajustes pedidos pelo usuário em 23/11/2026.
   Blocos: C sessão cancelada e cobrada continua na grade (sem ocupar o horário) · S "esta e as seguintes" leva o dia ·
   L o limite de agendamentos (saiu no 14.7) · V valor da sessão no cadastro do paciente · T listas e crachá.
   Mesmo arnês da suíte do 14.5 (Código.js real sobre planilhas simuladas, relógio fixo em 25/11/2026 14:00).
   Uso: node scripts/testes/backend_14_6.js */
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

const h = av('({ post: post, cracha: cracha, novoPaciente: novoPaciente, celula: celula, linhaDe: linhaDe, cab: cab, abaPac: abaPac, ctrl: ctrl, EMAILS: EMAILS, memo: _memoZerar_, aceite: _gravarAceitePolitica_, hashProf: hashProf })');
const S = nome => av(nome);
av('CONFIRMAR_ABRE_PADRAO = 100000'); // 14.26.1: esta suíte confirma a presença com muita antecedência (regra de antes); a janela de 48 horas é provada em backend_14_26_1.js
av('MSG_PADRAO.lembrete.horas = 24'); // 14.30: esta suíte foi escrita com o segundo lembrete 24 horas antes; o padrão passou a 36 (provado em backend_14_30.js)
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
const PER = { de: '2026-11-01', ate: '2027-03-31' };
const sessao = (sigla, d) => prof('profSalvarSessao', { periodo: PER, dados: Object.assign({ id: uuid(), sigla: sigla, data: '2026-12-02', hora: '10:00', duracao_min: 60, modalidade: 'presencial', valor: '300', notas: '', avisos: [] }, d || {}) });
const lida = id => prof('profLerAgenda', PER).sessoes.filter(x => x.id === id)[0];
const GRADE = [1, 2, 3, 4, 5].map(d => ({ dia_semana: d, hora_inicio: '08:00', hora_fim: '18:00', modalidade: 'ambas', ativo: 'sim' }));
const grade = cfg => prof('profSalvarGrade', { config: Object.assign({ duracao_slot_min: 60, antecedencia_min_horas: 24 }, cfg || {}), grade: GRADE });

const P1 = novo('Paula Primeira', 'p1@exemplo.test');
const P2 = novo('Pedro Segundo', 'p2@exemplo.test');
grade({ avisos_sessao: 'Nao' });

/* ---------------------------------------------------------------- C */
console.log('C. Sessão cancelada e cobrada continua na grade');
tenta('C', () => {
  const idC = uuid(), idN = uuid();
  // amanhã às 10:00 (menos de 24 h): cancelada a pedido do paciente fica cobrada
  sessao(P1, { id: idC, data: '2026-11-26', hora: '10:00' });
  sessao(P1, { id: idN, data: '2026-12-10', hora: '10:00' });
  let r = prof('profCancelarSessao', { id: idC, opcoes: { quem: 'paciente', avisar: false }, periodo: PER });
  const c = r.agenda.sessoes.filter(x => x.id === idC)[0];
  ok('C1 cancelada a pedido do paciente com menos de 24 h: cobrada, e continua na leitura da agenda como "cancelada"', r.ok === true && cel('Sessoes', idC, 'cobrada') === 'Sim' && !!c && c.estado === 'cancelada' && c.cobrada === 'Sim' && c.pode_repor === true && c.link_confirmar === '', c);
  r = prof('profCancelarSessao', { id: idN, opcoes: { quem: 'profissional', avisar: false }, periodo: PER });
  ok('C2 cancelada sem cobrança (pelo profissional) fica na grade como cancelada, sem poder repor (14.19)', r.ok === true && cel('Sessoes', idN, 'cobrada') !== 'Sim' && r.agenda.sessoes.filter(x => x.id === idN && x.estado === 'cancelada' && x.pode_repor === false).length === 1);
  const idOutra = uuid();
  r = sessao(P2, { id: idOutra, data: '2026-11-26', hora: '10:00' });
  ok('C3 a cancelada e cobrada não ocupa o horário: outro paciente é marcado no mesmo dia e hora', r.ok === true && !!lida(idOutra) && !!lida(idC), r && r.erro);
  const livres = prof('profLerHorariosLivres', {}).livres || [];
  ok('C4 e não tira horário da lista de livres do profissional (só a sessão ativa tira)', livres.filter(x => x.data === '2026-11-26' && x.hora === '10:00').length === 0 && livres.filter(x => x.data === '2026-11-26' && x.hora === '11:00').length === 1, livres.filter(x => x.data === '2026-11-26').map(x => x.hora));
  const idRep = uuid();
  r = sessao(P1, { id: idRep, data: '2026-12-11', hora: '09:00', reposicao_de: idC });
  const depois = lida(idC);
  ok('C5 reposição criada a partir dela: nasce sem cobrança e a cancelada mostra "reposta em", sem oferecer repor de novo', r.ok === true && lida(idRep).cobrada === 'Nao' && lida(idRep).reposicao_de === idC && depois.reposta_em === '2026-12-11' && depois.pode_repor === false, [r && r.erro, depois]);
  ok('C6 o paciente continua vendo a cancelada nas sessões dele, como antes', pac(P1, 'lerMinhasSessoes').sessoes.filter(x => x.id === idC)[0].estado === 'cancelada');
  ok('C7 nenhum evento "confirmou" nem link de confirmar para sessão cancelada', prof('profLerAgenda', PER).eventos.filter(e => e.data === '2026-11-26' && e.tipo === 'confirmou').length === 0);
});

/* ---------------------------------------------------------------- S */
console.log('S. "Esta consulta e as seguintes" leva o dia');
tenta('S', () => {
  // série semanal às terças, 4 sessões: 05/01, 12/01, 19/01, 26/01/2027, 09:00
  const idS = uuid();
  let r = sessao(P1, { id: idS, data: '2027-01-05', hora: '09:00', repeticao: { cada: 1, unidade: 'semana', dias_semana: [2], fim_tipo: 'n', fim_n: 4 } });
  const serie = () => prof('profLerAgenda', PER).sessoes.filter(x => x.serie_id && x.sigla === P1 && x.data >= '2027-01-01' && x.data <= '2027-02-28' && x.estado === 'agendada').sort((a, b) => a.data < b.data ? -1 : 1);
  ok('S0 preparo: série de 4 terças', r.ok === true && serie().map(x => x.data).join(',') === '2027-01-05,2027-01-12,2027-01-19,2027-01-26', [r && r.erro, serie().map(x => x.data)]);
  const serieId = serie()[0].serie_id;
  pac(P1, 'pacienteConfirmarSessao', { id: serie()[2].id });
  // outro paciente ocupa a quinta 21/01 às 09:00: a terça 19/01 não pode ir para lá
  const idBloq = uuid();
  sessao(P2, { id: idBloq, data: '2027-01-21', hora: '09:00' });
  const base = { id: idS, sigla: P1, data: '2027-01-07', hora: '09:00', duracao_min: 60, modalidade: 'presencial', valor: '300', notas: '', avisos: [], escopo: 'seguintes' };
  r = prof('profSalvarSessao', { dados: Object.assign({}, base, { simular: true }) });
  ok('S1 simulação: terça → quinta move esta e as seguintes; a data ocupada é pulada e listada', r.ok === true && r.simulacao.datas.join(',') === '2027-01-07,2027-01-14,2027-01-28' && r.simulacao.puladas.join(',') === '2027-01-19' && !r.simulacao.conflito, r.simulacao);
  ok('S2 a simulação não grava nada', serie().map(x => x.data).join(',') === '2027-01-05,2027-01-12,2027-01-19,2027-01-26');
  const conf19 = serie()[2].id;
  r = prof('profSalvarSessao', { dados: base, periodo: PER });
  ok('S3 gravação: as sessões vão para quinta, a pulada fica na terça e é devolvida em nao_alteradas', r.ok === true && r.remarcada === true && r.movidas === 2 && r.nao_alteradas.join(',') === '2027-01-19' && serie().map(x => x.data).join(',') === '2027-01-07,2027-01-14,2027-01-19,2027-01-28', [r.movidas, r.nao_alteradas, serie().map(x => x.data)]);
  ok('S4 a pulada mantém a confirmação do paciente; as movidas ficam a confirmar', lida(conf19).confirmada === true && serie().filter(x => x.id !== conf19).every(x => x.confirmada === false));
  ok('S5 a regra da série passa a dizer quinta (dia 4)', prof('profLerAgenda', PER).series[serieId].dias_semana.join(',') === '4', prof('profLerAgenda', PER).series[serieId]);
  ok('S6 células de data continuam texto AAAA-MM-DD', serie().every(x => /^\d{4}-\d{2}-\d{2}$/.test(cel('Sessoes', x.id, 'data'))));
  // uma semana inteira para a frente, com a quinta 21/01 ocupada por outro paciente: a de 14/01 não pode sair, e a aberta cairia em cima dela
  const s2 = serie();
  r = prof('profSalvarSessao', { dados: Object.assign({}, base, { id: s2[0].id, data: '2027-01-14', hora: '09:00' }), periodo: PER });
  ok('S7 destino da aberta fica ocupado por uma sessão da série que não pôde sair: recusa inteira, nada muda', r.ok === false && r.codigo === 'ocupado' && serie().map(x => x.data).join(',') === s2.map(x => x.data).join(','), [r.codigo, serie().map(x => x.data)]);
  // sem o outro paciente no caminho: cada uma cai no lugar que a seguinte deixou
  prof('profCancelarSessao', { id: idBloq, opcoes: { quem: 'profissional', avisar: false }, periodo: PER });
  r = prof('profSalvarSessao', { dados: Object.assign({}, base, { id: s2[0].id, data: '2027-01-14', hora: '09:00' }), periodo: PER });
  ok('S7b uma semana para a frente: 07→14, 14→21, 19→26, 28→04/02, sem pular nenhuma', r.ok === true && r.movidas === 3 && r.nao_alteradas.length === 0 && serie().map(x => x.data).join(',') === '2027-01-14,2027-01-21,2027-01-26,2027-02-04', [r.movidas, r.nao_alteradas, serie().map(x => x.data)]);
  r = prof('profSalvarSessao', { dados: Object.assign({}, base, { id: serie()[0].id, data: '2027-01-07', hora: '09:00' }), periodo: PER });
  ok('S7c e uma semana para trás devolve tudo ao lugar', r.ok === true && serie().map(x => x.data).join(',') === '2027-01-07,2027-01-14,2027-01-19,2027-01-28', serie().map(x => x.data));
  const datas = serie().map(x => x.data + ' ' + x.hora);
  ok('S8 nunca duas sessões da série no mesmo dia e hora', new Set(datas).size === datas.length, datas);
  // "só esta" continua mudando só a aberta; mudar só a hora das seguintes continua como antes
  const s3 = serie();
  r = prof('profSalvarSessao', { dados: Object.assign({}, base, { id: s3[0].id, data: s3[0].data, hora: '11:00', escopo: 'seguintes' }), periodo: PER });
  ok('S9 mesma data, hora nova, "seguintes": todas passam para a hora nova, no mesmo dia', r.ok === true && serie().every(x => x.hora === '11:00') && serie().map(x => x.data).join(',') === s3.map(x => x.data).join(','), serie().map(x => x.data + ' ' + x.hora));
  const s4 = serie();
  r = prof('profSalvarSessao', { dados: Object.assign({}, base, { id: s4[1].id, data: _mais(s4[1].data, 1), hora: '11:00', escopo: 'esta' }), periodo: PER });
  ok('S10 "só esta consulta": muda só a aberta', r.ok === true && r.movidas === 0 && serie().filter((x, i) => i !== 1).map(x => x.data).join(',') === s4.filter((x, i) => i !== 1).map(x => x.data).join(','), serie().map(x => x.data));
  // destino da aberta ocupado: recusa inteira
  const s5 = serie();
  sessao(P2, { id: uuid(), data: _mais(s5[0].data, 2), hora: '11:00' });
  r = prof('profSalvarSessao', { dados: Object.assign({}, base, { id: s5[0].id, data: _mais(s5[0].data, 2), hora: '11:00', escopo: 'seguintes', simular: true }) });
  ok('S11 destino da sessão aberta ocupado: a simulação avisa o conflito e nada é movido', r.ok === true && r.simulacao.conflito === 'ocupado' && r.simulacao.datas.length === 0, r.simulacao);
  r = prof('profSalvarSessao', { dados: Object.assign({}, base, { id: s5[0].id, data: _mais(s5[0].data, 2), hora: '11:00', escopo: 'seguintes' }), periodo: PER });
  ok('S12 e a gravação é recusada (horário ocupado)', r.ok === false && r.codigo === 'ocupado' && serie().map(x => x.data).join(',') === s5.map(x => x.data).join(','), r);
});
function _mais(iso, n) { const d = new Real(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

/* ---------------------------------------------------------------- L */
console.log('L. O limite de agendamentos saiu no 14.7 (todo agendamento do paciente passa pela aprovação)');
tenta('L', () => {
  ok('L1 a leitura do paciente não traz mais o limite', pac(P2, 'lerMinhasSessoes').limite === undefined);
  grade({ avisos_sessao: 'Nao', limite_agendamentos: 2 });
  ok('L2 a Grade não grava mais a chave e a agenda não a lê', prof('profLerGrade').config.limite_agendamentos === undefined && prof('profLerAgenda', PER).config.limite_agendamentos === undefined, prof('profLerGrade').config);
  const fonteJs = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('L3 nada do limite ficou no servidor', fonteJs.indexOf('limite_agendamentos') === -1 && fonteJs.indexOf('_ageLimite_') === -1 && fonteJs.indexOf('_ageMsgLimite_') === -1);
});

/* ---------------------------------------------------------------- V */
console.log('V. Valor da sessão no cadastro do paciente');
tenta('V', () => {
  let r = prof('profSalvarValorSessao', { siglaPaciente: P1, valor: '250,00' });
  ok('V1 grava o valor no cadastro e devolve o que ficou', r.ok === true && r.valor_sessao === '250,00' && h.celula(h.abaPac, h.linhaDe(h.abaPac, 'sigla', P1), 'valor_sessao') === '250,00', r);
  let lista = prof('profListarPacientes').pacientes;
  ok('V2 a lista de pacientes traz o valor (e vazio para quem não tem)', lista.filter(p => p.sigla === P1)[0].valor_sessao === '250,00' && lista.filter(p => p.sigla === P2)[0].valor_sessao === '', lista.map(p => [p.sigla, p.valor_sessao]));
  r = prof('profSalvarValorSessao', { siglaPaciente: P1, valor: '=SOMA(1;2) R$ 300 <b>' });
  ok('V3 só números, vírgula e ponto ficam (fórmula e marcação não entram)', r.ok === true && r.valor_sessao === '1230' ? true : /^[0-9.,]*$/.test(r.valor_sessao), r);
  r = prof('profSalvarValorSessao', { siglaPaciente: P1, valor: '0300' });
  const bruto = h.abaPac.getRange(h.linhaDe(h.abaPac, 'sigla', P1), h.cab(h.abaPac).indexOf('valor_sessao') + 1).getValue();
  ok('V4 a célula é texto literal (o zero à esquerda fica)', r.valor_sessao === '0300' && String(bruto).replace(/^'/, '') === '0300', bruto);
  r = prof('profSalvarValorSessao', { siglaPaciente: P1, valor: '' });
  ok('V5 vazio apaga o valor', r.ok === true && r.valor_sessao === '' && prof('profListarPacientes').pacientes.filter(p => p.sigla === P1)[0].valor_sessao === '');
  ok('V6 paciente que não existe: recusado', prof('profSalvarValorSessao', { siglaPaciente: 'ZZZ', valor: '100' }).ok === false);
  ok('V7 crachá de paciente não grava valor', pac(P1, 'profSalvarValorSessao', { siglaPaciente: P1, valor: '1' }).ok === false);
  ok('V8 sem crachá: recusado', h.post({ acao: 'profSalvarValorSessao', siglaPaciente: P1, valor: '1' }).ok === false);
  prof('profSalvarValorSessao', { siglaPaciente: P1, valor: '280' });
});

/* ---------------------------------------------------------------- T */
console.log('T. Listas e versão');
tenta('T', () => {
  ok('T1 a ação nova está na trava e não é pública nem só leitura', S('ACOES_COM_TRAVA').indexOf('profSalvarValorSessao') !== -1 && S('ACOES_PUBLICAS').indexOf('profSalvarValorSessao') === -1 && S('ACOES_SO_LEITURA').indexOf('profSalvarValorSessao') === -1);
  ok('T2 o valor é coluna do cadastro, não de Sessoes', S('COLUNAS_SESSOES').indexOf('valor_sessao') === -1);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T3 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO: ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
