/* Gera/atualiza docs/escalas/fontes.json a partir do código em produção (22/11/2026).
   A estrutura (itens, âncoras, reversos, subescalas, faixas, DOIs) é SEMPRE regravada do código; o que foi
   anotado à mão — `fonte` de cada faixa e de cada bloco de estrutura (arquivo, página, tabela, trecho,
   conferido_por), `exige_pagina` e `corte.fonte_diz` — é preservado de uma geração para a outra.
   Uso: node scripts/gerar_fontes_json.js [--opcoes <json com valores por item da carga>] [--exige SIGLA,SIGLA]
   Só estrutura e número: nenhum texto de item ou de âncora entra aqui. */
const fs = require('fs');
const path = require('path');
const F = require('./fontes_estrutura.js');

const ARQ = path.join(F.RAIZ, 'docs', 'escalas', 'fontes.json');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const opcoesCarga = opt('--opcoes') ? JSON.parse(fs.readFileSync(opt('--opcoes'), 'utf8')) : null;
const exigir = opt('--exige') ? opt('--exige').split(',') : [];

const FONTE_VAZIA = () => ({ ref: null, arquivo: null, pagina: null, tabela: null, trecho: null, conferido_por: null });
const anterior = fs.existsSync(ARQ) ? JSON.parse(fs.readFileSync(ARQ, 'utf8')) : { escalas: {} };
const ant = cod => (anterior.escalas && anterior.escalas[cod]) || {};
const fonteAnterior = (cod, caminho) => {
  const a = ant(cod);
  if (!a.fontes_estrutura) return null;
  return a.fontes_estrutura[caminho] || null;
};

const novo = {
  _sobre: 'Fontes das escalas do COGNIATIVO. Estrutura gerada do código (scripts/gerar_fontes_json.js); `fonte` anotada à mão: arquivo do PDF no cache local VMC-offline/fontes_escalas/<SIGLA>/ (fora do repositório), página, tabela e um trecho curto de como o número aparece. `exige_pagina` = toda faixa e bloco de estrutura precisa de fonte com página (Lote C em diante). Conferido por scripts/testes/teste_fontes.js (portão) e scripts/conferir_fontes_pdf.py (PC). Sem texto de item ou de âncora.',
  gerado_em: new Date().toISOString().slice(0, 10),
  escalas: {}
};

const est = F.estruturas(opcoesCarga);
Object.keys(est).forEach(cod => {
  const x = est[cod], a = ant(cod);
  const faixasAnt = (a.faixas || []);
  const faixas = x.estrutura.faixas.map(f => {
    const velha = faixasAnt.find(v => v.min === f.min && v.max === f.max);
    return Object.assign({}, f, { fonte: (velha && velha.fonte) || FONTE_VAZIA() });
  });
  const estrutura = Object.assign({}, x.estrutura); delete estrutura.faixas;
  const blocos = ['ancoras'].concat(estrutura.ancoras_por_item ? ['ancoras_por_item'] : [], estrutura.reversos ? ['reversos'] : [], estrutura.subescalas ? ['subescalas'] : [], estrutura.composto ? ['composto'] : [], estrutura.faixas_subescalas ? ['faixas_subescalas'] : [], estrutura.estagios ? ['estagios'] : []);
  const fontesEstrutura = {};
  blocos.forEach(b => { fontesEstrutura[b] = fonteAnterior(cod, b) || FONTE_VAZIA(); });
  const entrada = {
    exige_pagina: exigir.indexOf(cod) >= 0 ? true : !!a.exige_pagina,
    estrutura,
    fontes_estrutura: fontesEstrutura,
    faixas
  };
  if (estrutura.estagios) {
    // 19.0.1: sem faixa no escore, mas com regra de estágio — o que a fonte diz é sempre a nota atual do catálogo
    entrada.corte = { status: 'regra_de_estagio', fonte_diz: x.nota_faixas || null };
  } else if (!faixas.length && !estrutura.faixas_subescalas) {
    entrada.corte = { status: 'sem_corte', fonte_diz: (a.corte && a.corte.fonte_diz) || x.nota_faixas || null };
  } else if (x.nota_faixas) entrada.nota_faixas = x.nota_faixas;
  if (x.comentario_codigo) entrada.comentario_codigo = x.comentario_codigo;
  entrada.referencias = x.referencias.map(r => {
    const velha = (a.referencias || []).find(v => (r.doi && v.doi === r.doi) || v.id === r.id);
    return velha && velha.arquivo ? Object.assign({}, r, { arquivo: velha.arquivo }) : r;
  });
  if (a.validacao_br) entrada.validacao_br = a.validacao_br;
  novo.escalas[cod] = entrada;
});

fs.mkdirSync(path.dirname(ARQ), { recursive: true });
fs.writeFileSync(ARQ, JSON.stringify(novo, null, 1) + '\n', 'utf8');
const n = Object.keys(novo.escalas).length;
const comFaixa = Object.keys(novo.escalas).filter(c => novo.escalas[c].faixas.length || novo.escalas[c].estrutura.faixas_subescalas).length;
const dois = Object.values(novo.escalas).reduce((s, e) => s + e.referencias.filter(r => r.doi).length, 0);
console.log('fontes.json: ' + n + ' escalas, ' + comFaixa + ' com faixas, ' + dois + ' referências com DOI → ' + path.relative(F.RAIZ, ARQ));
