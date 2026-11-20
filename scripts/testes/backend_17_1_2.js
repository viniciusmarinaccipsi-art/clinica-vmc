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
  ['bdi2', 'bai', 'bhs', 'bsi'].forEach(function (ins) {
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
ok('A1 paciente sem liberação: bdi2, bai e bhs (sem bsi)', JSON.stringify(G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'ABC' }).liberados")) === JSON.stringify(['bdi2', 'bai', 'bhs']), G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'ABC' })"));
ok('A2 paciente com a BSS liberada: os quatro', JSON.stringify(G("lerItensInstrumento({}, { tipo: 'paciente', sigla: 'DEF' }).liberados")) === JSON.stringify(['bdi2', 'bai', 'bhs', 'bsi']));
ok('A3 profissional: os quatro, sempre', JSON.stringify(G("lerItensInstrumento({}, { tipo: 'profissional', sigla: 'VMC' }).liberados")) === JSON.stringify(['bdi2', 'bai', 'bhs', 'bsi']));
ok('A4 admin ou sem crachá: recusa', G("lerItensInstrumento({}, { tipo: 'admin' }).ok") === false && G("lerItensInstrumento({}, null).ok") === false);

console.log('B. lerItensInstrumento — textos de um instrumento');
ok('B1 paciente sem liberação pede bsi: recusa, motivo nao_liberado_paciente', G("JSON.stringify(lerItensInstrumento({ instrumento: 'bsi' }, { tipo: 'paciente', sigla: 'ABC' }))") === JSON.stringify({ ok: false, erro: 'Instrumento nao liberado', motivo: 'nao_liberado_paciente' }));
ok('B2 paciente com liberação pede bsi: recebe os textos', G("lerItensInstrumento({ instrumento: 'bsi' }, { tipo: 'paciente', sigla: 'DEF' }).textos.instrucao") === 'Instrucao de teste bsi');
ok('B3 paciente sem liberação pede bhs: recebe (não é só do profissional)', G("lerItensInstrumento({ instrumento: 'bhs' }, { tipo: 'paciente', sigla: 'ABC' }).ok") === true);
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
ok('C4 instrumento que não é só do profissional (bhs): recusa', G("profLiberarEscala(" + S + ", 'ABC', 'bhs', true).ok") === false);
ok('C5 paciente de outro profissional: recusa', G("profLiberarEscala(" + S + ", 'XYZ', 'bsi', true).ok") === false);
ok('C6 crachá de paciente: recusa', G("profLiberarEscala({ tipo: 'paciente', sigla: 'ABC' }, 'ABC', 'bsi', true).ok") === false);
ok('C7 a ação está na trava de gravação e na lista do roteador', G("ACOES_COM_TRAVA.indexOf('profLiberarEscala') !== -1") && /case 'profLiberarEscala'/.test(fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8')));

console.log('D. lista normalizada');
ok('D1 " BSI, x ,," → ["bsi","x"]', JSON.stringify(G("_escalasLiberadasLista_(' BSI, x ,,')")) === JSON.stringify(['bsi', 'x']) && JSON.stringify(G("_escalasLiberadasLista_(undefined)")) === '[]');

console.log('\nRESULTADO: ' + (falhas === 0 ? 'OK — ' + total + '/' + total + ' provas' : falhas + ' FALHA(S) em ' + total + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
