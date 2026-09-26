# Pacote 16.5 · 02_telas.md — estrutura, componentes, estados e comportamento

Celular 390 px salvo indicação. Textos entre aspas são os do `16.5_textos_interface.md` (coluna "Proposta" / "O que fica igual") ou do `16.5_catalogo_automonitoramento.md`. Nomes de componentes em `03_componentes.md`. Tokens em `04_tokens.css`.

Regra geral de resposta a largura (navegador e app): coluna única até 899 px; a partir de 900 px, `grid 320px minmax(0,1fr)` com a coluna lateral fixa (ver AUT-11). Nenhuma medida em vw/vh.

---

## AUT-02 · Hub do automonitoramento

**Estrutura (de cima para baixo)**
1. Barra simples: voltar (44 px) · título "Automonitoramento".
2. Cartão principal (borda índigo 1,5 px, ícone `i-plus` em tinte índigo 48 px): título "Iniciar Novo Registro" · texto "Faça a checagem breve de humor e, se quiser, siga para o registro completo."
3. Dois cartões lado a lado (`grid 1fr 1fr`, gap 12): `i-chart` "Painel de Evolução" · "Gráficos e insights sobre seus registros" | `i-archive` "Meus Registros" · "Consulte seu histórico de automonitoramento".
4. Faixa (fundo `--c-action-tint`, sem borda): `i-book` "Como Usar Este Registro" · "Entenda a estrutura, as escalas e como preencher".

**Componentes:** BarraSimples, CartaoAcao, CartaoDuplo, Faixa.
**Estados:** *primeiro acesso* (D11): aviso âmbar no topo — "Antes do registro completo, leia o "Como Usar Este Registro". A checagem breve de humor já está liberada." Painel e Meus Registros a 55 % de opacidade e não tocáveis; a faixa "Como Usar" ganha borda âmbar e chevron. *Rascunho encontrado:* ver AUT-12b. *Carregando:* cartões com esqueleto (`ini-skel-l`). *Erro de rede:* faixa `erro-rede` do sistema.
**Comportamento:** "Iniciar Novo Registro" → AUT-03. Painel → Painel de Evolução (como está). Meus Registros → Meus Registros (como está). Faixa → "Como Usar Este Registro" (como está). Voltar → Início.

## AUT-03 · Checagem breve de humor

**Estrutura**
1. Barra: voltar · sobretítulo "AUTOMONITORAMENTO" (12 px caixa alta, índigo) · título "Checagem breve de humor".
2. Título da tela (h2, 24 px 600): "Como está seu humor agora?"
3. Pílula de data (cartão 52 px, `i-calendar`): "Hoje, 22/09 · 10:05" · link "alterar" à direita (alvo 44 px). Data e hora vêm preenchidas com o agora.
4. Cinco faixas (56 px, raio 14, gap 8), radiogroup: número em círculo branco 40 px · rostinho `i-humor-N` 28 px · nome. Cores por nível: 1 `--c-humor-1-bg/ink` "Muito mal" · 2 "Mal" · 3 "Mais ou menos" · 4 "Bem" · 5 "Muito bem". A faixa escolhida fica branca com borda índigo 2 px, anel `--c-action-ring` 3 px e `i-check` à direita.
5. Caixa descritiva do nível escolhido (fundo `--c-humor-3-bg`, itálico, `aria-live="polite"`): a frase do catálogo para o nível (ex.: nível 3 "Não estou me sentindo bem nem mal — estou em um estado emocional estável.").
6. Observação: rótulo "Observações (opcional)" (16 px 600) · pergunta sempre visível abaixo do rótulo, fora do campo: "Onde você estava, o que estava fazendo, com quem estava ou se estava só?" · textarea 3 linhas.
7. Rótulo de seção "QUER CONTINUAR?" (12 px caixa alta).
8. Cartão "Registro Negativo" (borda ameixa, `i-heart-crack`) com a descrição do catálogo: "Situações conflituosas → emoções desagradáveis, pensamentos desadaptativos e comportamentos disfuncionais".
9. Cartão "Registro Positivo" (borda verde-água, `i-heart`): "Situações conflituosas ou harmoniosas → emoções agradáveis, pensamentos adaptativos e comportamentos funcionais".
10. Botão secundário 56 px: "Concluir só com a checagem de humor".

**Estados:** *nada escolhido:* caixa descritiva oculta; os três botões de continuação desabilitados (`--c-disabled-bg/ink`). *Erro (humor obrigatório):* mensagem de hoje na tela, junto das faixas (mesmo padrão de AUT-12a). *alterar:* abre os campos de data e hora nativos abaixo da pílula, no lugar dela.
**Comportamento:** cartão Negativo → envia a checagem e abre AUT-04 (Registro Negativo). Cartão Positivo → idem, Registro Positivo. "Concluir só com a checagem de humor" → envia a checagem → AUT-03b. Dados enviados: data, hora, humor (1–5), observação.

## AUT-03b · Checagem de humor enviada (nova)

**Estrutura:** barra sem voltar (sobretítulo "AUTOMONITORAMENTO" · "Checagem breve de humor") · círculo `--c-pos-tint` 96 px com `i-check` · título "Checagem de humor enviada" · cartão (borda esquerda índigo 4 px): rostinho 30 px · nome do nível em 600 · "· Hoje, 22/09 às 10:05" · trecho da observação entre aspas · frase "Fica em Meus Registros e no Painel de Evolução." · botão secundário "Voltar ao início".
**Estados:** sem observação → o cartão mostra só a linha do humor. **Comportamento:** "Voltar ao início" → Início. Botão do sistema voltar → Início.

## Componentes comuns das etapas (AUT-04 a AUT-08, AUT-08p, AUT-11)

- **BarraEtapa:** voltar 44 px · sobretítulo "REGISTRO NEGATIVO" / "REGISTRO POSITIVO" (12 px caixa alta, cor do tipo) · título "Etapa N de 5 · nome completo" (17 px 600, quebra em 2 linhas) · botão pílula "Salvar e sair" (44 px).
- **Trilho:** 5 segmentos 6 px, gap 6, raio 3. Feitos = cor do tipo (`--c-reg-neg`); atual = meio-tom (`--c-reg-neg-mid`); a fazer = tinte. Segmentos feitos são tocáveis (alvo 44 px de altura invisível) e levam à etapa.
- **CabeçalhoCumulativo:** cartão em tinte do tipo, raio 14. Linhas em `grid 22px 116px 1fr`: ícone · rótulo em caixa alta (cor ink do tipo) · texto 14 px. Linha HUMOR: rostinho `i-humor-N` como ícone + nome do nível. Cada etapa feita: ícone da etapa; primeiro a definição dos subgrupos assinalados (nota em negrito onde há escala: "Triste **3** · Desanimado(a) **4**"), depois " · " e a frase escrita em itálico; no máximo duas linhas (~62 caracteres), cortando a partir da frase com "…". No Positivo, a linha SITUAÇÃO mostra só a frase. Rodapé do cartão: "editar" com `i-pencil` e "ver tudo" com `i-layers` (ambos 44 px de alvo, índigo). "editar" volta à etapa da última linha; "ver tudo" abre a revisão em leitura (AUT-09 sem botão de envio).
- **TítuloEtapa:** h2 24 px 600 + instrução 15 px `--c-ink-3`. Textos: Situação "O que aconteceu?" / "O que estava acontecendo quando seu humor mudou"; Emoções "O que você sentiu?" / "Identifique as emoções desagradáveis e avalie a intensidade do desconforto"; Reações "O que você sentiu no corpo?" / "Identifique as sensações corporais de mal-estar e avalie sua intensidade"; Pensamentos "Quais pensamentos passaram pela sua mente?" / "Identifique pensamentos desadaptativos e avalie o quanto você acredita nesses pensamentos"; Comportamentos "Como você reagiu a essa situação?" / "Identifique seus comportamentos disfuncionais que pioraram a situação". (Positivo: as instruções de hoje do Positivo.)
- **GrupoRecolhível:** ver `03_componentes.md`. Fechado: "N. Título" + "5 itens" ou "2 marcados" (cor do tipo quando há marcados) + "›". Aberto: título + contagem, descrição completa em itálico, chips dos 5 itens + chip tracejado "+ Outro: especifique...", e, nas etapas com intensidade, uma **EscalaItem** por item marcado.
- **Chip "+ Outro: especifique..."** (um por grupo, em todas as etapas): tocar abre, no lugar do chip, o campo de texto do "Outro" do grupo (rótulo "Outro:" visível à esquerda, dica "especifique..." visível acima do campo, 44 px de altura, foco automático, botão "✓" 44 px para confirmar). Confirmado com texto, o campo vira um chip **marcado** com o texto digitado (e, nas etapas com intensidade, ganha a sua EscalaItem como qualquer item); o chip tracejado não reaparece — o grupo tem um só "Outro". Tocar o chip do "Outro" marcado reabre o campo para editar; apagar o texto e confirmar remove o chip (e a escala) e o tracejado volta. O texto vai para o campo "Outro" do grupo (`data-grupo` correspondente), sem criar dado novo.
- **EscalaItem:** nome do item · à direita "N · Palavra" (cor ink do tipo) · rótulo de hoje em caixa alta ("DESCONFORTO:", "MAL-ESTAR:", "ACREDITO:", "CONFORTO:", "BEM-ESTAR:") · 5 círculos 48 px com o número e a palavra da legenda embaixo (14 px). Legendas: Emoções/Reações "Nenhum · Pouco · Moderado · Muito · Intenso/Extremo"; Pensamentos "Nada · Pouco · Moderado · Muito · Totalmente".
- **RodapéEtapa:** contagem centralizada ("2 emoções marcadas" e equivalentes) · "‹" 56×56 (`aria-label="Etapa anterior"`) · botão primário com o nome da próxima etapa + " ›" ("Reações Físicas de Mal-Estar ›"); na etapa 5, "Concluir e Revisar".
- **Obrigatório na tela (D9):** as frases de hoje, abaixo do campo ou do bloco de grupos, com `i-alert` e `--c-risk-ink`; o campo ganha borda `--c-risk` 2 px. Frases: "Preencha o campo "O que aconteceu?" antes de avançar." · "Marque pelo menos uma opção em algum tipo de contexto antes de avançar." · "Marque pelo menos um item em algum grupo desta seção antes de avançar." · "Descreva pelo menos um pensamento na caixa de texto antes de avançar." · "Descreva como você reagiu na caixa de texto antes de avançar." · "Marque pelo menos uma opção em algum tipo de comportamento antes de avançar."
- **Salvar e sair:** grava o rascunho (só nesta aba) e abre a folha "Sair sem enviar?" (AUT-12c) quando há conteúdo não enviado; sem conteúdo, volta ao hub.

## AUT-04 · Etapa 1 · Situação

Barra "Etapa 1 de 5 · Situação" · trilho (1 atual) · cabeçalho só com HUMOR · título "O que aconteceu?" · instrução · **Referência da checagem** (quando houver observação): caixa índigo-clara "Na checagem você anotou: "…"" · dica visível "Ex.: o fato ou a conversa que mexeu com você." (sem observação: "Ex: Quando isso aconteceu? Onde você estava? Com quem você estava? O que você estava fazendo?") · textarea · rótulo "Tipo de Contexto" + frase ""Marque os tipos de situação que desencadearam alterações no seu humor."" · 5 GruposRecolhíveis (Situações Interpessoais, de Desempenho, de Solidão / Inatividade, de Perda ou Mudança, Internas (sem evento externo claro)) com 25 itens + "Outro:", **sem escala** · rodapé "1 situação marcada" · "Emoções Desagradáveis ›".
**Obrigatório:** texto preenchido e ≥ 1 item. **Positivo:** só o campo de texto (sem grupos) — débito 8.6.

## AUT-05 · Etapa 2 · Emoções Desagradáveis

Barra "Etapa 2 de 5 · Emoções Desagradáveis" · trilho (1 feito, 2 atual) · cabeçalho HUMOR + SITUAÇÃO · título "O que você sentiu?" · instrução · 5 grupos (Tristeza / Depressão; Ansiedade / Medo; Raiva / Irritação; Culpa / Vergonha; Ciúme / Inveja), o 1º aberto com "2 marcados": chips (Triste ✓, Solitário(a), Deprimido(a), Desanimado(a) ✓, Desesperançoso(a), + Outro) e duas EscalaItem "Desconforto:" (Triste 3 · Moderado; Desanimado(a) 4 · Muito) · rodapé "2 emoções marcadas" · "Reações Físicas de Mal-Estar ›".
**Comportamento:** marcar um chip cria a sua EscalaItem abaixo dos chips, com a nota vazia; a nota é obrigatória para o item marcado (frase de hoje). Desmarcar remove a escala. "Outro:" abre um campo de texto inline com a dica "especifique..." e, preenchido, vira um chip marcado com escala.

## AUT-06 · Etapa 3 · Reações Físicas de Mal-Estar

Mesmo padrão; rótulo "Mal-estar:"; legenda termina em "Extremo". Prancha: grupo 1 (Ativação / Aceleração) aberto com Coração acelerado 4 · Muito; grupo 3 (Tensão / Contração) fechado com "1 marcado". Rodapé "2 reações físicas marcadas" · "Pensamentos Desadaptativos ›".

## AUT-07 · Etapa 4 · Pensamentos Desadaptativos

Cabeçalho até REAÇÕES FÍSICAS · título "Quais pensamentos passaram pela sua mente?" · instrução · dica visível (a de hoje: "O que estava passando pela minha mente instantes antes…") · textarea com a frase em itálico · link "+ Adicionar outro pensamento" (adiciona outra textarea igual abaixo; cada uma sem nota) · **Cartão de ajuda** âmbar com `i-bulb`: "Precisa de ajuda? Veja perguntas que podem guiar sua reflexão" (recolhível; na prancha está aberto): introdução "Dependendo da emoção que você sentiu, algumas perguntas podem ajudar a identificar o pensamento por trás dela:" e as 5 emoções com as 2 perguntas cada · rótulo "Tipo de Pensamento" + ""Marque os tipos de pensamento desadaptativo que passaram pela sua cabeça."" · 5 grupos, o 1º aberto (Pensamentos sobre Mim Mesmo (Autocrítica)) com ""Não sou bom o bastante ou suficiente"" 4 · Muito e EscalaItem "Acredito:" (Nada … Totalmente) · rodapé "1 pensamento marcado" · "Comportamentos Disfuncionais ›".
**Obrigatório:** ≥ 1 frase e ≥ 1 item. O cartão de ajuda só existe no Registro Negativo.

## AUT-08 · Etapa 5 · Comportamentos Disfuncionais

Cabeçalho completo (HUMOR, SITUAÇÃO, EMOÇÕES, REAÇÕES FÍSICAS, PENSAMENTOS) · título "Como você reagiu a essa situação?" · instrução · dica visível (a de hoje: "O que você fez nessa situação? Como você agiu ou reagiu diante disso?") · textarea · rótulo "Tipo de Comportamento" + ""Marque os tipos de comportamento disfuncional que você teve nessa situação."" · 5 grupos (Evitação / Fuga; Isolamento / Retraimento; Agitação / Reatividade; Entorpecimento / Fuga emocional; Busca excessiva de controle / Reasseguramento), o 1º aberto, **sem escala** · rodapé "2 comportamentos marcados" · "Concluir e Revisar" → AUT-09.

## AUT-08p · Registro Positivo · Etapa 2 · Emoções Agradáveis (nova)

Igual à AUT-05 em verde-água: barra "REGISTRO POSITIVO" · trilho `--c-reg-pos*` · cabeçalho HUMOR (Bem, `i-humor-4`) + SITUAÇÃO (só a frase, em itálico) · título "O que você sentiu?" · instrução do Positivo · grupos Felicidade / Satisfação (aberto: Contente 4 · Muito, Satisfeito(a) 3 · Moderado, rótulo "Conforto:"), Orgulho / Realização, Conexão / Afeto, Calma / Serenidade, Esperança / Motivação · rodapé "Reações Físicas de Bem-Estar ›". Ícones do Positivo: `i-heart`, `i-leaf`, `i-sun`, `i-trend-up`.

## AUT-09 · Revisar e Enviar

Barra: voltar · "REGISTRO NEGATIVO" · "Revisar e Enviar" · frase "Confira as informações antes de enviar." · **Bloco Humor** (borda esquerda índigo): `i-thermometer` "HUMOR" · "editar" · rostinho + "Mais ou menos" + "· 22/09 às 10:05" · **Um bloco por etapa** (borda esquerda ameixa 4 px): ícone · rótulo em caixa alta com nome completo e contagem ("EMOÇÕES DESAGRADÁVEIS · 2", "REAÇÕES FÍSICAS DE MAL-ESTAR · 2", "PENSAMENTOS DESADAPTATIVOS · 1", "COMPORTAMENTOS DISFUNCIONAIS · 2"; "SITUAÇÃO" sem contagem) · "editar" com lápis · conteúdo: frase escrita; chips dos tipos marcados (Situação, Comportamentos); linhas item + barra de intensidade (largura = nota/5, trilha tinte, preenchimento cor do tipo) + nota · frase "Você pode corrigir depois em Meus Registros." · botão primário `i-send` "Enviar Registro".
**Estados:** *enviando:* botão desabilitado com spinner e "Enviar Registro"; *erro de rede:* faixa `erro-rede` com "Tentar de novo" (texto do sistema). **Comportamento:** "editar" → a etapa correspondente, mantendo o preenchido; voltar do sistema → etapa 5. Enviar → AUT-10. O que é enviado: humor, data/hora, observação, texto de cada etapa, itens marcados por grupo (chave `data-grupo`), nota 1–5 por item marcado, campos "Outro".

## AUT-10 · Registro enviado

Barra sem voltar ("REGISTRO NEGATIVO" · "Registro enviado") · círculo `i-check` · título "Registro enviado" · "Hoje, 22/09 · 10:12" · "Seu terapeuta terá acesso a este registro. Você pode corrigir depois em Meus Registros." · **espaço reservado** (112 px, tracejado só na prancha) para o cartão de risco do pacote seguinte · rótulo "SE QUISER CONTINUAR" · lista: `i-heart` "Fazer também um Registro Positivo" (ou `i-heart-crack` "Fazer também um Registro Negativo", quando o enviado foi o Positivo) · `i-chart` "Abrir o Painel de Evolução" · botão secundário "Voltar ao início".
**Comportamento:** "Fazer também…" → AUT-04 do outro tipo, reaproveitando a checagem de humor já enviada (sem nova checagem). Painel → Painel de Evolução. Voltar ao início → Início. Botão voltar do sistema → Início (não volta à revisão).

## AUT-11 · Etapa no computador (1280 px)

Barra de 64 px: voltar · "REGISTRO NEGATIVO" · "Etapa 4 de 5 · Pensamentos Desadaptativos" · "Salvar e sair" à direita. Abaixo, `grid 320px minmax(0,1fr)`, gap 32, padding 28/32:
- **Coluna lateral (sticky):** cartão com as 5 etapas (círculo 28 px: ✓ preenchido nas feitas, número com borda na atual, número cinza nas a fazer; a atual com fundo tinte; ícone da etapa à direita; as feitas são clicáveis) · cartão tinte "O QUE JÁ ESTÁ ANOTADO": HUMOR (rostinho + nome), SITUAÇÃO (frase + chips), EMOÇÕES e REAÇÕES FÍSICAS (item + barra + nota), cada bloco com "editar".
- **Conteúdo (máx. 760 px):** título 28 px · instrução · dica · textarea · linha com "+ Adicionar outro pensamento" e a pílula âmbar "Precisa de ajuda?…" · "Tipo de Pensamento" · grupos: aberto com escala em duas colunas (item + rótulo/nota à esquerda, 5 círculos 44 px à direita em 400 px); fechados com **legenda (descrição) visível** · rodapé inline: "‹" · contagem · botão da próxima etapa.
Sem cabeçalho cumulativo (a coluna lateral faz o papel). Entre 900 e 1279 px a lateral encolhe para 280 px; abaixo de 900 px volta a AUT-07.

## AUT-12 · Estados do fluxo

- **12a · Campo obrigatório:** AUT-04 com o campo vazio, borda `--c-risk` 2 px e, abaixo, `i-alert` + "Preencha o campo "O que aconteceu?" antes de avançar." (14 px 600, `--c-risk-ink`, `role="alert"`). O botão da próxima etapa continua ativo; ao tocar, a tela rola até o primeiro aviso.
- **12b · Rascunho encontrado:** hub com aviso âmbar (borda esquerda `--c-warn`, `i-pencil`): "Você tem um registro em andamento." · resumo do rascunho (chip do tipo + "Etapa 2 de 5 · Emoções Desagradáveis") · botões "Continuar de onde parei" (primário) e "Descartar e começar novo" (secundário). O cartão "Iniciar Novo Registro" não aparece enquanto houver rascunho; Painel, Meus Registros e "Como Usar" continuam. Continuar → a etapa gravada; Descartar → apaga o rascunho e mostra o hub normal.
- **12c · "Sair sem enviar?":** folha inferior (raio 20 em cima, `--sh-3`, fundo escurecido 45 %, `role="dialog"`): título "Sair sem enviar?" · "O que você preencheu fica guardado enquanto esta aba estiver aberta." · dois botões 56 px (rótulos pendentes — ver Dúvida 1). Abre em "Salvar e sair" e no voltar do sistema a partir de qualquer etapa com conteúdo. Fechar a folha volta à etapa.
