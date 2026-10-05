/* Pacote 18.2.1 — Pimenta no hash de senha: testes em Node do Código.js REAL sobre planilhas
   simuladas (mocks do PACOTE_18_2_node.js). Blocos: H formato v3 e pimenta · L login com regravação
   v2 → v3 (crachá, links, duas contas) · S sem pimenta · W gravações de senha em v3 · R retenção com sufixo.
   Uso: node PACOTE_18_2_1_node.js */
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
const PROPS = { SEGREDO_SESSAO: 'segredo-de-teste-' + crypto.randomUUID() };
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


PROPS.PIMENTA_SENHA = crypto.randomBytes(32).toString('hex');
let passo = 0, falhas = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 220) : '')); } };
const tenta = (n, f) => { try { f(); } catch (e) { ok(n + ' (exceção)', false, String(e && e.message || e)); } };
const celula = (aba, linha, col) => { const h = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]; return aba.getRange(linha, h.indexOf(col) + 1).getValue(); };
const setCel = (aba, linha, col, v) => { const h = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]; aba.getRange(linha, h.indexOf(col) + 1).setValue(v); };
const linhaDe = (aba, colChave, chave) => { const d = aba.getDataRange().getValues(); const i = d[0].indexOf(colChave); return d.findIndex((l, k) => k > 0 && String(l[i]).toUpperCase() === String(chave).toUpperCase()) + 1; };
const aleat = () => crypto.randomBytes(12).toString('base64url') + 'aA1';
const limpaFalhas = () => Object.keys(CACHE).forEach(k => { if (k.indexOf('falha:') === 0) delete CACHE[k]; });
const abaPac = ctrl.getSheetByName(ABA_PACIENTES);
const gerar = typeof gerarHashSenha === 'function' ? gerarHashSenha : () => '';
const v2 = (senha, iter) => _hashSenha_(senha, crypto.randomBytes(16).toString('hex'), iter);
let chamadasInvalidar = 0;
const invalidarReal = _invalidarLinks_;
_invalidarLinks_ = function () { chamadasInvalidar++; return invalidarReal.apply(this, arguments); };

console.log('H. Formato v3 e pimenta');
tenta('H', () => {
  const s = aleat(), h = gerar(s), p = String(h).split('$');
  ok('H1 gerarHashSenha emite v3$sal$iter$hash com ITER_SENHA', p.length === 4 && p[0] === 'v3' && p[2] === String(ITER_SENHA) && /^[0-9a-f]{64}$/.test(p[3]), p.slice(0, 3));
  ok('H2 v3 confere com a senha certa e não com a errada', conferirSenha(s, h) === true && conferirSenha(s + 'x', h) === false);
  ok('H3 v2 antigo de 300 e de 5000 iterações ainda confere', conferirSenha(s, v2(s, 300)) === true && conferirSenha(s, v2(s, 5000)) === true && conferirSenha('outra-senha', v2(s, 300)) === false);
  const guardada = PROPS.PIMENTA_SENHA;
  PROPS.PIMENTA_SENHA = crypto.randomBytes(32).toString('hex');
  ok('H4 com outra pimenta o mesmo v3 NÃO confere (a cópia da planilha sozinha não basta)', conferirSenha(s, h) === false);
  PROPS.PIMENTA_SENHA = guardada;
  ok('H5 de volta à pimenta certa, confere', conferirSenha(s, h) === true);
  ok('H6 o v3 não é o v2 com outro prefixo (a pimenta entra na conta)', p.length === 4 && _hashSenha_(s, p[1], ITER_SENHA).split('$')[3] !== p[3]);
  ok('H7 nenhum chamador de gerarHashSenhaV2 no Código.js', fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8').indexOf('gerarHashSenhaV2') === -1);
  const m = medirHashSenha();
  ok('H8 medirHashSenha mede o caminho v3 e devolve só números', !!m && m.formato === 'v3' && m.iter === ITER_SENHA && typeof m.ms === 'number' && JSON.stringify(m).indexOf(PROPS.PIMENTA_SENHA) === -1, m);
});

console.log('L. Login com regravação v2 → v3');
let SIG = null, SENHA = aleat();
tenta('L', () => {
  const cad = cadastrarPaciente(sProf, { nomeCompleto: 'Paciente Pimenta', email: 'pim@exemplo.test', telefone: '' });
  SIG = cad.sigla;
  const L = linhaDe(abaPac, 'sigla', SIG);
  setCel(abaPac, L, 'senha_hash', v2(SENHA, 300));
  _gravarAceitePolitica_(SIG, 'PROF_NP');
  const pendente = _brutoDoLink_(cad.link);
  ok('L0 preparo: conta em v2/300 e link de convite pendente', String(celula(abaPac, L, 'senha_hash')).indexOf('v2$') === 0 && !!_linkValido_(pendente));
  const e1 = autenticar('paciente', 'pim@exemplo.test', SENHA + 'errada');
  ok('L1 senha errada falha e NÃO regrava', e1.ok === false && String(celula(abaPac, L, 'senha_hash')).indexOf('v2$') === 0);
  limpaFalhas(); chamadasInvalidar = 0;
  const a1 = autenticar('paciente', 'pim@exemplo.test', SENHA);
  const h1 = String(celula(abaPac, L, 'senha_hash'));
  ok('L2 login em v2 entra e a célula passa a v3 com o ITER_SENHA atual', a1.ok === true && h1.indexOf('v3$') === 0 && h1.split('$')[2] === String(ITER_SENHA), [a1.ok, h1.slice(0, 3)]);
  ok('L3 o crachá desse login vale na chamada seguinte', !!a1.token && !!_validarToken_(a1.token));
  ok('L4 a regravação não chama _invalidarLinks_ e o link pendente segue válido', chamadasInvalidar === 0 && !!_linkValido_(pendente), { chamadasInvalidar });
  const a2 = autenticar('paciente', 'pim@exemplo.test', SENHA);
  ok('L5 segundo login entra, não regrava de novo e o primeiro crachá segue válido', a2.ok === true && String(celula(abaPac, L, 'senha_hash')) === h1 && !!_validarToken_(a1.token) && !!_validarToken_(a2.token));
  ok('L6 senha errada depois da regravação segue falhando', autenticar('paciente', 'pim@exemplo.test', SENHA + 'x').ok === false && String(celula(abaPac, L, 'senha_hash')) === h1);
  limpaFalhas();
});
tenta('L-prof', () => {
  const sp = aleat(), LP = linhaDe(abaProfs, 'profissional_id', 'PROF_NP');
  setCel(abaProfs, LP, 'senha_hash', v2(sp, 5000));
  const a = autenticar('profissional', 'np@exemplo.test', sp);
  const h = String(celula(abaProfs, LP, 'senha_hash'));
  ok('L7 profissional em v2/5000: entra, vira v3 com ITER_SENHA, crachá válido', a.ok === true && h.indexOf('v3$') === 0 && h.split('$')[2] === String(ITER_SENHA) && !!_validarToken_(a.token), [a.ok, h.slice(0, 8)]);
  const sa = aleat(), LA = linhaDe(abaAdmins, 'admin_id', 'ADM_N');
  setCel(abaAdmins, LA, 'senha_hash', v2(sa, 5000));
  const b = autenticar('admin', 'admn@exemplo.test', sa);
  ok('L8 admin em v2/5000: entra, vira v3, crachá válido', b.ok === true && String(celula(abaAdmins, LA, 'senha_hash')).indexOf('v3$') === 0 && !!_validarToken_(b.token), b.ok);
  limpaFalhas();
});
tenta('L-duas', () => {
  // segundo profissional com paciente de MESMO e-mail (18.1.3)
  const pasta2 = novoId('pasta'), pp2 = novoId('pasta'); FOLDERS[pp2] = { files: [], subfolders: {} };
  const ctrl2 = new Workbook(novoId('ctrl'), NOME_CONTROLE);
  ctrl2.abas = [new Sheet(ABA_PACIENTES, [['sigla', 'senha_hash', 'link_planilha_individual', 'data_cadastro', 'data_anamnese', 'ativo', 'observacoes', 'email', 'telefone', 'nome', 'aceite_politica_em', 'aceite_politica_versao']])];
  WORKBOOKS[ctrl2.id] = ctrl2;
  FOLDERS[pasta2] = { files: [{ nome: NOME_CONTROLE, getId: () => ctrl2.id }], subfolders: { Pacientes: pp2 } };
  abaProfs.appendRow(['PROF_N2', 'N2', 'Dr. Segundo', 'n2@exemplo.test', '', '', '', 'Sim', '', pasta2, '2026-10-03']);
  abaIndice.appendRow(['N2|profissional|PROF_N2', 'N2', 'profissional', 'PROF_N2', '2026-10-03', 'n2@exemplo.test']);
  const sA = aleat(), sB = aleat();
  const cA = cadastrarPaciente(sProf, { nomeCompleto: 'Duas Contas', email: 'duas@exemplo.test', telefone: '' });
  const cB = cadastrarPaciente({ tipo: 'profissional', sigla: 'N2', profissional_id: 'PROF_N2', nome: 'Dr. Segundo', email: 'n2@exemplo.test' }, { nomeCompleto: 'Duas Contas', email: 'duas@exemplo.test', telefone: '' });
  const abaB = ctrl2.getSheetByName(ABA_PACIENTES);
  const LA = linhaDe(abaPac, 'sigla', cA.sigla), LB = linhaDe(abaB, 'sigla', cB.sigla);
  setCel(abaPac, LA, 'senha_hash', v2(sA, 300)); setCel(abaB, LB, 'senha_hash', v2(sB, 300));
  const a = autenticar('paciente', 'duas@exemplo.test', sA);
  ok('L9 duas contas, senhas diferentes: entra na certa e regrava SÓ ela', cA.ok && cB.ok && a.ok === true && a.perfil.sigla === cA.sigla && String(celula(abaPac, LA, 'senha_hash')).indexOf('v3$') === 0 && String(celula(abaB, LB, 'senha_hash')).indexOf('v2$') === 0,
    [a.ok, String(celula(abaPac, LA, 'senha_hash')).slice(0, 3), String(celula(abaB, LB, 'senha_hash')).slice(0, 3)]);
  // mesma senha nas duas: 1a chamada pede a escolha e não regrava nenhuma; a 2a regrava só a escolhida
  setCel(abaPac, LA, 'senha_hash', v2(sB, 300));
  const p1 = autenticar('paciente', 'duas@exemplo.test', sB);
  ok('L10 mesma senha nas duas: pede a escolha, sem crachá, sem regravar', p1.ok === false && p1.codigo === 'escolher' && p1.opcoes.length === 2 && String(celula(abaPac, LA, 'senha_hash')).indexOf('v2$') === 0 && String(celula(abaB, LB, 'senha_hash')).indexOf('v2$') === 0, p1);
  const alvo = p1.opcoes && p1.opcoes.find(o => o.profissional === 'Dr. Segundo');
  const p2 = autenticar('paciente', 'duas@exemplo.test', sB, alvo && alvo.id);
  ok('L11 2ª chamada: entra na escolhida, regrava só ela, crachá válido', p2.ok === true && p2.perfil.sigla === cB.sigla && String(celula(abaB, LB, 'senha_hash')).indexOf('v3$') === 0 && String(celula(abaPac, LA, 'senha_hash')).indexOf('v2$') === 0 && !!_validarToken_(p2.token), [p2.ok]);
  limpaFalhas();
});

console.log('W. Toda gravação de senha emite v3');
tenta('W', () => {
  const L = linhaDe(abaPac, 'sigla', SIG);
  const n1 = aleat();
  const r1 = alterarSenhaPaciente(SIG, SENHA, n1);
  ok('W1 alterarSenhaPaciente grava v3 e devolve crachá válido', r1.ok === true && String(celula(abaPac, L, 'senha_hash')).indexOf('v3$') === 0 && !!_validarToken_(r1.token), r1.ok ? 'ok' : r1);
  const n2 = aleat();
  const r2 = profAlterarSenhaPaciente(sProf, SIG, n2);
  ok('W2 profAlterarSenhaPaciente grava v3 e a senha nova entra', r2.ok === true && String(celula(abaPac, L, 'senha_hash')).indexOf('v3$') === 0 && autenticar('paciente', 'pim@exemplo.test', n2).ok === true, r2);
  const link = _criarLinkAtivacao_('paciente', SIG, 'PROF_NP', 'redefinicao', 'pim@exemplo.test');
  const n3 = aleat();
  const r3 = definirSenha(_brutoDoLink_(link), n3);
  ok('W3 definirSenha (redefinição) grava v3 e a senha nova entra', r3.ok === true && String(celula(abaPac, L, 'senha_hash')).indexOf('v3$') === 0 && autenticar('paciente', 'pim@exemplo.test', n3).ok === true, r3);
  const n4 = aleat(), LP = linhaDe(abaProfs, 'profissional_id', 'PROF_NP');
  const r4 = trocarSenhaProfissional(sAdm, 'PROF_NP', n4);
  ok('W4 trocarSenhaProfissional grava v3 e a senha nova entra', r4.ok === true && String(celula(abaProfs, LP, 'senha_hash')).indexOf('v3$') === 0 && autenticar('profissional', 'np@exemplo.test', n4).ok === true, r4);
  SENHA = n3; limpaFalhas();
});

console.log('S. Sem pimenta configurada: recusa, nunca cai para v2');
tenta('S', () => {
  const guardada = PROPS.PIMENTA_SENHA; delete PROPS.PIMENTA_SENHA;
  const erros = []; const ce = console.error; console.error = m => erros.push(String(m));
  try {
    const L = linhaDe(abaPac, 'sigla', SIG), antes = String(celula(abaPac, L, 'senha_hash'));
    ok('S1 gerarHashSenha não devolve hash', !gerar('qualquer-senha-1A'));
    ok('S2 conferirSenha recusa v3 e também v2', conferirSenha(SENHA, antes) === false && conferirSenha('abc12345', v2('abc12345', 300)) === false);
    const a = autenticar('paciente', 'pim@exemplo.test', SENHA);
    ok('S3 autenticar recusa com a mensagem genérica de sempre, sem crachá', a.ok === false && !a.token && a.erro === MSG_LOGIN, a);
    const r = alterarSenhaPaciente(SIG, SENHA, aleat());
    const p = profAlterarSenhaPaciente(sProf, SIG, aleat());
    const t = trocarSenhaProfissional(sAdm, 'PROF_NP', aleat());
    ok('S4 nenhuma gravação de senha acontece (célula igual)', r.ok === false && p.ok === false && t.ok === false && String(celula(abaPac, L, 'senha_hash')) === antes, [r, p, t]);
    ok('S5 a falta fica registrada no log do servidor, sem a senha', erros.length > 0 && erros.every(m => m.indexOf(SENHA) === -1), erros.length);
  } finally { PROPS.PIMENTA_SENHA = guardada; console.error = ce; limpaFalhas(); }
  ok('S6 com a pimenta de volta o login funciona', autenticar('paciente', 'pim@exemplo.test', SENHA).ok === true);
});

console.log('R. Retenção reconhece AAAA-MM-DD_<sufixo> (decisão 8)');
tenta('R', () => {
  const lista = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-03_pre_18_2_1', '2026-10-03_pre_18_2_2', '2026-10-04', '2026-10-05', '2026-10-05_extra', '2026-10-06', '_restauracao_teste', 'Outra pasta', '2026-13-99x'];
  const ex = pastasExcedentes(lista, 5).slice().sort();
  ok('R1 lista mista, manter 5 datas: saem só as datas mais antigas (30/09 e 01/10)', JSON.stringify(ex) === JSON.stringify(['2026-09-30', '2026-10-01']), ex);
  const ex2 = pastasExcedentes(lista.concat(['2026-10-07', '2026-10-08']), 5).slice().sort();
  ok('R2 as com sufixo saem junto com as do mesmo dia', JSON.stringify(ex2) === JSON.stringify(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-03_pre_18_2_1', '2026-10-03_pre_18_2_2']), ex2);
  ok('R3 sem excedente e sem sufixo: igual a antes', pastasExcedentes(['2026-10-01', '2026-10-02'], 5).length === 0 && JSON.stringify(pastasExcedentes(['2026-10-01', '2026-10-02', '2026-10-03'], 2)) === JSON.stringify(['2026-10-01']));
  ok('R4 pasta que não começa com data nunca entra; manter inválido não apaga nada', pastasExcedentes(['_x', 'Backups', 'pre_2026-10-01'], 1).length === 0 && pastasExcedentes(lista, 0).length === 0);
  ok('R5 só sufixo, sem a pasta do dia: conta como cópia daquela data', JSON.stringify(pastasExcedentes(['2026-10-01_a', '2026-10-02', '2026-10-03'], 2)) === JSON.stringify(['2026-10-01_a']));
});

tenta('V', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
  ok('V1 nenhuma função temporária no código', src.indexOf('TEMP18') === -1 && !/function \w*18_2_1\(/.test(src));
  ok('V2 a pimenta não está no código nem em constante', !/PIMENTA_SENHA\s*=\s*['"]/.test(src) && src.indexOf("getProperty('PIMENTA_SENHA')") !== -1);
  ok('V3 VERSAO_PACOTE definida (era fixa em 18.2.1; a versao e conferida no teste do pacote corrente)', /^18\.\d/.test(VERSAO_PACOTE), VERSAO_PACOTE);
});

console.log('\n' + (falhas === 0 ? 'RESULTADO: OK — ' + passo + '/' + passo + ' provas' : 'RESULTADO: ' + falhas + ' FALHA(S) em ' + passo + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
