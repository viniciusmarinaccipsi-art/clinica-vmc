# CLAUDE.md — Sistema Clínico Digital VMC (repositório `clinica-vmc`)

Gerado a partir da skill `clinica-vmc` em 17/09/2026 (regeneração pós-Pacote 15.0). Regenerar junto com a skill. Este arquivo guarda conhecimento **estável**; o estado do sistema (versão em produção, roadmap, débitos, IDs) vive em `..\status_projeto_vmc.md` — **ler primeiro**, e em conflito o status vence.

## O que é este projeto

Sistema web modular para consultório de psicologia (TCC): `index.html` (SPA vanilla JS, GitHub Pages) + `admin.html` + backend Google Apps Script (Web App, `doPost` roteado por `acao`) + Google Sheets como banco multi-tenant (Admin → Profissional → Paciente).

**Natureza (decisão de 14/09/2026):** é um **laboratório** — protótipo não divulgado, em uso com poucos pacientes, que será reconstruído do zero ao fim da exploração. Portanto: melhorias no sistema atual são decididas item a item por custo-benefício (vale o que traz ganho antes do reset ou ensina algo para o novo sistema; fora disso, reescrever o código inteiro e escala); toda ideia fica registrada no roadmap do status por tema, com estado feito/candidato/adiado; **remover peso morto** (código, colunas, abas, docs, logs sem função) em vez de preservar — o Pacote 15.0 é a referência. Sigilo dos pacientes vale integralmente.

## Usuário

Vinicius Marinacci, psicólogo clínico; não é programador, mas opera agentes com autonomia. Decisões técnicas: você toma e mostra o resultado. Produto, conteúdo clínico e UX: pergunte antes. Respostas curtas dele = "executar". Deixe explícito o que está fazendo em cada passo; nunca contorne uma falha em silêncio — diagnostique e reporte. O que exige login, senha ou consentimento OAuth é ele quem executa.

## Esta pasta

- `index.html`, `admin.html`, `Código.js` (o "`Code.gs`" — nome real exigido pelo clasp) e `appsscript.json` são a produção; `CLAUDE.md` e `docs/` são referência. Não existe mais `sw.js` (removido no 15.0).
- `.clasp.json` é ignorado pelo git (repositório público). `Backup - */` são histórico local, fora do git.
- Na pasta acima (`..\`) existem `credentials.json` e `token.json` (OAuth dos scripts Python): **NUNCA abrir, ler, pedir ou mover.** IDs de implantação e de planilhas ficam no status, nunca em arquivo que suba ao GitHub.
- Scripts Python administrativos (gspread + OAuth) vivem em `..\` e copiam a autenticação de `migracao_13_0_1.py`/`limpeza_15_0.py` (`invalid_grant` → fluxo do navegador, não abortar). **Toda** chamada gspread atrás de um wrapper único com espera em 429 (60 leituras/min por usuário; `sh.worksheet()` também conta), `sh.worksheets()` uma vez por planilha, pausa entre planilhas. Padrão de script destrutivo: dry-run por padrão, `--executar` com dupla confirmação `SIM`, log, verificação pós-execução.

## Como seus comandos rodam

- `!` executa no **Bash** (Git Bash), não no PowerShell: caminhos com `/` (`!python ../script.py`); `\` é escape. `node`/`clasp`/`python` levam `!`; git roda direto.
- `!` **não tem stdin**: script com `input()` recebe EOF. Execução destrutiva com confirmação digitada roda num PowerShell externo aberto pelo usuário em `..\` — entregue o comando e aguarde.
- Nada de força bruta no git: nunca `push --force`, nunca `reset --hard` sem backup.

## Esteira (a partir de 14/09/2026)

1. Ler `..\status_projeto_vmc.md`; confirmar o item do roadmap.
2. Branch de trabalho (`pacote-N`). Editar por `str_replace` (nunca reescrever arquivo inteiro). Após cada edição: `grep -n` do trecho inserido + `wc -l` (delta = linhas inseridas). Após substituir ou remover uma função inteira: grep pelo nome para caçar fragmento órfão ou chamada pendente.
3. Validar (checklist abaixo).
4. `var VERSAO_PACOTE = '<pacote>'` no topo do `Código.js`; `ping` devolve `versao_pacote`; mesmo marcador em comentário no topo do `index.html`.
5. `git commit` → `!clasp push` → `!clasp deploy --deploymentId <ID no status> --description "<pacote>"` (sempre a MESMA implantação; nova implantação = URL nova = app quebrado) → `ping` → merge `--ff-only` em `main`, tag `vN` → `git push origin main` (Pages publica em ~1 min) → teste em aba anônima no site publicado com `?v=N`.
6. Só marcar CONCLUÍDO após ping correto e teste em produção. Rollback: `git revert` + `clasp push` + `clasp deploy` na mesma implantação.
7. Fechar: atualizar `..\status_projeto_vmc.md` (seções 1, 4, 5, 6, 8), `docs/` se a arquitetura mudou, e escrever `..\PACOTE_N_RELATORIO.md`. A cópia do status no Projeto claude.ai é sincronizada pelo chat.

Deploy manual (colar no editor do Apps Script, arrastar no GitHub) está descontinuado.

**Prova do ping:**
- PowerShell: `Invoke-RestMethod -Method Post -Uri "<APPS_SCRIPT_URL do index.html>" -ContentType "text/plain;charset=utf-8" -Body '{"acao":"ping"}'`
- Bash: `curl -sL -H 'Content-Type: text/plain;charset=utf-8' -d '{"acao":"ping"}' "<APPS_SCRIPT_URL>"`
- Nunca `curl.exe -X POST` no PowerShell (411 e JSON corrompido). Erro no ping pode ser do cliente: confirmar com um segundo cliente antes de concluir que a implantação quebrou.

## Princípios não-negociáveis

- **Aditivo só para dados vivos:** colunas com dados reais não são removidas nem renomeadas; chaves técnicas (`data-grupo`, prefixos `neg_emo_*` etc., nomes de ações do `doPost`) não mudam; cada registro carrega `versao_formulario`; assinaturas de backend mudam por parâmetro opcional com default antigo. O backend lê e grava pelo **nome do cabeçalho**, nunca por posição; `_garantirColunasX_()` cria colunas faltantes no primeiro uso. Código, abas e colunas **sem função** são removidos em pacotes de limpeza, com registro no status; coluna vazia de seção removida sai por script.
- **DOM-first:** subitens, títulos e rótulos vêm do DOM em runtime (`pevConstruirCacheSubitens`, `revTituloGrupo`), nunca de listas duplicadas em JS. Texto de `data-item` alterado de forma equivalente → migrar dados por script, não aceitar coexistência.
- **Reuso antes de criar:** modais `.p5-modal-*`, cadeado `.card.locked`, cache 30 s `pev*`, detecção de veterano via `lerHistorico`/`lerEscalas`, tintura `.esc-tint-*`, motor aditivo de escalas (`reverso`, `multiSubescalas`, `criticoLimiar`, `dicotomica`), renderer unificado `escRenderizarConteudoResultado`, padrão "empréstimo", lock de presença fire-and-forget, `_garantirColunasX_()`. Catálogo em `docs/arquitetura.md`.
- **Multi-tenant seguro:** `profissional_id` sempre derivado server-side via `Indice_Siglas`; toda chamada passa `sigla` explícita (`chamarServidor` não adiciona); funções admin revalidam `(adminSigla, adminSenha)` a cada chamada; `senha_hash` nunca volta ao cliente; credenciais admin só em `ADM_STATE` (memória); paciente via `carregarSessao()` (sessionStorage; localStorage não é usado).
- **Terminologia clínica:** agradáveis/desagradáveis, bem-estar/mal-estar, adaptativos/desadaptativos, funcionais/disfuncionais. Nunca "positivo/negativo" como rótulo de seção.
- **Descrição ≠ código:** contagens, nomes de funções e ações saem de grep no arquivo real, com data. Nunca verificar nome de função de memória.
- **Pacote = uma coisa só**, testável isoladamente; bug no caminho vira pacote próprio.

## Checklist antes de entregar

- [ ] `node --check` do JS extraído (`sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > check.js`)
- [ ] Tags balanceadas `div`/`button`/`script`, contando **fora** dos blocos `<script>` e por profundidade — a contagem bruta tem 1 `<div` a mais dentro de string JS de `innerHTML` (diagnóstico do 15.0); sem tolerância desde o 15.0
- [ ] Toda `var(--x)` declarada no `:root` (variável ausente falha em silêncio)
- [ ] Marcadores preservados: `pevConstruirCacheSubitens`, `P5_STATE`, `autoFormatarHora`, `.hidden` global, `Utilities.formatDate` em `lerAbaComoObjetos`
- [ ] Nenhum fragmento órfão; nenhuma função nova sem chamada; nenhuma aba/coluna "reservada"
- [ ] `sigla` explícita no payload; `data-grupo` alinhado com colunas
- [ ] `VERSAO_PACOTE` atualizada e devolvida pelo `ping`
- [ ] Nenhum `console.log` com dado clínico; nenhuma senha, token ou ID de implantação em arquivo que suba ao GitHub

## Bugs recorrentes

- Sheets devolve células TIME como `Date` em UTC (`1899-12-30T…`): no backend `Utilities.formatDate(val, 'America/Sao_Paulo', 'HH:mm')` — nunca `getUTCHours()`; no front `autoFormatarHora` é fallback; "há X dias" por datas civis. Colunas de hora em texto `@` + `getDisplayValues()` não têm o problema.
- Cache do navegador mascara deploy: `?v=N` em aba anônima; o `ping` diz a versão real.
- `const`/`let` no escopo global de `<script>` não viram `window.X` nem são içados — estado global usa `var`.
- Teste de "primeira vez" exige aba realmente vazia.
- GitHub Pages é case-sensitive; raw tem ~5 min de cache.
- 429 da Sheets API, EOF em `input()` sob `!`, `invalid_grant` no token: soluções em "Esta pasta" e "Como seus comandos rodam".

## Identidade visual

Nunito (texto) e Quicksand (títulos); cards com borda lateral colorida; paleta por significado no `:root` do `index.html` (azul institucional, coral, âmbar, verde, laranja, roxo, teal, vermelho, cinzas; `--adm*` só no admin; `--cal-*` na agenda). Declarar no `:root` antes de usar.

## Referências

- `docs/arquitetura.md` — padrões técnicos, namespaces, modelo de dados, backend.
- `docs/licoes-aprendidas.md` — lições 1–71 (numeração original; obsoletas marcadas). Lições novas nascem na seção 8 do status e entram aqui na regeneração seguinte da skill.
