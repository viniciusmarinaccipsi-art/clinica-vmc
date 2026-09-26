# Pacote 16.5 · Registro de automonitoramento (rodada 3) — LEIA-ME

**Sistema Clínico Digital VMC** · entrega do Design · 26/09/2026 · responde ao `BRIEF_rodada3_design.md` e ao documento "As 11 perguntas" (que prevaleceu onde havia diferença).
Refaz só os quatro pontos decididos depois da rodada 2; tudo o mais fica como em 25/09.

## Índice da entrega

| Arquivo | O que é |
| --- | --- |
| `00_LEIA-ME.md` | Este arquivo: índice, o que mudou, regra a regra, Dúvidas, Sugestões |
| `01_pranchas_16.5_v3.html` | As 18 telas em pacote offline (abre sem internet; Figtree embutida) |
| `01_pranchas_16.5_v3.dc.html` | O mesmo, no formato editável do Design (fonte das pranchas) |
| `01_png/` | Um PNG por tela, 390 px de largura a 2× (780 px); `AUT-11` a 1280 px a 2× (2560 px) |
| `02_telas.md` | Por tela: estrutura, componentes, estados e comportamento |
| `03_componentes.md` | Componentes comuns; novos: **ListaSubgrupo**, **BarraDeslizante**, **MenuEtapas**, **CartãoTipo** revisado |
| `04_tokens.css` | Só o diff declarado abaixo (o repositório mescla, nunca copia por cima) |
| `05_rostinhos.svg` | Igual à rodada 2 |
| `06_contrato_de_leitura_v3.md` | Checklist de aceite atualizado (itens 14–17 e 22 mudam; 23–24 novos) |
| `catalogo.js` | **Idêntico ao da rodada 2** (byte a byte; conferível por script) |
| `icones.js` | Rodada 2 + `i-lock` (cadeado do primeiro acesso) |

### PNGs (`01_png/`)

AUT-02_automonitoramento · AUT-02_automonitoramento-primeiro-acesso · AUT-03_checagem-breve · AUT-03b_checagem-enviada · **AUT-03c_suas-5-etapas** · AUT-04_situacao · **AUT-04p_positivo-situacao** · AUT-05_emocoes · AUT-06_reacoes-fisicas · AUT-07_pensamentos · AUT-08_comportamentos · AUT-08p_positivo-emocoes · AUT-09_revisar-e-enviar · AUT-10_registro-enviado · AUT-11_computador-1280 · AUT-12a_campo-obrigatorio · AUT-12b_rascunho-encontrado · AUT-12c_sair-sem-enviar

## O que mudou em relação à rodada 2, regra a regra

| Item do brief | O que foi feito |
| --- | --- |
| **1.1 Lugar da escolha do tipo (D3)** | AUT-03 termina em "QUER CONTINUAR?" → botão primário "+ Iniciar novo registro" → botão secundário "Concluir só com a checagem de humor". Os cartões de tipo saíram da checagem. AUT-02 abre com "QUE TIPO DE REGISTRO?" e os dois CartõesTipo (borda esquerda 4 px na cor do tipo, ícone em quadrado tinte, título na cor `-ink`, descrição do catálogo, chevron). O cartão "Iniciar Novo Registro" saiu; Painel de Evolução, Meus Registros e "Como Usar" continuam. |
| **1.1 Primeiro acesso (D11)** | Aviso âmbar com `i-lock` (novo no `icones.js`) e a frase da lista de textos; os dois CartõesTipo a 50 % de opacidade, `aria-disabled`, não tocáveis; "Como Usar Este Registro" com borda índigo 1,5 px e chevron. Painel e Meus Registros ficam normais (como na imagem do PDF; na rodada 2 estavam apagados). |
| **1.1 Rascunho (AUT-12b)** | Igual à rodada 2, aplicado à página nova: o aviso ocupa o lugar do bloco "QUE TIPO DE REGISTRO?" enquanto houver rascunho (ver Dúvida 2). |
| **1.2 Menu das etapas (D10 → AUT-03c)** | Tela nova entre a escolha do tipo e a etapa 1. Barra "REGISTRO NEGATIVO · Suas 5 etapas" + "Salvar e sair"; bloco HUMOR (cartão com borda esquerda índigo, `i-thermometer`, rostinho, nome do nível, "· 22/09 às 10:05", "editar"); "Toque em uma etapa para abrir."; um cartão por etapa com borda esquerda ameixa, ícone da etapa num círculo tinte 44 px, nome completo em caixa alta (700 13 px) e a pergunta da etapa (15 px); rodapé fixo com "Começar: Situação ›". **Sem trilho** e **sem estado por etapa** (o trilho começa na etapa 1; o estado fica em Revisar e Enviar). Forma repensada em relação ao modelo do chat: os cartões seguem o padrão dos BlocosRevisão (borda lateral, ícone em círculo) para o paciente reconhecer o mesmo objeto nas duas telas. |
| **1.3 Lista de subgrupos + barra deslizante (decisão 10)** | Chips saíram de todas as etapas. No grupo aberto, os 5 subgrupos ficam um embaixo do outro (linha 56 px, divisor `--c-line-inner`, check redondo 28 px à esquerda) e a última linha é "Outro:" + campo tracejado "especifique..." (textos do catálogo). Etapas 2, 3 e 4: item marcado → check preenchido na cor do tipo, título em `--c-ink` 600, nota por extenso à direita ("3 · Moderado") e, logo abaixo, a **BarraDeslizante**: rótulo em caixa alta ("DESCONFORTO:", "MAL-ESTAR:", "ACREDITO:"; Positivo "CONFORTO:", "BEM-ESTAR:", "ACREDITO:"), trilha com 5 pontos, preenchimento até o valor, marcador 44 px com o número, palavra da legenda sob cada ponto (legenda certa por etapa). Etapas 1 e 5: item marcado só acende (check preenchido, título 600 na cor `-ink` do tipo), sem barra. |
| **1.3 Cabeçalho cumulativo** | Como na rodada 2. Na etapa 1 só HUMOR + "ver tudo" (sem "editar", pois não há etapa feita). |
| **1.3 Etapa 4** | Cartão de ajuda âmbar nasce **recolhido** (só título + chevron); o conteúdo é o mesmo da rodada 2 quando aberto. |
| **1.4 Computador (AUT-11)** | Coluna lateral de 320 px mantida (cartão "SUAS 5 ETAPAS" + "O QUE JÁ ESTÁ ANOTADO"). No grupo aberto, o item marcado fica em duas colunas: check + nome + nota + rótulo à esquerda; BarraDeslizante de 400 px (`--w-slider-desktop`) à direita. Grupos fechados mostram a descrição; ajuda âmbar como pílula recolhida; rodapé inline com a contagem. Trilho também no computador (indicador de progresso, como no modelo). |
| **1.5 AUT-04 do Positivo** | Nova prancha `AUT-04p`: igual à AUT-04 em verde-água, com HUMOR "Bem", "Na checagem você anotou:", dica e caixa de texto; **sem** "Tipo de Contexto" e sem contagem no rodapé (não há grupos); botão "Emoções Agradáveis ›". |
| **1.6 Valores fora dos tokens** | `rgba(29,27,43,.08)` → `--c-line-alpha`; `rgba(29,27,43,.45)` → `--c-scrim`. Usados pelo nome nas pranchas. Também `--hit-thumb` 44 px e `--w-slider-desktop` 400 px (medidas da barra). Diff completo abaixo. |
| **2 Textos** | Só os da lista + os aceitos na seção 2 do brief. Novos nesta rodada, já aceitos: "Iniciar novo registro", "Suas 5 etapas", "Toque em uma etapa para abrir.", "Começar: Situação ›", "QUE TIPO DE REGISTRO?". Para a lista de textos (item 1.6): "O QUE JÁ ESTÁ ANOTADO", "SUAS 5 ETAPAS" (título do cartão lateral), "Fazer também um Registro Negativo", "Emoções Agradáveis ›", "Reações Físicas de Bem-Estar ›", "Pensamentos Adaptativos ›", "Comportamentos Funcionais ›". |
| **Conteúdo clínico** | `catalogo.js` idêntico à rodada 2; as pranchas leem dele (nomes completos dos subgrupos, "Outro:" e "especifique..." vêm do catálogo). |
| **Toque ≥ 44 px** | Linha da lista 56 px; check 28 px dentro de alvo de 56 px (a linha inteira é o botão); marcador da barra 44 px; a barra inteira (trilha + legenda, 52 px + 17 px) é a área de arrasto; botões 44/56 px. |

### Diff do `04_tokens.css` (rodada 2 → rodada 3)

```
+ --c-line-alpha:      rgba(29,27,43,.08)    (escuro: rgba(255,255,255,.10))
+ --c-scrim:           rgba(29,27,43,.45)    (escuro: rgba(0,0,0,.60))
+ --hit-thumb:         44px
+ --w-slider-desktop:  400px
~ comentário do topo: item 6 descreve os quatro tokens novos
```
Nada removido, nada alterado de valor.

## Dúvidas (não decidimos sozinhos onde o brief e o PDF calam — decidimos e registramos onde uma das leituras era claramente mais provável)

1. **AUT-03c e "Salvar e sair".** O menu tem "Salvar e sair" na barra (como no modelo). Neste ponto só o humor e o tipo existem; entendemos que "Salvar e sair" grava o rascunho com o tipo escolhido e volta à página Automonitoramento, onde aparece o aviso de rascunho. Confirmar.
2. **Rascunho encontrado × cartões de tipo.** Enquanto há rascunho, o aviso substitui o bloco "QUE TIPO DE REGISTRO?" (o paciente decide primeiro entre continuar e descartar). Alternativa: manter os cartões abaixo do aviso. Escolhemos substituir para não haver dois "começar" na mesma tela.
3. **Nota por extenso nas etapas sem intensidade.** O texto da pergunta 10 do PDF diz "na Situação e nos Comportamentos o título acende na cor do tipo de registro, com a nota por extenso ao lado do título"; o brief (1.3) diz "só acende, sem barra". Como essas etapas não têm nota, seguimos o brief: acende, sem nota.
4. **Onde a barra deslizante nasce.** Ao marcar um item com intensidade, a barra abre **sem valor** (marcador ausente, trilha vazia, "N · Palavra" vazio) até o primeiro toque/arrasto; a nota continua obrigatória para o item marcado. As pranchas mostram o estado já preenchido. Confirmar se prefere que a barra nasça em 3 (Moderado) — desaconselhamos: registra uma nota que o paciente não escolheu.
5. **Voltar (‹) no menu AUT-03c.** Entendemos que volta à página Automonitoramento (escolha do tipo), não à checagem. Confirmar.
6. **Legenda a 14 px na barra.** No celular a barra sangra 12 px para cada lado dentro do cartão (coluna de 70 px, `--w-likert-col`) para "Totalmente" caber a 14 px sem quebrar. Abaixo de 360 px de largura recomendamos 13 px só nessa palavra.

## Sugestões (fora da prancha)

1. Na barra deslizante, além do arrasto, aceitar toque direto num ponto (leva o marcador até ele) — está descrito em `03_componentes.md` como comportamento padrão; se preferir "só arrasto", é uma linha a tirar.
2. No menu AUT-03c, quando o paciente volta de uma etapa pelo "Voltar", o cartão daquela etapa poderia receber um traço discreto de "aberta" — não fizemos porque o brief pede o menu sem estado.
3. Nas etapas sem intensidade, o grupo fechado poderia listar os itens marcados por nome (mantida da rodada 2).

## Como navegar e como o sistema deve se comportar em navegador e app

Como na rodada 2: coluna única até 899 px; a partir de 900 px, `grid 320px minmax(0,1fr)` (AUT-11); nenhuma medida em vw/vh; barra de ação fixa no celular e inline no computador. A barra deslizante responde a toque/arrasto (Pointer Events), a teclado (setas, Home/End, 1–5) e expõe `role="slider"` com `aria-valuetext` ("3 · Moderado").
