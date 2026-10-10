# cogniativo · marca_logo/ — logo aprovado (Etapa A, 10/10/2026)

Substitui o pacote de 09/10 ("C + ponto central", duas cores). Decisão: direção **1c** — C de terminais redondos com ponto central — na proporção **3a** (símbolo da altura das letras, apoiado na linha de base). **Duas tintas da mesma família**: o C na cor da marca e o ponto sempre um tom mais claro (revisão de 10/10, noite).

## Índice
- `00_LEIA-ME.md` — este arquivo
- `01_pranchas_logo.html` — quadro final, arquivo único (abre em qualquer navegador): símbolo, cores, 6C, 6D, barra, favicon, login 6B, ícone do app, uma cor
- `01_pranchas_logo.dc.html` (+ `support.js`) — fonte editável do quadro
- `01_png/apresentacao-logo.png` — o quadro a 2×
- `simbolo.svg` — símbolo cru (claro): C #4C4A8F, ponto #A8A5E0, `viewBox 0 0 64 64`
- `simbolo-escuro.svg` — para fundo escuro: C #A8A5E0, ponto #C4C2EE
- `simbolo-mono.svg` — uma cor só, tudo em `currentColor` (impressão, marca-d'água, ícone pintado pelo tema)
- `simbolo-quadro.svg` / `simbolo-quadro-escuro.svg` — símbolo no quadrado (raio 18): lavanda #E7E6F5 com C #3D3A6B e ponto #A8A5E0; escuro #262441 com C #A8A5E0 e ponto #C4C2EE
- `icone-app.svg` — fundo índigo #4C4A8F cheio, C #C4C2EE, ponto #FFFFFF (o sistema arredonda)
- `favicon.svg` — `viewBox 0 0 32 32`, traço mais grosso, C #4C4A8F, ponto #A8A5E0
- `logo-horizontal.svg` — símbolo + "cogniativo" + lema, **texto em curvas** (Figtree SemiBold e Regular convertidas; nenhum `<text>`, nenhuma fonte), tema claro, fundo transparente
- `logo-horizontal-escuro.svg` — o mesmo, cores do tema escuro

## Conceito
Um C de pontas arredondadas — a cognição — e um ponto no centro: o foco, aquilo que se registra e se transforma. Duas tintas da mesma família: o C na cor da marca, o ponto um tom mais claro. Nome em minúsculas ("cogniativo"), Figtree 600; lema em Figtree 400.

## Geometria do símbolo (viewBox 64)
Arco: centro (32, 32), raio 20, espessura 11, terminais redondos, abertura de 80° voltada para a direita (de 320° a 40°). Ponto: círculo centro (32, 32), raio 7,5. Caixa ocupada: 6,5–57,5 nos dois eixos.
Quadrado: símbolo a 62,5 % do lado (40 em 64), centrado. Favicon (viewBox 32): arco centro (16, 16) raio 10 espessura 6; ponto raio 4.

## Proporção símbolo + nome (3a)
Símbolo apoiado na linha de base, altura visível = altura do "t"/"i" (0,74 × corpo). Em números: símbolo = 0,93 × corpo do nome; espaço entre símbolo e nome = 0,28 × corpo. Lema a 0,47 × corpo, alinhado à esquerda do símbolo, 5 px abaixo.
- Horizontal (SVG): nome 30 → símbolo 28, espaço 8, lema 14.
- Barra do sistema 52 px: nome 18 → símbolo 17, espaço 5 (sem quadrado lavanda).
- Topo do login: nome 26 → símbolo 24, espaço 7; lema 13.

## Cores (só de tokens.css) — regra: o ponto é sempre o tom mais claro do par
- Claro: C `--c-action` #4C4A8F · ponto #A8A5E0 · nome `--c-ink` #1D1B2B · lema `--c-ink-3` #5E5B73
- Escuro: C #A8A5E0 · ponto #C4C2EE · nome #F7F6FB · lema #9C99AD
- Quadrado lavanda (`--c-action-tint` #E7E6F5): C `--c-action-ink` #3D3A6B · ponto #A8A5E0
- Quadrado escuro (#262441): C #A8A5E0 · ponto #C4C2EE
- Ícone do app (fundo #4C4A8F cheio): C #C4C2EE · ponto #FFFFFF
- Uma cor só (`simbolo-mono.svg`): tudo em `currentColor`
- Nenhum token novo.

## Tamanho mínimo
Símbolo isolado: 16 px (favicon). Lockup horizontal: nome 18 px / símbolo 17 px; abaixo disso, usar só o símbolo.

## Área de respiro
Ao menos ¼ da altura do símbolo livre em volta (≈ o diâmetro do ponto). Nada encosta nesse espaço.

## O que não fazer
- Não inverter o par (ponto escuro e C claro) nem pintar o ponto com a cor dos botões.
- Não usar sombra, degradê, contorno ou efeito; não girar, espelhar ou afinar o traço; não deslocar o ponto do centro.
- Não escrever o nome em caixa alta ao lado do símbolo; não trocar a Figtree; não desalinhar o símbolo da linha de base.
- Não usar vermelho (no sistema é risco) nem o símbolo sobre foto.
- Não colocar o símbolo abaixo de 16 px nem o lema abaixo de 11 px.

## Para o Code
1. `favicon.svg` no `<head>`; PNGs de 16/32 a partir de `favicon.svg`; 180/192/512 a partir de `icone-app.svg`.
1b. No sistema, onde o ícone é pintado por `currentColor`, usar `simbolo-mono.svg`; onde há duas cores, `simbolo.svg`/`simbolo-escuro.svg` conforme o tema.
2. Imagem do e-mail: `logo-horizontal.svg` rasterizado a 480 × 112 (2×), fundo branco.
3. Barra do sistema: símbolo 17 px direto (sem quadrado), nome 18 px, baseline alinhada.
4. Os textos de tela em caixa alta ("COGNIATIVO") continuam; só a marca gráfica é em minúsculas.

## Dúvidas
1. O topo do login passa a ser horizontal (símbolo + nome + lema embaixo), como no quadro, ou mantém o quadrado lavanda empilhado de hoje?
2. O lema entra na barra do sistema em telas largas ou só no login e no e-mail?
3. Confirmar se o SVG em curvas pode substituir o PNG nos cabeçalhos do sistema (fica nítido em qualquer tela).
