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
`reverso`, `multiSubescalas`, `criticoLimiar`, `dicotomica`, `naoPontua`,
`condicional` (17.1). Escala nova = entrada no dicionário `ESC_ESCALAS`
(+ branch se necessário) e a entrada gêmea em `ESCALAS_CALCULO` no
`Código.js` (o gabarito `teste_escores.js` e a seção S de `backend_18_5.js`
conferem os dois lados). Nunca reescrever o motor.

**Subescalas genéricas (17.2, URICA):** nada no motor cita o DASS-21 pelo
nome. Propriedades da escala: `multSub` (multiplicador de cada soma; DASS-21
= 2), `subescalasMeta[k] = { sigla, nome, icone, corPrefix, tri? }` (a ordem
das chaves é a ordem de cálculo, de gravação e de tela — a mesma de `sub`
no servidor), `faixasSubescalas` opcional (sem ela, o box mostra a média),
`composto = { chave, sigla, nome, legenda, mais, menos, casas }` (escore
derivado das **médias** das subescalas, gravado em `escore_<chave>`),
`eduGeralDesc` (texto geral no lugar do texto por faixa). Servidor: `min`
(menor valor da resposta; URICA = 1), `multSub`, `siglaSub`, `faixasSub`
opcional, `composto`. Colunas gravadas: `escore_<subescala>` para cada chave
(as três do DASS-21 existem sempre), `escore_<composto>`, e `faixa` com o
resumo textual (`Dep:Leve | Ans:Normal | Est:Normal`; `PC:14 | C:22 | A:19
| M:17 | Prontidão: 7,3`) — montado por `escCamposSubescalas_` no cliente e
por `_escoresDaEscala_` no servidor, com o mesmo formato. `salvarEscala`
garante as colunas de `HEADERS_ESCALAS` (item_22..item_24 e as novas) na
planilha do paciente antes de gravar. Âncoras vindas da aba
(`ancora_rotulo`) são lidas em ordem numérica, qualquer faixa (BAI 0–3,
URICA 1–5). A linha do histórico esconde o escore (`escoreOculto`) **antes**
de desenhar subescalas.

**Escala simples com âncoras na aba (17.3, lote A da HumanTrack):** PCL-5,
PSWQ, EAR, AAQ-II, SWLS, MAAS e WBSI são escalas de escore único cujos
itens, instrução e âncoras vivem em `Itens_Instrumentos` (1 `instrucao` +
n `item` + k `ancora_rotulo`, códigos numéricos lidos em ordem). Propriedades
novas do catálogo: `valorMin`/`valorMax` (espelho de `min`/`max` em
`ESCALAS_CALCULO`; sem `opcoes`, o cliente inverte item reverso com
`valorMin + valorMax − bruto`, a mesma conta do servidor) e `mediaPor`
(MAAS = 15: o cabeçalho do resultado mostra "média x,x" ao lado do total;
grava-se só o total). Faixas (`faixas` + `faixasLista`) só onde há fonte
publicada (PCL-5, PSWQ, SWLS); as demais entram sem `faixas`, com a nota e
a direção em `faixasLista`. Todas `soProfissional` e `escoreOculto`; três
pares de cor por família (`trauma`, `bemestar`, `processo`). Carga e
liberação parciais pela tabela genérica `GRADES_SIMPLES` de
`gerar_modelo_itens_17_0.py` / `carga_itens_17_0.py`.

**Liberação universal e molde único das escalas (17.3.1):** toda escala do
catálogo é por liberação do profissional, paciente a paciente: `ESCALAS_MENU`
(servidor) mapeia o código do catálogo ao id de `escalas_liberadas`
(Controle); `INSTRUMENTOS_SO_PROFISSIONAL` são os 20 ids; o cliente
esconde os 20 cartões do menu até `lerItensInstrumento` (sem instrumento)
devolver os liberados — ids do 12.x entram direto, ids da aba só quando a
aba os libera. O cadeado fica dentro do cartão de cada escala na tela do
profissional (`profRenderizarEscalas_` desenha as 20, com ou sem aplicação;
`profCadeadoHtml_` / `profLiberarEscala_`); `profCriarEscala` abre a escala
que o profissional aplicou (`_abrirEscalaParaPaciente_`) e devolve a lista.
Molde do paciente: cartão com `.esc-card-desc` + 3 fichas (itens · tempo ·
recorte), subtítulo "N itens · X a Y minutos · Pensando em …", grade de
opções do 12.x para âncoras da aba (só `opcoesPorItem` empilha), resultado
com escore, faixa, "O que isso significa?" (`descricao`/`sugestao` por
faixa ou `eduGeral*`) e "Sobre a faixa"; `escoreOculto` só na BSS. A
migração única `rodarMigracaoLiberacoes` (20/11/2026, removida depois)
abriu para cada paciente as escalas que ele já tinha respondido.

**Nome original, ficha e tags (17.3.2 piloto em PHQ-9, BDI-II, BSS, AAQ-II,
PCL-5; 17.4 nas outras 15 — as 20 desde 20/11/2026; o menu do paciente é
HTML estático: mudança de nome passa pelo catálogo e pelos cartões):** `nomeCompleto` = nome original em inglês +
(SIGLA) e `nomeTraducao` = tradução em letra menor, mostrada por
`escNomeTraducaoHtml_` nos cinco lugares do nome (cartão do menu, cabeçalho
do preenchimento, resultado, histórico, cartão do profissional). A grade de
opções é `display:grid` com `data-n` colunas (nº de opções do item; celular =
2; `opcoesPorItem` empilha; dicotômica = 2). `ESC_ESCALAS[cod].ficha` guarda
a ficha da escala — `tags`, `descricao`, `tempo`, `populacao`, `usos`,
`interpretacao[]`, `desenvolvedores`, `validacaoBr`, `referencias[]` — como
HTML simples, conteúdo original escrito a partir das publicações e aprovado
pelo usuário (nunca copiado de outra plataforma); `fichaAbrir_` monta o modal
`#fichaModal` com as abas Informações (da ficha), Escalas (gerada do catálogo)
e Questões (itens e opções pela mesma leitura da aplicação; nada da aba entra
no repositório). A busca do profissional (`profBuscaHtml_`,
`profFiltrarEscalas_`) filtra cartões e lista "Nova escala" por sigla, nome,
tradução e chips de tag (união das `ficha.tags`). **Molde de inserção:** escala
nova entra com `nomeTraducao`, `ficha` (com validação brasileira e
referências) e `tags`. A lupa "Minhas respostas" carrega os textos da aba
antes de montar a lista (`rrGarantirTextos_`) e mostra o rótulo da opção.

**Lote B e motor de subescalas (17.5, 20/11/2026):** 25 escalas. Além de `sub`/`multi`/`multSub`/`composto`
(17.2), `ESCALAS_CALCULO` (servidor) e `ESC_ESCALAS` (cliente) aceitam `subMedia: <casas>` (a subescala é a
média dos itens, arredondada — SCS), `composto.dividir` (média das médias — SCS: total de 1 a 5) e `faixas` numa
escala `multi` (OCI-R: a faixa do total entra como `Total:…` antes das subescalas no resumo gravado em `faixa`).
Decimais no resumo com vírgula nos dois lados. Colunas por subescala (`escore_<chave>`) e `item_25`/`item_26`
são aditivas (`_garantirColunas_`). Escala nova de escore simples ou com subescalas entra pelo mesmo caminho do
lote A: `ESCALAS_SIMPLES` nos dois scripts Python (modelo + carga), `INSTRUMENTOS_VALIDOS` + `ESCALAS_MENU` +
`ESCALAS_CALCULO` no servidor, catálogo + cartão estático + `ESC_CARTOES_POR_INSTRUMENTO` + `ESC_HIST_ORDEM` no
cliente, casos no gabarito e listas das suítes (20 → 25).

**Lotes E e F — dependências e compulsões (17.6 e 17.7, 21–22/11/2026):** 35 escalas, todas com ficha. Três acréscimos ao motor, sempre por propriedade do catálogo e espelhados em `ESCALAS_CALCULO` (nenhuma escala é citada pelo nome no cálculo — lição 118):
- **Opções por item fora do BDI-II** (`opcoesPorItem: true` em AUDIT, FTND, G-SAS e DUDIT): cada item tem as suas opções e o **código da opção é o peso** (AUDIT 9/10 e DUDIT 10/11 valem 0, 2 ou 4; FTND com itens de 2 ou 4 opções). Na carga, essas escalas ficam na tabela `ESCALAS_POR_ITEM` de `gerar_modelo_itens_17_0.py` e `carga_itens_17_0.py` (linhas `item` + `opcao`); as demais continuam em `ESCALAS_SIMPLES`. O servidor ordena as opções pelo código.
- **`composto.mediaItens`** (17.6): o composto é a média dos itens pontuados — EAAD e ESTUD (média por subescala com `subMedia` e média geral dos 24 itens, de 1 a 5).
- **`composto.somaItens`** (17.7): o composto é a soma dos itens — EPM (dois fatores por soma + total 20–100) e SAS-LV (cinco fatores pela média + total 33–198).
Escala só de total e sem corte validado (PIUQ-SF-9) segue o molde da MAAS: total, "Como ler" e lista de faixas sem corte; percentis, quando há fonte, vão na ficha. Colunas novas, todas aditivas por `_garantirColunas_`: no 17.6, sete `escore_*` (subescalas e média geral da EAAD/ESTUD, fatores da FTND); no 17.7, `escore_cognitivos`, `escore_comportamentais`, `escore_total_processos`, `escore_perturbacao`, `escore_antecipacao`, `escore_abstinencia`, `escore_ciberespaco`, `escore_uso_excessivo` e `escore_total_sas`. O modelo `docs/escalas/itens_instrumentos_modelo.xlsx` tem 994 posições; o gabarito `scripts/testes/teste_escores.js` cobre os dois lados (397 casos no fechamento do 17.7). Listas que crescem a cada lote: `INSTRUMENTOS_VALIDOS`, `ESCALAS_MENU` (35 códigos → ids) e `ESCALAS_CALCULO` no servidor; catálogo `ESC_ESCALAS`, cartão estático do menu, `ESC_CARTOES_POR_INSTRUMENTO` e `ESC_HIST_ORDEM` no cliente; `backend_17_1_2.js` confere a contagem de ids. **Método, ordem das fontes e scripts-molde** de um lote novo ficam fora do repositório: `..\VMC-offline\METODO_INSERCAO_ESCALAS.md` e `..\scripts_escalas\`. **Ainda sem molde:** ASSIST (matriz de 10 substâncias × 7 perguntas, com saltos — exige extensão do motor e do carregador) e CORE-OM (escore clínico = média × 10, uma linha nova nos dois motores).

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
- **(Substituído no 13.7 — ver "Edição do registro pelo fluxo", no fim.)** **Edição em Meus Registros (16.5e, débitos 8.24/8.26/8.27c):** `p136RenderGrupo_` monta a linha
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
  falham), `font-size` < 13 px, emoji, marcadores, `fetch(` ≤ 3 (chamarServidor, ViaCEP e a conferência de versão da página, 17.1.3), texto
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
  remetente "COGNIATIVO", em HTML com texto puro de reserva. O texto puro tem a linha
  de destaque (nome + subtítulo) no topo, um único link `index-dev.html?ativar=<token>`
  e a assinatura do profissional no fim. **Desde o Pacote 16.11 o HTML segue o layout
  aprovado no Design** (entrega `marca_email` de 10/10/2026, em
  `Meu Drive\clinica-vmc\design_cogniativo\entrega\`): `_layoutEmail_` monta tabelas com
  estilo inline (600 px no máximo, bom a 375 px), logo embutido como `cid:logo`
  (`_enviarEmail_` passa `inlineImages` com o PNG de `EMAIL_LOGO_PNG_B64`, gerado de
  `docs/design/marca/logo-email.png`; sem a imagem o e-mail sai assim mesmo), título,
  pílula lavanda "Acompanhamento com:" (só quando há), saudação, parágrafo, botão
  (`EMAIL_HTML`: "Criar minha senha" / "Criar senha nova"), o endereço em texto
  (`EMAIL_LINK_RESERVA`), aviso, assinatura e, fora do cartão, o subtítulo e
  `EMAIL_RODAPE`; todo texto passa por `_escHtml_`, o único escapador de HTML do
  backend. Textos de corpo, saudação, aviso e assunto são os mesmos do texto puro;
  `enviarEmailsDeExemplo()` (fora do `doPost`, via `clasp run`) manda um convite e uma
  redefinição de exemplo só ao dono do script; a tela "Crie sua senha" chama
  `definirSenha(token, senha)`, que grava o hash e marca o token como usado;
  o cliente apaga o token da URL com `history.replaceState`.
- **Contato do paciente (decisão de 30/09):** o cadastro (Controle: `email`,
  `telefone`, só dígitos) é a única fonte; as colunas `email` e `telefone` da
  aba Anamnese permanecem (dados reais) e são espelhadas pelo servidor a cada
  gravação da anamnese, ignorando o que o cliente mandar nessas chaves; o
  formulário de anamnese não pergunta; o editor do profissional pré-carrega
  os campos de cadastro com os valores da anamnese quando a Controle está
  vazia, e `_atualizarContatoPaciente_` grava a Controle por nome de cabeçalho.
- **Marca (COGNIATIVO; logo desde o Pacote 16.10):** símbolo "C de terminais
  redondos + ponto" (entrega do Design de 10/10/2026, originais limpos em
  `docs/design/marca/`; ícones da aba e de atalho em `marca/`, ligados no
  `<head>` das três páginas). Duas tintas: o C em `--c-action` (no quadrado
  lavanda, `--c-marca-quadro`) e o ponto sempre um tom mais claro
  (`--c-marca-ponto`); no `index-dev.html` é o símbolo `#i-marca` do sprite.
  Na marca gráfica o nome vai em minúsculas, "cogniativo" (Figtree 600); os
  textos de tela e títulos seguem "COGNIATIVO". Barra: símbolo 17 px sem
  quadrado + nome 18 px, **sem a frase**; login empilhado (prancha 6B):
  quadrado lavanda 56 px, nome 26 px e a frase "pensar, registrar,
  transformar" (13 px) embaixo — a frase só aparece no login e no e-mail
  (decisão do usuário de 10/10); privacidade: símbolo 20 px + nome; admin:
  símbolo 24 px ao lado do título, cores fixas da marca. Subtítulo oficial "Psicoterapia para além das sessões, com intervenções cognitivo-comportamentais no dia a dia." em letra miúda (piso de 13 px) no rodapé do login e nos
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
  (`EMAIL_FORMACAO`) saíram no 18.8.1: a assinatura é só o nome e, havendo CRP, "Psicólogo/Psicóloga — CRP". No WhatsApp, "Aqui é o <primeiro nome>" de quem está logado.
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
falha parcial manda e-mail ao dono (remetente e assunto "COGNIATIVO - …", texto com acentos desde o 16.11; continua em texto puro).

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

## Início do profissional como dashboard e tela Pacientes (Pacote 19.2 — publicado em 22/11/2026, só frontend)

Primeiro pacote da Fase 19 — Área do profissional. Nenhuma ação nova no servidor e nenhuma chamada
nova: tudo sai da lista de pacientes que já vem na resposta do login (indicadores `ind_*` da
Controle, 18.10/18.11).

**Duas telas, uma lista em memória.** `profCarregarDashboard` continua carregando (lista do login
ou `profListarPacientes`, erro com "Tentar novamente", pré-carregamento do 18.11.1) e guarda a
lista em `PROF_LISTA` (só memória; `sairDoSistema` zera). Dela saem:

- **Início (`#profDashboardConteudo`)** — nesta ordem: `.prof-atalhos` (quatro `.prof-atalho`:
  Novo Paciente, Agenda, Pacientes, Escalas e Inventários — este `disabled`, com `#i-lock` e o selo
  "Em breve", até o 19.3); `#profBlocoAlertas` (`profRenderAlertas_`: o alerta crítico mais recente
  de cada paciente ativo, `ind_alertas[0]`; não expira); `#profBlocoAtualizacoes`
  (`profRenderAtualizacoes_`: último registro e última escala de cada paciente ativo, só os dos
  últimos `PROF_ATUALIZACOES_DIAS` = 7 dias). Sem paciente nenhum: atalhos + "Nenhum paciente
  cadastrado".
- **Pacientes (`#sec-prof-pacientes`, `#profPacientesConteudo`)** — `profRenderPacientes_`: os
  cartões e a seção de desativados do 13.2.2/13.5, sem mudança (o roteiro prova HTML igual, cartão
  a cartão), mais a busca (`.esc-busca*`, `profFiltrarPacientes_`).

**Regras.** Os blocos do Início mostram só pacientes ativos. A lista traz datas `DD/MM/AAAA` sem
hora: a ordem é data mais nova primeiro e, no mesmo dia, nome (`localeCompare` pt-BR), com registro
antes de escala. Dias contados por data civil — `profDiasDesdeBR_` só converte para o formato de
`iniDiasDesde`, e o texto é o de `iniTextoDias` ("hoje", "há N dias"). A lista não distingue
registro completo de checagem de humor: o item diz "Automonitoramento". Cada item
(`profEvHtml_`, `.prof-ev`) leva `data-sigla` e chama `profAbrirPaciente(this.dataset.sigla)`;
nome, sigla, instrumento e faixa passam pelo escapador único.

**Busca DOM-first.** `profFiltrarPacientes_` lê nome e sigla dos cartões que estão na tela
(`.prof-pac-nome` + `data-sigla`), normaliza com `profNormalizar_` (o da busca das escalas) e
alterna `.hidden`; resultado entre os desativados abre a seção deles (`p135ToggleInativos`).

**Voltar com origem.** `profAbrirPaciente` anota em `PROF_ORIGEM_PACIENTE` a tela de onde o
paciente foi aberto (Início ou Pacientes) e `profVoltarDashboard` devolve para ela. Excluir
paciente e login continuam caindo no Início.

**Teste.** O servidor dos roteiros da Fase 19 é o `Código.js` real em Node
(`..\FASE_19_servidor_simulado.js`, sobre o arnês de `scripts/testes/backend_18_10a.js`), com
relógio fixo igual ao da página (`page.clock.setFixedTime`); a página é servida do disco por
`page.route`. Regras e provas da fase: `..\prompts_19\PROVAS_FASE_19.md`.

## Plano de lembretes (Pacote 19.2.1 — publicado em 22/11/2026)

Segundo pacote da Fase 19. Absorve o cartão G1 e os débitos 8.5, 8.23 e 8.93. Backend + frontend,
um deploy.

**Aba `Lembretes` (Controle do profissional).** Uma linha por item do plano de um paciente; nasce
no primeiro item gravado, só pelo cabeçalho (`COLUNAS_LEMBRETES`, 18 colunas: `id`, `sigla`,
`tipo` (`auto` | `escala` | `outro`), `instrumento`, `texto`, `recorrencia` (`agora` | `uma_vez` |
`recorrente`), `periodicidade` (`diaria` | `semanal` | `quinzenal` | `mensal` | `dias_semana`),
`dias_semana`, `data_inicio`, `data_termino`, `hora`, `ativo`, `encerrado_em`, `criado_em`,
`criado_por`, `atualizado_em`, `ultimo_email_em`, `ultimo_cumprido_em`). **Toda célula é texto
literal** (`_lemCelula_` põe o apóstrofo) e a leitura é por `getDisplayValues` (`_lembretesLer_`):
o Sheets não retipa data nem hora (lição 105, conferido no servidor real) e a regra trabalha só
com `AAAA-MM-DD` e `HH:mm`. Não há coluna de canal: WhatsApp e e-mail valem sempre. Leitura nunca
cria a aba. Excluir o paciente apaga os itens dele (`_lembretesApagarDoPaciente_`), porque a sigla
pode voltar a ser usada.

**Regra de datas — funções puras, o "agora" entra por parâmetro.** `_lembreteOcorre_(item, iso)`
(início, término inclusive e periodicidade; mensal em mês mais curto = último dia do mês),
`_lembreteUltimaAntes_`, `_lembreteSituacao_(item, hojeIso)` → `{ hoje, atrasado, respondido_hoje,
email_hoje }`, `_lembreteEmailVence_(item, hojeIso, horaAgora)`. **Vence hoje:** o item ativo
ocorre hoje. **Atrasado:** a última data prevista antes de hoje ficou sem resposta
(`ultimo_cumprido_em` anterior a ela); "Outro" nunca fica atrasado; item de data única ou já
terminado sai depois de `LEMBRETE_ATRASO_DIAS` (7). **E-mail vence:** ocorre hoje, a hora do item
já passou, ainda não foi enviado hoje e o paciente ainda não respondeu hoje. Só `_lemAgora_` lê o
relógio (fuso do consultório) — o teste passa datas fixas.

**Respondido.** `salvarAutomonitoramento` e `profCriarAutomonitoramento` (só registro completo —
`_registroCompleto_`: `neg_preenchido` ou `pos_preenchido` = `sim`; a checagem de humor sozinha não
conta) e `salvarEscala`/`profCriarEscala` (mesmo `instrumento`) chamam `_lembretesCumprir_`, que
grava `ultimo_cumprido_em` = hoje nos itens ativos daquele instrumento, na mesma trava. Erro ali
nunca derruba a gravação do paciente.

**Ações (crachá; as três primeiras em `ACOES_COM_TRAVA` e `VMC_ACOES_GRAVACAO`).**
`profSalvarLembrete(siglaPaciente, dados)` — cria ou edita (o `id` vem da tela: o mesmo `id` de
novo regrava as colunas do plano, nunca duplica; item encerrado não se edita);
`profEncerrarLembrete(siglaPaciente, id)`; `profLembrarAgora(siglaPaciente, dados)` — grava o item
(`recorrencia: agora`) e manda o e-mail na hora (`email_enviado`, `motivo`); `lerMeusLembretes`
(paciente, só leitura, em `ACOES_SO_LEITURA`) — uma linha por item ativo com a próxima data nos 7
dias seguintes; item respondido hoje passa para a data seguinte. As três que gravam devolvem
`lembretes` (o plano do paciente, itens vigentes) e `inicio` (os itens de hoje e atrasados dele +
`telefone` e `tem_email`) — a tela atualiza o Início sem nova chamada. Lembrete de escala abre a
escala para o paciente (`_abrirEscalaParaPaciente_`; `escala_aberta`). São 53 ações no `doPost`.

**Leituras sem chamada nova para o profissional.** `listarPacientesDoProfissional` (e, por ela, o
login) devolve em cada paciente `lembretes` — os itens de hoje e atrasados (`_lembretesDoInicio_`)
— e, só quando há itens e o paciente está ativo, `telefone` e `tem_email`. `lerDadosPaciente`
devolve `lembretes` (o plano, `_lembretesDoPaciente_`). O paciente ganha uma leitura em segundo
plano no Início (`lerMeusLembretes`).

**E-mail.** `montarEmailLembrete(tipo, nome, assinatura, detalhe)` usa `_layoutEmail_` (o dos
convites) com a linha opcional `sobBotao`; textos em `EMAIL_LEMBRETE` (um conjunto por tipo),
aprovados em 22/11/2026. **Desde o 19.2.2 (decisão do usuário, 22/11/2026) a sigla da escala e o
texto do "Outro" aparecem na mensagem:** `_lembreteDetalhe_(item)` devolve a sigla (a chave de
`ESCALAS_MENU`, só se for do catálogo — PHQ-9, URICA-A; nunca o nome por extenso) ou o texto
digitado, e `EMAIL_LEMBRETE_COM_DETALHE` monta o parágrafo ("Há uma escala aberta para você:
<sigla>. Quando puder, responda." / "Combinado de hoje: <texto>"). No HTML o parágrafo inteiro
passa pelo escapador único; no texto puro vai como foi digitado. Sem sigla ou sem texto vale o
parágrafo genérico. Assunto, título e prévia não levam o detalhe (o assunto aparece na tela
bloqueada). No WhatsApp, `lemDetalhe_(l)` e `lemLinkWhats_(telefone, tipo, nome, detalhe)` fazem o
mesmo, com o texto por `encodeURIComponent`. O Automonitoramento não mudou. Cota própria: `_reservarEmail_('lembretes')`, `LEMBRETES_DIA_MAX` =
60 por dia (convites 20 e redefinições 10 ficam à parte).

**Gatilho.** `enviarLembretes_` roda **a cada 5 minutos desde o 19.2.3** (`instalarGatilhos` cria os dois
gatilhos: `monitorarPing_` diário e `enviarLembretes_` com `everyMinutes(5)`; até o 19.2.2 era de hora em
hora e o e-mail chegava até uma hora depois do horário escolhido — o usuário criou um lembrete para dali a
dois minutos e não recebeu). Percorre a aba `Lembretes` de cada
profissional ativo; para cada item com e-mail vencendo, **grava `ultimo_email_em` antes de enviar,
dentro da trava e relendo a célula** — duas rodadas no mesmo dia nunca mandam o mesmo item duas
vezes; se o envio falha, a marca volta ao valor anterior e a rodada seguinte tenta de novo.
Devolve só contagens. À mão: `clasp --user run run-function rodarLembretesAgora`. Rollback do
pacote: `removerGatilhoLembretes` antes do `git revert` (gatilho apontando para função que não
existe dá erro toda hora).

**Enviar agora um item que já existe (19.2.3).** `profLembrarAgora` aceita `dados.enviar_id`: manda na hora
o e-mail de um item ativo do plano (`_lembreteEnviarAgora_`), sem criar linha, e grava `ultimo_email_em` —
o gatilho não repete o item no mesmo dia. Nenhuma ação nova (continuam 53); `_lembreteMandarEmail_` é o
envio comum ao "Lembrar agora" e a este caminho (motivos `inativo`, `sem_email`, `cota`, `falha`). Na
tela, as duas formas de enviar ficam **dentro do Editar** de cada lembrete (decisão do usuário de
22/11/2026: a linha do lembrete tem só Editar e Encerrar): bloco `#profLemEnviar` "Enviar agora" com o
botão WhatsApp (`lemBotaoWhats_`, o item como está gravado) e o botão E-mail (`profLemEnviarEmail_`); o
erro do servidor aparece no próprio formulário.

**8.23.** `_calcularIndicadores_` conta em `ind_total_auto` só os registros completos; o "último"
(`ind_ultimo_auto`) continua sendo a última linha, checagem ou não.

**Frontend.** Início do profissional: `profRenderInicio_` (refaz o Início a partir de `PROF_LISTA`,
também depois de gravar um lembrete) com `#profBlocoLembretesHoje` e `#profBlocoAtrasados` entre os
alertas e as atualizações; cada linha (`.prof-lem-linha`) é o item clicável do bloco (`profEvHtml_`)
mais o botão WhatsApp (`lemBotaoWhats_`, `wa.me` com o telefone do cadastro e a mensagem aprovada)
ou "Sem telefone no cadastro". Paciente aberto: módulo `#profMod-lem` "Plano de lembretes"
(`profLemCorpoHtml_`, formulário `profLemFormHtml_` com os valores postos por `.value`, obrigatórios
avisados na tela, confirmação de encerrar em `.p5-modal-*`); depois de gravar, `profLemAplicar_`
atualiza o plano, os cadeados das escalas (`profAtualizarCadeados_`) e o Início. Início do
paciente: faixa `#iniLembretes` "Combinado para esta semana" (`iniLemCarregar_`/`iniLemRender_`),
só leitura, some quando não há nada.

**Teste.** `scripts/testes/backend_19_2_1.js` (94 provas; relógio fixo por `Date` injetado; passa no
fuso local e em UTC). O arnês de `backend_18_10a.js` passou a retipar data sem hora como
meia-noite **local** (era UTC — débito 8.93). Roteiro `..\PACOTE_19_2_1_fluxo.js` (59 provas por
viewport) e prova real `..\PACOTE_19_2_1_real.js`; funções temporárias da prova no servidor em
`..\PACOTE_19_2_1_temp.js`.

## Painel das Escalas (Pacote 19.0 — publicado em 22/11/2026, só frontend)

Gráfico de cada escala respondida, no molde do automonitoramento (histórico de um lado, painel do
outro). **Uma tela (`#sec-escalas-painel`, contêiner `#escpConteudo`) e uma função
(`escPainelRenderizar`) para os dois perfis**; nenhuma ação nova no servidor.

**Entradas.** Paciente: cartão `#escCardPainel` no hub `#sec-escalas`, logo depois de "Meu Histórico
de Escalas" → `escAbrirPainel()`. Profissional: botão "Painel das Escalas" ao lado de "Nova escala"
no módulo `#profMod-esc` do paciente aberto → `profAbrirPainelEscalas()`. A barra (`data-barra-voltar`)
chama `escPainelVoltar()` — está na lista de `vmcAcaoDaBarra_` —, que devolve para
`ESCP_STATE.origem` (`sec-escalas` ou `sec-prof-paciente`).

**Dados.** Os registros são os de `ESC_HIST_STATE.registros`. Paciente: `escHistObter_(aoCarregar)` —
a carga com o cache de 30 s que o histórico já tinha, agora numa função só, usada por
`escRenderHistorico` e pelo painel (devolve `{ lista }` ou `{ erro: 'sessao' | 'servidor' |
'conexao' }`); com mais de 60 aplicações, `escHistCarregarTudo_()` traz as páginas anteriores em
silêncio e o painel se redesenha. Profissional: o que veio em `profLerDadosPaciente` (todas as
aplicações), já na memória — abrir o painel não chama o servidor. Quem abre marca
`ESC_HIST_STATE.visaoProfissional`; com ela falsa, a escala `escoreOculto` (BSS) fica fora, e o
estado vazio do paciente não a cita.

**O que se desenha, só pelas propriedades do catálogo** (`escPainelGraficos_`; o motor não cita
escala pelo nome):

| Catálogo | Gráfico |
|---|---|
| `escore_total` com `faixas` | "Escore total" com as faixas como bandas; eixo da menor à maior faixa (teto em `escoreMax`) |
| `escore_total` sem `faixas` | "Escore total", só a linha, de zero a `escoreMax` |
| `composto` | um gráfico com `composto.nome`, lendo `escore_<composto.chave>` |
| subescala com `faixasSubescalas[chave]` | um gráfico para ela, com as bandas dela (hoje só a DASS-21) |
| demais subescalas (`subescalasMeta`) | um gráfico "Subescalas", uma linha por subescala (régua própria, separada da do total) |

Das 40 escalas, 18 têm `faixas` no total; as que não têm faixa com fonte aparecem só com a linha.
Um cartão `.escp-cartao` por escala com aplicação no período, na ordem de `ESC_HIST_ORDEM`:
título e tradução, "N aplicações · última em dd/mm/aaaa", os gráficos (`.escp-graf`, canvas em
`.escp-canvas`), a legenda (`.escp-legenda`: amostra `.escp-amostra.<cor>` por faixa; traço
`.escp-traco` por subescala) e a nota.

**Tempo.** `escPainelDia_(r)` devolve o dia civil de `data_aplicacao` como número (dias, pelo
calendário local), com a hora do `timestamp` como fração quando é do mesmo dia — nunca
`new Date('AAAA-MM-DD')`. O eixo X é linear nesses dias (distância proporcional ao tempo, sem
adaptador de datas); as datas mostradas são as das aplicações (primeira e última sempre, as do meio
quando cabem — `afterBuildTicks`). O filtro é o do Painel de Evolução (`pevMontarSeletor`,
`pevBindSeletor(raiz, aoEscolher)`, `pevFiltrarPorPeriodo(registros, periodo, campo)` — o terceiro
parâmetro, novo, diz a coluna da data; padrão `data_registro`), abre em "Tudo" e vale para a tela
inteira (`ESCP_STATE.periodo`).

**Cores.** Lidas dos tokens ao desenhar (`vmcTok`): a linha do total usa a tinta da escala
(`escPainelTokEscala_`: `--c-<prefixo>-ink`, com o mapa `ESCP_TOK_ESCALA` para os cinco prefixos
antigos); cada subescala tem cor (`ESCP_TOK_SERIES`), traço (`ESCP_TRACOS`) e marcador
(`ESCP_PONTOS`) próprios. As bandas saem de um plugin do próprio gráfico (`beforeDatasetsDraw`,
nenhuma biblioteca nova): `ESCP_TOK_FAIXA` dá o fundo de cada cor de faixa e, para laranja e
vermelho, uma tinta por cima com opacidade (`globalAlpha`) — nenhuma cor fixa no código. A borda do
cartão e a cor dos traços da legenda vão pelo estilo do elemento (`var(--token)`), sem regra de CSS
por escala. Trocar o tema zera o cache de tokens e chama `escPainelRenderizar()` quando a tela ativa
é o painel.

**Estado e sigilo.** `ESCP_STATE = { periodo, origem, charts }`; os `Chart` são destruídos a cada
desenho, no Voltar e em `descartarCachesPaciente_()` (os dois logouts), que também esvazia
`#escpConteudo`. No profissional, cada abertura parte do paciente aberto e do período "Tudo".

**Teste.** `..\PACOTE_19_0_fluxo.js` (65 provas por viewport, servidor = `Código.js` real em Node,
relógio fixo): confere o que cada gráfico desenha lendo o `Chart` vivo de cada canvas e a cor do
pixel das bandas contra o token, nos dois temas. A troca de tema é esperada por condição, não por
tempo: numa janela que não está pintando quadros, o evento de `prefers-color-scheme` só chega no
quadro seguinte.

## Resultado das escalas: estágio, "Seu resultado", tom e nomes (Pacote 19.0.1 — publicado em 22/11/2026, só frontend)

O montador único do resultado (`escRenderizarConteudoResultado`, tela imediata e janela de detalhes) ganhou o
passo **3b**, entre o cabeçalho com o escore e "O que isso significa": `escRrBlocoEstagio(def, reg, contexto)` e
`escRrBlocoSeuResultado(cod, def, reg, contexto)`. Cada um devolve `''` quando a escala não é dele; o motor não
cita escala pelo nome.

**Estágio de mudança (escala com `estagios` no catálogo — hoje as quatro URICA).** `def.estagios` guarda só a
regra e os números, dentro de `ESC_ESCALAS` (o bloco continua autocontido: os scripts o extraem sozinho):

| `metodo` | Dados | Regra | Versão e fonte |
|---|---|---|---|
| `escoreT` | `normas[subescala] = [[soma mín., soma máx., T], …]`, `prontidaoSomaMedia` opcional | o estágio é o da subescala com o T mais alto (empate: os dois) | drogas ilícitas (Szupszynski & Oliveira, 2008, Tabela 5) e tabaco (Oliveira et al., 2014, Tabela 3) |
| `prontidao` | `cortes = [{ ate, estagio }, …, { estagio, rotulo? }]` | prontidão exata pelas somas (médias de C + A + M − média de PC), arredondada a duas casas e comparada com `ate` | hábitos alimentares (Bittencourt, 2009: 8 e 10,33) e álcool (DiClemente, Schlundt & Gemmell, 2004: 8 e 11) |

`escEstagioDe_(def, reg)` calcula; o bloco mostra o estágio, a regra aplicada (com os T ou com os cortes por
extenso), a comparação com a aplicação anterior, o quadro dos quatro estágios (`ESC_QUADRO_ESTAGIOS`: `voce` =
frase ao paciente, `descricao` = linha do quadro, `propor` = coluna só do profissional, por
`ESC_HIST_STATE.visaoProfissional`) e a linha da fonte (`estagios.fonte`). As caixas das subescalas mostram
"escore T n" quando há norma. A regra oficial de correção (maior escore T = estágio) é a da folha do GAAPCC/PUCRS;
os arquivos-fonte ficam em `..\VMC-offline\fontes_escalas\URICA\` (índice `FONTES_URICA.md`) e o bloco `estagios`
entrou em `docs/escalas/fontes.json` com arquivo e página (`scripts/fontes_estrutura.js`,
`scripts/gerar_fontes_json.js`; status do corte `regra_de_estagio`).

**"Seu resultado nesta aplicação" (escala sem `faixas`, sem `faixasSubescalas`, sem `estagios`, não oculta).**
Só o que os números dizem: escore único → régua de `itens × valorMin` a `escoreMax` (`.rr-regua`); três ou mais
subescalas → mais alta e mais baixa (pelo valor quando a régua é a mesma — `subMedia` ou mesmo número de itens —,
pela média por item quando os números de itens diferem); diferença para a aplicação anterior (total, composto ou
cada subescala). A aplicação anterior vem em `contexto.anterior`, campo novo de
`escCalcularContextoLongitudinal`.

**Tom das faixas.** Nenhuma faixa do catálogo usa "o quanto antes", "o mais breve possível" ou "atenção
imediata": a sugestão das faixas altas é "Traga este resultado para sua próxima sessão. Seu terapeuta verá este
resultado antes dela…". A orientação de crise continua no bloco de risco (`escRrBlocoAlerta`, CVV 188 e SAMU 192),
que é acionado pelo item crítico e não mudou.

**Nome da escala.** `escNomeHtml_(def, cod)` devolve um bloco `.esc-nome` com `.esc-nome-orig` em cima e
`.esc-nome-trad` embaixo; substituiu `escNomeTraducaoHtml_` em todos os cabeçalhos (aplicação, resultado, janela
de detalhes, ficha, histórico, Painel das Escalas, cartão do profissional). Em cabeçalho cheio (`.rr-header`,
`.p11-mhead`) a tradução usa `--c-action-tint`.

**Profissional.** Cartão da escala: `Ficha · Aplicar · cadeado` (`profAplicarHtmlBotao_` →
`profAplicarEscala_` → `profEscalaIniciar_`, o mesmo fluxo de "Nova escala"; escala de texto protegido só quando
o servidor já liberou o texto). Fim da aplicação: `profFluxoEncerrar_(msg, { cod, idEnvio })` reabre o paciente e
`profAbrirResultadoRecente_` abre a janela de detalhes da aplicação com aquele `id_envio` — nunca "a mais
recente". Nenhuma chamada nova ao servidor.

**Teste.** `..\PACOTE_19_0_1_fluxo.js` (53 provas por viewport; `VMC_REPO` escolhe a pasta do `index-dev.html`).

## Agenda completa (Pacote 14.3 — 22/11/2026)

**O que é.** A Agenda do profissional deixa de ser só a grade: clicar num horário abre o painel da
consulta (abas Consulta e Bloqueio), as sessões aparecem na grade com a duração real, e o paciente
tem a tela "Minhas sessões". Decisões do usuário: horário ocupado ou bloqueado nunca recebe sessão
(na série a data é pulada e listada); paciente cancela e pede remarcação só com
`antecedencia_min_horas` ou mais; reposição é sempre decisão do profissional e nunca gera cobrança.

**Dados (Controle do profissional).** Quatro abas, criadas no primeiro uso, tudo texto literal
(`_lemCelula_`) e lido por `getDisplayValues` (`_lembretesLer_`), como os lembretes:
`Sessoes` (21 colunas; `estado` agendada | realizada | falta | cancelada; `cobrada` Sim | Nao | vazio;
`reposicao_de` = id da sessão cobrada que esta repõe; `cancelada_por` paciente | profissional |
edicao_serie), `Series` (a regra; `dias_semana` no padrão da Grade, 1 = segunda), `Bloqueios` e
`Pedidos_Agenda` (remarcar | repor; pendente | aprovado | recusado). `Config_Agenda` ganhou a chave
`avisos_sessao` (nasce `Nao`; `salvarGradeAtendimento` só a grava quando a tela a manda).

**Regra de datas (funções puras, "agora" por parâmetro).** `_ageSerie_(regra, inicio, ocupada)`:
semanal ou mensal (dia do mês ou n-ésimo dia da semana), fim "após N" (N = sessões criadas) ou "em
data" (incluída), pula o que `ocupada(iso)` disser, aponta feriados (`_ageFeriados_`: nacionais +
Carnaval e Corpus Christi pela Páscoa) e recusa acima de 60 sessões ou 12 meses (`codigo: 'teto'`).
`_ageSobrepoe_` (encostar não é conflito), `_ageNoPrazo_` e `_ageCobrada_` (a tabela de cobrança).
Reusa `_lemDia_`, `_lemIso_`, `_lemDiaDaSemana_`, `_lemHora_` e `_lemAgora_`.

**Ações (14; o `doPost` passa a ter 67).** Profissional: `profLerAgenda` (sessões, séries, bloqueios,
feriados, pedidos e config numa chamada), `profSalvarSessao` (cria, edita, remarca, cria série e
reposição; `simular: true` devolve as datas sem gravar), `profEditarSerie`, `profCancelarSessao`,
`profMarcarSituacao`, `profSalvarBloqueio`, `profApagarBloqueio`, `profDecidirPedido`. Paciente:
`lerMinhasSessoes`, `lerHorariosLivres`, `pacienteAgendarSessao`, `pacienteConfirmarSessao`,
`pacienteCancelarSessao`, `pacientePedirAgenda`. As 11 que gravam estão em `ACOES_COM_TRAVA` e em
`VMC_ACOES_GRAVACAO`; o conflito é conferido dentro da trava (`_ageOcupado_`). O `id` vem do cliente:
repetir o pedido edita ou responde `duplicado`. Toda gravação do profissional devolve a agenda do
período pedido em `periodo` (`_ageResposta_`), e a do paciente devolve a lista dele: a tela nunca relê.

**Sem chamada nova no Início.** Os pedidos pendentes vão na lista do login (`pedidos_agenda` por
paciente, `_agePedidosDoInicio_`) e a próxima sessão do paciente vai em `lerMeusLembretes`
(`proxima_sessao`). Excluir paciente apaga sessões, séries e pedidos dele (`_agendaApagarDoPaciente_`).

**Avisos.** `montarEmailSessao` (confirmação, série, lembrete, cancelamento, remarcação, pedido
aprovado ou recusado e aviso ao profissional) no `_layoutEmail_`; cota própria `sessoes` (60 por dia).
Só saem com `avisos_sessao = Sim` e, para confirmação, lembrete e cancelamento, com a caixa da sessão
marcada (`_ageAvisarPaciente_` devolve o motivo quando não envia). O lembrete sai na primeira rodada
do gatilho depois de faltarem 24 horas: `enviarAvisosSessao_` é chamada no fim de `enviarLembretes_`,
dentro de `try/catch`, com a marca `ultimo_aviso_em` gravada antes do envio, na trava. WhatsApp é
botão `wa.me` com o texto pronto (`ageWhatsLink_`).

**Tela.** Namespace `age*` (profissional) e `ses*` (paciente), depois do bloco `cal*`. Um único modal
(`#ageModal`, `.p5-modal-*`) com vistas: painel, repetição, lista de datas, cancelar, apagar bloqueio
e "Sair sem salvar?". `ageDesenharDia_` desenha bloqueios, sessões e o clique no horário em cada
coluna; `CAL_ALT_HORA` passou de 48 para 64 px. `ageAplicar_(resp)` troca a agenda da tela pela que
veio na resposta e atualiza os pedidos do Início. O profissional pode marcar fora da grade, em data
passada e em feriado (com aviso); o paciente só vê horário livre da grade.

**Testes.** `scripts/testes/backend_14_3.js` (130 provas, relógio fixo, passa em qualquer fuso) e
`..\PACOTE_14_3_fluxo.js` (62 provas por largura, `Código.js` real em Node pelo
`FASE_19_servidor_simulado.js` com `VMC_REPO` apontando para a pasta do pacote).

**Rollback.** `git revert` dos commits + `clasp push` + `clasp deploy` na mesma implantação. As
quatro abas ficam na Controle sem uso; nada se perde. O gatilho continua o mesmo (`enviarLembretes_`).

## Agenda: confirmação por link, eventos e avisos na hora (Pacote 14.4 — 22/11/2026)

**Link de confirmação.** `_ageTokenConfirmar_(profId, sessaoId)` = `b64url("conf|profissional|sessao")` + `.` + 32 hex do
HMAC com o segredo da sessão (`_segredoSessao_`). `confirmarSessaoPorLink` é a quinta ação de `ACOES_PUBLICAS` (sem
crachá) e está em `ACOES_COM_TRAVA`: token inválido nem abre planilha; válido, só grava `confirmada_em` e devolve
`{ ok, ja_confirmada, data, hora, modalidade }` — nenhum nome. O token não tem validade própria: vence pelo estado da
sessão (cancelada, com situação marcada ou já iniciada). Remarcar zera `confirmada_em`, e o mesmo link confirma a data
nova. A sessão lida pelo profissional traz `link_confirmar` (`ctx.profId` vem de `_ageResposta_(alvo, …)`); o e-mail
de confirmação e os lembretes usam o link no botão "Confirmar presença" (`montarEmailSessao`, `p.link`; sessão já
confirmada volta ao botão do sistema). Na página, `?confirmar=` é lido no `DOMContentLoaded`, sai do endereço na hora
e abre a tela do login em modo aviso (`ageConfirmarPorLink_`).

**Eventos da agenda.** `_ageEventos_(ctx, pacs, agora)` deriva das colunas que já existiam, sem aba nova: `agendou`
(`origem = paciente`), `confirmou` (`confirmada_em`), `cancelou` (`cancelada_por = paciente`), `remarcar` e `repor`
(`Pedidos_Agenda`; o de remarcação mostra o horário pedido). Janela de `AGENDA_EVENTOS_DIAS` (30). Vão em
`profLerAgenda` (`eventos`, `eventos_vistos_ate`) e na lista do login (`eventos_agenda` por paciente, `_ageInicio_`,
que substituiu `_agePedidosDoInicio_`). `profMarcarEventosVistos` grava `agenda_vistos_ate` na `Config_Agenda`
(`_ageConfigGravar_`); o sino conta os eventos mais novos que essa marca.

**Lembretes.** Dois, pelo mesmo gatilho (`enviarAvisosSessao_`): 48 horas antes (janela de 48 a 24 horas; caixa
`lembrete48`; marca `lembrete48_em`) e 24 horas antes (caixa `lembrete`; marca `ultimo_aviso_em`). Sessão que nasce
ou é remarcada para dentro do prazo de um lembrete recebe a marca `dispensado` (`_ageMarcasLembrete_`,
`_ageNovaSessao_`). As quatro caixas: `confirmacao`, `lembrete48`, `lembrete`, `cancelamento` (mudança ou
cancelamento — é a caixa que governa o e-mail automático de remarcação).

**E-mail na hora.** `profAvisarSessao(s, id, { tipo, anterior })` manda o e-mail da sessão com `forcar: true`
(`_ageAvisarPaciente_` ignora a chave geral e a caixa; continuam valendo paciente ativo, e-mail no cadastro e cota).
Sessão cancelada só recebe o tipo `cancelamento`. Toda gravação do profissional devolve `aviso` ('' = enviado;
`desligado`, `caixa`, `sem_email`, `cota`…), que o cartão "Avisar o paciente" mostra.

**Tela.** Vista nova `avisar` no `#ageModal` (`ageAbrirAviso_`, `ageRenderAvisar_`, `ageEmailAgora_`); sino
`#calSino` + `#calSinoPainel` (`ageSinoRender_`); bloco `profRenderEventosAgenda_` no Início; `ageAtualizarSozinha_`
(`visibilitychange` e `setInterval` de 2 min; no máximo uma leitura por minuto; nunca com o painel aberto);
`.cal-ev-presencial` em lilás e `.cal-ev-online` em verde.

**Testes.** `scripts/testes/backend_14_4.js` (52 provas) e `..\PACOTE_14_4_fluxo.js` (82 por largura).

## Agenda: endereço, Google Calendar, Meet e horários livres (Pacote 14.5 — 22/11/2026)

**Espelho no Google Calendar (mão única).** O manifesto pede o escopo `calendar`; o acesso é pela API REST
(`_calApi_`: `UrlFetchApp` + `ScriptApp.getOAuthToken()`), sem serviço avançado. `_ageGravar_` marca
`gcal_sinc = pendente` em toda gravação de `Sessoes` que mude data, hora, duração, modalidade, crie a linha ou cancele.
`_calSincronizar_(controle, profId, { ids, max, agora })` cria (`POST`), muda (`PATCH`, com queda para `POST` em 404) ou
apaga (`DELETE`) o evento e grava `gcal_evento`, `meet_link` e a marca vazia; nunca lança. É chamada em `_ageResposta_`
(até 3 por ação do profissional), nas gravações do paciente, em `_ageAvisarPaciente_` (para o link do Meet entrar no
e-mail) e em `enviarAvisosSessao_` (até `CAL_SINC_RODADA` por profissional a cada 5 minutos: séries e o que falhou).
Só roda com `google_calendar = Sim` na `Config_Agenda` e para o profissional que é o dono do script (`_calDoDono_`:
o Calendar é o da conta Google que executa o servidor). A agenda (`gcal_nome`, padrão "Cogniativo: Agenda Consultório")
é achada ou criada por `_calAgendaId_` e o id fica em `gcal_id`; agenda apagada no Google → o id é esquecido e ela
renasce. Evento (`_calEvento_`): "Sessão de Psicoterapia — nome", `colorId` 1 (presencial) ou 2 (on-line), endereço da
data em `location`, e, na on-line sem link, `conferenceData.createRequest` — um Meet por sessão. Sessão no passado ou
cancelada sem evento só perde a marca. Ligar a chave marca as sessões futuras (`_calMarcarFuturas_`).

**O `clasp run` não serve para o Calendar:** a função executa com o token de quem chama (credencial `run`), sem o
escopo — a resposta é 403 `insufficientPermissions`. `autorizarGoogleCalendar` e qualquer prova com o Google de verdade
rodam pelo editor (ou pelo gatilho e pelo Web App, que usam a autorização do dono).

**Endereço.** Chaves `endereco`, `endereco_novo`, `endereco_novo_desde` (texto literal). `_ageEndereco_(cfg, data)`
devolve o novo a partir da data; `_ageMapa_` monta o link do Google Maps. Vão na sessão lida (`endereco`, `mapa`), no
e-mail (`linkExtra` do `_layoutEmail_`), no WhatsApp e no evento.

**Evento em anexo.** `_ageIcs_` gera o iCalendar (horários em UTC, `UID` = id da sessão + `@cogniativo`, `SEQUENCE`
crescente, título neutro "Sessão com <profissional>"); `_enviarEmail_` anexa `email.anexo` como `text/calendar`.
Confirmação, série (todas as datas), remarcação e pedido aprovado: `METHOD:PUBLISH`; cancelamento: `METHOD:CANCEL`.

**Horários livres.** `_calOcupados_` lê o `freeBusy` da agenda principal (5 min no cache do script) e `_ageLivres_`
tira esses intervalos (`ctx.externos`), além do que já começou. `profLerHorariosLivres` (leitura, 14 dias, sem o prazo
do paciente) alimenta "Ver horários livres" e "Escolher horário". O profissional pode marcar por cima do compromisso
pessoal: `_ageOcupado_` não consulta o Google.

**Horário ideal.** `pacientePedirAgenda` com `sugestao` e sem data grava o pedido sem horário; `profDecidirPedido`
recebe `quando { data, hora }` (obrigatório nesse caso; opcional no pedido comum) e fecha o pedido com esse horário.

**Tela.** `ageOndeHtml_`, `ageLivresHtml_`, `ageLivresRender_`, `ageLivresAbrir_`, `ageLivreEscolher_`,
`agePedidoLivres_`, `sesIdealHtml_`, `sesIdealAbrir_`, `sesEnviarIdeal_`; cartão "Consultório e Google Calendar" na
Grade (`graCfgEndereco`, `graCfgEnderecoNovo`, `graCfgEnderecoDesde`, `graCfgCalendar`).

**Testes.** `scripts/testes/backend_14_5.js` (67 provas, com um Google Calendar simulado) e `..\PACOTE_14_5_fluxo.js`
(35 por largura).

## Pacotes 14.5.1, 19.2.4 e 13.7 (22/11/2026)

### Link de confirmação diz onde é a sessão (14.5.1)

- `confirmarSessaoPorLink` (ação pública, token assinado) devolve, além de dia, hora e modalidade: `estado`, `endereco` e
  `mapa` (presencial — o endereço que vale na data, `_ageEndereco_`) ou `meet_link` (on-line). Nenhum nome, sigla ou telefone;
  a suíte confere a lista exata de chaves.
- `ageWhatsLink_` deixou de levar o endereço por extenso e o link do mapa: a mensagem tem um link só (o de confirmar) e a
  página dele usa `ageOndeHtml_` ("Abrir no mapa" / "Abrir o Meet").

### Destino do lembrete (19.2.4)

- Servidor: `_lembreteDestino_(item)` → `auto` | `escala.<SIGLA>` | `''`; `_lembreteLink_(destino)` só monta `SITE_URL?ir=…`
  quando o destino passa na expressão regular; `montarEmailLembrete(tipo, nome, assinatura, detalhe, destino)`.
- Cliente: `?ir=` é lido no `DOMContentLoaded`, sai da URL (`history.replaceState`) e vira `VMC_DESTINO` (só em memória);
  `vmcDestinoLer_` aceita `auto` ou escala do catálogo; `vmcDestinoAbrir_` roda com a sessão aberta ou no fim do
  `loginConcluir_` do paciente (o do profissional descarta). Registro → `iniNovoRegistro()`; escala → `escAbrirMenu()` e, se
  liberada, `escClicarCardEscala()` (o mesmo caminho do cartão); não liberada → aviso na tela do menu.
- Início do paciente: `iniLemRender_` desenha os itens de registro e de escala como `button.ini-lem-item` com `data-ir`.
- `lemLinkWhats_` leva o mesmo `?ir=`.

### Edição do registro pelo fluxo (13.7)

- Estado único `REG_EDICAO = { idx, timestamp, quem, lados, soChecagem, original, guardado }`. `p136IniciarEdicao` (o botão
  "Editar" da janela) fecha a janela, marca a presença e chama `regEdicaoAbrir_`: zera o formulário, monta `AUTO_STATE.dados`
  com as colunas que o formulário conhece (`regEdicaoChaves_`, lidas do DOM), hidrata e guarda `original` = o que a tela
  devolve depois de hidratada (`regEdicaoColetar_`).
- Abre a revisão (`revisarAbrir`; `regEdicaoAjustarRevisar_` troca título, botão e, com os dois lados, mostra os 10 blocos) ou,
  em registro só com checagem, a checagem (`chkEditar`; `regEdicaoAjustarChecagem_`).
- Ganchos enquanto `REG_EDICAO` existe: `autoSalvarRascunho` e `rascDoFluxoAtivo_` não gravam; `abrirSecao` para fora de
  `regEdicaoTelas_()` encerra (`regEdicaoLimpar_`); `topbarAtualizar` tira a ação e redireciona o voltar (`regEdicaoBarra_`);
  `cabEditar` e `chkIniciarNovoRegistro` devolvem à revisão; `confirmarSaida` só pergunta se algo mudou, com o texto da
  edição; `autoEnviarRegistro` vira `regEdicaoSalvar_`.
- `regEdicaoSalvar_`: `vmcCamposAlterados_(original, agora)`; etapa cujo prefixo (`neg_emo_`…) mudou passa por
  `autoValidarSecao`; grava por `pacienteEditarAutomonitoramento` / `profEditarAutomonitoramento` (`campos` + `id_envio`);
  atualiza `_HIST_REGS`, invalida Painel e Início e volta (`regEdicaoVoltar_`): janela do registro reaberta (paciente) ou
  `profFluxoEncerrar_` (profissional).
- `autoHidratarFormulario` repõe também as caixas de texto de Pensamentos (uma por pensamento, `" | "`) e Comportamentos.
- Saíram: o formulário `p136Render*`, `p136ColetarDados_`, `p136SalvarEdicao`, `P136_ESTADO` e as classes `.p136-form-wrap`,
  `.p136-humor-*`, `.p136-btn-salvar/-cancelar`, `.auto-sec-header/-icon/-title`.

## Fechamento da Agenda — 14.5.2 e 14.5.3 (22/11/2026)

> **14.5.4 (23/11/2026) desfez o primeiro item abaixo:** não existe mais `noPedido`, `confirmou_sessao` nem `porAprovacao`. Regra em vigor: o paciente sempre confirma depois — `profDecidirPedido` grava `confirmada_em = ''` na remarcação e não confirma a reposição nova; o e-mail `pedido_aprovado` sempre pede a confirmação. Os demais itens (e-mails no grupo `confirma`, WhatsApp de sessão já confirmada, 14.5.3) continuam.

- **Confirmação conforme quem mudou o horário (14.5.2):** `profDecidirPedido` calcula `noPedido` (o horário aprovado é o
  que o paciente pediu: sem `quando`, ou `quando` igual; pedido só com `sugestao` nunca é). Com `noPedido`, grava
  `confirmada_em` na sessão (remarcada ou reposição nova) e `confirmou_sessao = Sim` no pedido (`COLUNAS_PEDIDOS_AGENDA`);
  sem, `confirmada_em = ''`. `profSalvarSessao` ao mudar data ou hora continua zerando a confirmação.
- **E-mails:** `remarcacao` e `pedido_aprovado` passaram a ser do grupo `confirma` de `montarEmailSessao` (botão
  "Confirmar presença" + link + linha da antecedência); com `p.confirmada`, a regra de sempre troca por "Sua presença já
  está confirmada." e "Ver minhas sessões".
- **Sino:** `_ageEventos_` monta `porAprovacao` (sessão + `decidido_em` dos pedidos aprovados com `confirmou_sessao = Sim`) e
  não emite `confirmou` para essas confirmações. A marca é própria porque o carimbo tem precisão de minuto.
- **WhatsApp:** `ageWhatsLink_` com `s.confirmada` troca o pedido de confirmação por "Sua presença já está confirmada." +
  o link para ver o endereço ou abrir a sessão on-line.
- **14.5.3:** `ageAplicar_` só chama `calRender()` com `calDataRef` e `calMiniMes` iniciados (Agenda já aberta nesta página).
- **Prova no publicado do lado do paciente:** `..\PACOTE_14_5_2_real.js` (conta descartável; crachás por `sessoes14_5_2`,
  temporária de `..\PACOTE_14_5_2_temp.js`; `zerar14_5_2` recomeça a agenda de teste; `limpar14_3` apaga a conta).

## Pacote 14.6 — Agenda: quatro ajustes (23/11/2026)

- **Cancelada e cobrada na grade:** `_ageCanceladaCobrada_(x)` (cancelada, `cobrada = Sim`, não de `edicao_serie`) entra em
  `_ageLeitura_` ao lado das ativas; `_ageOcupado_` continua olhando só `_ageAtiva_` (ela não ocupa o horário). No cliente o
  bloco usa `.cal-ev-cancelada` (e `.cal-ev-lado` quando há sessão ativa no mesmo intervalo); `ageAbrirSessao_` abre a vista
  `cancelada` (só leitura) e "Agendar reposição" chama `ageRepor_()`.
- **"Esta e as seguintes" com o dia:** em `profSalvarSessao` (sessão existente), `delta` = dias entre a data nova e a antiga;
  `_ageSeguintesPlano_(ctx, seguintes, delta, hora, dur, idAberta)` decide, na ordem que evita colisão (da última para a
  primeira quando anda para a frente), quem move e quem fica; quem move já assume o lugar novo no `ctx`. Movida com dia ou
  hora diferente perde a confirmação e ganha as marcas de lembrete da data nova. Série semanal: `dias_semana` é deslocado
  pelo mesmo `delta`. `simular` devolve `datas`, `puladas`, `conflito`, `seguintes`. No cliente, `ageSalvar_` chama a
  simulação quando o escopo é `seguintes` e a data mudou, e mostra a vista `listaSeg`; `ageSalvarSeg_` confirma (`AGE.segOk`).
- **Limite de agendamentos:** existiu só no 14.6; **saiu no 14.7** (todo agendamento do paciente passa pela aprovação).
- **Valor por paciente:** ação `profSalvarValorSessao(s, siglaPaciente, valor)` (na trava; 72 ações) grava a coluna
  `valor_sessao` da aba Pacientes da Controle como texto literal (`_lemCelula_`, por `camposServidor` de
  `_atualizarLinhaPorChave_`); `listarPacientesDoProfissional` devolve `valor_sessao`. Cliente: campo no cabeçalho do paciente
  (`profBuildHeader_`, valor posto por `.value` em `profValorPintar_`), `profValorSalvar_`, e `ageEscolher_` preenche o valor
  da nova consulta quando ele está vazio.

## Pacote 14.7 — Agenda: agendamento do paciente com aprovação (23/11/2026)

Decisão do usuário: o paciente vê os horários livres, escolhe um e aguarda a aprovação ou a sugestão de outro horário.

- **Pedido de agendamento:** `pacienteAgendarSessao(sigla, dados)` (nome mantido) grava uma linha em `Pedidos_Agenda` com
  `tipo = agendar`, `sessao_id` vazio, `data`, `hora` e a coluna nova `modalidade`; avisa o profissional
  (`_ageAvisarProfissional_`). Nenhuma sessão nasce. Reenvio do mesmo `id`: `duplicado`.
- **Reserva:** `_ageReservas_(ctx, agora, menosId)` lista os pedidos **pendentes com horário que ainda não passou** (qualquer
  tipo; na remarcação, pela duração da sessão). `_ageLivres_` tira esses horários da lista — a do paciente
  (`lerHorariosLivres`, `_ageSlotLivre_`) e a do profissional (`profLerHorariosLivres`). `ctx.semReservaDe` (parâmetro
  `pedido` de `profLerHorariosLivres`) deixa o horário do próprio pedido na lista quando o profissional está escolhendo o
  horário dele. A reserva **não** entra em `_ageOcupado_`: o profissional pode marcar ali.
- **Decisão:** `profDecidirPedido(s, id, aprovar, periodo, quando)`. Pedido `agendar` aprovado: confere o horário
  (`codigo: 'passou'` se já passou; `'ocupado'` se há sessão ou bloqueio), cria a sessão (`id = 'ag-' + id do pedido`,
  `origem = pedido`, `estado = agendada`, `confirmada_em` vazio, duração do slot, todos os avisos, `valor` = `valor_sessao`
  do cadastro, modalidade pedida ou a que a Grade oferece naquele horário), liga o pedido à sessão (`sessao_id`) e manda
  `pedido_aprovado`. `quando { data, hora }` aprova em outro horário. Recusa: `pedido_recusado`.
- **Leituras:** `_agePedidosPendentes_` devolve `modalidade` nos pedidos `agendar`; `_ageMinhas_` devolve
  `pedidos_agendar` (pendentes e recusados há até 7 dias, só de horário que não passou) e deixou de devolver `limite`;
  `_ageEventos_` tem o tipo `agendar` (o pedido) — a sessão aprovada não vira `agendou`.
- **Cliente:** `sesEnviar_` manda o pedido e mostra "Pedido enviado…"; `sesLinhaPedido_` desenha o pedido entre as próximas;
  `agePedidoTexto_` e `agePedidosHtml_` (três botões em todo pedido com horário; `data-tipo` na linha);
  `agePedidoLivres_` passa `pedido` ao servidor; `ageEventoTexto_` com o tipo `agendar`. Saíram `graCfgLimite` e a frase do
  limite.
- **Trabalho em paralelo:** o pacote nasceu em `repo-14-7` (worktree). Com três conversas no repositório, a regra é
  `..\ORQUESTRA_SESSOES.md` (territórios, pontos de encosto e fila de publicação com `PUBLICANDO.md`).

## Painel de Evolução na tela do profissional (Pacote 19.1 — 23/11/2026, só frontend)

- **Uma tela, dois perfis:** `#sec-auto-painel` e `pevRenderizar` servem ao paciente e ao profissional. O modo é uma
  variável de estado: `PEV_STATE.visaoProfissional` e `PEV_STATE.origem` (tela para onde o Voltar devolve), no molde de
  `ESC_HIST_STATE.visaoProfissional` + `ESCP_STATE.origem` do Painel das Escalas (19.0).
- **Entrada do profissional:** botão "Painel de Evolução" no módulo `auto` de `profRenderPaciente_`, ao lado de "Novo
  registro" → `profAbrirPainelEvolucao()`: zera o estado, põe em `PEV_STATE` (por `pevGuardar_`) os registros que
  `profLerDadosPaciente` já trouxe (`PROF_PACIENTE_SEL.automonitoramento` — a aba inteira, por isso `tem_mais: false` e
  `pevCompletar_` nunca chama o servidor), marca o modo e abre a seção. `pevAbrir`, em modo profissional, só desenha: não lê
  sessão nem chama `lerHistorico`. **Nenhuma chamada ao servidor.**
- **O que muda na tela do profissional:** o nome do paciente no topo (`.escp-paciente`, a mesma classe do Painel das
  Escalas) e os dois avisos de vazio ("O paciente ainda não enviou registros." e "Nenhum registro nesse período" + "Tente um
  período mais longo.", por `escPainelVazioHtml_`). O HTML do paciente é o mesmo de antes, byte a byte. O período de abertura
  é o automático do paciente (`pevPeriodoInicial`).
- **Subtítulos que falam com o paciente (19.1.1, decisão do usuário de 23/11/2026):** três blocos de `PEV_SECOES`
  (`neg_sit_tipo_`, `neg_emo_`, `pos_emo_`) têm `subProf` — a frase falando *do* paciente ("…os registros do
  paciente"; a do bloco Emoções Agradáveis foi escolhida pelo usuário: "Quais grupos de emoções agradáveis aparecem mais
  nos registros do paciente"); `pevMontarBlocoBarras` usa `subProf` só em modo profissional. Frase nova que
  fale com o paciente num bloco ganha a sua `subProf`; as demais não precisam.
- **Voltar:** `data-barra-voltar="pevVoltar()"` (na lista de `vmcAcaoDaBarra_`). Paciente: `sec-automonitoramento`, como
  antes. Profissional: zera e volta a `sec-prof-paciente`.
- **Zeragem num lugar só — `pevZerar_()`:** destrói os gráficos, esvazia registros, total, marcas de página, validade do
  cache e período automático, repõe modo e origem, fecha a pizza e limpa `#pevConteudo`. É chamada em `profAbrirPaciente`
  (antes de qualquer coisa do paciente novo), em `profVoltarDashboard`, em `pevVoltar` (modo profissional), em
  `profAbrirPainelEvolucao` e em `descartarCachesPaciente_` (as duas saídas e o fim do fluxo aberto pelo profissional). Efeito
  colateral desejado: depois de sair, o HTML do último painel desenhado não fica mais no DOM (antes só os gráficos eram
  destruídos).
- **Roteiros com relógio fixo:** `page.clock.setFixedTime` congela o `Date.now()` que o Chart.js usa para animar — os
  gráficos ficam no primeiro quadro (barras com largura zero) e o toque numa barra não acerta nada. Antes de fotografar ou
  tocar, o roteiro leva os gráficos ao estado final com `chart.update('none')` (`assentarGraficos` em
  `PACOTE_19_1_fluxo.js`).

## Fase 20 — Fluxo de caixa (Pacote 20.0 — 23/11/2026)

Prompt e decisões: `..\prompts_fluxo_caixa\PROMPT_FASE_20.md`; plano aprovado e mapa de execução citados no relatório
`..\VMC-offline\PACOTE_20_0_RELATORIO.md`. Produto geral (não é réplica das planilhas do usuário).

- **O financeiro lê a Agenda.** O item a receber é a própria linha de `Sessoes`; nenhuma sessão é copiada nem digitada.
  `_finCobravel_(x, cad, agora)`: `cobrada = Sim` entra, `Nao` não entra, reposição nunca; sem situação marcada, a que já
  ocorreu entra como proposta (estado `ocorrida` na leitura) e a futura só entra para quem paga o mês (mensal adiantado ou
  por faixa) e só no mês corrente. Valor da sessão (`_finValor_`): o da sessão; sem ele, o `valor_sessao` do cadastro do
  paciente (14.6); sem ele, o `valor_padrao` do profissional. O `valor` da sessão continua em reais, texto; **o financeiro
  trabalha em centavos inteiros** (`_finCent_` converte; `_finInt_` confere o que vem da tela).
- **Abas novas na Controle** (nascem no primeiro uso; toda célula texto literal por `_lemCelula_`, lidas por
  `getDisplayValues`; colunas em `COLUNAS_FIN`): `Fin_Cadastro` (`id` = sigla; modo, n, quando, pagador, recibo, titular,
  canal, encaminhamento, recibo_pedido_em), `Fin_Pessoas` (pagadores e titular do recibo, com CPF ou CNPJ conferido por
  `_finDocumento_`), `Fin_Pagamentos` (origem `profissional` ou `comprovante`; situação `confirmado`, `aguardando`,
  `recusado`, `estornado`), `Fin_Alocacoes` (pagamento → sessão, valor), `Fin_Cobrancas`, `Fin_Despesas_Fixas`,
  `Fin_Despesas` e `Config_Financeiro` (chave → valor). O valor da sessão do paciente **não** tem coluna nova: é o
  `valor_sessao` do cadastro (um dono só).
- **Tudo é calculado, nada é digitado como situação.** `_finEstado_` soma as alocações dos pagamentos **confirmados** e dá
  o pago de cada sessão e o crédito de cada paciente (pagamentos confirmados menos alocações). Situação da cobrança
  (`_finCobranca_`): a enviar, enviada, parcial, atrasada (vencida com saldo) ou paga. "Recebido" tem duas leituras: pelo mês
  das sessões (padrão; sai das alocações) e pela data do pagamento (`resumo.recebido_entrada`).
- **Pagamento** (`profSalvarPagamento`): `dados.sessoes` é a escolha do profissional (a tela sugere as mais antigas,
  `_finSugerir_` / `finPagSugerir_`); o que não for alocado é crédito; `credito: true` aloca o crédito que já existe;
  `simular: true` devolve o antes e o depois sem gravar; `id` do cliente → reenvio responde `duplicado`. O mês do pagamento
  é o das sessões que ele quita (não se pergunta). `profEstornarPagamento` deixa a linha com `estornado`.
- **Cobrança só por ação do profissional; não há gatilho.** `_finPropostas_` propõe por paciente e por mês, pelo modo de
  pagamento (`_finElegivel_`: por sessão e a cada N só o que ocorreu; mensal desde o dia 1, 11 ou 21; mês seguinte só depois
  que o mês fecha; mês fechado em aberto sempre). `profGerarCobrancas` grava "a enviar"; `profEnviarCobranca` é a única
  porta de saída (`canal: 'email'` manda pelo `_layoutEmail_`, com `linhas` e `semBotao`, a quem paga, cota própria
  `cobrancas` de 60 por dia; `'marcar'` registra o envio por fora, pelo WhatsApp). Sessão desmarcada sai só daquele envio;
  **"Não cobrar esta sessão" é outro gesto** (`profNaoCobrarSessao` grava `cobrada = Nao` em `Sessoes`).
- **Comprovante** (primeiro envio de arquivo do sistema): base64 no `doPost`, JPG, PNG ou PDF até 5 MB, guardado na pasta
  `Comprovantes` da pasta do profissional (`_finGuardarArquivo_`); o pagamento nasce `aguardando` e não conta até
  `profDecidirComprovante`. `lerArquivoFinanceiro` entrega o arquivo só com crachá (profissional dono ou o paciente que
  enviou); a página o oferece como arquivo para abrir (sem origem nova na CSP).
- **Despesas:** a despesa fixa gera a conta do mês **na leitura** (`_finDespesas_`, id `fixa:<id>:<AAAA-MM>`); valor fixo
  sugere o último pago, valor variável vem em branco; pagar grava o lançamento com data e valor reais
  (`profSalvarDespesa`); `profEncerrarDespesaFixa` para de repetir.
- **Leituras:** `profLerFinanceiro` (período da página, `siglaPaciente` para o módulo do paciente aberto — só aí os
  documentos aparecem —, ou `so: 'inicio'` para os blocos do Início) e, do paciente, `lerMeuFinanceiro` (só o próprio, pela
  sigla do crachá). Toda ação que salva devolve a leitura do período (`_finResposta_`): a tela nunca relê.
- **Frontend (`fin*`):** página `sec-prof-financeiro` (abas Resumo, Receitas, Cobranças, Despesas, Configuração; a aba
  Recibos e a parte fiscal da configuração só aparecem quando o servidor as oferecer, na Etapa 9), janela única `finModal`,
  módulo Financeiro no paciente aberto (`finPacModuloHtml_`), tela `sec-financeiro` do paciente e os blocos do Início
  (`finInicioHtml_`, lidos em segundo plano depois do login — uma chamada a mais, que não segura a tela). Estado em `FIN`,
  zerado em `finZerar_` no login e na saída.
- **Excluir paciente:** saem o cadastro financeiro, quem paga e as cobranças; os pagamentos ficam (`_finApagarDoPaciente_`).
- **Provas:** `scripts/testes/backend_20.js` (94 provas, em São Paulo e em UTC) e o roteiro `..\FASE_20_fluxo.js`
  (`Código.js` real em Node, 390 e 1280).

## Fase 20 — Recibos e livro caixa (Pacote 20.1 — 23/11/2026)

Camada fiscal **opcional**, ligada pelo profissional em Configuração (`fiscal = Sim` em `Config_Financeiro`, com o CPF de quem
emite e os códigos do rendimento e da ocupação — nada disso fica no código). Desligada, a aba Recibos não aparece.

- **O sistema prepara, mostra e registra; não fala com o site do governo.** Importar o lote, ler o número real e baixar o PDF é
  trabalho da skill, pelo Chrome do usuário.
- **Aba `Fin_Recibos`** (texto literal): um recibo por paciente e por mês de sessões (`mes`), com `data` (a do recibo, sempre
  informada pelo profissional; decide o mês do lançamento), `datas` das sessões (`DD/MM/AAAA`), `unitario`, `modalidade`,
  `valor` (quantidade × unitário), `descricao` (montada, nunca digitada), `titular_nome` e `titular_documento` (fotografia de
  quem recebe o recibo no momento em que ele é salvo: paciente pela anamnese, quem paga, ou a terceira pessoa do cadastro),
  `situacao` (`a_emitir`, `no_lote`, `emitido`, `cancelado`), `numero`, `lote` e o arquivo do recibo.
- **Proposta na leitura** (`_finRecibos_`): para cada paciente marcado "precisa de recibo" com sessão cobrada no mês e sem
  recibo válido, a leitura traz a proposta (`novo:<sigla>:<AAAA-MM>`) com as datas e a descrição prontas e a **data do recibo em
  branco**. A anamnese só é aberta quando o recibo é salvo (`_finTitular_`), não na listagem.
- **Formato do lote** (`_finLoteDescricao_`, `_finLoteLinhaRecibo_`, `_finLoteLinhaPagamento_`): UTF-8 sem BOM, sem cabeçalho,
  `;`, CRLF; recibo com 16 campos, despesa com 4; descrição em uma linha, até 255 caracteres, com a forma compacta quando a
  longa não cabe. **Prova:** `scripts/testes/fixtures_lote_20_1.json` é o gabarito gerado pelo gerador que o usuário usa hoje
  (`lote.py`, lido da pasta dele, com entradas inventadas e o CPF de quem emite trocado por um fictício) e a suíte exige igualdade
  byte a byte; no PC, `..\FASE_20_lotes_reais.js` confere contra os lotes já aceitos pelo site e imprime só contagens.
- **O portão é da tela** (`_finLote_` → janela "Conferir o lote"): as linhas literais aparecem antes de o arquivo existir, com o
  que ficou de fora e o motivo. `profGerarLote` (`simular` devolve só a prévia) marca o que entrou — recibo vira `no_lote`,
  despesa ganha o nome do lote — para nunca repetir linha.
- **Livro caixa:** despesa paga com `conta` do plano de contas (`P10.…` dedutível, `P11.…` não) e `historico` em uma linha entra
  no lote de despesas; a despesa que repete leva conta e histórico fixos para a conta de cada mês.
- **Registro depois da importação:** `profSalvarRecibo` com `numero` marca `emitido`; `cancelado` guarda o número (ele continua
  consumido); `a_emitir` devolve o recibo ao lote. Com o arquivo anexado, o paciente o baixa (`lerArquivoFinanceiro`, só o dele).
- **Demonstrativo** (`_finDemonstrativo_`): rendimentos = recibos no lote ou emitidos, pela data do recibo; despesas = pagas com
  conta dedutível; resultado = a diferença.
- Ações novas: `profSalvarRecibo` e `profGerarLote` (90 no `doPost`).

## Biblioteca de Escalas e Inventários (Pacote 19.3 — 23/11/2026, só frontend; fecha a Fase 19)

- **Direção escala → paciente.** Atalho `#profAtalhoEscalas` do Início → `profAbrirBiblioteca()` → seção `#sec-prof-biblioteca`
  (molde de `#sec-prof-pacientes`). `bibRender_` desenha o catálogo como ele é (`ESC_HIST_ORDEM` + `ESC_ESCALAS`, nenhuma
  cópia): cartão `.esch-bloco` com a cor da escala, `escNomeHtml_`, `fichaHtmlBotao_` e o botão "Aplicar a um paciente"
  (`.prof-btn-acao.bib-aplicar`). Sem cadeado e sem contagem: esses são do paciente aberto.
- **Busca por contêiner.** `profBuscaHtml_(prefixo)` (padrão `profEsc`, os ids de sempre; a Biblioteca usa `bib`) e
  `profFiltrarEscalas_(origem)`: a busca filtra só os cartões do pai dela (`raiz.parentElement`). A tela do paciente aberto
  continua no DOM enquanto a Biblioteca está na tela — sem isso uma busca esconderia cartões da outra.
- **Ficha sem paciente.** `escCarregarTextos` deixou de exigir sigla quando há `PROF_SESSAO`: para o profissional,
  `lerItensInstrumento` lê pelo crachá (o servidor ignora a sigla).
- **Janela `#bibModal` (`.p11-mov`), estado `BIB = { cod, sigla }`:** `bibAbrir_(cod)` → `bibPasso1_` (pacientes ativos de
  `PROF_LISTA`, busca por nome e sigla com `profNormalizar_`) → `bibEscolher_(sigla)` → `bibPasso2_`.
  - **Liberar:** `bibLiberar_` chama `profLiberarEscala` com `{ siglaPaciente, instrumento, liberar: true }` — o payload do
    cadeado ao abrir. **Pela Biblioteca só se abre; fechar continua no cadeado do paciente.** `chamarServidor` esvazia a
    memória do paciente (18.11), então a tela dele reflete o cadeado na próxima abertura. Quando o paciente está em
    `PROF_PACIENTES_MEM` e a escala já consta em `escalas_liberadas`, o passo 2 avisa e não oferece liberar; fora da memória,
    oferece — liberar de novo não muda nada no servidor.
  - **Preencher agora:** `bibPreencher_` fecha a janela, `await profAbrirPaciente(sigla)`, abre o módulo Escalas e chama o
    mesmo `profAplicarEscala_` do cartão do paciente (`PROF_FLUXO`; escore no servidor; resultado aberto ao terminar, 19.0.1).
  - `profAbrirPaciente` aceita `sec-prof-biblioteca` como origem: o Voltar do paciente devolve à Biblioteca.
- **Saída:** `vmcFecharSobreposicoes_` esvazia `#bibCorpo` e `sairDoSistema` zera `BIB`; Esc fecha a janela.

### Tags da busca recolhidas e sem "Mensuração" (Pacote 19.3.1 — 23/11/2026, só frontend)

- **Decisão do usuário (23/11/2026):** as tags ficam recolhidas e só aparecem quando o botão delas é tocado. `profBuscaHtml_`
  põe o campo e o botão `.esc-busca-abrir` (ícone `#i-tag` + "Tags") numa `.esc-busca-linha`; a lista `.esc-busca-tags` nasce
  com `.hidden`; `profAlternarTags_(btn)` abre e fecha a lista da busca em que o botão está (`aria-expanded`). Com a lista
  recolhida, `profFiltrarEscalas_` mostra no botão quantas tags estão marcadas ("Tags (1)", classe `com-tags`). Vale para as
  duas telas que usam a busca das escalas (paciente aberto e Biblioteca); as buscas de paciente não têm tags.
- **Tag que vale para toda escala não é tag.** "Mensuração" estava em 24 das 40 fichas e saiu do catálogo (`ficha.tags`),
  por decisão do usuário: toda escala mede. Tag descreve o assunto da escala; o que toda escala faz não entra.
- **Limpeza do 19.3.2 (23/11/2026):** saíram as tags que dizem o tipo de uso ou são jargão vago (`Monitoramento`,
  `Diagnóstico`, `Processo`) e as repetidas foram juntadas: `TEPT` → `Trauma`, `Humor` → `Afeto`, `Mudança de
  comportamento` → `Motivação`, `Risco` e `Ideação suicida` → `Risco de suicídio`. O catálogo tem 38 tags; ficaram
  `Rastreamento` e `Transdiagnóstico`. Ficha nova: uma tag por assunto, sem sinônimo de tag que já existe.
- **"Agradáveis", não "positivas" (19.3.2):** os dois textos da tela do paciente que diziam "emoções positivas" (subtítulo
  do bloco Emoções Agradáveis do Painel de Evolução e a lista "Por que registrar momentos bons") dizem "emoções
  agradáveis". "Registro Negativo/Positivo" e os divisores "Aspectos Negativos/Positivos" são nomes dos dois tipos de
  registro e não mudaram.

## Pacote 14.8 — Agenda: cada profissional conecta a própria conta do Google (23/11/2026)

Primeiro de quatro pacotes do plano aprovado pelo usuário (14.8 Google · 14.9 Outlook · 14.10 e-mails pela conta conectada ·
14.11 convite de agenda para o paciente). O espelho do 14.5 deixou de ser só da conta do dono do script.

- **Chave do botão:** cliente OAuth do Google em duas propriedades do script, `GOOGLE_OAUTH_CLIENT_ID` e
  `GOOGLE_OAUTH_CLIENT_SECRET`, que só o usuário preenche (`_gcalCliente_`). Sem elas, `profAgendaConectar` responde
  `codigo: 'indisponivel'`. Endereço de volta = o do próprio Web App (`_e3UrlDoServico_()`, o `/exec` da implantação fixa).
- **Ida:** `profAgendaConectar(s, dados, periodo)` → `_gcalUrl_` monta a tela de permissão (`access_type=offline`,
  `prompt=consent`, `state` = `_gcalEstado_`: `gcal|profissional|validade|ocupado`, assinado com o segredo da sessão, 20 min).
  Escopos: `openid email` + `calendar.app.created` (só as agendas que o sistema criar); `calendar.freebusy` só com a opção.
  Para o dono do script não há ida: liga `google_calendar` na hora.
- **Volta:** `doGet(e)` com `state` → `_gcalRetorno_` confere o estado, troca o código (`oauth2.googleapis.com/token`), guarda
  `{ rt, conta, escopos }` em `PropertiesService` na chave `gcal:<profissional>` (`_gcalGuardar_`), liga `google_calendar`,
  grava `agenda_conta` (só o e-mail) na `Config_Agenda` e põe as sessões futuras na fila (`_calMarcarFuturas_`; com conta
  nova, `refazer` zera `gcal_evento`). `_gcalPagina_` devolve uma página que só diz o resultado — a tela do Google abre em
  **outra aba**, porque a sessão do profissional mora só na memória da página (lição 23).
- **Uso:** `_calToken_(profId)` = token da conta conectada (`_gcalToken_`: renova com o `rt`, 55 min no cache `gcalat:<id>`)
  ou, para o dono sem conexão, o do script — o único `ScriptApp.getOAuthToken()` do código. `_calApi_` ganhou o `profId`;
  `_calConectada_` substituiu `_calDoDono_` nas decisões; `_calAgendaId_` não lista agendas na conta conectada (cria).
  `invalid_grant` na renovação → `_gcalCaiu_` (apaga, desliga, `agenda_aviso = caiu`).
- **Compromissos pessoais:** só com `agenda_ocupado = Sim` (ação `profAgendaOpcao`; ligar sem o escopo devolve `url`).
  `_calOcupados_` tira os horários de `_ageLivres_`; `_calOcupadosTela_` manda à Agenda `ocupados: [{ data, hora_inicio,
  hora_fim }]`. Nunca entram em `_ageOcupado_`.
- **Tela:** a leitura da Agenda devolve `agenda_externa { servico, disponivel, direta, conectada, conta, ocupado, aviso }`.
  Quadro = vista `conta` do `#ageModal` (`ageContaAbrir_`, `ageRenderConta_`, `ageContaConectar_`, `ageContaOpcao_`,
  `ageContaDesconectar_`); a aba nasce no clique (`window.open('about:blank')` antes do `await`) e `ageContaConferir_` relê a
  Agenda quando a página volta a ser vista (`visibilitychange`) ou em "Já permiti". Bloco `.cal-ocup` na grade.
- **Desligar:** `profAgendaDesconectar` e `desativarProfissional` chamam `_gcalDesligar_` (revoga no Google e apaga).
- Saíram: `google_calendar` de `salvarGradeAtendimento`, `calendar_disponivel` de `lerGradeAtendimento`, o campo da Grade.
## Status das sessões (Pacote 20.2 — 23/11/2026)

Decisões do usuário (23/11/2026): a palavra é **status** (o campo "Situação" da sessão passou a "Status"; "Sem marcação" passou a "Sem status"); a sessão de hoje só vira pendência **depois que a última sessão do dia termina**; dois e-mails, só ao profissional, com nome completo e grade com data e hora. A regra do "a receber" não mudou (`_finCobravel_`).

- **Regra pura** (`_stpPendentes_`, com o "agora" por parâmetro): sessão não cancelada, ainda `agendada`, de dia anterior — ou de hoje, se `agora` já passou do fim da última sessão ativa do dia (`_stpFimDoDia_`: início + duração). Mais antigas primeiro.
- **Bloco "Sessões com status pendente" no Início**: os dados vêm na leitura que o Início já fazia (`profLerFinanceiro { so: 'inicio' }` → `inicio.status_pendente = { total, itens }`, no máximo 60 linhas); nenhuma chamada nova no login. A tela (`stpInicioHtml_`) agrupa por dia; `FIN.inicioLido` faz a leitura ser refeita em segundo plano depois de 2 minutos, quando o Início é redesenhado.
- **Ação nova `profMarcarStatusLote`** (`ids`, `situacao`: `realizada` | `falta`; 91 ações): serve a "Realizada", "Não compareceu" e "Todas realizadas". Só toca sessão que está na lista de pendentes (nunca futura, cancelada ou já marcada), grava o mesmo que `profMarcarSituacao` (`estado`, `cobrada` por `_ageCobrada_`) e devolve o `inicio` atualizado. "Outra" não chama o servidor: abre a sessão na Agenda (`stpOutra_`).
- **Dois e-mails ao profissional**, no gatilho dos lembretes (`enviarEmailsProfissional_`, chamada no fim de `enviarLembretes_`, dentro de `try/catch`):
  - fim de dia (`_stpEmailPendenteVence_`): só em dia com sessão, **uma hora depois** do fim da última (teto 23:55), uma vez por dia, e só se sobrou sessão de hoje com status pendente;
  - véspera (`_stpEmailAmanhaVence_`): a partir do horário escolhido (padrão 20:00), uma vez por dia, e só se amanhã tem sessão agendada.
  - Chaves na `Config_Agenda`: `email_status_pendente`, `email_agenda_amanha` (nascem `Nao`), `email_agenda_hora` (texto literal `HH:mm`) e as marcas `email_status_enviado_em` / `email_agenda_enviado_em` (`AAAA-MM-DD`). A marca é gravada **antes** do envio, dentro da trava e relendo a célula; cota ou falha desfazem a marca.
  - Texto: `montarEmailAgendaProfissional`; a grade usa o parâmetro opcional `tabela` de `_layoutEmail_` (cabeçalho + linhas, toda célula escapada). Assunto e título sem nome de paciente.
  - Envio só por `_reservarEmail_('sessoes')` e `_enviarEmail_`; nenhum `MailApp` direto, nome do remetente e "responder para" intocados.
- **Trava do remetente** (`_stpDisponivel_`, função única): enquanto o profissional não tiver a própria conta conectada, os dois e-mails só existem para a conta do dono do script (hoje a função chama `_calDoDono_`). A Grade recebe `emails_prof_disponivel` e mostra os campos travados com o aviso; salvar "Ligado" numa conta travada grava `Nao`; o gatilho nem abre a Controle de conta travada. Quando a conta conectada chegar, troca-se só essa função.
- Prova: `scripts/testes/backend_20_2.js` (relógio fixo, dois fusos) e o roteiro `..\PACOTE_20_2_fluxo.js` (390 e 1280, com os dois e-mails montados pelo gatilho).

## Pacote 14.8.1 — Agenda: a volta da permissão do Google passa por uma página do site (23/11/2026)

Conserto achado na prova do 14.8 com o Google de verdade. Substitui, na seção do 14.8, tudo o que diz "volta pelo `doGet`".

- **O defeito:** quem permite com uma conta que não é a primeira do navegador é devolvido pelo Google com `authuser=1`; o Apps
  Script manda esse endereço para `script.google.com/accounts?authuser=1&continueUrl=…` e a página não abre ("Não foi possível
  abrir o arquivo"). A permissão era dada, o `doGet` nunca rodava.
- **A volta agora:** `_gcalVolta_()` = `conectar.html`, ao lado do `index-dev.html` (derivada de `SITE_URL`). É o `redirect_uri`
  da ida (`_gcalUrl_`) e da troca do código (`_gcalRetorno_`), e o único endereço cadastrado no cliente OAuth do Google Cloud
  ("COGNIATIVO - Conectar agenda", projeto `cogniativo-clasp`). **Renomear ou mover a página quebra a conexão.**
- **`conectar.html`:** página estática, CSP própria (`connect-src` só o Apps Script), `referrer` desligado. Lê `state`, `code` e
  `error` do endereço, limpa o endereço (`history.replaceState`), faz um POST `{ acao: 'concluirConexaoAgenda', state, code,
  error }` e mostra só o resultado em `#cxMsg` (`data-resultado`: `esperando` → `conectada` | `negada` | `erro`). Sem `state`,
  nem chama o servidor. O POST não leva conta do navegador, por isso não sofre do `authuser`.
- **`concluirConexaoAgenda(dados)`:** ação **pública** (sexta de `ACOES_PUBLICAS`) — a aba da volta não tem a sessão do
  profissional; quem protege é o `state` assinado (`_gcalEstado_`: profissional, validade de 20 min, HMAC com o segredo da
  sessão). Fica **fora de `ACOES_COM_TRAVA`**, como o `autenticar`: a conversa com o Google roda sem a trava e só a gravação a
  pega, dentro de `_gcalRetorno_`. Devolve só `{ ok, resultado }`.
- **Saíram:** o ramo `state` do `doGet` (voltou a só responder "Use POST") e `_gcalPagina_`.
- **Portão:** o passo da CSP do `portoes.yml` confere também `conectar.html`.
- **Provas:** `scripts/testes/backend_14_8.js` (bloco B pela ação nova; B17/B17b/B17c), `..\PACOTE_14_8_1_fluxo.js` (a página de
  verdade, com `authuser=1` no endereço) e a prova real com a segunda conta do Google no navegador do usuário.

## Pacote 14.10 — E-mails aos pacientes pela conta do Google que o profissional conectou (23/11/2026)

Terceiro pacote do plano da conta conectada (o 14.9, Outlook, foi adiado pelo usuário para o sistema oficial). Decisões dele: quem não
permitiu o e-mail não envia e-mail aos pacientes (só WhatsApp); o nome de quem envia é o do cadastro do profissional; senha esquecida por
paciente de quem não permitiu não gera link (o profissional reenvia o acesso pelo WhatsApp).

- **Permissão:** a mesma conexão do 14.8 pede também `https://www.googleapis.com/auth/gmail.send` (`GCAL_ESCOPO_EMAIL`): só envia, não lê
  nem apaga. A tela do Google mostra caixas; `_gcalRetorno_` lê o `scope` devolvido e grava o que foi permitido — agenda
  (`google_calendar = Sim`), e-mails, os dois; nenhum = `negada` e a permissão recebida é devolvida ao Google (`/revoke`).
- **Quem envia:** `_emailRemetente_(profId)` → `{ modo: 'dono' | 'gmail', nome, conta }` ou `null`. `dono` = o cadastro do profissional é a
  conta que roda o script (`_calDoDono_`): segue pelo `MailApp`, agora com `name` = nome do cadastro. `gmail` = há permissão guardada com
  o escopo de envio. `_emailPermitido_(profId)` é o sim/não usado por todos os chamadores; fica na memória da chamada (`_MEMO_.emailDe`).
- **Envio:** `_enviarEmail_(para, email, profId)`. Sem `profId` é e-mail do sistema (convite e senha do próprio profissional, exemplos):
  `MailApp`, nome "COGNIATIVO". Com `profId` e sem permissão devolve `false` — nada sai por outro caminho. No modo `gmail`,
  `_gmailEnviar_` monta a mensagem (`_mimeMontar_`: `multipart/mixed` → `related` → `alternative`; texto, HTML, logo `cid:logo` e o `.ics`,
  tudo em base64, cabeçalhos só ASCII, quebra de linha removida de nome, destinatário e assunto) e chama
  `gmail/v1/users/me/messages/send` com o token de `_gcalToken_`. O e-mail fica nos Enviados do profissional e a resposta volta para ele.
- **Chamadores que passam o profissional:** convite do paciente, redefinição de senha do paciente, lembretes (botão e gatilho), avisos de
  sessão ao paciente, aviso de movimento ao profissional, cobrança e os dois e-mails do 20.2 (`_stpDisponivel_` = `_emailPermitido_`).
  Motivo novo `sem_conexao` (botões) e contador `sem_conexao` nos gatilhos, que não gravam marca para quem não conectou.
- **Tela:** `agenda_externa` ganhou `ligada`, `email`, `email_conta`; a lista do login e `profListarPacientes` levam `email_pacientes`.
  `profEmailOk_()` usa a leitura da Agenda quando existe, senão o sinal do login. Quadro "Sua conta do Google" (`ageRenderConta_`): duas
  linhas e "Permitir e-mails" (`ageContaConectar_('email')`, o mesmo `profAgendaConectar`). Frase única em `VMC_MSG_EMAIL_CONECTE`.
- **Google Cloud:** Gmail API ativada no projeto da chave do botão. A lista de escopos da tela de consentimento não é usada.
- **Provas:** `scripts/testes/backend_14_10.js`; `scripts/testes/_gmail_de_mentira.js` (lê a mensagem entregue ao Gmail e a devolve no
  formato do `MailApp`; não é suíte). No arnês `backend_18_10a.js` a profissional de prova é a dona do script.

## Pacote 14.11 — Agenda: a confirmação no evento do Google e o evento recolocado (25/11/2026)

Só servidor; nenhuma ação nova. O COGNIATIVO continua sendo a fonte e o Google só recebe.

- **Confirmação no evento.** `confirmarSessaoPorLink` e `pacienteConfirmarSessao` gravam `gcal_sinc = 'pendente'` junto de `confirmada_em`; nenhuma das duas fala com o Google (o toque do paciente não espera). `_calEvento_` monta a descrição: "Criado pelo COGNIATIVO." + " Reposição." (se for) + " Presença confirmada pelo paciente." (se `confirmada_em`). A frase chega ao evento na rodada seguinte do gatilho ou na próxima ação do profissional que espelha. Remarcar zera a confirmação (14.5.4) e a frase sai.
- **Evento apagado direto no Google volta.** `_calRecolocar_(controle, profId, agora)`, chamada em `enviarAvisosSessao_` logo antes de `_calSincronizar_`: lê a lista dos eventos da agenda do espelho de hoje em diante (`_calEventosVivos_`: uma chamada, paginada até `CAL_LISTA_PAGINAS`; `{}` se a agenda inteira sumiu, `null` se não deu para saber) e põe de volta na fila a sessão futura e agendada cujo evento não está lá. Sem resposta do Google, ninguém mexe em nada. A função só lê o Google e só grava a marca da fila: nunca cancela sessão, nunca envia e-mail.
- **Como o evento volta.** `_calSincronizar_` manda o `patch` com `status: 'confirmed'` (o próprio evento sai da lixeira do Google, com a sala do Meet que tinha); se o evento não volta (404, 410 ou continua `cancelled`), nasce outro — e, em sessão on-line, o evento novo não pede sala nova: o link que o paciente já recebeu vai escrito no local do evento e `meet_link` não muda.
- **Fora do pacote:** evento mudado de horário direto no Google não é desfeito.
- Suíte: `scripts/testes/backend_14_11.js` (Google de mentira com lixeira). As suítes 14.5, 14.8 e 14.10 ganharam a resposta da lista de eventos no Google de mentira.

## Pacote 14.12 — Lentidão: cada coisa é lida uma vez por ação (25/11/2026)

Só servidor; nenhuma ação nova, nenhuma regra mudou. A medição de 25/11/2026 (`..\VMC-offline\medicao_etapa_1\`) mostrou que criar uma sessão gastava cerca de 7 dos 10 segundos do servidor relendo as mesmas abas (Sessoes, Config_Agenda e Pacientes três vezes; as outras, duas), o cadastro do profissional (sete vezes) e os cabeçalhos (sete vezes). E-mail e Google Calendar pesavam cerca de 1 segundo.

A memória da chamada (`_MEMO_`, 18.10) ganhou a gaveta `_MEMO_.age`, que só existe com a memória ativa (dentro do `doPost` e do gatilho dos lembretes):

- `_ageAba_` devolve a mesma instância da aba durante a chamada; é ela a chave das outras gavetas (`Map` por objeto).
- `_garantirColunas_` lê o cabeçalho de cada aba uma vez.
- `_ageLer_(aba)` é o `_lembretesLer_` com memória, para Sessoes, Series, Bloqueios e Pedidos_Agenda (`_ageCtx_` e `_calSincronizar_`). Quem chama recebe cópias. `_ageGravar_` mantém a memória igual à planilha (linha nova e campo alterado); **quem apaga linha ou grava direto na célula chama `_ageEsquecer_(aba)`**.
- `_ageConfig_` lê a `Config_Agenda` uma vez (`_ageConfigLer_` é a leitura); `_ageConfigGravar_` e a Grade esquecem a guardada.
- `_agePacientes_` lê a aba Pacientes uma vez; `_memoEsquecerPacientes_()` é chamada em `_anexarPorCabecalho_`, `_atualizarLinhaPorChave_` e `_atualizarIndicadores_`.
- `buscarProfissional` guarda o cadastro em `_MEMO_.profs` nas ações de `ACOES_DA_AGENDA` (nenhuma delas muda a aba Profissionais).

Regra para quem mexer na Agenda: **gravação nova em aba da Agenda passa por `_ageGravar_`**; se não passar, chama `_ageEsquecer_`. A suíte `scripts/testes/backend_14_12.js` confere, depois de cada gravação, que a agenda devolvida (montada com a memória) é igual à planilha lida de novo.
