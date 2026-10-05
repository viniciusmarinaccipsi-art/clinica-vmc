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
const cliente = new Function(blocoDe(front, 'const ESC_ESCALAS = {') + '\n' + corpoDe(front, 'escValorNumerico') + '\n' + corpoDe(front, 'escCalcularEscoreEAlerta') + '\nreturn { catalogo: ESC_ESCALAS, calc: escCalcularEscoreEAlerta };')();

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
function noCliente(cod, r) {
  const c = cliente.calc(cod, r);
  return {
    escore_total: c.escoreTotal,
    escore_depressao: (c.subescalas && c.subescalas.depressao) ? c.subescalas.depressao.escore : '',
    escore_ansiedade: (c.subescalas && c.subescalas.ansiedade) ? c.subescalas.ansiedade.escore : '',
    escore_estresse: (c.subescalas && c.subescalas.estresse) ? c.subescalas.estresse.escore : '',
    faixa: c.faixa ? c.faixa.rotulo : (c.subescalas ? ('Dep:' + c.subescalas.depressao.faixa.rotulo + ' | Ans:' + c.subescalas.ansiedade.faixa.rotulo + ' | Est:' + c.subescalas.estresse.faixa.rotulo) : ''),
    alerta_risco_flag: c.alertaFlag, alerta_risco_item: c.alertaItem, alerta_risco_valor: c.alertaValor };
}
/* esperado: { total, faixa, alerta: 'SIM'|'NAO', item?, dep?, ans?, est? } */
function caso(cod, nome, respostas, esperado) {
  ['servidor', 'frontend'].forEach(lado => {
    const o = lado === 'servidor' ? noServidor(cod, respostas) : noCliente(cod, respostas);
    const certo = !o.erro && o.escore_total === esperado.total && o.faixa === esperado.faixa && o.alerta_risco_flag === esperado.alerta &&
      (esperado.item === undefined || o.alerta_risco_item === esperado.item) &&
      (esperado.dep === undefined || (o.escore_depressao === esperado.dep && o.escore_ansiedade === esperado.ans && o.escore_estresse === esperado.est));
    ok(cod + ' · ' + nome + ' (' + lado + ')', certo, { esperado, obtido: o });
  });
}

console.log('0. Catálogo');
const ESPERADAS = ['BAI', 'BDI-II', 'DASS-21', 'GAD-7', 'PHQ-9', 'PSS-10', 'SRQ-20'];
ok('servidor e frontend têm as mesmas 7 escalas do gabarito', Object.keys(servidor.tabela).sort().join() === ESPERADAS.join() && Object.keys(cliente.catalogo).sort().join() === ESPERADAS.join(), [Object.keys(servidor.tabela), Object.keys(cliente.catalogo)]);

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

console.log('8. Resposta inválida (servidor recusa)');
ok('PHQ-9 com um item sem resposta', servidor.calc('PHQ-9', c => (c === 'item_05' ? '' : 1)).ok === false);
ok('PHQ-9 com resposta fora da faixa', servidor.calc('PHQ-9', c => (c === 'item_05' ? 4 : 1)).ok === false);
ok('escala desconhecida', servidor.calc('XYZ', () => 1).ok === false);

console.log('\nRESULTADO: ' + (falhas === 0 ? 'OK — ' + passo + '/' + passo + ' provas' : falhas + ' FALHA(S) em ' + passo + ' provas'));
process.exit(falhas === 0 ? 0 : 1);
