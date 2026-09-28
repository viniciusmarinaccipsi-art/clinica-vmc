# PROMPT · Pacote 16.5f.1 — Lateral "Suas 5 etapas": nome longo passa por cima do ícone (index-dev)

**Leia:** `CLAUDE.md`; `../VMC-offline/PACOTE_16_5f_RELATORIO.md` (desvios, lição 92); `docs/prompts/MODELO_PROMPT.md`.

## Bug (achado no QA visual do usuário, 28/09, `?v=165f`, 1280 e 1000 px)
No cartão lateral "Suas 5 etapas", os nomes de duas linhas — "Reações Físicas de Mal-Estar", "Pensamentos Desadaptativos", "Comportamentos Disfuncionais" — não quebram: o texto transborda a coluna `minmax(0,1fr)` e cobre o ícone da etapa (coluna de 20 px). Ocorre na etapa feita (✓) e na atual. "Situação" e "Emoções Desagradáveis" cabem numa linha e não mostram o problema.

## Causa (conferida no clone, `51a722d`)
`index-dev.html` l. 1870: `.cab-etapa-nome{display:block;font:600 15px/1.25 var(--f-text);white-space:nowrap;}` — regra do cabeçalho v2 (16.5d-3). O 16.5f reaproveitou a **mesma classe** na lateral (l. 1935: `.cab-etapa-nome{font:400 15px/1.3 …}`) sem anular o `nowrap`. Colisão de nome de classe entre dois componentes.

## Passos
1. Reproduzir: Playwright local 1280, etapa 4, medir `getBoundingClientRect()` do `.cab-etapa-nome` e do `.cab-etapa-ico` de "Pensamentos Desadaptativos" — sobreposição horizontal > 0 antes da edição (capturar `lateral_etapas_antes.png`).
2. Grep dos consumidores de `.cab-etapa-nome` (HTML gerado em JS incluído). **Se a regra da l. 1870 só serve à lateral** (a trilha v4 do celular não tem nomes), removê-la — peso morto — e deixar a lateral com `white-space:normal; min-width:0; overflow-wrap:anywhere`. Se houver outro consumidor, renomear a classe da lateral para `.cab-lat-nome` (gerador em `cabRenderEtapasLateral`/l. ~11534 e CSS l. 1935–1942) e não tocar a l. 1870. Registrar qual dos dois caminhos foi tomado.
3. `validar_index_dev.py --antes/--depois` (classes sem uso = 0); Playwright 1000 e 1280: sobreposição = 0 nas 5 etapas, ícone visível, nome em 2 linhas; 390 sem mudança (capturas iguais); `pageerror` 0; payload 56 chaves; gabarito md5 igual.
4. Marcador linha 2 = "Pacote 16.5f.1"; commit "Pacote 16.5f.1 — Lateral: nome de etapa quebra em duas linhas sem cobrir o ícone (index-dev)"; push; `vmc_fumaca.js` a 1280 (`?v=165f1`).
5. Docs: `docs/licoes-aprendidas.md` — lição nova: **classe reaproveitada entre componentes herda regras que o novo não pediu; componente novo = classe nova ou grep da classe antes de reusar** (irmã da lição 92). Status (Drive) seções 1, 4, 5, 8, 9 pelo Code, **10ª edição**, cópia Drive → repo no commit. Relatório `../VMC-offline/PACOTE_16_5f_1_RELATORIO.md` ≤ 30 linhas.

## Checklist (Code confere no publicado; usuário só olha a lateral a 1280 e ~1000)
- [ ] Os 3 nomes longos em duas linhas, ícone inteiro à direita, nas etapas feita e atual.
- [ ] Situação e Emoções inalteradas; 390 idêntico ao 16.5f.
- [ ] Classes sem uso = 0; `pageerror` 0; gabarito igual.
