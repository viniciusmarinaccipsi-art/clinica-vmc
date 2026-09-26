# Pacote 16.5 · Registro de automonitoramento (rodada 2) — LEIA-ME

**Sistema Clínico Digital VMC** · entrega do Design · 25/09/2026 · responde ao `16.5_brief_design.md` (22/09, rev. 23/09).
Substitui as pranchas AUT-02 a AUT-11 do Documento-mestre v1 (17/09/2026).

## Índice da entrega

| Arquivo | O que é |
| --- | --- |
| `00_LEIA-ME.md` | Este arquivo: índice, o que mudou, regra a regra, Dúvidas, Sugestões |
| `01_pranchas_16.5.html` | As 16 telas em pacote offline (abre sem internet; Figtree embutida) |
| `01_pranchas_16.5.dc.html` | O mesmo, no formato editável do Design (fonte das pranchas) |
| `01b_documento-mestre-v2.html` | Documento-mestre atualizado: seção 7 refeita com o 16.5, APP-02 e APP-03 marcadas como descartadas, anexo = contrato v2 |
| `01_png/` | Um PNG por tela, 390 px de largura (2×), `AUT-11` a 1280 px |
| `02_telas.md` | Por tela: estrutura, componentes, estados e comportamento, com os textos do arquivo de textos |
| `03_componentes.md` | Componentes comuns com medidas, tokens e estados |
| `04_tokens.css` | `tokens.css` com Figtree única e os tokens novos (comentário no topo lista o que mudou) |
| `05_rostinhos.svg` | `i-humor-1` a `i-humor-5`, prontos para o sprite |
| `06_contrato_de_leitura_v2.md` | Checklist de aceite atualizado |
| `catalogo.js` · `icones.js` | Dados que alimentam as pranchas: catálogo clínico (gerado por script a partir do `.md`) e caminhos dos ícones |

### PNGs (`01_png/`)

AUT-02_hub · AUT-02_hub-primeiro-acesso · AUT-03_checagem-breve · AUT-03b_checagem-enviada · AUT-04_situacao · AUT-05_emocoes · AUT-06_reacoes-fisicas · AUT-07_pensamentos · AUT-08_comportamentos · AUT-08p_positivo-emocoes · AUT-09_revisar-e-enviar · AUT-10_registro-enviado · AUT-11_computador-1280 · AUT-12a_campo-obrigatorio · AUT-12b_rascunho-encontrado · AUT-12c_sair-sem-enviar

## O que mudou desde a v1

1. **Conteúdo clínico não é mais digitado à mão.** O `catalogo.js` foi gerado por script a partir do `16.5_catalogo_automonitoramento.md` (45 grupos · 225 itens · 45 "Outro:" · 3 legendas, conferidos por contagem). As pranchas leem desse arquivo. Nenhum item reescrito, cortado ou inventado; "(a)" preservado.
2. **Textos da interface só da coluna "Proposta".** "Gravar" saiu; "Enviar Registro" / "Registro enviado"; "Salvar e sair" só para o rascunho; "seu terapeuta"; sem "Módulo 2"; sem contagem de tempo ou de dias.
3. **Fonte única Figtree, títulos 600.** Newsreader saiu do app. Foi avaliada nas pranchas com o arquivo real do Google Fonts, embutido no pacote offline. Nota técnica: o Google serve a Figtree como **fonte variável** (eixo `wght` 300–900) — um único `.woff2` por subconjunto (latin e latin-ext) cobre 400, 500, 600 e 700; por isso as quatro declarações `@font-face` do pacote apontam para o mesmo arquivo. Não é erro: os pesos renderizam distintos (ver PNGs). Para o app, o Code pode carregar o mesmo par de arquivos variáveis ou os quatro estáticos da família — o resultado visual é o mesmo.
4. **Fluxo novo:** hub → checagem breve → (escolha do tipo no fim da checagem) → 5 etapas → Revisar e Enviar → Registro enviado. As telas "Tipo de registro" e os menus das etapas saíram.
5. **Escala por subgrupo assinalado** (rev. 23/09): cada item marcado ganha a sua régua com rótulo de hoje, palavra da legenda sob cada número e a nota por extenso ("3 · Moderado").
6. **Cabeçalho cumulativo** sem emoji: rostinho SVG; definição dos subgrupos assinalados (com nota) antes da frase escrita; duas linhas, cortando a partir da frase.
7. **Telas novas:** AUT-03b, AUT-08p, AUT-12 (3 estados) e o hub no primeiro acesso.
8. **Sem campos novos:** os `pacContatoConfianca*` da v1 não entram; a caixa de pensamentos continua sem nota.

## Como cada regra do brief foi aplicada

| # | Regra | Como |
| --- | --- | --- |
| 1 | Conteúdo clínico literal | Gerado por script (`catalogo.js`) e renderizado a partir dele. Quando não coube, mostramos menos grupos abertos (1 aberto por etapa; nas pranchas AUT-06 e AUT-08 um segundo grupo aparece fechado com "1 marcado"), nunca menos itens no grupo aberto |
| 2 | Textos só do arquivo | Coluna "Proposta" + "O que fica igual". Instruções das etapas, "Tipo de Contexto/Pensamento/Comportamento" e as dicas dos campos lidos do `index-dev.html` (Pacote 17.0) do repositório. O que não constava foi para Dúvidas/Sugestões, não para a prancha |
| 3 | Nenhum campo novo | Nenhum. A referência da observação da checagem na Situação é só leitura |
| 4 | Figtree, títulos 600 | Em tudo, inclusive números, horas e barra. `04_tokens.css` troca `--f-title` |
| 5 | Cor por token | Só valores do `tokens.css` (+ os novos, declarados no `04_tokens.css` e usados na prancha como `var(--c-humor-N-bg)`, `var(--c-reg-neg-mid)`, `var(--c-reg-pos-mid)`). A caixa descritiva do humor e "Na checagem você anotou:" usam `--c-action-tint`; `#EDEBF7` (DASS-21) não aparece. Vermelho só no aviso de campo obrigatório (erro). Ameixa = Negativo, verde-água = Positivo, índigo = ação, âmbar = ajuda e pendência |
| 6 | Rostinhos | `05_rostinhos.svg`: 5 símbolos 24×24, traço 2, `currentColor`, mesmo traço do sprite. Cores: `--c-humor-N-ink` |
| 7 | Acessibilidade | Toque ≥ 44 px (faixas de humor 56, Likert 48, botões do rodapé 56); texto ≥ 14 px (rótulos em caixa alta 12 px); contraste ≥ 4,5:1 conferido nos pares de token; rótulo sempre visível; dicas dos campos fora do campo |
| 8 | Verbos | "Enviar Registro", "Registro enviado", "Checagem de humor enviada"; "Salvar e sair" só no rascunho |
| 9 | Profissional | "Seu terapeuta terá acesso a este registro" |
| 10 | Escopo | Só AUT-02 a AUT-12. Escalas, anamnese, área do profissional e agenda intocadas |

## Dúvidas (não corrigimos por conta própria)

1. **Contagem do rodapé nas outras etapas.** O arquivo dá "2 emoções marcadas" e pede "o equivalente em cada etapa". Derivamos: "1 situação marcada", "2 reações físicas marcadas", "1 pensamento marcado", "2 comportamentos marcados". Confirmar a forma.
2. **Instrução da etapa Situação.** Hoje o cabeçalho da seção diz "O que estava acontecendo quando seu humor mudou" (sem ponto/interrogação). Usamos como instrução abaixo do título "O que aconteceu?". Confirmar se fica.
3. **"Tipo de Contexto" no Registro Positivo.** O catálogo diz que a Situação do Positivo não tem grupos (débito 8.6). A prancha AUT-08p mostra só a frase no cabeçalho, como pedido. A etapa 1 do Positivo não foi desenhada nesta rodada (não estava na lista).
4. **Grafia herdada do catálogo** (não alterada, só registrada): "repudio" (sem acento), "estomago", "dissossiação", "Sou fracasso e não consigo…", "Ruminando o que eu deveria fazer…". Valem como estão até o catálogo mudar.
5. **Rótulo "Desconforto:" em caixa alta.** O texto é o de hoje; a caixa alta é só apresentação (`text-transform`). Se preferir em caixa normal, é um token de estilo, não de texto.
6. **AUT-11 mostra a etapa 4 (Pensamentos), não a 2.** Escolhida para a coluna "O que já está anotado" exibir barras de duas etapas. Se preferir a etapa 2 como na v1, é troca de dados, não de layout.

## Sugestões (fora da prancha)

**Textos novos aceitos em 25/09/2026** (não constavam do arquivo de textos; entram na próxima revisão dele):
- "Nada marcado ainda" — contagem do rodapé quando nenhum item foi marcado na etapa.
- "Continuar registro" (primário) e "Sair" (secundário) — botões da folha "Sair sem enviar?".

1. Quando a observação da checagem existir, a dica do campo Situação poderia ser mais curta ainda ou sumir: a referência acima do campo já contextualiza.
2. Nas etapas sem intensidade (Situação, Comportamentos), o grupo fechado poderia mostrar os itens marcados por nome (não só "2 marcados") — cabe num chip pequeno.
3. Nos aparelhos com largura ≥ 400 px a régua 1–5 ganha folga; abaixo de 360 px recomendamos reduzir o círculo para 44 px e manter a palavra em 14 px (a coluna mínima é 70 px por causa de "Totalmente").
4. Na tela "Registro enviado", quando o cartão de risco for desenhado, sugerimos que ele entre entre a frase "Seu terapeuta…" e "Se quiser continuar", no espaço já reservado.
5. O botão "‹" do rodapé lê "Etapa anterior" para leitores de tela (`aria-label`); na etapa 1 ele volta à checagem — vale confirmar esse destino no Code.

## Como navegar e como o sistema deve se comportar em navegador e app

As pranchas são desenhadas a 390 px (celular) e 1280 px (computador), mas o layout é fluido: coluna única até ~900 px; a partir daí, coluna lateral fixa de 320 px + conteúdo de até 760 px (AUT-11). Não há medidas em unidades de janela; tudo em px de token e `minmax(0,1fr)`. Em app (WebView) e navegador o comportamento é o mesmo; a barra de ação inferior fica fixa no celular e inline no computador.
