# Pacote 16.5 · 03_componentes.md — rodada 4 (26/09/2026): só o que muda

Substitui o **§3** da rodada 3 e acrescenta **§18** e **§19**. Os demais parágrafos (§1, §2, §4–§17) continuam os da rodada 3. Medidas em px; tokens de `04_tokens.css`; Figtree em tudo. Cores "do tipo" = `--c-reg-neg*` no Negativo, `--c-reg-pos*` no Positivo (`reg`, `-ink`, `-tint`, `-line`, `-mid`).

## 3. CabeçalhoCumulativo v2

Cartão no topo de cada etapa (1–5), nos dois tipos. Lê só o que já foi marcado; nunca grava.

**Cartão:** fundo `-tint`, borda 1 `-line`, raio `--r-card` 14, `overflow:hidden`; margem 16 (dentro do padding da etapa). Quatro blocos empilhados, separados por filete 1 `--c-line-alpha`.

**Bloco 1 · Humor + etapa atual** — `grid 40px minmax(0,1fr) auto`, gap 12, `align-items:center`, padding 12 14, `min-height` 64.
- Círculo 40 `--c-surface` com o rostinho `i-humor-N` 26 (stroke 2) em `--c-humor-N-ink`.
- Coluna: "HUMOR" (`--t-label` 700 12/1.3, `--ls-label`, caixa alta, cor `-ink`) · nome do nível 600 17/1.25 `--c-ink` (`HUMOR_NOMES`).
- Direita (alinhado à direita, `text-align:right`): "PREENCHENDO" (`--t-label`, `--c-ink-3`) · nome curto da etapa 600 15/1.25 cor `-ink`, `nowrap` ("Situação", "Emoções", "Reações físicas", "Pensamentos", "Comportamentos").

**Bloco 2 · Trilha** — `flex`, `align-items:center`, padding 0 14, altura 48. `role="list"`, `aria-label="Progresso: etapa N de 5"`.
- 5 nós, cada um dentro de um botão 44 × 48 (`role="listitem"`, `aria-label="Etapa N de 5 · nome completo · feita/atual"`, `aria-current="step"` na atual). Entre nós, traço `flex:1` de 2 px.
- Nó: círculo 32 com o ícone da etapa 16 (stroke 2). Ícones: `i-pin` · `i-heart-crack`/`i-heart` · `i-zap`/`i-leaf` · `i-cloud-rain`/`i-sun` · `i-trend-down`/`i-trend-up`.
  - **Feita:** fundo `reg`, borda 2 `reg`, ícone `--c-ink-inv`. Tocável (vai à etapa).
  - **Atual:** fundo `--c-surface`, borda 2 `reg`, ícone `-ink`, anel `box-shadow 0 0 0 4px var(--c-reg-*-mid)`. Não tocável.
  - **Futura:** fundo transparente, borda 1,5 `--c-line-strong`, ícone `--c-ink-3`. Não tocável (`disabled`).
  - Traço: `reg` até a atual (inclusive), `--c-line-strong` depois.
- Sem nome, sem check.

**Bloco 3 · Linhas** — uma por etapa **feita ou atual**, em ordem; `grid 20px minmax(0,1fr)`, gap 10, `align-items:start`, padding 9 14; a partir da 2ª, `border-top 1 --c-line-alpha`.
- Ícone da etapa 20 (stroke 2) cor `-ink`; na linha atual, cor `reg`.
- Conteúdo, um parágrafo 400 14/1.45 `--c-ink` com `overflow-wrap:anywhere`:
  - **Rótulo em linha:** `<span>` 700 12/1 caixa alta, `letter-spacing .06em`, cor `-ink`, `white-space:nowrap`, `margin-right 8` — "SITUAÇÃO", "EMOÇÕES", "REAÇÕES FÍSICAS", "PENSAMENTOS", "COMPORTAMENTOS". Nunca quebra dentro de si; o conteúdo corre depois dele e quebra livremente nas linhas seguintes.
  - **Grupos:** nomes curtos dos grupos com ≥ 1 item marcado (ou "Outro" preenchido), separados por " · ", ordem do catálogo. Regra do nome curto: título do grupo pai sem o prefixo da etapa (`^Situações (de )?`, `^Pensamentos (sobre (o|os)?|de)? `). Nunca subgrupo, nunca nota.
  - **Vazia:** "…" em itálico `--c-ink-3`.
- **Situação:** abaixo dos grupos, a frase do paciente em itálico 400 13/1.4 `--c-ink-2`, `display:block`, uma linha, `text-overflow:ellipsis`. Sem grupos marcados e com frase: só a frase. **Positivo, etapa 1:** só a frase (enquanto não houver grupos).
- **Linha atual:** fundo `--c-surface`; `aria-live="polite"`. Re-renderiza a cada `change` de item/"Outro" e a cada `input` do texto da etapa (mesmo caminho da contagem do rodapé). Ao entrar na etapa, aparece imediatamente (vazia = "…").

**Bloco 4 · Ações** — `flex`, `justify-content:flex-end`, gap 2, padding 2 6, `border-top 1 --c-line-alpha`; altura 48.
- "editar" (`i-pencil` 16) → abre o menu "Suas 5 etapas". "ver tudo" (`i-layers` 16) → abre o detalhe completo (subgrupos com nota). Botões sem borda, 600 14 `--c-action`, gap 6, `min-height` 44, padding 0 10, `nowrap`. Hover: `--c-action-hover`; foco: anel global.

**Medidas de referência (390 px):** etapa 1 = 64 + 48 + 40 + 48 ≈ 200; etapa 5 com Situação em 2 linhas ≈ 64 + 48 + (58 + 40 + 60 + 40 + 40) + 48 ≈ 400. Nada de altura fixa: as linhas crescem com o conteúdo.

**Computador (AUT-11, ≥ 900 px):** o cartão vai para a coluna lateral de 320 px **sem o Bloco 2** (a nav "SUAS 5 ETAPAS" já indica progresso); acima do Bloco 3 entra o título "O QUE JÁ ESTÁ ANOTADO" (`--t-label`, cor `-ink`, padding 10 14 4, filete acima). Mesmas linhas, mesmas ações.

**Tema escuro:** herda os tokens; a linha atual usa `--c-surface` escuro sobre o `-tint` escuro (contraste preservado pelos tokens da rodada 3).

## 18. CartãoChecagemEnviada (AUT-03b)

- Cartão `--c-surface`, borda 1 `--c-line`, **borda esquerda 4 `--c-action`**, raio 14, padding 14 16 14 14, `--sh-1`; `role="status"`.
- `grid 24px minmax(0,1fr)`, gap 8 12, `align-items:center`; três linhas:
  1. `i-thermometer` 20 em `--c-action-ink` · "HUMOR" (`--t-label` caixa alta `--c-action-ink`).
  2. rostinho `i-humor-N` 24 em `--c-humor-N-ink` · nome do nível 600 20/1.2 `--c-ink`.
  3. `i-calendar` 18 `--c-ink-3` · data e hora 400 14 `--c-ink-3`, `tnum`: "26/09/2026 · 14:57" (data completa; não é "Hoje" porque a tela pode ser revista depois).
- Ícones centrados na coluna de 24 (`justify-self:center`).

## 19. GráficoHumor (AUT-03b; mesma anatomia do Painel de Evolução)

- Cartão `--c-surface`, borda 1 `--c-line`, raio 14, padding 16 14 12, gap 12, `--sh-1`.
- **Título:** `i-trend-up` 20 `--c-action` + "Humor ao longo do tempo" 600 17 `--c-ink`; legenda 400 13/1.45 `--c-ink-3` ("Cada ponto é um registro. Linhas tracejadas são dias sem registro.").
- **Recorte:** `role="tablist"`, `grid 4 colunas`, gap 4, fundo `--c-bg`, raio 12, padding 4; abas 40 de altura, raio 9, 600 14: selecionada fundo `--c-action`, texto `--c-ink-inv`, `--sh-1`; as outras transparentes `--c-ink-2`. Opções: "7 dias" · "30 dias" · "90 dias" · "Tudo". Toque ≥ 44 com o padding do trilho.
- **Área do gráfico:** `grid 36px minmax(0,1fr)`, gap 6. Eixo Y: 5 linhas, cada uma com o rostinho `i-humor-N` 18 (cor `--c-humor-N-ink`) e o número 600 13 `--c-ink-2`. Plot em SVG `viewBox 0 0 280 190`, largura 100 %: grade horizontal 1 `--c-line` nos 5 níveis + eixo vertical; linha 2,5 `--c-action`, `linejoin round`; segmentos entre dias sem registro tracejados (`stroke-dasharray 4 4`); pontos r 5 com borda 2 `--c-ink-inv`, preenchimento por nível: 1–2 `--c-chart-neg`, 3 `--c-chart-neutro`, 4–5 `--c-chart-pos`; datas no eixo X 11 px `--c-ink-3`, `text-anchor:middle`, `overflow:visible` para a primeira e a última não cortarem.
- **Rodapé:** `border-top 1 --c-line-inner`, padding 10 2 0: "Humor médio nos N dias" (400 14 `--c-ink-2`, `flex:1`) · valor 600 19 `tnum` `--c-ink` ("2,8") · chip do nível arredondado (fundo `--c-action-tint`, 600 13 `--c-action-ink`, pílula, "Mais ou menos"). "Tudo" → "Humor médio em todos os registros".
- **Estados:** *sem registros no recorte:* área do gráfico com "Nenhum registro nesse período." 400 14 `--c-ink-3` centrado e rodapé com "—"; *carregando:* grade sem linha, valor "—"; *erro:* faixa `erro-rede` do sistema.
- **Para o Code:** a mesma função de montagem do Painel, recebendo o contêiner como parâmetro; dados do cache `pev*`; nenhuma segunda implementação.
