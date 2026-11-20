/* Pacote 18.8 — gabarito dos escores das escalas (portão E4).
   Casos escritos à mão a partir dos pontos de corte de cada instrumento (mínimo, máximo, os dois lados de cada
   corte, item de risco). Cada caso é conferido nas DUAS contas: a do servidor (_escoresDaEscala_, Código.js) e a
   do frontend (escCalcularEscoreEAlerta, index-dev.html). Sem dado de paciente.
   Uso: node scripts/testes/teste_escores.js */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const ler = a => fs.readFileSync(path.join(RAIZ, a), 'utf8').replace(/\r\n/g, '\n');
const corpoDe = (src, nome) => { const i = src.indexOf('function ' + nome + '('); if (i < 0) throw new Error('função ausente: ' + nome); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } throw new Error('função sem fim: ' + nome); };
const blocoDe = (src, inicio) => { const i = src.indexOf(inicio); if (i < 0) throw new Error('bloco ausente: ' + inicio); return src.slice(i, src.indexOf('\n};', i) + 3); };

const back = ler('Código.js'), front = ler('index-dev.html');
const servidor = new Function(blocoDe(back, 'var ESCALAS_CALCULO = {') + '\n' + corpoDe(back, '_escoresDaEscala_') + '\nreturn { tabela: ESCALAS_CALCULO, calc: _escoresDaEscala_ };')();
const cliente = new Function(blocoDe(front, 'const ESC_ESCALAS = {') + '\n' + corpoDe(front, 'escValorNumerico') + '\n' + corpoDe(front, 'escCondicionais_') + '\n' + corpoDe(front, 'escCondicionalAtivo_') + '\n' + corpoDe(front, 'escItensFechados_') + '\n' + corpoDe(front, 'escRespostasEfetivas_') + '\n' + corpoDe(front, 'escCalcularEscoreEAlerta') + '\n' + corpoDe(front, 'escCamposSubescalas_') + '\nreturn { catalogo: ESC_ESCALAS, calc: escCalcularEscoreEAlerta, campos: escCamposSubescalas_ };')(); // 17.1: + bloco condicional; 17.2: + colunas das subescalas

let passo = 0, falhas = 0;
const ok = (n, c, x) => { passo++; if (c) console.log('  ok   ' + n); else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 400) : '')); } };

/* Respostas (1..n) que somam `total` pontos, enchendo primeiro os itens fora de `porUltimo` (o item de risco fica
   em zero enquanto o total couber nos outros). */
function somando(n, max, total, porUltimo) {
  const ordem = []; for (let i = 1; i <= n; i++) if (i !== porUltimo) ordem.push(i);
  if (porUltimo) ordem.push(porUltimo);
  const r = {}; let resta = total;
  ordem.forEach(i => { const v = Math.min(max, resta); r[i] = v; resta -= v; });
  if (resta) throw new Error('total ' + total + ' não cabe em ' + n + ' itens de 0 a ' + max);
  return r;
}
/* PSS-10: `pontos` são os pontos já pontuados; os itens invertidos (4, 5, 7, 8) entram como max - pontos. */
const pss = total => { const p = somando(10, 4, total), r = {}; for (let i = 1; i <= 10; i++) r[i] = [4, 5, 7, 8].indexOf(i) !== -1 ? 4 - p[i] : p[i]; return r; };
const tudo = (n, v) => { const r = {}; for (let i = 1; i <= n; i++) r[i] = v; return r; };
const com = (r, extra) => Object.assign({}, r, extra);

function noServidor(cod, r) {
  const s = servidor.calc(cod, c => r[parseInt(c.slice(5), 10)]);
  return s.ok ? s.campos : { erro: s.erro };
}
/* 17.2: o que o cliente grava (escEnviarEscala) — escore_total + as colunas que escCamposSubescalas_ devolve
   (as três do DASS-21 sempre, as da URICA e o composto quando existem, e o resumo em 'faixa') + alerta. */
function noCliente(cod, r) {
  const c = cliente.calc(cod, r);
  const o = { escore_total: c.escoreTotal };
  Object.assign(o, cliente.campos(cliente.catalogo[cod], c));
  o.alerta_risco_flag = c.alertaFlag; o.alerta_risco_item = c.alertaItem; o.alerta_risco_valor = c.alertaValor;
  return o;
}
/* esperado: { total, faixa, alerta: 'SIM'|'NAO', item?, dep?, ans?, est?, sub?: { escore_<chave>: valor, ... } } */
function caso(cod, nome, respostas, esperado) {
  ['servidor', 'frontend'].forEach(lado => {
    const o = lado === 'servidor' ? noServidor(cod, respostas) : noCliente(cod, respostas);
    const certo = !o.erro && o.escore_total === esperado.total && o.faixa === esperado.faixa && o.alerta_risco_flag === esperado.alerta &&
      (esperado.item === undefined || o.alerta_risco_item === esperado.item) &&
      (esperado.dep === undefined || (o.escore_depressao === esperado.dep && o.escore_ansiedade === esperado.ans && o.escore_estresse === esperado.est)) &&
      (esperado.sub === undefined || Object.keys(esperado.sub).every(k => o[k] === esperado.sub[k]));
    ok(cod + ' · ' + nome + ' (' + lado + ')', certo, { esperado, obtido: o });
  });
}

console.log('0. Catálogo');
const ESPERADAS = ['AAQ-II', 'BAI', 'BDI-II', 'BHS', 'BSS', 'DASS-21', 'EAR', 'GAD-7', 'MAAS', 'PCL-5', 'PHQ-9', 'PSS-10', 'PSWQ', 'SRQ-20', 'SWLS', 'URICA-A', 'URICA-D', 'URICA-HA', 'URICA-T', 'WBSI']; // 17.3: + lote A
ok('servidor e frontend têm as mesmas 20 escalas do gabarito', Object.keys(servidor.tabela).sort().join() === ESPERADAS.join() && Object.keys(cliente.catalogo).sort().join() === ESPERADAS.join(), [Object.keys(servidor.tabela), Object.keys(cliente.catalogo)]);

console.log('1. PHQ-9 (0–27; cortes 5, 10, 15, 20; risco: item 9 ≥ 1)');
[[0, 'Sintomas mínimos ou ausentes'], [4, 'Sintomas mínimos ou ausentes'], [5, 'Depressão leve'], [9, 'Depressão leve'], [10, 'Depressão moderada'], [14, 'Depressão moderada'],
  [15, 'Depressão moderadamente grave'], [19, 'Depressão moderadamente grave'], [20, 'Depressão grave'], [24, 'Depressão grave']]
  .forEach(([t, f]) => caso('PHQ-9', 'total ' + t + ', item 9 em zero', somando(9, 3, t, 9), { total: t, faixa: f, alerta: 'NAO', item: '' }));
caso('PHQ-9', 'máximo 27', tudo(9, 3), { total: 27, faixa: 'Depressão grave', alerta: 'SIM', item: 'PHQ9_item9' });
caso('PHQ-9', 'só o item 9 = 1: alerta mesmo com escore mínimo', com(tudo(9, 0), { 9: 1 }), { total: 1, faixa: 'Sintomas mínimos ou ausentes', alerta: 'SIM', item: 'PHQ9_item9' });

console.log('2. GAD-7 (0–21; cortes 5, 10, 15; sem item de risco)');
[[0, 'Ansiedade mínima'], [4, 'Ansiedade mínima'], [5, 'Ansiedade leve'], [9, 'Ansiedade leve'], [10, 'Ansiedade moderada'], [14, 'Ansiedade moderada'], [15, 'Ansiedade grave'], [21, 'Ansiedade grave']]
  .forEach(([t, f]) => caso('GAD-7', 'total ' + t, somando(7, 3, t), { total: t, faixa: f, alerta: 'NAO', item: '' }));

console.log('3. PSS-10 (0–40; itens 4, 5, 7 e 8 invertidos; cortes 14 e 27)');
[[0, 'Estresse baixo'], [13, 'Estresse baixo'], [14, 'Estresse moderado'], [26, 'Estresse moderado'], [27, 'Estresse alto'], [40, 'Estresse alto']]
  .forEach(([t, f]) => caso('PSS-10', 'total ' + t, pss(t), { total: t, faixa: f, alerta: 'NAO', item: '' }));
caso('PSS-10', 'tudo marcado em 0: os 4 invertidos valem 4 cada (16)', tudo(10, 0), { total: 16, faixa: 'Estresse moderado', alerta: 'NAO' });
caso('PSS-10', 'tudo marcado em 4: os 4 invertidos valem 0 (24)', tudo(10, 4), { total: 24, faixa: 'Estresse moderado', alerta: 'NAO' });

console.log('4. DASS-21 (subescalas × 2; risco: item 21 ≥ 2)');
const DEP = [3, 5, 10, 13, 16, 17, 21], ANS = [2, 4, 7, 9, 15, 19, 20], EST = [1, 6, 8, 11, 12, 14, 18];
const dass = (d, a, e) => { const r = tudo(21, 0); const por = (itens, soma, ultimo) => { let resta = soma; itens.filter(i => i !== ultimo).concat(ultimo ? [ultimo] : []).forEach(i => { const v = Math.min(3, resta); r[i] = v; resta -= v; }); }; por(DEP, d, 21); por(ANS, a); por(EST, e); return r; };
const rot = (d, a, e) => 'Dep:' + d + ' | Ans:' + a + ' | Est:' + e;
caso('DASS-21', 'tudo em zero', tudo(21, 0), { total: 0, faixa: rot('Normal', 'Normal', 'Normal'), alerta: 'NAO', dep: 0, ans: 0, est: 0 });
caso('DASS-21', 'último ponto do Normal (4·3·7 → 8·6·14)', dass(4, 3, 7), { total: 14, faixa: rot('Normal', 'Normal', 'Normal'), alerta: 'NAO', dep: 8, ans: 6, est: 14 });
caso('DASS-21', 'primeiro ponto do Leve (5·4·8 → 10·8·16)', dass(5, 4, 8), { total: 17, faixa: rot('Leve', 'Leve', 'Leve'), alerta: 'NAO', dep: 10, ans: 8, est: 16 });
caso('DASS-21', 'primeiro ponto do Moderado (7·5·10 → 14·10·20)', dass(7, 5, 10), { total: 22, faixa: rot('Moderado', 'Moderado', 'Moderado'), alerta: 'NAO', dep: 14, ans: 10, est: 20 });
caso('DASS-21', 'primeiro ponto do Severo (11·8·13 → 22·16·26)', dass(11, 8, 13), { total: 32, faixa: rot('Severo', 'Severo', 'Severo'), alerta: 'NAO', dep: 22, ans: 16, est: 26 });
caso('DASS-21', 'primeiro ponto do Extremamente severo (14·10·17 → 28·20·34)', dass(14, 10, 17), { total: 41, faixa: rot('Extremamente severo', 'Extremamente severo', 'Extremamente severo'), alerta: 'NAO', dep: 28, ans: 20, est: 34 });
caso('DASS-21', 'máximo (42·42·42)', tudo(21, 3), { total: 63, faixa: rot('Extremamente severo', 'Extremamente severo', 'Extremamente severo'), alerta: 'SIM', item: 'DASS21_item21', dep: 42, ans: 42, est: 42 });
caso('DASS-21', 'item 21 = 1 não alerta', com(tudo(21, 0), { 21: 1 }), { total: 1, faixa: rot('Normal', 'Normal', 'Normal'), alerta: 'NAO', item: '', dep: 2, ans: 0, est: 0 });
caso('DASS-21', 'item 21 = 2 alerta', com(tudo(21, 0), { 21: 2 }), { total: 2, faixa: rot('Normal', 'Normal', 'Normal'), alerta: 'SIM', item: 'DASS21_item21', dep: 4, ans: 0, est: 0 });

console.log('5. SRQ-20 (0–20; corte 7; risco: item 17)');
caso('SRQ-20', 'total 0', tudo(20, 0), { total: 0, faixa: 'Baixa probabilidade de TMC', alerta: 'NAO', item: '' });
caso('SRQ-20', 'total 6, item 17 em zero', somando(20, 1, 6, 17), { total: 6, faixa: 'Baixa probabilidade de TMC', alerta: 'NAO', item: '' });
caso('SRQ-20', 'total 7, item 17 em zero', somando(20, 1, 7, 17), { total: 7, faixa: 'Suspeita de transtorno mental comum', alerta: 'NAO', item: '' });
caso('SRQ-20', 'máximo 20', tudo(20, 1), { total: 20, faixa: 'Suspeita de transtorno mental comum', alerta: 'SIM', item: 'SRQ20_item17' });
caso('SRQ-20', 'só o item 17', com(tudo(20, 0), { 17: 1 }), { total: 1, faixa: 'Baixa probabilidade de TMC', alerta: 'SIM', item: 'SRQ20_item17' });

console.log('6. BDI-II (0–63; cortes 14, 20, 29; risco: item 9 ≥ 1; itens 16 e 18 com letra)');
[[0, 'Mínimo'], [13, 'Mínimo'], [14, 'Leve'], [19, 'Leve'], [20, 'Moderado'], [28, 'Moderado'], [29, 'Grave'], [60, 'Grave']]
  .forEach(([t, f]) => caso('BDI-II', 'total ' + t + ', item 9 em zero', somando(21, 3, t, 9), { total: t, faixa: f, alerta: 'NAO', item: '' }));
caso('BDI-II', 'máximo 63', tudo(21, 3), { total: 63, faixa: 'Grave', alerta: 'SIM', item: 'BDI2_item9' });
caso('BDI-II', 'só o item 9 = 1', com(tudo(21, 0), { 9: 1 }), { total: 1, faixa: 'Mínimo', alerta: 'SIM', item: 'BDI2_item9' });
caso('BDI-II', 'respostas com letra ("2b" no 16, "3a" no 18) pontuam o dígito', com(tudo(21, 0), { 16: '2b', 18: '3a' }), { total: 5, faixa: 'Mínimo', alerta: 'NAO', item: '' });

console.log('7. BAI (0–63; cortes 11, 20, 31; sem item de risco)');
[[0, 'Mínimo'], [10, 'Mínimo'], [11, 'Leve'], [19, 'Leve'], [20, 'Moderado'], [30, 'Moderado'], [31, 'Grave'], [63, 'Grave']]
  .forEach(([t, f]) => caso('BAI', 'total ' + t, somando(21, 3, t), { total: t, faixa: f, alerta: 'NAO', item: '' }));

console.log('8. BHS (0–20; Certo = 1, Errado = 0; itens 1, 3, 5, 6, 8, 10, 13, 15, 19 pontuam no "Errado"; cortes 5, 9, 14; sem item de risco)');
const BHS_ERRADO = [1, 3, 5, 6, 8, 10, 13, 15, 19];
/* bhs(p): os p primeiros itens respondidos na direção da desesperança (pontuam), os demais na direção oposta. */
const bhs = p => { const r = {}; for (let i = 1; i <= 20; i++) { const ponto = i <= p, errado = BHS_ERRADO.indexOf(i) !== -1; r[i] = errado ? (ponto ? 0 : 1) : (ponto ? 1 : 0); } return r; };
[[0, 'Mínimo'], [4, 'Mínimo'], [5, 'Leve'], [8, 'Leve'], [9, 'Moderado'], [13, 'Moderado'], [14, 'Grave'], [20, 'Grave']]
  .forEach(([t, f]) => caso('BHS', 'total ' + t, bhs(t), { total: t, faixa: f, alerta: 'NAO', item: '' }));
caso('BHS', 'tudo "Certo": só os 11 itens de chave Certo pontuam (11)', tudo(20, 1), { total: 11, faixa: 'Moderado', alerta: 'NAO' });
caso('BHS', 'tudo "Errado": só os 9 itens de chave Errado pontuam (9)', tudo(20, 0), { total: 9, faixa: 'Moderado', alerta: 'NAO' });

console.log('9. BSS (0–38 = soma dos itens 1–19; 20 e 21 não pontuam; 4 e 5 em 0 fecham os itens 6–19; risco: item 4 ou 5 ≥ 1; sem faixas)');
caso('BSS', 'tudo em zero', tudo(21, 0), { total: 0, faixa: '', alerta: 'NAO', item: '' });
caso('BSS', 'só o item 4 = 1: alerta', com(tudo(21, 0), { 4: 1 }), { total: 1, faixa: '', alerta: 'SIM', item: 'BSS_item4' });
caso('BSS', 'só o item 5 = 2: alerta', com(tudo(21, 0), { 5: 2 }), { total: 2, faixa: '', alerta: 'SIM', item: 'BSS_item5' });
caso('BSS', 'itens 20 e 21 em 2 não somam', com(tudo(21, 0), { 20: 2, 21: 2 }), { total: 0, faixa: '', alerta: 'NAO', item: '' });
caso('BSS', '4 e 5 em 0: os itens 6–19 valem 0 mesmo marcados (só 1–3 contam: 6)', com(tudo(21, 2), { 4: 0, 5: 0 }), { total: 6, faixa: '', alerta: 'NAO', item: '' });
caso('BSS', 'item 4 = 2 e 5 = 0 abre os itens 6–19 (6 + 2 + 28 = 36)', com(tudo(21, 2), { 5: 0 }), { total: 36, faixa: '', alerta: 'SIM', item: 'BSS_item4' });
caso('BSS', 'máximo 38', tudo(21, 2), { total: 38, faixa: '', alerta: 'SIM', item: 'BSS_item5' });
caso('BSS', 'item 20 = 0: o 21 vale 0 mesmo marcado (nada muda no total)', com(tudo(21, 0), { 20: 0, 21: 2 }), { total: 0, faixa: '', alerta: 'NAO', item: '' });
ok('BSS: 20 = 0 dispensa o 21 no servidor (coluna vazia aceita)', servidor.calc('BSS', c => (c === 'item_21' ? '' : 0)).ok === true);
ok('BSS: 4 e 5 = 0 dispensam 6–19 no servidor (colunas vazias aceitas)', servidor.calc('BSS', c => (/item_(0[6-9]|1[0-9])/.test(c) ? '' : 0)).ok === true);

console.log('10. URICA (17.2: 24 itens de 1 a 5; PC 1,5,7,16,19,22 · C 3,6,9,13,14,17 · A 2,4,8,11,18,23 · M 10,12,15,20,21,24; soma por subescala 6–30; prontidão = média C + A + M − média PC; sem faixas; sem item de risco)');
const URICA_PC = [1, 5, 7, 16, 19, 22], URICA_C = [3, 6, 9, 13, 14, 17], URICA_A = [2, 4, 8, 11, 18, 23], URICA_M = [10, 12, 15, 20, 21, 24];
const urica = (pc, c, a, m) => { const r = {}; URICA_PC.forEach((i, k) => r[i] = Array.isArray(pc) ? pc[k] : pc); URICA_C.forEach(i => r[i] = c); URICA_A.forEach(i => r[i] = a); URICA_M.forEach(i => r[i] = m); return r; };
['URICA-A', 'URICA-D', 'URICA-T', 'URICA-HA'].forEach(cod => {
  caso(cod, 'tudo 1: subescalas 6, prontidão 2', tudo(24, 1), { total: 24, faixa: 'PC:6 | C:6 | A:6 | M:6 | Prontidão: 2', alerta: 'NAO', item: '',
    sub: { escore_precontemplacao: 6, escore_contemplacao: 6, escore_acao: 6, escore_manutencao: 6, escore_prontidao: 2 } });
  caso(cod, 'tudo 5: subescalas 30, prontidão 10', tudo(24, 5), { total: 120, faixa: 'PC:30 | C:30 | A:30 | M:30 | Prontidão: 10', alerta: 'NAO',
    sub: { escore_precontemplacao: 30, escore_contemplacao: 30, escore_acao: 30, escore_manutencao: 30, escore_prontidao: 10 } });
});
caso('URICA-A', 'PC em 5 e o resto em 1: prontidão negativa (−2)', urica(5, 1, 1, 1), { total: 48, faixa: 'PC:30 | C:6 | A:6 | M:6 | Prontidão: -2', alerta: 'NAO',
  sub: { escore_precontemplacao: 30, escore_contemplacao: 6, escore_acao: 6, escore_manutencao: 6, escore_prontidao: -2 } });
caso('URICA-D', 'perfil misto com decimal: PC 1,2,3,4,5,1 (16) · C 4 (24) · A 3 (18) · M 2 (12) → 4 + 3 + 2 − 2,667 = 6,3', urica([1, 2, 3, 4, 5, 1], 4, 3, 2),
  { total: 70, faixa: 'PC:16 | C:24 | A:18 | M:12 | Prontidão: 6,3', alerta: 'NAO', sub: { escore_precontemplacao: 16, escore_contemplacao: 24, escore_acao: 18, escore_manutencao: 12, escore_prontidao: 6.3 } });
ok('URICA-A: resposta 0 recusada (mínimo é 1)', servidor.calc('URICA-A', c => (c === 'item_07' ? 0 : 3)).ok === false);
ok('URICA-A: resposta 6 recusada (máximo é 5)', servidor.calc('URICA-A', c => (c === 'item_07' ? 6 : 3)).ok === false);
ok('URICA-A: item 24 vazio recusado (são 24 itens)', servidor.calc('URICA-A', c => (c === 'item_24' ? '' : 3)).ok === false);
ok('DASS-21 continua gravando as três colunas e nenhuma da URICA', (() => { const o = noServidor('DASS-21', tudo(21, 1)); return o.escore_depressao === 14 && o.escore_precontemplacao === undefined && o.faixa === 'Dep:Moderado | Ans:Moderado | Est:Normal'; })(), noServidor('DASS-21', tudo(21, 1)));

console.log('12. Lote A da HumanTrack (17.3: escore único; PSWQ e EAR com reversos e mínimo 1 — inversão min + max − bruto nos dois lados)');
caso('PCL-5', 'tudo 0', tudo(20, 0), { total: 0, faixa: 'Abaixo do ponto de corte', alerta: 'NAO', item: '' });
caso('PCL-5', 'tudo 1 (20): abaixo do corte', tudo(20, 1), { total: 20, faixa: 'Abaixo do ponto de corte', alerta: 'NAO' });
caso('PCL-5', 'último ponto abaixo do corte (35)', somando(20, 4, 35), { total: 35, faixa: 'Abaixo do ponto de corte', alerta: 'NAO' });
caso('PCL-5', 'corte da versão brasileira (36)', somando(20, 4, 36), { total: 36, faixa: 'Sugestivo de TEPT', alerta: 'NAO' });
caso('PCL-5', 'tudo 2 (40): sugestivo; item 15 não é alerta', tudo(20, 2), { total: 40, faixa: 'Sugestivo de TEPT', alerta: 'NAO', item: '' });
caso('PCL-5', 'máximo 80', tudo(20, 4), { total: 80, faixa: 'Sugestivo de TEPT', alerta: 'NAO' });
caso('PSWQ', 'tudo 1: os 5 reversos valem 5 (11 + 25 = 36)', tudo(16, 1), { total: 36, faixa: 'Abaixo do corte clínico', alerta: 'NAO', item: '' });
caso('PSWQ', 'tudo 5: os 5 reversos valem 1 (55 + 5 = 60)', tudo(16, 5), { total: 60, faixa: 'Preocupação elevada', alerta: 'NAO' });
caso('PSWQ', 'tudo 3: 48', tudo(16, 3), { total: 48, faixa: 'Preocupação elevada', alerta: 'NAO' });
caso('PSWQ', 'reversos em 1 e o resto em 5: máximo 80', com(tudo(16, 5), { 1: 1, 3: 1, 8: 1, 10: 1, 11: 1 }), { total: 80, faixa: 'Preocupação muito elevada', alerta: 'NAO' });
caso('PSWQ', 'reversos em 5 e o resto em 1: mínimo 16', com(tudo(16, 1), { 1: 5, 3: 5, 8: 5, 10: 5, 11: 5 }), { total: 16, faixa: 'Abaixo do corte clínico', alerta: 'NAO' });
caso('PSWQ', 'último ponto abaixo do corte (44)', com(tudo(16, 1), { 1: 5, 3: 5, 8: 5, 10: 5, 11: 5, 2: 5, 4: 5, 5: 5, 6: 5, 7: 5, 9: 5, 12: 5 }), { total: 44, faixa: 'Abaixo do corte clínico', alerta: 'NAO' });
caso('PSWQ', 'primeiro ponto do corte clínico (45)', com(tudo(16, 1), { 1: 5, 3: 5, 8: 5, 10: 5, 11: 5, 2: 5, 4: 5, 5: 5, 6: 5, 7: 5, 9: 5, 12: 5, 13: 2 }), { total: 45, faixa: 'Preocupação elevada', alerta: 'NAO' });
caso('PSWQ', 'primeiro ponto do corte em universitários (62)', com(tudo(16, 5), { 1: 1, 3: 1, 8: 1, 10: 1, 11: 1, 2: 1, 4: 1, 5: 1, 6: 1, 7: 3 }), { total: 62, faixa: 'Preocupação muito elevada', alerta: 'NAO' });
caso('EAR', 'tudo 4: os 5 reversos valem 1 (20 + 5 = 25)', tudo(10, 4), { total: 25, faixa: '', alerta: 'NAO', item: '' });
caso('EAR', 'tudo 1: os 5 reversos valem 4 (5 + 20 = 25)', tudo(10, 1), { total: 25, faixa: '', alerta: 'NAO' });
caso('EAR', 'diretos em 4 e reversos em 1: máximo 40', com(tudo(10, 4), { 3: 1, 5: 1, 8: 1, 9: 1, 10: 1 }), { total: 40, faixa: '', alerta: 'NAO' });
caso('EAR', 'diretos em 1 e reversos em 4: mínimo 10', com(tudo(10, 1), { 3: 4, 5: 4, 8: 4, 9: 4, 10: 4 }), { total: 10, faixa: '', alerta: 'NAO' });
caso('AAQ-II', 'tudo 1: mínimo 7', tudo(7, 1), { total: 7, faixa: '', alerta: 'NAO', item: '' });
caso('AAQ-II', 'tudo 7: máximo 49', tudo(7, 7), { total: 49, faixa: '', alerta: 'NAO' });
caso('SWLS', 'tudo 1: mínimo 5, extremamente insatisfeito', tudo(5, 1), { total: 5, faixa: 'Extremamente insatisfeito', alerta: 'NAO', item: '' });
[[9, 'Extremamente insatisfeito'], [10, 'Insatisfeito'], [14, 'Insatisfeito'], [15, 'Um pouco abaixo da média'], [19, 'Um pouco abaixo da média'], [20, 'Satisfação média'],
  [24, 'Satisfação média'], [25, 'Satisfação alta'], [29, 'Satisfação alta'], [30, 'Satisfação muito alta'], [35, 'Satisfação muito alta']]
  .forEach(([t, f]) => caso('SWLS', 'total ' + t, com(tudo(5, 1), (() => { const r = {}; let resta = t - 5; for (let i = 1; i <= 5; i++) { const v = Math.min(6, resta); r[i] = 1 + v; resta -= v; } return r; })()), { total: t, faixa: f, alerta: 'NAO' }));
caso('MAAS', 'tudo 1: mínimo 15', tudo(15, 1), { total: 15, faixa: '', alerta: 'NAO', item: '' });
caso('MAAS', 'tudo 6: máximo 90', tudo(15, 6), { total: 90, faixa: '', alerta: 'NAO' });
caso('WBSI', 'tudo 1: mínimo 15', tudo(15, 1), { total: 15, faixa: '', alerta: 'NAO', item: '' });
caso('WBSI', 'tudo 5: máximo 75', tudo(15, 5), { total: 75, faixa: '', alerta: 'NAO' });
ok('PSWQ: resposta 0 recusada (mínimo é 1)', servidor.calc('PSWQ', c => (c === 'item_02' ? 0 : 3)).ok === false);
ok('PSWQ: resposta 6 recusada (máximo é 5)', servidor.calc('PSWQ', c => (c === 'item_02' ? 6 : 3)).ok === false);
ok('EAR: resposta 5 recusada (máximo é 4)', servidor.calc('EAR', c => (c === 'item_01' ? 5 : 2)).ok === false);
ok('SWLS: resposta 8 recusada (máximo é 7)', servidor.calc('SWLS', c => (c === 'item_05' ? 8 : 4)).ok === false);
ok('PCL-5: item 20 vazio recusado (são 20 itens)', servidor.calc('PCL-5', c => (c === 'item_20' ? '' : 1)).ok === false);
ok('PCL-5: item 21 não é lido (20 itens)', servidor.calc('PCL-5', c => (c === 'item_21' ? 99 : 1)).ok === true);
ok('lote A não grava coluna de subescala', (() => { const o = noServidor('PSWQ', tudo(16, 3)); return o.escore_depressao === '' && o.escore_precontemplacao === undefined; })(), noServidor('PSWQ', tudo(16, 3)));

console.log('11. Resposta inválida (servidor recusa)');
ok('PHQ-9 com um item sem resposta', servidor.calc('PHQ-9', c => (c === 'item_05' ? '' : 1)).ok === false);
ok('PHQ-9 com resposta fora da faixa', servidor.calc('PHQ-9', c => (c === 'item_05' ? 4 : 1)).ok === false);
ok('escala desconhecida', servidor.calc('XYZ', () => 1).ok === false);

console.log('\nRESULTADO: ' + (falhas === 0 ? 'OK — ' + passo + '/' + passo + ' provas' : falhas + ' FALHA(S) em ' + passo + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
