/* Pacote 17.1.2 — BSS liberada por paciente: testes em Node do Código.js REAL (lerItensInstrumento com a
   sessão de paciente e de profissional; profLiberarEscala). Planilha trocada por listas em memória; a aba
   Itens_Instrumentos de teste tem conteúdo INVENTADO e a linha de controle com o hash real das funções.
   Uso: node scripts/testes/backend_17_1_2.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const sign = b => Array.from(b).map(x => (x > 127 ? x - 256 : x));
const ctx = {
  console: { error: () => {}, log: () => {}, warn: () => {} }, JSON, Math, Date, String, Object, Array, parseInt, isNaN,
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
    computeDigest: (_a, t) => sign(crypto.createHash('sha256').update(String(t), 'utf8').digest()),
    computeHmacSha256Signature: (m, k) => sign(crypto.createHmac('sha256', String(k)).update(String(m), 'utf8').digest()),
    base64EncodeWebSafe: d => (typeof d === 'string' ? Buffer.from(d, 'utf8') : Buffer.from(d.map(x => (x < 0 ? x + 256 : x)))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    base64DecodeWebSafe: s => sign(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
    newBlob: b => ({ getDataAsString: () => Buffer.from(b.map(x => (x < 0 ? x + 256 : x))).toString('utf8') }),
    formatDate: d => d.toISOString(), getUuid: () => crypto.randomUUID(), sleep: () => {}
  },
  CacheService: { getScriptCache: () => ({ get: () => null, getAll: () => ({}), put: () => {}, remove: () => {}, removeAll: () => {} }) },
  SpreadsheetApp: { flush: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8'), ctx, { filename: 'Código.js' });
const G = code => vm.runInContext(code, ctx);

let total = 0, falhas = 0;
const ok = (n, c, x) => { total++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 300) : '')); } };

/* ---- aba Itens_Instrumentos de teste: 1 linha de conteúdo por instrumento + controle com o hash real ---- */
G(`
  var __LINHAS = [];
  ['bdi2', 'bai', 'bhs', 'bsi', 'urica_alcool', 'urica_drogas', 'urica_tabaco', 'urica_alimentar', 'pcl5', 'pswq', 'ear', 'aaq2', 'swls', 'maas', 'wbsi', 'panas', 'spin', 'ocir', 'asrs', 'scs', 'audit', 'ftnd', 'gsas', 'eaad', 'estud', 'dudit', 'sast', 'epm', 'piuq', 'saslv'].forEach(function (ins) { // 17.2: + URICA; 17.3: + lote A
    var conteudo = [{ instrumento: ins, tipo: 'instrucao', item: '', opcao: '', texto: 'Instrucao de teste ' + ins, ativo: '' },
                    { instrumento: ins, tipo: 'item', item: 1, opcao: '', texto: 'Item de teste 1 ' + ins, ativo: '' }];
    __LINHAS = __LINHAS.concat(conteudo, [{ instrumento: ins, tipo: 'controle', item: '', opcao: '', texto: _itensHashConteudo_(conteudo), ativo: 'SIM' }]);
  });
  var __PAC = { ABC: { sigla: 'ABC', escalas_liberadas: '' }, DEF: { sigla: 'DEF', escalas_liberadas: 'bsi' } };
  _abrirPlanilha_ = function () { return {}; };
  lerAbaComoObjetos = function () { return __LINHAS; };
  buscarPaciente = function (sigla) { return __PAC[String(sigla).toUpperCase()] || null; };
`);

console.log('A. lerItensInstrumento — lista de liberados');
const TODOS = ['bdi2', 'bai', 'bhs', 'bsi', 'urica_alcool', 'urica_drogas', 'urica_tabaco', 'urica_alimentar', 'pcl5', 'pswq', 'ear', 'aaq2', 'swls', 'maas', 'wbsi', 'panas', 'spin', 'ocir', 'asrs', 'scs', 'audit', 'ftnd', 'gsas', 'eaad', 'estud', 'dudit', 'sast', 'epm', 'piuq', 'saslv']; // 17.2; 17.3: + lote A
ok('A1 (17.3.1) paciente sem liberação: nenhuma escala — toda escala é por liberação', JSON.stringify(G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'ABC' }).liberados")) === JSON.stringify([]), G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'ABC' })"));
ok('A2 paciente com a BSS liberada: só bsi', JSON.stringify(G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'DEF' }).liberados")) === JSON.stringify(['bsi']));
ok('A2b (17.3.1) paciente com phq9, bdi2 e um id inválido em escalas_liberadas: phq9 (sem aba) e bdi2 (aba liberada); o inválido cai', (() => { G("__PAC.MNO = { sigla: 'MNO', escalas_liberadas: 'phq9, bdi2, xyz' }"); return JSON.stringify(G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'MNO' }).liberados")) === JSON.stringify(['phq9', 'bdi2']); })(), G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'MNO' })"));
ok('A2c (17.3.1) instrumento da aba liberado para o paciente mas desligado na aba (controle NAO): não entra', (() => { G("__LINHAS.forEach(function (l) { if (l.instrumento === 'bhs' && l.tipo === 'controle') l.ativo = 'NAO'; }); __PAC.PQR = { sigla: 'PQR', escalas_liberadas: 'bhs,gad7' }"); const r = JSON.stringify(G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'PQR' }).liberados")); G("__LINHAS.forEach(function (l) { if (l.instrumento === 'bhs' && l.tipo === 'controle') l.ativo = 'SIM'; })"); return r === JSON.stringify(['gad7']); })());
ok('A3 profissional: os quinze, sempre', JSON.stringify(G("lerItensInstrumento({}, { tipo: 'profissional', sigla: 'VMC' }).liberados")) === JSON.stringify(TODOS));
ok('A5 (17.2) paciente com a URICA-Álcool liberada: a URICA entra, as outras três não', (() => { G("__PAC.GHI = { sigla: 'GHI', escalas_liberadas: 'urica_alcool' }"); return JSON.stringify(G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'GHI' }).liberados")) === JSON.stringify(['urica_alcool']); })(), G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'GHI' })"));
ok('A6 (17.3) paciente com a PSWQ liberada: a PSWQ entra, as outras seis do lote A não', (() => { G("__PAC.JKL = { sigla: 'JKL', escalas_liberadas: 'pswq' }"); return JSON.stringify(G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'JKL' }).liberados")) === JSON.stringify(['pswq']); })(), G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'JKL' })"));
ok('A4 admin ou sem crachá: recusa', G("lerItensInstrumento({}, { tipo: 'admin' }).ok") === false && G("lerItensInstrumento({}, null).ok") === false);

console.log('B. lerItensInstrumento — textos de um instrumento');
ok('B1 paciente sem liberação pede bsi: recusa, motivo nao_liberado_paciente', G("JSON.stringify(lerItensInstrumento({ instrumento: 'bsi' }, { tipo: 'paciente', sigla: 'ABC' }))") === JSON.stringify({ ok: false, erro: 'Instrumento nao liberado', motivo: 'nao_liberado_paciente' }));
ok('B2 paciente com liberação pede bsi: recebe os textos', G("lerItensInstrumento({ instrumento: 'bsi' }, { tipo: 'paciente', sigla: 'DEF' }).textos.instrucao") === 'Instrucao de teste bsi');
ok('B3 (17.3.1) paciente sem liberação pede bhs: recusa (toda escala é por liberação)', G("JSON.stringify(lerItensInstrumento({ instrumento: 'bhs' }, { tipo: 'paciente', sigla: 'ABC' }))") === JSON.stringify({ ok: false, erro: 'Instrumento nao liberado', motivo: 'nao_liberado_paciente' }));
ok('B3b paciente com bhs liberada pede bhs: recebe', G("lerItensInstrumento({ instrumento: 'bhs' }, { tipo: 'paciente', sigla: 'PQR' }).ok") === true);
ok('B4 profissional pede bsi: recebe', G("lerItensInstrumento({ instrumento: 'bsi' }, { tipo: 'profissional', sigla: 'VMC' }).ok") === true);

console.log('C. profLiberarEscala — lista gravada na Controle');
G(`
  var __GRAVADO = null;
  _pacienteDoProfissional_ = function (s, sigla) { return (s && s.tipo === 'profissional' && __PAC[sigla]) ? { ok: true, profissionalId: 'P1', planilha: {} } : { ok: false, erro: 'Este paciente nao pertence a voce' }; };
  abrirControleDoProfissional = function () { return { getSheetByName: function () { return 'aba'; } }; };
  _atualizarLinhaPorChave_ = function (aba, chave, valor, campos) { __GRAVADO = { aba: aba, chave: chave, valor: valor, campos: campos }; return true; };
`);
const S = "{ tipo: 'profissional', sigla: 'VMC' }";
ok('C1 liberar bsi para ABC: lista ["bsi"], gravada em escalas_liberadas pela sigla', G("JSON.stringify(profLiberarEscala(" + S + ", 'ABC', 'bsi', true))") === JSON.stringify({ ok: true, escalas_liberadas: ['bsi'] }) && G("JSON.stringify(__GRAVADO)") === JSON.stringify({ aba: 'aba', chave: 'sigla', valor: 'ABC', campos: { escalas_liberadas: 'bsi' } }), G("__GRAVADO"));
ok('C2 retirar bsi de DEF: lista vazia gravada como texto vazio', G("JSON.stringify(profLiberarEscala(" + S + ", 'DEF', 'bsi', false))") === JSON.stringify({ ok: true, escalas_liberadas: [] }) && G("__GRAVADO.campos.escalas_liberadas") === '');
ok('C3 liberar de novo para DEF não duplica', G("JSON.stringify(profLiberarEscala(" + S + ", 'DEF', 'BSI', 'true').escalas_liberadas)") === JSON.stringify(['bsi']));
ok('C4 (17.3.1) qualquer das 20 é aceita (bhs, phq9); id desconhecido (xyz) recusa', G("profLiberarEscala(" + S + ", 'ABC', 'bhs', true).ok") === true && JSON.stringify(G("profLiberarEscala(" + S + ", 'ABC', 'PHQ9', true).escalas_liberadas")) === JSON.stringify(['phq9']) && G("profLiberarEscala(" + S + ", 'ABC', 'xyz', true).ok") === false);
ok('C4b ESCALAS_MENU tem 35 códigos e INSTRUMENTOS_SO_PROFISSIONAL os 35 ids; _idDaEscala_ traduz código → id', G("Object.keys(ESCALAS_MENU).length") === 35 && G("INSTRUMENTOS_SO_PROFISSIONAL.length") === 35 && G("_idDaEscala_('URICA-HA')") === 'urica_alimentar' && G("_idDaEscala_('XYZ')") === '');
ok('C5 paciente de outro profissional: recusa', G("profLiberarEscala(" + S + ", 'XYZ', 'bsi', true).ok") === false);
ok('C6 crachá de paciente: recusa', G("profLiberarEscala({ tipo: 'paciente', sigla: 'ABC' }, 'ABC', 'bsi', true).ok") === false);
ok('C7 a ação está na trava de gravação e na lista do roteador', G("ACOES_COM_TRAVA.indexOf('profLiberarEscala') !== -1") && /case 'profLiberarEscala'/.test(fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8')));

console.log('E. 17.3.1 — abertura ao aplicar e migração das liberações');
G(`
  __PAC.ABC.escalas_liberadas = '';
  __GRAVADO = null;
`);
ok('E1 _abrirEscalaParaPaciente_: PHQ-9 aplicado pelo profissional abre phq9 para ABC (grava a lista)', JSON.stringify(G("_abrirEscalaParaPaciente_('P1', 'ABC', 'PHQ-9')")) === JSON.stringify(['phq9']) && G("__GRAVADO && __GRAVADO.campos.escalas_liberadas") === 'phq9', G("__GRAVADO"));
ok('E2 já aberta (DEF tem bsi): não regrava', (() => { G("__GRAVADO = null"); return JSON.stringify(G("_abrirEscalaParaPaciente_('P1', 'DEF', 'BSS')")) === JSON.stringify(['bsi']) && G("__GRAVADO") === null; })());
ok('E3 código desconhecido: lista intacta, nada gravado', JSON.stringify(G("_abrirEscalaParaPaciente_('P1', 'DEF', 'XYZ')")) === JSON.stringify(['bsi']) && G("__GRAVADO") === null);
// A migração única `rodarMigracaoLiberacoes` (17.3.1) foi provada aqui sobre planilhas simuladas no commit 4fe6f15,
// rodou no servidor em 20/11/2026 (29 pacientes, 8 alterados) e saiu do Código.js no fechamento — as provas foram com ela.

console.log('D. lista normalizada');
ok('D1 " BSI, x ,," → ["bsi","x"]', JSON.stringify(G("_escalasLiberadasLista_(' BSI, x ,,')")) === JSON.stringify(['bsi', 'x']) && JSON.stringify(G("_escalasLiberadasLista_(undefined)")) === '[]');

console.log('\nRESULTADO: ' + (falhas === 0 ? 'OK — ' + total + '/' + total + ' provas' : falhas + ' FALHA(S) em ' + total + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
