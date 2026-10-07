/* Pacote 18.2 — Células seguras: testes em Node do Código.js REAL sobre planilhas
   simuladas (mesma base dos mocks do 18.1.3/18.1.6). O mock imita o que o experimento
   de 03/10 mediu no Sheets real: apóstrofo inicial é consumido e força texto; string
   crua que começa com = + - @ vira "fórmula" (marcada aqui como {formula}).
   Blocos: T trava pura · G cada gravação da decisão 2 com valor perigoso, lida de volta ·
   A aceite sem apóstrofo duplicado · F formato @ nos caminhos de criação · B bootstrap fora.
   Uso: node PACOTE_18_2_node.js  (sem 'use strict': o eval precisa vazar declarações) */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sign = b => Array.from(b).map(x => (x > 127 ? x - 256 : x));
global.Utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
  computeDigest: (_a, t) => sign(crypto.createHash('sha256').update(String(t), 'utf8').digest()),
  computeHmacSha256Signature: (m, k) => sign(crypto.createHmac('sha256', String(k)).update(String(m), 'utf8').digest()),
  formatDate: (d, _tz, fmt) => {
    const p = n => String(n).padStart(2, '0');
    if (fmt === 'yyyy-MM-dd') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    if (fmt === 'yyyy-MM-dd HH:mm:ss') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    if (fmt === 'HH:mm') return p(d.getHours()) + ':' + p(d.getMinutes());
    return d.toISOString();
  },
  getUuid: () => crypto.randomUUID(), sleep: () => {},
  base64EncodeWebSafe: d => (typeof d === 'string' ? Buffer.from(d, 'utf8') : Buffer.from(d.map(x => (x < 0 ? x + 256 : x)))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
  base64DecodeWebSafe: s => sign(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
  newBlob: b => ({ getDataAsString: () => Buffer.from(b.map(x => (x < 0 ? x + 256 : x))).toString('utf8') })
};

/* Célula como o Sheets a trata (medido em 03/10 por exp18_2): */
const FORMULA = v => ({ formula: v });
function comoSheets(v, formato) {
  if (typeof v !== 'string') return v;
  if (v.charAt(0) === "'") return v.slice(1);          // apóstrofo: texto literal, apóstrofo some
  if (/^[=]/.test(v)) return FORMULA(v);                // fórmula (mesmo em coluna @)
  if (/^[+\-@]/.test(v) && !/^[+-]?\d+([.,]\d+)?$/.test(v)) return FORMULA(v); // + - @ : fórmula/erro
  if (formato === '@') return v;                        // coluna de texto: não retipa
  // retipagem do Sheets em célula de formato geral (medida em 03/10)
  if (/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(v)) return new Date(v.replace(' ', 'T'));
  if (/^\d{4}-\d{2}$/.test(v)) return new Date(v + '-01T00:00:00');
  if (/^\d{1,2}[\/-]\d{1,2}$/.test(v)) return new Date(2026, parseInt(v, 10) - 1, parseInt(v.split(/[\/-]/)[1], 10));
  if (/^\d{1,2}:\d{2}$/.test(v)) return new Date(1899, 11, 30, parseInt(v, 10), parseInt(v.split(':')[1], 10));
  if (/^-?\d+([.]\d+)?$/.test(v)) return Number(v);
  return v;
}
class Range {
  constructor(s, r, c, nr, nc) { this.s = s; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const l = this.s.dados[this.r - 1 + i] || []; const row = []; for (let j = 0; j < this.nc; j++) row.push(l[this.c - 1 + j] !== undefined ? l[this.c - 1 + j] : ''); o.push(row); } return o; }
  getDisplayValues() { return this.getValues().map(l => l.map(v => (v && v.formula) ? '#ERROR!' : String(v))); }
  getValue() { return this.getValues()[0][0]; }
  setValues(v) { for (let i = 0; i < v.length; i++) for (let j = 0; j < v[i].length; j++) this._set(this.r + i, this.c + j, v[i][j]); return this; }
  setValue(v) { this._set(this.r, this.c, v); return this; }
  _set(r, c, v) { while (this.s.dados.length < r) this.s.dados.push([]); const l = this.s.dados[r - 1]; while (l.length < c) l.push(''); l[c - 1] = comoSheets(v, this.s.formatos[c]); }
  clearContent() { for (let i = 0; i < this.nr; i++) { const l = this.s.dados[this.r - 1 + i]; if (l) for (let j = 0; j < this.nc; j++) if (this.c - 1 + j < l.length) l[this.c - 1 + j] = ''; } while (this.s.dados.length > 1 && this.s.dados[this.s.dados.length - 1].every(x => x === '')) this.s.dados.pop(); return this; }
  setFontWeight() { return this; }
  setNumberFormat(f) { for (let j = 0; j < this.nc; j++) if (this.r === 1 && this.nr >= this.s.getMaxRows()) this.s.formatos[this.c + j] = f; return this; }
}
class Sheet {
  constructor(n, d) { this.nome = n; this.dados = d || [[]]; this.formatos = {}; }
  getName() { return this.nome; } setName(n) { this.nome = n; return this; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  getDataRange() { return new Range(this, 1, 1, Math.max(this.dados.length, 1), Math.max(this.getLastColumn(), 1)); }
  getLastColumn() { return this.dados.reduce((m, l) => Math.max(m, l.length), 0) || 1; }
  getLastRow() { return this.dados.length; }
  getMaxRows() { return 1000; }
  appendRow(v) { this.dados.push(v.map(x => comoSheets(x))); return this; } // appendRow ignora o formato @ da coluna (medido em 03/10)
  deleteRow(r) { this.dados.splice(r - 1, 1); return this; }
  setFrozenRows() { return this; }
}
class Workbook {
  constructor(id, n) { this.id = id; this.nome = n; this.abas = [new Sheet('Página1', [[]])]; }
  getId() { return this.id; } getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
  getSheets() { return this.abas; }
  getSheetByName(n) { return this.abas.find(a => a.nome === n) || null; }
  insertSheet(n) { const s = new Sheet(n, [[]]); this.abas.push(s); return s; }
}
const WORKBOOKS = {}, FOLDERS = {}; let seq = 0; const novoId = p => p + '-' + (++seq);
const pastaObj = id => { const f = FOLDERS[id]; if (!f) throw new Error('pasta inexistente: ' + id); return {
  getId: () => id,
  getFilesByName: n => { const a = f.files.filter(x => x.nome === n); let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; },
  getFoldersByName: n => { const s = f.subfolders[n]; let d = false; return { hasNext: () => !!s && !d, next: () => { d = true; return pastaObj(s); } }; },
  createFolder: n => { const nid = novoId('pasta'); FOLDERS[nid] = { files: [], subfolders: {} }; f.subfolders[n] = nid; return pastaObj(nid); }
}; };
const RAIZ = 'pasta-raiz'; FOLDERS[RAIZ] = { files: [], subfolders: {} };
global.SpreadsheetApp = { openById: id => { if (!WORKBOOKS[id]) throw new Error('planilha inexistente: ' + id); return WORKBOOKS[id]; }, create: n => { const w = new Workbook(novoId('wb'), n); WORKBOOKS[w.id] = w; return w; } };
global.DriveApp = {
  getFolderById: pastaObj,
  getFileById: id => ({ getId: () => id, getName: () => (WORKBOOKS[id] || {}).nome,
    moveTo: p => { if (p && p.getId && FOLDERS[p.getId()]) FOLDERS[p.getId()].files.push({ nome: WORKBOOKS[id].nome, getId: () => id }); },
    getParents: () => { let d = false; return { hasNext: () => !d, next: () => { d = true; return pastaObj(RAIZ); } }; } })
};
const CACHE = {}; global.CacheService = { getScriptCache: () => ({ get: k => (k in CACHE ? CACHE[k] : null), put: (k, v) => { CACHE[k] = String(v); }, remove: k => { delete CACHE[k]; } }) };
const PROPS = { SEGREDO_SESSAO: 'segredo-de-teste-' + crypto.randomUUID(), PIMENTA_SENHA: crypto.randomBytes(32).toString('hex') }; // 18.2.1
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in PROPS ? PROPS[k] : null), setProperty: (k, v) => { PROPS[k] = String(v); }, deleteProperty: k => { delete PROPS[k]; } }) };
global.LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
global.MailApp = { sendEmail: () => {} };
global.Logger = { log: () => {} };
global.ContentService = { MimeType: { JSON: 'JSON' }, createTextOutput: t => ({ setMimeType: () => ({ conteudo: t }) }) };
global.ScriptApp = { getService: () => ({ getUrl: () => 'https://script.local/exec' }), getProjectTriggers: () => [], newTrigger: () => ({}), deleteTrigger: () => {} };
global.Session = { getEffectiveUser: () => ({ getEmail: () => 'dono@exemplo.test' }) };
global.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{}' }) };

eval(fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8'));

/* ---- mundo ---- */
const sistema = new Workbook(SISTEMA_VMC_ID, 'Sistema_VMC'); WORKBOOKS[SISTEMA_VMC_ID] = sistema; sistema.abas = [];
const abaIndice = new Sheet(ABA_INDICE_SIGLAS, [['sigla_global', 'sigla', 'tipo', 'profissional_id', 'data_cadastro', 'email']]);
const abaProfs = new Sheet(ABA_PROFISSIONAIS, [['profissional_id', 'sigla', 'nome_completo', 'email', 'telefone', 'crp', 'data_inicio', 'ativo', 'senha_hash', 'pasta_drive_id', 'data_cadastro']]);
const abaAdmins = new Sheet(ABA_ADMINS, [['admin_id', 'sigla', 'nome_completo', 'email', 'ativo', 'senha_hash']]);
sistema.abas.push(abaIndice, abaProfs, abaAdmins); // Tokens nasce pelo código (_abaTokens_)
const pastaProfId = novoId('pasta'), pastaPacId = novoId('pasta');
FOLDERS[pastaPacId] = { files: [], subfolders: {} };
const ctrl = new Workbook(novoId('ctrl'), NOME_CONTROLE);
ctrl.abas = [new Sheet(ABA_PACIENTES, [['sigla', 'senha_hash', 'link_planilha_individual', 'data_cadastro', 'data_anamnese', 'ativo', 'observacoes', 'email', 'telefone', 'nome']])];
WORKBOOKS[ctrl.id] = ctrl;
FOLDERS[pastaProfId] = { files: [{ nome: NOME_CONTROLE, getId: () => ctrl.id }], subfolders: { Pacientes: pastaPacId } };
abaProfs.appendRow(['PROF_NP', 'NP', 'Dra. Nova de Prova', 'np@exemplo.test', '', '', '', 'Sim', '', pastaProfId, '2026-10-03']);
abaIndice.appendRow(['NP|profissional|PROF_NP', 'NP', 'profissional', 'PROF_NP', '2026-10-03', 'np@exemplo.test']);
abaAdmins.appendRow(['ADM_N', 'ADM_N', 'Admin N', 'admn@exemplo.test', 'Sim', '']);
abaIndice.appendRow(['ADM_N|admin|ADM_N', 'ADM_N', 'admin', 'ADM_N', '2026-10-03', 'admn@exemplo.test']);
const sProf = { tipo: 'profissional', sigla: 'NP', profissional_id: 'PROF_NP', nome: 'Dra. Nova de Prova', email: 'np@exemplo.test' };
const sAdm = { tipo: 'admin', sigla: 'ADM_N', profissional_id: 'ADM_N' };

let passo = 0, falhas = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 220) : '')); } };
const tenta = (n, f) => { try { f(); } catch (e) { ok(n + ' (exceção)', false, String(e && e.message || e)); } };
const celula = (aba, linha, col) => { const h = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]; return aba.getRange(linha, h.indexOf(col) + 1).getValue(); };
const linhaDe = (aba, colChave, chave) => { const d = aba.getDataRange().getValues(); const i = d[0].indexOf(colChave); return d.findIndex((l, k) => k > 0 && String(l[i]).toUpperCase() === String(chave).toUpperCase()) + 1; };
const formatoDe = (aba, col) => { const h = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]; return aba.formatos[h.indexOf(col) + 1]; };
const PERIGOSOS = ['=1+1', '+55 19 99013-6391', '- briguei com meu chefe', '@nome', '\tcom tab', '\rcom retorno', "'aspas"];

console.log('T. Trava _celulaSegura_ (função pura)');
tenta('T', () => {
  const cs = typeof _celulaSegura_ === 'function' ? _celulaSegura_ : null;
  ok('T0 _celulaSegura_ existe', !!cs);
  PERIGOSOS.forEach((v, i) => ok('T' + (i + 1) + ' início perigoso ' + JSON.stringify(v.slice(0, 6)) + ' ganha apóstrofo', !!cs && cs(v) === "'" + v, cs && cs(v)));
  ok('T8 texto comum passa igual', !!cs && cs('briguei com meu chefe') === 'briguei com meu chefe');
  ok('T9 número passa intacto (number)', !!cs && cs(7) === 7 && cs(-3) === -3 && cs(0) === 0);
  ok('T10 vazio, null e undefined passam intactos', !!cs && cs('') === '' && cs(null) === null && cs(undefined) === undefined);
  const d = new Date(); ok('T11 Date e booleano passam intactos', !!cs && cs(d) === d && cs(true) === true && cs(false) === false);
});

console.log('G. Cada gravação da decisão 2 com valor perigoso, lida de volta');
let SIG = null, abaAn = null, abaAu = null, abaEs = null;
const abaPac = ctrl.getSheetByName(ABA_PACIENTES);
tenta('G1', () => {
  const cad = cadastrarPaciente(sProf, { nomeCompleto: '=HYPERLINK("http://x.test";"Maria")', email: '+maria@exemplo.test', telefone: '(19) 99013-6391' });
  ok('G1 cadastrarPaciente ok', cad.ok === true, cad);
  SIG = cad.sigla;
  const L = linhaDe(abaPac, 'sigla', SIG);
  ok('G1a _anexarPorCabecalho_: nome perigoso volta igual ao digitado', celula(abaPac, L, 'nome') === '=HYPERLINK("http://x.test";"Maria")', celula(abaPac, L, 'nome'));
  ok('G1b _anexarPorCabecalho_: e-mail com + volta igual (Controle e Índice)', celula(abaPac, L, 'email') === '+maria@exemplo.test' && celula(abaIndice, linhaDe(abaIndice, 'sigla', SIG), 'email') === '+maria@exemplo.test', celula(abaPac, L, 'email'));
  const wb = WORKBOOKS[extrairIdDaUrl(celula(abaPac, L, 'link_planilha_individual'))];
  abaAn = wb.getSheetByName(ABA_ANAMNESE); abaAu = wb.getSheetByName(ABA_AUTOMONITORAMENTO); abaEs = wb.getSheetByName(ABA_ESCALAS);
});
tenta('G2', () => {
  const r = salvarAnamnese(SIG, { nome_completo: '=1+1', profissao: '+55 19 99013-6391', escolaridade: '- briguei com meu chefe', cidade: '@nome', estado: "'aspas", cep: '01310-100', endereco_numero: 12 });
  ok('G2 salvarAnamnese (montarLinha): cinco inícios perigosos voltam iguais', r.ok && celula(abaAn, 2, 'nome_completo') === '=1+1' && celula(abaAn, 2, 'profissao') === '+55 19 99013-6391' && celula(abaAn, 2, 'escolaridade') === '- briguei com meu chefe' && celula(abaAn, 2, 'cidade') === '@nome' && celula(abaAn, 2, 'estado') === "'aspas",
    [celula(abaAn, 2, 'nome_completo'), celula(abaAn, 2, 'profissao'), celula(abaAn, 2, 'escolaridade'), celula(abaAn, 2, 'cidade'), celula(abaAn, 2, 'estado')]);
  ok('G2b número continua number; CEP igual', celula(abaAn, 2, 'endereco_numero') === 12 && celula(abaAn, 2, 'cep') === '01310-100');
});
tenta('G3', () => {
  const r = pacienteAtualizarAnamnese(SIG, { nome_completo: '@maria', profissao: '=CMD()', cidade: "'Campinas" });
  ok('G3 pacienteAtualizarAnamnese: valores perigosos voltam iguais', r.ok && celula(abaAn, 2, 'nome_completo') === '@maria' && celula(abaAn, 2, 'profissao') === '=CMD()' && celula(abaAn, 2, 'cidade') === "'Campinas", [celula(abaAn, 2, 'nome_completo'), celula(abaAn, 2, 'profissao'), celula(abaAn, 2, 'cidade')]);
});
tenta('G4', () => {
  const r = profSalvarAnamnese(sProf, SIG, { email: '+novo@exemplo.test', telefone: '19990136391' }, { nome_completo: '-Maria', profissao: '+engenheira' });
  ok('G4 profSalvarAnamnese: valores perigosos voltam iguais', r.ok && celula(abaAn, 2, 'nome_completo') === '-Maria' && celula(abaAn, 2, 'profissao') === '+engenheira', [r, celula(abaAn, 2, 'nome_completo')]);
  const L = linhaDe(abaPac, 'sigla', SIG);
  ok('G4b _atualizarLinhaPorChave_ + _gravarEmailIndice_: e-mail com + volta igual na Controle, no Índice e no espelho da Anamnese',
    celula(abaPac, L, 'email') === '+novo@exemplo.test' && celula(abaIndice, linhaDe(abaIndice, 'sigla', SIG), 'email') === '+novo@exemplo.test' && celula(abaAn, 2, 'email') === '+novo@exemplo.test',
    [celula(abaPac, L, 'email'), celula(abaIndice, linhaDe(abaIndice, 'sigla', SIG), 'email'), celula(abaAn, 2, 'email')]);
});
let TS = null;
tenta('G5', () => {
  const r = salvarAutomonitoramento(SIG, { data_registro: '2026-10-03', humor_nivel: 3, neg_emo_tristeza: 7, neg_sit_o_que: '- briguei com meu chefe', neg_pens_o_que: '=SOMA(A1:A9)', humor_observacoes: '+ ou - bem' });
  ok('G5 salvarAutomonitoramento: texto perigoso volta igual', r.ok && celula(abaAu, 2, 'neg_sit_o_que') === '- briguei com meu chefe' && celula(abaAu, 2, 'neg_pens_o_que') === '=SOMA(A1:A9)' && celula(abaAu, 2, 'humor_observacoes') === '+ ou - bem', [celula(abaAu, 2, 'neg_sit_o_que'), celula(abaAu, 2, 'neg_pens_o_que')]);
  ok('G5b intensidades continuam number', celula(abaAu, 2, 'humor_nivel') === 3 && celula(abaAu, 2, 'neg_emo_tristeza') === 7);
  TS = _tsNormalizar_(celula(abaAu, 2, 'timestamp'));
});
tenta('G6', () => {
  const r = pacienteEditarAutomonitoramento(SIG, TS, { neg_sit_o_que: '@chefe gritou', humor_nivel: 2 });
  ok('G6 pacienteEditarAutomonitoramento (_atualizarCamposLinha_): perigoso volta igual; número segue number', r.ok && celula(abaAu, 2, 'neg_sit_o_que') === '@chefe gritou' && celula(abaAu, 2, 'humor_nivel') === 2 && celula(abaAu, 2, 'editado_por') === 'paciente', [r, celula(abaAu, 2, 'neg_sit_o_que')]);
  const r2 = profEditarAutomonitoramento(sProf, SIG, TS, { neg_pens_o_que: '=1+1' });
  ok('G6b profEditarAutomonitoramento: perigoso volta igual', r2.ok && celula(abaAu, 2, 'neg_pens_o_que') === '=1+1', [r2, celula(abaAu, 2, 'neg_pens_o_que')]);
});
tenta('G7', () => {
  const r = salvarEscala(SIG, { data_aplicacao: '2026-10-03', instrumento: 'PHQ-9', item_01: 2, item_02: 0, escore_total: 14, observacoes: '@nome', item_funcional_texto: '=1+1' });
  ok('G7 salvarEscala: texto perigoso volta igual', r.ok && celula(abaEs, 2, 'observacoes') === '@nome' && celula(abaEs, 2, 'item_funcional_texto') === '=1+1', [celula(abaEs, 2, 'observacoes')]);
  ok('G7b nota e escore continuam number', celula(abaEs, 2, 'item_01') === 2 && celula(abaEs, 2, 'item_02') === 0 && celula(abaEs, 2, 'escore_total') === 14);
});
tenta('G8', () => {
  const r = cadastrarProfissional(sAdm, { sigla: 'ZP', nomeCompleto: '=Zeca', email: '+zp@exemplo.test', telefone: '1933334444', crp: '-06/123', dataInicio: '@hoje' });
  const L = linhaDe(abaProfs, 'profissional_id', 'PROF_ZP');
  ok('G8 cadastrarProfissional: nome, e-mail, CRP e data perigosos voltam iguais', r.ok && celula(abaProfs, L, 'nome_completo') === '=Zeca' && celula(abaProfs, L, 'email') === '+zp@exemplo.test' && celula(abaProfs, L, 'crp') === '-06/123' && celula(abaProfs, L, 'data_inicio') === '@hoje',
    [r, L && celula(abaProfs, L, 'nome_completo'), L && celula(abaProfs, L, 'crp')]);
});
tenta('G9', () => {
  const r = atualizarProfissional(sAdm, 'PROF_ZP', { nomeCompleto: '+Zeca', crp: '@crp', email: '+zp2@exemplo.test' });
  const L = linhaDe(abaProfs, 'profissional_id', 'PROF_ZP');
  ok('G9 atualizarProfissional: valores perigosos voltam iguais (aba e Índice)', r.ok && celula(abaProfs, L, 'nome_completo') === '+Zeca' && celula(abaProfs, L, 'crp') === '@crp' && celula(abaProfs, L, 'email') === '+zp2@exemplo.test' && celula(abaIndice, linhaDe(abaIndice, 'sigla', 'ZP'), 'email') === '+zp2@exemplo.test',
    [r, celula(abaProfs, L, 'nome_completo'), celula(abaIndice, linhaDe(abaIndice, 'sigla', 'ZP'), 'email')]);
});
tenta('G10', () => {
  const r = salvarGradeAtendimento(sProf, { duracao_slot_min: 50, antecedencia_min_horas: 12 }, [{ dia_semana: 1, hora_inicio: '08:00', hora_fim: '12:00', modalidade: 'online', ativo: '=1+1' }]);
  const g = ctrl.getSheetByName('Grade_Horarios'), c = ctrl.getSheetByName('Config_Agenda');
  ok('G10 salvarGradeAtendimento: `ativo` perigoso volta igual; horários e config iguais', r.ok && celula(g, 2, 'ativo') === '=1+1' && celula(g, 2, 'hora_inicio') === '08:00' && String(c.getRange(2, 2).getValue()) === '50', [r, g && celula(g, 2, 'ativo')]);
  const l = lerGradeAtendimento(sProf);
  ok('G10b lerGradeAtendimento devolve a grade e a config como antes', l.ok && l.grade.length === 1 && l.config.duracao_slot_min === 50 && l.config.antecedencia_min_horas === 12, l);
});
tenta('G11', () => {
  let formulas = 0;
  Object.keys(WORKBOOKS).forEach(id => WORKBOOKS[id].abas.forEach(a => a.dados.forEach(l => l.forEach(v => { if (v && v.formula) formulas++; }))));
  ok('G11 nenhuma célula do mundo virou fórmula', formulas === 0, { formulas });
});

console.log('L. Texto livre não é retipado (decisão 1b); datas, horas e números seguem com o tipo de antes');
const tipo = v => (v instanceof Date ? 'Date' : typeof v);
tenta('L', () => {
  ok('L0 _celulaTexto_ existe; livre força texto, fora só a trava', typeof _celulaTexto_ === 'function' && _celulaTexto_('neg_sit_o_que', '10/10') === "'10/10" && _celulaTexto_('data_registro', '2026-10-03') === '2026-10-03' && _celulaTexto_('humor_observacoes', 7) === 7 && _celulaTexto_('humor_observacoes', '') === '' && _celulaTexto_('hora_registro', '13:00') === '13:00' && _celulaTexto_('observacoes', "'x") === "''x");
  const r = salvarAutomonitoramento(SIG, { data_registro: '2026-10-04', hora_registro: '13:00', humor_nivel: 4, humor_observacoes: '10/10', neg_sit_o_que: '13:00', neg_pens_o_que: '1-2', neg_comp_o_que: '3/4 da noite', pos_sit_o_que: '0123' });
  const L = abaAu.getLastRow();
  ok('L1 registro: 10/10, 13:00, 1-2, 3/4 da noite e 0123 em campo livre voltam iguais (string)', r.ok && celula(abaAu, L, 'humor_observacoes') === '10/10' && celula(abaAu, L, 'neg_sit_o_que') === '13:00' && celula(abaAu, L, 'neg_pens_o_que') === '1-2' && celula(abaAu, L, 'neg_comp_o_que') === '3/4 da noite' && celula(abaAu, L, 'pos_sit_o_que') === '0123',
    ['humor_observacoes', 'neg_sit_o_que', 'neg_pens_o_que', 'neg_comp_o_que', 'pos_sit_o_que'].map(c => tipo(celula(abaAu, L, c))));
  ok('L2 registro: data_registro e hora_registro seguem Date (como antes); humor number', tipo(celula(abaAu, L, 'data_registro')) === 'Date' && tipo(celula(abaAu, L, 'hora_registro')) === 'Date' && celula(abaAu, L, 'humor_nivel') === 4, [tipo(celula(abaAu, L, 'data_registro')), tipo(celula(abaAu, L, 'hora_registro'))]);
  abaAu.getRange(L, abaAu.getRange(1, 1, 1, abaAu.getLastColumn()).getValues()[0].indexOf('timestamp') + 1).setValue("'2026-10-04 09:09:09"); // carimbo proprio: as duas linhas nasceram no mesmo segundo
  const ts = _tsNormalizar_(celula(abaAu, L, 'timestamp'));
  const e = pacienteEditarAutomonitoramento(SIG, ts, { pos_pens_o_que: '10/10', hora_registro: '14:30' });
  ok('L3 edição do registro: campo livre igual; hora segue Date', e.ok && celula(abaAu, L, 'pos_pens_o_que') === '10/10' && tipo(celula(abaAu, L, 'hora_registro')) === 'Date', [e, tipo(celula(abaAu, L, 'pos_pens_o_que'))]);
  const a = pacienteAtualizarAnamnese(SIG, { nome_completo: 'Maria', data_nascimento: '1990-05-10', tratamentos_anteriores: '10/10', endereco_complemento: '1-2', endereco_numero: '123', medicacao_psico_detalhes: '13:00', cpf: '01234567890' });
  ok('L4 anamnese: campos livres voltam iguais (string); data_nascimento segue Date', a.ok && celula(abaAn, 2, 'tratamentos_anteriores') === '10/10' && celula(abaAn, 2, 'endereco_complemento') === '1-2' && celula(abaAn, 2, 'endereco_numero') === '123' && celula(abaAn, 2, 'medicacao_psico_detalhes') === '13:00' && celula(abaAn, 2, 'cpf') === '01234567890' && tipo(celula(abaAn, 2, 'data_nascimento')) === 'Date',
    ['tratamentos_anteriores', 'endereco_complemento', 'endereco_numero', 'medicacao_psico_detalhes', 'cpf', 'data_nascimento'].map(c => tipo(celula(abaAn, 2, c))));
  const p = profSalvarAnamnese(sProf, SIG, null, { nome_completo: 'Maria', data_nascimento: '1990-05-10', profissao: '3/4 da noite', familiar_transtorno_detalhes: '1-2' });
  ok('L5 anamnese pelo profissional: idem', p.ok && celula(abaAn, 2, 'profissao') === '3/4 da noite' && celula(abaAn, 2, 'familiar_transtorno_detalhes') === '1-2' && tipo(celula(abaAn, 2, 'data_nascimento')) === 'Date');
  const s2 = salvarEscala(SIG, { data_aplicacao: '2026-10-04', instrumento: 'GAD-7', item_01: 3, escore_total: 9, observacoes: '1-2', item_funcional_texto: '10/10' });
  const LE = abaEs.getLastRow();
  ok('L6 escala: observações e texto funcional iguais; nota e escore number; data_aplicacao Date', s2.ok && celula(abaEs, LE, 'observacoes') === '1-2' && celula(abaEs, LE, 'item_funcional_texto') === '10/10' && celula(abaEs, LE, 'item_01') === 3 && celula(abaEs, LE, 'escore_total') === 9 && tipo(celula(abaEs, LE, 'data_aplicacao')) === 'Date',
    [tipo(celula(abaEs, LE, 'observacoes')), tipo(celula(abaEs, LE, 'data_aplicacao'))]);
  const u = atualizarProfissional(sAdm, 'PROF_ZP', { crp: '06/12', nomeCompleto: '10/10', dataInicio: '2026-10-01' });
  const LP = linhaDe(abaProfs, 'profissional_id', 'PROF_ZP');
  ok('L7 profissional: CRP e nome livres iguais; data_inicio segue Date', u.ok && celula(abaProfs, LP, 'crp') === '06/12' && celula(abaProfs, LP, 'nome_completo') === '10/10' && tipo(celula(abaProfs, LP, 'data_inicio')) === 'Date', [tipo(celula(abaProfs, LP, 'crp')), tipo(celula(abaProfs, LP, 'data_inicio'))]);
  const c2 = cadastrarPaciente(sProf, { nomeCompleto: '10/10', email: 'dezdez@exemplo.test', telefone: '' });
  ok('L8 cadastro: nome livre igual na Controle', c2.ok && celula(abaPac, linhaDe(abaPac, 'sigla', c2.sigla), 'nome') === '10/10', c2);
});

console.log('I. Identificação em linha nova (appendRow ignora o formato @: vale o apóstrofo)');
tenta('I', () => {
  ok('I0 _celulaTexto_ força texto em sigla, profissional_id, telefone, cpf, cep, email_destino', ['sigla', 'profissional_id', 'telefone', 'cpf', 'cep', 'zip_code', 'rg', 'email', 'email_destino', 'pessoa_confianca_2_telefone'].every(c => _celulaTexto_(c, '0123') === "'0123") && _celulaTexto_('sigla', '') === '' && _celulaTexto_('telefone', 199) === 199);
  ok('I1 e fora delas só a trava: senha_hash, token_hash, expira, data_cadastro, ativo, tipo', ['senha_hash', 'token_hash', 'expira', 'data_cadastro', 'ativo', 'tipo', 'usado', 'link_planilha_individual'].every(c => _celulaTexto_(c, '0123') === '0123'));
  const c3 = cadastrarPaciente(sProf, { nomeCompleto: 'Telefone Numérico', email: 'tel@exemplo.test', telefone: '(19) 99013-6391' });
  const L = linhaDe(abaPac, 'sigla', c3.sigla);
  ok('I2 cadastro (appendRow): telefone só de dígitos volta string na Controle', c3.ok && celula(abaPac, L, 'telefone') === '19990136391', [c3.ok, typeof celula(abaPac, L, 'telefone')]);
  const wb = WORKBOOKS[extrairIdDaUrl(celula(abaPac, L, 'link_planilha_individual'))];
  const r = salvarAnamnese(c3.sigla, { nome_completo: 'Telefone Numérico', cpf: '01234567890', cep: '01310100', rg: '0123', pessoa_confianca_1_telefone: '1933334444' });
  const an = wb.getSheetByName(ABA_ANAMNESE);
  ok('I3 anamnese (appendRow): cpf, cep, rg e telefones só de dígitos voltam string, com o zero', r.ok && celula(an, 2, 'cpf') === '01234567890' && celula(an, 2, 'cep') === '01310100' && celula(an, 2, 'rg') === '0123' && celula(an, 2, 'pessoa_confianca_1_telefone') === '1933334444' && celula(an, 2, 'telefone') === '19990136391',
    ['cpf', 'cep', 'rg', 'pessoa_confianca_1_telefone', 'telefone'].map(c => typeof celula(an, 2, c)));
  const tk = sistema.getSheetByName(ABA_TOKENS);
  const LT = linhaDe(tk, 'sigla', c3.sigla);
  ok('I4 Tokens (appendRow): sigla, profissional_id e email_destino string; expira intacto', LT > 0 && celula(tk, LT, 'profissional_id') === 'PROF_NP' && celula(tk, LT, 'email_destino') === 'tel@exemplo.test' && typeof celula(tk, LT, 'expira') === 'string');
});

console.log('A. Aceite da política sem apóstrofo duplicado (decisão 3)');
tenta('A', () => {
  const L = linhaDe(abaPac, 'sigla', SIG);
  const link = _criarLinkAtivacao_('paciente', SIG, 'PROF_NP', 'convite', '+novo@exemplo.test');
  const r = definirSenha(_brutoDoLink_(link), crypto.randomBytes(12).toString('base64url') + 'A1', true, POLITICA_VERSAO);
  ok('A1 ativação com aceite ok', r.ok === true, r);
  ok('A2 aceite_politica_versao lido de volta = POLITICA_VERSAO exata (sem apóstrofo)', celula(abaPac, L, 'aceite_politica_versao') === POLITICA_VERSAO, celula(abaPac, L, 'aceite_politica_versao'));
  ok('A3 aceite_politica_em lido de volta no formato de data/hora (sem apóstrofo)', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(celula(abaPac, L, 'aceite_politica_em'))), celula(abaPac, L, 'aceite_politica_em'));
  ok('A4 _aceitouPoliticaAtual_ confere', _aceitouPoliticaAtual_(SIG, 'PROF_NP') === true);
  ok('A5 senha_hash gravado intacto (v3 desde o 18.2.1)', /^v3\$/.test(String(celula(abaPac, L, 'senha_hash'))));
});

console.log('F. Formato texto (@) nos caminhos de criação (decisão 4b)');
tenta('F', () => {
  ok('F1 Anamnese nova: email, telefone, cep, cpf, rg e zip_code nascem @', abaAn && ['email', 'telefone', 'cep', 'cpf', 'rg', 'zip_code', 'pessoa_confianca_1_telefone', 'pessoa_confianca_1_email'].every(c => formatoDe(abaAn, c) === '@'), abaAn && abaAn.formatos);
  ok('F2 Anamnese nova: data_nascimento e timestamp NÃO são @', abaAn && formatoDe(abaAn, 'data_nascimento') === undefined && formatoDe(abaAn, 'timestamp') === undefined);
  ok('F3 colunas de aceite criadas pelo cabeçalho nascem @', formatoDe(abaPac, 'aceite_politica_em') === '@' && formatoDe(abaPac, 'aceite_politica_versao') === '@', abaPac.formatos);
  const tk = sistema.getSheetByName(ABA_TOKENS);
  ok('F4 aba Tokens criada pelo código: sigla, profissional_id e email_destino @; expira fora', !!tk && formatoDe(tk, 'sigla') === '@' && formatoDe(tk, 'profissional_id') === '@' && formatoDe(tk, 'email_destino') === '@' && formatoDe(tk, 'expira') === undefined, tk && tk.formatos);
  const pzp = FOLDERS[RAIZ].subfolders['Profissional_ZP'];
  const cz = pzp && FOLDERS[pzp].files.find(f => f.nome === NOME_CONTROLE);
  const abaZ = cz && WORKBOOKS[cz.getId()].getSheetByName(ABA_PACIENTES);
  ok('F5 Controle nova (cadastrarProfissional): sigla, email e telefone nascem @; datas fora', !!abaZ && formatoDe(abaZ, 'sigla') === '@' && formatoDe(abaZ, 'email') === '@' && formatoDe(abaZ, 'telefone') === '@' && formatoDe(abaZ, 'data_cadastro') === undefined, abaZ && abaZ.formatos);
});

console.log('B. bootstrapAcesso18_1 fora (decisão 5) e versão');
tenta('B', () => {
  ok('B1 bootstrapAcesso18_1 não existe mais', typeof bootstrapAcesso18_1 === 'undefined');
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('B2 nenhuma menção a bootstrapAcesso18_1 no Código.js', src.indexOf('bootstrapAcesso18_1') === -1);
  ok('B3 mensagem sem segredo = "Servidor sem segredo de sessão."', src.indexOf("erro: 'Servidor sem segredo de sessão.'") !== -1);
  ok('B4 e3TextoSeguro saiu (o log do backup usa a trava única)', typeof e3TextoSeguro === 'undefined' && /detalhe: _celulaSegura_\(/.test(src));
  ok('B5 nenhuma função temporária no código (prova/formato/varredura/restauração/exp)', !/function (prova|formato|varredura|restaur|exp)\w*18_2/.test(src) && src.indexOf('TEMP18_2') === -1);
  ok('B6 VERSAO_PACOTE definida (era fixa em 18.2)', (typeof VERSAO_PACOTE === 'string' && VERSAO_PACOTE.length > 0), VERSAO_PACOTE);
});

console.log('\n' + (falhas === 0 ? 'RESULTADO: OK — ' + passo + '/' + passo + ' provas' : 'RESULTADO: ' + falhas + ' FALHA(S) em ' + passo + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
