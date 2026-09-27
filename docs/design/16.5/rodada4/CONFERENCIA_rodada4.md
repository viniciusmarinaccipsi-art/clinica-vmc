# Conferência 16.5 — entrega do Design (rodada 4) × `index-dev.html`

Gerado por `scripts/conferir_entrega_16_5.py` sobre `../VMC-offline/16.5_entrada_design/Diagnóstico de usabilidade do sistema 16.5_v4/16.5_rodada4` (pranchas: `01_pranchas_16.5_v4.html`; contrato: `06_contrato_de_leitura_v4.md`). Reexecutável e determinístico (sem data/hora no corpo).

Arquivos que a pasta não tem e vieram de `docs/design/16.5/` (ou da pasta indicada): `02_telas.md (de docs/design/16.5/rodada3)`, `16.5_textos_interface.md`, `referencia_25-09/`.

| # | Item | Resultado |
|---|---|---|
| 0 | Catálogo | IGUAL |
| 1 | Gabarito | OK (45 · 225 · 45 · 3) |
| 2 | Catálogo × gabarito | OK |
| 3 | Textos | 6 sem origem (além dos 2 aceitos) |
| 4 | Tokens | OK |
| 5 | Rostinhos | OK |
| 6 | Ícones | OK (faltam só nenhum) |
| 7 | Referência | OK (12 arquivos) |
| 8 | Componentes da rodada 4 | OK |
| 9 | PNG rodada 4 | OK (8 arquivos) |

## 0. Catálogo idêntico à rodada 2 (`catalogo.js` × `docs/design/16.5/catalogo.js`)

**IGUAL** — 28944 bytes, idêntico ao da rodada 2.

## 1. Gabarito do código (`gabarito_codigo.json`)

**OK** — 45 grupos · 225 itens · 45 "Outro" · 3 legendas

Legendas encontradas:
- Nada · Pouco · Moderado · Muito · Totalmente
- Nenhum · Pouco · Moderado · Muito · Extremo
- Nenhum · Pouco · Moderado · Muito · Intenso

Rótulos de intensidade — negativo: ['Desconforto:', 'Mal-estar:', 'Acredito:'] · positivo: ['Conforto:', 'Bem-estar:', 'Acredito:']

Seções (linha inicial–final em `index-dev.html`, total de linhas):

| Seção | Início | Fim | Linhas | Grupos | Itens |
|---|---|---|---|---|---|
| `sec-auto-sit-a` | 4679 | 4855 | 177 | 5 | 25 |
| `sec-auto-emo-a` | 4876 | 5074 | 199 | 5 | 25 |
| `sec-auto-fis-a` | 5280 | 5478 | 199 | 5 | 25 |
| `sec-auto-pens-a` | 5684 | 5945 | 262 | 5 | 25 |
| `sec-auto-comp-a` | 6163 | 6339 | 177 | 5 | 25 |
| `sec-auto-sit-b` | 4856 | 4870 | 15 | 0 | 0 |
| `sec-auto-emo-b` | 5075 | 5274 | 200 | 5 | 25 |
| `sec-auto-fis-b` | 5479 | 5678 | 200 | 5 | 25 |
| `sec-auto-pens-b` | 5946 | 6157 | 212 | 5 | 25 |
| `sec-auto-comp-b` | 6340 | 6519 | 180 | 5 | 25 |

## 2. `catalogo.js` × gabarito

**OK** — forma do título no código: numerado ("N. Título")


## 3. Textos (`textos` do catalogo.js + strings entre aspas de 02/03)

**6 diferença(s)** — 127 existem em `index-dev.html` · 23 na coluna "Proposta" · 2 aceitos pelo usuário · 9 só caixa alta · 7 modelos com N · 4 data/hora de exemplo · 3 abreviados · 2 compostos · **6 sem origem**

**Sem origem** (não estão em `index-dev.html`, nem na coluna "Proposta", nem na lista aceita):
- `02_telas.md` — "Fazer também um Registro Negativo"
- `02_telas.md` — "O QUE JÁ ESTÁ ANOTADO"
- `03_componentes.md` — "2,8"
- `03_componentes.md` — "Humor médio em todos os registros"
- `03_componentes.md` — "Nenhum registro nesse período."
- `catalogo.js:textos` — "Identifique as emoções desagradáveis e avalie a intensidade do desconforto"

Aceitos pelo usuário (não são erro):
- "2 reações físicas marcadas"
- "QUE TIPO DE REGISTRO?"

Só a caixa difere (o Design usa `text-transform`; LEIA-ME, dúvida 5):
- "ACREDITO:"
- "BEM-ESTAR:"
- "CONFORTO:"
- "DESCONFORTO:"
- "MAL-ESTAR:"
- "QUER CONTINUAR?"
- "SE QUISER CONTINUAR"
- "SUAS 5 ETAPAS"
- "PREENCHENDO"

Modelos com placeholder ou instância de modelo ("N marcado(s)", "Etapa N de 5 · nome", "RÓTULO · N"):
- "1 marcado" — instância de "N marcado(s)"
- "COMPORTAMENTOS DISFUNCIONAIS · 2" — instância de "RÓTULO · N"
- "Etapa 1 de 5 · Situação" — instância de "Etapa N de 5 · nome"
- "Etapa 4 de 5 · Pensamentos Desadaptativos" — instância de "Etapa N de 5 · nome"
- "N. Título" — placeholder N / nome
- "REAÇÕES FÍSICAS DE MAL-ESTAR · 2" — instância de "RÓTULO · N"
- "Humor médio nos N dias" — placeholder N / nome

Data/hora de exemplo da prancha:
- "Hoje, 22/09 · 10:12"
- "· 22/09 às 10:05"
- "· Hoje, 22/09 às 10:05"
- "26/09/2026 · 14:57"

Texto existente abreviado com "…":
- "Fazer também…"
- "O que estava passando pela minha mente instantes antes…"
- "Precisa de ajuda?…"

Compostos de partes que existem (separadores " · ", "/", ": "):
- ") · textarea · rótulo" — todas as partes existem: ) | textarea | rótulo
- "4 · Muito" — todas as partes existem: 4 | Muito

Na coluna "Proposta" (texto novo previsto no arquivo de textos):
- "2 emoções marcadas"
- "2 marcados"
- "3 · Moderado"
- "Abrir o Painel de Evolução"
- "Confira as informações antes de enviar."
- "Continuar de onde parei"
- "Descartar e começar novo"
- "EMOÇÕES DESAGRADÁVEIS · 2"
- "Etapa 2 de 5 · Emoções Desagradáveis"
- "Fazer também um Registro Positivo"
- "Hoje, 22/09 · 10:05"
- "Na checagem você anotou:"
- "O que você preencheu fica guardado enquanto esta aba estiver aberta."
- "PENSAMENTOS DESADAPTATIVOS · 1"
- "Registro enviado"
- "SITUAÇÃO"
- "Seu terapeuta terá acesso a este registro. Você pode corrigir depois em Meus Registros."
- "Você pode corrigir depois em Meus Registros."
- "COMPORTAMENTOS"
- "EMOÇÕES"
- "PENSAMENTOS"
- "REAÇÕES FÍSICAS"
- "Ex.: o fato ou a conversa que mexeu com você."

Fragmentos de aspas aninhadas do Markdown, ignorados (não são textos de interface):
- "(Fiquei em silêncio ou me resguardei; Me afastei das pessoas ou evitei o contato — acesos em ameixa, **sem barra**) · rodapé"
- "(Nada … Totalmente) · rodapé"
- "(a Situação do Positivo não tem grupos — débito 8.6) · rodapé sem contagem ·"
- "(sem observação:"
- "); na etapa 5,"
- ". No Positivo, a linha SITUAÇÃO mostra só a frase. Rodapé do cartão:"
- "Triste **3** · Desanimado(a) **4**"
- "com  (só quando há etapa feita; na etapa 1 não aparece) e"
- "volta à etapa da última linha;"
- "· 5 grupos (Evitação / Fuga; Isolamento / Retraimento; Agitação / Reatividade; Entorpecimento / Fuga emocional; Busca excessiva de controle / Reasseguramento), o 2º aberto com"
- "· 5 grupos, o 1º aberto (Pensamentos sobre Mim Mesmo (Autocrítica)) com"
- "· dica visível"
- "· dica · textarea · **sem**"
- "; *carregando:* grade sem linha, valor"

## 4. Tokens (`04_tokens.css` × `docs/design/tokens.css`)

### Tema claro

NOVO (entram no 16.5b, mesclados):
- (nenhum)

MUDOU (16.4.5 troca só as linhas de fonte/peso):
- (nenhum)

SUMIU no arquivo do Design — **ficam** no repositório (ganhos após 17/09):
- `--c-bai-ink`: `#4F5B23`
- `--c-bai-tint`: `#EAEFDC`
- `--c-bdi2-ink`: `#35477F`
- `--c-bdi2-tint`: `#E7EBF5`
- `--c-bg-app`: `var(--c-bg)`
- `--c-bg-page`: `var(--c-bg)`
- `--c-ink-4`: `var(--c-ink-3)`
- `--c-placeholder`: `var(--c-ink-3)`
- `--c-surface-2`: `var(--c-surface-sub)`
- `--t-quote`: `italic 400 18px/1.5 var(--f-title)`

Já aplicados no repositório com o mesmo valor do Design (16.4.5 / 16.5b):
- `--c-humor-1-bg`
- `--c-humor-2-bg`
- `--c-humor-3-bg`
- `--c-humor-4-bg`
- `--c-humor-5-bg`
- `--c-humor-1-ink`
- `--c-humor-2-ink`
- `--c-humor-3-ink`
- `--c-humor-4-ink`
- `--c-humor-5-ink`
- `--c-reg-neg-mid`
- `--c-reg-pos-mid`
- `--t-h2-sm`
- `--t-legend`
- `--hit-face`
- `--w-likert-col`
- `--f-title`
- `--t-display`
- `--t-h1`
- `--t-h2`
- `--t-h3`
- `--t-h4`

### Tema escuro

NOVO (entram no 16.5b, mesclados):
- (nenhum)

MUDOU (16.4.5 troca só as linhas de fonte/peso):
- (nenhum)

SUMIU no arquivo do Design — **ficam** no repositório (ganhos após 17/09):
- `--c-bai-ink`: `#C3CE8E`
- `--c-bai-tint`: `#232815`
- `--c-bdi2-ink`: `#A9B9E8`
- `--c-bdi2-tint`: `#1B2135`

### Pranchas (`01_pranchas_16.5.html`)

As telas vivem no `<script type="__bundler/template">` (lição 76); o resto do arquivo é o cromo do visualizador do pacote e não entra no app.

`var(--x)` usados no arquivo: 12; não declarados em `04_tokens.css`:
- (nenhum)

**Dentro das telas** — `#hex` fora dos valores de `04_tokens.css` (ocorrências):
- (nenhum)

**Dentro das telas** — `rgb()/rgba()` fora dos tokens (ocorrências):
- (nenhum)

Fora das telas (cromo do visualizador; informativo, não conta como diferença):
- `#2A1215` × 1
- `#5C2B2E` × 1
- `#666` × 1
- `#999` × 2
- `#FAF9F5` × 2
- `#FF8A80` × 1
- `#FFF` × 1
- `rgba(0,0,0,0.08)` × 1
- `rgba(0,0,0,0.12)` × 1
- `rgba(255,255,255,0.9)` × 1

**OK**

## 5. Rostinhos (`05_rostinhos.svg`)

**OK** — símbolos: ['i-humor-1', 'i-humor-2', 'i-humor-3', 'i-humor-4', 'i-humor-5']; bloco `<metadata>` (C2PA) presente: sim — é descartado na importação para o sprite.

Já no sprite de `index-dev.html` com o mesmo desenho (16.5b): `i-humor-1`, `i-humor-2`, `i-humor-3`, `i-humor-4`, `i-humor-5`.


## 6. Ícones (`icones.js` × sprite de `index-dev.html`)

**OK** — 29 ids em icones.js; sprite tem 60 símbolos.

Ausentes do sprite (esperado: só `i-humor-1..5`, que entram no 16.5b):
- (nenhum)

Ausentes além de `i-humor-*`:
- (nenhum)

## 7. Referência 25/09 × entrega da rodada 2

**OK** — 12 arquivos em `referencia_25-09/`.

| Arquivo | Tipo | Dimensões | Prancha rodada 2 | Situação |
|---|---|---|---|---|
| `V-01_checagem.jpg` | JPEG | 560×1246 | AUT-03 (fim da tela) | DIVERGE — aguarda rodada 3 (§1.1: escolha do tipo sai da checagem) |
| `V-02a_automonitoramento-primeiro-acesso.jpg` | JPEG | 560×1052 | AUT-02 primeiro acesso | DIVERGE — aguarda rodada 3 (§1.1: cartões de tipo na página; aviso D11) |
| `V-02b_automonitoramento.jpg` | JPEG | 560×911 | AUT-02 | DIVERGE — aguarda rodada 3 (§1.1: "QUE TIPO DE REGISTRO?" + cartões) |
| `V-03_menu-etapas.jpg` | JPEG | 560×1064 | AUT-03c (nova) | NOVA — não existe na rodada 2 (§1.2: menu "Suas 5 etapas") |
| `V-04_etapa1-situacao.jpg` | JPEG | 560×2109 | AUT-04 | DIVERGE — aguarda rodada 3 (§1.3: subgrupos em lista com check redondo) |
| `V-05_etapa2-emocoes.jpg` | JPEG | 560×2136 | AUT-05 | DIVERGE — aguarda rodada 3 (§1.3: lista + barra deslizante) |
| `V-06_etapa3-reacoes.jpg` | JPEG | 560×2052 | AUT-06 | DIVERGE — aguarda rodada 3 (§1.3: lista + barra deslizante) |
| `V-07_etapa4-pensamentos.jpg` | JPEG | 560×2594 | AUT-07 | DIVERGE — aguarda rodada 3 (§1.3: lista + barra; ajuda âmbar recolhida) |
| `V-08_etapa5-comportamentos.jpg` | JPEG | 560×2347 | AUT-08 / AUT-08p | DIVERGE — aguarda rodada 3 (§1.3: lista com check redondo) |
| `V-09_revisar.jpg` | JPEG | 560×1450 | AUT-09 | APROVADA como está na rodada 2 |
| `V-10_enviado.jpg` | JPEG | 560×758 | AUT-10 | APROVADA como está na rodada 2 |
| `V-11_computador-1280_modelo.png` | PNG | 2560×2976 | AUT-11 | DIVERGE — aguarda rodada 3 (§1.4: coluna lateral + lista/barra em duas colunas) |

Aprovadas como estão, sem imagem de referência (não mudam na rodada 3): AUT-03b, AUT-12a, AUT-12b, AUT-12c.

Aguardam a rodada 3: AUT-02, AUT-03 (fim da tela), AUT-03c (nova), AUT-04 a AUT-08, AUT-08p, AUT-11.

## 8. Componentes e telas da rodada 4 (`03_componentes.md`, `02_telas.md`)

Componentes (título de seção por grep):
- `CabeçalhoCumulativo v2`: encontrado — "## 3. CabeçalhoCumulativo v2"
- `CartãoChecagemEnviada`: encontrado — "## 18. CartãoChecagemEnviada"
- `GráficoHumor`: encontrado — "## 19. GráficoHumor"

Telas: (a rodada 4 não reenvia `02_telas.md`; o conferido é o da rodada 3, emprestado)

**OK**

## 9. PNG da rodada 4 (`01_png/`)

8 arquivos. **OK** — `AUT-03`, `AUT-03b`, `AUT-04`, `AUT-05p`, `AUT-06`, `AUT-06alt`, `AUT-08`, `AUT-11` presentes nos nomes.

