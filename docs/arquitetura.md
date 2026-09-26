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
desfaça o efeito colateral. Ex: modal `📋 +N` reusa `autoAbrirResumo()`.

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
  quando recebe um id físico (caminho do `p11aAbrirModal`).
- Coleta (`autoColetarDadosDaSecao`), validação (`autoValidarSecao`),
  `autoTemConteudoNaSecao`, `AUTO_SEC_MAP`, `AUTO_SEQ_*`, `autoFinalizarTipo`,
  `autoAbrirResumo` e o rascunho continuam trabalhando pelos ids lógicos: cada
  `getElementById('sec-auto-emo-a')` devolve o bloco, que contém exatamente os
  campos e grupos de antes. Payload, chaves de coluna, `AUTO_SEPARADOR`,
  `data-grupo`/`data-item`/`data-tem-likert` e `versao_formulario` não mudam
  (prova: payloads iguais campo a campo antes e depois, relatório do 16.5d-1).
- Um registro pode levar Negativo **e** Positivo (os dois blocos existem sempre
  no DOM); por isso a coleta final percorre os 10 ids lógicos, como antes.
- O cabeçalho cumulativo (`#p11aHdr-{etapa}-a`) vive na seção física e só é
  renderizado no Negativo (`P11A_NEG_SECOES`).

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
  (`chkMostrarCampos`); caixa descritiva (`HUMOR_DESC`, textos do catálogo);
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
  outra checagem.
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
  lido do `data-barra-titulo` do bloco) e passa `soTrilho:true` a `progressoDefinir`, que esconde
  `#progTxt`: o trilho é só indicador (feito = `reg`, atual = `-mid`, a fazer = `-tint`). Os blocos
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
- **Cabeçalho cumulativo (`cab*`):** `#cabHdr-{etapa}` na seção física, renderizado por
  `cabRenderizar(idLógico)` no hook de `abrirSecao` para os dois tipos: linha HUMOR (rostinho +
  `HUMOR_NOMES`) e, por etapa já preenchida (exceto a atual), ícone, rótulo, itens com a nota em
  `<b>` e a frase em `<i>` (2 linhas, `-webkit-line-clamp`); "editar" volta à última etapa feita e
  "ver tudo" abre o modal existente (`p11aAbrirModal`). **Só lê `AUTO_STATE.dados`** — mantido atual
  por `autoColetarSecaoAtiva()` nos listeners de `change`/`input` — e nunca escreve nele: fecha o
  débito 8.21 (o cabeçalho antigo coletava as 5 seções a cada render). `P11A_NEG_SECOES` e as
  funções `p11a*` de render saíram; ficam só o modal e seu casco `.p11-m*`.
- **RodapéEtapa:** `.auto-rodape.barra-acao` com `.auto-rodape-cont` (textos nos atributos
  `data-cont-0/1/n` do próprio rodapé; `autoRodapeAtualizar(bloco)`), "‹" 56 px
  (`aria-label="Etapa anterior"`; "Voltar" na etapa 1) e o primário com o nome da próxima etapa ou
  "Concluir e Revisar". A Situação do Positivo não tem contagem (contrato v3, item 23).
- **Obrigatório na tela (D9):** `autoValidarSecao` devolve `{ ok:false, msg, campo|itens|grupos }` e
  `autoExibirAviso` põe a frase de sempre (`.auto-aviso[role=alert]`, `i-alert`, `--c-risk-ink`) sob o
  campo (`aria-invalid` + borda de risco), sob a barra do item sem nota (`.auto-item-likert.erro`,
  rótulo em risco; abre o grupo) ou após o bloco de grupos, e rola até o primeiro aviso;
  `autoLimparAvisos` a cada mudança. `autoAvancarSequencial` e `autoFinalizarTipo` não usam mais
  `alert()`.
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
| `p5*`, `p8*`, `p9*`, `p10*`, `p11*`, `p11a*` | Pacotes 5–11.6 |
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
- **Cabeçalho cumulativo (`.cab`, Pacote 16.5d-2):** substituiu o
  `.p11-header` do 16.3 — ver "Registro: interior das 5 etapas". Cartão em
  tinte do tipo, sempre visível (HUMOR na etapa 1), só leitura de
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
  sem fluxo; desde o 16.5d-2 passa `soTrilho:true` (o título "Etapa N de 5 ·
  nome completo" vai para a barra) e o segmento atual usa `--c-reg-*-mid`. A
  anamnese define o próprio em `renderPasso`/`renderRevisao`
  (`ANAM_PASSOS_NOMES`, 5 = 4 passos + revisão, volta por
  `anamIrParaPasso(k)`); a escala em `escAtualizarProgresso` (item atual =
  próximo não respondido; tocar rola até `#escItemBox-<id>`). Cor `--c-pos`;
  `.prog.neg` / `.prog.pos-reg` nas etapas do registro. Substituiu pontos da
  anamnese, pontos do humor, barra gamificada, selo "Preenchido", tabs do
  cabeçalho cumulativo e barra percentual das escalas.
- **Barra de ação (`.barra-acao`, Pacote 16.3):** classe no contêiner dos
  botões de navegação já existentes (`.auto-nav-duplo`, `.anam-nav`,
  `.esc-nav`). Em ≤ 600 px vira fixa no rodapé (`--sh-bar`, 64 px +
  `env(safe-area-inset-bottom)`; "Anterior" em contorno com 38 %, primário à
  direita) e `body:has(.section.active .barra-acao) .app` ganha
  `padding-bottom`; no desktop fica no fim do card. `@keyframes fadeIn` das
  seções é só opacidade (um `transform` na seção deslocaria a barra fixa).
- **Sair sem gravar (Pacote 16.3):** `confirmarSaida(acao)` abre `#sairModal`
  (padrão `.p5-modal-*`) quando `fluxoEmAndamento()` — anamnese com rascunho
  fora do modo consulta, registro com dados ou etapa preenchida, escala com
  resposta — depois de `fluxoGuardarRascunho()`. Pontos cobertos: voltar da
  barra quando `destinoForaDoFluxo(codigo, idAtual)` (etapa → hub não pede),
  sair (⏻ → `confirmarSaida(logout)`), Cancelar da escala
  (`confirmarSaida(escCancelarAplicacao)`, sem `confirm()` nativo).
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
- **`chamarServidor` (Pacotes 16.2.1–16.2.2):** `_chamarUmaVez_` com
  `AbortController` (`VMC_TIMEOUT_MS` = 20 s; falha = timeout, rede, HTTP fora
  de 2xx ou corpo não-JSON); repetição automática uma vez após `VMC_RETRY_MS`
  (2 s) **só** para ações fora de `VMC_ACOES_GRAVACAO` (as 23 do `doPost` que
  gravam, editam, excluem ou travam registro — conferir por grep no
  `Código.js` ao criar ação nova); na falha final, `_aguardarTentarDeNovo_`
  mostra a faixa `#vmcErroRede` ("O servidor não respondeu…") e a promessa só
  resolve com a resposta real, preservando o contrato de quem chamou. A
  consulta de CEP (ViaCEP) é o único `fetch` fora do wrapper.
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
