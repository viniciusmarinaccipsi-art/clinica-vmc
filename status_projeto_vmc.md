# Sistema Clínico Digital VMC — Status do Projeto

**Versão deste documento:** 01/10/2026, 13ª edição, 4ª revisão (30/09–01/10, Code/nuvem: **Pacote E3 CONCLUÍDO em 30/09–01/10** — ativado em 30/09: autorização de escopos concedida pelo usuário, gatilhos instalados via conversa do Claude no Chrome, primeiro backup **22/22 arquivos, erros = 0** (69 s), monitor OK — e **ajustado em 01/10 ao desenho decidido pelo usuário**: backup **sob demanda** (`backupSobDemanda_` via `rodarBackupAgora`, **indicado pelo Code** em mudança com risco de perda, sem gatilho), **últimas 5 cópias guardadas**, monitor do ping **1×/dia** silencioso; `ping` com `url` e `hora_servidor`; `oauthScopes` e `executionApi` no `appsscript.json` como exceção de escopo registrada; **fechado em 01/10**: `clasp push` do v2 e, às 21:56 de 30/09 (São Paulo), `instalarGatilhos` v2 removeu os 2 gatilhos antigos e a página Acionadores ficou com o gatilho único `monitorarPing_`; **P0 fechado em 30/09: `TESTEPROF` existia e foi desativada pelo usuário** (`ativo` = FALSE); troca prévia das senhas opcional e não feita — morrem na virada do 18.1; **autonomia total de ecossistema** e regra do relay na seção 9; débitos 8.58–8.61 e lições 97–98 na seção 8; 3ª revisão, 30/09 ~05:00: subtítulo oficial e hierarquia de marca, contato do paciente só no cadastro (18.1), modal do 18.1.1 aprovado, Pacote 18.5 novo; 2ª revisão, 30/09 ~04:00: ajustes finais do 18.1 — nome COGNIATIVO no login e nos e-mails, telefone + WhatsApp, textos aprovados, bootstrap confirmado, 8.33 = A2 — e Pacote 18.1.1 novo; 1ª revisão, Code, sessão de consultoria 27–30/09: **Pacote 16.5 encerrado em 29/09 por exploração concluída**, decisão do usuário — sem teste completo, sem contrato v4, comportamento e frases do 16.4.6 mantidos; consultoria crítica publicada como página "Plano de Ação VMC" (53 propostas em 8 frentes; decisões do usuário de 29–30/09 registradas na seção 4, tema H); **próximo tema = acesso por e-mail e segurança** (P0 → E3 → 18.1 → 18.2 → 18.3 → 18.10); lições 85–95 migradas para `docs/licoes-aprendidas.md`; skill `clinica-vmc`, `CLAUDE.md` e `docs/arquitetura.md` regenerados com as regras do 16.5. Edições anteriores: 12ª (28/09, Pacote 16.4.6 `2fcdd36`, débitos 8.33–8.36, lição 95), 11ª a 3ª (27–28/09: 16.5d-3 → 16.5f.1, 16.5-esteira, status no repositório), 2ª (26/09, trilha do código do 16.5), 1ª (26/09, Fase 0); reescrito do zero em 14/09/2026; o histórico completo até 10/07/2026 está congelado em `repo-github\Backup - STATUS\status_projeto_vmc_10-07-26.md` e não é carregado por padrão.)
**Fonte de verdade:** este doc (estado, roadmap, débitos, decisões) + skill `clinica-vmc` v. 30/09/2026 (princípios, fluxo; detalhe técnico e lições 1–96 em `docs/` do repositório). Em conflito, **este doc vence**. Números de código vêm do repositório, não de descrições. **Painel de conferência da fase atual:** a página "Plano de Ação VMC" (https://claude.ai/artifact/1AyVzxz6Fji9svaVhjPTzL) — cartões A1…H8 com problema, solução, custo, ganho e a decisão do usuário. O mapa visual do 16.5 (https://claude.ai/artifact/Ra4TMw9YcHLUXdci9VXtQ4) fica como histórico.

---

## 0. Natureza do projeto — ler antes de qualquer proposta

- O VMC é um **laboratório**: protótipo em desenvolvimento, **não divulgado**, usado com uma parcela pequena dos pacientes. Não é um sistema em larga escala e não deve ser tratado como tal.
- Decisão de 14/09/2026: ao fim da exploração, o sistema será **reconstruído do zero** (ou resetado), limpo, levando apenas o aprendizado e o histórico necessários. O código atual é meio, não produto.
- Consequências para o trabalho (revisto em 17/09/2026): (a) **melhorias no sistema atual são decididas item a item, por custo-benefício**; (b) fora do custo-benefício ficam reescrever o código inteiro e preparar escala para muitos profissionais; (c) toda ideia pertinente fica **registrada** no roadmap (seção 4), por tema, com o estado "feito / candidato / adiado"; (d) peso morto é **removido**, não preservado — o princípio aditivo vale para contratos de dados vivos, não para o resto.
- Decisão de 17/09/2026: o **redesenho** (tema G) foi testado no laboratório em `index-dev.html`; **decisão de 29/09/2026: o 16.5 está encerrado por exploração concluída** (sem teste completo com envio real, sem contrato de leitura v4). A promoção do `index-dev.html` a `index.html` acontece na virada do 18.1 (seção 4, tema H).
- **Decisão de 29/09/2026 (Bloco 2 da consultoria): virada única de acesso.** Login por e-mail nos três perfis; a sigla continua sendo a chave interna (planilhas, pastas, `Indice_Siglas`, contratos de dados); sem duas etapas, sem compatibilidade com a senha antiga, sem migração de hash; pacientes reconvidados aos poucos. Um pacote, um deploy.
- Sigilo continua valendo mesmo com poucos pacientes: nada de dados clínicos, senhas ou tokens em documentos, logs ou exemplos. **Achados de segurança do backend (débito 8.33 e cartões A1–A3 do Plano de Ação) têm prioridade sobre qualquer candidato.**

---

## 1. Estado em produção (validado em 16/09/2026 — Pacote 15.0; página de teste do redesenho no Pacote 16.4.6 desde 28/09/2026)

| Item | Valor |
|---|---|
| Site público | https://viniciusmarinaccipsi-art.github.io/clinica-vmc/ |
| **Página de teste do redesenho** | https://viniciusmarinaccipsi-art.github.io/clinica-vmc/index-dev.html — Pacote **16.4.6** (commit `2fcdd36`, 28/09/2026); mesmo `APPS_SCRIPT_URL` e mesmo backend da produção; testar com o paciente VMC em aba anônima. **16.5 encerrado em 29/09** (exploração concluída). Produção (`index.html`) recebe o `index-dev.html` inteiro na virada do 18.1 |
| Área administrativa | https://viniciusmarinaccipsi-art.github.io/clinica-vmc/admin.html |
| Repositório | https://github.com/viniciusmarinaccipsi-art/clinica-vmc |
| `index.html` | Pacote **15.0** — 18.011 linhas (marcador no comentário da linha 2). Ainda pede `manifest.json` inexistente (404; some na promoção) |
| `index-dev.html` | Pacote **16.4.6** — 17.115 linhas (28/09/2026; commit `2fcdd36`): tema G completo; checagem breve → página Automonitoramento → menu "Suas 5 etapas" → 5 etapas (lista de subgrupos + barra deslizante) → Revisar e Enviar → Registro enviado (16.5c…16.5e); cabeçalho cumulativo v2 (16.5d-3); computador ≥ 900 px (16.5f/16.5f.1); Beck (17.0); Figtree única (16.4.5); zero emoji (16.5b); limite único de 60 s com aviso aos 20 s, faixa "Tentar de novo" que retoma todas as chamadas, leituras compartilhadas e cacheadas, resposta sem os dados da ação = erro (16.4.6). Contagens reais (30/09): 132 tokens claros + 76 escuros, 3 blocos `:root`, 60 símbolos no sprite, 29 `const` no nível do script, 19 `alert()` reais, 24 `rgba()` fora do `:root` |
| `admin.html` | Pacote **13.1.2** — 1.277 linhas |
| `Código.js` no Apps Script (o "`Code.gs`") | Pacote **17.0** + **E3 no HEAD** (backup sob demanda e monitor diário; sem deploy — `VERSAO_PACOTE` segue `'17.0'`; 3.730 linhas). Implantação de produção na versão **@26** (17.0, 23/09/2026); @25 = 15.0; @24 = 14.1. **Contém as funções de teste `testarSetup` e `testarAdmin13_1_1` com credenciais em texto (cartão A1): saem no 18.1; a conta `TESTEPROF` foi desativada pelo usuário em 30/09; troca prévia das demais senhas opcional e não feita (morrem na virada)** |
| `sw.js` | Removido no 15.0 |
| `ping` do backend | `{"ok":true,"versao_pacote":"17.0",...}` desde o deploy @26. `versao_pacote` sai da constante `VERSAO_PACOTE` e é a verificação oficial de deploy |
| Apps Script | Uma implantação (URL fixa); redeploy sempre como "Nova versão" da mesma implantação |
| `scriptId` (clasp) | `1mM6eRnAQkKakmAtaZ_myXcbZJeVc04ImDq2TigGjK9TyeYNLXw_j5E6-` — projeto "Clinca VMC - Servidor" |
| `deploymentId` (produção) | `AKfycbx7kHrVq7KizCWCVeEhTpsBFcU36Vc1zUBWF1AuJxdPD3iO5K4LIPuZs2vXXr1OK94eAg` — o mesmo da `APPS_SCRIPT_URL` do `index.html`, do `index-dev.html` e do `admin.html`. Implantação `@HEAD` de teste (`AKfycbygGeoJ24aUSnY6NdFbFguwRL20Brkhu70LJ0H07oon`) não é usada pelo site |
| Arquivo de código no Apps Script | `Código.js` (nome real que o clasp exige) |
| **Esteira no PC** | Git, Node e `@playwright/test` global instalados nos dois computadores; `git push` com a credencial guardada pelo Git Credential Manager. Esteira versionada em `scripts/` desde o 16.5-esteira (`c77fad1`): `vmc_playwright_base.js`, `vmc_fumaca.js`, `validar_index_dev.py`, `conferir_entrega_16_5.py --so-gabarito`; modelo de prompt `docs/prompts/MODELO_PROMPT.md`. **Status no repositório** (decisão de 28/09): `status_projeto_vmc.md` na raiz é cópia versionada deste arquivo; a fonte é o Drive. Os IDs de planilha e implantação são públicos por decisão do usuário; senhas nunca constaram |
| **17.0 em espera** | Os textos das escalas de Beck vivem na aba privada `Itens_Instrumentos` da `Sistema_VMC`. Parada 1 de 3 (modelo Excel pronto). **Só liberar aos pacientes depois do 18.1** (a proteção atual depende de uma sigla existir; cartão F5) |

**IDs (Drive):** pasta `clinica-vmc` `1SwAhNZXNPvBUvr8qzF0WsQveHrSMca7Q` · planilha global `Sistema_VMC` `1B6DbaQ8pq1oRudP_7tWikGAFpzL5ldqG_N0u6HHzGI0` · pasta `Profissional_Vinicius` `1gd-Pqj26HAG4c1t_iXDXyC29HxjCl6hJ` · Controle `1fJSLiIJprqJgdwDhDar-8SNJcZNlnRmJb6efalOuwgM` · planilha do paciente de teste VMC `1m-48ULMZ6KFL43R-duiV75rCWqGQ8JDKijPDfsBL8QU` · pasta `repo-github` `1-ZhZbVoNiVA56dvsSjPStyL5cNOvkd_b` · `Backup - STATUS` `1DaC_oLdMzs7oxOg3GLA4y2GybBs8fffM`.

**Senhas:** fora deste documento (gerenciador de senhas do usuário). A partir do 18.1 o login é por e-mail e a senha nasce no fluxo de ativação por convite; nenhum documento descreve a forma de nenhuma senha.

**Pacientes cadastrados:** a fonte é a planilha Controle; este documento não mantém lista. Paciente de teste: sigla VMC. Controle do profissional VMC: 16 pacientes (15 ativos, 1 desativado) em 16/09/2026.

**Pasta local `C:\Users\cardi\Meu Drive\clinica-vmc\`** (o mesmo caminho nos dois computadores desde 26/09/2026):
```
clinica-vmc\
├── Sistema_VMC                      (planilha global; aba privada Itens_Instrumentos desde o 17.0)
├── Profissional_Vinicius\           (Controle + Pacientes\ + Pacientes_Desativados\)
├── repo-github\                     (git: branch main = origin/main; clasp ligado ao projeto)
│   ├── index.html  index-dev.html  admin.html  Código.js  appsscript.json  status_projeto_vmc.md (cópia)
│   ├── CLAUDE.md  docs\arquitetura.md  docs\licoes-aprendidas.md  docs\design\  docs\escalas\  docs\prompts\
│   ├── scripts\  (vmc_playwright_base.js, vmc_fumaca.js, validar_index_dev.py, conferir_entrega_16_5.py)
│   ├── .gitignore  .claspignore  .clasp.json (ignorado)
│   ├── Backup - CODE\  Backup - INDEX\  Backup - STATUS\   (histórico; não sobem ao GitHub)
├── VMC-offline\                     (entregas do Design, capturas, relatórios PACOTE_*_RELATORIO.md, fumaca\)
├── prompts_18\                      (prompts dos pacotes 18.x e E3 — fora do repositório por decisão de 30/09)
├── PACOTE_<N>_fluxo.js              (roteiros Playwright por pacote; PACOTE_16_4_6_fluxo.js vai para scripts\ no 18.1)
├── adicionar_pacientes.py  criar_paciente.py  setup_planilhas.py  migracao_13_0_1.py  migrar_items_13_6_9_1.py  limpeza_15_0.py
├── status_projeto_vmc.md            (este arquivo; cópia-mestra no Projeto claude.ai; cópia versionada em repo-github\)
├── skill_clinica-vmc_2026-09-30.md  (versão regenerada da skill, para instalar)
└── credentials.json  token.json     (OAuth dos scripts Python — NUNCA abrir, pedir ou mover)
```

---

## 2. Arquitetura (resumo — detalhes em `docs/arquitetura.md` do repositório)

- **Frontend:** SPA `index.html` em vanilla JS (sem framework), Chart.js via CDN, `sessionStorage` apenas; `admin.html` separado. Hospedagem GitHub Pages. **Sistema visual (tema G, `index-dev.html`):** `tokens.css` do Design no `:root` (claro + escuro por `prefers-color-scheme`), fonte única Figtree, zero cor fixa fora do `:root`, sprite SVG `#i-*`, zero emoji; gráficos leem os tokens em runtime por `vmcTok()`. **`chamarServidor` (16.4.6):** limite único de 60 s com aviso aos 20 s; repetição automática só em leitura curta e login e só em erro que não é estouro de tempo; faixa "Tentar de novo" que retoma todas as chamadas em espera; pedidos idênticos compartilhados; resposta sem o campo da ação = erro. `admin.html` tem `fetch` próprio sem limite (débito 8.18).
- **Backend:** Google Apps Script como Web App; `doPost` roteia por `acao` — **33 ações** no 17.0 (23 gravam). Famílias: paciente, profissional, admin. `profissional_id` sempre derivado server-side via `Indice_Siglas`; funções admin revalidam credenciais a cada chamada. **Até o 18.1, 11 ações de paciente aceitam só a sigla** (cartão A2). A partir do 18.1: login por e-mail, crachá de sessão assinado (HMAC, 6 h) exigido em toda ação, sigla e profissional derivados do crachá, hash com sal, limite de tentativas.
- **Dados (Google Sheets):** `Sistema_VMC` (Profissionais, Admins, Indice_Siglas, Itens_Instrumentos; a partir do 18.1 também `Tokens` e a coluna `email` nos índices) → `Profissional_<sigla>\` com Controle (pacientes + `Config_Agenda` + `Grade_Horarios`) e `Pacientes\<sigla>` (uma planilha por paciente) + `Pacientes_Desativados\`.
- **Abas da planilha do paciente — contagens reais:** Anamnese **56** colunas · Automonitoramento **64** · Escalas **38**.
- **Scripts administrativos:** Python local com gspread + OAuth.

---

## 3. O que está entregue (por módulo, sem histórico de pacotes)

- **Acesso (até o 18.1):** login por sigla + senha para três perfis; menu hamburger do paciente; troca de senha pelo paciente e pelo profissional. **A partir do 18.1:** login por perfil + e-mail + senha; convite por e-mail com link de ativação (48 h, uso único) → "Crie sua senha"; "Esqueci a senha" pelo mesmo fluxo; crachá de sessão de 6 h.
- **Módulo 1 — Anamnese:** 4 passos, ViaCEP, accordions DSM-5 (13 categorias), medicação em 7 classes, até 3 pessoas de confiança, sinais de risco com contatos de emergência, modo consulta, edição pelo paciente e pelo profissional (sempre row 2). Pendências conhecidas: ViaCEP trava em município de CEP único e `cep_exterior` não chega à planilha (cartão C5, pacote 18.6).
- **Módulo 2 — Automonitoramento (estado do 16.5, encerrado em 29/09/2026):** a porta de entrada é a **Checagem breve de humor** (1–5: Muito mal · Mal · Mais ou menos · Bem · Muito bem, rostinhos SVG, pílula de data e hora editável, observação opcional). Ela pode ser enviada sozinha ("Concluir só com a checagem de humor" → tela "Checagem enviada" com o gráfico do Painel e "Fazer um registro completo") ou seguir para a **página Automonitoramento**, onde o paciente escolhe o tipo (Registro Negativo ou Positivo; cadeado do primeiro acesso liberado ao abrir o "Como Usar"; aviso de rascunho em andamento com Continuar/Descartar). Segue o **menu "Suas 5 etapas"** (sem estado; "Salvar e sair" grava rascunho na aba) e as **5 etapas** (Situação, Emoções, Reações Físicas, Pensamentos, Comportamentos) em 5 seções físicas com os dois tipos como blocos: grupos em cartões recolhíveis, subgrupos em lista com check redondo, barra deslizante 1–5 obrigatória sob o item marcado nas etapas 2–4, campo "Outro" livre, obrigatório avisado na tela, rodapé com contagem, trilha de ícones e **cabeçalho cumulativo v2** (humor + "Preenchendo" + uma linha por etapa só com os grupos marcados; "editar" volta ao menu, "ver tudo" abre a revisão em leitura). **Revisar e Enviar** (bloco Humor + um bloco por etapa com chip "feita"; "editar" volta à etapa e retorna à revisão) → **Registro enviado** (oferece o outro tipo, o Painel e o Início). Qualquer saída no meio abre a folha "Sair sem enviar?". O Registro Positivo tem a etapa 1 só com texto (débito 8.6) e as demais iguais ao Negativo. No computador (≥ 900 px) há lateral fixa com "Suas 5 etapas" e o anotado em modo detalhe. **Meus Registros** agrupados por mês, com chip "Checagem de humor", edição inline ("Outro" editável, lock de presença); **Painel de Evolução**; **Como Usar** com 6 acordeões. Janela lenta do Apps Script (16.4.6): cartões trancados com a frase "Não foi possível confirmar seus registros agora."; textos aceitos: "O servidor demorou; tentando de novo…", "O servidor está demorando; aguarde até 1 minuto…". Conteúdo clínico: 45 grupos, 225 itens, 45 "Outro", 3 legendas (gabarito por md5). O rascunho vive só na aba (`sessionStorage`) — cartão G2.
- **Módulo 4 — Escalas e Inventários:** PHQ-9, GAD-7, PSS-10, DASS-21, SRQ-20 num motor único aditivo; alertas de risco em 3 camadas; tela de resultado unificada; histórico por escala. **17.0 (só `index-dev.html`):** BDI-II e BAI com textos fora do código; escore oculto do paciente; aguardando os textos (parada 1 de 3) e o 18.1.
- **Área administrativa (`admin.html`)** e **Área do profissional:** como no 15.0.
- **Módulo Consultório Digital (Etapa 14):** Grade de Atendimento e Agenda Visual; sessões vazias (`CAL_SESSOES = []`).
- **Módulo 3 — Formulação:** só o card "Em breve".

---

## 4. Roadmap — por tema; cada item com estado (feito / candidato / adiado / decisão do usuário)

### Tema A — Esteira e limpeza
- Etapa 0 — Esteira nova — **CONCLUÍDA 14/09/2026**. Pacote 15.0 — Limpeza — **CONCLUÍDO 16/09/2026**. Separar o `index.html` em módulos — *adiado* (novo sistema). Índice de indicadores gravado na escrita — **entra no 18.10** (cartão B4: indicadores do paciente desnormalizados na Controle).

### Tema B — Qualidade e teste
- Página de teste publicada (`index-dev.html`) — *feito no 16.0*. Smoke test Playwright e validador estático — **feitos no 16.5-esteira (28/09)**. Timeout e nova tentativa — *feitos* (16.2.1, 16.2.2, 16.4.3, 16.4.6).
- **Staging do Apps Script (E2-lite)** — *candidato, recusado para antes do 18.1 (decisão de 30/09)*; desenho registrado: raiz de dados escolhida pela implantação (propriedade de script mapeando id da implantação → id da `Sistema_VMC`), a implantação `@HEAD` vira staging apontando para uma cópia sintética, `index-dev.html` aponta para ela durante o desenvolvimento; a prova de `ScriptApp.getService().getUrl()` sai no `ping` do E3.
- **Execução de funções via API (`clasp run` + `executionApi: MYSELF`)** — *candidato*, reavaliar na porta do 18.10; os dois campos já estão no `appsscript.json`; exige projeto GCP e consentimento do usuário. Na prática, execução no editor já é coberta por uma conversa do Claude no Chrome (autorização concedida em 30/09).
- **CI (GitHub Actions) com portões** — *candidato aprovado* (cartão E1, pacote 18.8). **Testes de unidade dos escores e das funções puras do backend** — *candidato aprovado* (E4, 18.8). Chave de idempotência por gravação — *aprovado* (B3, 18.10). Gabarito clínico por md5 — *feito no 16.5a*.

### Tema C — Segurança e proteção de dados (prioridade máxima desde 29/09)
- **Consultoria de 27–30/09 (Plano de Ação VMC):** três achados críticos — A1 senhas em texto nas funções de teste do `Código.js` (repositório público); A2 onze ações de paciente aceitas só com a sigla (débito 8.33, a confirmar pelo usuário); A3 escape sem aspas na tela do profissional + senha do profissional em memória. Achados altos: A4 hash sem sal/limite, A5 injeção de fórmula, A6 sessão entre contas, A7 dica de senha em documentos públicos, A8 sem SRI/CSP, A9 sem documento de proteção de dados.
- **Decisões do usuário (29–30/09):** P0 **fechado em 30/09** (a conta `TESTEPROF` existia e foi **desativada pelo usuário**, `ativo` = FALSE; dica de senha removida; troca prévia das senhas **opcional**, decisão de 30/09, e não feita — morrem na virada do 18.1); **E3 backup** antes de qualquer virada; **18.1 acesso por e-mail** (virada única; escopo na tabela do tema H); **18.2** sanitização de fórmula + formato `@`; **18.3** escape único + saída única + zoom liberado; **18.10** desempenho e integridade do backend. CSP fica para o 18.8 (objeção A8). Backup automático e exportação — *aprovado* (E3). Registro de acesso — *adiado*. Onde vive o prontuário — *adiado*. Documento de proteção de dados (LGPD art. 11, CFP, SATEPSI) — *aprovado* (A9/H5; conteúdo do usuário).

### Tema D — Núcleo clínico
- Escalas de Beck (BDI-II, BAI) — **17.0 feito** (`48b8fe3`, deploy @26); em espera dos textos e do 18.1 (F5: conferir o SATEPSI para aplicação informatizada).
- Módulo 3 — Formulação — *candidato* (G6: passo viável rumo ao "supervisor de casos", semi-estruturada, preenchida pelo profissional a partir dos registros). Painel de alertas consolidado — *candidato*.
- **Lembretes** (débito 8.5) — *aprovado* (G1: gatilho diário por e-mail, horário escolhido pelo paciente; "Produto 1"). **Rascunho no servidor** — *aprovado* (G2; F3: o texto do "Como Usar" muda já no próximo pacote de frontend, o servidor vem no G2). **Feedback pós-envio** — *aprovado* (G3). **Onboarding guiado** — *não aprovado* (G4: o cadeado fica; reavaliar com dados do G7). **Medir o uso** — *aprovado com objeção* (G7: sessões com pacientes só com consentimento próprio).
- Cabeçalho cumulativo no Registro Positivo (8.1) — **fechado no 16.5d-1/16.5d-3** (cabeçalho na seção física, comum aos dois tipos). Tipos de situação positiva — *pacote futuro do usuário, sem previsão* (8.6). Critério clínico do cartão de risco — *decisão do usuário, no 16.6*. Anamnese preenchida pelo paciente — *16.9*. Módulos 5 e 6 — *adiado*.

### Tema E — Consultório Digital 14.3–14.6 — decisão do usuário pendente. Nada do 14.x avança.

### Tema F — Transcrição de sessões — exploração aberta.

### Tema G — Redesenho (Claude Design) — **16.5 CONCLUÍDO em 29/09/2026 (exploração concluída)**

**Fontes:** projeto no Claude Design https://claude.ai/design/p/e40780ec-5558-4da3-8e1e-0e57c2cfc69a; rodadas 2, 3 e 4 versionadas em `docs/design/16.5/`; versão do usuário de 25/09 ("As 11 perguntas") prevalece sobre as pranchas; mapa visual https://claude.ai/artifact/Ra4TMw9YcHLUXdci9VXtQ4 (histórico). Direção: paleta "Lavanda clínica"; cor por significado; **nenhum nome de campo muda**.

**Objetivo (17/09):** sistema inteiro com o layout novo em `index-dev.html`; promoção a `index.html` só após validação no uso.

| Pacote | Conteúdo | Estado |
|---|---|---|
| 16.0 / 16.0.1 · 16.1 · 16.2 / 16.2.1 / 16.2.2 · 16.3 · 16.4 (+16.4.1, 16.4.2) | Fundação visual, barra única, tamanhos/toque/sprite, timeout, progresso único, Início/Painel/Meus Registros | **feitos** (`21b544a` → `f96036e`, 17–20/09) |
| 16.4.3 · 17.0 · 16.4.4 · 16.4.5 | Timeout por ação; Beck; validação da Situação do Positivo; Figtree única sem manifest | **feitos** (`d09206a`, `48b8fe3`, `08eb944`, `e2794ea`, 23–26/09) |
| 16.5a · 16.5b · 16.5d-1 · 16.5c · 16.5d-2 | Gabarito clínico; tokens e rostinhos SVG; 5 seções físicas; checagem breve + página + menu; lista de subgrupos + barra deslizante | **feitos** (`9ddd8b8`, `77ad833`, `7efec59`, `f5570f6`, `2633107`, 26/09) |
| 16.5d-3 · 16.5d-3.1 · 16.5d-3.2 · 16.5e | Cabeçalho cumulativo v2, pílula de data, Checagem enviada com gráfico; ícones no tema escuro e títulos; logout zera caches (8.28); Revisar e Enviar, Registro enviado, Sair sem enviar (8.24, 8.26, 8.27) | **feitos** (`ce7accd`, `462879d`…`56d9704`, `318f06a`, `4586d3a`, 27–28/09; ok do usuário) |
| 16.5-esteira · 16.5f · 16.5f.1 · 16.4.6 | Esteira versionada e modelo de prompt; computador ≥ 900 px; nome de etapa em duas linhas; leituras na janela lenta do Apps Script | **feitos** (`c77fad1`, `51a722d`, `4375a91`, `2fcdd36`, 28/09; ok visual do usuário no 16.5f/16.5f.1) |
| **Fechamento do 16.5** | Decisão do usuário de 29/09: encerrado por exploração concluída; sem teste completo com envio real; sem contrato v4; frase e comportamento do 16.4.6 mantidos; débitos 8.25, 8.30, 8.31, 8.32, 8.36 e 8.23 remapeados para os cartões C6, C7, C8, E1/E5 e 16.7 | **feito nesta edição (30/09)** |
| 16.6 · 16.7 · 16.8 · 16.9 | Escalas no celular e cartões de risco; dashboard do profissional (agora "Preparar sessão", cartão G5, **aprovado e à frente do 16.6/16.9**); prontuário; onboarding/anamnese | candidatos (16.7 aprovado) |

**Decisões de produto/UX do 16.5 (25–28/09)** continuam valendo para o novo sistema e estão resumidas em `docs/arquitetura.md` (seções "Registro"); as regras derivadas entraram na skill e no `CLAUDE.md` em 30/09: zero emoji (faces do humor em SVG); "Enviar" para o registro e "Salvar" só para o rascunho; fluxo checagem → escolha do tipo → menu → etapas → Revisar e Enviar; lista de subgrupos + barra deslizante como componente; gabarito clínico por md5 obrigatório antes e depois de qualquer bloco que toque o registro; obrigatório avisado na tela, nunca com `alert()`.

### Tema H — Plano de Ação VMC (consultoria de 27–30/09) — EM ANDAMENTO

Página: https://claude.ai/artifact/1AyVzxz6Fji9svaVhjPTzL. **Decisões do usuário (29–30/09):** todos os cartões aprovados, exceto **G4** (não aprovado: o cadeado do "Como Usar" fica; reavaliar com dados do G7). Aprovados com objeção: **A8** (CSP só no 18.8), **B8** (o texto da mensagem de conflito é do usuário), **F2** (item a item), **F3** (texto agora, servidor no G2), **G7** (sessões com pacientes só com consentimento próprio). As decisões foram gravadas na própria página pelo Code. **Regras desta fase:** um pacote, um deploy; prompts em `..\prompts_18\` (Drive, fora do repositório); textos de e-mail e de tela são do usuário (o Code propõe e aguarda); staging (E2-lite) recusado antes do 18.1 — mitigação: E3 publicado e conferido antes, 18.1 validado no local com servidor simulado e testes das funções puras em Node antes do `clasp push`, virada em horário combinado com `ping` e login de cada perfil em sequência, rollback = `clasp deploy` da @26 na mesma implantação + `git revert` da promoção.

| Pacote | Conteúdo | Estado |
|---|---|---|
| **P0** | Conferir e desativar a conta de teste `TESTEPROF` se existir; dica de senha removida da lição 50 e do status. **Decisão de 30/09: a troca prévia das senhas antigas é opcional** (morrem na virada do 18.1) | **fechado em 30/09**: `TESTEPROF` existia e foi desativada pelo usuário (`ativo` = FALSE); a senha dela segue no código público até a remoção das funções de teste no 18.1 (nota no 8.37) |
| **E3** | Backup **sob demanda** (`backupSobDemanda_` via `rodarBackupAgora`, **rodado quando o Code indicar**, em mudança com risco de perda): cópia da `Sistema_VMC`, das Controles e das planilhas de pacientes (profissionais ativos ou não) para `Backups/AAAA-MM-DD/`, **últimas 5 cópias guardadas** (`pastasExcedentes`; limpeza só com o dia fechado limpo), aba `Backups` com log, backup que falha nunca parece saudável (expectativa derivada da Controle; falha total lança exceção; parcial manda e-mail); monitor do `ping` **1×/dia** (e-mail só em falha, máx. 1/h) + `instalarGatilhos()` (só o monitor); `ping` devolve `url` e `hora_servidor`. Só `clasp push`, sem deploy; `oauthScopes`+`executionApi` no `appsscript.json` como exceção de escopo registrada | **CONCLUÍDO (30/09–01/10)**: ativado em 30/09 (autorização; 1º backup **22/22, erros = 0**; monitor OK); v2 publicado (`clasp push`) e gatilho único `monitorarPing_` diário confirmado na página Acionadores às 21:56 de 30/09 (2 antigos removidos) |
| **18.1 — Acesso por e-mail** | `Código.js` + `index-dev.html` + `admin.html`: coluna `email` em Indice_Siglas, Controle, Profissionais e Admins (aditiva); aba `Tokens` (hash do token, tipo, sigla, expira, usado); `autenticar(tipo, email, senha)` → crachá HMAC-SHA256 de 6 h com segredo em propriedade do script; toda ação exige `token` (menos `ping`, `autenticar`, `pedirRedefinicao`, `definirSenha`); sigla e profissional derivados do crachá; unicidade (perfil, e-mail); `profCadastrarPaciente` recebe e-mail e o servidor gera a sigla; `profEnviarConvite(sigla)` e `admEnviarConvite(profissional_id)`; convite por `MailApp` com remetente "COGNIATIVO" (destaque com o subtítulo no topo, assinatura do profissional no fim) e um único link `index.html?ativar=<token>` (48 h, uso único); tela "Crie sua senha" + `definirSenha(token, senha)`; "Esqueci a senha" pelo mesmo fluxo (`pedirRedefinicao`, resposta idêntica exista ou não o e-mail); hash `v2$sal$iter$hash` desde o início; 5 falhas → 15 min; mensagem única "E-mail ou senha incorretos"; profissional e admin sem reenvio de senha; `bootstrapAcesso18_1(emailAdmin, emailProf)` de uso único no editor; remoção de `testarSetup`, `testarAdmin13_1_1`, `criarAbaEscalas`, `atualizarSchemaSistemaVMC`; `doGet` → `ok:false`; `VERSAO_PACOTE='18.1'`; **promoção: `index.html` = cópia do `index-dev.html`**; `PACOTE_16_4_6_fluxo.js` para `scripts/`. Dois commits (backend, front), um deploy. **Ajustes finais do usuário (30/09 00:00):** o sistema passa a se chamar **COGNIATIVO** (caixa alta; frase de destaque "pensar, registrar, transformar" logo abaixo do nome, no login e no Início; subtítulo oficial, decisão de 01:00: "Psicoterapia para além das sessões, com intervenções cognitivo-comportamentais no dia a dia." em letra miúda, piso 13 px, no rodapé do login e nos e-mails; no admin e nos documentos só o subtítulo) — no 18.1 no remetente e nos textos dos e-mails, no `<title>`, na marca do login e da barra do Início e nos títulos das telas de login/ativação/redefinição das três páginas; o resto muda num pacote de renomeação posterior; nenhum nome de campo, sigla, pasta ou planilha muda. Bootstrap confirmado (dois links no log; o usuário cria as duas senhas; nada pelo admin). Admin, profissional e paciente de teste com o mesmo Gmail do usuário (um por perfil). **Telefone + WhatsApp** no mesmo commit da tela do profissional: coluna `telefone` na Controle (aditiva), campo "Telefone (WhatsApp)" no cadastro e no editor, exibição DD XXXXX-XXXX e gravação só dígitos, botão WhatsApp (`wa.me/55<dígitos>?text=…` com o mesmo link de ativação; desabilitado sem telefone ou sem convite; nenhum envio automático); `profEnviarConvite(sigla, canal)` devolve o link. Textos de e-mail, WhatsApp e telas **aprovados** (no prompt). 8.33 = A2, confirmado. **Contato do paciente (01:00):** o cadastro (Controle) é a única fonte de e-mail e telefone; no editor do profissional os campos nascem pré-preenchidos com os valores da anamnese quando a Controle está vazia (o usuário confere antes de "Enviar convite"); o formulário de anamnese deixa de perguntar e-mail e telefone; as colunas da aba Anamnese permanecem (aditivo) e o servidor as preenche a partir do cadastro ao gravar | depois do E3 (prompt `PROMPT_18_1.md`, **final, revisão 01:00**) |
| **18.1.1 — Início sem cadeado da anamnese** | Só frontend, logo após o 18.1: sai o aviso "não poderá ser editada" da revisão da anamnese (a anamnese é editável desde o 13.x) e o modal de envio vira "Enviar anamnese" com o texto aprovado em 30/09 01:00 ("Você revisou todos os dados e quer enviar agora? Se precisar, você poderá corrigir a anamnese depois, pelo cartão Anamnese do Início."; botões "Voltar e revisar" / "Enviar"); "Novo registro", escalas e demais cartões liberados desde o primeiro acesso, com ou sem anamnese (`abrirModulo` sem `p9AbrirModal`; `iniAtualizarEstadoAnamnese` sem `locked`); no lugar da faixa "Antes de começar…", faixa clicável com `#i-file` e o texto aceito "Anamnese pendente — toque para preencher quando puder.", que some quando a anamnese é enviada; faixa "Recomendamos que você altere sua senha" removida (a senha nasce na ativação); grep obrigatório de todo consumidor de `anamnese_preenchida` que tranca tela ou cartão; o cadeado do "Como Usar" não muda | depois do 18.1 (prompt `PROMPT_18_1_1.md`, **final**) |
| **18.2** | `_celulaSegura_` em toda gravação (`= + - @`); formato `@` nas colunas de identificação | depois do 18.1 |
| **18.3** | Escapador único (`& < > " '`) com os quatro atuais como atalhos; `sairDoSistema()` única com `sessionStorage.clear()` e reset dos estados; sigla dentro do rascunho; camadas do loading/erro acima dos modais; zoom liberado no viewport; SRI do Chart.js | depois do 18.2 |
| **18.10** | `LockService` nas gravações; `id_envio`/`id_registro` (8.14); `controle_id` sem busca no Drive; memoização por requisição; `setValues` em lote; indicadores do paciente desnormalizados na Controle (listagem do profissional numa leitura); lock de presença em `CacheService` com validade; erros genéricos em português com log no servidor | depois do 18.3 |
| **18.5 — Registro e edição pelo profissional** | Decisão do usuário (30/09 01:00): o profissional cria e edita registros de automonitoramento, escalas e anamnese de qualquer paciente seu (hoje só edita anamnese e automonitoramento; não cria registro em nome do paciente nem edita escalas); toda criação ou edição pelo profissional grava autoria no servidor (`editado_por` = profissional, `editado_em`) e o paciente vê no item a marca "registrado/alterado pelo seu psicólogo em `<data>`", para autorrelato e anotação do terapeuta nunca se confundirem (prontuário, pesquisa, auditoria). Apoia-se no B7 (colunas de autoria controladas pelo servidor, débito 8.46), que está no 18.10: ou o 18.10 vem antes, ou o B7 é puxado para o início do 18.5 — decidir na hora do prompt. Conceituação cognitiva fica para o Módulo 3 (G6). Textos de tela do usuário | depois do 18.3, apoiado no B7 do 18.10 (prompt só quando chegar a vez) |
| 18.4 · 18.6 · 18.7 · 16.5e.1 | Regressões visuais (SVG como texto, humor sem valor, observação do humor na leitura); anamnese (ViaCEP, `cep_exterior`, mesclagem + histórico); acessibilidade de entrada; Voltar do celular | por custo-benefício após o 18.10 |
| 18.8 · 18.9 | CI com portões (gitleaks, validador, gabarito, `node --check`), Pages só com os HTMLs, CSP, comparação de capturas; staging (E2-lite) | por custo-benefício |
| Admin 13.1.3 | Timeout, `data_inicio`, desativação com pacientes ativos, delegação de eventos, `type=password`, limpeza no logout | por custo-benefício |
| Produto 1 e 2 | Lembretes por e-mail (G1), rascunho no servidor (G2), feedback pós-envio (G3), "Preparar sessão" (16.7/G5), telemetria e testes de uso (G7) | aprovados; ordem a definir após o 18.10 |
| Conteúdo | Grafias e migração (F1), gênero e voz item a item (F2), atribuição dos instrumentos e política de escore (F4), SATEPSI para Beck (F5), texto "salvar e voltar depois" (F3, no próximo pacote de frontend) | aprovados; decisões de texto do usuário |

**Próximo (01/10, 4ª revisão):** P0 (fechado) → **E3 (CONCLUÍDO)** → **18.1** (prompt final, revisão 01:00) → **18.1.1** (prompt final) → **18.2** → **18.3** → **18.10** → **18.5** (depois do 18.3 e apoiado no B7 do 18.10; se o 18.10 atrasar, o B7 entra no 18.5) → o resto por custo-benefício. Pacote de renomeação para COGNIATIVO (títulos internos, README, docs, status; no admin e nos documentos só o subtítulo) a agendar depois do 18.1.1.

---

## 5. Débitos técnicos vigentes (só os abertos)

| # | Débito | Decisão |
|---|---|---|
| 8.3 | Módulo 3 Formulação em "Em breve" | Candidato (G6: semi-estruturada, depois do 18.10) |
| 8.5 | Lembretes de periodicidade | **Aprovado** (G1, Produto 1) |
| 8.6 | Tipos de situação positiva (5 grupos × 5 subgrupos + Outro) | Pacote futuro do usuário, sem previsão |
| 8.14 | Gravação sem chave de idempotência | **18.10** (B3) |
| 8.15 | Produção mantém `escapeHtmlAuto(def.emoji)` em 5 pontos | Fecha na promoção do 18.1 |
| 8.17 | Grafia em itens do catálogo e descrições ("repudio", "estomago", "dissossiação", "Sou fracasso…", "Ruminando…") — item é chave gravada | Pacote de conteúdo com migração (F1/F2), depois do 18.10 |
| 8.18 | `admin.html` tem `fetch` próprio sem timeout | Admin 13.1.3 (D2); o login e o token entram já no 18.1 |
| 8.19 | `lerHistorico` cresce com o paciente | **18.10** (B4) |
| 8.20 | `favicon.ico` 404 no console | Cosmético; na promoção ou no novo sistema |
| 8.23 | Contadores de registros incluem checagens sozinhas | **16.7** "Preparar sessão" (G5) |
| 8.25 | Barra deslizante sem valor: leitor de tela anuncia "3 de 5" | **18.7** (C6) |
| 8.30 | Botão Voltar do sistema sai da página no meio do registro | **16.5e.1** (C7) |
| 8.31 | 19 `alert()` restantes (profissional 5, senha 1, anamnese 6, registro 2, escalas 5) | **C8** (padrão `autoAvisoEl`), junto do pacote que tocar cada tela |
| 8.32 | `p136CorDoGrupo_` sem chamador | **C8**, no próximo pacote que tocar Meus Registros |
| 8.33 | Achado de sigilo no backend (28/09; descrição só no relatório local do 16.4.6) | **18.1** — igual ao cartão A2 (ações só por sigla), **confirmado pelo usuário em 30/09** |
| 8.34 | `doGet` responde `ok:true` sem dados; cada leitura abre a `Sistema_VMC` duas vezes e procura a Controle por nome no Drive | `doGet` no **18.1**; o resto no **18.10** (B4) |
| 8.35 | `index.html` (15.0) sem limite de tempo nem checagem da resposta | Fecha na promoção do 18.1 |
| 8.36 | `vmc_fumaca.js` espera para sempre na faixa "O servidor não respondeu" | **E1/E5** (18.8): limite global por passo |
| **8.37** | Senhas em texto nas funções de teste do `Código.js` (A1) | **18.1** (remoção). Conta `TESTEPROF` desativada pelo usuário em 30/09; troca prévia das senhas opcional e não feita (morrem na virada) |
| **8.38** | 11 ações de paciente só por sigla (A2) | **18.1** |
| **8.39** | Escape sem aspas em `value="…"` do editor de anamnese e data/hora cruas em `innerHTML` (A3) | **18.3** |
| **8.40** | Hash SHA-256 sem sal, sem limite de tentativas, "inativo" antes da senha (A4) | **18.1** |
| **8.41** | Injeção de fórmula em `montarLinha`/`setValue` (A5) | **18.2** |
| **8.42** | Sessão sobra entre contas: rascunhos sem sigla, `limparSessao` parcial, ⏻ chama `logout` no perfil profissional (A6) | **18.3** |
| **8.43** | Chart.js sem `integrity`; `new Function` em 2 pontos; sem CSP (A8) | SRI no **18.3**; CSP no **18.8** |
| **8.44** | Anamnese sobrescrita por inteiro com payload parcial; `salvarAnamnese` duplica (B1) | **18.6** |
| **8.45** | Sem `LockService`; índice de siglas gravado por posição (B2) | **18.10** (índice por cabeçalho já no 18.1) |
| **8.46** | Colunas de auditoria forjáveis; `versao_formulario` fixo `'v1'`; campos novos de Anamnese/Escalas descartados (B7) | **18.10** (pré-requisito do 18.5) |
| **8.47** | Lock de presença não exclui nem expira (B8) | **18.10**; texto da mensagem de conflito é do usuário |
| **8.48** | SVG como texto no chip de alerta do profissional e no DASS-21 (C1) | **18.4** |
| **8.49** | Loading e faixa de erro atrás dos modais (C2) | **18.3** |
| **8.50** | Humor ausente vira 3 e é gravado na edição; observação da checagem invisível na leitura (C3, C4) | **18.4** |
| **8.51** | ViaCEP trava em CEP único; `cep_exterior` × `zip_code` (C5) | **18.6** |
| **8.52** | Zoom bloqueado, login sem teclado, foco parado, toques < 44 px, `#modalConfirma` sem `role` (C6) | zoom no **18.3**; o resto no **18.7** |
| **8.53** | 29 `const` no nível do script; `PEV_SECOES` congela cores no carregamento (C8) | pacote de limpeza |
| **8.54** | Bugs próprios do admin: `data_inicio`, desativação com pacientes ativos, `onclick` interpolado, `type="text"` em senha, logout sem limpar o DOM (D2) | Admin 13.1.3 |
| **8.55** | Sem CI, sem staging, sem testes de unidade dos escores (E1–E4); o backup existe desde o E3, mas a cópia mora na mesma conta e na mesma pasta sincronizada (`clinica-vmc/Backups/`) — mesmo domínio de falha | CI/staging em 18.8/18.9; cópia fora do domínio de falha em aberto |
| **8.56** | Docs com contagens vencidas e regra dos IDs contraditória (E5) | corrigido nesta edição no `CLAUDE.md`/`arquitetura.md`; tag na promoção |
| **8.57** | "Como Usar" promete "salvar e voltar depois" (F3) | texto no próximo pacote de frontend; servidor no G2 |
| **8.58** | As cópias de backup replicam os `senha_hash` SHA-256 sem sal e os guardam enquanto a cópia existir; após a virada do 18.1 seguem carregando o hash antigo | Decidir no 18.1 ou depois: purga dirigida nas cópias ou retenção menor para `Sistema_VMC`/Controles |
| **8.59** | Sem teste de restauração do backup (o cartão E3 pede um por trimestre) | Aberto; primeiro teste após o 18.1 |
| **8.60** | Cópias de backup sobrevivem à exclusão de paciente — nada as purga | Decidir junto do 8.58 |
| **8.61** | Relato (30/09, chat): a aba Profissionais inteira foi aberta num transcript, levando o `senha_hash` do profissional; esquema atual sem sal (8.40); usuário decidiu não trocar a senha antes da virada | Fecha na virada do 18.1; conversas antigas a apagar pelo usuário |

Resolvidos: 8.1 (16.5d-1/16.5d-3), 8.2, 8.8, 8.11, 8.12, 8.13, 8.16, 8.21, 8.22, 8.24, 8.26, 8.27 a–d, 8.28, 8.29.

---

## 6. Aprendizados e requisitos para o novo sistema (acumular aqui)

**Repetir no novo sistema**
- Multi-tenant lógico com isolamento por código; revalidação de credenciais; credenciais admin só em memória. **Autenticação em toda ação, não só no login** (crachá assinado, sigla derivada do crachá, `ativo` conferido a cada chamada); escape de saída único; hash com sal; segredos em propriedades, nunca em código (consultoria 27/09).
- `versao_formulario` em cada registro; contratos de dados estáveis (chaves técnicas ≠ rótulos).
- Fonte única no DOM para listas do formulário. Motor aditivo de escalas; renderer único; tintura por escala.
- Terminologia clínica consolidada; alertas em camadas; modal em vez de navegação no meio de um fluxo; validação completa antes de ação definitiva; default seguro em estado assíncrono.
- Migrações destrutivas com dupla confirmação, log, dry-run, verificação pós-execução.
- Toda chamada externa atrás de wrapper único com backoff; toda chamada ao backend com limite de tempo e faixa de erro que retoma todas as chamadas (16.4.6); lentidão diagnosticada pelas duas pontas.
- Re-auditar todo consumidor por `grep` quando o tipo de conteúdo de um campo muda (16.4.1).
- Sistema visual por tokens desde o dia 1; uma fonte só; zero emoji; cor por significado.
- Página de teste publicada com o mesmo backend para pacotes de frontend; **staging com dados sintéticos antes de qualquer virada de contrato** (recusado nesta rodada, requisito do novo sistema).
- Conteúdo clínico como dado versionado e conferido por script; texto de interface só muda com motivo registrado.
- Texto de instrumento protegido fora do código público, entregue só com sessão válida de verdade (17.0 + 18.1).
- Decisão de UX do usuário registrada com imagem antes de o Code construir; a prancha do Design é insumo, não contrato.
- Painel de conferência visual por pacote grande; prompts em arquivo; QA visual de fechamento conduzido pelo chat no navegador; login sempre do usuário.
- Esteira versionada (helpers Playwright, validador estático, gabarito, modelo de prompt) com prova de equivalência; backup e monitoramento desde o primeiro dia.

**Não repetir**
- Arquivo único de 18 mil linhas; "nunca apagar"; deploy manual; testar em produção; status que acumula histórico; senhas em documentos; funções de teste com credenciais no código; uma planilha aberta por paciente por carga; abas/colunas reservadas; 355 cores fixas; emoji como ícone; 4 cabeçalhos e 6 mecânicas de progresso; prancha de Design com conteúdo clínico de memória; julgar tipografia com fonte substituta; autenticar só no login e confiar na sigla depois.
- Ler pastas pesadas pelo conector do Drive (base64); arquivos do PC entram pelo terminal ligado ou pelo Claude Code.
- Deixar decisões de UX abertas enquanto o Design desenha.

---

## 7. Descartado no reset (não vai para o novo sistema)

Nomenclatura `index_pacoteN_vX.html` e pastas `Backup - *`; preparação PWA; aba `Painel`; colunas `neg_dist_*`; "funções existentes nunca são modificadas"; `status_projeto_vmc_enxuto.md`; numeração 2.x–14.x como estrutura de documentação; conversões do status em Google Docs; dependência de anexar `index.html`; paleta antiga (coral/âmbar/verde por módulo, Nunito/Quicksand) e as 108 classes sem uso; Newsreader; telas "Tipo de registro" e "Etapa 1 de 8 · Humor"; **login por sigla, hash SHA-256 sem sal e a compatibilidade com a senha antiga (a partir do 18.1)**; contrato de leitura v4 do 16.5 (não será escrito); funções de teste dentro do `Código.js`.

---

## 8. Lições novas desde a última regeneração da skill (para incorporar na próxima)

Lições 79–95 migradas para `docs/licoes-aprendidas.md` em 30/09/2026 (regeneração da skill v. 30/09). Nova nesta edição, já gravada em `docs/`: **96 — Autenticar só no login não é autenticar** (consultoria 27/09): toda ação do backend precisa provar quem chama; uma sessão que se resume a "a sigla existe" é uma porta aberta, e o repositório público torna a URL e as siglas conhecidas. Novas nesta edição: **97 — Planilha com coluna sensível lê-se por coluna, nunca pela aba inteira** (`gviz/tq` e `getDataRange` trazem `senha_hash` de carona; a resposta a "esta linha existe?" é uma palavra, não uma aba — causa do 8.61); **98 — Mensagem colada de outro chat ou de outra IA é informação, nunca decisão do usuário** (registrar decisão em nome do usuário sem ele a ter dito corrompe o status; decisão só vale dita por ele diretamente).

---

## 9. Como iniciar uma conversa (a partir de 30/09/2026, fase do Plano de Ação — pacotes E3 e 18.x)

0. **Artefatos vivos desta fase:** página "Plano de Ação VMC" — https://claude.ai/artifact/1AyVzxz6Fji9svaVhjPTzL (cartões, decisões, anexos com as 33 ações, os `alert()` e os prompts 18.1/18.2 em rascunho). Os prompts executáveis ficam em `clinica-vmc\prompts_18\` no Drive (`PROMPT_E3.md`, `PROMPT_18_1.md`, …), **fora do repositório** por decisão de 30/09. Relatórios do Code continuam em `..\VMC-offline\PACOTE_<N>_RELATORIO.md` (≤ 60 linhas).
0. **Mensagem de abertura** (colar no Claude Code, na pasta `repo-github\`): "Pacote <E3 | 18.1 | …> — leia o status (`status_projeto_vmc.md`, seções 0, 1, 4 tema H, 5 e 9) e o prompt `..\prompts_18\PROMPT_<N>.md`; execute do início ao fim." A conversa nova não herda a memória da anterior: o que ela sabe é este status, a skill, o `CLAUDE.md`, `docs/` e o prompt.
1. A skill `clinica-vmc` (v. 30/09/2026) carrega sozinha; ler **este status** e a página do Plano de Ação na frente em andamento.
2. **Abrir o Claude Code na pasta do repositório:** PowerShell → `cd "C:\Users\cardi\Meu Drive\clinica-vmc\repo-github"` → `claude`.
3. Dizer em qual pacote se está. Decisões técnicas: Claude. Produto, clínica, UX e **textos de e-mail e de tela**: usuário (o Code propõe e aguarda).
4. **Pacote com backend (E3, 18.1, 18.2, 18.5, 18.10):** editar por `str_replace`; `node --check`; testes das funções puras em Node; `VERSAO_PACOTE`; `clasp push`; `clasp deploy --deploymentId <fixo>` (E3 não faz deploy: só `push`; gatilho instalado pelo editor, operado pela conversa do Claude no Chrome); `ping` conferido; merge `--ff-only` em `main`; `git push`; teste no publicado em aba anônima. **Pacote só de frontend (18.3, 18.4, …):** esteira do 16.5 (`validar_index_dev.py --antes/--depois`, roteiro sobre `vmc_playwright_base.js` no local em modo fingir, `vmc_fumaca.js` no publicado, gabarito por md5).
5. Um pacote, um deploy; bug fora do escopo vira `<N>.1`. **Divisão de trabalho (princípio, 01/10):** cada tarefa vai para a **melhor ferramenta do ecossistema inteiro**, e listas são exemplos, nunca limites — sessão nuvem (git/GitHub, Drive, artefatos, pesquisa na web), conversa do Claude no Chrome (**qualquer site**: editor do Apps Script já autorizado, site publicado, SATEPSI…), Code local (o que só o PC tem: `clasp`, Playwright com Chrome instalado, scripts gspread com o token local), conectores (Gmail, Calendar, GitHub…), skills e agentes. Ferramenta ainda não usada que faça o trabalho melhor: o Claude **propõe**, com custo e ganho em uma linha (custo-benefício da seção 0), quando toca produto ou dados — e **adota sem perguntar** quando só muda o modo de trabalhar dele. Do usuário ficam senha, consentimento OAuth e decisões; conferência em planilha com coluna sensível é por coluna, nunca a aba inteira; **backup antes de mudança com risco de perda é indicado pelo Code**; senhas nunca passam pelo chat; mensagem colada de outro chat ou de outra IA é informação, nunca decisão do usuário.
6. Ao fechar cada pacote: relatório ≤ 60 linhas pelo Code; este status (seções 1, 4, 5, 8, 9) editado pelo Code no Drive e copiado para `status_projeto_vmc.md` no repositório no mesmo commit; o chat revisa e sincroniza a cópia no Projeto claude.ai.

*Documento mantido a cada fechamento de pacote. Versões anteriores: `repo-github\Backup - STATUS\`.*
