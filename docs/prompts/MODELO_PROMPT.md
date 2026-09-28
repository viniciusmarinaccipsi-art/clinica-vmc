# MODELO DE PROMPT — pacote de frontend em `index-dev.html` (a partir do 16.5f)

Modelo com as 8 regras da esteira (`VMC-offline\ESTEIRA_16_5_DUPLICACOES_E_ADEQUACOES.md` §3.1) embutidas. O chat copia este arquivo para `docs/prompts/<fase>/PROMPT_<pacote>.md`, preenche os `<…>` e apaga o que não se aplica. O que está entre `[[ ]]` é instrução para quem escreve o prompt, não para o Code. Alvo: ≤ 80 linhas; o Code lê `CLAUDE.md` sozinho — não repetir `docs/arquitetura.md` nem `docs/licoes-aprendidas.md` inteiros, citar a seção quando ela importa.

---

# PROMPT · Pacote <N> — <título curto> (index-dev)

**Pré-requisito:** `scripts/vmc_playwright_base.js`, `scripts/vmc_fumaca.js`, `scripts/validar_index_dev.py` e `conferir_entrega_16_5.py --so-gabarito` existem (16.5-esteira). Se algum faltar, pare e avise.

**Leia (só isto):** `CLAUDE.md`; `../VMC-offline/PACOTE_<anterior>_RELATORIO.md`; entrada do Design da fase: `<docs/design/16.5/rodadaN/02_telas.md (telas X, Y)>`, `<03_componentes.md §n>`, `<01_png/…>`; `<docs/arquitetura.md, seção "…">` [[só se o pacote depender de um padrão específico]]. Referência que vence em conflito com a prancha: `<decisão do usuário, data, onde está registrada>`.

## Contexto
- `main` = `origin/main`, linha 2 = "Pacote <anterior>" (`<commit>`). Só `index-dev.html` (+ docs + status). `Código.js`, planilha e `index.html` intocados. [[Se o backend mudar, o pacote não é deste modelo: usar a esteira com `clasp` do CLAUDE.md.]]
- Gabarito clínico: md5 igual antes e depois (`python scripts/conferir_entrega_16_5.py --so-gabarito`). Contrato: `<56>` chaves do payload iguais à linha de base em modo fingir. **Envio real:** <não | sim — motivo: contrato/`Código.js`/planilha mudou ou fechamento de fase> (último envio real: <data>, pacote <N>).
- Regressão: abaixo de <900> px nada muda — capturas 390 de `<telas>` idênticas às do pacote anterior (nomes fixos).

## Decisões (fechadas — <onde>)
1. <…>
2. <…>
n. Zero cor fixa fora do `:root`; zero classe nova sem uso; nenhum texto novo de interface sem motivo registrado; toque ≥ 44 px; emoji 0.

## Passos
1. **Linha de base:** `--so-gabarito` (md5); `python scripts/validar_index_dev.py --antes`; capturas 390 das telas que o pacote toca (nomes fixos: `<rotulo>_<tela>_390.png`), via roteiro sobre `vmc_playwright_base.js`; payload em modo fingir = linha de base (`<caminho do JSON de referência>`).
2. Edições por `str_replace` com verificação (grep do trecho + `wc -l`); CSS antes, JS depois. Bug fora do escopo → `<N>.1`, não corrigir.
3. `python scripts/validar_index_dev.py --depois` → tabela antes × depois no relatório; `RESULTADO: OK` obrigatório.
4. **Playwright local, modo fingir** (Chrome visível), roteiro `../PACOTE_<N>_fluxo.js` sobre `vmc_playwright_base.js`, viewports `<390,1280 | 390,1000,1280>`: <fluxo mínimo que prova o pacote: p. ex. Negativo completo até "Registro enviado" + "Salvar e sair" + …>; `pageerror` 0, `dialog` 0, payload = linha de base, capturas 390 = passo 1. [[Uma passagem completa, antes do commit. Nada de passagem completa no publicado.]]
5. Marcador linha 2 = "Pacote <N>"; commit "Pacote <N> — <título> (index-dev)"; merge ff-only em `main`; `git push`.
6. **Fumaça no publicado:** `node scripts/vmc_fumaca.js "<URL>/index-dev.html?v=<N>" --marcador "Pacote <N>" --viewport <390 | 1280> --baseline <JSON da linha de base>` → marcador, login inválido, envio fingido até "Registro enviado", `pageerror` 0. [[Login em `index.html` de produção só quando `index.html` mudar.]]
7. **Docs:** `docs/arquitetura.md` <seção>; `docs/design/icones.md` [[se entrou ícone]]; **`..\status_projeto_vmc.md` (Drive) seções 1, 4, 5, 8, 9 pelo Code** — o chat revisa, não reescreve. Relatório `../VMC-offline/PACOTE_<N>_RELATORIO.md` ≤ 60 linhas: resultado (tabela), o que mudou (5–8 linhas), decisões e desvios, textos de interface (só os que mudaram), capturas (nomes), checklist abaixo conferido caixa a caixa pelo Code no publicado. Sem inventário por grep (fica no diff) e sem seção "Para o status".
8. Memória do Code: só ponteiros (commit, pendência), nunca o conteúdo do status.

## Checklist (o Code confere no publicado e escreve o resultado no relatório; o usuário faz só o julgamento visual em <viewport>)
- [ ] <critério objetivo 1>
- [ ] <critério objetivo 2>
- [ ] `pageerror` 0, `dialog` 0, payload `<56>` chaves = linha de base, gabarito md5 igual, `validar_index_dev.py` OK.

---

## Regras que este modelo aplica (para quem escreve o prompt)

1. **Prompt enxuto** — leitura = `CLAUDE.md` + relatório anterior + entrada do Design; seção citada, nunca doc inteiro.
2. **Playwright em duas passagens** — local fingir (completa, antes do commit) + fumaça no publicado (`vmc_fumaca.js`).
3. **Envio real** só quando o contrato, `Código.js` ou a planilha mudarem, ou no fechamento de fase; registrar a data do último.
4. **Status pelo Code** no fechamento (seções 1, 4, 5, 8, 9 do `..\status_projeto_vmc.md`); relatório sem "Para o status"; memória do Code só ponteiros.
5. **Relatório ≤ 60 linhas**, sem inventário por grep.
6. **Checklist = critério de aceite conferido pelo Code**; usuário só o visual.
7. **Capturas** só das telas novas/alteradas, em 390; 1280 só quando o pacote toca o computador; nome fixo por tela.
8. **Gabarito** só por md5 (`--so-gabarito`); `CONFERENCIA_*.md` só é regenerada quando chega rodada nova do Design.
