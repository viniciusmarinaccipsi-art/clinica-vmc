/* Pacote 18.11 — portão do crachá em cache: testes em Node das funções puras novas (chave, valor, conferência)
   e da invalidação, com o Código.js REAL, um CacheService de mentira (com validade) e a leitura da planilha
   trocada por um contador. Uso: node PACOTE_18_11_node.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const sign = b => Array.from(b).map(x => (x > 127 ? x - 256 : x));
let AGORA = 1000000;
const CACHE = new Map(); let cacheForaDoAr = false; const PUTS = [];
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
  CacheService: { getScriptCache: () => {
    if (cacheForaDoAr) throw new Error('cache fora do ar');
    const vivo = k => { const e = CACHE.get(k); if (!e) return null; if (e.ate <= AGORA) { CACHE.delete(k); return null; } return e.v; };
    return {
      get: vivo,
      getAll: ks => { const o = {}; ks.forEach(k => { const v = vivo(k); if (v !== null) o[k] = v; }); return o; },
      put: (k, v, s) => { PUTS.push({ k, s }); CACHE.set(k, { v: String(v), ate: AGORA + s * 1000 }); },
      remove: k => { CACHE.delete(k); }, removeAll: ks => ks.forEach(k => CACHE.delete(k))
    };
  } },
  SpreadsheetApp: { flush: () => { ctx.__flush++; } }, __flush: 0,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === 'SEGREDO_SESSAO' ? 'segredo-de-teste' : null) }) }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'Código.js'), 'utf8'), ctx, { filename: 'Código.js' });
const G = code => vm.runInContext(code, ctx);

let total = 0, falhas = 0;
const ok = (nome, cond, extra) => { total++; if (!cond) { falhas++; console.log('FALHA ' + nome + (extra !== undefined ? ' — ' + JSON.stringify(extra) : '')); } };

/* ---------- K: chave ---------- */
ok('K1 chave por conta, sigla sem caixa e sem espaços', G(`_chavePortao_('profissional', ' vmc ', 'PROF_VMC')`) === 'portao:profissional:VMC:PROF_VMC');
ok('K2 perfis diferentes com a mesma sigla não dividem a chave', G(`_chavePortao_('paciente','VMC','PROF_VMC') !== _chavePortao_('profissional','VMC','PROF_VMC')`));
ok('K3 mesma sigla de paciente com outro dono é outra chave', G(`_chavePortao_('paciente','ABC','PROF_A') !== _chavePortao_('paciente','ABC','PROF_B')`));
ok('K4 chave não contém hash nem impressão', !/v3\$|[0-9a-f]{16}/.test(G(`_chavePortao_('paciente','ABC','PROF_A')`)));

/* ---------- V: valor e conferência ---------- */
G(`var REG = { ativo: true, senha_hash: 'v3$sal$300$aaaa', nome: 'Fulano', email: 'f@x.com' };`);
const valor = G(`_valorPortao_(REG)`);
ok('V1 o valor guarda a impressão, nunca o hash', valor.indexOf('v3$') === -1 && JSON.parse(valor).i === G(`impressaoCracha(REG.senha_hash)`));
ok('V2 impressão do crachá igual à guardada confere e devolve nome e e-mail', JSON.stringify(G(`_portaoConfere_(_valorPortao_(REG), impressaoCracha(REG.senha_hash))`)) === '{"nome":"Fulano","email":"f@x.com"}');
ok('V3 crachá de outra credencial não confere', G(`_portaoConfere_(_valorPortao_(REG), impressaoCracha('v3$sal$300$bbbb'))`) === null);
ok('V4 valor vazio, lixo, sem impressão e impressão vazia não conferem', G(`_portaoConfere_(null, 'x') === null && _portaoConfere_('{', 'x') === null && _portaoConfere_('{"n":"a"}', 'x') === null && _portaoConfere_('{"i":""}', '') === null && _portaoConfere_(_valorPortao_(REG), '') === null`));

/* ---------- P: portão (_validarToken_) com a leitura da planilha contada ---------- */
G(`var LEITURAS = 0, CONTA = { ativo: true, senha_hash: 'v3$sal$300$aaaa', nome: 'Prof Teste', email: 'p@x.com' };
   _registroDaConta_ = function (tipo, sigla, prof) { LEITURAS++; return (sigla === 'VMC' && prof === 'PROF_VMC') ? CONTA : null; };
   function cracha(hash, agora) { return emitirToken({ tipo: 'profissional', sigla: 'VMC', profissional_id: 'PROF_VMC', impressao: impressaoCracha(hash) }, 'segredo-de-teste', agora || Date.now()); }
   function portao(tok) { _memoZerar_(true); return _validarToken_(tok); }`);
const tok = G(`cracha(CONTA.senha_hash)`);
ctx.TOK = tok;
let s = G(`portao(TOK)`);
ok('P1 primeira chamada confere na planilha e passa', !!s && s.nome === 'Prof Teste' && G('LEITURAS') === 1);
ok('P2 o portão guardou por 300 s, numa chave da conta', PUTS.length === 1 && PUTS[0].s === 300 && PUTS[0].k === 'portao:profissional:VMC:PROF_VMC');
s = G(`portao(TOK)`);
ok('P3 (a) segunda chamada passa SEM ler a planilha, com o mesmo nome e e-mail', !!s && s.nome === 'Prof Teste' && s.email === 'p@x.com' && s.sigla === 'VMC' && G('LEITURAS') === 1);
ok('P4 (e) crachá adulterado é recusado sem tocar na planilha', G(`portao(TOK.slice(0, -1) + (TOK.slice(-1) === 'a' ? 'b' : 'a'))`) === null && G(`portao('x.' + TOK.split('.')[1])`) === null && G('LEITURAS') === 1);
ctx.TOKVELHO = G(`cracha(CONTA.senha_hash, Date.now() - 7 * 3600 * 1000)`);
ok('P5 crachá expirado é recusado mesmo com o portão em cache', G(`portao(TOKVELHO)`) === null && G('LEITURAS') === 1);
// (c) senha trocada pelo sistema: grava o hash novo e solta o portão
G(`CONTA.senha_hash = 'v3$sal$300$nova'; _portaoEsquecer_([{ tipo: 'profissional', sigla: 'vmc', profissional_id: 'PROF_VMC' }]);`);
ok('P6 invalidação: flush antes de soltar e a chave sai do cache', ctx.__flush === 1 && !CACHE.has('portao:profissional:VMC:PROF_VMC'));
ok('P7 (c) crachá antigo recusado na chamada seguinte à troca de senha', G(`portao(TOK)`) === null && G('LEITURAS') === 2);
ok('P8 recusa não entra no cache', !CACHE.has('portao:profissional:VMC:PROF_VMC'));
ctx.TOK2 = G(`cracha(CONTA.senha_hash)`);
ok('P9 crachá novo passa e volta a ser guardado', !!G(`portao(TOK2)`) && G('LEITURAS') === 3 && !!G(`portao(TOK2)`) && G('LEITURAS') === 3);
ok('P10 crachá da credencial antiga, com o portão da nova em cache, vai à planilha e é recusado', G(`portao(TOK)`) === null && G('LEITURAS') === 4 && !!G(`portao(TOK2)`) && G('LEITURAS') === 4);
// (b) conta desativada pelo sistema
G(`CONTA.ativo = false; _portaoEsquecer_([{ tipo: 'profissional', sigla: 'VMC', profissional_id: 'PROF_VMC' }]);`);
ok('P11 (b) conta desativada pelo sistema é recusada na chamada seguinte e não é guardada', G(`portao(TOK2)`) === null && G('LEITURAS') === 5 && !CACHE.has('portao:profissional:VMC:PROF_VMC'));
G(`CONTA.ativo = true;`);
ok('P12 reativada: passa de novo (pela planilha)', !!G(`portao(TOK2)`) && G('LEITURAS') === 6);
// edição direta na planilha: o atraso existe e acaba em 5 min
G(`CONTA.ativo = false;`);
ok('P13 desativada direto na planilha: ainda passa dentro dos 5 min', !!G(`portao(TOK2)`) && G('LEITURAS') === 6);
AGORA += 301 * 1000;
ok('P14 passados os 5 min, a planilha manda', G(`portao(TOK2)`) === null && G('LEITURAS') === 7);
G(`CONTA.ativo = true;`);
// cache fora do ar: tudo pela planilha, nada quebra
cacheForaDoAr = true;
ok('P15 cache fora do ar: confere na planilha e passa', !!G(`portao(TOK2)`) && G('LEITURAS') === 8 && !!G(`portao(TOK2)`) && G('LEITURAS') === 9);
ok('P16 cache fora do ar: a invalidação não lança e devolve false', G(`_portaoEsquecer_([{ tipo: 'profissional', sigla: 'VMC', profissional_id: 'PROF_VMC' }])`) === false);
cacheForaDoAr = false;

/* ---------- E: o que mais sai na exclusão; dono e Controle ---------- */
CACHE.set('portao:paciente:ABC:PROF_VMC', { v: 'x', ate: AGORA + 9e9 }); CACHE.set('dono:ABC', { v: 'PROF_VMC', ate: AGORA + 9e9 }); CACHE.set('planilha:ABC', { v: 'id', ate: AGORA + 9e9 });
G(`_portaoEsquecer_([{ tipo: 'paciente', sigla: 'abc', profissional_id: 'PROF_VMC' }])`);
ok('E1 mudança de senha/e-mail/ativo solta só o portão (dono e planilha não mudam)', !CACHE.has('portao:paciente:ABC:PROF_VMC') && CACHE.has('dono:ABC') && CACHE.has('planilha:ABC'));
G(`_portaoEsquecer_([{ tipo: 'paciente', sigla: 'ABC', profissional_id: 'PROF_VMC', excluida: true }])`);
ok('E2 exclusão solta também dono e planilha', !CACHE.has('dono:ABC') && !CACHE.has('planilha:ABC'));
// (d) paciente de outro profissional: o dono vem do Índice (ou do cache do que o Índice disse) e é comparado como antes
G(`var INDICE = [['sigla','tipo','profissional_id','email'], ['ABC','paciente','PROF_OUTRO','a@x.com'], ['DEF','paciente','PROF_VMC','d@x.com']];
   _indiceValores_ = function () { LEITURAS_INDICE++; return INDICE; }; var LEITURAS_INDICE = 0;`);
ok('E3 (d) dono lido do Índice e guardado; a segunda consulta não relê', G(`_memoZerar_(true); resolverProfissionalIdPorSigla('abc', 'paciente')`) === 'PROF_OUTRO' && G(`_memoZerar_(true); resolverProfissionalIdPorSigla('ABC', 'paciente')`) === 'PROF_OUTRO' && G('LEITURAS_INDICE') === 1);
ok('E4 (d) profissional do crachá ≠ dono: leitura do paciente alheio recusada (com o dono em cache)', G(`_memoZerar_(true); _siglaAlvoLeitura_({ tipo: 'profissional', sigla: 'VMC', profissional_id: 'PROF_VMC' }, 'ABC')`) === null && G(`_memoZerar_(true); _siglaAlvoLeitura_({ tipo: 'profissional', sigla: 'VMC', profissional_id: 'PROF_VMC' }, 'DEF')`) === 'DEF');
ok('E5 sigla que não existe não entra no cache', G(`_memoZerar_(true); resolverProfissionalIdPorSigla('ZZZ', 'paciente')`) === null && !CACHE.has('dono:ZZZ'));
ok('E6 profissional e admin não usam o cache de dono', G(`_memoZerar_(true); INDICE.push(['VMC','profissional','PROF_VMC','p@x.com']); resolverProfissionalIdPorSigla('VMC', 'profissional')`) === 'PROF_VMC' && !CACHE.has('dono:VMC'));

console.log((falhas ? 'FALHOU' : 'OK') + ': ' + (total - falhas) + '/' + total);
process.exit(falhas ? 1 : 0);
