# PROMPT · Pacote 16.5 — pendências de conferência antes da rodada 3 (fase 5½)

Sistema Clínico Digital VMC · 26/09/2026 · Tema G · Pacote 16.5. Sem mudança de código no app: só captura, script de conferência e docs. Pode rodar antes de a rodada 3 do Design chegar.

## Contexto
1. Ler `CLAUDE.md` e `docs/prompts/16.5/00_PANORAMA_16_5.md`. `git pull`. Pré-requisito: 16.5d-1 fechado (commit `7efec59`).
2. **Não editar** `index-dev.html`, `index.html` nem `Código.js`. Sem `clasp`. Só `scripts/conferir_entrega_16_5.py`, capturas em `../VMC-offline/capturas_16_5b/` e o relatório.
3. Motivo: a conferência do chat nas fontes (26/09) encontrou duas pendências do 16.5b: a captura `dev-pub_registros_390.png` saiu com a lista ainda carregando (spinner, meses recolhidos) e não prova o rostinho em Meus Registros; e o script do 16.5a ainda não sabe conferir a entrega da rodada 3 (nomes `_v3`, `catalogo.js` idêntico ao da rodada 2).

## Passos
1. **Refazer a captura de Meus Registros no publicado** (`https://viniciusmarinaccipsi-art.github.io/clinica-vmc/index-dev.html?v=165d1`), Playwright com Chrome visível, sessão simulada do paciente de teste (`salvarSessao({...})`, sem senha), 390×844 e 1280×800:
   - abrir Meus Registros; esperar `networkidle` **e** o desaparecimento do spinner **e** o primeiro grupo de mês visível; expandir o mês mais recente (clique) e esperar os cartões;
   - contar no DOM da lista `svg use[href^="#i-humor-"]` (deve ser ≥ 1 e igual ao número de cartões com humor) e confirmar zero caracteres emoji no `innerText` da lista;
   - salvar `dev-pub_registros_390.png` e `dev-pub_registros_1280.png` **substituindo** as anteriores; zero `pageerror`.
2. **Preparar `scripts/conferir_entrega_16_5.py` para a rodada 3** (mesma chamada `python scripts/conferir_entrega_16_5.py <pasta>`):
   - aceitar `01_pranchas_16.5_v3.html` e `06_contrato_de_leitura_v3.md` como equivalentes dos nomes da rodada 2 (o obrigatório passa a ser "um dos dois nomes"), e exigir `00_LEIA-ME.md`, `01_png/` (com `AUT-03c` e `AUT-11` presentes nos nomes), `02_telas.md`, `03_componentes.md`, `catalogo.js`; `04_tokens.css` e `icones.js` opcionais na rodada 3 (se ausentes, usar os de `docs/design/16.5/` e dizer isso na saída);
   - item novo **"0. Catálogo idêntico à rodada 2"**: comparar byte a byte o `catalogo.js` da pasta com `docs/design/16.5/catalogo.js`; diferente = **FALHA** no topo da saída, com as primeiras 5 linhas divergentes;
   - item novo **"7. Componentes da rodada 3"**: em `03_componentes.md` devem existir as seções `ListaSubgrupo`, `BarraDeslizante` e `MenuEtapas` (grep por título); em `02_telas.md` devem existir `AUT-03c` e `AUT-04` do Positivo (grep por `AUT-03c` e por `AUT-04p` ou "AUT-04 · Positivo" — aceitar qualquer uma das grafias e registrar qual apareceu);
   - **teste de regressão:** rodar sobre `docs/design/16.5/` (rodada 2): item 0 IGUAL, item 1 = 45 · 225 · 45 · 3, item 7 avisa "componentes da rodada 3 ausentes (esperado na rodada 2)", sem exceção Python. Guardar a saída em `docs/design/16.5/CONFERENCIA_regressao_pendencias.md`.
3. **Commit** `Docs: script pronto para a rodada 3 e captura de Meus Registros refeita (16.5)` · `git push` (não há mudança no app; o Pages não precisa ser esperado).
4. **Relatório** `../VMC-offline/PACOTE_16_5_PENDENCIAS_RELATORIO.md` (≤ 30 linhas): contagem de `use[href^="#i-humor-"]` em Meus Registros nas duas larguras, emoji = 0, `pageerror` = 0, mudanças do script (função:linha), saída do teste de regressão.
5. Mensagem final: 5 linhas com os números acima.

## Checklist do usuário (aba anônima, `index-dev.html?v=165d1`)
- [ ] Meus Registros → abrir o mês mais recente: o humor de cada cartão é o rostinho de traço, sem emoji.
- [ ] Nada mais mudou (este prompt não toca o app).
