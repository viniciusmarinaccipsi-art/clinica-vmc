/* Pacote 16.4.6 — Leituras na janela lenta do Apps Script (index-dev).
   Reproduz os quatro comportamentos do servidor medidos em 28/09/2026 (curl × página Execuções do Apps Script),
   com o servidor INTEIRAMENTE simulado por page.route — nenhuma chamada chega ao Apps Script; dados sintéticos,
   nada clínico, senha nunca passa por aqui (login com sigla inexistente):
     lenta     — toda resposta chega 25 s depois (o script executa rápido; a entrega demora 18–50 s);
     falha     — as leituras falham (rede) até "o servidor voltar"; aí UM clique em "Tentar de novo";
     404       — a primeira resposta de cada leitura é 404 em HTML, as seguintes normais;
     outraRota — lerHistorico, lerEscalas e autenticar respondem como o doGet ({ok:true} sem dados) até "o servidor voltar".
   Mede por cenário: login (segundos, mensagens do overlay, faixa, pedidos), bloco "Sua continuidade", "Novo registro"
   a partir do Início (pedidos de lerHistorico, faixa, seção final), página Automonitoramento (cartões trancados, qual
   aviso, estado da verificação de primeira vez) e pageerror/diálogos.
   Uso (raiz do repositório): node scripts/PACOTE_16_4_6_fluxo.js <url> <rotulo> [cenarios=lenta,falha,404,outraRota] [viewports=390] [dirCapturas] */
const path = require('path');
const vmc = require(path.join(__dirname, 'vmc_playwright_base.js')); // 18.1: movido de .. para scripts/

const url = process.argv[2];
const rotulo = process.argv[3] || 'dev';
const cenarios = (process.argv[4] || 'lenta,falha,404,outraRota').split(',').map(s => s.trim()).filter(Boolean);
const viewports = vmc.viewportsDe(process.argv[5] || '390');
const dirCap = process.argv[6] || path.join(__dirname, '..', '..', 'VMC-offline', 'capturas_16_4_6');
const ATRASO_LENTO_MS = 25000;

/* respostas sintéticas (paciente veterano: há Negativo feito) */
const HIST_OK = { ok: true, anamnese_preenchida: true, anamnese: { nome_completo: 'Paciente Teste' }, total_registros: 3, automonitoramento: [
  { timestamp: '2026-09-20T12:00:00.000Z', versao_formulario: 'v1', data_registro: '2026-09-20', hora_registro: '09:00', humor_nivel: 3, neg_preenchido: 'sim', pos_preenchido: '' },
  { timestamp: '2026-09-24T12:00:00.000Z', versao_formulario: 'v1', data_registro: '2026-09-24', hora_registro: '10:00', humor_nivel: 4, neg_preenchido: '', pos_preenchido: 'sim' },
  { timestamp: '2026-09-27T12:00:00.000Z', versao_formulario: 'v1', data_registro: '2026-09-27', hora_registro: '11:00', humor_nivel: 2, neg_preenchido: 'sim', pos_preenchido: '' }] };
const ESC_OK = { ok: true, total: 1, escalas: [{ timestamp: '2026-09-21T12:00:00.000Z', data_aplicacao: '2026-09-21', instrumento: 'PHQ-9', escore_total: 5, faixa: 'teste' }] };
const LOGIN_INVALIDO = { ok: false, erro: 'Sigla ou senha incorretos' };
const DOGET = { ok: true, mensagem: 'Sistema Clinico Digital VMC - Backend 13.4 (multi-tenant)', versao: 'v1' };
const HTML404 = '<!DOCTYPE html><html><body>Pagina nao encontrada (simulada)</body></html>';
const FINGIDAS_NA_BASE = ['salvarAutomonitoramento'].concat(vmc.ACOES_EDICAO);

/* servidor simulado — registrado DEPOIS do da base, portanto roda antes dele (Playwright: última rota vence) */
async function instalarServidor(page, cenario) {
  const E = { cenario, voltou: false, pedidos: [], vistos404: {} };
  await page.route(/script\.google\.com/, async route => {
    let corpo = null; try { corpo = JSON.parse(route.request().postData() || 'null'); } catch (e) { /* GET */ }
    const acao = corpo && corpo.acao;
    if (!acao || FINGIDAS_NA_BASE.indexOf(acao) !== -1) return route.fallback();
    E.pedidos.push(acao);
    let resp = acao === 'lerHistorico' ? HIST_OK : acao === 'lerEscalas' ? ESC_OK : acao === 'autenticar' ? LOGIN_INVALIDO : { ok: true };
    try {
      if (cenario === 'lenta' && !E.voltou) await new Promise(r => setTimeout(r, ATRASO_LENTO_MS));
      if (cenario === 'falha' && !E.voltou && acao.indexOf('ler') === 0) return await route.abort('failed');
      if (cenario === '404' && acao.indexOf('ler') === 0 && !E.vistos404[acao]) { E.vistos404[acao] = 1; return await route.fulfill({ status: 404, contentType: 'text/html', body: HTML404 }); }
      if (cenario === 'outraRota' && !E.voltou && ['lerHistorico', 'lerEscalas', 'autenticar'].indexOf(acao) !== -1) resp = DOGET;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp) });
    } catch (e) { /* o navegador já desistiu do pedido (estouro de tempo do app) */ }
  });
  return E;
}

const foto = page => page.evaluate(() => {
  const $ = id => document.getElementById(id);
  const cont = $('iniContinuidade'); const falha = $('p5SubAvisoFalha');
  let sessao = null; try { sessao = sessionStorage.getItem('paciente'); } catch (e) { /* */ }
  return {
    secao: typeof secaoAtivaId === 'function' ? secaoAtivaId() : null,
    overlay: $('loadingOverlay').classList.contains('visible'), msg: $('loadingMsg').textContent || '',
    faixa: $('vmcErroRede').classList.contains('visivel'),
    continuidade: !cont ? null : cont.querySelector('.ini-cont-erro') ? 'erro' : cont.querySelector('.ini-skel-l') ? 'carregando'
      : cont.textContent.indexOf('ainda não tem registros') !== -1 ? 'VAZIO (0 registros)' : cont.querySelector('.ini-cont-linha') ? 'dados' : '?',
    avisoPrimeiraVez: !$('p5SubAviso').hidden, avisoFalha: falha ? !falha.hidden : null,
    negTrancado: $('autoCardNeg').classList.contains('bloqueado'), comoUsarDestaque: $('autoCardComoUsar').classList.contains('destaque'),
    p5: P5_STATE.verificado + '/' + P5_STATE.carregando + '/' + P5_STATE.primeiraVez, sessao: sessao === null ? null : sessao.slice(0, 20)
  };
});

/* acompanha a tela a cada 0,5 s e guarda só as mudanças; para quando parar(f) for verdadeiro */
async function acompanhar(page, t0, parar, maxSeg) {
  const eventos = []; let ultimo = ''; let f = null;
  for (let i = 0; i < maxSeg * 2; i++) {
    f = await foto(page);
    const k = JSON.stringify(f);
    if (k !== ultimo) { eventos.push(Object.assign({ t: +((Date.now() - t0) / 1000).toFixed(1) }, f)); ultimo = k; }
    if (parar(f)) break;
    await page.waitForTimeout(500);
  }
  return { final: f, segundos: +((Date.now() - t0) / 1000).toFixed(1), eventos };
}
const contar = (lista, desde) => lista.slice(desde).reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {});

async function medirLogin(S, E) {
  const { page } = S; const n0 = E.pedidos.length;
  await page.click('#loginTipoPaciente'); await S.sleep(200);
  await page.fill('#inputEmail', 'teste-inexistente@exemplo.com'); await page.fill('#inputSenha', 'senha-invalida-de-teste'); // 18.1: login por e-mail
  const msgs = []; const t0 = Date.now(); await page.click('#btnLogin');
  let f = {};
  for (let i = 0; i < 90 * 4; i++) {
    await S.sleep(250);
    f = await page.evaluate(() => ({ msg: document.getElementById('loadingMsg').textContent, faixa: document.getElementById('vmcErroRede').classList.contains('visivel'),
      erro: (el => (!el || el.classList.contains('hidden')) ? '' : el.textContent.trim())(document.getElementById('loginError')), secao: secaoAtivaId(),
      sessao: (() => { try { return sessionStorage.getItem('paciente'); } catch (e) { return '(erro)'; } })() }));
    if (f.msg && msgs.indexOf(f.msg) === -1) msgs.push(f.msg);
    if (f.erro || f.faixa || f.secao !== 'sec-login' || (f.sessao !== null && i > 8)) break;
  }
  return { segundos: +((Date.now() - t0) / 1000).toFixed(1), mensagem: f.erro, faixa: f.faixa, secao: f.secao, sessaoGravada: f.sessao, mensagensOverlay: msgs, pedidos: contar(E.pedidos, n0) };
}

async function recomecar(S) { await S.page.evaluate(() => { try { sessionStorage.clear(); } catch (e) { /* */ } }); await S.ir(); }

async function rodarCenario(browser, vp, cenario) {
  const S = await vmc.abrir(browser, url, vp, { modo: 'fingir', rotulo: rotulo + '_' + cenario, dirCap });
  const { page, R } = S;
  const E = await instalarServidor(page, cenario);
  const C = { cenario, viewport: vp.w + 'x' + vp.h };
  await S.ir();
  C.marcador = R.marcador;

  /* 1. login com sigla inexistente */
  if (cenario !== '404') {
    C.login = await medirLogin(S, E);
    if (C.login.faixa) { E.voltou = true; await page.click('#vmcErroRedeBtn'); C.login.depoisDoClique = await medirLoginFim(S); }
    E.voltou = false;
    await recomecar(S);
  }

  /* 2. Início (bloco "Sua continuidade") e, 2 s depois, "Novo registro" — como quem entra e toca logo no botão */
  let n0 = E.pedidos.length; let t0 = Date.now();
  await S.simularSessao({ secao: 'sec-menu', veterano: false, comoUsarLido: false });
  await S.sleep(Math.max(0, 2000 - (Date.now() - t0)));
  await page.evaluate(() => { iniNovoRegistro(); });
  const fimNovo = f => f.secao === 'sec-auto-passo1' || f.faixa;
  C.novoRegistro = await acompanhar(page, t0, fimNovo, 75);
  if (C.novoRegistro.final.faixa) {
    await S.sleep(1500); C.novoRegistro.naFalha = await foto(page); await S.foto('hub_na_falha', false);
    /* o servidor volta; UM clique em "Tentar de novo" */
    E.voltou = true; const t1 = Date.now(); await page.click('#vmcErroRedeBtn');
    C.novoRegistro.depoisDoClique = await acompanhar(page, t1, f => f.secao === 'sec-auto-passo1' && !f.overlay && f.p5.indexOf('true/false') === 0, 20);
  }
  C.novoRegistro.pedidos = contar(E.pedidos, n0);
  /* a continuidade terminou? (espera o que faltar, até 40 s) */
  const contAcomp = await acompanhar(page, t0, f => f.continuidade !== 'carregando', 40);
  const evCont = C.novoRegistro.eventos.concat(contAcomp.eventos).find(e => e.continuidade && e.continuidade !== 'carregando');
  C.continuidade = { final: contAcomp.final.continuidade, segundos: evCont ? evCont.t : contAcomp.segundos }; // quando mudou, não quando foi conferido

  /* 3. página Automonitoramento: cartões e aviso para esta paciente veterana */
  n0 = E.pedidos.length; const t2 = Date.now();
  await page.evaluate(() => abrirSecao('sec-automonitoramento'));
  C.pagina = await acompanhar(page, t2, f => !f.overlay && !f.faixa && f.p5.indexOf('/false/') !== -1, 45);
  C.pagina.pedidos = contar(E.pedidos, n0);
  await S.foto('hub_final', false);
  C.pageerror = R.pageerror.slice(); C.dialogos = R.dialogos.slice(); C.consoleErros = R.consoleErros.length; C.pedidosTotal = contar(E.pedidos, 0);
  await S.fechar();
  return C;
}

async function medirLoginFim(S) {
  for (let i = 0; i < 40; i++) {
    await S.sleep(500);
    const f = await S.page.evaluate(() => ({ erro: (el => (!el || el.classList.contains('hidden')) ? '' : el.textContent.trim())(document.getElementById('loginError')), faixa: document.getElementById('vmcErroRede').classList.contains('visivel') }));
    if (f.erro || f.faixa) return f;
  }
  return { erro: '(sem mensagem em 20 s)' };
}

function linha(C) {
  const n = C.novoRegistro; const p = C.pagina.final;
  return [
    '== ' + C.cenario + ' @ ' + C.viewport + ' (' + C.marcador + ')',
    C.login ? '  login (e-mail inexistente): ' + C.login.segundos + ' s → ' + JSON.stringify(C.login.mensagem || (C.login.faixa ? 'FAIXA' : '(nada)')) + ' · overlay: ' + JSON.stringify(C.login.mensagensOverlay) + ' · pedidos ' + JSON.stringify(C.login.pedidos) + (C.login.sessaoGravada ? ' · SESSÃO GRAVADA: ' + C.login.sessaoGravada : '') + (C.login.depoisDoClique ? ' · após clique: ' + JSON.stringify(C.login.depoisDoClique) : '') : '  (sem login)',
    '  continuidade: ' + C.continuidade.final + ' em ' + C.continuidade.segundos + ' s',
    '  "Novo registro": ' + n.final.secao + (n.final.faixa ? ' + FAIXA' : '') + ' em ' + n.segundos + ' s · pedidos ' + JSON.stringify(n.pedidos) +
      (n.naFalha ? ' · na falha: aviso1ªvez=' + n.naFalha.avisoPrimeiraVez + ' avisoFalha=' + n.naFalha.avisoFalha + ' trancado=' + n.naFalha.negTrancado : '') +
      (n.depoisDoClique ? ' · após 1 clique: ' + n.depoisDoClique.final.secao + ' p5=' + n.depoisDoClique.final.p5 + ' faixa=' + n.depoisDoClique.final.faixa + ' em ' + n.depoisDoClique.segundos + ' s' : ''),
    '  página Automonitoramento: trancado=' + p.negTrancado + ' aviso1ªvez=' + p.avisoPrimeiraVez + ' avisoFalha=' + p.avisoFalha + ' destaqueComoUsar=' + p.comoUsarDestaque + ' p5(verif/carreg/1ªvez)=' + p.p5 + ' faixa=' + p.faixa + ' · pedidos ' + JSON.stringify(C.pagina.pedidos) + ' · ' + C.pagina.segundos + ' s',
    '  pageerror ' + C.pageerror.length + (C.pageerror.length ? ' ' + JSON.stringify(C.pageerror.slice(0, 2)) : '') + ' · diálogos ' + C.dialogos.length + ' · pedidos no total ' + JSON.stringify(C.pedidosTotal)
  ].join('\n');
}

(async () => {
  const browser = await vmc.abrirNavegador();
  const resultado = { url, rotulo, quando: new Date().toISOString(), cenarios: [] };
  for (const vp of viewports) for (const c of cenarios) {
    const C = await rodarCenario(browser, vp, c);
    resultado.cenarios.push(C); console.log(linha(C));
  }
  await browser.close();
  const saida = vmc.gravarResultado(path.join(path.dirname(dirCap), 'capturas_16_4_6_' + rotulo + '.json'), resultado);
  console.log('-> ' + saida);
})().catch(vmc.falhar);
