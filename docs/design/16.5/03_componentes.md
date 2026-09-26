# Pacote 16.5 · 03_componentes.md — componentes comuns

Medidas em px. Tokens de `04_tokens.css`. Fonte: `--f-text` (Figtree) em tudo; títulos 600. Alvo mínimo 44 × 44. Foco visível: `outline 3px var(--c-action-ring)`, offset 2 (regra global `:focus-visible`). Movimento: `--dur` 200 ms `--ease`; respeita `prefers-reduced-motion`.

Cores "do tipo" = `--c-reg-neg*` no Registro Negativo e `--c-reg-pos*` no Positivo (`reg`, `-ink`, `-tint`, `-line`, `-mid`).

## 1. BarraEtapa
- Altura mínima 68 (conteúdo 44 + padding 12/10); fundo `--c-surface`; abaixo dela o Trilho, e só depois a borda `--c-line`.
- Voltar: círculo 44, borda `--c-line-strong`, glifo "‹" 22 px; `aria-label="Voltar"`.
- Sobretítulo: `--t-label` (700 12/1.3, `--ls-label`, caixa alta), cor `reg` do tipo ("REGISTRO NEGATIVO" / "REGISTRO POSITIVO"); na checagem, `--c-action` ("AUTOMONITORAMENTO").
- Título: 600 17/1.25 `--c-ink`, "Etapa N de 5 · nome completo", quebra em até 2 linhas (`text-wrap:balance`).
- "Salvar e sair": pílula 44 de altura, padding 0 14, borda `--c-line-strong`, `--t-action`; hover `--c-action-tint`; pressionado: borda `--c-action`, fundo `--c-action-tint`, texto `--c-action-ink`.
- Computador: 64 de altura, sobretítulo e título na mesma linha (gap 14).

## 2. Trilho
- 5 segmentos `flex:1`, altura 6, gap 6, raio 3; padding 6 16 12; fundo `--c-surface`.
- Feito: `reg` (`--c-reg-neg` / `--c-reg-pos`) · Atual: `--c-reg-neg-mid` / `--c-reg-pos-mid` · A fazer: `-tint`.
- Segmentos feitos são botões (alvo 44 de altura, invisível) que levam à etapa; os demais não são tocáveis. `aria-label="Etapa N de 5"` no grupo.

## 3. CabeçalhoCumulativo
- Cartão `-tint`, raio `--r-card` 14, padding 14 14 8, gap 8; margem 16.
- Linha: `grid 22px 116px minmax(0,1fr)`, gap 8, `align-items:start`. Ícone 22 (stroke 2, cor `-ink`); rótulo `--t-label` caixa alta, cor `-ink`, altura de linha 22; texto 400 14/22 `--c-ink`, frase em itálico `--c-ink-2`, nota em `<b>` cor `-ink`.
- Texto limitado a 2 linhas (~62 caracteres): corta a partir da frase com "…"; se a definição sozinha exceder, corta a definição e omite a frase.
- Ícones: HUMOR = `i-humor-N`; SITUAÇÃO `i-pin`; EMOÇÕES `i-heart-crack`/`i-heart`; REAÇÕES FÍSICAS `i-zap`/`i-leaf`; PENSAMENTOS `i-cloud-rain`/`i-sun`; COMPORTAMENTOS `i-trend-down`/`i-trend-up`.
- Ações: "editar" (`i-pencil` 18) e "ver tudo" (`i-layers` 18), botões sem borda, `--c-action`, 600 15, alvo 44, alinhados à direita.
- Estados: só HUMOR (etapa 1); cresce uma linha por etapa feita; no Positivo a linha SITUAÇÃO traz só a frase.

## 4. GrupoRecolhível
- Cartão `--c-surface`, raio 14, padding 16, gap 12; borda `--c-line` fechado, `-line` do tipo aberto.
- Cabeça (botão, `aria-expanded`): "N. Título" 600 17/1.3 `--c-ink`; à direita, contagem 14: "5 itens" `--c-ink-3` ou "N marcado(s)" 600 cor `-ink`; fechado mostra "›" 22 `--c-ink-3`. Altura mínima fechado 64.
- Aberto: descrição em itálico 400 14/1.5 `--c-ink-2` (texto literal do catálogo, com as aspas quando ele as tem); chips; EscalaItem por item marcado (etapas com intensidade).
- Computador: fechado também mostra a descrição (legenda) abaixo do título.
- Regra: um grupo aberto por vez por padrão; abrir outro recolhe o anterior (o estado marcado permanece e aparece na contagem).

## 5. Chip (item)
- Pílula `--r-chip`, `min-height` 44, padding 9 16, `flex:1 1 auto` numa linha `flex-wrap` com gap 8 (os chips esticam para preencher a linha; o texto pode quebrar em 2 linhas).
- Normal: fundo `--c-surface`, borda 1,5 `--c-line-strong`, texto 400 15/1.35 `--c-ink`.
- Hover: borda `--c-action`. Foco: anel global.
- Marcado (`aria-pressed="true"`): fundo `-tint`, borda 1,5 `reg`, texto 600 cor `-ink`, `i-check` 16 (stroke 2,5) à direita do texto (gap 6).
- Desabilitado: `--c-disabled-bg` / `--c-disabled-ink`, sem borda.
- Chip "Outro:": tracejado 1,5 `--c-line-strong`, fundo transparente, texto "+ Outro: especifique..." `--c-ink-3`, `white-space:nowrap`. Tocar troca o chip pelo campo de texto do "Outro" (linha inteira: rótulo "Outro:" 600 15 + input 44 de altura, borda `--c-line-strong`, dica "especifique..." 14 `--c-ink-3` visível acima, botão "✓" 44 índigo). Confirmado, vira chip marcado com o texto digitado (mesmo estilo de Marcado; ganha EscalaItem onde há intensidade). Ver comportamento completo em `02_telas.md`.

## 6. EscalaItem (1–5 por item marcado)
- Bloco separado por `--c-line-inner`; padding 14 0 6; gap 8; `role="radiogroup"` com `aria-label="<rótulo> <item>"`.
- Linha 1: nome do item 600 15/1.35 `--c-ink` · à direita "N · Palavra" 600 15 cor `-ink` (vazio até escolher).
- Linha 2: rótulo de hoje em `--t-label` caixa alta `--c-ink-3` ("Desconforto:", "Mal-estar:", "Acredito:", "Conforto:", "Bem-estar:").
- Linha 3: `grid repeat(5, minmax(0,1fr))`, bleed de 12 para cada lado (coluna ≥ 70 = `--w-likert-col`); cada ponto é um botão coluna (círculo + palavra, gap 6):
  - Círculo 48 (`--hit-likert`): normal fundo `--c-surface`, borda 1,5 `--c-line-strong`, número 600 17 `--c-ink`; hover borda `--c-action`; escolhido fundo `reg`, número `--c-ink-inv`.
  - Palavra: `--t-legend` 400 14/1.2 `--c-ink-3`, `white-space:nowrap`, `letter-spacing -.01em`; escolhida 600 cor `-ink`.
- Erro (item marcado sem nota ao avançar): rótulo em `--c-risk-ink` e a frase de hoje abaixo da régua.
- Computador: `grid minmax(0,1fr) 400px` — nome + rótulo/nota à esquerda, régua com círculos 44 à direita.

## 7. CampoTexto (Situação, Pensamentos, Comportamentos, Observação)
- Rótulo/título sempre visível acima; dica em 400 14/1.45 `--c-ink-3` acima do campo (nunca só como placeholder).
- Textarea: borda 1,5 `--c-line-strong`, raio `--r-field` 10, padding 12 14, 400 16/1.45 `--c-ink`, 3 linhas, `resize:vertical`; foco borda `--c-action` + anel.
- Frase de pensamento em itálico. "+ Adicionar outro pensamento": botão sem borda `--c-action` 600 15, alvo 44.
- Erro: borda 2 `--c-risk`, `aria-invalid`, mensagem abaixo (`role="alert"`, `i-alert` 20 + 600 14 `--c-risk-ink`).
- Referência da checagem (só Situação com observação): caixa `--c-action-tint`, raio 10, padding 10 14, 400 14 `--c-action-ink`: "Na checagem você anotou: "…"".

## 8. CartãoAjuda (Pensamentos, só no Negativo)
- Fundo `--c-warn-tint`, borda 1 `--c-warn-line`, raio 14, padding 14 16; `i-bulb` 24 `--c-warn-ink`; título 600 15 `--c-warn-ink`; chevron gira 90° quando aberto.
- Aberto: introdução 400 14 `--c-ink-2`; 5 blocos separados por `--c-warn-line`: nome da emoção 600 14 `--c-ink` + 2 perguntas em itálico 14 `--c-ink-2`.
- Computador: pílula âmbar ao lado de "+ Adicionar outro pensamento"; abre como painel abaixo.

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

## 12. CartãoTipo (Registro Negativo / Positivo)
- Cartão `--c-surface`, raio 14, padding 16, borda 1,5 `reg` do tipo; ícone `i-heart-crack`/`i-heart` 22 + título 600 19 na cor `-ink`; descrição 400 14 `--c-ink-2` (texto do catálogo). Hover: fundo `-tint`.

## 13. BlocoRevisão
- Cartão `--c-surface`, borda `--c-line`, borda esquerda 4 (`--c-action` no Humor; `reg` nas etapas), raio 14, padding 14 16, gap 10.
- Cabeça: ícone 20 (cor `-ink`) · rótulo `--t-label` caixa alta `--c-ink-2` com contagem "· N" · "editar" com lápis.
- Linhas de intensidade: `grid minmax(0,1fr) 120px 24px`; barra 8 de altura, raio 4, trilha `-tint`, preenchimento `reg` com largura nota/5; nota 600 16 `tnum`.
- Chips de resumo: fundo `-tint`, texto 600 14 `-ink`, raio pílula, padding 6 12 (não interativos).

## 14. FolhaInferior ("Sair sem enviar?")
- Fundo escurecido `rgba(29,27,43,.45)`; folha `--c-surface`, raio `--r-sheet` 20 em cima, `--sh-3`, padding 20 16 24, alça 40 × 4 `--c-line-strong`; `role="dialog" aria-modal="true"`.
- Título 600 22; texto 400 15 `--c-ink-2`; dois botões 56 (primário índigo, secundário com borda). Fecha com a alça, com o fundo ou com Esc.

## 15. AvisoRascunho (hub)
- Cartão `--c-surface`, borda `--c-warn-line`, borda esquerda 4 `--c-warn`, raio 14, padding 16, gap 12; `role="status"`; `i-pencil` 22 `--c-warn-ink`; texto 600 16 `--c-ink`; resumo do rascunho em caixa `-tint` do tipo (ícone 18 + tipo 600 14 + "· Etapa N de 5 · nome"); botões 52 (primário e secundário).

## 16. Ícones
- Sprite do `index-dev.html` (24 × 24, `fill:none; stroke:currentColor; stroke-width:2; stroke-linecap/linejoin:round`), mais `i-humor-1..5` de `05_rostinhos.svg`.
- Tamanhos usados: 16 (check no chip), 18 (ações de texto), 20–22 (cabeçalhos e listas), 24–26 (cartões), 28–30 (rostinho grande), 40 (confirmação).
