# PROMPT · Pacote 16.5d-1 — Unificar as 10 seções do registro em 5, sem mudança visual (index-dev)

Sistema Clínico Digital VMC · 26/09/2026 · Tema G · Pacote 16.5, fase 5. É a parte de maior risco técnico do 16.5 e a que **não depende das pranchas**: por isso vem antes da rodada 3. Objetivo: o paciente não percebe diferença nenhuma; o código passa a ter uma estrutura só por etapa.

## Contexto
1. Ler `CLAUDE.md`, `docs/arquitetura.md` (DOM-first; namespaces; princípio aditivo restrito a dados vivos), `docs/licoes-aprendidas.md`. `git pull`; pré-requisitos: 16.5a, 16.4.5, 16.5b e 16.4.4 fechados; gabarito e script disponíveis; inventário de linhas das 10 seções no `PACOTE_16_5a_RELATORIO.md` (Passo 2d).
2. Só `index-dev.html`. `index.html` e `Código.js` intocados; sem `clasp`.
3. **Contratos que não mudam** (grep antes e depois, com contagem): `data-grupo`, `data-item`, `data-tem-likert`, os prefixos de coluna (`neg_*`, `pos_*` — confirmar os reais), a montagem "Item:nota" com `AUTO_SEPARADOR`, os payloads das ações de gravação e leitura do registro, `versao_formulario`. O servidor não pode perceber diferença.

## Estratégia (decisão técnica; executar como descrito, registrar desvios)
- Hoje: 10 seções `sec-auto-{sit,emo,fis,pens,comp}-{a,b}` com HTML duplicado (~3.900 linhas) e, provavelmente, funções/ids duplicados por sufixo a/b.
- Alvo: 5 seções `sec-auto-{sit,emo,fis,pens,comp}` cujo conteúdo (título, instrução, dica, grupos e itens) é **trocado conforme o tipo de registro ativo**, mantendo o conteúdo clínico no HTML (DOM-first): os dois catálogos continuam existindo como blocos HTML (por exemplo `<template>` ou blocos com `data-tipo="neg|pos"` dentro da seção única), e o JS mostra/oculta ou clona o bloco do tipo ativo. Nenhum array JS com textos clínicos.
- Cor do tipo continua vindo de uma classe/atributo no container (ameixa/verde-água), como hoje.
- Menus das etapas, cabeçalho cumulativo, validação, gravação e edição passam a apontar para as 5 seções; onde havia dois handlers idênticos com sufixo, fica um parametrizado pelo tipo. Funções antigas removidas por completo (grep por nome após remover: zero fragmentos órfãos, zero chamadas pendentes).
- Se em algum ponto a unificação exigir mudar uma chave técnica ou o formato gravado, **parar e relatar** em vez de improvisar.

## Passos
1. **Gabarito antes** + baseline funcional: com sessão simulada do paciente de teste, Playwright grava **um Registro Negativo e um Registro Positivo completos** (texto neutro, 1 item por etapa com nota quando houver) e captura o payload enviado (`page.route` interceptando a ação de gravação: salvar o JSON em `../VMC-offline/16_5d1_baseline_neg.json` e `_pos.json`). Não repetir a gravação real além do necessário (cada uma é uma linha na planilha do paciente de teste; registrar data/hora no relatório).
2. **Refatorar** conforme a estratégia, em passos pequenos por etapa (sit → emo → fis → pens → comp), com `node --check` e gabarito a cada etapa concluída.
3. **Prova de equivalência:** repetir o passo 1; os payloads novos devem ser **iguais** aos da baseline campo a campo (mesmas chaves, mesmos valores, mesma ordem de itens), exceto data/hora. Gabarito igual (o JSON pode mudar de forma se as seções mudarem de id; nesse caso, ajustar o script para ler as 5 seções × 2 tipos e provar que o conteúdo é o mesmo — registrar).
4. **Validação:** `node --check`; tags balanceadas; toda `var()` declarada; zero cor fixa; zero emoji; zero classe sem uso (as classes das seções antigas removidas); Playwright 390/1280 login inválido + fluxo completo dos dois tipos (zero `pageerror`); capturas antes/depois de cada etapa dos dois tipos em `../VMC-offline/capturas_16_5d1/` (devem ser visualmente iguais); `wc -l` antes/depois (esperada redução da ordem de milhares de linhas).
5. **Marcador:** linha 2 → "Pacote 16.5d-1". Commit `Pacote 16.5d-1 - Secoes do registro unificadas (5 em vez de 10), sem mudanca visual (index-dev)` · `git push` · fluxo dos dois tipos no publicado com `?v=165d1`.
6. **Relatório** `../VMC-offline/PACOTE_16_5d1_RELATORIO.md`: estratégia aplicada, linhas antes/depois, funções removidas, prova de equivalência (diff dos payloads = vazio), capturas, planilha do paciente de teste (linhas criadas: data/hora). `docs/arquitetura.md`: seção nova "Registro: estrutura única por etapa".
7. Mensagem final: "publicado" + 6 linhas.

## Checklist do usuário (aba anônima, `index-dev.html?v=165d1`, paciente VMC)
- [ ] Um Registro Negativo completo e um Positivo completo gravam e aparecem em Meus Registros com os itens e notas certos.
- [ ] Na planilha do paciente VMC (aba Automonitoramento), as duas linhas novas têm as mesmas colunas preenchidas que uma linha antiga do mesmo tipo.
- [ ] Editar um registro antigo (Meus Registros → editar) continua funcionando.
- [ ] Nada mudou de aparência nas 5 etapas dos dois tipos.
