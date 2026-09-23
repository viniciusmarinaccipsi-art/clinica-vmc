# Prompt — Pacote 17.0 (Escalas de Beck)

Colar no Claude Code, aberto na pasta do repositório:
PowerShell → cd "C:\Users\cardi\Meu Drive\clinica-vmc\repo-github" → claude

---

Pacote 17.0 — Escalas de Beck (BDI-II e BAI) respondidas pelo paciente. Especificação completa: docs/escalas/ESPEC_escalas_beck.md. Ler inteira antes de qualquer edição; ela vence qualquer suposição.

0. Pré-requisito: grep em index-dev.html por chamarServidor. Se ainda não houver timeout por ação (ações pesadas de leitura do profissional e todas as gravações com limite ≥ 60 s, sem repetição automática nas pesadas), fazer isso ANTES, como pacote próprio (próximo número 16.4.x livre no git log): medir no Playwright (aba visível) os tempos reais, commit, push, relatório. Só então seguir.

1. Conferir o mapa da seção 0.2 contra o código atual (grep; as linhas podem ter mudado). Reportar divergências antes de editar.

2. Backend (Código.js): ação lerItensInstrumento, constante da aba Itens_Instrumentos na Sistema_VMC, conferência de sessão, liberação (ativo=SIM) e hash, conforme seções 0 e 0.1. VERSAO_PACOTE='17.0'. Nenhuma mudança em HEADERS_ESCALAS, salvarEscala, montarLinha, lerEscalas nem listarPacientes.

3. Frontend só em index-dev.html, conforme 0.2: tokens e tinturas, cartões, definições em ESC_ESCALAS sem texto de item, opções por item e itens 16/18 com 7 opções, letra em observacoes, ESC_HIST_ORDEM, resultado do paciente conforme a seção 4 (opção a), histórico do paciente sem escore, visão do profissional completa. Escala fora do menu sem liberação ou com hash divergente.

4. Criar o modelo Excel vazio (todas as posições numeradas, seção 0.1 item 5) e o script Python de carga e liberação (dry-run padrão, confirmação digitada, log, backoff 429). O modelo preenchido vai para o .gitignore. NÃO digitar nenhum texto dos inventários: o modelo sai vazio.

5. Validação: lista padrão da skill + seção 5 da especificação (grep sem texto de item em arquivos versionados, faixas, alerta do item 9, 16/18, recusa sem sessão, escala oculta sem liberação, teste de fidelidade innerText = aba).

6. Deploy: clasp push, clasp deploy --deploymentId fixo, ping = 17.0, git push. PARAR e me avisar em três pontos: (a) quando o modelo Excel estiver pronto para eu preencher; (b) quando eu tiver rodado o script de carga, para você gerar o PDF de conferência (Playwright, 390 px, paciente VMC — o login eu faço); (c) quando eu aprovar o PDF, para eu rodar a liberação.

7. Relatório em PACOTE_17_0_RELATORIO.md na pasta clinica-vmc.
