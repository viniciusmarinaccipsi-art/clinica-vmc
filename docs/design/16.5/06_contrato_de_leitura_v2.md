# Pacote 16.5 · 06_contrato_de_leitura_v2.md — checklist de aceite

Use quando o Claude Code (ou o Claude in Chrome) entregar qualquer tela do automonitoramento. Se um item falhar, a tela saiu do padrão. Os itens 1–10 vêm do contrato v1; 11–20 são as regras do brief 16.5.

## Do contrato v1 (mantidos)
1. Os rótulos usam o vocabulário fixo (Emoções desagradáveis/agradáveis · Reações físicas de mal-estar/bem-estar · Pensamentos desadaptativos/adaptativos · Comportamentos disfuncionais/funcionais) — sem sinônimos.
2. A cor do conteúdo vem do tipo de registro (ameixa = Negativo, verde-água = Positivo); índigo = ação; âmbar = pendência e ajuda; vermelho só em risco e erro.
3. A intensidade (1–5) aparece apenas nos itens que o paciente marcou.
4. As cinco etapas mantêm ordem e nomes completos.
5. Toda lista, gráfico e formulário tem estado vazio, carregando e erro.
6. Toque mínimo de 44 px; texto de interface ≥ 14 px (rótulos em caixa alta 12 px).
7. Nenhuma cor, fonte, raio ou sombra fora de `04_tokens.css`.
8. Nomes de campo (`data-grupo`, `data-auto-campo`) conferem com o código; nenhum campo novo (sem `pacContatoConfianca*`).
9. O cartão de risco não é decoração: na tela "Registro enviado" há apenas o espaço reservado até o pacote seguinte.
10. Nenhum emoji: rostinhos e ícones são SVG do sprite (`currentColor`).

## Do brief 16.5 (novos)
11. **Conteúdo clínico letra por letra:** 45 grupos, 225 itens, 45 "Outro:" com "especifique...", descrições entre aspas quando o catálogo as tem, "(a)" preservado. Conferir contra `catalogo.js` (gerado do `.md`), não de memória. Quando não couber: menos grupos abertos, nunca menos itens no grupo aberto.
12. **Textos da interface só do arquivo de textos** (coluna "Proposta" e "O que fica igual"). Nada de "Módulo 2", "Meus Registros Anteriores", "Gravar", nome do profissional, tempo estimado, "nenhuma é obrigatória", "o progresso fica salvo se você fechar a aba".
13. **Verbos:** o registro é enviado ("Enviar Registro", "Registro enviado", "Checagem de humor enviada"); "Salvar e sair" é só o rascunho. "Seu terapeuta", nunca um nome.
14. **Fluxo:** hub ("Iniciar Novo Registro") → checagem breve → escolha do tipo no fim dela ("Quer continuar?" / "Concluir só com a checagem de humor") → 5 etapas → "Revisar e Enviar" → "Registro enviado". Não existem mais as telas "Tipo de registro" e os menus de etapas.
15. **Barra e trilho:** "REGISTRO NEGATIVO/POSITIVO" + "Etapa N de 5 · nome completo" + "Salvar e sair"; trilho de 5 segmentos com as etapas feitas tocáveis; o botão do rodapé diz o nome da próxima etapa (ou "Concluir e Revisar"); "‹" lê "Etapa anterior"; contagem do que foi marcado no rodapé.
16. **Escala por subgrupo assinalado:** em cada item marcado, o rótulo de hoje ("Desconforto:", "Mal-estar:", "Acredito:"; "Conforto:", "Bem-estar:"), os números 1–5 com a palavra da legenda embaixo de cada um (legenda certa por etapa: …Intenso / …Extremo / Nada…Totalmente) e a nota por extenso ao lado do nome ("3 · Moderado"). Grupos fechados mostram "5 itens" ou "N marcado(s)".
17. **Cabeçalho cumulativo:** HUMOR com o rostinho `i-humor-N` e o nome do nível ("Mais ou menos"); por etapa feita, ícone da etapa, definição dos subgrupos assinalados com a nota, depois a frase escrita, em até duas linhas cortando a partir da frase; no Positivo a Situação mostra só a frase; "editar" com lápis e "ver tudo" com camadas.
18. **Checagem breve:** "Como está seu humor agora?"; data e hora preenchidas com "alterar"; 5 faixas com número, rostinho e nome ("Muito mal · Mal · Mais ou menos · Bem · Muito bem"), de ameixa a verde-água; caixa descritiva do nível (frases do catálogo); "Observações (opcional)" com a pergunta de contexto sempre visível fora do campo.
19. **Acessibilidade de formulário:** rótulo sempre visível; nenhuma instrução só como placeholder; avisos de obrigatório na tela, junto do campo, com as frases de hoje (nunca `alert()`/`confirm()` do navegador); contraste ≥ 4,5:1.
20. **Fonte:** Figtree em tudo, títulos e números em 600; nenhuma serifa; nenhuma fonte carregada além dela.
21. **Estados do fluxo:** rascunho encontrado no hub ("Você tem um registro em andamento." · "Continuar de onde parei" · "Descartar e começar novo"); "Sair sem enviar?" com "O que você preencheu fica guardado enquanto esta aba estiver aberta."; hub do primeiro acesso com o aviso D11.
22. **Fluidez:** mesmo HTML em navegador e app; coluna única até 899 px, coluna lateral a partir de 900 px (AUT-11); nenhuma medida em vw/vh; barra de ação fixa no celular, inline no computador.
