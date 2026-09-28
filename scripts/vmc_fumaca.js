/* scripts/vmc_fumaca.js — Pacote 16.5-esteira (28/09/2026)
   Passagem de fumaça no `index-dev.html` publicado (regra 2b da esteira): substitui a passagem completa no
   publicado e os três logins por viewport. Uma janela do Chrome, um viewport (390 por padrão):
     1. (opcional) espera o Pages servir o marcador da linha 2 (`--marcador "Pacote 16.5f"`, até `--espera` s);
     2. abre a página e lê o marcador;
     3. login com sigla inexistente até a mensagem do servidor (mede segundos; `pageerror` 0);
     4. sessão simulada do paciente de teste → checagem → Negativo completo → Revisar e Enviar → envio FINGIDO
        (rota interceptada; nada gravado) até "Registro enviado"; compara as chaves do payload com a linha de base;
     5. uma captura (`<rotulo>_fumaca_enviado_<w>.png`) e um JSON de resultado; sai com código 1 se algo falhar.

   Uso (raiz do repositório):
     node scripts/vmc_fumaca.js <url> [--viewport 390|1280|WxH] [--rotulo dev-pub] [--marcador "Pacote X"]
                                      [--espera 240] [--baseline <json>] [--dir <pasta das capturas>]
   Exemplo: node scripts/vmc_fumaca.js "https://viniciusmarinaccipsi-art.github.io/clinica-vmc/index-dev.html?v=165f" --marcador "Pacote 16.5f"
   `--baseline`: JSON com as chaves esperadas do payload — aceita `{negativo:{chaves:[…]}}` (formato do
   baseline_payload_16_5e.json), `{chaves:[…]}` ou uma lista. Sem `--baseline`, só registra a contagem.
   Nenhum dado clínico no log; senha nunca passa por aqui (o login é com sigla inexistente). */
'use strict';
const path = require('path');
const fs = require('fs');
const vmc = require('./vmc_playwright_base.js');

function args(argv) {
  const a = { url: null, viewport: '390', rotulo: 'dev-pub', marcador: null, espera: 240, baseline: null, dir: null };
  const resto = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) { const k = t.slice(2); a[k] = argv[i + 1]; i++; } else resto.push(t);
  }
  a.url = resto[0]; a.espera = +a.espera;
  if (!a.url) { console.error('Uso: node scripts/vmc_fumaca.js <url> [--viewport 390] [--rotulo dev-pub] [--marcador "Pacote X"] [--espera 240] [--baseline <json>] [--dir <pasta>]'); process.exit(2); }
  return a;
}

function chavesDaBaseline(caminho) {
  const j = JSON.parse(fs.readFileSync(caminho, 'utf8'));
  if (Array.isArray(j)) return j.slice().sort();
  if (j.negativo && j.negativo.chaves) return j.negativo.chaves.slice().sort();
  if (j.chaves) return j.chaves.slice().sort();
  throw new Error('baseline sem lista de chaves: ' + caminho);
}

async function esperarMarcador(url, marcador, maxSeg) {
  const t0 = Date.now();
  for (;;) {
    let linha2 = '';
    try {
      const r = await fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'nocache=' + Date.now(), { cache: 'no-store' });
      const txt = await r.text(); linha2 = (txt.split('\n')[1] || '').trim();
    } catch (e) { linha2 = '(erro: ' + e.message.slice(0, 60) + ')'; }
    const seg = Math.round((Date.now() - t0) / 1000);
    if (linha2.indexOf(marcador) !== -1) return { ok: true, segundos: seg, linha2 };
    if (seg >= maxSeg) return { ok: false, segundos: seg, linha2 };
    await new Promise(res => setTimeout(res, 10000));
  }
}

(async () => {
  const a = args(process.argv.slice(2));
  const vp = vmc.viewportsDe(a.viewport)[0];
  const dir = a.dir || path.join(__dirname, '..', '..', 'VMC-offline', 'fumaca');
  const F = { url: a.url, rotulo: a.rotulo, viewport: vp.w + 'x' + vp.h, inicio: new Date().toISOString(), checks: {} };

  if (a.marcador) { F.pages = await esperarMarcador(a.url, a.marcador, a.espera); F.checks.marcadorNoPages = F.pages.ok; console.log('Pages: ' + (F.pages.ok ? 'marcador servido em ' + F.pages.segundos + ' s' : 'marcador NÃO apareceu em ' + F.pages.segundos + ' s') + ' — linha 2: ' + F.pages.linha2.slice(-60)); }

  const browser = await vmc.abrirNavegador();
  const S = await vmc.abrir(browser, a.url, vp, { modo: 'fingir', rotulo: a.rotulo, dirCap: dir });
  await S.ir();
  F.marcador = S.R.marcador;
  if (a.marcador) F.checks.marcadorNaPagina = F.marcador.indexOf(a.marcador) !== -1;

  F.login = await S.login();
  F.checks.loginMensagem = /incorret/i.test(F.login.mensagem);

  await S.simularSessao();
  F.inicioRegistro = await S.iniciarRegistro('neg', 2);
  await S.preencherEtapas('neg', { comOutro: false });
  await S.nextBtn(); F.checks.revisao = await S.esperarSecao('sec-auto-revisar', 10000);
  F.envio = await S.enviar();
  F.checks.enviado = F.envio.secaoDepois === 'sec-auto-enviado';
  F.enviado = F.checks.enviado ? await S.medirEnviado() : null;
  await S.foto('fumaca_enviado');
  if (a.baseline) {
    const esperado = chavesDaBaseline(a.baseline); const obtido = F.envio.chaves;
    F.contrato = { esperado: esperado.length, obtido: obtido.length, faltam: esperado.filter(k => obtido.indexOf(k) === -1), sobram: obtido.filter(k => esperado.indexOf(k) === -1) };
    F.checks.contratoIgual = F.contrato.faltam.length === 0 && F.contrato.sobram.length === 0;
  }
  await S.fechar(); await browser.close();

  F.pageerror = S.R.pageerror; F.dialogos = S.R.dialogos; F.consoleErros = S.R.consoleErros; F.requests = S.R.requests; F.capturas = S.R.capturas;
  F.checks.pageerrorZero = S.R.pageerror.length === 0;
  F.checks.dialogosZero = S.R.dialogos.length === 0;
  F.ok = Object.keys(F.checks).every(k => F.checks[k]);

  const saida = vmc.gravarResultado(path.join(dir, 'fumaca_' + a.rotulo + '_' + vp.w + '.json'), F);
  const linhas = [
    ['marcador', F.marcador],
    ['login', F.login.mensagem + ' (' + F.login.segundos + ' s)'],
    ['envio fingido', F.envio.n + ' chaves → ' + F.envio.secaoDepois + (F.contrato ? (F.checks.contratoIgual ? ' · = linha de base' : ' · DIFERE da linha de base: faltam ' + F.contrato.faltam.join(',') + ' sobram ' + F.contrato.sobram.join(',')) : '')],
    ['pageerror / diálogos / console', S.R.pageerror.length + ' / ' + S.R.dialogos.length + ' / ' + S.R.consoleErros.length],
    ['capturas', S.R.capturas.join(', ')],
    ['resultado', F.ok ? 'OK' : 'FALHA em: ' + Object.keys(F.checks).filter(k => !F.checks[k]).join(', ')],
    ['json', saida]
  ];
  console.log(linhas.map(l => l[0].padEnd(32) + l[1]).join('\n'));
  process.exit(F.ok ? 0 : 1);
})().catch(vmc.falhar);
