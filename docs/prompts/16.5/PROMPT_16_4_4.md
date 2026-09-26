# PROMPT · Pacote 16.4.4 — Validação da etapa Situação do Registro Positivo (index-dev)

Sistema Clínico Digital VMC · 26/09/2026 · correção técnica mínima; **só edita se reproduzir**. Decisão E do usuário (26/09): os tipos de situação positiva (5 grupos) serão criados por ele num pacote futuro, sem previsão; este pacote **não cria conteúdo**, só permite que a etapa 1 do Positivo avance com o campo de texto até lá.

## Contexto
1. Ler `CLAUDE.md`, `docs/arquitetura.md`, `docs/licoes-aprendidas.md` ("bug sem reprodução não vira commit Correção"). `git pull`; pré-requisito: 16.5b fechado.
2. Só `index-dev.html`. `index.html` e `Código.js` intocados; sem `clasp`.
3. Hipótese a testar: `autoValidarSecao('sec-auto-sit-b')` (ou a função equivalente — confirmar o nome por grep, nunca de memória) exige "Marque pelo menos uma opção em algum tipo de contexto antes de avançar." mesmo quando a seção não tem nenhum `[data-grupo]`, e por isso o Positivo não passa da etapa 1.

## Passos
1. **Reproduzir antes de editar.** Playwright, `index-dev.html` **publicado** (o `file://` não chama o Apps Script), Chrome visível, 390×844. Sessão simulada do paciente de teste (`salvarSessao({...})`, sem senha) ou, se o fluxo exigir login real, parar e pedir ao usuário que faça o login de teste na aba (você não digita senhas). Abrir o Registro Positivo, preencher o textarea da `sec-auto-sit-b` com um texto de teste neutro, tentar avançar (pelo botão real da tela e também por `page.evaluate` chamando a função de validação). Registrar: mensagem exibida, retorno da função, `pageerror`. Repetir no Negativo com texto e sem grupo (deve bloquear) e com texto e um grupo (deve passar). **Se o Positivo avançar normalmente, não há bug: escrever o relatório dizendo isso, sem commit de código, e encerrar.**
2. **Correção (só se reproduzido):** na função de validação, a exigência de grupo marcado vale quando a seção contém ao menos um `[data-grupo]`; seção sem grupos exige só o texto (a mensagem de texto vazio continua a de hoje). Não criar grupos, não alterar mensagens, não tocar no Negativo. `str_replace` com contexto único; grep do trecho + `wc -l`.
3. **Marcador:** linha 2 → "Pacote 16.4.4".
4. **Validação:** repetir o passo 1 (Positivo passa com texto; Negativo continua exigindo grupo; texto vazio bloqueia nos dois); smoke padrão 390/1280 com login inválido, zero `pageerror`, comparando com `index.html`; gabarito do 16.5a igual; `node --check`; tags.
5. **Publicar:** commit `Pacote 16.4.4 - Registro Positivo: validacao da Situacao sem grupos (index-dev)` · `git push` · repetir o passo 1 no publicado com `?v=1644`.
6. **Relatório** `../VMC-offline/PACOTE_16_4_4_RELATORIO.md`: reprodução (antes), diff (função, linhas), reprodução (depois), smoke. Registrar que o conteúdo (grupos positivos) continua débito 8.6.
7. Mensagem final: "publicado" (ou "sem bug, nada alterado") + 4 linhas.

## Checklist do usuário (aba anônima, `index-dev.html?v=1644`, paciente VMC)
- [ ] Registro Positivo: etapa Situação com um texto avança para Emoções Agradáveis.
- [ ] Registro Positivo: sem texto, aparece o aviso e não avança.
- [ ] Registro Negativo: com texto e sem tipo de contexto, continua avisando "Marque pelo menos uma opção…".
- [ ] Um Registro Positivo completo grava e aparece em Meus Registros.
