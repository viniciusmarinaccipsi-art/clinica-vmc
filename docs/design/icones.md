# Ícones do sistema visual (Pacote 16.2)

Sprite SVG inline no início do `<body>` de `index-dev.html`: `<svg style="display:none"><symbol id="i-…" viewBox="0 0 24 24">…</symbol></svg>`.
Todos os símbolos são **desenho próprio** (grade 24, traço 1,75 px, `currentColor`, cantos e pontas arredondados); não há cópia de conjunto externo, logo sem crédito de terceiros. Estilo geométrico compatível com conjuntos MIT como Lucide, caso se queira trocar depois.

## Uso

```html
<!-- com texto ao lado -->
<svg class="ico" aria-hidden="true"><use href="#i-lock"/></svg> Bloqueado
<!-- sozinho num botão sem rótulo -->
<svg class="ico" role="img" aria-label="Sair"><use href="#i-power"/></svg>
<!-- em strings JS (sem aspas, para caber em qualquer delimitador) -->
'<svg class=ico aria-hidden=true><use href=#i-check></use></svg>'
```

`.ico` = 1,25 em, `vertical-align:-.3em`, `fill:none`, `stroke:currentColor`. `.ico-lg` = 28 px (cards do menu). Contêineres de ícone (`.card-icon`, `.auto-card-icon`, `.esc-card-icon`, `.login-tipo-icon`, `.p8-edu-icon`, `.p5-modal-icone`, `.login-icon`, `.prof-pv-mod-icon`) fixam 28 px; `.auto-sec-icon` 20 px. Cor por token: `.ico-pos`, `.ico-warn`, `.ico-risk2`, `.ico-risk` (bolinhas de severidade).
Pseudo-elementos que exibiam emoji (`.card.locked …::after`, `.auto-progress::before`, `.gbar-step.concluido::after`, `.auto-group-summary::before`, `.auto-sec-warn::before`, `.p11-tab.filled::after`) usam máscara (`--ico-lock`, `--ico-check`, `--ico-check-square`, `--ico-alert`, declaradas no `:root`) com `background:currentColor`.
**Zero emoji (Pacote 16.5b).** As 5 faces da escala de humor, que eram a última exceção, passaram a símbolos do sprite `#i-humor-1` … `#i-humor-5` (entrega do Design de 25/09, `docs/design/16.5/05_rostinhos.svg`: círculo + traços, grade 24, traço 2). A cor vem das classes `.ico-humor-1` … `.ico-humor-5` (`--c-humor-N-ink`, de ameixa a verde-água; o 3 é índigo neutro). Único ponto de geração em JS: `vmcHumorIcone(nivel)` — fora de 1–5 devolve `#i-help`. Consumidores: checagem de humor (`.mood-card`), cabeçalho cumulativo, revisão, Meus Registros (lista e modal), edição do registro pelo paciente, legenda do gráfico de humor do Painel e chips do profissional. Nenhum caractere da faixa de emoticons/pictogramas existe mais em `index-dev.html`.

| símbolo | nível do humor | classe de cor |
|---|---|---|
| `#i-humor-1` | 1 · Muito negativo | `.ico-humor-1` → `--c-humor-1-ink` |
| `#i-humor-2` | 2 · Negativo | `.ico-humor-2` → `--c-humor-2-ink` |
| `#i-humor-3` | 3 · Neutro | `.ico-humor-3` → `--c-humor-3-ink` |
| `#i-humor-4` | 4 · Positivo | `.ico-humor-4` → `--c-humor-4-ink` |
| `#i-humor-5` | 5 · Muito positivo | `.ico-humor-5` → `--c-humor-5-ink` |

## Mapa emoji → símbolo (ocorrências contadas em `index.html` de produção)

| símbolo | emoji(s) substituído(s) | ocorrências em index.html |
|---|---|---|
| `#i-check` | ✓ ✅ | 30 |
| `#i-alert` | ⚠️ | 22 |
| `#i-heart` | 💙 💚 | 17 |
| `#i-lock` | 🔒 🔐 | 16 |
| `#i-heart-crack` | 💔 | 16 |
| `#i-pin` | 📍 | 15 |
| `#i-circle` | 🟢 🟡 🟠 🔴 | 14 |
| `#i-cloud-rain` | 🌧️ 😔 | 12 |
| `#i-zap` | ⚡ 😰 | 12 |
| `#i-trend-up` | 📈 | 11 |
| `#i-search` | 🔍 | 10 |
| `#i-calendar` | 📅 🗓️ | 10 |
| `#i-file` | 📝 | 10 |
| `#i-chart` | 📊 | 9 |
| `#i-trend-down` | 📉 | 9 |
| `#i-leaf` | 🌿 🌱 | 9 |
| `#i-clipboard` | 📋 | 9 |
| `#i-sun` | ☀️ | 8 |
| `#i-key` | 🔑 🗝️ | 7 |
| `#i-book` | 📖 📚 | 7 |
| `#i-thermometer` | 🌡️ 😤 | 7 |
| `#i-pencil` | ✏️ | 7 |
| `#i-help` | ❓ 🤔 | 7 |
| `#i-inbox` | 📭 | 4 |
| `#i-plus-circle` | 🚑 | 3 |
| `#i-phone` | 📞 ☎️ | 3 |
| `#i-save` | 💾 | 3 |
| `#i-send` | 📤 | 3 |
| `#i-target` | 🎯 | 3 |
| `#i-unlock` | 🔓 | 2 |
| `#i-clock` | 🕐 ⏱️ | 2 |
| `#i-hourglass` | ⏳ | 2 |
| `#i-x` | ✕ | 2 |
| `#i-settings` | ⚙️ | 2 |
| `#i-pause` | ⏸️ | 2 |
| `#i-trash` | 🗑️ | 2 |
| `#i-bulb` | 💡 | 2 |
| `#i-brain` | 🧠 | 2 |
| `#i-wrench` | 🛠️ 🏗️ | 2 |
| `#i-star` | 🌟 | 2 |
| `#i-layers` | 🤯 | 2 |
| `#i-alert-circle` | ⛔ | 1 |
| `#i-message` | 💬 | 1 |
| `#i-check-square` | ☑ | 1 |
| `#i-plus` | ➕ | 1 |
| `#i-power` | ⏻ | 1 |
| `#i-menu` | ☰ | 1 |
| `#i-compass` | 🧭 | 1 |
| `#i-user` | 👤 | 1 |
| `#i-archive` | 🗂️ | 1 |
| `#i-puzzle` | 🧩 | 1 |
| `#i-building` | 🏢 | 1 |
| `#i-monitor` | 💻 | 1 |
| `#i-refresh` | 🔄 | 1 |
| `#i-pointer` | 👆 | 1 |
