# PROMPT · Pacote 16.4.5 — Fonte única Figtree no app inteiro (index-dev)

Sistema Clínico Digital VMC · 26/09/2026 · Tema G · decisão 1 das "11 perguntas" (25/09): opção B, Figtree em tudo, títulos em seminegrito 600, Newsreader sai.

## Contexto
1. Ler `CLAUDE.md`, `docs/arquitetura.md` (seção "Sistema visual"), `docs/licoes-aprendidas.md` (lição 80: tipografia só se avalia com a fonte real). `git pull`; pré-requisito: o 16.5a fechado (existe `docs/design/16.5/gabarito_codigo.json` e `scripts/conferir_entrega_16_5.py`).
2. Só `index-dev.html` e `docs/design/tokens.css`. `index.html` e `Código.js` intocados; sem `clasp`. Pacote só de frontend: `git push` publica.
3. Entradas: `docs/design/16.5/04_tokens.css` (o do Design, com `--f-title: 'Figtree'` e títulos 600) e `docs/design/16.5/CONFERENCIA_16_5a.md` item 4 (diff de tokens já feito).

## Passo 0 — Ajustes de bordo herdados do 16.5a (mesmo commit ou commit `Docs:` separado, antes do passo 1)
- `.gitignore`: acrescentar `!scripts/*.py` (o 16.5a precisou de `git add -f` para versionar `scripts/conferir_entrega_16_5.py`). Conferir com `git check-ignore -v scripts/conferir_entrega_16_5.py` que o arquivo deixou de ser ignorado.
- `docs/licoes-aprendidas.md`: acrescentar as lições 79–84, copiadas da seção 8 do status (o usuário cola o trecho se você não tiver acesso ao status; o texto está reproduzido no fim deste prompt).
- Branches locais já mesclados em `main`: `git branch -d pacote-16.4.3 pacote-17.0` (decisão C do usuário). Não tocar em `pacote-16` nem em nada remoto.

## Passos
1. **Gabarito antes:** rodar `python scripts/conferir_entrega_16_5.py` e guardar a saída do item 1 (45 · 225 · 45 · 3).
2. **Google Fonts:** no `<head>` de `index-dev.html`, o `<link>` de fontes passa a carregar só Figtree (pesos 400, 500, 600, 700; `display=swap`); a Newsreader sai do link e de qualquer `@font-face`/`preconnect` específico. Grep final: zero ocorrências de `Newsreader` em `index-dev.html` e em `docs/design/tokens.css`.
3. **Tokens de fonte:** em `docs/design/tokens.css` e no `:root` de `index-dev.html` (tema claro; conferir se o escuro redeclara algo de fonte): `--f-title` → `'Figtree', system-ui, sans-serif`; `--t-display`, `--t-h1`, `--t-h2`, `--t-h3`, `--t-h4`, `--t-num` → peso **600** (copiar os valores exatos do `04_tokens.css` do Design; não copiar o arquivo inteiro por cima — só as linhas de fonte e peso). Se houver regras CSS com `font-family` literal ou `font-weight: 500` em títulos fora dos tokens, listar por grep e decidir: título → 600 via token; texto corrido → inalterado.
4. **Débito 8.16:** remover `<link rel="manifest" href="manifest.json">` de `index-dev.html` (grep confirma que não há outra referência a `manifest`).
5. **Marcador:** comentário da linha 2 de `index-dev.html` → "Pacote 16.4.5 (data)".
6. **Validação:** `node --check` do JS extraído; tags balanceadas fora dos `<script>`; toda `var(--x)` declarada; zero cor fixa fora do `:root`; **gabarito depois** igual ao de antes (byte a byte no JSON); Playwright com Chrome visível em 390×844 e 1280×800: login com sigla inválida até "Sigla ou senha incorretos", zero `pageerror`, comparando com `index.html`; **captura de tela** de Início, hub do automonitoramento, etapa 2 do Registro Negativo, menu de Escalas e Painel com sessão simulada do paciente de teste (`salvarSessao({...})`, sem senha), 390 e 1280, em `../VMC-offline/capturas_16_4_5/`; no `document.fonts` da página publicada, listar as famílias carregadas: só Figtree.
7. **Publicar:** commit `Pacote 16.4.5 - Fonte unica Figtree e remocao do manifest (index-dev)` · `git push` · esperar o Pages · abrir `index-dev.html?v=1645` no Playwright e repetir o login inválido (zero `pageerror`) e a checagem de `document.fonts`.
8. **Relatório** `../VMC-offline/PACOTE_16_4_5_RELATORIO.md`: o que mudou (linhas), grep de `Newsreader` = 0, `document.fonts` no publicado, gabarito igual, capturas. Atualizar `docs/arquitetura.md` (seção "Sistema visual": fonte única) e `CLAUDE.md` (seção 6 da identidade visual: sai a Newsreader) no mesmo commit ou num commit `Docs:` logo após.
9. Mensagem final: "publicado" + link da página de teste + 5 linhas de resultado.

## Checklist do usuário (aba anônima, `index-dev.html?v=1645`)
- [ ] Nenhum título com serifa em lugar nenhum (Início, automonitoramento, escalas, Painel, Meus Registros, área do profissional).
- [ ] Títulos visivelmente mais pesados que o texto (600 × 400), sem parecer negrito de sistema.
- [ ] Console sem o erro 404 de `manifest.json`.
- [ ] Login e navegação funcionando como antes.

## Anexo — lições 79–84 para `docs/licoes-aprendidas.md` (numeração contínua; obsoletas continuam marcadas)
- **79 — Conteúdo clínico nunca sai de prancha** (22/09/2026). A v1 do Design reescreveu itens, cortou grupos e renomeou grupos; o `mapa_campos.md` também errou. Textos clínicos vêm do HTML atual e um script compara o catálogo antes e depois de cada bloco (16.5a: `scripts/conferir_entrega_16_5.py`, `docs/design/16.5/gabarito_codigo.json`).
- **80 — Tipografia só se avalia com a fonte real renderizada** (22/09/2026). Imagens geradas no ambiente de nuvem saem com DejaVu quando o Google Fonts não carrega; para avaliar fonte, renderizar com os arquivos reais (Fontsource).
- **81 — Texto de interface só muda com motivo registrado** (22/09/2026), numa lista "hoje → proposta → motivo" que acompanha o pacote (tela saiu, texto falso, vocabulário, consistência, repetição, digitação, elemento novo, decisão).
- **82 — A decisão de UX do usuário, registrada com imagem, prevalece sobre a prancha** (25–26/09/2026). O brief ao Design só sai depois das respostas; diferença entre prancha e decisão vira rodada nova do Design, nunca construção "do jeito da prancha".
- **83 — Painel de conferência visual + prompts em arquivo** (26/09/2026). O documento que o usuário confere mostra as telas reais, o que muda/não muda, as fases com portões e o checklist; o que as ferramentas executam fica em `docs/prompts/` e no brief do Design, nunca colado no painel.
- **84 — Arquivos do PC entram pelo terminal ligado ao Cowork ou pelo Claude Code, nunca pelo conector do Drive em base64** (25/09/2026).
