# Mapa de campos — redesenho × código atual

**Sistema Clínico Digital VMC** · gerado em 17/09/2026
Fonte: `clinica-vmc/repo-github/index.html` (18.012 linhas), lido diretamente.

**Decisão desta entrega: nenhum nome de campo muda.** O redesenho reusa `id`, `data-grupo`, `data-item`
e `data-tem-likert` exatamente como estão no código. Nenhuma migração de planilha é necessária.
Este documento existe para que o desenvolvedor saiba, para cada elemento novo de tela, qual campo
existente ele lê ou escreve — e para registrar os dois campos genuinamente novos, no fim.

---

## 1. Como ler este mapa

| Coluna | Significado |
|---|---|
| Elemento no redesenho | O que aparece na tela, com o arquivo de design onde está |
| Campo no código | `id`, `data-grupo` ou `data-item` atual — **inalterado** |
| Ação | lê · escreve · só apresentação |

Convenção de nomes já existente no código, preservada:

```
<tipo>_<etapa>_<grupo>            → data-grupo   ex.: neg_emo_tristeza
<tipo>_<etapa>_<grupo>_<item>     → data-item    ex.: neg_emo_tristeza_triste
tipo   = neg (Registro Negativo) | pos (Registro Positivo)
etapa  = sit | emo | fis | pens | comp
```

---

## 2. Automonitoramento — as 5 etapas

Arquivo de design: **Fluxo - Automonitoramento**

### 2.1 Etapa 1 · Situação

| Elemento no redesenho | Campo no código | Ação |
|---|---|---|
| Campo de texto “O que aconteceu?” | `autoInpObsHumor` (reuso) / textarea da etapa | escreve |
| Data do registro | `autoInpData` | escreve |
| Hora do registro | `autoInpHora` | escreve |
| Chip **Interpessoal** | `neg_sit_tipo_interpessoais` | escreve |
| Chip **Desempenho** | `neg_sit_tipo_desempenho` | escreve |
| Chip **Solidão** | `neg_sit_tipo_solidao` | escreve |
| Chip **Perda** | `neg_sit_tipo_perda` | escreve |
| Chip **Internas** | `neg_sit_tipo_internas` | escreve |

Os 5 grupos de situação têm `data-tem-likert` ausente (não recebem intensidade) — o redesenho
respeita isso: chips de situação não abrem linha de Likert.

### 2.2 Etapa 2 · Emoções Desagradáveis / Agradáveis

| Grupo na tela | `data-grupo` | Likert |
|---|---|---|
| Tristeza / Depressão | `neg_emo_tristeza` | sim |
| Ansiedade / Medo | `neg_emo_ansiedade` | sim |
| Raiva / Irritação | `neg_emo_raiva` | sim |
| Culpa / Vergonha | `neg_emo_culpa` | sim |
| Ciúme / Inveja | `neg_emo_ciume` | sim |
| Felicidade / Alegria | `pos_emo_felicidade` | sim |
| Orgulho / Satisfação | `pos_emo_orgulho` | sim |
| Conexão / Afeto | `pos_emo_conexao` | sim |
| Calma / Tranquilidade | `pos_emo_calma` | sim |
| Esperança / Motivação | `pos_emo_esperanca` | sim |

### 2.3 Etapa 3 · Reações Físicas de Mal-Estar / Bem-Estar

| Grupo na tela | `data-grupo` | Likert |
|---|---|---|
| Ativação | `neg_fis_ativacao` | sim |
| Desativação | `neg_fis_desativacao` | sim |
| Tensão | `neg_fis_tensao` | sim |
| Digestivas | `neg_fis_digestivas` | sim |
| Sono | `neg_fis_sono` | sim |
| Calma corporal | `pos_fis_calma` | sim |
| Energia | `pos_fis_energia` | sim |
| Relaxamento | `pos_fis_relaxamento` | sim |
| Digestivo | `pos_fis_digestivo` | sim |
| Atenção | `pos_fis_atencao` | sim |

### 2.4 Etapa 4 · Pensamentos Desadaptativos / Adaptativos

| Grupo na tela | `data-grupo` | Likert |
|---|---|---|
| Sobre mim | `neg_pens_sobre_mim` | sim |
| Sobre o futuro | `neg_pens_sobre_futuro` | sim |
| Sobre os outros | `neg_pens_sobre_outros` | sim |
| Cobrança | `neg_pens_cobranca` | sim |
| Culpa | `neg_pens_culpa` | sim |
| Autocompaixão | `pos_pens_autocompaixao` | sim |
| Esperança | `pos_pens_esperanca` | sim |
| Confiança | `pos_pens_confianca` | sim |
| Flexibilidade | `pos_pens_flexibilidade` | sim |
| Responsabilidade | `pos_pens_responsabilidade` | sim |

Os chips “Esse pensamento é sobre — Mim / O futuro / Os outros / Cobrança / Culpa” da tela de
celular **são** esses cinco grupos, apresentados como filtro em vez de cinco cartões empilhados.
Nenhum campo novo.

### 2.5 Etapa 5 · Comportamentos Disfuncionais / Funcionais

| Grupo na tela | `data-grupo` | Likert |
|---|---|---|
| Evitação | `neg_comp_evitacao` | **não** (`data-tem-likert="0"`) |
| Isolamento | `neg_comp_isolamento` | não |
| Reatividade | `neg_comp_reatividade` | não |
| Entorpecimento | `neg_comp_entorpecimento` | não |
| Controle | `neg_comp_controle` | não |
| Enfrentamento | `pos_comp_enfrentamento` | não |
| Conexão | `pos_comp_conexao` | não |
| Expressão | `pos_comp_expressao` | não |
| Autocuidado | `pos_comp_autocuidado` | não |
| Aceitação | `pos_comp_aceitacao` | não |

Por isso a etapa 5 do redesenho não mostra intensidade, e o texto de apoio diz
“aqui não há intensidade” — é fidelidade ao `data-tem-likert="0"`, não simplificação.

### 2.6 Navegação e gravação

| Elemento no redesenho | Campo no código | Ação |
|---|---|---|
| Cartão **Registro Negativo** no hub | `autoCardNeg` → `autoSelecionarTipo('neg')` | ação |
| Cartão **Registro Positivo** no hub | `autoCardPos` → `autoSelecionarTipo('pos')` | ação |
| Botão “Revisar antes de gravar” (neg.) | `autoBtnFinalizarNeg` → `autoFinalizarTipo('neg')` | ação |
| Botão “Revisar antes de gravar” (pos.) | `autoBtnFinalizarPos` → `autoFinalizarTipo('pos')` | ação |
| Tela **Confira antes de gravar** | `autoResumoConteudo` | lê |
| Botão **Gravar registro** | `autoBtnEnviar` → `autoEnviarRegistro()` | escreve |
| Lista **Meus registros** | `autoHistLista` | lê |
| Cartão “Como usar” | `autoCardComoUsar` → `abrirSecao('sec-auto-instrucoes')` | ação |
| Cartão **Painel de Evolução** | `autoCardPainel` → `p5ClicarCardBloquevel('painel')` | ação |
| Cartão **Histórico** | `autoCardHistorico` → `p5ClicarCardBloquevel('historico')` | ação |
| Botão **Fazer checagem de humor** (menu) | `autoCardIniciar` → `p5ClicarCardBloquevel('iniciar')` | ação |

### 2.7 Checagem de humor

| Elemento no redesenho | Campo no código | Ação |
|---|---|---|
| Botões 1 a 5 (Muito mal → Muito bem) | escala de humor existente (1–5) | escreve |
| Texto descritivo abaixo da escolha | `autoHumorDesc` | lê |
| Campo de observação livre | `autoInpObsHumor` | escreve |

O redesenho separa a checagem de humor do registro completo (“Só salvar o humor” /
“Salvar e seguir”). Ambos os caminhos gravam os mesmos campos — muda só o ponto de saída.

---

## 3. Escalas

Arquivo de design: **Fluxo - Escalas**. Definições em `ESC_ESCALAS` (linha ~15.631 do `index.html`).

| Elemento no redesenho | Campo no código | Ação |
|---|---|---|
| Título da escala na abertura | `escAplicarHead` / `escAplicarTitulo` | lê |
| Subtítulo (“Sintomas depressivos”) | `escAplicarSub` | lê |
| Enunciado (“Durante as últimas 2 semanas…”) | `escAplicarEnunciado` | lê |
| Lista de itens | `escItens` | lê |
| Texto “4 de 9 respondidas” | `escProgressoLabel` | lê |
| Barra de progresso | `escProgressoBarra` | lê |
| Percentual | `escProgressoPct` | lê |
| Botão **Ver resultado** | `escBtnEnviar` → `escEnviarEscala(event)` | escreve |
| Tela de resultado (escore, faixa, texto) | `escResultContainer` | lê |
| Selo de faixa colorido | `.esc-result-faixa` + `.verde/.amarelo/.vermelho` | só apresentação |
| Cartão “Como usar” | `escCardComoUsar` | ação |
| Modal de instruções | `escModalComoUsar` · `escBtnEntendi` → `escClicarEntendi()` | ação |
| Aviso de sub-escala | `escSubAviso` | lê |
| Lista **Meu histórico** | `eschConteudo` | lê |
| Detalhe de uma aplicação | `eschModalDetalhe` · `eschModalTitulo` · `eschModalConteudo` | lê |

Itens, opções (0 a 3), pontuação e faixas vêm de `ESC_ESCALAS` sem alteração — o redesenho troca
a apresentação (um item em foco, 44 px de alvo, faixa como régua) e nunca o instrumento.

---

## 4. Anamnese e cadastro

Arquivo de design: **Paciente - Onboarding**

| Elemento no redesenho | Campo no código | Ação |
|---|---|---|
| Corpo dos 5 passos | `anamConteudo` | lê · escreve |

Os campos individuais da anamnese são gerados dinamicamente dentro de `anamConteudo`; o redesenho
apenas os reagrupa em 5 passos e mantém os `name`/`id` que o gerador já produz.

---

## 5. Campos novos (os únicos)

Dois elementos do redesenho não têm correspondente no código. Ambos são opcionais: sem eles, as
telas funcionam, só perdem a função descrita.

| Campo proposto | Tipo | Onde aparece | Para quê |
|---|---|---|---|
| `pacContatoConfiancaNome` | texto | Cadastro; botão “Avisar minha pessoa de confiança” no alerta de risco | Nome exibido no botão do cartão de apoio em crise |
| `pacContatoConfiancaFone` | telefone | idem | Destino do `tel:` do mesmo botão |

Se o Vinicius preferir não coletar contato de terceiros, o botão sai e o cartão de risco fica
apenas com o CVV 188 — nenhuma outra tela muda.

---

## 6. O que o redesenho **não** toca

- Nenhum `data-grupo` renomeado, removido ou reordenado.
- Nenhum `data-item` alterado.
- `data-tem-likert` respeitado item a item (inclusive os `"0"` dos comportamentos).
- Estrutura da planilha `Sistema_VMC` intacta.
- Itens, escores e faixas das escalas preservados.
- Termos clínicos da seção 4 do brief aplicados literalmente na interface.
