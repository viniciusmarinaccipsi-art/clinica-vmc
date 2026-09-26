# Prompts do Pacote 16.5 — como usar

Cada arquivo desta pasta é o prompt completo de UMA fase. Abrir o Claude Code na raiz do repositório (PowerShell: `cd "C:\Users\cardi\Meu Drive\clinica-vmc\repo-github"` → `claude`) e colar a linha indicada. O Code executa a fase inteira, valida, publica e responde "publicado" com o relatório; o usuário testa uma vez em aba anônima e diz "ok" (portão) antes da fase seguinte. O checklist de conferência de cada fase está no mapa visual "Pacote 16.5 · Mapa visual".

| Ordem | Fase | Linha a colar no Claude Code | Depende de |
|---|---|---|---|
| 1 | 16.5a — conferência da entrega + gabarito clínico | `Leia docs/prompts/16.5/PROMPT_16_5a.md e execute do início ao fim.` | nada |
| 2 | 16.4.5 — fonte única Figtree | `Leia docs/prompts/16.5/PROMPT_16_4_5.md e execute do início ao fim.` | 16.5a fechado (gabarito existe) |
| 3 | 16.5b — tokens novos + rostinhos no sprite | `Leia docs/prompts/16.5/PROMPT_16_5b.md e execute do início ao fim.` | 16.4.5 |
| 4 | 16.4.4 — validação da Situação do Positivo | `Leia docs/prompts/16.5/PROMPT_16_4_4.md e execute do início ao fim.` | 16.5b; só edita se reproduzir |
| 5 | 16.5d-1 — unificar as 10 seções em 5, sem mudança visual | `Leia docs/prompts/16.5/PROMPT_16_5d1.md e execute do início ao fim.` | 16.4.4 |
| 5½ | 16.5 pendências — captura de Meus Registros refeita + script pronto para a rodada 3 (não toca o app) | `Leia docs/prompts/16.5/PROMPT_16_5_pendencias.md e execute do início ao fim.` | 16.5d-1; pode rodar antes da rodada 3 |
| — | rodada 3 do Design (em paralelo desde a ordem 1) | o usuário abre o Claude Design seguindo `VMC-offline\16.5_entrada_design\rodada3\MENSAGEM_para_colar_no_Design.md` (anexos + texto a colar); a entrega volta para `rodada3\entrega\` | — |
| 6–9 | 16.5c, 16.5d-2, 16.5e, 16.5f | prompts escritos pelo chat **depois** que a rodada 3 chegar e passar pelo script do 16.5a | rodada 3 |

Regras comuns a todos os prompts (o Code as lê no CLAUDE.md e em docs/): edições por `str_replace` com verificação (grep + `wc -l`); `node --check`; tags balanceadas fora dos `<script>`; zero cor fixa fora do `:root` em `index-dev.html`; Playwright com Chrome visível em 390×844 e 1280×800 (login com sigla inválida até a mensagem do servidor, zero `pageerror`, comparando com `index.html`); `git push` publica (Pages, ~1 min); nada de `clasp` (o 16.5 não toca `Código.js`); nenhum dado clínico em log ou relatório; `index.html` (produção) nunca é editado.

## Retomar em conversa nova do chat (Cowork)

Colar como primeira mensagem: **"Pacote 16.5 — retomada. Leia o status do Projeto (seções 4 e 9) e o mapa visual; a rodada 3 do Design está em `VMC-offline\16.5_entrada_design\rodada3\entrega\`. Confira a entrega com `scripts/conferir_entrega_16_5.py` pelo terminal ligado e escreva o prompt do 16.5c."** A conversa nova tem tudo de que precisa: skill `clinica-vmc` (carrega sozinha), status no Projeto, mapa visual (link no status), esta pasta de prompts, o script de conferência e o terminal ligado à pasta `clinica-vmc`. O que ela **não** tem é a memória desta conversa — por isso qualquer decisão nova entra no status antes de trocar de conversa.
