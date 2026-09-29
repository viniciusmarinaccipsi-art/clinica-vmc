# Arquitetura e Padrões Técnicos — Referência

Padrões consolidados do sistema. O estado atual (versões, contagens de
colunas, funções mais recentes) vive no `status_projeto_vmc.md` do
Projeto e no próprio código — em caso de dúvida, conferir a fonte real.

## Stack

- **Frontend:** single-page app `index.html`, vanilla JavaScript sem
  framework, Chart.js via CDN, `sessionStorage` apenas (localStorage não
  é usado). Sem service worker (removido no Pacote 15.0).
  `admin.html` é arquivo separado e independente.
- **Backend:** Google Apps Script publicado como Web App (`doPost` com
  roteador de ações). Deploy por `clasp push` + `clasp deploy
  --deploymentId` na mesma implantação (URL fixa); `VERSAO_PACOTE` no
  topo do `Código.js`, devolvida pelo `ping` como `versao_pacote`.
- **Dados:** Google Sheets. Planilha global `Sistema_VMC` + uma planilha
  Controle por profissional + uma planilha individual por paciente.
- **Hospedagem:** GitHub Pages (repo público `clinica-vmc`).
- **Scripts administrativos:** Python local (gspread + OAuth) para
  migrações e operações em lote.

## Princípio aditivo (não-negociável)

Colunas nunca são removidas, apenas adicionadas. Funções existentes
nunca são modificadas — apenas estendidas. Cada registro carrega
`versao_formulario`.

Implicações práticas:
- Campo substituído por outro → o antigo continua na planilha, vazio nos
  registros novos; registros antigos permanecem legíveis.
- Texto de `data-item` alterado → itens novo e antigo coexistem no
  Painel. Se a alteração for equivalente (mesmo conteúdo, texto
  refinado), o correto é trocar o `data-item` no HTML **e** migrar as
  planilhas via script Python (referência: Pacote 13.6.9.1) para manter
  os gráficos limpos.
- Seção removida do frontend → colunas **sem dados** são removidas num
  pacote de limpeza, com script de dry-run (ex.: `neg_dist_*` no 15.0).

Chaves técnicas que NÃO podem mudar: `data-grupo`, prefixos de coluna
(`neg_emo_*`, `pos_fis_*`...), IDs de seções/botões, nomes de funções
globais. O que PODE mudar livremente: textos visíveis, cores,
espaçamentos, ordem visual, internals de funções auxiliares.

> **Revisão de 14/09/2026 (ver CLAUDE.md e status):** o princípio aditivo
> passa a valer apenas para contratos de dados vivos. Código, abas e
> colunas sem função são removidos em pacotes de limpeza (ex.: 15.0 —
> `neg_dist_*`, aba `Painel`, funções nunca chamadas, ramos v3, service worker).

## Arquitetura DOM-first

Listas hardcoded duplicando o HTML divergem silenciosamente (41 de 49
grupos divergentes na auditoria do Pacote 2.1). Ler do DOM em runtime:

- `pevConstruirCacheSubitens()` — varre `.auto-group[data-grupo]` uma vez
- `pevObterSubitensGrupo(coluna)` / `pevListarColunasSubitens()`
- Títulos visíveis via `revTituloGrupo()` (Pacotes 6/7)

Regra: prestes a criar um array com textos que já estão no HTML? Pare e
leia do DOM.

## Catálogo de padrões reusáveis

### Modal flutuante `.p5-modal-*`
Criado no Pacote 5; reusado em 9, 11.6, 12.2. Estrutura
overlay → card (role="dialog") → head/body/footer. Fecha por ×, ESC e
clique no backdrop.

### Cadeado de card `.card.locked`
Opacidade + cursor proibido + badge "🔒 Bloqueado". Usado para gating de
módulos (anamnese pendente, primeira vez).

### Cache 30s (padrão `pev*`)
Para dados do servidor que mudam pouco na sessão (`lerHistorico`,
`lerEscalas`). SEMPRE invalidar após operação de escrita correspondente.
**Todo cache por paciente é descartado no logout** (Pacote 16.5d-3.2, débito
8.28): `descartarCachesPaciente_()`, chamada por `logout()` e
`logoutProfissional()`, zera `PEV_STATE` (registros, `carregadoEm`, `invalidado`,
`charts` destruídos), `ESC_HIST_STATE` (inclusive `visaoProfissional`),
`CHK_ENV.chart` e `window._HIST_REGS`. Cache novo por paciente = entrar nessa
função.

### Detecção de veterano
"Paciente tem ≥1 registro = já passou pelo onboarding". Derivar de
`lerHistorico`/`lerEscalas`; zero coluna nova, zero mudança de backend.

### Tintura dinâmica `.esc-tint-*`
Tela recebe classe única via JS; 12 regras CSS por cor (cabeçalho,
progresso, número, hover, seleção, botões, alertas; item funcional
mantém azul). Toda cor nova ganha o conjunto completo.

### Motor de cálculo aditivo (escalas)
`escCalcularEscoreEAlerta` detecta propriedades opcionais do item/escala:
`reverso`, `multiSubescalas`, `criticoLimiar`, `dicotomica`. Escala nova
= entrada no dicionário `ESC_ESCALAS` (+ branch se necessário). Nunca
reescrever o motor.

### Renderer unificado de resultado (Pacote 12.7.2)
`escRenderizarConteudoResultado(modo)` serve a tela imediata E o modal
do histórico — 1 função, 2 modos. Mudança na tela de resultado é feita
uma vez só.

### Padrão "empréstimo" de função
Função faz várias coisas e você quer uma: chame, capture o output,
desfaça o efeito colateral. Ex.: o gráfico de humor da "Checagem enviada" reusa as
funções do Painel (16.5d-3). (O exemplo antigo — modal "+N" sobre `autoAbrirResumo()` —
saiu no 16.5e: "ver tudo" abre a própria tela de revisão em leitura.)

### Cores neutras para estados compartilhados
Estado com mesmo significado em contextos de cores diferentes usa azul
institucional (ex: pill "Preenchida" nos dois lados do registro).

### Modal > navegação durante um fluxo
Consulta no meio de um preenchimento abre modal sobre a tela atual —
nunca navegar para fora ("voltar pra onde eu estava" confunde).

### Validação completa antes de ação definitiva
Botões que gravam/enviam/excluem só habilitam com TODAS as pré-condições
válidas; ao falhar, alerta amigável + navegação para a seção pendente.
Exclusões permanentes: confirmação dupla digitando a sigla exata.

### Lock de presença + carimbo de auditoria (Pacote 13.6)
Colunas `editando_quem/editando_desde/editado/editado_por/editado_em`.
Gravação do lock é fire-and-forget (sem await); leitura do lock é em
tempo real ao abrir o modal; limpar ao salvar/cancelar. Após salvar,
exibir "✏️ Editado por X em DD/MM HH:MM".

### Telas read-only do profissional
Cards colapsáveis por módulo (`.prof-pv-mod`, chevron rotativo,
`profToggleModulo_()`) — nunca despejar tudo aberto.

### Colunas garantidas em runtime
Padrão `_garantirColunasX_()`: planilhas existentes recebem colunas
novas na primeira operação que precisa delas (aditivo, sem migração).

### Container largo
`body.vmc-largo` (hook em `abrirSecao`) libera `max-width` maior para
telas que precisam (agenda/calendário); demais telas mantêm 800px.

## Registro: estrutura única por etapa (Pacote 16.5d-1)

Em `index-dev.html` o registro de automonitoramento tem **5 seções físicas**,
`sec-auto-sit`, `sec-auto-emo`, `sec-auto-fis`, `sec-auto-pens` e
`sec-auto-comp` (uma por etapa), em vez das 10 antigas. Dentro de cada uma,
os dois tipos de registro são blocos `<div class="auto-tipo" data-tipo="neg|pos">`
que **conservam os ids lógicos de sempre** (`sec-auto-emo-a` = Negativo,
`sec-auto-emo-b` = Positivo) e carregam `data-barra-titulo`/`data-barra-voltar`
do seu tipo. O conteúdo clínico continua no HTML, no bloco do seu tipo
(DOM-first; nenhum array JS com textos).

- `abrirSecao(id)` aceita o id lógico ou o físico: com id lógico, ativa a seção
  física, chama `autoMostrarTipo(secao, bloco)` (mostra só o bloco daquele tipo
  via `hidden`, copia título/voltar para a seção, esconde o cabeçalho cumulativo
  no Positivo) e segue com `topbarAtualizar(físico)` + `progressoParaTela(lógico)`.
- `secaoAtivaId()` devolve o id lógico do bloco visível (ou o id da seção nas
  demais telas); é o que `autoAvancarSequencial`, `fluxoEmAndamento` e
  `fluxoGuardarRascunho` usam. `PROG_REGISTRO_TELAS` contém os 5 ids físicos
  além dos 10 lógicos, e `progressoParaTela` lê o tipo do `data-tipo` da seção
  quando recebe um id físico.
- Coleta (`autoColetarDadosDaSecao`), validação (`autoValidarSecao`),
  `autoTemConteudoNaSecao`, `AUTO_SEC_MAP`, `AUTO_SEQ_*`, `autoFinalizarTipo`,
  a revisão (`revisar*`, 16.5e) e o rascunho continuam trabalhando pelos ids lógicos: cada
  `getElementById('sec-auto-emo-a')` devolve o bloco, que contém exatamente os
  campos e grupos de antes. Payload, chaves de coluna, `AUTO_SEPARADOR`,
  `data-grupo`/`data-item`/`data-tem-likert` e `versao_formulario` não mudam
  (prova: payloads iguais campo a campo antes e depois, relatório do 16.5d-1).
- Um registro pode levar Negativo **e** Positivo (os dois blocos existem sempre
  no DOM); por isso a coleta final percorre os 10 ids lógicos, como antes.
- O cabeçalho cumulativo (`#cabHdr-{etapa}`; v2 desde o 16.5d-3) vive na seção física e é
  renderizado para os dois tipos pelo hook de `abrirSecao` (ver "Registro: interior das 5 etapas").

## Registro: fluxo do paciente a partir do Pacote 16.5c

**Início → checagem breve (`#sec-auto-passo1`) → página Automonitoramento
(`#sec-automonitoramento`, escolha do tipo, D3) → menu "Suas 5 etapas"
(`#sec-auto-menu`) → 5 etapas → Revisar e Enviar → envio.** A tela "Tipo de
registro" (`sec-auto-passo2`) e os dois menus antigos saíram; a checagem não
tem mais contador ("Etapa 1 de 8" acabou: o trilho `#prog` só conta as 5
etapas, `PROG_REGISTRO_TELAS` com 1–5, e checagem/menu/revisão ficam no fluxo
com valor -1, isto é, sem trilho).

- **Checagem breve (AUT-03):** 5 faixas `.chk-faixa[role=radio]` com número,
  rostinho `i-humor-N` e o nome de `HUMOR_NOMES` (D6: Muito mal · Mal · Mais ou
  menos · Bem · Muito bem — **única fonte** dos nomes do humor, usada por
  checagem, menu, revisão, Meus Registros, modal e visão do profissional; os
  valores gravados continuam 1–5); pílula "Hoje, dd/mm · hh:mm" com "alterar"
  (`chkMostrarCampos`; desde o 16.5d-3 ela já nasce preenchida com a data e a hora
  de agora — `chkAtualizarPill` em `chkAbrir`, `chkEditar` e na troca dos campos,
  contrato v4 item 25); caixa descritiva (`HUMOR_DESC`, textos do catálogo);
  observação com a pergunta fora do campo. Termina em "QUER CONTINUAR?" →
  `chkIniciarNovoRegistro()` (guarda a checagem em `AUTO_STATE.dados`, nada é
  enviado, e abre a página) ou `chkConcluirSoChecagem()` →
  `autoEnviarRegistro({ soChecagem: true })`.
- **Linha "só checagem":** a mesma ação `salvarAutomonitoramento` com apenas
  `data_registro`, `hora_registro`, `humor_nivel`, `humor_observacoes`
  (`neg_preenchido` e `pos_preenchido` vazios); nenhuma coluna nova, `Código.js`
  intocado. Quem lê a linha: Meus Registros mostra o chip "Checagem de humor"
  (`.histc-tipo.chk`) e não oferece a lupa; o Painel de Evolução usa
  `humor_nivel` como em qualquer registro; a revisão nunca é aberta por esse
  caminho. Depois de enviada, `chkMostrarEnviada()` abre AUT-03b
  (`#sec-auto-checagem-enviada`, barra sem voltar) e um novo registro começa
  outra checagem. **AUT-03b desde o 16.5d-3 (§18/§19 da rodada 4, contrato v4
  itens 26–27):** cartão `role="status"` em grade de 24 px — `i-thermometer` +
  HUMOR · rostinho + nome do nível · `i-calendar` + data completa e hora
  (`formatarDataBR` + `autoFormatarHora`, o formato de Meus Registros) · a
  observação em itálico como 4.ª linha só quando houver (D3) — e, abaixo, o
  gráfico "Humor ao longo do tempo" **do Painel, emprestado**: `chkCarregarGrafico()`
  (sem `await`; a confirmação não depende dele) lê o cache `PEV_STATE` ou busca
  `lerHistorico` por `iniLerQuieto` e preenche o cache como o Início faz, escolhe o
  recorte por `pevPeriodoInicial` e chama `chkRenderGrafico(regs)` →
  `pevMontarBlocoHumor('chkEnvCanvas', {…})` + `pevMontarSeletor(periodo)` +
  `pevBindSeletor(contêiner, aoEscolher)` + `pevDesenharHumor(recorte, canvas)`;
  rodapé "Humor médio nos N dias" / "em todos os registros" com a média de
  `pevCalcularResumo` (a mesma string do cartão HUMOR MÉDIO, "2.8" — decisão D4) e
  o chip `HUMOR_NOMES[Math.round(média)]`; estados carregando (legenda sem linha,
  "—"), sem registros no recorte ("Nenhum registro nesse período"), falha
  ("Falha de conexão" + "Tentar de novo"). Estado próprio `CHK_ENV`
  (`periodo`, `chart`, `seq`); nenhuma segunda implementação de gráfico.
- **Página Automonitoramento (AUT-02):** `hubAtualizar()` (chamado por
  `abrirSecao`, e de novo quando `p5VerificarPrimeiraVez` responde) decide:
  aviso D11 + CartõesTipo `.ctipo.bloqueado` (`aria-disabled`) enquanto
  `p5DeveBloquear()` — nenhum registro gravado **e** "Como Usar" não aberto
  nesta sessão (`sessionStorage.autoComoUsarLido`, gravado ao abrir a seção
  de instruções); Painel e Meus Registros ficam livres; linha HUMOR
  (`#hubHumor`) quando há checagem nesta sessão sem tipo; aviso de rascunho
  (`#hubRascunho`, `hubRascunhoEmAndamento()` = rascunho com `humor_nivel` e
  `tipo`) **no lugar** do bloco "QUE TIPO DE REGISTRO?" (dúvida 2), com
  "Continuar registro" / "Descartar". Regra dos Pacotes 5/10 preservada: na
  primeira vez o Positivo fica trancado até o primeiro Negativo
  (`hubPositivoTrancado()`). `hubEscolherTipo(tipo)`: sem checagem nesta
  sessão abre a checagem primeiro; com checagem, grava `AUTO_STATE.tipoAtual`
  (vai para o rascunho como `tipo`) e abre o menu.
- **Menu "Suas 5 etapas" (AUT-03c):** uma seção física `#sec-auto-menu` com
  os dois tipos como blocos `.auto-tipo` (`#sec-auto-menu-neg` /
  `#sec-auto-menu-pos` continuam sendo os ids lógicos, então
  `abrirSecao('sec-auto-menu-neg')` das etapas e da revisão não mudou). Bloco
  HUMOR com "editar" (`chkEditar()`), "Toque em uma etapa para abrir.", cinco
  `.metapa` (ícone, nome completo em caixa alta, pergunta da etapa) sem estado
  e sem trilho, rodapé fixo "Começar: Situação ›" (`menuComecar()`). Barra com
  sobretítulo "Registro Negativo/Positivo" e ação "Salvar e sair"
  (`menuSalvarESair()`: grava o rascunho e volta à página, que mostra o aviso).
  Voltar (‹) vai para a página sem confirmação (`destinoForaDoFluxo` trata
  `sec-automonitoramento`, `autoAbrirMenuTipo(` e `autoVoltarEditarRevisar(`
  como destinos dentro do fluxo). O hook de `abrirSecao` chama
  `menuAoAbrir(id)` por qualquer caminho de entrada.
- **Barra única, atributos novos (16.5c):** `data-barra-sobretitulo` (linha em
  caixa alta acima do título, cor da ação ou do tipo via `data-tipo`) e
  `data-barra-acao` + `data-barra-acao-onclick` (pílula à direita; esconde badge
  e hambúrguer enquanto existe). `autoMostrarTipo` copia o sobretítulo do bloco
  para a seção física.

## Registro: interior das 5 etapas (Pacote 16.5d-2)

Em `index-dev.html` cada etapa (os dois tipos) segue `03_componentes.md` da rodada 3:

- **BarraEtapa + Trilho:** a barra única ganha altura automática (`--topbar-h`, escrita por um
  `ResizeObserver` em `#topbar`; `body.com-barra .app` usa `calc(var(--topbar-h) + 8px)`); com
  sobretítulo, o título quebra em até 3 linhas (17 px, `text-wrap:balance`) em vez de cortar — fecha
  o débito 8.22. `progressoParaTela` escreve "Etapa N de 5 · nome completo" no `#topbarTitulo` (nome
  lido do `data-barra-titulo` do bloco) e, **desde o 16.5d-3 (decisão P1)**, esconde o `#prog` em todas
  as telas do registro: o progresso das 5 etapas é a trilha de ícones do cabeçalho cumulativo
  (abaixo); `progressoDefinir` perdeu `soTrilho` e as cores `neg`/`pos-reg` e serve só à anamnese e às
  escalas. Os blocos
  carregam `data-barra-sobretitulo` e `data-barra-acao="Salvar e sair"` (`etapaSalvarESair()`:
  coleta a seção ativa, grava o rascunho com `etapa` e volta à página); `autoMostrarTipo` copia
  também a ação para a seção física.
- **TítuloEtapa:** `h2.auto-etapa-titulo` com a pergunta da etapa (mesmo texto do menu) +
  `.auto-etapa-instr`; o `.auto-sec-header` (ícone + instrução) saiu das etapas. Os campos de texto
  usam `aria-labelledby` para o h2 e a dica que era `placeholder` virou `p.auto-dica` visível
  (`aria-describedby`); as caixas extras de Pensamentos (`p8AdicionarPensamento`) nascem sem
  placeholder. O cartão branco `.anam-card` dentro das 5 seções vira só contêiner (sem fundo nem
  padding): os grupos são os cartões.
- **GrupoRecolhível:** `.auto-group[data-grupo]` (sem classe de cor; a cor vem do
  `[data-tipo]` ancestral) com `.auto-group-head[role=button][aria-expanded]`, título,
  `.auto-group-cont` ("5 itens" / "N marcado(s)", `autoAtualizarContagemGrupo`) e chevron; corpo com
  `.auto-group-desc` (texto literal) e `.auto-lista[role=group]` (`aria-label` = título, lido do DOM em
  `autoIniciarGrupos`). `autoToggleGrupo` abre um por vez dentro do bloco (`autoGrupoAbrir`).
- **ListaSubgrupo:** todas as etapas usam a mesma estrutura — `.auto-option` > `label.auto-option-lbl`
  com o **mesmo** `<input type="checkbox" data-item>` de sempre (visualmente oculto, semântica
  nativa), `.auto-check` (28 px, `i-check`), `.auto-option-nome` e, com intensidade,
  `.auto-option-nota` ("3 · Moderado"). "Outro:" é a última linha (`.auto-option-is-outro`:
  `label.auto-option-other-chk` + `.auto-option-other-lbl` + `.auto-option-other-inp`; com texto
  conta como marcado, apagar desmarca, tocar o check ou o rótulo abre o campo). A ramificação
  "legacy" da Situação (checkbox solto) deixou de existir em `autoColetarDadosDaSecao`,
  `autoContarItensMarcados` e `autoHidratarFormulario`.
- **BarraDeslizante (controle nativo):** `.auto-item-likert` guarda só o rótulo no HTML
  (`.auto-item-likert-label`, caixa alta por CSS) e a nota em `data-nota` (fonte da coleta:
  `autoNotaDoItem`). Ao marcar o item, `autoBarraGarantir` constrói `.auto-slider` — trilha de
  10 % a 90 % com 5 pontos, preenchimento e marcador de 44 px (`--hit-thumb`) com o número, posicionados
  pela variável `--v` — e a legenda (`.auto-slider-legenda`, 5 colunas) lida da `.auto-scale
  .auto-legenda-fonte` do bloco (DOM-first); por cima fica um `<input type="range" min=1 max=5
  step=1>` transparente (largura `80% + 44px`, centrado nos pontos) que dá toque no ponto, arrasto,
  setas/Home/End e leitor de tela (`aria-label` = "rótulo item", `aria-valuetext` = "N · Palavra").
  `autoBarraDefinirValor(op, v|null)` atualiza tudo; `.sem-valor` (nasce assim) esconde marcador e
  preenchimento; teclas 1–5 e o primeiro toque de seta no estado sem valor são tratados no `keydown`;
  o `click` confirma a nota quando o toque cai no valor interno do controle (3), caso em que o
  nativo não dispara `input`. Sangria `margin:0 -12px` no celular (5 colunas de 70 px em 390 px);
  `max-width: var(--w-slider-desktop)` a partir de 900 px; só a palavra da legenda que não cabe
  desce a 13 px (`autoLegendaAjustar`, medido ao construir, ao abrir a etapa e no `resize`).
  Gravação inalterada: "Item:nota" com `AUTO_SEPARADOR`; desmarcar apaga a nota. O modal de edição
  de Meus Registros (`p136RenderGrupo_`) monta a mesma lista e barra a partir do grupo original
  (`p136InicializarBarras_`); sem nota, o item vai sem ":n" (antes recebia 3 em silêncio).
- **Cabeçalho cumulativo v2 (`cab*`, Pacote 16.5d-3; §3 da rodada 4, contrato v4 item 17):**
  `#cabHdr-{etapa}` na seção física, renderizado por `cabRenderizar(idLógico)` no hook de
  `abrirSecao` para os dois tipos. Cartão em tinte do tipo com quatro blocos separados por filete
  `--c-line-alpha`: **(1)** `.cab-humor` — rostinho `i-humor-N` num círculo `--c-surface` de 40 px
  (tinta do próprio nível, P4), "HUMOR" + `HUMOR_NOMES` e, à direita, "PREENCHENDO" + nome curto da
  etapa (`CAB_ROTULOS`, fonte única dos rótulos curtos; `PROG_REGISTRO_NOMES` saiu); **(2)**
  `.cab-trilha` — 5 nós de 36 px com o ícone da etapa (`CAB_ICONES`), traço de 4 px; feita = fundo
  `reg` e ícone `--c-ink-inv`, tocável (`<button>` → `cabIrEtapa` → `autoEntrarSecao`, o mesmo
  caminho do trilho antigo, D2); atual = `--c-surface` com borda `reg`, anel `--c-reg-*-mid` e
  `aria-current="step"`; futura = contorno `--c-line-strong`; o traço à esquerda de um nó fica cheio
  quando esse nó é feito ou atual; **(3)** `.cab-lin` — uma linha por etapa **feita ou atual**
  (`cabEtapaFeita`: grupo marcado ou texto livre em `AUTO_STATE.dados`), ícone + rótulo em caixa alta
  correndo em linha (`.cab-rot`, `--t-label`, nunca quebra) + **só os nomes curtos dos grupos
  marcados** separados por " · " (`cabGruposMarcados`: chave e título lidos do DOM por
  `histTituloGrupo`; `cabNomeCurtoGrupo` tira o prefixo da etapa — `Situações (de )?`,
  `Pensamentos (sobre (os? )?|de )` — e, sobrando parêntese, usa só o seu conteúdo quando é uma
  palavra, senão a parte antes: "Autocrítica", "Internas" — decisão D1); nunca subgrupo, nunca nota;
  "…" quando vazia; a Situação acrescenta a frase em itálico 13 px numa linha cortada (D5); no
  Positivo a etapa 1 mostra só a frase; a linha atual tem fundo `--c-surface` e a região
  `aria-live` fica só no trecho dos grupos (`.cab-grupos`), atualizado por `cabAtualizarAtual()` no
  mesmo caminho da contagem do rodapé (`autoAposMudancaNoGrupo` e `autoAposMudancaNoTexto`, o
  caminho único dos campos de texto nos listeners de `change`/`input`); **(4)** `.cab-acoes` —
  "editar" (`cabEditar` → `autoAbrirMenuTipo`, abre "Suas 5 etapas") e "ver tudo" (desde o 16.5e
  `revisarVerTudo(tipo)`: a tela "Revisar e Enviar" em leitura, sem botão de envio, e o voltar da barra
  retorna à etapa de origem — débito 8.27a; o modal "+N" `p11a*` saiu, o casco `.p11-m*` fica só para o
  detalhe do histórico de escalas), sempre presentes, inclusive na etapa 1 (P3). **Só lê
  `AUTO_STATE.dados`** — mantido atual por `autoColetarSecaoAtiva()` (inclusive ao remover uma caixa de
  pensamento, `p8RemoverPensamento` → `autoAposMudancaNoTexto`, 8.27b) — e nunca escreve nele (débito
  8.21 continua fechado). Nuance aceita: item marcado sem nota num grupo com escala só entra na linha
  quando ganha a nota (a coleta o omite; a nota é obrigatória, D9).
- **RodapéEtapa:** `.auto-rodape.barra-acao` com `.auto-rodape-cont` (textos nos atributos
  `data-cont-0/1/n` do próprio rodapé; `autoRodapeAtualizar(bloco)`), "‹" 56 px
  (`aria-label="Etapa anterior"`; "Voltar" na etapa 1) e o primário com o nome da próxima etapa ou
  "Concluir e Revisar". A Situação do Positivo não tem contagem (contrato v3, item 23).
- **Obrigatório na tela (D9):** `autoValidarSecao` devolve `{ ok:false, msg, campo|itens|grupos }` e
  `autoExibirAviso` põe a frase de sempre (`.auto-aviso[role=alert]`, `i-alert`, `--c-risk-ink`) sob o
  campo (`aria-invalid` + borda de risco), sob a barra do item sem nota (`.auto-item-likert.erro`,
  rótulo em risco; abre o grupo) ou após o bloco de grupos, e rola até o primeiro aviso;
  `autoLimparAvisos` a cada mudança. `autoAvancarSequencial` e `autoFinalizarTipo` não usam mais
  `alert()`. **Avisos na tela no lugar de `alert()` (16.5e):** o mesmo `autoAvisoEl(msg)` serve ao erro
  do servidor no envio (`#rvsAviso` na revisão, `#chkAviso` na checagem) e a Meus Registros
  (`histAvisoNaTela`, no topo de `#autoHistLista`); o sucesso do envio é a tela "Registro enviado".
  Nenhum diálogo nativo resta no fluxo do registro (só "Sessão expirada" antes do `logout()`; os
  `alert()` de anamnese e escalas ficam como candidatos).
- **Revisar e Enviar (AUT-09, §13 BlocoRevisão, Pacote 16.5e):** seção `#sec-auto-revisar`
  (substituiu `#sec-auto-resumo`/`autoAbrirResumo`), aberta por `autoFinalizarTipo(tipo)` → coleta as
  10 seções lógicas (as mesmas 56 chaves de sempre no payload; o outro tipo vai vazio), grava
  `<tipo>_preenchido='sim'` e chama `revisarAbrir(tipo)`. A revisão **só lê** `AUTO_STATE.dados` + DOM:
  bloco HUMOR = o mesmo `.menu-humor` do menu (`humorLinhaPreencher('rvs')`, "editar" →
  `revisarEditarHumor` → checagem, cujo "Iniciar novo registro" volta à revisão); um `.rvs-bloco` por
  etapa (`revisarBlocoHtml`): ícone `CAB_ICONES`, rótulo em caixa alta com o nome completo lido do
  `data-barra-titulo` do bloco e a contagem "· N" de itens marcados (Situação sem contagem), chip
  "feita" (`.rvs-feita`) quando há conteúdo, "editar" (`revisarEditar` → `autoEntrarSecao` com
  `AUTO_STATE.revisaoRetorno = tipo`: o rodapé da etapa vira "Concluir e Revisar" —
  `revisarAjustarRodape` no hook de `abrirSecao` — e `autoAvancarSequencial` volta à revisão em vez de
  avançar; a flag zera no menu, na página e ao reabrir a revisão); corpo = textos livres
  (`cabTextoLivre`, Pensamentos em itálico entre aspas `<q>`), chips dos itens marcados nas etapas 1 e 5
  (`.rvs-chip`) e linhas item + barra (largura = nota/5, `.rvs-barra-fill`) + nota nas etapas 2–4
  (`revisarItens`: texto gravado "Item:nota" por `data-grupo`, inclusive "Outro (…)"). Rodapé
  "Você pode corrigir depois em Meus Registros." + `#autoBtnEnviar` (`.b56`, `i-send`); enviando =
  `disabled` + `.enviando` (spinner) + `aria-busy`. `data-tipo` e `data-barra-sobretitulo` da seção
  são escritos por `revisarAbrir`; voltar da barra (`autoVoltarEditarRevisar`) → etapa 5 do tipo, ou
  à etapa de origem quando aberta por "ver tudo" (`AUTO_STATE.revisaoLeitura`).
- **Registro enviado (AUT-10, 16.5e):** `autoEnviarRegistro` guarda `AUTO_STATE.ultimoEnvio`
  (tipo + os 4 campos da checagem) antes de `autoResetState()`, invalida `PEV_STATE`/`INI_STATE`
  como antes e abre `#sec-auto-enviado` por `enviadoMostrar(dados, tipo)` (barra sem voltar,
  `i-check`, "Hoje, dd/mm · hh:mm" por `chkTextoDataHora`, lista "SE QUISER CONTINUAR"). "Fazer também
  um Registro Positivo/Negativo" → `enviadoFazerTambem()` → `autoReaproveitarChecagem(ultimoEnvio)`
  (estado zerado + só data, hora, humor e observação de volta, formulário hidratado) → etapa 1 do outro
  tipo, sem nova checagem e com o mesmo humor/hora no payload. "Abrir o Painel de Evolução" e "Voltar
  ao início" são `abrirSecao`. O espaço do cartão de risco fica para o 16.6. A mesma
  `autoReaproveitarChecagem` serve ao botão "Fazer um registro completo" da "Checagem enviada"
  (`chkFazerRegistroCompleto`, `CHK_ENV.dados`), que leva à página Automonitoramento com a linha
  HUMOR preenchida.
- **Edição em Meus Registros (16.5e, débitos 8.24/8.26/8.27c):** `p136RenderGrupo_` monta a linha
  "Outro:" das etapas já preenchida quando o registro tem "Outro (…)" gravado (texto e nota) e
  `p136ColetarDados_` grava de volta "Outro (texto)[:nota]" como a coleta das etapas
  (`p136OutroInput` aplica a regra §5: texto = marcado); `p136RenderSecao_` usa `--c-reg-neg*`/
  `--c-reg-pos*`; `p136SalvarEdicao` chama `pevInvalidarCache()` e `iniInvalidar()` ao salvar.
- **Rascunho:** grava `etapa` (`AUTO_STATE.etapaAtual`, definida ao abrir uma etapa e zerada no
  menu); `hubContinuarRascunho` reabre essa etapa (ou o menu) e `hubRenderRascunho` mostra
  "Etapa N de 5 · nome" a partir dela. `autoAtualizarBadgesData`, os `[data-auto-badge]` e o
  subtítulo `#topbarSub` saíram (só mostravam a data nas etapas).

## Convenções de namespace (prefixos CSS/JS)

| Prefixo | Escopo |
|---|---|
| `anam*` | Módulo 1 Anamnese |
| `auto*` / `AUTO_*` | Módulo 2 Automonitoramento base |
| `pev*` / `PEV_*` | Painel de Evolução |
| `rev-*` | Infográfico Revisar |
| `hist-*` | Meus Registros (lista) |
| `p5*`, `p8*`, `p9*`, `p10*`, `p11*` | Pacotes 5–11.6 (`p11a*`, o modal "+N", saiu no 16.5e) |
| `rvs-*` / `revisar*`, `env-*` / `enviado*`, `folha*` | Revisar e Enviar, Registro enviado, FolhaInferior (16.5e) |
| `esc*` / `ESC_*` | Módulo 4 Escalas (inclui histórico 12.7) |
| `rr-*` | Telas de resultado unificadas (12.7.2) |
| `prof-*`, `prof-pv-*`, `prof-cad-*`, `prof-edit-*` | Área do profissional (13.2+) |
| `pac-*` | Ações do paciente (senha, edição anamnese — 13.4.1) |
| `p135*` | Ciclo de vida do paciente (13.5) |
| `p136*` | Edição de automonitoramento (13.6) |
| `gra*` | Grade de Atendimento (14.1) |
| `cal*` | Agenda Visual (14.2) |
| `ADM_*` / `--adm*` | admin.html (arquivo separado) |

Pacote novo = prefixo novo (ou continuação do namespace do módulo).
Sugeridos já reservados: `p11b*` (cabeçalho no Positivo), `form*`
(Módulo 3 Formulação).

## Modelo de dados

```
Sistema_VMC (planilha global)
├── Profissionais   (dados dos profissionais; nunca retorna senha_hash)
├── Admins
└── Indice_Siglas   (sigla → tipo → profissional dono; resolução server-side)

Profissional_<sigla>/ (uma pasta por profissional)
├── Clinica VMC - Controle   (pacientes; + abas Config_Agenda e
│                             Grade_Horarios a partir do 14.1)
├── Pacientes/<sigla>        (uma planilha por paciente)
└── Pacientes_Desativados/   (planilhas movidas ao desativar)

Planilha individual do paciente — abas:
├── Anamnese          (registro único na row 2 — sobrescrever, nunca append)
├── Automonitoramento (1 linha por registro; versao_formulario)
└── Escalas           (1 linha por aplicação; escores e alertas)
```

- Contagens de colunas evoluem — a fonte é o cabeçalho real da aba
  (`montarLinha` grava por nome de coluna lido em runtime).
- Formato de grupo do Automonitoramento: itens separados por ` | `, com
  Likert após `:` (ex: `Triste:4 | Solitário(a):3`).
- `Grade_Horarios`/`Config_Agenda` usam formato `@` (texto puro) e
  leitura via `getDisplayValues()` — o bug de hora 1899 não existe ali.
  A grade é estado de configuração: linhas substituídas a cada save (o
  princípio aditivo aplica-se ao schema, não a essas linhas).

## Backend (Apps Script)

- `doPost` roteia por `acao`. Famílias de funções:
  - **Paciente:** `autenticar` (com `tipo` opcional, default paciente),
    `salvarAnamnese`, `salvarAutomonitoramento`, `lerHistorico`,
    `salvarEscala`, `lerEscalas`, `alterarSenhaPaciente`,
    `pacienteAtualizarAnamnese`, lock de edição.
  - **Profissional:** `profListarPacientes`, `lerDadosPaciente`,
    cadastro/anamnese/senha do paciente, desativar/reativar/excluir,
    locks de edição, `profLerGrade`/`profSalvarGrade`.
  - **Admin:** listar/cadastrar/atualizar/trocar senha/desativar/
    reativar profissionais — todas revalidam credenciais por chamada.
  - A lista completa e atual está no próprio `Code.gs` (repo/pasta).
- Resolução multi-tenant: `resolverProfissionalIdPorSigla` →
  `buscarProfissional` → `abrirControleDoProfissional`;
  `buscarPaciente` descobre o dono via Indice_Siglas — o payload nunca
  carrega `profissional_id`.
- `montarLinha` é aditiva por nome de coluna; campos desconhecidos são
  ignorados — o frontend pode evoluir antes do backend.
- `HEADERS_ANAMNESE/AUTOMONITORAMENTO/ESCALAS`: arrays constantes
  usados ao criar planilha de paciente nova; coluna nova = atualizar o
  array correspondente.
- Conversões obrigatórias em `lerAbaComoObjetos`: TIME →
  `Utilities.formatDate(val, 'America/Sao_Paulo', 'HH:mm')`; datas →
  ISO `yyyy-mm-dd`; timestamps → `toISOString()`. Normalização de
  comparação: `_tsNormalizar_()`.
- Compatibilidade retroativa: assinaturas mudam por parâmetros opcionais
  com default no comportamento antigo; o frontend migra em pacote
  separado.

## Frontend — regras estruturais

- Estado global de script usa `var` (const/let não são içados e não
  viram `window.X`).
- Sessão do paciente: `carregarSessao()` (sessionStorage). Credenciais
  admin: apenas variável `ADM_STATE` em memória.
- Toda chamada `chamarServidor` passa `sigla` explícita.
- Rascunhos locais: sessionStorage.

## Sistema visual (Pacote 16.x — só `index-dev.html`)

- **Tokens:** `docs/design/tokens.css` (cópia da entrega do Design) substitui o
  `:root` antigo. 99 tokens claros + 58 sobrescritos em
  `@media (prefers-color-scheme: dark)`, mais apelidos (`--c-bg-page`,
  `--c-surface-2`, `--cal-*`). Regra: nenhum hex/rgba fixo fora dos dois
  `:root`; cor de texto usa a variante `-ink`; vermelho só em `--c-risk*`;
  escalas usam o par por instrumento (`--c-phq9-*` … `--c-srq20-*`);
  registro usa `--c-reg-neg*` / `--c-reg-pos*`. **Fonte única (Pacote 16.4.5,
  decisão 1 das "11 perguntas"):** `--f-title` e `--f-text` são ambos Figtree
  (400, 500, 600, 700 pelo Google Fonts); títulos, escores e horas em 600
  (`--t-display`, `--t-h1`…`--t-h4`, `--t-num`), texto em 400. A Newsreader
  saiu do app e do `tokens.css`; nenhuma serifa em lugar nenhum. Regras
  locais em `--f-title` também usam 600 (`.topbar-titulo`, `.prog-txt`).
  Não existe mais `<link rel="manifest">` (débito 8.16). Sombras
  `--sh-1/2/3/bar`.
- **`vmcTok(nome)`:** lê um token do `:root` para o JS (Chart.js, cores de
  humor) com cache por nome, zerado no `change` de
  `matchMedia('(prefers-color-scheme: dark)')`. Nunca chamar dentro de laço
  de renderização sem o cache.
- **Barra única (`#topbar`, Pacote 16.1):** componente fixo de 52 px fora de
  `.app`, um só para todas as telas. `abrirSecao()` chama
  `topbarAtualizar(id)`, que lê da própria seção `data-barra-titulo`,
  `data-barra-voltar` (o mesmo `onclick` da antiga barra "← Menu") e
  `data-barra-voltar-rotulo`; com atributos → modo `.tela` (voltar + título
  + subtítulo com a data do `[data-auto-badge]`); sem atributos (menu, telas
  do profissional) → modo `.marca`; no login a barra some
  (`body.com-barra` desligado). Título dinâmico: `topbarDefinirTitulo(id,
  texto)`. Badge da sigla e hambúrguer do paciente vivem na barra (ids
  `userBadge`, `pacHamburgerWrap` preservados). O header institucional
  antigo existe só como marca reduzida no login (`.login-marca`).
- **Cabeçalho cumulativo (`.cab`, Pacote 16.5d-2 → v2 no 16.5d-3):** substituiu o
  `.p11-header` do 16.3 — ver "Registro: interior das 5 etapas". Cartão em
  tinte do tipo com quatro blocos (humor + etapa atual, trilha, linhas por
  etapa, ações), sempre visível (na etapa 1 já com a linha "…"), só leitura de
  `AUTO_STATE.dados`.
- **Título nunca duplicado:** quando o título do card repete o da barra, o
  card fica só com ícone + subtítulo (o asterisco de obrigatório vai para
  `.auto-sec-sub .req`).
- **Progresso único (`#prog`, Pacote 16.3):** `progressoDefinir({ total,
  atual, nome, rotulo, cor, feitos, nomes, irPara })` escreve "Etapa N de T ·
  nome" (`#progTxt`) e o trilho (`#progTrilho`): etapas feitas são
  `<button class="prog-seg feito">` (44 px de altura, largura do segmento) que
  chamam `progressoIr(i)` → `irPara(i)`; `progressoOcultar()` esconde.
  `abrirSecao()` chama `progressoParaTela(id)`, que usa `PROG_REGISTRO_TELAS`
  (5 etapas; checagem, menu e revisão = -1, sem trilho) e esconde nas telas
  sem fluxo; o título "Etapa N de 5 · nome completo" vai para a barra (16.5d-2)
  e, **desde o 16.5d-3, o `#prog` fica escondido em todas as telas do registro**
  (decisão P1: a trilha de ícones do cabeçalho cumulativo é o único indicador
  de progresso das etapas; `soTrilho`, `.prog.neg` e `.prog.pos-reg` saíram). A
  anamnese define o próprio em `renderPasso`/`renderRevisao`
  (`ANAM_PASSOS_NOMES`, 5 = 4 passos + revisão, volta por
  `anamIrParaPasso(k)`); a escala em `escAtualizarProgresso` (item atual =
  próximo não respondido; tocar rola até `#escItemBox-<id>`). Cor `--c-pos`.
  Substituiu pontos da anamnese, pontos do humor, barra gamificada, selo
  "Preenchido", tabs do cabeçalho cumulativo e barra percentual das escalas.
- **Barra de ação (`.barra-acao`, Pacote 16.3):** classe no contêiner dos
  botões de navegação já existentes (`.auto-nav-duplo`, `.anam-nav`,
  `.esc-nav`). Em ≤ 600 px vira fixa no rodapé (`--sh-bar`, 64 px +
  `env(safe-area-inset-bottom)`; "Anterior" em contorno com 38 %, primário à
  direita) e `body:has(.section.active .barra-acao) .app` ganha
  `padding-bottom`; no desktop fica no fim do card. `@keyframes fadeIn` das
  seções é só opacidade (um `transform` na seção deslocaria a barra fixa).
- **"Sair sem enviar?" — FolhaInferior (Pacote 16.3 → 16.5e, AUT-12c, §14):**
  `confirmarSaida(acao)` abre a folha `#sairFolha` (`.folha-scrim` em `--c-scrim`,
  `.folha` com alça de 44 px, `role="dialog" aria-modal="true"`, título "Sair sem
  enviar?", texto "O que você preencheu fica guardado enquanto esta aba estiver
  aberta.", botões `.b56` "Continuar registro" — "Continuar aqui" na anamnese e na
  escala — e "Sair"; fecha pela alça, pelo fundo ou por Esc; a partir de 900 px vira
  cartão centrado) quando `fluxoEmAndamento()` — anamnese com rascunho fora do modo
  consulta, registro com dados ou etapa preenchida, escala com resposta — depois de
  `fluxoGuardarRascunho()`. **É o padrão de confirmação de saída** e o único ponto de
  decisão: voltar da barra quando `destinoForaDoFluxo(codigo, idAtual)` (etapa → menu
  e menu → página não pedem), sair (⏻ → `confirmarSaida(logout)`), "Salvar e sair"
  da etapa e do menu (`etapaSalvarESair`/`menuSalvarESair` → `confirmarSaida(→ página)`,
  16.5e), Cancelar da escala (`confirmarSaida(escCancelarAplicacao)`, sem `confirm()`
  nativo). O modal `.p5-modal-*` continua para os demais diálogos (p9, escalas). O
  botão "voltar" do sistema (histórico do navegador) não é interceptado — o app não
  usa `pushState`; candidato 16.5e.1.
- **Rascunhos no `sessionStorage`:** registro `AUTO_RASCUNHO_KEY`
  (`automon_rascunho_v4`, `autoSalvarRascunho`), anamnese
  `anamnese_rascunho` (gravado a cada passo) e, desde o 16.3, escala
  `ESC_RASCUNHO_KEY` (`esc_rascunho_v1`: código, respostas, início;
  `escSalvarRascunho` a cada resposta, `escCarregarRascunho` em
  `escIniciarAplicacao` da mesma escala, `escLimparRascunho` ao mostrar o
  resultado).
- **Ícones (Pacote 16.2):** sprite SVG inline no início do `<body>`, 55
  `<symbol id="i-…">` de desenho próprio (grade 24, traço 1,75,
  `currentColor`); uso `<svg class="ico" aria-hidden="true"><use
  href="#i-x"/></svg>` (com texto ao lado) ou `role="img" aria-label` (só
  ícone); em strings JS a forma sem aspas `<svg class=ico aria-hidden=true><use
  href=#i-x></use></svg>`. `.ico-lg` 28 px nos cards do menu; pseudo-elementos
  usam máscara (`--ico-lock/-check/-check-square/-alert`). **Zero emoji
  (Pacote 16.5b):** as 5 faces do humor são `#i-humor-1` … `#i-humor-5`
  (rostinhos da entrega do Design), geradas em JS só por `vmcHumorIcone(nivel)`
  e coloridas por `.ico-humor-N` (`--c-humor-N-ink`); nenhum caractere
  pictográfico existe em `index-dev.html`, e a validação do checklist confere
  isso por varredura Unicode. Mapa emoji → símbolo em `docs/design/icones.md`.
- **Tokens do 16.5 (Pacote 16.5b):** `--c-humor-1..5-bg/-ink` (faixa e tinta
  de cada nível, claro e escuro), `--c-reg-neg-mid`/`--c-reg-pos-mid`
  (segmento atual do trilho), `--t-h2-sm`, `--t-legend`, `--hit-face` (56 px)
  e `--w-likert-col` (70 px) — mesclados a `tokens.css` e ao `:root` de
  `index-dev.html`; os `-bg`, `-mid`, `--t-h2-sm`, `--t-legend`, `--hit-face`
  e `--w-likert-col` ficam sem uso até o 16.5c/16.5d-2.
- **Toque, piso tipográfico e foco (Pacote 16.2):** `--hit-min` (44 px) em
  tudo que se toca, Likert `--hit-likert` (48 px), checkbox tocável pelo
  `label`; nenhum `font-size` fixo abaixo de 13 px (rótulos em caixa alta usam
  `--t-label`); zero `outline:none` — vale o `:focus-visible` do `tokens.css`.
- **`chamarServidor` (Pacotes 16.2.1–16.2.2; limite e repetição revistos no
  16.4.6):** `_chamarUmaVez_` com `AbortController` e um limite só,
  `VMC_TIMEOUT_MS` = 60 s, com o aviso "aguarde até 1 minuto" aos `VMC_AVISO_MS`
  (20 s). Falha = estouro de tempo, rede, HTTP fora de 2xx, corpo não-JSON ou
  resposta `ok:true` sem o campo da ação (`VMC_CAMPO_DA_RESPOSTA` — um POST
  redirecionado pode terminar no `doGet`). Repetição automática uma vez após
  `VMC_RETRY_MS` (2 s) **só** para leitura curta e login — fora de
  `VMC_ACOES_GRAVACAO` (as 23 do `doPost` que gravam, editam, excluem ou travam
  registro; conferir por grep no `Código.js` ao criar ação nova) e de
  `VMC_ACOES_PESADAS` — e **só** em erro que não é estouro de tempo: o pedido
  que o navegador corta continua executando no servidor (lição 95). Pedido
  idêntico de `VMC_ACOES_COMPARTILHADAS` (`lerHistorico`, `lerEscalas`) já em
  andamento é devolvido a quem pedir de novo. Na falha final,
  `_aguardarTentarDeNovo_` mostra a faixa `#vmcErroRede` ("O servidor não
  respondeu…"); **um clique retoma todas as chamadas em espera**, a promessa só
  resolve com a resposta real (contrato de quem chamou preservado) e a faixa
  avisa a página pelo evento `vmc-faixa-rede`. `iniLerQuieto` (Início,
  checagem) segue a mesma regra sem overlay nem faixa; `lerHistoricoComCache`
  serve a verificação de primeira vez e a de "já fez Negativo" pelo cache de
  30 s de `PEV_STATE`. A consulta de CEP (ViaCEP) é o único `fetch` fora do
  wrapper.
- **Início, período do Painel e blocos recolhíveis (Pacote 16.4):** `#sec-menu`
  virou o Início (`data-barra-titulo="Início"`, `data-barra-voltar=""` = tela sem
  volta via `.topbar.sem-voltar`): saudação com o primeiro nome de
  `lerHistorico().anamnese.nome_completo`, ação primária `iniNovoRegistro()` (mesmo
  caminho de `abrirModulo('automonitoramento')` → `p5ClicarCardBloquevel('iniciar')`)
  e bloco de continuidade que lê `lerHistorico` + `lerEscalas` em paralelo por
  `_chamarUmaVez_` (sem overlay), reaproveitando os caches de `PEV_STATE` e
  `ESC_HIST_STATE`; o Painel abre no menor período com dados —
  `pevPeriodoInicial()` em `pevRenderizar`, menor de 7/30/90 com ≥ 3 registros ou
  "tudo", válido só enquanto `PEV_STATE.periodoAuto`, que a escolha manual zera; e
  `blocoRecolhivelToggle(headEl, estado, attrChave)` é o alternador único dos blocos
  recolhíveis (`.aberto` + seta `.esch-bloco-chevron`), com `escHistToggleBloco`
  (`ESC_HIST_STATE.abertos`, `data-esc`) e `histToggleMes` (`HIST_MESES_ABERTOS`,
  `data-mes`) como adaptadores.
- **Gráfico de humor emprestado (Pacote 16.5d-3):** o bloco "Humor ao longo do
  tempo" do Painel virou três funções com o contêiner por parâmetro —
  `pevMontarBlocoHumor(canvasId, {meio, corpo, fim, classe})` (título, legenda,
  rostinhos 5→1 e canvas), `pevDesenharHumor(regs, canvas)` (devolve o Chart;
  o Painel guarda em `PEV_STATE.charts.humor`, a "Checagem enviada" em
  `CHK_ENV.chart`) e `pevBindSeletor(raiz, aoEscolher)` (liga só os
  `.pev-periodo-btn` do contêiner — sem argumentos, `#pevConteudo` e o
  comportamento de sempre; com `aoEscolher`, o chamador decide) +
  `pevMontarSeletor(periodo)`. Padrão "empréstimo" sem segunda implementação;
  o Painel não mudou de comportamento.

## Registro no computador ≥ 900 px (Pacote 16.5f)

Breakpoints 900 e 1280 (AUT-11 da rodada 3 + decisão P do usuário, 28/09;
`02_telas.md` linha 5: nenhuma medida em vw/vh). Abaixo de 900 px nada muda.

- **Grade da etapa:** a seção física ativa que tem cabeçalho v2 renderizado
  (`.section.active:has(> .cab:not([hidden]))`) vira `grid 280px minmax(0,1fr)`
  (320 px a partir de 1280), `column-gap` 32, áreas `"lateral trilha" /
  "lateral conteudo"`; o bloco `.auto-tipo` visível ocupa `conteudo` com
  `max-width: 760px`. Só nessas telas o `.app` e a `.topbar-in` alargam para
  1136/1176 px (`body:has(…)`), padding 28/32.
- **Cabeçalho v2 = mesmo nó, reposicionado.** `cabRenderizar` monta
  `.cab-trilha` + `.cab-corpo` [ `.cab-etapas` + `.cab-anotado` [ `.cab-humor`,
  `.cab-linhas`, `.cab-acoes` ] ]. No celular `.cab` é flex-coluna,
  `.cab-corpo`/`.cab-anotado` são `display:contents` e a ordem humor → trilha
  → linhas → ações vem de `order`; `.cab-etapas`, `.cab-humor-editar` e
  `.cab-itens` ficam ocultos. No computador `.cab` é `display:contents`: a
  trilha vai para a área `trilha` (acima do título, na largura do conteúdo,
  fundo `-tint` do tipo, sem borda) e `.cab-corpo` para a área `lateral`
  (`position: sticky`, `top = --topbar-h + 16`), sem cabeçalho cumulativo
  acima do conteúdo.
- **Cartão "Suas 5 etapas"** (`cabEtapasHtml`): título = `data-barra-titulo`
  do `#sec-auto-menu`; uma linha por `.metapa` do menu do tipo (nome completo
  e ícone lidos do DOM; o nome usa a classe própria `.cab-lat-nome` e quebra
  em duas linhas — 16.5f.1: `.cab-etapa-nome` é do "Preenchendo" do celular,
  com `nowrap`), com estado — feita = círculo cheio na cor do tipo com
  `i-check`, `<button>` → `cabIrEtapa` (o mesmo caminho da trilha); atual =
  número com borda, fundo `-tint`, `aria-current="step"`; a fazer = número
  cinza. O menu (AUT-03c) continua sem estado. Não é atualizado ao vivo (como
  a trilha): renderiza ao abrir a etapa.
- **Modo detalhe** (`cabItensHtml`, só ≥ 900 por CSS): nas linhas de
  Emoções, Reações físicas e Pensamentos a lateral mostra os itens marcados
  com barra (largura = nota/5) + nota — `revisarItens` + `revisarLinhasHtml`,
  as mesmas funções da tela "Revisar e Enviar" (classes `.rvs-lin*`
  reusadas, item longo cortado com "…"); Situação e Comportamentos continuam
  com os grupos. `cabAtualizarAtual` refaz o `.cab-itens` da etapa atual no
  mesmo caminho do rodapé. A linha HUMOR ganha "editar" (`chkEditar`, o
  mesmo do menu) no lugar de "PREENCHENDO".
- **Item marcado em duas colunas:** `.auto-option.marked` vira `grid
  minmax(0,1fr) var(--w-slider-desktop)` com áreas `"lbl sl" / "rot leg" /
  "avs avs"`; o `label.auto-option-lbl` vira grade `28px 1fr` (check | nome /
  nota) e o `.auto-item-likert` é `display:contents` — rótulo ("ACREDITO:") na
  coluna esquerda sob a nota, `.auto-slider` e legenda na coluna direita de
  400 px. As variáveis (`--v`) e as classes (`.sem-valor`, `.erro`) continuam
  no `.auto-item-likert` e herdam normalmente; `autoLegendaAjustarVisiveis`
  passou a medir a visibilidade pela legenda (o `offsetParent` de um
  `display:contents` é nulo).
- **Grupos fechados** mostram a descrição (`.auto-group-body` visível, só a
  `.auto-lista` recolhida). **Rodapé inline:** `.auto-rodape` vira grade
  `56px 1fr auto` (‹ · contagem à esquerda · próxima etapa).
- **Telas de leitura** (`#sec-auto-passo1`, `#sec-auto-checagem-enviada`,
  `#sec-auto-menu`, `#sec-auto-revisar`, `#sec-auto-enviado`): coluna única
  centrada, `max-width: 720px`. Folha "Sair sem enviar?": centrada, 480 px.

## Esteira de teste dos pacotes de frontend (Pacote 16.5-esteira, 28/09/2026)

Quatro peças versionadas em `scripts/` substituem o que cada pacote reescrevia
(diagnóstico em `..\VMC-offline\ESTEIRA_16_5_DUPLICACOES_E_ADEQUACOES.md`):

- **`scripts/vmc_playwright_base.js`** — módulo dos roteiros Playwright.
  `abrirNavegador()` (Chrome instalado, aba visível), `viewportsDe("390,1280")`,
  `abrir(browser, url, vp, {modo, rotulo, dirCap})` → objeto `S` com a página,
  a coleta (`S.R`: `pageerror`, `dialogos`, `consoleErros`, `requests`,
  `payloads` sem `sigla`, `edicoes`, `capturas`) e os helpers: `ir`, `login`
  (sigla inexistente), `simularSessao`, `iniciarRegistro(tipo, nivel)`,
  `preencherEtapas(tipo, {comOutro})`, `enviar`, `esperarSecao`,
  `esperarPayload`, `foto(nome)` (nome fixo `<rotulo>_<tela>_<largura>.png`),
  `escrever`/`abrirGrupo`/`marcar`/`nota`/`outro`/`nextBtn`/`clicarAcao`,
  medidores `medirTopbar`, `medirCab`, `medirRevisao`, `medirEnviado`,
  `medirFolha`. Rota do Apps Script com modos `fingir` (gravação e edição
  interceptadas, nada gravado) e `real`; `S.bloquearEnvio = n` simula n falhas
  de rede. O roteiro de cada pacote (`..\PACOTE_<N>_fluxo.js`, 60–100 linhas)
  só descreve o fluxo; exemplo completo: `..\PACOTE_16_5e_fluxo_base.js`.
- **`scripts/vmc_fumaca.js`** — fumaça no publicado (uma janela, um viewport):
  espera o Pages servir o marcador (`--marcador`), login inválido até a
  mensagem do servidor, envio fingido até "Registro enviado", chaves do
  payload × `--baseline`, `pageerror`/`dialog` 0; JSON e captura em
  `..\VMC-offline\fumaca\`; código de saída 1 em qualquer falha.
- **`scripts/validar_index_dev.py`** — validação estática do checklist:
  `node --check` por bloco, tags fora de `<script>` por profundidade,
  `var()` sem declaração (reconhece `setProperty`), hex fora dos `:root`
  (falha) e `rgba()` (não pode aumentar), classes sem uso (só as novas
  falham), `font-size` < 13 px, emoji, marcadores, `fetch(` ≤ 2, texto
  proibido fora de comentários, função nova sem chamador e função removida
  ainda referenciada; tabela antes × depois contra `HEAD` (`--ref`) ou contra
  a linha de base gravada por `--antes` e lida por `--depois`.
- **`scripts/conferir_entrega_16_5.py --so-gabarito`** — md5 do gabarito
  clínico sem regenerar `CONFERENCIA_*.md` (que só muda com rodada nova do
  Design).

Duas passagens de navegador por pacote: local em modo fingir (completa, antes
do commit) e fumaça no publicado. Envio real só quando o contrato, `Código.js`
ou a planilha mudarem, ou no fechamento de fase. Modelo de prompt com as
regras: `docs/prompts/MODELO_PROMPT.md`.
