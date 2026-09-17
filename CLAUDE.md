# CLAUDE.md — Sistema Clínico Digital VMC (repositório `clinica-vmc`)

Gerado a partir da skill `clinica-vmc` em 14/09/2026. Regenerar junto com a skill. Este arquivo guarda conhecimento **estável**; o estado do sistema (versão em produção, roadmap, débitos, IDs) vive em `..\status_projeto_vmc.md` — **ler primeiro**, e em conflito o status vence.

## O que é este projeto

Sistema web modular para consultório de psicologia (TCC): `index.html` (SPA vanilla JS, GitHub Pages) + `admin.html` + backend Google Apps Script (Web App, `doPost` roteado por `acao`) + Google Sheets como banco multi-tenant (Admin → Profissional → Paciente).

**Natureza (decisão de 14/09/2026):** é um **laboratório** — protótipo não divulgado, em uso com poucos pacientes, que será reconstruído do zero ao fim da exploração. Portanto: não investir em hardening, escala ou refatoração profunda; explorar o que ensina algo para o novo sistema; **remover peso morto** (código, colunas, abas, docs sem função) em vez de preservar. Sigilo dos pacientes vale integralmente.

## Usuário

Vinicius Marinacci, psicólogo clínico; não é programador, mas opera agentes com autonomia. Decisões técnicas: você toma e mostra o resultado. Produto, conteúdo clínico e UX: pergunte antes. Respostas curtas dele = "executar". Deixe explícito o que está fazendo em cada passo; nunca contorne uma falha em silêncio — diagnostique e reporte.

## Esta pasta

- `index.html`, `admin.html`, `Code.gs` (ou o nome que o clasp usar) e `appsscript.json` são a produção; `CLAUDE.md` e `docs/` são referência.
- `.clasp.json` é ignorado pelo git (repositório público). `Backup - */` são histórico local, fora do git.
- Na pasta acima (`..\`) existem `credentials.json` e `token.json` (OAuth dos scripts Python): **NUNCA abrir, ler, pedir ou mover.**
- Scripts Python administrativos (gspread + OAuth) vivem em `..\`; rodam com `!python`.

## Esteira (a partir de 14/09/2026)

1. Ler `..\status_projeto_vmc.md`; confirmar o item do roadmap.
2. Editar por `str_replace` (nunca reescrever arquivo inteiro). Após cada edição: `grep -n` do trecho inserido + `wc -l` (delta = linhas inseridas). Após substituir uma função inteira: grep pelo nome para caçar fragmento órfão.
3. Validar (checklist abaixo).
4. `VERSAO_PACOTE` no topo do `Code.gs`; `ping` devolve essa constante; mesmo marcador em comentário no topo do `index.html`.
5. `git commit` → `!clasp push` → `!clasp deploy --deploymentId <ID no status> --description "<pacote>"` (sempre a MESMA implantação; nova implantação = URL nova = app quebrado) → `git push origin main` (Pages publica) → conferir `ping` → teste em aba anônima no site publicado com `?v=N`.
6. Só marcar CONCLUÍDO após ping correto e teste em produção. Fechar atualizando `..\status_projeto_vmc.md` (seções 1, 4, 5, 6, 8) e a cópia no Projeto claude.ai.

Deploy manual (colar no editor do Apps Script, arrastar no GitHub) está descontinuado.

**Prova do ping** (validado em 14/09/2026; no PowerShell 5.1 o `curl.exe` com `-X POST` e aspas escapadas falha — 411 ou JSON corrompido):
- PowerShell: `Invoke-RestMethod -Method Post -Uri "<APPS_SCRIPT_URL do index.html>" -ContentType "text/plain;charset=utf-8" -Body '{"acao":"ping"}'`
- Bash: `curl -sL -H 'Content-Type: text/plain;charset=utf-8' -d '{"acao":"ping"}' "<APPS_SCRIPT_URL>"` (sem `-X POST`: o 302 do Apps Script precisa virar GET)

## Princípios não-negociáveis

- **Aditivo só para dados vivos:** colunas com dados reais não são removidas nem renomeadas; chaves técnicas (`data-grupo`, prefixos `neg_emo_*` etc., nomes de ações do `doPost`) não mudam; cada registro carrega `versao_formulario`; assinaturas de backend mudam por parâmetro opcional com default antigo. Código, abas e colunas **sem função** são removidos em pacotes de limpeza, com registro no status.
- **DOM-first:** subitens, títulos e rótulos vêm do DOM em runtime (`pevConstruirCacheSubitens`, `revTituloGrupo`), nunca de listas duplicadas em JS. Texto de `data-item` alterado de forma equivalente → migrar dados por script, não aceitar coexistência.
- **Reuso antes de criar:** modais `.p5-modal-*`, cadeado `.card.locked`, cache 30 s `pev*`, detecção de veterano via `lerHistorico`/`lerEscalas`, tintura `.esc-tint-*`, motor aditivo de escalas (`reverso`, `multiSubescalas`, `criticoLimiar`, `dicotomica`), renderer unificado `escRenderizarConteudoResultado`, padrão "empréstimo", lock de presença fire-and-forget, `_garantirColunasX_()`. Catálogo em `docs/arquitetura.md`.
- **Multi-tenant seguro:** `profissional_id` sempre derivado server-side via `Indice_Siglas`; toda chamada passa `sigla` explícita (`chamarServidor` não adiciona); funções admin revalidam `(adminSigla, adminSenha)` a cada chamada; `senha_hash` nunca volta ao cliente; credenciais admin só em `ADM_STATE` (memória); paciente via `carregarSessao()` (sessionStorage; localStorage não é usado).
- **Terminologia clínica:** agradáveis/desagradáveis, bem-estar/mal-estar, adaptativos/desadaptativos, funcionais/disfuncionais. Nunca "positivo/negativo" como rótulo de seção.
- **Descrição ≠ código:** contagens, nomes de funções e ações saem de grep no arquivo real, com data. Nunca verificar nome de função de memória.
- **Pacote = uma coisa só**, testável isoladamente; bug no caminho vira pacote próprio.

## Checklist antes de entregar

- [ ] `node --check` do JS extraído (`sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > check.js`)
- [ ] Tags balanceadas `div`/`button`/`script` (sem tolerância a partir do 15.0), contando `div` **fora** dos blocos `<script>` — a contagem bruta tem 1 `<div` a mais dentro de string JS de `innerHTML` (diagnóstico do 15.0)
- [ ] Toda `var(--x)` declarada no `:root` (variável ausente falha em silêncio)
- [ ] Marcadores preservados: `pevConstruirCacheSubitens`, `P5_STATE`, `autoFormatarHora`, `.hidden` global, `Utilities.formatDate` em `lerAbaComoObjetos`
- [ ] Nenhum fragmento órfão; nenhuma função nova sem chamada; nenhuma aba/coluna "reservada"
- [ ] `sigla` explícita no payload; `data-grupo` alinhado com colunas
- [ ] `VERSAO_PACOTE` atualizada e devolvida pelo `ping`
- [ ] Nenhum `console.log` com dado clínico; nenhuma senha/token em arquivo

## Bugs recorrentes

- Sheets devolve células TIME como `Date` em UTC (`1899-12-30T…`): no backend `Utilities.formatDate(val, 'America/Sao_Paulo', 'HH:mm')` — nunca `getUTCHours()`; no front `autoFormatarHora` é fallback; "há X dias" por datas civis. Colunas de hora em texto `@` + `getDisplayValues()` não têm o problema.
- Cache do navegador mascara deploy: `?v=N` em aba anônima; o `ping` diz a versão real.
- `const`/`let` no escopo global de `<script>` não viram `window.X` nem são içados — estado global usa `var`.
- Teste de "primeira vez" exige aba realmente vazia.
- GitHub Pages é case-sensitive; raw tem ~5 min de cache.

## Identidade visual

Nunito (texto) e Quicksand (títulos); cards com borda lateral colorida; paleta por significado no `:root` do `index.html` (azul institucional, coral, âmbar, verde, laranja, roxo, teal, vermelho, cinzas; `--adm*` só no admin; `--cal-*` na agenda). Declarar no `:root` antes de usar.

## Referências

- `docs/arquitetura.md` — padrões técnicos, namespaces, modelo de dados, backend.
- `docs/licoes-aprendidas.md` — 64 lições; as novas (65+) ficam na seção 8 do status até a próxima regeneração.
