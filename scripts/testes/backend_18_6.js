/* Pacote 18.6 — Anamnese: testes em Node do Código.js REAL sobre planilhas simuladas (mocks do PACOTE_18_5_node.js).
   Blocos: A primeiro envio sem duplicar · B caminho da linha inteira fora, montador único · C histórico da anamnese ·
   Z zip_code como texto e versão.
   Uso: node PACOTE_18_6_node.js */
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

/* ================= Pacote 18.6 — provas ================= */
const histDe = sigla => planilhaDe(sigla).getSheetByName(ABA_ANAMNESE_HISTORICO);
const linhasHist = sigla => { const a = histDe(sigla); if (!a) return []; const h = cab(a); return a.getDataRange().getValues().slice(1).map(l => { const o = {}; h.forEach((c, i) => { o[c] = l[i]; }); return o; }); };
const FICHA = extra => Object.assign({ nome_completo: 'Paciente Anamnese Um', data_nascimento: '1990-05-10', rg: '0123', cpf: '012.345.678-90', profissao: 'Professora',
  reside_fora_brasil: 'Não', cep: '13010-000', estado: 'SP', cidade: 'Campinas', endereco_logradouro: 'Rua Um', endereco_numero: '10', endereco_bairro: 'Centro',
  tratamentos_anteriores: '10/10', medicacao_psico_atual: 'Sertralina; Outro: X', pessoa_confianca_1_nome: 'Fulana', pessoa_confianca_1_telefone: '19 99999-0000' }, extra || {});

let A1s, tokA1, abaN1;
console.log('A. Primeiro envio sem duplicar (8.44)');
tenta('A', () => {
  A1s = novoPaciente('Paciente Anamnese Um', 'a1@exemplo.test');
  tokA1 = comSenha(A1s);
  abaN1 = planilhaDe(A1s).getSheetByName(ABA_ANAMNESE);
  ok('A0 envio sem `dados` é recusado e nada é criado', post({ acao: 'salvarAnamnese', token: tokA1 }).ok === false && abaN1.getLastRow() === 1);
  const id1 = uuid();
  const r1 = post({ acao: 'salvarAnamnese', token: tokA1, dados: FICHA({ id_envio: id1 }) });
  const n0 = comoObj(abaN1, 2);
  ok('A1 primeiro envio: cria a linha 2 (uma ficha), e-mail do cadastro espelhado, sem histórico', r1.ok && abaN1.getLastRow() === 2 && n0.email === 'a1@exemplo.test' && n0.profissao === 'Professora' && !histDe(A1s), r1);
  const r2 = post({ acao: 'salvarAnamnese', token: tokA1, dados: FICHA({ id_envio: uuid(), profissao: 'Diretora', cidade: 'Valinhos' }) });
  const n1 = comoObj(abaN1, 2);
  ok('A2 segundo envio (id novo): NÃO cria linha; só o que mudou é gravado', r2.ok && !r2.duplicado && abaN1.getLastRow() === 2 &&
    JSON.stringify(mudaram(n0, n1)) === JSON.stringify(['autoria_campos', 'cidade', 'editado_em', 'editado_por', 'profissao']), mudaram(n0, n1));
  const au = autoria(abaN1, 2);
  ok('A3 segundo envio carimba os campos alterados (por = paciente) e devolve o que mudou', au && Object.keys(au).sort().join() === 'cidade,profissao' && au.profissao.por === 'paciente' && FMT_EM.test(au.profissao.em) &&
    JSON.stringify(r2.campos_alterados.slice().sort()) === '["cidade","profissao"]', au);
  ok('A4 timestamp, id_envio do primeiro envio e data de nascimento intactos', String(n1.timestamp) === String(n0.timestamp) && n1.id_envio === id1 && String(n1.data_nascimento) === String(n0.data_nascimento));
  const r3 = post({ acao: 'salvarAnamnese', token: tokA1, dados: { id_envio: uuid(), escolaridade: 'Superior' } });
  const n2 = comoObj(abaN1, 2);
  ok('A5 envio parcial (um campo só): os campos ausentes NÃO são apagados', r3.ok && abaN1.getLastRow() === 2 && n2.escolaridade === 'Superior' && n2.nome_completo === 'Paciente Anamnese Um' && n2.cpf === '012.345.678-90' && n2.endereco_logradouro === 'Rua Um' &&
    JSON.stringify(mudaram(n1, n2).filter(k => k !== 'editado_em')) === JSON.stringify(['autoria_campos', 'escolaridade']), mudaram(n1, n2)); // editado_em pode cair no mesmo segundo
  const r4 = post({ acao: 'salvarAnamnese', token: tokA1, dados: FICHA({ id_envio: id1, profissao: 'OUTRA' }) });
  ok('A6 reenvio com o id_envio do primeiro envio: duplicado, nada regravado', r4.ok && r4.duplicado === true && celula(abaN1, 2, 'profissao') === 'Diretora' && abaN1.getLastRow() === 2, r4);
  const idE = uuid();
  post({ acao: 'salvarAnamnese', token: tokA1, dados: { id_envio: idE, profissao: 'Gerente' } });
  const r5 = post({ acao: 'salvarAnamnese', token: tokA1, dados: { id_envio: idE, profissao: 'De novo' } });
  ok('A7 reenvio do segundo envio (mesmo id_envio) não regrava', r5.ok && r5.duplicado === true && celula(abaN1, 2, 'profissao') === 'Gerente', r5);
  const r6 = post({ acao: 'salvarAnamnese', token: tokA1, dados: { id_envio: uuid(), nome_completo: 'Nome Novo Um', email: 'forjado@exemplo.test', telefone: '11900000000' } });
  ok('A8 segundo envio: e-mail e telefone seguem o cadastro; indicador do nome atualizado', r6.ok && celula(abaN1, 2, 'email') === 'a1@exemplo.test' && autoria(abaN1, 2).email === undefined && ind(A1s, 'ind_nome') === 'Nome Novo Um', celula(abaN1, 2, 'email'));
  const trava0 = TRAVA.pegas;
  post({ acao: 'salvarAnamnese', token: tokA1, dados: { id_envio: uuid(), profissao: 'Com trava' } });
  ok('A9 o segundo envio roda dentro da trava de gravação', TRAVA.pegas === trava0 + 1 && TRAVA.pegas === TRAVA.soltas);
});

console.log('B. Caminho da linha inteira fora; montador único (8.44)');
tenta('B', () => {
  const antes = JSON.stringify(linhaToda(abaN1, 2));
  const rp = post({ acao: 'pacienteAtualizarAnamnese', token: tokA1, dados: { nome_completo: 'Linha Inteira' }, id_envio: uuid() });
  ok('B1 pacienteAtualizarAnamnese sem `campos` (cliente antigo com `dados`): recusado com a mensagem já existente, linha intacta', rp.ok === false && rp.erro === 'Dados da anamnese ausentes' && JSON.stringify(linhaToda(abaN1, 2)) === antes, rp);
  const rf = post({ acao: 'profSalvarAnamnese', token: tokProf, siglaPaciente: A1s, dados: { nome_completo: 'Linha Inteira' } });
  ok('B2 profSalvarAnamnese sem `campos`: recusado, linha e cadastro intactos', rf.ok === false && rf.erro === 'Dados da anamnese ausentes' && JSON.stringify(linhaToda(abaN1, 2)) === antes, rf);
  const cPac = corpoDe(FONTE.replace(/\r\n/g, '\n'), 'pacienteAtualizarAnamnese'), cProf = corpoDe(FONTE.replace(/\r\n/g, '\n'), 'profSalvarAnamnese'), cSalvar = corpoDe(FONTE.replace(/\r\n/g, '\n'), 'salvarAnamnese');
  const monta = c => (c.match(/montarLinha\(|appendRow\(|setValues\(/g) || []).length;
  ok('B3 montador único: só salvarAnamnese monta a linha da ficha; as duas edições não montam nem regravam linha', monta(cPac) === 0 && monta(cProf) === 0 && (cSalvar.match(/montarLinha\(/g) || []).length === 1 && (cSalvar.match(/appendRow\(/g) || []).length === 1);
  ok('B4 órfãos zero: nenhuma menção a porCampos nem a `payload.dados` nas duas edições', FONTE.indexOf('porCampos') === -1 && !/pacienteAtualizarAnamnese\([^)]*payload\.dados/.test(FONTE) && !/profSalvarAnamnese\([^)]*payload\.dados/.test(FONTE));
  const n0 = comoObj(abaN1, 2);
  const re = post({ acao: 'pacienteAtualizarAnamnese', token: tokA1, campos: { rg: '0456' }, id_envio: uuid() });
  const n1 = comoObj(abaN1, 2);
  ok('B5 edição com um campo: campo ausente não apaga célula; "0456" fica texto', re.ok && n1.rg === '0456' && JSON.stringify(mudaram(n0, n1).filter(k => k !== 'editado_em')) === JSON.stringify(['autoria_campos', 'rg']), mudaram(n0, n1));
  const SEM = novoPaciente('Sem Ficha', 'semficha@exemplo.test');
  ok('B6 edição sem ficha enviada: recusada, nada criado (nem ficha, nem histórico)', semMemo(() => pacienteAtualizarAnamnese(SEM, { profissao: 'X' }, uuid())).ok === false &&
    semMemo(() => profSalvarAnamnese(sProf, SEM, null, { profissao: 'X' }, uuid())).ok === false && planilhaDe(SEM).getSheetByName(ABA_ANAMNESE).getLastRow() === 1 && !histDe(SEM));
});

console.log('C. Histórico da anamnese (Anamnese_Historico)');
tenta('C', () => {
  const H = novoPaciente('Paciente Historico', 'h1@exemplo.test');
  const tokH = comSenha(H);
  const abaN = planilhaDe(H).getSheetByName(ABA_ANAMNESE);
  post({ acao: 'salvarAnamnese', token: tokH, dados: FICHA({ id_envio: uuid(), nome_completo: 'Paciente Historico' }) });
  ok('C1 primeiro envio não cria a aba de histórico', !histDe(H) && abaN.getLastRow() === 2);
  const r1 = post({ acao: 'pacienteAtualizarAnamnese', token: tokH, campos: { profissao: 'Diretora', tratamentos_anteriores: 'nenhum', cidade: 'Campinas', data_nascimento: '1990-05-10' }, id_envio: uuid() });
  const h1 = linhasHist(H), au1 = autoria(abaN, 2);
  ok('C2 aba criada no primeiro uso, cabeçalho campo|valor_anterior|por|em', !!histDe(H) && cab(histDe(H)).join('|') === 'campo|valor_anterior|por|em');
  ok('C3 uma linha por campo EFETIVAMENTE alterado (2 de 4 enviados), com o valor anterior certo', r1.ok && h1.length === 2 && h1.map(l => l.campo).sort().join() === 'profissao,tratamentos_anteriores' &&
    h1.find(l => l.campo === 'profissao').valor_anterior === 'Professora' && h1.find(l => l.campo === 'tratamentos_anteriores').valor_anterior === '10/10', h1);
  ok('C4 quem e quando: por = paciente (do crachá); em = o mesmo instante do carimbo, como texto', h1.every(l => l.por === 'paciente' && typeof l.em === 'string' && FMT_EM.test(l.em)) && h1[0].em === au1.profissao.em, h1.map(l => [l.por, l.em]));
  const r2 = post({ acao: 'pacienteAtualizarAnamnese', token: tokH, campos: { profissao: 'Diretora', cidade: 'Campinas' }, id_envio: uuid() });
  ok('C5 nada mudou: nenhuma linha nova no histórico', r2.ok && r2.campos_alterados.length === 0 && linhasHist(H).length === 2);
  const r3 = post({ acao: 'profSalvarAnamnese', token: tokProf, siglaPaciente: H, campos: { profissao: 'Reitora', data_nascimento: '1991-06-11', rg: '0999' }, id_envio: uuid() });
  const h3 = linhasHist(H).slice(2);
  ok('C6 edição do profissional: por = profissional; valor anterior = o que o paciente tinha gravado; data anterior em aaaa-mm-dd; "0123" segue texto', r3.ok && h3.length === 3 && h3.every(l => l.por === 'profissional') &&
    h3.find(l => l.campo === 'profissao').valor_anterior === 'Diretora' && h3.find(l => l.campo === 'data_nascimento').valor_anterior === '1990-05-10' && h3.find(l => l.campo === 'rg').valor_anterior === '0123', h3);
  const r4 = post({ acao: 'salvarAnamnese', token: tokH, dados: { id_envio: uuid(), profissao: 'Aposentada' } });
  const h4 = linhasHist(H).slice(5);
  ok('C7 segundo salvarAnamnese (vira edição) também registra o histórico', r4.ok && h4.length === 1 && h4[0].campo === 'profissao' && h4[0].valor_anterior === 'Reitora' && h4[0].por === 'paciente', h4);
  const n0 = linhasHist(H).length;
  const r5 = post({ acao: 'pacienteAtualizarAnamnese', token: tokH, id_envio: uuid(),
    campos: { cidade: '=1+1', autoria_campos: '{"x":{"por":"profissional","em":"1999-01-01 00:00:00"}}', editado_por: 'profissional', valor_anterior: 'forjado', campo: 'forjado', por: 'profissional', em: '1999-01-01 00:00:00', Anamnese_Historico: 'x' } });
  const h5 = linhasHist(H).slice(n0), au5 = autoria(abaN, 2);
  ok('C8 autoria e histórico nunca aceitos do cliente: só `cidade` grava; carimbo e histórico saem do crachá', r5.ok && JSON.stringify(r5.campos_alterados) === '["cidade"]' && h5.length === 1 && h5[0].campo === 'cidade' && h5[0].por === 'paciente' &&
    h5[0].valor_anterior === 'Campinas' && h5[0].em !== '1999-01-01 00:00:00' && au5.x === undefined && au5.cidade.por === 'paciente' && celula(abaN, 2, 'editado_por') === 'paciente' && cab(abaN).indexOf('valor_anterior') === -1, { h5, au5 });
  post({ acao: 'pacienteAtualizarAnamnese', token: tokH, campos: { cidade: 'Campinas' }, id_envio: uuid() });
  const ult = linhasHist(H).pop();
  ok('C9 valor anterior perigoso ("=1+1") fica texto literal no histórico (passa por _celulaTexto_)', ult.campo === 'cidade' && ult.valor_anterior === '=1+1' && typeof ult.valor_anterior === 'string', ult);
  const idR = uuid(), antes = linhasHist(H).length;
  post({ acao: 'pacienteAtualizarAnamnese', token: tokH, campos: { profissao: 'Uma vez' }, id_envio: idR });
  post({ acao: 'pacienteAtualizarAnamnese', token: tokH, campos: { profissao: 'Uma vez' }, id_envio: idR });
  ok('C10 reenvio da mesma edição não duplica o histórico', linhasHist(H).length === antes + 1);
  const fonteLF = FONTE.replace(/\r\n/g, '\n');
  const acoes = (fonteLF.match(/^ *case '[A-Za-z0-9_]+':/gm) || []).length;
  ok('C11 nenhuma ação de leitura nova do histórico: 48 ações no doPost (44 + as 4 do 18.8.1); o histórico só é citado por quem grava', acoes === 48 && (fonteLF.match(/_historicoDaAnamnese_\(/g) || []).length === 2 && (fonteLF.match(/ABA_ANAMNESE_HISTORICO/g) || []).length === 3, acoes);
  ok('C12 as três ações que gravam a anamnese estão na trava', ['salvarAnamnese', 'pacienteAtualizarAnamnese', 'profSalvarAnamnese'].every(a => ACOES_COM_TRAVA.indexOf(a) !== -1));
});

console.log('Z. zip_code (8.51) e versão');
tenta('Z', () => {
  const Zs = novoPaciente('Paciente Exterior', 'z1@exemplo.test');
  const tokZ = comSenha(Zs);
  const abaN = planilhaDe(Zs).getSheetByName(ABA_ANAMNESE);
  const r = post({ acao: 'salvarAnamnese', token: tokZ, dados: { id_envio: uuid(), nome_completo: 'Paciente Exterior', reside_fora_brasil: 'Sim', pais: 'Estados Unidos', zip_code: '02134', cep_exterior: 'CHAVE ANTIGA', endereco_exterior: '1 Main St' } });
  ok('Z1 zip_code do primeiro envio gravado como texto (zero à esquerda); a chave antiga cep_exterior não vira coluna', r.ok && celula(abaN, 2, 'zip_code') === '02134' && typeof celula(abaN, 2, 'zip_code') === 'string' && cab(abaN).indexOf('cep_exterior') === -1, celula(abaN, 2, 'zip_code'));
  const e = post({ acao: 'pacienteAtualizarAnamnese', token: tokZ, campos: { zip_code: '00501' }, id_envio: uuid() });
  ok('Z2 zip_code editado por campo: texto, com histórico do valor anterior', e.ok && celula(abaN, 2, 'zip_code') === '00501' && linhasHist(Zs)[0].valor_anterior === '02134', celula(abaN, 2, 'zip_code'));
  ok('Z3 cabeçalho do servidor tem zip_code e não tem cep_exterior', HEADERS_ANAMNESE.indexOf('zip_code') !== -1 && HEADERS_ANAMNESE.indexOf('cep_exterior') === -1);
  ok('Z4 VERSAO_PACOTE definida e o ping a devolve (era fixa em 18.6.2; a versao e conferida no pacote corrente)', (typeof VERSAO_PACOTE === 'string' && VERSAO_PACOTE.length > 0) && post({ acao: 'ping' }).versao_pacote === VERSAO_PACOTE);
  ok('Z5 nenhuma função temporária no código', FONTE.indexOf('TEMP18_') === -1 && !/function (prova|copia|cabecalhos)18_/.test(FONTE));
});

console.log('M. 18.6.1 — nome de quem alterou dentro do carimbo');
tenta('M', () => {
  const Ms = novoPaciente('Paciente Do Carimbo', 'm1@exemplo.test');
  const tokM = comSenha(Ms);
  const wbM = planilhaDe(Ms), abaN = wbM.getSheetByName(ABA_ANAMNESE), abaA = wbM.getSheetByName(ABA_AUTOMONITORAMENTO), abaS = wbM.getSheetByName(ABA_ESCALAS);
  post({ acao: 'salvarAutomonitoramento', token: tokM, dados: registro({ id_envio: uuid() }) });
  const ts = semMemo(() => lerHistorico(Ms)).automonitoramento[0].timestamp;
  post({ acao: 'pacienteEditarAutomonitoramento', token: tokM, timestamp: ts, campos: { humor_observacoes: 'sem ficha ainda' }, id_envio: uuid() });
  ok('M1 paciente sem ficha: o carimbo leva o nome do cadastro', autoria(abaA, 2).humor_observacoes.nome === 'Paciente Do Carimbo' && autoria(abaA, 2).humor_observacoes.por === 'paciente', autoria(abaA, 2));
  post({ acao: 'salvarAnamnese', token: tokM, dados: FICHA({ id_envio: uuid(), nome_completo: 'Nome Da Ficha Completo' }) });
  const r1 = post({ acao: 'pacienteAtualizarAnamnese', token: tokM, campos: { profissao: 'Diretora' }, id_envio: uuid() });
  const a1 = autoria(abaN, 2);
  ok('M2 paciente com ficha: o carimbo leva o nome da anamnese; a resposta devolve o carimbo com o nome', a1.profissao.nome === 'Nome Da Ficha Completo' && a1.profissao.por === 'paciente' && FMT_EM.test(a1.profissao.em) && r1.autoria_campos.profissao.nome === 'Nome Da Ficha Completo', a1);
  post({ acao: 'profSalvarAnamnese', token: tokProf, siglaPaciente: Ms, campos: { cidade: 'Valinhos' }, id_envio: uuid() });
  post({ acao: 'profEditarAutomonitoramento', token: tokProf, siglaPaciente: Ms, timestamp: ts, campos: { humor_nivel: 2 }, id_envio: uuid() });
  const a2 = autoria(abaN, 2), a3 = autoria(abaA, 2);
  ok('M3 profissional: nome_completo do cadastro, na anamnese e no registro; o carimbo do paciente não muda', a2.cidade.nome === 'Dra. Nova de Prova' && a2.cidade.por === 'profissional' && a3.humor_nivel.nome === 'Dra. Nova de Prova' && a2.profissao.nome === 'Nome Da Ficha Completo' && a3.humor_observacoes.nome === 'Paciente Do Carimbo', { a2, a3 });
  const itens = {}; for (let i = 1; i <= 9; i++) itens['item_0' + i] = 1;
  post({ acao: 'profCriarEscala', token: tokProf, siglaPaciente: Ms, dados: Object.assign({ id_envio: uuid(), instrumento: 'PHQ-9', versao_instrumento: 'v1', data_aplicacao: '2026-10-03' }, itens) });
  const tsE = semMemo(() => lerEscalas(Ms)).escalas[0].timestamp;
  post({ acao: 'profEditarEscala', token: tokProf, siglaPaciente: Ms, timestamp: tsE, campos: { item_01: 3 }, id_envio: uuid() });
  ok('M4 escala editada pelo profissional: carimbo com o nome', autoria(abaS, 2).item_01.nome === 'Dra. Nova de Prova', autoria(abaS, 2));
  post({ acao: 'pacienteAtualizarAnamnese', token: tokM, id_envio: uuid(), campos: { estado: 'RJ', nome: 'Forjado', autoria_campos: '{"estado":{"por":"profissional","em":"1999-01-01 00:00:00","nome":"Forjado"}}' } });
  const a4 = autoria(abaN, 2);
  ok('M5 nome forjado pelo cliente descartado: o nome sai da conta do crachá', a4.estado.nome === 'Nome Da Ficha Completo' && a4.estado.por === 'paciente' && JSON.stringify(a4).indexOf('Forjado') === -1, a4.estado);
  const lido = post({ acao: 'lerHistorico', token: tokM });
  ok('M6 a leitura do paciente devolve os carimbos com os nomes (anamnese e registro)', JSON.parse(lido.anamnese.autoria_campos).cidade.nome === 'Dra. Nova de Prova' && JSON.parse(lido.automonitoramento[0].autoria_campos).humor_nivel.nome === 'Dra. Nova de Prova');
  post({ acao: 'profCriarAutomonitoramento', token: tokProf, siglaPaciente: Ms, dados: registro({ id_envio: uuid(), criado_por_nome: 'Forjado', criado_por: 'paciente' }) });
  const lidoM = post({ acao: 'lerHistorico', token: tokM }), lidoE = post({ acao: 'lerEscalas', token: tokM });
  ok('M8 (18.6.2) registro e escala criados pelo profissional guardam criado_por_nome (do cadastro, nunca do cliente) e as leituras do paciente o devolvem', celula(abaA, abaA.getLastRow(), 'criado_por_nome') === 'Dra. Nova de Prova' && celula(abaA, abaA.getLastRow(), 'criado_por') === 'profissional' && celula(abaS, 2, 'criado_por_nome') === 'Dra. Nova de Prova' &&
    lidoM.automonitoramento[lidoM.automonitoramento.length - 1].criado_por_nome === 'Dra. Nova de Prova' && lidoE.escalas[0].criado_por_nome === 'Dra. Nova de Prova' && String(celula(abaA, 2, 'criado_por_nome') || '') === '', [celula(abaA, abaA.getLastRow(), 'criado_por_nome'), celula(abaS, 2, 'criado_por_nome')]);
  ok('M7 _carimbar_ sem nome não cria a chave (carimbo antigo continua válido)', !('nome' in _carimbar_('', ['x'], 'paciente', '2026-10-03 10:00:00').mapa.x) && _nomeDeQuemAltera_('paciente', 'NAOEXISTE', 'PROF_NP') === '');
});

console.log('\nRESULTADO: ' + (falhas === 0 ? 'OK — ' + passo + '/' + passo + ' provas' : falhas + ' FALHA(S) em ' + passo + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
