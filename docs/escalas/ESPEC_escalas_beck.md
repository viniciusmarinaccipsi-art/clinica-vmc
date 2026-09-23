# Especificação — Escalas de Beck (BDI-II e BAI) respondidas pelo paciente no app, como a PHQ-9

**Data:** 22/09/2026 · **Tema:** D (núcleo clínico) · **Pacote sugerido:** 17.0 (depois da correção do timeout por ação)
**Fonte:** material impresso do profissional (folhas de aplicação e manuais fotografados em 22/09/2026).
**Destino deste arquivo:** `repo-github\docs\escalas\ESPEC_escalas_beck.md`, lido pelo Claude Code ao construir o pacote.

---

## 0. Como funciona

1. **Fluxo do paciente igual ao da PHQ-9.** Pontos do `index-dev.html` que mudam (linhas no commit `6f67b7b`):
   - Cartões do menu de Escalas (linhas ~8342–8395): dois cartões novos.
   - `ESC_ESCALAS` (linha 15807): duas definições novas, com a estrutura (itens, faixas, escore máximo, item crítico), sem os textos.
   - `ESC_HIST_ORDEM` (linha 17354): acrescentar `BDI-II` e `BAI`. É o que faz os registros aparecerem no histórico do paciente e no card Escalas da visão do profissional (linha ~9982). Sem isso, os registros ficam gravados e invisíveis.
   - Dashboard do profissional: nenhuma mudança. O indicador de alerta do `Código.js` (linha ~803) já lê `alerta_risco_flag` de qualquer instrumento.

   **Extensão do motor:** a PHQ-9 e o BAI têm um único conjunto de opções para todos os itens, e isso já existe. O BDI-II tem quatro afirmações próprias em cada item (sete nos itens 16 e 18). O motor ganha "opções por item" (propriedade aditiva, sem efeito nas escalas atuais), e o seletor dos itens 16 e 18 devolve o número para a soma e a letra para `observacoes`.
2. **O texto dos itens não fica no código.** O repositório e o site são públicos. Os enunciados, as opções e as instruções ficam numa aba privada, `Itens_Instrumentos`, na planilha `Sistema_VMC`, e o backend os entrega só a quem tem sessão válida (paciente ou profissional). O código publicado contém apenas a estrutura: número de itens, pontuação, faixas e alertas.
3. **Quem digita os itens é o profissional**, a partir das folhas dele. O Claude Code gera o modelo `.xlsx` local (`itens_instrumentos_modelo.xlsx`, colunas abaixo) e um script Python que carrega o modelo preenchido na aba. O script segue o padrão dos scripts existentes: dry-run por padrão, confirmação digitada, log e wrapper de 429. Ele roda no PowerShell externo, pelo usuário.
4. Estrutura da aba (uma linha por texto):

| Coluna | Conteúdo |
|---|---|
| `instrumento` | `bdi2` ou `bai` |
| `tipo` | `instrucao`, `titulo` (BDI-II), `item`, `opcao` ou `ancora` (colunas do BAI: rótulo e descrição) |
| `item` | Número do item (vazio para instrução e âncora) |
| `opcao` | Código da opção: `0`, `1`, `1a`, `1b`… (vazio para instrução, título e enunciado) |
| `texto` | O texto, digitado pelo profissional exatamente como na folha |
| `ativo` | `SIM` depois da conferência (uma linha de controle por instrumento) |

5. **Ação nova do `doPost`:** leitura dos itens de um instrumento (fora de `VMC_ACOES_GRAVACAO`, com repetição automática). Ela exige sessão de paciente ou de profissional válida e nunca devolve a aba inteira sem autenticação. No cliente, os itens ficam só em memória, nunca em `sessionStorage`. O rascunho de escala continua guardando apenas as respostas numéricas.
6. **Gravação: nenhuma coluna nova na planilha do paciente** (conferido no `Código.js`, commit `6f67b7b`). A aba Escalas já tem uma linha por aplicação, com a coluna `instrumento` e as colunas `item_01`…`item_21` (`HEADERS_ESCALAS`, linha 142). BDI-II e BAI têm 21 itens e cabem exatamente. A ação `salvarEscala` e a função `montarLinha` servem sem mudança. Mapeamento:

| Coluna existente | BDI-II | BAI |
|---|---|---|
| `instrumento` | `BDI-II` | `BAI` |
| `item_01`…`item_21` | 0–3 (só o número, inclusive nos itens 16 e 18) | 0–3 |
| `escore_total` / `faixa` | soma / faixa da seção 1 | soma / faixa da seção 2 |
| `alerta_risco_flag` / `_item` / `_valor` | `SIM` / `BDI2_item9` / valor, quando item 9 ≥ 1 | vazio |
| `observacoes` | letra dos itens 16 e 18 (`i16=2b; i18=1a`) | vazio |
| `tempo_preenchimento_seg`, `data_aplicacao`, `versao_instrumento` | como na PHQ-9 | como na PHQ-9 |

Os itens 16 e 18 ficam numéricos em `item_16`/`item_18` porque o resultado e o histórico leem essas colunas como número. A letra (direção da mudança) vai para `observacoes`, que hoje é gravada vazia em todas as escalas.

**Única estrutura nova:** a aba `Itens_Instrumentos` na `Sistema_VMC` (item 4).
7. **Frontend só em `index-dev.html`; backend aditivo** (serve aos dois arquivos). Exige `VERSAO_PACOTE` nova, `clasp push`, `clasp deploy --deploymentId` fixo e ping.
8. **Dependência:** fazer depois da correção do timeout por ação (pacote 16.4.x próprio). Hoje o corte de 20 s do `index-dev.html` pode mostrar erro em gravação lenta.

---

## 0.1 Fidelidade ao instrumento (regra do usuário, 22/09/2026)

A aplicação no app tem de ser a mesma da prática profissional. Nada do instrumento é resumido, adaptado ou reescrito.

1. **Nomes oficiais**, exatamente como nas folhas: "BDI-II — Inventário de Depressão de Beck" e "BAI — Inventário de Ansiedade de Beck". Os cartões do menu não recebem descrição inventada, ao contrário dos cartões das escalas atuais. Mostram só o nome oficial e a janela temporal da instrução.
2. **Todo texto que o paciente lê vem da aba `Itens_Instrumentos`**, digitado pelo profissional a partir da folha original: instrução, título de cada item do BDI-II, cada afirmação (0–3, e 1a…3b nos itens 16 e 18), enunciados do BAI e rótulos das quatro colunas do BAI com as descrições. A instrução é mantida integralmente, inclusive a janela temporal e as regras de resposta.
3. **O código não transforma o texto:** não corta, não resume, não muda maiúsculas nem pontuação e não remove "(a)". Só faz o escape de HTML, que preserva os caracteres, e retira espaços nas pontas.
4. **Ordem e numeração** iguais às da folha. As opções aparecem na ordem 0, 1, 2, 3 (no BDI-II, 0, 1a, 1b, 2a, 2b, 3a, 3b nos itens 16 e 18), com o número visível como no papel.
5. **Modelo Excel com todas as posições já numeradas.** BDI-II: 1 instrução, 21 títulos e 90 afirmações (19 itens × 4 + 2 itens × 7). BAI: 1 instrução, 21 enunciados e 4 colunas × (rótulo + descrição). O script de carga recusa o envio se alguma posição estiver vazia ou sobrar.
6. **Conferência antes de liberar:**
   - Depois da carga, o Claude Code gera um PDF de conferência com cada tela exatamente como o paciente verá (Playwright, 390 px, paciente VMC).
   - O profissional confere o PDF contra a folha original.
   - A escala só aparece no menu do paciente depois da liberação (`ativo = SIM` na aba, marcado pelo profissional).
7. **Trava de integridade:** na liberação, o script grava um hash do conteúdo de cada instrumento. Qualquer alteração posterior na aba exige nova conferência. Enquanto o hash não bater, o backend não entrega os textos e a escala sai do menu.

## 0.2 Mapa de impacto no código (conferido no commit `6f67b7b`, 22/09/2026)

### `index-dev.html` (página de teste): recebe tudo

| Onde (linha aprox.) | O quê | Mudança |
|---|---|---|
| `:root` (98–99, 219) e `docs/design/tokens.css` | Par de cor por escala (`--c-srq20-tint/ink`…) | 2 pares novos: `--c-bdi2-*` e `--c-bai-*`, claro e escuro |
| CSS 2503, 2729–2752, 2838, 2855 | Tintura por escala (`.esc-card.X`, `.esc-tint-X`, `.esch-bloco.X`) | Regras das 2 tinturas novas |
| HTML 8349–8395 (menu de Escalas) | Cartões das escalas | 2 cartões com o nome oficial, sem descrição inventada |
| HTML 8454 (Como Usar as Escalas) | Texto geral, incluindo "O que você verá depois de responder?" | Ajustar: com a opção (a) da seção 4, BDI-II e BAI não mostram resultado ao paciente |
| JS 8791 `VMC_ACOES_GRAVACAO` | Lista de ações de gravação | Nada: a leitura de itens não grava. Se houver ação de liberação chamada pelo app, ela entra aqui |
| JS 15807 `ESC_ESCALAS` | Catálogo (itens, opções, faixas com `rotulo`, `descricao` e `sugestao`, item crítico) | 2 definições com estrutura e faixas. Textos vêm da aba. Sem `descricao`/`sugestao` (seção 4) |
| JS 16260 e renderizador de aplicação | Um conjunto de opções por escala | Extensão aditiva: opções por item (BDI-II) e itens 16/18 com 7 opções |
| JS 16432 `escCalcularEscoreEAlerta` | Soma, faixa, alerta | Funciona com a definição. Conferir o limiar do item 9 (`criticoLimiar: 1`, chave `BDI2_item9`) |
| JS 16501 `escEnviarEscala` | Monta o registro `item_01`…`item_21` | Acrescentar `observacoes` com a letra dos itens 16/18 |
| JS 16604 `escMostrarResultado` | Tela de resultado imediata | "Respostas enviadas" sem escore (seção 4) |
| JS 17354 `ESC_HIST_ORDEM` | Lista usada pelo histórico do paciente (17472) **e** pela visão do profissional `profRenderizarEscalas_` (9970–9991) | Acrescentar `BDI-II` e `BAI`. Sem isso, o registro é gravado e não aparece |
| JS 17465 | Texto do histórico vazio, com os nomes das escalas | Incluir os 2 nomes |
| JS 17536 `escHistRenderAplicacao` | Linha do histórico | Conferir exibição dos itens 16/18 (número + letra de `observacoes`) |
| JS ~9298 Início (16.4) | Continuidade usa `ESC_HIST_STATE` | Nenhuma mudança esperada; o Claude Code confirma por grep |
| Carregamento dos textos | Novo | Chamada à ação de leitura dos itens ao abrir a escala; textos em memória; escala fora do menu sem liberação |

### `index.html` (produção): não muda

Registros `BDI-II`/`BAI` gravados pela página de teste não aparecem no histórico da produção (ficam fora do `ESC_HIST_ORDEM` dela), e nada quebra. O dashboard da produção mostra "última escala" e o alerta do item 9, porque isso vem do servidor. Tudo entra na produção na promoção do tema G.

### `Código.js` (Apps Script): mudanças aditivas

| Onde (linha aprox.) | O quê | Mudança |
|---|---|---|
| 142 `HEADERS_ESCALAS` | Cabeçalho da aba Escalas | Nenhuma (21 itens cabem; `observacoes` já existe) |
| 1121 `salvarEscala` / 981 `montarLinha` | Gravação por cabeçalho | Nenhuma |
| 1143 `lerEscalas` | Leitura do histórico | Nenhuma |
| 803–835 `listarPacientes` (indicadores 13.2.3) | Última escala e alerta mais recente, de qualquer instrumento | Nenhuma: BDI-II entra sozinho |
| `doPost` (roteador, 32 ações) | Ações | +1: `lerItensInstrumento` (sessão válida, instrumento liberado, hash conferido) |
| Constantes | `ABA_ITENS_INSTRUMENTOS = 'Itens_Instrumentos'` na `Sistema_VMC` | Nova |
| `VERSAO_PACOTE` | Verificação por ping | Nova versão, clasp push + deploy fixo |

### Fora do código

- A planilha `Sistema_VMC` ganha a aba `Itens_Instrumentos`.
- O repositório ganha o modelo `.xlsx` vazio e o script de carga e liberação. O modelo preenchido vai para o `.gitignore`.

## 1. BDI-II — Inventário de Depressão de Beck (completo)

| Propriedade | Valor |
|---|---|
| Id técnico | `bdi2` |
| Itens | 21 |
| Resposta | 0, 1, 2 ou 3 (uma por item) |
| Itens com variante de direção | 16 (sono) e 18 (apetite): opções 0, 1a, 1b, 2a, 2b, 3a, 3b |
| Pontuação dos itens 16 e 18 | Só o dígito conta (1a e 1b valem 1). **Gravar a letra** também, porque a direção (aumento ou redução) tem valor clínico |
| Escore total | Soma dos 21 itens, de 0 a 63 |
| Janela temporal (para exibir) | Duas últimas semanas, incluindo o dia da aplicação |
| Obrigatoriedade | Os 21 itens, com uma opção por item (seleção única na tela, que dispensa a regra do papel de "duas marcadas, vale a mais alta") |

**Faixas** (pontos de corte sugeridos no manual para pacientes com diagnóstico de depressão maior):

| Total | Classificação |
|---|---|
| 0–13 | Mínimo |
| 14–19 | Leve |
| 20–28 | Moderado |
| 29–63 | Grave |

**Alerta de risco:** item 9 ≥ 1 gera alerta na mesma camada do PHQ-9 item 9 (tela de resultado, prontuário e indicador do dashboard). A mensagem é genérica ("Item de ideação suicida pontuado") e não reproduz o texto do item.

---

## 2. BAI — Inventário de Ansiedade de Beck (completo)

| Propriedade | Valor |
|---|---|
| Id técnico | `bai` |
| Itens | 21 |
| Resposta | 0 a 3, na ordem das quatro colunas da folha (da ausência de incômodo ao incômodo grave) |
| Escore total | Soma dos 21 itens, de 0 a 63 |
| Janela temporal | Última semana, incluindo o dia da aplicação |
| Obrigatoriedade | Os 21 itens |

**Faixas** (Tabela 2 do manual brasileiro: pacientes psiquiátricos, versão em português):

| Total | Classificação |
|---|---|
| 0–10 | Mínimo |
| 11–19 | Leve |
| 20–30 | Moderado |
| 31–63 | Grave |

Nota do manual, a exibir no histórico do profissional: os cortes dependem da amostra e do objetivo. Em triagem, os limites tendem a ser baixados (menos falsos negativos). Em pesquisa, tendem a ser elevados (menos falsos positivos). O sistema usa a Tabela 2 sem ajuste.

**Alerta de risco:** o BAI não tem item crítico.

---

## 3. Fora deste pacote (material incompleto)

| Instrumento | Falta |
|---|---|
| BHS (Beck Hopelessness Scale) | Chave de correção (quais itens pontuam em C e quais em E) e faixas |
| BSI (Beck Scale for Suicide Ideation) | Faixas ou critério de interpretação e confirmação da regra de correção (salto 4–5 → 20, itens 20–21 fora do total) |

---

## 4. Decisão tomada

**O que o paciente vê ao terminar:** opção (a), igual à prática com o papel (22/09/2026). O paciente vê "Respostas enviadas", sem escore, sem faixa e sem texto interpretativo. Escore, faixa, alerta e histórico aparecem só na área do profissional. No histórico do paciente, a aplicação aparece com data e nome, sem escore. O alerta do item 9 do BDI-II mantém para o paciente a mesma camada de segurança da PHQ-9 item 9.

## 5. Validação do pacote (além da lista padrão da skill)

- `grep` confirma que nenhum texto de item dos instrumentos existe em `index-dev.html`, `index.html`, `Código.js` ou em qualquer arquivo versionado. O modelo `.xlsx` preenchido entra no `.gitignore`.
- A ação de leitura dos itens recusa chamada sem sessão válida (teste com payload sem sigla ou com sigla de outro profissional).
- Com a aba ainda vazia, sem liberação ou com o hash divergente, a escala não aparece no menu do paciente (default seguro).
- Teste de fidelidade: para cada texto da aba, o texto renderizado na tela (`innerText`) é idêntico ao da aba. Qualquer diferença impede o fechamento.
- Teste das faixas do BDI-II (13/14, 19/20, 28/29) e do BAI (10/11, 19/20, 30/31).
- Teste do alerta do BDI-II no item 9, com valor 0 e com valor ≥ 1.
- BDI-II itens 16 e 18: "2b" soma 2 e grava "2b".
- Playwright no `index-dev.html` com sessão simulada do paciente VMC: responder o BDI-II e o BAI, gravar, ver o resultado, reabrir o histórico e conferir na visão do profissional, com zero `pageerror`.
