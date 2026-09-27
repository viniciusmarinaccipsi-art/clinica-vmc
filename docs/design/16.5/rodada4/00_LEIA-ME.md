# Pacote 16.5 · Rodada 4 do Design — Cabeçalho cumulativo v2, checagem com data, "Checagem enviada" com gráfico — LEIA-ME

**Sistema Clínico Digital VMC** · entrega do Design · 26/09/2026 · responde ao `BRIEF_rodada4_design.md`. Tema G, `04_tokens.css` sem mudança, Figtree única, ícones do `icones.js` (nenhum novo), `catalogo.js` idêntico ao da rodada 3.

## Índice da entrega

| Arquivo | O que é |
| --- | --- |
| `00_LEIA-ME.md` | Este arquivo: como cada requisito 1–8 foi resolvido, onde propusemos diferente, dúvidas |
| `01_pranchas_16.5_v4.html` | Pranchas em pacote offline (Figtree embutida) |
| `01_pranchas_16.5_v4.dc.html` | O mesmo, no formato editável do Design (fonte) |
| `01_png/` | PNG a 2× (780 px) de cada prancha; AUT-11 a 1280 px (2560 px) |
| `03_componentes.md` | Só o que muda: **§3 CabeçalhoCumulativo v2**, **§18 CartãoChecagemEnviada**, **§19 GráficoHumor** (o resto é o da rodada 3) |
| `06_contrato_de_leitura_v4.md` | Só os itens 17 e 22 revistos e os novos 25–27 |
| `04_tokens.css` | Idêntico ao da rodada 3 (nenhum token novo — ver abaixo) |
| `icones.js` · `05_rostinhos.svg` · `catalogo.js` | Idênticos aos da rodada 3 (termômetro, lápis, camadas, agenda e `i-trend-up` já existiam) |

### PNGs (`01_png/`)

AUT-04_situacao-cabecalho-v2 (etapa 1 recém-aberta) · AUT-06_reacoes-fisicas-cabecalho-v2 (etapa 3, 1 grupo marcado) · AUT-08_comportamentos-cabecalho-v2 (etapa 5, 5 linhas) · AUT-05p_positivo-emocoes-cabecalho-v2 · **AUT-06alt_trilha-sem-trilho** (alternativa) · AUT-03_checagem-breve-com-data · AUT-03b_checagem-enviada-com-grafico · AUT-11_computador-1280.

## A ideia em uma frase

O cabeçalho v2 é **um cartão de quatro blocos separados por filete**, cada um com uma única função: **(1)** quem sou agora — humor à esquerda, etapa em preenchimento à direita; **(2)** onde estou — a trilha das 5 etapas; **(3)** o que já anotei — uma linha por etapa, só grupos; **(4)** o que posso fazer — editar / ver tudo. As duas versões reprovadas misturavam essas funções na mesma linha (ações junto do humor, nota junto do grupo) ou empilhavam sem hierarquia; aqui cada bloco tem o seu ritmo e o olho encontra a informação pela posição, não lendo tudo.

## Como cada requisito foi resolvido

| Requisito | O que foi feito |
| --- | --- |
| **1 · Humor + etapa atual** | Bloco 1 (64 px): rostinho `i-humor-N` em círculo branco de 40 px (mesmo objeto da faixa da checagem, na cor `--c-humor-N-ink`) · coluna "HUMOR" (rótulo 12 caixa alta na cor `-ink` do tipo) + nome do nível (600 17) · à direita, alinhado à direita, "PREENCHENDO" (12 caixa alta `--c-ink-3`) + nome curto da etapa (600 15 na cor `-ink` do tipo, `nowrap`). É o "Preenchendo: Comportamentos" do cabeçalho antigo, em duas linhas para não competir com o humor. |
| **2 · Progresso das 5 etapas** | Bloco 2 (48 px): 5 nós de 32 px com o ícone da etapa (16 px), ligados por um traço de 2 px. **Feita** = fundo `reg` do tipo, ícone `--c-ink-inv`; **atual** = fundo `--c-surface`, borda 2 `reg`, ícone `-ink`, anel de 4 px em `--c-reg-*-mid` ("mais acesa"); **futura** = sem fundo, borda 1,5 `--c-line-strong`, ícone `--c-ink-3`. Traço na cor `reg` até a atual, `--c-line-strong` depois. Sem nome, sem check, como pedido. Nós feitos são botões (alvo 44 × 48) que levam à etapa; os demais não são tocáveis. **Alternativa** ao lado (AUT-06 alt): a trilha substitui o Trilho de segmentos da barra — ver "Onde propusemos diferente". |
| **3 · Uma linha por etapa** | Bloco 3: uma linha por etapa feita **ou atual**, `grid 20px minmax(0,1fr)`, gap 10, padding 9 14, separadas por filete `--c-line-alpha`. Conteúdo: **rótulo em linha** (700 12 caixa alta, `letter-spacing .06em`, `nowrap`, cor `-ink` do tipo, margem direita 8) seguido dos **nomes dos grupos marcados** (400 14/1.45 `--c-ink`, separados por " · "), correndo juntos — o rótulo nunca quebra dentro de si nem precisa de coluna reservada, e o conteúdo quebra livremente na linha seguinte alinhado ao rótulo. Nunca subgrupo, nunca nota. **Situação**: grupos na primeira linha e, abaixo, a frase do paciente em itálico 13 `--c-ink-2`, uma linha, cortada com "…". **Linha atual**: fundo `--c-surface` (branco sobre o tinte), ícone na cor `reg`, `aria-live="polite"`; vazia mostra "…" em itálico `--c-ink-3`; atualiza a cada marcação. **Positivo, etapa 1**: só a frase (quando os grupos positivos existirem, a linha de grupos entra igual ao Negativo). |
| **4 · Duas ações** | Bloco 4 (48 px): "editar" (`i-pencil` 16) e "ver tudo" (`i-layers` 16), botões de texto 600 14 `--c-action`, alvo 44, alinhados à direita, com filete acima. Uma ocorrência de cada; nada na linha do humor; nenhum lápis por linha. "editar" abre "Suas 5 etapas"; "ver tudo" abre o detalhe completo (subgrupos com nota). Na etapa 1 os dois já aparecem (o menu é sempre um destino válido). |
| **5 · Legibilidade** | Rótulo `nowrap` em linha (não há mais coluna de 116 px para transbordar); "REAÇÕES FÍSICAS" e "COMPORTAMENTOS" inteiros em 320–430 px, conferidos na prancha de 390 e na lateral de 320 (AUT-11). Separação por filete `--c-line-alpha` entre os 4 blocos e entre as linhas; a linha atual ganha fundo branco (contraste de superfície além do filete). Piso 13 px (só a frase da Situação e o texto do gráfico); tudo o mais ≥ 14; toques ≥ 44. |
| **6 · Checagem breve** | AUT-03 abre com a PílulaData preenchida "Hoje, 26/09 · 14:57" e "alterar" (§11 da rodada 3, sem mudança de forma). |
| **7 · Checagem enviada** | **§18 CartãoChecagemEnviada**: cartão branco com borda esquerda 4 `--c-action`, `grid 24px 1fr`, 3 linhas: `i-thermometer` + "HUMOR" (700 12 caixa alta `--c-action-ink`) · rostinho 24 + nome do nível (600 20) · `i-calendar` 18 + "26/09/2026 · 14:57" (400 14 `--c-ink-3`, `tnum`). **§19 GráficoHumor**: cartão com título `i-trend-up` + "Humor ao longo do tempo", legenda do Painel, segmentado 7 dias / 30 dias / 90 dias / Tudo (40 px, selecionado em `--c-action`), eixo Y com rostinhos 1–5, linha `--c-action`, pontos coloridos por nível (`--c-chart-neg` 1–2, `--c-chart-neutro` 3, `--c-chart-pos` 4–5), tracejado nos dias sem registro, datas no eixo X; rodapé "Humor médio nos 7 dias · 2,8 · Mais ou menos" (chip `--c-action-tint`). Mesma anatomia do Painel para o Code reaproveitar a função. A observação da checagem, quando houver, não entra no cartão (o brief pediu 3 linhas) — ver Dúvida 3. |
| **8 · AUT-11** | A coluna lateral vira o mesmo cartão v2 sem a trilha (a nav "SUAS 5 ETAPAS" já faz esse papel): bloco HUMOR, título "O QUE JÁ ESTÁ ANOTADO", uma linha por etapa só com grupos, ações. A largura de 320 px foi o teste de quebra: "REAÇÕES FÍSICAS Ativação / Aceleração · Alterações Digestivas" corre em duas linhas sem invadir nada. |

## Onde propusemos diferente do pedido (o usuário decide)

1. **Trilha no lugar do Trilho (AUT-06 alt).** Com a trilha de ícones no cartão, o Trilho de 5 segmentos da barra repete a mesma informação a 60 px de distância. A alternativa tira o Trilho, deixa a barra com filete simples e cresce os nós para 36 px (ícone 18, traço 4 px). Ganha 24 px de tela e um único indicador de progresso — o que tem ícone, estado e toque. A prancha principal mantém os dois, como pedido.
2. **Rótulo em linha, não em coluna.** O pedido dizia "rótulos nunca quebram nem invadem"; a coluna fixa resolve só até certa largura. O rótulo correndo em linha com o conteúdo (como o cabeçalho antigo fazia com "Reações Físicas:") resolve em qualquer largura e ainda economiza a coluna vazia das linhas curtas ("PENSAMENTOS Cobrança").
3. **"editar" sempre visível**, inclusive na etapa 1 (a rodada 3 escondia sem etapa feita). Motivo: agora "editar" abre o menu, que existe desde o início; esconder e mostrar um botão muda a largura do bloco entre etapas.
4. **Humor em círculo branco de 40 px** em vez do ícone de 22 px na coluna: é o mesmo objeto da faixa da checagem, então o paciente reconhece "o humor que escolhi" sem ler o rótulo.

## Regra do nome curto do grupo (para o Code)

Nome exibido = título do grupo pai sem o prefixo repetido da etapa: `^Situações (de )?` → "" e `^Pensamentos (sobre (o|os)?|de)? ` → "". Exemplos: "Situações Interpessoais" → **Interpessoais**; "Situações de Desempenho" → **Desempenho**; "Pensamentos de Cobrança" → **Cobrança**; "Pensamentos sobre o Futuro" → **Futuro**; "Ansiedade / Medo", "Ativação / Aceleração", "Isolamento / Retraimento" ficam inteiros. Casos longos ficam como estão: "Situações Internas (sem evento externo claro)" → **Internas (sem evento externo claro)**; "Pensamentos sobre Mim Mesmo (Autocrítica)" → **Mim Mesmo (Autocrítica)** — ver Dúvida 1. Separador " · ". Nada disso toca o catálogo nem o que é gravado.

## Dúvidas (≤ 5)

1. **Dois nomes curtos ficam estranhos** ("Mim Mesmo (Autocrítica)", "Internas (sem evento externo claro)"). Sugestão: exibir só o parêntese quando houver — **Autocrítica**, **Internas** — regra: se o nome curto contém "(…)", usar o conteúdo do parêntese quando ele tem uma palavra; senão a parte antes do parêntese. Confirmar, ou aceitar os nomes longos.
2. **Nó feito da trilha é tocável?** Desenhamos como botão (leva à etapa), igual aos segmentos feitos do Trilho. Se preferir a trilha só como indicador (e deixar a navegação para "editar"), é tirar o `role="button"`.
3. **Observação da checagem no AUT-03b.** O brief pediu 3 linhas (HUMOR · rostinho + nome · agenda + data). A rodada 3 mostrava também a frase da observação. Deixamos de fora; se quiser, entra como 4ª linha em itálico 14 `--c-ink-2`.
4. **Humor médio: rótulo por arredondamento.** "2,8 · Mais ou menos" arredonda para o nível 3. Confirmar que o Painel usa o mesmo critério (round half up) para os dois textos baterem.
5. **Frase da Situação a 13 px.** É o único texto abaixo de 14 no cabeçalho, por ser secundária e cortada. Se preferir 14, cabe — a linha ganha 2 px.

## Diff do `04_tokens.css`

Nenhum. Tudo o que o cabeçalho v2, o cartão e o gráfico usam já existia: `--c-reg-*`, `--c-reg-*-mid` (anel da etapa atual), `--c-line-alpha` (filetes), `--c-humor-N-ink`, `--c-chart-neg/neutro/pos`, `--c-action*`.
