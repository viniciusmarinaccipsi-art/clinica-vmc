# Lições Aprendidas — Referência

76 lições acumuladas no desenvolvimento (numeração original preservada —
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

**50. A senha do profissional VMC contém minus sign (U+2212), não hífen
comum.** Sempre copiar/colar da fonte segura; nunca digitar à mão.

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
