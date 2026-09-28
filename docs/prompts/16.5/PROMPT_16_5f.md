# PROMPT · Pacote 16.5f — Computador ≥ 900 px (index-dev)

**Pré-requisito:** pacote 16.5-esteira concluído (`scripts/vmc_playwright_base.js`, `scripts/vmc_fumaca.js`, `scripts/validar_index_dev.py`, `--so-gabarito`). Se algum faltar, pare e avise.

**Leia:** `CLAUDE.md`; `../VMC-offline/PACOTE_16_5e_RELATORIO.md`; `docs/design/16.5/rodada3/02_telas.md` (linha 5 e AUT-11), `03_componentes.md` (§6 BarraDeslizante, §17 último item), `01_png/AUT-11_computador-1280.png`; `docs/prompts/MODELO_PROMPT.md`. Referência aprovada pelo usuário: mapa visual §4c (decisão P, 28/09) — resumo abaixo; em conflito com a prancha AUT-11, **§4c vence**.

## Contexto
- `main` = `origin/main`, linha 2 = "Pacote 16.5e" (`4586d3a`). Só `index-dev.html` (+ docs + status). `Código.js`, planilha e `index.html` intocados.
- Gabarito: md5 igual (`--so-gabarito`). Contrato: 56 chaves do payload iguais à linha de base em modo fingir. **Sem envio real** neste pacote.
- Abaixo de 900 px **nada muda** (o celular do 16.5e é a referência de regressão: capturas em 390 idênticas).

## Decisões (fechadas — decisão P)
1. **Grade:** ≥ 900 px `grid 280px minmax(0,1fr)`; ≥ 1280 px `320px minmax(0,1fr)`; gap 32, padding 28/32; conteúdo máx. 760 px. Sem vw/vh. Lateral `position: sticky`.
2. **Lateral, cartão 1 — "SUAS 5 ETAPAS":** gerado do **mesmo DOM do menu** (`#sec-auto-menu`, nomes completos das etapas + ícone). Estado só aqui (≥ 900): feita = círculo cheio na cor do tipo com `i-check`, clicável (abre a etapa); atual = número com borda + fundo `-tint`; a fazer = número cinza. O menu (AUT-03c) continua sem estado.
3. **Lateral, cartão 2 — cabeçalho v2 em coluna:** o mesmo nó do cabeçalho cumulativo, reposicionado por CSS (`grid-area`/ordem), não duplicado. Linhas: HUMOR (rostinho + nome + editar); SITUAÇÃO e COMPORTAMENTOS = **grupos** (como hoje); **EMOÇÕES, REAÇÕES FÍSICAS e PENSAMENTOS = itens marcados com barra de intensidade (largura = nota/5) + nota** — modo "detalhe", lido de `AUTO_STATE.dados`, ativo só ≥ 900 px (no celular a decisão M continua: grupos). Item longo cortado com "…". "ver tudo" → revisão em leitura, como no 16.5e.
4. **Sem cabeçalho cumulativo acima do conteúdo** no computador.
5. **Trilha de ícones das 5 etapas acima do título**, na largura do conteúdo, desconectada da lateral, **fundo `-tint` do tipo, sem borda** (pedido de 28/09). É o nó da trilha do cabeçalho v2 movido por CSS.
6. **Item marcado em duas colunas:** `grid minmax(0,1fr) 400px` — check + nome + "4 · Muito" + rótulo à esquerda; BarraDeslizante real (`--w-slider-desktop`, legenda Nada…Totalmente, círculo com a nota) à direita. Grupos fechados com a descrição visível. Rodapé inline ("‹" · contagem · próxima etapa).
7. **Telas de leitura** — Revisar e Enviar, Registro enviado, menu "Suas 5 etapas", checagem breve e "Checagem enviada": coluna única centrada, **máx. 720 px** (regra do §17 estendida). Folha "Sair sem enviar?": centrada, máx. 480 px.
8. Zero cor fixa fora do `:root`; zero classe sem uso; nenhum texto novo de interface; toque ≥ 44 px; emoji 0.

## Passos
1. Linha de base: gabarito md5; `validar_index_dev.py --antes`; capturas 390 das 5 etapas + revisão (nomes fixos) para comparar depois.
2. Edições por `str_replace` (CSS primeiro; JS só para o estado do cartão de etapas e o modo "detalhe" do cabeçalho).
3. `validar_index_dev.py --depois` (contagens antes × depois no relatório).
4. Playwright local, modo fingir, `vmc_playwright_base.js`: **390, 1000 e 1280** — Negativo completo até "Registro enviado" + "Salvar e sair" + clique numa etapa feita na lateral; `pageerror` 0, `dialog` 0; payload = linha de base; capturas 390 idênticas às do passo 1.
5. Marcador linha 2 = "Pacote 16.5f"; commit "Pacote 16.5f — Computador ≥ 900 px: lateral, trilha, barra em duas colunas (index-dev)"; `git push`; `vmc_fumaca.js` no publicado a **1280** (`?v=165f`).
6. Docs: `docs/arquitetura.md` (breakpoints 900/1280; lateral = cabeçalho v2 reposicionado; modo detalhe). **`..\status_projeto_vmc.md` (Drive) seções 1, 4, 5, 8, 9** pelo Code, edição 9ª na linha 3; **copiar o Drive → `status_projeto_vmc.md` na raiz do repositório e incluir no commit.** Relatório `../VMC-offline/PACOTE_16_5f_RELATORIO.md` ≤ 60 linhas: resultado, o que mudou, decisões/desvios, capturas, checklist abaixo conferido caixa a caixa. Bug fora do escopo → 16.5f.1, não corrigir.

## Checklist (Code confere no publicado; usuário só o visual a 1280 e ~1000 px)
- [ ] 1280: lateral 320 com "SUAS 5 ETAPAS" (feita ✓ clicável, atual em tinte) e o cabeçalho em coluna (grupos na Situação/Comportamentos; item + barra + nota nas etapas 2–4).
- [ ] Trilha acima do título, fundo tinte, sem borda; nenhum cabeçalho cumulativo acima do conteúdo.
- [ ] Item marcado em duas colunas com a barra de 400 px e legenda; grupos fechados mostram a descrição; rodapé inline.
- [ ] 1000: lateral 280, tudo igual. 899 e 390: idêntico ao 16.5e.
- [ ] Revisar e Enviar, Registro enviado, menu, checagem: coluna centrada de 720 px; folha "Sair sem enviar?" centrada.
- [ ] `pageerror` 0, `dialog` 0, payload 56 chaves = linha de base, gabarito md5 igual.
