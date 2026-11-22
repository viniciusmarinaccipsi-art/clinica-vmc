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
const ESPERADAS = ['AAQ-II', 'ASRS-18', 'AUDIT', 'BAI', 'BDI-II', 'BHS', 'BSS', 'DASS-21', 'DUDIT', 'EAAD', 'EAR', 'EPM', 'ESTUD', 'FTND', 'G-SAS', 'GAD-7', 'MAAS', 'OCI-R', 'PANAS', 'PCL-5', 'PHQ-9', 'PIUQ-SF-9', 'PSS-10', 'PSWQ', 'SAS-LV', 'SAST', 'SCS', 'SPIN', 'SRQ-20', 'SWLS', 'URICA-A', 'URICA-D', 'URICA-HA', 'URICA-T', 'WBSI']; // 17.3: + lote A; 17.5: + lote B; 17.6: + lote E; 17.7: + lote F
ok('servidor e frontend têm as mesmas 35 escalas do gabarito', Object.keys(servidor.tabela).sort().join() === ESPERADAS.join() && Object.keys(cliente.catalogo).sort().join() === ESPERADAS.join(), [Object.keys(servidor.tabela), Object.keys(cliente.catalogo)]);

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

console.log('13. Lote B (17.5): PANAS (somas AP 9–45 / AN 10–50), SPIN (corte 19), OCI-R (6 subescalas + corte 21), ASRS-18 (somas), SCS (médias + média das médias)');
caso('PANAS', 'tudo 1: AP 9, AN 10', tudo(19, 1), { total: 19, faixa: 'AP:9 | AN:10', alerta: 'NAO', item: '', sub: { escore_afeto_positivo: 9, escore_afeto_negativo: 10 } });
caso('PANAS', 'tudo 5: AP 45, AN 50', tudo(19, 5), { total: 95, faixa: 'AP:45 | AN:50', alerta: 'NAO', sub: { escore_afeto_positivo: 45, escore_afeto_negativo: 50 } });
caso('PANAS', 'AP em 5 e AN em 1', com(tudo(19, 1), { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 5 }), { total: 55, faixa: 'AP:45 | AN:10', alerta: 'NAO' });
caso('SPIN', 'tudo 0: mínimo', tudo(17, 0), { total: 0, faixa: 'Abaixo do ponto de corte', alerta: 'NAO', item: '' });
caso('SPIN', '18: último abaixo do corte', somando(17, 4, 18), { total: 18, faixa: 'Abaixo do ponto de corte', alerta: 'NAO' });
caso('SPIN', '19: primeiro sugestivo', somando(17, 4, 19), { total: 19, faixa: 'Sugestivo de ansiedade social', alerta: 'NAO' });
caso('SPIN', 'tudo 4: máximo 68', tudo(17, 4), { total: 68, faixa: 'Sugestivo de ansiedade social', alerta: 'NAO' });
caso('OCI-R', 'tudo 0', tudo(18, 0), { total: 0, faixa: 'Total:Abaixo do ponto de corte | Ver:0 | Lav:0 | Ord:0 | Acu:0 | Obs:0 | Neu:0', alerta: 'NAO', item: '',
  sub: { escore_verificacao: 0, escore_lavagem: 0, escore_ordenacao: 0, escore_acumulacao: 0, escore_obsessoes: 0, escore_neutralizacao: 0 } });
caso('OCI-R', '20 pontos (Ver 12 + Lav 8): abaixo do corte', com(tudo(18, 0), { 2: 4, 8: 4, 14: 4, 5: 4, 11: 4 }), { total: 20, faixa: 'Total:Abaixo do ponto de corte | Ver:12 | Lav:8 | Ord:0 | Acu:0 | Obs:0 | Neu:0', alerta: 'NAO', sub: { escore_verificacao: 12, escore_lavagem: 8 } });
caso('OCI-R', '21 pontos (Ver 12 + Lav 9): sugestivo', com(tudo(18, 0), { 2: 4, 8: 4, 14: 4, 5: 4, 11: 4, 17: 1 }), { total: 21, faixa: 'Total:Sugestivo de TOC | Ver:12 | Lav:9 | Ord:0 | Acu:0 | Obs:0 | Neu:0', alerta: 'NAO', sub: { escore_lavagem: 9 } });
caso('OCI-R', 'tudo 4: máximo 72', tudo(18, 4), { total: 72, faixa: 'Total:Sugestivo de TOC | Ver:12 | Lav:12 | Ord:12 | Acu:12 | Obs:12 | Neu:12', alerta: 'NAO' });
caso('ASRS-18', 'tudo 0', tudo(18, 0), { total: 0, faixa: 'Des:0 | Hip:0', alerta: 'NAO', item: '', sub: { escore_desatencao: 0, escore_hiperatividade: 0 } });
caso('ASRS-18', 'tudo 4: 36 + 36', tudo(18, 4), { total: 72, faixa: 'Des:36 | Hip:36', alerta: 'NAO', sub: { escore_desatencao: 36, escore_hiperatividade: 36 } });
caso('ASRS-18', 'desatenção em 4, hiperatividade em 0', com(tudo(18, 0), { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4 }), { total: 36, faixa: 'Des:36 | Hip:0', alerta: 'NAO' });
const SCS_NEG = [1, 2, 4, 6, 8, 11, 13, 16, 18, 20, 21, 24, 25];
const scs = (pos, neg) => { const r = {}; for (let i = 1; i <= 26; i++) r[i] = SCS_NEG.indexOf(i) !== -1 ? neg : pos; return r; };
caso('SCS', 'tudo 3: todas as médias 3, total 3', tudo(26, 3), { total: 78, faixa: 'Bon:3 | Auc:3 | Hum:3 | Iso:3 | Min:3 | Sob:3 | Total: 3', alerta: 'NAO', item: '',
  sub: { escore_bondade: 3, escore_autocritica: 3, escore_humanidade: 3, escore_isolamento: 3, escore_mindfulness: 3, escore_sobreidentificacao: 3, escore_autocompaixao: 3 } });
caso('SCS', 'positivos em 5 e negativos em 1 (invertem para 5): autocompaixão máxima 5', scs(5, 1), { total: 130, faixa: 'Bon:5 | Auc:5 | Hum:5 | Iso:5 | Min:5 | Sob:5 | Total: 5', alerta: 'NAO',
  sub: { escore_bondade: 5, escore_autocritica: 5, escore_autocompaixao: 5 } });
caso('SCS', 'positivos em 1 e negativos em 5 (invertem para 1): mínimo 1', scs(1, 5), { total: 26, faixa: 'Bon:1 | Auc:1 | Hum:1 | Iso:1 | Min:1 | Sob:1 | Total: 1', alerta: 'NAO', sub: { escore_autocompaixao: 1 } });
caso('SCS', 'tudo 5 cru: negativos viram 1 → médias 5 e 1, total 3', tudo(26, 5), { total: 78, faixa: 'Bon:5 | Auc:1 | Hum:5 | Iso:1 | Min:5 | Sob:1 | Total: 3', alerta: 'NAO', sub: { escore_autocritica: 1, escore_autocompaixao: 3 } });
caso('SCS', 'decimal: bondade 5,4,4,4,4 (média 4,2) e o resto 3 → total (4,2 + 15) / 6 = 3,2', com(tudo(26, 3), { 5: 5, 12: 4, 19: 4, 23: 4, 26: 4 }),
  { total: 84, faixa: 'Bon:4,2 | Auc:3 | Hum:3 | Iso:3 | Min:3 | Sob:3 | Total: 3,2', alerta: 'NAO', sub: { escore_bondade: 4.2, escore_autocompaixao: 3.2 } });

console.log('14. Lote E (17.6): AUDIT (zonas da OMS; itens 9 e 10 valem 0/2/4), FTND (níveis + 2 fatores), G-SAS (faixas de Kim 2009), EAAD/ESTUD (médias + média geral)');
caso('AUDIT', 'tudo 0: baixo risco', tudo(10, 0), { total: 0, faixa: 'Uso de baixo risco', alerta: 'NAO', item: '' });
caso('AUDIT', '7: último de baixo risco', somando(10, 4, 7), { total: 7, faixa: 'Uso de baixo risco', alerta: 'NAO' });
caso('AUDIT', '8: primeiro de uso de risco (corte brasileiro 7/8)', somando(10, 4, 8), { total: 8, faixa: 'Uso de risco', alerta: 'NAO' });
caso('AUDIT', '16: uso nocivo', somando(10, 4, 16), { total: 16, faixa: 'Uso nocivo', alerta: 'NAO' });
caso('AUDIT', '20: provável dependência', somando(10, 4, 20), { total: 20, faixa: 'Provável dependência', alerta: 'NAO' });
caso('AUDIT', 'itens 9 e 10 em 4 e o resto 0: 8 = uso de risco', com(tudo(10, 0), { 9: 4, 10: 4 }), { total: 8, faixa: 'Uso de risco', alerta: 'NAO' });
caso('AUDIT', 'tudo 4: máximo 40', tudo(10, 4), { total: 40, faixa: 'Provável dependência', alerta: 'NAO' });
caso('FTND', 'tudo 0: muito baixa', tudo(6, 0), { total: 0, faixa: 'Total:Dependência muito baixa | Mat:0 | Pad:0', alerta: 'NAO', item: '', sub: { escore_matinal: 0, escore_padrao: 0 } });
caso('FTND', 'item 1 = 3 (primeiro cigarro em 5 min): 3 = baixa', com(tudo(6, 0), { 1: 3 }), { total: 3, faixa: 'Total:Dependência baixa | Mat:0 | Pad:3', alerta: 'NAO', sub: { escore_padrao: 3 } });
caso('FTND', 'item 1 = 3, itens 3 e 5 = 1: 5 = média, matinal 2', com(tudo(6, 0), { 1: 3, 3: 1, 5: 1 }), { total: 5, faixa: 'Total:Dependência média | Mat:2 | Pad:3', alerta: 'NAO', sub: { escore_matinal: 2, escore_padrao: 3 } });
caso('FTND', 'itens 1 e 4 = 3: 6 = elevada', com(tudo(6, 0), { 1: 3, 4: 3 }), { total: 6, faixa: 'Total:Dependência elevada | Mat:0 | Pad:6', alerta: 'NAO' });
caso('FTND', 'máximo 10: muito elevada (matinal 2, padrão 8)', { 1: 3, 2: 1, 3: 1, 4: 3, 5: 1, 6: 1 }, { total: 10, faixa: 'Total:Dependência muito elevada | Mat:2 | Pad:8', alerta: 'NAO', sub: { escore_matinal: 2, escore_padrao: 8 } });
caso('G-SAS', 'tudo 0: abaixo da faixa leve', tudo(12, 0), { total: 0, faixa: 'Abaixo da faixa leve', alerta: 'NAO', item: '' });
caso('G-SAS', '7: último abaixo de leve', somando(12, 4, 7), { total: 7, faixa: 'Abaixo da faixa leve', alerta: 'NAO' });
caso('G-SAS', '8: leve', somando(12, 4, 8), { total: 8, faixa: 'Leve', alerta: 'NAO' });
caso('G-SAS', '21: moderado', somando(12, 4, 21), { total: 21, faixa: 'Moderado', alerta: 'NAO' });
caso('G-SAS', '31: severo', somando(12, 4, 31), { total: 31, faixa: 'Severo', alerta: 'NAO' });
caso('G-SAS', '41: extremo', somando(12, 4, 41), { total: 41, faixa: 'Extremo', alerta: 'NAO' });
caso('G-SAS', 'tudo 4: máximo 48', tudo(12, 4), { total: 48, faixa: 'Extremo', alerta: 'NAO' });
caso('EAAD', 'tudo 3: médias 3 e média geral 3', tudo(24, 3), { total: 72, faixa: 'Emo:3 | Soc:3 | Pre:3 | Abs:3 | Média: 3', alerta: 'NAO', item: '',
  sub: { escore_emocoes_negativas: 3, escore_social_positivo: 3, escore_preocupacoes: 3, escore_abstinencia_impulsos: 3, escore_media_geral: 3 } });
caso('EAAD', 'tudo 5: máximo', tudo(24, 5), { total: 120, faixa: 'Emo:5 | Soc:5 | Pre:5 | Abs:5 | Média: 5', alerta: 'NAO', sub: { escore_media_geral: 5 } });
caso('EAAD', 'decimal: item 1 = 5 e o resto 3 → Abs (5+3+3+3+3)/5 = 3,4; média geral 74/24 = 3,08', com(tudo(24, 3), { 1: 5 }),
  { total: 74, faixa: 'Emo:3 | Soc:3 | Pre:3 | Abs:3,4 | Média: 3,08', alerta: 'NAO', sub: { escore_abstinencia_impulsos: 3.4, escore_media_geral: 3.08 } });
caso('ESTUD', 'tudo 1: mínimo', tudo(24, 1), { total: 24, faixa: 'Emo:1 | Soc:1 | Pre:1 | Abs:1 | Média: 1', alerta: 'NAO', item: '', sub: { escore_media_geral: 1 } });
caso('ESTUD', 'emoções negativas em 5 (itens 3,6,14,16,18,23,24) e o resto 1: Emo 5, média geral (35+17)/24 = 2,17', com(tudo(24, 1), { 3: 5, 6: 5, 14: 5, 16: 5, 18: 5, 23: 5, 24: 5 }),
  { total: 52, faixa: 'Emo:5 | Soc:1 | Pre:1 | Abs:1 | Média: 2,17', alerta: 'NAO', sub: { escore_emocoes_negativas: 5, escore_media_geral: 2.17 } });

console.log('15. Lote F (17.7): DUDIT (cortes 6 e 25; itens 10 e 11 valem 0/2/4), SAST (corte 6), EPM (2 fatores por soma + total), PIUQ-SF-9 e SAS-LV (só total, sem corte)');
caso('DUDIT', 'tudo 0: abaixo do corte', tudo(11, 0), { total: 0, faixa: 'Abaixo do ponto de corte', alerta: 'NAO', item: '' });
caso('DUDIT', '5: último abaixo do corte', somando(11, 4, 5), { total: 5, faixa: 'Abaixo do ponto de corte', alerta: 'NAO' });
caso('DUDIT', '6: triagem positiva (provável problema)', somando(11, 4, 6), { total: 6, faixa: 'Provável problema com drogas', alerta: 'NAO' });
caso('DUDIT', '24: último do provável problema', somando(11, 4, 24), { total: 24, faixa: 'Provável problema com drogas', alerta: 'NAO' });
caso('DUDIT', '25: provável dependência', somando(11, 4, 25), { total: 25, faixa: 'Provável dependência', alerta: 'NAO' });
caso('DUDIT', 'itens 10 e 11 em 4 e o resto 0: 8 = provável problema', com(tudo(11, 0), { 10: 4, 11: 4 }), { total: 8, faixa: 'Provável problema com drogas', alerta: 'NAO' });
caso('DUDIT', 'tudo 4: máximo 44', tudo(11, 4), { total: 44, faixa: 'Provável dependência', alerta: 'NAO' });
caso('SAST', 'tudo 0: abaixo do corte', tudo(25, 0), { total: 0, faixa: 'Abaixo do ponto de corte', alerta: 'NAO', item: '' });
caso('SAST', '5 sim: último abaixo do corte', somando(25, 1, 5), { total: 5, faixa: 'Abaixo do ponto de corte', alerta: 'NAO' });
caso('SAST', '6 sim: triagem positiva (Silveira et al., 2000)', somando(25, 1, 6), { total: 6, faixa: 'Triagem positiva', alerta: 'NAO' });
caso('SAST', 'tudo 1: máximo 25', tudo(25, 1), { total: 25, faixa: 'Triagem positiva', alerta: 'NAO' });
caso('EPM', 'tudo 1: mínimo (10 + 10 = 20)', tudo(20, 1), { total: 20, faixa: 'Cog:10 | Com:10 | Total: 20', alerta: 'NAO', item: '', sub: { escore_cognitivos: 10, escore_comportamentais: 10, escore_total_processos: 20 } });
caso('EPM', 'tudo 5: máximo (50 + 50 = 100)', tudo(20, 5), { total: 100, faixa: 'Cog:50 | Com:50 | Total: 100', alerta: 'NAO', sub: { escore_total_processos: 100 } });
caso('EPM', 'cognitivos (3,4,5,7,8,9,12,14,15,20) em 5 e o resto 1: Cog 50, Com 10, total 60', com(tudo(20, 1), { 3: 5, 4: 5, 5: 5, 7: 5, 8: 5, 9: 5, 12: 5, 14: 5, 15: 5, 20: 5 }),
  { total: 60, faixa: 'Cog:50 | Com:10 | Total: 60', alerta: 'NAO', sub: { escore_cognitivos: 50, escore_comportamentais: 10, escore_total_processos: 60 } });
caso('EPM', 'comportamentais (1,2,6,10,11,13,16,17,18,19) em 3 e o resto 2: Cog 20, Com 30, total 50', com(tudo(20, 2), { 1: 3, 2: 3, 6: 3, 10: 3, 11: 3, 13: 3, 16: 3, 17: 3, 18: 3, 19: 3 }),
  { total: 50, faixa: 'Cog:20 | Com:30 | Total: 50', alerta: 'NAO', sub: { escore_cognitivos: 20, escore_comportamentais: 30, escore_total_processos: 50 } });
caso('PIUQ-SF-9', 'tudo 1: mínimo 9, sem faixa', tudo(9, 1), { total: 9, faixa: '', alerta: 'NAO', item: '' });
caso('PIUQ-SF-9', 'tudo 5: máximo 45', tudo(9, 5), { total: 45, faixa: '', alerta: 'NAO' });
caso('PIUQ-SF-9', 'item 6 = 5 e o resto 1: 13', com(tudo(9, 1), { 6: 5 }), { total: 13, faixa: '', alerta: 'NAO' });
caso('SAS-LV', 'tudo 1: mínimo (fatores 1, total 33)', tudo(33, 1), { total: 33, faixa: 'Per:1 | Ant:1 | Abs:1 | Cib:1 | Uso:1 | Total: 33', alerta: 'NAO', item: '', sub: { escore_perturbacao: 1, escore_uso_excessivo: 1, escore_total_sas: 33 } });
caso('SAS-LV', 'tudo 6: máximo (fatores 6, total 198)', tudo(33, 6), { total: 198, faixa: 'Per:6 | Ant:6 | Abs:6 | Cib:6 | Uso:6 | Total: 198', alerta: 'NAO', sub: { escore_abstinencia: 6, escore_total_sas: 198 } });
caso('SAS-LV', 'item 1 = 6 e o resto 1: Uso (6 + 12)/13 = 1,38; total 38', com(tudo(33, 1), { 1: 6 }), { total: 38, faixa: 'Per:1 | Ant:1 | Abs:1 | Cib:1 | Uso:1,38 | Total: 38', alerta: 'NAO', sub: { escore_uso_excessivo: 1.38, escore_total_sas: 38 } });
caso('SAS-LV', 'item 18 em 6 e o resto 1: Abs (6 + 7)/8 = 1,63 (item 18 pertence à abstinência)', com(tudo(33, 1), { 18: 6 }), { total: 38, faixa: 'Per:1 | Ant:1 | Abs:1,63 | Cib:1 | Uso:1 | Total: 38', alerta: 'NAO', sub: { escore_abstinencia: 1.63 } });
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
