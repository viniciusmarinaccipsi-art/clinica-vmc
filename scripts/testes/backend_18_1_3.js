/* Pacote 18.1.3 — E-mail único por profissional: testes em Node do Código.js REAL
   sobre planilhas simuladas (mesmo desenho dos testes do 18.1.2). Nenhum dado real:
   nomes, e-mails e senhas são inventados; nada sai da máquina (MailApp é capturado).
   Regras provadas:
     A. cadastro — mesmo profissional recusa e-mail repetido; outro profissional aceita
     B. troca de e-mail (_gravarEmailIndice_) — paciente por profissional; prof/admin global
     C. login — 0/1/2 contas; senhas iguais → 'escolher' (sem crachá) → escolha válida entra;
        escolha inválida conta como falha; senhas diferentes → entra direto na certa;
        tranca 5×; profissional segue global
     D. redefinição — 1 conta = 1 e-mail sem a linha; 2 contas = 2 links e 2 e-mails com
        "Acompanhamento com:"; cota insuficiente = nenhum e-mail e nenhum link pendente;
        uso de um link derruba só os da MESMA conta
   Uso: node PACOTE_18_1_3_node.js  (sai 0 se tudo passar)
   (sem 'use strict': o eval do Código.js precisa vazar as declarações para este escopo) */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ============ mocks mínimos do Apps Script ============ */
const sign = b => Array.from(b).map(x => (x > 127 ? x - 256 : x));
global.Utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  computeDigest: (_a, texto) => sign(crypto.createHash('sha256').update(String(texto), 'utf8').digest()),
  computeHmacSha256Signature: (msg, chave) => sign(crypto.createHmac('sha256', String(chave)).update(String(msg), 'utf8').digest()),
  formatDate: (d, _tz, fmt) => {
    const p = n => String(n).padStart(2, '0');
    if (fmt === 'yyyy-MM-dd') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    if (fmt === 'HH:mm') return p(d.getHours()) + ':' + p(d.getMinutes());
    return d.toISOString();
  },
  getUuid: () => crypto.randomUUID(),
  sleep: ms => { global.__sleeps.push(ms); },
  base64EncodeWebSafe: (dados) => {
    const buf = typeof dados === 'string' ? Buffer.from(dados, 'utf8') : Buffer.from(dados.map(x => (x < 0 ? x + 256 : x)));
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  },
  base64DecodeWebSafe: (s) => sign(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
  newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes.map(x => (x < 0 ? x + 256 : x))).toString('utf8') })
};
global.__sleeps = [];

class Range {
  constructor(sheet, r, c, nr, nc) { this.s = sheet; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const linha = this.s.dados[this.r - 1 + i] || [];
      const row = [];
      for (let j = 0; j < this.nc; j++) row.push(linha[this.c - 1 + j] !== undefined ? linha[this.c - 1 + j] : '');
      out.push(row);
    }
    return out;
  }
  setValues(v) {
    for (let i = 0; i < v.length; i++) for (let j = 0; j < v[i].length; j++) this._set(this.r + i, this.c + j, v[i][j]);
    return this;
  }
  setValue(v) { this._set(this.r, this.c, v); return this; }
  _set(r, c, v) {
    while (this.s.dados.length < r) this.s.dados.push([]);
    const linha = this.s.dados[r - 1];
    while (linha.length < c) linha.push('');
    linha[c - 1] = (x => (typeof x === 'string' && x.charAt(0) === "'") ? x.slice(1) : x)(v); // 18.2: apóstrofo = texto, como no Sheets (medido em 03/10)
  }
  setFontWeight() { return this; }
  setNumberFormat() { return this; } // 18.2: formato @ nas colunas de identificacao
}
class Sheet {
  constructor(nome, dados) { this.nome = nome; this.dados = dados || [[]]; }
  getName() { return this.nome; }
  setName(n) { this.nome = n; return this; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  getDataRange() {
    const nr = Math.max(this.dados.length, 1);
    const nc = Math.max(this.getLastColumn(), 1);
    return new Range(this, 1, 1, nr, nc);
  }
  getLastColumn() { return this.dados.reduce((m, l) => Math.max(m, l.length), 0) || 1; }
  getLastRow() { return this.dados.length; }
  getMaxRows() { return 1000; } // 18.2
  appendRow(vals) { this.dados.push(vals.map((x => (typeof x === 'string' && x.charAt(0) === "'") ? x.slice(1) : x))); return this; }
  deleteRow(r) { this.dados.splice(r - 1, 1); return this; }
  setFrozenRows() { return this; }
}
class Workbook {
  constructor(id, nome) { this.id = id; this.nome = nome; this.abas = []; this.abas.push(new Sheet('Página1', [[]])); }
  getId() { return this.id; }
  getUrl() { return 'https://sheets.local/' + this.id; }
  getSheets() { return this.abas; }
  getSheetByName(n) { return this.abas.find(a => a.nome === n) || null; }
  insertSheet(n) { const s = new Sheet(n, [[]]); this.abas.push(s); return s; }
}
const WORKBOOKS = {};   // id -> Workbook
const FOLDERS = {};     // id -> { files: [{nome, id}], subfolders: {nome: folderId} }
let seqId = 0;
const novoId = p => p + '_' + (++seqId);

global.SpreadsheetApp = {
  openById: id => { if (!WORKBOOKS[id]) throw new Error('planilha inexistente: ' + id); return WORKBOOKS[id]; },
  create: nome => { const wb = new Workbook(novoId('wb'), nome); WORKBOOKS[wb.id] = wb; return wb; }
};
global.DriveApp = {
  getFolderById: id => {
    const f = FOLDERS[id]; if (!f) throw new Error('pasta inexistente: ' + id);
    return {
      getFilesByName: nome => { const achados = f.files.filter(x => x.nome === nome); let i = 0; return { hasNext: () => i < achados.length, next: () => achados[i++] }; },
      getFoldersByName: nome => { const sub = f.subfolders[nome]; let dado = false; return { hasNext: () => !!sub && !dado, next: () => { dado = true; return { __folderId: sub }; } }; }
    };
  },
  getFileById: id => ({ getId: () => id, moveTo: () => {}, getParents: () => ({ hasNext: () => false }) })
};
const CACHE = {};
global.CacheService = { getScriptCache: () => ({
  get: k => (k in CACHE ? CACHE[k] : null),
  put: (k, v) => { CACHE[k] = String(v); },
  remove: k => { delete CACHE[k]; }
}) };
const PROPS = { SEGREDO_SESSAO: 'segredo-de-teste-' + crypto.randomUUID(), PIMENTA_SENHA: crypto.randomBytes(32).toString('hex') }; // 18.2.1
global.PropertiesService = { getScriptProperties: () => ({
  getProperty: k => (k in PROPS ? PROPS[k] : null),
  setProperty: (k, v) => { PROPS[k] = String(v); },
  deleteProperty: k => { delete PROPS[k]; }
}) };
global.LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
const ENVIADOS = [];
global.MailApp = { sendEmail: o => { ENVIADOS.push(o); } };
global.Logger = { log: () => {} };
global.ContentService = { MimeType: { JSON: 'JSON' }, createTextOutput: t => ({ setMimeType: () => ({ conteudo: t }) }) };
global.ScriptApp = { getService: () => ({ getUrl: () => 'https://script.local/exec' }), getProjectTriggers: () => [], newTrigger: () => ({}), deleteTrigger: () => {} };
global.Session = { getEffectiveUser: () => ({ getEmail: () => 'dono@exemplo.test' }) };
global.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{}' }) };

/* ============ carrega o Código.js REAL ============ */
const CODIGO = path.join(__dirname, '..', '..', 'Código.js');
eval(fs.readFileSync(CODIGO, 'utf8'));

/* ============ monta o mundo simulado ============ */
const sistema = new Workbook(SISTEMA_VMC_ID, 'Sistema_VMC');
WORKBOOKS[SISTEMA_VMC_ID] = sistema;
sistema.abas = [];
const abaIndice = new Sheet(ABA_INDICE_SIGLAS, [['sigla_global', 'sigla', 'tipo', 'profissional_id', 'data_cadastro', 'email']]);
const abaProfs = new Sheet(ABA_PROFISSIONAIS, [['profissional_id', 'sigla', 'nome_completo', 'email', 'telefone', 'ativo', 'senha_hash', 'pasta_drive_id']]);
const abaAdmins = new Sheet(ABA_ADMINS, [['admin_id', 'sigla', 'nome_completo', 'email', 'ativo', 'senha_hash']]);
const abaTokens = new Sheet(ABA_TOKENS, [COLUNAS_TOKENS.slice()]);
sistema.abas.push(abaIndice, abaProfs, abaAdmins, abaTokens);

function criarProfissional(id, sigla, nome, email, senha) {
  const pastaId = novoId('pasta');
  const controle = new Workbook(novoId('ctrl'), NOME_CONTROLE);
  controle.abas = [new Sheet(ABA_PACIENTES, [['sigla', 'nome', 'email', 'telefone', 'ativo', 'senha_hash', 'data_cadastro', 'data_anamnese', 'link_planilha_individual', 'observacoes']])];
  WORKBOOKS[controle.id] = controle;
  const pastaPacientesId = novoId('pastaPac');
  FOLDERS[pastaPacientesId] = { files: [], subfolders: {} };
  FOLDERS[pastaId] = { files: [{ nome: NOME_CONTROLE, id: controle.id, getId: () => controle.id }], subfolders: { Pacientes: pastaPacientesId } };
  FOLDERS[pastaId].files[0].getId = () => controle.id;
  abaProfs.appendRow([id, sigla, nome, email, '', 'Sim', gerarHashSenha(senha), pastaId]);
  abaIndice.appendRow([sigla + '|profissional|' + id, sigla, 'profissional', id, '2026-10-02', email]);
  return controle;
}
function criarPaciente(controle, profId, sigla, nome, email, senha, ativo) {
  controle.getSheetByName(ABA_PACIENTES).appendRow([sigla, nome, email, '11999990000', ativo === undefined ? 'Sim' : ativo, senha ? gerarHashSenha(senha) : '', '2026-10-02', '', 'https://sheets.local/x', '']);
  abaIndice.appendRow([sigla + '|paciente|' + profId, sigla, 'paciente', profId, '2026-10-02', email]);
}
const aleat = () => crypto.randomBytes(12).toString('base64url'); // senhas de teste geradas na hora, nunca fixas
const S = { pa: aleat(), pb: aleat(), comum: aleat(), prof: aleat() };

const ctrlA = criarProfissional('PROF_ANA', 'ANA', 'Dra. Ana de Prova', 'ana.prova@exemplo.test', S.prof);
const ctrlB = criarProfissional('PROF_BETO', 'BETO', 'Dr. Beto de Prova', 'beto.prova@exemplo.test', S.prof);
// e-mail compartilhado entre consultórios, senhas DIFERENTES:
criarPaciente(ctrlA, 'PROF_ANA', 'PD1', 'Paciente Dup Um', 'dup@exemplo.test', S.pa);
criarPaciente(ctrlB, 'PROF_BETO', 'PD2', 'Paciente Dup Dois', 'dup@exemplo.test', S.pb);
// e-mail compartilhado, MESMA senha:
criarPaciente(ctrlA, 'PROF_ANA', 'PM1', 'Paciente Mesmo Um', 'mesma@exemplo.test', S.comum);
criarPaciente(ctrlB, 'PROF_BETO', 'PM2', 'Paciente Mesmo Dois', 'mesma@exemplo.test', S.comum);
// paciente solitário:
criarPaciente(ctrlA, 'PROF_ANA', 'SOLO', 'Paciente Solo', 'solo@exemplo.test', S.pa);

/* ============ mini-runner ============ */
let passo = 0, falhas = 0;
function ok(nome, cond, extra) {
  passo++;
  if (cond) console.log('  ok   ' + nome);
  else { falhas++; console.log('  FALHA ' + nome + (extra !== undefined ? '  → ' + JSON.stringify(extra).slice(0, 220) : '')); }
}
const limparTranca = (t, e) => { delete CACHE['falha:' + t + ':' + e]; delete CACHE['redef:' + t + ':' + e]; };
const linksPendentes = sigla => abaTokens.dados.slice(1).filter(l => String(l[2]).toUpperCase() === sigla && !String(l[6]));

/* ============ A. cadastro ============ */
console.log('A. Cadastro de paciente — e-mail único POR profissional');
const sessaoAna = { tipo: 'profissional', sigla: 'ANA', profissional_id: 'PROF_ANA', nome: 'Dra. Ana de Prova', email: 'ana.prova@exemplo.test' };
const sessaoBeto = { tipo: 'profissional', sigla: 'BETO', profissional_id: 'PROF_BETO', nome: 'Dr. Beto de Prova', email: 'beto.prova@exemplo.test' };
const a1 = cadastrarPaciente(sessaoAna, { nomeCompleto: 'Novo Caso', email: 'dup@exemplo.test', telefone: '11988887777' });
ok('A1 mesmo profissional + e-mail repetido → recusa', !a1.ok && /já está em uso/.test(a1.erro || ''), a1);
const a2 = cadastrarPaciente(sessaoBeto, { nomeCompleto: 'Caso Novo Beto', email: 'solo@exemplo.test', telefone: '11988886666' });
ok('A2 OUTRO profissional + mesmo e-mail → aceita (sigla única nova)', a2.ok === true && !!a2.sigla && a2.sigla !== 'SOLO', a2);
const a3 = cadastrarPaciente(sessaoAna, { nomeCompleto: 'Terceiro Caso', email: 'inedito@exemplo.test', telefone: '' });
ok('A3 e-mail inédito → aceita', a3.ok === true, a3);
ok('A4 siglas de paciente continuam únicas globais', (() => {
  const sg = abaIndice.dados.slice(1).filter(l => l[2] === 'paciente').map(l => l[1]);
  return new Set(sg).size === sg.length;
})());

/* ============ B. troca de e-mail ============ */
console.log('B. _gravarEmailIndice_ — paciente por profissional; profissional/admin global');
const b1 = _gravarEmailIndice_('SOLO', 'paciente', 'dup@exemplo.test');
ok('B1 mesmo profissional: trocar para e-mail de outro paciente da Ana → recusa', !b1.ok, b1);
// (o A2 deu ao Beto um paciente com solo@…; o alvo cruzado aqui é o inedito@ da Ana, do A3)
const b2 = _gravarEmailIndice_('PD2', 'paciente', 'inedito@exemplo.test');
ok('B2 outro profissional: PD2 (Beto) pode usar um e-mail já usado na Ana', b2.ok === true, b2);
_gravarEmailIndice_('PD2', 'paciente', 'dup@exemplo.test'); // devolve
const b3 = _gravarEmailIndice_('BETO', 'profissional', 'ana.prova@exemplo.test');
ok('B3 profissional continua global: e-mail da Ana recusado para o Beto', !b3.ok, b3);
abaAdmins.appendRow(['ADM_T', 'ADM_T', 'Admin de Prova', 'adm@exemplo.test', 'Sim', gerarHashSenha(aleat())]);
abaIndice.appendRow(['ADM_T|admin|ADM_T', 'ADM_T', 'admin', 'ADM_T', '2026-10-02', 'adm@exemplo.test']);
abaAdmins.appendRow(['ADM_U', 'ADM_U', 'Admin Dois', 'adm2@exemplo.test', 'Sim', gerarHashSenha(aleat())]);
abaIndice.appendRow(['ADM_U|admin|ADM_U', 'ADM_U', 'admin', 'ADM_U', '2026-10-02', 'adm2@exemplo.test']);
const b4 = _gravarEmailIndice_('ADM_U', 'admin', 'adm@exemplo.test');
ok('B4 admin continua global', !b4.ok, b4);

/* ============ C. login ============ */
console.log('C. Login — a senha decide; duas contas pedem a escolha');
limparTranca('paciente', 'nenhum@exemplo.test');
const c0 = autenticar('paciente', 'nenhum@exemplo.test', aleat());
ok('C0 zero contas → mesma mensagem de sempre', !c0.ok && c0.erro === MSG_LOGIN && !c0.codigo, c0);
limparTranca('paciente', 'solo@exemplo.test');
const c1 = autenticar('paciente', 'solo@exemplo.test', S.pa);
ok('C1 uma conta, senha certa → entra com crachá (sem tela de escolha)', c1.ok === true && !!c1.token && c1.perfil.sigla === 'SOLO', c1.ok ? { sigla: c1.perfil.sigla } : c1);
limparTranca('paciente', 'dup@exemplo.test');
const c2 = autenticar('paciente', 'dup@exemplo.test', S.pa);
ok('C2 duas contas, senhas DIFERENTES → entra direto na conta cuja senha conferiu', c2.ok === true && c2.perfil.sigla === 'PD1', c2.ok ? { sigla: c2.perfil.sigla } : c2);
limparTranca('paciente', 'dup@exemplo.test');
const c2b = autenticar('paciente', 'dup@exemplo.test', S.pb);
ok('C2b … e a outra senha entra na outra conta', c2b.ok === true && c2b.perfil.sigla === 'PD2', c2b.ok ? { sigla: c2b.perfil.sigla } : c2b);
limparTranca('paciente', 'mesma@exemplo.test');
const c3 = autenticar('paciente', 'mesma@exemplo.test', S.comum);
ok('C3 duas contas, MESMA senha → codigo "escolher", SEM crachá', !c3.ok && c3.codigo === 'escolher' && !c3.token && (c3.opcoes || []).length === 2, c3);
ok('C3b opções trazem só nome do profissional + id opaco (sem sigla/profissional_id)', (c3.opcoes || []).every(o =>
  o.profissional && /Prova/.test(o.profissional) && /^[0-9a-f]{16}$/.test(o.id) &&
  !JSON.stringify(o).match(/PM1|PM2|PROF_ANA|PROF_BETO/)), c3.opcoes);
ok('C3c o "escolher" não consome tentativa da tranca', !CACHE['falha:paciente:mesma@exemplo.test']);
const opAna = (c3.opcoes || []).find(o => /Ana/.test(o.profissional)) || {};
const c4 = autenticar('paciente', 'mesma@exemplo.test', S.comum, opAna.id);
ok('C4 escolha válida (2ª chamada: e-mail + senha + escolha) → crachá da conta certa', c4.ok === true && c4.perfil.sigla === 'PM1', c4.ok ? { sigla: c4.perfil.sigla } : c4);
ok('C4b crachá emitido vale e aponta a conta escolhida', (() => {
  const d = lerToken(c4.token, PROPS.SEGREDO_SESSAO, Date.now());
  return d && d.sigla === 'PM1' && d.profissional_id === 'PROF_ANA';
})());
limparTranca('paciente', 'mesma@exemplo.test');
const c5 = autenticar('paciente', 'mesma@exemplo.test', S.comum, 'deadbeefdeadbeef');
ok('C5 escolha inválida → falha padrão e conta como tentativa', !c5.ok && c5.erro === MSG_LOGIN && CACHE['falha:paciente:mesma@exemplo.test'] === '1', c5);
limparTranca('paciente', 'mesma@exemplo.test');
const c6 = autenticar('paciente', 'mesma@exemplo.test', aleat());
ok('C6 duas contas, senha errada → mesma falha de sempre (nada de "escolher")', !c6.ok && c6.erro === MSG_LOGIN && !c6.codigo, c6);
CACHE['falha:paciente:mesma@exemplo.test'] = String(FALHAS_MAX);
const c7 = autenticar('paciente', 'mesma@exemplo.test', S.comum);
ok('C7 tranca 5 falhas → 15 min continua por (perfil, e-mail)', !c7.ok && c7.codigo === 'bloqueado', c7);
limparTranca('paciente', 'mesma@exemplo.test');
limparTranca('profissional', 'ana.prova@exemplo.test');
const c8 = autenticar('profissional', 'ana.prova@exemplo.test', S.prof);
ok('C8 profissional: comportamento idêntico ao atual', c8.ok === true && c8.perfil.profissional_id === 'PROF_ANA', c8.ok ? { id: c8.perfil.profissional_id } : c8);
// paciente inativo não entra na escolha:
_atualizarLinhaPorChave_(ctrlB.getSheetByName(ABA_PACIENTES), 'sigla', 'PM2', { ativo: 'Nao' });
limparTranca('paciente', 'mesma@exemplo.test');
const c9 = autenticar('paciente', 'mesma@exemplo.test', S.comum);
ok('C9 conta inativa sai da disputa → com uma só ativa, entra direto', c9.ok === true && c9.perfil.sigla === 'PM1', c9.ok ? { sigla: c9.perfil.sigla } : c9);
_atualizarLinhaPorChave_(ctrlB.getSheetByName(ABA_PACIENTES), 'sigla', 'PM2', { ativo: 'Sim' });

/* ============ D. redefinição ============ */
console.log('D. "Esqueci a senha" — um link e um e-mail por conta');
// (solo@ passou a ter 2 contas depois do A2; o e-mail com UMA conta é o inedito@ da Ana)
limparTranca('paciente', 'inedito@exemplo.test');
ENVIADOS.length = 0;
const d1 = pedirRedefinicao('paciente', 'inedito@exemplo.test');
ok('D1 uma conta → 1 e-mail, SEM a linha "Acompanhamento com:"', d1.ok && ENVIADOS.length === 1 && ENVIADOS[0].body.indexOf('Acompanhamento com:') === -1, { n: ENVIADOS.length });
limparTranca('paciente', 'mesma@exemplo.test');
ENVIADOS.length = 0;
const d2 = pedirRedefinicao('paciente', 'mesma@exemplo.test');
const linksPM1 = linksPendentes('PM1').filter(l => l[4] === 'redefinicao');
const linksPM2 = linksPendentes('PM2').filter(l => l[4] === 'redefinicao');
ok('D2 duas contas → 2 e-mails e 2 links (um por conta)', d2.ok && ENVIADOS.length === 2 && linksPM1.length === 1 && linksPM2.length === 1, { emails: ENVIADOS.length, pm1: linksPM1.length, pm2: linksPM2.length });
ok('D2b cada e-mail traz "Acompanhamento com: <profissional>"', ENVIADOS.length === 2 &&
  ENVIADOS.every(m => /Acompanhamento com: Dr/.test(m.body)) &&
  ENVIADOS.some(m => /Ana de Prova/.test(m.body)) && ENVIADOS.some(m => /Beto de Prova/.test(m.body)),
  ENVIADOS.map(m => (m.body.match(/Acompanhamento com: .*/) || [''])[0]));
ok('D2c resposta é a mesma de sempre', d2.ok === true && d2.mensagem === MSG_REDEFINICAO, d2);
// D3: cota insuficiente → nenhum e-mail e nenhum link novo
limparTranca('paciente', 'mesma@exemplo.test');
delete CACHE['redef:paciente:mesma@exemplo.test'];
const chaveCota = 'redefinicoes:' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
PROPS[chaveCota] = String(REDEFINICOES_DIA_MAX - 1); // só 1 vaga para 2 contas
ENVIADOS.length = 0;
const antesPend = linksPendentes('PM1').length + linksPendentes('PM2').length;
const d3 = pedirRedefinicao('paciente', 'mesma@exemplo.test');
const depoisPend = linksPendentes('PM1').length + linksPendentes('PM2').length;
ok('D3 cota não cobre as duas → nenhum e-mail e nenhum link novo; resposta igual', d3.ok && ENVIADOS.length === 0 && depoisPend === antesPend, { emails: ENVIADOS.length, antes: antesPend, depois: depoisPend });
delete PROPS[chaveCota];
// D4: usar um link derruba só os da MESMA conta (links presos a tipo+sigla desde o 18.1.2)
const bruto1 = gerarTokenLink();
abaTokens.appendRow([_sha256Hex_(bruto1), 'paciente', 'PM1', 'PROF_ANA', 'redefinicao', new Date(Date.now() + 3600000).toISOString(), '', new Date().toISOString(), 'mesma@exemplo.test']);
const nPM2Antes = linksPendentes('PM2').length;
const senhaNova = aleat();
const d4 = definirSenha(bruto1, senhaNova, true, POLITICA_VERSAO); // desde o 18.1.6 a ativacao de paciente exige o aceite
ok('D4 usar o link da PM1 cria a senha e NÃO derruba os links da PM2', d4.ok === true && linksPendentes('PM1').length === 0 && linksPendentes('PM2').length === nPM2Antes, { d4, pm1: linksPendentes('PM1').length, pm2: linksPendentes('PM2').length, pm2Antes: nPM2Antes });
limparTranca('paciente', 'mesma@exemplo.test');
const d5 = autenticar('paciente', 'mesma@exemplo.test', senhaNova);
ok('D5 senha nova da PM1 entra direto (senhas voltaram a ser diferentes)', d5.ok === true && d5.perfil.sigla === 'PM1', d5.ok ? { sigla: d5.perfil.sigla } : d5);

/* ============ regressões rápidas ============ */
console.log('R. Regressões');
ok('R1 VERSAO_PACOTE definida (era fixa em 18.1.3; a versao e conferida no teste do pacote corrente)', (typeof VERSAO_PACOTE === 'string' && VERSAO_PACOTE.length > 0));
limparTranca('profissional', 'nao-existe@exemplo.test');
const r2 = autenticar('profissional', 'nao-existe@exemplo.test', aleat());
ok('R2 e-mail inexistente de profissional → falha padrão com hash de descarte', !r2.ok && r2.erro === MSG_LOGIN);
const r3 = montarEmail('convite', 'Fulano', 'https://x.test/?ativar=abc');
ok('R3 convite não ganhou a linha nova', r3.texto.indexOf('Acompanhamento com:') === -1);
const r4 = montarEmail('redefinicao', '', 'https://x.test/?ativar=abc', 'Dra. Ana de Prova');
ok('R4 redefinição com profissional traz a linha no texto e no HTML (escapado)', /Acompanhamento com: Dra\. Ana de Prova/.test(r4.texto) && /Acompanhamento com: Dra\. Ana de Prova/.test(r4.html));
ok('R5 _reservarEmail_ sem segundo argumento continua reservando 1', (() => {
  const k = 'emails:' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
  delete PROPS[k];
  const r = _reservarEmail_('convites');
  return r === true && PROPS[k] === '1';
})());

console.log('\n' + (falhas === 0 ? 'RESULTADO: OK — ' + passo + '/' + passo + ' provas' : 'RESULTADO: ' + falhas + ' FALHA(S) em ' + passo + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
