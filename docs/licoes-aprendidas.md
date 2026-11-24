# Lições Aprendidas — Referência

179 lições acumuladas no desenvolvimento (numeração original preservada —
as conversas citam "lição #N"). Consultar antes de decisões não-triviais.
Lições novas nascem na seção 8 do status_projeto_vmc.md e entram aqui na
regeneração seguinte da skill clinica-vmc.

## Deploy, GitHub e Apps Script

**1. Sempre testar pelo site publicado em aba anônima.** Nunca pelo
arquivo local. Cache do navegador é fonte recorrente de confusão.

**(Obsoleta desde a esteira de 14/09/2026.)** **2. Upload no GitHub: sempre arrastar ("Upload files").** Copiar/colar
trunca arquivos grandes. URL direta: `https://github.com/USER/REPO/upload/main`.
"Uploads are disabled" = sessão expirou, fazer Sign in.
*(A partir de 14/09/2026 o deploy é por git push — esta lição vale só como histórico.)*

**(Obsoleta desde a esteira de 14/09/2026.)** **3. NUNCA deletar arquivo antigo antes do upload.** O GitHub sobrescreve.
Deletar cria janela de site quebrado.

**38. Cache do navegador esconde uploads bem-sucedidos.** Se o commit
aparece no GitHub com horário correto, o upload funcionou — qualquer
"versão antiga" visível é cache do cliente. Testar com `?v=N` ou aba
anônima ANTES de suspeitar do upload.

**41. "Concluído no status" ≠ "publicado em produção".** O Code.gs do
Pacote 12.2 ficou uma semana "concluído" sem deploy; o do 13.7.6 ficou
40 dias. Marcar CONCLUÍDO somente após teste em produção — especialmente
Code.gs, que exige redeploy explícito.

**(Obsoleta desde a esteira de 14/09/2026.)** **48. Windows esconde extensões "conhecidas"** (`.html`, `.py`, `.js`).
Não tentar renomear no Windows; conferir o nome final no GitHub após o
upload.

**49. Nome de arquivo no GitHub é case-sensitive.** `Index.html` ≠
`index.html`, e o Pages serve `index.html`. Garantir minúsculas ANTES de
arrastar.

**(Obsoleta desde a esteira de 14/09/2026.)** **64. Antes de redeploy do Apps Script, conferir se o código do fix está
no EDITOR** (Ctrl+F pelo marcador de versão, ex: "13.7.6"). Todo Code.gs
deve conter comentário com o número do pacote como marcador verificável.
Sequência: código no editor → salvar → Gerenciar implantações → lápis →
Nova versão → Implantar → testar em produção → só então CONCLUÍDO.
*(Com a esteira clasp, o marcador passa a ser `VERSAO_PACOTE` devolvida pelo `ping`.)*

## Processo e escopo

**8. Conversas longas geram retrabalho.** Migrar após ~15 turnos
substanciais, com resumo enxuto e status atualizado antes.

**9. Não misturar mudanças no mesmo pacote.** Cada pacote faz uma coisa,
testável isoladamente; bug no caminho vira pacote próprio.

**13. Respostas curtas do usuário = "executar".** Não pedir
micro-confirmações técnicas de quem não é programador.

**(Obsoleta desde a esteira de 14/09/2026.)** **15. Nomear versões de entrega** (`index_pacoteN_vX.html`) e guardar
todas nas pastas de backup. *(Descartado no reset — git resolve.)*

**(Obsoleta desde a esteira de 14/09/2026.)** **34. Nomenclatura cronológica de arquivos evita ambiguidade.** O número
do arquivo segue a ordem de deploy, não do roadmap conceitual.

**36. Verificar as ferramentas disponíveis no início da conversa.** Se
algo que seria usado (shell, edição de arquivos, conectores) estiver
ausente, avisar imediatamente — não contornar em silêncio.

**37. Débitos técnicos documentados são mais baratos que esquecidos.**
Tudo que for adiado vai para a seção de débitos do status na hora.

## Validação, testes e protótipos

**4. Validar antes de entregar:** `node --check`, tags balanceadas
(`div`, `button`, `script`), alinhamento `data-grupo` ↔ colunas,
funções essenciais intactas.

**6. Testes de "primeira vez"** exigem aba Automonitoramento/Escalas
realmente vazia — linhas residuais quebram a detecção.

**7. Protótipos antes de produção.** Validar fluxos em HTML de teste
antes de mexer no `index.html`.

**16. Verificar que a base contém as correções anteriores.** Grep por
marcadores: `pevConstruirCacheSubitens` (2.1), `P5_STATE` (5),
`autoFormatarHora` (10 v5), `.hidden` global (9).

**17. Protótipos com nomes EXATOS do formulário real** — nunca inventar
nomes de grupos/subitens; na implementação real, ler do DOM.

**20. Testar é encontrar o que só aparece na prática.** UX se valida
usando; bugs graves (Pacote 10, 11.6 v1) só apareceram com registros reais.

**23. Pacotes textuais extensos valem protótipo visual** com destaque
colorido por versão — forma mais eficiente de revisar texto.

**35. Preview interativo com toggles de estado** (primeira vez/veterano)
supera protótipo estático quando há múltiplos estados a validar.

**61. Fragmentos órfãos de funções substituídas causam crashes
silenciosos.** `node --check` não detecta código morto fora de função.
Após substituir função inteira via str_replace, grep pelo nome dela.

## Bugs técnicos recorrentes

**5. Bug de hora 1899:** Sheets serializa TIME como
`1899-12-30T07:15:28.000Z` (UTC). Em strings ISO, extrair com regex
`/T(\d{2}):(\d{2})/`.

**22. Horários do Google Sheets são UTC, não local.** `autoFormatarHora`
(frontend) trata 4 cenários.

**62. `lerAbaComoObjetos` converte células TIME/DATE antes de retornar.**
`getValues()` devolve Date objects; "20:35" local vira 23:35 UTC. Fix
definitivo no backend: `Utilities.formatDate(val, 'America/Sao_Paulo', 'HH:mm')`;
datas → `toISOString().slice(0,10)`; timestamps → `toISOString()`.

**63. `getUTCHours()` NÃO recupera a hora original de célula TIME** — o
Sheets armazena em UTC internamente; usar sempre `Utilities.formatDate`
com o fuso `America/Sao_Paulo`.

**40. "Há X dias" usa datas civis, não milissegundos.** Subtrair
timestamps falha entre dias civis com <24h de diferença (18/04 22:00 vs
19/04 03:00). Converter para `new Date(ano, mes, dia)` e subtrair;
`Math.round`, não `Math.floor`.

**10. CORS impede protótipos `file://` de chamar o Apps Script.**
Integrar no index ou publicar página de teste no GitHub Pages.

**11. Listas hardcoded duplicando o DOM divergem com o tempo.** Causa
raiz do bug das pizzas do Painel (41 de 49 grupos divergentes). Ler do DOM.

**14. Default seguro em estados assíncronos.** Enquanto o servidor não
responde, assumir o caso restritivo (travar) e liberar na confirmação.

**19. Blindar contra valores não-string do backend.**
`String(valor || '').trim()`; try/catch em renderização expõe o erro real
em vez de travar em "Carregando...".

**21. CSS de classe utilitária precisa ser global.** `.hidden`,
`.disabled`, `.active` nunca restritos a um contexto — regra local
mascara bugs estruturais por anos.

**28. `chamarServidor` NÃO adiciona `sigla` automaticamente.** Sempre
passar `{ sigla: ..., ... }` explícito no payload.

**29. Variável CSS não declarada no `:root` some silenciosamente.**
`var(--x)` sem declaração = transparente/undefined sem erro no console;
fallback inline mascara. Declarar no `:root` antes de usar (caso do
DASS-21 invisível).

**30. Borda de card em cor muito clara fica invisível.** Usar saturação
comparável às demais bordas (caso `.esc-card.blue` → `#BFD5DF`).

**39. `const` em top-level de `<script>` não vira `window.X`.**
`if (window.MEU_OBJ)` retorna false silenciosamente. Acessar a const
direto pelo nome, sem `window.`.

**57. `const` no escopo global não é içado.** Estado global acessado
antes da sua posição no arquivo deve ser `var` (caso `ESC_HIST_STATE`:
travamento total da tela do paciente).

**58. Sessão do paciente usa `carregarSessao()`, não objeto global
`SESSAO`.** Não inventar atalhos globais que não existem.

**59. Timestamp em célula do Sheets pode voltar como Date object.**
`_tsNormalizar_(val)`: se `instanceof Date` → `.toISOString()`; senão
`String(val).trim()`.

**50. Credenciais podem conter caracteres visualmente ambíguos** (sinais
tipográficos que se confundem com os do teclado). Sempre copiar/colar da
fonte segura; nunca digitar à mão, e nunca descrever a forma de uma senha
em documento, lição ou status (reescrita em 30/09/2026).

## Padrões arquiteturais

**12. Não reinventar padrões que já existem no código.** Se está
planejando mais do que codando, pare e procure o padrão pronto.

**18. Desacoplar frontend de backend.** O backend aditivo ignora campos
novos pacificamente — o frontend pode evoluir antes.

**24. Terminologia clínica consistente ajuda a memória do paciente**
(pares agradáveis/desagradáveis, bem-estar/mal-estar etc.).

**25. Escalas visualmente unificadas simplificam a UX** — o paciente
aprende um formato só.

**26. Derivar persistência dos dados que já existem no servidor** antes
de criar coluna nova ("tem registros = veterano", Pacote 11.5).

**27. Cores neutras para estados compartilhados** entre contextos de
cores diferentes (azul institucional = "preenchida" nos dois lados).

**31. Motor de cálculo aditivo por propriedades do item.** Um único
motor serve PHQ-9, PSS-10 (`reverso`), DASS-21 (`multiSubescalas`,
`criticoLimiar`) e SRQ-20 (`dicotomica`) — estender, nunca reescrever.

**32. Reutilizar função pelo output ("empréstimo").** Chamar a função,
capturar o que interessa, desfazer o efeito colateral — mais simples que
refatorar.

**33. Validar o fluxo inteiro antes de ação destrutiva/definitiva.**
Botão final só habilita com TODAS as pré-condições válidas.

**51. Telas read-only do profissional usam cards colapsáveis**
(`.prof-pv-mod`), nunca tudo aberto de uma vez.

**53. Anamnese é sempre row 2 — sobrescrever, nunca append.** Edição usa
`setValues` na linha 2; duplicar linha de anamnese é bug.

**54. Menu hamburger do paciente vive no `.app-header`**, alinhado ao
badge de logout, visível apenas logado.

**55. Desativar paciente = mover planilha + marcar Controle** — as duas
operações são inseparáveis.

**56. `lerDadosPaciente` retorna `ativo`** e o frontend decide os botões
por ele — nunca confiar em estado em memória.

**60. Lock de presença é fire-and-forget.** Gravar o lock sem `await`
para não atrasar a abertura do formulário; é indicação de presença, não
bloqueio funcional.

## Multi-tenant e segurança

**42. Multi-tenant lógico > múltiplos backends.** Um backend, um modelo
de dados com dono em tudo, isolamento por código validado server-side.

**43. Compatibilidade retroativa garante deploy seguro de mudanças
estruturais.** Parâmetros novos são opcionais com default no
comportamento antigo; o cliente migra em pacote separado.

**44. `profissional_id` nunca vem do cliente.** Sempre derivado
server-side via `Indice_Siglas` a partir da sigla autenticada.

**45. Toda função admin revalida credenciais em cada chamada**
(`validarCredenciaisAdmin`). Não existe "já autenticou antes".

**46. Credenciais admin em memória, não em sessionStorage.** XSS lê
sessionStorage; a variável JS morre com a aba.

**47. Migrações destrutivas exigem dupla confirmação** (`SIM` após o
plano em alto nível e `SIM` após a lista exata do que será apagado/movido,
com IDs visíveis).

**52. Headers das abas como constantes no Code.gs** (`HEADERS_*`),
usados ao criar planilha nova — adicionar coluna = atualizar o array.

## Checklist rápido antes de entregar qualquer arquivo

- [ ] `node --check` do JS passa
- [ ] Tags HTML balanceadas (`div`, `button`, `script`)
- [ ] Variáveis CSS usadas declaradas no `:root`
- [ ] Marcadores de correções anteriores preservados
- [ ] Nenhum fragmento órfão de função substituída
- [ ] Chamadas ao servidor passam `sigla` explícita
- [ ] Nenhuma chave técnica de dado vivo alterada
- [ ] Colunas com dados apenas adicionadas, nunca removidas
- [ ] Code.gs com `VERSAO_PACOTE` devolvida pelo `ping`
- [ ] Nenhum log com dados clínicos

## Esteira, scripts e verificação (Etapa 0 e Pacote 15.0)

**65. Descrição ≠ código.** O status afirmou "Escalas: 32 colunas" por meses; o `Code.gs` tem 38. Toda contagem ou nome citado num documento sai de grep no arquivo real, com data.

**66. "Nunca apagar" em excesso é dívida.** Colunas, funções, abas e documentos sem função foram preservados por regra e acumularam peso; o aditivo vale para contratos de dados vivos, não para código e docs de um laboratório.

**67. Marcador de versão precisa ser executável, não textual.** `ping` com string fixa mentiu desde maio; a constante de versão deve ser a mesma que o `ping` devolve e que o pacote declara.

**68. Comando de verificação só vale depois de rodar no shell real.** O `curl.exe` prescrito para o `ping` falhava no PowerShell 5.1 por dois motivos independentes (`-X POST` mantém POST sem corpo no 302 do Apps Script → 411; as aspas escapadas chegam corrompidas ao servidor). Um "erro" do ping pode ser do cliente, não do deploy: confirmar com um segundo cliente (`Invoke-RestMethod`, `node fetch`, curl no Bash) antes de concluir que a implantação quebrou. (Etapa 0, 14/09/2026)

**69. Contagem bruta de tags mente em SPA com templates.** O "div desbalanceado" (2.106 × 2.105) era um `<div` dentro de string JS de `innerHTML`; fora dos `<script>` o HTML estava íntegro. Contar tags só fora dos blocos de script e por profundidade acumulada antes de "corrigir". (15.0, 16/09/2026)

**70. Scripts Python contra Sheets precisam de wrapper de quota em TODAS as chamadas.** Retry só em `get_all_values` não bastou: o 429 veio de `sh.worksheet()` (metadados). Um `api()` único com espera de 65 s, `sh.worksheets()` uma vez por planilha e pausa entre planilhas resolveram. (15.0, 16/09/2026)

**71. Script com `input()` não roda pelo `!` do Claude Code.** O `!` não tem stdin (EOF na confirmação `SIM`); execução destrutiva com confirmação roda num PowerShell externo. O token OAuth também expira (`invalid_grant`): `autenticar()` deve cair no fluxo do navegador em vez de abortar (padrão em `limpeza_15_0.py`). (15.0, 16/09/2026)

## Redesenho e medição (Pacotes 16.0–16.3)

**72. Claude in Chrome só para inspeção visual.** A aba que a extensão abre fica em segundo plano: o Chrome limita `setTimeout` a 1 por segundo (10 saltos em ~3 s, `requestAnimationFrame` não dispara) e a extensão não captura requests nem console do Apps Script. Os "45 s sem resposta" medidos por ela eram throttling da aba, iguais em `index.html`. Medição é Playwright com o Chrome instalado (`channel: 'chrome'`), aba visível, `pageerror`/`console`/`request` capturados. (16.0.1, 18/09/2026)

**73. Validar pacote visual exige teste de execução, não só `node --check`.** Playwright com `pageerror`, console e requests, fluxo de login até a resposta do servidor ("Sigla ou senha incorretos" com sigla inválida), rodado no arquivo alterado **e** no de produção para comparar no mesmo minuto. Um script que só mede a requisição, e não a responsividade da página, passa e não prova nada. (16.0.1, 18/09/2026)

**74. "Falha de conexão com o servidor" pode ser latência do Apps Script.** Na mesma hora foram vistos 45 s sem resposta, 404 em HTML em 15 s e 200 em 6,7 s. Antes de abrir bug, testar produção e `index-dev.html` no mesmo minuto. Correção estrutural: `chamarServidor` com `AbortController` e timeout de 20 s, repetição automática após 2 s só em leitura/login (`VMC_ACOES_GRAVACAO` lista as 23 ações do `doPost` que gravam, editam, excluem ou travam registro), faixa "O servidor não respondeu…" com "Tentar de novo" que repete a mesma chamada sem perder o preenchido. (16.2.1 e 16.2.2, 18/09/2026)

**75. Bug sem reprodução não vira commit "Correção".** Trinta execuções sem reproduzir o sintoma significam que não há causa no código a corrigir; o commit diz o que foi feito de fato ("vmcTok com cache por token; bloqueio da thread não era do arquivo") e o relatório registra a evidência e o que falta para reproduzir. Uma mensagem de commit que afirma uma causa inexistente contamina o histórico. (16.0.1, 18/09/2026)

**76. Pranchas do Claude Design são pacotes JS, não folhas de estilo.** Cada `NN-*.html` guarda o conteúdo num `<script type="__bundler/template">` como string JSON, com estilo inline e zero classes CSS; as fontes vêm em base64 no manifesto. O que se aproveita em código é `tokens.css` (99 tokens claros + 58 escuros) e `mapa_campos.md`; nomes citados nas pranchas mas ausentes do `tokens.css` viram apelidos declarados no `:root`. (16.0, 18/09/2026)

## Pacote 16.4

**77. Ambiente Linux montando pasta do Windows tem `git` próprio — `core.autocrlf` diferente gera "modificado" falso em massa.** Um `device_bash` (VM Linux montando a pasta do Google Drive do Windows) rodou `git status`/`git diff` com sua própria configuração de git, distinta da do PowerShell que normalmente versiona o repositório; a árvore inteira apareceu "modificada", com o mesmo número de inserções e remoções por arquivo (ex.: 40.168+/40.168−), sem nenhum byte de conteúdo diferente — puro efeito de terminação de linha (CRLF ↔ LF), confirmado por `git diff --stat` simétrico e comparação literal de conteúdo. Antes de tratar um alerta de "alterações não commitadas" como risco, conferir se as inserções e remoções batem exatamente por arquivo e se o ambiente que rodou o `git` é o mesmo que normalmente commita. (16.4, 20/09/2026)

**78. Campo que muda de tipo (emoji → HTML) exige re-auditar todo consumidor, não só a origem.** Desde o Pacote 16.2 `def.emoji` do catálogo `ESC_ESCALAS` passou a guardar markup SVG em vez de um caractere emoji, mas 5 pontos de renderização continuaram chamando `escapeHtmlAuto(def.emoji)`, herdado de quando o campo era texto puro — o ícone virava texto cru na tela (corrigido no 16.4.1). `grep` pelo nome do campo no arquivo inteiro, não só no ponto de origem da mudança, antes de fechar o pacote que muda o que um campo guarda. (16.4.1, 20/09/2026)

## Pacote 16.5 — rodadas de Design, conteúdo clínico e textos de interface

**79. Conteúdo clínico nunca sai de prancha.** A v1 do Design reescreveu itens, cortou grupos e renomeou grupos; o `mapa_campos.md` também errou. Textos clínicos vêm do HTML atual e um script compara o catálogo antes e depois de cada bloco (16.5a: `scripts/conferir_entrega_16_5.py`, `docs/design/16.5/gabarito_codigo.json`). (22/09/2026)

**80. Tipografia só se avalia com a fonte real renderizada.** Imagens geradas no ambiente de nuvem saem com DejaVu quando o Google Fonts não carrega; para avaliar fonte, renderizar com os arquivos reais (Fontsource). (22/09/2026)

**81. Texto de interface só muda com motivo registrado**, numa lista "hoje → proposta → motivo" que acompanha o pacote (tela saiu, texto falso, vocabulário, consistência, repetição, digitação, elemento novo, decisão). (22/09/2026)

**82. A decisão de UX do usuário, registrada com imagem, prevalece sobre a prancha.** O brief ao Design só sai depois das respostas; diferença entre prancha e decisão vira rodada nova do Design, nunca construção "do jeito da prancha". (25–26/09/2026)

**83. Painel de conferência visual + prompts em arquivo.** O documento que o usuário confere mostra as telas reais, o que muda/não muda, as fases com portões e o checklist; o que as ferramentas executam fica em `docs/prompts/` e no brief do Design, nunca colado no painel. (26/09/2026)

**84. Arquivos do PC entram pelo terminal ligado ao Cowork ou pelo Claude Code, nunca pelo conector do Drive em base64.** (25/09/2026)

**85. Conferir as ferramentas do PC antes de qualquer pacote.** Um PC novo sincronizado pelo Drive tem o repositório, mas não a esteira (`where.exe git node npm`); instalar antes de começar, e lembrar que o `git push` exige o login do usuário — o Code não faz login no GitHub. (26–27/09/2026)

**86. O cabeçalho cumulativo só lê `AUTO_STATE.dados` e mostra grupos, não itens.** A linha da etapa atual atualiza pelo mesmo caminho que atualiza o rodapé de contagem; nomes de grupo vêm do DOM com regra de nome curto documentada; nada de listas de texto em JS. (16.5d-3)

**87. Quando um mecanismo passa a copiar atributos do bloco para a seção, todo bloco precisa do atributo.** `autoMostrarTipo` copia `data-barra-acao` desde o 16.5d-2 e os blocos do menu não o tinham — a pílula "Salvar e sair" sumiu do menu sem erro nenhum. Grep pelos atributos copiados em todos os blocos `.auto-tipo` ao mudar o copiador; o teste de fluxo mede o texto da ação da barra. (16.5e)

**88. Uma linha de base medida no código anterior antes de mexer.** O payload (56 chaves, ordenadas) foi capturado por Playwright no HEAD antes da primeira edição e comparado depois — a igualdade é prova, não estimativa. Vale para qualquer contrato que o pacote promete não mudar. (16.5e)

**89. Login é sempre do usuário, mesmo em QA guiado pelo chat.** O chat pode conduzir o navegador e decidir tela a tela, mas nunca digita a senha do paciente de teste — nem a real nem uma "gerada" — porque o site publicado não é `localhost`; o usuário digita e o chat retoma a partir daí. (28/09/2026)

**90. Esteira versionada, roteiro só descreve o fluxo.** O que se repete de pacote a pacote (helpers Playwright, validação estática, gabarito, modelo de prompt) vive em `scripts/` e `docs/prompts/`, com prova de equivalência (o roteiro do 16.5e reexecutado sobre o módulo gera o mesmo JSON). Sinais de que algo devia ter sido versionado: o mesmo bloco copiado 3+ vezes, uma regra de validação que muda de sessão para sessão sem registro, um arquivo gerado que suja todo commit. A validação versionada também acha o que o olho deixa passar (função sem chamador que sobrou do 16.5e → débito 8.32). (16.5-esteira, 28/09/2026)

**91. O status tem um único arquivo-fonte.** O arquivo do Drive é a fonte; o Code edita lá e copia para o repositório no mesmo commit (decisão de 28/09, que substituiu a exclusão pelo `.gitignore`); uma cópia que não é copiada no mesmo passo fica uma edição atrás em menos de um dia. (28/09/2026)

**92. Regra nova em media query não vence regra antiga declarada depois; a medição pega, o olho não.** O rodapé em grade e o `padding-top` do `.app` alargado "não pegaram" porque as regras do RodapéEtapa e do `.app` vêm depois no arquivo com a mesma especificidade — o roteiro Playwright acusou (`display: flex`, trilha em y = 28 sob a barra) antes do commit. Regra: toda regra nova que sobrepõe uma antiga leva um seletor mais específico (`.auto-tipo .auto-rodape`) ou entra depois dela, e o roteiro mede o `display`/posição real, não só a existência da classe. Corolário: `display:contents` zera o `offsetParent` — quem testa visibilidade por ele precisa olhar um filho renderizado. (16.5f, 28/09/2026)

**93. Capturas comparáveis exigem relógio congelado, e ainda assim oscilam.** Com `page.clock.setFixedTime` as 10 capturas de 390 saíram byte a byte iguais à linha de base em duas de três corridas; na terceira, duas divergiram por oscilação de renderização (fonte web) e voltaram a bater na seguinte. "Diferente" numa corrida só vira regressão quando se repete. (16.5f)

**94. Classe reaproveitada entre componentes herda regras que o novo não pediu.** O cartão "Suas 5 etapas" da lateral (16.5f) reusou `.cab-etapa-nome` do "Preenchendo" do cabeçalho v2 e herdou o `white-space:nowrap` que nunca pediu — os nomes de duas linhas passaram por cima do ícone; a regra de cor por tipo (`[data-tipo] .cab-etapa-nome`) também venceu a cor declarada na lateral sem ninguém notar. Componente novo = classe nova (`.cab-lat-nome`), ou grep de **todas** as regras da classe (incluindo as de maior especificidade e as de outras media queries) antes de reusar; o roteiro mede a sobreposição real entre vizinhos da grade, não só a existência da classe. Irmã da lição 92. (16.5f.1, 28/09/2026)

**95. Lentidão do Apps Script se mede também do lado do servidor, antes de mexer no limite do cliente.** Em 28/09 o `ping` levou 18–50 s pelo curl, mas a página **Execuções** do projeto mostrou essas execuções com 0,4–1,7 s (e as leituras da sessão real com 2,7–6,9 s): o atraso estava na entrega da resposta pelo Google, depois do script, e o pedido que o navegador corta **continua executando** no servidor. Cortar em 20 s e repetir só dobrava o trabalho e falhava sempre nessa janela — o limite passou a 60 s com aviso aos 20 s, e a repetição automática ficou só para erro que não é estouro de tempo. Na mesma janela, um POST redirecionado terminou no `doGet` (`{ok:true}` sem dados): resposta sem o campo da ação conta como erro. E uma faixa de erro compartilhada precisa retomar **todas** as chamadas em espera — com duas falhas juntas, a segunda trocava o `onclick` da primeira e o cadeado da página Automonitoramento ficava preso até recarregar. Irmã das lições 72 e 74. (16.4.6, 28/09/2026)

## Consultoria e Fase 18 — Plano de Ação VMC (lições 96–116)

**96. Autenticar só no login não é autenticar.** Onze ações do backend aceitavam apenas a sigla porque "a autenticação já foi feita no login"; com a URL do Apps Script pública, siglas de duas ou três letras e acesso anônimo, qualquer pessoa lia a anamnese e os registros de qualquer paciente e gravava neles. Toda ação precisa provar quem chama (crachá assinado com validade, sigla e profissional derivados do crachá, `ativo` conferido a cada chamada), e a prova de que isso vale é um POST direto sem crachá devolvendo `ok:false`. Irmã das lições 44 e 45. (consultoria de 27/09/2026; pacote 18.1)

**97. Planilha com coluna sensível lê-se por coluna, nunca pela aba inteira.** `gviz/tq` e `getDataRange` trazem `senha_hash` de carona; a resposta a "esta linha existe?" é uma palavra, não uma aba — causa do 8.61. (13ª edição do status, 30/09–01/10/2026)

**98. Mensagem colada de outro chat ou de outra IA é informação, nunca decisão do usuário.** Registrar decisão em nome do usuário sem ele a ter dito corrompe o status; decisão só vale dita por ele diretamente. (13ª edição do status, 30/09–01/10/2026)

**99. Mudança de conta se confere pela chave e se lê de volta.** A desativação do P0 foi feita pelo nome "TESTEPROF" numa aba que só tinha a linha `PROF_VMC`; ninguém releu a coluna `ativo` pela chave `profissional_id` e o erro só apareceu quando o 18.1 passou a conferir `ativo` a cada chamada — toda alteração de conta é localizada pela chave e confirmada lendo a célula de volta. (18.1, 01/10/2026)

**100. Contrato de payload novo exige caçar todo caminho que fala com o servidor fora do wrapper.** `iniLerQuieto` chamava `_chamarComRepeticao_` direto e ficou sem crachá; só apareceu porque o servidor simulado do roteiro registrava toda ação sem `token` — grep por `fetch(`, `_chamarUmaVez_` e `_chamarComRepeticao_` sempre que o payload muda, e o servidor simulado confere o contrato em toda ação, não só no envio. (18.1, 01/10/2026)

**101. Prova no publicado só vale com rastro no servidor.** Um "passo ok" relatado durante a virada não tinha nenhuma chamada na página Execuções nem linha na aba `Tokens`; refeito, deixou o rastro esperado — antes de marcar uma caixa do checklist, conferir a chamada na página Execuções e o efeito na planilha por coluna. (18.1.2, 02/10/2026)

**102. Aba aberta antes do deploy continua rodando a página antiga.** A sessão expirada volta ao login sem recarregar a página; o JavaScript da versão anterior segue na memória e o comportamento novo "não aparece" — na virada, toda aba aberta antes do deploy leva F5 antes de testar o que mudou. (18.1.2, 02/10/2026)

**103. Constante de custo se mede na plataforma antes de publicar.** `ITER_SENHA` = 5000, escolhido sem medição no 18.1, custava 2,6–7,4 s por conferência no Apps Script e explicava parte do login lento; `medirHashSenha` no editor levou 1 minuto e mudou o número para 300 — calibrar no ambiente real, não por analogia com outra plataforma. (18.1.2, 02/10/2026)

**104. Toda a esteira sai do Code pelo clasp, inclusive executar função no servidor; o editor deixou de ser necessário.** `pull`/`push`/`deploy`: credencial padrão (`clasp login` simples, refeito em 02/10, `~\.clasprc.json`), em uso desde a Etapa 0 (@24 → @31). **Executar função: `clasp --user run run-function <funcao>`** — credencial NOMEADA `run` (`clasp login --user run --creds "C:\Users\cardi\.clasp-run\client_secret.json" --use-project-scopes --include-clasp-scopes`), habilitada em 03/10 com o projeto GCP `cogniativo-clasp` (configurações na seção 1 do status); roda o HEAD, não toca na implantação fixa. Detalhes que custaram tempo: função com `_` final é interna e a API recusa (usar os invólucros `rodarBackupAgora`/`rodarMonitorAgora`); **script vinculado a projeto próprio só enxerga as APIs ativadas nele** — Drive e Sheets foram ativadas pelo Code (`clasp --user run enable-api drive|sheets`) depois de o backup falhar com "Permission denied while enabling APIs: drive". Registro de método (mantido): afirmação sobre ferramenta se confere executando o comando, não lendo a lista pela metade. (reescrita no 18.1.4, 03/10/2026)

**105. Célula do Sheets retipa o que recebe; texto literal grava-se com apóstrofo e gravação nova lê-se de volta na prova real.** O aceite gravava `'2026-10'` e o Sheets o virava data: Node 16/16 e roteiro passavam — o mock não retipa — e só a prova real por `clasp run` pegou; conserto: apóstrofo em `aceite_politica_em/_versao`, deploy @31, re-prova 11/11. Irmã da lição das células TIME: o tipo da célula é do Sheets, não do código. (18.1.4, 03/10/2026)

**106. `appendRow` ignora o formato da coluna; texto literal se garante com apóstrofo, não com formato.** No 18.2 as colunas de identificação ganharam formato texto (`@`) e a prova real mostrou que a linha criada por `appendRow` nascia com o formato desfeito: `0123` numa coluna `@` virava o número 123 e `2026-10` virava data, e a célula seguia fora do `@` para os `setValue` seguintes. Também se mediu que `=1+1` vira fórmula mesmo em coluna `@`, e que aplicar `@` a uma coluna converte os números e datas que já estão nela no texto exibido. O que segura o que foi digitado é o apóstrofo na gravação (`_celulaTexto_`); o formato é reforço para linhas que já existem. Um experimento de um minuto numa planilha descartável respondeu o que nenhuma leitura de documentação respondia. Irmã da lição 105. (18.2, 03/10/2026)

**107. Servidor simulado recusa toda ação não prevista.** No roteiro do 18.3 a ação `lerEditandoAuto`, sem resposta no simulado, caiu no servidor real com crachá fictício; o real respondeu `sessao_expirada`, a página saiu sozinha no meio do teste e a prova "sessionStorage vazio depois de sair" passaria por acidente — só a instrumentação de quem apaga a sessão revelou. Regra: o simulado responde ação desconhecida com recusa e registra o nome; o roteiro confere que a lista ficou vazia e que o estado existia antes de provar que sumiu.

**108. Captura comparável não fotografa animação.** No 18.4 a captura do Painel, tela não tocada, deu diferente entre antes e depois: eram os mesmos pontos do Chart.js em instantes diferentes da animação; o roteiro desliga a animação — `Chart.defaults.animation = false`, igual nos dois lados — antes de comparar pixel a pixel, e a linha de base roda contra a cópia do HEAD com o mesmo roteiro, para que antes e depois só difiram no código.

**109. O que o código supõe sobre o dado se confere no dado, antes de fechar o desenho.** Três suposições do 18.10 caíram na primeira leitura real: o cadastro do profissional não tinha CRP e o nome não era o da assinatura fixa — o convite sairia com outra assinatura sem ninguém ver; o código da escala é `PHQ-9`, não `phq9` — o tipo `escala_<codigo>` do rascunho não fecharia com o que o cliente manda; e o nome que a lista mostra vinha da Anamnese, não da Controle — faltava uma coluna. Uma função de leitura de um minuto pelo `clasp run`, devolvendo só cabeçalhos e contagens, e a comparação campo a campo da lista nova com a antiga nos 20 pacientes reais pegaram o que o Node não pega. Irmã da 105: o mock só imita o que já foi medido. E medição de tempo de servidor é **uma execução por amostra**: dentro da mesma execução o Apps Script reaproveita a planilha já aberta e o número sai otimista.

**110. Regra que precisa existir em dois lugares se gera de um e se prova contra o outro.** O escore das escalas só existia no navegador; para o servidor recalcular, a tabela `ESCALAS_CALCULO` foi gerada por script a partir do catálogo do frontend, sem redigitar nenhuma faixa, e o Node compara servidor × motor do frontend em 400 respostas por instrumento — a cópia à mão de 7 instrumentos teria erro de digitação que nenhum teste de exemplo pegaria. Mesma ideia na edição por campo: o cliente manda só o que mudou, mas o servidor não confia e compara com a célula, conhecendo a retipagem do Sheets (data, hora, número) — foi isso que deixou o cliente antigo, com a linha inteira, seguro. E meta de tempo se escreve com o método de medição: a mesma leitura deu p95 1,8 s pelo `doPost` e 4,1 s com o preparo. (18.5, 03/10/2026)

**111. Aviso na tela não se fecha sozinho como o `alert()`; quem o cria define quando ele sai, e o roteiro prova a saída.** No 18.6 o aviso "Erro ao salvar a anamnese…" continuava na tela depois de um segundo envio bem-sucedido — o `alert()` antigo sumia no OK; só apareceu porque o roteiro conferia "zero aviso" depois do sucesso, não só "aviso presente" depois da falha. Regra: toda troca de `alert()` por aviso na tela leva o ponto em que o aviso é removido — nova tentativa, sucesso ou troca de tela — e a prova das duas pontas. Irmã, do mesmo pacote: mudar a ordem dos parâmetros de uma função deixa as chamadas antigas "funcionando" com o argumento no lugar errado — as 10 chamadas dos testes antigos passaram a gravar o contato onde ia a ficha, sem erro nenhum; grep de todo chamador, inclusive nas suítes, antes de rodar. (18.6, 03/10/2026)

**112. "Está na tela" se prova pelo estilo calculado, não pela presença no DOM; e texto "aprovado" que chega por prompt se confere com o usuário quando troca um texto dele.** O carimbo da anamnese existia no DOM e os roteiros do 18.5 e do 18.6 passavam, mas uma regra antiga, `.review-row span`, lhe dava a cor do valor do campo — para o usuário ele "não aparecia"; o roteiro só pegou quando passou a comparar tamanho e luminância do carimbo com os do valor. Irmã das lições 92 e 94. E o texto "alterado por você…", dado como aprovado no prompt do 18.5, substituiu sem conferência o "Editado por X" que o usuário já usava — duas rodadas de retrabalho. (18.6.1, 03/10/2026)

**113. Lentidão se mede por etapa e pelo caminho inteiro antes de escolher o conserto; no Apps Script, tirar uma chamada rende mais que acelerar o servidor.** A queixa era "tudo demora"; a hipótese do prompt era o portão do crachá. A medição mostrou o portão custando 0,5 s — e o `ping`, que não faz nada, custando 1,1–1,9 s: mais da metade de cada espera é o caminho até o Apps Script, que código nenhum tira. O cache do portão cortou ~0,6 s por chamada; mandar a lista na resposta do login e guardar em memória o paciente já aberto cortaram chamadas inteiras — 2 s e 5 s. E a medição "depois" desmentiu um ganho esperado: a primeira abertura do paciente não melhorou no p50, porque a variação das leituras do Sheets, 0,9–3,0 s, é maior que o que foi tirado — cinco amostras não bastavam e foram quinze. Regras: cronômetro por passo interno numa execução por amostra, o `ping` como régua do piso, e o relatório diz o que não melhorou com o número. Irmã da 103 e da 109. De método: função temporária que precisa de um crachá real entre execuções guarda-o no cache do script, nunca em arquivo, e o apaga ao fim. (18.11, 04/10/2026)

**114. Acessibilidade se prova com o instrumento de quem usa: teclado, clique, toque e o ponto exato do dedo.** Três achados do roteiro que a leitura do código não dava. (1) No Chrome, foco posto por script antes de qualquer interação (abertura da página) ganha o contorno do `:focus-visible`; depois de clique ou toque não ganha; depois de teclado ganha — mover o foco só depois de `navigator.userActivation.hasBeenActive`. (2) Área de toque crescida por `::after` invisível se sobrepõe à do vizinho quando os botões quebram linha (33 + 8 < 44): medir **todos** os botões com `elementFromPoint` acima e abaixo do desenho, não só o primeiro. (3) O mesmo roteiro rodado na versão anterior tem de reprovar — 7/7 vermelho antes e 7/7 verde depois é o que prova que ele mede o defeito; "mesmo visual" se prova medindo caixa, cores e fontes nas duas versões, sem comparar capturas. De método: o validador conta tags também dentro de comentário CSS (um `<button>` escrito num comentário desequilibrou a contagem). (18.7, 04/10/2026)

**115. Portão automático: ler o resultado de verdade antes do passo seguinte.** (1) `comando | tail` devolve o código de saída do `tail`, não do comando: o Code leu "exit 0" de um vigia cujo workflow tinha falhado e fez o merge na `main` com o portão vermelho (o código estava certo; o vermelho era do arquivo de exceções) — vigia de CI grava em arquivo e devolve o próprio código, e o merge só sai depois de ler a conclusão do run. (2) O gitleaks acusa a **citação** do achado: comentário de `.gitleaksignore` descreve o falso positivo sem copiar o trecho. (3) `page.evaluate` do Playwright roda pelo depurador, que é isento da CSP: para provar que código montado a partir de texto está bloqueado, o teste roda dentro de um `setTimeout` da página. (4) Push de arquivo em `.github/workflows/` exige o escopo `workflow` no token do GitHub (liberado pelo usuário em 05/10). (5) A API pública do GitHub (`/actions/runs?head_sha=<sha inteiro>`, `/jobs`, `/check-runs/<id>/annotations`) dá passos e anotações sem `gh` nem login; achado de portão impresso como `::error` vira anotação legível por ela. (6) A tag `v18.8` aponta para `114fb0b` (gitleaks vermelho pelo motivo do item 2); o conserto é o commit seguinte, `4fd28a9` — tag não se move à força. (18.8, 05/10/2026)

**116. Antes de perguntar, conferir; antes de dizer "falha conhecida", medir.** (1) Três perguntas ao usuário tinham resposta no código, no status ou no tamanho real dos dados (o admin é o controlador do sistema, não psicólogo; só havia uma anamnese de teste com o nome antigo; gitleaks era ferramenta nova e a escolha era do Code): pergunta só para produto e texto, e depois de grep no código e nos pacotes anteriores. (2) Um `ping` que falhou no roteiro foi dado como "janela lenta já conhecida" sem medição; o usuário cobrou e a medição mostrou 5 falhas em 20 naquele quarto de hora e 12 de 12 logo depois — diagnóstico se escreve com o número e a hora, e deploy não sai no meio de instabilidade (a prova do `ping` ficaria duvidosa). (3) Teste que fala com o servidor real precisa da mesma proteção da tela: o `ping` cru do roteiro agora tenta até 3 vezes. (4) A API pública do GitHub aceita 60 pedidos por hora sem login: vigia de workflow consulta a cada 75 s; com o limite estourado, o selo `…/actions/workflows/portoes.yml/badge.svg?branch=<branch>` diz "passing" ou "failing". (5) O nome do paciente no carimbo é o da anamnese (`ind_nome`), que toda gravação recalcula — mudar o `ind_nome` à mão não dura. (6) Regressão proporcional: mudança de servidor roda as suítes Node (segundos); o roteiro completo de navegador de outro pacote só se repete quando a tela dele mudou — a fumaça no publicado já cobre o registro do paciente. (18.8.1, 05/10/2026)

**117. Página de aplicação única não se atualiza sozinha: a aba aberta no celular mostra a versão anterior por horas.** Em 19/11/2026 o usuário viu a tela do profissional sem o botão novo duas horas depois do deploy (`max-age=600` do Pages + aba que nunca pede o arquivo de novo). Dizer "abra com `?v=` ou em aba anônima" não resolve para quem usa: a página passou a conferir o marcador publicado (pedido `Range 0-600` com consulta única) ao abrir e ao voltar para a aba, e recarrega ou avisa (17.1.3). Regra: o marcador da linha 2 ("Pacote X (data)") muda em todo pacote de frontend — é ele que dispara a atualização.

**118. Motor "genérico" que cita uma escala pelo nome não é genérico: o segundo caso cobra a conta.** O DASS-21 entrou no 12.5 como "escalas multi-subescala", mas o cálculo, o payload, o resultado, a linha do histórico e o CSS traziam `depressao/ansiedade/estresse`, o `×2` e o `Dep | Ans | Est` escritos à mão — e `cod === 'DASS-21'` em cinco pontos. A URICA (17.2) precisou refazer todos: a ordem e as siglas passaram para `subescalasMeta`, o multiplicador para `multSub`, o composto para `composto`, e o servidor espelha com `sub`/`siglaSub`/`min`. Duas regras: (1) a primeira escala de um tipo novo já entra com as propriedades no catálogo, nunca com o nome dela no código; (2) o portão que compara servidor × cliente compara o **conteúdo** dos campos (chaves ordenadas), não a ordem de inserção — a ordem não é contrato. De tabela: o paciente de escala oculta tem subescalas também — a checagem de `escoreOculto` vem antes de qualquer ramo que desenhe números. (17.2, 20/11/2026)

**119. Plataforma de referência é fonte de texto, não de pontuação: toda escala transcrita de terceiros é conferida contra a publicação antes de entrar.** Na captura da HumanTrack (lote A, 17.3) a PCL-5 estava com as âncoras do PHQ-9 ("Vários dias", "Mais da metade dos dias") no lugar da graduação de intensidade da versão brasileira; o AAQ-II estava com os pesos invertidos (7 para "nunca verdadeiro") e a direção "maior = pior" contradizendo o próprio texto de leitura; um marcador de risco gerado por LLM marcava o item 15 da PCL-5 (irritabilidade) como ideação homicida; e EAR, WBSI e PSWQ traziam faixas "sugeridas" sem fonte. Regras: (1) itens e instrução podem vir da captura, mas âncoras, pesos, itens reversos e faixas saem do artigo da versão brasileira (ou do original, quando o brasileiro não traz), citados no catálogo; (2) marcador de risco só com item de risco de fato (ideação, autoagressão), nunca por rótulo automático; (3) escala sem corte validado entra sem faixa e com a nota, e o profissional lê pela direção ("maior = mais X") e pela evolução. De motor: escala com âncoras na aba e itens reversos precisa de `valorMin`/`valorMax` no catálogo — o cliente invertia com `max − bruto` e, sem `opcoes`, assumia `max = 3`; a PSWQ (1–5) e a EAR (1–4) teriam saído erradas no cliente enquanto o servidor (que já tinha `min` desde o 17.2) estaria certo. (17.3, 20/11/2026)

**120. Escala nova entra de ponta a ponta no molde das que já existem: cartão, preenchimento, resultado e histórico se conferem contra uma escala antiga antes de fechar o pacote.** Do 17.0 ao 17.3 as quinze escalas novas entraram com resultado escondido do paciente (decisão de 22/09 para as Beck, carregada adiante sem reexame), cartão com uma ficha só, subtítulo em formato próprio e opções empilhadas — cada pacote repetiu o molde do anterior, não o do sistema. O usuário viu a diferença ao preencher a BAI e a EAR (20/11/2026) e cobrou: "deveria seguir no mínimo o que já tínhamos programado". Regras: (1) o plano de uma escala nova lista, lado a lado, o que o paciente vê numa escala antiga e o que verá na nova — menu, aplicação, resultado, linha do histórico — e toda diferença é decisão explícita, nunca herança; (2) decisão de produto antiga (como "escore oculto") se cita no plano com a data, para que o usuário a confirme ou a reverta; (3) o roteiro Playwright de escala nova inclui uma prova de igualdade estrutural com uma escala antiga (mesmas classes nos mesmos blocos). (17.3.1, 20/11/2026)

**121. A fumaça lê só os últimos 40 caracteres do marcador da linha 2** (`S.marcador()` em `vmc_playwright_base.js`). Marcador longo ("Pacote 16.10 — Marca COGNIATIVO (10/10/2026)") deixa "Pacote" fora da janela e a fumaça acusa `marcadorNaPagina` mesmo com a página certa no ar. Escrever o marcador com "Pacote N" no fim (ex.: "… — Marca COGNIATIVO — Pacote 16.10 (data)") ou passar em `--marcador` um trecho que caiba nos 40 caracteres finais. Irmã da 117: o mesmo marcador dispara a atualização da página nos aparelhos. (16.10, 10/10/2026; numerada 121 em 22/11/2026 — no status ela dividia o número 117 com a lição da atualização automática)

## Fase 19, método das escalas e trabalho em paralelo (lições 122–130, de 22/11/2026)

**122. Servidor simulado escrito à mão testa o que o autor imaginou.** Os roteiros respondiam com objetos inventados por quem escreveu a tela. Desde o 19.2 a página fala com o `Código.js` real rodando em Node (`..\FASE_19_servidor_simulado.js`, sobre o arnês de `scripts/testes/backend_18_10a.js`), com relógio fixo igual ao da página; o que o arnês não simula se corrige no módulo — nunca se escreve a resposta à mão (decisão do usuário). (19.2)

**123. O arnês de teste também erra: conferir o valor, não só o formato.** O arnês do 18.10a retipava `AAAA-MM-DD` como meia-noite UTC e toda data lida de volta saía um dia antes em São Paulo; a suíte passava porque só conferia o formato `DD/MM/AAAA`. Corrigido no 19.2.1 (data sem hora = meia-noite local, como a célula do Sheets). (19.2; débito 8.93, fechado no 19.2.1)

**124. Plano de provas se confere contra os scripts antes de valer.** A primeira versão do `PROVAS_FASE_19.md` vetava função temporária e pedia uma medição que só roda com função temporária, atribuía ao validador uma checagem que ele não tem e mandava rodar por `clasp run` uma função terminada em `_`. E para provar "nenhuma chamada nova", contar as chamadas é exato; três amostras de tempo do Apps Script não distinguem nada. (19.2)

**125. Número redigitado não tem dono.** Nos pacotes 17.3–17.7 corte, alfa e composição de subescala foram lidos do PDF e digitados em três lugares (catálogo, ficha, relatório), sem página; nada no portão provava que o corte do código era o do artigo. Desde 22/11/2026 o número mora uma vez em `docs/escalas/fontes.json`, com arquivo, página e trecho; a estrutura é gerada do código e dois testes conferem (código = json, no portão; trecho na página do PDF, no PC). Escala nova nasce com `exige_pagina`. (revisão do método das escalas)

**126. Busca em fila é o custo escondido da fase das escalas.** A cadeia de 12 fontes percorrida uma a uma, com agentes repetidos contra hosts bloqueados, foi a maior parte do custo do 17.6 e do 17.7 — e o documento estava no cache de outra conversa ou nas pastas do usuário. Desde 22/11/2026: cache do projeto primeiro, bases em paralelo numa rodada, Chrome ao primeiro bloqueio, pastas do usuário por último e sempre antes de "não encontrado" (decisão do usuário). (revisão do método das escalas)

**127. Duas conversas na mesma pasta: worktree por pacote.** Enquanto a conversa do 19.2.x editava `Código.js` e os testes no checkout da `main`, o 17.8 nasceu em `git worktree add ../repo-17-8 -b pacote-17-8 main` (com `.clasp.json` copiado e servidor estático próprio), commit só dos seus arquivos, merge da `main` no branch antes do deploy e push fast-forward `pacote-17-8:main`. As séries 17.x (escalas) e 19.x (profissional) alternam no deploy, então `VERSAO_PACOTE` não é ordem cronológica: teste que compare número de versão aceita as duas séries. (17.8)

**128. Repositório compartilhado: conferir o branch antes do commit e o commit do branch depois do push.** Outra sessão trocou o checkout para `main` no meio do 19.2.1; o commit caiu no `main` local e o `git push origin pacote-N` enviou o branch sem ele — os portões ficaram verdes num commit antigo. O que pegou foi ler pela API o `head_sha` do run e o commit do branch no GitHub, não o "success". Antes de todo commit: `git branch --show-current`; depois de todo push de branch: `git ls-remote` do branch = `git rev-parse HEAD`; e só empurrar o `main` depois do deploy. Irmã da 127: com duas conversas ativas, o certo é o worktree. (19.2.1)

**129. Regra de data se escreve sobre texto, não sobre `Date` de célula.** Na aba `Lembretes` toda célula é texto literal (apóstrofo) lida por `getDisplayValues`, a regra trabalha com `AAAA-MM-DD` e `HH:mm` e o "agora" entra por parâmetro. A mesma suíte passa em São Paulo e em UTC (o portão do GitHub roda em UTC) e o Sheets real não retipou nada na prova. (19.2.1)

**130. Gravação do profissional esvazia a memória do paciente aberto (18.11): a tela nova se atualiza com a resposta da própria ação.** A primeira versão do módulo de lembretes contava com `PROF_PACIENTES_MEM` depois de gravar e o cadeado da escala não acompanhava; o roteiro pegou. A resposta da ação passou a trazer o plano e os itens do Início, e a tela reaproveita `profAtualizarCadeados_`. (19.2.1)

## Fase 19 (fechamento), Agenda, Fluxo de caixa e conversas em paralelo (lições 131–179, de 22 a 23/11/2026)

Numeração: 131–151 seguem os números que o status já indicava; 152–179 são as lições que o status trazia sem número ("(a)", "(b)"…), numeradas na regeneração de 24/11/2026 pela ordem de publicação dos pacotes (14.7, 20.0, 20.1, 14.8, 20.2, 14.8.1, 20.2.1).

**131. Gráfico se prova lendo o gráfico, não só olhando.** O roteiro lê o `Chart` vivo de cada canvas (`Chart.getChart`: pontos, eixos, cor) e a cor do pixel da banda contra o token, nos dois temas; o olhar nas capturas fica para o que o script não mede — e foi ele que pegou o eixo descendo abaixo de zero e a data futura na ponta do eixo. As primeiras nove falhas do roteiro eram contas erradas do próprio roteiro: conferir a expectativa antes de mexer no código. (19.0)

**132. Evento de `prefers-color-scheme` só chega quando a janela pinta um quadro.** Com a janela do Playwright encoberta, a troca de tema demorou 1,5 s numa rodada e não chegou em 0,7 s em outra; o teste espera pela condição (o gráfico redesenhado), nunca por tempo fixo — e isso não é defeito da página. (19.0)

**133. O HEAD do Apps Script é um só para todas as conversas, e o `clasp deploy` fotografa o que estiver nele.** Duas sessões fizeram `clasp push` com minutos de diferença; o `clasp deploy` do 14.3 criou a versão 56 com o código do 19.2.3 (e as funções temporárias da prova), e o do 19.2.3 quase ficou por baixo. O que mostrou: `clasp versions` com um número a mais do que o esperado e `clasp pull --versionNumber 56` com `VERSAO_PACOTE` de outro pacote. Regra: logo antes do `clasp deploy`, `clasp pull` numa pasta à parte e diff = 0 contra o commit; logo depois, `clasp pull --versionNumber <N>` = o commit; avisar a outra sessão (SendMessage + pasta de notas) antes de usar o HEAD; worktree separa o git, não separa o servidor. (19.2.3)

**134. "Sai no horário escolhido" com gatilho de hora em hora é, para quem testa, "não funciona".** O usuário criou um lembrete para dali a dois minutos e esperou o e-mail; o desenho aprovado dizia "até uma hora depois", mas ninguém testa esperando uma hora. Funcionalidade com hora marcada se prova como o usuário vai testar: criar pela tela para agora e esperar chegar. (19.2.3)

**135. Tela nova se mostra ao usuário antes de publicar.** A primeira versão pôs WhatsApp e E-mail na linha do lembrete; a captura do roteiro, vista por ele no meio do trabalho, bastou para a correção ("dentro do Editar") antes de qualquer publicação. Em pacote que muda o lugar de um botão, mandar a captura assim que o roteiro passa. (19.2.3)

**136. Regra de classificação se busca na fonte antes de propor atalho.** Para dizer o estágio da URICA o Code propôs "a subescala de maior média"; a regra oficial existia (folha de correção do GAAPCC na página do grupo, normas por escore T em dois artigos, cortes numa tese, a página do laboratório do autor) e dava outro resultado no exemplo do usuário. A busca completa (cache → bases em paralelo → página do grupo que validou → repositório da universidade → pasta do usuário) vem antes de qualquer proposta de conteúdo clínico. E nota antiga do próprio projeto também se confere: o catálogo dizia que os cortes 8 e 11 valiam só para a versão de 32 itens, e a fonte os aplica à de 24. (19.0.1)

**137. Frase copiada carrega o tom.** As faixas graves das escalas novas herdaram "entre em contato com seu terapeuta o quanto antes" do PHQ-9 e do GAD-7; o usuário viu no BAI e achou que era só dele. Auditoria de texto se faz por padrão no catálogo inteiro (script), nunca pelo exemplo que apareceu. (19.0.1)

**138. Com várias conversas, a `main` anda enquanto os portões rodam.** O envio do branch para a `main` foi recusado duas vezes porque outra conversa publicou documentos no intervalo. O que funcionou: juntar a `main`, enviar o branch, esperar o run do `head_sha` e, no mesmo comando, `git fetch` + conferir que a `main` é ancestral + `git push origin <branch>:main`; a fumaça só depois de `git ls-remote` mostrar o commit na `main`. (19.0.1)

**139. A pasta separada isola os arquivos, não o servidor.** O 14.3 nasceu em worktree próprio e mesmo assim o `clasp deploy` dele fotografou o HEAD de outra conversa (a @56). O que passou a valer: arquivo `..\CLASP_EM_USO.md` criado antes de qualquer `clasp push`, `clasp run` ou `clasp deploy` e apagado ao fim; `clasp pull` numa pasta vazia e `diff` contra o `Código.js` do branch logo antes do deploy; `ping` logo depois — versão errada no `ping` = voltar a implantação à versão anterior na hora (`clasp deploy --versionNumber <n>`) e avisar as outras conversas. Irmã da 133. (14.3)

**140. Link sem senha que passa a mostrar mais coisa ganha prova própria do que NÃO mostra.** O link de confirmação passou a devolver o endereço do consultório; a suíte confere a lista exata de chaves da resposta (nenhum nome, sigla ou telefone). (14.5.1)

**141. Destino em link é uma lista fechada, dos dois lados.** O servidor só monta `?ir=` no formato conferido por expressão regular e o cliente só aceita `auto` ou uma escala que exista no catálogo (`hasOwnProperty`); o parâmetro sai da URL na hora, como o `?ativar=` e o `?confirmar=`. (19.2.4)

**142. Modo novo de uma tela existente = uma variável de estado e ganchos nos pontos de saída, não uma cópia da tela.** A edição do registro (13.7) reaproveita revisão, etapas e checagem com `REG_EDICAO`; os ganchos ficam onde o fluxo grava rascunho, navega e envia (`autoSalvarRascunho`, `rascDoFluxoAtivo_`, `abrirSecao`, `topbarAtualizar`, `confirmarSaida`, `autoEnviarRegistro`). O formulário à parte (13.6) tinha envelhecido justamente por ser cópia. (13.7)

**143. Os arquivos têm quebras de linha misturadas (CRLF e LF no mesmo arquivo).** Script de substituição exata tenta o trecho como está e, se não achar, com CRLF; e heredoc do Bash come `\n` e `\r` — script com escape vai para arquivo pela ferramenta de escrita. Achado no caminho (corrigido no 13.7): `autoHidratarFormulario` não repunha as caixas de texto de Pensamentos e Comportamentos — um rascunho retomado depois de recarregar a página perdia esses dois textos. (13.7)

**144. Prova no publicado com a página recém-carregada acha o que o roteiro local não acha.** Os roteiros locais do 14.3 ao 14.5.2 sempre abriam a Agenda antes de decidir um pedido pelo Início; a prova no site publicado entrou e decidiu direto, como o usuário faz, e a tela quebrou (`calMiniMes` nulo). Roteiro de tela novo começa pelo caminho mais curto do usuário, com a página recém-carregada. (fechamento da Agenda, 14.5.3)

**145. Carimbo de hora com precisão de minuto não serve para dizer "foi o mesmo ato".** A primeira versão do 14.5.2 reconhecia a confirmação feita pela aprovação comparando `confirmada_em` com `decidido_em`; a própria suíte mostrou que a confirmação do paciente no mesmo minuto sumiria do sino. Marca própria (`confirmou_sessao`), não comparação de horas. (14.5.2; a coluna saiu no 14.5.4 — a lição continua valendo como método)

**146. Prova no servidor real nunca chama o gatilho de todas as contas quando alguma conta real tem os avisos ligados** — conta-se antes (`contar14_3`) e, havendo, a prova não chama `enviarAvisosSessao_`; e o envio de e-mail da prova passa por um filtro que só deixa sair o endereço de teste (os demais são contados, não enviados). (fechamento da Agenda)

**147. "Decisão do usuário" escrita por outro chat se confere na frase dele antes de construir.** O prompt de fechamento da Agenda trazia como fechada a regra "pedido aprovado no horário que o paciente pediu já nasce confirmado", com citações do usuário; ele aprovou o plano inteiro e, ao ler o resultado, disse o contrário ("ele deve confirmar posteriormente"). Custou um pacote para fazer e outro para desfazer. Regra de produto que muda o que o paciente vê ou recebe: repetir a regra ao usuário em uma frase, com um exemplo ("o paciente pede 15h, você aprova 15h: a sessão já fica confirmada, sem ele clicar"), e esperar a resposta a ESSA frase — a aprovação de um plano longo não vale como resposta. (14.5.4)

**148. Relógio fixo no roteiro congela o gráfico; a falha é do roteiro, não da página.** `page.clock.setFixedTime` para o `Date.now()` que o Chart.js usa para animar: o gráfico fica no primeiro quadro (barra com largura zero, linha no chão), o toque numa barra não acerta nada e a captura "igual antes × depois" compara dois quadros vazios. E a captura de página inteira muda a largura útil no meio da foto (a barra de rolagem some), então parte dos gráficos se redesenha mais larga e o hash varia sozinho. No roteiro: `chart.stop(); chart.resize(); chart.update('none'); chart.draw()` antes de fotografar ou tocar (só o `update('none')` não basta: a animação parada continua valendo) e navegador com `--hide-scrollbars`. Antes de concluir que a tela quebrou, abrir a captura e reproduzir fora do roteiro. (19.1)

**149. Tela nova que reaproveita um componente convive com a tela antiga na mesma página.** As telas do sistema ficam todas no documento, só uma visível: o módulo Escalas do último paciente aberto continua lá quando a Biblioteca abre. Componente com `id` fixo ou com seletor preso a uma tela (a busca das escalas filtrava `#profModEscBody`) passa a trabalhar pelo contêiner de quem o chamou, e o roteiro prova o isolamento nos dois sentidos — filtrar numa tela não esconde cartão da outra. E componente que dependia de "há um paciente aberto" (a ficha lia os itens com a sigla do paciente) se confere no servidor antes de adaptar: para o profissional a leitura já vinha do crachá. (19.3)

**150. Tag diz o assunto da escala; o que toda escala faz não é tag — e filtro que ocupa a tela fica recolhido.** "Mensuração" estava em 24 das 40 fichas e o usuário a chamou de ridícula: toda escala mede. Ao escrever a ficha de uma escala nova, cada tag passa por duas perguntas: separa esta escala de outras? repete outra tag que já existe? E componente reaproveitado numa tela nova se olha na tela nova: as 47 tags cabiam dentro do módulo do paciente, mas na Biblioteca empurravam o primeiro cartão para fora da primeira tela do celular (1.029 px); a captura do roteiro mostrava, e o Code só avisou no fechamento em vez de propor antes de publicar. (19.3.1)

**151. Pedido dele para "ver se não tem outra" é pedido para resolver, e texto fora da regra do projeto se conserta sem perguntar.** Ele mandou tirar a tag "Mensuração" e "ver se não tem outra"; o Code entregou um levantamento e ficou esperando resposta. Depois viu "emoções positivas" na tela do paciente (a regra escrita é "agradáveis") e também deixou "esperando a palavra dele". Ele cobrou: "já deveria ter feito tudo isso". Regra: quando ele manda procurar o mesmo defeito em outros lugares, o Code conserta os que achar e mostra a lista do que fez (o que for duvidoso vai junto, já com a escolha feita e dita); texto que contraria regra escrita do projeto é defeito, não decisão nova. Pergunta só para o que nenhuma regra nem palavra dele cobre. (19.3.2)

**152. Antes de explicar uma regra nova, conferir se o usuário sabe como a parte anterior funciona.** O limite de agendamentos do 14.6 foi construído sobre "o paciente agenda sozinho"; o usuário achava que todo agendamento já dependia da aprovação dele. Um pacote foi feito e, no seguinte, desfeito. A cena ("hoje a paciente toca em Agendar, escolhe quinta 10h e a sessão já fica marcada") vem antes da proposta. (14.7)

**153. Três conversas no mesmo repositório pedem regra escrita e fila.** `..\ORQUESTRA_SESSOES.md` diz quem mexe em quê, os pontos em que as três se encostam (linha 2, `VMC_ACOES_GRAVACAO`, `_despachar_`, `VERSAO_PACOTE`, testes que guardam número, status) e a fila de publicação com o arquivo `PUBLICANDO.md` (uma conversa por vez, do merge da `main` até a cópia do status no Projeto). (14.7)

**154. Prova no publicado que repete em duas larguras na mesma conta precisa contar só o que é da rodada** (o recusado da primeira largura aparece, com razão, na segunda). (14.7)

**155. Lista digitada "separada por vírgula" quebra o nome que tem vírgula.** A categoria padrão "Contas (água, luz, internet)" virou três; quem achou foi o roteiro, ao escolher a categoria na tela. Listas de configuração são uma por linha. (20.0)

**156. A prova "igual à de antes" precisa de uma referência que não ande.** O roteiro comparava as chamadas do login com a pasta da `main`; depois da publicação a `main` já era a nova e a prova falhou sem defeito nenhum. Referência fixa: a tag ou a lista escrita. (20.0)

**157. Prova no servidor real lê a célula antes do passo seguinte.** A prova do comprovante lia a situação depois de já ter confirmado e deu falso; o defeito era da prova. (20.0)

**158. Plano escrito por outro chat se confere contra o código e contra a palavra do usuário antes de construir.** Três regras do plano mudaram (pagamento por mês, sessão desmarcada na cobrança, começo em dezembro) e as três foram ditas ao usuário em uma frase com exemplo, no plano que ele aprovou. Irmã da 147. (20.0)

**159. Formato que outro sistema lê se prova contra quem já acerta.** O gabarito do lote foi gerado pelo gerador que o usuário usa hoje, com entradas inventadas, e a suíte exige igualdade byte a byte; no PC, o mesmo código foi conferido contra os lotes já aceitos pelo site, imprimindo só contagens (nenhuma linha, nome, CPF ou valor saiu da pasta dele). (20.1)

**160. Caractere invisível não se escreve no código-fonte.** Uma expressão regular com os separadores de linha U+2028 e U+2029 quebrou o `node --check` porque a ferramenta de escrita os gravou de verdade; lista de códigos (`charCodeAt`) no lugar. (20.1)

**161. Campo que liga uma função não pode depender dela ligada.** O CPF de quem emite só aparecia com os recibos ligados, e o servidor recusava ligar sem o CPF — os campos ficam sempre visíveis. (20.1)

**162. Conversa que para no meio da publicação deixa escrito onde parou.** A sessão caiu por limite de uso com as funções temporárias no HEAD do Apps Script e as travas presas; a retomada conferiu trava, HEAD e conta descartável antes de qualquer comando, e as outras conversas esperaram porque os dois arquivos de trava diziam o que estava no HEAD. (20.1)

**163. Proposta de recurso de integração começa pelo que os sistemas do mercado usam**, com o nome que o usuário reconhece ("conectar a conta", "convite de agenda"); a saída caseira entra como complemento. (14.8)

**164. Limitação do tipo "só vale para a sua conta" vem com a consequência para os outros profissionais e com a saída**, na mesma frase. (14.8)

**165. Fluxo que sai do site e volta (tela de permissão do Google) abre em outra aba.** A sessão do profissional mora só na memória da página (lição 23) e se perderia na ida; a aba nasce no próprio clique, antes do `await`, e a página original relê o estado ao voltar a ser vista. (14.8)

**166. Permissão guardada de terceiros (refresh token) fica no cofre do script**, nunca em planilha, resposta ou log, e a chave do aplicativo são propriedades que só o usuário preenche — a suíte confere que o código não as contém e que o token do script continua pedido num lugar só. (14.8)

**167. Regra CSS nova declarada antes da antiga com a mesma especificidade perde** (lição 92 de novo, na caixa de marcar do quadro): seletor composto. (14.8)

**168. Palavra de tela se confere contra o que ela já quer dizer no sistema.** "Sessões a marcar" foi recusado pelo usuário na hora: "marcar" já é agendar. A palavra certa veio dele ("status") e valeu para o sistema inteiro. (20.2)

**169. E-mail com tabela se prova na largura do telefone.** A grade de cinco colunas passava no computador e estourava em 390 px; quem achou foi o roteiro, que monta o e-mail pelo gatilho de verdade e mede a largura. (20.2)

**170. Dado que muda em outra tela precisa de um gancho de volta.** O bloco do Início ficava velho depois de mudar o status pela Agenda; a leitura "quando ficar velha" não bastava. A saída foi reler ao abrir o Início (`abrirSecao`), não espalhar invalidações. (20.2)

**171. Decisão de outra conversa que muda o pacote vai ao usuário em uma frase, com o caminho.** A regra do remetente (ele não quer e-mail de outro profissional saindo do Gmail dele) chegou pela coordenadora no meio da proposta; a resposta foi a trava numa função só, dita a ele antes de construir. (20.2)

**172. Substituir uma função do simulador pode quebrar outra coisa que a usa** (`Utilities.newBlob` sem `getDataAsString` derrubou a leitura do crachá): acrescentar o que falta, nunca trocar o que existe. (20.2)

**173. Página de retorno de permissão (OAuth) nunca mora no `/exec` do Apps Script.** Com mais de uma conta do Google no navegador o Google acrescenta `authuser=N` e o Apps Script não abre a página; a volta é uma página do próprio site, que entrega o resultado ao servidor por POST (o POST não leva conta nenhuma do navegador). (14.8.1)

**174. Integração com serviço de fora só está provada com o serviço de verdade.** 63 provas e 39 de tela com um Google de mentira passaram, e a primeira tentativa real falhou num caso comum; o pacote só é "concluído" depois dessa prova. (14.8.1)

**175. Segredo que vai aparecer numa tela se avisa antes.** Dizer ao usuário, antes de a janela abrir, que ela não deve ser fotografada nem colada no chat; a conferência do que ele colou é por sim/não (existe, formato, lido pelo sistema), nunca pelo valor. (14.8.1)

**176. Com o Chrome minimizado a extensão não captura a tela**, mas lê e clica pelos elementos da página: seguir por eles e conferir o resultado relendo a página. (14.8.1)

**177. Texto se revisa vendo onde ele aparece.** A lista só de frases não bastou ("mostra em imagem, o local e a parte exata do app"); a página com o recorte de tela de cada texto, contornado, e o campo de troca na mesma linha resolveu em uma passada, e a marcação fica no banco da página, lida pelo Code. (20.2.1)

**178. Quando ele pergunta "a que se refere?", o texto está ruim** — "Há também 2 de dias anteriores." virou uma frase que diz o que são. (20.2.1)

**179. Não discutir a palavra que ele escolheu.** "Próximas sessões" foi contestada pelo Code e ele já tinha pensado nisso (quem paga por mês usa o crédito no mês seguinte). (20.2.1)
