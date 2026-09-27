# Rodada 4 do Design · Pacote 16.5d-3 — Cabeçalho cumulativo v2, checagem com data, "Checagem enviada" com gráfico

Projeto: Sistema Clínico Digital VMC · tema G · continuação da rodada 3 (26/09/2026). Mesmos tokens (`04_tokens.css`), Figtree única, ícones (`icones.js`, `05_rostinhos.svg`) e catálogo (`catalogo.js`). Token ou ícone novo: pode, declarado no LEIA-ME.

## Por que esta rodada existe

O cabeçalho cumulativo construído no 16.5d-2 (a partir do §3 da rodada 3) foi **reprovado no uso**: mostra subgrupos com nota, esconde a etapa em preenchimento, o rótulo transborda e o conjunto ficou menos organizado que o cabeçalho antigo (produção). Depois disso o chat tentou consertar por conta própria numa demonstração HTML e o resultado também foi reprovado pelo usuário: **"espaço mal aproveitado", "parece que tudo é uma coisa só", "amadorismo"**. A conclusão do usuário foi clara: isso é trabalho de Design, não de chat. **Esta rodada pede a sua expertise em layout, hierarquia, ritmo e uso do espaço num cartão pequeno (390 px) — não a reprodução de nenhuma das duas versões reprovadas.**

## O que é fixo (requisitos funcionais — decisões do usuário de 26/09)

O cabeçalho cumulativo fica no topo de cada uma das 5 etapas, nos dois tipos (ameixa = Negativo, verde-água = Positivo), e precisa **comunicar** estas coisas — a forma é sua:

1. **Humor** da checagem (rostinho + nome: Muito mal · Mal · Mais ou menos · Bem · Muito bem) e **qual etapa está sendo preenchida agora**. O usuário gostava de como o cabeçalho antigo fazia isso ("Preenchendo: Comportamentos" ao lado do humor).
2. **Progresso pelas 5 etapas**, com o ícone de cada etapa: feita, atual (com destaque claro, "mais acesa"), futura. O usuário pediu que a trilha seja só de ícones (sem nomes, sem check) e que a etapa feita inverta a cor (fundo na cor do tipo, ícone branco) e a atual fique branca com ícone e borda na cor — **se você tiver uma solução melhor para o mesmo objetivo, apresente ao lado, com justificativa**.
3. **Um resumo por etapa feita ou em preenchimento**, e a etapa atual **aparece e se atualiza** conforme o paciente marca; vazia mostra "…". O resumo mostra **só os nomes dos grupos marcados** (5 grupos por etapa; nunca subgrupos, nunca notas — esses ficam em "ver tudo"). Situação = grupos + a frase do paciente, em uma linha, cortada com "…". Positivo, etapa 1: por enquanto só a frase.
4. **Duas ações**: "editar" (abre o menu Suas 5 etapas) e "ver tudo" (detalhe completo). Uma ocorrência de cada; o usuário recusou lápis por linha e recusou os dois botões espremidos na linha do humor — **onde e como elas ficam é decisão sua**.
5. **Legibilidade**: rótulos como "COMPORTAMENTOS" e "REAÇÕES FÍSICAS" nunca quebram nem invadem o conteúdo; separação clara entre blocos (o usuário pediu divisórias, mas aceita outra forma de separar que funcione melhor); piso tipográfico 13 px; toque ≥ 44 px.

Fora do cabeçalho:

6. **Checagem breve (AUT-03):** data e hora já preenchidas ao abrir ("alterar" continua).
7. **Checagem enviada (AUT-03b):** cartão com humor (o usuário descreveu: termômetro + HUMOR em negrito; rostinho + nome; agenda + data e hora menores — desenhe a melhor versão disso) e, abaixo, o gráfico "Humor ao longo do tempo" do Painel de Evolução com recorte 7/30/90/Tudo e o humor médio do recorte (`referencia/painel_humor_ao_longo_do_tempo.png`; o Code reaproveita o gráfico existente, então mantenha a mesma anatomia).
8. **AUT-11 (≥ 900 px):** a coluna lateral "O que já está anotado" segue a regra 3 (só grupos).

Nada de conteúdo clínico, chave técnica ou nome de campo muda. Texto de interface novo só com motivo, na lista de textos.

## O que está na pasta e como usar

- `referencia/antigo_cabecalho_{situacao,emocoes,comportamentos}.png` — o cabeçalho **antigo** (produção, Nunito/coral). É a referência de **organização e uso do espaço** que o usuário quer de volta, traduzida para o tema G. Não é para copiar a estética.
- `referencia/atual_16_5d2_reprovado_*.png` — o cabeçalho **atual**, reprovado: o que não repetir.
- `ESPEC_funcional_cabecalho_v2.html` — demonstração do chat, **também reprovada visualmente**. Serve só como inventário do **conteúdo** de cada estado (A: etapa 1 recém-aberta · B: etapa 3 em preenchimento · C: etapa 5 · D: Positivo etapa 2 · E: cartão AUT-03b). Não use como referência de layout.
- `referencia/painel_humor_ao_longo_do_tempo.png` — o gráfico a replicar.
- Rodada 3 (sua): `../rodada3/entrega/` — tokens, ícones, rostinhos, catálogo, `02_telas.md`, `03_componentes.md` §3 (a substituir), AUT-11.

## O que deve voltar em `rodada4/entrega/`

1. `00_LEIA-ME.md` — como cada requisito 1–8 foi resolvido; onde você propôs algo diferente do pedido do usuário e por quê (ele decide); dúvidas objetivas (≤ 5).
2. `01_pranchas_16.5_v4.html` (+ `.dc.html`) a 390 px: AUT-04 (etapa 1 recém-aberta), AUT-06 (etapa 3 em preenchimento, 1 grupo marcado), AUT-08 (etapa 5, todas as linhas — o caso mais cheio), AUT-05p (Positivo, etapa 2); AUT-03 com data/hora; AUT-03b com cartão + gráfico; AUT-11 a 1280 px. Se houver alternativa para a trilha ou para as ações, uma prancha extra lado a lado.
3. `01_png/` — as mesmas a 2× (AUT-11 a 1280).
4. `03_componentes.md` — §3 CabeçalhoCumulativo v2 (grade, medidas, estados, cores por tipo, comportamento ao vivo da linha atual), §18 CartãoChecagemEnviada, §19 GráficoHumor.
5. `06_contrato_de_leitura_v4.md` — só os itens que mudam (17, 22) e os novos.
6. `04_tokens.css` só se houver token novo (diff declarado); `icones.js` só se houver ícone novo (conferir se termômetro, lápis, camadas e agenda já existem).
7. `catalogo.js` idêntico ao da rodada 3 (o script confere byte a byte).
