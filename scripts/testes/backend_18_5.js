/* Pacote 18.5 — Registro e edição pelo profissional: testes em Node do Código.js REAL sobre planilhas simuladas
   (mocks do PACOTE_18_10a_node.js). Blocos: E edição por campo com carimbo · X pelo doPost · P presença sem trava ·
   C criação pelo profissional · S escore do servidor = motor do frontend · K edição de escala · N anamnese por campo ·
   L leitura paginada e por colunas (8.87) · Q data do aceite na lista.
   Uso: node PACOTE_18_5_node.js */
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

/* ---- instrumentos: contadores de abertura de planilha, busca no Drive, trava e e-mail ---- */
const ABERTURAS = []; const abrirReal = global.SpreadsheetApp.openById;
global.SpreadsheetApp.openById = id => { ABERTURAS.push(String(id)); return abrirReal(id); };
let buscasDrive = 0; const pastaReal = global.DriveApp.getFolderById;
global.DriveApp.getFolderById = id => { buscasDrive++; return pastaReal(id); };
const TRAVA = { pegas: 0, soltas: 0, ocupada: false };
global.LockService = { getScriptLock: () => ({
  waitLock: () => { if (TRAVA.ocupada) throw new Error('Lock timeout'); TRAVA.pegas++; },
  releaseLock: () => { TRAVA.soltas++; } }) };
const EMAILS = []; global.MailApp = { sendEmail: m => { EMAILS.push(m); } };
const errosLog = []; console.error = (...a) => errosLog.push(a.join(' '));
/* cada gravação ganha um segundo próprio (no teste tudo roda no mesmo segundo e o timestamp é a chave da edição) */
let tique = 0; const formatarReal = global.Utilities.formatDate;
global.Utilities.formatDate = (d, tz, fmt) => formatarReal(fmt === 'yyyy-MM-dd HH:mm:ss' ? new Date(d.getTime() + (++tique) * 1000) : d, tz, fmt);

const FONTE = fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8');
eval(FONTE);
/* Código da produção (@33, tag v18.2.1) para a prova de paridade da lista e do diff zero da trava de presença */
const FONTE_BASE = require('child_process').execSync('git show v18.2.1:Código.js', { cwd: path.join(__dirname, '..', '..'), maxBuffer: 1 << 26 }).toString('utf8');
const BASE = new Function(FONTE_BASE + '\nreturn { listarPacientesDoProfissional: listarPacientesDoProfissional };')();

/* ---- mundo ---- */
const sistema = new Workbook(SISTEMA_VMC_ID, 'Sistema_VMC'); WORKBOOKS[SISTEMA_VMC_ID] = sistema; sistema.abas = [];
const abaIndice = new Sheet(ABA_INDICE_SIGLAS, [['sigla_global', 'sigla', 'tipo', 'profissional_id', 'data_cadastro', 'email']]);
const abaProfs = new Sheet(ABA_PROFISSIONAIS, [['profissional_id', 'sigla', 'nome_completo', 'email', 'telefone', 'crp', 'data_inicio', 'ativo', 'senha_hash', 'pasta_drive_id', 'data_cadastro']]);
const abaAdmins = new Sheet(ABA_ADMINS, [['admin_id', 'sigla', 'nome_completo', 'email', 'ativo', 'senha_hash']]);
sistema.abas.push(abaIndice, abaProfs, abaAdmins);
const pastaProfId = novoId('pasta'), pastaPacId = novoId('pasta');
FOLDERS[pastaPacId] = { files: [], subfolders: {} };
const ctrl = new Workbook(novoId('ctrl'), NOME_CONTROLE);
ctrl.abas = [new Sheet(ABA_PACIENTES, [['sigla', 'senha_hash', 'link_planilha_individual', 'data_cadastro', 'data_anamnese', 'ativo', 'observacoes', 'email', 'telefone', 'nome']])];
WORKBOOKS[ctrl.id] = ctrl;
FOLDERS[pastaProfId] = { files: [{ nome: NOME_CONTROLE, getId: () => ctrl.id }], subfolders: { Pacientes: pastaPacId } };
PROPS.PIMENTA_SENHA = crypto.randomBytes(32).toString('hex');
const hashProf = gerarHashSenha('senha-do-prof-Aa1'), hashAdm = gerarHashSenha('senha-do-adm-Aa1');
abaProfs.appendRow(['PROF_NP', 'NP', 'Dra. Nova de Prova', 'np@exemplo.test', '', '06/999999', '', 'Sim', hashProf, pastaProfId, '2026-10-03']);
abaIndice.appendRow(['NP|profissional|PROF_NP', 'NP', 'profissional', 'PROF_NP', '2026-10-03', 'np@exemplo.test']);
abaAdmins.appendRow(['ADM_N', 'ADM_N', 'Admin N', 'admn@exemplo.test', 'Sim', hashAdm]);
abaIndice.appendRow(['ADM_N|admin|ADM_N', 'ADM_N', 'admin', 'ADM_N', '2026-10-03', 'admn@exemplo.test']);
const sProf = { tipo: 'profissional', sigla: 'NP', profissional_id: 'PROF_NP', nome: 'Dra. Nova de Prova', email: 'np@exemplo.test' };
const sAdm = { tipo: 'admin', sigla: 'ADM_N', profissional_id: 'ADM_N' };

let passo = 0, falhas = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 300) : '')); } };
const tenta = (n, f) => { try { f(); } catch (e) { ok(n + ' (exceção)', false, String(e && e.stack || e).slice(0, 400)); } };
const cab = aba => aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
const celula = (aba, linha, col) => { const i = cab(aba).indexOf(col); return i < 0 ? undefined : aba.getRange(linha, i + 1).getValue(); };
const linhaDe = (aba, colChave, chave) => { const d = aba.getDataRange().getValues(); const i = d[0].indexOf(colChave); return d.findIndex((l, k) => k > 0 && String(l[i]).toUpperCase() === String(chave).toUpperCase()) + 1; };
const abaPac = ctrl.getSheetByName(ABA_PACIENTES);
const uuid = () => crypto.randomUUID();
const post = corpo => JSON.parse(doPost({ postData: { contents: JSON.stringify(corpo) } }).conteudo);
const cracha = (tipo, sigla, id, hash) => emitirToken({ tipo: tipo, sigla: sigla, profissional_id: id, impressao: impressaoCracha(hash) }, PROPS.SEGREDO_SESSAO, Date.now());
const novoPaciente = (nome, email) => { _memoZerar_(); const r = cadastrarPaciente(sProf, { nomeCompleto: nome, email: email, telefone: '' }); if (!r.ok) throw new Error(r.erro); return r.sigla; };
const planilhaDe = sigla => WORKBOOKS[extrairIdDaUrl(celula(abaPac, linhaDe(abaPac, 'sigla', sigla), 'link_planilha_individual'))];
const ind = (sigla, col) => celula(abaPac, linhaDe(abaPac, 'sigla', sigla), col);
const semMemo = f => { _memoZerar_(); return f(); };
const registro = extra => Object.assign({ data_registro: '2026-10-02', hora_registro: '10:30', humor_nivel: 4, humor_observacoes: 'ok', neg_preenchido: 'sim', pos_preenchido: '' }, extra || {});
const escala = extra => Object.assign({ data_aplicacao: '2026-10-02', instrumento: 'PHQ-9', versao_instrumento: '1', item_01: 1, escore_total: 9, faixa: 'Leve', alerta_risco_flag: '', alerta_risco_item: '', alerta_risco_valor: '' }, extra || {});

/* ================= Pacote 18.5 — provas ================= */
const FONTE_TAG = require('child_process').execSync('git show v18.10:Código.js', { cwd: path.join(__dirname, '..', '..'), maxBuffer: 1 << 26 }).toString('utf8').replace(/\r\n/g, '\n');
const corpoDe = (src, nome) => { const i = src.indexOf('function ' + nome + '('); if (i < 0) return null; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return null; };
const linhaToda = (aba, n) => aba.getRange(n, 1, 1, aba.getLastColumn()).getValues()[0].slice();
const comoObj = (aba, n) => { const h = cab(aba), l = linhaToda(aba, n), o = {}; h.forEach((c, i) => { o[c] = l[i]; }); return o; };
const mudaram = (antes, depois) => Object.keys(depois).filter(k => String(antes[k]) !== String(depois[k])).sort();
const autoria = (aba, n) => { try { return JSON.parse(celula(aba, n, 'autoria_campos') || '{}'); } catch (e) { return null; } };
const sOutroProf = { tipo: 'profissional', sigla: 'OX', profissional_id: 'PROF_OUTRO', nome: 'Outro', email: 'ox@exemplo.test' };
const hashPac = sigla => celula(abaPac, linhaDe(abaPac, 'sigla', sigla), 'senha_hash');
const comSenha = sigla => { semMemo(() => _gravarHashDaConta_('paciente', sigla, 'PROF_NP', gerarHashSenha('senha-' + sigla + '-Aa1'))); semMemo(() => _gravarAceitePolitica_(sigla, 'PROF_NP')); return cracha('paciente', sigla.toUpperCase(), 'PROF_NP', hashPac(sigla)); };
const tokProf = cracha('profissional', 'NP', 'PROF_NP', hashProf);
const FMT_EM = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const regNeg = extra => registro(Object.assign({ neg_sit_o_que: 'briga no trabalho', neg_emo_tristeza: 'Triste:3 | Desanimado:2', neg_comp_o_que: 'saí da sala' }, extra || {}));

let E1, E2, tsE, abaE1;
console.log('E. Edição por campo (automonitoramento)');
tenta('E', () => {
  E1 = novoPaciente('Paciente Edição Um', 'e1@exemplo.test');
  abaE1 = planilhaDe(E1).getSheetByName(ABA_AUTOMONITORAMENTO);
  semMemo(() => salvarAutomonitoramento(E1, regNeg({ id_envio: uuid() })));
  const L = abaE1.getLastRow();
  tsE = semMemo(() => lerHistorico(E1)).automonitoramento[0].timestamp;
  const a0 = comoObj(abaE1, L);
  const r1 = semMemo(() => pacienteEditarAutomonitoramento(E1, tsE, null, { humor_observacoes: 'nova observação' }, uuid()));
  const a1 = comoObj(abaE1, L);
  ok('E1 edição parcial: só o campo enviado muda (mais editado, editado_por, editado_em e autoria_campos)', r1.ok && JSON.stringify(mudaram(a0, a1)) === JSON.stringify(['autoria_campos', 'editado', 'editado_em', 'editado_por', 'humor_observacoes']), mudaram(a0, a1));
  const au1 = autoria(abaE1, L);
  ok('E2 autoria_campos só com a chave alterada, por = paciente, em = aaaa-MM-dd HH:mm:ss', au1 && Object.keys(au1).join() === 'humor_observacoes' && au1.humor_observacoes.por === 'paciente' && FMT_EM.test(au1.humor_observacoes.em), au1);
  ok('E3 a resposta diz o que mudou e devolve a autoria', JSON.stringify(r1.campos_alterados) === '["humor_observacoes"]' && r1.autoria_campos.humor_observacoes.por === 'paciente' && !!r1.editado_em, r1);
  // dois editores, campos distintos, cada um mandando só o seu (os dois partiram da mesma leitura)
  const rp = semMemo(() => profEditarAutomonitoramento(sProf, E1, tsE, null, { neg_sit_o_que: 'briga com o chefe' }, uuid()));
  const rc = semMemo(() => pacienteEditarAutomonitoramento(E1, tsE, null, { humor_nivel: 2 }, uuid()));
  const a2 = comoObj(abaE1, L), au2 = autoria(abaE1, L);
  ok('E4 dois editores em campos distintos: os dois valores ficam', rp.ok && rc.ok && a2.neg_sit_o_que === 'briga com o chefe' && Number(a2.humor_nivel) === 2 && a2.humor_observacoes === 'nova observação', a2);
  ok('E5 carimbo de cada campo diz quem alterou', au2.neg_sit_o_que.por === 'profissional' && au2.humor_nivel.por === 'paciente' && au2.humor_observacoes.por === 'paciente', au2);
  ok('E6 os outros campos do registro ficaram como estavam', a2.neg_emo_tristeza === a0.neg_emo_tristeza && a2.neg_comp_o_que === a0.neg_comp_o_que && String(a2.data_registro) === String(a0.data_registro) && String(a2.timestamp) === String(a0.timestamp));
  // mesmo campo: último vence
  semMemo(() => pacienteEditarAutomonitoramento(E1, tsE, null, { neg_comp_o_que: 'versão do paciente' }, uuid()));
  semMemo(() => profEditarAutomonitoramento(sProf, E1, tsE, null, { neg_comp_o_que: 'versão do profissional' }, uuid()));
  const au3 = autoria(abaE1, L);
  ok('E7 mesmo campo: vale a última gravação e o carimbo é do último', celula(abaE1, L, 'neg_comp_o_que') === 'versão do profissional' && au3.neg_comp_o_que.por === 'profissional' && celula(abaE1, L, 'editado_por') === 'profissional', au3);
  ok('E8 os carimbos dos outros campos não foram tocados', au3.humor_nivel.em === au2.humor_nivel.em && au3.neg_sit_o_que.em === au2.neg_sit_o_que.em);
  // carimbo e autoria nunca aceitos do cliente
  const forjado = { humor_nivel: 5, autoria_campos: '{"neg_sit_o_que":{"por":"profissional","em":"1999-01-01 00:00:00"}}', criado_por: 'profissional', editado_por: 'profissional', editado_em: '1999-01-01T00:00:00', timestamp: '1999-01-01 00:00:00', versao_formulario: 'v9' };
  semMemo(() => pacienteEditarAutomonitoramento(E1, tsE, null, forjado, uuid()));
  const au4 = autoria(abaE1, L), a4 = comoObj(abaE1, L);
  ok('E9 carimbo forjado pelo cliente é descartado (autoria, criado_por, editado_por, timestamp e versão ficam do servidor)', au4.humor_nivel.por === 'paciente' && au4.neg_sit_o_que.em === au2.neg_sit_o_que.em && (a4.criado_por === '' || a4.criado_por === undefined) && a4.editado_por === 'paciente' && String(a4.editado_em).indexOf('1999') === -1 && String(a4.timestamp) === String(a0.timestamp) && a4.versao_formulario === VERSAO_FORM_AUTO, { au4, criado: a4.criado_por });
  // nada mudou → nada gravado
  const antesIgual = comoObj(abaE1, L);
  const rIgual = semMemo(() => pacienteEditarAutomonitoramento(E1, tsE, null, { humor_nivel: '5', neg_comp_o_que: 'versão do profissional', data_registro: '2026-10-02', hora_registro: '10:30' }, uuid()));
  ok('E10 valor igual ao da planilha (inclusive data e hora retipadas pelo Sheets) não é gravado nem carimbado', rIgual.ok && rIgual.campos_alterados.length === 0 && mudaram(antesIgual, comoObj(abaE1, L)).length === 0, { r: rIgual, m: mudaram(antesIgual, comoObj(abaE1, L)) });
  // cliente antigo: manda a linha inteira em `dados`
  const linhaInteira = Object.assign({}, semMemo(() => lerHistorico(E1)).automonitoramento[0], { humor_observacoes: 'pelo cliente antigo' });
  const rAnt = semMemo(() => pacienteEditarAutomonitoramento(E1, tsE, linhaInteira));
  ok('E11 cliente antigo (linha toda em `dados`): o servidor grava e carimba só o que mudou de fato', rAnt.ok && JSON.stringify(rAnt.campos_alterados) === '["humor_observacoes"]' && celula(abaE1, L, 'humor_observacoes') === 'pelo cliente antigo', rAnt.campos_alterados);
  // reenvio da mesma edição
  const idRep = uuid();
  semMemo(() => pacienteEditarAutomonitoramento(E1, tsE, null, { humor_observacoes: 'primeira' }, idRep));
  semMemo(() => profEditarAutomonitoramento(sProf, E1, tsE, null, { humor_observacoes: 'do profissional, depois' }, uuid()));
  const rRep = semMemo(() => pacienteEditarAutomonitoramento(E1, tsE, null, { humor_observacoes: 'primeira' }, idRep));
  ok('E12 "Tentar de novo" com o mesmo id_envio não regrava por cima de quem editou depois', rRep.ok && rRep.duplicado === true && celula(abaE1, L, 'humor_observacoes') === 'do profissional, depois', celula(abaE1, L, 'humor_observacoes'));
  semMemo(() => pacienteEditarAutomonitoramento(E1, tsE, null, { neg_sit_o_que: '=1+1', humor_observacoes: '10/10' }, uuid()));
  ok('E13 texto editado passa pela trava de células (nunca fórmula, nunca retipado)', celula(abaE1, L, 'neg_sit_o_que') === '=1+1' && celula(abaE1, L, 'humor_observacoes') === '10/10', [celula(abaE1, L, 'neg_sit_o_que'), celula(abaE1, L, 'humor_observacoes')]);
  ok('E14 paciente de outro profissional: edição recusada', semMemo(() => profEditarAutomonitoramento(sOutroProf, E1, tsE, null, { humor_nivel: 1 }, uuid())).ok === false && Number(celula(abaE1, L, 'humor_nivel')) === 5);
  ok('E15 coluna que não existe na aba é ignorada', semMemo(() => pacienteEditarAutomonitoramento(E1, tsE, null, { coluna_inventada: 'x' }, uuid())).campos_alterados.length === 0 && cab(abaE1).indexOf('coluna_inventada') === -1);
  const grande = {}; for (let i = 0; i < 900; i++) grande['campo_' + i] = { por: 'paciente', em: '2026-10-01 10:' + String(i % 60).padStart(2, '0') + ':00' };
  errosLog.length = 0;
  const cortado = _carimbar_(JSON.stringify(grande), ['novo'], 'profissional', '2026-10-03 12:00:00');
  ok('E16 autoria acima de 40.000 caracteres: ficam os 200 campos mais recentes (o novo entre eles) e o corte vai para o log', Object.keys(cortado.mapa).length === AUTORIA_MANTER && cortado.mapa.novo.por === 'profissional' && cortado.json.length <= AUTORIA_MAX && errosLog.some(l => l.indexOf('autoria_campos') !== -1), Object.keys(cortado.mapa).length);
});

console.log('X. Edição por campo pelo doPost (crachás de paciente e de profissional)');
tenta('X', () => {
  const tokE1 = comSenha(E1); const L = abaE1.getLastRow();
  const rp = post({ acao: 'pacienteEditarAutomonitoramento', token: tokE1, timestamp: tsE, campos: { humor_nivel: 1 }, id_envio: uuid() });
  const rf = post({ acao: 'profEditarAutomonitoramento', token: tokProf, siglaPaciente: E1, timestamp: tsE, campos: { neg_emo_tristeza: 'Triste:5' }, id_envio: uuid() });
  const au = autoria(abaE1, L);
  ok('X1 pelo doPost: paciente e profissional editam campos distintos e os dois persistem com o carimbo certo', rp.ok && rf.ok && Number(celula(abaE1, L, 'humor_nivel')) === 1 && celula(abaE1, L, 'neg_emo_tristeza') === 'Triste:5' && au.humor_nivel.por === 'paciente' && au.neg_emo_tristeza.por === 'profissional', { rp, rf });
  TRAVA.ocupada = true;
  const oc = post({ acao: 'profCriarAutomonitoramento', token: tokProf, siglaPaciente: E1, dados: regNeg({ id_envio: uuid() }) });
  const oc2 = post({ acao: 'profEditarEscala', token: tokProf, siglaPaciente: E1, timestamp: 'x', campos: { item_01: 1 }, id_envio: uuid() });
  TRAVA.ocupada = false;
  ok('X2 as ações novas rodam dentro da trava de gravação (trava ocupada → "ocupado", nada gravado)', oc.codigo === 'ocupado' && oc2.codigo === 'ocupado' && abaE1.getLastRow() === L && ['profCriarAutomonitoramento', 'profCriarEscala', 'profEditarEscala'].every(a => ACOES_COM_TRAVA.indexOf(a) !== -1), oc);
  const semCracha = post({ acao: 'profCriarEscala', siglaPaciente: E1, dados: {} });
  const comPac = post({ acao: 'profCriarAutomonitoramento', token: tokE1, siglaPaciente: E1, dados: regNeg({ id_envio: uuid() }) });
  ok('X3 ação nova sem crachá ou com crachá de paciente é recusada', semCracha.codigo === 'sessao_expirada' && comPac.ok === false && abaE1.getLastRow() === L, { semCracha, comPac });
});

console.log('P. Presença: aviso, não trava');
tenta('P', () => {
  ['profMarcarEditandoAuto', 'profLimparEditandoAuto'].forEach(n => ok('P· ' + n + ' com diff zero contra a tag v18.10', corpoDe(FONTE.replace(/\r\n/g, '\n'), n) === corpoDe(FONTE_TAG, n) && !!corpoDe(FONTE_TAG, n)));
  const L = abaE1.getLastRow();
  const m = semMemo(() => profMarcarEditandoAuto(sProf, E1, tsE));
  const lido = semMemo(() => lerEditandoAuto(E1, tsE));
  const r = semMemo(() => pacienteEditarAutomonitoramento(E1, tsE, null, { humor_observacoes: 'editei com o profissional presente' }, uuid()));
  ok('P4 com o profissional marcado como editando, o paciente edita e grava (a presença não bloqueia)', m.ok && lido.editando_quem === 'profissional:NP' && r.ok && celula(abaE1, L, 'humor_observacoes') === 'editei com o profissional presente', { lido, r });
  ok('P5 as colunas editando_* continuam na aba (contrato vivo)', cab(abaE1).indexOf('editando_quem') !== -1 && cab(abaE1).indexOf('editando_desde') !== -1);
});

console.log('C. Criação pelo profissional');
tenta('C', () => {
  E2 = novoPaciente('Paciente Criação Dois', 'e2@exemplo.test');
  const wb = planilhaDe(E2), abaA = wb.getSheetByName(ABA_AUTOMONITORAMENTO), abaS = wb.getSheetByName(ABA_ESCALAS);
  semMemo(() => salvarRascunho(E2, 'auto_negativo', { tipo: 'neg', dados: { humor_nivel: 3 } }));
  const id = uuid(), n0 = abaA.getLastRow();
  const r = semMemo(() => profCriarAutomonitoramento(sProf, E2, regNeg({ id_envio: id, criado_por: 'paciente', editado_por: 'paciente', timestamp: '1999-01-01 00:00:00' })));
  const L = abaA.getLastRow(), o = comoObj(abaA, L);
  ok('C1 o profissional cria o registro: uma linha nova com o conteúdo enviado', r.ok && L === n0 + 1 && o.neg_sit_o_que === 'briga no trabalho' && Number(o.humor_nivel) === 4 && o.id_envio === id, o);
  ok("C2 criado_por e editado_por = 'profissional' e editado_em gravados pelo servidor (o que o cliente mandou é descartado)", o.criado_por === 'profissional' && o.editado_por === 'profissional' && String(o.editado_em) !== '' && String(o.editado_em).indexOf('1999') === -1 && String(o.timestamp instanceof Date ? o.timestamp.getFullYear() : o.timestamp).indexOf('1999') === -1, o);
  const rd = semMemo(() => profCriarAutomonitoramento(sProf, E2, regNeg({ id_envio: id, humor_nivel: 1 })));
  ok('C3 reenvio com o mesmo id_envio: duplicado, uma linha só', rd.ok && rd.duplicado === true && abaA.getLastRow() === L);
  ok('C4 criação sem id_envio é recusada', semMemo(() => profCriarAutomonitoramento(sProf, E2, regNeg())).ok === false && abaA.getLastRow() === L);
  ok('C5 indicadores do paciente atualizados na mesma chamada', ind(E2, 'ind_total_auto') === 1 && JSON.parse(ind(E2, 'ind_ultimo_auto')).humor === 4, ind(E2, 'ind_ultimo_auto'));
  ok('C6 o rascunho do paciente não é tocado pela criação do profissional', semMemo(() => lerRascunhos(E2)).rascunhos.length === 1);
  ok('C7 paciente de outro profissional: criação recusada', semMemo(() => profCriarAutomonitoramento(sOutroProf, E2, regNeg({ id_envio: uuid() }))).ok === false && abaA.getLastRow() === L);
  semMemo(() => salvarAutomonitoramento(E2, regNeg({ id_envio: uuid(), criado_por: 'profissional' })));
  ok('C8 registro enviado pelo paciente: criado_por fica vazio mesmo que o cliente mande', comoObj(abaA, abaA.getLastRow()).criado_por === '');
  const hist = semMemo(() => lerHistorico(E2)).automonitoramento;
  ok('C9 o histórico do paciente traz criado_por de cada registro (para a faixa "registrado pelo seu psicólogo")', hist.length === 2 && hist[0].criado_por === 'profissional' && hist[1].criado_por === '', hist.map(x => x.criado_por));
  // escala criada pelo profissional: escore do servidor
  const itens = {}; [1, 2, 3, 4, 5, 6, 7, 8].forEach(i => { itens['item_0' + i] = 2; }); itens.item_09 = 1;
  const idE = uuid(), e0 = abaS.getLastRow();
  const re = semMemo(() => profCriarEscala(sProf, E2, Object.assign({ id_envio: idE, instrumento: 'PHQ-9', versao_instrumento: 'v1', data_aplicacao: '2026-10-03', escore_total: 99, faixa: 'Inventada', alerta_risco_flag: 'NAO', item_funcional: 1, item_funcional_texto: 'Um pouco difícil', observacoes: '' }, itens)));
  const oe = comoObj(abaS, abaS.getLastRow());
  ok('C10 escala criada pelo profissional: escore, faixa e alerta recalculados pelo servidor (o que o cliente mandou é ignorado)', re.ok && abaS.getLastRow() === e0 + 1 && Number(oe.escore_total) === 17 && oe.faixa === 'Depressão moderadamente grave' && oe.alerta_risco_flag === 'SIM' && oe.alerta_risco_item === 'PHQ9_item9' && String(oe.alerta_risco_valor) === '1', oe);
  ok("C11 escala criada pelo profissional: criado_por e editado_por = 'profissional'", oe.criado_por === 'profissional' && oe.editado_por === 'profissional' && oe.id_envio === idE);
  const semItem = Object.assign({ id_envio: uuid(), instrumento: 'PHQ-9' }, itens); delete semItem.item_05;
  const foraFaixa = Object.assign({ id_envio: uuid(), instrumento: 'PHQ-9' }, itens, { item_05: 7 });
  ok('C12 escala incompleta, com resposta fora da faixa, de instrumento desconhecido ou sem id_envio é recusada sem gravar', [semItem, foraFaixa, Object.assign({ id_envio: uuid(), instrumento: 'XYZ' }, itens), Object.assign({ instrumento: 'PHQ-9' }, itens)].every(d => semMemo(() => profCriarEscala(sProf, E2, d)).ok === false) && abaS.getLastRow() === e0 + 1);
  ok('C13 alerta e última escala chegam aos indicadores da lista', JSON.parse(ind(E2, 'ind_ultima_escala')).nome === 'PHQ-9' && JSON.parse(ind(E2, 'ind_alertas_json')).item === 'PHQ9_item9');
});

console.log('S. Escore do servidor = escore do paciente (motor do frontend)');
tenta('S', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index-dev.html'), 'utf8').replace(/\r\n/g, '\n');
  const ini = html.indexOf('const ESC_ESCALAS = {'), fim = html.indexOf('\n};', ini) + 3;
  const motor = new Function(html.slice(ini, fim) + '\n' + corpoDe(html, 'escValorNumerico') + '\n' + corpoDe(html, 'escCalcularEscoreEAlerta') + '\nreturn { ESC_ESCALAS: ESC_ESCALAS, calc: escCalcularEscoreEAlerta };')();
  ok('S0 a tabela do servidor cobre os mesmos instrumentos do frontend', Object.keys(motor.ESC_ESCALAS).sort().join() === Object.keys(ESCALAS_CALCULO).sort().join(), Object.keys(ESCALAS_CALCULO));
  // o que o cliente grava (escEnviarEscala) a partir do cálculo dele
  const doCliente = calc => ({
    escore_total: calc.escoreTotal,
    escore_depressao: (calc.subescalas && calc.subescalas.depressao) ? calc.subescalas.depressao.escore : '',
    escore_ansiedade: (calc.subescalas && calc.subescalas.ansiedade) ? calc.subescalas.ansiedade.escore : '',
    escore_estresse: (calc.subescalas && calc.subescalas.estresse) ? calc.subescalas.estresse.escore : '',
    faixa: calc.faixa ? calc.faixa.rotulo : (calc.subescalas ? ('Dep:' + calc.subescalas.depressao.faixa.rotulo + ' | Ans:' + calc.subescalas.ansiedade.faixa.rotulo + ' | Est:' + calc.subescalas.estresse.faixa.rotulo) : ''),
    alerta_risco_flag: calc.alertaFlag, alerta_risco_item: calc.alertaItem, alerta_risco_valor: calc.alertaValor });
  let semente = 20261003; const rnd = n => { semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente % n; };
  Object.keys(motor.ESC_ESCALAS).forEach(cod => {
    const def = motor.ESC_ESCALAS[cod], max = ESCALAS_CALCULO[cod].max; let iguais = 0, total = 0, primeiro = null;
    const casos = [];
    for (let v = 0; v <= max; v++) casos.push(def.itens.map(() => v));           // tudo no mínimo … tudo no máximo
    for (let k = 0; k < 400; k++) casos.push(def.itens.map(() => rnd(max + 1)));   // aleatórios (semente fixa)
    casos.forEach(vals => {
      const respostas = {}, cols = {};
      def.itens.forEach((it, i) => { respostas[it.id] = vals[i]; cols['item_' + String(it.id).padStart(2, '0')] = vals[i]; });
      const cli = doCliente(motor.calc(cod, respostas)), srv = _escoresDaEscala_(cod, c => cols[c]);
      total++;
      if (srv.ok && JSON.stringify(srv.campos) === JSON.stringify(cli)) iguais++; else if (!primeiro) primeiro = { vals, cli, srv };
    });
    ok('S· ' + cod + ': ' + total + ' respostas → escore, subescores, faixa e alerta idênticos aos do cliente', iguais === total, primeiro);
  });
  const com2b = _escoresDaEscala_('BDI-II', c => (c === 'item_16' ? '2b' : 1));
  ok('S8 BDI-II: resposta com letra ("2b") pontua só o dígito, como no cliente', com2b.ok && com2b.campos.escore_total === 22, com2b);
});

console.log('K. Edição de escala pelo profissional');
tenta('K', () => {
  const abaS = planilhaDe(E2).getSheetByName(ABA_ESCALAS), L = abaS.getLastRow();
  const esc = semMemo(() => lerEscalas(E2)).escalas; const ts = esc[esc.length - 1].timestamp;
  const a0 = comoObj(abaS, L);
  const r = semMemo(() => profEditarEscala(sProf, E2, ts, { item_09: 0, item_01: 3, escore_total: 0, faixa: 'Forjada', alerta_risco_flag: 'NAO', criado_por: 'paciente' }, uuid()));
  const a1 = comoObj(abaS, L), au = autoria(abaS, L);
  ok('K1 só os itens alterados são gravados; escore, faixa e alerta recalculados pelo servidor', r.ok && Number(a1.item_09) === 0 && Number(a1.item_01) === 3 && Number(a1.escore_total) === 17 && a1.faixa === 'Depressão moderadamente grave' && a1.alerta_risco_flag === 'NAO' && a1.alerta_risco_item === '' && Number(a1.item_02) === 2 && a1.criado_por === 'profissional', a1);
  ok('K2 carimbo só nos itens que o profissional alterou (colunas calculadas não levam carimbo)', au && Object.keys(au).sort().join() === 'item_01,item_09' && au.item_09.por === 'profissional' && FMT_EM.test(au.item_09.em), au);
  ok('K3 a resposta devolve o registro como ficou', r.registro && Number(r.registro.escore_total) === 17 && r.registro.instrumento === 'PHQ-9' && JSON.stringify(r.campos_alterados.slice().sort()) === '["item_01","item_09"]', r.campos_alterados);
  ok('K4 colunas que mudaram: só itens, escore/alerta derivados, editado_* e autoria', JSON.stringify(mudaram(a0, a1)) === JSON.stringify(['alerta_risco_flag', 'alerta_risco_item', 'alerta_risco_valor', 'autoria_campos', 'editado_em', 'item_01', 'item_09']), mudaram(a0, a1));
  const antes = comoObj(abaS, L);
  const ruim = semMemo(() => profEditarEscala(sProf, E2, ts, { item_03: 9 }, uuid()));
  ok('K5 resposta fora da faixa: recusada, nada gravado', ruim.ok === false && mudaram(antes, comoObj(abaS, L)).length === 0, ruim);
  ok('K6 escala de outro profissional ou timestamp inexistente: recusada', semMemo(() => profEditarEscala(sOutroProf, E2, ts, { item_03: 1 }, uuid())).ok === false && semMemo(() => profEditarEscala(sProf, E2, '2000-01-01T00:00:00.000Z', { item_03: 1 }, uuid())).ok === false);
  ok('K7 só escore/faixa no payload (sem item): nada é gravado', semMemo(() => profEditarEscala(sProf, E2, ts, { escore_total: 1, faixa: 'X' }, uuid())).campos_alterados.length === 0 && Number(celula(abaS, L, 'escore_total')) === 17);
  ok('K8 item além do tamanho do instrumento (PHQ-9 tem 9) é ignorado', semMemo(() => profEditarEscala(sProf, E2, ts, { item_15: 2 }, uuid())).campos_alterados.length === 0 && celula(abaS, L, 'item_15') === '');
  ok('K9 indicadores acompanham a edição (o alerta do item 9 saiu)', ind(E2, 'ind_alertas_json') === '', ind(E2, 'ind_alertas_json'));
  const lida = semMemo(() => lerEscalas(E2)).escalas.pop();
  ok('K10 o paciente lê a escala com autoria_campos e criado_por', typeof lida.autoria_campos === 'string' && JSON.parse(lida.autoria_campos).item_09.por === 'profissional' && lida.criado_por === 'profissional');
});

console.log('N. Anamnese por campo');
tenta('N', () => {
  const abaN = planilhaDe(E1).getSheetByName(ABA_ANAMNESE);
  semMemo(() => salvarAnamnese(E1, { nome_completo: 'Paciente Edição Um', profissao: 'Professora', cidade: 'Campinas', endereco_numero: '10', data_nascimento: '1990-05-10', id_envio: uuid() }));
  const a0 = comoObj(abaN, 2);
  const r = semMemo(() => pacienteAtualizarAnamnese(E1, { profissao: 'Diretora', email: 'outro@exemplo.test', telefone: '11999990000', data_nascimento: '1990-05-10' }, uuid()));
  const a1 = comoObj(abaN, 2), au = autoria(abaN, 2);
  ok('N1 paciente edita um campo: só ele muda na linha 2 (e-mail e telefone seguem o cadastro; data igual não é regravada)', r.ok && JSON.stringify(mudaram(a0, a1)) === JSON.stringify(['autoria_campos', 'editado_em', 'editado_por', 'profissao']) && a1.profissao === 'Diretora' && a1.email === 'e1@exemplo.test', mudaram(a0, a1));
  ok('N2 carimbo da anamnese: por = paciente', au && Object.keys(au).join() === 'profissao' && au.profissao.por === 'paciente' && FMT_EM.test(au.profissao.em), au);
  const rp = semMemo(() => profSalvarAnamnese(sProf, E1, null, { cidade: 'Valinhos', endereco_numero: '0123' }, uuid()));
  const a2 = comoObj(abaN, 2), au2 = autoria(abaN, 2);
  ok('N3 profissional edita outros campos: os dois editores persistem, carimbos certos, número com zero à esquerda fica texto', rp.ok && a2.profissao === 'Diretora' && a2.cidade === 'Valinhos' && a2.endereco_numero === '0123' && au2.profissao.por === 'paciente' && au2.cidade.por === 'profissional' && a2.editado_por === 'profissional', a2);
  ok('N4 nome_completo e timestamp da anamnese intactos; uma linha só', a2.nome_completo === 'Paciente Edição Um' && String(a2.timestamp) === String(a0.timestamp) && abaN.getLastRow() === 2);
  const rc = semMemo(() => profSalvarAnamnese(sProf, E1, { email: 'novo.e1@exemplo.test', telefone: '19988887777' }, { estado: 'SP' }, uuid()));
  ok('N5 contato trocado junto: cadastro atualizado e espelhado na anamnese, sem carimbo de e-mail', rc.ok && celula(abaN, 2, 'email') === 'novo.e1@exemplo.test' && String(celula(abaN, 2, 'telefone')) === '19988887777' && celula(abaN, 2, 'estado') === 'SP' && autoria(abaN, 2).email === undefined, [celula(abaN, 2, 'email'), celula(abaN, 2, 'telefone')]);
  const rAntigo = post({ acao: 'profSalvarAnamnese', token: tokProf, siglaPaciente: E1, dados: { nome_completo: 'Linha Inteira' } });
  ok('N6 (18.6) cliente antigo (linha inteira em `dados`, sem `campos`) é recusado e nada muda', rAntigo.ok === false && celula(abaN, 2, 'nome_completo') === 'Paciente Edição Um' && celula(abaN, 2, 'profissao') === 'Diretora' && abaN.getLastRow() === 2, rAntigo);
  const E3 = novoPaciente('Sem Anamnese', 'e3@exemplo.test');
  ok('N7 edição por campo sem anamnese enviada: recusada, nada criado', semMemo(() => pacienteAtualizarAnamnese(E3, { profissao: 'X' }, uuid())).ok === false && planilhaDe(E3).getSheetByName(ABA_ANAMNESE).getLastRow() === 1);
});

console.log('L. Leituras do paciente: por colunas e paginadas (8.87)');
tenta('L', () => {
  const G = novoPaciente('Paciente Grande', 'g@exemplo.test');
  const wb = planilhaDe(G), abaA = wb.getSheetByName(ABA_AUTOMONITORAMENTO), abaS = wb.getSheetByName(ABA_ESCALAS);
  const hA = cab(abaA), hS = cab(abaS);
  const linhaA = (i, neg) => hA.map(c => c === 'timestamp' ? new Date(2026, 0, 1, 8, 0, i) : c === 'data_registro' ? new Date(Date.UTC(2026, 0, 1 + (i % 28))) : c === 'humor_nivel' ? (i % 5) + 1 : c === 'neg_preenchido' ? (neg ? 'sim' : '') : c === 'pos_preenchido' ? (neg ? '' : 'sim') : c === 'humor_observacoes' ? 'obs ' + i : c === 'id_envio' ? 'id-envio-' + i : c === 'versao_formulario' ? 'v1' : '');
  for (let i = 1; i <= 130; i++) abaA.dados.push(linhaA(i, i === 3));
  for (let i = 1; i <= 70; i++) abaS.dados.push(hS.map(c => c === 'timestamp' ? new Date(2026, 1, 1, 9, 0, i) : c === 'instrumento' ? 'GAD-7' : c === 'escore_total' ? i % 21 : c === 'item_01' ? i % 4 : c === 'id_envio' ? 'esc-' + i : ''));
  const p1 = semMemo(() => lerHistorico(G));
  ok('L1 histórico: só os 60 registros mais recentes, em ordem cronológica, com o total real', p1.ok && p1.automonitoramento.length === 60 && p1.total_registros === 130 && p1.tem_mais === true && p1.automonitoramento[0].humor_observacoes === 'obs 71' && p1.automonitoramento[59].humor_observacoes === 'obs 130', [p1.automonitoramento.length, p1.total_registros, (p1.automonitoramento[0] || {}).humor_observacoes]);
  const p2 = semMemo(() => lerHistorico(G, 60)), p3 = semMemo(() => lerHistorico(G, 120)), p4 = semMemo(() => lerHistorico(G, 130));
  const todos = p3.automonitoramento.concat(p2.automonitoramento, p1.automonitoramento).map(r => r.humor_observacoes);
  ok('L2 "carregar mais" busca os anteriores: 60 + 60 + 10, sem repetir nem pular; depois do fim, lista vazia', p2.automonitoramento.length === 60 && p2.tem_mais === true && p3.automonitoramento.length === 10 && p3.tem_mais === false && p4.automonitoramento.length === 0 && p4.tem_mais === false && todos.length === 130 && todos.every((o, i) => o === 'obs ' + (i + 1)), [p2.automonitoramento.length, p3.automonitoramento.length, p4.automonitoramento.length]);
  const chaves = Object.keys(p1.automonitoramento[0]);
  ok('L3 só as colunas da lista explícita: sem versao_formulario, id_envio e editando_desde; com as de autoria', chaves.every(c => COLUNAS_LEITURA_AUTO.indexOf(c) !== -1) && ['versao_formulario', 'id_envio', 'editando_desde'].every(c => chaves.indexOf(c) === -1) && ['timestamp', 'data_registro', 'humor_nivel', 'neg_preenchido', 'neg_emo_tristeza', 'pos_comp_aceitacao', 'criado_por', 'autoria_campos', 'editado_por'].every(c => chaves.indexOf(c) !== -1), chaves.length);
  ok('L4 toda coluna de conteúdo da aba Automonitoramento está na lista (nenhum campo do registro some da leitura)', HEADERS_AUTOMONITORAMENTO.filter(c => ['versao_formulario', 'id_envio', 'editando_desde'].indexOf(c) === -1).every(c => COLUNAS_LEITURA_AUTO.indexOf(c) !== -1) && HEADERS_ESCALAS.filter(c => ['versao_formulario', 'id_envio'].indexOf(c) === -1).every(c => COLUNAS_LEITURA_ESCALAS.indexOf(c) !== -1));
  ok('L5 data e timestamp saem no formato de sempre (aaaa-mm-dd e ISO)', /^\d{4}-\d{2}-\d{2}$/.test(p1.automonitoramento[0].data_registro) && /^\d{4}-\d{2}-\d{2}T/.test(p1.automonitoramento[0].timestamp), p1.automonitoramento[0].data_registro);
  ok('L6 a anamnese vem só na primeira página', 'anamnese_preenchida' in p1 && !('anamnese' in p2) && !('anamnese_preenchida' in p2));
  ok('L7 tem_negativo olha a aba inteira (o único Negativo está fora da página)', p1.tem_negativo === true && p1.automonitoramento.every(r => r.neg_preenchido !== 'sim') && semMemo(() => lerHistorico(E2)).tem_negativo === true);
  const pequeno = semMemo(() => lerHistorico(E1));
  ok('L8 paciente com poucos registros: tudo numa página, tem_mais false', pequeno.automonitoramento.length === pequeno.total_registros && pequeno.tem_mais === false && pequeno.total_registros === 1);
  const vazio = semMemo(() => lerHistorico(novoPaciente('Paciente Vazio', 'v@exemplo.test')));
  ok('L9 paciente sem registros: lista vazia, total 0, tem_negativo false', vazio.ok && vazio.automonitoramento.length === 0 && vazio.total_registros === 0 && vazio.tem_mais === false && vazio.tem_negativo === false);
  const e1 = semMemo(() => lerEscalas(G)), e2 = semMemo(() => lerEscalas(G, 60));
  ok('L10 escalas: 60 mais recentes + 10 anteriores, total real, só as colunas da lista', e1.escalas.length === 60 && e1.total === 70 && e1.tem_mais === true && e2.escalas.length === 10 && e2.tem_mais === false && Number(e1.escalas[59].escore_total) === 70 % 21 && Object.keys(e1.escalas[0]).every(c => COLUNAS_LEITURA_ESCALAS.indexOf(c) !== -1) && Object.keys(e1.escalas[0]).indexOf('id_envio') === -1, [e1.escalas.length, e1.total, e2.escalas.length]);
  ok('L11 limite pedido pelo cliente é respeitado até o teto', semMemo(() => lerHistorico(G, 0, 10)).automonitoramento.length === 10 && semMemo(() => lerHistorico(G, 0, 5000)).automonitoramento.length === 130 - 0 > PAGINA_LEITURA_MAX ? false : semMemo(() => lerHistorico(G, 0, 5000)).automonitoramento.length === Math.min(130, PAGINA_LEITURA_MAX));
  // pelo doPost: cada planilha aberta uma vez e a linha do paciente lida uma vez
  const tokG = comSenha(G);
  let leiturasPac = 0; const lerReal = abaPac.getDataRange.bind(abaPac);
  abaPac.getDataRange = () => { leiturasPac++; return lerReal(); };
  ABERTURAS.length = 0;
  const viaPost = post({ acao: 'lerHistorico', token: tokG });
  const viaPost2 = post({ acao: 'lerEscalas', token: tokG, antes: 60 });
  abaPac.getDataRange = lerReal;
  ok('L12 pelo doPost: resposta paginada, cada planilha aberta uma vez por chamada e a linha do paciente lida uma vez', viaPost.ok && viaPost.automonitoramento.length === 60 && viaPost2.escalas.length === 10 && ABERTURAS.length === 6 && new Set(ABERTURAS.slice(0, 3)).size === 3 && leiturasPac === 2, { aberturas: ABERTURAS.length, leiturasPac });
  const grav = post({ acao: 'pacienteEditarAutomonitoramento', token: tokG, timestamp: viaPost.automonitoramento[59].timestamp, campos: { humor_observacoes: 'pós-leitura' }, id_envio: uuid() });
  ok('L13 a memória da linha do paciente vale só para as duas leituras (gravação continua lendo o dado na hora)', grav.ok && _MEMO_.linhas === undefined && celula(abaA, abaA.getLastRow(), 'humor_observacoes') === 'pós-leitura');
});

console.log('Q. Data do aceite na lista do profissional');
tenta('Q', () => {
  const lista = semMemo(() => listarPacientesDoProfissional(sProf)).pacientes;
  const de = sigla => lista.find(p => p.sigla === sigla);
  ok('Q1 paciente com aceite: aceite_em em DD/MM/AAAA', /^\d{2}\/\d{2}\/\d{4}$/.test(de(E1).aceite_em), de(E1).aceite_em);
  ok('Q2 paciente sem aceite: campo vazio', de(E2).aceite_em === '', de(E2).aceite_em);
  ok('Q3 conversão da data: texto do servidor, Date de linha antiga e vazio', _dataDoAceite_('2026-10-03 14:05:09') === '03/10/2026' && _dataDoAceite_(new Date(2026, 9, 3, 14, 5)) === '03/10/2026' && _dataDoAceite_('') === '' && _dataDoAceite_('lixo') === '');
  ok('Q4 senha_hash e a hora do aceite não vão para a lista', JSON.stringify(lista).indexOf('v3$') === -1 && lista.every(p => !('aceite_politica_em' in p) && !('senha_hash' in p)));
});

console.log('\nRESULTADO: ' + (falhas === 0 ? 'OK — ' + passo + '/' + passo + ' provas' : falhas + ' FALHA(S) em ' + passo + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
