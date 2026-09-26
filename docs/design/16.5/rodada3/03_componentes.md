# Pacote 16.5 · 03_componentes.md — componentes comuns (rodada 3, 26/09/2026)

Mudou nesta rodada: §4 (grupo aberto usa a lista), **§5 ListaSubgrupo** e **§6 BarraDeslizante** substituem Chip e EscalaItem; §8 nasce recolhido; §12 CartãoTipo redesenhado; §14 usa `--c-scrim`; **§17 MenuEtapas** novo.

Medidas em px. Tokens de `04_tokens.css`. Fonte: `--f-text` (Figtree) em tudo; títulos 600. Alvo mínimo 44 × 44. Foco visível: `outline 3px var(--c-action-ring)`, offset 2 (regra global `:focus-visible`). Movimento: `--dur` 200 ms `--ease`; respeita `prefers-reduced-motion`.

Cores "do tipo" = `--c-reg-neg*` no Registro Negativo e `--c-reg-pos*` no Positivo (`reg`, `-ink`, `-tint`, `-line`, `-mid`).

## 1. BarraEtapa
- Altura mínima 68 (conteúdo 44 + padding 12/10); fundo `--c-surface`; abaixo dela o Trilho, e só depois a borda `--c-line`.
- Voltar: círculo 44, borda `--c-line-strong`, glifo "‹" 22 px; `aria-label="Voltar"`.
- Sobretítulo: `--t-label` (700 12/1.3, `--ls-label`, caixa alta), cor `reg` do tipo ("REGISTRO NEGATIVO" / "REGISTRO POSITIVO"); na checagem, `--c-action` ("AUTOMONITORAMENTO").
- Título: 600 17/1.25 `--c-ink`, "Etapa N de 5 · nome completo", quebra em até 2 linhas (`text-wrap:balance`). Em AUT-03c o título é "Suas 5 etapas" (18 px) e não há Trilho.
- "Salvar e sair": pílula 44 de altura, padding 0 14, borda `--c-line-strong`, `--t-action`; hover `--c-action-tint`; pressionado: borda `--c-action`, fundo `--c-action-tint`, texto `--c-action-ink`.
- Computador: 64 de altura, sobretítulo sobre o título (2 linhas, gap 2); o Trilho vem logo abaixo, com padding 6 32 12.

## 2. Trilho
- 5 segmentos `flex:1`, altura 6, gap 6, raio 3; padding 6 16 12; fundo `--c-surface`.
- Feito: `reg` (`--c-reg-neg` / `--c-reg-pos`) · Atual: `--c-reg-neg-mid` / `--c-reg-pos-mid` · A fazer: `-tint`.
- Segmentos feitos são botões (alvo 44 de altura, invisível) que levam à etapa; os demais não são tocáveis. `aria-label="Etapa N de 5"` no grupo.

## 3. CabeçalhoCumulativo
- Cartão `-tint`, raio `--r-card` 14, padding 14 14 8, gap 8; margem 16.
- Linha: `grid 22px 116px minmax(0,1fr)`, gap 8, `align-items:start`. Ícone 22 (stroke 2, cor `-ink`); rótulo `--t-label` caixa alta, cor `-ink`, altura de linha 22; texto 400 14/22 `--c-ink`, frase em itálico `--c-ink-2`, nota em `<b>` cor `-ink`.
- Texto limitado a 2 linhas (~62 caracteres): corta a partir da frase com "…"; se a definição sozinha exceder, corta a definição e omite a frase.
- Ícones: HUMOR = `i-humor-N`; SITUAÇÃO `i-pin`; EMOÇÕES `i-heart-crack`/`i-heart`; REAÇÕES FÍSICAS `i-zap`/`i-leaf`; PENSAMENTOS `i-cloud-rain`/`i-sun`; COMPORTAMENTOS `i-trend-down`/`i-trend-up`.
- Ações: "editar" (`i-pencil` 18; só quando há etapa feita) e "ver tudo" (`i-layers` 18), botões sem borda, `--c-action`, 600 15, alvo 44, alinhados à direita.
- Estados: só HUMOR (etapa 1); cresce uma linha por etapa feita; no Positivo a linha SITUAÇÃO traz só a frase.

## 4. GrupoRecolhível
- Cartão `--c-surface`, raio 14, padding 16, gap 12; borda `--c-line` fechado, `-line` do tipo aberto.
- Cabeça (botão, `aria-expanded`): "N. Título" 600 17/1.3 `--c-ink`; à direita, contagem 14: "5 itens" `--c-ink-3` ou "N marcado(s)" 600 cor `-ink`; fechado mostra "›" 22 `--c-ink-3`. Altura mínima fechado 64.
- Aberto: padding 16 16 4; descrição em itálico 400 14/1.5 `--c-ink-2` (texto literal do catálogo, com as aspas quando ele as tem); abaixo, a ListaSubgrupo (§5). Computador: padding 20 20 6.
- Computador: fechado também mostra a descrição (legenda) abaixo do título.
- Regra: um grupo aberto por vez por padrão; abrir outro recolhe o anterior (o estado marcado permanece e aparece na contagem).

## 5. ListaSubgrupo (os 5 subgrupos de um grupo + "Outro:")
- Coluna `flex`, sem gap; cada linha separada por `border-top 1px --c-line-inner`. `role="group"` com `aria-label` = título do grupo.
- **Linha (item):** botão `role="checkbox"` ocupando a linha inteira (`width:100%`), `min-height` 56 (alvo), padding 8 0, gap 14 (16 no computador), `text-align:left`, sem fundo e sem borda.
  - Check redondo 28 × 28 (`flex:0 0 28`): normal fundo `--c-surface`, borda 1,5 `--c-line-strong`; marcado fundo `reg` do tipo, `i-check` 16 (stroke 2,5) em `--c-ink-inv`.
  - Nome: 400 16/1.35 `--c-ink`, `flex:1`, quebra livre (nunca cortado). Marcado **com** intensidade: 600 `--c-ink`. Marcado **sem** intensidade (Situação, Comportamentos): 600 na cor `-ink` do tipo.
  - Nota por extenso (só com intensidade): à direita, 600 15 cor `-ink`, `white-space:nowrap`: "3 · Moderado". Vazia até a barra receber valor.
  - Hover: nome em `--c-action`; foco: anel global na linha.
- **Linha "Outro:"**: check 28 (`role="checkbox"`) · rótulo "Outro:" 400 16 `--c-ink-3` · campo `flex:1`, `min-height` 36 dentro da linha de 56, só borda inferior 1,5 tracejada `--c-line-strong`, texto de apoio "especifique..." 400 16 `--c-ink-3` (some ao digitar; volta se vazio). Com texto: check marcado, texto 600 (`--c-ink` ou `-ink` conforme a etapa) e, nas etapas com intensidade, a BarraDeslizante abaixo. Um por grupo; grava no campo "Outro" do grupo (`data-grupo`).
- **Abaixo do item marcado com intensidade:** a BarraDeslizante (§6), dentro da mesma célula da lista, antes do divisor seguinte.
- Computador: item marcado com intensidade vira `grid minmax(0,1fr) 400px`, gap 24, padding 10 0 8: à esquerda check + coluna (nome 600 16 · nota 600 15 `-ink` · rótulo caixa alta), à direita a barra.
- Estados do grupo: "N marcado(s)" soma itens e "Outro" preenchido. Desabilitado (fora de uso): `--c-disabled-ink`, check sem borda.

## 6. BarraDeslizante (1–5, uma por item marcado)
- Bloco `role="slider"`, `tabindex="0"`, `aria-valuemin="1"`, `aria-valuemax="5"`, `aria-valuenow`, `aria-valuetext` = "N · Palavra", `aria-label` = "<rótulo> <item>" (ex.: "Desconforto: Triste"). Celular: `margin 0 -12` (sangra 12 para cada lado dentro do cartão → 5 colunas de 70, `--w-likert-col`), padding-bottom 12. Computador: largura fixa 400 (`--w-slider-desktop`), sem sangria.
- **Rótulo:** `--t-label` caixa alta, cor `-ink` do tipo ("DESCONFORTO:", "MAL-ESTAR:", "ACREDITO:"; Positivo "CONFORTO:", "BEM-ESTAR:", "ACREDITO:"). No computador fica na coluna esquerda, sob a nota.
- **Trilha:** área de 52 de altura; trilha 6 de altura, raio 3, de 10 % a 90 % da largura (centros das 5 colunas em 10/30/50/70/90 %), fundo `--c-line`; **preenchimento** de 10 % até o valor na cor `reg`; **5 pontos** 10 × 10, fundo `--c-surface`, borda 2 (`reg` até o valor, `--c-line-strong` depois).
- **Marcador:** círculo 44 (`--hit-thumb`), fundo `reg`, número 600 17 `--c-ink-inv`, anel branco 3 (`0 0 0 3px --c-surface`) + `--sh-1`; centrado no ponto do valor. Arrastando: escala 1,08 e `--sh-2`; foco: anel global.
- **Legenda:** `grid repeat(5, minmax(0,1fr))`, uma palavra por coluna, centrada, `--t-legend` 14/1.2, `letter-spacing -.01em`, `nowrap`, `--c-ink-3`; a escolhida 600 na cor `-ink`. Legendas: Emoções "Nenhum · Pouco · Moderado · Muito · Intenso"; Reações "… · Extremo"; Pensamentos "Nada · Pouco · Moderado · Muito · Totalmente" (Positivo idem, do catálogo).
- **Toque e arrasto:** Pointer Events em toda a área (trilha + legenda, ≥ 69 de altura). `pointerdown` em qualquer ponto move o marcador para o valor mais próximo (posição → `round((x − 10 %) / 20 %) + 1`, limitado a 1–5); `pointermove` com o ponteiro capturado arrasta com encaixe nos 5 pontos (transição `--dur-fast`); `pointerup` grava "Item:nota". O arrasto horizontal cancela a rolagem da página (`touch-action: pan-y` no bloco, `preventDefault` durante o arrasto).
- **Teclado:** ← / ↓ = −1; → / ↑ = +1; Home = 1; End = 5; teclas 1–5 = valor direto; Tab sai do bloco. Anúncio pelo `aria-valuetext`.
- **Estados:** *sem valor* (recém-marcado): sem marcador e sem preenchimento, pontos todos `--c-line-strong`, nota vazia; *com valor*: como descrito; *erro* (avançar sem nota): rótulo em `--c-risk-ink` e a frase de hoje abaixo da barra, `role="alert"`; *desabilitado*: trilha e marcador em `--c-disabled-bg/ink`.
- Movimento: marcador e preenchimento animam `--dur-fast` `--ease`; respeita `prefers-reduced-motion`.

## 7. CampoTexto (Situação, Pensamentos, Comportamentos, Observação)
- Rótulo/título sempre visível acima; dica em 400 14/1.45 `--c-ink-3` acima do campo (nunca só como placeholder).
- Textarea: borda 1,5 `--c-line-strong`, raio `--r-field` 10, padding 12 14, 400 16/1.45 `--c-ink`, 3 linhas, `resize:vertical`; foco borda `--c-action` + anel.
- Frase de pensamento em itálico. "+ Adicionar outro pensamento": botão sem borda `--c-action` 600 15, alvo 44.
- Erro: borda 2 `--c-risk`, `aria-invalid`, mensagem abaixo (`role="alert"`, `i-alert` 20 + 600 14 `--c-risk-ink`).
- Referência da checagem (só Situação com observação): caixa `--c-action-tint`, raio 10, padding 10 14, 400 14 `--c-action-ink`: "Na checagem você anotou: "…"".

## 8. CartãoAjuda (Pensamentos, só no Negativo)
- Fundo `--c-warn-tint`, borda 1 `--c-warn-line`, raio 14, padding 14 16, `min-height` 56; `i-bulb` 24 `--c-warn-ink`; título 600 15 `--c-warn-ink`; chevron "›" gira 90° quando aberto. **Nasce recolhido** (`aria-expanded="false"`).
- Aberto: introdução 400 14 `--c-ink-2`; 5 blocos separados por `--c-warn-line`: nome da emoção 600 14 `--c-ink` + 2 perguntas em itálico 14 `--c-ink-2`.
- Computador: pílula âmbar (44 de altura, `nowrap`) à direita de "+ Adicionar outro pensamento", recolhida; abre como painel abaixo da linha.

## 9. RodapéEtapa
- Fundo `--c-surface`, `--sh-bar`, padding 12 16 20 (+ área segura do aparelho); fixo no celular, inline no computador.
- Contagem: 400 14 `--c-ink-3`, centrada.
- "‹": 56 × 56, raio 14, borda `--c-line-strong`, glifo 26; `aria-label="Etapa anterior"`.
- Próxima etapa: botão primário `flex:1`, 56 de altura, raio 14, fundo `--c-action`, texto 600 16 `--c-ink-inv` ("Nome da próxima etapa ›" / "Concluir e Revisar"); hover `--c-action-hover`, pressionado `--c-action-press`; desabilitado `--c-disabled-bg/ink` (não usado: os obrigatórios são avisados na tela).

## 10. FaixaHumor (checagem breve)
- 56 de altura (`--hit-face`), raio 14, padding 0 10, gap 12, `role="radio"`.
- Fundo `--c-humor-N-bg`, tudo em `--c-humor-N-ink`: círculo branco 40 com o número 600 17; rostinho `i-humor-N` 28 (stroke 2); nome 600 17.
- Escolhida: fundo `--c-surface`, borda 2 `--c-action`, anel 3 `--c-action-ring`, texto e rostinho `--c-action-ink`, círculo `--c-humor-3-bg`, `i-check` 22 à direita.
- Caixa descritiva abaixo: `--c-action-tint`, itálico 15/1.5 `--c-ink-2`, `aria-live="polite"`.

## 11. PílulaData
- Cartão 52 de altura, borda `--c-line`, raio 14, `i-calendar` 20 `--c-ink-3`, texto 400 16 `tnum`, link "alterar" 600 15 `--c-action` (alvo 44). Ao tocar, troca pelos campos nativos de data e hora (2 colunas, 44 de altura).

## 12. CartãoTipo (Registro Negativo / Positivo — página Automonitoramento)
- Botão-cartão `--c-surface`, raio 14, borda 1 `--c-line` + **borda esquerda 4 `reg`** do tipo, padding 16 12 16 14, `--sh-1`; `grid`/flex: quadrado tinte 48 × 48 (raio 12, fundo `-tint`) com `i-heart-crack`/`i-heart` 24 em `-ink` · coluna com título 600 19 na cor `-ink` e descrição 400 14/1.45 `--c-ink-2` (texto literal do catálogo) · chevron "›" 22 `--c-ink-3`. Hover: fundo `-tint`; pressionado: borda esquerda 6.
- Bloqueado (primeiro acesso, D11): `opacity .5`, `aria-disabled="true"`, sem hover e sem ação; precede-o o aviso âmbar com `i-lock`.
- Rótulo do bloco acima dos dois cartões: "QUE TIPO DE REGISTRO?" (`--t-label`, `--c-ink-3`).

## 13. BlocoRevisão
- Cartão `--c-surface`, borda `--c-line`, borda esquerda 4 (`--c-action` no Humor; `reg` nas etapas), raio 14, padding 14 16, gap 10.
- Cabeça: ícone 20 (cor `-ink`) · rótulo `--t-label` caixa alta `--c-ink-2` com contagem "· N" · "editar" com lápis.
- Linhas de intensidade: `grid minmax(0,1fr) 120px 24px`; barra 8 de altura, raio 4, trilha `-tint`, preenchimento `reg` com largura nota/5; nota 600 16 `tnum`.
- Chips de resumo: fundo `-tint`, texto 600 14 `-ink`, raio pílula, padding 6 12 (não interativos).

## 14. FolhaInferior ("Sair sem enviar?")
- Fundo escurecido `--c-scrim`; folha `--c-surface`, raio `--r-sheet` 20 em cima, `--sh-3`, padding 20 16 24, alça 40 × 4 `--c-line-strong`; `role="dialog" aria-modal="true"`.
- Título 600 22; texto 400 15 `--c-ink-2`; dois botões 56 (primário índigo, secundário com borda). Fecha com a alça, com o fundo ou com Esc.

## 15. AvisoRascunho (hub)
- Cartão `--c-surface`, borda `--c-warn-line`, borda esquerda 4 `--c-warn`, raio 14, padding 16, gap 12; `role="status"`; `i-pencil` 22 `--c-warn-ink`; texto 600 16 `--c-ink`; resumo do rascunho em caixa `-tint` do tipo (ícone 18 + tipo 600 14 + "· Etapa N de 5 · nome"); botões 52 (primário e secundário).

## 16. Ícones
- Sprite do `index-dev.html` (24 × 24, `fill:none; stroke:currentColor; stroke-width:2; stroke-linecap/linejoin:round`), mais `i-humor-1..5` de `05_rostinhos.svg` e, nesta rodada, `i-lock` (cadeado: `M5 11h14v10H5z` + `M8 11V7a4 4 0 0 1 8 0v4`), em `icones.js`.
- Tamanhos usados: 16 (check no chip), 18 (ações de texto), 20–22 (cabeçalhos e listas), 24–26 (cartões), 28–30 (rostinho grande), 40 (confirmação).

## 17. MenuEtapas (AUT-03c)
- Lista `role="list"`, gap 10, um botão-cartão `role="listitem"` por etapa: `--c-surface`, raio 14, borda 1 `--c-line` + borda esquerda 4 `reg` do tipo, padding 12 12 12 14, `--sh-1`, `min-height` 76; `grid 44px minmax(0,1fr) 20px`, gap 12, `align-items:center`.
  - Círculo 44 (fundo `-tint`) com o ícone da etapa 22 em `-ink` (`i-pin`, `i-heart-crack`/`i-heart`, `i-zap`/`i-leaf`, `i-cloud-rain`/`i-sun`, `i-trend-down`/`i-trend-up`).
  - Nome completo da etapa em caixa alta: 700 13/1.3, `letter-spacing .06em`, `--c-ink`, quebra em 2 linhas (`text-wrap:balance`).
  - Pergunta da etapa: 400 15/1.4 `--c-ink-2` ("O que aconteceu?", "O que você sentiu?", "O que você sentiu no corpo?", "Quais pensamentos passaram pela sua mente?", "Como você reagiu a essa situação?").
  - Chevron "›" 22 `--c-ink-3`.
- Hover: fundo `-tint`; pressionado: borda esquerda 6; foco: anel global. **Sem** indicador de estado (feita/atual) por decisão.
- Acima da lista: bloco HUMOR (mesmo BlocoRevisão §13 do Humor, com "· 22/09 às 10:05" e "editar") e a frase "Toque em uma etapa para abrir." (400 15 `--c-ink-3`).
- Rodapé fixo (`--c-surface`, `--sh-bar`, padding 12 16 20): botão primário 56 "Começar: Situação ›" (`--c-action`, 600 16 `--c-ink-inv`).
- Computador (≥ 900 px): a lista vira `grid` de 1 coluna com largura máx. 640, centrada; o rodapé fica inline.
