/* scripts/vmc_playwright_base.js — Pacote 16.5-esteira (28/09/2026)
   Módulo com os helpers que todo roteiro Playwright do VMC copiava (PACOTE_16_5c…e_fluxo.js):
   navegador (Chrome instalado, aba visível), sessão simulada do paciente de teste, rota do Apps Script
   com modos "fingir"/"real", coleta de pageerror/console/dialog/requests, capturas com nome fixo,
   preenchimento das 5 etapas e os medidores comuns (topbar, cabeçalho v2, revisão, enviado, folha).

   Uso num roteiro (raiz clinica-vmc\ ou qualquer pasta):
     const vmc = require('./repo-github/scripts/vmc_playwright_base.js');
     (async () => {
       const browser = await vmc.abrirNavegador();
       const resultado = { url, rotulo, modo, viewports: [] };
       for (const vp of vmc.viewportsDe(process.argv[4])) {          // "390,1280" | "390x844,1000x700"
         const S = await vmc.abrir(browser, url, vp, { modo, rotulo, dirCap });
         await S.simularSessao();                                     // paciente VMC, seção Automonitoramento
         await S.iniciarRegistro('neg', 2);                           // checagem (nível 2) → tipo → menu → etapa 1
         await S.preencherEtapas('neg', { comOutro: true });
         await S.nextBtn(); await S.esperarSecao('sec-auto-revisar');
         S.R.revisao = await S.medirRevisao(); await S.foto('revisar_neg');
         const envio = await S.enviar();                              // clica "Enviar Registro" e espera AUT-10
         resultado.viewports.push(S.R); await S.fechar();
       }
       await browser.close(); vmc.gravarResultado(saida, resultado);
     })().catch(vmc.falhar);

   Modos: "fingir" — salvarAutomonitoramento e as ações de edição de Meus Registros são interceptadas ({ok:true});
          nada é gravado; payloads guardados sem `sigla`. "real" — salvarAutomonitoramento chega ao Apps Script
          (linhas no paciente de teste); as ações de edição continuam interceptadas.
   Nenhum dado clínico no log: textos digitados são "de teste (nao clinico)"; senhas nunca passam por aqui. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function carregarPlaywright() {
  try { return require('@playwright/test'); } catch (e) { /* global */ }
  return require(path.join(execSync('npm root -g').toString().trim(), '@playwright', 'test'));
}

const VIEWPORTS = { celular: { w: 390, h: 844 }, computador: { w: 1280, h: 800 } };
const ALTURA_PADRAO = { 390: 844, 1000: 700, 1280: 800 };
const ACOES_EDICAO = ['pacienteMarcarEditandoAuto', 'pacienteLimparEditandoAuto', 'pacienteEditarAutomonitoramento'];
const RE_HOJE = /^Hoje, \d{2}\/\d{2} · \d{2}:\d{2}$/;
const SIGLA_TESTE = 'VMC';

/* "390" | "390,1280" | "390x844,1000x700" | undefined → lista de {w,h}. Sem argumento: celular + computador. */
function viewportsDe(texto) {
  if (!texto) return [VIEWPORTS.celular, VIEWPORTS.computador];
  return String(texto).split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(\d+)(?:x(\d+))?$/);
    if (!m) throw new Error('viewport inválido: ' + s + ' (use 390, 1280 ou 1000x700)');
    const w = +m[1]; return { w, h: m[2] ? +m[2] : (ALTURA_PADRAO[w] || 800) };
  });
}

async function abrirNavegador(opts) {
  const { chromium } = carregarPlaywright();
  const o = Object.assign({ headless: false }, opts || {});
  try { return await chromium.launch(Object.assign({ channel: 'chrome' }, o)); }
  catch (e) { console.error('(canal chrome indisponível: ' + e.message.split('\n')[0] + ' — usando o Chromium do Playwright)'); return chromium.launch(o); }
}

function gravarResultado(caminho, obj) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, JSON.stringify(obj, null, 2));
  return caminho;
}

/* Resumo por viewport (o que se olha primeiro): pageerror, diálogos, erros de console, payloads, capturas. */
function resumo(resultado) {
  return (resultado.viewports || []).map(R => ({ viewport: R.viewport, pageerror: (R.pageerror || []).length, dialogos: (R.dialogos || []).length, consoleErros: (R.consoleErros || []).length, payloads: (R.payloads || []).length, requests: (R.requests || []).length, capturas: (R.capturas || []).length }));
}

function falhar(e) { console.error('FALHA: ' + e.message + '\n' + e.stack); process.exit(1); }

/* Abre um contexto+página no viewport, instala a coleta e a rota do Apps Script e devolve S com os helpers.
   opts: modo ('fingir' | 'real'), rotulo (prefixo das capturas), dirCap (pasta das capturas),
         acoesFingidas (lista; default ACOES_EDICAO), gotoTimeout (ms), colorScheme ('light'|'dark'). */
async function abrir(browser, url, vp, opts) {
  const o = Object.assign({ modo: 'fingir', rotulo: 'dev', dirCap: path.join(process.cwd(), 'capturas'), acoesFingidas: ACOES_EDICAO, gotoTimeout: 60000 }, opts || {});
  const ctxOpts = { viewport: { width: vp.w, height: vp.h } };
  if (o.colorScheme) ctxOpts.colorScheme = o.colorScheme;
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const erros = [];
  const R = { viewport: vp.w + 'x' + vp.h, modo: o.modo, capturas: [], dialogos: [], payloads: [], edicoes: [], consoleErros: [], requests: [], pageerror: erros };
  const S = { page, ctx, vp, modo: o.modo, rotulo: o.rotulo, dirCap: o.dirCap, R, bloquearEnvio: 0 };

  page.on('pageerror', e => erros.push(e.message.slice(0, 200)));
  page.on('crash', () => erros.push('CRASH do renderizador'));
  page.on('console', m => { if (m.type() === 'error') R.consoleErros.push(m.text().slice(0, 160)); });
  page.on('dialog', async d => { R.dialogos.push(d.message().slice(0, 80)); await d.accept(); });
  await page.route(/script\.google\.com/, async route => {
    let corpo = null;
    try { corpo = JSON.parse(route.request().postData() || 'null'); } catch (e) { /* GET ou corpo não-JSON */ }
    const acao = corpo && corpo.acao;
    if (acao) R.requests.push(acao);
    if (acao === 'salvarAutomonitoramento') {
      if (S.bloquearEnvio > 0) { S.bloquearEnvio--; await route.abort('failed'); return; }
      const c = JSON.parse(JSON.stringify(corpo)); delete c.sigla; R.payloads.push(c);
      if (o.modo === 'fingir') { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fingido: true }) }); return; }
    }
    if (o.acoesFingidas.indexOf(acao) !== -1) {
      if (acao === 'pacienteEditarAutomonitoramento') { const c = JSON.parse(JSON.stringify(corpo)); delete c.sigla; R.edicoes.push(c); }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fingido: true, editado_em: '' }) }); return;
    }
    await route.continue();
  });

  /* ---------- helpers básicos ---------- */
  S.sleep = ms => page.waitForTimeout(ms);
  S.ativa = () => page.evaluate(() => (typeof secaoAtivaId === 'function' ? secaoAtivaId() : null) || '(nenhuma)');
  S.esperarOverlay = async () => { for (let i = 0; i < 120; i++) { if (await page.evaluate(() => { const ov = document.getElementById('loadingOverlay'); return !ov || getComputedStyle(ov).display === 'none'; })) break; await page.waitForTimeout(500); } };
  S.esperarSecao = async (id, maxMs) => { const n = Math.ceil((maxMs || 45000) / 500); for (let i = 0; i < n && (await S.ativa()) !== id; i++) await S.sleep(500); return (await S.ativa()) === id; };
  S.esperarPayload = async (nAntes, maxMs) => { const n = Math.ceil((maxMs || 60000) / 500); for (let i = 0; i < n && R.payloads.length === nAntes; i++) await S.sleep(500); return R.payloads.length > nAntes; };
  S.esperar = async (fn, maxMs) => { const n = Math.ceil((maxMs || 30000) / 500); for (let i = 0; i < n; i++) { if (await page.evaluate(fn)) return true; await S.sleep(500); } return false; };
  S.foto = async (nome, full) => { await S.esperarOverlay(); await page.waitForTimeout(350); fs.mkdirSync(o.dirCap, { recursive: true }); const f = path.join(o.dirCap, o.rotulo + '_' + nome + '_' + vp.w + '.png'); await page.screenshot({ path: f, fullPage: full !== false }); R.capturas.push(path.basename(f)); return f; };
  S.marcador = () => page.evaluate(() => (document.childNodes[1] && document.childNodes[1].nodeValue || '').trim().slice(-40));
  S.sprite = ids => page.evaluate(ids => ids.filter(id => !document.getElementById(id)), ids);
  S.contarEmoji = () => page.evaluate(() => (document.body.innerHTML.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu) || []).length);
  S.ultimoPayload = () => R.payloads[R.payloads.length - 1] || null;

  /* ---------- navegação ---------- */
  S.ir = async () => { await page.goto(url, { waitUntil: 'load', timeout: o.gotoTimeout }); await S.sleep(800); R.marcador = await S.marcador(); return R.marcador; };

  /* Login (sigla inexistente por padrão) até a mensagem do servidor: {mensagem, segundos}. Nunca usar credencial real aqui. */
  S.login = async (sigla, senha, maxSeg) => {
    await page.click('#loginTipoPaciente'); await S.sleep(200);
    await page.fill('#inputSigla', sigla || 'ZZZ'); await page.fill('#inputSenha', senha || 'senha-invalida-de-teste');
    const t0 = Date.now(); await page.click('#btnLogin');
    let msg = '';
    for (let i = 0; i < (maxSeg || 60); i++) { await S.sleep(1000); msg = await page.evaluate(() => { const el = document.getElementById('loginError'); return (!el || el.classList.contains('hidden')) ? '' : el.textContent.trim(); }); if (msg) break; }
    return { mensagem: msg || '(sem mensagem em ' + (maxSeg || 60) + ' s)', segundos: Math.round((Date.now() - t0) / 1000) };
  };

  /* Sessão simulada do paciente de teste (sem senha). opts: {sigla, secao, comoUsarLido, veterano} */
  S.simularSessao = async (so) => {
    const p = Object.assign({ sigla: SIGLA_TESTE, secao: 'sec-automonitoramento', comoUsarLido: true, veterano: true }, so || {});
    await page.evaluate(p => {
      sessionStorage.clear(); salvarSessao({ sigla: p.sigla, anamnese_preenchida: true });
      if (p.comoUsarLido) sessionStorage.setItem('autoComoUsarLido', '1');
      atualizarBadgeUsuario(); atualizarMenuConformeSessao();
      if (p.veterano) { P5_STATE.verificado = true; P5_STATE.primeiraVez = false; }
      autoResetState();
      if (p.veterano) { AUTO_STATE.primeiraVezNeg = false; AUTO_STATE.primeiraVezPos = false; AUTO_STATE.primeiroNegFeitoGlobal = true; }
      abrirSecao(p.secao);
    }, p);
    await S.sleep(1200); await S.esperarOverlay();
  };

  /* Da página Automonitoramento: escolhe o tipo → checagem breve (nível 1–5) → "Iniciar novo registro" → tipo → menu → etapa 1. */
  S.iniciarRegistro = async (tipo, nivel) => {
    await page.evaluate(() => abrirSecao('sec-automonitoramento')); await S.sleep(400);
    await page.evaluate(t => hubEscolherTipo(t), tipo); await S.sleep(1000); await S.esperarOverlay();
    if ((await S.ativa()) === 'sec-auto-passo1') {
      await page.evaluate(n => document.querySelector('#sec-auto-passo1 .chk-faixa[data-nivel="' + n + '"]').click(), nivel || 3); await S.sleep(200);
      await page.evaluate(() => document.getElementById('chkBtnIniciar').click()); await S.sleep(700); await S.esperarOverlay();
      await page.evaluate(t => hubEscolherTipo(t), tipo); await S.sleep(700);
    }
    await page.evaluate(() => menuComecar()); await S.sleep(600);
    return S.ativa();
  };

  /* ---------- formulário (etapas) ---------- */
  S.escrever = (sel, txt) => page.evaluate(({ sel, txt }) => { const el = document.querySelector('.section.active > .auto-tipo:not([hidden]) ' + sel); el.value = txt; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, { sel, txt });
  S.abrirGrupo = chave => page.evaluate(chave => document.querySelector('[data-grupo="' + chave + '"] .auto-group-head').click(), chave);
  S.marcar = (chave, n) => page.evaluate(({ chave, n }) => { document.querySelectorAll('[data-grupo="' + chave + '"] .auto-option')[n].querySelector('.auto-option-lbl').click(); }, { chave, n });
  S.nota = (chave, n, v) => page.evaluate(({ chave, n, v }) => { const inp = document.querySelectorAll('[data-grupo="' + chave + '"] .auto-option')[n].querySelector('.auto-slider-inp'); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); }, { chave, n, v });
  S.outro = (chave, txt) => page.evaluate(({ chave, txt }) => { const inp = document.querySelector('[data-grupo="' + chave + '"] .auto-option-other-inp'); inp.value = txt; inp.dispatchEvent(new Event('input', { bubbles: true })); }, { chave, txt });
  S.nextBtn = () => page.evaluate(() => document.querySelector('.section.active > .auto-tipo:not([hidden]) .auto-rodape-next').click());
  S.rodapeTxt = () => page.evaluate(() => (document.querySelector('.section.active > .auto-tipo:not([hidden]) .auto-rodape-next') || {}).textContent);
  S.linhaAtual = () => page.evaluate(() => { const l = document.querySelector('.section.active > .cab .cab-lin.atual'); return l ? l.innerText.replace(/\s+/g, ' ').trim() : null; });
  S.clicarAcao = txt => page.evaluate(txt => { const b = Array.from(document.querySelectorAll('.section.active > .cab .cab-acao')).find(b => b.textContent.trim() === txt); if (b) b.click(); return !!b; }, txt);
  S.clicarBotao = (secId, txt) => page.evaluate(({ secId, txt }) => { const b = Array.from(document.querySelectorAll('#' + secId + ' .b56, #' + secId + ' button')).find(b => b.textContent.trim() === txt); if (b) b.click(); return !!b; }, { secId, txt });

  /* Preenche as 5 etapas do tipo (a partir da etapa 1 aberta) com o mesmo conteúdo de teste do 16.5e:
     etapa 1 texto (+2 grupos no Negativo), etapa 2 dois itens com nota (+ "Outro" com nota se comOutro),
     etapa 3 dois itens, etapa 4 texto + 1 item, etapa 5 texto + 2 itens. Termina na etapa 5 (sem concluir). */
  S.preencherEtapas = async (tipo, po) => {
    const p = Object.assign({ comOutro: false }, po || {});
    await S.escrever('[data-auto-campo="' + tipo + '_sit_o_que"]', 'texto de teste (nao clinico) para a situacao');
    if (tipo === 'neg') { await S.abrirGrupo('neg_sit_tipo_interpessoais'); await S.marcar('neg_sit_tipo_interpessoais', 1); await S.abrirGrupo('neg_sit_tipo_desempenho'); await S.marcar('neg_sit_tipo_desempenho', 0); await S.sleep(200); }
    await S.nextBtn(); await S.sleep(600);
    const gEmo = tipo === 'neg' ? 'neg_emo_tristeza' : 'pos_emo_felicidade';
    await S.abrirGrupo(gEmo); await S.marcar(gEmo, 0); await S.nota(gEmo, 0, 3); await S.marcar(gEmo, 1); await S.nota(gEmo, 1, 4); await S.sleep(150);
    if (p.comOutro) { await S.outro(gEmo, 'outro de teste (nao clinico)'); await S.sleep(150); await S.nota(gEmo, 5, 2); await S.sleep(150); }
    await S.nextBtn(); await S.sleep(600);
    const gFis = tipo === 'neg' ? 'neg_fis_ativacao' : 'pos_fis_calma';
    await S.abrirGrupo(gFis); await S.marcar(gFis, 0); await S.nota(gFis, 0, 4); await S.marcar(gFis, 1); await S.nota(gFis, 1, 3); await S.nextBtn(); await S.sleep(600);
    const gPens = tipo === 'neg' ? 'neg_pens_sobre_mim' : 'pos_pens_autocompaixao';
    await S.escrever('[data-auto-campo-pens="' + tipo + '"]', 'pensamento de teste (nao clinico)');
    await S.abrirGrupo(gPens); await S.marcar(gPens, 0); await S.nota(gPens, 0, 4); await S.nextBtn(); await S.sleep(600);
    const gComp = tipo === 'neg' ? 'neg_comp_isolamento' : 'pos_comp_conexao';
    await S.escrever('[data-auto-campo-comp="' + tipo + '"]', 'comportamento de teste (nao clinico)');
    await S.abrirGrupo(gComp); await S.marcar(gComp, 0); await S.marcar(gComp, 1); await S.sleep(300);
  };

  /* Clica "Enviar Registro" na revisão, espera o payload e a tela "Registro enviado"; devolve o resumo do payload (sem dado clínico). */
  S.enviar = async () => {
    const nAntes = R.payloads.length; const nDiag = R.dialogos.length;
    await page.evaluate(() => document.getElementById('autoBtnEnviar').click());
    await S.esperarPayload(nAntes); await S.esperarSecao('sec-auto-enviado');
    const p = S.ultimoPayload(); const d = p ? p.dados : {};
    return { acao: p && p.acao, chaves: Object.keys(d).sort(), n: Object.keys(d).length, negPre: d.neg_preenchido, posPre: d.pos_preenchido, humor: d.humor_nivel, data: d.data_registro, hora: d.hora_registro, dialogos: R.dialogos.slice(nDiag), secaoDepois: await S.ativa() };
  };

  /* ---------- medidores ---------- */
  S.medirTopbar = () => page.evaluate(() => ({ sobre: document.getElementById('topbarSobre').textContent, titulo: document.getElementById('topbarTitulo').textContent, semVoltar: document.getElementById('topbar').classList.contains('sem-voltar'), acao: document.getElementById('topbarAcao').textContent }));

  S.medirCab = nome => page.evaluate(nome => {
    const sec = document.querySelector('.section.active'); const cab = sec ? sec.querySelector(':scope > .cab') : null;
    if (!cab || cab.hidden) return { tela: nome, secao: secaoAtivaId(), cab: null };
    const q = s => cab.querySelector(s); const alt = el => Math.round(el.getBoundingClientRect().height); const larg = el => Math.round(el.getBoundingClientRect().width);
    const acoes = Array.from(cab.querySelectorAll('.cab-acao')).map(b => b.textContent.trim());
    return {
      tela: nome, secao: secaoAtivaId(), titulo: document.getElementById('topbarTitulo').textContent, progOculto: getComputedStyle(document.getElementById('prog')).display === 'none',
      humor: { nome: q('.cab-humor-nome').textContent, rosto: !!q('.cab-humor-circ use[href^="#i-humor-"]'), circulo: larg(q('.cab-humor-circ')), preenchendo: q('.cab-etapa-nome').textContent, blocoAlt: alt(q('.cab-humor')) },
      trilha: { nos: Array.from(cab.querySelectorAll('.cab-no-item')).map(n => n.className.replace('cab-no-item ', '') + (n.tagName === 'BUTTON' ? '(btn)' : '')), tracos: Array.from(cab.querySelectorAll('.cab-traco')).map(t => t.classList.contains('cheio') ? 1 : 0).join(''), alt: alt(q('.cab-trilha')), noAlvo: Array.from(cab.querySelectorAll('.cab-no-item')).map(n => larg(n) + 'x' + alt(n)), circulo: larg(q('.cab-no')), atualAria: q('.cab-no-item.atual') ? q('.cab-no-item.atual').getAttribute('aria-current') : null, grupoAria: q('.cab-trilha').getAttribute('aria-label') },
      linhas: Array.from(cab.querySelectorAll('.cab-lin')).map(l => ({ etapa: l.getAttribute('data-etapa'), atual: l.classList.contains('atual'), rotulo: l.querySelector('.cab-rot').textContent, rotuloTransborda: l.querySelector('.cab-rot').scrollWidth > l.querySelector('.cab-rot').clientWidth + 1, grupos: l.querySelector('.cab-grupos').textContent.split(' · ').filter(s => s && s !== '…').length, vazio: !!l.querySelector('.cab-vazio'), frase: !!l.querySelector('.cab-frase'), fraseCortada: l.querySelector('.cab-frase') ? l.querySelector('.cab-frase').scrollWidth > l.querySelector('.cab-frase').clientWidth : null, frasePx: l.querySelector('.cab-frase') ? getComputedStyle(l.querySelector('.cab-frase')).fontSize : null, notas: (l.querySelector('.cab-grupos').textContent.match(/:\d|\b[1-5] · /g) || []).length, live: l.querySelector('.cab-grupos').getAttribute('aria-live') })),
      acoes, acoesAlt: Math.min.apply(null, Array.from(cab.querySelectorAll('.cab-acao')).map(alt)), cabLarg: larg(cab), cabAlt: alt(cab), transbordaX: cab.scrollWidth > cab.clientWidth + 1,
      rodape: (sec.querySelector('.auto-tipo:not([hidden]) .auto-rodape-cont') || {}).textContent || '(sem contagem)',
      emoji: (document.body.innerHTML.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu) || []).length
    };
  }, nome);

  S.medirRevisao = () => page.evaluate(() => {
    const sec = document.getElementById('sec-auto-revisar');
    const blocos = Array.from(sec.querySelectorAll('.rvs-bloco')).map(b => ({
      rotulo: b.querySelector('.rvs-rot').textContent.trim(), feita: !!b.querySelector('.rvs-feita'), editar: !!b.querySelector('.lnk'),
      chips: b.querySelectorAll('.rvs-chip').length, linhas: b.querySelectorAll('.rvs-lin').length, barras: b.querySelectorAll('.rvs-barra-fill').length,
      notas: Array.from(b.querySelectorAll('.rvs-nota')).map(n => n.textContent.trim()).filter(Boolean),
      larguras: Array.from(b.querySelectorAll('.rvs-barra-fill')).map(f => f.style.width), frases: b.querySelectorAll('.rvs-frase').length,
      pensItalico: b.querySelector('.rvs-frase-pens') ? getComputedStyle(b.querySelector('.rvs-frase-pens')).fontStyle : null,
      outroNoTexto: Array.from(b.querySelectorAll('.rvs-lin-nome, .rvs-chip')).some(e => e.textContent.indexOf('Outro (') === 0),
      bordaEsq: getComputedStyle(b).borderLeftWidth, alturaEditar: Math.round(b.querySelector('.lnk').getBoundingClientRect().height)
    }));
    const humor = sec.querySelector('#rvsHumor');
    return {
      secao: secaoAtivaId(), tipo: sec.getAttribute('data-tipo'), intro: !sec.querySelector('#rvsIntro').hidden, envio: !sec.querySelector('#rvsEnvio').hidden,
      humor: { nome: document.getElementById('rvsHumorNome').textContent, data: document.getElementById('rvsHumorData').textContent, rosto: !!document.getElementById('rvsHumorRosto').querySelector('use[href^="#i-humor-"]'), editar: !!humor.querySelector('.lnk') },
      blocos, btnEnviar: (document.getElementById('autoBtnEnviar') || {}).textContent, btnEnviarAlt: Math.round(document.getElementById('autoBtnEnviar').getBoundingClientRect().height),
      rodape: (sec.querySelector('.rvs-rodape') || {}).textContent, aviso: sec.querySelector('#rvsAviso').textContent.trim(), html: document.getElementById('rvsBlocos').innerHTML.length,
      emoji: (document.body.innerHTML.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu) || []).length
    };
  });

  S.medirEnviado = async () => { const m = await page.evaluate(() => {
    const sec = document.getElementById('sec-auto-enviado');
    return { secao: secaoAtivaId(), tipo: sec.getAttribute('data-tipo'), titulo: sec.querySelector('.env-titulo').textContent, data: document.getElementById('envData').textContent, txt: sec.querySelector('.env-txt').textContent,
      rotulo: sec.querySelector('.env-rotulo').textContent, itens: Array.from(sec.querySelectorAll('.env-item')).map(b => b.textContent.trim() + ' [' + b.className + ']'), voltar: sec.querySelector('.b56-sec').textContent,
      itensAlt: Array.from(sec.querySelectorAll('.env-item')).map(b => Math.round(b.getBoundingClientRect().height)), fazerTambemIcone: document.getElementById('envFazerTambem').querySelector('use') ? document.getElementById('envFazerTambem').querySelector('use').getAttribute('href') : null,
      check: !!sec.querySelector('.chk-env-circ use[href="#i-check"]'), semVoltar: document.getElementById('topbar').classList.contains('sem-voltar'), sobre: document.getElementById('topbarSobre').textContent };
  }); m.dataHoje = RE_HOJE.test(m.data); return m; };

  S.medirFolha = () => page.evaluate(() => {
    const f = document.getElementById('sairFolha'); const d = f.querySelector('.folha');
    const vis = f.classList.contains('show') && getComputedStyle(f).display !== 'none';
    return { visivel: vis, role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), titulo: d.querySelector('.folha-titulo').textContent, txt: d.querySelector('.folha-txt').textContent,
      botoes: Array.from(d.querySelectorAll('.b56')).map(b => b.textContent.trim() + ':' + Math.round(b.getBoundingClientRect().height)), alca: !!d.querySelector('.folha-alca'), alcaAlt: Math.round(d.querySelector('.folha-alca').getBoundingClientRect().height),
      fundo: getComputedStyle(f).backgroundColor, foco: document.activeElement && document.activeElement.id, raio: getComputedStyle(d).borderTopLeftRadius, rascunho: !!sessionStorage.getItem('automon_rascunho_v4') };
  });

  S.fechar = () => ctx.close();
  return S;
}

module.exports = { carregarPlaywright, VIEWPORTS, viewportsDe, ACOES_EDICAO, RE_HOJE, SIGLA_TESTE, abrirNavegador, abrir, gravarResultado, resumo, falhar };
