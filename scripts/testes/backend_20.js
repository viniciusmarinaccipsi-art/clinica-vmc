/* Fase 20 — Fluxo de caixa (Pacote 20.0): o `Código.js` real sobre planilhas simuladas, relógio fixo em 25/11/2026 14:00.
   Blocos: A regras puras · B configuração e cadastro · C a leitura segue a Agenda · D pagamento, parcial, crédito e desfazer ·
   E cobranças (só por ação do profissional) · F lado do paciente e comprovante · G despesas e contas a pagar · H resumo ·
   R recibos, lote do Carnê-Leão e livro caixa (20.1; o gabarito do lote vem do gerador que o usuário usa hoje) · T listas, trava, texto literal e sigilo. Dados inventados; os CPFs são números de teste com dígito válido.
   Sem argumento, roda duas vezes: no fuso de São Paulo e em UTC.
   Uso: node scripts/testes/backend_20.js */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

if (!process.env.VMC_FUSO_20) {
  const partes = ['America/Sao_Paulo', 'UTC'].map(tz => {
    const r = spawnSync(process.execPath, [__filename], { stdio: 'inherit', env: Object.assign({}, process.env, { TZ: tz, VMC_FUSO_20: tz }) });
    return { tz: tz, saida: r.status };
  });
  const ruim = partes.some(p => p.saida !== 0);
  console.log('\nRESULTADO: ' + (ruim ? 'FALHA' : 'OK') + ' — ' + partes.map(p => p.tz + ': ' + (p.saida === 0 ? 'ok' : 'falhou')).join(' · '));
  process.exit(ruim ? 1 : 0);
}
console.log('=== fuso ' + process.env.VMC_FUSO_20 + ' ===');

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
// o que o arnês não simula e a Fase 20 usa: base64 e arquivo no Drive
const sinal = buf => Array.from(buf).map(x => (x > 127 ? x - 256 : x));
global.Utilities.base64Decode = s => sinal(Buffer.from(String(s), 'base64'));
global.Utilities.base64Encode = b => Buffer.from(b.map(x => (x < 0 ? x + 256 : x))).toString('base64');
global.Utilities.newBlob = (b, tipo, nome) => ({ bytes: b, tipo: tipo, nome: nome, getBytes: () => b, getDataAsString: () => Buffer.from((b || []).map(x => (x < 0 ? x + 256 : x))).toString('utf8') });
const ARQUIVOS = {};
const arquivoReal = global.DriveApp.getFileById;
global.DriveApp.createFile = blob => { const id = 'arq-' + crypto.randomUUID(); ARQUIVOS[id] = { blob: blob, pasta: '' }; return { getId: () => id, moveTo: p => { ARQUIVOS[id].pasta = p.getId(); } }; };
global.DriveApp.getFileById = id => (ARQUIVOS[id] ? { getId: () => id, getBlob: () => ARQUIVOS[id].blob } : arquivoReal(id));

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
const linhas = nomeAba => (aba(nomeAba) ? aba(nomeAba).getLastRow() - 1 : 0);
const PER = { de: '2026-09-01', ate: '2027-03-31' };
const sessao = (sigla, data, hora, d) => { const id = uuid(); const r = prof('profSalvarSessao', { periodo: PER, dados: Object.assign({ id: id, sigla: sigla, data: data, hora: hora || '10:00', duracao_min: 60, modalidade: 'presencial', valor: '', notas: '', avisos: [] }, d || {}) }); if (!r.ok) throw new Error('profSalvarSessao ' + data + ': ' + r.erro); return id; };
const situacao = (id, s) => prof('profMarcarSituacao', { id: id, situacao: s, periodo: PER });
const fin = extra => prof('profLerFinanceiro', Object.assign({ periodo: 'mes' }, extra || {}));
const doPac = (f, sigla) => f.pacientes.filter(p => p.sigla === sigla)[0];
const ses = (f, id) => f.sessoes.concat(f.abertas).filter(x => x.id === id)[0];
const pagar = (sigla, dados, extra) => prof('profSalvarPagamento', Object.assign({ siglaPaciente: sigla, periodo: 'mes', dados: Object.assign({ id: uuid(), data: '2026-11-25', forma: 'Pix', quem: '', obs: '' }, dados) }, extra || {}));
const cadastro = (sigla, d) => prof('profSalvarCadastroFinanceiro', { siglaPaciente: sigla, dados: Object.assign({ valor: 28000, modo: 'sessao', n: '', quando: '', pagador: 'paciente', pagadores: [], recibo: 'Nao', titular: 'paciente', canal: 'ambos', encaminhamento: '' }, d || {}) });
const CPF_OK = '529.982.247-25', CNPJ_OK = '11.222.333/0001-81';
const GRADE = [1, 2, 3, 4, 5].map(d => ({ dia_semana: d, hora_inicio: '08:00', hora_fim: '20:00', modalidade: 'ambas', ativo: 'sim' }));
prof('profSalvarGrade', { config: { duracao_slot_min: 60, antecedencia_min_horas: 24, avisos_sessao: 'Nao' }, grade: GRADE });

const ANA = novo('Ana Beatriz Moura', 'ana@exemplo.test');       // mensal, do dia 21 ao fim
const BRUNO = novo('Bruno Tavares', 'bruno@exemplo.test');        // mensal, 1 a 10; a mãe paga
const CARLA = novo('Carla Nogueira', 'carla@exemplo.test');       // por sessão
const DIEGO = novo('Diego & <b>"Fontes"</b> O\'Neil', 'diego@exemplo.test'); // a cada 2 sessões; nome com & < > " '
const ELISA = novo('Elisa Prado', 'elisa@exemplo.test');          // mensal adiantado
const FABIO = novo('Fábio Queiroz', 'fabio@exemplo.test');        // mês seguinte
const GUI = novo('Guilherme Antunes', 'gui@exemplo.test');        // sem cadastro financeiro; o e-mail é apagado abaixo (cadastro antigo, sem e-mail)
h.abaPac.getRange(h.linhaDe(h.abaPac, 'sigla', GUI), h.cab(h.abaPac).indexOf('email') + 1).setValue('');

/* ---------------------------------------------------------------- A */
console.log('A. Regras puras');
tenta('A', () => {
  const cent = S('_finCent_'), doc = S('_finDocumento_'), cobravel = S('_finCobravel_'), elegivel = S('_finElegivel_'), sugerir = S('_finSugerir_'), periodo = S('_finPeriodo_');
  ok('A1 dinheiro digitado vira centavos (280 · 280,5 · 1.120,00 · R$ 90 · 1.120 · 280.5 · vazio · letras)',
    [cent('280'), cent('280,5'), cent('1.120,00'), cent('R$ 90'), cent('1.120'), cent('280.5'), cent(''), cent('abc')].join() === '28000,28050,112000,9000,112000,28050,0,0');
  ok('A2 CPF e CNPJ: dígito conferido, só os dígitos guardados; vazio passa; errado, repetido e tamanho estranho são recusados',
    doc(CPF_OK) === '52998224725' && doc(CNPJ_OK) === '11222333000181' && doc('') === '' && doc('529.982.247-26') === null && doc('111.111.111-11') === null && doc('12345') === null);
  const agora = { data: '2026-11-25', hora: '14:00' }, mensal = { modo: 'mensal', quando: 'f3' }, porSessao = { modo: 'sessao', quando: '' }, seguinte = { modo: 'mensal', quando: 'seguinte' };
  const x = (o) => Object.assign({ data: '2026-11-10', hora_inicio: '10:00', estado: 'agendada', cobrada: '', reposicao_de: '' }, o);
  const tabela = [
    ['realizada (cobrada Sim)', x({ estado: 'realizada', cobrada: 'Sim' }), porSessao, true],
    ['falta (cobrada Sim)', x({ estado: 'falta', cobrada: 'Sim' }), porSessao, true],
    ['cancelada fora do prazo (cobrada Sim)', x({ estado: 'cancelada', cobrada: 'Sim' }), porSessao, true],
    ['cancelada no prazo (cobrada Nao)', x({ estado: 'cancelada', cobrada: 'Nao' }), porSessao, false],
    ['cancelada sem marca de cobrança', x({ estado: 'cancelada', cobrada: '' }), porSessao, false],
    ['reposição, mesmo realizada', x({ estado: 'realizada', cobrada: 'Sim', reposicao_de: 'abc' }), porSessao, false],
    ['isentada pelo profissional (realizada, cobrada Nao)', x({ estado: 'realizada', cobrada: 'Nao' }), porSessao, false],
    ['ocorrida sem situação marcada', x({}), porSessao, true],
    ['hoje, mais tarde (ainda não ocorreu), por sessão', x({ data: '2026-11-25', hora_inicio: '15:00' }), porSessao, false],
    ['hoje, na hora de agora', x({ data: '2026-11-25', hora_inicio: '14:00' }), porSessao, true],
    ['futura deste mês, mensal por faixa', x({ data: '2026-11-30' }), mensal, true],
    ['futura deste mês, mensal no mês seguinte', x({ data: '2026-11-30' }), seguinte, false],
    ['futura do mês que vem, mensal', x({ data: '2026-12-01' }), mensal, false],
    ['futura deste mês, por sessão', x({ data: '2026-11-30' }), porSessao, false]
  ];
  const errados = tabela.filter(l => cobravel(l[1], l[2], agora) !== l[3]).map(l => l[0]);
  ok('A3 sessão cobrável, linha a linha (' + tabela.length + ' casos da tabela da Agenda)', errados.length === 0, errados);
  const s = (data, futura) => ({ data: data, futura: !!futura });
  const el = (cad, sess, hoje, n) => elegivel(sess, cad, hoje, n || 0);
  ok('A4 por sessão: só a que já ocorreu', el({ modo: 'sessao' }, s('2026-11-10'), '2026-11-25') === true && el({ modo: 'sessao' }, s('2026-11-30', true), '2026-11-25') === false);
  ok('A5 a cada N: só com N ocorridas em aberto (N = 2: com 1 não, com 2 sim) e nunca a futura',
    el({ modo: 'n', n: '2' }, s('2026-11-10'), '2026-11-25', 1) === false && el({ modo: 'n', n: '2' }, s('2026-11-10'), '2026-11-25', 2) === true && el({ modo: 'n', n: '2' }, s('2026-11-30', true), '2026-11-25', 5) === false);
  const faixa = q => ['2026-11-01', '2026-11-10', '2026-11-11', '2026-11-20', '2026-11-21', '2026-11-30'].map(d => (el({ modo: 'mensal', quando: q }, s('2026-11-15'), d) ? 'S' : 'n')).join('');
  ok('A6 mensal no mês corrente, nas bordas das faixas (dias 1, 10, 11, 20, 21, 30): adiantado e 1 a 10 desde o dia 1; 11 a 20 desde o 11; 21 ao fim desde o 21; mês seguinte nunca',
    faixa('adiantado') === 'SSSSSS' && faixa('f1') === 'SSSSSS' && faixa('f2') === 'nnSSSS' && faixa('f3') === 'nnnnSS' && faixa('seguinte') === 'nnnnnn', [faixa('adiantado'), faixa('f1'), faixa('f2'), faixa('f3'), faixa('seguinte')]);
  ok('A7 virada do mês: no dia 30/11 o "mês seguinte" não cobra novembro; em 01/12 cobra; mês fechado em aberto cobra em qualquer faixa; mês futuro nunca',
    el({ modo: 'mensal', quando: 'seguinte' }, s('2026-11-30'), '2026-11-30') === false && el({ modo: 'mensal', quando: 'seguinte' }, s('2026-11-30'), '2026-12-01') === true &&
    el({ modo: 'mensal', quando: 'f3' }, s('2026-10-27'), '2026-11-01') === true && el({ modo: 'mensal', quando: 'adiantado' }, s('2026-12-01', true), '2026-11-30') === false);
  const ab = [{ id: 'c', data: '2026-11-17', hora: '10:00', valor: 28000, pago: 0 }, { id: 'a', data: '2026-10-27', hora: '10:00', valor: 28000, pago: 8000 }, { id: 'b', data: '2026-11-03', hora: '10:00', valor: 28000, pago: 0 }];
  const sg = sugerir(ab, 50000), sg2 = sugerir(ab, 100000);
  ok('A8 sugestão de abatimento: as mais antigas primeiro, respeitando o que já foi pago; o que falta fica parcial na última; o que sobra é crédito',
    JSON.stringify(sg.itens) === JSON.stringify([{ sessao: 'a', valor: 20000 }, { sessao: 'b', valor: 28000 }, { sessao: 'c', valor: 2000 }]) && sg.sobra === 0 && sg2.sobra === 24000 && sg2.itens.length === 3, [sg, sg2]);
  const pm = periodo({ periodo: 'mes' }, '2026-11-25'), pp = periodo({ periodo: 'mes_passado' }, '2026-01-15'), ps = periodo({ periodo: 'semana' }, '2026-11-25'), pa = periodo({ periodo: 'ano', comparar: 'ano_passado' }, '2026-11-25'),
    p12 = periodo({ periodo: '12m' }, '2026-11-25'), pf = periodo({ periodo: 'mes' }, '2028-02-10'), px = periodo({ periodo: 'personalizado', de: '2026-11-10', ate: '2026-11-19' }, '2026-11-25'), pr = periodo({ periodo: 'personalizado', de: '2026-11-10', ate: '2020-01-01' }, '2026-11-25');
  ok('A9 períodos: mês (com o anterior inteiro), mês passado na virada do ano, semana de segunda a domingo, ano contra o ano passado, 12 meses, fevereiro bissexto, personalizado e personalizado inválido (cai no mês)',
    pm.de === '2026-11-01' && pm.ate === '2026-11-30' && pm.antes.de === '2026-10-01' && pm.antes.ate === '2026-10-31' && pm.rotulo === 'Novembro de 2026' && pp.de === '2025-12-01' && pp.ate === '2025-12-31' &&
    ps.de === '2026-11-23' && ps.ate === '2026-11-29' && pa.antes.de === '2025-01-01' && pa.antes.ate === '2025-12-31' && p12.de === '2025-12-01' && p12.ate === '2026-11-30' && pf.ate === '2028-02-29' &&
    px.antes.de === '2026-10-31' && px.antes.ate === '2026-11-09' && pr.de === '2026-11-01', [pm, pp, ps, pa.antes, p12, pf.ate, px.antes, pr.de]);
  const texto = S('_finTextoCobranca_')(null, { nome: 'Ana', saudacao: S('_finSaudacao_')('14:00'), mes: 'novembro de 2026', sessoes: [{ data: '2026-11-03', valor: 28000, pago: 0 }, { data: '2026-11-10', valor: 28000, pago: 0 }], total: 56000, dados: 'Pix: chave' });
  ok('A10 mensagem padrão: saudação pela hora, uma data por linha, total em destaque e os dados para pagar',
    texto === 'Ana, boa tarde. Como vai?\n\nSegue o demonstrativo das sessões de novembro de 2026.\n\n2 sessões de psicoterapia (R$ 280,00 cada), nos dias:\na. 03 de novembro de 2026\nb. 10 de novembro de 2026\n\n*Total: R$ 560,00*\n\nDados para o pagamento:\n*Pix: chave*' &&
    S('_finSaudacao_')('11:59') === 'bom dia' && S('_finSaudacao_')('18:00') === 'boa noite', texto);
});

/* ---------------------------------------------------------------- B */
console.log('B. Configuração e cadastro');
tenta('B', () => {
  let r = fin();
  ok('B1 antes de qualquer uso a leitura responde com os padrões e nenhuma aba do financeiro nasce', r.ok && r.financeiro.config.formas.length === 5 && r.financeiro.config.valor_padrao === 0 && r.financeiro.sessoes.length === 0 &&
    Object.keys(S('COLUNAS_FIN')).every(n => !aba(n)), Object.keys(S('COLUNAS_FIN')).filter(n => aba(n)));
  r = prof('profSalvarConfigFinanceiro', { periodo: 'mes', dados: { dados_receber: 'Pix (chave e-mail): financeiro@consultorio.exemplo\nFavorecida: Nova de Prova', formas: 'Pix\nDinheiro\nTransferência\nPix', valor_padrao: '250,00', prazo_dias: '5', texto_cobranca: '', categorias: 'Aluguel\nContas (água, luz, internet)\nMaterial' } });
  ok('B2 configuração salva: valor padrão em centavos, listas uma por linha (sem repetidos; vírgula faz parte do nome), texto vazio volta ao modelo; a resposta já traz a leitura', r.ok && r.financeiro.config.valor_padrao === 25000 && r.financeiro.config.formas.join('|') === 'Pix|Dinheiro|Transferência' &&
    r.financeiro.config.categorias.length === 3 && r.financeiro.config.categorias[1] === 'Contas (água, luz, internet)' && /\{demonstrativo\}/.test(r.financeiro.config.texto_cobranca) && r.financeiro.config.prazo_dias === 5, r.financeiro && r.financeiro.config);
  ok('B3 sem forma de pagamento a configuração é recusada', prof('profSalvarConfigFinanceiro', { dados: { formas: ' \n ', categorias: 'Aluguel' } }).ok === false);
  r = cadastro(ANA, { modo: 'mensal', quando: 'f3', recibo: 'Sim', canal: 'whatsapp', encaminhamento: 'Indicação de paciente' });
  ok('B4 cadastro da Ana: mensal do dia 21 ao fim, recibo, quem paga é ela mesma (nenhuma pessoa gravada); o valor vai para o cadastro do paciente (o mesmo campo do 14.6)',
    r.ok && r.paciente.cadastro.modo === 'mensal' && r.paciente.cadastro.quando === 'f3' && r.paciente.cadastro.valor === 28000 && r.paciente.cadastro.pagadores.length === 0 && linhas('Fin_Pessoas') <= 0 &&
    String(h.celula(h.abaPac, h.linhaDe(h.abaPac, 'sigla', ANA), 'valor_sessao')).replace(/^'/, '') === '280', r.paciente && r.paciente.cadastro);
  r = cadastro(BRUNO, { valor: 25000, modo: 'mensal', quando: 'f1', pagador: 'outro', pagadores: [{ nome: 'Marta Tavares', documento: CPF_OK, telefone: '(11) 98765-4321', email: 'Marta@Exemplo.test' }], recibo: 'Sim', titular: 'pagador', encaminhamento: 'Médico parceiro' });
  ok('B5 cadastro do Bruno: outra pessoa paga; nome, CPF (só dígitos), telefone e e-mail gravados; o recibo sai em nome de quem paga', r.ok && r.paciente.cadastro.pagadores.length === 1 && r.paciente.cadastro.pagadores[0].documento === '52998224725' &&
    r.paciente.cadastro.pagadores[0].email === 'marta@exemplo.test' && r.paciente.cadastro.titular === 'pagador' && linhas('Fin_Pessoas') === 1, r.paciente && r.paciente.cadastro);
  const bruta = aba('Fin_Pessoas').getRange(2, h.cab(aba('Fin_Pessoas')).indexOf('documento') + 1).getValue();
  ok('B6 o CPF é texto literal na célula (o Sheets não o transforma em número)', String(bruta) === "'52998224725" || bruta === '52998224725', bruta);
  ok('B7 CPF com dígito errado e pagador sem nome são recusados; nada muda', cadastro(BRUNO, { pagador: 'outro', pagadores: [{ nome: 'Marta Tavares', documento: '529.982.247-26' }] }).ok === false &&
    cadastro(BRUNO, { pagador: 'outro', pagadores: [{ nome: '', documento: CPF_OK }] }).ok === false && linhas('Fin_Pessoas') === 1);
  r = cadastro(BRUNO, { valor: 25000, modo: 'mensal', quando: 'f1', pagador: 'outro', pagadores: [{ nome: 'Marta Tavares', documento: CPF_OK, email: 'marta@exemplo.test' }, { nome: 'Empresa Exemplo Ltda', documento: CNPJ_OK }], recibo: 'Sim', titular: 'outro', titular_nome: 'Paulo Tavares', titular_documento: '111.444.777-35' });
  ok('B8 dois pagadores (um CNPJ) e recibo em nome de uma terceira pessoa: salvar de novo substitui, não acumula', r.ok && r.paciente.cadastro.pagadores.length === 2 && r.paciente.cadastro.titular_nome === 'Paulo Tavares' && linhas('Fin_Pessoas') === 3 && linhas('Fin_Cadastro') === 2, [linhas('Fin_Pessoas'), linhas('Fin_Cadastro')]);
  cadastro(CARLA, { valor: 30000, modo: 'sessao', encaminhamento: 'Doctoralia' });
  cadastro(DIEGO, { valor: 28000, modo: 'n', n: '2', canal: 'email', encaminhamento: 'Indicação de paciente' });
  cadastro(ELISA, { valor: 32000, modo: 'mensal', quando: 'adiantado', recibo: 'Sim' });
  cadastro(FABIO, { valor: 26000, modo: 'mensal', quando: 'seguinte' });
  ok('B9 paciente que não é deste profissional: cadastro e leitura recusados', cadastro('ZZZ').ok === false && fin({ siglaPaciente: 'ZZZ' }).ok === false);
  const l = fin().financeiro;
  ok('B10 a lista de pacientes da página traz modo, recibo e o nome de quem paga, mas nunca o documento', doPac(l, BRUNO).pagadores[0].nome === 'Marta Tavares' && doPac(l, BRUNO).recibo === true && doPac(l, ANA).pagadores[0].nome === 'Ana Beatriz Moura' &&
    JSON.stringify(l).indexOf('52998224725') === -1 && JSON.stringify(l).indexOf('11222333000181') === -1);
});

/* ---------------------------------------------------------------- C */
console.log('C. A leitura segue a Agenda');
const ID = {};
tenta('C', () => {
  // Ana: 4 terças de novembro (3 já ocorreram + a de 24 realizada) e 1 de outubro em aberto
  ID.a0 = sessao(ANA, '2026-10-27'); ID.a1 = sessao(ANA, '2026-11-03'); ID.a2 = sessao(ANA, '2026-11-10'); ID.a3 = sessao(ANA, '2026-11-17'); ID.a4 = sessao(ANA, '2026-11-24');
  [ID.a0, ID.a1, ID.a2, ID.a3, ID.a4].forEach(id => situacao(id, 'realizada'));
  // Bruno: realizada, falta, uma futura do mês (30/11) e uma de dezembro
  ID.b1 = sessao(BRUNO, '2026-11-02', '14:00', { modalidade: 'online' }); ID.b2 = sessao(BRUNO, '2026-11-09', '14:00', { modalidade: 'online' }); ID.b3 = sessao(BRUNO, '2026-11-30', '14:00', { modalidade: 'online' }); ID.b4 = sessao(BRUNO, '2026-12-07', '14:00', { modalidade: 'online' });
  situacao(ID.b1, 'realizada'); situacao(ID.b2, 'falta');
  // Carla: uma realizada, uma ocorrida sem situação marcada, uma futura
  ID.c1 = sessao(CARLA, '2026-11-05', '16:00'); ID.c2 = sessao(CARLA, '2026-11-12', '16:00'); ID.c3 = sessao(CARLA, '2026-11-26', '16:00');
  situacao(ID.c1, 'realizada');
  // Diego: uma realizada (a segunda vem depois); Elisa: adiantado, duas futuras do mês; Fábio: realizada e cancelada pelo paciente fora do prazo
  ID.d1 = sessao(DIEGO, '2026-11-06', '09:00', { modalidade: 'online' }); situacao(ID.d1, 'realizada');
  ID.e1 = sessao(ELISA, '2026-11-26', '11:00'); ID.e2 = sessao(ELISA, '2026-11-27', '11:00');
  ID.f1 = sessao(FABIO, '2026-11-05', '18:00'); situacao(ID.f1, 'realizada');
  ID.f2 = sessao(FABIO, '2026-11-25', '18:00'); prof('profCancelarSessao', { id: ID.f2, opcoes: { quem: 'paciente' }, periodo: PER });
  ID.f3 = sessao(FABIO, '2026-12-10', '18:00'); prof('profCancelarSessao', { id: ID.f3, opcoes: { quem: 'paciente' }, periodo: PER });
  // Guilherme: sem cadastro e sessão sem valor → vale o valor padrão do profissional (R$ 250,00)
  ID.g1 = sessao(GUI, '2026-11-24', '15:00'); situacao(ID.g1, 'realizada');
  const f = fin().financeiro;
  ok('C1 sessão sem valor vale o do cadastro do paciente (Ana 280, Bruno 250, Carla 300) e, sem cadastro, o valor padrão (Guilherme 250)', ses(f, ID.a1).valor === 28000 && ses(f, ID.b1).valor === 25000 && ses(f, ID.c1).valor === 30000 && ses(f, ID.g1).valor === 25000, [ses(f, ID.a1), ses(f, ID.g1)]);
  ok('C2 realizada e falta entram; ocorrida sem situação entra como "ocorrida"; a futura do mês entra só para quem paga o mês (Bruno e Elisa sim, Carla não)',
    ses(f, ID.b1).cobravel && ses(f, ID.b2).cobravel && ses(f, ID.b2).estado === 'falta' && ses(f, ID.c2).cobravel && ses(f, ID.c2).estado === 'ocorrida' && ses(f, ID.b3).cobravel === true && ses(f, ID.e1).cobravel === true && ses(f, ID.c3).cobravel === false,
    [ses(f, ID.c2), ses(f, ID.b3), ses(f, ID.c3)]);
  ok('C3 cancelada pelo paciente com menos de 24 h é cobrada e aparece; cancelada no prazo não é assunto do financeiro; a de dezembro fica fora do mês', !!ses(f, ID.f2) && ses(f, ID.f2).cobravel && ses(f, ID.f2).estado === 'cancelada' && !ses(f, ID.f3) && !f.sessoes.some(x => x.id === ID.b4), ses(f, ID.f2));
  ok('C4 "abertas" traz tudo o que está a receber, de qualquer mês (a de outubro da Ana), em ordem de data', f.abertas[0].id === ID.a0 && f.abertas.every(x => x.cobravel && x.pago < x.valor) && f.abertas.some(x => x.id === ID.a4));
  // mudou a Agenda, mudou o financeiro
  situacao(ID.c2, 'falta');
  let g = fin().financeiro;
  ok('C5 mudou a Agenda, mudou o financeiro: marcar falta troca a situação sem digitar nada', ses(g, ID.c2).estado === 'falta' && ses(g, ID.c2).cobravel);
  prof('profCancelarSessao', { id: ID.b3, opcoes: { quem: 'profissional' }, periodo: PER });
  g = fin().financeiro;
  ok('C6 cancelar pela Agenda tira a sessão do a receber', !ses(g, ID.b3));
  // decisão 6: mudou o valor no cadastro
  ID.a5 = sessao(ANA, '2026-12-01'); ID.a6 = sessao(ANA, '2026-12-08', '10:00', { valor: '200' }); // a6: valor trocado à mão
  cadastro(ANA, { valor: 30000, modo: 'mensal', quando: 'f3', recibo: 'Sim', canal: 'whatsapp', encaminhamento: 'Indicação de paciente' });
  const d = prof('profLerFinanceiro', { periodo: 'personalizado', de: '2026-10-01', ate: '2026-12-31' }).financeiro;
  ok('C7 mudou o valor no cadastro: muda só a próxima sessão ainda não paga (300); as que já ocorreram ficam (280) e a que teve o valor trocado à mão fica (200)',
    ses(d, ID.a5).valor === 30000 && cel('Sessoes', ID.a5, 'valor').replace(/^'/, '') === '300' && cel('Sessoes', ID.a1, 'valor').replace(/^'/, '') === '' && ses(d, ID.a6).valor === 20000, [ses(d, ID.a5), cel('Sessoes', ID.a1, 'valor'), ses(d, ID.a6)]);
});

/* ---------------------------------------------------------------- D */
console.log('D. Pagamento, parcial, crédito e desfazer');
tenta('D', () => {
  const antes = fin().financeiro, idP = uuid();
  // as sessões já ocorridas da Ana guardam o valor da época? Não: sem valor na sessão, vale o cadastro atual (300). É o comportamento do valor que "nasce do cadastro".
  const abertasAna = antes.abertas.filter(x => x.sigla === ANA), devido = abertasAna.reduce((a, x) => a + x.valor - x.pago, 0);
  let r = pagar(ANA, { id: idP, valor: 60000, sessoes: [{ sessao: ID.a0, valor: 30000 }, { sessao: ID.a1, valor: 30000 }] }, { simular: true });
  ok('D1 simular mostra o antes e o depois e não grava nada', r.ok && r.simulacao.antes.a_receber === devido && r.simulacao.depois.a_receber === devido - 60000 && r.simulacao.depois.recebido === 60000 && linhas('Fin_Pagamentos') <= 0, r);
  r = pagar(ANA, { id: idP, valor: 60000, sessoes: [{ sessao: ID.a0, valor: 30000 }, { sessao: ID.a1, valor: 30000 }] });
  ok('D2 pagamento confirmado: uma linha, duas alocações, as duas sessões pagas; o mês do pagamento é o das sessões (uma de outubro, uma de novembro)',
    r.ok && linhas('Fin_Pagamentos') === 1 && linhas('Fin_Alocacoes') === 2 && ses(r.financeiro, ID.a1).pago === 30000 && !r.financeiro.abertas.some(x => x.id === ID.a0) && cel('Fin_Pagamentos', idP, 'situacao').replace(/^'/, '') === 'confirmado', r.erro);
  r = pagar(ANA, { id: idP, valor: 60000, sessoes: [{ sessao: ID.a2, valor: 30000 }] });
  ok('D3 reenvio do mesmo pagamento: duplicado, nada gravado de novo', r.ok && r.duplicado === true && linhas('Fin_Pagamentos') === 1 && linhas('Fin_Alocacoes') === 2);
  r = pagar(ANA, { valor: 10000, sessoes: [{ sessao: ID.a2, valor: 10000 }] });
  ok('D4 pagamento parcial: a sessão fica com 100 pagos e 200 em aberto', r.ok && ses(r.financeiro, ID.a2).pago === 10000 && r.financeiro.abertas.some(x => x.id === ID.a2));
  r = pagar(ANA, { valor: 50000, sessoes: [{ sessao: ID.a2, valor: 20000 }] });
  ok('D5 sobra vira crédito do paciente (pagou 500, a sessão pedia 200: crédito de 300), à vista na leitura', r.ok && r.sobra === 30000 && doPac(r.financeiro, ANA).credito === 30000 && !r.financeiro.abertas.some(x => x.id === ID.a2));
  ok('D6 alocação errada é recusada e nada é gravado: mais que o devido da sessão, sessão de outro paciente, sessão já paga e soma maior que o valor', [
    pagar(ANA, { valor: 50000, sessoes: [{ sessao: ID.a3, valor: 40000 }] }), pagar(ANA, { valor: 30000, sessoes: [{ sessao: ID.c1, valor: 30000 }] }),
    pagar(ANA, { valor: 30000, sessoes: [{ sessao: ID.a0, valor: 30000 }] }), pagar(ANA, { valor: 20000, sessoes: [{ sessao: ID.a3, valor: 30000 }] })].every(x => x.ok === false) && linhas('Fin_Pagamentos') === 3);
  ok('D7 sem valor, com data futura ou sem forma de pagamento: recusado', pagar(ANA, { valor: 0, sessoes: [] }).ok === false && pagar(ANA, { valor: 100, data: '2026-11-26', sessoes: [] }).ok === false && pagar(ANA, { valor: 100, forma: '', sessoes: [] }).ok === false);
  r = pagar(ANA, { credito: true, sessoes: [{ sessao: ID.a3, valor: 30000 }] });
  ok('D8 usar o crédito: nenhuma linha de pagamento nova; a sessão fica paga e o crédito zera', r.ok && linhas('Fin_Pagamentos') === 3 && doPac(r.financeiro, ANA).credito === 0 && ses(r.financeiro, ID.a3).pago === 30000, r.erro);
  ok('D9 crédito não cobre mais do que existe', pagar(ANA, { credito: true, sessoes: [{ sessao: ID.a4, valor: 30000 }] }).ok === false);
  // desfazer o pagamento parcial de 100 (a2 volta a dever 100)
  const idParcial = aba('Fin_Pagamentos').getDataRange().getValues().slice(1).map(l => String(l[0]).replace(/^'/, ''))[1];
  r = prof('profEstornarPagamento', { id: idParcial });
  const depois = fin().financeiro;
  ok('D10 desfazer um pagamento: a linha fica (situação estornado), deixa de contar e a sessão volta a ter saldo em aberto', r.ok && cel('Fin_Pagamentos', idParcial, 'situacao').replace(/^'/, '') === 'estornado' && linhas('Fin_Pagamentos') === 3 && ses(depois, ID.a2).pago === 20000, ses(depois, ID.a2));
  ok('D11 o extrato do paciente traz sessões e pagamentos confirmados, do mais novo ao mais antigo, sem o pagamento desfeito', r.paciente.extrato.filter(x => x.tipo === 'pagamento').length === 2 && r.paciente.extrato[0].data >= r.paciente.extrato[r.paciente.extrato.length - 1].data && r.paciente.credito === 0);
});

/* ---------------------------------------------------------------- E */
console.log('E. Cobranças');
tenta('E', () => {
  h.EMAILS.length = 0;
  let f = fin().financeiro;
  const prop = sig => f.propostas.filter(p => p.sigla === sig);
  ok('E1 propostas de hoje (25/11) pelo modo de cada um: Ana (21 ao fim) com o que falta de novembro; Bruno (1 a 10); Carla e Guilherme (por sessão) só o que ocorreu; Diego (a cada 2) ainda não, com 1 sessão; Elisa (adiantado) as do mês; Fábio (mês seguinte) nada',
    prop(ANA).length === 1 && prop(ANA)[0].sessoes.join() === [ID.a2, ID.a4].join() && prop(BRUNO).length === 1 && prop(BRUNO)[0].total === 50000 && prop(CARLA).length === 1 && prop(CARLA)[0].sessoes.join() === [ID.c1, ID.c2].join() &&
    prop(GUI).length === 1 && prop(DIEGO).length === 0 && prop(ELISA).length === 1 && prop(ELISA)[0].sessoes.length === 2 && prop(FABIO).length === 0, f.propostas);
  ok('E2 ler a página não gera cobrança nem manda e-mail', linhas('Fin_Cobrancas') <= 0 && h.EMAILS.length === 0);
  ID.d2 = sessao(DIEGO, '2026-11-13', '09:00', { modalidade: 'online' }); situacao(ID.d2, 'realizada');
  f = fin().financeiro;
  ok('E3 com a segunda sessão do Diego a proposta dele aparece ("A cada 2 sessões")', prop(DIEGO).length === 1 && prop(DIEGO)[0].sessoes.length === 2 && prop(DIEGO)[0].motivo === 'A cada 2 sessões');
  let r = prof('profGerarCobrancas', { siglas: [ANA, BRUNO, DIEGO], periodo: 'mes' });
  const cob = sig => r.financeiro.cobrancas.filter(c => c.sigla === sig)[0];
  ok('E4 gerar para três pacientes: três cobranças "a enviar", nenhum e-mail; quem não foi escolhido continua só como proposta',
    r.ok && r.geradas === 3 && linhas('Fin_Cobrancas') === 3 && r.financeiro.cobrancas.every(c => c.situacao === 'a_enviar') && h.EMAILS.length === 0 && r.financeiro.propostas.some(p => p.sigla === CARLA) && !r.financeiro.propostas.some(p => p.sigla === ANA), r.erro);
  ok('E5 a cobrança do Bruno vai para quem paga (Marta), com o vencimento em 5 dias e o que já foi pago descontado na da Ana',
    cob(BRUNO).para === 'Marta Tavares' && /^Marta, boa tarde/.test(cob(BRUNO).texto) && cob(BRUNO).vence_em === '2026-11-30' && cob(ANA).total === 40000 && cob(ANA).falta === 40000 && /já pago: R\$ 200,00/.test(cob(ANA).texto), [cob(BRUNO).texto.slice(0, 60), cob(ANA).total]);
  ok('E6 gerar de novo para os mesmos não duplica (não há mais proposta para eles)', prof('profGerarCobrancas', { siglas: [ANA, BRUNO, DIEGO] }).ok === false && linhas('Fin_Cobrancas') === 3);
  // enviar por e-mail a cobrança do Bruno, tirando a falta (ela continua em aberto)
  const idB = cob(BRUNO).id, idA = cob(ANA).id, idD = cob(DIEGO).id;
  r = prof('profEnviarCobranca', { id: idB, periodo: 'mes', dados: { canal: 'email', sessoes: [ID.b1], vence_em: '2026-11-28', texto: 'Marta, boa tarde.\n\n1 sessão & <b>teste</b> "aspas" \'simples\'\n\n*Total: R$ 250,00*' } });
  const m = h.EMAILS[0] || {};
  ok('E7 e-mail de cobrança: sai para o e-mail de quem paga, assunto genérico, sem botão, com o texto revisado escapado no HTML', r.ok && h.EMAILS.length === 1 && m.to === 'marta@exemplo.test' && m.subject === 'Demonstrativo de novembro de 2026' &&
    m.htmlBody.indexOf('1 sessão &amp; &lt;b&gt;teste&lt;/b&gt; &quot;aspas&quot; &#39;simples&#39;') !== -1 && m.htmlBody.indexOf('<b>teste</b>') === -1 && m.htmlBody.indexOf('border-radius:999px') === -1 && /Total: R\$ 250,00/.test(m.body) && m.body.indexOf('*Total') === -1,
    [m.to, m.subject, (m.htmlBody || '').indexOf('&lt;b&gt;')]);
  ok('E8 a sessão desmarcada saiu só desta cobrança: continua em aberto e volta a ser proposta', cob(BRUNO).situacao === 'enviada' && cob(BRUNO).sessoes.join() === ID.b1 && cob(BRUNO).total === 25000 && r.financeiro.abertas.some(x => x.id === ID.b2) && r.financeiro.propostas.some(p => p.sigla === BRUNO && p.sessoes.join() === ID.b2));
  r = prof('profEnviarCobranca', { id: idA, periodo: 'mes', dados: { canal: 'marcar', vence_em: '2026-11-20' } });
  ok('E9 "marcar como enviada" (WhatsApp) não manda e-mail; vencida em 20/11 e ainda com saldo, aparece como atrasada', r.ok && h.EMAILS.length === 1 && cob(ANA).situacao === 'atrasada' && cob(ANA).enviada_em === '2026-11-25');
  // Guilherme não tem e-mail
  r = prof('profGerarCobrancas', { siglas: [GUI], periodo: 'mes' });
  const idG = cob(GUI).id;
  ok('E10 sem e-mail no cadastro o envio por e-mail é recusado com a explicação e a cobrança continua a enviar', prof('profEnviarCobranca', { id: idG, dados: { canal: 'email' } }).ok === false && h.EMAILS.length === 1);
  r = prof('profDescartarCobranca', { id: idG, periodo: 'mes' });
  ok('E11 descartar a cobrança que não saiu: a linha some e a sessão volta a ser proposta; a já enviada não pode ser descartada', r.ok && linhas('Fin_Cobrancas') === 3 && r.financeiro.propostas.some(p => p.sigla === GUI) && prof('profDescartarCobranca', { id: idB }).ok === false);
  // pagar: parcial e depois paga
  r = prof('profEnviarCobranca', { id: idD, periodo: 'mes', dados: { canal: 'marcar' } });
  ok('E12 enviada e dentro do prazo, sem pagamento: "enviada", com o total cobrado e tudo em falta', cob(DIEGO).situacao === 'enviada' && cob(DIEGO).total === 56000 && cob(DIEGO).falta === 56000);
  r = pagar(DIEGO, { valor: 28000, sessoes: [{ sessao: ID.d1, valor: 28000 }] });
  ok('E13 recebeu metade depois de cobrada: parcial', cob(DIEGO).situacao === 'parcial' && cob(DIEGO).pago === 28000 && cob(DIEGO).falta === 28000, cob(DIEGO));
  r = pagar(DIEGO, { valor: 28000, data: '2026-11-24', sessoes: [{ sessao: ID.d2, valor: 28000 }] });
  ok('E14 quitada: paga, com a data do último pagamento', cob(DIEGO).situacao === 'paga' && cob(DIEGO).paga_em === '2026-11-25', cob(DIEGO));
  // não cobrar esta sessão
  ok('E15 sessão com pagamento não pode deixar de ser cobrada', prof('profNaoCobrarSessao', { sessoes: [ID.d1] }).ok === false);
  r = prof('profNaoCobrarSessao', { sessoes: [ID.b2], periodo: 'mes' });
  ok('E16 "não cobrar esta sessão" é um gesto próprio: grava cobrada = Nao na Agenda e a sessão sai do a receber e das propostas', r.ok && cel('Sessoes', ID.b2, 'cobrada').replace(/^'/, '') === 'Nao' && !r.financeiro.abertas.some(x => x.id === ID.b2) && !r.financeiro.propostas.some(p => p.sigla === BRUNO));
  // cota de e-mails de cobrança
  const cota = S('_reservarEmail_');
  let n = 0; while (cota('cobrancas', 1) && n < 100) n++;
  ok('E17 cota própria de e-mails de cobrança: 60 por dia (1 já usado); esgotada, o envio é recusado e nada sai', n === 59 && prof('profEnviarCobranca', { id: idB, dados: { canal: 'email' } }).ok === false && h.EMAILS.length === 1, n);
  ok('E18 não existe gatilho nem envio fora de profEnviarCobranca: o bloco do financeiro só chama _enviarEmail_ ali', (() => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8'), i = src.indexOf('// FASE 20 — FLUXO DE CAIXA'), j = src.indexOf('// ---------- fim da Fase 20 ----------');
    const bloco = src.slice(i, j); return i > 0 && j > i && (bloco.match(/_enviarEmail_\(/g) || []).length === 1 && bloco.indexOf('newTrigger') === -1 && bloco.indexOf('MailApp') === -1; })());
});

/* ---------------------------------------------------------------- F */
console.log('F. Lado do paciente e comprovante');
tenta('F', () => {
  let r = pac(ANA, 'lerMeuFinanceiro');
  ok('F1 a Ana vê só o próprio mês: sessões cobradas de novembro, total, pago, o que ficou de meses anteriores e os dados para pagar; nenhum dado de outro paciente', r.ok && r.meu.sessoes.length === 4 && r.meu.total === 120000 && r.meu.pago === 80000 && r.meu.aberto_anterior === 0 &&
    /Pix \(chave e-mail\)/.test(r.meu.dados_receber) && r.meu.pode_recibo === true && JSON.stringify(r).indexOf('Bruno') === -1 && JSON.stringify(r).indexOf('Marta') === -1, r.meu);
  ok('F2 o paciente não alcança nenhuma ação do profissional (leitura, pagamento, cobrança, despesa) nem o financeiro de outro pela sigla',
    ['profLerFinanceiro', 'profSalvarPagamento', 'profGerarCobrancas', 'profEnviarCobranca', 'profSalvarDespesa', 'profNaoCobrarSessao', 'profSalvarCadastroFinanceiro'].every(a => pac(ANA, a, { siglaPaciente: BRUNO, sigla: BRUNO, siglas: [BRUNO] }).ok === false) &&
    pac(ANA, 'lerMeuFinanceiro', { sigla: BRUNO, siglaPaciente: BRUNO }).meu.total === 120000);
  ok('F3 o profissional não usa as ações do paciente', prof('lerMeuFinanceiro').ok === false && prof('pacientePedirRecibo').ok === false);
  const jpg = Buffer.from('imagem de teste').toString('base64'), idC = uuid();
  ok('F4 comprovante sem arquivo, com tipo estranho, grande demais ou com data futura: recusado, nada gravado', [
    pac(ANA, 'pacienteEnviarComprovante', { dados: { id: uuid(), valor: 40000, data: '2026-11-25' } }),
    pac(ANA, 'pacienteEnviarComprovante', { dados: { id: uuid(), valor: 40000, data: '2026-11-25', arquivo: { nome: 'x.exe', tipo: 'application/x-msdownload', base64: jpg } } }),
    pac(ANA, 'pacienteEnviarComprovante', { dados: { id: uuid(), valor: 40000, data: '2026-11-25', arquivo: { nome: 'x.jpg', tipo: 'image/jpeg', base64: 'A'.repeat(7200001) } } }),
    pac(ANA, 'pacienteEnviarComprovante', { dados: { id: uuid(), valor: 40000, data: '2026-11-26', arquivo: { nome: 'x.jpg', tipo: 'image/jpeg', base64: jpg } } })].every(x => x.ok === false) && Object.keys(ARQUIVOS).length === 0);
  const nPag = linhas('Fin_Pagamentos');
  r = pac(ANA, 'pacienteEnviarComprovante', { dados: { id: idC, valor: 40000, data: '2026-11-25', arquivo: { nome: 'pix da ana.jpg', tipo: 'image/jpeg', base64: jpg } } });
  ok('F5 comprovante enviado: o arquivo vai para a pasta "Comprovantes" do profissional e o pagamento fica AGUARDANDO; o pago da Ana não muda', r.ok && Object.keys(ARQUIVOS).length === 1 && ARQUIVOS[Object.keys(ARQUIVOS)[0]].pasta !== '' && linhas('Fin_Pagamentos') === nPag + 1 &&
    r.meu.pago === 80000 && r.meu.historico[0].id === idC && r.meu.historico[0].situacao === 'aguardando' && cel('Fin_Pagamentos', idC, 'situacao').replace(/^'/, '') === 'aguardando', r.meu && r.meu.historico);
  ok('F6 reenvio do mesmo comprovante não duplica', pac(ANA, 'pacienteEnviarComprovante', { dados: { id: idC, valor: 40000, data: '2026-11-25', arquivo: { nome: 'x.jpg', tipo: 'image/jpeg', base64: jpg } } }).ok && linhas('Fin_Pagamentos') === nPag + 1 && Object.keys(ARQUIVOS).length === 1);
  let f = fin().financeiro, ini = prof('profLerFinanceiro', { so: 'inicio' }).inicio;
  ok('F7 o profissional vê o comprovante a conferir (na página e no Início) e o a receber não mudou', f.comprovantes.length === 1 && f.comprovantes[0].id === idC && f.comprovantes[0].valor === 40000 && ini.comprovantes.length === 1 && ses(f, ID.a2).pago === 20000);
  const arqP = prof('lerArquivoFinanceiro', { id: idC }), arqA = pac(ANA, 'lerArquivoFinanceiro', { id: idC }), arqB = pac(BRUNO, 'lerArquivoFinanceiro', { id: idC });
  ok('F8 o arquivo só é entregue com crachá: ao profissional e à paciente que enviou; outro paciente não o lê', arqP.ok && arqP.arquivo.base64 === jpg && arqP.arquivo.tipo === 'image/jpeg' && arqA.ok && arqB.ok === false);
  r = prof('profDecidirComprovante', { id: idC, aprovar: true, periodo: 'mes', dados: { valor: 40000, data: '2026-11-25', forma: 'Pix', sessoes: [{ sessao: ID.a2, valor: 10000 }, { sessao: ID.a4, valor: 30000 }] } });
  ok('F9 confirmar o comprovante: vira pagamento confirmado, abate as sessões escolhidas e sai da lista a conferir', r.ok && r.financeiro.comprovantes.length === 0 && ses(r.financeiro, ID.a4).pago === 30000 && cel('Fin_Pagamentos', idC, 'forma').replace(/^'/, '') === 'Pix' && pac(ANA, 'lerMeuFinanceiro').meu.pago === 120000);
  ok('F10 decidir de novo o mesmo comprovante não muda nada', prof('profDecidirComprovante', { id: idC, aprovar: false }).duplicado === true && cel('Fin_Pagamentos', idC, 'situacao').replace(/^'/, '') === 'confirmado');
  const idR = uuid();
  pac(BRUNO, 'pacienteEnviarComprovante', { dados: { id: idR, valor: 25000, data: '2026-11-24', arquivo: { nome: 'c.pdf', tipo: 'application/pdf', base64: jpg } } });
  r = prof('profDecidirComprovante', { id: idR, aprovar: false, periodo: 'mes' });
  ok('F11 recusar: fica como recusado, não conta e o paciente vê "não confirmado"', r.ok && ses(r.financeiro, ID.b1).pago === 0 && pac(BRUNO, 'lerMeuFinanceiro').meu.historico[0].situacao === 'recusado');
  ok('F12 pedido de recibo: só para quem o profissional marcou (Carla não); o da Ana fica registrado, aparece no Início e não se repete no mês', pac(CARLA, 'pacientePedirRecibo').ok === false && pac(ANA, 'pacientePedirRecibo').meu.recibo_pedido === true && pac(ANA, 'pacientePedirRecibo').ok &&
    prof('profLerFinanceiro', { so: 'inicio' }).inicio.recibos.length === 1 && doPac(fin().financeiro, ANA).recibo_pedido === true);
});

/* ---------------------------------------------------------------- G */
console.log('G. Despesas e contas a pagar');
tenta('G', () => {
  const dAluguel = uuid(), dAvulsa = uuid(), dEnergia = uuid();
  let r = prof('profSalvarDespesa', { periodo: 'mes', dados: { id: dAluguel, nome: 'Aluguel da sala', categoria: 'Aluguel', valor: 120000, data: '2026-11-05', situacao: 'paga', repete: 'fixo' } });
  ok('G1 despesa paga que repete (valor fixo): uma linha no mês e a despesa fixa criada com o dia 5', r.ok && linhas('Fin_Despesas') === 1 && linhas('Fin_Despesas_Fixas') === 1 && r.financeiro.despesas.length === 1 && r.financeiro.despesas[0].fixa && r.financeiro.despesas[0].tipo === 'fixo');
  r = prof('profSalvarDespesa', { periodo: 'mes', dados: { id: dEnergia, nome: 'Energia', categoria: 'Contas (água, luz, internet)', valor: 21440, data: '2026-11-16', situacao: 'paga', repete: 'variavel' } });
  r = prof('profSalvarDespesa', { periodo: 'mes', dados: { id: dAvulsa, nome: 'Supervisão clínica', categoria: 'Material', valor: 40000, data: '2026-11-27', situacao: 'a_pagar', repete: '' } });
  ok('G2 despesa avulsa a pagar com vencimento futuro entra pendente', r.ok && r.financeiro.despesas.filter(d => d.situacao === 'a_pagar').length === 1 && r.financeiro.despesas.length === 3);
  ok('G3 sem nome, sem categoria, paga com valor zero ou paga com data futura: recusado', [{ nome: '', categoria: 'Aluguel', valor: 100, data: '2026-11-05', situacao: 'paga' }, { nome: 'X', categoria: '', valor: 100, data: '2026-11-05', situacao: 'paga' },
    { nome: 'X', categoria: 'Aluguel', valor: 0, data: '2026-11-05', situacao: 'paga' }, { nome: 'X', categoria: 'Aluguel', valor: 100, data: '2026-11-30', situacao: 'paga' }].every(d => prof('profSalvarDespesa', { dados: Object.assign({ id: uuid() }, d) }).ok === false) && linhas('Fin_Despesas') === 3);
  irPara(2026, 12, 3, 9, 0);
  r = fin();
  const dez = r.financeiro.despesas, contaAluguel = dez.filter(d => d.nome === 'Aluguel da sala')[0], contaEnergia = dez.filter(d => d.nome === 'Energia')[0];
  ok('G4 em dezembro as contas do mês nascem na leitura, sem linha nova: aluguel com a sugestão do último valor pago; energia (valor que muda) em branco', dez.length === 2 && contaAluguel.valor === 120000 && contaAluguel.vence === '2026-12-05' && contaAluguel.situacao === 'a_pagar' &&
    contaEnergia.valor === 0 && contaEnergia.tipo === 'variavel' && /^fixa:/.test(contaAluguel.id) && linhas('Fin_Despesas') === 3, dez);
  ok('G5 o Início mostra as contas que vencem em 7 dias (aluguel no dia 5)', prof('profLerFinanceiro', { so: 'inicio' }).inicio.contas.some(c => c.nome === 'Aluguel da sala' && c.vence === '2026-12-05'));
  ok('G6 conta de valor variável não pode ser paga sem o valor', prof('profSalvarDespesa', { dados: { id: contaEnergia.id, valor: 0, data: '2026-12-03', situacao: 'paga' } }).ok === false);
  r = prof('profSalvarDespesa', { periodo: 'mes', dados: { id: contaAluguel.id, valor: 125000, data: '2026-12-03', situacao: 'paga' } });
  ok('G7 pagar a conta do mês grava o lançamento com a data e o valor reais; pagar de novo não duplica', r.ok && linhas('Fin_Despesas') === 4 && r.financeiro.despesas.filter(d => d.nome === 'Aluguel da sala' && d.situacao === 'paga' && d.valor === 125000 && d.paga_em === '2026-12-03').length === 1 &&
    prof('profSalvarDespesa', { dados: { id: contaAluguel.id, valor: 125000, data: '2026-12-03', situacao: 'paga' } }).duplicado === true && linhas('Fin_Despesas') === 4);
  r = prof('profSalvarDespesa', { periodo: 'mes_passado', dados: { id: dAvulsa, valor: 40000, data: '2026-12-01', situacao: 'paga' } });
  ok('G8 pagar a despesa avulsa que estava pendente atualiza a mesma linha', r.ok && linhas('Fin_Despesas') === 4 && cel('Fin_Despesas', dAvulsa, 'situacao').replace(/^'/, '') === 'paga' && cel('Fin_Despesas', dAvulsa, 'paga_em').replace(/^'/, '') === '2026-12-01');
  r = prof('profEncerrarDespesaFixa', { id: contaEnergia.id, periodo: 'mes' });
  ok('G9 parar de repetir: a conta de energia de dezembro some e a de novembro (já paga) fica', r.ok && !r.financeiro.despesas.some(d => d.nome === 'Energia') && fin({ periodo: 'mes_passado' }).financeiro.despesas.some(d => d.nome === 'Energia' && d.situacao === 'paga'));
  irPara(2027, 1, 10, 9, 0);
  ok('G10 em janeiro o aluguel sugere o último valor pago (1.250,00) e energia não volta', (() => { const j = fin().financeiro.despesas; return j.length === 1 && j[0].valor === 125000 && j[0].vence === '2027-01-05'; })());
  irPara(2026, 11, 25, 14, 0);
});

/* ---------------------------------------------------------------- H */
console.log('H. Resumo');
tenta('H', () => {
  const f = fin().financeiro, r = f.resumo;
  const cobraveis = f.sessoes.filter(x => x.cobravel), total = cobraveis.reduce((a, x) => a + x.valor, 0), recebido = cobraveis.reduce((a, x) => a + x.pago, 0);
  ok('H1 a série do gráfico tem um ponto por dia do mês e soma as sessões cobradas e o valor delas', r.granul === 'dia' && r.serie.length === 30 && r.serie.reduce((a, p) => a + p.sessoes, 0) === cobraveis.length && r.serie.reduce((a, p) => a + p.valor, 0) === total);
  ok('H2 recebido pela data de entrada soma os pagamentos confirmados do período (o desfeito, o recusado e o aguardando ficam fora)', r.recebido_entrada === 60000 + 50000 + 28000 + 28000 + 40000, r.recebido_entrada);
  ok('H3 recebido pelo mês das sessões: o pagamento que quitou a sessão de outubro conta em outubro (comparação), não em novembro', recebido === r.recebido_entrada - 30000 && r.anterior.recebido === 30000, [recebido, r.anterior]);
  ok('H4 agenda do período: realizadas, faltas e cancelamentos por quem cancelou, com as porcentagens', r.agenda.faltas === 2 && r.agenda.canc_pac === 1 && r.agenda.canc_prof === 1 && r.agenda.realizadas >= 10 && r.agenda.online + r.agenda.presencial === r.agenda.realizadas + r.agenda.faltas + f.sessoes.filter(x => x.estado === 'agendada').length, r.agenda);
  ok('H5 pacientes: todos os sete são novos no período (primeira sessão em novembro, menos a Ana, que vem de outubro) e o encaminhamento em texto livre (de antes do 19.5) conta como "Outro"', r.pacientes.novos === 6 && r.pacientes.regulares === 1 && r.encaminhamento[0].item === 'outro' && r.encaminhamento[0].n === 3 && r.encaminhamento[0].subs.length === 0, [r.pacientes, r.encaminhamento]); // 19.5: o texto livre antigo conta como "Outro"
  ok('H6 no ano: faturamento = soma do que é cobrável no ano, com e sem recibo somando o total, média mensal e projeção', r.ano.faturamento === r.ano.com_recibo + r.ano.sem_recibo && r.ano.faturamento >= total && r.ano.projecao === r.ano.media_mensal * 12 && r.ano.valor_medio > 0, r.ano);
  const ano = prof('profLerFinanceiro', { periodo: 'ano' }).financeiro;
  ok('H7 período longo (o ano): o gráfico vem por mês, com 12 pontos', ano.resumo.granul === 'mes' && ano.resumo.serie.length === 12 && ano.periodo.rotulo === 'Ano de 2026');
  ok('H8 despesas pagas do período anterior entram na comparação', prof('profLerFinanceiro', { periodo: 'personalizado', de: '2026-12-01', ate: '2026-12-31' }).financeiro.resumo.anterior.despesas === 120000 + 21440);
});

/* ---------------------------------------------------------------- R */
console.log('R. Recibos, lote e livro caixa (20.1)');
tenta('R', () => {
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures_lote_20_1.json'), 'utf8'));
  const cfgLote = { cod_rendimento: 'R01.001.001', cod_ocupacao: '255', cpf_emissor: FX.emissor };
  const ordem = l => l.slice().sort((a, b) => (a.slice(6) + a.slice(3, 5) + a.slice(0, 2)).localeCompare(b.slice(6) + b.slice(3, 5) + b.slice(0, 2)));
  const desc = S('_finLoteDescricao_'), linhaR = S('_finLoteLinhaRecibo_'), linhaD = S('_finLoteLinhaPagamento_');
  const difR = FX.recibos.filter(r => { const d = desc(ordem(r.datas), r.valor_sessao_centavos, r.modalidade); return d !== r.descricao || linhaR(r.data, r.datas.length * r.valor_sessao_centavos, d, r.cpf, cfgLote) !== r.linha; });
  ok('R1 lote de recibos idêntico, byte a byte, ao do gerador que o usuário usa hoje: ' + FX.recibos.length + ' recibos inventados (1 sessão, várias, com modalidade, forma compacta, milhar, centavos)', difR.length === 0 &&
    Buffer.from(FX.recibos.map(r => linhaR(r.data, r.datas.length * r.valor_sessao_centavos, desc(ordem(r.datas), r.valor_sessao_centavos, r.modalidade), r.cpf, cfgLote)).join(''), 'utf8').equals(Buffer.from(FX.arquivo_recibos, 'utf8')), difR.map(r => r.descricao));
  const difD = FX.despesas.filter(d => linhaD(d.data, d.conta, d.valor_centavos, d.historico) !== d.linha);
  ok('R2 lote de despesas idêntico, byte a byte: ' + FX.despesas.length + ' despesas (histórico com quebra de linha, conta não dedutível, centavos)', difD.length === 0 &&
    Buffer.from(FX.despesas.map(d => linhaD(d.data, d.conta, d.valor_centavos, d.historico)).join(''), 'utf8').equals(Buffer.from(FX.arquivo_despesas, 'utf8')), difD.map(d => d.linha));
  ok('R3 formato: UTF-8 sem BOM, 16 campos no recibo e 4 na despesa, fim de linha CRLF; conta fora do plano, histórico com ";" ou acima de 255 e descrição que não cabe são recusados',
    FX.arquivo_recibos.charCodeAt(0) !== 0xFEFF && FX.recibos.every(r => r.linha.split(';').length === 16 && /\r\n$/.test(r.linha)) && FX.despesas.every(d => d.linha.split(';').length === 4) &&
    linhaD('05/11/2026', 'X10.01.00002', 100, 'a') === null && linhaD('05/11/2026', 'P10.01.00002', 100, 'a;b') === null && linhaD('05/11/2026', 'P10.01.00002', 100, 'a'.repeat(256)) === null &&
    desc(Array.from({ length: 27 }, (_, i) => '01/11/2026'), 100, '') === null);

  // desligada, a camada fiscal não mostra nada
  let f = fin().financeiro;
  ok('R4 com "recibos e livro caixa" desligado: nenhum recibo, nenhuma prévia de lote, e salvar recibo é recusado', f.config.fiscal === false && f.recibos.length === 0 && f.lote === null && prof('profSalvarRecibo', { id: 'novo:' + ANA + ':2026-11', dados: {} }).ok === false);
  const cfg = extra => prof('profSalvarConfigFinanceiro', { periodo: 'mes', dados: Object.assign({ dados_receber: 'Pix: chave', formas: 'Pix\nDinheiro', valor_padrao: '250', prazo_dias: '5', texto_cobranca: '', categorias: 'Aluguel\nContas (água, luz, internet)\nMaterial' }, extra) });
  ok('R5 ligar sem o CPF de quem emite (ou com CPF errado) é recusado', cfg({ fiscal: 'Sim', cpf_emissor: '' }).ok === false && cfg({ fiscal: 'Sim', cpf_emissor: '111.444.777-36' }).ok === false);
  let r = cfg({ fiscal: 'Sim', cpf_emissor: '111.444.777-35', cod_rendimento: '', cod_ocupacao: '' });
  f = r.financeiro;
  const rec = sig => f.recibos.filter(x => x.sigla === sig)[0];
  ok('R6 ligado: códigos padrão do Carnê-Leão; a leitura propõe um recibo por paciente marcado, com sessão cobrada no mês — Ana (4), Bruno (1) e Elisa (2); quem não precisa de recibo (Carla) fica fora',
    r.ok && f.config.fiscal === true && f.config.cod_rendimento === 'R01.001.001' && f.config.cod_ocupacao === '255' && f.recibos.length === 3 && rec(ANA).sessoes === 4 && rec(BRUNO).sessoes === 1 && rec(ELISA).sessoes === 2 && !rec(CARLA), f.recibos.map(x => [x.nome, x.sessoes]));
  ok('R7 a proposta vem com a descrição montada, o valor certo, a data do recibo EM BRANCO e fora do lote (falta abrir e informar a data)', rec(ANA).novo === true && rec(ANA).data === '' && rec(ANA).valor === 120000 &&
    rec(ANA).descricao === 'Realização de 04 sessões de psicoterapia (R$ 300,00 cada), datadas em: a. 03 de novembro de 2026, b. 10 de novembro de 2026, c. 17 de novembro de 2026, d. 24 de novembro de 2026.' &&
    f.lote.recibos.linhas.length === 0 && f.lote.recibos.fora.length === 3 && linhas('Fin_Recibos') <= 0, [rec(ANA), f.lote.recibos.fora]);
  ok('R8 o CPF de quem recebe o recibo não vai para a lista: só o miolo, mascarado', JSON.stringify(f.recibos).indexOf('11144477735') === -1 && rec(BRUNO).titular === 'Paulo Tavares' && rec(BRUNO).titular_doc === '***.444.777-**');

  // salvar os recibos
  r = prof('profSalvarRecibo', { id: rec(BRUNO).id, periodo: 'mes', dados: { data: '2026-11-30' } });
  f = r.financeiro;
  const idBruno = r.id;
  ok('R9 recibo do Bruno salvo com a data: em nome de quem o cadastro manda (Paulo), entra na prévia do lote com a linha literal de 16 campos', r.ok && linhas('Fin_Recibos') === 1 && rec(BRUNO).novo === false && f.lote.recibos.linhas.length === 1 &&
    f.lote.recibos.linhas[0] === '30/11/2026;R01.001.001;255;250,00;;Realização de 01 sessão de psicoterapia (R$ 250,00), datada em: a. 02 de novembro de 2026.;PF;11144477735;11144477735;;;;;S;11144477735;\r\n', f.lote.recibos.linhas);
  ok('R10 salvar de novo a mesma proposta não cria o segundo recibo do mês', prof('profSalvarRecibo', { id: 'novo:' + BRUNO + ':2026-11', dados: { data: '2026-11-30' } }).duplicado === true && linhas('Fin_Recibos') === 1);
  r = prof('profSalvarRecibo', { id: rec(ANA).id, periodo: 'mes', dados: { data: '2026-11-30' } });
  f = r.financeiro;
  const idAna = r.id;
  ok('R11 recibo da Ana (em nome dela): sem CPF na anamnese fica fora do lote, com o motivo', r.ok && rec(ANA).cpf_ok === false && f.lote.recibos.fora.some(x => x.nome === 'Ana Beatriz Moura' && /CPF/.test(x.motivo)) && f.lote.recibos.linhas.length === 1);
  ok('R12 datas: de outro mês, inválida ou nenhuma são recusadas; valor unitário zero também', [{ datas: ['03/11/2026', '01/12/2026'] }, { datas: ['31/11/2026'] }, { datas: [] }, { unitario: 0 }].every(d => prof('profSalvarRecibo', { id: idAna, dados: d }).ok === false));
  r = prof('profSalvarRecibo', { id: idAna, periodo: 'mes', dados: { datas: ['24/11/2026', '03/11/2026', '10/11/2026'], unitario: 28050, modalidade: 'on-line' } });
  f = r.financeiro;
  ok('R13 editar o recibo: as datas ficam em ordem, o valor é quantidade × unitário e a descrição é montada de novo, com o complemento de modalidade', r.ok && rec(ANA).sessoes === 3 && rec(ANA).valor === 84150 &&
    rec(ANA).descricao === 'Realização de 03 sessões de psicoterapia, ofertadas na modalidade on-line, no valor de (R$ 280,50 cada), datadas em: a. 03 de novembro de 2026, b. 10 de novembro de 2026, c. 24 de novembro de 2026.', rec(ANA));
  const bruta = aba('Fin_Recibos').getRange(h.linhaDe(aba('Fin_Recibos'), 'id', idBruno), h.cab(aba('Fin_Recibos')).indexOf('titular_documento') + 1).getValue();
  ok('R14 o CPF de quem recebe fica na aba como texto', typeof bruta === 'string' && bruta.replace(/^'/, '') === '11144477735', bruta);

  // gerar o lote
  r = prof('profGerarLote', { qual: 'recibos', simular: true, periodo: 'mes' });
  ok('R15 o portão: simular devolve as linhas literais e não marca nada', r.ok && r.simulacao.linhas.length === 1 && cel('Fin_Recibos', idBruno, 'situacao').replace(/^'/, '') === 'a_emitir');
  r = prof('profGerarLote', { qual: 'recibos', periodo: 'mes' });
  f = r.financeiro;
  ok('R16 gerar o arquivo: o texto é a linha da prévia, o nome leva o período e o recibo passa a "no lote"', r.ok && r.arquivo.linhas === 1 && r.arquivo.nome === 'lote-recibos-2026-11-01-a-2026-11-30.csv' && /^30\/11\/2026;R01\.001\.001;255;250,00;;Realização de 01 sessão/.test(r.arquivo.texto) && /\r\n$/.test(r.arquivo.texto) && rec(BRUNO).situacao === 'no_lote');
  ok('R17 gerar de novo não repete a linha: nada pronto', prof('profGerarLote', { qual: 'recibos', periodo: 'mes' }).ok === false);
  ok('R18 registrar o número marca "emitido"; sem a data do recibo o número é recusado', prof('profSalvarRecibo', { id: rec(ELISA).id, dados: { numero: '119' } }).ok === false && (() => { r = prof('profSalvarRecibo', { id: idBruno, periodo: 'mes', dados: { numero: '118' } }); f = r.financeiro; return r.ok && rec(BRUNO).situacao === 'emitido' && rec(BRUNO).numero === '118'; })());
  r = prof('profSalvarRecibo', { id: idBruno, periodo: 'mes', dados: { situacao: 'cancelado' } });
  f = r.financeiro;
  ok('R19 recibo cancelado guarda o número (ele continua valendo como número usado) e o mês volta a ter uma proposta de recibo', r.ok && f.recibos.filter(x => x.id === idBruno)[0].situacao === 'cancelado' && f.recibos.filter(x => x.id === idBruno)[0].numero === '118' && f.recibos.some(x => x.sigla === BRUNO && x.novo));

  // livro caixa: despesas com conta e histórico
  const dA = uuid(), dB = uuid();
  prof('profSalvarDespesa', { dados: { id: dA, nome: 'Internet', categoria: 'Contas (água, luz, internet)', valor: 12990, data: '2026-11-10', situacao: 'paga', repete: 'fixo', conta: 'p10.01.00014', historico: 'Pagamento ref. internet\nnovembro' } });
  prof('profSalvarDespesa', { dados: { id: dB, nome: 'Café', categoria: 'Material', valor: 4000, data: '2026-11-11', situacao: 'paga', repete: '' } });
  ok('R20 conta fora do formato e histórico com ";" são recusados', prof('profSalvarDespesa', { dados: { id: uuid(), nome: 'X', categoria: 'Material', valor: 100, data: '2026-11-11', situacao: 'paga', conta: 'P12.01.00001' } }).ok === false &&
    prof('profSalvarDespesa', { dados: { id: uuid(), nome: 'X', categoria: 'Material', valor: 100, data: '2026-11-11', situacao: 'paga', conta: 'P10.01.00012', historico: 'a;b' } }).ok === false);
  f = fin().financeiro;
  ok('R21 prévia do lote de despesas: só as pagas com conta do plano; o histórico vai em uma linha; as sem conta são contadas à parte', f.lote.despesas.linhas.join('') === '10/11/2026;P10.01.00014;129,90;Pagamento ref. internet - novembro\r\n' && f.lote.despesas.fora >= 1, f.lote.despesas);
  r = prof('profGerarLote', { qual: 'despesas', periodo: 'mes' });
  ok('R22 gerar o lote de despesas marca a despesa e não a repete no lote seguinte', r.ok && r.arquivo.texto === '10/11/2026;P10.01.00014;129,90;Pagamento ref. internet - novembro\r\n' && r.financeiro.lote.despesas.linhas.length === 0 && r.financeiro.lote.despesas.em_lote === 1 && prof('profGerarLote', { qual: 'despesas', periodo: 'mes' }).ok === false);
  irPara(2026, 12, 2, 9, 0);
  const contaDez = fin().financeiro.despesas.filter(d => d.nome === 'Internet')[0];
  ok('R23 a despesa que repete leva a conta e o histórico fixos para a conta do mês seguinte', contaDez.conta === 'P10.01.00014' && contaDez.historico === 'Pagamento ref. internet - novembro' && /^fixa:/.test(contaDez.id));
  irPara(2026, 11, 25, 14, 0);
  // demonstrativo e o lado do paciente
  r = prof('profSalvarRecibo', { id: rec(ELISA).id, periodo: 'mes', dados: { data: '2026-11-03', numero: '119', arquivo: { nome: 'recibo 119.pdf', tipo: 'application/pdf', base64: Buffer.from('pdf de teste').toString('base64') } } });
  f = r.financeiro;
  const idElisa = r.id;
  ok('R24 demonstrativo do mês: rendimentos = recibos emitidos ou no lote pela data do recibo; despesas = pagas com conta dedutível; resultado = um menos o outro', r.ok && f.fiscal.rendimentos === 64000 && f.fiscal.despesas === 12990 && f.fiscal.resultado === 64000 - 12990, f.fiscal);
  const meuE = pac(ELISA, 'lerMeuFinanceiro').meu;
  ok('R25 o paciente vê o recibo emitido do mês e baixa o arquivo; outro paciente não o alcança', meuE.recibos.length === 1 && meuE.recibos[0].do_mes === true && meuE.recibos[0].tem_arquivo === true && pac(ELISA, 'lerArquivoFinanceiro', { id: idElisa }).ok === true && pac(ANA, 'lerArquivoFinanceiro', { id: idElisa }).ok === false && pac(ANA, 'lerMeuFinanceiro').meu.recibos.length === 0);
  ok('R26 a cobrança sabe que o recibo do mês já foi emitido (para a frase da mensagem) e o paciente não alcança as ações dos recibos', f.cobrancas.filter(c => c.sigla === ANA)[0].recibo_emitido === false && pac(ELISA, 'profSalvarRecibo', { id: idElisa, dados: { numero: '1' } }).ok === false && pac(ELISA, 'profGerarLote', { qual: 'recibos' }).ok === false);
});

/* ---------------------------------------------------------------- T */
console.log('T. Listas, trava, texto literal e sigilo');
tenta('T', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  const trava = S('ACOES_COM_TRAVA'), leitura = S('ACOES_SO_LEITURA');
  const gravam = ['profSalvarCadastroFinanceiro', 'profSalvarConfigFinanceiro', 'profSalvarPagamento', 'profEstornarPagamento', 'profDecidirComprovante', 'profGerarCobrancas', 'profEnviarCobranca', 'profDescartarCobranca', 'profNaoCobrarSessao', 'profSalvarDespesa', 'profEncerrarDespesaFixa', 'pacienteEnviarComprovante', 'pacientePedirRecibo', 'profSalvarRecibo', 'profGerarLote'];
  ok('T1 as 15 ações que salvam estão na trava; as 3 leituras estão na lista de leitura; todas existem no doPost', gravam.every(a => trava.indexOf(a) !== -1 && src.indexOf("case '" + a + "':") !== -1) && ['profLerFinanceiro', 'lerMeuFinanceiro', 'lerArquivoFinanceiro'].every(a => leitura.indexOf(a) !== -1 && trava.indexOf(a) === -1 && src.indexOf("case '" + a + "':") !== -1));
  ok('T2 nenhuma ação do financeiro é pública: sem crachá, todas respondem sessão expirada', gravam.concat(['profLerFinanceiro', 'lerMeuFinanceiro', 'lerArquivoFinanceiro']).every(a => { h.memo(); const r = h.post({ acao: a }); return r.ok === false && S('ACOES_PUBLICAS').indexOf(a) === -1; }));
  const semApostrofo = [];
  Object.keys(S('COLUNAS_FIN')).forEach(n => { const a = aba(n); if (!a) return; a.getDataRange().getValues().slice(1).forEach(l => l.forEach(v => { if (v !== '' && typeof v !== 'string') semApostrofo.push(n + ':' + String(v).slice(0, 20)); })); });
  ok('T3 toda célula das abas do financeiro é texto (nenhuma data, valor, CPF ou hora virou número ou Date)', semApostrofo.length === 0 && linhas('Fin_Alocacoes') > 0, semApostrofo.slice(0, 6));
  ok('T4 o cabeçalho de cada aba é exatamente o de COLUNAS_FIN', Object.keys(S('COLUNAS_FIN')).filter(n => aba(n)).every(n => h.cab(aba(n)).join() === S('COLUNAS_FIN')[n].join()));
  ok('T5 o ping devolve a VERSAO_PACOTE (o número exato quem confere é o H3 do 16.11)', !!S('VERSAO_PACOTE') && h.post({ acao: 'ping' }).versao_pacote === S('VERSAO_PACOTE'));
  ok('T6 nenhum CPF ou CNPJ foi para o log do servidor', logServidor.join(' ').indexOf('52998224725') === -1 && logServidor.join(' ').indexOf('11222333000181') === -1);
  // excluir o paciente: cadastro, quem paga e cobranças saem; os pagamentos ficam
  const pagAntes = linhas('Fin_Pagamentos');
  S('_finApagarDoPaciente_')(h.ctrl, BRUNO);
  ok('T7 ao excluir o paciente saem o cadastro financeiro, quem paga e as cobranças dele; os pagamentos ficam', linhas('Fin_Pessoas') === 0 && linhas('Fin_Cadastro') === 5 && !aba('Fin_Cobrancas').getDataRange().getValues().slice(1).some(l => String(l[1]).replace(/^'/, '') === BRUNO) && linhas('Fin_Pagamentos') === pagAntes,
    [linhas('Fin_Pessoas'), linhas('Fin_Cadastro')]);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('T8 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

/* ---------------------------------------------------------------- E19 (Pacote 19.5) */
console.log('E19. Encaminhamento em item e subitem');
tenta('E19', () => {
  const lerPac = s => prof('profLerFinanceiro', { siglaPaciente: s }).paciente.cadastro;
  const E = S('_finEnc_'), FE = S('FIN_ENC');
  ok('E1 a lista tem os onze itens aprovados e subitem só em rede social, médico e outro profissional de saúde (quatro opções + outra)',
    Object.keys(FE).join(',') === 'rede_social,busca,plataforma,paciente,colega,medico,outro_prof,convenio,familiar,espontanea,outro' &&
    Object.keys(FE).filter(k => FE[k].length).join(',') === 'rede_social,medico,outro_prof' && ['rede_social', 'medico', 'outro_prof'].every(k => FE[k].length === 5), FE);
  ok('E2 pura: chave desconhecida vira vazio (inclusive "constructor"), subitem de outro item sai, texto e nome só onde cabem',
    JSON.stringify(E({ enc_item: 'constructor', enc_sub: 'x', enc_texto: 't', enc_nome: 'n' })) === JSON.stringify({ enc_item: '', enc_sub: '', enc_texto: '', enc_nome: '' }) &&
    JSON.stringify(E({ enc_item: 'rede_social', enc_sub: 'psiquiatra', enc_texto: 't', enc_nome: 'n' })) === JSON.stringify({ enc_item: 'rede_social', enc_sub: '', enc_texto: '', enc_nome: '' }) &&
    JSON.stringify(E({ enc_item: 'rede_social', enc_sub: 'outra', enc_texto: 'Kwai', enc_nome: 'n' })) === JSON.stringify({ enc_item: 'rede_social', enc_sub: 'outra', enc_texto: 'Kwai', enc_nome: '' }) &&
    JSON.stringify(E({ enc_item: 'plataforma', enc_texto: 'Uma plataforma', enc_nome: 'n' })) === JSON.stringify({ enc_item: 'plataforma', enc_sub: '', enc_texto: 'Uma plataforma', enc_nome: '' }) &&
    JSON.stringify(E({ enc_item: 'colega', enc_texto: 't', enc_nome: 'Fulano' })) === JSON.stringify({ enc_item: 'colega', enc_sub: '', enc_texto: '', enc_nome: 'Fulano' }));
  let c = lerPac(CARLA);
  ok('E3 o texto livre de antes do pacote aparece como "Outro" com aquele texto (nada se perde) e a leitura não devolve mais o campo antigo',
    c.enc_item === 'outro' && c.enc_sub === '' && c.enc_texto === 'Doctoralia' && c.enc_nome === '' && c.encaminhamento === undefined, c);
  let r = cadastro(CARLA, { valor: 30000, enc_item: 'rede_social', enc_sub: 'instagram', enc_texto: 'sobra', enc_nome: 'sobra' });
  c = lerPac(CARLA);
  ok('E4 gravar rede social + Instagram: item e subitem ficam; texto e nome, que não cabem, saem; o texto antigo não volta',
    r.ok === true && c.enc_item === 'rede_social' && c.enc_sub === 'instagram' && c.enc_texto === '' && c.enc_nome === '' && r.paciente.cadastro.enc_sub === 'instagram', c);
  cadastro(ANA, { valor: 30000, modo: 'mensal', quando: 'f3', enc_item: 'medico', enc_sub: 'outra', enc_texto: 'Geriatra', enc_nome: '' });
  c = lerPac(ANA);
  ok('E5 médico + outra especialidade com texto; o nome pode ficar em branco', c.enc_item === 'medico' && c.enc_sub === 'outra' && c.enc_texto === 'Geriatra' && c.enc_nome === '', c);
  cadastro(ANA, { valor: 30000, modo: 'mensal', quando: 'f3', enc_item: 'medico', enc_sub: 'psiquiatra', enc_texto: 'Geriatra', enc_nome: 'Dra. Nome de Teste' });
  c = lerPac(ANA);
  ok('E6 o nome entra depois; trocar para psiquiatra tira o texto do "outra"', c.enc_sub === 'psiquiatra' && c.enc_texto === '' && c.enc_nome === 'Dra. Nome de Teste', c);
  cadastro(DIEGO, { valor: 28000, modo: 'n', n: '2', enc_item: 'rede_social', enc_sub: 'tiktok' });
  cadastro(ELISA, { enc_item: 'rede_social' });
  cadastro(FABIO, { enc_item: 'busca' });
  cadastro(GUI, { encaminhamento: 'Texto de página antiga' }); // página aberta de antes do pacote: manda só o campo antigo
  c = lerPac(GUI);
  ok('E7 quem ainda manda só o campo antigo grava como antes e aparece como "Outro" + texto', c.enc_item === 'outro' && c.enc_texto === 'Texto de página antiga', c);
  prof('profDesativarPaciente', { siglaPaciente: FABIO });
  const enc = fin().financeiro.resumo.encaminhamento, de = k => enc.filter(e => e.item === k)[0] || { n: 0, subs: [] };
  ok('E8 o resumo conta por item, do maior para o menor, e por subitem dentro do item',
    enc[0].item === 'rede_social' && enc[0].n === 3 && JSON.stringify(enc[0].subs) === JSON.stringify([{ sub: 'instagram', n: 1 }, { sub: 'tiktok', n: 1 }]) &&
    de('medico').n === 1 && JSON.stringify(de('medico').subs) === JSON.stringify([{ sub: 'psiquiatra', n: 1 }]) && de('outro').n === 1 && de('outro').subs.length === 0, enc);
  ok('E9 o paciente desativado continua na conta (de onde vieram os pacientes, ativos ou não)', de('busca').n === 1, enc);
  ok('E10 o resumo não leva nome de quem indicou nem texto digitado', JSON.stringify(enc).indexOf('Nome de Teste') === -1 && JSON.stringify(enc).indexOf('antiga') === -1);
  cadastro(GUI, { enc_item: '' });
  c = lerPac(GUI);
  ok('E11 voltar para "Selecione" limpa o encaminhamento (o texto antigo não reaparece) e ele sai da conta', c.enc_item === '' && c.enc_texto === '' &&
    !fin().financeiro.resumo.encaminhamento.some(e => e.item === 'outro'), c);
});

/* ---------------------------------------------------------------- X19 (Pacote 19.6) */
console.log('X19. Editar e excluir paciente');
tenta('X19', () => {
  const conta = (nomeAba, col, sig) => { const a = aba(nomeAba); if (!a) return 0; const v = a.getDataRange().getDisplayValues(), i = v[0].indexOf(col); return v.slice(1).filter(l => String(l[i]).toUpperCase() === sig).length; };
  const cel = (sig, col) => h.celula(h.abaPac, h.linhaDe(h.abaPac, 'sigla', sig), col);
  const editar = (sig, dados) => prof('profEditarPaciente', Object.assign({ siglaPaciente: sig }, dados ? { dados: dados, id_envio: uuid() } : {}));
  const noIndice = sig => { h.memo(); return S('_lerIndice_')().linhas.filter(l => l.tipo === 'paciente' && l.sigla === sig)[0]; };
  // ---- editar ----
  let r = editar(CARLA);
  ok('X1 sem dados a ação só lê: nome, e-mail, telefone e CPF do cadastro', r.ok === true && r.cadastro.nome === 'Carla Nogueira' && r.cadastro.email === 'carla@exemplo.test' && r.cadastro.cpf === '' && r.cadastro.tem_anamnese === false, r);
  r = editar(CARLA, { nome: '  Carla   Nogueira Prado ', email: 'carla@exemplo.test', telefone: '(11) 98888-7777', cpf: CPF_OK });
  ok('X2 gravar nome, telefone e CPF: a resposta e a planilha trazem o que ficou (CPF só com os dígitos, como texto)', r.ok === true && r.email_mudou === false && r.convite === undefined &&
    r.cadastro.nome === 'Carla Nogueira Prado' && r.cadastro.telefone === '11988887777' && r.cadastro.cpf === '52998224725' &&
    String(cel(CARLA, 'nome')) === 'Carla Nogueira Prado' && String(cel(CARLA, 'cpf')) === '52998224725' && String(cel(CARLA, 'telefone')).replace(/\D/g, '') === '11988887777', [r, cel(CARLA, 'cpf')]);
  ok('X3 a leitura seguinte e o Fluxo de caixa mostram o nome novo', editar(CARLA).cadastro.nome === 'Carla Nogueira Prado' && doPac(fin().financeiro, CARLA).nome === 'Carla Nogueira Prado');
  ok('X4 recusas: nome vazio, e-mail vazio, e-mail inválido, CPF que não confere, CPF com tamanho errado, e-mail de outro paciente do mesmo profissional',
    editar(CARLA, { nome: ' ', email: 'carla@exemplo.test', telefone: '', cpf: '' }).ok === false && editar(CARLA, { nome: 'Carla', email: '', telefone: '', cpf: '' }).ok === false &&
    editar(CARLA, { nome: 'Carla', email: 'nao-e-email', telefone: '', cpf: '' }).ok === false && editar(CARLA, { nome: 'Carla', email: 'carla@exemplo.test', telefone: '', cpf: '529.982.247-26' }).ok === false &&
    editar(CARLA, { nome: 'Carla', email: 'carla@exemplo.test', telefone: '', cpf: CNPJ_OK }).ok === false && editar(CARLA, { nome: 'Carla', email: 'diego@exemplo.test', telefone: '', cpf: '' }).ok === false &&
    String(cel(CARLA, 'nome')) === 'Carla Nogueira Prado' && noIndice(CARLA).email === 'carla@exemplo.test');
  r = editar(CARLA, { nome: 'Carla Nogueira Prado', email: 'Carla.Nova@Exemplo.test', telefone: '(11) 98888-7777', cpf: CPF_OK, enviar_convite: true });
  ok('X5 trocar o e-mail: grava no cadastro e no índice (é o login), avisa que mudou e manda o convite quando pedido', r.ok === true && r.email_mudou === true && r.cadastro.email === 'carla.nova@exemplo.test' &&
    String(cel(CARLA, 'email')) === 'carla.nova@exemplo.test' && noIndice(CARLA).email === 'carla.nova@exemplo.test' && !!r.convite && r.convite.enviado === true, r);
  r = editar(CARLA, { nome: 'Carla Nogueira Prado', email: 'carla.nova2@exemplo.test', telefone: '', cpf: '' });
  ok('X6 trocar o e-mail sem pedir convite não envia nada; CPF e telefone em branco apagam o que havia', r.ok === true && r.email_mudou === true && r.convite === undefined && String(cel(CARLA, 'cpf')) === '' && r.cadastro.telefone === '');
  ok('X7 só o profissional dono edita: crachá de paciente, sem crachá e paciente que não existe são recusados', pac(CARLA, 'profEditarPaciente', { siglaPaciente: CARLA, dados: { nome: 'X', email: 'x@exemplo.test' } }).ok === false &&
    h.post({ acao: 'profEditarPaciente', siglaPaciente: CARLA, dados: { nome: 'X', email: 'x@exemplo.test' } }).ok === false && editar('ZZZ', { nome: 'X', email: 'x@exemplo.test' }).ok === false && String(cel(CARLA, 'nome')) === 'Carla Nogueira Prado');
  const falsaAnam = { getLastRow: () => 2, getLastColumn: () => 3, getRange: () => ({ getValues: () => [['nome_completo', 'cpf', 'outra']], getDisplayValues: () => [['Nome da Anamnese', '529.982.247-25', '']] }) };
  const juntos = S('_cadastroDoPaciente_')({ nome: 'Nome do Cadastro', email: 'A@B.test', telefone: '11 99999-0000', cpf: '' }, falsaAnam);
  ok('X8 com anamnese preenchida, o nome e o CPF dela são os que a janela mostra (é um dado só)', juntos.tem_anamnese === true && juntos.nome === 'Nome da Anamnese' && juntos.cpf === '52998224725' && juntos.email === 'a@b.test');
  // ---- excluir ----
  const D = S('DriveApp'), pegar = D.getFileById; D.getFileById = function (id) { let o; try { o = pegar.call(D, id); } catch (e) { o = null; } o = o || {}; if (!o.setTrashed) o.setTrashed = function () { return o; }; return o; };
  const resumo = () => { const f = prof('profLerFinanceiro', { periodo: 'personalizado', de: '2026-09-01', ate: '2026-12-31' }).financeiro; return { entrada: f.resumo.recebido_entrada, pago: f.sessoes.filter(x => x.cobravel).reduce((a, x) => a + x.pago, 0), f: f }; };
  const linhasAna = () => ({ sessoes: conta('Sessoes', 'sigla', ANA), cadastro: conta('Fin_Cadastro', 'id', ANA), cobrancas: conta('Fin_Cobrancas', 'sigla', ANA), pagamentos: conta('Fin_Pagamentos', 'sigla', ANA), recibos: conta('Fin_Recibos', 'sigla', ANA), lembretes: conta('Lembretes', 'sigla', ANA) });
  const nomeAna = String(cel(ANA, 'nome')), antes = linhasAna(), resAntes = resumo();
  r = prof('profExcluirPaciente', { siglaPaciente: ANA, simular: true });
  const sim = r.simulacao || { ficam: {} };
  ok('X9 simular diz o que sai e o que fica e não apaga nada', r.ok === true && sim.nome === nomeAna && sim.ficam.pagamentos === antes.pagamentos && sim.ficam.recibos === antes.recibos && sim.ficam.sessoes > 0 &&
    sim.sessoes_saem + sim.ficam.sessoes === antes.sessoes && sim.fica_algo === true && JSON.stringify(linhasAna()) === JSON.stringify(antes) && !!cel(ANA, 'nome'), [sim, antes]);
  ok('X10 sem a confirmação a exclusão é recusada', prof('profExcluirPaciente', { siglaPaciente: ANA }).ok === false && prof('profExcluirPaciente', { siglaPaciente: ANA, confirmacaoSigla: 'outra' }).ok === false && JSON.stringify(linhasAna()) === JSON.stringify(antes));
  r = prof('profExcluirPaciente', { siglaPaciente: ANA, confirmacaoSigla: true });
  const depois = linhasAna(), resDepois = resumo();
  ok('X11 a lixeira vale para paciente ativo, direto (sem desativar antes e sem digitar a sigla)', r.ok === true && r.ficou === true && r.nome === nomeAna && h.linhaDe(h.abaPac, 'sigla', ANA) === 0 && !noIndice(ANA), r);
  ok('X12 saem as sessões sem cobrança e as cobranças; ficam as sessões cobradas ou pagas, os pagamentos, os recibos e o modo de cobrança que dizia o que era cobrável',
    depois.sessoes === sim.ficam.sessoes && depois.cadastro === 1 && depois.cobrancas === 0 && depois.pagamentos === antes.pagamentos && depois.recibos === antes.recibos, [antes, depois, sim]);
  ok('X13 o dinheiro continua batendo: o recebido pela data de entrada e o pago nas sessões são os mesmos de antes da exclusão', resDepois.entrada === resAntes.entrada && resDepois.pago === resAntes.pago, [resAntes.entrada, resDepois.entrada, resAntes.pago, resDepois.pago]);
  h.memo();
  const mapa = S('_agePacientes_')(h.ctrl), doExcluido = mapa[ANA] || {};
  ok('X14 o nome fica guardado e aparece marcado como excluído, sem e-mail e sem telefone', doExcluido.nome === nomeAna + ' (excluído)' && doExcluido.excluido === true && doExcluido.email === '' && doExcluido.telefone === '' && doExcluido.ativo === false &&
    conta('Excluidos', 'id', ANA) === 1 && resDepois.f.sessoes.filter(x => x.sigla === ANA).length === sim.ficam.sessoes, doExcluido);
  ok('X15 nada mais se faz com o excluído: abrir, editar, agendar e excluir de novo são recusados', prof('profLerDadosPaciente', { siglaPaciente: ANA }).ok === false && editar(ANA).ok === false &&
    prof('profExcluirPaciente', { siglaPaciente: ANA, confirmacaoSigla: true }).ok === false && prof('profEnviarConvite', { siglaPaciente: ANA, canal: 'link' }).ok === false);
  const homonimo = novo(nomeAna, 'homonimo@exemplo.test');
  const fNovo = prof('profLerFinanceiro', { siglaPaciente: homonimo }).paciente;
  ok('X16 um paciente novo com o mesmo nome recebe outra sigla e não herda sessão, pagamento nem recibo', homonimo !== ANA && fNovo.extrato.length === 0 && fNovo.credito === 0 &&
    conta('Fin_Pagamentos', 'sigla', homonimo) === 0 && conta('Fin_Recibos', 'sigla', homonimo) === 0, [homonimo === ANA, fNovo.extrato.length]);
  // quem não deixou dinheiro sai inteiro e a sigla volta a ficar livre
  const semDinheiro = novo('Zuleica Sem Nada', 'zuleica@exemplo.test');
  const simZ = prof('profExcluirPaciente', { siglaPaciente: semDinheiro, simular: true }).simulacao;
  r = prof('profExcluirPaciente', { siglaPaciente: semDinheiro, confirmacaoSigla: true });
  ok('X17 paciente sem nada no Fluxo de caixa sai inteiro: nada fica guardado e a sigla volta a ficar livre', simZ.fica_algo === false && r.ok === true && r.ficou === false && conta('Excluidos', 'id', semDinheiro) === 0 && novo('Zuleica Sem Nada', 'zuleica2@exemplo.test') === semDinheiro, [simZ, r]);
  ok('X18 nenhum CPF foi para o log do servidor', logServidor.join(' ').indexOf('52998224725') === -1);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('X19 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

/* ---------------------------------------------------------------- Y19 (Pacote 19.7) */
console.log('Y19. Blocos do Início depois da lista');
tenta('Y19', () => {
  const hoje = S('_lemAgora_')().data, dia = n => S('_lemIso_')(S('_lemDia_')(hoje) + n);
  const rL = prof('profSalvarLembrete', { siglaPaciente: CARLA, dados: { id: uuid(), tipo: 'auto', recorrencia: 'recorrente', periodicidade: 'diaria', data_inicio: hoje, hora: '09:00' } });
  let alvo = ''; for (let k = 9; k < 16 && !alvo; k++) { const p = dia(k).split('-'), ds = new Real(+p[0], +p[1] - 1, +p[2]).getDay(); if (ds >= 1 && ds <= 5) alvo = dia(k); }
  const rP = pac(BRUNO, 'pacienteAgendarSessao', { dados: { id: uuid(), data: alvo, hora: '19:00', modalidade: 'presencial' } });
  ok('Y1 o cenário tem um lembrete de hoje e um pedido pendente', rL.ok === true && rP.ok === true, [rL.erro, rP.erro, alvo]);
  const cheia = prof('profListarPacientes'), enxuta = prof('profListarPacientes', { enxuta: true }), ini = prof('profLerFinanceiro', { so: 'inicio', por_paciente: true }), velho = prof('profLerFinanceiro', { so: 'inicio' });
  const blocos = p => JSON.stringify([p.lembretes || [], p.pedidos_agenda || [], p.eventos_agenda || [], (p.lembretes || []).length ? [p.telefone, p.tem_email] : []]);
  const comLem = cheia.pacientes.filter(p => (p.lembretes || []).length).length, comPed = cheia.pacientes.filter(p => (p.pedidos_agenda || []).length).length;
  ok('Y2 sem o parâmetro, a lista continua levando lembretes e pedidos (página antiga aberta num aparelho não quebra)', cheia.ok === true && comLem >= 1 && comPed >= 1, [comLem, comPed]);
  ok('Y3 a lista enxuta não leva lembrete, pedido, evento nem o contato dos botões', enxuta.ok === true && enxuta.pacientes.length === cheia.pacientes.length &&
    enxuta.pacientes.every(p => (p.lembretes || []).length === 0 && p.pedidos_agenda === undefined && p.eventos_agenda === undefined && p.telefone === undefined && p.tem_email === undefined));
  const semBlocos = p => { const o = Object.assign({}, p); ['lembretes', 'pedidos_agenda', 'eventos_agenda', 'telefone', 'tem_email'].forEach(k => delete o[k]); return JSON.stringify(o); };
  ok('Y4 fora os blocos, a lista enxuta é igual à de antes, paciente a paciente', cheia.pacientes.every((p, i) => semBlocos(p) === semBlocos(enxuta.pacientes[i])));
  const junta = enxuta.pacientes.map(p => Object.assign({}, p, { lembretes: [] }, (ini.por_paciente || {})[String(p.sigla).trim().toUpperCase()] || {}));
  ok('Y5 lista enxuta + blocos da segunda leitura = a lista de antes, bloco a bloco', ini.ok === true && !!ini.por_paciente && cheia.pacientes.every((p, i) => blocos(p) === blocos(junta[i])),
    cheia.pacientes.map((p, i) => blocos(p) === blocos(junta[i])));
  ok('Y6 os blocos do financeiro vêm iguais com e sem o pedido novo; sem o parâmetro não vem nada por paciente', JSON.stringify(ini.inicio) === JSON.stringify(velho.inicio) && velho.por_paciente === undefined);
  ok('Y7 só entram pacientes deste profissional; o excluído que deixou dinheiro fica de fora', Object.keys(ini.por_paciente || {}).every(sig => enxuta.pacientes.some(p => String(p.sigla).toUpperCase() === sig)) && (ini.por_paciente || {})[ANA] === undefined);
  ok('Y8 crachá de paciente não lê os blocos; sem crachá, recusado', pac(BRUNO, 'profLerFinanceiro', { so: 'inicio', por_paciente: true }).ok === false && h.post({ acao: 'profLerFinanceiro', so: 'inicio', por_paciente: true }).ok === false);
  const inesperados = logServidor.filter(l => !/^trava de gravacao: nao obtida/.test(l));
  ok('Y9 o servidor não registrou nenhum erro', inesperados.length === 0, inesperados.slice(0, 5));
});

console.log('\nRESULTADO (' + process.env.VMC_FUSO_20 + '): ' + (falhas ? falhas + ' FALHA(S) em ' + passo + ' provas' : 'OK — ' + passo + '/' + passo + ' provas'));
process.exit(falhas ? 1 : 0);
