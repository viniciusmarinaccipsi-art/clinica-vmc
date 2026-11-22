/* Fontes das escalas (22/11/2026) — extrai do código em produção a ESTRUTURA de cada escala, do jeito que
   docs/escalas/fontes.json a guarda: itens, valores das âncoras (nunca o texto), reversos, pesos, subescalas,
   composto, faixas e DOIs das referências da ficha. Usado pelo gerador (scripts/gerar_fontes_json.js) e pelo
   teste do portão (scripts/testes/teste_fontes.js). Lê o Código.js e o index-dev.html com a mesma extração do
   gabarito dos escores (teste_escores.js). Sem dado de paciente, sem texto de instrumento. */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ler = a => fs.readFileSync(path.join(RAIZ, a), 'utf8').replace(/\r\n/g, '\n');
const blocoDe = (src, inicio) => { const i = src.indexOf(inicio); if (i < 0) throw new Error('bloco ausente: ' + inicio); return src.slice(i, src.indexOf('\n};', i) + 3); };

function carregar() {
  const back = ler('Código.js'), front = ler('index-dev.html');
  const blocoBack = blocoDe(back, 'var ESCALAS_CALCULO = {');
  const servidor = new Function(blocoBack + '\nreturn ESCALAS_CALCULO;')();
  const cliente = new Function(blocoDe(front, 'const ESC_ESCALAS = {') + '\nreturn ESC_ESCALAS;')();
  // comentário no fim da linha de cada escala do ESCALAS_CALCULO (é onde a fonte das faixas costuma estar)
  const comentarios = {};
  blocoBack.split('\n').forEach(l => {
    const m = l.match(/^\s*'([A-Z0-9-]+)':\{.*?\}\s*,?\s*\/\/\s*(.*)$/);
    if (m) comentarios[m[1]] = m[2].trim();
  });
  return { servidor, cliente, comentarios };
}

const semTag = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const faixaSimples = f => ({ min: f.min !== undefined ? f.min : f[0], max: f.max !== undefined ? f.max : f[1], rotulo: f.rotulo !== undefined ? f.rotulo : f[2] });
const intervalo = (a, b) => { const r = []; for (let v = a; v <= b; v++) r.push(v); return r; };

/* Citação curta de uma referência da ficha: autores e ano, até o ponto que fecha "(ano)." */
function citacaoCurta(ref) {
  const t = semTag(ref);
  const m = t.match(/^(.*?\(\d{4}[a-z]?\))\.?/);
  return (m ? m[1] : t.slice(0, 80)).trim();
}
function doiDe(ref) {
  const m = semTag(ref).match(/10\.\d{4,9}\/[^\s<>"]+/);
  return m ? m[0].replace(/[.,;)]+$/, '') : null;
}
function idDe(ref, usados) {
  const t = semTag(ref);
  const sobrenome = (t.match(/^([A-Za-zÀ-ÿ'’\-]+)/) || ['', 'ref'])[1].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  const ano = (t.match(/\((\d{4})[a-z]?\)/) || ['', ''])[1];
  let id = sobrenome + ano, k = 2;
  while (usados.has(id)) id = sobrenome + ano + '_' + (k++);
  usados.add(id);
  return id;
}

/* Estrutura canônica de uma escala, combinando servidor (conta) e cliente (catálogo). `opcoesCarga` é opcional:
   valores por item vindos da planilha de carga (escalas com opções próprias por item). */
function estruturaDe(cod, srv, cli, opcoesCarga) {
  const min = srv.min !== undefined ? srv.min : 0, max = srv.max;
  const e = {
    itens: srv.n,
    valor_min: min,
    valor_max: max,
    ancoras: cli.opcoes && cli.opcoes.length && cli.opcoes[0].valor !== undefined ? cli.opcoes.map(o => o.valor) : intervalo(min, max)
  };
  if (opcoesCarga && opcoesCarga.por_item && cli.instrumentoId && opcoesCarga.por_item[cli.instrumentoId]) {
    const porItem = {};
    opcoesCarga.por_item[cli.instrumentoId].forEach((ops, i) => { if (ops.join() !== e.ancoras.join()) porItem[i + 1] = ops; });
    if (Object.keys(porItem).length) e.ancoras_por_item = porItem;
  }
  if (srv.rev) e.reversos = srv.rev.slice();
  if (srv.naoPontua) e.nao_pontua = srv.naoPontua.slice();
  if (srv.letra) e.itens_com_letra = srv.letra.slice();
  if (srv.crit) e.criticos = srv.crit.map(c => ({ item: c[0], a_partir_de: c[1], chave: c[2] }));
  if (srv.cond) e.condicionais = srv.cond.map(c => ({ itens: c.itens.slice(), se: c.se.slice() }));
  if (srv.sub) {
    e.subescalas = {};
    Object.keys(srv.sub).forEach(k => { e.subescalas[k] = srv.sub[k].slice(); });
    if (srv.siglaSub) e.siglas_subescalas = Object.assign({}, srv.siglaSub);
    if (srv.subMedia) e.subescala_media_casas = srv.subMedia;
    if (srv.multSub) e.multiplicador_subescala = srv.multSub;
  }
  if (srv.composto) e.composto = JSON.parse(JSON.stringify(srv.composto));
  if (srv.func) e.item_funcional = srv.func;
  e.faixas = (srv.faixas || []).map(faixaSimples);
  if (srv.faixasSub) {
    e.faixas_subescalas = {};
    Object.keys(srv.faixasSub).forEach(k => { e.faixas_subescalas[k] = srv.faixasSub[k].map(faixaSimples); });
  }
  if (cli.escoreMax !== undefined) e.escore_max = cli.escoreMax;
  // 19.0.1: regra do estágio de mudança (URICA) — só número: método, norma por escore T ([soma mín., soma máx., T]) ou cortes da prontidão
  if (cli.estagios) {
    e.estagios = { metodo: cli.estagios.metodo };
    if (cli.estagios.normas) e.estagios.normas = JSON.parse(JSON.stringify(cli.estagios.normas));
    if (cli.estagios.cortes) e.estagios.cortes = cli.estagios.cortes.map(c => (c.ate !== undefined ? { ate: c.ate, estagio: c.estagio } : { estagio: c.estagio }));
    if (cli.estagios.prontidaoSomaMedia !== undefined) e.estagios.prontidao_soma_media = cli.estagios.prontidaoSomaMedia;
  }
  return e;
}

/* Nota que o catálogo mostra ao fim da lista de faixas (é a frase "a fonte diz isto"). */
function notaFaixas(cli) {
  const lista = cli.faixasLista || [];
  for (let i = lista.length - 1; i >= 0; i--) {
    const m = String(lista[i]).match(/<em style="color:var\(--c-ink-3\);">([\s\S]*?)<\/em>/);
    if (m) return semTag(m[1]);
  }
  return null;
}

function referenciasDe(cli) {
  const usados = new Set();
  return ((cli.ficha && cli.ficha.referencias) || []).map(r => {
    const o = { id: idDe(r, usados), citacao: citacaoCurta(r) };
    const d = doiDe(r); if (d) o.doi = d;
    return o;
  });
}

/* Todas as escalas do código, na ordem do servidor. */
function estruturas(opcoesCarga) {
  const { servidor, cliente, comentarios } = carregar();
  const out = {};
  Object.keys(servidor).forEach(cod => {
    const cli = cliente[cod];
    if (!cli) throw new Error('escala só no servidor: ' + cod);
    out[cod] = {
      estrutura: estruturaDe(cod, servidor[cod], cli, opcoesCarga),
      nota_faixas: notaFaixas(cli),
      comentario_codigo: comentarios[cod] || null,
      referencias: referenciasDe(cli)
    };
  });
  Object.keys(cliente).forEach(cod => { if (!servidor[cod]) throw new Error('escala só no cliente: ' + cod); });
  return out;
}

module.exports = { RAIZ, carregar, estruturas, estruturaDe, notaFaixas, referenciasDe, semTag };
