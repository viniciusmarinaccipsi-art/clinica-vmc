# Arquitetura e Padrões Técnicos — Referência

Padrões consolidados do sistema. O estado atual (versões, contagens de
colunas, funções mais recentes) vive no `status_projeto_vmc.md` do
Projeto e no próprio código — em caso de dúvida, conferir a fonte real.

## Stack

- **Frontend:** single-page app `index-dev.html` (index oficial desde 07/10/2026), vanilla JavaScript sem
  framework, Chart.js 4.4.1 via jsDelivr com SRI (18.3), `sessionStorage` apenas (localStorage não
  é usado). Sem service worker (removido no Pacote 15.0).
  `admin.html` é arquivo separado e independente.
  **Index oficial (decisão do usuário, 07/10/2026):** o `index-dev.html` é o único
  arquivo de frontend que recebe pacotes, e todo link que o sistema gera ou mostra
  (`SITE_URL` do `Código.js` — convite, redefinição e WhatsApp —, "Voltar ao
  COGNIATIVO" da `privacidade.html`, "página principal" do `admin.html`) aponta
  para ele. O `index.html` só redireciona (`location.replace` levando `?ativar=` e
  `#`; CSP com o hash do script; link de reserva "Se a página não abrir sozinha,
  toque aqui.") para quem tem a raiz do site salva; não é copiado, atualizado nem
  validado. A versão congelada de 05/10/2026 (Pacote 18.8.1) fica na tag `v18.8.1`
  e em `..\VMC-offline\index_18_8_1_consulta.html`.
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
primeira vez ("Como Usar", `autoComoUsarLido`) e para a janela lenta (16.4.6).
**Desde o 18.1.1 (02/10/2026) a anamnese pendente não tranca mais nada:** o
Início mostra a faixa clicável `.ini-faixa-anamnese` ("Anamnese pendente —
toque para preencher quando puder.", `abrirModulo('anamnese')`), escondida por
`atualizarMenuConformeSessao` quando `anamnese_preenchida`; o modal `p9Modal`
e a faixa da senha (`.pac-senha-destaque`) saíram.

### Cache 30s (padrão `pev*`)
Para dados do servidor que mudam pouco na sessão (`lerHistorico`,
`lerEscalas`). SEMPRE invalidar após operação de escrita correspondente.
**Todo cache por paciente é descartado no logout** (Pacote 16.5d-3.2, débito
8.28): `descartarCachesPaciente_()`, chamada pela saída única `sairDoSistema()`
(18.3), zera `PEV_STATE` (registros, `carregadoEm`, `invalidado`,
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

### Presença (aviso) + carimbo de auditoria (Pacote 13.6; presença sem trava desde o 18.5)
Colunas `editando_quem/editando_desde/editado/editado_por/editado_em`.
A marca de presença é gravada sem await ao abrir a edição e lida em tempo real ao
abrir o modal; limpa ao salvar/cancelar. **Desde o 18.5 ela só avisa** ("<quem>
também está editando este registro"): o botão Editar continua, ninguém é bloqueado,
e a edição é por campo com carimbo (seção "Registro e edição pelo profissional").
Após salvar, a linha mostra "Editado por X em DD/MM HH:MM".

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

Desde o 18.1.1 o Início não exige anamnese: "Novo registro" e as escalas abrem
sempre, e a anamnese pendente é só a faixa clicável (ver "Cadeado de card").

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
  Nenhum diálogo nativo resta no fluxo do registro nem nas escalas desde o 18.4 (regra dos avisos na
  seção "Regressões visuais"; os `alert()` da anamnese e do profissional ficam para 18.6 e 18.5).
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
├── Profissionais   (dados dos profissionais, com email, telefone e crp; controle_id desde o
│                    18.10 — id da Controle; nunca retorna senha_hash)
├── Admins          (email desde o 18.1)
├── Indice_Siglas   (sigla → tipo → profissional dono + email do login; gravado por
│                    nome de cabeçalho desde o 18.1; resolução server-side)
├── Tokens          (18.1: links de convite/redefinição — só o SHA-256 do token,
│                    tipo, sigla, profissional_id, finalidade, expira, usado, criado_em;
│                    18.1.2: + email_destino)
├── Itens_Instrumentos (17.0) · Backups (E3)

Profissional_<sigla>/ (uma pasta por profissional)
├── Clinica VMC - Controle   (pacientes, com email, telefone e nome desde o
│                             18.1 — única fonte do contato; indicadores ind_* de
│                             cada paciente desde o 18.10; + abas Config_Agenda e
│                             Grade_Horarios a partir do 14.1)
├── Pacientes/<sigla>        (uma planilha por paciente)
└── Pacientes_Desativados/   (planilhas movidas ao desativar)

Planilha individual do paciente — abas:
├── Anamnese          (registro único na row 2 — criada uma vez por `salvarAnamnese`; depois, só edição por campo)
├── Anamnese_Historico (18.6: campo, valor_anterior, por, em — 1 linha por campo alterado;
│                      nasce na primeira edição; só o servidor grava; nenhuma ação lê)
├── Automonitoramento (1 linha por registro; versao_formulario)
├── Escalas           (1 linha por aplicação; escores e alertas)
└── Rascunho          (18.10b: 1 linha por tipo — tipo, atualizado_em, dados_json;
                       nasce no primeiro "Salvar e sair"; nenhuma leitura clínica a usa)
(as três primeiras têm a coluna id_envio desde o 18.10 — identificador do envio)
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

- `doPost` roteia por `acao` (44 ações desde o 18.5 — as três novas são `profCriarAutomonitoramento`, `profCriarEscala` e `profEditarEscala`; eram 41 desde o 18.10; o `switch` mora em `_despachar_`, e as
  ações de `ACOES_COM_TRAVA` rodam dentro da trava de gravação — seção do 18.10). Um **portão
  único** antes do despacho exige o crachá (`payload.token`) em toda ação fora de
  `ACOES_PUBLICAS`; cada `case` cabe numa linha e recebe a sessão `s`
  (`_exigir_(s, 'paciente')`, `_authProfissional_(s)`, `_admDaSessao_(s)`).
  Famílias de funções:
  - **Públicas:** `ping`, `autenticar(tipo, email, senha)`,
    `pedirRedefinicao(tipo, email)`, `definirSenha(ativar, senha?)`.
  - **Paciente (sigla do crachá):** `salvarAnamnese`,
    `salvarAutomonitoramento`, `lerHistorico`, `salvarEscala`, `lerEscalas`,
    `alterarSenhaPaciente`, `pacienteAtualizarAnamnese`, lock de edição,
    `salvarRascunho`/`lerRascunhos`/`apagarRascunho` (18.10b).
  - **Profissional (profissional do crachá; `siglaPaciente` conferido contra o
    dono):** `profListarPacientes`, `lerDadosPaciente` (devolve também o
    `contato` do cadastro), cadastro (sigla gerada), anamnese (com
    `contato` opcional), convite, senha do paciente, desativar/reativar/
    excluir, locks de edição, `profLerGrade`/`profSalvarGrade`.
  - **Paciente ou profissional:** `lerItensInstrumento`, `lerEditandoAuto`.
  - **Admin:** listar/cadastrar (sem senha)/atualizar/trocar senha/
    desativar/reativar profissionais e `admEnviarConvite`.
  - A lista completa e atual está no próprio `Código.js`.
- Resolução multi-tenant: `resolverProfissionalIdPorSigla` →
  `buscarProfissional` → `abrirControleDoProfissional`;
  `buscarPaciente` descobre o dono via Indice_Siglas — o payload nunca
  carrega `profissional_id`. Desde o 18.10 a Controle abre pelo `controle_id`
  (sem busca no Drive) e cada planilha é aberta uma vez por chamada.
- `montarLinha` é aditiva por nome de coluna (desde o 18.10 as colunas de
  `CAMPOS_DO_SERVIDOR` nunca recebem valor do cliente); campos desconhecidos são
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
  separado — exceção decidida em 29/09: a autenticação virou de uma vez no
  18.1 (sem senha antiga, sem hash v1).

## Frontend — regras estruturais

- Estado global de script usa `var` (const/let não são içados e não
  viram `window.X`).
- Sessão do paciente: `carregarSessao()` (sessionStorage: sigla, e-mail,
  nome e crachá — nunca a senha). Profissional (`PROF_SESSAO`) e admin
  (`ADM_STATE`) só em memória, com o crachá.
- `chamarServidor` acrescenta `token` a todo payload (menos as ações
  públicas) e trata `{codigo:'sessao_expirada'}` voltando ao login com aviso
  na tela; caminho que fala com o servidor fora dele (`iniLerQuieto`) faz o
  mesmo. `payload.sigla` ainda viaja em algumas chamadas e é ignorado pelo
  servidor.
- Rascunhos locais: sessionStorage, presos à sigla da sessão desde o 18.1.2 (`vmcRascunhoDaSessao_`).
- Saída de dados: escapador único `esc` e saída única `sairDoSistema` (18.3, seção "Escape único, saída
  única e camadas").

## Sistema visual (Pacote 16.x — só `index-dev.html`)

- **Tokens:** `docs/design/tokens.css` (cópia da entrega do Design) substitui o
  `:root` antigo. 132 tokens claros + 76 sobrescritos em
  `@media (prefers-color-scheme: dark)` (contagem de 30/09/2026 no
  `index-dev.html`; os 16.5b/16.5e acrescentaram tokens ao arquivo de 17/09),
  mais apelidos (`--c-bg-page`, `--c-surface-2`, `--cal-*`) num terceiro bloco.
  Regra: nenhum hex fixo fora dos três `:root` e `rgba()` não aumenta
  (24 ocorrências toleradas em 30/09; o validador acusa qualquer acréscimo); cor de texto usa a variante `-ink`; vermelho só em `--c-risk*`;
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
  e menu → página não pedem), sair (⏻ → `confirmarSaida(sairDoSistema)`), "Salvar e sair"
  da etapa e do menu (`etapaSalvarESair`/`menuSalvarESair` → `confirmarSaida(→ página)`,
  16.5e), Cancelar da escala (`confirmarSaida(escCancelarAplicacao)`, sem `confirm()`
  nativo). O modal `.p5-modal-*` continua para os demais diálogos (escalas; o p9
  saiu no 18.1.1). O
  botão "voltar" do sistema (histórico do navegador) não é interceptado — o app não
  usa `pushState`; candidato 16.5e.1.
- **Rascunhos no `sessionStorage`:** registro `AUTO_RASCUNHO_KEY`
  (`automon_rascunho_v4`, `autoSalvarRascunho`), anamnese
  `anamnese_rascunho` (gravado a cada passo) e, desde o 16.3, escala
  `ESC_RASCUNHO_KEY` (`esc_rascunho_v1`: código, respostas, início;
  `escSalvarRascunho` a cada resposta, `escCarregarRascunho` em
  `escIniciarAplicacao` da mesma escala, `escLimparRascunho` ao mostrar o
  resultado). **Desde o 18.1.2 os três gravam a `sigla` da sessão** e são lidos por
  `vmcRascunhoDaSessao_` (rascunho sem sigla ou de outra sigla é apagado ao carregar;
  sem sessão nada é devolvido); a anamnese grava sempre por `gravarRascunhoAnamnese_`.
  A saída manual (`sairDoSistema()`, 18.3) esvazia o `sessionStorage` inteiro e zera o registro em memória;
  a sessão expirada os mantém para a mesma sigla.
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
  **Desde o 18.1:** `S.login` usa e-mail; a sessão simulada leva um crachá
  fictício e, em modo `fingir`, `lerHistorico`/`lerEscalas`/`lerItensInstrumento`
  respondem localmente (o servidor real recusaria); `S.servidor = (acao, corpo)
  => resposta` simula qualquer ação do servidor (exemplo completo, com
  conferência de `token` em toda ação: `..\PACOTE_18_1_fluxo.js`);
  `S.R.chavesPorAcao` guarda as chaves de cada payload (prova de que nenhuma
  senha viaja).
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

**Portões automáticos (18.8):** `.github/workflows/portoes.yml` roda a cada push na
`main` e nos branches `pacote-*` e em pull request: `node --check` (`Código.js` e
scripts), `scripts/testes/teste_escores.js` (gabarito dos escores por ponto de
corte, servidor e frontend), `scripts/testes/backend_*.js` (o backend real sobre
planilhas simuladas), validador, gabarito md5 (o portão `index.html` = `index-dev.html` saiu em 07/10/2026),
CSP presente sem `'unsafe-eval'`, zero `new Function`, e gitleaks no histórico
inteiro (exceções conferidas à mão em `.gitleaksignore`, sem citar o trecho).
O branch do pacote fica verde antes do merge. A fumaça (`vmc_fumaca.js`) tem
limite por passo e falha com violação de CSP; `vmc_playwright_base.js` coleta
as violações em `R.csp`. Playwright e comparação de capturas seguem no PC.

## Acesso por e-mail e crachá de sessão (Pacote 18.1 — implementado e publicado em 01/10/2026, @27)

Detalhes da implementação que o desenho abaixo não fixava: o token do link
de convite vai no campo `ativar` (o `token` do payload é o crachá);
`definirSenha` sem senha só confere o link (a tela "Crie sua senha" mostra o
e-mail antes); o cadastro do paciente já devolve um link (canal `link`) e o
botão WhatsApp usa o último link gerado na tela (no 18.1.2 passou a gerar o link sob
demanda — ver "Endurecimento"); o e-mail cumprimenta pelo
primeiro nome; a Anamnese espelha o cadastro mas mantém o valor que já tinha
quando o cadastro está vazio; o Início usa a barra em modo marca
(COGNIATIVO + frase); `ITER_SENHA` = 5000 no 18.1, calibrado em 300 no 18.1.2.

### Endurecimento (Pacote 18.1.2 — publicado em 02/10/2026, @28)

Correções da revisão de segurança pós-publicação do 18.1 (detalhes e cenários
só fora do repositório). O que muda no desenho abaixo:

- **Links presos ao e-mail de destino:** a aba `Tokens` ganhou `email_destino`
  (normalizado); `definirSenha` só aceita o link quando ele é igual ao e-mail
  atual da conta (link sem `email_destino` não vale). `_invalidarLinks_(tipo,
  sigla)` marca como `substituido` os links pendentes da conta quando a senha é
  gravada por qualquer caminho, quando o e-mail muda de fato e quando a conta é
  desativada ou excluída.
- **Links coexistem:** criar um link não derruba os anteriores (e-mail e
  WhatsApp valem juntos); usar um invalida os outros. Teto de 3 pendentes por
  conta (o 4º substitui o mais antigo); ao criar, saem da aba as linhas vencidas
  há mais de 7 dias.
- **Crachá preso à credencial:** 5 campos (`tipo|sigla|profissional_id|expira|impressao`),
  `impressao` = 16 hex de `SHA-256('cracha|' + senha_hash)`; `_validarToken_`
  recalcula com o registro que já lê. Senha trocada ou conta recriada com a
  mesma sigla derruba os crachás antigos; `alterarSenhaPaciente` devolve um
  crachá novo, que o cliente grava na sessão.
- **Ações públicas:** senha acima de `SENHA_MAXIMA` (128) recusada antes de
  qualquer hash (e `maxlength="128"` nas telas); "Esqueci a senha" com limite
  por (perfil, e-mail) antes de ler planilha, cota própria
  (`REDEFINICOES_DIA_MAX`) separada da dos convites (`EMAILS_DIA_MAX`), cota
  reservada sob `LockService` antes de criar o link, link anulado se o e-mail
  não sai, resposta neutra sempre; piso de tempo nas falhas de login e nas
  respostas da redefinição (`PISO_LOGIN_MS`, `PISO_REDEF_MS`; calibração no
  débito 8.77); a tranca de 5
  falhas grava a tentativa antes de conferir a senha.
- **`ativo`:** critério único `_estaAtivo_` (o booleano `true` ou os textos
  `sim`, `s` e `true`, sem diferença de caixa e de espaços = ativo; o resto,
  inclusive vazio = inativo); o cliente recebe sempre `Sim`/`Nao`.
- **Cliente — geração da sessão:** `VMC_GERACAO_SESSAO` sobe no login feito,
  nos logouts e na sessão expirada; `chamarServidor` e `iniLerQuieto` descartam
  a resposta de um pedido feito numa geração anterior (a promessa não
  resolve), e o Início só mescla o nome na sessão se o crachá for o mesmo.
- **Cliente — sessão expirada:** remove só a sessão (rascunhos ficam, presos à
  sigla), fecha todas as sobreposições e esvazia as quatro que mostram conteúdo
  já renderizado — histórico, detalhe de escala, respostas, lista do Painel
  (`vmcFecharSobreposicoes_`); os modais de formulário limpam os campos ao
  abrir; o envio da anamnese não mostra `alert()` nesse caso.
- **Cliente — pedido compartilhado:** a chave de `_chamarUmaVez_` ordena as
  chaves do payload (`_chaveDoPedido_`), e `iniLerQuieto` monta o payload na
  mesma ordem do `chamarServidor`.
- **Cliente — WhatsApp:** habilitado com telefone válido, sem depender do
  envio por e-mail (o e-mail da conta continua obrigatório: o link é preso a
  ele); sem link em memória, o clique abre a aba na hora, pede
  `profEnviarConvite`/`admEnviarConvite` com `canal: 'link'` e navega a aba
  para o `wa.me`; com o link do cadastro ou do último convite na tela,
  reaproveita esse. O link fica guardado por sigla (`PROF_LINK_POR_SIGLA`, até
  47 h; no admin, `ADM_STATE.convites` por profissional) até o logout ou a
  sessão expirada, e é esquecido quando a própria página troca a senha, o
  e-mail ou desativa/exclui a conta — mudança feita em outra página não chega
  a ele (o servidor recusa o link velho com "Link inválido").

Decisão do usuário (29/09): virada única, sem compatibilidade com a senha
antiga e sem migração de hash; pacientes reconvidados aos poucos. A sigla
continua sendo a chave interna de tudo (planilhas, pastas, `Indice_Siglas`,
contratos de dados); o e-mail é só o identificador de login.

- **Identidade:** unicidade de conta = (perfil, e-mail), porque a mesma pessoa
  pode ser admin, profissional e paciente com o mesmo e-mail. A tela de login
  mantém a escolha do perfil. `Indice_Siglas` ganha a coluna `email`
  (aditiva) para resolver e-mail → sigla → profissional dono numa leitura;
  Controle, Profissionais e Admins ganham `email` para exibição e convite. O
  índice passa a ser gravado por nome de cabeçalho.
- **Crachá de sessão (`token`):** emitido por `autenticar(tipo, email, senha)`;
  assinado por HMAC-SHA256 com segredo em `PropertiesService` (script), carrega
  `tipo|sigla|profissional_id|expira` (6 h; desde o 18.1.2 com o 5º campo
  `impressao`); validar = recomputar a assinatura
  e conferir a validade; `ativo` conferido a cada chamada. Sem armazenamento
  de sessão (o `CacheService` pode expirar antes das 6 h). Toda ação exige o
  crachá, menos `ping`, `autenticar`, `pedirRedefinicao` e `definirSenha`;
  sigla e profissional saem do crachá, nunca do payload. Rotacionar o segredo
  derruba todas as sessões. Profissional e admin deixam de reenviar a senha.
- **Convite e redefinição:** `profEnviarConvite(sigla, canal, contato)`,
  `admEnviarConvite(profissional_id, canal)` e `pedirRedefinicao(tipo, email)`
  (resposta idêntica exista ou não o e-mail) geram um token aleatório de uso
  único, válido por 48 h, guardado só como SHA-256 na aba `Tokens` da
  `Sistema_VMC` (colunas `token_hash`, `tipo`, `sigla`, `expira`, `usado`; no
  18.1.2 também `email_destino` — ver "Endurecimento", que muda o que segue);
  `canal` = `email` (envia) ou `link` (só gera); ambos devolvem o link, que o
  botão WhatsApp da área do profissional abre em `wa.me/55<dígitos>` com a
  mensagem aprovada (nenhum envio automático). O e-mail sai por `MailApp` com
  remetente "COGNIATIVO", em HTML simples com texto puro de reserva: linha de
  destaque (nome + subtítulo) no topo, um único link `index-dev.html?ativar=<token>`
  e a assinatura do profissional no fim; a tela "Crie sua senha" chama
  `definirSenha(token, senha)`, que grava o hash e marca o token como usado;
  o cliente apaga o token da URL com `history.replaceState`.
- **Contato do paciente (decisão de 30/09):** o cadastro (Controle: `email`,
  `telefone`, só dígitos) é a única fonte; as colunas `email` e `telefone` da
  aba Anamnese permanecem (dados reais) e são espelhadas pelo servidor a cada
  gravação da anamnese, ignorando o que o cliente mandar nessas chaves; o
  formulário de anamnese não pergunta; o editor do profissional pré-carrega
  os campos de cadastro com os valores da anamnese quando a Controle está
  vazia, e `_atualizarContatoPaciente_` grava a Controle por nome de cabeçalho.
- **Marca (COGNIATIVO):** nome em caixa alta; frase de destaque "pensar,
  registrar, transformar" logo abaixo do nome, no login e na barra do Início;
  subtítulo oficial "Psicoterapia para além das sessões, com intervenções cognitivo-comportamentais no dia a dia." em letra miúda (piso de 13 px) no rodapé do login e nos
  e-mails; admin e documentos só com o subtítulo. Títulos internos mudam no
  pacote de renomeação.
- **Senha:** (desde o 18.2.1 o formato é o v3 com pimenta — ver a subseção própria abaixo; o v2 só é conferido) hash `v2$<sal_hex>$<iter>$<hmac_sha256_hex>` com sal por usuário
  e iterações calibradas para 200–400 ms no Apps Script; mínimo de 8
  caracteres; comparação em tempo constante; 5 falhas por (perfil, e-mail)
  → 15 min de bloqueio (`CacheService`, chave `falha:<tipo>:<email>`);
  mensagem única "E-mail ou senha incorretos", inclusive para conta inativa.
- **Cadastro:** `profCadastrarPaciente` recebe nome, e-mail e telefone; o servidor gera a
  sigla (iniciais + desambiguação, dentro de `^[A-Z0-9_]{2,10}$`) e envia o
  convite. A função de arranque de uso único do 18.1 (gravava o segredo do crachá
  e os e-mails das contas admin e profissional) foi usada em 01/10 e **removida no
  18.2**. **Recuperação, se um dia for preciso** (não há função no código para isso):
  (1) *segredo do crachá perdido* — o login responde "Servidor sem segredo de sessão.":
  no editor do Apps Script, Configurações do projeto → Propriedades do script, criar
  `SEGREDO_SESSAO` com um valor longo e aleatório (dois UUID colados servem); nunca em
  código nem em documento; todas as sessões abertas caem e cada pessoa entra de novo;
  (2) *conta de admin ou profissional sem e-mail ou sem senha* — conferir o e-mail na
  aba `Admins`/`Profissionais` **e** na `Indice_Siglas` (mesma sigla e tipo) e usar
  "Esqueci a senha" no perfil certo: o link de 48 h chega ao e-mail cadastrado.
- **Fora do código:** as funções de teste (`testarSetup`,
  `testarAdmin13_1_1`) e os utilitários mortos (`criarAbaEscalas`,
  `atualizarSchemaSistemaVMC`) saem no 18.1; `doGet` devolve `ok:false`.
- **Cliente:** `sessionStorage.paciente` guarda sigla, e-mail e crachá; as
  sessões de profissional e admin ficam em memória com o crachá; `chamarServidor`
  acrescenta `token` a todo payload; `{ok:false, codigo:"sessao_expirada"}`
  leva ao login com aviso na tela (nunca `alert()`).

### E-mail único por profissional (Pacote 18.1.3 — publicado em 02/10/2026, @29)

A unicidade do e-mail de **paciente** vale dentro de cada `profissional_id`
(a recusa global "já está em uso" revelava a um profissional que a pessoa já
era paciente de outro consultório — sigilo); e-mail de **profissional** e de
**admin** segue único global. A sigla continua única global.

- **Cadastro e troca de e-mail:** `cadastrarPaciente` e `_gravarEmailIndice_`
  comparam o e-mail só entre pacientes do mesmo profissional.
- **Login (a senha decide):** `autenticar` confere a senha em todas as contas
  ativas do e-mail (`_contasPorEmail_`). Nenhuma confere → falha de sempre
  (mesma mensagem e piso; hash de descarte com zero contas). Uma confere →
  entra como antes. Mais de uma → `{ok:false, codigo:'escolher', opcoes:[{id,
  profissional}]}` **sem crachá**; o `id` é opaco (HMAC com o segredo de
  sessão, `_idEscolha_`), sem sigla nem `profissional_id`. A 2ª chamada
  (`escolha` no payload) reconfere a senha e só então emite o crachá; escolha
  inválida conta na tranca 5 falhas → 15 min.
- **Redefinição:** um link e um e-mail por conta ativa; com mais de uma, cada
  e-mail leva "Acompanhamento com: <profissional>" (`montarEmail` com 4º
  parâmetro). Cota reservada tudo-ou-nada (`_reservarEmail_(cota, quantos)`).
  Os links já são por conta (tipo + sigla) desde o 18.1.2: usar um derruba só
  os da mesma conta.
- **Cliente:** resposta `escolher` abre a tela "Com qual profissional deseja
  entrar?" (`#loginEscolher`, botões `.login-escolha-btn` via `textContent`);
  e-mail e senha ficam só em memória (`LOGIN_ESCOLHA`) até a 2ª chamada e são
  apagados ao entrar, voltar ou falhar; a conclusão do login é única
  (`loginConcluir_`), comum aos dois caminhos.

### Política de Privacidade e aceite (Pacotes 18.1.5 e 18.1.6 — publicados em 03/10/2026, @30)

- **Página:** `privacidade.html` na raiz — pública, sem login e sem JavaScript de
  sistema; tokens de `docs/design/tokens.css`; versão no topo = `POLITICA_VERSAO`
  do `Código.js` (**mudou o texto → sobe a versão nos dois**). Link discreto no
  rodapé do login.
- **Aceite na ativação:** o probe do `definirSenha` devolve `exige_aceite` (paciente
  sem aceite da versão atual) e `politica_versao`; a tela "Crie sua senha" mostra a
  caixa obrigatória e o cliente devolve `{aceite:true, versao_politica}`; o servidor
  recusa sem eles (`aceite_obrigatorio`) e, ao gravar a senha, grava
  `aceite_politica_em` (America/Sao_Paulo) e `aceite_politica_versao` na linha do
  paciente na **Controle** (onde vivem `senha_hash` e `ativo`; colunas por cabeçalho).
- **Aceite de quem já tinha senha:** `autenticar` devolve o booleano
  `aceite_pendente` no perfil (só do próprio paciente); o cliente mostra a tela única
  "Política de Privacidade" com "Continuar" e só entra depois de `aceitarPolitica`
  (ação autenticada pelo crachá — `chamarServidor` aceita token do chamador antes
  da sessão existir). Na escolha de profissional (18.1.3), o aceite é da conta
  escolhida. Redefinição de conta que já aceitou não pede de novo; profissional e
  admin não têm aceite.

### Execução de funções pelo Code (Pacote 18.1.4 — 03/10/2026)

`clasp --user run run-function <funcao>` executa qualquer função pública do
`Código.js` no servidor real, direto do Code — prova de pacote, backup sob
demanda (`rodarBackupAgora`), monitor (`rodarMonitorAgora`). Credencial nomeada
`run` (projeto GCP `cogniativo-clasp`; configurações na seção 1 do status;
`client_secret.json` fora do Drive e do repositório), separada da credencial
padrão de `push`/`deploy`. Roda o HEAD; a implantação fixa do app web não muda.
Limites: função com `_` final é interna (a API recusa); o projeto próprio só
enxerga as APIs ativadas nele (Apps Script, Drive e Sheets ativadas em 03/10).
`versaoDoServidor` é a função de verificação. O editor do Apps Script deixou de
ser necessário para executar função. O aceite do 18.1.6 grava com apóstrofo
(texto literal; o Sheets retipava `'2026-10'` para data — achado da prova real,
deploy @31).

### Células seguras (Pacote 18.2 — publicado em 03/10/2026, @32)

- **Trava única `_celulaSegura_(v)`** — só age em `string`: se começa com `=`, `+`,
  `-`, `@`, tab, retorno de carro ou apóstrofo, grava `"'" + v`. O Sheets guarda o
  texto como digitado (o apóstrofo some na leitura) e nunca o trata como fórmula.
  Número, booleano, `Date`, `null` e vazio passam intactos.
- **`_celulaTexto_(col, v)`** é o que as gravações chamam: em coluna de **texto livre**
  (`_colunaTextoLivre_`) ou de **identificação** (`_colunaTexto_`), toda string não
  vazia ganha o apóstrofo — o que foi digitado não é retipado (`10/10`, `1-2`, `13:00`,
  `0123`, `2026-10`); nas demais colunas vale só a `_celulaSegura_`.
  - Texto livre: todas as colunas da Anamnese menos `timestamp`, `versao_formulario`
    e `data_nascimento`; `humor_observacoes` e os `*_o_que` do registro;
    `observacoes` e `item_funcional_texto` das escalas; `nome`, `nome_completo`,
    `observacoes` e `crp` dos cadastros.
  - Identificação: `sigla`, `profissional_id`, `email`, `telefone`, `cep`, `zip_code`,
    `cpf`, `rg`, `email_destino`, `aceite_politica_em`, `aceite_politica_versao` e
    `*_email`/`*_telefone`.
  - **Fora, de propósito** (alguma leitura trata como data, hora ou número, ou são
    estruturadas): `data_*`, `hora_registro`, `timestamp`, `humor_nivel`, subgrupos
    do registro, `*_preenchido`, itens e escores das escalas, `faixa`, `instrumento`,
    alertas, lock e auditoria, `expira`/`criado_em`/`usado` dos tokens, `senha_hash`.
- **Onde:** `montarLinha` (anamnese, registro, escala — desde o 18.6 a ficha da anamnese
  só é montada em `salvarAnamnese`), `_atualizarCamposLinha_`, `_historicoDaAnamnese_`, `_anexarPorCabecalho_`,
  `_atualizarLinhaPorChave_`, `_gravarEmailIndice_`, `cadastrarProfissional`,
  `atualizarProfissional`; `salvarGradeAtendimento` e o log do backup usam a
  `_celulaSegura_`. Valor só do servidor (cabeçalho, hash, status, carimbo de hora)
  não passa pela trava. Valor do servidor que **já traz o próprio apóstrofo** (aceite
  da política) vai no 5º parâmetro `camposServidor` de `_atualizarLinhaPorChave_` —
  pela trava ganharia um segundo, que ficaria gravado.
- **Formato texto (`@`)** nas colunas de identificação: aplicado uma vez nas abas que
  já existiam e, daí em diante, só onde aba ou coluna **nasce** (`_garantirColunas_`,
  `_formatarColunasTexto_` em `cadastrarPaciente` e `cadastrarProfissional`) — nenhuma
  gravação paga por isso. **O formato não basta sozinho:** `appendRow` ignora o `@` da
  coluna e ainda o desfaz na linha nova (medido em 03/10); quem protege a linha nova é
  o apóstrofo. O formato segura `setValue` nas linhas que já existiam.
- **Gravação nova se prova lendo a célula de volta no servidor real** (lições 105 e
  106): o mock do Node só imita o que já foi medido.

### Pimenta no hash de senha (Pacote 18.2.1 — publicado em 03/10/2026, @33)

- **Formato v3:** `v3$<sal_hex>$<iter>$<hmac_sha256_hex>`. É o mesmo HMAC-SHA256 iterado
  do v2, mas a chave deixa de ser a senha crua e passa a ser
  `HMAC-SHA256(PIMENTA_SENHA, senha)`. Sal por usuário e `ITER_SENHA` (300) como antes.
- **Pimenta:** propriedade do script `PIMENTA_SENHA` (32 bytes aleatórios em hex),
  criada uma única vez em 03/10/2026 por função temporária. Mora **só** nas
  propriedades do script: não está nas planilhas, nos backups, no código, no
  repositório nem em log, e nenhuma função a devolve. É separada de `SEGREDO_SESSAO`
  (trocar o segredo de sessão derruba as sessões, não as senhas). Efeito: uma cópia
  das planilhas ou de um backup, sozinha, não serve para testar senhas.
- **Sem pimenta o servidor recusa** gravar e conferir senha (inclusive v2), com a
  resposta genérica de sempre para quem chama e `console.error` no servidor — nunca
  cai para v2 em silêncio.
- **Toda gravação emite v3** (`gerarHashSenha`): ativação e redefinição
  (`definirSenha`), `alterarSenhaPaciente`, `profAlterarSenhaPaciente`,
  `trocarSenhaProfissional`. `conferirSenha` aceita v3 e v2. O hash de descarte
  (conta inexistente, sem senha ou com hash inválido) passa pelo caminho v3.
- **Regravação no login:** quando `autenticar` confere uma senha ainda guardada em v2
  (300 ou 5000 iterações), regrava **só aquela conta** em v3 na mesma chamada
  (`_gravarHashDaConta_`). Não é troca de senha: não chama `_invalidarLinks_`. O
  crachá sai depois, com a impressão do hash que ficou gravado; as sessões abertas
  dessa conta em outros aparelhos caem uma vez (a impressão mudou). No login com
  escolha de profissional (18.1.3) a primeira chamada não regrava nada; a segunda
  regrava só a conta escolhida.
- **Se a propriedade `PIMENTA_SENHA` for perdida ou trocada:** nenhuma senha v3
  confere mais e não há como recuperar. Criar uma pimenta nova (Configurações do
  projeto → Propriedades do script, valor longo e aleatório) e **todas as contas
  voltam por "Esqueci a senha"** (admin e profissional) e por convite ou "Esqueci a
  senha" (pacientes). O mesmo vale para o rollback: a @32 não confere v3 — voltar
  para ela obriga "Esqueci a senha" nas contas já regravadas.
- **Pisos de tempo (8.77), medidos em 03/10/2026 no servidor real**, 20 execuções por
  caminho com o piso zerado, conta de paciente descartável. Regra: piso = maior p95
  medido, arredondado para cima em 250 ms.

  | Caminho | p50 | p95 | máx. |
  |---|---|---|---|
  | `autenticar` — sucesso v3 | 1359 ms | 2007 ms | 3081 ms |
  | `autenticar` — falha de senha | 1295 | **3328** | 4515 |
  | `autenticar` — conta inexistente | 456 | 1015 | 1484 |
  | `autenticar` — sucesso com regravação v2→v3 (uma vez por conta) | 2578 | 3083 | 3810 |
  | `pedirRedefinicao` — conta existente, sem o envio | 2374 | 3330 | 3406 |
  | envio real de um e-mail (3 medições) | — | — | 219 |
  | `pedirRedefinicao` — conta inexistente | 318 | 490 | 1447 |
  | `pedirRedefinicao` — pedido repetido em 15 min | 33 | 42 | 44 |

  (**remedidos no 18.10: 2750 e 3250 — seção do 18.10**) `PISO_LOGIN_MS` = **3500** (3328 → 3500; a regravação não passou dos demais e
  entrou na conta) e `PISO_REDEF_MS` = **3750** (3330 + 219 = 3549 → 3750). Eram 2500
  sem calibração. O hash v3 isolado custa ~180–250 ms; o resto do tempo é leitura de
  planilha — refazer a medição quando o 18.10 reduzir as leituras por login.
- **Retenção:** `pastasExcedentes` reconhece `AAAA-MM-DD` e `AAAA-MM-DD_<sufixo>`
  (cópia extra feita antes de um pacote); conta **datas**, e as pastas com sufixo saem
  junto com a do mesmo dia. Nenhuma pasta de backup é apagada à mão.
- `medirHashSenha` mede o caminho v3 e devolve só números
  (`clasp --user run run-function medirHashSenha`).

### Escape único, saída única e camadas (Pacote 18.3 — publicado em 03/10/2026, só frontend)

- **Escapador único `esc(s)`** (`index-dev.html` e `admin.html`): converte `& < > " '` (o `&`
  primeiro); `null`/`undefined` → `''`; número → texto. `escapeHtml`, `escapeAttr`, `profEscHtml_` e
  `escapeHtmlAuto` são atalhos que chamam `esc`; não existe outro `.replace(/&/g…)`. Regra: todo dado do
  usuário ou do servidor que entra em `innerHTML`, template string ou atributo (`value="…"`,
  `aria-label`, `data-*`) passa por `esc`. Dado que vai para JS de `onclick` não é interpolado: vai
  num `data-*` escapado e o `onclick` lê `this.dataset.*` (sigla do paciente no painel do
  profissional, código da opção da escala). **Exceções (HTML interno, não escapado):** sprite e ícones
  (`vmcHumorIcone`, `cabIco`, `<svg><use href=#i-…>`), catálogo `ESC_ESCALAS` (`emoji`, `subtitulo`,
  textos educativos com `<strong>`), constantes de formulário (`ESCOLARIDADES`, `ESTADOS_BR`…) e HTML
  montado por funções que já escapam por dentro. Seletor CSS montado com dado (`querySelector('[value="…"]')`)
  não é HTML: fica para o 18.3.1 (`CSS.escape`).
- **Saída única `sairDoSistema(opcoes)`:** ⏻ da barra (`confirmarSaida(sairDoSistema)`, nos dois
  perfis), "Sair" do painel do profissional, sessão sem crachá e sessão expirada
  (`vmcSessaoExpirada_` → `sairDoSistema({ manterRascunhos: true })`). Sobe `VMC_GERACAO_SESSAO`, fecha
  as sobreposições, `sessionStorage.clear()` (na sessão expirada só os três rascunhos voltam, presos à
  sigla), zera `VMC_EM_ANDAMENTO`, solta `VMC_ESPERANDO_FAIXA` e esconde faixa e loading, e devolve ao
  valor inicial: `PROF_SESSAO`, `PROF_PACIENTE_SEL`, `PROF_LINK_POR_SIGLA`, `PROF_CONVITE`, `graEstado`,
  `CAL_*`, `AUTO_STATE` (fica na sessão expirada) e `VMC_ULTIMA_SIGLA_PACIENTE`, caches
  (`descartarCachesPaciente_`), `P5_STATE`, `P8_STATE`, `ESC_STATE`, `ESC_TEXTOS`, `ESC_LIBERADOS`,
  `RR_RESPOSTAS_CACHE`, `ANAM_STATE`, `INI_STATE`, `P136_ESTADO`, `HIST_*`, `CHK_ENV.periodo`, `LOGIN_*`
  (`resetarTelaLogin_`), crachá e menu da barra; esvazia os contêineres com dado lido do servidor
  (`profDashboardConteudo`, `profPacienteConteudo`, `autoHistLista`, `pevConteudo`, `eschConteudo`,
  `anamConteudo`, `iniContinuidade`, `graDias`). Estado global novo por sessão = entrar nessa função.
  O paciente não tem variável `SESSAO`: a sessão dele é a chave `paciente` do `sessionStorage`.
- **Escala de camadas (`z-index`):**

| Camada | z-index |
|---|---|
| `.cal-col-head` (cabeçalho fixo da agenda) · `.p11-mhead` | 5 · 10 |
| `.pac-hamburger-dropdown` · `.barra-acao` (celular) · `.topbar` · `.p11-mov` | 90 · 95 · 100 · 100 |
| `.modal-overlay` (genérico) | 2000 |
| `.pev-modal-overlay` · aviso flutuante do profissional (inline) | 9999 |
| `.p5-modal-overlay` · `.folha-scrim` ("Sair sem enviar?") | 10000 |
| `.hist-modal-overlay` | 10001 |
| `.rr-submodal-overlay` ("Minhas respostas") | 10100 |
| **`.loading-overlay`** (18.3: era 1000) | **10200** |
| **`.erro-rede`** — faixa "Tentar de novo" (18.3: era 1001) | **10300** |

  Regra: loading e faixa de erro ficam acima de qualquer modal ou folha; modal novo usa até 10199.
- **SRI:** `chart.js@4.4.1/dist/chart.umd.min.js` (jsDelivr) com `integrity="sha384-…"` calculado do
  arquivo baixado (`openssl dgst -sha384 -binary | openssl base64 -A`, conferido em dois downloads) e
  `crossorigin="anonymous"`. Trocar a versão = recalcular o hash.
- **CSP (18.8):** `<meta http-equiv="Content-Security-Policy">` logo depois do `charset` em
  `index-dev.html`, `admin.html` e `privacidade.html` (o `index.html`, só redirecionamento desde 07/10/2026, tem a sua: nada além do script com hash); cada página lista só as origens que usa
  (`script.google.com` e `script.googleusercontent.com`, `viacep.com.br`, `cdn.jsdelivr.net`,
  `fonts.googleapis.com`, `fonts.gstatic.com`; `img-src 'self' data:` por causa dos ícones em `data:` do CSS).
  `'unsafe-inline'` fica (manipuladores inline); `'unsafe-eval'` não entra. **Origem nova de script, fonte,
  imagem ou `fetch` só funciona depois de entrar na CSP da página.** Links de navegação (`wa.me`, Correios)
  não dependem dela.
- **Barra sem código montado de texto (18.8):** `vmcAcaoDaBarra_(codigo)` executa `data-barra-voltar` e
  `data-barra-acao-onclick` por uma lista fechada de funções (formatos `nome()` e `nome('texto')`); função
  nova usada nesses atributos entra na lista.
- **Zoom:** viewport `width=device-width, initial-scale=1.0` (sem `maximum-scale` nem `user-scalable=no`).
- **Confirmação na tela:** `vmcAvisoOkNaTela(msg)` — o `autoAvisoEl` com `.auto-aviso-ok` (cor
  `--c-pos-ink`, ícone `i-check`, `role="status"`) no topo da tela ativa; `abrirSecao` remove. Usado na
  troca de senha do paciente (era `alert()`) e, desde o 18.4, na troca feita pelo profissional.

### Regressões visuais (Pacote 18.4 — publicado em 03/10/2026, só frontend)

- **Ícone fora do escape (8.48):** HTML do sprite nunca passa por `esc()`; só o dado passa. Chip de alerta
  da lista do profissional = `<svg #i-alert>` + `Alerta: <instrumento> · item <N> · <dd/mm/aaaa>`, em que só
  `a.instrumento`, o número do item e `a.data` passam por `esc()`. O número sai de `a.item` por uma regra
  única, `vmcNumeroDoItem_` (`PHQ9_item9` → 9, `DASS21_item21` → 21, `9` → 9; sem número, o trecho
  " · item N" some; sem data, " · data" some). DASS-21: o ícone de cada subescala (`subescalasMeta.icone`,
  constante do catálogo) entra cru em `.rr-sub-icone`.
- **Humor ausente (8.50):** `vmcHumorNivel_(v)` devolve 1–5 ou 0 — nunca 3. Com 0: cartão (Meus Registros e
  ficha do profissional) sem rosto e com a pílula "Sem registro de humor" (`vmcHumorPill_`); modal de leitura
  sem rosto, "Sem registro de humor"; edição sem rosto marcado, rótulo `.p136-humor-vazio` e
  `#p136HumorNivel` vazio — salvar sem escolher **não envia** `humor_nivel` (o servidor só grava as chaves
  recebidas). O gráfico do Painel ainda desenha humor ausente como 3 (fora do escopo; candidato).
  `humor_observacoes` aparece escapada abaixo do humor no modal de leitura (`.hist-modal-head-obs`), no
  cartão da checagem sem lupa (`.histc-obs`) e no campo "Observações" da edição.
- **Regra dos avisos (8.31):** erro vai para a própria tela com `vmcAvisoNaTela(msg, ancora?)` — o
  `autoAvisoEl` (`role=alert`) com `data-aviso-tela`, no topo da tela ativa ou logo antes de `ancora`
  (nas escalas, a barra `.esc-nav`); um por tela; `abrirSecao` remove; "Responda todas as questões" sai
  quando o botão destrava. "Sessão expirada" que já saía continua saindo: `sairDoSistema()` e depois
  `vmcAvisoNoLogin_(msg)` no `#loginError` (o envio da escala sem sessão, que não saía, mostra o aviso na
  tela). Mesmo texto do `alert()` antigo. Restam 10 `alert()`: anamnese 6 (18.6) e profissional 4 (18.5).
- **Seletor com valor do servidor (8.83):** valor interpolado em `querySelector` passa por `CSS.escape`
  (restauração da anamnese, antecedência da grade).

### Desempenho e integridade do backend (Pacote 18.10 — publicado em 03/10/2026, @34 = 18.10a e @35 = 18.10)

- **Memória por chamada (8.34).** `_MEMO_` (variável do módulo, zerada no início do `doPost` por
  `_memoZerar_(true)`): toda planilha é aberta por `_abrirPlanilha_(id)` — uma vez por chamada
  (Sistema_VMC, Controle, planilha do paciente); a Controle fica em `_MEMO_.controles`; o
  `Indice_Siglas` é lido uma vez (`_indiceValores_`, só dentro do `doPost`) e quem grava no índice
  chama `_memoEsquecerIndice_()`. Não existe mais `SpreadsheetApp.openById` fora de `_abrirPlanilha_`.
- **`genero` e `pedido_alteracao` (18.8.1).** Duas colunas aditivas na aba `Profissionais`, criadas pelo cabeçalho no
  primeiro uso. `genero`: `M`, `F` ou vazio (vazio = textos no masculino); só o próprio profissional grava, em
  "Meus dados" (`profSalvarMeusDados`); decide "Psicólogo/Psicóloga — CRP" (`_assinaturaDe_`), "Aqui é o/a" e
  "Área do Psicólogo/da Psicóloga". `pedido_alteracao`: JSON `{ campos: { nomeCompleto, email, telefone, crp }, em }`
  com o que o profissional pediu para mudar — o cadastro só muda quando o admin aprova (`admAprovarPedido`, que
  aplica por `atualizarProfissional`) e o pedido sai na aprovação ou na recusa (`admRecusarPedido`). Um pedido por
  vez. `listarProfissionais` devolve o pedido já lido (`pedido`), nunca a célula crua. A aba `Admins` não tem CRP
  nem gênero: o admin é o controlador do sistema.
- **Carimbo pelo cadastro (18.8.1).** O nome exibido em "Alterado por…", "Última alteração por…" e "Registrado
  por…" é o do cadastro na hora da leitura: `_nomesDoCarimbo_(sigla, profissionalId)` + `_carimbosDoCadastro_` em
  `lerHistorico`, `lerEscalas`, `lerDadosPaciente` e nas respostas de edição. O nome gravado em `autoria_campos` e
  em `criado_por_nome` é só reserva (cadastro ilegível); nada é regravado. Leitura nova que devolva carimbo passa
  pelas mesmas funções.
- **`controle_id` (8.34).** Coluna `controle_id` na aba `Profissionais` (criada pelo cabeçalho, texto).
  `abrirControleDoProfissional` abre por id; a busca por nome na pasta do Drive só roda com a coluna
  vazia ou com id que não abre, e grava o id encontrado (`_gravarControleId_`). Profissional novo já
  nasce com o id.
- **Indicadores do paciente na Controle (8.62).** Colunas na aba `Pacientes` da Controle, pelo
  cabeçalho (`COLUNAS_INDICADORES`): `ind_total_auto`, `ind_ultimo_auto` (JSON `{data, humor}`),
  `ind_total_escalas`, `ind_ultima_escala` (JSON `{nome, faixa, data}`), `ind_alertas_json` (JSON do
  alerta crítico mais recente; vazio = nenhum), `ind_nome` (nome da Anamnese, que a lista mostrava;
  vazio = nome do cadastro) e `ind_atualizado_em` (texto `aaaa-MM-dd HH:mm:ss`). Datas dentro do JSON
  já em `DD/MM/AAAA`. `_calcularIndicadores_(planilha)` usa as mesmas regras da lista do 13.2.3;
  `_indicadoresAposGravar_` roda em toda gravação do paciente (`salvarAnamnese`,
  `salvarAutomonitoramento`, `salvarEscala`, `pacienteAtualizarAnamnese`,
  `pacienteEditarAutomonitoramento`) e em toda edição pelo profissional (`profSalvarAnamnese`,
  `profEditarAutomonitoramento`), na mesma chamada e na mesma trava; se a atualização falhar,
  `ind_atualizado_em` é esvaziado. `listarPacientesDoProfissional` lê **só a Controle**; abre a
  planilha de um paciente apenas quando `ind_atualizado_em` está vazio (recálculo preguiçoso, uma vez).
  O contrato da resposta não mudou (ganhou `ind_total_escalas`). **Edição direta na planilha do
  paciente (fora do sistema) não atualiza os indicadores:** esvaziar `ind_atualizado_em` da linha
  força o recálculo na próxima lista. O mesmo vale depois de um rollback para versão anterior à @34.
- **Trava de gravação (8.45).** `_comTrava_(fn)`: `LockService.getScriptLock()` com `waitLock(10000)`,
  reentrante na mesma execução. O `doPost` roda dentro dela toda ação de `ACOES_COM_TRAVA` (todas as
  que gravam); `autenticar` (regravação v2 → v3) e `pedirRedefinicao` (cota e links) pegam a trava só
  no trecho que grava, por causa do piso de tempo; gravação acessória dentro de leitura
  (`controle_id`, recálculo preguiçoso) usa `_comTravaSeDer_` (sem a trava, só registra e segue).
  Sem a trava em 10 s: nada é gravado, resposta `{ok: false, codigo: 'ocupado', erro: MSG_OCUPADO}`
  ("Não foi possível gravar agora. Tente de novo.") e `console.error` no servidor. A trava de presença
  do registro (`editando_quem`/`editando_desde`) **não mudou** — será substituída no 18.5.
- **Identificador único do envio (8.14).** O cliente gera `id_envio` (UUID, `vmcNovoIdEnvio_`) a cada
  clique em "Enviar" (registro, escala, anamnese) e o manda dentro de `dados`; o "Tentar de novo" da
  faixa repete a mesma chamada, com o mesmo id. O servidor guarda `id_envio` na linha (coluna pelo
  cabeçalho, texto) e, se o id já existe na aba (`_linhaDoEnvio_`, lê só a coluna), responde
  `{ok: true, duplicado: true, registro}` sem gravar. Id fora do formato (letras, números e hífen, 8 a
  64) é descartado; cliente sem `id_envio` grava como antes.
- **Autoria pelo servidor (8.46).** `CAMPOS_DO_SERVIDOR` (`timestamp`, `versao_formulario`, `sigla`,
  `profissional_id`, `editado`, `editado_por`, `editado_em`, `editando_quem`, `editando_desde`): o
  que vier do cliente com esses nomes é descartado em todo caminho que grava (`_dadosDoCliente_` +
  `montarLinha`); `editado_por` sai do crachá. `versao_formulario` vem de uma constante por formulário:
  `VERSAO_FORM_ANAMNESE`, `VERSAO_FORM_AUTO`, `VERSAO_FORM_ESCALAS` (as três em `v1` em 03/10/2026;
  sobe a do formulário que mudar).
- **Assinatura dos e-mails.** `EMAIL_ASSINATURA` fixa saiu. Convite e redefinição do **paciente**:
  nome e CRP do profissional dono (`_assinaturaDoProfissional_`, colunas `nome_completo` e `crp` da aba
  `Profissionais`; sem CRP, só o nome). Convite de profissional: o admin que enviou. Redefinição de
  profissional e de admin: o primeiro admin ativo (`_assinaturaDoSistema_`). As linhas de formação
  (`EMAIL_FORMACAO`) continuam fixas. No WhatsApp, "Aqui é o <primeiro nome>" de quem está logado.
- **Rascunho no servidor (G2, 8.57 — 18.10b).** Aba `Rascunho` na planilha do paciente (cabeçalhos
  `tipo`, `atualizado_em`, `dados_json`), uma linha por tipo: `auto_negativo`, `auto_positivo`,
  `escala_<codigo>` (o código como o cliente usa, ex. `escala_PHQ-9`) e `anamnese`. Nasce no primeiro
  uso. Ações pelo crachá do paciente: `salvarRascunho {tipo, dados}` (regrava a linha do tipo; limite
  de 45 mil caracteres), `lerRascunhos` e `apagarRascunho {tipo}`. Toda gravação definitiva apaga o
  rascunho do tipo na mesma chamada (`_rascunhoEnviado_`). A aba fica **fora** de indicadores,
  histórico, varreduras e comparação de restauração (nenhum deles a lê); a cópia de backup leva o
  arquivo inteiro. **Rollback para a @33 não lê a aba: o dado fica nela, sem perda.**
  Cliente: `RASC_SERVIDOR`; todo "Sair" da folha "Sair sem enviar?" chama `rascSalvarNoServidor_`
  (a cópia do `sessionStorage` continua); o Início lê `lerRascunhos` em segundo plano e mostra
  `#iniRascunho` ("Você tem um registro começado em <dd/mm> às <hh:mm>. Continuar ou descartar?",
  botões "Continuar" e "Descartar") para o rascunho mais recente; "Continuar" grava o rascunho no
  aparelho e reabre o fluxo pelo caminho de cada módulo. Registro sem tipo escolhido e anamnese em
  edição de uma já enviada continuam só no aparelho.
- **Pisos de tempo remedidos** (mesmo método do 18.2.1, 20 execuções por caminho): `PISO_LOGIN_MS`
  3500 → **2750** e `PISO_REDEF_MS` 3750 → **3250** (tabela no comentário do código).

## Backup e monitoramento (Pacote E3 — ativado em 30/09/2026, ajustado em 01/10)

`backupSobDemanda_()` (invólucro público `rodarBackupAgora`) copia a
`Sistema_VMC`, cada Controle e cada planilha de paciente (profissionais
ativos ou não) para `Backups/AAAA-MM-DD/` (`DriveApp.makeCopy`), confere o
resultado contra uma expectativa derivada da Controle e registra uma linha
na aba `Backups` da `Sistema_VMC`. **Roda sob demanda, quando o Code
indica** (mudança com risco de perda) — nunca por gatilho. Guarda **as
últimas 5 cópias** (`pastasExcedentes`; a limpeza só roda com o dia fechado
limpo). Backup que falha nunca parece saudável: falha total lança exceção e
falha parcial manda e-mail ao dono.

`monitorarPing_()` (invólucro `rodarMonitorAgora`) chama o `ping` da
implantação de produção **1× ao dia** (gatilho único criado por
`instalarGatilhos()`, entre 7 h e 8 h, America/Sao_Paulo) e envia e-mail
**só em falha** (máximo 1 por hora). O `ping` devolve `url`
(`ScriptApp.getService().getUrl()`) e `hora_servidor`, prova necessária
para um staging por implantação (candidato E2-lite no status).

Manifesto (`appsscript.json`): os `oauthScopes` são **explícitos** — a
declaração substitui a inferência automática, então serviço novo no
`Código.js` exige acrescentar o escopo correspondente no mesmo pacote,
senão falha em execução. `executionApi: { access: "MYSELF" }` limita a API
de execução ao dono e **não** toca `webapp.access: ANYONE_ANONYMOUS`; é
seguro carregar para a produção no deploy do 18.1.

## Registro e edição pelo profissional (Pacote 18.5 — publicado em 03/10/2026, @36)

O profissional cria e edita registros de automonitoramento, escalas e anamnese de
qualquer paciente seu; o paciente continua editando os seus. Autorrelato e anotação
do terapeuta nunca se confundem: cada campo alterado carrega quem alterou e quando.

**Edição conjunta por campo (substitui a trava de presença, débito 8.47).** Toda
edição — paciente ou profissional; registro, escala, anamnese — manda ao servidor só
os campos alterados (`campos: {coluna: valor}`) e um `id_envio`. O servidor grava só
essas colunas (`_editarCampos_` → `_atualizarCamposLinha_`), nunca a linha inteira:
dois editores ao mesmo tempo não se bloqueiam; em campos diferentes os dois valores
ficam, no mesmo campo vale a última gravação. O servidor também compara cada valor
com o que já está na célula (`_mesmoValor_`, que conhece data, hora e número retipados
pelo Sheets): valor igual não é gravado nem carimbado — por isso um cliente antigo,
que ainda manda a linha toda em `dados`, grava só o que mudou de fato. O reenvio da
mesma edição ("Tentar de novo", mesmo `id_envio`) responde `duplicado: true` sem
gravar (`CacheService`, chave `edicao:<id>`, 6 h). `editando_quem` virou aviso na tela;
as funções `*MarcarEditandoAuto`, `*LimparEditandoAuto` e `lerEditandoAuto` não mudaram
e as colunas `editando_*` ficam (contrato vivo).

**Carimbo por campo.** Coluna `autoria_campos` nas abas Automonitoramento, Escalas e
Anamnese (criada pelo cabeçalho no primeiro uso; planilha nova já nasce com ela):
`{ "<coluna>": { "por": "paciente|profissional", "em": "aaaa-MM-dd HH:mm:ss" } }`,
atualizada só nas chaves alteradas; `por` sai do crachá, nunca do cliente
(`autoria_campos` e `criado_por` entraram em `CAMPOS_DO_SERVIDOR`). `editado_por` e
`editado_em` continuam dizendo quem mexeu por último na linha (as duas colunas passaram
a existir também em Escalas e Anamnese). Acima de 40.000 caracteres ficam os 200
campos alterados mais recentemente, com registro no log. Na tela, `vmcCarimboHtml_`
mostra o carimbo junto do campo, na leitura e na edição, só onde há carimbo — textos
aprovados em 03/10: para o paciente, "alterado pelo seu psicólogo em dd/mm às hh:mm"
e "alterado por você em …"; para o profissional, "alterado pelo paciente em …" e
"alterado por você em …". Limite conhecido: no formulário de 4 passos da anamnese do
paciente o carimbo aparece nos campos simples (`f_<coluna>`); nos grupos de marcação
ele aparece só na leitura.

**Criação pelo profissional.** `profCriarAutomonitoramento` e `profCriarEscala` recebem
o mesmo payload do paciente (`id_envio` obrigatório; reenvio = `duplicado`) e gravam
`criado_por = profissional` (coluna nova, pelo cabeçalho), `editado_por` e
`editado_em`; o rascunho do paciente não é tocado e os indicadores da lista são
atualizados na mesma chamada. Registro enviado pelo paciente fica com `criado_por`
vazio. O paciente vê no cartão "registrado pelo seu psicólogo em dd/mm"
(`vmcFaixaCriadoHtml_`); não há botão de apagar. No frontend não existe cópia de
formulário: "Novo registro" e "Nova escala" abrem as telas do paciente com
`PROF_FLUXO = { sigla }` — `carregarSessao()` devolve o paciente selecionado (o crachá
continua o do profissional), `profFluxoAdaptar_` troca o envio pela ação do profissional
e responde `lerHistorico`/`lerEscalas` com o que `profLerDadosPaciente` já trouxe, os
cadeados de primeira vez não valem, e `abrirSecao` devolve à tela do paciente qualquer
destino fora do fluxo (`profFluxoEncerrar_`). O rascunho no servidor continua só do
paciente.

**Escore das escalas no servidor.** `ESCALAS_CALCULO` (itens, valor máximo, itens
invertidos, subescalas, itens críticos, faixas — sem nenhum texto de item) foi gerada
do catálogo do frontend (`ESC_ESCALAS`) e `_escoresDaEscala_` repete as contas de
`escCalcularEscoreEAlerta`; a paridade é provada em Node com 400 respostas por
instrumento (os 7). Em `profCriarEscala` e `profEditarEscala` o escore, a faixa e o
alerta são sempre os do servidor (o que o cliente mandar nessas colunas é descartado);
na edição só os itens alterados levam carimbo e a linha resultante é validada antes de
gravar (resposta faltando ou fora da faixa recusa sem gravar). **Mudou o catálogo de
uma escala no frontend → regenerar a tabela e rodar o Node.** `salvarEscala` (paciente)
continua gravando o escore calculado no cliente, como antes.

**Leituras do paciente por colunas e paginadas (8.87).** `lerHistorico` e `lerEscalas`
devolvem os 60 registros mais recentes (`PAGINA_LEITURA`; teto 200), em ordem
cronológica, só com as colunas de `COLUNAS_LEITURA_AUTO` / `COLUNAS_LEITURA_ESCALAS`
(o que o cartão, a lupa, a edição e o Painel leem; ficam de fora `versao_formulario`,
`id_envio` e `editando_desde`). `antes` = quantos o cliente já tem: "Carregar mais"
(Meus Registros e histórico de escalas) pede a página anterior. A resposta traz
`total_registros`/`total`, `tem_mais` e, no histórico, `tem_negativo` (a regra de
primeira vez não pode depender do que coube na página); a anamnese vem só na primeira
página. O Painel e o gráfico da checagem buscam as páginas anteriores sozinhos quando
o período pedido vai além do que está carregado (`pevCompletar_`), e a ordinal da
escala ("esta é sua Nª aplicação") carrega todas antes de contar. Nessas duas ações o
`doPost` guarda em `_MEMO_.linhas` a linha do paciente e a do profissional dono — o
portão do crachá e a ação liam a mesma linha, cada um a sua leitura. A leitura do
profissional (`profLerDadosPaciente`) continua trazendo tudo.

**Lista do profissional.** `aceite_em` (DD/MM/AAAA, de `aceite_politica_em`; vazio quando
não há) aparece no cartão do paciente como "Aceite: …".

Conceituação cognitiva fica para o Módulo 3.

## Anamnese (Pacote 18.6 — publicado em 03/10/2026, @37)

**Montador único.** A linha da ficha (linha 2 da aba `Anamnese`) é montada num lugar só:
`salvarAnamnese`, no primeiro envio. Com a ficha já existente, o mesmo `salvarAnamnese`
vira edição por campo (`_editarAnamnesePorCampos_`: compara com a célula, grava só o que
mudou, carimba) — nunca cria segunda linha, e campo ausente do envio não apaga célula.
`id_envio` continua valendo para o reenvio (o do primeiro envio pela coluna; o dos
seguintes pelo `CacheService`). `pacienteAtualizarAnamnese(sigla, campos, idEnvio)` e
`profSalvarAnamnese(s, siglaPaciente, contato, campos, idEnvio)` só aceitam `campos`:
o caminho que regravava a linha inteira a partir de `dados` saiu, e payload sem `campos`
recebe "Dados da anamnese ausentes". Edição sem ficha enviada continua recusada.

**Histórico.** Aba `Anamnese_Historico` na planilha do paciente (`campo`, `valor_anterior`,
`por`, `em`), criada no primeiro uso por `_historicoDaAnamnese_`, chamada só por
`_editarAnamnesePorCampos_`, dentro da trava da ação. Uma linha por campo efetivamente
alterado; o valor anterior é o da célula lido antes de gravar (`_editarCampos_` devolve
`anteriores` e `em`), passa por `_celulaTexto_` (coluna `valor_anterior` é texto livre:
`0123`, `10/10` e `=1+1` ficam como estavam; data retipada pelo Sheets vira `aaaa-mm-dd`);
`por` sai do crachá e `em` é o mesmo instante do carimbo de `autoria_campos`, gravado como
texto. Nada mudou → nenhuma linha. Sem tela e sem ação de leitura; entra no backup por ser
aba da planilha do paciente.

**CEP.** Depois da busca no ViaCEP só fica travado o campo que a busca preencheu
(`anamCepTravar_`); o que veio vazio (CEP único de município: rua e bairro) fica aberto para
digitação, e a validação cobra a rua com o "Campo obrigatório" do próprio campo. A frase
"Não foi possível buscar o endereço. Tente outro CEP." ficou só para a falha real da busca
(campo ainda travado e vazio). Alterar o CEP (`onCepInput`) reabre os quatro campos e limpa
o que tinha vindo da busca anterior (travado = veio da busca); `ANAM_STATE.cepBuscado` e
`cepAbertos` guardam o CEP buscado e os campos que o paciente digita, para seguirem abertos
ao voltar ao passo. **Exterior:** a tela do paciente lê e envia na chave do cabeçalho,
`zip_code` (o id do campo no DOM continua `f_cep_exterior`); `cep_exterior` não existe em
nenhuma planilha (conferido nas 20 em 03/10) e deixou de existir no código.

**Avisos e carimbos.** Os 6 `alert()` da anamnese viraram aviso na tela
(`vmcAvisoNaTela` junto do bloco que falta; "Sessão expirada" no login, por
`vmcAvisoNoLogin_`) — não resta `alert()` real no `index-dev.html`. Na edição pelo paciente o
carimbo aparece também nos campos compostos (medicação, categorias de transtornos, sinais
de risco, condições clínicas), nas pessoas de confiança e nas perguntas de sim/não
(`anamCarimbosAplicar_`). `vmcFaixaCriadoHtml_` mostra "registrado por você em dd/mm" na
tela do profissional (lista de registros e histórico de escalas) e "registrado pelo seu
psicólogo em dd/mm" na do paciente.

**18.6.1 (@38) — carimbo com nome.** O carimbo de `autoria_campos` passou a ser
`{por, em, nome}`: `nome` é gravado pelo servidor (`_nomeDeQuemAltera_`: profissional =
`nome_completo` do cadastro; paciente = `ind_nome` — o nome da anamnese — ou o `nome` do
cadastro), nunca vem do cliente e guarda o nome da hora da alteração. A tela mostra
"Alterado por <Nome> em dd/mm/aaaa às hh:mm" (`vmcCarimboTexto_`), o mesmo texto para
paciente e profissional; carimbo sem nome mostra só a data. Visual: `--t-carimbo` (12 px,
peso 400) e `--c-ink-carimbo` (5,0:1), decisão do usuário ("menor e mais claro, para não
poluir"); o seletor `.review-row span.vmc-carimbo` existe para vencer `.review-row span`,
que dava ao carimbo a cor do valor. A leitura da anamnese não tem mais os textos
"fale diretamente com seu terapeuta" e "Visualização somente leitura".

**18.6.2 (@39) — "Registrado por" e última alteração.** Registro e escala criados pelo
profissional guardam `criado_por_nome` (coluna nova em Automonitoramento e Escalas, gravada
por `_autoriaDeCriacao_(profissionalId)`; em `CAMPOS_DO_SERVIDOR` e nas `COLUNAS_LEITURA_*`);
`vmcFaixaCriadoHtml_` mostra "Registrado por <Nome> em dd/mm/aaaa às hh:mm" (data e hora do
`timestamp` da linha), igual nas duas telas; sem nome, só a data. A faixa do topo da leitura
da anamnese mostra "Última alteração por <Nome> em …" (`vmcUltimaAlteracaoTexto_`: o carimbo
mais recente de `autoria_campos`; vazio quando não há carimbo).

## Velocidade do profissional (Pacote 18.11 — publicado em 04/10/2026, @40)

Medição que guiou o pacote (conta real do profissional, só leitura, uma execução por amostra):
toda ida ao Apps Script custa **1,1–1,8 s só de caminho** (`ping`, que não faz nada no servidor),
e por cima disso vinha o trabalho do servidor — portão do crachá 0,5 s, lista 1,3 s, abrir paciente
2,2 s. O conserto ataca os dois lados: menos trabalho por chamada e menos chamadas.

**Portão do crachá em cache (`_validarToken_`).** A ordem não mudou: assinatura e validade do crachá
primeiro (`lerToken`), sempre. Depois, em vez de abrir a `Sistema_VMC` em toda chamada, o portão lê
do cache do script (`CacheService`) a chave `portao:<perfil>:<SIGLA>:<dono>`, que guarda a impressão
da credencial (`impressaoCracha`, a mesma que já vai dentro do crachá — nunca o hash), o nome e o
e-mail da conta. Só passa pelo cache o crachá cuja impressão é igual à guardada; qualquer outro vai
à planilha, como antes. Só entra no cache conta que a planilha acabou de aprovar (ativa, e com o
profissional dono ativo, no caso do paciente); recusa nunca é guardada. Validade: `PORTAO_CACHE_SEG`
= 300 s, sem renovação — a cada 5 min uma chamada confere na planilha de novo.

**Invalidação imediata (`_portaoEsquecer_`).** Toda ação do sistema que muda senha, e-mail, nome,
`ativo` ou exclui uma conta solta a chave depois de gravar (com `SpreadsheetApp.flush()` antes):
`_gravarHashDaConta_` (ativação, redefinição, troca pelo próprio paciente, regravação v2→v3),
`profAlterarSenhaPaciente`, `trocarSenhaProfissional`, `_gravarEmailIndice_`,
`_atualizarContatoPaciente_`, `atualizarProfissional`, `_alterarStatusPacienteControle_`,
`_alterarStatusProfissional` (o profissional **e todos os pacientes dele**,
`_portaoEsquecerProfissional_`), `profExcluirPaciente` (portão, dono e planilha) e `_anexarIndice_`
(conta nova). O atraso de até 5 min só existe para edição feita direto na planilha. **Regra para
pacote futuro: ação nova que mude senha, e-mail, `ativo` ou exclua conta chama `_portaoEsquecer_`.**

**O que mais mora no cache (fatos que não mudam, nunca estado de acesso):** `dono:<SIGLA>` (o
profissional dono do paciente, lido do `Indice_Siglas`; 5 min; `resolverProfissionalIdPorSigla`),
`controle:<profissional_id>` (id da Controle; 6 h; `abrirControleDoProfissional` confere que o id
abre e tem a aba `Pacientes`) e `planilha:<SIGLA>` (id da planilha do paciente; 6 h;
`_obterPlanilhaIdPaciente_`). O cache nunca é a fonte: sem a chave, ou com o `CacheService` fora do
ar, a planilha é lida como antes (`_cacheLer_`, `_cacheLerVarias_`, `_cacheGuardar_`,
`_cacheEsquecer_`; uma leitura de cada chave por chamada, em `_MEMO_.cache`). O isolamento entre
profissionais continua igual: o dono vem do Índice e é comparado com o profissional do crachá em
cada função. O segredo do crachá e a pimenta **não** vão para o cache.

**Login.** `autenticar` lê o Índice por `_indiceValores_` (sem conferir colunas), deixa o portão em
cache ao emitir o crachá e, para o profissional, devolve `pacientes` (a mesma lista de
`profListarPacientes`) na própria resposta — a tela não faz a segunda chamada. Pisos de tempo,
iterações do hash e validade do crachá não mudaram; a falha continua igual e não traz lista.

**Leituras.** `ACOES_SO_LEITURA` liga a memória de linhas (`_MEMO_.linhas`) nas leituras do
profissional e do admin (a linha do profissional era lida duas vezes por chamada); `lerEditandoAuto`
virou uma leitura só da aba, sem `_garantirColunasAutomonitoramento_`. `profLerDadosPaciente`
**não** foi paginada: 74 registros + 61 escalas custam ~0,25 s por aba — o peso era abrir planilhas.

**Tela do profissional.** `PROF_PACIENTES_MEM[sigla]` guarda a resposta de `profLerDadosPaciente`
por sessão: voltar a um paciente já aberto desenha a tela na hora (`profRenderPaciente_`) e confere
o servidor sem overlay (`profConferirPaciente_`); se algo mudou, a tela é refeita mantendo os
módulos abertos — menos com modal, fluxo ou editor de anamnese abertos (a memória fica com o dado
novo para a próxima abertura). Toda gravação do profissional esvazia a memória do paciente
(`chamarServidor`), e a saída esvazia tudo. `profLerGrade_` pede a grade uma vez por sessão para a
Agenda e a Grade de Atendimento; salvar a grade pede de novo.

**Admin (`admin.html`).** `admChamarServidor` com limite de 60 s e a faixa "O servidor não
respondeu…" + "Tentar de novo" (mesma chamada, só no clique; sair desiste); botões da tabela por
`data-adm-acao` com um ouvinte só; data de início normalizada para o campo e enviada só quando
mexida; a saída limpa a tabela, o cabeçalho e os modais.
