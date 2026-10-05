/* Pacote 18.1.6 — Aceite da Política: testes em Node do Código.js REAL sobre planilhas
   simuladas (mesmos mocks do PACOTE_18_1_3_node.js). Provas:
   N1 ativar (convite de paciente) SEM aceite -> recusa com mensagem clara, link não consumido
   N2 ativar COM aceite -> senha criada e colunas aceite_politica_em/_versao gravadas
   N3 probe (definirSenha sem senha) diz exige_aceite e politica_versao
   N4 login de conta sem aceite -> perfil.aceite_pendente = true (crachá sai; cliente barra)
   N5 aceitarPolitica com o crachá grava e o login seguinte vem sem pendência
   N6 redefinição de conta que JÁ aceitou: probe sem exige_aceite; senha troca sem aceite
   N7 profissional e admin: ativação intacta, sem exigência
   N8 versão errada no aceite -> recusa
   Uso: node PACOTE_18_1_6_node.js  (sem 'use strict': o eval precisa vazar declarações) */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ---- mocks idênticos aos do 18.1.3 (resumidos) ---- */
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
class Range {
  constructor(s, r, c, nr, nc) { this.s = s; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const l = this.s.dados[this.r - 1 + i] || []; const row = []; for (let j = 0; j < this.nc; j++) row.push(l[this.c - 1 + j] !== undefined ? l[this.c - 1 + j] : ''); o.push(row); } return o; }
  setValues(v) { for (let i = 0; i < v.length; i++) for (let j = 0; j < v[i].length; j++) this._set(this.r + i, this.c + j, v[i][j]); return this; }
  setValue(v) { this._set(this.r, this.c, v); return this; }
  _set(r, c, v) { while (this.s.dados.length < r) this.s.dados.push([]); const l = this.s.dados[r - 1]; while (l.length < c) l.push(''); l[c - 1] = (typeof v === 'string' && v.charAt(0) === "'") ? v.slice(1) : v; } // apóstrofo = texto, como no Sheets
  setFontWeight() { return this; }
  setNumberFormat() { return this; } // 18.2: formato @ nas colunas de identificacao
}
class Sheet {
  constructor(n, d) { this.nome = n; this.dados = d || [[]]; }
  getName() { return this.nome; } setName(n) { this.nome = n; return this; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  getDataRange() { return new Range(this, 1, 1, Math.max(this.dados.length, 1), Math.max(this.getLastColumn(), 1)); }
  getLastColumn() { return this.dados.reduce((m, l) => Math.max(m, l.length), 0) || 1; }
  getLastRow() { return this.dados.length; }
  getMaxRows() { return 1000; } // 18.2
  appendRow(v) { this.dados.push(v.map((x => (typeof x === 'string' && x.charAt(0) === "'") ? x.slice(1) : x))); return this; } // 18.2: apóstrofo = texto, como no Sheets
  deleteRow(r) { this.dados.splice(r - 1, 1); return this; }
  setFrozenRows() { return this; }
}
class Workbook {
  constructor(id, n) { this.id = id; this.nome = n; this.abas = [new Sheet('Página1', [[]])]; }
  getId() { return this.id; } getUrl() { return 'https://sheets.local/' + this.id; }
  getSheets() { return this.abas; }
  getSheetByName(n) { return this.abas.find(a => a.nome === n) || null; }
  insertSheet(n) { const s = new Sheet(n, [[]]); this.abas.push(s); return s; }
}
const WORKBOOKS = {}, FOLDERS = {}; let seq = 0; const novoId = p => p + '_' + (++seq);
global.SpreadsheetApp = { openById: id => { if (!WORKBOOKS[id]) throw new Error('planilha inexistente: ' + id); return WORKBOOKS[id]; }, create: n => { const w = new Workbook(novoId('wb'), n); WORKBOOKS[w.id] = w; return w; } };
global.DriveApp = {
  getFolderById: id => { const f = FOLDERS[id]; if (!f) throw new Error('pasta inexistente: ' + id); return {
    getFilesByName: n => { const a = f.files.filter(x => x.nome === n); let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; },
    getFoldersByName: n => { const s = f.subfolders[n]; let d = false; return { hasNext: () => !!s && !d, next: () => { d = true; return { __folderId: s }; } }; }
  }; },
  getFileById: id => ({ getId: () => id, moveTo: () => {}, getParents: () => ({ hasNext: () => false }) })
};
const CACHE = {}; global.CacheService = { getScriptCache: () => ({ get: k => (k in CACHE ? CACHE[k] : null), put: (k, v) => { CACHE[k] = String(v); }, remove: k => { delete CACHE[k]; } }) };
const PROPS = { SEGREDO_SESSAO: 'segredo-de-teste-' + crypto.randomUUID(), PIMENTA_SENHA: crypto.randomBytes(32).toString('hex') }; // 18.2.1
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in PROPS ? PROPS[k] : null), setProperty: (k, v) => { PROPS[k] = String(v); }, deleteProperty: k => { delete PROPS[k]; } }) };
global.LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
const ENVIADOS = []; global.MailApp = { sendEmail: o => { ENVIADOS.push(o); } };
global.Logger = { log: () => {} };
global.ContentService = { MimeType: { JSON: 'JSON' }, createTextOutput: t => ({ setMimeType: () => ({ conteudo: t }) }) };
global.ScriptApp = { getService: () => ({ getUrl: () => 'https://script.local/exec' }), getProjectTriggers: () => [], newTrigger: () => ({}), deleteTrigger: () => {} };
global.Session = { getEffectiveUser: () => ({ getEmail: () => 'dono@exemplo.test' }) };
global.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{}' }) };

eval(fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8'));

/* ---- mundo ---- */
const sistema = new Workbook(SISTEMA_VMC_ID, 'Sistema_VMC'); WORKBOOKS[SISTEMA_VMC_ID] = sistema; sistema.abas = [];
const abaIndice = new Sheet(ABA_INDICE_SIGLAS, [['sigla_global', 'sigla', 'tipo', 'profissional_id', 'data_cadastro', 'email']]);
const abaProfs = new Sheet(ABA_PROFISSIONAIS, [['profissional_id', 'sigla', 'nome_completo', 'email', 'telefone', 'ativo', 'senha_hash', 'pasta_drive_id']]);
const abaAdmins = new Sheet(ABA_ADMINS, [['admin_id', 'sigla', 'nome_completo', 'email', 'ativo', 'senha_hash']]);
const abaTokens = new Sheet(ABA_TOKENS, [COLUNAS_TOKENS.slice()]);
sistema.abas.push(abaIndice, abaProfs, abaAdmins, abaTokens);
function criarProf(id, sigla, nome, email, senha) {
  const pastaId = novoId('pasta');
  const ctrl = new Workbook(novoId('ctrl'), NOME_CONTROLE);
  ctrl.abas = [new Sheet(ABA_PACIENTES, [['sigla', 'nome', 'email', 'telefone', 'ativo', 'senha_hash', 'data_cadastro', 'data_anamnese', 'link_planilha_individual', 'observacoes']])];
  WORKBOOKS[ctrl.id] = ctrl;
  const pp = novoId('pp'); FOLDERS[pp] = { files: [], subfolders: {} };
  FOLDERS[pastaId] = { files: [{ nome: NOME_CONTROLE, getId: () => ctrl.id }], subfolders: { Pacientes: pp } };
  abaProfs.appendRow([id, sigla, nome, email, '', 'Sim', gerarHashSenha(senha), pastaId]);
  abaIndice.appendRow([sigla + '|profissional|' + id, sigla, 'profissional', id, '2026-10-03', email]);
  return ctrl;
}
const aleat = () => crypto.randomBytes(12).toString('base64url');
const SENHA_PROF = aleat();
const ctrl = criarProf('PROF_NP', 'NP', 'Dra. Nova de Prova', 'np@exemplo.test', SENHA_PROF);
const sProf = { tipo: 'profissional', sigla: 'NP', profissional_id: 'PROF_NP', nome: 'Dra. Nova de Prova', email: 'np@exemplo.test' };
abaAdmins.appendRow(['ADM_N', 'ADM_N', 'Admin N', 'admn@exemplo.test', 'Sim', '']);
abaIndice.appendRow(['ADM_N|admin|ADM_N', 'ADM_N', 'admin', 'ADM_N', '2026-10-03', 'admn@exemplo.test']);

let passo = 0, falhas = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 200) : '')); } };
const abaPac = ctrl.getSheetByName(ABA_PACIENTES);
const colunaDoPac = (sigla, col) => {
  const d = abaPac.getDataRange().getValues(); const h = d[0];
  const i = d.findIndex((l, k) => k > 0 && String(l[h.indexOf('sigla')]).toUpperCase() === sigla);
  return i === -1 ? undefined : d[i][h.indexOf(col)];
};

console.log('N. Aceite da Política (POLITICA_VERSAO=' + POLITICA_VERSAO + ')');
// preparo: paciente novo por convite
const cad = cadastrarPaciente(sProf, { nomeCompleto: 'Paciente Aceite Um', email: 'ac1@exemplo.test', telefone: '' });
ok('preparo: paciente cadastrado com link de convite', cad.ok === true, cad);
const bruto = _brutoDoLink_(cad.link);
const senha1 = aleat() + 'A1';

const n3 = definirSenha(bruto);
ok('N3 probe diz exige_aceite=true e a versão da política', n3.ok && n3.exige_aceite === true && n3.politica_versao === POLITICA_VERSAO, n3);
const n1 = definirSenha(bruto, senha1);
ok('N1 ativar SEM aceite -> recusa clara e link continua válido', !n1.ok && n1.codigo === 'aceite_obrigatorio' && !!_linkValido_(bruto), n1);
const n8 = definirSenha(bruto, senha1, true, '2020-01');
ok('N8 aceite com versão errada -> recusa', !n8.ok && n8.codigo === 'aceite_obrigatorio', n8);
const n2 = definirSenha(bruto, senha1, true, POLITICA_VERSAO);
ok('N2 ativar COM aceite -> senha criada e colunas gravadas', n2.ok === true &&
  String(colunaDoPac(cad.sigla, 'aceite_politica_versao')) === POLITICA_VERSAO &&
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(colunaDoPac(cad.sigla, 'aceite_politica_em'))),
  { v: colunaDoPac(cad.sigla, 'aceite_politica_versao'), em: colunaDoPac(cad.sigla, 'aceite_politica_em') });
delete CACHE['falha:paciente:ac1@exemplo.test'];
const l1 = autenticar('paciente', 'ac1@exemplo.test', senha1);
ok('N2b login após ativação com aceite -> sem pendência', l1.ok === true && l1.perfil.aceite_pendente === false, l1.ok ? l1.perfil : l1);

// N4/N5: conta antiga (senha gravada direto, sem aceite — o caso do paciente VMC)
abaPac.appendRow(['VELHA', 'Paciente Antiga', 'velha@exemplo.test', '', 'Sim', gerarHashSenha('senha-antiga-' + aleat()), '2026-09-01', '', 'x', '']);
abaIndice.appendRow(['VELHA|paciente|PROF_NP', 'VELHA', 'paciente', 'PROF_NP', '2026-09-01', 'velha@exemplo.test']);
const senhaVelha = aleat() + 'V1';
_gravarSenhaDaConta_('paciente', 'VELHA', 'PROF_NP', senhaVelha);
delete CACHE['falha:paciente:velha@exemplo.test'];
const n4 = autenticar('paciente', 'velha@exemplo.test', senhaVelha);
ok('N4 login de conta sem aceite -> aceite_pendente=true (crachá emitido; cliente barra a entrada)', n4.ok === true && n4.perfil.aceite_pendente === true && !!n4.token, n4.ok ? n4.perfil : n4);
const sTok = _validarToken_(n4.token);
const n5 = aceitarPolitica(sTok);
ok('N5 aceitarPolitica com o crachá grava as duas colunas', n5.ok === true && n5.aceite === true &&
  String(colunaDoPac('VELHA', 'aceite_politica_versao')) === POLITICA_VERSAO, { n5, v: colunaDoPac('VELHA', 'aceite_politica_versao') });
delete CACHE['falha:paciente:velha@exemplo.test'];
const n5b = autenticar('paciente', 'velha@exemplo.test', senhaVelha);
ok('N5b login seguinte sem pendência', n5b.ok === true && n5b.perfil.aceite_pendente === false, n5b.ok ? n5b.perfil : n5b);
ok('N5c aceitarPolitica exige crachá de paciente', aceitarPolitica(null).codigo === 'sessao_expirada' && aceitarPolitica({ tipo: 'profissional' }).codigo === 'sessao_expirada');

// N6: redefinição de quem já aceitou — não pede de novo
const l6 = _criarLinkAtivacao_('paciente', 'VELHA', 'PROF_NP', 'redefinicao', 'velha@exemplo.test');
const b6 = _brutoDoLink_(l6);
const p6 = definirSenha(b6);
ok('N6 probe da redefinição de conta que já aceitou: exige_aceite=false', p6.ok && p6.exige_aceite === false, p6);
const senhaNova6 = aleat() + 'N6';
const r6 = definirSenha(b6, senhaNova6);
ok('N6b redefinição sem aceite funciona (já aceitou)', r6.ok === true, r6);

// N7: profissional e admin intactos
const l7 = _criarLinkAtivacao_('profissional', 'NP', 'PROF_NP', 'redefinicao', 'np@exemplo.test');
const p7 = definirSenha(_brutoDoLink_(l7));
ok('N7 probe de profissional: sem exigência de aceite', p7.ok && p7.exige_aceite === false, p7);
const r7 = definirSenha(_brutoDoLink_(l7), aleat() + 'P7');
ok('N7b profissional cria senha sem aceite', r7.ok === true, r7);
_gravarEmailIndice_('ADM_N', 'admin', 'admn@exemplo.test');
const l7c = _criarLinkAtivacao_('admin', 'ADM_N', 'ADM_N', 'convite', 'admn@exemplo.test');
const r7c = definirSenha(_brutoDoLink_(l7c), aleat() + 'A7');
ok('N7c admin cria senha sem aceite', r7c.ok === true, r7c);

ok('R1 VERSAO_PACOTE definida (era fixa em 18.1.6; a versao e conferida no teste do pacote corrente)', /^18\.\d/.test(VERSAO_PACOTE));
console.log('\n' + (falhas === 0 ? 'RESULTADO: OK — ' + passo + '/' + passo + ' provas' : 'RESULTADO: ' + falhas + ' FALHA(S) em ' + passo + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
