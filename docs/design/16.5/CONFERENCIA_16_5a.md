# Conferência 16.5a — entrega do Design (rodada 2) × `index-dev.html`

Gerado por `scripts/conferir_entrega_16_5.py` sobre `docs/design/16.5`. Reexecutável e determinístico (sem data/hora no corpo).

| # | Item | Resultado |
|---|---|---|
| 1 | Gabarito | OK (45 · 225 · 45 · 3) |
| 2 | Catálogo × gabarito | OK |
| 3 | Textos | 4 sem origem (além dos 1 aceitos) |
| 4 | Tokens | 2 diferença(s) |
| 5 | Rostinhos | OK |
| 6 | Ícones | OK (faltam só i-humor-1, i-humor-2, i-humor-3, i-humor-4, i-humor-5) |
| 7 | Referência | OK (12 arquivos) |

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
| `sec-auto-sit-a` | 4752 | 4872 | 121 | 5 | 25 |
| `sec-auto-emo-a` | 4874 | 5366 | 493 | 5 | 25 |
| `sec-auto-fis-a` | 5368 | 5860 | 493 | 5 | 25 |
| `sec-auto-pens-a` | 5862 | 6417 | 556 | 5 | 25 |
| `sec-auto-comp-a` | 6419 | 6619 | 201 | 5 | 25 |
| `sec-auto-sit-b` | 6621 | 6637 | 17 | 0 | 0 |
| `sec-auto-emo-b` | 6639 | 7129 | 491 | 5 | 25 |
| `sec-auto-fis-b` | 7131 | 7621 | 491 | 5 | 25 |
| `sec-auto-pens-b` | 7623 | 8125 | 503 | 5 | 25 |
| `sec-auto-comp-b` | 8127 | 8327 | 201 | 5 | 25 |

## 2. `catalogo.js` × gabarito

**OK** — forma do título no código: numerado ("N. Título")


## 3. Textos (`textos` do catalogo.js + strings entre aspas de 02/03)

**4 diferença(s)** — 95 existem em `index-dev.html` · 38 na coluna "Proposta" · 1 aceitos pelo usuário · 7 só caixa alta · 12 modelos com N · 3 data/hora de exemplo · 3 abreviados · 4 compostos · **4 sem origem**

**Sem origem** (não estão em `index-dev.html`, nem na coluna "Proposta", nem na lista aceita):
- `02_telas.md` — "Fazer também um Registro Negativo"
- `02_telas.md` — "O QUE JÁ ESTÁ ANOTADO"
- `02_telas.md` — "Reações Físicas de Bem-Estar ›"
- `catalogo.js:textos` — "Identifique as emoções desagradáveis e avalie a intensidade do desconforto"

Aceitos pelo usuário (não são erro):
- "2 reações físicas marcadas"

Só a caixa difere (o Design usa `text-transform`; LEIA-ME, dúvida 5):
- "ACREDITO:"
- "BEM-ESTAR:"
- "CONFORTO:"
- "DESCONFORTO:"
- "MAL-ESTAR:"
- "QUER CONTINUAR?"
- "SE QUISER CONTINUAR"

Modelos com placeholder ou instância de modelo ("N marcado(s)", "Etapa N de 5 · nome", "RÓTULO · N"):
- "1 marcado" — instância de "N marcado(s)"
- "COMPORTAMENTOS DISFUNCIONAIS · 2" — instância de "RÓTULO · N"
- "Etapa 1 de 5 · Situação" — instância de "Etapa N de 5 · nome"
- "Etapa 4 de 5 · Pensamentos Desadaptativos" — instância de "Etapa N de 5 · nome"
- "Etapa N de 5 · nome completo" — placeholder N / nome
- "N · Palavra" — placeholder N / nome
- "N. Título" — placeholder N / nome
- "Pensamentos Desadaptativos ›" — instância de "Nome da próxima etapa ›"
- "REAÇÕES FÍSICAS DE MAL-ESTAR · 2" — instância de "RÓTULO · N"
- "N marcado(s)" — placeholder N / nome
- "Nome da próxima etapa ›" — placeholder N / nome
- "· Etapa N de 5 · nome" — placeholder N / nome

Data/hora de exemplo da prancha:
- "Hoje, 22/09 · 10:12"
- "· 22/09 às 10:05"
- "· Hoje, 22/09 às 10:05"

Texto existente abreviado com "…":
- "Fazer também…"
- "O que estava passando pela minha mente instantes antes…"
- "Precisa de ajuda?…"

Compostos de partes que existem (separadores " · ", "/", ": "):
- ") · textarea · rótulo" — todas as partes existem: ) | textarea | rótulo
- "+ Outro: especifique..." — todas as partes existem: Outro | especifique...
- "Nada · Pouco · Moderado · Muito · Totalmente" — todas as partes existem: Nada | Pouco | Moderado | Muito | Totalmente
- "Nenhum · Pouco · Moderado · Muito · Intenso/Extremo" — todas as partes existem: Nenhum | Pouco | Moderado | Muito | Intenso | Extremo

Na coluna "Proposta" (texto novo previsto no arquivo de textos):
- ". A checagem breve de humor já está liberada."
- "2 emoções marcadas"
- "2 marcados"
- "5 itens"
- "Abrir o Painel de Evolução"
- "Antes do registro completo, leia o"
- "Checagem breve de humor"
- "Checagem de humor enviada"
- "Como está seu humor agora?"
- "Concluir só com a checagem de humor"
- "Confira as informações antes de enviar."
- "Continuar de onde parei"
- "Descartar e começar novo"
- "EMOÇÕES DESAGRADÁVEIS · 2"
- "Etapa 2 de 5 · Emoções Desagradáveis"
- "Fazer também um Registro Positivo"
- "Faça a checagem breve de humor e, se quiser, siga para o registro completo."
- "Fica em Meus Registros e no Painel de Evolução."
- "Hoje, 22/09 · 10:05"
- "Na checagem você anotou:"
- "O que você preencheu fica guardado enquanto esta aba estiver aberta."
- "Onde você estava, o que estava fazendo, com quem estava ou se estava só?"
- "PENSAMENTOS DESADAPTATIVOS · 1"
- "Reações Físicas de Mal-Estar ›"
- "Registro enviado"
- "SITUAÇÃO"
- "Sair sem enviar?"
- "Salvar e sair"
- "Seu terapeuta terá acesso a este registro. Você pode corrigir depois em Meus Registros."
- "Você pode corrigir depois em Meus Registros."
- "Voltar ao início"
- "· N"
- "Ex.: o fato ou a conversa que mexeu com você."
- "Mais ou menos"
- "Muito bem"
- "Muito mal"
- "O que você sentiu no corpo?"
- "O que você sentiu?"

Fragmentos de aspas aninhadas do Markdown, ignorados (não são textos de interface):
- "(Nada … Totalmente) · rodapé"
- "(sem observação:"
- "); na etapa 5,"
- "+ frase"
- ", **sem escala** · rodapé"
- ". Aberto: título + contagem, descrição completa em itálico, chips dos 5 itens + chip tracejado"
- ". No Positivo, a linha SITUAÇÃO mostra só a frase. Rodapé do cartão:"
- ". Tocar o chip do"
- "Triste **3** · Desanimado(a) **4**"
- "marcado reabre o campo para editar; apagar o texto e confirmar remove o chip (e a escala) e o tracejado volta. O texto vai para o campo"
- "volta à etapa da última linha;"
- "· 5 grupos (Evitação / Fuga; Isolamento / Retraimento; Agitação / Reatividade; Entorpecimento / Fuga emocional; Busca excessiva de controle / Reasseguramento), o 1º aberto, **sem escala** · rodapé"
- "· 5 grupos, o 1º aberto (Pensamentos sobre Mim Mesmo (Autocrítica)) com"
- "· dica visível"

## 4. Tokens (`04_tokens.css` × `docs/design/tokens.css`)

### Tema claro

NOVO (entram no 16.5b, mesclados):
- `--c-humor-1-bg`: `#EFDCE4`
- `--c-humor-1-ink`: `#7A3E59`
- `--c-humor-2-bg`: `#F6E9EF`
- `--c-humor-2-ink`: `#7A3E59`
- `--c-humor-3-bg`: `#E7E6F5`
- `--c-humor-3-ink`: `#3D3A6B`
- `--c-humor-4-bg`: `#EAF4F2`
- `--c-humor-4-ink`: `#245F5A`
- `--c-humor-5-bg`: `#D9ECE9`
- `--c-humor-5-ink`: `#245F5A`
- `--c-reg-neg-mid`: `#C69AB2`
- `--c-reg-pos-mid`: `#8FBFBA`
- `--hit-face`: `56px`
- `--t-h2-sm`: `600 22px/1.25 var(--f-title)`
- `--t-legend`: `400 14px/1.2 var(--f-text)`
- `--w-likert-col`: `70px`

MUDOU (16.4.5 troca só as linhas de fonte/peso):
- `--f-title`: `'Newsreader', Georgia, serif` → `'Figtree', system-ui, sans-serif`
- `--t-display`: `500 32px/1.2 var(--f-title)` → `600 32px/1.2 var(--f-title)`
- `--t-h1`: `500 27px/1.2 var(--f-title)` → `600 27px/1.2 var(--f-title)`
- `--t-h2`: `500 24px/1.25 var(--f-title)` → `600 24px/1.25 var(--f-title)`
- `--t-h3`: `500 20px/1.3 var(--f-title)` → `600 20px/1.3 var(--f-title)`
- `--t-h4`: `500 18px/1.3 var(--f-title)` → `600 18px/1.3 var(--f-title)`

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

### Tema escuro

NOVO (entram no 16.5b, mesclados):
- `--c-humor-1-bg`: `#3A2436`
- `--c-humor-1-ink`: `#E4B4C9`
- `--c-humor-2-bg`: `#2E2130`
- `--c-humor-2-ink`: `#E4B4C9`
- `--c-humor-3-bg`: `#262441`
- `--c-humor-3-ink`: `#C4C2EE`
- `--c-humor-4-bg`: `#16302E`
- `--c-humor-4-ink`: `#8FD3CC`
- `--c-humor-5-bg`: `#1C3D3A`
- `--c-humor-5-ink`: `#8FD3CC`
- `--c-reg-neg-mid`: `#7E4E68`
- `--c-reg-pos-mid`: `#3F7A75`

MUDOU (16.4.5 troca só as linhas de fonte/peso):
- (nenhum)

SUMIU no arquivo do Design — **ficam** no repositório (ganhos após 17/09):
- `--c-bai-ink`: `#C3CE8E`
- `--c-bai-tint`: `#232815`
- `--c-bdi2-ink`: `#A9B9E8`
- `--c-bdi2-tint`: `#1B2135`

### Pranchas (`01_pranchas_16.5.html`)

As telas vivem no `<script type="__bundler/template">` (lição 76); o resto do arquivo é o cromo do visualizador do pacote e não entra no app.

`var(--x)` usados no arquivo: 7; não declarados em `04_tokens.css`:
- (nenhum)

**Dentro das telas** — `#hex` fora dos valores de `04_tokens.css` (ocorrências):
- (nenhum)

**Dentro das telas** — `rgb()/rgba()` fora dos tokens (ocorrências):
- `rgba(29,27,43,.08)` × 1
- `rgba(29,27,43,.45)` × 1

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

**2 diferença(s)**
- rgba fora dos tokens nas telas: rgba(29,27,43,.08) ×1
- rgba fora dos tokens nas telas: rgba(29,27,43,.45) ×1

## 5. Rostinhos (`05_rostinhos.svg`)

**OK** — símbolos: ['i-humor-1', 'i-humor-2', 'i-humor-3', 'i-humor-4', 'i-humor-5']; bloco `<metadata>` (C2PA) presente: sim — é descartado na importação para o sprite.


## 6. Ícones (`icones.js` × sprite de `index-dev.html`)

**OK** — 28 ids em icones.js; sprite tem 55 símbolos.

Ausentes do sprite (esperado: só `i-humor-1..5`, que entram no 16.5b):
- `i-humor-1`
- `i-humor-2`
- `i-humor-3`
- `i-humor-4`
- `i-humor-5`

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

