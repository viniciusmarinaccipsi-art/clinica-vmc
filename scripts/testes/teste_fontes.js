/* Fontes das escalas (22/11/2026) — portão: o código em produção e docs/escalas/fontes.json dizem a mesma coisa.
   Confere, escala a escala: itens, valores das âncoras, reversos, pesos por item, subescalas, composto, faixas e DOIs
   das referências da ficha. Escala com `exige_pagina` (Lote C em diante) precisa de fonte com arquivo, página e trecho
   em toda faixa e em todo bloco de estrutura (ou `conferido_por: "imagem"` com a captura). Nas antigas, faixa sem
   página sai como AVISO, sem reprovar. Não abre PDF (isso é scripts/conferir_fontes_pdf.py, no PC).
   Uso: node scripts/testes/teste_fontes.js */
const fs = require('fs');
const path = require('path');
const F = require('../fontes_estrutura.js');

const ARQ = path.join(F.RAIZ, 'docs', 'escalas', 'fontes.json');
let passo = 0, falhas = 0, avisos = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 300) : '')); } };
const aviso = n => { avisos++; console.log('  aviso ' + n); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const temFonte = f => !!(f && f.arquivo && f.trecho && (f.pagina !== null && f.pagina !== undefined || f.conferido_por === 'imagem'));

console.log('0. Arquivo');
ok('docs/escalas/fontes.json existe e é JSON', fs.existsSync(ARQ));
const json = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
const codigo = F.estruturas(null);
const noCodigo = Object.keys(codigo).sort(), noJson = Object.keys(json.escalas || {}).sort();
ok('as mesmas escalas no código e no json (' + noCodigo.length + ')', igual(noCodigo, noJson), { soCodigo: noCodigo.filter(c => noJson.indexOf(c) < 0), soJson: noJson.filter(c => noCodigo.indexOf(c) < 0) });

console.log('1. Estrutura escala a escala');
const CAMPOS = ['itens', 'valor_min', 'valor_max', 'ancoras', 'reversos', 'nao_pontua', 'itens_com_letra', 'criticos', 'condicionais', 'subescalas', 'siglas_subescalas', 'subescala_media_casas', 'multiplicador_subescala', 'composto', 'item_funcional', 'faixas_subescalas', 'escore_max'];
noCodigo.forEach(cod => {
  const c = codigo[cod], j = json.escalas[cod];
  if (!j) return;
  const dif = CAMPOS.filter(k => !igual(c.estrutura[k], (j.estrutura || {})[k]));
  ok(cod + ' · estrutura igual (' + CAMPOS.length + ' campos)', !dif.length, { campos: dif, codigo: dif.map(k => c.estrutura[k]), json: dif.map(k => (j.estrutura || {})[k]) });
  const fxC = c.estrutura.faixas, fxJ = (j.faixas || []).map(f => ({ min: f.min, max: f.max, rotulo: f.rotulo }));
  ok(cod + ' · faixas iguais (' + fxC.length + ')', igual(fxC, fxJ), { codigo: fxC, json: fxJ });
  if (!fxC.length && !c.estrutura.faixas_subescalas) ok(cod + ' · sem faixa: registro "sem_corte" com o que a fonte diz', j.corte && j.corte.status === 'sem_corte' && !!j.corte.fonte_diz, j.corte);
  // pesos por item: o json pode saber mais que o código (vem da carga); o código não pode contradizer o json
  if (j.estrutura && j.estrutura.ancoras_por_item) {
    const fora = Object.keys(j.estrutura.ancoras_por_item).filter(i => j.estrutura.ancoras_por_item[i].some(v => v < c.estrutura.valor_min || v > c.estrutura.valor_max));
    ok(cod + ' · pesos por item dentro do intervalo do servidor', !fora.length, fora);
  }
});

console.log('2. Referências');
noCodigo.forEach(cod => {
  const c = codigo[cod], j = json.escalas[cod];
  if (!j) return;
  const doisC = c.referencias.map(r => r.doi).filter(Boolean).sort(), doisJ = (j.referencias || []).map(r => r.doi).filter(Boolean).sort();
  ok(cod + ' · DOIs da ficha = DOIs do json (' + doisC.length + ')', igual(doisC, doisJ), { ficha: doisC, json: doisJ });
  const ruins = doisJ.filter(d => !/^10\.\d{4,9}\/\S+$/.test(d));
  ok(cod + ' · DOIs bem formados', !ruins.length, ruins);
});

console.log('3. Fontes com página');
noCodigo.forEach(cod => {
  const j = json.escalas[cod]; if (!j) return;
  const pendentes = [];
  (j.faixas || []).forEach(f => { if (!temFonte(f.fonte)) pendentes.push('faixa ' + f.min + '–' + f.max); });
  Object.keys(j.fontes_estrutura || {}).forEach(b => { if (b !== 'ancoras' && !temFonte(j.fontes_estrutura[b])) pendentes.push('estrutura ' + b); });
  (j.faixas || []).concat(Object.values(j.fontes_estrutura || {})).forEach(f => {
    const fo = f.fonte || f;
    if (fo && fo.ref) ok(cod + ' · fonte aponta para referência existente (' + fo.ref + ')', (j.referencias || []).some(r => r.id === fo.ref), fo.ref);
    if (fo && fo.arquivo) ok(cod + ' · fonte dentro do cache da escala (' + fo.arquivo + ')', !/[\\/]|\.\./.test(fo.arquivo), fo.arquivo);
  });
  if (j.exige_pagina) ok(cod + ' · exige página: toda faixa e bloco de estrutura com arquivo, página e trecho', !pendentes.length, pendentes);
  else if (pendentes.length) aviso(cod + ' · sem página em ' + pendentes.length + ' registro(s): ' + pendentes.join(', '));
});

console.log('\n' + passo + ' passos, ' + falhas + ' falha(s), ' + avisos + ' aviso(s)');
if (falhas) process.exit(1);
