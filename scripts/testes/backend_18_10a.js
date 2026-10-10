/* Pacote 18.10a — Desempenho e integridade do backend: testes em Node do Código.js REAL sobre planilhas
   simuladas (mocks do PACOTE_18_2_node.js). Blocos: C controle_id · I indicadores na Controle em cada gravação ·
   L lista só pela Controle (paridade com a @33) · D id_envio · A autoria pelo servidor · S assinatura do convite ·
   T trava de gravação e memória por chamada · R rascunho no servidor (18.10b) · P trava de presença intocada.
   Uso: node PACOTE_18_10a_node.js */
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

console.log('C. controle_id');
tenta('C', () => {
  ok('C1 começa sem a coluna controle_id', cab(abaProfs).indexOf('controle_id') === -1);
  buscasDrive = 0; _memoZerar_();
  const c1 = abrirControleDoProfissional('PROF_NP');
  ok('C2 primeira abertura procura por nome no Drive e acha a Controle', !!c1 && c1.getId() === ctrl.id && buscasDrive === 1, buscasDrive);
  ok('C3 o id encontrado foi gravado em Profissionais.controle_id (coluna criada pelo cabeçalho)', celula(abaProfs, 2, 'controle_id') === ctrl.id, celula(abaProfs, 2, 'controle_id'));
  buscasDrive = 0; _memoZerar_();
  const c2 = abrirControleDoProfissional('PROF_NP');
  ok('C4 com controle_id preenchido abre por id, sem tocar no Drive', !!c2 && c2.getId() === ctrl.id && buscasDrive === 0, buscasDrive);
  const guardado = celula(abaProfs, 2, 'controle_id');
  abaProfs.getRange(2, cab(abaProfs).indexOf('controle_id') + 1).setValue("'id-que-nao-abre");
  buscasDrive = 0; _memoZerar_(); delete CACHE['controle:PROF_NP']; // 18.11: o id da Controle tambem fica no cache do script
  const c3 = abrirControleDoProfissional('PROF_NP');
  ok('C5 id que não abre cai para a busca por nome e regrava o id certo', !!c3 && c3.getId() === ctrl.id && buscasDrive === 1 && celula(abaProfs, 2, 'controle_id') === guardado);
});

let P1, P2;
console.log('I. Indicadores na Controle, atualizados em cada gravação');
tenta('I', () => {
  P1 = novoPaciente('Paciente Um de Prova', 'p1@exemplo.test');
  P2 = novoPaciente('Paciente Dois de Prova', 'p2@exemplo.test');
  const h = cab(abaPac);
  ok('I1 as 7 colunas ind_* nasceram pelo cabeçalho', COLUNAS_INDICADORES.every(c => h.indexOf(c) !== -1), h);
  ok('I2 paciente novo nasce com indicadores zerados e ind_atualizado_em preenchido', ind(P1, 'ind_total_auto') === 0 && ind(P1, 'ind_total_escalas') === 0 && typeof ind(P1, 'ind_atualizado_em') === 'string' && ind(P1, 'ind_atualizado_em') !== '', ind(P1, 'ind_atualizado_em'));
  let r = semMemo(() => salvarAutomonitoramento(P1, registro()));
  ok('I3 salvarAutomonitoramento: total 1 e último registro (data e humor) na linha do paciente', r.ok && ind(P1, 'ind_total_auto') === 1 && JSON.parse(ind(P1, 'ind_ultimo_auto')).humor === 4 && /^\d{2}\/\d{2}\/\d{4}$/.test(JSON.parse(ind(P1, 'ind_ultimo_auto')).data), ind(P1, 'ind_ultimo_auto'));
  semMemo(() => salvarAutomonitoramento(P1, registro({ humor_nivel: 2, data_registro: '2026-10-03' })));
  ok('I4 segundo registro: total 2, humor 2', ind(P1, 'ind_total_auto') === 2 && JSON.parse(ind(P1, 'ind_ultimo_auto')).humor === 2);
  ok('I5 o outro paciente não foi tocado', ind(P2, 'ind_total_auto') === 0 && ind(P2, 'ind_ultimo_auto') === '');
  r = semMemo(() => salvarEscala(P1, escala({ alerta_risco_flag: 'Sim', alerta_risco_item: 'PHQ9_item9', alerta_risco_valor: 2 })));
  const ue = JSON.parse(ind(P1, 'ind_ultima_escala')), al = JSON.parse(ind(P1, 'ind_alertas_json'));
  ok('I6 salvarEscala: total 1, última escala e alerta crítico em JSON', r.ok && ind(P1, 'ind_total_escalas') === 1 && ue.nome === 'PHQ-9' && ue.faixa === 'Leve' && al.instrumento === 'PHQ-9' && al.item === 'PHQ9_item9' && al.valor === '2', { ue, al });
  semMemo(() => salvarEscala(P1, escala({ instrumento: 'GAD-7', faixa: 'Mínima' })));
  ok('I7 escala seguinte sem alerta: última muda, alerta mais recente continua o do PHQ-9', JSON.parse(ind(P1, 'ind_ultima_escala')).nome === 'GAD-7' && JSON.parse(ind(P1, 'ind_alertas_json')).instrumento === 'PHQ-9' && ind(P1, 'ind_total_escalas') === 2);
  r = semMemo(() => salvarAnamnese(P1, { nome_completo: 'Nome da Anamnese Um', profissao: 'x' }));
  ok('I8 salvarAnamnese: ind_nome = nome da anamnese', r.ok && ind(P1, 'ind_nome') === 'Nome da Anamnese Um', ind(P1, 'ind_nome'));
  r = semMemo(() => pacienteAtualizarAnamnese(P1, { nome_completo: 'Nome Atualizado Um' }));
  ok('I9 pacienteAtualizarAnamnese atualiza ind_nome', r.ok && ind(P1, 'ind_nome') === 'Nome Atualizado Um');
  r = semMemo(() => profSalvarAnamnese(sProf, P1, null, { nome_completo: 'Nome Pelo Profissional' }));
  ok('I10 profSalvarAnamnese atualiza ind_nome', r.ok && ind(P1, 'ind_nome') === 'Nome Pelo Profissional', r);
  const regs = semMemo(() => lerHistorico(P1)).automonitoramento;
  const ts = regs[regs.length - 1].timestamp;
  r = semMemo(() => pacienteEditarAutomonitoramento(P1, ts, { humor_nivel: 5 }));
  ok('I11 edição pelo paciente recalcula (humor do último registro vira 5)', r.ok && JSON.parse(ind(P1, 'ind_ultimo_auto')).humor === 5, r);
  r = semMemo(() => profEditarAutomonitoramento(sProf, P1, ts, { humor_nivel: 1 }));
  ok('I12 edição pelo profissional recalcula (humor vira 1)', r.ok && JSON.parse(ind(P1, 'ind_ultimo_auto')).humor === 1, r);
  const antes = ind(P1, 'ind_atualizado_em');
  ok('I13 ind_atualizado_em é texto aaaa-MM-dd HH:mm:ss (não vira data)', typeof antes === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(antes), antes);
});

console.log('L. Lista do profissional lê só a Controle');
tenta('L', () => {
  _memoZerar_(); ABERTURAS.length = 0;
  const nova = listarPacientesDoProfissional(sProf);
  const abertasPac = ABERTURAS.filter(id => id !== SISTEMA_VMC_ID && id !== ctrl.id);
  ok('L1 lista com indicadores em dia não abre nenhuma planilha de paciente', nova.ok && nova.pacientes.length === 2 && abertasPac.length === 0, ABERTURAS);
  const base = BASE.listarPacientesDoProfissional(sProf);
  const semNovo = l => l.map(p => { const c = Object.assign({}, p); delete c.ind_total_escalas; delete c.aceite_em; /* 18.5: campo novo da lista */ return c; });
  ok('L2 mesmo conteúdo da lista da @33 (que abria cada planilha), campo a campo', JSON.stringify(semNovo(nova.pacientes)) === JSON.stringify(base.pacientes), { nova: semNovo(nova.pacientes), base: base.pacientes });
  ok('L3 a lista traz o nome da anamnese, o alerta e os dias desde o último registro', nova.pacientes[0].nome_completo === 'Nome Pelo Profissional' && nova.pacientes[0].ind_alertas.length === 1 && typeof nova.pacientes[0].ind_dias_desde_auto === 'number' && nova.pacientes[1].ind_alertas.length === 0 && nova.pacientes[1].nome_completo === 'Paciente Dois de Prova');
  // recálculo preguiçoso: paciente antigo (sem ind_atualizado_em) com dados na planilha
  const wb = planilhaDe(P2);
  wb.getSheetByName(ABA_AUTOMONITORAMENTO).appendRow(montarLinha(wb.getSheetByName(ABA_AUTOMONITORAMENTO), registro({ humor_nivel: 3 })));
  abaPac.getRange(linhaDe(abaPac, 'sigla', P2), cab(abaPac).indexOf('ind_atualizado_em') + 1).setValue('');
  _memoZerar_(); ABERTURAS.length = 0;
  const l2 = listarPacientesDoProfissional(sProf);
  const p2 = l2.pacientes.find(p => p.sigla === P2);
  ok('L4 ind_atualizado_em vazio: abre SÓ a planilha desse paciente, calcula e grava', ABERTURAS.filter(id => id === wb.id).length === 1 && ABERTURAS.filter(id => id === planilhaDe(P1).id).length === 0 && p2.ind_total_auto === 1 && p2.ind_ultimo_humor === 3 && ind(P2, 'ind_total_auto') === 1 && ind(P2, 'ind_atualizado_em') !== '', { p2, ABERTURAS });
  _memoZerar_(); ABERTURAS.length = 0;
  const l3 = listarPacientesDoProfissional(sProf);
  ok('L5 na lista seguinte nenhuma planilha de paciente é aberta (recálculo uma vez só)', ABERTURAS.filter(id => id !== SISTEMA_VMC_ID && id !== ctrl.id).length === 0 && JSON.stringify(l3.pacientes) === JSON.stringify(l2.pacientes));
  ok('L6 paridade com a @33 depois do recálculo preguiçoso', JSON.stringify(semNovo(l3.pacientes)) === JSON.stringify(BASE.listarPacientesDoProfissional(sProf).pacientes));
});

console.log('D. Identificador único do envio (id_envio)');
tenta('D', () => {
  const wb = planilhaDe(P2), abaA = wb.getSheetByName(ABA_AUTOMONITORAMENTO), abaE = wb.getSheetByName(ABA_ESCALAS), abaN = wb.getSheetByName(ABA_ANAMNESE);
  const id1 = uuid(); const n0 = abaA.getLastRow();
  const r1 = semMemo(() => salvarAutomonitoramento(P2, registro({ id_envio: id1 })));
  const r2 = semMemo(() => salvarAutomonitoramento(P2, registro({ id_envio: id1, humor_nivel: 1 })));
  ok('D1 automonitoramento: envio duplo → uma linha só', abaA.getLastRow() === n0 + 1, abaA.getLastRow() - n0);
  ok('D2 o 1º envio responde ok sem duplicado; o 2º ok: true, duplicado: true com o registro que já existia', r1.ok === true && r1.duplicado === undefined && r2.ok === true && r2.duplicado === true && r2.registro && r2.registro.id_envio === id1 && Number(r2.registro.humor_nivel) === 4, r2);
  ok('D3 id_envio gravado na coluna criada pelo cabeçalho, como texto', celula(abaA, abaA.getLastRow(), 'id_envio') === id1);
  ok('D4 o reenvio não mexeu nos indicadores (total continua o mesmo)', ind(P2, 'ind_total_auto') === abaA.getLastRow() - 1);
  const id2 = uuid(); const e0 = abaE.getLastRow();
  semMemo(() => salvarEscala(P2, escala({ id_envio: id2 })));
  const re = semMemo(() => salvarEscala(P2, escala({ id_envio: id2 })));
  ok('D5 escala: envio duplo → uma linha e duplicado: true', abaE.getLastRow() === e0 + 1 && re.ok && re.duplicado === true);
  const id3 = uuid(); const a0 = abaN.getLastRow();
  semMemo(() => salvarAnamnese(P2, { nome_completo: 'Dois', id_envio: id3 }));
  const ra = semMemo(() => salvarAnamnese(P2, { nome_completo: 'Dois', id_envio: id3 }));
  ok('D6 anamnese: envio duplo → uma linha e duplicado: true', abaN.getLastRow() === a0 + 1 && ra.ok && ra.duplicado === true, abaN.getLastRow() - a0);
  const id4 = uuid();
  semMemo(() => pacienteAtualizarAnamnese(P2, { nome_completo: 'Dois B' }, id4));
  const tsAntes = celula(abaN, 2, 'nome_completo');
  const rb = semMemo(() => pacienteAtualizarAnamnese(P2, { nome_completo: 'OUTRO' }, id4));
  ok('D7 atualização da anamnese repetida com o mesmo id não regrava', rb.ok && rb.duplicado === true && celula(abaN, 2, 'nome_completo') === tsAntes);
  const s0 = abaA.getLastRow();
  semMemo(() => salvarAutomonitoramento(P2, registro()));
  semMemo(() => salvarAutomonitoramento(P2, registro()));
  ok('D8 cliente antigo (sem id_envio) continua gravando: dois envios, duas linhas', abaA.getLastRow() === s0 + 2);
  const s1 = abaA.getLastRow();
  semMemo(() => salvarAutomonitoramento(P2, registro({ id_envio: '=1+1' })));
  semMemo(() => salvarAutomonitoramento(P2, registro({ id_envio: '=1+1' })));
  ok('D9 id_envio fora do formato é descartado (não vira chave nem fórmula)', abaA.getLastRow() === s1 + 2 && celula(abaA, abaA.getLastRow(), 'id_envio') === '');
  const id5 = uuid();
  semMemo(() => salvarAutomonitoramento(P2, registro({ id_envio: id5 })));
  const outra = semMemo(() => salvarAutomonitoramento(P1, registro({ id_envio: id5 })));
  ok('D10 o mesmo id em OUTRO paciente não é duplicado (a chave vale por aba)', outra.ok && outra.duplicado === undefined);
});

console.log('A. Autoria pelo servidor');
tenta('A', () => {
  const wb = planilhaDe(P1), abaA = wb.getSheetByName(ABA_AUTOMONITORAMENTO);
  _garantirColunasAutomonitoramento_(abaA);
  semMemo(() => salvarAutomonitoramento(P1, registro({ timestamp: '1999-01-01 00:00:00', versao_formulario: 'v9', editado: 'Sim', editado_por: 'profissional', editado_em: '1999-01-01T00:00:00', editando_quem: 'profissional:XX', editando_desde: '1999', sigla: 'OUTRA' })));
  const L = abaA.getLastRow();
  const tsCel = celula(abaA, L, 'timestamp');
  ok('A1 registro novo: timestamp e versao_formulario do servidor, não os do cliente', String(tsCel instanceof Date ? tsCel.getFullYear() : tsCel).indexOf('1999') === -1 && celula(abaA, L, 'versao_formulario') === VERSAO_FORM_AUTO, { tsCel, v: celula(abaA, L, 'versao_formulario') });
  ok('A2 registro novo: editado, editado_por, editado_em, editando_quem e editando_desde forjados ficam vazios', ['editado', 'editado_por', 'editado_em', 'editando_quem', 'editando_desde'].every(c => celula(abaA, L, c) === ''), ['editado', 'editado_por', 'editado_em', 'editando_quem', 'editando_desde'].map(c => celula(abaA, L, c)));
  const regs = semMemo(() => lerHistorico(P1)).automonitoramento;
  const ts = regs[regs.length - 1].timestamp;
  const r = semMemo(() => pacienteEditarAutomonitoramento(P1, ts, { humor_nivel: 3, editado_por: 'profissional', editado_em: '1999-01-01T00:00:00', versao_formulario: 'v9', timestamp: 'x', id_envio: uuid() }));
  ok("A3 edição vinda de paciente com editado_por: 'profissional' grava 'paciente'", r.ok && celula(abaA, L, 'editado_por') === 'paciente' && celula(abaA, L, 'editado') === 'Sim', celula(abaA, L, 'editado_por'));
  const em = celula(abaA, L, 'editado_em');
  ok('A4 editado_em é a hora do servidor; versao_formulario, timestamp e id_envio da linha não mudam na edição', String(em instanceof Date ? em.getFullYear() : em).indexOf('1999') === -1 && celula(abaA, L, 'versao_formulario') === VERSAO_FORM_AUTO && celula(abaA, L, 'id_envio') === '', { em, id: celula(abaA, L, 'id_envio') });
  const r2 = semMemo(() => profEditarAutomonitoramento(sProf, P1, ts, { humor_nivel: 2, editado_por: 'paciente' }));
  ok("A5 edição vinda do profissional com editado_por: 'paciente' grava 'profissional'", r2.ok && celula(abaA, L, 'editado_por') === 'profissional');
  const abaE = wb.getSheetByName(ABA_ESCALAS);
  semMemo(() => salvarEscala(P1, escala({ versao_formulario: 'v9', timestamp: '1999-01-01 00:00:00' })));
  ok('A6 escala: versao_formulario vem da constante das escalas', celula(abaE, abaE.getLastRow(), 'versao_formulario') === VERSAO_FORM_ESCALAS);
  const abaN = wb.getSheetByName(ABA_ANAMNESE);
  semMemo(() => pacienteAtualizarAnamnese(P1, { nome_completo: 'Nome Final Um', versao_formulario: 'v9' }));
  ok('A7 anamnese: versao_formulario vem da constante da anamnese', celula(abaN, 2, 'versao_formulario') === VERSAO_FORM_ANAMNESE);
  ok('A8 não existe mais a constante única VERSAO_FORMULARIO', typeof VERSAO_FORMULARIO === 'undefined' && !/VERSAO_FORMULARIO\b/.test(FONTE));
});

console.log('S. Assinatura do convite');
tenta('S', () => {
  ok('S1 EMAIL_ASSINATURA fixa saiu do código', typeof EMAIL_ASSINATURA === 'undefined' && FONTE.indexOf('EMAIL_ASSINATURA') === -1 && FONTE.indexOf('Vinícius Marinacci Cardim') === -1);
  EMAILS.length = 0; _memoZerar_();
  const r = profEnviarConvite(sProf, P1, 'email');
  const m = EMAILS[0] || {};
  ok('S2 convite do paciente sai assinado com o nome do profissional dono e o CRP dele', r.ok && r.enviado === true && /\nDra\. Nova de Prova\nPsicólogo — CRP 06\/999999$/.test(m.body || ''), (m.body || '').slice(-330));
  ok('S3 o HTML traz a mesma assinatura, como última linha do cartão (16.11: layout novo)', /<strong>Dra\. Nova de Prova<\/strong><br><span[^>]*>Psicólogo — CRP 06\/999999<\/span><\/p><\/td><\/tr>\n<\/table>/.test(m.htmlBody || ''));
  const antigo = new Function(FONTE_BASE + '\nreturn montarEmail;')()('convite', 'Fulano', 'https://x/?ativar=abc');
  const novo = montarEmail('convite', 'Fulano', 'https://x/?ativar=abc', '', ['Vinícius Marinacci Cardim', 'Psicólogo — CRP 06/165128']);
  ok('S4 (18.8.1) com o mesmo nome e CRP o e-mail é o da @33 sem as linhas de formação: o texto novo é o começo do antigo e termina na assinatura', antigo.texto.indexOf(novo.texto + '\n') === 0 && /CRP 06\/165128$/.test(novo.texto) && !/UNICAMP|PUC-RS|Mestrando|Especializa/.test(novo.texto + novo.html) && novo.assunto === antigo.assunto, novo.texto.slice(-200));
  ok('S5 sem CRP a assinatura é só o nome; "CRP" repetido na célula não duplica', JSON.stringify(_assinaturaDe_('Fulana de Tal', '')) === '["Fulana de Tal"]' && _assinaturaDe_('F', 'CRP 06/1')[1] === 'Psicólogo — CRP 06/1');
  EMAILS.length = 0; _memoZerar_();
  const novoProf = cadastrarProfissional(sAdm, { sigla: 'ZP', nomeCompleto: 'Profissional Convidado', email: 'zp@exemplo.test', telefone: '', crp: '', dataInicio: '' });
  const rc = admEnviarConvite(sAdm, 'PROF_ZP', 'email');
  ok('S6 convite de profissional sai assinado pelo admin que enviou', novoProf.ok && rc.ok && /\nAdmin N$/.test((EMAILS[0] || {}).body || ''), ((EMAILS[0] || {}).body || '').slice(-300));
  ok('S7 profissional novo já nasce com controle_id gravado', String(celula(abaProfs, linhaDe(abaProfs, 'profissional_id', 'PROF_ZP'), 'controle_id')).length > 3);
  EMAILS.length = 0; _memoZerar_(); Object.keys(CACHE).forEach(k => delete CACHE[k]);
  abaPac.getRange(linhaDe(abaPac, 'sigla', P1), cab(abaPac).indexOf('senha_hash') + 1).setValue(gerarHashSenha('senha-do-pac-Aa1'));
  pedirRedefinicao('paciente', 'p1@exemplo.test');
  ok('S8 redefinição do paciente assinada pelo profissional dono', EMAILS.length === 1 && /\nDra\. Nova de Prova\nPsicólogo — CRP 06\/999999$/.test(EMAILS[0].body), EMAILS.length);
  EMAILS.length = 0; _memoZerar_();
  pedirRedefinicao('profissional', 'np@exemplo.test');
  ok('S9 redefinição de profissional assinada pelo admin do sistema', EMAILS.length === 1 && /\nAdmin N$/.test(EMAILS[0].body), EMAILS.length ? EMAILS[0].body.slice(-300) : 0);
});

console.log('T. Trava de gravação e memória por chamada (pelo doPost)');
tenta('T', () => {
  const hashPac = celula(abaPac, linhaDe(abaPac, 'sigla', P1), 'senha_hash');
  _gravarAceitePolitica_(P1, 'PROF_NP');
  const tokPac = cracha('paciente', P1, 'PROF_NP', hashPac), tokProf = cracha('profissional', 'NP', 'PROF_NP', hashProf);
  const abaA = planilhaDe(P1).getSheetByName(ABA_AUTOMONITORAMENTO);
  TRAVA.pegas = TRAVA.soltas = 0; ABERTURAS.length = 0; buscasDrive = 0;
  const n0 = abaA.getLastRow();
  const r = post({ acao: 'salvarAutomonitoramento', token: tokPac, dados: registro({ id_envio: uuid() }) });
  ok('T1 gravação pelo doPost: ok, uma linha, trava pega uma vez e solta uma vez', r.ok === true && abaA.getLastRow() === n0 + 1 && TRAVA.pegas === 1 && TRAVA.soltas === 1, { r, TRAVA });
  const cont = id => ABERTURAS.filter(x => x === id).length;
  ok('T2 na mesma chamada: Sistema_VMC, Controle e planilha do paciente abertas uma vez cada; nenhuma busca no Drive', cont(SISTEMA_VMC_ID) === 1 && cont(ctrl.id) === 1 && cont(planilhaDe(P1).id) === 1 && buscasDrive === 0, { s: cont(SISTEMA_VMC_ID), c: cont(ctrl.id), p: cont(planilhaDe(P1).id), buscasDrive });
  TRAVA.pegas = TRAVA.soltas = 0; ABERTURAS.length = 0;
  const lh = post({ acao: 'lerHistorico', token: tokPac });
  ok('T3 leitura não pega a trava e também abre cada planilha uma vez', lh.ok === true && TRAVA.pegas === 0 && cont(SISTEMA_VMC_ID) === 1 && cont(ctrl.id) === 1 && cont(planilhaDe(P1).id) === 1, { TRAVA, s: cont(SISTEMA_VMC_ID), c: cont(ctrl.id) });
  TRAVA.ocupada = true; errosLog.length = 0;
  const n1 = abaA.getLastRow(), totalAntes = ind(P1, 'ind_total_auto');
  const ro = post({ acao: 'salvarAutomonitoramento', token: tokPac, dados: registro({ id_envio: uuid() }) });
  ok('T4 trava ocupada: erro genérico em português, código ocupado, NADA gravado (nem linha, nem indicador)', ro.ok === false && ro.codigo === 'ocupado' && ro.erro === MSG_OCUPADO && abaA.getLastRow() === n1 && ind(P1, 'ind_total_auto') === totalAntes, ro);
  ok('T5 a falha da trava vai para o log do servidor', errosLog.some(l => /trava de gravacao/.test(l)), errosLog);
  const edit = post({ acao: 'profEditarAutomonitoramento', token: tokProf, siglaPaciente: P1, timestamp: 'qualquer', dados: { humor_nivel: 1 } });
  const lista = post({ acao: 'profListarPacientes', token: tokProf });
  ok('T6 com a trava ocupada toda ação de gravação recusa; a leitura (lista) segue respondendo', edit.ok === false && edit.codigo === 'ocupado' && lista.ok === true && lista.pacientes.length === 2);
  TRAVA.ocupada = false;
  const todas = FONTE.match(/case '([A-Za-z]+)':/g).map(c => c.slice(6, -2));
  const leitura = ['ping', 'autenticar', 'pedirRedefinicao', 'lerHistorico', 'lerEscalas', 'lerRascunhos', 'lerItensInstrumento', 'lerEditandoAuto', 'profListarPacientes', 'profLerDadosPaciente', 'profLerGrade', 'admListarProfissionais', 'profLerMeusDados'];
  const semTrava = todas.filter(a => ACOES_COM_TRAVA.indexOf(a) === -1 && leitura.indexOf(a) === -1);
  ok('T7 toda ação do doPost que grava está em ACOES_COM_TRAVA (as demais são as leituras conhecidas)', semTrava.length === 0 && ACOES_COM_TRAVA.every(a => todas.indexOf(a) !== -1), semTrava);
  TRAVA.pegas = TRAVA.soltas = 0; EMAILS.length = 0;
  const conv = post({ acao: 'profEnviarConvite', token: tokProf, siglaPaciente: P2, canal: 'email' });
  ok('T8 trava reentrante: convite (cota + link + e-mail) pega e solta UMA vez, e a cota não solta a trava de fora', conv.ok === true && TRAVA.pegas === 1 && TRAVA.soltas === 1, { conv, TRAVA });
  ok('T9 nenhum LockService fora de _comTrava_', (FONTE.match(/LockService\.getScriptLock\(\)/g) || []).length === 1);
  const escritasFora = FONTE.split(/\r?\n/).filter(l => /\.(appendRow|setValue|setValues|deleteRow|insertSheet)\(/.test(l)).length;
  ok('T10 (informativo) linhas com escrita em planilha no arquivo: ' + escritasFora, escritasFora > 0);
});

console.log('R. Rascunho no servidor (18.10b)');
tenta('R', () => {
  const P3 = novoPaciente('Paciente Tres de Prova', 'p3@exemplo.test');
  const wb = planilhaDe(P3);
  const abaR = () => wb.getSheetByName(ABA_RASCUNHO);
  const l0 = semMemo(() => lerRascunhos(P3));
  ok('R1 sem rascunho: lista vazia e a aba Rascunho nem é criada', l0.ok && l0.rascunhos.length === 0 && abaR() === null);
  const rNeg = { sigla: P3, dados: { humor_nivel: 4, data_registro: '2026-10-03', neg_sit_o_que: '=1+1 texto' }, tipo: 'neg', etapa: 'sec-auto-emo-a', preenchido: { 'sec-auto-sit-a': true } };
  const s1 = semMemo(() => salvarRascunho(P3, 'auto_negativo', rNeg));
  ok('R2 salvarRascunho cria a aba com os 3 cabeçalhos e uma linha', s1.ok && s1.tipo === 'auto_negativo' && JSON.stringify(cab(abaR())) === JSON.stringify(['tipo', 'atualizado_em', 'dados_json']) && abaR().getLastRow() === 2, cab(abaR() || { getRange: () => ({ getValues: () => [[]] }), getLastColumn: () => 1 }));
  ok('R3 atualizado_em é texto aaaa-MM-dd HH:mm:ss (o mesmo devolvido) e dados_json é o JSON do cliente', typeof celula(abaR(), 2, 'atualizado_em') === 'string' && celula(abaR(), 2, 'atualizado_em') === s1.atualizado_em && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s1.atualizado_em) && JSON.parse(celula(abaR(), 2, 'dados_json')).dados.neg_sit_o_que === '=1+1 texto', celula(abaR(), 2, 'atualizado_em'));
  const s2 = semMemo(() => salvarRascunho(P3, 'auto_negativo', Object.assign({}, rNeg, { etapa: 'sec-auto-fis-a' })));
  ok('R4 salvar de novo o mesmo tipo regrava a MESMA linha (uma linha por tipo)', s2.ok && abaR().getLastRow() === 2 && JSON.parse(celula(abaR(), 2, 'dados_json')).etapa === 'sec-auto-fis-a');
  semMemo(() => salvarRascunho(P3, 'auto_positivo', { sigla: P3, dados: { humor_nivel: 5 }, tipo: 'pos' }));
  semMemo(() => salvarRascunho(P3, 'escala_PHQ-9', { sigla: P3, codigo: 'PHQ-9', respostas: { 1: 2 } }));
  semMemo(() => salvarRascunho(P3, 'anamnese', { sigla: P3, passo: 2, dados: { nome_completo: 'Tres' } }));
  const l1 = semMemo(() => lerRascunhos(P3));
  ok('R5 os quatro tipos convivem; lerRascunhos devolve tipo, atualizado_em e os dados já como objeto', l1.ok && l1.rascunhos.length === 4 && l1.rascunhos.map(r => r.tipo).sort().join() === 'anamnese,auto_negativo,auto_positivo,escala_PHQ-9' && l1.rascunhos.find(r => r.tipo === 'escala_PHQ-9').dados.respostas['1'] === 2 && l1.rascunhos.every(r => /^\d{4}-\d{2}-\d{2} /.test(r.atualizado_em)), l1);
  const ruins = [semMemo(() => salvarRascunho(P3, 'outro_tipo', { a: 1 })), semMemo(() => salvarRascunho(P3, 'auto_negativo', 'texto')), semMemo(() => salvarRascunho(P3, 'auto_negativo', [1])), semMemo(() => salvarRascunho(P3, 'auto_negativo', { x: 'a'.repeat(RASCUNHO_MAX) })), semMemo(() => apagarRascunho(P3, '=tipo'))];
  ok('R6 tipo fora da lista, dados que não são objeto e rascunho grande demais são recusados sem gravar', ruins.every(r => r.ok === false && r.erro === MSG_OCUPADO) && abaR().getLastRow() === 5 && JSON.parse(celula(abaR(), 2, 'dados_json')).etapa === 'sec-auto-fis-a');
  const totalAntes = ind(P3, 'ind_total_auto'), hist = semMemo(() => lerHistorico(P3));
  ok('R7 a aba Rascunho fica fora dos indicadores e do histórico', totalAntes === 0 && hist.total_registros === 0 && ind(P3, 'ind_total_escalas') === 0 && JSON.stringify(hist).indexOf('dados_json') === -1);
  const ap = semMemo(() => apagarRascunho(P3, 'auto_positivo'));
  ok('R8 apagarRascunho tira só o tipo pedido', ap.ok && ap.apagados === 1 && semMemo(() => lerRascunhos(P3)).rascunhos.map(r => r.tipo).sort().join() === 'anamnese,auto_negativo,escala_PHQ-9');
  semMemo(() => salvarRascunho(P3, 'auto_positivo', { sigla: P3, dados: { humor_nivel: 5 }, tipo: 'pos' }));
  semMemo(() => salvarAutomonitoramento(P3, registro({ id_envio: uuid() })));
  ok('R9 Enviar o registro negativo apaga o rascunho auto_negativo e deixa os outros', semMemo(() => lerRascunhos(P3)).rascunhos.map(r => r.tipo).sort().join() === 'anamnese,auto_positivo,escala_PHQ-9');
  semMemo(() => salvarEscala(P3, escala({ instrumento: 'PHQ-9', id_envio: uuid() })));
  ok('R10 Enviar a escala apaga o rascunho escala_<codigo>', semMemo(() => lerRascunhos(P3)).rascunhos.map(r => r.tipo).sort().join() === 'anamnese,auto_positivo');
  const idA = uuid();
  semMemo(() => salvarAnamnese(P3, { nome_completo: 'Tres', id_envio: idA }));
  ok('R11 Enviar a anamnese apaga o rascunho da anamnese', semMemo(() => lerRascunhos(P3)).rascunhos.map(r => r.tipo).join() === 'auto_positivo');
  semMemo(() => salvarRascunho(P3, 'anamnese', { sigla: P3, passo: 1, dados: {} }));
  const dup = semMemo(() => salvarAnamnese(P3, { nome_completo: 'Tres', id_envio: idA }));
  ok('R12 o reenvio duplicado também encerra o rascunho do tipo', dup.duplicado === true && semMemo(() => lerRascunhos(P3)).rascunhos.map(r => r.tipo).join() === 'auto_positivo');
  // pelo doPost: crachá, perfil e trava
  abaPac.getRange(linhaDe(abaPac, 'sigla', P3), cab(abaPac).indexOf('senha_hash') + 1).setValue(gerarHashSenha('senha-do-p3-Aa1'));
  const hashP3 = celula(abaPac, linhaDe(abaPac, 'sigla', P3), 'senha_hash');
  const tokA = cracha('paciente', P3, 'PROF_NP', hashP3), tokB = cracha('paciente', P3, 'PROF_NP', hashP3), tokProf = cracha('profissional', 'NP', 'PROF_NP', hashProf);
  TRAVA.pegas = TRAVA.soltas = 0;
  const g = post({ acao: 'salvarRascunho', token: tokA, tipo: 'auto_negativo', dados: rNeg });
  const pegasGravar = TRAVA.pegas;
  const lB = post({ acao: 'lerRascunhos', token: tokB });
  ok('R13 doPost: salvo numa sessão, lido em OUTRA sessão da mesma conta; gravar pega a trava, ler não', g.ok === true && pegasGravar === 1 && TRAVA.pegas === 1 && lB.ok === true && lB.rascunhos.some(r => r.tipo === 'auto_negativo' && r.dados.etapa === 'sec-auto-emo-a'), { g, lB });
  const semCracha = post({ acao: 'lerRascunhos' }), comProf = post({ acao: 'lerRascunhos', token: tokProf }), gravProf = post({ acao: 'salvarRascunho', token: tokProf, tipo: 'anamnese', dados: { a: 1 } });
  ok('R14 sem crachá ou com crachá de profissional: sessão expirada, nada lido nem gravado', semCracha.codigo === 'sessao_expirada' && comProf.codigo === 'sessao_expirada' && gravProf.codigo === 'sessao_expirada');
  TRAVA.ocupada = true;
  const oc = post({ acao: 'salvarRascunho', token: tokA, tipo: 'anamnese', dados: { a: 1 } }), oa = post({ acao: 'apagarRascunho', token: tokA, tipo: 'auto_negativo' });
  TRAVA.ocupada = false;
  ok('R15 trava ocupada: salvar e apagar rascunho recusam com o erro genérico e nada muda', oc.codigo === 'ocupado' && oa.codigo === 'ocupado' && post({ acao: 'lerRascunhos', token: tokB }).rascunhos.map(r => r.tipo).sort().join() === 'auto_negativo,auto_positivo');
  _memoZerar_(); ABERTURAS.length = 0;
  const lista = listarPacientesDoProfissional(sProf);
  ok('R16 a lista do profissional segue sem abrir planilha de paciente e sem nenhum campo de rascunho', lista.ok && ABERTURAS.filter(id => id !== SISTEMA_VMC_ID && id !== ctrl.id).length === 0 && JSON.stringify(lista).toLowerCase().indexOf('rascunho') === -1);
  ok('R17 as ações novas estão na trava (gravação) ou fora dela (leitura)', ACOES_COM_TRAVA.indexOf('salvarRascunho') !== -1 && ACOES_COM_TRAVA.indexOf('apagarRascunho') !== -1 && ACOES_COM_TRAVA.indexOf('lerRascunhos') === -1);
});

console.log('P. Trava de presença intocada e versão');
tenta('P', () => {
  const corpo = (fonte, nome) => { const l = fonte.replace(/\r\n/g, '\n').split('\n'); const i = l.findIndex(x => x.indexOf('function ' + nome + '(') === 0); const f = l.findIndex((x, k) => k > i && x === '}'); return l.slice(i, f + 1).join('\n'); };
  ['profMarcarEditandoAuto', 'profLimparEditandoAuto'].forEach(n => // 18.11: lerEditandoAuto virou leitura de uma ida so (saiu daqui)
    ok('P ' + n + ': diff zero contra a @33', corpo(FONTE, n) === corpo(FONTE_BASE, n) && corpo(FONTE, n).length > 100));
  const p = post({ acao: 'ping' });
  ok('P ping devolve versao_pacote = VERSAO_PACOTE e não pega a trava', p.ok && p.versao_pacote === VERSAO_PACOTE);
});

console.log('\n' + (falhas === 0 ? 'RESULTADO: OK — ' + passo + '/' + passo + ' provas' : 'RESULTADO: ' + falhas + ' FALHA(S) em ' + passo + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
