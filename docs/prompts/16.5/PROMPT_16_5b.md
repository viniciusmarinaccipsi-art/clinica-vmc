# PROMPT · Pacote 16.5b — Tokens novos do 16.5 e rostinhos do humor no sprite (index-dev)

Sistema Clínico Digital VMC · 26/09/2026 · Tema G · Pacote 16.5, fase 3. Nenhuma tela é redesenhada aqui; é a fundação que as fases seguintes usam.

## Contexto
1. Ler `CLAUDE.md`, `docs/arquitetura.md` ("Sistema visual", sprite e `vmcTok()`), `docs/licoes-aprendidas.md` (lição do campo `emoji`: quando o tipo de conteúdo de um campo muda, re-auditar todo consumidor por grep), `docs/design/icones.md`. `git pull`; pré-requisitos: 16.5a e 16.4.5 fechados.
2. Só `index-dev.html`, `docs/design/tokens.css`, `docs/design/icones.md`. `index.html` e `Código.js` intocados; sem `clasp`.
3. Entradas: `docs/design/16.5/04_tokens.css`, `docs/design/16.5/05_rostinhos.svg`, `docs/design/16.5/icones.js`, `docs/design/16.5/CONFERENCIA_16_5a.md` (itens 4, 5, 6 e o inventário de consumidores do humor do Passo 2c).
4. Regra: o `catalogo.js` do Design **não entra no app** (o conteúdo clínico continua no HTML — DOM-first). Este pacote não toca nas seções `sec-auto-*`.

## Passos
1. **Gabarito antes** (script do 16.5a; guardar).
2. **Tokens — mesclar, nunca copiar por cima.** Acrescentar ao `:root` claro de `index-dev.html` e a `docs/design/tokens.css` os tokens NOVOS do item 4 da conferência: `--c-humor-1..5-bg`, `--c-humor-1..5-ink`, `--c-reg-neg-mid`, `--c-reg-pos-mid`, `--t-h2-sm`, `--t-legend`, `--hit-face`, `--w-likert-col`, com os valores do `04_tokens.css`; no tema escuro, os equivalentes que o `04_tokens.css` declarar (conferir bloco a bloco). Os tokens que só o repositório tem (`--c-bdi2-*`, `--c-bai-*`, apelidos) **permanecem**. Ao final: cada token novo aparece nos dois arquivos; grep de `var(--c-humor-3-bg)` etc. ainda sem uso é aceitável nesta fase (serão usados no 16.5c/d-2) — registrar a lista.
3. **Sprite:** inserir os 5 `<symbol id="i-humor-1..5" viewBox="0 0 24 24">` de `05_rostinhos.svg` no sprite inline de `index-dev.html` (sem o `<metadata>`; `fill="none" stroke="currentColor"` herdados como os demais). Inserir também os ids de `icones.js` que o item 6 da conferência apontou como ausentes. Atualizar `docs/design/icones.md`.
4. **Faces do humor → SVG.** Usar o inventário do 16.5a (Passo 2c): todo ponto que hoje renderiza a face emoji do humor 1–5 (escala de humor da checagem/etapa, cabeçalho cumulativo, Meus Registros, modal infográfico, Painel/legendas, visão do profissional se houver) passa a `<svg class="ico" aria-hidden="true"><use href="#i-humor-N"/></svg>` com a cor `var(--c-humor-N-ink)` onde a face tinha cor própria. Se o valor do humor vive num campo do catálogo de humor (ex.: `emoji`), mudar o **consumidor**, não o dado, e re-auditar por grep todos os consumidores antes de fechar (lição 16.4.1). Ao final, grep de emojis (faixa Unicode de emoticons e símbolos pictográficos) em `index-dev.html` = **zero**: a regra passa a ser "zero emoji".
5. **Marcador:** linha 2 → "Pacote 16.5b".
6. **Validação:** `node --check`; tags; toda `var()` declarada; zero cor fixa fora do `:root`; zero emoji; nenhuma classe CSS nova sem uso (as regras que usarem os tokens novos podem esperar; não criar classes vazias); gabarito igual; Playwright 390/1280 com login inválido (zero `pageerror`) e sessão simulada do paciente de teste em: Início, hub, checagem de humor atual (as 5 faces em SVG, cores `--c-humor-N-ink`), etapa 2 do Negativo (cabeçalho cumulativo com rostinho), Meus Registros e Painel; capturas em `../VMC-offline/capturas_16_5b/`; comparar com `index.html` no mesmo minuto.
7. **Publicar:** commit `Pacote 16.5b - Tokens do 16.5 e rostinhos do humor em SVG (index-dev)` · `git push` · teste no publicado com `?v=165b`.
8. **Relatório** `../VMC-offline/PACOTE_16_5b_RELATORIO.md`: tokens acrescentados (lista), símbolos acrescentados, pontos alterados (arquivo:linha antes → depois), grep de emoji = 0, gabarito igual, capturas. `docs/arquitetura.md`: regra "zero emoji" e os 5 símbolos do humor.
9. Mensagem final: "publicado" + resultados em 5 linhas.

## Checklist do usuário (aba anônima, `index-dev.html?v=165b`)
- [ ] Na checagem de humor atual as 5 faces são desenhos de traço (não emoji), coloridas de ameixa a verde-água.
- [ ] Em Meus Registros e no cabeçalho de uma etapa, o humor aparece com o mesmo rostinho.
- [ ] Nada mais mudou de aparência (fonte, cores, telas).
- [ ] Um registro antigo com humor 1–5 continua exibindo o rostinho correto.
