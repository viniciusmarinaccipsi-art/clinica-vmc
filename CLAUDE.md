# CLAUDE.md — Sistema Clínico Digital VMC (repositório `clinica-vmc`)

Gerado a partir da skill `clinica-vmc` em 20/09/2026 (regeneração pós-Pacote 16.3). Regenerar junto com a skill. Este arquivo guarda conhecimento **estável**; o estado do sistema (versão em produção, roadmap, débitos, IDs) vive em `..\status_projeto_vmc.md` — **ler primeiro**, e em conflito o status vence.

## O que é este projeto

Sistema web modular para consultório de psicologia (TCC): `index.html` (SPA vanilla JS, GitHub Pages) + `admin.html` + backend Google Apps Script (Web App, `doPost` roteado por `acao`) + Google Sheets como banco multi-tenant (Admin → Profissional → Paciente). Desde o Pacote 16.0 existe também `index-dev.html`: a página de teste do redesenho, publicada no mesmo Pages e falando com o **mesmo** backend, onde o tema G (redesenho visual) avança pacote a pacote até a promoção para `index.html`.

**Natureza (decisão de 14/09, revista em 17/09/2026):** é um **laboratório** — protótipo não divulgado, em uso com poucos pacientes, que será reconstruído do zero ao fim da exploração. Portanto: melhorias no sistema atual são decididas item a item por custo-benefício (vale o que traz ganho antes do reset ou ensina algo para o novo sistema; fora disso, reescrever o código inteiro e escala); toda ideia fica registrada no roadmap do status por tema, com estado feito/candidato/adiado; **remover peso morto** (código, colunas, abas, docs, logs sem função) em vez de preservar — o Pacote 15.0 é a referência. Sigilo dos pacientes vale integralmente.

## Usuário

Vinicius Marinacci, psicólogo clínico; não é programador, mas opera agentes com autonomia. Decisões técnicas: você toma e mostra o resultado. Produto, conteúdo clínico e UX: pergunte antes. Respostas curtas dele = "executar". Deixe explícito o que está fazendo em cada passo; nunca contorne uma falha em silêncio — diagnostique e reporte. O que exige login, senha ou consentimento OAuth é ele quem executa. **Senhas nunca circulam no chat**: credenciais de teste só por variável de ambiente ou digitadas pelo usuário; se não houver, a validação usa sessão simulada e diz isso no relatório.

## Como abrir

PowerShell → `cd "C:\Users\cardi\Meu Drive\clinica-vmc\repo-github"` → `claude`. O caminho vai **entre aspas** por causa do espaço em "Meu Drive" (ou navegar até a pasta pelo seletor). A entrega do Design fica ao lado, em `..\VMC-offline\` (pranchas, `tokens.css`, `mapa_campos.md`, capturas e diagnósticos).

## Esta pasta

- `index.html`, `admin.html`, `Código.js` (o "`Code.gs`" — nome real exigido pelo clasp) e `appsscript.json` são a produção; `index-dev.html` é o redesenho em teste (mesmo backend); `CLAUDE.md` e `docs/` são referência. `docs/design/` guarda `tokens.css`, `mapa_campos.md` e `icones.md` (cópias da entrega do Design + mapa emoji → símbolo). Não existe mais `sw.js` (removido no 15.0).
- `.clasp.json` é ignorado pelo git (repositório público). `Backup - */` são histórico local, fora do git.
- Na pasta acima (`..\`) existem `credentials.json` e `token.json` (OAuth dos scripts Python): **NUNCA abrir, ler, pedir ou mover.** IDs de implantação e de planilhas ficam no status, nunca em arquivo que suba ao GitHub (por isso o status não é copiado para o repositório).
- Scripts Python administrativos (gspread + OAuth) vivem em `..\` e copiam a autenticação de `migracao_13_0_1.py`/`limpeza_15_0.py` (`invalid_grant` → fluxo do navegador, não abortar). **Toda** chamada gspread atrás de um wrapper único com espera em 429 (60 leituras/min por usuário; `sh.worksheet()` também conta), `sh.worksheets()` uma vez por planilha, pausa entre planilhas. Padrão de script destrutivo: dry-run por padrão, `--executar` com dupla confirmação `SIM`, log, verificação pós-execução.

## Como seus comandos rodam

- `!` executa no **Bash** (Git Bash), não no PowerShell: caminhos com `/` (`!python ../script.py`); `\` é escape. `node`/`clasp`/`python` levam `!`; git roda direto.
- `!` **não tem stdin**: script com `input()` recebe EOF. Execução destrutiva com confirmação digitada roda num PowerShell externo aberto pelo usuário em `..\` — entregue o comando e aguarde.
- Heredoc no Bash da ferramenta come barras invertidas: scripts com regex ou `\n` literal vão para arquivo pela ferramenta de escrita, não por `cat <<EOF`.
- Nada de força bruta no git: nunca `push --force`, nunca `reset --hard` sem backup.

## Esteira (a partir de 14/09/2026; frontend do redesenho desde 18/09)

1. Ler `..\status_projeto_vmc.md`; confirmar o item do roadmap.
2. Branch de trabalho (`pacote-N`). Editar por `str_replace` (nunca reescrever arquivo inteiro); substituições em lote por script determinístico com contagem por padrão e log. Após cada edição: `grep -n` do trecho inserido + `wc -l` (delta = linhas inseridas). Após substituir ou remover uma função inteira: grep pelo nome para caçar fragmento órfão ou chamada pendente.
3. Validar (checklist abaixo) — inclui o teste de execução no Playwright.
4. `var VERSAO_PACOTE = '<pacote>'` no topo do `Código.js` quando o backend mudar; `ping` devolve `versao_pacote`; mesmo marcador em comentário no topo do `index.html`.
5. **Pacote com backend:** `git commit` → `!clasp push` → `!clasp deploy --deploymentId <ID no status> --description "<pacote>"` (sempre a MESMA implantação; nova implantação = URL nova = app quebrado) → `ping` → merge `--ff-only` em `main`, tag `vN` → `git push origin main` (Pages publica em ~1 min) → teste em aba anônima no site publicado com `?v=N`.
   **Pacote só de frontend (tema G em `index-dev.html`):** `git commit` → merge `--ff-only` em `main` → `git push origin main` → esperar o Pages (curl até o marcador do pacote aparecer, ~45 s) → Playwright de login no `index-dev.html` publicado. Sem `clasp`, sem tag.
6. Só marcar CONCLUÍDO após ping correto (backend) ou login no publicado (frontend) e teste em produção. Rollback: `git revert` + `clasp push` + `clasp deploy` na mesma implantação.
7. Fechar: atualizar `..\status_projeto_vmc.md` (seções 1, 4, 5, 6, 8) quando o pedido incluir, `docs/` se a arquitetura mudou, e escrever `..\PACOTE_N_RELATORIO.md` (contagens antes/depois, exceções, o que ficou de fora e por quê). A cópia do status no Projeto claude.ai é sincronizada pelo chat.

Deploy manual (colar no editor do Apps Script, arrastar no GitHub) está descontinuado.

**Prova do ping:**
- PowerShell: `Invoke-RestMethod -Method Post -Uri "<APPS_SCRIPT_URL do index.html>" -ContentType "text/plain;charset=utf-8" -Body '{"acao":"ping"}'`
- Bash: `curl -sL -H 'Content-Type: text/plain;charset=utf-8' -d '{"acao":"ping"}' "<APPS_SCRIPT_URL>"`
- Nunca `curl.exe -X POST` no PowerShell (411 e JSON corrompido). Erro no ping pode ser do cliente: confirmar com um segundo cliente antes de concluir que a implantação quebrou.

## Medir com o instrumento certo

- **Claude in Chrome é só para inspeção visual.** A aba que a extensão abre fica em segundo plano: timers limitados a 1 por segundo, `requestAnimationFrame` parado, requests e console do Apps Script invisíveis. Números de "página travada" vindos dela são artefato (lição 72).
- **Medição e validação são Playwright com o Chrome instalado** (`chromium.launch({ channel: 'chrome' })`, janela visível quando o assunto é responsividade), capturando `pageerror`, `console`, `request`/`response`, com `page.route` para simular atraso, 404 e falha do Apps Script. O pacote global é `@playwright/test`; `require` pelo caminho absoluto do `npm root -g`.
- **Comparar no mesmo minuto** o arquivo alterado e o de produção: o Apps Script oscila (45 s sem resposta, 404 em HTML, 200 lento na mesma hora). "Falha de conexão" sem essa comparação não é bug do frontend (lição 74).
- **Sem reprodução, sem "Correção"**: o commit diz o que foi feito de fato e o relatório registra a evidência e o que falta para reproduzir (lição 75).
- Sessão simulada (`sessionStorage` com sigla ZZZ) serve para telas internas; login real só com credencial em variável de ambiente.

## Princípios não-negociáveis

- **Aditivo só para dados vivos:** colunas com dados reais não são removidas nem renomeadas; chaves técnicas (`data-grupo`, prefixos `neg_emo_*` etc., nomes de ações do `doPost`) não mudam; cada registro carrega `versao_formulario`; assinaturas de backend mudam por parâmetro opcional com default antigo. O backend lê e grava pelo **nome do cabeçalho**, nunca por posição; `_garantirColunasX_()` cria colunas faltantes no primeiro uso. Código, abas e colunas **sem função** são removidos em pacotes de limpeza, com registro no status; coluna vazia de seção removida sai por script.
- **DOM-first:** subitens, títulos e rótulos vêm do DOM em runtime (`pevConstruirCacheSubitens`, `revTituloGrupo`, `data-barra-titulo`/`data-barra-voltar` das seções), nunca de listas duplicadas em JS. Texto de `data-item` alterado de forma equivalente → migrar dados por script, não aceitar coexistência.
- **Reuso antes de criar:** modais `.p5-modal-*`, cadeado `.card.locked`, cache 30 s `pev*`, detecção de veterano via `lerHistorico`/`lerEscalas`, tintura `.esc-tint-*`, motor aditivo de escalas (`reverso`, `multiSubescalas`, `criticoLimiar`, `dicotomica`), renderer unificado `escRenderizarConteudoResultado`, padrão "empréstimo", lock de presença fire-and-forget, `_garantirColunasX_()`; no redesenho, barra única `#topbar`, progresso único `#prog`, `.barra-acao`, `confirmarSaida()`, `chamarServidor` com timeout, sprite `#i-*`. Catálogo em `docs/arquitetura.md`.
- **Multi-tenant seguro:** `profissional_id` sempre derivado server-side via `Indice_Siglas`; toda chamada passa `sigla` explícita (`chamarServidor` não adiciona); funções admin revalidam `(adminSigla, adminSenha)` a cada chamada; `senha_hash` nunca volta ao cliente; credenciais admin só em `ADM_STATE` (memória); paciente via `carregarSessao()` (sessionStorage; localStorage não é usado).
- **Terminologia clínica:** agradáveis/desagradáveis, bem-estar/mal-estar, adaptativos/desadaptativos, funcionais/disfuncionais. Nunca "positivo/negativo" como rótulo de seção.
- **Pacote = uma coisa só**, testável isoladamente; bug no caminho vira pacote próprio.

## Checklist antes de entregar

- [ ] `node --check` do JS extraído (`sed -n '/<script>/,/<\/script>/p' arquivo.html | sed '1d;$d' > check.js`)
- [ ] Tags balanceadas `div`/`button`/`span`/`svg`, contando **fora** dos blocos `<script>` e por profundidade — a contagem bruta tem 1 `<div` a mais dentro de string JS de `innerHTML` (diagnóstico do 15.0); o sprite SVG entra na contagem
- [ ] Toda `var(--x)` declarada no `:root` (variável ausente falha em silêncio); em `index-dev.html`, zero hex/rgba fixo fora dos dois `:root`, zero classe CSS sem uso (script de inventário), zero `font-size` fixo abaixo de 13 px, zero emoji fora da escala de humor, clicáveis ≥ 44 px
- [ ] Playwright (Chrome instalado, aba visível, 390×844 e 1280×800): login com sigla inválida até "Sigla ou senha incorretos" sem `pageerror`, no arquivo local e no publicado; telas internas com sessão simulada; capturas em `..\VMC-offline\capturas_<pacote>\`
- [ ] Marcadores preservados: `pevConstruirCacheSubitens`, `P5_STATE`, `autoFormatarHora`, `.hidden` global, `Utilities.formatDate` em `lerAbaComoObjetos`
- [ ] Nenhum fragmento órfão; nenhuma função nova sem chamada; nenhuma aba/coluna "reservada"
- [ ] `sigla` explícita no payload; `data-grupo` alinhado com colunas; ação nova do `doPost` classificada em `VMC_ACOES_GRAVACAO` se gravar
- [ ] `VERSAO_PACOTE` atualizada e devolvida pelo `ping` quando o backend mudou
- [ ] Nenhum `console.log` com dado clínico; nenhuma senha, token ou ID de implantação em arquivo que suba ao GitHub

## Bugs recorrentes

- Sheets devolve células TIME como `Date` em UTC (`1899-12-30T…`): no backend `Utilities.formatDate(val, 'America/Sao_Paulo', 'HH:mm')` — nunca `getUTCHours()`; no front `autoFormatarHora` é fallback; "há X dias" por datas civis. Colunas de hora em texto `@` + `getDisplayValues()` não têm o problema.
- Cache do navegador mascara deploy: `?v=N` em aba anônima; o `ping` diz a versão real.
- `const`/`let` no escopo global de `<script>` não viram `window.X` nem são içados — estado global usa `var`; uma constante usada antes da linha que a declara derruba o script inteiro no carregamento (16.3).
- Teste de "primeira vez" exige aba realmente vazia.
- GitHub Pages é case-sensitive; raw tem ~5 min de cache.
- `transform` em animação de seção cria bloco de contenção e desloca elementos `position:fixed` (barra de ação) enquanto anima; animar só opacidade.
- 429 da Sheets API, EOF em `input()` sob `!`, `invalid_grant` no token: soluções em "Esta pasta" e "Como seus comandos rodam".

## Identidade visual

**Redesenho (`index-dev.html`, tema G):** `docs/design/tokens.css` no lugar do `:root` antigo — 99 tokens claros + 58 escuros (`prefers-color-scheme: dark`); Newsreader (`--f-title`: títulos, escores, horas) e Figtree (`--f-text`: o resto) via Google Fonts; **cor por significado** — risco/erro só vermelho (`--c-risk*`), Registro Negativo ameixa (`--c-reg-neg*`), Positivo verde-água (`--c-reg-pos*`), ação índigo (`--c-action*`), atenção âmbar (`--c-warn*`), um par tinte/tinta por instrumento (`--c-phq9-*` … `--c-srq20-*`); texto usa a variante `-ink`; sombras `--sh-1/2/3/bar`, raios `--r-*`, toque `--hit-min`/`--hit-likert`; ícones pelo sprite SVG inline `#i-*` (`docs/design/icones.md`), emoji só nas 5 faces da escala de humor. Nenhuma cor fixa fora dos `:root`.

**Produção (`index.html`, `admin.html`):** mantém a identidade antiga até a promoção — Nunito e Quicksand, cards com borda lateral colorida, paleta por significado no `:root` (azul institucional, coral, âmbar, verde, laranja, roxo, teal, vermelho, cinzas; `--adm*` só no admin; `--cal-*` na agenda). Declarar no `:root` antes de usar.

## Referências

- `docs/arquitetura.md` — padrões técnicos, namespaces, modelo de dados, backend, seção "Sistema visual" do redesenho.
- `docs/licoes-aprendidas.md` — lições 1–76 (numeração original; obsoletas marcadas). Lições novas nascem na seção 8 do status e entram aqui na regeneração seguinte da skill.
- `..\VMC-offline\diagnostico_codigo_16.md` — diagnóstico de código que abriu o tema G; `..\PACOTE_16_*_RELATORIO.md` — um relatório por pacote.
