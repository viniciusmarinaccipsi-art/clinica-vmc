# PROMPT · Pacote 16.5d-3.2 — `logout()` zera os caches do Painel e do histórico de escalas (sigilo) (index-dev)

Leia antes: `CLAUDE.md` §3.5 (multi-tenant) e §5; `docs/arquitetura.md` (caches `pev*`); relatório `../VMC-offline/PACOTE_16_5d3_RELATORIO.md` §7, débito 8.28.

## Contexto

1. Bug encontrado no 16.5d-3 e deixado fora do escopo. `PEV_STATE` (l. ~13642) e `ESC_HIST_STATE` (l. ~16052) guardam `registros` do paciente com `carregadoEm` + `cacheTtlMs` = 30 s. `logout()` (l. ~9024) zera `P5_STATE`, `ESC_STATE`, `INI_STATE` e a sessão, **mas não zera esses dois**. Consumidores do cache: l. ~7681/7683 (Início, `iniLerQuieto`), ~11609 (automonitoramento), ~13679 (Painel), ~16088 (histórico de escalas).
2. Efeito: paciente B entrando na mesma aba em menos de 30 s depois do logout de A vê o Painel/histórico de A. Só exibição; nada gravado.
3. Este pacote faz **uma coisa só**: o logout do paciente (e o do profissional, se ele também usar esses caches — conferir por grep) descarta os dois caches. Não altera `Código.js`, planilha, nem outra tela. Só `index-dev.html`.

## Passos

1. Grep de todos os `*_STATE` com `carregadoEm`/`cacheTtlMs` (inventário no relatório) — cobrir todos os caches por paciente, não só os dois citados.
2. Em `logout()` (e em `logoutProfissional()` se aplicável), no mesmo bloco dos resets existentes: `registros = []`, `carregadoEm = 0`, `invalidado = true`, e destruir os gráficos `PEV_STATE.charts` (Chart.js `destroy()`) para não manter canvas com dados. Padrão: uma função `descartarCachesPaciente_()` chamada pelos dois logouts, se houver mais de um ponto.
3. Playwright (Chrome visível, 390×844): login VMC → abrir Painel e histórico de escalas (cache cheio) → logout → em < 30 s, login com **sigla inválida** até a mensagem do servidor (não há segundo paciente para o teste; a prova é o estado: após o logout, `PEV_STATE.registros.length === 0` e `ESC_HIST_STATE.registros.length === 0`, `charts` vazio) → login VMC de novo → Painel carrega do servidor (request `lerHistorico` observado). `pageerror` 0.
4. `node --check`; nenhuma classe/CSS tocada; gabarito clínico não se aplica (nada de conteúdo), mas rodar mesmo assim (md5 igual).
5. Marcador da linha 2 = "Pacote 16.5d-3.2"; commit "Pacote 16.5d-3.2 — logout zera os caches do Painel e do histórico de escalas (sigilo)"; `git push`; conferir o publicado com `?v=165d32`.
6. `docs/arquitetura.md`: uma linha na seção de caches ("todo cache por paciente é descartado no logout — `descartarCachesPaciente_()`"). Relatório `../VMC-offline/PACOTE_16_5d3_2_RELATORIO.md` (≤ 40 linhas). Fecha o débito 8.28.

## Checklist do usuário (aba anônima, `index-dev.html?v=165d32`, paciente VMC)
- [ ] Login → Painel de Evolução carrega → sair → entrar de novo em menos de 30 s → o Painel mostra "carregando" e busca do servidor (não aparece instantâneo).
- [ ] Mesmo teste com Escalas → histórico.
- [ ] Nada mais mudou de aparência.
