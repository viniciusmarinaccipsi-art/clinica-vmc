/* Pacote 18.8.1 — Assinatura dos convites: testes em Node do Código.js REAL sobre planilhas simuladas
   (mundo e ajudantes da suíte backend_18_5.js; arquivo gerado por ..\PACOTE_18_8_1_gerar_teste.js).
   Blocos: G gênero na assinatura e e-mail sem linhas de formação · M "Meus dados" (gênero na hora, pedido de
   alteração) · A o admin aprova e recusa · K carimbo com o nome lido do cadastro na hora de mostrar.
   Uso: node scripts/testes/backend_18_8_1.js */
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


/* ================= Pacote 18.8.1 — provas ================= */
const linhaProf = id => linhaDe(abaProfs, 'profissional_id', id);
const doProf = (id, col) => celula(abaProfs, linhaProf(id), col);

console.log('G. Gênero na assinatura; e-mail sem as linhas de formação');
tenta('G', () => {
  ok('G1 sem gênero: "Psicólogo — CRP" (como sempre foi)', JSON.stringify(_assinaturaDe_('Fulano', '06/1')) === '["Fulano","Psicólogo — CRP 06/1"]' && _assinaturaDe_('Fulano', '06/1', '')[1] === 'Psicólogo — CRP 06/1');
  ok('G2 gênero M: "Psicólogo — CRP"', _assinaturaDe_('Fulano', '06/1', 'M')[1] === 'Psicólogo — CRP 06/1' && _assinaturaDe_('Fulano', '06/1', 'm')[1] === 'Psicólogo — CRP 06/1');
  ok('G3 gênero F: "Psicóloga — CRP"', _assinaturaDe_('Fulana', '06/1', 'F')[1] === 'Psicóloga — CRP 06/1' && _assinaturaDe_('Fulana', 'CRP 06/1', ' f ')[1] === 'Psicóloga — CRP 06/1');
  ok('G4 sem CRP a assinatura é só o nome, com qualquer gênero', ['', 'M', 'F'].every(g => JSON.stringify(_assinaturaDe_('Fulana', '', g)) === '["Fulana"]') && _assinaturaDe_('', '06/1', 'F').length === 0);
  ok('G5 valor estranho na célula do gênero vale como vazio', _generoDe_('X') === '' && _generoDe_(null) === '' && _generoDe_(1) === '' && _assinaturaDe_('F', '06/1', 'Feminino')[1] === 'Psicólogo — CRP 06/1');
  const e = montarEmail('convite', 'Fulano', 'https://x/?ativar=abc', '', _assinaturaDe_('Fulana de Tal', '06/1', 'F'));
  ok('G6 o e-mail termina na assinatura: nenhuma linha de formação no texto nem no HTML', /\nFulana de Tal\nPsicóloga — CRP 06\/1$/.test(e.texto) && /<strong>Fulana de Tal<\/strong><br><span[^>]*>Psicóloga — CRP 06\/1<\/span><\/p><\/td><\/tr>\n<\/table>/.test(e.html) && !/UNICAMP|PUC-RS|Mestrando|Especializa/.test(e.texto + e.html), e.texto.slice(-120));
  const semAss = montarEmail('redefinicao', '', 'https://x/?ativar=abc');
  ok('G7 sem assinatura o e-mail não ganha parágrafo vazio', !/<p><\/p>/.test(semAss.html) && typeof EMAIL_FORMACAO === 'undefined' && FONTE.indexOf('EMAIL_FORMACAO') === -1);
});

console.log('M. "Meus dados" do profissional');
let tokPacM;
tenta('M', () => {
  const entrar = () => post({ acao: 'autenticar', tipo: 'profissional', email: 'np@exemplo.test', senha: 'senha-do-prof-Aa1' });
  const e0 = entrar();
  ok('M1 o login do profissional devolve o gênero (vazio enquanto ele não escolhe)', e0.ok && e0.perfil.genero === '' && e0.perfil.nome_completo === 'Dra. Nova de Prova', e0.perfil);
  const tok = e0.token;
  const l0 = post({ acao: 'profLerMeusDados', token: tok });
  ok('M2 profLerMeusDados devolve o cadastro e nenhum pedido', l0.ok && l0.pedido === null && JSON.stringify(l0.dados) === JSON.stringify({ sigla: 'NP', nomeCompleto: 'Dra. Nova de Prova', email: 'np@exemplo.test', telefone: '', crp: '06/999999', genero: '' }), l0);
  ok('M3 a leitura não devolve senha_hash nem a pasta', JSON.stringify(l0).indexOf('v3$') === -1 && JSON.stringify(l0).indexOf('pasta') === -1);
  const r1 = post({ acao: 'profSalvarMeusDados', token: tok, dados: { genero: 'F', nomeCompleto: 'Dra. Nova de Prova', email: 'NP@exemplo.test', telefone: '', crp: '06/999999' } });
  ok('M4 só o gênero mudou: grava na hora, sem pedido (e-mail com outra caixa é o mesmo e-mail)', r1.ok && r1.pedido === null && r1.dados.genero === 'F' && doProf('PROF_NP', 'genero') === 'F' && doProf('PROF_NP', 'pedido_alteracao') === '', r1);
  ok('M5 o login seguinte já traz o gênero', entrar().perfil.genero === 'F');
  EMAILS.length = 0;
  const pacM = novoPaciente('Paciente Do Convite', 'pm@exemplo.test');
  const conv = semMemo(() => profEnviarConvite(sProf, pacM, 'email'));
  ok('M6 com gênero F o convite do paciente sai assinado "Psicóloga — CRP"', conv.ok && EMAILS.length === 1 && /\nDra\. Nova de Prova\nPsicóloga — CRP 06\/999999$/.test(EMAILS[0].body), EMAILS.length ? EMAILS[0].body.slice(-120) : conv);
  ok('M7 gênero inválido é recusado e nada muda', post({ acao: 'profSalvarMeusDados', token: tok, dados: { genero: 'X' } }).ok === false && doProf('PROF_NP', 'genero') === 'F');
  const r2 = post({ acao: 'profSalvarMeusDados', token: tok, dados: { genero: 'F', nomeCompleto: 'Dra. Nova de Prova Silva', email: 'np@exemplo.test', telefone: '(19) 99999-0000', crp: '06/999999' } });
  ok('M8 nome e telefone alterados viram PEDIDO: o cadastro não muda', r2.ok && r2.pedido && JSON.stringify(r2.pedido.campos) === JSON.stringify({ nomeCompleto: 'Dra. Nova de Prova Silva', telefone: '19999990000' }) && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r2.pedido.em) && doProf('PROF_NP', 'nome_completo') === 'Dra. Nova de Prova' && doProf('PROF_NP', 'telefone') === '' && r2.dados.nomeCompleto === 'Dra. Nova de Prova', r2);
  const l2 = post({ acao: 'profLerMeusDados', token: tok });
  ok('M9 a leitura seguinte mostra o cadastro e o pedido pendente', l2.ok && l2.dados.nomeCompleto === 'Dra. Nova de Prova' && l2.pedido && l2.pedido.campos.nomeCompleto === 'Dra. Nova de Prova Silva', l2);
  const r3 = post({ acao: 'profSalvarMeusDados', token: tok, dados: { genero: 'F', nomeCompleto: 'Dra. Nova de Prova', email: 'np@exemplo.test', telefone: '', crp: '06/111111' } });
  ok('M10 salvar de novo SUBSTITUI o pedido (um por vez)', r3.ok && JSON.stringify(r3.pedido.campos) === '{"crp":"06/111111"}' && JSON.parse(doProf('PROF_NP', 'pedido_alteracao')).campos.nomeCompleto === undefined);
  const r4 = post({ acao: 'profSalvarMeusDados', token: tok, dados: { genero: 'F', nomeCompleto: 'Dra. Nova de Prova', email: 'np@exemplo.test', telefone: '', crp: '06/999999' } });
  ok('M11 salvar igual ao cadastro retira o pedido', r4.ok && r4.pedido === null && doProf('PROF_NP', 'pedido_alteracao') === '');
  abaProfs.appendRow(['PROF_OUTRO', 'OX', 'Outro Profissional', 'ox@exemplo.test', '', '', '', 'Sim', hashProf, '', '2026-10-03']);
  abaIndice.appendRow(['OX|profissional|PROF_OUTRO', 'OX', 'profissional', 'PROF_OUTRO', '2026-10-03', 'ox@exemplo.test']);
  const recusas = [{ nomeCompleto: '   ' }, { email: 'nao-e-email' }, { email: 'ox@exemplo.test' }, { crp: 'x'.repeat(121) }].map(d => post({ acao: 'profSalvarMeusDados', token: tok, dados: Object.assign({ genero: 'F' }, d) }));
  ok('M12 nome vazio, e-mail inválido, e-mail de outro profissional e texto longo demais são recusados sem gravar', recusas.every(r => r.ok === false) && doProf('PROF_NP', 'pedido_alteracao') === '' && recusas[2].erro === 'Este e-mail já está em uso por outra conta.', recusas.map(r => r.erro));
  ok('M13 pedido forjado com chave desconhecida é ignorado', (() => { const r = post({ acao: 'profSalvarMeusDados', token: tok, dados: { genero: 'F', sigla: 'ZZZ', ativo: 'Nao', senha_hash: 'x', profissional_id: 'PROF_OUTRO' } }); return r.ok && r.pedido === null && doProf('PROF_NP', 'sigla') === 'NP' && doProf('PROF_OUTRO', 'genero') !== 'F'; })());
  tokPacM = comSenha(pacM);
  const comPac = [post({ acao: 'profLerMeusDados', token: tokPacM }), post({ acao: 'profSalvarMeusDados', token: tokPacM, dados: { genero: 'M' } }), post({ acao: 'profSalvarMeusDados', dados: { genero: 'M' } })];
  ok('M14 crachá de paciente ou ausência de crachá: recusado', comPac.every(r => r.ok === false && r.codigo === 'sessao_expirada') && doProf('PROF_NP', 'genero') === 'F', comPac);
  TRAVA.ocupada = true;
  const oc = post({ acao: 'profSalvarMeusDados', token: tok, dados: { genero: 'M' } });
  TRAVA.ocupada = false;
  ok('M15 as três ações que gravam rodam dentro da trava', oc.codigo === 'ocupado' && doProf('PROF_NP', 'genero') === 'F' && ['profSalvarMeusDados', 'admAprovarPedido', 'admRecusarPedido'].every(a => ACOES_COM_TRAVA.indexOf(a) !== -1) && ACOES_COM_TRAVA.indexOf('profLerMeusDados') === -1, oc);
});

console.log('A. O admin aprova e recusa o pedido');
tenta('A', () => {
  const tokAdm = cracha('admin', 'ADM_N', 'ADM_N', hashAdm);
  const entrar = (email) => post({ acao: 'autenticar', tipo: 'profissional', email: email, senha: 'senha-do-prof-Aa1' });
  let tok = entrar('np@exemplo.test').token;
  post({ acao: 'profSalvarMeusDados', token: tok, dados: { genero: 'F', nomeCompleto: 'Dra. Nova Aprovada', email: 'nova@exemplo.test', telefone: '19 99999-0000', crp: '06/222222' } });
  const lista = post({ acao: 'admListarProfissionais', token: tokAdm });
  const np = (lista.profissionais || []).find(p => p.profissional_id === 'PROF_NP'), ox = (lista.profissionais || []).find(p => p.profissional_id === 'PROF_OUTRO');
  ok('A1 a lista do admin traz o pedido de quem pediu (e nada em quem não pediu); sem senha_hash e sem a célula crua', lista.ok && np && np.pedido && np.pedido.campos.email === 'nova@exemplo.test' && np.nome_completo === 'Dra. Nova de Prova' && ox && !ox.pedido && np.senha_hash === undefined && np.pedido_alteracao === undefined && np.genero === 'F', np);
  ok('A2 pedido não é aprovado por profissional nem por paciente', [tok, tokPacM].every(t => post({ acao: 'admAprovarPedido', token: t, profissionalId: 'PROF_NP' }).ok === false && post({ acao: 'admRecusarPedido', token: t, profissionalId: 'PROF_NP' }).ok === false) && doProf('PROF_NP', 'nome_completo') === 'Dra. Nova de Prova' && doProf('PROF_NP', 'pedido_alteracao') !== '');
  const ap = post({ acao: 'admAprovarPedido', token: tokAdm, profissionalId: 'PROF_NP' });
  ok('A3 aprovar aplica os quatro campos no cadastro e apaga o pedido', ap.ok && doProf('PROF_NP', 'nome_completo') === 'Dra. Nova Aprovada' && doProf('PROF_NP', 'email') === 'nova@exemplo.test' && doProf('PROF_NP', 'telefone') === '19999990000' && doProf('PROF_NP', 'crp') === '06/222222' && doProf('PROF_NP', 'pedido_alteracao') === '', ap);
  ok('A4 o e-mail aprovado vale no índice: o login antigo não entra e o novo entra, com o nome novo', entrar('np@exemplo.test').ok === false && (() => { const e = entrar('nova@exemplo.test'); tok = e.token; return e.ok && e.perfil.nome_completo === 'Dra. Nova Aprovada' && e.perfil.genero === 'F'; })());
  ok('A5 aprovar ou recusar sem pedido devolve erro', post({ acao: 'admAprovarPedido', token: tokAdm, profissionalId: 'PROF_NP' }).ok === false && post({ acao: 'admRecusarPedido', token: tokAdm, profissionalId: 'PROF_NP' }).ok === false && post({ acao: 'admAprovarPedido', token: tokAdm, profissionalId: 'PROF_NAO_EXISTE' }).ok === false);
  post({ acao: 'profSalvarMeusDados', token: tok, dados: { genero: 'F', crp: '06/333333' } });
  const rec = post({ acao: 'admRecusarPedido', token: tokAdm, profissionalId: 'PROF_NP' });
  ok('A6 recusar apaga o pedido e deixa o cadastro como estava', rec.ok && doProf('PROF_NP', 'crp') === '06/222222' && doProf('PROF_NP', 'pedido_alteracao') === '' && post({ acao: 'profLerMeusDados', token: tok }).pedido === null, rec);
  // e-mail pedido que passou a ser de outra conta entre o pedido e a aprovação
  post({ acao: 'profSalvarMeusDados', token: tok, dados: { genero: 'F', email: 'livre@exemplo.test' } });
  semMemo(() => atualizarProfissional(sAdm, 'PROF_OUTRO', { email: 'livre@exemplo.test' }));
  const conflito = post({ acao: 'admAprovarPedido', token: tokAdm, profissionalId: 'PROF_NP' });
  ok('A7 e-mail tomado por outra conta depois do pedido: a aprovação recusa, nada muda e o pedido continua para o admin decidir', conflito.ok === false && doProf('PROF_NP', 'email') === 'nova@exemplo.test' && doProf('PROF_NP', 'pedido_alteracao') !== '', conflito);
  post({ acao: 'admRecusarPedido', token: tokAdm, profissionalId: 'PROF_NP' });
  EMAILS.length = 0;
  const conv = semMemo(() => admEnviarConvite(sAdm, 'PROF_OUTRO', 'email'));
  ok('A8 convite de profissional: assinado só com o nome do admin (admin não tem CRP nem gênero)', conv.ok && EMAILS.length === 1 && /\nAdmin N$/.test(EMAILS[0].body) && !/CRP/.test(EMAILS[0].body), EMAILS.length ? EMAILS[0].body.slice(-80) : conv);
});

console.log('K. Carimbo: o nome é o do cadastro na hora de mostrar');
tenta('K', () => {
  const K1 = novoPaciente('Paciente Carimbo', 'k1@exemplo.test');
  const wb = planilhaDe(K1), abaA = wb.getSheetByName(ABA_AUTOMONITORAMENTO), abaS = wb.getSheetByName(ABA_ESCALAS);
  const sP = { tipo: 'profissional', sigla: 'NP', profissional_id: 'PROF_NP', nome: 'x', email: 'x' };
  semMemo(() => salvarAnamnese(K1, { nome_completo: 'Paciente Carimbo', id_envio: uuid() }));
  semMemo(() => salvarAutomonitoramento(K1, regNeg({ id_envio: uuid() })));
  const ts = semMemo(() => lerHistorico(K1)).automonitoramento[0].timestamp;
  semMemo(() => pacienteEditarAutomonitoramento(K1, ts, null, { humor_observacoes: 'do paciente' }, uuid()));
  semMemo(() => profEditarAutomonitoramento(sP, K1, ts, null, { neg_sit_o_que: 'do profissional' }, uuid()));
  semMemo(() => profCriarAutomonitoramento(sP, K1, regNeg({ id_envio: uuid() })));
  const itens = {}; [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(i => { itens['item_0' + i] = 1; });
  semMemo(() => profCriarEscala(sP, K1, Object.assign({ id_envio: uuid(), instrumento: 'PHQ-9', versao_instrumento: 'v1', data_aplicacao: '2026-10-05' }, itens)));
  semMemo(() => profSalvarAnamnese(sP, K1, null, { profissao: 'teste' }, uuid()));
  const nomeAntes = doProf('PROF_NP', 'nome_completo');
  const cru = () => JSON.parse(celula(abaA, 2, 'autoria_campos'));
  const h0 = semMemo(() => lerHistorico(K1));
  const au0 = JSON.parse(h0.automonitoramento[0].autoria_campos);
  ok('K1 antes de mudar o cadastro: carimbo do profissional e do paciente com os nomes atuais', au0.neg_sit_o_que.nome === nomeAntes && au0.humor_observacoes.nome === 'Paciente Carimbo' && h0.automonitoramento[1].criado_por_nome === nomeAntes, au0);
  const gravadoAntes = celula(abaA, 2, 'autoria_campos');
  // o admin corrige o nome do profissional; o nome do paciente muda no cadastro (Controle)
  semMemo(() => atualizarProfissional(sAdm, 'PROF_NP', { nomeCompleto: 'Dra. Nome Corrigido' }));
  const lp = linhaDe(abaPac, 'sigla', K1);
  ['nome', 'ind_nome'].forEach(c => { const i = cab(abaPac).indexOf(c); if (i >= 0) abaPac.getRange(lp, i + 1).setValue('Paciente Renomeado'); });
  const h1 = semMemo(() => lerHistorico(K1));
  const au1 = JSON.parse(h1.automonitoramento[0].autoria_campos);
  ok('K2 lerHistorico: carimbos ANTIGOS mostram o nome novo do profissional e do paciente', au1.neg_sit_o_que.nome === 'Dra. Nome Corrigido' && au1.humor_observacoes.nome === 'Paciente Renomeado' && au1.neg_sit_o_que.em === au0.neg_sit_o_que.em && au1.neg_sit_o_que.por === 'profissional', au1);
  ok('K3 "Registrado por": criado_por_nome do registro criado pelo profissional segue o cadastro; registro do paciente fica sem nome', h1.automonitoramento[1].criado_por_nome === 'Dra. Nome Corrigido' && !h1.automonitoramento[0].criado_por_nome);
  ok('K4 nada foi regravado na planilha: a célula guarda o nome da época (reserva)', celula(abaA, 2, 'autoria_campos') === gravadoAntes && cru().neg_sit_o_que.nome === nomeAntes && celula(abaA, 3, 'criado_por_nome') === nomeAntes);
  const auAn = JSON.parse(h1.anamnese.autoria_campos);
  ok('K5 a anamnese do histórico também', auAn.profissao.nome === 'Dra. Nome Corrigido', auAn);
  const e1 = semMemo(() => lerEscalas(K1)).escalas[0];
  ok('K6 lerEscalas: criado_por_nome segue o cadastro', e1.criado_por_nome === 'Dra. Nome Corrigido' && celula(abaS, 2, 'criado_por_nome') === nomeAntes, e1.criado_por_nome);
  const d1 = semMemo(() => lerDadosPaciente(sP, K1));
  ok('K7 lerDadosPaciente (tela do profissional): anamnese, registros e escalas com o nome atual', JSON.parse(d1.automonitoramento[0].autoria_campos).neg_sit_o_que.nome === 'Dra. Nome Corrigido' && JSON.parse(d1.automonitoramento[0].autoria_campos).humor_observacoes.nome === 'Paciente Renomeado' && d1.automonitoramento[1].criado_por_nome === 'Dra. Nome Corrigido' && d1.escalas[0].criado_por_nome === 'Dra. Nome Corrigido' && JSON.parse(d1.anamnese.autoria_campos).profissao.nome === 'Dra. Nome Corrigido');
  const ed = semMemo(() => pacienteEditarAutomonitoramento(K1, ts, null, { humor_nivel: 1 }, uuid()));
  ok('K8 a resposta de uma edição devolve TODOS os carimbos com o nome atual (não só o do campo editado)', ed.ok && ed.autoria_campos.neg_sit_o_que.nome === 'Dra. Nome Corrigido' && ed.autoria_campos.humor_nivel.nome === semMemo(() => _nomeDeQuemAltera_('paciente', K1, 'PROF_NP')) && ed.autoria_campos.humor_observacoes.nome === ed.autoria_campos.humor_nivel.nome, ed.autoria_campos); // o nome do paciente é o da anamnese (ind_nome), que a gravação recalcula
  const tsEsc = e1.timestamp;
  const edE = semMemo(() => profEditarEscala(sP, K1, tsEsc, { item_01: 2 }, uuid()));
  ok('K9 edição de escala: carimbo e registro devolvido com o nome atual', edE.ok && edE.autoria_campos.item_01.nome === 'Dra. Nome Corrigido' && edE.registro.criado_por_nome === 'Dra. Nome Corrigido', edE.autoria_campos);
  ok('K10 carimbo sem "por" conhecido, texto vazio e JSON quebrado passam intactos', _autoriaComNomeAtual_('', { profissional: 'A', paciente: 'B' }) === '' && _autoriaComNomeAtual_('{quebrado', { profissional: 'A' }) === '{quebrado' && JSON.stringify(_autoriaComNomeAtual_({ x: { por: 'outro', em: '1', nome: 'N' } }, { profissional: 'A', paciente: 'B' })) === '{"x":{"por":"outro","em":"1","nome":"N"}}');
  ok('K11 sem nome no cadastro o carimbo guardado continua valendo (reserva)', JSON.parse(_autoriaComNomeAtual_('{"x":{"por":"profissional","em":"1","nome":"Antigo"}}', { profissional: '', paciente: '' })).x.nome === 'Antigo');
  ok('K12 carimbo antigo sem nome (anterior ao 18.6.1) ganha o nome do cadastro', JSON.parse(_autoriaComNomeAtual_('{"x":{"por":"paciente","em":"1"}}', { profissional: 'A', paciente: 'B' })).x.nome === 'B');
});

console.log('\nRESULTADO: ' + (falhas === 0 ? 'OK — ' + passo + '/' + passo + ' provas' : falhas + ' FALHA(S) em ' + passo + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
