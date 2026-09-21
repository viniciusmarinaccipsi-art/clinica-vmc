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
  registro usa `--c-reg-neg*` / `--c-reg-pos*`. Fontes: `--f-title`
  (Newsreader 400–700) e `--f-text` (Figtree). Sombras `--sh-1/2/3/bar`.
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
- **Cabeçalho cumulativo compacto (`.p11-header`, Pacote 16.3):**
  `p11aRenderizarCabecalho` só resume o que já foi preenchido — linha
  `.p11-linha` com "Humor 😐 · N etapas preenchidas", botão "+N" que abre o
  modal existente e chevron `.p11-abrir` que expande a trilha `.p11-det`
  (`p11aToggleDetalhes`). Sem etapa preenchida, não aparece. A navegação
  entre etapas é do componente de progresso, não dele.
- **Título nunca duplicado:** quando o título do card repete o da barra, o
  card fica só com ícone + subtítulo (o asterisco de obrigatório vai para
  `.auto-sec-sub .req`).
- **Progresso único (`#prog`, Pacote 16.3):** `progressoDefinir({ total,
  atual, nome, rotulo, cor, feitos, nomes, irPara })` escreve "Etapa N de T ·
  nome" (`#progTxt`) e o trilho (`#progTrilho`): etapas feitas são
  `<button class="prog-seg feito">` (44 px de altura, largura do segmento) que
  chamam `progressoIr(i)` → `irPara(i)`; `progressoOcultar()` esconde.
  `abrirSecao()` chama `progressoParaTela(id)`, que usa `PROG_REGISTRO_TELAS`
  (humor, tipo, 5 etapas, revisão = 8; nos hubs, atual = próxima etapa não
  preenchida em `AUTO_STATE.preenchido`) e esconde nas telas sem fluxo. A
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
  usam máscara (`--ico-lock/-check/-check-square/-alert`). Só as 5 faces da
  escala de humor continuam emoji. Mapa emoji → símbolo em
  `docs/design/icones.md`.
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
