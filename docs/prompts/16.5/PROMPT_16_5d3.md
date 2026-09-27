# PROMPT · Pacote 16.5d-3 — Cabeçalho cumulativo v2, data na checagem, "Checagem enviada" com gráfico (index-dev)

Leia antes: `CLAUDE.md`, `docs/arquitetura.md` (DOM-first, cabeçalho só-leitura do 16.5d-2, `vmcTok()`), `docs/licoes-aprendidas.md` (lições 16.4.1, 79–84), `docs/prompts/16.5/PROMPT_16_5d2.md` (o que o cabeçalho atual faz) e o relatório `../PACOTE_16_5d2_RELATORIO.md`.

## Contexto

1. O cabeçalho cumulativo do 16.5d-2 (commit `2633107`) foi **reprovado no teste do usuário em 26/09**: mostra subgrupos com nota, não mostra a etapa em preenchimento, o rótulo "COMPORTAMENTOS" transborda e o layout ficou menos organizado que o antigo. Não é bug seu: você construiu o §3 da rodada 3; a decisão do usuário de 26/09 (M, N, O no mapa) prevalece sobre a prancha (lição 82).
2. **Entrada do Design (rodada 4, 26/09):** pasta `../VMC-offline/16.5_entrada_design/Diagnóstico de usabilidade do sistema 16.5_v4/16.5_rodada4/` — `00_LEIA-ME.md`, `01_pranchas_16.5_v4.html`, `01_png/` (8), `03_componentes.md` (§3 CabeçalhoCumulativo v2, §18 CartãoChecagemEnviada, §19 GráficoHumor), `06_contrato_de_leitura_v4.md`; `catalogo.js`, `04_tokens.css`, `icones.js`, `05_rostinhos.svg` **idênticos aos da rodada 3** (conferido pelo chat por `cmp`). **Passo 0:** adaptar `scripts/conferir_entrega_16_5.py` para aceitar os nomes `_v4` (mesma lógica dos `_v3`), rodá-lo sobre a pasta e versionar os arquivos leves em `docs/design/16.5/rodada4/` (LEIA-ME, 03, 06, PNG, brief). Regras do usuário: `docs/design/16.5/rodada4/BRIEF_rodada4_design.md`.
2b. **Decisões do usuário sobre a rodada 4 (26/09 22:20, todas as indicações do chat aceitas):** **P1** usar a alternativa AUT-06 alt — a trilha de ícones substitui o Trilho de 5 segmentos nas 5 etapas (nós de 36 px, ícone 18, traço 4; barra com filete simples); **P2** rótulo em linha com o conteúdo, não em coluna; **P3** "editar" visível já na etapa 1; **P4** humor em círculo branco de 40 px; **D1** nome curto com parêntese: só o conteúdo do parêntese se for uma palavra ("Autocrítica"), senão a parte antes ("Internas"); **D2** nó feito da trilha é botão que leva à etapa; **D3** observação da checagem como 4ª linha do cartão AUT-03b (itálico 14, só quando houver); **D4** humor médio: usar a mesma função/critério de arredondamento do Painel; **D5** frase da Situação a 13 px. **AUT-11 fica para o 16.5f.**
3. Este pacote **não altera `Código.js` nem a planilha**; só `index-dev.html`. Sem `clasp`.
4. **Gabarito clínico antes e depois** (`scripts/conferir_entrega_16_5.py` + `docs/design/16.5/gabarito_codigo.json`): md5 igual; 225 `data-item`, 45 "Outro", 45 grupos.

## Decisões que este prompt implementa

- **Visual = a prancha da rodada 4** (§3 v4 de `03_componentes.md` + PNG). O chat não define layout; onde a prancha e a `ESPEC_funcional` divergirem no visual, vale a prancha; onde divergirem no **conteúdo** (o que cada linha mostra), vale o brief.
- Cabeçalho lê **só `AUTO_STATE.dados`** (mantém o que fechou o 8.21) e comunica: humor (rostinho `vmcHumorIcone` + nome de `HUMOR_NOMES`) e a etapa atual; progresso das 5 etapas (feita/atual/futura); uma linha por etapa feita **ou atual**, com **só os nomes dos grupos marcados** (derivados do DOM: título do grupo pai de cada item marcado, sem o prefixo da etapa — regra única, documentada), "…" quando vazia; Situação com a frase cortada com reticências; Positivo etapa 1 só a frase; ações "editar" e "ver tudo" onde a prancha as colocou.
- Nenhum rótulo quebra nem invade o conteúdo em 320–430 px (medir no Playwright).
- Re-render da linha atual em cada `change` de item/"Outro" e em cada `input` do texto (mesmo caminho que atualiza o rodapé de contagem — reaproveitar, não duplicar).
- "editar" abre o menu "Suas 5 etapas"; "ver tudo" abre o detalhe completo já existente (subgrupos com nota) — só muda o gatilho.
- Checagem breve: ao abrir, data e hora preenchidas com agora (mesma função que já formata em Meus Registros; `autoFormatarHora` como fallback); "alterar" mantido.
- AUT-03b: cartão de 3 linhas + gráfico: **reaproveitar o gráfico "Humor ao longo do tempo" do Painel** (mesma função de montagem, mesmo `vmcTok()`, mesmos dados de `lerHistorico` já em cache `pev*`), com os botões de recorte 7/30/90/Tudo e o "humor médio" do recorte; nenhuma segunda implementação de gráfico. Se o Painel exigir a seção montada, extrair a função de construção para receber o contêiner como parâmetro (empréstimo de função).
- Zero cor fixa fora do `:root`; tokens novos da rodada 4 (se houver) mesclados, nunca copiados por cima; emoji 0; toque ≥ 44 px nos botões redondos (32 px visuais com área de toque 44).

## Passos

1. Gabarito ANTES. Inventário por grep: função(ões) que renderizam o cabeçalho cumulativo, quem as chama, a função do gráfico do Painel e o cache `pev*`, a função que preenche data/hora na checagem. Guardar no relatório.
2. Cabeçalho v2 por `str_replace` sobre a função atual (substituição inteira → grep por fragmentos órfãos depois). CSS novo só com tokens; remover as classes do cabeçalho v1 que ficarem sem uso (contagem antes/depois).
3. Trilha e linha da etapa atual: hook nos eventos existentes de marcação/texto.
4. Checagem: data/hora ao abrir.
5. AUT-03b: cartão + gráfico reaproveitado + recorte + média.
6. Validação (seção 5 do CLAUDE.md): `node --check`; tags fora de `<script>`; vars CSS no `:root`; zero cor fixa; zero classe sem uso; piso 13/14 px; Playwright Chrome visível 390 e 1280, dois tipos ponta a ponta com `pageerror` = 0, comparando com `index.html`; **capturas do cabeçalho nas 5 etapas × 2 tipos + AUT-03 + AUT-03b** em `capturas_16_5d3/`; teste a 320 e 430 px de que nenhum rótulo quebra.
7. Gabarito DEPOIS (md5 igual). Envio real de um Negativo, um Positivo e uma checagem sozinha com o VMC; conferir na planilha que as colunas são as mesmas das linhas de 26/09 12:27.
8. Marcador da linha 2 = "Pacote 16.5d-3"; commit "Pacote 16.5d-3 — Cabeçalho cumulativo v2, data na checagem, Checagem enviada com gráfico"; `git push`; conferir o publicado com `?v=165d3`.
9. Docs: `docs/arquitetura.md` (cabeçalho v2: regra dos grupos, trilha, gráfico reaproveitado), `docs/design/icones.md` (ícones novos, se houver). Relatório `../PACOTE_16_5d3_RELATORIO.md` (≤ 100 linhas): inventário, o que mudou, contagens, desvios. Bug fora do escopo → registrar como 16.5d-3.1, não corrigir.

## Checklist do usuário (aba anônima, `index-dev.html?v=165d3`, paciente VMC)
- [ ] Etapa 1 recém-aberta: cabeçalho igual à prancha AUT-04 v4 — humor, etapa atual indicada, progresso com a Situação em destaque, linha "Situação" com "…".
- [ ] Ao marcar um grupo, a linha da etapa atual muda na hora; nunca aparece subgrupo nem nota no cabeçalho; "ver tudo" mostra o detalhe completo; "editar" abre "Suas 5 etapas".
- [ ] Situação: grupos numa linha, frase em itálico menor abaixo, cortada com "…".
- [ ] Etapa 5: "COMPORTAMENTOS" e "REAÇÕES FÍSICAS" inteiros na coluna do rótulo, sem invadir o conteúdo (celular e computador).
- [ ] Progresso das etapas e ações "editar"/"ver tudo" como na prancha v4; nada de lápis por linha.
- [ ] Positivo: mesmas regras em verde-água; etapa 1 só com a frase.
- [ ] Checagem breve abre com data e hora de agora; "alterar" funciona.
- [ ] "Concluir só com a checagem de humor" → cartão de 3 linhas (HUMOR em negrito · rostinho + nome · agenda + data e hora menores) + gráfico "Humor ao longo do tempo" com 7/30/90/Tudo e humor médio, igual ao do Painel.
- [ ] Um Negativo, um Positivo e uma checagem sozinha gravam; Meus Registros e Painel iguais a antes.
