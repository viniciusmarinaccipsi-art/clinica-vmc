/**
 * ============================================================
 * SISTEMA CLINICO DIGITAL VMC - Google Apps Script (Servidor)
 * ============================================================
 *
 * A versao em producao e a constante VERSAO_PACOTE (devolvida pelo ping).
 *
 * Acesso (Pacote 18.1): login por perfil + e-mail + senha; toda acao,
 * menos ping/autenticar/pedirRedefinicao/definirSenha, exige o cracha de
 * sessao (payload.token), do qual o servidor deriva sigla e profissional.
 *
 * Infraestrutura multi-tenant (13.0.2):
 *   - Uma planilha global "Sistema_VMC" governa tudo
 *   - Cada profissional tem seu proprio territorio (pasta + Controle
 *     + Pacientes) isolado dos demais
 *
 * Estrutura no Drive:
 *
 *   clinica-vmc/
 *     Sistema_VMC                          <- planilha global (3 abas)
 *     Profissional_Vinicius/               <- "territorio" do profissional
 *       Clinica VMC - Controle             <- pacientes deste profissional
 *       Pacientes/
 *         VMC                              <- planilha individual do paciente VMC
 *
 * As 3 abas da planilha global Sistema_VMC:
 *   - Profissionais: lista de psicologos cadastrados
 *   - Admins: lista de admins (apenas Vinicius por enquanto)
 *   - Indice_Siglas: mapa global "sigla -> tipo -> profissional dono"
 *
 * ISOLAMENTO DE DADOS (regra de seguranca critica):
 *   - O profissional_id dono de uma sigla e SEMPRE derivado server-side
 *     consultando o Indice_Siglas. NUNCA aceitamos profissional_id do
 *     payload do cliente.
 *   - Isso garante que profissional A nao consegue acessar dados do
 *     profissional B, mesmo se manipular a requisicao.
 */


// ============================================================
// CONFIGURACAO
// ============================================================

// ID da planilha global Sistema_VMC.
// Criada pelo script Python migracao_13_0_1.py.
// Pacote 17.0 — Escalas de Beck: acao lerItensInstrumento (23/09/2026)
// Pacote E3 — backup (sob demanda desde 30/09) e monitor do ping (só clasp push, sem deploy)
// Pacote 18.1 — acesso por e-mail, cracha de sessao, convite e redefinicao (01/10/2026)
// Pacote 18.1.2 — correcoes de seguranca do acesso: links, cracha, acoes publicas, ativo (02/10/2026)
// Pacote 18.10 — desempenho e integridade (18.10a: indicadores na Controle, controle_id, trava de gravacao,
// id_envio, autoria; 18.10b: rascunho no servidor) (03/10/2026)
// Pacote 18.5 — registro e edicao pelo profissional: edicao por campo com carimbo (autoria_campos), criacao pelo
// profissional (criado_por), escore de escala no servidor, leituras do paciente paginadas e por colunas (03/10/2026)
// Pacote 18.8.1 — assinatura dos convites: genero do profissional (escolhido por ele em "Meus dados"), pedido de
// alteracao de dados aprovado pelo admin, linhas de formacao fora dos e-mails, carimbo com o nome lido do cadastro
// na hora de mostrar (05/10/2026)
// Rodada DOCS_2026-10-07 — index-dev.html e o index oficial: SITE_URL aponta para ele; texto do aviso de backup
// com falha alinhado ao backup sob demanda (07/10/2026)
// Pacote 19.2.1 — Plano de lembretes: aba Lembretes na Controle, acoes profSalvarLembrete, profEncerrarLembrete,
// profLembrarAgora e lerMeusLembretes, gatilho enviarLembretes_ (e-mail; a cada 5 minutos desde o 19.2.3), blocos do Inicio na lista
// do profissional; ind_total_auto sem as checagens sozinhas (22/11/2026)
// Pacote 14.7 — Agenda: o paciente PEDE o agendamento (pacienteAgendarSessao grava um pedido `agendar`); a sessao so nasce quando o
// profissional aprova (profDecidirPedido); o horario pedido fica reservado ate a resposta; saiu o limite de agendamentos do 14.6.
// Pacote 14.4 — Agenda: confirmacao de presenca por link (acao publica confirmarSessaoPorLink, token assinado, so confirma),
// eventos da agenda (sino e Inicio; profMarcarEventosVistos), lembretes de sessao 48 h e 24 h antes, e-mail na hora (profAvisarSessao).
// Pacote 14.3 — Agenda completa: abas Sessoes, Series, Bloqueios e Pedidos_Agenda na Controle; acoes do profissional
// (profLerAgenda, profSalvarSessao com simular, profEditarSerie, profCancelarSessao, profMarcarSituacao, profSalvarBloqueio,
// profApagarBloqueio, profDecidirPedido) e do paciente (lerMinhasSessoes, lerHorariosLivres, pacienteAgendarSessao,
// pacienteConfirmarSessao, pacienteCancelarSessao, pacientePedirAgenda); avisos de sessao por e-mail, desligados por padrao.
// Pacote 14.8 — Agenda: cada profissional conecta a propria conta do Google (profAgendaConectar, profAgendaDesconectar,
// profAgendaOpcao; a volta do Google chega pelo doGet); a permissao fica no cofre do script; o Google so recebe as sessoes e os
// compromissos pessoais so fecham horarios com a opcao `agenda_ocupado` ligada (decisoes do usuario de 23/11/2026).
// Pacote 14.8.1 — Agenda: a volta da tela de permissao do Google deixa o doGet (o Apps Script nao abre a pagina quando o
// profissional permite com uma conta que nao e a primeira do navegador: `authuser=1`) e passa a chegar por uma pagina do
// site (conectar.html), que entrega `state` + `code` a acao publica concluirConexaoAgenda (23/11/2026).
// Pacote 19.2.2 — Lembretes: a sigla da escala e o texto do "Outro" passam a aparecer no e-mail e no WhatsApp
// (decisao do usuario de 22/11/2026; assunto, titulo e previa do e-mail nao mudam)
var VERSAO_PACOTE = '19.6';

var SISTEMA_VMC_ID = '1B6DbaQ8pq1oRudP_7tWikGAFpzL5ldqG_N0u6HHzGI0';

// Nomes das abas da planilha global Sistema_VMC
var ABA_PROFISSIONAIS  = 'Profissionais';
var ABA_ADMINS         = 'Admins';
var ABA_INDICE_SIGLAS  = 'Indice_Siglas';
// Pacote 17.0: textos dos inventarios respondidos pelo paciente (BDI-II, BAI).
// Os enunciados NAO ficam no codigo - o repositorio e o site sao publicos.
// Uma linha por texto; colunas: instrumento, tipo, item, opcao, texto, ativo.
var ABA_ITENS_INSTRUMENTOS = 'Itens_Instrumentos';
// Pacote 18.1: links de convite e redefinicao (so o SHA-256 do token fica aqui).
var ABA_TOKENS = 'Tokens';

// Nome da aba dentro de cada Controle de profissional.
// Mantemos o nome "Pacientes" da versao anterior por compatibilidade
// (a Controle nao foi recriada, apenas movida de pasta).
var ABA_PACIENTES = 'Pacientes';

// Nome do arquivo Controle dentro de cada pasta de profissional.
var NOME_CONTROLE = 'Clinica VMC - Controle';

// Nomes das abas na planilha individual de cada paciente
var ABA_ANAMNESE          = 'Anamnese';
var ABA_AUTOMONITORAMENTO = 'Automonitoramento';
var ABA_ESCALAS           = 'Escalas';

// Versao de cada formulario (18.10, debito 8.46): gravada pelo SERVIDOR em toda linha
// nova ou regravada; o que o cliente mandar em `versao_formulario` e ignorado. Mudou o
// formulario (campos, itens, sentido de uma resposta) -> sobe a constante dele.
var VERSAO_FORM_ANAMNESE = 'v1';
var VERSAO_FORM_AUTO     = 'v1';
var VERSAO_FORM_ESCALAS  = 'v1';

// Pacote 13.4: Headers das 3 abas da planilha individual do paciente (Painel removida no 15.0).
// Usados por cadastrarPaciente() ao criar planilha nova.
var HEADERS_ANAMNESE = [
  'timestamp', 'versao_formulario', 'nome_completo', 'data_nascimento',
  'rg', 'cpf', 'telefone', 'email', 'escolaridade', 'profissao',
  'estado_civil', 'reside_fora_brasil', 'pais', 'zip_code', 'estado',
  'cidade', 'cep', 'endereco_logradouro', 'endereco_numero',
  'endereco_complemento', 'endereco_bairro', 'endereco_exterior',
  'psicoterapia_anterior', 'tratamentos_anteriores',
  'procedimento_medico_12m', 'procedimento_medico_detalhes',
  'medicacao_nao_psico_continua', 'medicacao_nao_psico_detalhes',
  'medicacao_psico', 'medicacao_psico_atual', 'medicacao_psico_passado',
  'medicacao_psico_detalhes', 'transtornos_em_tratamento',
  'transtornos_tratamento_passado', 'transtornos_sem_tratamento',
  'transtornos_suspeitados', 'transtornos_outros_texto',
  'familiar_transtorno', 'familiar_transtorno_detalhes',
  'sinais_risco_marcados', 'complicacoes_clinicas',
  'complicacoes_outros_texto', 'familiar_complicacao',
  'familiar_complicacao_detalhes', 'pessoa_confianca_1_nome',
  'pessoa_confianca_1_relacao', 'pessoa_confianca_1_telefone',
  'pessoa_confianca_1_email', 'pessoa_confianca_2_nome',
  'pessoa_confianca_2_relacao', 'pessoa_confianca_2_telefone',
  'pessoa_confianca_2_email', 'pessoa_confianca_3_nome',
  'pessoa_confianca_3_relacao', 'pessoa_confianca_3_telefone',
  'pessoa_confianca_3_email',
  'id_envio', // 18.10 (8.14): identificador do envio, gerado pelo cliente
  'editado_por', 'editado_em', 'autoria_campos' // 18.5: ultimo editor da linha e carimbo por campo
];

var HEADERS_AUTOMONITORAMENTO = [
  'timestamp', 'versao_formulario', 'data_registro', 'hora_registro',
  'humor_nivel', 'humor_observacoes', 'neg_preenchido', 'pos_preenchido',
  'neg_sit_o_que', 'neg_sit_tipo_interpessoais', 'neg_sit_tipo_desempenho',
  'neg_sit_tipo_solidao', 'neg_sit_tipo_perda', 'neg_sit_tipo_internas',
  'neg_emo_tristeza', 'neg_emo_ansiedade', 'neg_emo_raiva',
  'neg_emo_culpa', 'neg_emo_ciume', 'neg_fis_ativacao',
  'neg_fis_desativacao', 'neg_fis_tensao', 'neg_fis_digestivas',
  'neg_fis_sono', 'neg_pens_o_que', 'neg_pens_sobre_mim',
  'neg_pens_sobre_futuro', 'neg_pens_sobre_outros', 'neg_pens_cobranca',
  'neg_pens_culpa',
  'neg_comp_o_que', 'neg_comp_evitacao', 'neg_comp_isolamento',
  'neg_comp_reatividade', 'neg_comp_entorpecimento', 'neg_comp_controle',
  'pos_sit_o_que', 'pos_emo_felicidade', 'pos_emo_orgulho',
  'pos_emo_conexao', 'pos_emo_calma', 'pos_emo_esperanca',
  'pos_fis_calma', 'pos_fis_energia', 'pos_fis_relaxamento',
  'pos_fis_digestivo', 'pos_fis_atencao', 'pos_pens_o_que',
  'pos_pens_autocompaixao', 'pos_pens_esperanca', 'pos_pens_confianca',
  'pos_pens_flexibilidade', 'pos_pens_responsabilidade',
  'pos_comp_o_que', 'pos_comp_enfrentamento', 'pos_comp_conexao',
  'pos_comp_expressao', 'pos_comp_autocuidado', 'pos_comp_aceitacao',
  // Pacote 13.6: lock de edição + auditoria
  'editando_quem', 'editando_desde',
  'editado', 'editado_por', 'editado_em',
  'id_envio', // 18.10 (8.14)
  'criado_por', 'autoria_campos', // 18.5: quem criou a linha (so o profissional e marcado) e carimbo por campo
  'criado_por_nome' // 18.6.2: nome do profissional que criou a linha ("Registrado por <nome> em ...")
];

var HEADERS_ESCALAS = [
  'timestamp', 'versao_formulario', 'data_aplicacao',
  'instrumento', 'versao_instrumento',
  'item_01', 'item_02', 'item_03', 'item_04', 'item_05',
  'item_06', 'item_07', 'item_08', 'item_09', 'item_10',
  'item_11', 'item_12', 'item_13', 'item_14', 'item_15',
  'item_16', 'item_17', 'item_18', 'item_19', 'item_20', 'item_21',
  'item_22', 'item_23', 'item_24', // 17.2: URICA tem 24 itens
  'item_25', 'item_26', // 17.5: SCS tem 26 itens
  'item_funcional', 'item_funcional_texto',
  'escore_total', 'escore_depressao', 'escore_ansiedade', 'escore_estresse',
  // 17.2: subescalas da URICA (soma de 6 itens, 6-30) e prontidao (medias: C + A + M - PC)
  'escore_precontemplacao', 'escore_contemplacao', 'escore_acao', 'escore_manutencao', 'escore_prontidao',
  // 17.5: subescalas do lote B — PANAS (somas), OCI-R (somas), ASRS-18 (somas), SCS (medias) + autocompaixao (media das medias)
  'escore_afeto_positivo', 'escore_afeto_negativo', 'escore_verificacao', 'escore_lavagem', 'escore_ordenacao', 'escore_acumulacao',
  'escore_obsessoes', 'escore_neutralizacao', 'escore_desatencao', 'escore_hiperatividade', 'escore_bondade', 'escore_autocritica',
  'escore_humanidade', 'escore_isolamento', 'escore_mindfulness', 'escore_sobreidentificacao', 'escore_autocompaixao',
  // 17.6: lote E - FTND (somas: matinal, padrao), EAAD/ESTUD (medias das 4 subescalas + media geral dos 24 itens)
  'escore_matinal', 'escore_padrao', 'escore_emocoes_negativas', 'escore_social_positivo', 'escore_preocupacoes', 'escore_abstinencia_impulsos', 'escore_media_geral',
  // 17.7: lote F - EPM (somas: processos cognitivos e comportamentais; total dos 20 itens)
  'escore_cognitivos', 'escore_comportamentais', 'escore_total_processos',
  // 17.7 (fechamento): SAS-LV (medias dos cinco fatores + total dos 33 itens)
  'escore_perturbacao', 'escore_antecipacao', 'escore_abstinencia', 'escore_ciberespaco', 'escore_uso_excessivo', 'escore_total_sas',
  // 17.8: lote C - DERS (seis somas + total), PTCI (tres medias + total), CORE-OM (quatro medias + escore clinico), BIS-11 (duas somas)
  'escore_nao_aceitacao', 'escore_objetivos', 'escore_impulsos', 'escore_consciencia', 'escore_estrategias', 'escore_clareza', 'escore_total_ders',
  'escore_self', 'escore_mundo', 'escore_autoculpa', 'escore_total_ptci',
  'escore_bem_estar', 'escore_problemas', 'escore_funcionamento', 'escore_risco', 'escore_clinico',
  'escore_controle_inibitorio', 'escore_nao_planejamento',
  'faixa',
  'alerta_risco_flag', 'alerta_risco_item', 'alerta_risco_valor',
  'observacoes', 'tempo_preenchimento_seg',
  'id_envio', // 18.10 (8.14)
  'editado_por', 'editado_em', 'criado_por', 'autoria_campos', // 18.5
  'criado_por_nome' // 18.6.2
];


// ============================================================
// ROTEADOR PRINCIPAL
// ============================================================

function doPost(e) {
  try {
    _memoZerar_(true); // 18.10: Sistema_VMC, indice e Controle abertos uma vez por chamada
    var payload = JSON.parse(e.postData.contents);
    var acao = payload.acao;
    // 18.5 (8.87): nas duas leituras do paciente a linha dele na Controle e a do profissional dono
    // sao lidas uma vez (o portao do cracha e a acao pediam a mesma linha, cada um a sua leitura)
    // 18.11: o mesmo vale para as leituras do profissional e do admin (nenhuma delas muda conta)
    if (ACOES_SO_LEITURA.indexOf(acao) !== -1) _MEMO_.linhas = {};
    if (ACOES_DA_AGENDA.indexOf(acao) !== -1) _MEMO_.profs = {}; // 14.12

    // Pacote 18.1: toda acao fora de ACOES_PUBLICAS exige o cracha de sessao.
    // Sigla e profissional saem do cracha (payload.sigla e ignorado);
    // payload.siglaPaciente continua sendo o alvo das acoes do profissional,
    // conferido contra o dono em cada funcao.
    var s = null;
    if (ACOES_PUBLICAS.indexOf(acao) === -1) {
      s = _validarToken_(payload.token);
      if (!s) return _respostaJson_(_respostaSessaoExpirada_());
    }

    // 18.10 (8.45): acao que grava roda inteira dentro da trava do script. Sem a trava em
    // 10 s nada e gravado: erro generico para o cliente, motivo no log.
    var resposta;
    if (ACOES_COM_TRAVA.indexOf(acao) !== -1) {
      try {
        resposta = _comTrava_(function () { return _despachar_(acao, payload, s); });
      } catch (erroTrava) {
        if (!erroTrava || erroTrava.message !== ERRO_TRAVA) throw erroTrava;
        resposta = { ok: false, codigo: 'ocupado', erro: MSG_OCUPADO };
      }
    } else {
      resposta = _despachar_(acao, payload, s);
    }
    return _respostaJson_(resposta);

  } catch (erro) {
    return _respostaJson_({ ok: false, erro: String(erro) });
  }
}

/** Roteador das acoes (o doPost ja conferiu o cracha e, se a acao grava, pegou a trava). */
function _despachar_(acao, payload, s) {
    var resposta;
    switch (acao) {
      case 'ping':
        resposta = { ok: true, versao_pacote: VERSAO_PACOTE, versao_formulario: VERSAO_FORM_AUTO, versao: VERSAO_FORM_AUTO, url: _e3UrlDoServico_(), hora_servidor: _e3HoraServidor_(), mensagem: 'Servidor respondendo (Pacote ' + VERSAO_PACOTE + ')' };
        break;

      // Pacote 18.1 - acoes publicas (sem cracha)
      case 'autenticar':
        resposta = autenticar(payload.tipo, payload.email, payload.senha, payload.escolha);
        break;

      case 'pedirRedefinicao':
        resposta = pedirRedefinicao(payload.tipo, payload.email);
        break;

      case 'definirSenha':
        resposta = definirSenha(payload.ativar, payload.senha, payload.aceite, payload.versao_politica);
        break;

      // Acoes do paciente (sigla do cracha)
      // 18.1.6: aceite da Politica de Privacidade por quem ja tinha senha (cracha)
      case 'aceitarPolitica':
        resposta = aceitarPolitica(s);
        break;

      case 'salvarAnamnese':
        resposta = _exigir_(s, 'paciente') || salvarAnamnese(s.sigla, payload.dados);
        break;

      case 'salvarAutomonitoramento':
        resposta = _exigir_(s, 'paciente') || salvarAutomonitoramento(s.sigla, payload.dados);
        break;

      case 'lerHistorico':
        resposta = _exigir_(s, 'paciente') || lerHistorico(s.sigla, payload.antes, payload.limite);
        break;

      case 'salvarEscala':
        resposta = _exigir_(s, 'paciente') || salvarEscala(s.sigla, payload.dados);
        break;

      case 'lerEscalas':
        resposta = _exigir_(s, 'paciente') || lerEscalas(s.sigla, payload.antes, payload.limite);
        break;

      // Pacote 18.10b - rascunho no servidor (G2): so o proprio paciente, pelo cracha
      case 'salvarRascunho':
        resposta = _exigir_(s, 'paciente') || salvarRascunho(s.sigla, payload.tipo, payload.dados);
        break;

      case 'lerRascunhos':
        resposta = _exigir_(s, 'paciente') || lerRascunhos(s.sigla);
        break;

      case 'apagarRascunho':
        resposta = _exigir_(s, 'paciente') || apagarRascunho(s.sigla, payload.tipo);
        break;

      // Pacote 17.0 - textos dos inventarios (BDI-II, BAI). Paciente ou
      // profissional; sem 'instrumento' devolve so quais estao liberados.
      case 'lerItensInstrumento':
        resposta = lerItensInstrumento(payload, s);
        break;

      case 'alterarSenhaPaciente':
        resposta = _exigir_(s, 'paciente') || alterarSenhaPaciente(s.sigla, payload.senhaAtual, payload.novaSenha);
        break;

      case 'pacienteAtualizarAnamnese':
        resposta = _exigir_(s, 'paciente') || pacienteAtualizarAnamnese(s.sigla, payload.campos, payload.id_envio);
        break;

      case 'pacienteMarcarEditandoAuto':
        resposta = _exigir_(s, 'paciente') || pacienteMarcarEditandoAuto(s.sigla, payload.timestamp);
        break;

      case 'pacienteLimparEditandoAuto':
        resposta = _exigir_(s, 'paciente') || pacienteLimparEditandoAuto(s.sigla, payload.timestamp);
        break;

      case 'pacienteEditarAutomonitoramento':
        resposta = _exigir_(s, 'paciente') || pacienteEditarAutomonitoramento(s.sigla, payload.timestamp, payload.dados, payload.campos, payload.id_envio);
        break;

      // Lock de presenca (13.6.2): paciente le o proprio; profissional, o de um paciente seu.
      case 'lerEditandoAuto':
        resposta = lerEditandoAuto(_siglaAlvoLeitura_(s, payload.sigla), payload.timestamp);
        break;

      // Acoes do profissional (profissional do cracha; siglaPaciente = alvo)
      case 'profListarPacientes':
        resposta = listarPacientesDoProfissional(s);
        break;

      case 'profLerDadosPaciente':
        resposta = lerDadosPaciente(s, payload.siglaPaciente);
        break;

      case 'profCadastrarPaciente':
        resposta = cadastrarPaciente(s, payload.dados);
        break;

      case 'profSalvarAnamnese':
        resposta = profSalvarAnamnese(s, payload.siglaPaciente, payload.contato, payload.campos, payload.id_envio);
        break;

      case 'profEnviarConvite':
        resposta = profEnviarConvite(s, payload.siglaPaciente, payload.canal, payload.contato);
        break;

      case 'profMarcarEditandoAuto':
        resposta = profMarcarEditandoAuto(s, payload.siglaPaciente, payload.timestamp);
        break;

      case 'profLimparEditandoAuto':
        resposta = profLimparEditandoAuto(s, payload.siglaPaciente, payload.timestamp);
        break;

      case 'profEditarAutomonitoramento':
        resposta = profEditarAutomonitoramento(s, payload.siglaPaciente, payload.timestamp, payload.dados, payload.campos, payload.id_envio);
        break;

      // Pacote 18.5 - o profissional cria registro e escala em nome do paciente e edita escala
      case 'profCriarAutomonitoramento':
        resposta = profCriarAutomonitoramento(s, payload.siglaPaciente, payload.dados);
        break;

      case 'profCriarEscala':
        resposta = profCriarEscala(s, payload.siglaPaciente, payload.dados);
        break;

      case 'profEditarEscala':
        resposta = profEditarEscala(s, payload.siglaPaciente, payload.timestamp, payload.campos, payload.id_envio);
        break;

      // 17.1.2 - liberacao de instrumento 'so do profissional' (BSS) por paciente
      case 'profLiberarEscala':
        resposta = profLiberarEscala(s, payload.siglaPaciente, payload.instrumento, payload.liberar);
        break;

      case 'profDesativarPaciente':
        resposta = profDesativarPaciente(s, payload.siglaPaciente);
        break;

      case 'profReativarPaciente':
        resposta = profReativarPaciente(s, payload.siglaPaciente);
        break;

      case 'profExcluirPaciente':
        resposta = profExcluirPaciente(s, payload.siglaPaciente, payload.confirmacaoSigla, payload.simular);
        break;

      case 'profEditarPaciente': // 19.6
        resposta = profEditarPaciente(s, payload.siglaPaciente, payload.dados, payload.id_envio);
        break;

      case 'profAlterarSenhaPaciente':
        resposta = profAlterarSenhaPaciente(s, payload.sigla_paciente, payload.nova_senha);
        break;

      case 'profLerGrade':
        resposta = lerGradeAtendimento(s);
        break;

      case 'profSalvarGrade':
        resposta = salvarGradeAtendimento(s, payload.config, payload.grade);
        break;

      // Pacote 18.8.1 - "Meus dados" do profissional (genero na hora; nome, e-mail, telefone e CRP viram pedido)
      case 'profLerMeusDados':
        resposta = profLerMeusDados(s);
        break;

      case 'profSalvarMeusDados':
        resposta = profSalvarMeusDados(s, payload.dados);
        break;

      // Pacote 19.2.1 - plano de lembretes (profissional grava; o paciente so le o dele)
      case 'profSalvarLembrete':
        resposta = profSalvarLembrete(s, payload.siglaPaciente, payload.dados);
        break;

      case 'profEncerrarLembrete':
        resposta = profEncerrarLembrete(s, payload.siglaPaciente, payload.id);
        break;

      case 'profLembrarAgora':
        resposta = profLembrarAgora(s, payload.siglaPaciente, payload.dados);
        break;

      case 'lerMeusLembretes':
        resposta = _exigir_(s, 'paciente') || lerMeusLembretes(s.sigla);
        break;

      // Pacote 14.3 - Agenda completa (profissional)
      case 'profLerAgenda':
        resposta = profLerAgenda(s, payload.de, payload.ate);
        break;

      case 'profSalvarSessao':
        resposta = profSalvarSessao(s, payload.dados, payload.periodo);
        break;

      case 'profEditarSerie':
        resposta = profEditarSerie(s, payload.dados, payload.periodo);
        break;

      case 'profCancelarSessao':
        resposta = profCancelarSessao(s, payload.id, payload.opcoes, payload.periodo);
        break;

      case 'profMarcarSituacao':
        resposta = profMarcarSituacao(s, payload.id, payload.situacao, payload.periodo);
        break;

      case 'profSalvarBloqueio':
        resposta = profSalvarBloqueio(s, payload.dados, payload.periodo);
        break;

      case 'profApagarBloqueio':
        resposta = profApagarBloqueio(s, payload.id, payload.periodo);
        break;

      case 'profDecidirPedido':
        resposta = profDecidirPedido(s, payload.id, payload.aprovar, payload.periodo, payload.quando);
        break;

      // Pacote 14.3 - Agenda completa (paciente: so as proprias sessoes)
      case 'lerMinhasSessoes':
        resposta = _exigir_(s, 'paciente') || lerMinhasSessoes(s.sigla);
        break;

      case 'lerHorariosLivres':
        resposta = _exigir_(s, 'paciente') || lerHorariosLivres(s.sigla, payload.de);
        break;

      case 'profLerHorariosLivres': // 14.5
        resposta = profLerHorariosLivres(s, payload.de, payload.pedido);
        break;

      case 'pacienteAgendarSessao':
        resposta = _exigir_(s, 'paciente') || pacienteAgendarSessao(s.sigla, payload.dados);
        break;

      case 'pacienteConfirmarSessao':
        resposta = _exigir_(s, 'paciente') || pacienteConfirmarSessao(s.sigla, payload.id);
        break;

      case 'pacienteCancelarSessao':
        resposta = _exigir_(s, 'paciente') || pacienteCancelarSessao(s.sigla, payload.id);
        break;

      case 'pacientePedirAgenda':
        resposta = _exigir_(s, 'paciente') || pacientePedirAgenda(s.sigla, payload.dados);
        break;

      // Pacote 14.4 - confirmacao por link (publica), eventos vistos e e-mail na hora
      case 'confirmarSessaoPorLink':
        resposta = confirmarSessaoPorLink(payload.t);
        break;

      // Pacote 14.8 - conta conectada (Google Agenda por profissional)
      case 'profAgendaConectar':
        resposta = profAgendaConectar(s, payload.dados, payload.periodo);
        break;

      case 'profAgendaDesconectar':
        resposta = profAgendaDesconectar(s, payload.periodo);
        break;

      case 'profAgendaOpcao':
        resposta = profAgendaOpcao(s, payload.dados, payload.periodo);
        break;

      // Pacote 14.8.1 - a volta do Google, entregue pela pagina conectar.html (publica: quem protege e o `state` assinado)
      case 'concluirConexaoAgenda':
        resposta = concluirConexaoAgenda(payload);
        break;

      case 'profMarcarEventosVistos':
        resposta = profMarcarEventosVistos(s, payload.periodo);
        break;

      case 'profAvisarSessao':
        resposta = profAvisarSessao(s, payload.id, payload.dados);
        break;

      case 'profSalvarValorSessao': // 14.6
        resposta = profSalvarValorSessao(s, payload.siglaPaciente, payload.valor);
        break;

      // Fase 20 - Fluxo de caixa (profissional)
      case 'profLerFinanceiro':
        resposta = profLerFinanceiro(s, payload);
        break;
      case 'profSalvarCadastroFinanceiro':
        resposta = profSalvarCadastroFinanceiro(s, payload.siglaPaciente, payload.dados);
        break;
      case 'profSalvarConfigFinanceiro':
        resposta = profSalvarConfigFinanceiro(s, payload.dados, payload);
        break;
      case 'profSalvarPagamento':
        resposta = profSalvarPagamento(s, payload.siglaPaciente, payload.dados, payload.simular === true, payload);
        break;
      case 'profEstornarPagamento':
        resposta = profEstornarPagamento(s, payload.id);
        break;
      case 'profDecidirComprovante':
        resposta = profDecidirComprovante(s, payload.id, payload.aprovar === true, payload.dados, payload);
        break;
      case 'profGerarCobrancas':
        resposta = profGerarCobrancas(s, payload.siglas, payload);
        break;
      case 'profEnviarCobranca':
        resposta = profEnviarCobranca(s, payload.id, payload.dados, payload);
        break;
      case 'profDescartarCobranca':
        resposta = profDescartarCobranca(s, payload.id, payload);
        break;
      case 'profNaoCobrarSessao':
        resposta = profNaoCobrarSessao(s, payload.sessoes, payload);
        break;
      case 'profSalvarDespesa':
        resposta = profSalvarDespesa(s, payload.dados, payload);
        break;
      case 'profEncerrarDespesaFixa':
        resposta = profEncerrarDespesaFixa(s, payload.id, payload);
        break;
      case 'lerArquivoFinanceiro':
        resposta = lerArquivoFinanceiro(s, payload.id);
        break;
      case 'profSalvarRecibo': // 20.1
        resposta = profSalvarRecibo(s, payload.id, payload.dados, payload);
        break;
      case 'profGerarLote': // 20.1
        resposta = profGerarLote(s, payload.qual, payload.simular === true, payload);
        break;
      case 'profMarcarStatusLote': // 20.2: status das sessoes pelo bloco do Inicio
        resposta = profMarcarStatusLote(s, payload.ids, payload.situacao);
        break;
      // Fase 20 - Fluxo de caixa (paciente: so o proprio financeiro)
      case 'lerMeuFinanceiro':
        resposta = _exigir_(s, 'paciente') || lerMeuFinanceiro(s.sigla);
        break;
      case 'pacienteEnviarComprovante':
        resposta = _exigir_(s, 'paciente') || pacienteEnviarComprovante(s.sigla, payload.dados);
        break;
      case 'pacientePedirRecibo':
        resposta = _exigir_(s, 'paciente') || pacientePedirRecibo(s.sigla);
        break;

      // Acoes do admin (admin do cracha)
      case 'admListarProfissionais':
        resposta = listarProfissionais(s);
        break;

      case 'admCadastrarProfissional':
        resposta = cadastrarProfissional(s, payload.dados);
        break;

      case 'admAtualizarProfissional':
        resposta = atualizarProfissional(s, payload.profissionalId, payload.mudancas);
        break;

      case 'admTrocarSenhaProfissional':
        resposta = trocarSenhaProfissional(s, payload.profissionalId, payload.novaSenha);
        break;

      case 'admDesativarProfissional':
        resposta = desativarProfissional(s, payload.profissionalId);
        break;

      case 'admReativarProfissional':
        resposta = reativarProfissional(s, payload.profissionalId);
        break;

      case 'admEnviarConvite':
        resposta = admEnviarConvite(s, payload.profissionalId, payload.canal);
        break;

      // Pacote 18.8.1 - pedido de alteracao de dados do profissional
      case 'admAprovarPedido':
        resposta = admAprovarPedido(s, payload.profissionalId);
        break;

      case 'admRecusarPedido':
        resposta = admRecusarPedido(s, payload.profissionalId);
        break;

      default:
        resposta = { ok: false, erro: 'Acao desconhecida: ' + acao };
    }
    return resposta;
}

function doGet(e) {
  return _respostaJson_({ ok: false, erro: 'Use POST' });
}

function _respostaJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
// PACOTE 18.10 - MEMORIA POR REQUISICAO E TRAVA DE GRAVACAO
// ============================================================

/**
 * Memoria da chamada (8.34): cada planilha e aberta uma vez (Sistema_VMC, Controle,
 * planilha do paciente) e o Indice_Siglas e lido uma vez. 18.5: em lerHistorico e lerEscalas
 * (que nao gravam) _MEMO_.linhas guarda tambem a linha do paciente e a do profissional. Variavel do modulo, zerada
 * no inicio de cada doPost. O cache dos DADOS do indice so vale dentro do doPost
 * (`ativo`); funcao chamada direto (clasp run, testes) sempre le a planilha. Quem
 * grava no indice chama _memoEsquecerIndice_().
 */
var _MEMO_ = { ativo: false, planilhas: {}, controles: {}, indice: null, cache: {} };

function _memoZerar_(ativo) {
  _MEMO_ = { ativo: ativo === true, planilhas: {}, controles: {}, indice: null, cache: {} };
  // 14.12: dentro do doPost, cada aba da Agenda, a configuracao, a lista de pacientes e os cabecalhos sao lidos uma vez
  // por chamada. As chaves sao os proprios objetos da planilha e da aba (a mesma instancia durante a chamada).
  if (_MEMO_.ativo) _MEMO_.age = { abas: new Map(), cabs: new Map(), linhas: new Map(), cfg: new Map(), pacs: new Map() };
}

/** 14.12: a lista de pacientes da Agenda mudou nesta chamada (cadastro, valor da sessao, nome, ativo): a proxima leitura vai a planilha. */
function _memoEsquecerPacientes_() {
  if (_MEMO_.age) _MEMO_.age.pacs = new Map();
}

/** 14.12: as linhas de uma aba da Agenda mudaram por fora de _ageGravar_ (linha apagada): a proxima leitura vai a planilha. */
function _ageEsquecer_(aba) {
  if (_MEMO_.age && aba) _MEMO_.age.linhas.delete(aba);
}

/**
 * 14.12: _lembretesLer_ com memoria da chamada, para as abas da Agenda (Sessoes, Series, Bloqueios, Pedidos_Agenda).
 * Quem chama recebe sempre copias: mexer num item lido nao muda o que a memoria guarda. _ageGravar_ mantem a memoria
 * igual a planilha; quem apaga linha chama _ageEsquecer_.
 */
function _ageLer_(aba) {
  if (!_MEMO_.age || !aba) return _lembretesLer_(aba);
  var guardado = _MEMO_.age.linhas.get(aba);
  if (!guardado) { guardado = _lembretesLer_(aba); _MEMO_.age.linhas.set(aba, guardado); }
  return guardado.map(function (o) { var c = {}; for (var k in o) c[k] = o[k]; return c; });
}

// 18.11: leituras em que a linha do paciente e a do profissional sao lidas uma vez por chamada
var ACOES_SO_LEITURA = ['lerHistorico', 'lerEscalas', 'lerRascunhos', 'lerEditandoAuto',
  'profListarPacientes', 'profLerDadosPaciente', 'profLerGrade', 'admListarProfissionais', 'profLerMeusDados',
  'lerMeusLembretes', // 19.2.1
  'profLerAgenda', 'lerMinhasSessoes', 'lerHorariosLivres', // 14.3
  'profLerFinanceiro', 'lerMeuFinanceiro', 'lerArquivoFinanceiro', // Fase 20
  'profLerHorariosLivres']; // 14.5

// 14.12: gravacoes da Agenda — nenhuma delas muda a aba Profissionais, entao o cadastro do profissional e lido uma vez por chamada
var ACOES_DA_AGENDA = ['profSalvarSessao', 'profEditarSerie', 'profCancelarSessao', 'profMarcarSituacao', 'profSalvarBloqueio', 'profApagarBloqueio',
  'profDecidirPedido', 'profAvisarSessao', 'profMarcarEventosVistos', 'profMarcarStatusLote',
  'pacienteAgendarSessao', 'pacienteConfirmarSessao', 'pacienteCancelarSessao', 'pacientePedirAgenda', 'confirmarSessaoPorLink'];

// ---------- 18.11: cache do script (CacheService) ----------
// Tres coisas moram no cache do script, para a chamada comum nao abrir a Sistema_VMC:
//   portao:<perfil>:<SIGLA>:<dono>  conferencia de conta ativa do cracha (5 min) — ver _validarToken_
//   dono:<SIGLA>                    profissional dono do paciente, do Indice_Siglas (5 min)
//   controle:<profissional_id>      id da Controle do profissional (6 h; o id nao muda)
//   planilha:<SIGLA>                id da planilha do paciente (6 h; o id nao muda)
// O cache nunca e a fonte: sem a chave (ou com o cache fora do ar) a planilha e lida como antes.
var PORTAO_CACHE_SEG = 300;
var LOCAL_CACHE_SEG = 21600;

/** Le uma chave do cache do script (uma vez por chamada); null sem a chave ou com o cache fora do ar. */
function _cacheLer_(chave) {
  if (_MEMO_.cache[chave] !== undefined) return _MEMO_.cache[chave];
  var v = null;
  try { v = CacheService.getScriptCache().get(chave); } catch (e) { v = null; }
  _MEMO_.cache[chave] = v;
  return v;
}

/** Le varias chaves de uma vez (uma ida ao cache) e guarda na memoria da chamada. */
function _cacheLerVarias_(chaves) {
  var achadas = {};
  try { achadas = CacheService.getScriptCache().getAll(chaves) || {}; } catch (e) { achadas = {}; }
  for (var i = 0; i < chaves.length; i++) _MEMO_.cache[chaves[i]] = achadas[chaves[i]] !== undefined ? achadas[chaves[i]] : null;
}

function _cacheGuardar_(chave, valor, segundos) {
  _MEMO_.cache[chave] = String(valor);
  try { CacheService.getScriptCache().put(chave, String(valor), segundos); } catch (e) { /* sem cache: a planilha continua sendo lida */ }
}

/** Tira chaves do cache. Devolve false se o cache nao respondeu (quem chama decide o que fazer). */
function _cacheEsquecer_(chaves) {
  for (var i = 0; i < chaves.length; i++) _MEMO_.cache[chaves[i]] = null;
  try { CacheService.getScriptCache().removeAll(chaves); return true; }
  catch (e) { console.error('cache: nao consegui esquecer ' + chaves.length + ' chave(s): ' + String(e && e.message || e).slice(0, 120)); return false; }
}

function _siglaChave_(sigla) { return String(sigla === undefined || sigla === null ? '' : sigla).trim().toUpperCase(); }

/** Chave do portao: uma por conta (perfil, sigla, dono). Funcao pura. */
function _chavePortao_(tipo, sigla, profissionalId) {
  return 'portao:' + String(tipo) + ':' + _siglaChave_(sigla) + ':' + String(profissionalId === undefined || profissionalId === null ? '' : profissionalId).trim();
}

/** O que o portao guarda de uma conta conferida na planilha: a impressao da credencial, o nome e o e-mail. Funcao pura. */
function _valorPortao_(reg) {
  return JSON.stringify({ i: impressaoCracha(reg.senha_hash), n: String(reg.nome || ''), e: String(reg.email || '') });
}

/**
 * Valor guardado x cracha: devolve {nome, email} so quando a impressao guardada e a do cracha.
 * Cracha de credencial trocada nunca passa por aqui — cai na planilha, que o recusa. Funcao pura.
 */
function _portaoConfere_(texto, impressao) {
  if (!texto || !impressao) return null;
  var o = null;
  try { o = JSON.parse(String(texto)); } catch (e) { return null; }
  if (!o || typeof o.i !== 'string' || !o.i) return null;
  if (!_iguaisTempoConstante_(o.i, String(impressao))) return null;
  return { nome: String(o.n || ''), email: String(o.e || '') };
}

/**
 * Invalidacao imediata (18.11): toda acao do sistema que muda senha, e-mail, nome, `ativo`
 * ou exclui uma conta chama isto DEPOIS de gravar. O flush vem antes para a planilha ja
 * estar com o valor novo quando a proxima chamada for conferir. `contas` = [{tipo, sigla,
 * profissional_id}].
 */
function _portaoEsquecer_(contas) {
  var chaves = [];
  for (var i = 0; i < contas.length; i++) {
    chaves.push(_chavePortao_(contas[i].tipo, contas[i].sigla, contas[i].profissional_id));
    if (contas[i].excluida) { chaves.push('dono:' + _siglaChave_(contas[i].sigla)); chaves.push('planilha:' + _siglaChave_(contas[i].sigla)); }
  }
  if (!chaves.length) return true;
  try { SpreadsheetApp.flush(); } catch (e) { /* segue: o que importa e soltar o cache */ }
  return _cacheEsquecer_(chaves);
}

/** O portao de um profissional e o de todos os pacientes dele (o paciente so entra com o dono ativo). */
function _portaoEsquecerProfissional_(profissionalId, sigla) {
  var contas = [{ tipo: 'profissional', sigla: sigla, profissional_id: profissionalId }];
  var idx = _lerIndice_().linhas;
  for (var i = 0; i < idx.length; i++) {
    if (idx[i].tipo === 'paciente' && idx[i].profissional_id === String(profissionalId).trim()) contas.push(idx[i]);
  }
  return _portaoEsquecer_(contas);
}

function _memoEsquecerIndice_() { _MEMO_.indice = null; }

function _abrirPlanilha_(id) {
  var chave = String(id);
  if (!_MEMO_.planilhas[chave]) _MEMO_.planilhas[chave] = SpreadsheetApp.openById(chave);
  return _MEMO_.planilhas[chave];
}

/** Valores da aba Indice_Siglas (com o cabecalho na linha 0) ou null. */
function _indiceValores_() {
  if (_MEMO_.ativo && _MEMO_.indice) return _MEMO_.indice;
  var aba = _abrirPlanilha_(SISTEMA_VMC_ID).getSheetByName(ABA_INDICE_SIGLAS);
  var valores = aba ? aba.getDataRange().getValues() : null;
  if (_MEMO_.ativo) _MEMO_.indice = valores;
  return valores;
}

/**
 * Trava de gravacao (8.45): toda escrita em planilha roda dentro do lock do script,
 * com espera de 10 s. Reentrante na mesma execucao (a acao inteira ja esta na trava
 * e as funcoes internas a pedem de novo sem soltar a de fora). Sem a trava, lanca
 * ERRO_TRAVA antes de qualquer escrita — nunca ha gravacao pela metade por causa dela.
 */
var ERRO_TRAVA = 'TRAVA_OCUPADA';
var MSG_OCUPADO = 'Não foi possível gravar agora. Tente de novo.';
var _TRAVA_ATIVA_ = false;

function _comTrava_(fn) {
  if (_TRAVA_ATIVA_) return fn();
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    console.error('trava de gravacao: nao obtida em 10 s (' + String(e && e.message || e).slice(0, 120) + ')');
    throw new Error(ERRO_TRAVA);
  }
  _TRAVA_ATIVA_ = true;
  try {
    return fn();
  } finally {
    _TRAVA_ATIVA_ = false;
    lock.releaseLock();
  }
}

/** Gravacao acessoria dentro de uma leitura (controle_id, indicadores): sem a trava, so registra e segue. */
function _comTravaSeDer_(fn) {
  try { return _comTrava_(fn); }
  catch (e) { console.error('gravacao acessoria nao feita: ' + String(e && e.message || e).slice(0, 160)); return null; }
}

// Acoes do doPost que gravam em planilha (as de leitura ficam fora; autenticar e
// pedirRedefinicao pegam a trava so no trecho que grava, por causa do piso de tempo).
var ACOES_COM_TRAVA = [
  'definirSenha', 'aceitarPolitica',
  'salvarAnamnese', 'salvarAutomonitoramento', 'salvarEscala',
  'salvarRascunho', 'apagarRascunho', // 18.10b
  'alterarSenhaPaciente', 'pacienteAtualizarAnamnese',
  'pacienteMarcarEditandoAuto', 'pacienteLimparEditandoAuto', 'pacienteEditarAutomonitoramento',
  'profCadastrarPaciente', 'profSalvarAnamnese', 'profEnviarConvite',
  'profLiberarEscala', // 17.1.2
  'profMarcarEditandoAuto', 'profLimparEditandoAuto', 'profEditarAutomonitoramento',
  'profCriarAutomonitoramento', 'profCriarEscala', 'profEditarEscala', // 18.5
  'profDesativarPaciente', 'profReativarPaciente', 'profExcluirPaciente', 'profAlterarSenhaPaciente', 'profEditarPaciente', // 19.6
  'profSalvarGrade',
  'admCadastrarProfissional', 'admAtualizarProfissional', 'admTrocarSenhaProfissional',
  'admDesativarProfissional', 'admReativarProfissional', 'admEnviarConvite',
  'profSalvarMeusDados', 'admAprovarPedido', 'admRecusarPedido', // 18.8.1
  'profSalvarLembrete', 'profEncerrarLembrete', 'profLembrarAgora', // 19.2.1
  'profSalvarSessao', 'profEditarSerie', 'profCancelarSessao', 'profMarcarSituacao', 'profSalvarBloqueio', 'profApagarBloqueio', 'profDecidirPedido', // 14.3
  'pacienteAgendarSessao', 'pacienteConfirmarSessao', 'pacienteCancelarSessao', 'pacientePedirAgenda', // 14.3
  'confirmarSessaoPorLink', 'profMarcarEventosVistos', 'profAvisarSessao', // 14.4
  'profAgendaConectar', 'profAgendaDesconectar', 'profAgendaOpcao', // 14.8
  'profSalvarValorSessao', // 14.6
  'profSalvarCadastroFinanceiro', 'profSalvarConfigFinanceiro', 'profSalvarPagamento', 'profEstornarPagamento', 'profDecidirComprovante', // Fase 20
  'profGerarCobrancas', 'profEnviarCobranca', 'profDescartarCobranca', 'profNaoCobrarSessao', 'profSalvarDespesa', 'profEncerrarDespesaFixa', // Fase 20
  'pacienteEnviarComprovante', 'pacientePedirRecibo', // Fase 20
  'profSalvarRecibo', 'profGerarLote', // 20.1
  'profMarcarStatusLote' // 20.2
];


// ============================================================
// RESOLUCAO MULTI-TENANT
// ============================================================
// Estas funcoes sao o coracao do isolamento entre profissionais.
// Dada uma sigla, descobrem a quem ela pertence e abrem a planilha
// certa - SEMPRE consultando o Indice_Siglas, nunca confiando no
// payload do cliente.
// ============================================================

/**
 * Consulta o Indice_Siglas para descobrir a quem uma sigla pertence.
 *
 * Entrada:
 *   sigla - codigo do usuario (ex: 'VMC')
 *   tipo  - 'paciente', 'profissional' ou 'admin'
 *
 * Saida:
 *   profissional_id (string) ou null se nao encontrar
 *
 * Para tipo='admin', retorna o admin_id (a propria conta admin).
 * Para tipo='profissional', retorna o profissional_id (a propria conta).
 * Para tipo='paciente', retorna o profissional_id DONO daquele paciente.
 */
function resolverProfissionalIdPorSigla(sigla, tipo) {
  if (!sigla || !tipo) return null;

  // 18.11: o dono de um paciente nao muda (so some na exclusao, que solta a chave) — a resposta
  // do Indice fica 5 min no cache do script e a chamada comum nao abre a Sistema_VMC.
  var chaveDono = String(tipo).trim().toLowerCase() === 'paciente' ? 'dono:' + _siglaChave_(sigla) : '';
  if (chaveDono) {
    var donoGuardado = _cacheLer_(chaveDono);
    if (donoGuardado) return donoGuardado;
  }

  var dados = _indiceValores_(); // 18.10: lido uma vez por chamada
  if (!dados || dados.length < 2) return null;

  var cabecalhos = dados[0];
  var idxSigla = cabecalhos.indexOf('sigla');
  var idxTipo  = cabecalhos.indexOf('tipo');
  var idxProf  = cabecalhos.indexOf('profissional_id');

  if (idxSigla === -1 || idxTipo === -1 || idxProf === -1) return null;

  var siglaLimpa = String(sigla).trim().toUpperCase();
  var tipoLimpo  = String(tipo).trim().toLowerCase();

  for (var i = 1; i < dados.length; i++) {
    var s = String(dados[i][idxSigla]).trim().toUpperCase();
    var t = String(dados[i][idxTipo]).trim().toLowerCase();
    if (s === siglaLimpa && t === tipoLimpo) {
      var achado = String(dados[i][idxProf]).trim();
      if (chaveDono && achado) _cacheGuardar_(chaveDono, achado, PORTAO_CACHE_SEG);
      return achado;
    }
  }
  return null;
}

/**
 * Dado um profissional_id, retorna o objeto com seus dados (linha
 * da aba Profissionais).
 */
function buscarProfissional(profissionalId) {
  if (!profissionalId) return null;
  var chaveMemo = 'prof:' + String(profissionalId).trim();
  if (_MEMO_.linhas && _MEMO_.linhas[chaveMemo]) return _MEMO_.linhas[chaveMemo];
  if (_MEMO_.profs && _MEMO_.profs[chaveMemo]) return _MEMO_.profs[chaveMemo]; // 14.12

  var planilha = _abrirPlanilha_(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_PROFISSIONAIS);
  if (!aba) return null;

  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return null;

  var cabecalhos = dados[0];
  var idxId = cabecalhos.indexOf('profissional_id');
  if (idxId === -1) return null;

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]).trim() === String(profissionalId).trim()) {
      var obj = {};
      for (var j = 0; j < cabecalhos.length; j++) {
        obj[cabecalhos[j]] = dados[i][j];
      }
      if (_MEMO_.linhas) _MEMO_.linhas[chaveMemo] = obj;
      if (_MEMO_.profs) _MEMO_.profs[chaveMemo] = obj; // 14.12
      return obj;
    }
  }
  return null;
}

/**
 * Dado um admin_id, retorna o objeto com seus dados.
 */
function buscarAdmin(adminId) {
  if (!adminId) return null;

  var planilha = _abrirPlanilha_(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_ADMINS);
  if (!aba) return null;

  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return null;

  var cabecalhos = dados[0];
  var idxId = cabecalhos.indexOf('admin_id');
  if (idxId === -1) return null;

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]).trim() === String(adminId).trim()) {
      var obj = {};
      for (var j = 0; j < cabecalhos.length; j++) {
        obj[cabecalhos[j]] = dados[i][j];
      }
      return obj;
    }
  }
  return null;
}

/**
 * Abre a planilha Controle de um profissional dado seu profissional_id.
 *
 * Estrategia: buscamos o profissional na aba Profissionais para descobrir
 * sua pasta_drive_id, depois listamos arquivos dentro dessa pasta
 * procurando pelo arquivo de nome "Clinica VMC - Controle".
 *
 * Retorna o objeto Spreadsheet, ou null se nao encontrar.
 */
function abrirControleDoProfissional(profissionalId) {
  var chave = String(profissionalId || '').trim();
  if (_MEMO_.controles[chave]) return _MEMO_.controles[chave];
  if (!chave) return null;

  // 18.11: o id da Controle fica no cache do script — sem ele a chamada abria a Sistema_VMC so
  // para ler `controle_id`. Id que nao abre (ou sem a aba Pacientes) cai no caminho de sempre.
  var chaveCache = 'controle:' + chave;
  var idCache = _cacheLer_(chaveCache);
  if (idCache) {
    try {
      var doCache = _abrirPlanilha_(idCache);
      if (doCache.getSheetByName(ABA_PACIENTES)) { _MEMO_.controles[chave] = doCache; return doCache; }
    } catch (e) { /* cai no caminho de sempre */ }
  }

  var prof = buscarProfissional(profissionalId);
  if (!prof) return null;

  // 18.10 (8.34): `controle_id` na aba Profissionais -> abre direto pelo id. A busca
  // por nome na pasta do Drive so roda com a coluna vazia (ou id que nao abre), e o
  // id encontrado e gravado para as proximas chamadas.
  var controle = null;
  var idGuardado = String(prof.controle_id || '').trim();
  if (idGuardado) {
    try {
      var aberta = _abrirPlanilha_(idGuardado);
      if (aberta.getSheetByName(ABA_PACIENTES)) controle = aberta;
    } catch (e) {
      controle = null;
    }
  }
  if (!controle) {
    if (!prof.pasta_drive_id) return null;
    try {
      var arquivos = DriveApp.getFolderById(prof.pasta_drive_id).getFilesByName(NOME_CONTROLE);
      if (!arquivos.hasNext()) return null;
      var idAchado = arquivos.next().getId();
      controle = _abrirPlanilha_(idAchado);
      _gravarControleId_(prof.profissional_id, idAchado);
    } catch (e) {
      return null;
    }
  }
  _MEMO_.controles[chave] = controle;
  _cacheGuardar_(chaveCache, controle.getId(), LOCAL_CACHE_SEG);
  return controle;
}

/** Grava o id da Controle na linha do profissional (coluna criada pelo cabecalho). */
function _gravarControleId_(profissionalId, controleId) {
  _comTravaSeDer_(function () {
    _atualizarLinhaPorChave_(_abrirPlanilha_(SISTEMA_VMC_ID).getSheetByName(ABA_PROFISSIONAIS),
      'profissional_id', profissionalId, { controle_id: controleId });
  });
}

/**
 * Busca um paciente pela sigla, derivando o profissional dono via
 * Indice_Siglas. Retorna o objeto com as colunas da Controle, ou null.
 *
 * Esta funcao substitui a buscarPaciente(sigla) antiga. A diferenca
 * critica: o profissional dono e descoberto server-side, garantindo
 * isolamento.
 */
function buscarPaciente(sigla) {
  if (!sigla) return null;
  var chaveMemo = 'pac:' + String(sigla).trim().toUpperCase();
  if (_MEMO_.linhas && _MEMO_.linhas[chaveMemo]) return _MEMO_.linhas[chaveMemo];

  var profissionalId = resolverProfissionalIdPorSigla(sigla, 'paciente');
  if (!profissionalId) return null;

  var controle = abrirControleDoProfissional(profissionalId);
  if (!controle) return null;

  var aba = controle.getSheetByName(ABA_PACIENTES);
  if (!aba) return null;

  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return null;

  var cabecalhos = dados[0];
  var idxSigla = cabecalhos.indexOf('sigla');
  if (idxSigla === -1) return null;

  var siglaLimpa = String(sigla).trim().toUpperCase();

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxSigla]).trim().toUpperCase() === siglaLimpa) {
      var obj = {};
      for (var j = 0; j < cabecalhos.length; j++) {
        obj[cabecalhos[j]] = dados[i][j];
      }
      // Anexa o profissional_id para uso interno (nao volta pro cliente)
      obj.__profissional_id = profissionalId;
      if (_MEMO_.linhas) _MEMO_.linhas[chaveMemo] = obj;
      return obj;
    }
  }
  return null;
}


// ============================================================
// PACOTE 18.1 - ACESSO POR E-MAIL E CRACHA DE SESSAO
// ============================================================
// Desenho em docs/arquitetura.md, secao "Acesso por e-mail e cracha de
// sessao". Virada unica (decisao de 29/09/2026): sem hash v1, sem senha
// antiga; cada conta entra por convite ou redefinicao (link de uso unico).
//   - Conta = (perfil, e-mail normalizado). E-mail -> sigla pela coluna
//     `email` do Indice_Siglas; a sigla continua sendo a chave interna.
//   - Cracha: base64url("tipo|sigla|profissional_id|expira") + "." + HMAC
//     SHA-256 (hex) com o segredo SEGREDO_SESSAO das propriedades do script.
//     Validade 6 h; `ativo` conferido a cada chamada; sem estado no servidor.
//   - Senha: "v2$<sal_hex>$<iter>$<hash_hex>" (HMAC-SHA256 iterado, sal por
//     usuario). Senha, hash, cracha e segredo nunca vao para o Logger.
// ============================================================

// 07/10/2026: index-dev.html e o index oficial (decisao do usuario); o index.html so redireciona para ele.
var SITE_URL = 'https://viniciusmarinaccipsi-art.github.io/clinica-vmc/index-dev.html';
// 18.1.6: versao da Politica de Privacidade (a mesma exibida em privacidade.html).
// Mudou o texto da politica -> sobe a versao aqui e na pagina; paciente com aceite
// de versao anterior ve o aceite de novo no proximo login.
var POLITICA_VERSAO = '2026-11';
var ACOES_PUBLICAS = ['ping', 'autenticar', 'pedirRedefinicao', 'definirSenha',
  'confirmarSessaoPorLink', // 14.4: o link do e-mail e do WhatsApp so confirma a presenca daquela sessao (token assinado)
  'concluirConexaoAgenda']; // 14.8.1: a volta do Google so conclui o pedido de conexao que o proprio servidor assinou (`state`)
var PERFIS = ['paciente', 'profissional', 'admin'];
var SESSAO_HORAS = 6;
var LINK_HORAS = 48;
// Iteracoes do hash v2. Calibracao: alvo de 200-400 ms por conferencia no
// Apps Script. Comecou em 5000 (18.1); medido com medirHashSenha() em 02/10/2026:
// 5000 iteracoes = 7398 / 5174 / 2631 ms (0,5-1,5 ms cada) -> 300 (18.1.2),
// conferido: 300 iteracoes = 96 / 175 / 297 ms (mediana das seis ~0,8 ms -> ~240 ms).
// Hashes antigos guardam o proprio iter. 18.2.1: o formato corrente e o v3 (pimenta);
// conta ainda em v2 (300 ou 5000 iteracoes) e regravada em v3 no proximo login.
var ITER_SENHA = 300;
var SENHA_MINIMA = 8;
var FALHAS_MAX = 5;            // 5 falhas por (perfil, e-mail) ...
var BLOQUEIO_SEG = 15 * 60;    // ... bloqueiam por 15 minutos
var EMAILS_DIA_MAX = 20;       // convites (profissional e admin) por dia
var REDEFINICOES_DIA_MAX = 10; // pedidos anonimos de "Esqueci a senha" por dia (cota separada, 18.1.2)
var SENHA_MAXIMA = 128;        // recusada antes de qualquer hash (18.1.2)
var LINKS_PENDENTES_MAX = 3;   // por conta; o 4o substitui o mais antigo (18.1.2)
var LINKS_GUARDA_DIAS = 7;     // linhas vencidas ha mais que isso saem da aba Tokens
var REDEF_INTERVALO_SEG = 15 * 60; // 1 "Esqueci a senha" por (perfil, e-mail) a cada 15 min
// Piso de tempo das acoes publicas (18.1.2): toda falha de login e toda resposta de
// pedirRedefinicao levam pelo menos isto, para o tempo nao revelar se o e-mail existe.
// Calibrados no 18.2.1 (03/10/2026), no servidor real, 20 execucoes por caminho com o
// piso zerado: piso = maior p95 medido, arredondado para cima em 250 ms.
//   autenticar: sucesso v3 2007 ms · falha de senha 3328 · conta inexistente 1015 ·
//               sucesso com regravacao v2->v3 3083 (uma vez por conta)        -> 3500
//   pedirRedefinicao: conta existente 3330 + envio do e-mail 219 = 3549 ·
//               conta inexistente 490 · pedido repetido 42                     -> 3750
// Remedidos no 18.10 (03/10/2026), mesmo metodo, depois da memoria por chamada e do
// controle_id (menos leituras por login):
//   autenticar: sucesso v3 1393 ms · falha de senha 1363 · conta inexistente 834 ·
//               sucesso com regravacao v2->v3 2749 (uma vez por conta)        -> 2750
//   pedirRedefinicao: conta existente 3000 + envio do e-mail 219 = 3219 ·
//               conta inexistente 350 · pedido repetido 40                     -> 3250
// Refazer a medicao se o numero de leituras por login mudar.
var PISO_LOGIN_MS = 2750;
var PISO_REDEF_MS = 3250;
var COLUNAS_TOKENS = ['token_hash', 'tipo', 'sigla', 'profissional_id', 'finalidade', 'expira', 'usado', 'criado_em', 'email_destino'];

// Textos aprovados pelo usuario (PROMPT_18_1.md, 30/09/2026)
var MSG_SESSAO = 'Sua sessão expirou. Entre de novo para continuar.';
var MSG_LOGIN = 'E-mail ou senha incorretos.';
var MSG_BLOQUEIO = 'Muitas tentativas. Aguarde 15 minutos e tente de novo.';
var MSG_LINK = 'Este link não é mais válido. Peça um novo em "Esqueci a senha" ou fale com seu terapeuta.';
var MSG_REDEFINICAO = 'Se o e-mail estiver cadastrado, o link chegará em alguns minutos. Confira também a caixa de spam.';
var MSG_COTA_EMAIL = 'Limite diário de e-mails atingido. Use o botão WhatsApp ou tente amanhã.'; // texto do 18.1 (8.66)
var EMAIL_DESTAQUE = 'COGNIATIVO — Psicoterapia para além das sessões, com intervenções cognitivo-comportamentais no dia a dia.';
// 16.11: textos do e-mail em HTML (layout aprovado no Design em 10/10/2026, entrega marca_email; textos novos
// aprovados pelo usuario no Design). O texto puro (body) continua o mesmo de antes.
var EMAIL_HTML = {
  convite: { titulo: 'Seu acesso está pronto', previa: 'Crie sua senha para começar. O link vale por 48 horas.', botao: 'Criar minha senha' },
  redefinicao: { titulo: 'Redefinir a sua senha', previa: 'Crie uma senha nova. O link vale por 48 horas.', botao: 'Criar senha nova' }
};
var EMAIL_LINK_RESERVA = 'Se o botão não abrir, copie este endereço no navegador:';
var EMAIL_RODAPE = 'E-mail automático do COGNIATIVO.'; // 14.10.1: saiu "Não é preciso responder." — a resposta do paciente agora chega ao profissional
// 18.10: a assinatura deixou de ser fixa — e o nome (e o CRP, se houver) de quem assina,
// lido da planilha (_assinaturaDe_). 18.8.1: as linhas de formacao fixas sairam de todos os
// e-mails (decisao do usuario, 05/10): a assinatura e so nome + "Psicologo/Psicologa — CRP".

// ---------- funcoes puras (testadas em Node: scratchpad check_18_1.js) ----------

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

/** Telefone so com digitos; '' se vazio. */
function normalizarTelefone(tel) {
  return String(tel || '').replace(/\D/g, '');
}

/** Contato normalizado do paciente: {email, telefone} ou {erro}. Vazio e permitido. */
function normalizarContato(contato) {
  contato = contato || {};
  var email = normalizarEmail(contato.email);
  var telefone = normalizarTelefone(contato.telefone);
  if (email && !emailValido(email)) return { erro: 'E-mail inválido.' };
  if (telefone && telefone.length !== 10 && telefone.length !== 11) {
    return { erro: 'Telefone inválido: use DDD + número (10 ou 11 dígitos).' };
  }
  return { email: email, telefone: telefone };
}

function _hex_(bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var v = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    hex += (v < 16 ? '0' : '') + v.toString(16);
  }
  return hex;
}

function _bytesDeHex_(hex) {
  var out = [];
  for (var i = 0; i + 1 < hex.length; i += 2) {
    var v = parseInt(hex.substr(i, 2), 16);
    out.push(v > 127 ? v - 256 : v);
  }
  return out;
}

function _sha256Hex_(texto) {
  return _hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto), Utilities.Charset.UTF_8));
}

function _hmacHex_(mensagem, chave) {
  return _hex_(Utilities.computeHmacSha256Signature(String(mensagem), String(chave), Utilities.Charset.UTF_8));
}

/** Comparacao em tempo constante (mesmo custo qualquer que seja a primeira diferenca). */
function _iguaisTempoConstante_(a, b) {
  a = String(a || ''); b = String(b || '');
  var dif = a.length ^ b.length;
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) {
    dif |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  }
  return dif === 0;
}

function _aleatorioHex_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function _b64url_(dados) {
  var b64 = typeof dados === 'string'
    ? Utilities.base64EncodeWebSafe(dados, Utilities.Charset.UTF_8)
    : Utilities.base64EncodeWebSafe(dados);
  return b64.replace(/=+$/, '');
}

function _deB64url_(texto) {
  var s = String(texto);
  while (s.length % 4) s += '=';
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(s)).getDataAsString('UTF-8');
}

/**
 * Hash v2 (18.1): HMAC-SHA256 iterado, com a senha como chave e o sal como semente.
 * Desde o 18.2.1 so serve para CONFERIR senha ainda guardada em v2; nada mais grava v2.
 */
function _hashSenha_(senha, salHex, iter) {
  var bloco = String(salHex);
  for (var i = 0; i < iter; i++) bloco = _hmacHex_(bloco, senha);
  return 'v2$' + salHex + '$' + iter + '$' + bloco;
}

/**
 * Pimenta do hash de senha (18.2.1): segredo que mora so nas propriedades do script,
 * nunca nas planilhas, nos backups, no codigo ou em log. Separada de SEGREDO_SESSAO
 * (trocar o segredo de sessao nao invalida senhas). Sem ela nenhuma senha e gravada
 * nem conferida — o servidor nunca cai para v2 em silencio.
 */
function _pimentaSenha_() {
  return PropertiesService.getScriptProperties().getProperty('PIMENTA_SENHA');
}

/**
 * Hash v3: o mesmo HMAC-SHA256 iterado do v2, mas a chave e HMAC-SHA256(pimenta, senha)
 * em vez da senha crua. Quem tiver so a copia da planilha nao consegue testar senhas.
 */
function _hashSenhaV3_(senha, salHex, iter, pimenta) {
  var chave = _hmacHex_(String(senha), pimenta);
  var bloco = String(salHex);
  for (var i = 0; i < iter; i++) bloco = _hmacHex_(bloco, chave);
  return 'v3$' + salHex + '$' + iter + '$' + bloco;
}

/** Hash v3 de uma senha nova; '' (e log no servidor) se a pimenta nao estiver configurada. */
function gerarHashSenha(senha) {
  var pimenta = _pimentaSenha_();
  if (!pimenta) { console.error('gerarHashSenha: PIMENTA_SENHA ausente nas propriedades do script; senha nao gravada.'); return ''; }
  return _hashSenhaV3_(senha, _aleatorioHex_(), ITER_SENHA, pimenta);
}

/** Custo de uma conferencia real, para conta inexistente, sem senha ou com hash invalido. */
function _hashDeDescarte_(senha, pimenta) {
  _hashSenhaV3_(String(senha || ''), '0', ITER_SENHA, pimenta || '0');
}

/**
 * Confere a senha contra o hash guardado. Aceita v3 e v2 (o v1 morreu na virada do 18.1).
 * Sem pimenta configurada recusa tudo, inclusive v2, e registra no log do servidor.
 */
function conferirSenha(senha, guardado) {
  var pimenta = _pimentaSenha_();
  if (!pimenta) { console.error('conferirSenha: PIMENTA_SENHA ausente nas propriedades do script; senha nao conferida.'); return false; }
  var partes = String(guardado || '').split('$');
  var iter = parseInt(partes[2], 10);
  if (partes.length !== 4 || (partes[0] !== 'v3' && partes[0] !== 'v2') || !(iter > 0) || !senha) {
    // conta sem senha (convidada) ou hash invalido: mesmo custo de uma conferencia real
    _hashDeDescarte_(senha, pimenta);
    return false;
  }
  var calculado = partes[0] === 'v3' ? _hashSenhaV3_(String(senha), partes[1], iter, pimenta) : _hashSenha_(String(senha), partes[1], iter);
  return _iguaisTempoConstante_(calculado, String(guardado));
}

/**
 * Impressao da credencial no cracha (18.1.2): muda quando a senha muda e e
 * diferente numa conta recriada com a mesma sigla, derrubando crachas antigos.
 */
function impressaoCracha(senhaHash) {
  return _sha256Hex_('cracha|' + String(senhaHash || '')).slice(0, 16);
}

/** Cracha de sessao: dados = {tipo, sigla, profissional_id, impressao}; agoraMs = Date.now(). */
function emitirToken(dados, segredo, agoraMs) {
  var expira = agoraMs + SESSAO_HORAS * 3600 * 1000;
  var corpo = _b64url_([dados.tipo, dados.sigla, dados.profissional_id, expira, dados.impressao].join('|'));
  return corpo + '.' + _hmacHex_(corpo, segredo);
}

/** Le e confere a assinatura e a validade; devolve {tipo, sigla, profissional_id, expira, impressao} ou null. */
function lerToken(token, segredo, agoraMs) {
  if (!token || !segredo) return null;
  var partes = String(token).split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  if (!_iguaisTempoConstante_(_hmacHex_(partes[0], segredo), partes[1])) return null;
  var campos;
  try { campos = _deB64url_(partes[0]).split('|'); } catch (e) { return null; }
  if (campos.length !== 5) return null;
  var expira = parseInt(campos[3], 10);
  if (!(expira > agoraMs)) return null;
  if (PERFIS.indexOf(campos[0]) === -1 || !campos[1] || !campos[2] || !campos[4]) return null;
  return { tipo: campos[0], sigla: campos[1], profissional_id: campos[2], expira: expira, impressao: campos[4] };
}

/** Link de uso unico: 32 bytes aleatorios em base64url (o servidor guarda so o SHA-256). */
function gerarTokenLink() {
  return _b64url_(_bytesDeHex_(_aleatorioHex_() + _aleatorioHex_()));
}

/**
 * Sigla gerada para paciente novo: iniciais do nome (2-3 letras, sem acento,
 * sem "de/da/do/das/dos/e"); se colidir com `existentes` (lista em caixa alta),
 * acrescenta 2 caracteres aleatorios. Sempre dentro de ^[A-Z0-9_]{2,10}$.
 */
function gerarSiglaPaciente(nome, existentes, aleatorio) {
  aleatorio = aleatorio || Math.random;
  var limpo = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ');
  var palavras = limpo.split(/\s+/).filter(function (p) { return p && ['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'].indexOf(p) === -1; });
  var base;
  if (palavras.length === 0) base = 'PAC';
  else if (palavras.length === 1) base = palavras[0].slice(0, 2);
  else if (palavras.length === 2) base = palavras[0][0] + palavras[1][0];
  else base = palavras[0][0] + palavras[1][0] + palavras[palavras.length - 1][0];
  if (base.length < 2) base = (base + 'X').slice(0, 2);
  var usados = {};
  (existentes || []).forEach(function (x) { usados[String(x).toUpperCase()] = true; });
  if (!usados[base]) return base;
  var alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (var t = 0; t < 50; t++) {
    var cand = base + alfabeto[Math.floor(aleatorio() * alfabeto.length)] + alfabeto[Math.floor(aleatorio() * alfabeto.length)];
    if (!usados[cand]) return cand;
  }
  return null;
}

/** Escapador de HTML do backend (16.11; antes era local de montarEmail): & < > " ' */
function _escHtml_(t) {
  return String(t === undefined || t === null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Corpo dos e-mails (texto puro e HTML), com os textos aprovados.
 * 18.1.3: `profissionalNome` (opcional) acrescenta a linha "Acompanhamento com: <nome>"
 * — usada na redefinicao quando o mesmo e-mail tem conta com mais de um profissional.
 * 18.10: `assinatura` = linhas de quem assina (_assinaturaDe_): o profissional dono
 * do paciente; nos e-mails de profissional e de admin, o admin do sistema.
 * 16.11: o HTML segue o layout aprovado no Design (_layoutEmail_); o texto puro nao mudou.
 */
function montarEmail(tipoEmail, nome, link, profissionalNome, assinatura) {
  var linhasAssinatura = assinatura || [];
  var convite = tipoEmail === 'convite';
  var assunto = convite ? 'Seu acesso ao COGNIATIVO' : 'Redefinir a sua senha no COGNIATIVO';
  var ola = convite ? 'Olá, ' + nome + '.' : 'Olá.';
  var paragrafo = convite
    ? 'Seu acesso ao COGNIATIVO, o sistema de acompanhamento que usamos entre as sessões, está pronto. Para criar a sua senha, abra este link (ele vale por 48 horas e só funciona uma vez):'
    : 'Recebemos um pedido para redefinir a sua senha no COGNIATIVO. Para criar uma senha nova, abra este link (vale por 48 horas e só funciona uma vez):';
  var aviso = convite
    ? 'Se você não esperava este e-mail, ignore-o. Nada será alterado.'
    : 'Se você não pediu isso, ignore este e-mail. Sua senha atual continua a mesma.';
  var acompanhamento = profissionalNome ? 'Acompanhamento com: ' + profissionalNome : '';
  var texto = [EMAIL_DESTAQUE, '', ola, '', paragrafo]
    .concat(acompanhamento ? ['', acompanhamento] : [])
    .concat(['', link, '', aviso, ''])
    .concat(linhasAssinatura).join('\n');
  var h = EMAIL_HTML[convite ? 'convite' : 'redefinicao'];
  var html = _layoutEmail_({ previa: h.previa, titulo: h.titulo, acompanhamento: acompanhamento, ola: ola,
    paragrafo: paragrafo, botao: h.botao, link: link, aviso: aviso, assinatura: linhasAssinatura });
  return { assunto: assunto, texto: texto, html: html };
}

/**
 * 16.11: HTML do e-mail no layout do Design (entrega marca_email de 10/10/2026): tabelas com estilo
 * inline, 600 px no maximo, botao "a prova de balas", logo embutido como cid:logo (_enviarEmail_).
 * Todo texto passa por _escHtml_. Linhas opcionais: "Acompanhamento com:" e a segunda linha da assinatura.
 */
function _layoutEmail_(p) {
  var F = 'font-family:Figtree, Arial, Helvetica, sans-serif;';
  var esp = function (px) { return '<tr><td style="height:' + px + 'px;line-height:' + px + 'px;font-size:0">&nbsp;</td></tr>'; };
  var par = function (t, tam, alt, cor) { return '<tr><td><p style="margin:0;' + F + 'font-size:' + tam + 'px;line-height:' + alt + 'px;color:' + cor + ';">' + t + '</p></td></tr>'; };
  var link = _escHtml_(p.link);
  var ass = p.assinatura || [];
  var linhas = [
    '<!DOCTYPE html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light only">',
    '<meta name="supported-color-schemes" content="light only">',
    '<title>COGNIATIVO</title>',
    '</head>',
    '<body style="margin:0;padding:0;background-color:#F3F3F8;">',
    '<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:#F3F3F8;">' + _escHtml_(p.previa) + '</div>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F3F3F8" style="background-color:#F3F3F8;">',
    '<tr><td align="center" style="padding:28px 12px;">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">',
    '<tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #E2E1EE;border-radius:14px;padding:28px 32px 30px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">',
    '<tr><td><img src="cid:logo" alt="COGNIATIVO" width="240" height="56" style="display:block;border:0;outline:none;width:240px;height:56px;"></td></tr>',
    esp(26),
    '<tr><td><h1 style="margin:0;' + F + 'font-size:22px;line-height:28px;font-weight:600;color:#1D1B2B;">' + _escHtml_(p.titulo) + '</h1></td></tr>'
  ];
  if (p.acompanhamento) {
    linhas.push(esp(12));
    linhas.push('<tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#E7E6F5" style="background-color:#E7E6F5;border-radius:16px;padding:7px 12px;' + F + 'font-size:13px;line-height:18px;font-weight:600;color:#3D3A6B;">' + _escHtml_(p.acompanhamento) + '</td></tr></table></td></tr>');
  }
  linhas.push(esp(14), par(_escHtml_(p.ola), 15, 23, '#3F3C52'));
  if (p.paragrafo || !p.linhas) linhas.push(esp(10), par(_escHtml_(p.paragrafo), 15, 23, '#3F3C52'));
  // Fase 20: corpo em varias linhas (o demonstrativo da cobranca), cada uma escapada
  if (p.linhas && p.linhas.length) linhas.push(esp(10), par(p.linhas.map(function (l) { return _escHtml_(l); }).join('<br>'), 15, 23, '#3F3C52'));
  // 20.2: grade opcional (cabecalho + linhas), toda celula escapada — a agenda que vai ao profissional
  if (p.tabela && p.tabela.linhas && p.tabela.linhas.length) {
    var cel = 'padding:8px 8px;border-bottom:1px solid #E2E1EE;text-align:left;vertical-align:top;' + F + 'font-size:14px;line-height:20px;';
    // celula [principal, secundario]: a segunda linha vai menor e mais clara (cabe na largura de um telefone)
    var conteudo = function (c) { return Array.isArray(c) ? _escHtml_(c[0]) + '<br><span style="font-size:13px;line-height:18px;color:#5E5B73;">' + _escHtml_(c[1]) + '</span>' : _escHtml_(c); };
    linhas.push(esp(14), '<tr><td><table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #E2E1EE;">' +
      '<tr>' + p.tabela.cab.map(function (c) { return '<th bgcolor="#F3F3F8" style="' + cel + 'background-color:#F3F3F8;font-weight:600;color:#3D3A6B;">' + _escHtml_(c) + '</th>'; }).join('') + '</tr>' +
      p.tabela.linhas.map(function (l) { return '<tr>' + l.map(function (c) { return '<td style="' + cel + 'color:#1D1B2B;">' + conteudo(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</table></td></tr>');
  }
  // 14.5: segundo link do e-mail de sessao (endereco no mapa ou sala do Meet)
  if (p.linkExtra && p.linkExtra.url) linhas.push(esp(10), par('<a href="' + _escHtml_(p.linkExtra.url) + '" target="_blank" style="color:#4C4A8F;text-decoration:underline;font-weight:600;">' + _escHtml_(p.linkExtra.rotulo) + '</a>', 15, 23, '#3F3C52'));
  if (!p.semBotao) { // Fase 20: a cobranca vai sem botao (quem paga pode nao ter acesso)
  linhas.push(esp(22));
  linhas.push('<tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#4C4A8F" style="background-color:#4C4A8F;border-radius:999px;"><a href="' + link + '" target="_blank" style="display:block;' + F + 'font-size:15px;line-height:16px;font-weight:600;color:#FFFFFF;text-decoration:none;padding:14px 26px;border-radius:999px;">' + _escHtml_(p.botao) + '</a></td></tr></table></td></tr>');
  if (p.sobBotao) linhas.push(esp(12), par(_escHtml_(p.sobBotao), 13, 20, '#5E5B73')); // 19.2.1: linha sob o botao (lembrete)
  linhas.push(esp(18), par(_escHtml_(EMAIL_LINK_RESERVA) + '<br><a href="' + link + '" target="_blank" style="color:#4C4A8F;text-decoration:underline;word-break:break-all;">' + link + '</a>', 13, 20, '#5E5B73'));
  }
  linhas.push(esp(24), '<tr><td><div style="height:1px;line-height:1px;font-size:0;background-color:#E2E1EE;">&nbsp;</div></td></tr>', esp(24));
  linhas.push(par(_escHtml_(p.aviso), 13, 20, '#5E5B73'));
  if (ass.length) {
    linhas.push(esp(18), par('<strong>' + _escHtml_(ass[0]) + '</strong>' +
      (ass[1] ? '<br><span style="font-size:13px;line-height:20px;color:#5E5B73;">' + _escHtml_(ass[1]) + '</span>' : ''), 15, 22, '#1D1B2B'));
  }
  linhas.push(
    '</table>',
    '</td></tr>',
    '<tr><td align="center" style="padding:18px 20px 0;">',
    '<p style="margin:0;' + F + 'font-size:12px;line-height:18px;color:#6E6B80;text-align:center;">' + _escHtml_(EMAIL_DESTAQUE) + '<br>' + _escHtml_(EMAIL_RODAPE) + '</p>',
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>');
  return linhas.join('\n');
}

/** Genero como o sistema o guarda: 'M', 'F' ou '' (sem escolha = textos no masculino, como sempre foi). */
function _generoDe_(v) {
  var g = String(v === undefined || v === null ? '' : v).trim().toUpperCase();
  return g === 'M' || g === 'F' ? g : '';
}

/**
 * Linhas da assinatura: nome e, se houver CRP, "Psicólogo — CRP <numero>" ou, com
 * genero 'F' (18.8.1), "Psicóloga — CRP <numero>".
 */
function _assinaturaDe_(nome, crp, genero) {
  var n = String(nome || '').trim();
  if (!n) return [];
  var c = String(crp || '').trim().replace(/^crp\s*/i, '');
  return c ? [n, (_generoDe_(genero) === 'F' ? 'Psicóloga' : 'Psicólogo') + ' — CRP ' + c] : [n];
}

/** Assinatura do profissional (aba Profissionais: nome_completo, crp e genero, se as colunas existirem). */
function _assinaturaDoProfissional_(profissionalId) {
  var prof = buscarProfissional(profissionalId);
  return prof ? _assinaturaDe_(prof.nome_completo, prof.crp, prof.genero) : [];
}

/**
 * Assinatura dos e-mails de profissional e de admin: o primeiro admin ativo (aba Admins).
 * 18.8.1: so o nome — o admin e o controlador do sistema, nao psicologo (sem CRP e sem genero).
 */
function _assinaturaDoSistema_() {
  var admins = lerAbaComoObjetos(_abrirPlanilha_(SISTEMA_VMC_ID), ABA_ADMINS);
  for (var i = 0; i < admins.length; i++) {
    if (_estaAtivo_(admins[i].ativo)) return _assinaturaDe_(admins[i].nome_completo);
  }
  return [];
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

// ---------- planilhas: celulas seguras, colunas, indice e tokens ----------

/**
 * 18.2 — trava unica de gravacao: todo valor vindo de quem digita passa por aqui
 * antes de setValue/setValues/appendRow. So age em string: se comeca com = + - @,
 * tab, retorno de carro ou apostrofo, ganha um apostrofo na frente — o Sheets guarda
 * o texto como digitado (o apostrofo some na leitura) e nunca o trata como formula.
 * Numero, booleano, Date, null e vazio passam intactos (notas e intensidades seguem
 * numeros). Valor que o SERVIDOR ja montou com apostrofo nao passa por aqui (ganharia
 * um segundo, que ficaria gravado): ver `camposServidor` em _atualizarLinhaPorChave_.
 */
function _celulaSegura_(v) {
  if (typeof v !== 'string') return v;
  return /^[=+\-@\t\r']/.test(v) ? "'" + v : v;
}

/**
 * 18.2 (decisao 1b) — colunas de TEXTO LIVRE, pelo nome do cabecalho: o que a pessoa
 * digita num campo aberto fica como digitado. Sem isto o Sheets retipa ("10/10" e
 * "1-2" viram data, "13:00" vira hora, "0123" vira 123 — medido em 03/10). Sao: todas
 * as colunas da Anamnese menos timestamp, versao_formulario e data_nascimento; os
 * campos abertos do registro (humor_observacoes e os *_o_que); os dois campos abertos
 * das escalas; nome, nome_completo, observacoes e crp dos cadastros. FORA (seguem so
 * com a regra dos caracteres perigosos): toda coluna que alguma leitura trata como
 * data, hora ou numero — data_*, hora_registro, humor_nivel, itens e escores das
 * escalas — e as colunas estruturadas (subgrupos do registro, *_preenchido, faixa,
 * instrumento, alertas, lock e auditoria).
 */
var COLUNAS_TEXTO_LIVRE_FORA_ANAMNESE = ['timestamp', 'versao_formulario', 'data_nascimento'];
var COLUNAS_TEXTO_LIVRE_AVULSAS = ['nome', 'observacoes', 'crp', 'humor_observacoes', 'item_funcional_texto', 'ind_nome',
  'valor_anterior', // 18.6: Anamnese_Historico
  'criado_por_nome']; // 18.6.2

function _colunaTextoLivre_(col) {
  var c = String(col);
  if (COLUNAS_TEXTO_LIVRE_AVULSAS.indexOf(c) !== -1 || /_o_que$/.test(c)) return true;
  return HEADERS_ANAMNESE.indexOf(c) !== -1 && COLUNAS_TEXTO_LIVRE_FORA_ANAMNESE.indexOf(c) === -1;
}

/**
 * Valor pronto para a celula da coluna `col`: em coluna de texto livre ou de
 * identificacao (_colunaTexto_), toda string nao vazia ganha o apostrofo (texto
 * literal); nas demais vale so a _celulaSegura_. Numero, booleano, Date, null e vazio
 * passam intactos. O apostrofo e a protecao de fato: appendRow IGNORA o formato @ da
 * coluna e ainda o desfaz na linha nova (medido em 03/10) — o formato sozinho so
 * segura setValue em linha que ja existia.
 */
function _celulaTexto_(col, v) {
  if (typeof v === 'string' && v !== '' && (_colunaTextoLivre_(col) || _colunaTexto_(col))) return "'" + v;
  return _celulaSegura_(v);
}

/**
 * 18.2 — colunas de identificacao gravadas como TEXTO (formato @): o Sheets retipa
 * texto literal (sigla "1E5" vira numero, CPF e CEP perdem o zero, "2026-10" vira
 * data — licao 105). Vale pelo NOME do cabecalho. Fora: coluna de data, hora ou
 * numero que alguma leitura trate como Date ou use em conta. O formato vale para as
 * linhas que ja existem e para setValue; linha nova (appendRow) depende do apostrofo
 * de _celulaTexto_, que cobre estas mesmas colunas.
 */
var COLUNAS_TEXTO = ['sigla', 'profissional_id', 'email', 'telefone', 'cep', 'zip_code', 'cpf', 'rg',
  'email_destino', 'aceite_politica_em', 'aceite_politica_versao',
  'controle_id', 'id_envio', 'ind_atualizado_em', 'atualizado_em']; // 18.10

function _colunaTexto_(col) {
  var c = String(col);
  return COLUNAS_TEXTO.indexOf(c) !== -1 || /_(email|telefone)$/.test(c);
}

/**
 * Aplica o formato @ nas colunas de identificacao da aba, pelo cabecalho. So nos
 * caminhos que CRIAM aba ou coluna — nenhuma gravacao paga por isso.
 */
function _formatarColunasTexto_(aba, header) {
  for (var i = 0; i < header.length; i++) {
    if (_colunaTexto_(header[i])) aba.getRange(1, i + 1, aba.getMaxRows(), 1).setNumberFormat('@');
  }
}

/** Garante as colunas em `lista` no cabecalho da aba (aditivo); devolve o cabecalho. */
function _garantirColunas_(aba, lista) {
  // 14.12: o cabecalho de cada aba e lido uma vez por chamada (a memoria so acerta com a mesma instancia da aba — ver _ageAba_)
  var guardado = _MEMO_.age ? _MEMO_.age.cabs.get(aba) : null;
  var header = guardado;
  if (!header) {
    var ultima = Math.max(aba.getLastColumn(), 1);
    header = aba.getRange(1, 1, 1, ultima).getValues()[0];
    if (header.length === 1 && header[0] === '') header = [];
    if (_MEMO_.age) _MEMO_.age.cabs.set(aba, header);
  }
  lista.forEach(function (col) {
    if (header.indexOf(col) === -1) {
      header.push(col);
      aba.getRange(1, header.length).setValue(col).setFontWeight('bold');
      // 18.2: coluna de identificacao ja nasce como texto
      if (_colunaTexto_(col)) aba.getRange(1, header.length, aba.getMaxRows(), 1).setNumberFormat('@');
    }
  });
  return header;
}

/** Grava uma linha nova pelo nome do cabecalho (campos ausentes ficam vazios). */
function _anexarPorCabecalho_(aba, header, valores) {
  _memoEsquecerPacientes_(); // 14.12: linha nova (pode ser um paciente)
  aba.appendRow(header.map(function (col) { return valores[col] !== undefined ? _celulaTexto_(col, valores[col]) : ''; }));
}

function _abaIndice_() {
  var aba = _abrirPlanilha_(SISTEMA_VMC_ID).getSheetByName(ABA_INDICE_SIGLAS);
  _garantirColunas_(aba, ['sigla_global', 'sigla', 'tipo', 'profissional_id', 'data_cadastro', 'email']);
  return aba;
}

function _anexarIndice_(sigla, tipo, profissionalId, email) {
  var aba = _abaIndice_();
  var header = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  _anexarPorCabecalho_(aba, header, {
    sigla_global: sigla + '|' + tipo + '|' + profissionalId,
    sigla: sigla, tipo: tipo, profissional_id: profissionalId,
    data_cadastro: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd'),
    email: normalizarEmail(email)
  });
  _memoEsquecerIndice_();
  // 18.11: conta nova — nada de uma conta antiga com a mesma sigla (ou o mesmo id) fica no cache do script
  var chavesNovas = [_chavePortao_(tipo, sigla, profissionalId)];
  if (tipo === 'paciente') chavesNovas.push('dono:' + _siglaChave_(sigla), 'planilha:' + _siglaChave_(sigla));
  if (tipo === 'profissional') chavesNovas.push('controle:' + String(profissionalId).trim());
  _cacheEsquecer_(chavesNovas);
}

/** Linhas do Indice como objetos {linha, sigla, tipo, profissional_id, email}. */
function _lerIndice_() {
  var aba = _abaIndice_();
  var dados = aba.getDataRange().getValues();
  var h = dados[0];
  var iS = h.indexOf('sigla'), iT = h.indexOf('tipo'), iP = h.indexOf('profissional_id'), iE = h.indexOf('email');
  var out = [];
  for (var i = 1; i < dados.length; i++) {
    out.push({
      linha: i + 1,
      sigla: String(dados[i][iS] || '').trim().toUpperCase(),
      tipo: String(dados[i][iT] || '').trim().toLowerCase(),
      profissional_id: String(dados[i][iP] || '').trim(),
      email: normalizarEmail(dados[i][iE])
    });
  }
  return { aba: aba, header: h, linhas: out };
}

/** Todas as contas do perfil com aquele e-mail. 18.1.3: um e-mail de paciente pode ter uma conta por profissional. */
function _contasPorEmail_(tipo, email) {
  // 18.11: so leitura — o Indice vem de _indiceValores_ (lido uma vez por chamada, sem conferir colunas)
  var dados = _indiceValores_();
  var out = [];
  if (!dados || dados.length < 2) return out;
  var h = dados[0];
  var iS = h.indexOf('sigla'), iT = h.indexOf('tipo'), iP = h.indexOf('profissional_id'), iE = h.indexOf('email');
  if (iS === -1 || iT === -1 || iP === -1 || iE === -1) return out;
  for (var i = 1; i < dados.length; i++) {
    var mail = normalizarEmail(dados[i][iE]);
    if (String(dados[i][iT] || '').trim().toLowerCase() !== tipo || !mail || mail !== email) continue;
    out.push({ linha: i + 1, sigla: String(dados[i][iS] || '').trim().toUpperCase(), tipo: tipo,
      profissional_id: String(dados[i][iP] || '').trim(), email: mail });
  }
  return out;
}

/** Primeira conta do perfil com aquele e-mail (profissional e admin: no máximo uma). */
function _contaPorEmail_(tipo, email) {
  var contas = _contasPorEmail_(tipo, email);
  return contas.length ? contas[0] : null;
}

/**
 * Grava o e-mail de (sigla, tipo) no Indice. Recusa e-mail ja usado por outra conta
 * do mesmo perfil — para paciente (18.1.3), so entre os pacientes do MESMO
 * profissional (a recusa global revelava a um profissional que a pessoa ja era
 * paciente de outro); para profissional e admin a unicidade segue global.
 */
function _gravarEmailIndice_(sigla, tipo, email) {
  var idx = _lerIndice_();
  var siglaU = String(sigla).toUpperCase();
  var alvo = null;
  for (var i = 0; i < idx.linhas.length; i++) {
    if (idx.linhas[i].tipo === tipo && idx.linhas[i].sigla === siglaU) { alvo = idx.linhas[i]; break; }
  }
  if (!alvo) return { ok: false, erro: 'Conta não encontrada no índice.' };
  for (var j = 0; j < idx.linhas.length; j++) {
    var o = idx.linhas[j];
    if (o.tipo !== tipo || o.sigla === siglaU || !email || o.email !== email) continue;
    if (tipo === 'paciente' && o.profissional_id !== alvo.profissional_id) continue;
    return { ok: false, erro: 'Este e-mail já está em uso por outra conta.' };
  }
  idx.aba.getRange(alvo.linha, idx.header.indexOf('email') + 1).setValue(_celulaTexto_('email', email));
  _memoEsquecerIndice_();
  _portaoEsquecer_([alvo]); // 18.11: e-mail da conta mudou
  return { ok: true, mudou: alvo.email !== normalizarEmail(email) };
}

/**
 * Atualiza colunas de uma linha localizada por `chave` = valor (comparacao sem caixa).
 * `campos` passa pela trava (_celulaTexto_). `camposServidor` (opcional, 18.2) e
 * gravado como veio: so para valor montado pelo servidor que ja traz o proprio
 * apostrofo (aceite da politica) — a trava lhe daria um segundo.
 */
function _atualizarLinhaPorChave_(aba, colChave, valorChave, campos, camposServidor) {
  _memoEsquecerPacientes_(); // 14.12: a linha de um cadastro mudou
  var doServidor = camposServidor || {};
  var header = _garantirColunas_(aba, Object.keys(campos).concat(Object.keys(doServidor)));
  var dados = aba.getDataRange().getValues();
  var iChave = header.indexOf(colChave);
  if (iChave === -1) return false;
  var alvo = String(valorChave).trim().toUpperCase();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][iChave]).trim().toUpperCase() === alvo) {
      for (var col in campos) aba.getRange(i + 1, header.indexOf(col) + 1).setValue(_celulaTexto_(col, campos[col]));
      for (var colS in doServidor) aba.getRange(i + 1, header.indexOf(colS) + 1).setValue(doServidor[colS]);
      return true;
    }
  }
  return false;
}

function _abaTokens_() {
  var planilha = _abrirPlanilha_(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_TOKENS);
  if (!aba) aba = planilha.insertSheet(ABA_TOKENS);
  _garantirColunas_(aba, COLUNAS_TOKENS);
  return aba;
}

function _expiraMs_(valor) {
  return valor instanceof Date ? valor.getTime() : Date.parse(String(valor));
}

/**
 * Gera um link de uso unico (48 h) para (tipo, sigla), preso ao e-mail de destino.
 * 18.1.2: os links pendentes da conta coexistem (e-mail e WhatsApp); o uso de um
 * invalida os outros (_invalidarLinks_). Teto de LINKS_PENDENTES_MAX: o mais antigo
 * vira 'substituido'. Linhas vencidas ha mais de LINKS_GUARDA_DIAS saem da aba.
 */
function _criarLinkAtivacao_(tipo, sigla, profissionalId, finalidade, emailDestino) {
  var aba = _abaTokens_();
  var dados = aba.getDataRange().getValues();
  var h = dados[0];
  var iT = h.indexOf('tipo'), iS = h.indexOf('sigla'), iU = h.indexOf('usado'), iE = h.indexOf('expira');
  var agora = new Date();
  var siglaU = String(sigla).toUpperCase();
  var limite = agora.getTime() - LINKS_GUARDA_DIAS * 24 * 3600 * 1000;
  var pendentes = [], velhas = [];
  for (var i = 1; i < dados.length; i++) {
    var expira = _expiraMs_(dados[i][iE]);
    if (expira < limite) velhas.push(i + 1);
    else if (String(dados[i][iT]) === tipo && String(dados[i][iS]).toUpperCase() === siglaU && !String(dados[i][iU]) && expira > agora.getTime()) {
      pendentes.push({ linha: i + 1, expira: expira });
    }
  }
  // Primeiro marca (linhas ainda nas posicoes lidas), depois apaga de baixo para cima.
  pendentes.sort(function (a, b) { return a.expira - b.expira; });
  var aDerrubar = pendentes.length - (LINKS_PENDENTES_MAX - 1);
  for (var k = 0; k < aDerrubar; k++) aba.getRange(pendentes[k].linha, iU + 1).setValue('substituido');
  for (var v = velhas.length - 1; v >= 0; v--) aba.deleteRow(velhas[v]);
  var bruto = gerarTokenLink();
  _anexarPorCabecalho_(aba, h, {
    token_hash: _sha256Hex_(bruto), tipo: tipo, sigla: siglaU,
    profissional_id: profissionalId, finalidade: finalidade,
    expira: new Date(agora.getTime() + LINK_HORAS * 3600 * 1000).toISOString(),
    usado: '', criado_em: agora.toISOString(), email_destino: normalizarEmail(emailDestino)
  });
  return SITE_URL + '?ativar=' + bruto;
}

/** Marca como 'substituido' todo link ainda nao usado de (tipo, sigla). */
function _invalidarLinks_(tipo, sigla) {
  var aba = _abaTokens_();
  var dados = aba.getDataRange().getValues();
  var h = dados[0];
  var iT = h.indexOf('tipo'), iS = h.indexOf('sigla'), iU = h.indexOf('usado');
  var siglaU = String(sigla || '').toUpperCase();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][iT]) === tipo && String(dados[i][iS]).toUpperCase() === siglaU && !String(dados[i][iU])) {
      aba.getRange(i + 1, iU + 1).setValue('substituido');
    }
  }
}

/** Anula um link recem-criado cujo e-mail nao saiu (nao fica pendente a toa). */
function _anularLink_(url) {
  var link = _linkValido_(_brutoDoLink_(url));
  if (link) link.aba.getRange(link.linha, link.colUsado).setValue('substituido');
}

function _brutoDoLink_(url) {
  var m = String(url || '').match(/[?&]ativar=([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
}

/** Localiza o link pelo token bruto; devolve {linha, tipo, sigla, profissional_id, email_destino} se valido. */
function _linkValido_(bruto) {
  if (!bruto) return null;
  var aba = _abaTokens_();
  var dados = aba.getDataRange().getValues();
  var h = dados[0];
  var alvo = _sha256Hex_(String(bruto));
  var iH = h.indexOf('token_hash'), iE = h.indexOf('expira'), iU = h.indexOf('usado');
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][iH]) !== alvo) continue;
    var expira = _expiraMs_(dados[i][iE]);
    if (String(dados[i][iU]) || !(expira > Date.now())) return null;
    return {
      aba: aba, linha: i + 1, colUsado: iU + 1,
      tipo: String(dados[i][h.indexOf('tipo')]),
      sigla: String(dados[i][h.indexOf('sigla')]),
      profissional_id: String(dados[i][h.indexOf('profissional_id')]),
      email_destino: normalizarEmail(dados[i][h.indexOf('email_destino')])
    };
  }
  return null;
}

// ---------- contas: leitura do registro de cada perfil ----------

/**
 * Criterio unico de `ativo` (18.1.2): true, 'sim', 's', 'true' (sem caixa e sem
 * espacos) = ativo; todo o resto, inclusive vazio, false, 'nao', 'não' = inativo.
 */
function _estaAtivo_(v) {
  if (v === true) return true;
  return ['sim', 's', 'true'].indexOf(String(v === undefined || v === null ? '' : v).trim().toLowerCase()) !== -1;
}

/** `ativo` como o cliente sempre recebe: 'Sim' ou 'Nao'. */
function _ativoParaCliente_(v) {
  return _estaAtivo_(v) ? 'Sim' : 'Nao';
}

/** Registro da conta (tipo, sigla, profissional_id): {ativo, senha_hash, nome, email, extra} ou null. */
function _registroDaConta_(tipo, sigla, profissionalId) {
  if (tipo === 'paciente') {
    var pac = buscarPaciente(sigla);
    if (!pac || pac.__profissional_id !== profissionalId) return null;
    var dono = buscarProfissional(profissionalId);
    var ativoPac = _estaAtivo_(pac.ativo) && !!dono && _estaAtivo_(dono.ativo);
    return {
      ativo: ativoPac, senha_hash: pac.senha_hash, nome: pac.nome || '', email: normalizarEmail(pac.email),
      extra: {
        anamnese_preenchida: pac.data_anamnese !== '' && pac.data_anamnese !== null, data_anamnese: pac.data_anamnese,
        // 18.1.6: so o proprio paciente ve, e so como verdadeiro/falso
        aceite_pendente: String(pac.aceite_politica_versao || '') !== POLITICA_VERSAO
      }
    };
  }
  if (tipo === 'profissional') {
    var prof = buscarProfissional(profissionalId);
    if (!prof || String(prof.sigla).trim().toUpperCase() !== String(sigla).toUpperCase()) return null;
    return {
      ativo: _estaAtivo_(prof.ativo), senha_hash: prof.senha_hash,
      nome: prof.nome_completo || '', email: normalizarEmail(prof.email),
      extra: { profissional_id: prof.profissional_id, nome_completo: prof.nome_completo, genero: _generoDe_(prof.genero) } // 18.8.1
    };
  }
  if (tipo === 'admin') {
    var adm = buscarAdmin(profissionalId);
    if (!adm || String(adm.sigla).trim().toUpperCase() !== String(sigla).toUpperCase()) return null;
    return {
      ativo: _estaAtivo_(adm.ativo), senha_hash: adm.senha_hash,
      nome: adm.nome_completo || '', email: normalizarEmail(adm.email),
      extra: { admin_id: adm.admin_id, nome_completo: adm.nome_completo }
    };
  }
  return null;
}

/** Grava `hash` na linha da conta (so a celula senha_hash). Devolve true se gravou. */
function _gravarHashDaConta_(tipo, sigla, profissionalId, hash) {
  var gravou = false;
  if (tipo === 'paciente') {
    var controle = abrirControleDoProfissional(profissionalId);
    gravou = !!controle && _atualizarLinhaPorChave_(controle.getSheetByName(ABA_PACIENTES), 'sigla', sigla, { senha_hash: hash });
  } else {
    var global = _abrirPlanilha_(SISTEMA_VMC_ID);
    if (tipo === 'profissional') gravou = _atualizarLinhaPorChave_(global.getSheetByName(ABA_PROFISSIONAIS), 'profissional_id', profissionalId, { senha_hash: hash });
    if (tipo === 'admin') gravou = _atualizarLinhaPorChave_(global.getSheetByName(ABA_ADMINS), 'admin_id', profissionalId, { senha_hash: hash });
  }
  // 18.11: credencial nova — o portao em cache desta conta cai na hora (o cracha antigo e recusado na chamada seguinte)
  if (gravou) _portaoEsquecer_([{ tipo: tipo, sigla: sigla, profissional_id: profissionalId }]);
  return gravou;
}

/**
 * Troca de senha: grava o hash v3 da senha na linha da conta e invalida os links
 * pendentes dela. Devolve o hash gravado (para o cracha novo) ou false.
 */
function _gravarSenhaDaConta_(tipo, sigla, profissionalId, senha) {
  var hash = gerarHashSenha(senha);
  if (!hash || !_gravarHashDaConta_(tipo, sigla, profissionalId, hash)) return false;
  _invalidarLinks_(tipo, sigla);
  return hash;
}

// ---------- cracha ----------

function _segredoSessao_() {
  return PropertiesService.getScriptProperties().getProperty('SEGREDO_SESSAO');
}

function _respostaSessaoExpirada_() {
  return { ok: false, codigo: 'sessao_expirada', erro: MSG_SESSAO };
}

/** Confere o cracha e o `ativo` da conta; devolve a sessao {tipo, sigla, profissional_id, ...} ou null. */
function _validarToken_(token) {
  // Assinatura e validade primeiro, sempre: cracha adulterado ou expirado nem chega ao cache.
  var dados = lerToken(token, _segredoSessao_(), Date.now());
  if (!dados) return null;
  // 18.11 (8.90): a conferencia de conta ativa feita na planilha vale por ate PORTAO_CACHE_SEG no
  // cache do script, por conta, junto com a impressao da credencial que conferiu. So entra no
  // cache o que a planilha aprovou; cracha de outra credencial nao bate com o guardado e vai a
  // planilha. Toda acao do sistema que muda senha, e-mail, `ativo` ou exclui a conta solta a
  // chave na hora (_portaoEsquecer_) — o atraso de ate 5 min so existe para edicao feita direto
  // na planilha. A mesma ida ao cache ja traz o que a acao vai pedir (Controle e dono).
  var chavePortao = _chavePortao_(dados.tipo, dados.sigla, dados.profissional_id);
  var chaves = [chavePortao];
  if (dados.tipo !== 'admin') chaves.push('controle:' + String(dados.profissional_id).trim());
  if (dados.tipo === 'paciente') chaves.push('dono:' + _siglaChave_(dados.sigla));
  _cacheLerVarias_(chaves);
  var guardado = _portaoConfere_(_cacheLer_(chavePortao), dados.impressao);
  if (guardado) {
    dados.nome = guardado.nome;
    dados.email = guardado.email;
    return dados;
  }
  var reg = _registroDaConta_(dados.tipo, dados.sigla, dados.profissional_id);
  if (!reg || !reg.ativo) return null;
  if (!_iguaisTempoConstante_(impressaoCracha(reg.senha_hash), dados.impressao)) return null;
  _cacheGuardar_(chavePortao, _valorPortao_(reg), PORTAO_CACHE_SEG);
  dados.nome = reg.nome;
  dados.email = reg.email;
  return dados;
}

/** null se a sessao for do perfil exigido; senao a resposta de sessao expirada. */
function _exigir_(s, tipo) {
  return (s && s.tipo === tipo) ? null : _respostaSessaoExpirada_();
}

/** Auth no formato antigo das funcoes prof* ({ok, profissional:{profissional_id, sigla, ...}}). */
function _authProfissional_(s) {
  if (!s || s.tipo !== 'profissional') return _respostaSessaoExpirada_();
  return { ok: true, profissional: { profissional_id: s.profissional_id, sigla: s.sigla, nome_completo: s.nome, email: s.email } };
}

/** Admin da sessao (objeto da aba Admins) ou null. */
function _admDaSessao_(s) {
  if (!s || s.tipo !== 'admin') return null;
  return buscarAdmin(s.profissional_id);
}

/** Sigla do paciente para leituras abertas a paciente e profissional (lerEditandoAuto). */
function _siglaAlvoLeitura_(s, siglaPayload) {
  if (!s) return null;
  if (s.tipo === 'paciente') return s.sigla;
  if (s.tipo === 'profissional' && siglaPayload && resolverProfissionalIdPorSigla(siglaPayload, 'paciente') === s.profissional_id) return siglaPayload;
  return null;
}

// ---------- acoes publicas ----------

/**
 * Login por perfil + e-mail + senha.
 * Saida: { ok:true, token, perfil:{tipo, sigla, nome, email, ...} } ou
 *        { ok:false, erro } (mensagem unica, tambem para conta inativa).
 */
/** Completa a resposta ate `pisoMs` desde t0 (o tempo nao revela qual caminho rodou). */
function _completarPiso_(t0, pisoMs, resposta) {
  var falta = pisoMs - (Date.now() - t0);
  if (falta > 0) Utilities.sleep(falta);
  return resposta;
}

/** Identificador opaco de uma conta na escolha do login (18.1.3): nao expoe sigla nem profissional_id. */
function _idEscolha_(tipo, email, conta, segredo) {
  return _hmacHex_(['escolha', tipo, email, conta.sigla, conta.profissional_id].join('|'), segredo).slice(0, 16);
}

function autenticar(tipo, email, senha, escolha) {
  var t0 = Date.now();
  var falha = function (r) { return _completarPiso_(t0, PISO_LOGIN_MS, r || { ok: false, erro: MSG_LOGIN }); };
  var t = String(tipo || '').trim().toLowerCase();
  var e = normalizarEmail(email);
  if (PERFIS.indexOf(t) === -1 || !e || !senha) return falha();
  if (String(senha).length > SENHA_MAXIMA) return falha();

  // A tranca 5 falhas -> 15 min fica (decisao do usuario, 02/10: risco aceito de um
  // terceiro trancar a conta alheia). falhas + 1 e gravado ANTES de conferir a senha,
  // para tentativas em paralelo nao lerem todas o mesmo valor; o acerto remove a chave.
  // 18.2.1: sem a pimenta nenhuma senha e conferida (erro generico; o motivo vai para o log)
  var pimenta = _pimentaSenha_();
  if (!pimenta) { console.error('autenticar: PIMENTA_SENHA ausente nas propriedades do script.'); return falha(); }

  var cache = CacheService.getScriptCache();
  var chave = 'falha:' + t + ':' + e;
  var falhas = parseInt(cache.get(chave) || '0', 10);
  if (falhas >= FALHAS_MAX) return falha({ ok: false, codigo: 'bloqueado', erro: MSG_BLOQUEIO });
  cache.put(chave, String(falhas + 1), BLOQUEIO_SEG);

  // 18.1.3: o e-mail de paciente pode ter uma conta por profissional — a senha decide.
  // A senha e conferida em TODAS as contas ativas; a resposta de falha e a mesma de
  // sempre (mensagem e piso de tempo), sem revelar quantas contas existem.
  var contas = _contasPorEmail_(t, e);
  var acertos = [];
  for (var i = 0; i < contas.length; i++) {
    var r = _registroDaConta_(t, contas[i].sigla, contas[i].profissional_id);
    if (r && r.ativo && conferirSenha(senha, r.senha_hash)) acertos.push({ conta: contas[i], reg: r });
  }
  if (!contas.length) _hashDeDescarte_(senha, pimenta); // sem conta: custo de uma conferencia real (caminho v3)
  if (!acertos.length) return falha();

  var segredo = _segredoSessao_();
  if (!segredo) return { ok: false, erro: 'Servidor sem segredo de sessão.' };

  var alvo = null;
  if (escolha !== undefined && escolha !== null && escolha !== '') {
    // 2a chamada: a senha foi conferida de novo acima; a escolha aponta a conta.
    for (var j = 0; j < acertos.length; j++) {
      if (_iguaisTempoConstante_(_idEscolha_(t, e, acertos[j].conta, segredo), String(escolha))) { alvo = acertos[j]; break; }
    }
    if (!alvo) return falha(); // escolha invalida conta como falha (o falhas+1 la de cima fica)
  } else if (acertos.length === 1) {
    alvo = acertos[0];
  } else {
    // mais de uma conta confere: NENHUM cracha sai; o cliente pergunta o profissional.
    cache.remove(chave); // a senha esta certa — nao e falha
    var opcoes = [];
    for (var m = 0; m < acertos.length; m++) {
      var dono = buscarProfissional(acertos[m].conta.profissional_id);
      opcoes.push({
        id: _idEscolha_(t, e, acertos[m].conta, segredo),
        profissional: dono && dono.nome_completo ? String(dono.nome_completo) : 'Profissional'
      });
    }
    return { ok: false, codigo: 'escolher', opcoes: opcoes };
  }
  cache.remove(chave);

  var conta = alvo.conta, reg = alvo.reg;
  // 18.2.1: senha que conferiu em formato antigo (v2, com qualquer numero de iteracoes)
  // e regravada em v3 aqui, so nesta conta. Nao e troca de senha: nao invalida links.
  // O cracha sai DEPOIS, com a impressao do hash que ficou gravado (se a gravacao
  // falhar, o hash antigo segue valendo e o cracha e emitido sobre ele).
  var hashDaConta = reg.senha_hash;
  if (String(hashDaConta).indexOf('v3$') !== 0) {
    var hashNovo = gerarHashSenha(String(senha));
    // 18.10: a regravacao pega a trava; sem ela, fica para o proximo login
    if (hashNovo && _comTravaSeDer_(function () { return _gravarHashDaConta_(t, conta.sigla, conta.profissional_id, hashNovo); })) hashDaConta = hashNovo;
  }
  var perfil = { tipo: t, sigla: conta.sigla, nome: reg.nome, email: e };
  for (var k in reg.extra) perfil[k] = reg.extra[k];
  var entrada = {
    ok: true,
    token: emitirToken({ tipo: t, sigla: conta.sigla, profissional_id: conta.profissional_id, impressao: impressaoCracha(hashDaConta) }, segredo, Date.now()),
    perfil: perfil
  };
  // 18.11: a conta acabou de ser conferida na planilha (ativa, senha certa) — o portao ja nasce em
  // cache, com a impressao do hash que ficou gravado; a primeira chamada depois do login nao reabre a Sistema_VMC.
  _cacheGuardar_(_chavePortao_(t, conta.sigla, conta.profissional_id),
    _valorPortao_({ senha_hash: hashDaConta, nome: reg.nome, email: reg.email }), PORTAO_CACHE_SEG);
  // 18.11: o profissional entra direto na lista de pacientes — ela vai na resposta do login e a tela
  // nao faz a segunda chamada (cada ida ao Apps Script custa mais de 1 s so de caminho). Sem a
  // lista (erro aqui), o cliente pede profListarPacientes como antes.
  if (t === 'profissional') {
    try {
      var lista = listarPacientesDoProfissional({ tipo: t, sigla: conta.sigla, profissional_id: conta.profissional_id, nome: reg.nome, email: reg.email });
      if (lista && lista.ok === true) { entrada.pacientes = lista.pacientes; entrada.email_pacientes = lista.email_pacientes; } // 14.10
    } catch (erroLista) {
      console.error('autenticar: lista de pacientes nao foi junto: ' + String(erroLista && erroLista.message || erroLista).slice(0, 120));
    }
  }
  return entrada;
}

/**
 * Pede um link de redefinicao. Resposta identica (e com o mesmo piso de tempo)
 * exista ou nao o e-mail, com ou sem cota, com ou sem falha do envio.
 * 18.1.2: 1 pedido por (perfil, e-mail) a cada 15 min, conferido antes de qualquer
 * leitura de planilha; cota propria (REDEFINICOES_DIA_MAX) conferida antes de criar
 * o link; link anulado se o e-mail nao sair; links pendentes (convite) continuam.
 */
function pedirRedefinicao(tipo, email) {
  var t0 = Date.now();
  var resposta = { ok: true, mensagem: MSG_REDEFINICAO };
  try {
    var t = String(tipo || '').trim().toLowerCase();
    var e = normalizarEmail(email);
    if (PERFIS.indexOf(t) === -1 || !emailValido(e)) return _completarPiso_(t0, PISO_REDEF_MS, resposta);
    var cache = CacheService.getScriptCache();
    var chave = 'redef:' + t + ':' + e;
    if (cache.get(chave)) return _completarPiso_(t0, PISO_REDEF_MS, resposta);
    cache.put(chave, '1', REDEF_INTERVALO_SEG);
    // 18.1.3: um link e um e-mail por conta ativa (o e-mail de paciente pode ter uma
    // conta por profissional). A cota e reservada de uma vez: se nao couberem todos,
    // nenhum e-mail sai e nenhum link fica.
    var contas = _contasPorEmail_(t, e);
    var ativas = [];
    for (var i = 0; i < contas.length; i++) {
      var reg = _registroDaConta_(t, contas[i].sigla, contas[i].profissional_id);
      // 14.10: o e-mail do paciente sai da conta do profissional dele; sem a permissao, nao sai (o profissional reenvia o acesso pelo WhatsApp)
      if (reg && reg.ativo && (t !== 'paciente' || _emailPermitido_(contas[i].profissional_id))) ativas.push(contas[i]);
    }
    // 18.10: o trecho que grava (cota, links) roda na trava; o piso de tempo fica fora dela
    if (ativas.length) _comTrava_(function () {
      if (!_reservarEmail_('redefinicoes', ativas.length)) return;
      for (var j = 0; j < ativas.length; j++) {
        // Com mais de uma conta, cada e-mail diz o profissional ("Acompanhamento com: …")
        var profNome = '';
        if (ativas.length > 1) {
          var dono = buscarProfissional(ativas[j].profissional_id);
          profNome = dono ? String(dono.nome_completo || '') : '';
        }
        // 18.10: paciente -> assina o profissional dono; profissional e admin -> o admin do sistema
        var assina = t === 'paciente' ? _assinaturaDoProfissional_(ativas[j].profissional_id) : _assinaturaDoSistema_();
        var link = _criarLinkAtivacao_(t, ativas[j].sigla, ativas[j].profissional_id, 'redefinicao', e);
        if (!_enviarEmail_(e, montarEmail('redefinicao', '', link, profNome, assina), t === 'paciente' ? ativas[j].profissional_id : undefined)) _anularLink_(link);
      }
    });
  } catch (erro) {
    console.error('pedirRedefinicao: ' + String(erro && erro.message || erro).slice(0, 200));
  }
  return _completarPiso_(t0, PISO_REDEF_MS, resposta);
}

/**
 * Grava o aceite da Politica de Privacidade na linha do paciente (Controle do
 * profissional, aba Pacientes — e onde vive o registro do paciente: senha_hash e
 * ativo ja moram la). Colunas criadas pelo cabecalho (_atualizarLinhaPorChave_ ->
 * _garantirColunas_), nunca por posicao.
 */
function _gravarAceitePolitica_(sigla, profissionalId) {
  var controle = abrirControleDoProfissional(profissionalId);
  if (!controle) return false;
  // Apostrofo: forca TEXTO na celula. Sem ele o Sheets retipa '2026-10' para data
  // e a leitura de volta nunca bate com POLITICA_VERSAO (achado da prova real, 03/10).
  // 18.2: valores do servidor, ja com apostrofo — vao como `camposServidor`, fora da trava.
  return _atualizarLinhaPorChave_(controle.getSheetByName(ABA_PACIENTES), 'sigla', sigla, {}, {
    aceite_politica_em: "'" + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss'),
    aceite_politica_versao: "'" + POLITICA_VERSAO
  });
}

/** O paciente (sigla do profissional dado) ja aceitou a versao atual da politica? */
function _aceitouPoliticaAtual_(sigla, profissionalId) {
  var pac = buscarPaciente(sigla);
  return !!pac && pac.__profissional_id === profissionalId && String(pac.aceite_politica_versao || '') === POLITICA_VERSAO;
}

/**
 * Cria a senha a partir do link (?ativar=<token>).
 * Sem `senha`: so confere o link e devolve {ok, tipo, email, exige_aceite, politica_versao}
 * (tela "Crie sua senha"; exige_aceite so para paciente sem aceite da versao atual).
 * Com `senha`: grava o hash v2, marca o link como usado e devolve {ok, tipo, email}.
 * 18.1.6: ativacao de paciente sem aceite da versao atual EXIGE aceite + versao;
 * redefinicao de conta que ja aceitou nao pede de novo. Profissional e admin: nada muda.
 */
function definirSenha(ativar, senha, aceite, versaoPolitica) {
  var link = _linkValido_(ativar);
  if (!link) return { ok: false, codigo: 'link_invalido', erro: MSG_LINK };
  var reg = _registroDaConta_(link.tipo, link.sigla, link.profissional_id);
  // 18.1.2: o link vale so para o e-mail a que foi enviado (troca de e-mail o derruba;
  // link sem email_destino, emitido antes do 18.1.2, nao vale)
  if (!reg || !reg.ativo || !reg.email || !link.email_destino || link.email_destino !== reg.email) {
    return { ok: false, codigo: 'link_invalido', erro: MSG_LINK };
  }
  var exigeAceite = link.tipo === 'paciente' && !_aceitouPoliticaAtual_(link.sigla, link.profissional_id);
  if (senha === undefined || senha === null || senha === '') {
    return { ok: true, tipo: link.tipo, email: reg.email, exige_aceite: exigeAceite, politica_versao: POLITICA_VERSAO };
  }
  if (exigeAceite && (aceite !== true || String(versaoPolitica || '') !== POLITICA_VERSAO)) {
    return { ok: false, codigo: 'aceite_obrigatorio', erro: 'Para criar a senha, marque o aceite da Política de Privacidade.' };
  }
  if (String(senha).length < SENHA_MINIMA) return { ok: false, erro: 'Escolha uma senha com pelo menos 8 caracteres.' };
  if (String(senha).length > SENHA_MAXIMA) return { ok: false, erro: 'Não foi possível gravar a senha. Tente de novo.' };
  // grava a senha e invalida os links pendentes da conta (inclusive os dos outros canais)
  if (!_gravarSenhaDaConta_(link.tipo, link.sigla, link.profissional_id, String(senha))) {
    return { ok: false, erro: 'Não foi possível gravar a senha. Tente de novo.' };
  }
  if (exigeAceite) _gravarAceitePolitica_(link.sigla, link.profissional_id); // 18.1.6: data/hora + versao na linha do paciente
  link.aba.getRange(link.linha, link.colUsado).setValue(new Date().toISOString());
  CacheService.getScriptCache().remove('falha:' + link.tipo + ':' + reg.email);
  return { ok: true, tipo: link.tipo, email: reg.email };
}

/**
 * 18.1.6: paciente que ja tinha senha e ainda nao aceitou a versao atual grava o
 * aceite aqui, autenticado pelo cracha (o login devolve `aceite_pendente` e o
 * cliente mostra a caixa antes de entrar). Resposta so com verdadeiro/falso.
 */
function aceitarPolitica(s) {
  var erro = _exigir_(s, 'paciente');
  if (erro) return erro;
  if (!_gravarAceitePolitica_(s.sigla, s.profissional_id)) {
    return { ok: false, erro: 'Não foi possível registrar o aceite. Tente de novo.' };
  }
  return { ok: true, aceite: true };
}

// ---------- convites ----------

/**
 * Reserva envios na cota do dia: 'convites' (EMAILS_DIA_MAX, profissional e admin)
 * ou 'redefinicoes' (REDEFINICOES_DIA_MAX, pedidos anonimos). O contador sobe antes do
 * envio e sob o lock do script, para rajadas em paralelo nao furarem o teto.
 * 18.1.3: `quantos` (opcional, 1) reserva varios de uma vez — ou todos, ou nenhum.
 */
function _reservarEmail_(cota, quantos) {
  var n = quantos || 1;
  // 19.2.1: terceira cota, 'lembretes' (LEMBRETES_DIA_MAX), separada das outras duas
  // 14.3: quarta cota, 'sessoes' (SESSOES_EMAIL_DIA_MAX), para os avisos de sessao
  // Fase 20: quinta cota, 'cobrancas' (FIN_COBRANCAS_EMAIL_DIA_MAX), para as cobrancas enviadas pelo profissional
  var max = cota === 'redefinicoes' ? REDEFINICOES_DIA_MAX : (cota === 'lembretes' ? LEMBRETES_DIA_MAX : (cota === 'sessoes' ? SESSOES_EMAIL_DIA_MAX : (cota === 'cobrancas' ? FIN_COBRANCAS_EMAIL_DIA_MAX : EMAILS_DIA_MAX)));
  var prefixo = cota === 'redefinicoes' ? 'redefinicoes:' : (cota === 'lembretes' ? 'lembretes:' : (cota === 'sessoes' ? 'sessoes:' : (cota === 'cobrancas' ? 'cobrancas:' : 'emails:')));
  // 18.10: a mesma trava das gravacoes (reentrante — nao solta a da acao que chamou)
  return _comTrava_(function () {
    var props = PropertiesService.getScriptProperties();
    var chave = prefixo + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
    var enviados = parseInt(props.getProperty(chave) || '0', 10);
    if (enviados + n > max) return false;
    props.setProperty(chave, String(enviados + n));
    return true;
  });
}

/** Envia um e-mail do COGNIATIVO (a cota ja reservada). Devolve true se enviou.
 *  16.11: o logo vai embutido (inlineImages, cid:logo); sem a imagem o e-mail sai assim mesmo (alt "COGNIATIVO"). */
function _enviarEmail_(para, email, profId) {
  try {
    // 14.10: com `profId`, o e-mail e do profissional (aos pacientes dele ou a ele mesmo) e sai da conta DELE —
    // pela conta do Google que ele conectou; para o dono do script, pelo proprio script. Sem a permissao, nao sai.
    var de = null;
    if (profId !== undefined && profId !== null) {
      de = _emailRemetente_(profId);
      if (!de) return false;
      if (de.modo === 'gmail') return _gmailEnviar_(profId, de, para, email);
    }
    var msg = { to: para, subject: email.assunto, body: email.texto, htmlBody: email.html, name: de ? de.nome : 'COGNIATIVO' };
    var logo = _logoEmailBlob_();
    if (logo) msg.inlineImages = { logo: logo };
    // 14.5: evento da sessao em anexo (.ics) — o paciente abre e guarda na agenda dele (Google, Outlook, Apple)
    if (email.anexo && email.anexo.texto) {
      try { msg.attachments = [Utilities.newBlob(email.anexo.texto, 'text/calendar', email.anexo.nome || 'sessao.ics')]; } catch (erroAnexo) { /* sem o anexo o e-mail sai assim mesmo */ }
    }
    MailApp.sendEmail(msg);
    return true;
  } catch (e) {
    console.error('_enviarEmail_: ' + String(e && e.message || e).slice(0, 200));
    return false;
  }
}

// ---------- 14.10: de onde sai o e-mail do profissional ----------
var GCAL_ESCOPO_EMAIL = 'https://www.googleapis.com/auth/gmail.send'; // so envia; nao le nem apaga nada da caixa
var MSG_EMAIL_CONECTE = 'Para enviar e-mails aos seus pacientes, conecte a sua conta do Google na Agenda.';

/**
 * Por onde sai o e-mail do profissional: { modo: 'dono' | 'gmail', nome, conta } ou null (nao sai).
 * 'dono' = a conta que roda o script e a dele (MailApp ja sai do Gmail dele); 'gmail' = a conta que ele conectou,
 * com a permissao de envio. O nome de quem envia e o do cadastro (decisao do usuario, 23/11/2026).
 */
function _emailRemetente_(profId) {
  if (!profId) return null;
  if (_MEMO_.emailDe === undefined) _MEMO_.emailDe = {};
  if (_MEMO_.emailDe[profId] !== undefined) return _MEMO_.emailDe[profId];
  var de = null;
  try {
    var prof = buscarProfissional(profId) || {};
    var nome = String(prof.nome_completo || '').replace(/[\r\n"<>]/g, ' ').trim() || 'COGNIATIVO';
    var g = _gcalGuardada_(profId);
    if (_calDoDono_(profId)) de = { modo: 'dono', nome: nome, conta: normalizarEmail(prof.email) };
    else if (g && g.conta && String(g.escopos || '').indexOf(GCAL_ESCOPO_EMAIL) !== -1) de = { modo: 'gmail', nome: nome, conta: String(g.conta) };
  } catch (e) { de = null; }
  _MEMO_.emailDe[profId] = de;
  return de;
}
/** O profissional pode mandar e-mail aos pacientes dele (e receber os do sistema sobre a agenda dele)? */
function _emailPermitido_(profId) { return !!_emailRemetente_(profId); }

function _mimeB64_(texto) {
  return Utilities.base64Encode(String(texto), Utilities.Charset.UTF_8);
}
function _mimeLinhas_(b64) {
  return String(b64).replace(/(.{76})/g, '$1\r\n').replace(/\r\n$/, '');
}
function _mimePalavra_(texto) {
  return '=?UTF-8?B?' + _mimeB64_(texto) + '?=';
}
/** A mensagem inteira (RFC 2822) como o Gmail a recebe: texto + HTML, o logo embutido (cid:logo) e o anexo, tudo em base64. */
function _mimeMontar_(de, para, email) {
  var M = 'cgn-m-' + Utilities.getUuid(), R = 'cgn-r-' + Utilities.getUuid(), A = 'cgn-a-' + Utilities.getUuid(), nl = '\r\n';
  var limpo = function (x) { return String(x === undefined || x === null ? '' : x).replace(/[\r\n]/g, ' ').trim(); };
  var parte = function (tipo, b64, extras) {
    return ['Content-Type: ' + tipo, 'Content-Transfer-Encoding: base64'].concat(extras || []).join(nl) + nl + nl + _mimeLinhas_(b64) + nl;
  };
  var linhas = ['From: ' + _mimePalavra_(de.nome) + ' <' + limpo(de.conta) + '>', 'To: ' + limpo(para), 'Subject: ' + _mimePalavra_(limpo(email.assunto)),
    'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="' + M + '"', '',
    '--' + M, 'Content-Type: multipart/related; boundary="' + R + '"', '',
    '--' + R, 'Content-Type: multipart/alternative; boundary="' + A + '"', '',
    '--' + A, parte('text/plain; charset=UTF-8', _mimeB64_(email.texto || '')),
    '--' + A, parte('text/html; charset=UTF-8', _mimeB64_(email.html || '')),
    '--' + A + '--', ''];
  if (EMAIL_LOGO_PNG_B64) linhas.push('--' + R, parte('image/png; name="cogniativo.png"', EMAIL_LOGO_PNG_B64, ['Content-ID: <logo>', 'Content-Disposition: inline; filename="cogniativo.png"']));
  linhas.push('--' + R + '--', '');
  if (email.anexo && email.anexo.texto) {
    var nome = limpo(email.anexo.nome || 'sessao.ics').replace(/"/g, '');
    linhas.push('--' + M, parte('text/calendar; charset=UTF-8; name="' + nome + '"', _mimeB64_(email.anexo.texto), ['Content-Disposition: attachment; filename="' + nome + '"']));
  }
  linhas.push('--' + M + '--', '');
  return linhas.join(nl);
}
/** Envia pela conta do Google que o profissional conectou (fica nos Enviados dele; a resposta volta para ele). Nunca lanca. */
function _gmailEnviar_(profId, de, para, email) {
  try {
    var token = _gcalToken_(profId);
    if (!token) return false;
    var r = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'post', muteHttpExceptions: true,
      contentType: 'application/json', headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ raw: Utilities.base64EncodeWebSafe(_mimeMontar_(de, para, email), Utilities.Charset.UTF_8) }) });
    if (r.getResponseCode() === 200) return true;
    console.error('e-mail pela conta conectada: o Google respondeu ' + r.getResponseCode());
    return false;
  } catch (e) {
    console.error('e-mail pela conta conectada: ' + String(e && e.message || e).slice(0, 160));
    return false;
  }
}

/** 16.11: PNG do logo do e-mail (docs/design/marca/logo-email.png, 480 x 112) a partir de EMAIL_LOGO_PNG_B64. */
function _logoEmailBlob_() {
  try {
    return Utilities.newBlob(Utilities.base64Decode(EMAIL_LOGO_PNG_B64), 'image/png', 'cogniativo.png');
  } catch (e) {
    console.error('_logoEmailBlob_: ' + String(e && e.message || e).slice(0, 200));
    return null;
  }
}

/**
 * 16.11: manda ao dono do script (so a ele) um convite e uma redefinicao de exemplo, com dados
 * ficticios e link sem valor, para conferir o layout no Gmail. Uso: clasp --user run run-function enviarEmailsDeExemplo.
 * Fora do doPost; nao toca planilha nem a cota do sistema.
 */
function enviarEmailsDeExemplo() {
  var dono = Session.getEffectiveUser().getEmail();
  var link = SITE_URL + '?ativar=EXEMPLO-SEM-VALOR';
  var ass = _assinaturaDe_('Nome do Profissional', '00/000000');
  var exemplos = [montarEmail('convite', 'Ana', link, '', ass), montarEmail('redefinicao', '', link, 'Nome do Profissional', ass)];
  var enviados = 0;
  exemplos.forEach(function (e) {
    e.assunto = '[Exemplo] ' + e.assunto;
    if (_enviarEmail_(dono, e)) enviados++;
  });
  return { ok: enviados === exemplos.length, enviados: enviados, para: dono };
}

/** Grava e-mail e telefone do paciente na Controle (e o e-mail no Indice), normalizados. */
function _atualizarContatoPaciente_(sigla, contato) {
  var c = normalizarContato(contato);
  if (c.erro) return { ok: false, erro: c.erro };
  var dono = resolverProfissionalIdPorSigla(sigla, 'paciente');
  var controle = dono ? abrirControleDoProfissional(dono) : null;
  if (!controle) return { ok: false, erro: 'Controle do profissional não encontrada.' };
  var idx = _gravarEmailIndice_(sigla, 'paciente', c.email);
  if (!idx.ok) return idx;
  if (!_atualizarLinhaPorChave_(controle.getSheetByName(ABA_PACIENTES), 'sigla', sigla, { email: c.email, telefone: c.telefone })) {
    return { ok: false, erro: 'Paciente não encontrado na Controle.' };
  }
  _portaoEsquecer_([{ tipo: 'paciente', sigla: sigla, profissional_id: dono }]); // 18.11: e-mail gravado na linha da conta
  if (idx.mudou) _invalidarLinks_('paciente', sigla); // 18.1.2: link antigo nao vale para o e-mail novo
  return { ok: true, email: c.email, telefone: c.telefone };
}

/** Nome do paciente para o convite: anamnese, senao o nome do cadastro. */
function _nomeDoPaciente_(paciente) {
  try {
    var anam = lerAbaComoObjetos(_abrirPlanilha_(extrairIdDaUrl(paciente.link_planilha_individual)), ABA_ANAMNESE);
    if (anam.length && anam[0].nome_completo) return String(anam[0].nome_completo);
  } catch (e) { /* sem anamnese: usa o cadastro */ }
  return String(paciente.nome || '');
}

/**
 * Convite do paciente. canal = 'email' (envia) ou 'link' (so gera, para o WhatsApp).
 * contato (opcional) = {email, telefone}: grava na Controle antes de gerar o link.
 * Saida: { ok:true, link, email, telefone, enviado }.
 */
function profEnviarConvite(s, siglaPaciente, canal, contato) {
  var auth = _authProfissional_(s);
  if (!auth.ok) return auth;
  if (!siglaPaciente || resolverProfissionalIdPorSigla(siglaPaciente, 'paciente') !== s.profissional_id) {
    return { ok: false, erro: 'Este paciente nao pertence a voce' };
  }
  if (contato) {
    var c = _atualizarContatoPaciente_(siglaPaciente, contato);
    if (!c.ok) return c;
  }
  var pac = buscarPaciente(siglaPaciente);
  if (!pac) return { ok: false, erro: 'Paciente nao encontrado' };
  if (!_estaAtivo_(pac.ativo)) return { ok: false, erro: 'Paciente desativado.' };
  var email = normalizarEmail(pac.email);
  if (!email) return { ok: false, erro: 'Cadastre o e-mail do paciente antes do convite.' };
  // 18.1.2: cota conferida antes de criar o link; e-mail que nao sai anula o proprio link
  if (canal === 'email' && !_emailPermitido_(s.profissional_id)) return { ok: false, codigo: 'sem_conexao', erro: MSG_EMAIL_CONECTE }; // 14.10
  if (canal === 'email' && !_reservarEmail_('convites')) return { ok: false, erro: MSG_COTA_EMAIL };
  var link = _criarLinkAtivacao_('paciente', pac.sigla, s.profissional_id, 'convite', email);
  var enviado = false;
  if (canal === 'email') {
    // 18.10: o convite e assinado pelo profissional dono (nome e CRP da aba Profissionais)
    enviado = _enviarEmail_(email, montarEmail('convite', primeiroNome(_nomeDoPaciente_(pac)), link, '', _assinaturaDoProfissional_(s.profissional_id)), s.profissional_id);
    if (!enviado) { _anularLink_(link); return { ok: false, erro: MSG_COTA_EMAIL }; }
  }
  return { ok: true, link: link, email: email, telefone: normalizarTelefone(pac.telefone), enviado: enviado };
}

/** Convite do profissional pelo admin. canal = 'email' | 'link'. Saida: { ok, link, enviado }. */
function admEnviarConvite(s, profissionalId, canal) {
  var adm = _admDaSessao_(s);
  if (!adm) return _respostaSessaoExpirada_();
  var prof = buscarProfissional(profissionalId);
  if (!prof) return { ok: false, erro: 'Profissional nao encontrado: ' + profissionalId };
  if (!_estaAtivo_(prof.ativo)) return { ok: false, erro: 'Profissional desativado.' };
  var email = normalizarEmail(prof.email);
  if (!emailValido(email)) return { ok: false, erro: 'Cadastre o e-mail do profissional antes do convite.' };
  var idx = _gravarEmailIndice_(prof.sigla, 'profissional', email);
  if (!idx.ok) return idx;
  if (canal === 'email' && !_reservarEmail_('convites')) return { ok: false, erro: MSG_COTA_EMAIL };
  var link = _criarLinkAtivacao_('profissional', String(prof.sigla).toUpperCase(), prof.profissional_id, 'convite', email);
  var enviado = false;
  if (canal === 'email') {
    // 18.10: convite de profissional assinado pelo admin que o enviou
    enviado = _enviarEmail_(email, montarEmail('convite', primeiroNome(prof.nome_completo), link, '', _assinaturaDe_(adm.nome_completo)));
    if (!enviado) { _anularLink_(link); return { ok: false, erro: MSG_COTA_EMAIL }; }
  }
  return { ok: true, link: link, enviado: enviado };
}

// ---------- editor do Apps Script (uso do usuario) ----------

/**
 * Calibracao do ITER_SENHA (alvo 200-400 ms) pelo caminho v3:
 * clasp --user run run-function medirHashSenha. So devolve numeros.
 */
function medirHashSenha() {
  var pimenta = _pimentaSenha_();
  if (!pimenta) return { ok: false, erro: 'PIMENTA_SENHA ausente' };
  var t0 = Date.now();
  _hashSenhaV3_('medicao-sem-uso', _aleatorioHex_(), ITER_SENHA, pimenta);
  var ms = Date.now() - t0;
  Logger.log('ITER_SENHA=' + ITER_SENHA + ' (v3): ' + ms + ' ms');
  return { ok: true, formato: 'v3', iter: ITER_SENHA, ms: ms };
}


// ============================================================
// PACOTE 13.2 - AREA DO PROFISSIONAL
// ============================================================

/**
 * Lista todos os pacientes de um profissional.
 *
 * Profissional vem do cracha de sessao (s), conferido no doPost.
 * Le a Controle do profissional e retorna dados basicos.
 * Para cada paciente com anamnese preenchida, tenta ler o nome
 * completo da aba Anamnese da planilha individual (senao, o nome do cadastro).
 *
 * Retorna:
 *   { ok: true, pacientes: [ { sigla, nome_completo, data_cadastro,
 *     data_anamnese, ativo } ] }
 */
function listarPacientesDoProfissional(s) {
  // 1. Revalidar credenciais do profissional
  var authResult = _authProfissional_(s);
  if (!authResult.ok) {
    return authResult; // { ok: false, erro: '...' }
  }

  var profissionalId = authResult.profissional.profissional_id;

  // 2. Abrir a Controle deste profissional
  var controle = abrirControleDoProfissional(profissionalId);
  if (!controle) {
    return { ok: true, pacientes: [] }; // Sem controle = sem pacientes
  }

  var aba = controle.getSheetByName(ABA_PACIENTES);
  if (!aba) {
    return { ok: true, pacientes: [] };
  }

  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) {
    return { ok: true, pacientes: [] }; // So cabecalho, sem pacientes
  }

  // 18.10 (8.62): a lista sai SO da Controle — os indicadores de cada paciente moram na
  // linha dele (colunas ind_*), atualizados em toda gravacao. A planilha do paciente so
  // e aberta quando `ind_atualizado_em` esta vazio (recalculo preguicoso, uma vez).
  var cabecalhos = dados[0];
  var col = function (nome) { return cabecalhos.indexOf(nome); };
  var idxSigla = col('sigla');
  var idxLink = col('link_planilha_individual');
  var idxDataCad = col('data_cadastro');
  var idxDataAnam = col('data_anamnese');
  var idxAtivo = col('ativo');
  var idxNomeCad = col('nome'); // Pacote 18.1: nome do cadastro
  var idxAceite = col('aceite_politica_em'); // 18.5: data do aceite da Politica (18.1.6), so para exibir

  var lista = [];

  // 19.2.1: lembretes de hoje e atrasados de cada paciente ativo vao junto (blocos do Inicio) —
  // uma leitura a mais na Controle que ja esta aberta, nenhuma chamada nova. Erro aqui nao derruba a lista.
  var lembretesPorSigla = {};
  try {
    lembretesPorSigla = _lembretesDoInicio_(controle, _lemAgora_().data);
  } catch (erroLem) {
    console.error('listarPacientes: lembretes nao foram junto: ' + String(erroLem && erroLem.message || erroLem).slice(0, 120));
  }
  // 14.3: pedidos pendentes de remarcacao e de reposicao vao junto (bloco do Inicio), como os lembretes
  var pedidosPorSigla = {}, eventosPorSigla = {};
  try {
    var agendaDoInicio = _ageInicio_(controle);
    pedidosPorSigla = agendaDoInicio.pedidos; eventosPorSigla = agendaDoInicio.eventos; // 14.4: os eventos da agenda tambem
  } catch (erroPed) {
    console.error('listarPacientes: pedidos da agenda nao foram junto: ' + String(erroPed && erroPed.message || erroPed).slice(0, 120));
  }
  var idxEmailCad = col('email'), idxTelCad = col('telefone');
  var idxValorSessao = col('valor_sessao'); // 14.6

  for (var i = 1; i < dados.length; i++) {
    var row = dados[i];
    var siglaPac = String(row[idxSigla] || '').trim();
    if (!siglaPac) continue; // Linha vazia

    var ind = {};
    for (var c = 0; c < COLUNAS_INDICADORES.length; c++) {
      var ic = col(COLUNAS_INDICADORES[c]);
      ind[COLUNAS_INDICADORES[c]] = ic >= 0 ? row[ic] : '';
    }
    if (!String(ind.ind_atualizado_em || '').trim() && idxLink >= 0 && row[idxLink]) {
      try {
        var calculado = _atualizarIndicadores_(profissionalId, siglaPac, _abrirPlanilha_(extrairIdDaUrl(String(row[idxLink]))), true);
        if (calculado) ind = calculado;
      } catch (e) {
        // Se nao conseguir abrir a planilha individual, segue sem indicadores
        Logger.log('listarPacientes: erro ao ler dados de ' + siglaPac + ': ' + e.message);
      }
    }

    var ultimoAuto = _jsonOuVazio_(ind.ind_ultimo_auto);
    var ultimaEscala = _jsonOuVazio_(ind.ind_ultima_escala);
    var alerta = _jsonOuVazio_(ind.ind_alertas_json);
    var nomeAnamnese = String(ind.ind_nome || '').trim();

    lista.push({
      sigla: siglaPac,
      nome_completo: nomeAnamnese || (idxNomeCad >= 0 ? String(row[idxNomeCad] || '').trim() : ''),
      data_cadastro: idxDataCad >= 0 ? formatarDataParaExibicao_(row[idxDataCad]) : '',
      data_anamnese: idxDataAnam >= 0 ? formatarDataParaExibicao_(row[idxDataAnam]) : '',
      ativo: idxAtivo >= 0 ? _ativoParaCliente_(row[idxAtivo]) : 'Sim',
      aceite_em: idxAceite >= 0 ? _dataDoAceite_(row[idxAceite]) : '', // 18.5: 'DD/MM/AAAA' ou ''
      // Pacote 13.2.3: indicadores clinicos (mesmo contrato; a fonte passou a ser a Controle)
      ind_total_auto: parseInt(ind.ind_total_auto, 10) || 0,
      ind_ultimo_auto_data: String(ultimoAuto.data || ''),
      ind_dias_desde_auto: _diasDesdeDataBR_(ultimoAuto.data),
      ind_ultimo_humor: parseInt(ultimoAuto.humor, 10) || null,
      ind_total_escalas: parseInt(ind.ind_total_escalas, 10) || 0,
      ind_ultima_escala_nome: String(ultimaEscala.nome || ''),
      ind_ultima_escala_faixa: String(ultimaEscala.faixa || ''),
      ind_ultima_escala_data: String(ultimaEscala.data || ''),
      ind_alertas: alerta.instrumento !== undefined ? [alerta] : [],
      lembretes: [], // 19.2.1
      valor_sessao: idxValorSessao >= 0 ? String(row[idxValorSessao] === undefined || row[idxValorSessao] === null ? '' : row[idxValorSessao]).trim() : '', // 14.6
      email: idxEmailCad >= 0 ? normalizarEmail(row[idxEmailCad]) : '' // 19.6: sem a sigla na tela, o e-mail distingue dois pacientes de mesmo nome
    });
    // 19.2.1: so paciente ativo e com lembrete de hoje ou atrasado leva os itens e o contato do botao WhatsApp
    if (pedidosPorSigla[_siglaChave_(siglaPac)]) lista[lista.length - 1].pedidos_agenda = pedidosPorSigla[_siglaChave_(siglaPac)]; // 14.3
    if (eventosPorSigla[_siglaChave_(siglaPac)]) lista[lista.length - 1].eventos_agenda = eventosPorSigla[_siglaChave_(siglaPac)]; // 14.4
    var lemDoPac = lembretesPorSigla[_siglaChave_(siglaPac)];
    if (lemDoPac && lista[lista.length - 1].ativo === 'Sim') {
      lista[lista.length - 1].lembretes = lemDoPac;
      lista[lista.length - 1].telefone = idxTelCad >= 0 ? normalizarTelefone(row[idxTelCad]) : '';
      lista[lista.length - 1].tem_email = idxEmailCad >= 0 ? !!normalizarEmail(row[idxEmailCad]) : false;
    }
  }

  return { ok: true, pacientes: lista, email_pacientes: _emailPermitido_(s.profissional_id) }; // 14.10: a tela avisa onde o e-mail sairia
}

/** 18.5: data do aceite ('aaaa-MM-dd HH:mm:ss' em texto, ou Date em linha antiga) como 'DD/MM/AAAA'; vazio quando nao ha. */
function _dataDoAceite_(valor) {
  if (valor instanceof Date) return formatarDataParaExibicao_(valor);
  var m = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}

// ---------- 18.10: indicadores do paciente na Controle ----------

// Colunas da aba Pacientes da Controle, criadas pelo cabecalho (_garantirColunas_):
//   ind_total_auto / ind_total_escalas  numero de linhas de cada aba
//   ind_ultimo_auto     JSON {data: 'DD/MM/AAAA', humor: 1..5 | null} da ultima linha
//   ind_ultima_escala   JSON {nome, faixa, data} da ultima linha
//   ind_alertas_json    JSON {instrumento, item, valor, data} do alerta critico mais recente ('' = nenhum)
//   ind_nome            nome_completo da Anamnese (a lista mostrava este nome; '' = usa o do cadastro)
//   ind_atualizado_em   'aaaa-MM-dd HH:mm:ss' do ultimo calculo; vazio = recalcular na proxima lista
var COLUNAS_INDICADORES = ['ind_total_auto', 'ind_ultimo_auto', 'ind_total_escalas', 'ind_ultima_escala',
  'ind_alertas_json', 'ind_nome', 'ind_atualizado_em'];

function _jsonOuVazio_(texto) {
  try {
    var o = JSON.parse(String(texto || ''));
    return (o && typeof o === 'object') ? o : {};
  } catch (e) {
    return {};
  }
}

/** Dias civis entre hoje e uma data 'DD/MM/AAAA' (null se nao for data). */
function _diasDesdeDataBR_(texto) {
  var m = String(texto || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  var hoje = new Date();
  var hojeCivil = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  var dia = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  return Math.round((hojeCivil - dia) / 86400000);
}

/**
 * Calcula os indicadores a partir da planilha do paciente, com as mesmas regras que a
 * lista usava (13.2.3): total = linhas da aba; "ultimo" = ultima linha; alerta = a
 * linha mais recente das Escalas com alerta_risco_flag ligado.
 */
function _calcularIndicadores_(planilha) {
  var ind = { ind_total_auto: 0, ind_ultimo_auto: '', ind_total_escalas: 0, ind_ultima_escala: '', ind_alertas_json: '', ind_nome: '' };

  var abaAnam = planilha.getSheetByName(ABA_ANAMNESE);
  if (abaAnam && abaAnam.getLastRow() >= 2) {
    var cabAnam = abaAnam.getRange(1, 1, 1, abaAnam.getLastColumn()).getValues()[0];
    var idxNome = cabAnam.indexOf('nome_completo');
    if (idxNome >= 0) ind.ind_nome = String(abaAnam.getRange(abaAnam.getLastRow(), idxNome + 1).getValue() || '').trim();
  }

  var abaAuto = planilha.getSheetByName(ABA_AUTOMONITORAMENTO);
  if (abaAuto && abaAuto.getLastRow() >= 2) {
    var cabAuto = abaAuto.getRange(1, 1, 1, abaAuto.getLastColumn()).getValues()[0];
    // 19.2.1 (8.23): o total conta so registro completo (Negativo ou Positivo). A checagem de humor
    // sozinha fica fora — a mesma regra do chip "Checagem de humor" de Meus Registros. O "ultimo"
    // continua sendo a ultima linha, checagem ou nao.
    var linhasAuto = abaAuto.getLastRow() - 1; // descontar cabecalho
    var idxNegP = cabAuto.indexOf('neg_preenchido'), idxPosP = cabAuto.indexOf('pos_preenchido');
    if (idxNegP === -1 && idxPosP === -1) {
      ind.ind_total_auto = linhasAuto;
    } else {
      var colNegP = idxNegP >= 0 ? abaAuto.getRange(2, idxNegP + 1, linhasAuto, 1).getValues() : null;
      var colPosP = idxPosP >= 0 ? abaAuto.getRange(2, idxPosP + 1, linhasAuto, 1).getValues() : null;
      for (var la = 0; la < linhasAuto; la++) {
        if (_registroCompleto_({ neg_preenchido: colNegP ? colNegP[la][0] : '', pos_preenchido: colPosP ? colPosP[la][0] : '' })) ind.ind_total_auto++;
      }
    }
    var ultLinha = abaAuto.getRange(abaAuto.getLastRow(), 1, 1, abaAuto.getLastColumn()).getValues()[0];
    var idxDataReg = cabAuto.indexOf('data_registro');
    var idxHumor = cabAuto.indexOf('humor_nivel');
    ind.ind_ultimo_auto = JSON.stringify({
      data: (idxDataReg >= 0 && ultLinha[idxDataReg]) ? formatarDataParaExibicao_(ultLinha[idxDataReg]) : '',
      humor: (idxHumor >= 0 && ultLinha[idxHumor]) ? (parseInt(ultLinha[idxHumor], 10) || null) : null
    });
  }

  var abaEsc = planilha.getSheetByName(ABA_ESCALAS);
  if (abaEsc && abaEsc.getLastRow() >= 2) {
    var dadosEsc = abaEsc.getDataRange().getValues();
    var cabEsc = dadosEsc[0];
    var idxInstr = cabEsc.indexOf('instrumento');
    var idxFaixa = cabEsc.indexOf('faixa');
    var idxDataApl = cabEsc.indexOf('data_aplicacao');
    var idxAlertaFlag = cabEsc.indexOf('alerta_risco_flag');
    var idxAlertaItem = cabEsc.indexOf('alerta_risco_item');
    var idxAlertaValor = cabEsc.indexOf('alerta_risco_valor');
    ind.ind_total_escalas = dadosEsc.length - 1;
    var ultEsc = dadosEsc[dadosEsc.length - 1];
    ind.ind_ultima_escala = JSON.stringify({
      nome: idxInstr >= 0 ? String(ultEsc[idxInstr] || '') : '',
      faixa: idxFaixa >= 0 ? String(ultEsc[idxFaixa] || '') : '',
      data: idxDataApl >= 0 ? formatarDataParaExibicao_(ultEsc[idxDataApl]) : ''
    });
    if (idxAlertaFlag >= 0) {
      for (var e = dadosEsc.length - 1; e >= 1; e--) {
        var flagVal = String(dadosEsc[e][idxAlertaFlag] || '').trim().toLowerCase();
        if (flagVal === 'sim' || flagVal === 'true' || flagVal === '1') {
          ind.ind_alertas_json = JSON.stringify({
            instrumento: idxInstr >= 0 ? String(dadosEsc[e][idxInstr] || '') : '',
            item: idxAlertaItem >= 0 ? String(dadosEsc[e][idxAlertaItem] || '') : '',
            valor: idxAlertaValor >= 0 ? String(dadosEsc[e][idxAlertaValor] || '') : '',
            data: idxDataApl >= 0 ? formatarDataParaExibicao_(dadosEsc[e][idxDataApl]) : ''
          });
          break; // Apenas o alerta mais recente
        }
      }
    }
  }
  return ind;
}

/**
 * Recalcula os indicadores do paciente e grava na linha dele na Controle (uma escrita
 * em lote quando as colunas sao vizinhas). Chamada por toda gravacao do paciente e
 * toda edicao pelo profissional, na mesma chamada e dentro da mesma trava.
 * `tolerante` (lista do profissional): sem a trava, devolve o calculo sem gravar.
 * Devolve os indicadores calculados, ou null se a linha do paciente nao foi achada.
 */
function _atualizarIndicadores_(profissionalId, sigla, planilha, tolerante) {
  _memoEsquecerPacientes_(); // 14.12: o nome da anamnese (ind_nome) pode mudar aqui
  var controle = abrirControleDoProfissional(profissionalId);
  if (!controle) return null;
  var aba = controle.getSheetByName(ABA_PACIENTES);
  if (!aba) return null;
  var ind = _calcularIndicadores_(planilha);
  ind.ind_atualizado_em = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss');
  var gravar = function () {
    var header = _garantirColunas_(aba, COLUNAS_INDICADORES);
    var iSigla = header.indexOf('sigla');
    if (iSigla === -1 || aba.getLastRow() < 2) return false;
    var siglas = aba.getRange(2, iSigla + 1, aba.getLastRow() - 1, 1).getValues();
    var alvo = String(sigla).trim().toUpperCase();
    for (var i = 0; i < siglas.length; i++) {
      if (String(siglas[i][0]).trim().toUpperCase() !== alvo) continue;
      var primeira = header.indexOf(COLUNAS_INDICADORES[0]);
      var vizinhas = COLUNAS_INDICADORES.every(function (c, k) { return header.indexOf(c) === primeira + k; });
      var valores = COLUNAS_INDICADORES.map(function (c) { return _celulaTexto_(c, ind[c]); });
      if (vizinhas) {
        aba.getRange(i + 2, primeira + 1, 1, valores.length).setValues([valores]);
      } else {
        for (var k = 0; k < valores.length; k++) aba.getRange(i + 2, header.indexOf(COLUNAS_INDICADORES[k]) + 1).setValue(valores[k]);
      }
      return true;
    }
    return false;
  };
  var gravou = tolerante ? _comTravaSeDer_(gravar) : _comTrava_(gravar);
  return (gravou || tolerante) ? ind : null;
}

/**
 * Indicadores depois de uma gravacao: o registro do paciente ja esta na planilha dele;
 * se a atualizacao da Controle falhar, `ind_atualizado_em` e esvaziado para a proxima
 * lista recalcular (a lista nunca fica com numero velho sem saber).
 */
function _indicadoresAposGravar_(profissionalId, sigla, planilha) {
  try {
    if (_atualizarIndicadores_(profissionalId, sigla, planilha)) return;
  } catch (e) {
    console.error('indicadores: ' + String(e && e.message || e).slice(0, 160));
  }
  try {
    var controle = abrirControleDoProfissional(profissionalId);
    if (controle) _atualizarLinhaPorChave_(controle.getSheetByName(ABA_PACIENTES), 'sigla', sigla, { ind_atualizado_em: '' });
  } catch (e2) {
    console.error('indicadores: nao consegui marcar para recalculo: ' + String(e2 && e2.message || e2).slice(0, 160));
  }
}

/**
 * Pacote 13.3.1: Le dados de um paciente para visualizacao pelo profissional.
 *
 * Seguranca:
 *   1. Profissional do cracha de sessao (s)
 *   2. Verifica que o paciente pertence a este profissional (isolamento multi-tenant)
 *   3. Retorna dados read-only
 *
 * Retorna:
 *   { ok: true, anamnese: { ... } | null, anamnese_preenchida: bool,
 *     contato: { email, telefone } (cadastro, Pacote 18.1), ... }
 */
function lerDadosPaciente(s, siglaPaciente) {
  // 1. Revalidar credenciais do profissional
  var authResult = _authProfissional_(s);
  if (!authResult.ok) {
    return authResult;
  }
  var profissionalId = authResult.profissional.profissional_id;

  // 2. Validar que o paciente existe e pertence a este profissional
  if (!siglaPaciente) {
    return { ok: false, erro: 'Sigla do paciente e obrigatoria' };
  }

  var profIdDono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!profIdDono) {
    return { ok: false, erro: 'Paciente nao encontrado' };
  }

  if (profIdDono !== profissionalId) {
    return { ok: false, erro: 'Este paciente nao pertence a voce' };
  }

  // 3. Abrir planilha individual do paciente (via Controle do profissional)
  var paciente = buscarPaciente(siglaPaciente);
  if (!paciente || !paciente.link_planilha_individual) {
    return { ok: false, erro: 'Planilha do paciente nao encontrada' };
  }

  var planilhaId = extrairIdDaUrl(paciente.link_planilha_individual);
  if (!planilhaId) {
    return { ok: false, erro: 'Link da planilha invalido' };
  }

  var planilha = _abrirPlanilha_(planilhaId);

  // 4. Ler anamnese (reuso de lerAbaComoObjetos)
  var anamnese = lerAbaComoObjetos(planilha, ABA_ANAMNESE);

  // 5. Pacote 13.3.2: Ler automonitoramento
  var automonitoramento = lerAbaComoObjetos(planilha, ABA_AUTOMONITORAMENTO);

  // 6. Pacote 13.3.3: Ler escalas
  var escalas = lerAbaComoObjetos(planilha, ABA_ESCALAS);

  // 18.8.1: carimbos com o nome atual do cadastro
  var nomesCarimbo = _nomesDoCarimbo_(siglaPaciente, profissionalId);
  _carimbosDoCadastro_(anamnese, nomesCarimbo);
  _carimbosDoCadastro_(automonitoramento, nomesCarimbo);
  _carimbosDoCadastro_(escalas, nomesCarimbo);

  return {
    ok: true,
    ativo: _ativoParaCliente_(paciente.ativo), // Pacote 13.5; 18.1.2: sempre 'Sim' ou 'Nao'
    anamnese_preenchida: anamnese.length > 0,
    anamnese: anamnese.length > 0 ? anamnese[0] : null,
    automonitoramento: automonitoramento,
    total_auto: automonitoramento.length,
    escalas: escalas,
    total_escalas: escalas.length,
    // Pacote 18.1: contato do cadastro (Controle), unica fonte de e-mail e telefone
    contato: { email: normalizarEmail(paciente.email), telefone: normalizarTelefone(paciente.telefone) },
    nome_cadastro: String(paciente.nome || ''),
    cpf_cadastro: String(paciente.cpf === undefined || paciente.cpf === null ? '' : paciente.cpf).replace(/\D/g, ''), // 19.6: Dados Cadastrais nascem com o cadastro
    escalas_liberadas: _escalasLiberadasLista_(paciente.escalas_liberadas), // 17.1.2: BSS liberada por paciente
    lembretes: _lembretesDoPaciente_(abrirControleDoProfissional(profissionalId), siglaPaciente, _lemAgora_().data) // 19.2.1: plano de lembretes
  };
}

/**
 * Formata uma data para exibicao (DD/MM/AAAA).
 * Aceita Date, string ISO ou vazio.
 */
function formatarDataParaExibicao_(valor) {
  if (!valor) return '';
  try {
    var d = (valor instanceof Date) ? valor : new Date(valor);
    if (isNaN(d.getTime())) return String(valor);
    var dia = ('0' + d.getDate()).slice(-2);
    var mes = ('0' + (d.getMonth() + 1)).slice(-2);
    var ano = d.getFullYear();
    return dia + '/' + mes + '/' + ano;
  } catch (e) {
    return String(valor);
  }
}


// ============================================================
// GRAVACAO DE DADOS
// ============================================================

/**
 * Pacote 18.1: `email` e `telefone` da aba Anamnese espelham o cadastro
 * (Controle), ignorando o que o cliente mandar nessas chaves. Se o cadastro
 * ainda estiver vazio (paciente antigo antes da conferencia do usuario), o
 * valor que ja esta na linha 2 da Anamnese e mantido - nada se perde.
 */
function _espelharContatoAnamnese_(aba, dados, paciente) {
  var copia = {};
  for (var k in (dados || {})) copia[k] = dados[k];
  var atual = {};
  if (aba.getLastRow() >= 2) {
    var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
    var lin = aba.getRange(2, 1, 1, cab.length).getValues()[0];
    atual.email = cab.indexOf('email') >= 0 ? lin[cab.indexOf('email')] : '';
    atual.telefone = cab.indexOf('telefone') >= 0 ? lin[cab.indexOf('telefone')] : '';
  }
  copia.email = normalizarEmail(paciente.email) || atual.email || '';
  copia.telefone = normalizarTelefone(paciente.telefone) || atual.telefone || '';
  return copia;
}

/**
 * Primeiro envio da anamnese. E o UNICO ponto que monta a linha da ficha (18.6, 8.44):
 * com a ficha ja existente (linha 2), o envio vira edicao por campo — nunca uma segunda
 * linha, nunca a linha inteira regravada.
 */
function salvarAnamnese(sigla, dados) {
  if (!dados || typeof dados !== 'object') return { ok: false, erro: 'Dados da anamnese ausentes' };
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };

  var planilhaIndividualId = extrairIdDaUrl(paciente.link_planilha_individual);
  var planilha = _abrirPlanilha_(planilhaIndividualId);
  var aba = planilha.getSheetByName(ABA_ANAMNESE);

  dados = _dadosDoCliente_(dados);
  var repetido = _linhaDoEnvio_(aba, dados.id_envio);
  if (repetido) {
    _rascunhoEnviado_(planilha, ['anamnese']);
    return _respostaDuplicado_(planilha, ABA_ANAMNESE, repetido, 'Anamnese salva com sucesso');
  }

  if (aba.getLastRow() >= 2) {
    var edicao = _editarAnamnesePorCampos_(planilha, aba, dados, 'paciente', dados.id_envio, paciente.__profissional_id, sigla, 'Anamnese salva com sucesso');
    if (edicao.ok) _rascunhoEnviado_(planilha, ['anamnese']);
    return edicao;
  }

  dados = _espelharContatoAnamnese_(aba, dados, paciente);
  var linha = montarLinha(aba, dados);
  aba.appendRow(linha);

  // Registra data de anamnese na Controle do profissional dono
  registrarDataAnamnese(sigla, paciente.__profissional_id);
  _indicadoresAposGravar_(paciente.__profissional_id, sigla, planilha);
  _rascunhoEnviado_(planilha, ['anamnese']); // 18.10b: enviado, o rascunho do tipo sai

  return { ok: true, mensagem: 'Anamnese salva com sucesso' };
}

// ---------- 18.10: autoria pelo servidor e identificador unico do envio ----------

// Campos que so o SERVIDOR escreve (8.46): o que vier do cliente com estes nomes e
// descartado em todo caminho que grava. `id_envio` vem do cliente, mas so vale se
// tiver cara de identificador (letras, numeros e hifen, 8 a 64).
var CAMPOS_DO_SERVIDOR = ['timestamp', 'versao_formulario', 'sigla', 'profissional_id',
  'editado', 'editado_por', 'editado_em', 'editando_quem', 'editando_desde',
  'criado_por', 'autoria_campos', // 18.5
  'criado_por_nome']; // 18.6.2

function _dadosDoCliente_(dados) {
  var limpo = {};
  for (var k in (dados || {})) {
    if (CAMPOS_DO_SERVIDOR.indexOf(k) === -1) limpo[k] = dados[k];
  }
  var id = String(limpo.id_envio === undefined || limpo.id_envio === null ? '' : limpo.id_envio).trim();
  if (/^[A-Za-z0-9-]{8,64}$/.test(id)) limpo.id_envio = id; else delete limpo.id_envio;
  return limpo;
}

/**
 * Linha (numero da planilha) que ja guarda este id_envio na aba, ou 0 (8.14). Garante
 * a coluna `id_envio` pelo cabecalho. Le so a coluna, nao a aba inteira.
 */
function _linhaDoEnvio_(aba, idEnvio) {
  var header = _garantirColunas_(aba, ['id_envio']);
  if (!idEnvio || aba.getLastRow() < 2) return 0;
  var coluna = aba.getRange(2, header.indexOf('id_envio') + 1, aba.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < coluna.length; i++) {
    if (String(coluna[i][0]).trim() === idEnvio) return i + 2;
  }
  return 0;
}

/** Resposta do reenvio: nada e gravado; volta o registro que ja estava na linha. */
function _respostaDuplicado_(planilha, nomeAba, linha, mensagem) {
  var registros = lerAbaComoObjetos(planilha, nomeAba);
  return { ok: true, duplicado: true, mensagem: mensagem, registro: registros[linha - 2] || null };
}

// ---------- 18.10b: rascunho no servidor (G2) ----------

// Aba `Rascunho` na planilha do paciente: uma linha por tipo (auto_negativo,
// auto_positivo, escala_<codigo> — o codigo da escala como o cliente o usa, ex. PHQ-9 —,
// anamnese), com o que o cliente guardava so no
// aparelho. Nasce no primeiro "Salvar e sair". Fica FORA de indicadores, historico,
// varreduras e comparacao de restauracao: nenhum deles le esta aba.
var ABA_RASCUNHO = 'Rascunho';
var HEADERS_RASCUNHO = ['tipo', 'atualizado_em', 'dados_json'];
var RASCUNHO_MAX = 45000; // caracteres do JSON (a celula do Sheets guarda 50 mil)

function _tipoDeRascunho_(tipo) {
  var t = String(tipo === undefined || tipo === null ? '' : tipo);
  return /^(auto_negativo|auto_positivo|anamnese|escala_[A-Za-z0-9_-]{1,30})$/.test(t) ? t : '';
}

/** Planilha do paciente (pela Controle do dono) ou null. */
function _planilhaDoPaciente_(sigla) {
  var id = _obterPlanilhaIdPaciente_(sigla);
  return id ? _abrirPlanilha_(id) : null;
}

/** Linhas da aba Rascunho como [{linha, tipo, atualizado_em, dados_json}] (aba ausente = lista vazia). */
function _linhasDeRascunho_(planilha) {
  var aba = planilha.getSheetByName(ABA_RASCUNHO);
  if (!aba || aba.getLastRow() < 2) return [];
  var valores = aba.getDataRange().getValues();
  var h = valores[0], iT = h.indexOf('tipo'), iA = h.indexOf('atualizado_em'), iD = h.indexOf('dados_json');
  var out = [];
  for (var i = 1; i < valores.length; i++) {
    var em = valores[i][iA];
    out.push({
      linha: i + 1, tipo: String(valores[i][iT] || ''),
      atualizado_em: em instanceof Date ? Utilities.formatDate(em, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss') : String(em || ''),
      dados_json: String(valores[i][iD] || '')
    });
  }
  return out;
}

/** Apaga o rascunho do tipo (todas as linhas dele). Devolve quantas apagou. */
function _apagarRascunhoDoTipo_(planilha, tipo) {
  var linhas = _linhasDeRascunho_(planilha), apagadas = 0;
  for (var i = linhas.length - 1; i >= 0; i--) {
    if (linhas[i].tipo === tipo) { planilha.getSheetByName(ABA_RASCUNHO).deleteRow(linhas[i].linha); apagadas++; }
  }
  return apagadas;
}

/** "Enviar" apaga o rascunho do tipo: chamado por cada gravacao definitiva, na mesma chamada. */
function _rascunhoEnviado_(planilha, tipos) {
  try {
    for (var i = 0; i < tipos.length; i++) {
      if (_tipoDeRascunho_(tipos[i])) _apagarRascunhoDoTipo_(planilha, tipos[i]);
    }
  } catch (e) {
    console.error('rascunho: nao apagado depois do envio: ' + String(e && e.message || e).slice(0, 160));
  }
}

/** Grava (ou regrava) o rascunho do tipo. Saida: { ok, tipo, atualizado_em }. */
function salvarRascunho(sigla, tipo, dados) {
  var t = _tipoDeRascunho_(tipo);
  if (!t || !dados || typeof dados !== 'object' || Array.isArray(dados)) return { ok: false, erro: MSG_OCUPADO };
  var json = JSON.stringify(dados);
  if (json.length > RASCUNHO_MAX) {
    console.error('salvarRascunho: rascunho com ' + json.length + ' caracteres recusado (tipo ' + t + ')');
    return { ok: false, erro: MSG_OCUPADO };
  }
  var planilha = _planilhaDoPaciente_(sigla);
  if (!planilha) return { ok: false, erro: 'Paciente nao encontrado' };
  var aba = planilha.getSheetByName(ABA_RASCUNHO);
  if (!aba) aba = planilha.insertSheet(ABA_RASCUNHO);
  var header = _garantirColunas_(aba, HEADERS_RASCUNHO);
  var agora = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss');
  var valores = { tipo: t, atualizado_em: agora, dados_json: json };
  var existentes = _linhasDeRascunho_(planilha), alvo = 0;
  for (var i = 0; i < existentes.length; i++) if (existentes[i].tipo === t) { alvo = existentes[i].linha; break; }
  if (alvo) {
    for (var col in valores) aba.getRange(alvo, header.indexOf(col) + 1).setValue(_celulaTexto_(col, valores[col]));
  } else {
    _anexarPorCabecalho_(aba, header, valores);
  }
  return { ok: true, tipo: t, atualizado_em: agora };
}

/** Rascunhos do paciente: { ok, rascunhos: [{tipo, atualizado_em, dados}] } (linha ilegivel e pulada). */
function lerRascunhos(sigla) {
  var planilha = _planilhaDoPaciente_(sigla);
  if (!planilha) return { ok: false, erro: 'Paciente nao encontrado' };
  var linhas = _linhasDeRascunho_(planilha), out = [];
  for (var i = 0; i < linhas.length; i++) {
    if (!_tipoDeRascunho_(linhas[i].tipo)) continue;
    try {
      var dados = JSON.parse(linhas[i].dados_json);
      if (dados && typeof dados === 'object') out.push({ tipo: linhas[i].tipo, atualizado_em: linhas[i].atualizado_em, dados: dados });
    } catch (e) { /* linha ilegivel: fica de fora */ }
  }
  return { ok: true, rascunhos: out };
}

function apagarRascunho(sigla, tipo) {
  var t = _tipoDeRascunho_(tipo);
  if (!t) return { ok: false, erro: MSG_OCUPADO };
  var planilha = _planilhaDoPaciente_(sigla);
  if (!planilha) return { ok: false, erro: 'Paciente nao encontrado' };
  return { ok: true, tipo: t, apagados: _apagarRascunhoDoTipo_(planilha, t) };
}

/** Tipos de rascunho que um registro enviado encerra (negativo, positivo ou os dois). */
function _tiposDoRegistro_(dados) {
  var tipos = [];
  if (dados && dados.neg_preenchido === 'sim') tipos.push('auto_negativo');
  if (dados && dados.pos_preenchido === 'sim') tipos.push('auto_positivo');
  return tipos;
}

/** Versao do formulario pela aba em que a linha e gravada. */
function _versaoDoFormulario_(nomeAba) {
  if (nomeAba === ABA_ANAMNESE) return VERSAO_FORM_ANAMNESE;
  if (nomeAba === ABA_ESCALAS) return VERSAO_FORM_ESCALAS;
  return VERSAO_FORM_AUTO;
}

function salvarAutomonitoramento(sigla, dados) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };

  var planilhaIndividualId = extrairIdDaUrl(paciente.link_planilha_individual);
  var planilha = _abrirPlanilha_(planilhaIndividualId);
  var aba = planilha.getSheetByName(ABA_AUTOMONITORAMENTO);

  dados = _dadosDoCliente_(dados);
  var repetido = _linhaDoEnvio_(aba, dados.id_envio);
  if (repetido) {
    _rascunhoEnviado_(planilha, _tiposDoRegistro_(dados));
    return _respostaDuplicado_(planilha, ABA_AUTOMONITORAMENTO, repetido, 'Registro salvo com sucesso');
  }

  var linha = montarLinha(aba, dados);
  aba.appendRow(linha);
  _indicadoresAposGravar_(paciente.__profissional_id, sigla, planilha);
  if (_registroCompleto_(dados)) _lembretesCumprir_(paciente.__profissional_id, sigla, 'auto'); // 19.2.1: checagem sozinha nao conta
  _rascunhoEnviado_(planilha, _tiposDoRegistro_(dados)); // 18.10b

  return { ok: true, mensagem: 'Registro salvo com sucesso' };
}

/**
 * Monta uma linha para insercao seguindo a ordem dos cabecalhos
 * da aba. Continua aditiva: campos ausentes viram vazios, novos
 * cabecalhos sao preenchidos automaticamente.
 */
function montarLinha(aba, dados, doServidor) {
  var cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var agora = new Date();
  var linha = [];
  var versao = _versaoDoFormulario_(aba.getName());

  for (var i = 0; i < cabecalhos.length; i++) {
    var col = cabecalhos[i];
    if (col === 'timestamp') {
      linha.push(Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss'));
    } else if (col === 'versao_formulario') {
      linha.push(versao);
    } else if (CAMPOS_DO_SERVIDOR.indexOf(col) !== -1) {
      // 18.10 (8.46): auditoria e trava de presenca nunca vem do cliente; 18.5: doServidor traz o que
      // o proprio servidor decide gravar na linha nova (criado_por, editado_por, editado_em)
      linha.push(doServidor && doServidor[col] !== undefined ? _celulaTexto_(col, doServidor[col]) : '');
    } else if (dados && dados[col] !== undefined && dados[col] !== null) {
      linha.push(_celulaTexto_(col, dados[col])); // 18.2: texto digitado nunca vira formula nem e retipado
    } else {
      linha.push('');
    }
  }
  return linha;
}

/**
 * Registra a data de anamnese do paciente na Controle do profissional
 * dono. Recebe profissional_id ja resolvido (de buscarPaciente).
 */
function registrarDataAnamnese(sigla, profissionalId) {
  var controle = abrirControleDoProfissional(profissionalId);
  if (!controle) return;

  var aba = controle.getSheetByName(ABA_PACIENTES);
  if (!aba) return;

  var dados = aba.getDataRange().getValues();
  var cabecalhos = dados[0];
  var idxSigla = cabecalhos.indexOf('sigla');
  var idxDataAnamnese = cabecalhos.indexOf('data_anamnese');

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxSigla]).trim().toUpperCase() === String(sigla).trim().toUpperCase()) {
      var hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
      aba.getRange(i + 1, idxDataAnamnese + 1).setValue(hoje);
      return;
    }
  }
}


// ============================================================
// LEITURA DE DADOS
// ============================================================

/**
 * Pacote 13.6.2: Retorna o editando_quem atual de um registro pelo timestamp.
 * Leitura pública do lock de presença — sem auth, campo não-sensível.
 */
function lerEditandoAuto(sigla, timestamp) {
  if (!sigla || !timestamp) return { ok: false, erro: 'Parametros ausentes' };
  var planilhaId = _obterPlanilhaIdPaciente_(sigla);
  if (!planilhaId) return { ok: false, erro: 'Paciente nao encontrado' };
  // 18.11: leitura de verdade — uma ida a aba (so leitura; sem criar coluna) e a resposta sai dela
  var aba = _abrirPlanilha_(planilhaId).getSheetByName(ABA_AUTOMONITORAMENTO);
  if (!aba || aba.getLastRow() < 2) return { ok: true, editando_quem: '' };
  var dados = aba.getDataRange().getValues();
  var idxTs = dados[0].indexOf('timestamp'), idx = dados[0].indexOf('editando_quem');
  if (idxTs === -1 || idx === -1) return { ok: true, editando_quem: '' };
  var tsLimpo = String(timestamp).trim();
  for (var i = 1; i < dados.length; i++) {
    if (_tsNormalizar_(dados[i][idxTs]) === tsLimpo) return { ok: true, editando_quem: String(dados[i][idx] || '').trim() };
  }
  return { ok: true, editando_quem: '' }; // registro nao encontrado = sem lock
}

// ---------- 18.5 (8.87): leituras do paciente por colunas e paginadas ----------

// Colunas que as telas do paciente leem de cada registro e de cada escala (cartao, lupa, edicao e
// Painel), pelo nome do cabecalho. Ficam de fora as que so o servidor usa (versao_formulario,
// id_envio, editando_desde). Coluna que a aba ainda nao tem simplesmente nao vem.
var COLUNAS_LEITURA_AUTO = [
  'timestamp', 'data_registro', 'hora_registro', 'humor_nivel', 'humor_observacoes', 'neg_preenchido', 'pos_preenchido',
  'neg_sit_o_que', 'neg_sit_tipo_interpessoais', 'neg_sit_tipo_desempenho', 'neg_sit_tipo_solidao', 'neg_sit_tipo_perda',
  'neg_sit_tipo_internas', 'neg_emo_tristeza', 'neg_emo_ansiedade', 'neg_emo_raiva', 'neg_emo_culpa', 'neg_emo_ciume',
  'neg_fis_ativacao', 'neg_fis_desativacao', 'neg_fis_tensao', 'neg_fis_digestivas', 'neg_fis_sono', 'neg_pens_o_que',
  'neg_pens_sobre_mim', 'neg_pens_sobre_futuro', 'neg_pens_sobre_outros', 'neg_pens_cobranca', 'neg_pens_culpa',
  'neg_comp_o_que', 'neg_comp_evitacao', 'neg_comp_isolamento', 'neg_comp_reatividade', 'neg_comp_entorpecimento',
  'neg_comp_controle', 'pos_sit_o_que', 'pos_emo_felicidade', 'pos_emo_orgulho', 'pos_emo_conexao',
  'pos_emo_calma', 'pos_emo_esperanca', 'pos_fis_calma', 'pos_fis_energia', 'pos_fis_relaxamento', 'pos_fis_digestivo',
  'pos_fis_atencao', 'pos_pens_o_que', 'pos_pens_autocompaixao', 'pos_pens_esperanca', 'pos_pens_confianca',
  'pos_pens_flexibilidade', 'pos_pens_responsabilidade', 'pos_comp_o_que', 'pos_comp_enfrentamento', 'pos_comp_conexao',
  'pos_comp_expressao', 'pos_comp_autocuidado', 'pos_comp_aceitacao',
  'editando_quem', 'editado', 'editado_por', 'editado_em', 'criado_por', 'autoria_campos', 'criado_por_nome'
];
var COLUNAS_LEITURA_ESCALAS = [
  'timestamp', 'data_aplicacao', 'instrumento', 'versao_instrumento',
  'item_01', 'item_02', 'item_03', 'item_04', 'item_05', 'item_06', 'item_07', 'item_08', 'item_09', 'item_10',
  'item_11', 'item_12', 'item_13', 'item_14', 'item_15', 'item_16', 'item_17', 'item_18', 'item_19', 'item_20', 'item_21',
  'item_22', 'item_23', 'item_24', // 17.2
  'item_25', 'item_26', // 17.5
  'item_funcional', 'item_funcional_texto', 'escore_total', 'escore_depressao', 'escore_ansiedade', 'escore_estresse',
  'escore_precontemplacao', 'escore_contemplacao', 'escore_acao', 'escore_manutencao', 'escore_prontidao', // 17.2
  'escore_afeto_positivo', 'escore_afeto_negativo', 'escore_verificacao', 'escore_lavagem', 'escore_ordenacao', 'escore_acumulacao', // 17.5
  'escore_obsessoes', 'escore_neutralizacao', 'escore_desatencao', 'escore_hiperatividade', 'escore_bondade', 'escore_autocritica',
  'escore_humanidade', 'escore_isolamento', 'escore_mindfulness', 'escore_sobreidentificacao', 'escore_autocompaixao',
  // 17.6: lote E - FTND (somas: matinal, padrao), EAAD/ESTUD (medias das 4 subescalas + media geral dos 24 itens)
  'escore_matinal', 'escore_padrao', 'escore_emocoes_negativas', 'escore_social_positivo', 'escore_preocupacoes', 'escore_abstinencia_impulsos', 'escore_media_geral',
  // 17.7: lote F - EPM (somas: processos cognitivos e comportamentais; total dos 20 itens)
  'escore_cognitivos', 'escore_comportamentais', 'escore_total_processos',
  // 17.7 (fechamento): SAS-LV (medias dos cinco fatores + total dos 33 itens)
  'escore_perturbacao', 'escore_antecipacao', 'escore_abstinencia', 'escore_ciberespaco', 'escore_uso_excessivo', 'escore_total_sas',
  // 17.8: lote C - DERS (seis somas + total), PTCI (tres medias + total), CORE-OM (quatro medias + escore clinico), BIS-11 (duas somas)
  'escore_nao_aceitacao', 'escore_objetivos', 'escore_impulsos', 'escore_consciencia', 'escore_estrategias', 'escore_clareza', 'escore_total_ders',
  'escore_self', 'escore_mundo', 'escore_autoculpa', 'escore_total_ptci',
  'escore_bem_estar', 'escore_problemas', 'escore_funcionamento', 'escore_risco', 'escore_clinico',
  'escore_controle_inibitorio', 'escore_nao_planejamento',
  'faixa', 'alerta_risco_flag', 'alerta_risco_item', 'alerta_risco_valor', 'observacoes', 'tempo_preenchimento_seg',
  'editado_por', 'editado_em', 'criado_por', 'autoria_campos', 'criado_por_nome'
];
var PAGINA_LEITURA = 60;      // registros por pagina (os mais recentes primeiro)
var PAGINA_LEITURA_MAX = 200;

/**
 * Uma pagina da aba, do fim para o comeco: pula os antes registros mais recentes e devolve
 * ate limite (em ordem cronologica, como sempre), so com as colunas pedidas. Uma leitura
 * do cabecalho e uma do bloco de linhas — nunca a aba inteira.
 * Saida: { registros, total, tem_mais }.
 */
function _lerPagina_(aba, colunas, antes, limite) {
  var vazio = { registros: [], total: 0, tem_mais: false };
  if (!aba) return vazio;
  var total = aba.getLastRow() - 1;
  if (total < 1) return vazio;
  var pular = Math.max(0, parseInt(antes, 10) || 0);
  var n = parseInt(limite, 10);
  n = Math.min(PAGINA_LEITURA_MAX, n > 0 ? n : PAGINA_LEITURA);
  var fim = total - pular;            // ultimo registro da pagina (1 = o mais antigo)
  if (fim < 1) return { registros: [], total: total, tem_mais: false };
  var inicio = Math.max(1, fim - n + 1);
  var largura = aba.getLastColumn();
  var cabecalhos = aba.getRange(1, 1, 1, largura).getValues()[0];
  var linhas = aba.getRange(inicio + 1, 1, fim - inicio + 1, largura).getValues();
  var indices = [];
  for (var c = 0; c < colunas.length; c++) {
    var ic = cabecalhos.indexOf(colunas[c]);
    if (ic !== -1) indices.push(ic);
  }
  var registros = [];
  for (var i = 0; i < linhas.length; i++) {
    var obj = {};
    for (var k = 0; k < indices.length; k++) obj[cabecalhos[indices[k]]] = _valorDeLeitura_(cabecalhos[indices[k]], linhas[i][indices[k]]);
    registros.push(obj);
  }
  return { registros: registros, total: total, tem_mais: inicio > 1 };
}

/** Existe algum registro com a coluna = valor fora da pagina? (le so a coluna) */
function _colunaTemValor_(aba, coluna, valor) {
  if (!aba || aba.getLastRow() < 2) return false;
  var cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var idx = cabecalhos.indexOf(coluna);
  if (idx === -1) return false;
  var valores = aba.getRange(2, idx + 1, aba.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < valores.length; i++) if (String(valores[i][0]).trim() === valor) return true;
  return false;
}

/**
 * Historico do paciente (18.5, 8.87): os PAGINA_LEITURA registros mais recentes, so com as
 * colunas de COLUNAS_LEITURA_AUTO; antes = quantos o cliente ja tem ("carregar mais" pede
 * os anteriores). A anamnese vem so na primeira pagina. total_registros e o total da aba
 * e tem_negativo diz se ha Registro Negativo em qualquer pagina (a primeira vez do
 * paciente nao pode depender do que coube na pagina).
 */
function lerHistorico(sigla, antes, limite) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };

  var planilhaIndividualId = extrairIdDaUrl(paciente.link_planilha_individual);
  var planilha = _abrirPlanilha_(planilhaIndividualId);

  var abaAuto = planilha.getSheetByName(ABA_AUTOMONITORAMENTO);
  var pagina = _lerPagina_(abaAuto, COLUNAS_LEITURA_AUTO, antes, limite);
  var temNegativo = pagina.registros.some(function (r) { return r.neg_preenchido === 'sim'; });
  if (!temNegativo && pagina.registros.length < pagina.total) temNegativo = _colunaTemValor_(abaAuto, 'neg_preenchido', 'sim');

  var nomesCarimbo = _nomesDoCarimbo_(sigla, paciente.__profissional_id); // 18.8.1
  var resposta = {
    ok: true,
    automonitoramento: _carimbosDoCadastro_(pagina.registros, nomesCarimbo),
    total_registros: pagina.total,
    tem_mais: pagina.tem_mais,
    tem_negativo: temNegativo
  };
  if (!(parseInt(antes, 10) > 0)) {
    var anamnese = lerAbaComoObjetos(planilha, ABA_ANAMNESE);
    resposta.anamnese_preenchida = anamnese.length > 0;
    resposta.anamnese = anamnese.length > 0 ? _carimboDoCadastro_(anamnese[0], nomesCarimbo) : null;
  }
  return resposta;
}

/**
 * Valor de uma celula como as leituras o devolvem ao cliente.
 * Pacote 13.7.6 — lição 22/62: Google Sheets serializa células TIME/DATE como Date
 * objects. Para hora_registro, o Sheets converte "20:35" (local) para UTC internamente;
 * Utilities.formatDate reconverte ao fuso correto. Para campos de data, toISOString
 * dá o formato consistente YYYY-MM-DD.
 */
function _valorDeLeitura_(col, val) {
  if (!(val instanceof Date)) return val;
  if (col === 'hora_registro') {
    // TIME: o Sheets armazena "20:35" como UTC 23:35 (offset São Paulo).
    return Utilities.formatDate(val, 'America/Sao_Paulo', 'HH:mm');
  }
  if (col === 'data_registro' || col === 'data_aplicacao' || col === 'data_anamnese') {
    // DATE: manter em YYYY-MM-DD usando UTC para evitar off-by-one
    return val.toISOString().slice(0, 10);
  }
  if (col === 'timestamp' || col === 'editando_desde' || col === 'editado_em') {
    // DATETIME: manter como ISO string completo
    return val.toISOString();
  }
  return val; // outros campos Date: deixar o JSON.stringify serializar normalmente
}

function lerAbaComoObjetos(planilha, nomeAba) {
  var aba = planilha.getSheetByName(nomeAba);
  if (!aba) return [];
  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return [];

  var cabecalhos = dados[0];
  var resultado = [];
  for (var i = 1; i < dados.length; i++) {
    var obj = {};
    for (var j = 0; j < cabecalhos.length; j++) obj[cabecalhos[j]] = _valorDeLeitura_(cabecalhos[j], dados[i][j]);
    resultado.push(obj);
  }
  return resultado;
}


// ============================================================
// UTILITARIOS
// ============================================================

function extrairIdDaUrl(url) {
  if (!url) return '';
  var match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : String(url);
}


// ============================================================
// ESCALAS E INVENTARIOS (Modulo 4)
// ============================================================

function salvarEscala(sigla, dados) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };

  var planilhaIndividualId = extrairIdDaUrl(paciente.link_planilha_individual);
  var planilha = _abrirPlanilha_(planilhaIndividualId);
  var aba = planilha.getSheetByName(ABA_ESCALAS);

  if (!aba) {
    return {
      ok: false,
      erro: 'Aba "Escalas" nao encontrada na planilha individual.'
    };
  }

  dados = _dadosDoCliente_(dados);
  var repetido = _linhaDoEnvio_(aba, dados.id_envio);
  // 18.10b: o rascunho da escala e `escala_<codigo>`; o codigo e o `instrumento` gravado
  var tipoRascunho = 'escala_' + String(dados.instrumento || '');
  if (repetido) {
    _rascunhoEnviado_(planilha, [tipoRascunho]);
    return _respostaDuplicado_(planilha, ABA_ESCALAS, repetido, 'Escala salva com sucesso');
  }

  // 17.2: planilhas antigas nao tem item_22..item_24 nem as colunas das subescalas da URICA -
  // montarLinha grava pelo nome do cabecalho e descartaria o que nao existe (aditivo: so acrescenta).
  _garantirColunas_(aba, HEADERS_ESCALAS);
  var linha = montarLinha(aba, dados);
  aba.appendRow(linha);
  _indicadoresAposGravar_(paciente.__profissional_id, sigla, planilha);
  _lembretesCumprir_(paciente.__profissional_id, sigla, 'escala', dados.instrumento); // 19.2.1
  _rascunhoEnviado_(planilha, [tipoRascunho]);

  return { ok: true, mensagem: 'Escala salva com sucesso' };
}

/** Escalas do paciente (18.5, 8.87): paginadas e por colunas, como lerHistorico. */
function lerEscalas(sigla, antes, limite) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };

  var planilhaIndividualId = extrairIdDaUrl(paciente.link_planilha_individual);
  var planilha = _abrirPlanilha_(planilhaIndividualId);

  var pagina = _lerPagina_(planilha.getSheetByName(ABA_ESCALAS), COLUNAS_LEITURA_ESCALAS, antes, limite);
  return {
    ok: true,
    total: pagina.total,
    tem_mais: pagina.tem_mais,
    escalas: _carimbosDoCadastro_(pagina.registros, _nomesDoCarimbo_(sigla, paciente.__profissional_id)) // 18.8.1
  };
}

// ============================================================
// PACOTE 17.0 - ITENS DOS INVENTARIOS (BDI-II, BAI)
// ============================================================
// Regras (docs/escalas/ESPEC_escalas_beck.md, secoes 0.1 e 5):
//   1. Nenhum texto de item vive no codigo: o repositorio e o site sao publicos.
//      Enunciados, afirmacoes e instrucoes ficam na aba Itens_Instrumentos da
//      Sistema_VMC e so saem daqui para quem tem sessao valida.
//   2. Um instrumento so e entregue quando a linha de controle (tipo='controle')
//      tem ativo='SIM' E o hash gravado nela bate com o conteudo atual da aba.
//      Qualquer edicao posterior derruba o hash: o instrumento sai do menu do
//      paciente ate nova conferencia e nova liberacao pelo script de carga.
//   3. Default seguro: aba ausente, instrumento desconhecido, sem liberacao ou
//      com hash divergente => nao entrega texto nenhum e nao aparece no menu.
//   4. A acao nao grava nada (fica FORA de VMC_ACOES_GRAVACAO no frontend).

var INSTRUMENTOS_VALIDOS = ['bdi2', 'bai', 'bhs', 'bsi', 'urica_alcool', 'urica_drogas', 'urica_tabaco', 'urica_alimentar', // 17.1: + BHS e BSS (id tecnico 'bsi'); 17.2: + as quatro URICA
  'pcl5', 'pswq', 'ear', 'aaq2', 'swls', 'maas', 'wbsi', // 17.3: lote A da HumanTrack (PCL-5, PSWQ, EAR, AAQ-II, SWLS, MAAS, WBSI)
  'panas', 'spin', 'ocir', 'asrs', 'scs', // 17.5: lote B (PANAS, SPIN, OCI-R, ASRS-18, SCS)
  'audit', 'ftnd', 'gsas', 'eaad', 'estud', // 17.6: lote E, dependencias (AUDIT, FTND, G-SAS, EAAD, ESTUD)
  'dudit', 'sast', 'epm', 'piuq', 'saslv', // 17.7: lote F (DUDIT, SAST, EPM, PIUQ-SF-9, SAS-LV)
  'cfq7', 'ders', 'ptci', 'coreom', 'bis11']; // 17.8: lote C (CFQ-7, DERS, PTCI, CORE-OM, BIS-11)

// 17.1.2 (decisao do usuario, 19/11/2026): instrumentos que o paciente so ve quando o profissional
// libera para ele - lista em 'escalas_liberadas' na linha do paciente na Controle (coluna criada no
// primeiro uso). O profissional sempre pode aplicar pelo "Nova escala".
// 17.2 (decisao do usuario, 20/11/2026): as quatro URICA tambem - o profissional libera a versao certa para
// cada paciente; sem isso, quatro cartoes de dependencia apareceriam no menu de quem nao usa.
// 17.3 (decisao do usuario, 20/11/2026): as sete do lote A tambem - o profissional libera o que cada paciente responde.
// 17.3.1 (decisao do usuario, 20/11/2026): TODA escala e por liberacao, inclusive as cinco do 12.x e as tres Beck.
// ESCALAS_MENU mapeia o codigo gravado em 'instrumento' (aba Escalas) para o id usado em 'escalas_liberadas'.
var ESCALAS_MENU = { 'PHQ-9': 'phq9', 'GAD-7': 'gad7', 'PSS-10': 'pss10', 'DASS-21': 'dass21', 'SRQ-20': 'srq20',
  'BDI-II': 'bdi2', 'BAI': 'bai', 'BHS': 'bhs', 'BSS': 'bsi',
  'URICA-A': 'urica_alcool', 'URICA-D': 'urica_drogas', 'URICA-T': 'urica_tabaco', 'URICA-HA': 'urica_alimentar',
  'PCL-5': 'pcl5', 'PSWQ': 'pswq', 'EAR': 'ear', 'AAQ-II': 'aaq2', 'SWLS': 'swls', 'MAAS': 'maas', 'WBSI': 'wbsi',
  'PANAS': 'panas', 'SPIN': 'spin', 'OCI-R': 'ocir', 'ASRS-18': 'asrs', 'SCS': 'scs', // 17.5: lote B
  'AUDIT': 'audit', 'FTND': 'ftnd', 'G-SAS': 'gsas', 'EAAD': 'eaad', 'ESTUD': 'estud', // 17.6: lote E
  'DUDIT': 'dudit', 'SAST': 'sast', 'EPM': 'epm', 'PIUQ-SF-9': 'piuq', 'SAS-LV': 'saslv', // 17.7: lote F
  'CFQ-7': 'cfq7', 'DERS': 'ders', 'PTCI': 'ptci', 'CORE-OM': 'coreom', 'BIS-11': 'bis11' }; // 17.8: lote C
var INSTRUMENTOS_SO_PROFISSIONAL = Object.keys(ESCALAS_MENU).map(function (c) { return ESCALAS_MENU[c]; });

/** Id de liberacao de uma escala pelo codigo do catalogo ('' se desconhecido). */
function _idDaEscala_(codigo) { return ESCALAS_MENU[String(codigo || '').trim()] || ''; }

/** 17.3.1: escala aplicada pelo profissional fica aberta para o paciente; grava so se ainda nao estava. Devolve a lista. */
function _abrirEscalaParaPaciente_(profissionalId, sigla, codigoEscala) {
  var id = _idDaEscala_(codigoEscala);
  var lista = _escalasLiberadasDoPaciente_(sigla);
  if (!id || lista.indexOf(id) !== -1) return lista;
  lista.push(id);
  var controle = abrirControleDoProfissional(profissionalId);
  if (controle) _atualizarLinhaPorChave_(controle.getSheetByName(ABA_PACIENTES), 'sigla', sigla, { escalas_liberadas: lista.join(',') });
  return lista;
}

function _escalasLiberadasLista_(valor) {
  return String(valor === undefined || valor === null ? '' : valor).toLowerCase().split(',')
    .map(function (x) { return x.trim(); }).filter(Boolean);
}
function _escalasLiberadasDoPaciente_(sigla) {
  var pac = buscarPaciente(sigla);
  return pac ? _escalasLiberadasLista_(pac.escalas_liberadas) : [];
}
function _instrumentoVisivelAoPaciente_(instrumento, liberadasDoPaciente) {
  return INSTRUMENTOS_SO_PROFISSIONAL.indexOf(instrumento) === -1 || liberadasDoPaciente.indexOf(instrumento) !== -1;
}

/**
 * Normalizacao canonica de uma celula para o hash.
 * O mesmo algoritmo roda no script Python de carga - qualquer divergencia aqui
 * derruba a liberacao (que e exatamente o comportamento seguro desejado).
 *   vazio           -> ''
 *   numero inteiro  -> sem casa decimal ('1', nao '1.0')
 *   resto           -> texto com espacos das pontas removidos
 */
function _itensNormalizar_(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') {
    return (valor === Math.floor(valor)) ? String(Math.floor(valor)) : String(valor);
  }
  return String(valor).trim();
}

/**
 * Hash SHA-256 (hex minusculo) do conteudo de um instrumento.
 * Serializacao canonica: uma linha "tipo|item|opcao|texto" por registro de
 * conteudo (a linha de controle fica de fora), ordenadas alfabeticamente e
 * unidas por \n. A ordenacao torna o hash independente da ordem das linhas na
 * aba, entao reordenar a planilha nao derruba a liberacao - so mudar texto.
 */
function _itensHashConteudo_(linhas) {
  var partes = [];
  for (var i = 0; i < linhas.length; i++) {
    var l = linhas[i];
    if (_itensNormalizar_(l.tipo).toLowerCase() === 'controle') continue;
    partes.push(
      _itensNormalizar_(l.tipo) + '|' +
      _itensNormalizar_(l.item) + '|' +
      _itensNormalizar_(l.opcao) + '|' +
      _itensNormalizar_(l.texto)
    );
  }
  partes.sort();
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, partes.join('\n'), Utilities.Charset.UTF_8);
  var hex = '';
  for (var b = 0; b < bytes.length; b++) {
    var v = (bytes[b] < 0) ? bytes[b] + 256 : bytes[b];
    hex += (v < 16 ? '0' : '') + v.toString(16);
  }
  return hex;
}

/**
 * Confere a sessao de quem pediu os textos: cracha de paciente ou de
 * profissional (assinatura, validade e `ativo` ja conferidos no doPost).
 * Admin ou sem cracha: recusa.
 */
function _itensSessaoValida_(s) {
  if (s && (s.tipo === 'paciente' || s.tipo === 'profissional')) return { ok: true, quem: s.tipo };
  return { ok: false, erro: 'Sessao invalida' };
}

/**
 * Le a aba Itens_Instrumentos e devolve so as linhas de um instrumento.
 * Aba ausente ou vazia => lista vazia (e o instrumento fica indisponivel).
 */
function _itensLinhasDoInstrumento_(todas, instrumento) {
  var alvo = String(instrumento).trim().toLowerCase();
  var saida = [];
  for (var i = 0; i < todas.length; i++) {
    if (_itensNormalizar_(todas[i].instrumento).toLowerCase() === alvo) saida.push(todas[i]);
  }
  return saida;
}

/**
 * Estado de liberacao de um instrumento: liberado apenas se houver linha de
 * controle com ativo='SIM' e hash igual ao conteudo atual.
 */
function _itensEstado_(linhas) {
  var controle = null;
  for (var i = 0; i < linhas.length; i++) {
    if (_itensNormalizar_(linhas[i].tipo).toLowerCase() === 'controle') { controle = linhas[i]; break; }
  }
  if (!controle) return { liberado: false, motivo: 'sem_controle' };
  if (_itensNormalizar_(controle.ativo).toUpperCase() !== 'SIM') {
    return { liberado: false, motivo: 'nao_liberado' };
  }
  var hashGravado = _itensNormalizar_(controle.texto).toLowerCase();
  var hashAtual = _itensHashConteudo_(linhas);
  if (!hashGravado || hashGravado !== hashAtual) {
    return { liberado: false, motivo: 'hash_divergente' };
  }
  return { liberado: true, hash: hashAtual };
}

/**
 * Monta os textos de um instrumento no formato que o frontend consome.
 * Nenhuma transformacao alem do agrupamento: o texto vai como esta na aba
 * (secao 0.1 item 3 da especificacao - o escape de HTML e feito na tela).
 */
function _itensMontarTextos_(linhas) {
  var out = { instrucao: '', titulos: {}, itens: {}, opcoes: {}, ancoras: {} };
  for (var i = 0; i < linhas.length; i++) {
    var l = linhas[i];
    var tipo = _itensNormalizar_(l.tipo).toLowerCase();
    var item = _itensNormalizar_(l.item);
    var opcao = _itensNormalizar_(l.opcao);
    var texto = _itensNormalizar_(l.texto);
    if (tipo === 'instrucao') {
      out.instrucao = texto;
    } else if (tipo === 'titulo') {
      out.titulos[item] = texto;
    } else if (tipo === 'item') {
      out.itens[item] = texto;
    } else if (tipo === 'opcao') {
      if (!out.opcoes[item]) out.opcoes[item] = [];
      out.opcoes[item].push({ codigo: opcao, texto: texto });
    } else if (tipo === 'ancora_rotulo' || tipo === 'ancora_descricao') {
      if (!out.ancoras[opcao]) out.ancoras[opcao] = { codigo: opcao, rotulo: '', descricao: '' };
      if (tipo === 'ancora_rotulo') out.ancoras[opcao].rotulo = texto;
      else out.ancoras[opcao].descricao = texto;
    }
  }
  // Ordem das opcoes: 0, 1, 2, 3 e, nos itens de 7 opcoes, 0, 1a, 1b, 2a, 2b,
  // 3a, 3b - digito primeiro, letra depois, como na folha impressa.
  Object.keys(out.opcoes).forEach(function (k) {
    out.opcoes[k].sort(function (a, b) {
      var na = parseInt(a.codigo, 10), nb = parseInt(b.codigo, 10);
      if (na !== nb) return na - nb;
      return String(a.codigo).localeCompare(String(b.codigo));
    });
  });
  return out;
}

/**
 * Acao lerItensInstrumento.
 *
 * Entrada: payload [+ instrumento]; s = sessao do cracha (paciente ou profissional).
 *
 * Sem 'instrumento': { ok: true, liberados: ['bdi2'] } - so a lista, sem texto,
 *   para o menu decidir quais cartoes mostrar.
 * Com 'instrumento' liberado: { ok: true, instrumento, hash, textos: {...} }.
 * Com 'instrumento' nao liberado: { ok: false, erro, motivo } - sem texto.
 */
function lerItensInstrumento(payload, s) {
  payload = payload || {};
  var sessao = _itensSessaoValida_(s);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  var sistema;
  try {
    sistema = _abrirPlanilha_(SISTEMA_VMC_ID);
  } catch (e) {
    return { ok: false, erro: 'Planilha do sistema indisponivel' };
  }
  var todas = lerAbaComoObjetos(sistema, ABA_ITENS_INSTRUMENTOS);

  var pedido = _itensNormalizar_(payload.instrumento).toLowerCase();
  // 17.1.2: para o paciente, os instrumentos 'so do profissional' dependem da liberacao por paciente
  var doPaciente = (sessao.quem === 'paciente') ? _escalasLiberadasDoPaciente_(s.sigla) : null;

  // Sem instrumento: devolve so quais estao liberados (nenhum texto).
  if (!pedido) {
    var liberados = [];
    if (doPaciente) {
      // 17.3.1: para o paciente, toda escala depende da liberacao (escalas_liberadas). As cinco do 12.x nao
      // tem texto na aba e entram direto; as da aba so quando a aba as libera (ativo=SIM e hash conferido).
      for (var p = 0; p < doPaciente.length; p++) {
        var idp = doPaciente[p];
        if (INSTRUMENTOS_SO_PROFISSIONAL.indexOf(idp) === -1 || liberados.indexOf(idp) !== -1) continue;
        if (INSTRUMENTOS_VALIDOS.indexOf(idp) === -1) { liberados.push(idp); continue; }
        if (_itensEstado_(_itensLinhasDoInstrumento_(todas, idp)).liberado) liberados.push(idp);
      }
      return { ok: true, liberados: liberados };
    }
    for (var i = 0; i < INSTRUMENTOS_VALIDOS.length; i++) {
      var cod = INSTRUMENTOS_VALIDOS[i];
      var est = _itensEstado_(_itensLinhasDoInstrumento_(todas, cod));
      if (est.liberado && (!doPaciente || _instrumentoVisivelAoPaciente_(cod, doPaciente))) liberados.push(cod);
    }
    return { ok: true, liberados: liberados };
  }

  if (INSTRUMENTOS_VALIDOS.indexOf(pedido) === -1) {
    return { ok: false, erro: 'Instrumento desconhecido' };
  }
  if (doPaciente && !_instrumentoVisivelAoPaciente_(pedido, doPaciente)) {
    return { ok: false, erro: 'Instrumento nao liberado', motivo: 'nao_liberado_paciente' };
  }

  var linhas = _itensLinhasDoInstrumento_(todas, pedido);
  var estado = _itensEstado_(linhas);
  if (!estado.liberado) {
    return { ok: false, erro: 'Instrumento nao liberado', motivo: estado.motivo };
  }

  return {
    ok: true,
    instrumento: pedido,
    hash: estado.hash,
    textos: _itensMontarTextos_(linhas)
  };
}


// ============================================================
// PACOTE 13.4.1 - FUNCOES DO PACIENTE
// ============================================================

/**
 * Paciente altera sua propria senha.
 *
 * Sigla do cracha; confere a senha atual (hash v2) e grava o novo hash v2
 * na Controle do profissional dono.
 */
function alterarSenhaPaciente(sigla, senhaAtual, novaSenha) {
  if (!sigla) return { ok: false, erro: 'Sigla obrigatoria' };
  if (!senhaAtual) return { ok: false, erro: 'Senha atual obrigatoria' };
  if (!novaSenha || String(novaSenha).length < SENHA_MINIMA) {
    return { ok: false, erro: 'Escolha uma senha com pelo menos 8 caracteres.' };
  }
  if (String(novaSenha).length > SENHA_MAXIMA) return { ok: false, erro: 'Não foi possível gravar a senha. Tente de novo.' };
  if (String(senhaAtual).length > SENHA_MAXIMA) return { ok: false, erro: 'Senha atual incorreta' };
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };
  if (!conferirSenha(senhaAtual, paciente.senha_hash)) return { ok: false, erro: 'Senha atual incorreta' };
  var hash = _gravarSenhaDaConta_('paciente', paciente.sigla, paciente.__profissional_id, String(novaSenha));
  if (!hash) return { ok: false, erro: 'Paciente nao encontrado na Controle' };
  // 18.1.2: a senha nova derruba os crachas antigos; esta sessao segue com um cracha novo
  var token = emitirToken({ tipo: 'paciente', sigla: String(paciente.sigla).toUpperCase(), profissional_id: paciente.__profissional_id, impressao: impressaoCracha(hash) }, _segredoSessao_(), Date.now());
  return { ok: true, mensagem: 'Senha alterada com sucesso', token: token };
}


/**
 * Paciente atualiza sua propria anamnese (linha 2), sempre por campo: so as colunas
 * de `campos` que mudaram sao gravadas, com carimbo e historico. Sem `campos`, recusa
 * (18.6: o caminho que regravava a linha inteira saiu).
 */
function pacienteAtualizarAnamnese(sigla, campos, idEnvio) {
  if (!sigla) return { ok: false, erro: 'Sigla obrigatoria' };
  if (!campos || typeof campos !== 'object') return { ok: false, erro: 'Dados da anamnese ausentes' };

  // 1. Abrir planilha individual
  var paciente = buscarPaciente(sigla);
  if (!paciente || !paciente.link_planilha_individual) {
    return { ok: false, erro: 'Planilha do paciente nao encontrada' };
  }
  var planilhaId = extrairIdDaUrl(paciente.link_planilha_individual);
  if (!planilhaId) return { ok: false, erro: 'Link da planilha invalido' };

  var planilha = _abrirPlanilha_(planilhaId);
  var aba = planilha.getSheetByName(ABA_ANAMNESE);
  if (!aba) return { ok: false, erro: 'Aba Anamnese nao encontrada' };

  // 2. Edicao por campo (18.5)
  return _editarAnamnesePorCampos_(planilha, aba, campos, 'paciente', idEnvio, paciente.__profissional_id, sigla, 'Anamnese atualizada com sucesso');
}


// ============================================================
// PACOTE 13.4 - CADASTRO DE PACIENTE PELO PROFISSIONAL
// ============================================================

/**
 * Cadastra um novo paciente para o profissional autenticado.
 *
 * Cria automaticamente:
 *   - Planilha individual com 3 abas (Anamnese, Automonitoramento,
 *     Escalas) usando headers padrao
 *   - Move planilha para pasta Pacientes/ do profissional
 *   - Linha na Controle do profissional (sem senha: o acesso nasce no convite)
 *   - Linha no Indice_Siglas (com o e-mail)
 *   - Link de convite (canal 'link'), devolvido para o WhatsApp
 *
 * Seguranca:
 *   - Profissional do cracha de sessao
 *   - profissional_id derivado server-side (nunca do payload)
 *   - Sigla gerada pelo servidor (gerarSiglaPaciente), unica no Indice_Siglas
 *   - E-mail unico entre os pacientes do mesmo profissional (18.1.3)
 *
 * Entrada: dados = { nomeCompleto, email, telefone }
 * Saida:   { ok, sigla, link, email, telefone }
 */
function cadastrarPaciente(s, dados) {
  // 1. Profissional do cracha
  var authResult = _authProfissional_(s);
  if (!authResult.ok) {
    return authResult;
  }
  var profissionalId = authResult.profissional.profissional_id;

  // 2. Validar dados de entrada
  if (!dados) return { ok: false, erro: 'Dados do paciente ausentes' };

  var nome  = String(dados.nomeCompleto || '').trim();
  if (!nome) return { ok: false, erro: 'Nome completo obrigatorio' };
  var contato = normalizarContato({ email: dados.email, telefone: dados.telefone });
  if (contato.erro) return { ok: false, erro: contato.erro };
  if (!contato.email) return { ok: false, erro: 'E-mail do paciente obrigatório.' };

  // 3. Unicidade do e-mail (18.1.3: so entre os pacientes DESTE profissional —
  //    a recusa global revelava vinculo com outro consultorio) e sigla gerada
  //    (unica global, Indice_Siglas)
  var indice = _lerIndice_().linhas;
  var siglasPac = [];
  for (var n = 0; n < indice.length; n++) {
    if (indice[n].tipo !== 'paciente') continue;
    if (indice[n].email === contato.email && indice[n].profissional_id === profissionalId) {
      return { ok: false, erro: 'Este e-mail já está em uso por outra conta.' };
    }
    siglasPac.push(indice[n].sigla);
  }
  Object.keys(_excluidosLer_(abrirControleDoProfissional(profissionalId))).forEach(function (sx) { siglasPac.push(sx); }); // 19.6
  var sigla = gerarSiglaPaciente(nome, siglasPac);
  if (!sigla || !/^[A-Z0-9_]{2,10}$/.test(sigla)) return { ok: false, erro: 'Nao foi possivel gerar a sigla do paciente.' };

  // 4. Localizar pasta Pacientes/ do profissional
  var prof = buscarProfissional(profissionalId);
  if (!prof || !prof.pasta_drive_id) {
    return { ok: false, erro: 'Pasta do profissional nao encontrada' };
  }

  var pastaPacientes;
  try {
    var pastaProf = DriveApp.getFolderById(prof.pasta_drive_id);
    var subpastas = pastaProf.getFoldersByName('Pacientes');
    if (!subpastas.hasNext()) {
      return { ok: false, erro: 'Subpasta Pacientes nao encontrada na pasta do profissional' };
    }
    pastaPacientes = subpastas.next();
  } catch (e) {
    return { ok: false, erro: 'Erro ao acessar pasta do profissional: ' + String(e) };
  }

  // 5. Criar planilha individual do paciente
  try {
    var planilha = SpreadsheetApp.create(sigla);

    // 5a. Renomear aba default para Anamnese e popular headers
    var abaDefault = planilha.getSheets()[0];
    abaDefault.setName(ABA_ANAMNESE);
    abaDefault.getRange(1, 1, 1, HEADERS_ANAMNESE.length).setValues([HEADERS_ANAMNESE]);
    abaDefault.setFrozenRows(1);
    abaDefault.getRange(1, 1, 1, HEADERS_ANAMNESE.length).setFontWeight('bold');
    _formatarColunasTexto_(abaDefault, HEADERS_ANAMNESE); // 18.2: identificacao nasce como texto

    // 5b. Automonitoramento
    var abaAuto = planilha.insertSheet(ABA_AUTOMONITORAMENTO);
    abaAuto.getRange(1, 1, 1, HEADERS_AUTOMONITORAMENTO.length).setValues([HEADERS_AUTOMONITORAMENTO]);
    abaAuto.setFrozenRows(1);
    abaAuto.getRange(1, 1, 1, HEADERS_AUTOMONITORAMENTO.length).setFontWeight('bold');

    // 5c. Escalas
    var abaEsc = planilha.insertSheet(ABA_ESCALAS);
    abaEsc.getRange(1, 1, 1, HEADERS_ESCALAS.length).setValues([HEADERS_ESCALAS]);
    abaEsc.setFrozenRows(1);
    abaEsc.getRange(1, 1, 1, HEADERS_ESCALAS.length).setFontWeight('bold');

    // 6. Mover planilha para pasta Pacientes/
    var arquivoPlanilha = DriveApp.getFileById(planilha.getId());
    arquivoPlanilha.moveTo(pastaPacientes);

    var linkPlanilha = planilha.getUrl();
    var hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');

    // 7. Adicionar linha na Controle do profissional
    var controle = abrirControleDoProfissional(profissionalId);
    if (!controle) {
      return { ok: false, erro: 'Nao foi possivel abrir a Controle do profissional. Planilha criada em: ' + linkPlanilha };
    }

    var abaCtrl = controle.getSheetByName(ABA_PACIENTES);
    if (!abaCtrl) {
      return { ok: false, erro: 'Aba Pacientes nao encontrada na Controle. Planilha criada em: ' + linkPlanilha };
    }

    // Linha gravada pelo nome do cabecalho; senha_hash vazio ate o convite
    // 18.10: paciente novo ja nasce com os indicadores zerados (a lista nao abre a planilha dele)
    var cabCtrl = _garantirColunas_(abaCtrl, ['email', 'telefone', 'nome'].concat(COLUNAS_INDICADORES));
    _anexarPorCabecalho_(abaCtrl, cabCtrl, {
      sigla: sigla, senha_hash: '', link_planilha_individual: linkPlanilha,
      data_cadastro: hoje, data_anamnese: '', ativo: 'Sim', observacoes: '',
      email: contato.email, telefone: contato.telefone, nome: nome,
      ind_total_auto: 0, ind_total_escalas: 0,
      ind_atualizado_em: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss')
    });

    // 8. Adicionar linha no Indice_Siglas (por nome de cabecalho, com o e-mail)
    _anexarIndice_(sigla, 'paciente', profissionalId, contato.email);

    // 9. Link de convite (canal 'link'): o profissional envia por e-mail ou WhatsApp
    var link = _criarLinkAtivacao_('paciente', sigla, profissionalId, 'convite', contato.email);

    return {
      ok: true,
      mensagem: 'Paciente cadastrado com sucesso',
      sigla: sigla,
      link: link,
      email: contato.email,
      telefone: contato.telefone
    };

  } catch (e) {
    return {
      ok: false,
      erro: 'Erro ao criar planilha do paciente: ' + String(e) +
            '. Pode ter ficado lixo no Drive - verificar manualmente.'
    };
  }
}


/**
 * Profissional edita a anamnese de um paciente (linha 2), sempre por campo: so as
 * colunas de `campos` que mudaram sao gravadas, com carimbo e historico. Sem `campos`,
 * recusa (18.6: o caminho que regravava a linha inteira saiu).
 *
 * Seguranca: profissional do cracha + verifica ownership multi-tenant.
 * Pacote 18.1: contato (opcional) = {email, telefone} grava o cadastro
 * (Controle) antes; sem ele, a Controle nao muda. E-mail e telefone da
 * Anamnese espelham o cadastro.
 */
function profSalvarAnamnese(s, siglaPaciente, contato, campos, idEnvio) {
  // 1. Revalidar credenciais
  var authResult = _authProfissional_(s);
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  // 2. Validar ownership
  if (!siglaPaciente) return { ok: false, erro: 'Sigla do paciente e obrigatoria' };
  var profIdDono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!profIdDono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (profIdDono !== profissionalId) return { ok: false, erro: 'Este paciente nao pertence a voce' };

  if (!campos || typeof campos !== 'object') return { ok: false, erro: 'Dados da anamnese ausentes' };

  if (contato) {
    var rc = _atualizarContatoPaciente_(siglaPaciente, contato);
    if (!rc.ok) return rc;
  }

  // 3. Abrir planilha individual
  var paciente = buscarPaciente(siglaPaciente);
  if (!paciente || !paciente.link_planilha_individual) {
    return { ok: false, erro: 'Planilha do paciente nao encontrada' };
  }
  var planilhaId = extrairIdDaUrl(paciente.link_planilha_individual);
  if (!planilhaId) return { ok: false, erro: 'Link da planilha invalido' };

  var planilha = _abrirPlanilha_(planilhaId);
  var aba = planilha.getSheetByName(ABA_ANAMNESE);
  if (!aba) return { ok: false, erro: 'Aba Anamnese nao encontrada' };

  // 4. Edicao por campo (18.5); e-mail e telefone continuam espelhando o cadastro
  // (sem carimbo: nao sao campos da anamnese)
  if (contato && aba.getLastRow() >= 2) {
    var espelho = _espelharContatoAnamnese_(aba, {}, paciente);
    _atualizarCamposLinha_(aba, 2, aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0], { email: espelho.email, telefone: espelho.telefone });
  }
  return _editarAnamnesePorCampos_(planilha, aba, campos, 'profissional', idEnvio, profissionalId, siglaPaciente, 'Anamnese salva com sucesso');
}


// ============================================================
// PACOTE 13.1 - FUNCOES ADMIN
// ============================================================
// Todas as funcoes admin recebem a sessao (s) do cracha, conferido no
// doPost (assinatura, validade e `ativo` a cada chamada).
// ============================================================


// ============================================================
// PACOTE 13.6 — EDIÇÃO DE AUTOMONITORAMENTO
// ============================================================

/**
 * Garante que as 5 colunas de lock/auditoria existem no header da aba.
 * Aditivo: só adiciona, nunca remove. Retorna o array de cabeçalhos atualizado.
 */
function _garantirColunasAutomonitoramento_(aba) {
  var novas = ['editando_quem', 'editando_desde', 'editado', 'editado_por', 'editado_em'];
  var ultima = aba.getLastColumn();
  var header = aba.getRange(1, 1, 1, ultima).getValues()[0];
  novas.forEach(function(col) {
    if (header.indexOf(col) === -1) {
      ultima++;
      aba.getRange(1, ultima).setValue(col).setFontWeight('bold');
      header.push(col);
    }
  });
  return header;
}

/**
 * Normaliza um valor de célula timestamp para string comparável.
 * Google Sheets pode retornar Date object ou string dependendo do formato da célula.
 * JSON.stringify de Date usa .toISOString() — usamos o mesmo para garantir match.
 */
function _tsNormalizar_(val) {
  if (val instanceof Date) return val.toISOString();
  return String(val).trim();
}

/**
 * Encontra a linha de um registro pelo timestamp.
 * Retorna { aba, rowIndex, cabecalhos } ou null.
 */
function _encontrarLinhaAuto_(planilhaId, timestamp) {
  var planilha = _abrirPlanilha_(planilhaId);
  var aba = planilha.getSheetByName(ABA_AUTOMONITORAMENTO);
  if (!aba) return null;
  var cabecalhos = _garantirColunasAutomonitoramento_(aba);
  var dados = aba.getDataRange().getValues();
  var idxTs = cabecalhos.indexOf('timestamp');
  if (idxTs === -1) return null;
  var tsLimpo = String(timestamp).trim();
  for (var i = 1; i < dados.length; i++) {
    if (_tsNormalizar_(dados[i][idxTs]) === tsLimpo) {
      return { aba: aba, rowIndex: i + 1, cabecalhos: cabecalhos };
    }
  }
  return null;
}

/**
 * Atualiza campos específicos numa linha da aba.
 */
function _atualizarCamposLinha_(aba, rowIndex, cabecalhos, campos) {
  for (var col in campos) {
    var idx = cabecalhos.indexOf(col);
    if (idx >= 0) {
      aba.getRange(rowIndex, idx + 1).setValue(_celulaTexto_(col, campos[col])); // 18.2
    }
  }
}

/**
 * Abre planilha do paciente dado o profissionalId e a sigla (via Controle).
 * Retorna o planilhaId ou null.
 */
function _obterPlanilhaIdPaciente_(sigla) {
  // 18.11: o id da planilha do paciente nao muda (desativar so troca a pasta); fica no cache do
  // script e a chamada nao abre a Controle so para achar o link. A exclusao solta a chave.
  var chave = 'planilha:' + _siglaChave_(sigla);
  var guardado = _cacheLer_(chave);
  if (guardado) return guardado;
  var pac = buscarPaciente(sigla);
  if (!pac || !pac.link_planilha_individual) return null;
  var id = extrairIdDaUrl(String(pac.link_planilha_individual));
  if (id) _cacheGuardar_(chave, id, LOCAL_CACHE_SEG);
  return id;
}

// --- Paciente: marcar / limpar / salvar ---

function pacienteMarcarEditandoAuto(sigla, timestamp) {
  var pac = buscarPaciente(sigla);
  if (!pac) return { ok: false, erro: 'Paciente nao encontrado' };
  var planilhaId = extrairIdDaUrl(String(pac.link_planilha_individual || ''));
  if (!planilhaId) return { ok: false, erro: 'Planilha nao encontrada' };
  var linha = _encontrarLinhaAuto_(planilhaId, timestamp);
  if (!linha) return { ok: false, erro: 'Registro nao encontrado' };
  var agora = Utilities.formatDate(new Date(), 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss");
  _atualizarCamposLinha_(linha.aba, linha.rowIndex, linha.cabecalhos, {
    editando_quem:   'paciente:' + sigla,
    editando_desde:  agora
  });
  // Retorna o editando_quem atual para o frontend exibir o banner
  return { ok: true, editando_quem: 'paciente:' + sigla };
}

function pacienteLimparEditandoAuto(sigla, timestamp) {
  var pac = buscarPaciente(sigla);
  if (!pac) return { ok: false, erro: 'Paciente nao encontrado' };
  var planilhaId = extrairIdDaUrl(String(pac.link_planilha_individual || ''));
  if (!planilhaId) return { ok: false, erro: 'Planilha nao encontrada' };
  var linha = _encontrarLinhaAuto_(planilhaId, timestamp);
  if (!linha) return { ok: false, erro: 'Registro nao encontrado' };
  _atualizarCamposLinha_(linha.aba, linha.rowIndex, linha.cabecalhos, {
    editando_quem:  '',
    editando_desde: ''
  });
  return { ok: true };
}

// 18.5: a edicao manda so os campos alterados em 'campos' (cliente antigo ainda manda 'dados'
// com a linha toda: o servidor compara com a planilha e grava so o que mudou de fato).
function pacienteEditarAutomonitoramento(sigla, timestamp, dados, campos, idEnvio) {
  var mudancas = (campos && typeof campos === 'object') ? campos : dados;
  if (!sigla || !timestamp || !mudancas) return { ok: false, erro: 'Parametros incompletos' };
  var pac = buscarPaciente(sigla);
  if (!pac) return { ok: false, erro: 'Paciente nao encontrado' };
  var planilhaId = extrairIdDaUrl(String(pac.link_planilha_individual || ''));
  if (!planilhaId) return { ok: false, erro: 'Planilha nao encontrada' };
  // 18.10 (8.46): autoria sempre do servidor (cracha de paciente)
  return _editarRegistroAuto_(planilhaId, timestamp, mudancas, 'paciente', idEnvio, pac.__profissional_id, sigla);
}

// --- Profissional: marcar / limpar / salvar ---

function profMarcarEditandoAuto(s, siglaPaciente, timestamp) {
  var auth = _authProfissional_(s);
  if (!auth.ok) return auth;
  var profId = auth.profissional.profissional_id;
  var dono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!dono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (dono !== profId) return { ok: false, erro: 'Este paciente nao pertence a voce' };
  var planilhaId = _obterPlanilhaIdPaciente_(siglaPaciente);
  if (!planilhaId) return { ok: false, erro: 'Planilha nao encontrada' };
  var linha = _encontrarLinhaAuto_(planilhaId, timestamp);
  if (!linha) return { ok: false, erro: 'Registro nao encontrado' };
  var agora = Utilities.formatDate(new Date(), 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss");
  var quem = 'profissional:' + s.sigla;
  _atualizarCamposLinha_(linha.aba, linha.rowIndex, linha.cabecalhos, {
    editando_quem:  quem,
    editando_desde: agora
  });
  return { ok: true, editando_quem: quem };
}

function profLimparEditandoAuto(s, siglaPaciente, timestamp) {
  var auth = _authProfissional_(s);
  if (!auth.ok) return auth;
  var profId = auth.profissional.profissional_id;
  var dono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!dono || dono !== profId) return { ok: false, erro: 'Acesso negado' };
  var planilhaId = _obterPlanilhaIdPaciente_(siglaPaciente);
  if (!planilhaId) return { ok: false, erro: 'Planilha nao encontrada' };
  var linha = _encontrarLinhaAuto_(planilhaId, timestamp);
  if (!linha) return { ok: false, erro: 'Registro nao encontrado' };
  _atualizarCamposLinha_(linha.aba, linha.rowIndex, linha.cabecalhos, {
    editando_quem:  '',
    editando_desde: ''
  });
  return { ok: true };
}

function profEditarAutomonitoramento(s, siglaPaciente, timestamp, dados, campos, idEnvio) {
  var mudancas = (campos && typeof campos === 'object') ? campos : dados;
  if (!siglaPaciente || !timestamp || !mudancas) return { ok: false, erro: 'Parametros incompletos' };
  var auth = _authProfissional_(s);
  if (!auth.ok) return auth;
  var profId = auth.profissional.profissional_id;
  var dono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!dono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (dono !== profId) return { ok: false, erro: 'Este paciente nao pertence a voce' };
  var planilhaId = _obterPlanilhaIdPaciente_(siglaPaciente);
  if (!planilhaId) return { ok: false, erro: 'Planilha nao encontrada' };
  // 18.10 (8.46): autoria sempre do servidor (cracha de profissional)
  return _editarRegistroAuto_(planilhaId, timestamp, mudancas, 'profissional', idEnvio, profId, siglaPaciente);
}


// ============================================================
// PACOTE 18.5 — EDICAO CONJUNTA POR CAMPO, CARIMBO E CRIACAO PELO PROFISSIONAL
// ============================================================
// Toda edicao (paciente ou profissional; registro, escala, anamnese) grava SO as colunas
// que mudaram — nunca a linha inteira. Dois editores ao mesmo tempo nao se bloqueiam: em
// campos diferentes os dois valores ficam; no mesmo campo vale a ultima gravacao. A coluna
// autoria_campos guarda, por campo alterado, quem alterou e quando:
//   { "<coluna>": { "por": "paciente|profissional", "em": "aaaa-MM-dd HH:mm:ss" } }
// "por" sai do cracha, nunca do cliente. editado_por/editado_em continuam dizendo quem foi
// o ultimo a mexer na linha. A trava de presenca (editando_quem) virou so um aviso na tela.

var AUTORIA_MAX = 40000;       // caracteres do JSON de autoria_campos
var AUTORIA_MANTER = 200;      // acima do limite ficam so os campos alterados mais recentemente
var EDICAO_GUARDA_SEG = 21600; // 6 h: o reenvio da mesma edicao (mesmo id_envio) nao grava de novo

function _idEnvioValido_(id) {
  var t = String(id === undefined || id === null ? '' : id).trim();
  return /^[A-Za-z0-9-]{8,64}$/.test(t) ? t : '';
}

function _edicaoJaFeita_(idEnvio) {
  return !!idEnvio && CacheService.getScriptCache().get('edicao:' + idEnvio) === '1';
}

function _edicaoFeita_(idEnvio) {
  if (idEnvio) CacheService.getScriptCache().put('edicao:' + idEnvio, '1', EDICAO_GUARDA_SEG);
}

/** O valor que chegou e o que ja esta na celula? (a celula pode ter sido retipada pelo Sheets) */
function _mesmoValor_(col, atual, novo) {
  var n = String(novo === undefined || novo === null ? '' : novo).trim();
  if (atual instanceof Date) {
    var iso = atual.toISOString();
    return n === String(_valorDeLeitura_(col, atual)) || n === iso || n === iso.slice(0, 10) ||
      n === Utilities.formatDate(atual, 'America/Sao_Paulo', 'yyyy-MM-dd') ||
      n === Utilities.formatDate(atual, 'America/Sao_Paulo', 'HH:mm');
  }
  return String(atual === undefined || atual === null ? '' : atual).trim() === n;
}

/**
 * Carimba as colunas no JSON de autoria (so as chaves alteradas mudam). Devolve { json, mapa }.
 * 18.6.1: o carimbo leva tambem o NOME de quem alterou (`nome`), como estava no cadastro na hora
 * da alteracao — a tela mostra "Alterado por <nome> em <data> as <hora>".
 */
function _carimbar_(textoAtual, colunas, por, em, nome) {
  var mapa = _jsonOuVazio_(textoAtual);
  for (var i = 0; i < colunas.length; i++) {
    mapa[colunas[i]] = { por: por, em: em };
    if (nome) mapa[colunas[i]].nome = nome;
  }
  var json = JSON.stringify(mapa);
  if (json.length > AUTORIA_MAX) {
    var recentes = Object.keys(mapa).sort(function (a, b) {
      return String((mapa[b] || {}).em).localeCompare(String((mapa[a] || {}).em));
    }).slice(0, AUTORIA_MANTER);
    var menor = {};
    recentes.forEach(function (k) { menor[k] = mapa[k]; });
    console.error('autoria_campos: ' + json.length + ' caracteres; mantidos os ' + recentes.length + ' campos mais recentes');
    mapa = menor;
    json = JSON.stringify(mapa);
  }
  return { json: json, mapa: mapa };
}

/**
 * Grava na linha so os campos de 'campos' que existem no cabecalho, nao sao do servidor e
 * tem valor diferente do que esta na celula; carimba cada um em autoria_campos e atualiza
 * editado_por/editado_em. opcoes: { fora: [colunas ignoradas], so: funcao(coluna) que diz se
 * a coluna pode ser editada, nome: nome de quem altera (vai no carimbo), derivados: funcao(cabecalho, linhaAtual, mudancas) que devolve
 * colunas calculadas pelo servidor (gravadas sem carimbo) ou { __erro } para nao gravar }.
 * Saida: { alterados, autoria_campos, editado_em, anteriores, em } ou { erro } — `anteriores`
 * e o valor de cada celula alterada, lido antes de gravar; `em` e a hora do carimbo.
 */
function _editarCampos_(aba, linha, campos, por, opcoes) {
  var o = opcoes || {};
  var header = _garantirColunas_(aba, ['editado_por', 'editado_em', 'autoria_campos']);
  var atual = aba.getRange(linha, 1, 1, header.length).getValues()[0];
  var limpos = _dadosDoCliente_(campos);
  delete limpos.id_envio;
  var mudar = {}, alterados = [], anteriores = {};
  for (var k in limpos) {
    var idx = header.indexOf(k);
    if (idx === -1 || (o.fora && o.fora.indexOf(k) !== -1) || (o.so && !o.so(k))) continue;
    if (_mesmoValor_(k, atual[idx], limpos[k])) continue;
    mudar[k] = limpos[k];
    anteriores[k] = atual[idx];
    alterados.push(k);
  }
  var textoAutoria = atual[header.indexOf('autoria_campos')];
  if (!alterados.length) return { alterados: [], autoria_campos: _jsonOuVazio_(textoAutoria), editado_em: '' };
  if (o.derivados) {
    var derivados = o.derivados(header, atual, mudar);
    if (derivados && derivados.__erro) return { erro: derivados.__erro, alterados: [] };
    for (var kd in derivados) mudar[kd] = derivados[kd];
  }
  var agora = new Date();
  var em = Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss');
  var carimbo = _carimbar_(textoAutoria, alterados, por, em, o.nome || '');
  var editadoEm = Utilities.formatDate(agora, 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss");
  mudar.editado_por = por;
  mudar.editado_em = editadoEm;
  mudar.autoria_campos = carimbo.json;
  if (header.indexOf('editado') !== -1) mudar.editado = 'Sim';
  _atualizarCamposLinha_(aba, linha, header, mudar);
  return { alterados: alterados, autoria_campos: carimbo.mapa, editado_em: editadoEm, anteriores: anteriores, em: em };
}

/**
 * 18.6.1 — nome que vai no carimbo: do profissional, o `nome_completo` do cadastro; do paciente,
 * o nome da anamnese (`ind_nome` da Controle) ou, sem ficha, o nome do cadastro. Sai do servidor,
 * pela conta do cracha — nunca do cliente. Falha de leitura nao impede a gravacao (carimbo sem nome).
 */
function _nomeDeQuemAltera_(por, sigla, profissionalId) {
  try {
    if (por === 'profissional') {
      var prof = buscarProfissional(profissionalId);
      return String((prof && prof.nome_completo) || '').trim();
    }
    var pac = buscarPaciente(sigla);
    return String((pac && (pac.ind_nome || pac.nome)) || '').trim();
  } catch (e) {
    console.error('carimbo sem nome: ' + String(e && e.message || e).slice(0, 120));
    return '';
  }
}

// ---------- 18.8.1: o nome do carimbo e o do cadastro NA HORA DE MOSTRAR ----------
// Regra do usuario (04/10): carimbo e assinatura seguem sempre o nome do cadastro; mudou o nome,
// mudam. O nome gravado em autoria_campos e em criado_por_nome continua sendo escrito, mas so
// vale como reserva: toda leitura que devolve carimbo troca-o pelo nome atual — "profissional"
// e o dono do paciente (cada paciente tem um so), "paciente" e o proprio. Nada e regravado.

/** Nomes atuais de quem pode ter carimbado os registros deste paciente: { profissional, paciente }. */
function _nomesDoCarimbo_(sigla, profissionalId) {
  return { profissional: _nomeDeQuemAltera_('profissional', sigla, profissionalId),
    paciente: _nomeDeQuemAltera_('paciente', sigla, profissionalId) };
}

/** autoria_campos (texto JSON da celula ou mapa) com o nome atual; devolve no mesmo formato em que veio. */
function _autoriaComNomeAtual_(autoria, nomes) {
  var texto = typeof autoria === 'string';
  if (texto && !autoria) return autoria;
  var mapa = texto ? _jsonOuVazio_(autoria) : autoria;
  if (!mapa || typeof mapa !== 'object') return autoria;
  var mudou = false;
  for (var col in mapa) {
    var c = mapa[col];
    if (!c || typeof c !== 'object') continue;
    var atual = nomes[c.por];
    if (atual && c.nome !== atual) { c.nome = atual; mudou = true; }
  }
  return texto ? (mudou ? JSON.stringify(mapa) : autoria) : mapa;
}

/** Aplica o nome atual aos carimbos de um registro lido (autoria_campos e criado_por_nome). Devolve o registro. */
function _carimboDoCadastro_(registro, nomes) {
  if (!registro) return registro;
  if (registro.autoria_campos) registro.autoria_campos = _autoriaComNomeAtual_(registro.autoria_campos, nomes);
  if (registro.criado_por === 'profissional' && nomes.profissional) registro.criado_por_nome = nomes.profissional;
  return registro;
}

function _carimbosDoCadastro_(registros, nomes) {
  for (var i = 0; registros && i < registros.length; i++) _carimboDoCadastro_(registros[i], nomes);
  return registros;
}

/** Edicao de um registro de automonitoramento (paciente ou profissional), por campo. */
function _editarRegistroAuto_(planilhaId, timestamp, campos, por, idEnvio, profissionalId, sigla) {
  var id = _idEnvioValido_(idEnvio);
  if (_edicaoJaFeita_(id)) return { ok: true, duplicado: true, mensagem: 'Registro atualizado com sucesso' };
  var linha = _encontrarLinhaAuto_(planilhaId, timestamp);
  if (!linha) return { ok: false, erro: 'Registro nao encontrado' };
  var r = _editarCampos_(linha.aba, linha.rowIndex, campos, por, { nome: _nomeDeQuemAltera_(por, sigla, profissionalId) });
  // quem salvou deixou de editar: o aviso de presenca sai junto
  _atualizarCamposLinha_(linha.aba, linha.rowIndex, linha.cabecalhos, { editando_quem: '', editando_desde: '' });
  if (r.alterados.length) _indicadoresAposGravar_(profissionalId, sigla, _abrirPlanilha_(planilhaId));
  _edicaoFeita_(id);
  return { ok: true, mensagem: 'Registro atualizado com sucesso', editado_em: r.editado_em,
    campos_alterados: r.alterados, autoria_campos: _autoriaComNomeAtual_(r.autoria_campos, _nomesDoCarimbo_(sigla, profissionalId)) };
}

/** Edicao da anamnese (linha 2) por campo. E-mail e telefone espelham o cadastro e ficam de fora. */
function _editarAnamnesePorCampos_(planilha, aba, campos, por, idEnvio, profissionalId, sigla, mensagem) {
  var id = _idEnvioValido_(idEnvio);
  if (_edicaoJaFeita_(id)) return { ok: true, duplicado: true, mensagem: mensagem };
  if (aba.getLastRow() < 2) return { ok: false, erro: 'Dados da anamnese ausentes' };
  var r = _editarCampos_(aba, 2, campos, por, { fora: ['email', 'telefone'], nome: _nomeDeQuemAltera_(por, sigla, profissionalId) });
  if (r.alterados.length) {
    _historicoDaAnamnese_(planilha, r.alterados, r.anteriores, por, r.em);
    registrarDataAnamnese(sigla, profissionalId);
    _indicadoresAposGravar_(profissionalId, sigla, planilha);
  }
  _edicaoFeita_(id);
  return { ok: true, mensagem: mensagem, editado_em: r.editado_em, campos_alterados: r.alterados,
    autoria_campos: _autoriaComNomeAtual_(r.autoria_campos, _nomesDoCarimbo_(sigla, profissionalId)) };
}

// 18.6 — historico da anamnese: aba `Anamnese_Historico` na planilha do paciente, criada no
// primeiro uso. Uma linha por campo efetivamente alterado, com o valor que estava na celula
// antes da gravacao, quem alterou (do cracha) e quando. So o servidor escreve aqui, dentro da
// trava da acao; nenhuma acao le esta aba (sem tela). Entra no backup por ser aba da planilha.
var ABA_ANAMNESE_HISTORICO = 'Anamnese_Historico';
var HEADERS_ANAMNESE_HISTORICO = ['campo', 'valor_anterior', 'por', 'em'];

function _historicoDaAnamnese_(planilha, alterados, anteriores, por, em) {
  var aba = planilha.getSheetByName(ABA_ANAMNESE_HISTORICO);
  if (!aba) aba = planilha.insertSheet(ABA_ANAMNESE_HISTORICO);
  var header = _garantirColunas_(aba, HEADERS_ANAMNESE_HISTORICO);
  var linhas = alterados.map(function (campo) {
    var antes = anteriores[campo];
    if (antes instanceof Date) { // celula retipada pelo Sheets: guarda o que a leitura mostra (data em aaaa-mm-dd)
      var lido = _valorDeLeitura_(campo, antes);
      antes = lido instanceof Date ? antes.toISOString().slice(0, 10) : lido;
    }
    var v = { campo: campo, valor_anterior: String(antes === undefined || antes === null ? '' : antes), por: por, em: em };
    return header.map(function (col) {
      if (col === 'em') return "'" + em; // texto literal, igual ao `em` de autoria_campos (o Sheets retiparia para data — licao 105)
      return v[col] !== undefined ? _celulaTexto_(col, v[col]) : '';
    });
  });
  aba.getRange(aba.getLastRow() + 1, 1, linhas.length, header.length).setValues(linhas);
}

/** Profissional do cracha + paciente dele: { ok, profissionalId, planilha } ou a recusa. */
function _pacienteDoProfissional_(s, siglaPaciente) {
  var auth = _authProfissional_(s);
  if (!auth.ok) return auth;
  var profId = auth.profissional.profissional_id;
  if (!siglaPaciente) return { ok: false, erro: 'Sigla do paciente e obrigatoria' };
  var dono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!dono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (dono !== profId) return { ok: false, erro: 'Este paciente nao pertence a voce' };
  var planilha = _planilhaDoPaciente_(siglaPaciente);
  if (!planilha) return { ok: false, erro: 'Planilha do paciente nao encontrada' };
  return { ok: true, profissionalId: profId, planilha: planilha };
}

/**
 * 17.1.2: o profissional libera (liberar = true) ou retira (false) um instrumento 'so do profissional'
 * para um paciente seu. A lista fica em 'escalas_liberadas' na linha do paciente na Controle.
 * Saida: { ok: true, escalas_liberadas: [...] }.
 */
function profLiberarEscala(s, siglaPaciente, instrumento, liberar) {
  var alvo = _pacienteDoProfissional_(s, siglaPaciente);
  if (!alvo.ok) return alvo;
  var instr = String(instrumento || '').trim().toLowerCase();
  if (INSTRUMENTOS_SO_PROFISSIONAL.indexOf(instr) === -1) return { ok: false, erro: 'Instrumento desconhecido' };
  var lista = _escalasLiberadasDoPaciente_(siglaPaciente).filter(function (x) { return x !== instr; });
  if (liberar === true || liberar === 'true' || liberar === 'SIM') lista.push(instr);
  var controle = abrirControleDoProfissional(alvo.profissionalId);
  if (!controle || !_atualizarLinhaPorChave_(controle.getSheetByName(ABA_PACIENTES), 'sigla', siglaPaciente, { escalas_liberadas: lista.join(',') })) {
    return { ok: false, erro: 'Paciente nao encontrado na Controle' };
  }
  return { ok: true, escalas_liberadas: lista };
}

/** O que o servidor grava na linha criada pelo profissional. */
function _autoriaDeCriacao_(profissionalId) {
  return { criado_por: 'profissional', editado_por: 'profissional',
    criado_por_nome: _nomeDeQuemAltera_('profissional', '', profissionalId), // 18.6.2
    editado_em: Utilities.formatDate(new Date(), 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss") };
}

/**
 * O profissional cria um registro de automonitoramento em nome do paciente: o mesmo
 * payload do paciente (id_envio obrigatorio), gravado com criado_por = profissional.
 * O rascunho do paciente nao e tocado.
 */
function profCriarAutomonitoramento(s, siglaPaciente, dados) {
  var alvo = _pacienteDoProfissional_(s, siglaPaciente);
  if (!alvo.ok) return alvo;
  dados = _dadosDoCliente_(dados);
  if (!dados.id_envio) return { ok: false, erro: 'Parametros incompletos' };
  var aba = alvo.planilha.getSheetByName(ABA_AUTOMONITORAMENTO);
  if (!aba) return { ok: false, erro: 'Registro nao encontrado' };
  var repetido = _linhaDoEnvio_(aba, dados.id_envio);
  if (repetido) return _respostaDuplicado_(alvo.planilha, ABA_AUTOMONITORAMENTO, repetido, 'Registro salvo com sucesso');
  _garantirColunasAutomonitoramento_(aba);
  _garantirColunas_(aba, ['criado_por', 'autoria_campos', 'criado_por_nome']);
  aba.appendRow(montarLinha(aba, dados, _autoriaDeCriacao_(alvo.profissionalId)));
  _indicadoresAposGravar_(alvo.profissionalId, siglaPaciente, alvo.planilha);
  if (_registroCompleto_(dados)) _lembretesCumprir_(alvo.profissionalId, siglaPaciente, 'auto'); // 19.2.1
  return { ok: true, mensagem: 'Registro salvo com sucesso' };
}

// Regras de calculo de cada escala, geradas do catalogo do frontend (ESC_ESCALAS) e conferidas
// contra ele em Node (mesmo escore, faixa e alerta para qualquer resposta): n = itens;
// max = maior valor da resposta; rev = itens invertidos; crit = [item, limiar, chave do alerta];
// sub = itens de cada subescala; faixas = [min, max, rotulo]; func = opcoes do item funcional.
// 17.1: naoPontua = itens fora do total (BSS 20 e 21); cond = lista de blocos condicionais (BSS: os itens
// de 'itens' valem 0 quando nenhum item de 'se' chega a 1). Referencias no catalogo do frontend (ESC_ESCALAS).
// 17.2 (URICA): min = menor valor da resposta (default 0); multi = grava escore_<sub> para cada chave de 'sub',
// na ordem declarada, vezes multSub (DASS-21: 2, de 21 para 42 itens; default 1); siglaSub = rotulo curto de
// cada subescala no resumo gravado em 'faixa'; faixasSub = faixas por subescala (opcional - a URICA nao tem);
// composto = { chave, sigla, mais, menos, casas }: escore derivado das MEDIAS das subescalas
// (prontidao = C + A + M - PC, DiClemente & Hughes, 1990), gravado em escore_<chave>.
var ESCALAS_CALCULO = {
  'PHQ-9':{n:9,max:3,crit:[[9,1,'PHQ9_item9']],faixas:[[20,27,'Depressão grave'],[15,19,'Depressão moderadamente grave'],[10,14,'Depressão moderada'],[5,9,'Depressão leve'],[0,4,'Sintomas mínimos ou ausentes']],func:4},
  'GAD-7':{n:7,max:3,faixas:[[15,21,'Ansiedade grave'],[10,14,'Ansiedade moderada'],[5,9,'Ansiedade leve'],[0,4,'Ansiedade mínima']],func:4},
  'PSS-10':{n:10,max:4,rev:[4,5,7,8],faixas:[[27,40,'Estresse alto'],[14,26,'Estresse moderado'],[0,13,'Estresse baixo']]},
  'DASS-21':{n:21,max:3,crit:[[21,2,'DASS21_item21']],sub:{depressao:[3,5,10,13,16,17,21],ansiedade:[2,4,7,9,15,19,20],estresse:[1,6,8,11,12,14,18]},multi:true,multSub:2,siglaSub:{depressao:'Dep',ansiedade:'Ans',estresse:'Est'},faixasSub:{depressao:[[28,99,'Extremamente severo'],[21,27,'Severo'],[14,20,'Moderado'],[10,13,'Leve'],[0,9,'Normal']],ansiedade:[[20,99,'Extremamente severo'],[15,19,'Severo'],[10,14,'Moderado'],[8,9,'Leve'],[0,7,'Normal']],estresse:[[34,99,'Extremamente severo'],[26,33,'Severo'],[19,25,'Moderado'],[15,18,'Leve'],[0,14,'Normal']]}},
  'SRQ-20':{n:20,max:1,crit:[[17,1,'SRQ20_item17']],faixas:[[7,20,'Suspeita de transtorno mental comum'],[0,6,'Baixa probabilidade de TMC']]},
  'BDI-II':{n:21,max:3,crit:[[9,1,'BDI2_item9']],faixas:[[29,63,'Grave'],[20,28,'Moderado'],[14,19,'Leve'],[0,13,'Mínimo']],letra:[16,18]},
  'BAI':{n:21,max:3,faixas:[[31,63,'Grave'],[20,30,'Moderado'],[11,19,'Leve'],[0,10,'Mínimo']]},
  'BHS':{n:20,max:1,rev:[1,3,5,6,8,10,13,15,19],faixas:[[14,20,'Grave'],[9,13,'Moderado'],[5,8,'Leve'],[0,4,'Mínimo']]},
  'BSS':{n:21,max:2,crit:[[4,1,'BSS_item4'],[5,1,'BSS_item5']],naoPontua:[20,21],cond:[{itens:[6,7,8,9,10,11,12,13,14,15,16,17,18,19],se:[4,5]},{itens:[21],se:[20]}]},
  'URICA-A':{n:24,min:1,max:5,sub:{precontemplacao:[1,5,7,16,19,22],contemplacao:[3,6,9,13,14,17],acao:[2,4,8,11,18,23],manutencao:[10,12,15,20,21,24]},multi:true,siglaSub:{precontemplacao:'PC',contemplacao:'C',acao:'A',manutencao:'M'},composto:{chave:'prontidao',sigla:'Prontidão',mais:['contemplacao','acao','manutencao'],menos:['precontemplacao'],casas:1}},
  'URICA-D':{n:24,min:1,max:5,sub:{precontemplacao:[1,5,7,16,19,22],contemplacao:[3,6,9,13,14,17],acao:[2,4,8,11,18,23],manutencao:[10,12,15,20,21,24]},multi:true,siglaSub:{precontemplacao:'PC',contemplacao:'C',acao:'A',manutencao:'M'},composto:{chave:'prontidao',sigla:'Prontidão',mais:['contemplacao','acao','manutencao'],menos:['precontemplacao'],casas:1}},
  'URICA-T':{n:24,min:1,max:5,sub:{precontemplacao:[1,5,7,16,19,22],contemplacao:[3,6,9,13,14,17],acao:[2,4,8,11,18,23],manutencao:[10,12,15,20,21,24]},multi:true,siglaSub:{precontemplacao:'PC',contemplacao:'C',acao:'A',manutencao:'M'},composto:{chave:'prontidao',sigla:'Prontidão',mais:['contemplacao','acao','manutencao'],menos:['precontemplacao'],casas:1}},
  'URICA-HA':{n:24,min:1,max:5,sub:{precontemplacao:[1,5,7,16,19,22],contemplacao:[3,6,9,13,14,17],acao:[2,4,8,11,18,23],manutencao:[10,12,15,20,21,24]},multi:true,siglaSub:{precontemplacao:'PC',contemplacao:'C',acao:'A',manutencao:'M'},composto:{chave:'prontidao',sigla:'Prontidão',mais:['contemplacao','acao','manutencao'],menos:['precontemplacao'],casas:1}},
  // 17.3 - lote A da HumanTrack (escore unico). Faixas so onde ha fonte: PCL-5 >= 36 (Pereira-Lima et al., 2019);
  // PSWQ 45 e 62 (Behar et al., 2003); SWLS (Diener, 2006; Pavot & Diener, 2008). EAR, AAQ-II, MAAS e WBSI sem corte validado.
  'PCL-5':{n:20,max:4,faixas:[[36,80,'Sugestivo de TEPT'],[0,35,'Abaixo do ponto de corte']]},
  'PSWQ':{n:16,min:1,max:5,rev:[1,3,8,10,11],faixas:[[62,80,'Preocupação muito elevada'],[45,61,'Preocupação elevada'],[16,44,'Abaixo do corte clínico']]},
  'EAR':{n:10,min:1,max:4,rev:[3,5,8,9,10]},
  'AAQ-II':{n:7,min:1,max:7},
  'SWLS':{n:5,min:1,max:7,faixas:[[30,35,'Satisfação muito alta'],[25,29,'Satisfação alta'],[20,24,'Satisfação média'],[15,19,'Um pouco abaixo da média'],[10,14,'Insatisfeito'],[5,9,'Extremamente insatisfeito']]},
  'MAAS':{n:15,min:1,max:6},
  'WBSI':{n:15,min:1,max:5},
  // 17.5 - lote B da HumanTrack. PANAS: 19 itens da versao brasileira (Carvalho et al., 2013), somas por subescala
  // (AP 9-45, AN 10-50); SPIN: corte 19 (Connor et al., 2000); OCI-R: 6 subescalas x 3 itens e corte 21 no total
  // (Foa et al., 2002); ASRS-18: somas por dominio, sem corte brasileiro; SCS: itens negativos invertidos, media
  // por subescala (subMedia: casas) e total = media das seis medias (composto com dividir: 6) (Neff, 2003).
  'PANAS':{n:19,min:1,max:5,sub:{afeto_positivo:[1,2,3,4,5,6,7,8,9],afeto_negativo:[10,11,12,13,14,15,16,17,18,19]},multi:true,siglaSub:{afeto_positivo:'AP',afeto_negativo:'AN'}},
  'SPIN':{n:17,max:4,faixas:[[19,68,'Sugestivo de ansiedade social'],[0,18,'Abaixo do ponto de corte']]},
  'OCI-R':{n:18,max:4,sub:{verificacao:[2,8,14],lavagem:[5,11,17],ordenacao:[3,9,15],acumulacao:[1,7,13],obsessoes:[6,12,18],neutralizacao:[4,10,16]},multi:true,siglaSub:{verificacao:'Ver',lavagem:'Lav',ordenacao:'Ord',acumulacao:'Acu',obsessoes:'Obs',neutralizacao:'Neu'},faixas:[[21,72,'Sugestivo de TOC'],[0,20,'Abaixo do ponto de corte']]},
  'ASRS-18':{n:18,max:4,sub:{desatencao:[1,2,3,4,5,6,7,8,9],hiperatividade:[10,11,12,13,14,15,16,17,18]},multi:true,siglaSub:{desatencao:'Des',hiperatividade:'Hip'}},
  'SCS':{n:26,min:1,max:5,rev:[1,2,4,6,8,11,13,16,18,20,21,24,25],sub:{bondade:[5,12,19,23,26],autocritica:[1,8,11,16,21],humanidade:[3,7,10,15],isolamento:[4,13,18,25],mindfulness:[9,14,17,22],sobreidentificacao:[2,6,20,24]},multi:true,subMedia:2,siglaSub:{bondade:'Bon',autocritica:'Auc',humanidade:'Hum',isolamento:'Iso',mindfulness:'Min',sobreidentificacao:'Sob'},composto:{chave:'autocompaixao',sigla:'Total',mais:['bondade','autocritica','humanidade','isolamento','mindfulness','sobreidentificacao'],menos:[],dividir:6,casas:2}},
  // 17.6 - lote E (dependencias). AUDIT: soma 0-40, zonas da OMS (Babor et al., 2001; corte brasileiro 7/8, Lima et al., 2005);
  // itens 9 e 10 valem 0, 2 ou 4 (opcoes por item). FTND: soma 0-10, niveis da chave de correcao de Fagerstrom (Wilcox et al.,
  // 2014; versao brasileira Meneses-Gaya et al., 2009); dois fatores: tabagismo matinal (3, 5) e padrao (1, 2, 4, 6). G-SAS: soma
  // 0-48, faixas de Kim et al. (2009). EAAD e ESTUD: media por subescala (subMedia) e media geral dos 24 itens (composto.mediaItens);
  // sem corte (Freire, 2009). Lote E e por liberacao do profissional, como todas.
  'AUDIT':{n:10,max:4,faixas:[[20,40,'Provável dependência'],[16,19,'Uso nocivo'],[8,15,'Uso de risco'],[0,7,'Uso de baixo risco']]},
  'FTND':{n:6,max:3,sub:{matinal:[3,5],padrao:[1,2,4,6]},multi:true,siglaSub:{matinal:'Mat',padrao:'Pad'},faixas:[[8,10,'Dependência muito elevada'],[6,7,'Dependência elevada'],[5,5,'Dependência média'],[3,4,'Dependência baixa'],[0,2,'Dependência muito baixa']]},
  'G-SAS':{n:12,max:4,faixas:[[41,48,'Extremo'],[31,40,'Severo'],[21,30,'Moderado'],[8,20,'Leve'],[0,7,'Abaixo da faixa leve']]},
  'EAAD':{n:24,min:1,max:5,sub:{emocoes_negativas:[3,6,14,16,18,23,24],social_positivo:[4,8,15,17,20,21,22],preocupacoes:[2,5,9,12,13],abstinencia_impulsos:[1,7,10,11,19]},multi:true,subMedia:2,siglaSub:{emocoes_negativas:'Emo',social_positivo:'Soc',preocupacoes:'Pre',abstinencia_impulsos:'Abs'},composto:{chave:'media_geral',sigla:'Média',mais:[],menos:[],mediaItens:true,casas:2}},
  'ESTUD':{n:24,min:1,max:5,sub:{emocoes_negativas:[3,6,14,16,18,23,24],social_positivo:[4,8,15,17,20,21,22],preocupacoes:[2,5,9,12,13],abstinencia_impulsos:[1,7,10,11,19]},multi:true,subMedia:2,siglaSub:{emocoes_negativas:'Emo',social_positivo:'Soc',preocupacoes:'Pre',abstinencia_impulsos:'Abs'},composto:{chave:'media_geral',sigla:'Média',mais:[],menos:[],mediaItens:true,casas:2}},
  // 17.7 - lote F. DUDIT: soma 0-44, opcoes por item (10 e 11 valem 0/2/4); cortes do manual (Berman et al., 2005) como
  // publicados: 6 = triagem positiva, 25 = provavel dependencia (Pape et al., 2022). SAST: soma 0-25, corte brasileiro 6
  // (Silveira et al., 2000: sens. 0,83, esp. 0,75). EPM: 20 itens 1-5, dois fatores por soma (cognitivos, comportamentais) e
  // total dos 20 (composto.somaItens); sem corte. PIUQ-SF-9: soma 9-45, sem corte (Spritzer et al., 2021). SAS-LV: soma 33-198,
  // sem corte (Kwon et al., 2013; Andrade et al., 2020). Lote F e por liberacao do profissional, como todas.
  'DUDIT':{n:11,max:4,faixas:[[25,44,'Provável dependência'],[6,24,'Provável problema com drogas'],[0,5,'Abaixo do ponto de corte']]},
  'SAST':{n:25,max:1,faixas:[[6,25,'Triagem positiva'],[0,5,'Abaixo do ponto de corte']]},
  'EPM':{n:20,min:1,max:5,sub:{cognitivos:[3,4,5,7,8,9,12,14,15,20],comportamentais:[1,2,6,10,11,13,16,17,18,19]},multi:true,siglaSub:{cognitivos:'Cog',comportamentais:'Com'},composto:{chave:'total_processos',sigla:'Total',mais:[],menos:[],somaItens:true,casas:0}},
  'PIUQ-SF-9':{n:9,min:1,max:5},
  'SAS-LV':{n:33,min:1,max:6,sub:{perturbacao:[3,4,5],antecipacao:[6,7,8,9],abstinencia:[10,11,12,13,14,15,17,18],ciberespaco:[20,21,22,23,26],uso_excessivo:[1,2,16,19,24,25,27,28,29,30,31,32,33]},multi:true,subMedia:2,siglaSub:{perturbacao:'Per',antecipacao:'Ant',abstinencia:'Abs',ciberespaco:'Cib',uso_excessivo:'Uso'},composto:{chave:'total_sas',sigla:'Total',mais:[],menos:[],somaItens:true,casas:0}}, // 17.7 (fechamento): cinco fatores da versao brasileira (Andrade et al., 2020, Tabela 3; item 18 em abstinencia) + total pela soma
  // 17.8 - lote C (fontes com pagina em docs/escalas/fontes.json). CFQ-7: soma 7-49, sem corte (Gillanders et al., 2014;
  // Peixoto et al., 2019). DERS: 36 itens 1-5, 11 invertidos, seis fatores e total por SOMA como no estudo brasileiro
  // (Cancian et al., 2019, Tabela 6); sem corte. PTCI: 33 itens 1-7 (os 33 pontuados do original de 36), tres fatores por
  // MEDIA e total = soma das tres medias (Foa et al., 1999, Apendice B); sem corte. CORE-OM: 34 itens 0-4, 8 positivos
  // invertidos (formulario do CORE System Trust; Evans et al., 2002, Tabela 9), quatro dominios por media, escore clinico =
  // media geral x 10 (composto.multiplicar); itens de risco 9, 16, 24 e 34 disparam o alerta; sem corte brasileiro
  // (Santana et al., 2015). BIS-11: 30 itens 1-4, 11 invertidos (Malloy-Diniz et al., 2010), dois fatores brasileiros por
  // soma (Vasconcelos et al., 2015, Tabela 1; itens 15 e 29 so no total) e faixas por percentil da tabela corrigida de
  // normas (Malloy-Diniz et al., 2015; corrigendum 2019): P5 = 47, P25 = 55, P75 = 68, P95 = 80.
  'CFQ-7':{n:7,min:1,max:7},
  'DERS':{n:36,min:1,max:5,rev:[1,2,6,7,8,10,17,20,22,24,34],sub:{nao_aceitacao:[11,12,21,23,25,29],objetivos:[13,18,20,26,33],impulsos:[3,14,19,24,27,32],consciencia:[2,6,8,10,17,34],estrategias:[15,16,22,28,30,31,35,36],clareza:[1,4,5,7,9]},multi:true,siglaSub:{nao_aceitacao:'NAc',objetivos:'Obj',impulsos:'Imp',consciencia:'Con',estrategias:'Est',clareza:'Cla'},composto:{chave:'total_ders',sigla:'Total',mais:[],menos:[],somaItens:true,casas:0}},
  'PTCI':{n:33,min:1,max:7,sub:{self:[2,3,4,5,6,9,12,13,15,16,19,20,23,24,25,27,28,29,31,32,33],mundo:[7,8,10,11,17,22,26],autoculpa:[1,14,18,21,30]},multi:true,subMedia:2,siglaSub:{self:'Self',mundo:'Mun',autoculpa:'Cul'},composto:{chave:'total_ptci',sigla:'Total',mais:['self','mundo','autoculpa'],menos:[],casas:2}},
  'CORE-OM':{n:34,max:4,rev:[3,4,7,12,19,21,31,32],crit:[[9,1,'COREOM_item9'],[16,1,'COREOM_item16'],[24,1,'COREOM_item24'],[34,1,'COREOM_item34']],sub:{bem_estar:[4,14,17,31],problemas:[2,5,8,11,13,15,18,20,23,27,28,30],funcionamento:[1,3,7,10,12,19,21,25,26,29,32,33],risco:[6,9,16,22,24,34]},multi:true,subMedia:2,siglaSub:{bem_estar:'Bem',problemas:'Pro',funcionamento:'Fun',risco:'Ris'},composto:{chave:'clinico',sigla:'Clínico',mais:[],menos:[],mediaItens:true,multiplicar:10,casas:1}},
  'BIS-11':{n:30,min:1,max:4,rev:[1,7,8,9,10,12,13,15,20,29,30],sub:{controle_inibitorio:[2,3,5,6,8,9,11,14,16,17,18,19,20,21,22,23,24,25,26,28],nao_planejamento:[1,4,7,10,12,13,27,30]},multi:true,siglaSub:{controle_inibitorio:'CI',nao_planejamento:'NP'},faixas:[[80,120,'Acima do percentil 95'],[68,79,'Percentil 75 a 94'],[55,67,'Percentil 25 a 74'],[47,54,'Percentil 5 a 24'],[30,46,'Abaixo do percentil 5']]}
};

/**
 * Escore, faixa e alerta de uma escala a partir das respostas (as mesmas contas do cliente,
 * escCalcularEscoreEAlerta). 'lerColuna(coluna)' devolve o valor de item_NN. Todos os itens
 * precisam estar respondidos e dentro da faixa. Saida: { ok, campos } ou { ok: false, erro }.
 */
function _escoresDaEscala_(instrumento, lerColuna) {
  var codigo = String(instrumento || '').trim();
  var t = ESCALAS_CALCULO[codigo];
  if (!t) return { ok: false, erro: 'Escala não encontrada: ' + codigo };
  var total = 0, somas = {}, flag = 'NAO', alertaItem = '', alertaValor = '';
  // 17.1 (BSS): bloco condicional fechado quando nenhum item de 'se' chega a 1 - os itens do bloco valem 0.
  var fechados = [];
  (t.cond || []).forEach(function (c) {
    var aberto = false;
    for (var s = 0; s < c.se.length; s++) {
      var vs = parseInt(String(lerColuna('item_' + (c.se[s] < 10 ? '0' : '') + c.se[s]) || ''), 10);
      if (!isNaN(vs) && vs >= 1) aberto = true;
    }
    if (!aberto) fechados = fechados.concat(c.itens);
  });
  for (var id = 1; id <= t.n; id++) {
    var bruto;
    if (fechados.indexOf(id) !== -1) {
      bruto = 0;
    } else {
      var cru = lerColuna('item_' + (id < 10 ? '0' : '') + id);
      bruto = parseInt(String(cru === undefined || cru === null ? '' : cru), 10);
      if (isNaN(bruto) || bruto < (t.min || 0) || bruto > t.max) return { ok: false, erro: 'Responda todas as questões' }; // 17.2: min
    }
    var v = (t.rev && t.rev.indexOf(id) !== -1) ? ((t.min || 0) + t.max - bruto) : bruto;
    if (!t.naoPontua || t.naoPontua.indexOf(id) === -1) total += v; // 17.1: BSS 20 e 21 fora do total
    if (t.sub) {
      for (var sub in t.sub) if (t.sub[sub].indexOf(id) !== -1) somas[sub] = (somas[sub] || 0) + v;
    }
    for (var c = 0; t.crit && c < t.crit.length; c++) {
      if (t.crit[c][0] === id && bruto >= t.crit[c][1]) { flag = 'SIM'; alertaItem = t.crit[c][2]; alertaValor = String(bruto); }
    }
  }
  var achar = function (faixas, escore, padrao) {
    for (var i = 0; i < faixas.length; i++) if (escore >= faixas[i][0] && escore <= faixas[i][1]) return faixas[i][2];
    return faixas[padrao === 'ultima' ? faixas.length - 1 : 0][2];
  };
  var campos = { escore_total: total, escore_depressao: '', escore_ansiedade: '', escore_estresse: '', faixa: '',
    alerta_risco_flag: flag, alerta_risco_item: alertaItem, alerta_risco_valor: alertaValor };
  if (t.multi) {
    // 17.2: generico - uma parte do resumo por subescala, na ordem de 'sub'; faixa quando houver, senao o escore.
    var partes = [];
    if (t.faixas) partes.push('Total:' + achar(t.faixas, total, 'primeira')); // 17.5: OCI-R tem corte no total alem das subescalas
    Object.keys(t.sub).forEach(function (sub) {
      // 17.5: subMedia = casas decimais da MEDIA dos itens da subescala (SCS); senao a soma vezes multSub (DASS-21: x2)
      var escore = t.subMedia ? Math.round((somas[sub] || 0) / t.sub[sub].length * Math.pow(10, t.subMedia)) / Math.pow(10, t.subMedia)
                              : (somas[sub] || 0) * (t.multSub || 1);
      campos['escore_' + sub] = escore;
      var rotulo = (t.faixasSub && t.faixasSub[sub]) ? achar(t.faixasSub[sub], escore, 'ultima') : String(escore).replace('.', ',');
      partes.push((t.siglaSub && t.siglaSub[sub] ? t.siglaSub[sub] : sub) + ':' + rotulo);
    });
    if (t.composto) {
      // Escore composto pelas MEDIAS das subescalas (URICA: prontidao = C + A + M - PC); mesma ordem de contas no cliente.
      var comp = 0;
      t.composto.mais.forEach(function (k) { comp += (somas[k] || 0) / t.sub[k].length; });
      t.composto.menos.forEach(function (k) { comp -= (somas[k] || 0) / t.sub[k].length; });
      if (t.composto.mediaItens) comp = total / t.n; // 17.6: EAAD/ESTUD = media dos itens (escala global da folha)
      if (t.composto.somaItens) comp = total; // 17.7: EPM = soma dos 20 itens (20-100)
      if (t.composto.multiplicar) comp = comp * t.composto.multiplicar; // 17.8: CORE-OM = media geral x 10 (escore clinico)
      if (t.composto.dividir) comp = comp / t.composto.dividir; // 17.5: SCS = media das seis medias
      var fator = Math.pow(10, t.composto.casas || 0);
      comp = Math.round(comp * fator) / fator;
      campos['escore_' + t.composto.chave] = comp;
      partes.push(t.composto.sigla + ': ' + String(comp).replace('.', ','));
    }
    campos.faixa = partes.join(' | ');
  } else if (t.faixas) {
    campos.faixa = achar(t.faixas, total, 'primeira');
  }
  return { ok: true, campos: campos };
}

/**
 * O profissional aplica uma escala em nome do paciente: o payload do paciente (id_envio
 * obrigatorio); escore, faixa e alerta sao RECALCULADOS aqui, o que vier do cliente nessas
 * colunas e descartado.
 */
function profCriarEscala(s, siglaPaciente, dados) {
  var alvo = _pacienteDoProfissional_(s, siglaPaciente);
  if (!alvo.ok) return alvo;
  dados = _dadosDoCliente_(dados);
  if (!dados.id_envio) return { ok: false, erro: 'Parametros incompletos' };
  var aba = alvo.planilha.getSheetByName(ABA_ESCALAS);
  if (!aba) return { ok: false, erro: 'Aba "Escalas" nao encontrada na planilha individual.' };
  var repetido = _linhaDoEnvio_(aba, dados.id_envio);
  if (repetido) return _respostaDuplicado_(alvo.planilha, ABA_ESCALAS, repetido, 'Escala salva com sucesso');
  var calc = _escoresDaEscala_(dados.instrumento, function (col) { return dados[col]; });
  if (!calc.ok) return calc;
  for (var k in calc.campos) dados[k] = calc.campos[k];
  _garantirColunas_(aba, ['editado_por', 'editado_em', 'criado_por', 'autoria_campos', 'criado_por_nome']);
  aba.appendRow(montarLinha(aba, dados, _autoriaDeCriacao_(alvo.profissionalId)));
  _indicadoresAposGravar_(alvo.profissionalId, siglaPaciente, alvo.planilha);
  _lembretesCumprir_(alvo.profissionalId, siglaPaciente, 'escala', dados.instrumento); // 19.2.1
  // 17.3.1: a escala que o profissional aplicou fica aberta no menu do paciente
  var liberadas = _abrirEscalaParaPaciente_(alvo.profissionalId, siglaPaciente, dados.instrumento);
  return { ok: true, mensagem: 'Escala salva com sucesso', escalas_liberadas: liberadas };
}

/** Linha (numero da planilha) da escala com este timestamp, ou 0. Le so a coluna. */
function _encontrarLinhaEscala_(aba, timestamp) {
  if (!aba || aba.getLastRow() < 2) return 0;
  var header = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var idx = header.indexOf('timestamp');
  if (idx === -1) return 0;
  var coluna = aba.getRange(2, idx + 1, aba.getLastRow() - 1, 1).getValues();
  var alvo = String(timestamp).trim();
  for (var i = 0; i < coluna.length; i++) if (_tsNormalizar_(coluna[i][0]) === alvo) return i + 2;
  return 0;
}

/**
 * O profissional edita as respostas de uma escala ja aplicada: so os itens alterados sao
 * gravados (com carimbo) e escore, faixa e alerta sao recalculados pelo servidor a partir
 * da linha resultante. Devolve o registro como ficou.
 */
function profEditarEscala(s, siglaPaciente, timestamp, campos, idEnvio) {
  if (!siglaPaciente || !timestamp || !campos || typeof campos !== 'object') return { ok: false, erro: 'Parametros incompletos' };
  var alvo = _pacienteDoProfissional_(s, siglaPaciente);
  if (!alvo.ok) return alvo;
  var id = _idEnvioValido_(idEnvio);
  if (_edicaoJaFeita_(id)) return { ok: true, duplicado: true, mensagem: 'Escala salva com sucesso' };
  var aba = alvo.planilha.getSheetByName(ABA_ESCALAS);
  var linha = _encontrarLinhaEscala_(aba, timestamp);
  if (!linha) return { ok: false, erro: 'Registro nao encontrado' };
  var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var instrumento = String(aba.getRange(linha, cab.indexOf('instrumento') + 1).getValue() || '').trim();
  var t = ESCALAS_CALCULO[instrumento];
  if (!t) return { ok: false, erro: 'Escala não encontrada: ' + instrumento };
  var r = _editarCampos_(aba, linha, campos, 'profissional', {
    nome: _nomeDeQuemAltera_('profissional', siglaPaciente, alvo.profissionalId),
    so: function (k) {
      if (/^item_\d{2}$/.test(k)) return parseInt(k.slice(5), 10) >= 1 && parseInt(k.slice(5), 10) <= t.n;
      return k === 'item_funcional' || k === 'item_funcional_texto' || k === 'observacoes';
    },
    derivados: function (header, atual, mudar) {
      var calc = _escoresDaEscala_(instrumento, function (col) {
        return mudar[col] !== undefined ? mudar[col] : atual[header.indexOf(col)];
      });
      return calc.ok ? calc.campos : { __erro: calc.erro };
    }
  });
  if (r.erro) return { ok: false, erro: r.erro };
  if (r.alterados.length) _indicadoresAposGravar_(alvo.profissionalId, siglaPaciente, alvo.planilha);
  _edicaoFeita_(id);
  var header = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var valores = aba.getRange(linha, 1, 1, header.length).getValues()[0];
  var registro = {};
  for (var i = 0; i < header.length; i++) registro[header[i]] = _valorDeLeitura_(header[i], valores[i]);
  var nomesEscala = _nomesDoCarimbo_(siglaPaciente, alvo.profissionalId); // 18.8.1
  return { ok: true, mensagem: 'Escala salva com sucesso', editado_em: r.editado_em,
    campos_alterados: r.alterados, autoria_campos: _autoriaComNomeAtual_(r.autoria_campos, nomesEscala),
    registro: _carimboDoCadastro_(registro, nomesEscala) };
}


// ============================================================
// PACOTE 13.5 — DESATIVAR / REATIVAR / EXCLUIR PACIENTE
// ============================================================

/**
 * Desativa um paciente.
 * Marca ativo = Nao na Controle e move planilha para Pacientes_Desativados/.
 */
function profDesativarPaciente(s, siglaPaciente) {
  var authResult = _authProfissional_(s);
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  if (!siglaPaciente) return { ok: false, erro: 'Sigla do paciente obrigatoria' };

  var profIdDono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!profIdDono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (profIdDono !== profissionalId) return { ok: false, erro: 'Este paciente nao pertence a voce' };

  var paciente = buscarPaciente(siglaPaciente);
  if (!paciente) return { ok: false, erro: 'Dados do paciente nao encontrados' };
  if (!_estaAtivo_(paciente.ativo)) {
    return { ok: false, erro: 'Paciente ja esta desativado' };
  }

  var planilhaId = extrairIdDaUrl(String(paciente.link_planilha_individual || ''));
  if (!planilhaId) return { ok: false, erro: 'Link da planilha invalido' };

  var prof = buscarProfissional(profissionalId);
  if (!prof || !prof.pasta_drive_id) return { ok: false, erro: 'Pasta do profissional nao encontrada' };

  try {
    var pastaProf = DriveApp.getFolderById(prof.pasta_drive_id);

    // Encontrar ou criar Pacientes_Desativados/
    var pastaDesativados;
    var iterDesativ = pastaProf.getFoldersByName('Pacientes_Desativados');
    if (iterDesativ.hasNext()) {
      pastaDesativados = iterDesativ.next();
    } else {
      pastaDesativados = pastaProf.createFolder('Pacientes_Desativados');
    }

    // Mover planilha
    DriveApp.getFileById(planilhaId).moveTo(pastaDesativados);

    // Marcar ativo = Nao na Controle
    _alterarStatusPacienteControle_(profissionalId, siglaPaciente, 'Nao');
    _invalidarLinks_('paciente', siglaPaciente);

    return { ok: true, mensagem: 'Paciente desativado com sucesso' };
  } catch (e) {
    return { ok: false, erro: 'Erro ao desativar paciente: ' + String(e) };
  }
}

/**
 * Reativa um paciente.
 * Marca ativo = Sim na Controle e move planilha de volta para Pacientes/.
 */
function profReativarPaciente(s, siglaPaciente) {
  var authResult = _authProfissional_(s);
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  if (!siglaPaciente) return { ok: false, erro: 'Sigla do paciente obrigatoria' };

  var profIdDono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!profIdDono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (profIdDono !== profissionalId) return { ok: false, erro: 'Este paciente nao pertence a voce' };

  var paciente = buscarPaciente(siglaPaciente);
  if (!paciente) return { ok: false, erro: 'Dados do paciente nao encontrados' };
  if (_estaAtivo_(paciente.ativo)) {
    return { ok: false, erro: 'Paciente ja esta ativo' };
  }

  var planilhaId = extrairIdDaUrl(String(paciente.link_planilha_individual || ''));
  if (!planilhaId) return { ok: false, erro: 'Link da planilha invalido' };

  var prof = buscarProfissional(profissionalId);
  if (!prof || !prof.pasta_drive_id) return { ok: false, erro: 'Pasta do profissional nao encontrada' };

  try {
    var pastaProf = DriveApp.getFolderById(prof.pasta_drive_id);

    // Localizar pasta Pacientes/
    var iterPac = pastaProf.getFoldersByName('Pacientes');
    if (!iterPac.hasNext()) return { ok: false, erro: 'Pasta Pacientes nao encontrada' };
    var pastaPacientes = iterPac.next();

    // Mover planilha de volta
    DriveApp.getFileById(planilhaId).moveTo(pastaPacientes);

    // Marcar ativo = Sim na Controle
    _alterarStatusPacienteControle_(profissionalId, siglaPaciente, 'Sim');

    return { ok: true, mensagem: 'Paciente reativado com sucesso' };
  } catch (e) {
    return { ok: false, erro: 'Erro ao reativar paciente: ' + String(e) };
  }
}

/**
 * Exclui permanentemente um paciente DESATIVADO.
 * Confirmacao dupla: confirmacaoSigla deve ser igual a siglaPaciente.
 * Move planilha para lixeira, remove da Controle e do Indice_Siglas.
 */
function profExcluirPaciente(s, siglaPaciente, confirmacaoSigla, simular) {
  var authResult = _authProfissional_(s);
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  if (!siglaPaciente) return { ok: false, erro: 'Sigla do paciente obrigatoria' };

  // 19.6 (decisao do usuario, 25/11/2026): a lixeira vale para qualquer paciente, direto — sem desativar antes e sem digitar a sigla.
  // A confirmacao sao as duas janelas da tela; `confirmacaoSigla` = true (tela nova) ou a propria sigla (chamadas antigas).
  // `simular` devolve so o que sai e o que fica, sem apagar nada (e o que a segunda janela mostra).
  if (simular !== true && confirmacaoSigla !== true && String(confirmacaoSigla || '').trim().toUpperCase() !== String(siglaPaciente).trim().toUpperCase()) {
    return { ok: false, erro: 'Confirme a exclusão do paciente.' };
  }

  var profIdDono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!profIdDono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (profIdDono !== profissionalId) return { ok: false, erro: 'Este paciente nao pertence a voce' };

  var paciente = buscarPaciente(siglaPaciente);
  if (!paciente) return { ok: false, erro: 'Dados do paciente nao encontrados' };

  var planilhaId = extrairIdDaUrl(String(paciente.link_planilha_individual || ''));
  var controlePlano = abrirControleDoProfissional(profissionalId);
  if (!controlePlano) return { ok: false, erro: 'Controle do profissional não encontrada.' };
  var pl = _excluirPlano_(controlePlano, paciente);
  if (simular === true) return { ok: true, simulacao: pl.plano };

  try {
    // 1. Mover planilha para lixeira do Drive
    if (planilhaId) {
      DriveApp.getFileById(planilhaId).setTrashed(true);
    }

    // 2. Remover linha da Controle
    var controle = abrirControleDoProfissional(profissionalId);
    if (controle) {
      var aba = controle.getSheetByName(ABA_PACIENTES);
      if (aba) {
        var dados = aba.getDataRange().getValues();
        var idxSigla = dados[0].indexOf('sigla');
        var siglaLimpa = String(siglaPaciente).trim().toUpperCase();
        for (var i = dados.length - 1; i >= 1; i--) {
          if (String(dados[i][idxSigla] || '').trim().toUpperCase() === siglaLimpa) {
            aba.deleteRow(i + 1);
            break;
          }
        }
      }
      _lembretesApagarDoPaciente_(controle, siglaPaciente); // 19.2.1: o plano de lembretes sai com o paciente
      // 19.6: a sessao que fica e nao tinha valor proprio guarda o valor do cadastro que esta saindo (senao passaria a valer o valor padrao)
      var valorDoCadastro = String(paciente.valor_sessao === undefined || paciente.valor_sessao === null ? '' : paciente.valor_sessao).replace(/[^0-9.,]/g, '').slice(0, 12);
      if (valorDoCadastro && pl.semValor.length) { var abaSes = _ageAba_(controle, ABA_SESSOES, COLUNAS_SESSOES, false); pl.semValor.forEach(function (x) { _ageGravar_(abaSes, COLUNAS_SESSOES, x.__linha, { valor: valorDoCadastro }); }); }
      _agendaApagarDoPaciente_(controle, siglaPaciente, pl.guardar); // 14.3: sessoes, series e pedidos tambem; 19.6: a sessao cobrada ou paga fica
      // 19.6: o que ja virou dinheiro continua no Fluxo de caixa com o nome marcado, e a sigla nao volta a ser usada neste consultorio
      if (pl.plano.fica_algo) _ageGravar_(_ageAba_(controle, ABA_EXCLUIDOS, COLUNAS_EXCLUIDOS, true), COLUNAS_EXCLUIDOS, 0, { id: String(siglaPaciente).trim().toUpperCase(), nome: pl.plano.nome, excluido_em: _lemAgora_().carimbo });
      _finApagarDoPaciente_(controle, siglaPaciente, pl.plano.fica_algo); // Fase 20: cadastro financeiro, quem paga e cobrancas
    }

    // 3. Remover linha do Indice_Siglas
    var planilhaGlobal = _abrirPlanilha_(SISTEMA_VMC_ID);
    var abaIdx = planilhaGlobal.getSheetByName(ABA_INDICE_SIGLAS);
    if (abaIdx) {
      var dadosIdx = abaIdx.getDataRange().getValues();
      var iSig = dadosIdx[0].indexOf('sigla'), iTip = dadosIdx[0].indexOf('tipo');
      for (var k = dadosIdx.length - 1; k >= 1; k--) {
        var siglaCel = String(dadosIdx[k][iSig] || '').trim().toUpperCase();
        var tipoCel  = String(dadosIdx[k][iTip] || '').trim().toLowerCase();
        if (siglaCel === String(siglaPaciente).trim().toUpperCase() && tipoCel === 'paciente') {
          abaIdx.deleteRow(k + 1);
          _memoEsquecerIndice_();
          break;
        }
      }
    }

    // 18.11: conta excluida — portao, dono e planilha saem do cache na hora
    _portaoEsquecer_([{ tipo: 'paciente', sigla: siglaPaciente, profissional_id: profissionalId, excluida: true }]);
    _invalidarLinks_('paciente', siglaPaciente);
    return { ok: true, mensagem: 'Paciente excluido permanentemente', ficou: pl.plano.fica_algo, nome: pl.plano.nome };
  } catch (e) {
    return { ok: false, erro: 'Erro ao excluir paciente: ' + String(e) };
  }
}

/* ============================================================
   PACOTE 19.6 — Editar e excluir paciente (etapa 7 do plano de correcoes de 24/11/2026)
   ============================================================ */
var ABA_EXCLUIDOS = 'Excluidos';
var COLUNAS_EXCLUIDOS = ['id', 'nome', 'excluido_em']; // id = a sigla do paciente (a leitura das abas em texto literal exige a coluna id); // so de quem deixou sessao cobrada, pagamento ou recibo no Fluxo de caixa
var MARCA_EXCLUIDO = ' (excluído)';

/** Quem foi excluido e deixou dinheiro registrado: { SIGLA: nome }. A aba so nasce na primeira exclusao desse tipo. */
function _excluidosLer_(controle) {
  var mapa = {}, aba = controle ? controle.getSheetByName(ABA_EXCLUIDOS) : null;
  if (!aba || aba.getLastRow() < 2) return mapa;
  _lembretesLer_(aba).forEach(function (l) { var sig = _siglaChave_(l.id); if (sig) mapa[sig] = String(l.nome || '').trim() || sig; });
  return mapa;
}

/** Os dados de cadastro que o lapis edita: nome, e-mail, telefone e CPF. O CPF e o nome da anamnese valem quando ela existe. */
function _cadastroDoPaciente_(paciente, abaAnam) {
  var o = { nome: String(paciente.nome || '').trim(), email: normalizarEmail(paciente.email), telefone: normalizarTelefone(paciente.telefone),
    cpf: String(paciente.cpf === undefined || paciente.cpf === null ? '' : paciente.cpf).replace(/\D/g, ''), tem_anamnese: false };
  if (abaAnam && abaAnam.getLastRow() >= 2) {
    var cab = abaAnam.getRange(1, 1, 1, abaAnam.getLastColumn()).getValues()[0], lin = abaAnam.getRange(2, 1, 1, cab.length).getDisplayValues()[0];
    var de = function (col) { return cab.indexOf(col) >= 0 ? String(lin[cab.indexOf(col)] || '').trim() : ''; };
    o.tem_anamnese = true;
    o.nome_anamnese = de('nome_completo'); o.cpf_anamnese = de('cpf').replace(/\D/g, '');
    if (o.nome_anamnese) o.nome = o.nome_anamnese;
    if (o.cpf_anamnese) o.cpf = o.cpf_anamnese;
  }
  return o;
}

/**
 * Lapis "Editar" do paciente: nome, e-mail, telefone e CPF num lugar so.
 *  - sem `dados`: so le o cadastro (a janela abre preenchida, tambem pelo cartao da lista);
 *  - com `dados`: grava no cadastro (Controle) e, se a anamnese ja existe, nos mesmos campos dela — e um dado so;
 *    o e-mail e o login: trocar invalida os links antigos e o portao (_atualizarContatoPaciente_);
 *    `dados.enviar_convite` manda o convite para o e-mail novo (so quando o e-mail mudou).
 * O CPF nunca vai para log; volta so nesta leitura, para o profissional dono.
 */
function profEditarPaciente(s, siglaPaciente, dados, idEnvio) {
  var auth = _authProfissional_(s);
  if (!auth.ok) return auth;
  if (!siglaPaciente || resolverProfissionalIdPorSigla(siglaPaciente, 'paciente') !== s.profissional_id) return { ok: false, erro: 'Este paciente nao pertence a voce' };
  var pac = buscarPaciente(siglaPaciente);
  if (!pac) return { ok: false, erro: 'Paciente nao encontrado' };
  var abaAnam = null;
  try { abaAnam = _abrirPlanilha_(extrairIdDaUrl(pac.link_planilha_individual)).getSheetByName(ABA_ANAMNESE); } catch (e) { abaAnam = null; }
  var atual = _cadastroDoPaciente_(pac, abaAnam);
  var saida = function (c) { return { nome: c.nome, email: c.email, telefone: c.telefone, cpf: c.cpf, tem_anamnese: c.tem_anamnese }; };
  if (!dados || typeof dados !== 'object') return { ok: true, cadastro: saida(atual) };

  var nome = String(dados.nome || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!nome) return { ok: false, erro: 'Informe o nome do paciente.' };
  var contato = normalizarContato({ email: dados.email, telefone: dados.telefone });
  if (contato.erro) return { ok: false, erro: contato.erro };
  if (!contato.email) return { ok: false, erro: 'E-mail do paciente obrigatório.' };
  var cpf = String(dados.cpf || '').replace(/\D/g, '');
  if (String(dados.cpf || '').trim() && (cpf.length !== 11 || _finDocumento_(cpf) === null)) return { ok: false, erro: 'O CPF não confere. Revise os números.' };

  var emailMudou = contato.email !== atual.email;
  if (emailMudou || contato.telefone !== atual.telefone) {
    var rc = _atualizarContatoPaciente_(siglaPaciente, contato);
    if (!rc.ok) return rc;
  }
  var controle = abrirControleDoProfissional(s.profissional_id);
  if (!controle || !_atualizarLinhaPorChave_(controle.getSheetByName(ABA_PACIENTES), 'sigla', siglaPaciente, { nome: nome, cpf: cpf })) return { ok: false, erro: 'Paciente não encontrado na Controle.' };
  if (atual.tem_anamnese) {
    var campos = {};
    if (nome !== atual.nome_anamnese) campos.nome_completo = nome;
    if (cpf !== atual.cpf_anamnese) campos.cpf = cpf;
    if (Object.keys(campos).length) {
      var ra = profSalvarAnamnese(s, siglaPaciente, null, campos, idEnvio);
      if (!ra || !ra.ok) return { ok: false, erro: (ra && ra.erro) || 'Não foi possível gravar na anamnese.' };
    }
    if (emailMudou || contato.telefone !== atual.telefone) { // o e-mail e o telefone da anamnese espelham o cadastro
      _atualizarCamposLinha_(abaAnam, 2, abaAnam.getRange(1, 1, 1, abaAnam.getLastColumn()).getValues()[0], { email: contato.email, telefone: contato.telefone });
    }
  }
  var resp = { ok: true, cadastro: { nome: nome, email: contato.email, telefone: contato.telefone, cpf: cpf, tem_anamnese: atual.tem_anamnese }, email_mudou: emailMudou };
  if (emailMudou && dados.enviar_convite === true) {
    var rv = profEnviarConvite(s, siglaPaciente, 'email');
    resp.convite = (rv && rv.ok && rv.enviado) ? { enviado: true } : { enviado: false, codigo: (rv && rv.codigo) || '', erro: (rv && rv.erro) || 'Não foi possível enviar o convite agora.' };
  }
  return resp;
}

/**
 * O que a exclusao de um paciente apaga e o que fica (a segunda confirmacao mostra isto, e a exclusao segue isto).
 * Fica o que ja virou dinheiro: sessao cobrada ou com pagamento alocado, os pagamentos e os recibos. O resto sai.
 */
function _excluirPlano_(controle, paciente) {
  var sig = _siglaChave_(paciente.sigla), doPac = function (l) { return _siglaChave_(l.sigla) === sig; };
  var ler = function (nome) { var aba = controle.getSheetByName(nome); return aba ? _lembretesLer_(aba).filter(doPac) : []; };
  var alocado = {};
  ler(ABA_FIN_ALOCACOES).forEach(function (a) { alocado[a.sessao_id] = (alocado[a.sessao_id] || 0) + (parseInt(a.valor, 10) || 0); });
  var sessoes = ler(ABA_SESSOES), guardar = {}, ficam = 0;
  sessoes.forEach(function (x) { if (x.cobrada === 'Sim' || alocado[x.id] > 0) { guardar[x.id] = true; ficam++; } });
  var p = { nome: String(paciente.ind_nome || paciente.nome || '').trim() || String(paciente.sigla),
    anamnese: !!String(paciente.data_anamnese || '').trim() || !!String(paciente.ind_nome || '').trim(),
    registros: parseInt(paciente.ind_total_auto, 10) || 0, escalas: parseInt(paciente.ind_total_escalas, 10) || 0,
    sessoes_saem: sessoes.length - ficam, lembretes: ler(ABA_LEMBRETES).length,
    ficam: { sessoes: ficam, pagamentos: ler(ABA_FIN_PAGAMENTOS).length, recibos: ler(ABA_FIN_RECIBOS).length } };
  p.fica_algo = p.ficam.sessoes + p.ficam.pagamentos + p.ficam.recibos > 0;
  return { plano: p, guardar: guardar, semValor: sessoes.filter(function (x) { return guardar[x.id] && !_finCent_(x.valor); }) };
}

/**
 * Pacote 13.7 — Altera a senha de um paciente pelo profissional responsável.
 * Não exige senha atual do paciente — o profissional tem autoridade.
 */
function profAlterarSenhaPaciente(s, siglaPaciente, novaSenha) {
  // 1. Autenticar profissional
  var authResult = _authProfissional_(s);
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  // 2. Validar nova senha
  if (!novaSenha || String(novaSenha).length < SENHA_MINIMA) {
    return { ok: false, erro: 'Escolha uma senha com pelo menos 8 caracteres.' };
  }
  if (String(novaSenha).length > SENHA_MAXIMA) return { ok: false, erro: 'Não foi possível gravar a senha. Tente de novo.' };

  // 3. Abrir Controle do profissional e atualizar hash
  var controle = abrirControleDoProfissional(profissionalId);
  if (!controle) return { ok: false, erro: 'Controle do profissional nao encontrada.' };

  var aba = controle.getSheetByName(ABA_PACIENTES);
  if (!aba) return { ok: false, erro: 'Aba Pacientes nao encontrada.' };

  var dados = aba.getDataRange().getValues();
  var cabecalhos = dados[0];
  var idxSigla = cabecalhos.indexOf('sigla');
  var idxHash  = cabecalhos.indexOf('senha_hash');

  if (idxSigla === -1 || idxHash === -1) {
    return { ok: false, erro: 'Estrutura da Controle invalida.' };
  }

  var novoHash = gerarHashSenha(String(novaSenha));
  if (!novoHash) return { ok: false, erro: 'Não foi possível gravar a senha. Tente de novo.' };

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxSigla]).trim().toUpperCase() === String(siglaPaciente).trim().toUpperCase()) {
      aba.getRange(i + 1, idxHash + 1).setValue(novoHash);
      _portaoEsquecer_([{ tipo: 'paciente', sigla: siglaPaciente, profissional_id: profissionalId }]); // 18.11: senha trocada
      _invalidarLinks_('paciente', siglaPaciente);
      return { ok: true };
    }
  }

  return { ok: false, erro: 'Paciente nao encontrado na Controle.' };
}

/**
 * Helper interno: atualiza o campo ativo na Controle do profissional.
 */
function _alterarStatusPacienteControle_(profissionalId, siglaPaciente, novoStatus) {
  var controle = abrirControleDoProfissional(profissionalId);
  if (!controle) return false;
  var aba = controle.getSheetByName(ABA_PACIENTES);
  if (!aba) return false;
  var dados = aba.getDataRange().getValues();
  var cabecalhos = dados[0];
  var idxSigla = cabecalhos.indexOf('sigla');
  var idxAtivo = cabecalhos.indexOf('ativo');
  if (idxSigla === -1 || idxAtivo === -1) return false;
  var siglaLimpa = String(siglaPaciente).trim().toUpperCase();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxSigla] || '').trim().toUpperCase() === siglaLimpa) {
      aba.getRange(i + 1, idxAtivo + 1).setValue(novoStatus);
      _portaoEsquecer_([{ tipo: 'paciente', sigla: siglaPaciente, profissional_id: profissionalId }]); // 18.11: `ativo` mudou
      return true;
    }
  }
  return false;
}


/**
 * Lista todos os profissionais cadastrados no sistema.
 *
 * Retorna: { ok: true, total: N, profissionais: [...] }
 * Cada profissional inclui todos os campos EXCETO senha_hash.
 */
function listarProfissionais(s) {
  var adm = _admDaSessao_(s);
  if (!adm) return { ok: false, erro: 'Credenciais de admin invalidas' };

  var planilha = _abrirPlanilha_(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_PROFISSIONAIS);
  if (!aba) return { ok: false, erro: 'Aba Profissionais nao encontrada' };

  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return { ok: true, total: 0, profissionais: [] };

  var cabecalhos = dados[0];
  var lista = [];
  for (var i = 1; i < dados.length; i++) {
    var obj = {};
    for (var j = 0; j < cabecalhos.length; j++) {
      if (cabecalhos[j] === 'senha_hash') continue;  // nunca volta pro cliente
      if (cabecalhos[j] === 'pedido_alteracao') { obj.pedido = _pedidoDe_(dados[i][j]); continue; } // 18.8.1
      obj[cabecalhos[j]] = cabecalhos[j] === 'ativo' ? _ativoParaCliente_(dados[i][j]) : dados[i][j];
    }
    lista.push(obj);
  }
  return { ok: true, total: lista.length, profissionais: lista };
}


// ============================================================
// PACOTE 18.8.1 — "MEUS DADOS" DO PROFISSIONAL E PEDIDO DE ALTERACAO
// ============================================================
// O profissional abre "Meus dados" na area dele: o genero e dele e grava na hora (coluna
// `genero`: 'M', 'F' ou vazio). Nome, e-mail, telefone e CRP ele edita, mas o cadastro so
// muda quando o admin aprova: o que ele pediu fica na coluna `pedido_alteracao` da propria
// linha (JSON { campos: {nomeCompleto, email, telefone, crp}, em }), um pedido por vez —
// salvar de novo substitui; salvar igual ao cadastro retira o pedido. Aprovar aplica por
// atualizarProfissional (o mesmo caminho da edicao do admin: e-mail unico, links, portao).

var PEDIDO_CAMPOS = { nomeCompleto: 'nome_completo', email: 'email', telefone: 'telefone', crp: 'crp' };
var PEDIDO_TAMANHO_MAX = 120;

/** Pedido guardado na celula: { campos, em } so com as chaves conhecidas, ou null. */
function _pedidoDe_(texto) {
  var bruto = _jsonOuVazio_(texto);
  var campos = {}, tem = false;
  for (var k in PEDIDO_CAMPOS) {
    if (bruto && bruto.campos && typeof bruto.campos[k] === 'string') { campos[k] = bruto.campos[k]; tem = true; }
  }
  return tem ? { campos: campos, em: String(bruto.em || '') } : null;
}

/** Os dados do cadastro como "Meus dados" os mostra. */
function _meusDadosDe_(prof) {
  return { sigla: String(prof.sigla || ''), nomeCompleto: String(prof.nome_completo || '').trim(), email: normalizarEmail(prof.email),
    telefone: normalizarTelefone(prof.telefone), crp: String(prof.crp || '').trim(), genero: _generoDe_(prof.genero) };
}

function profLerMeusDados(s) {
  var auth = _authProfissional_(s);
  if (!auth.ok) return auth;
  var prof = buscarProfissional(auth.profissional.profissional_id);
  if (!prof) return { ok: false, erro: 'Profissional nao encontrado' };
  return { ok: true, dados: _meusDadosDe_(prof), pedido: _pedidoDe_(prof.pedido_alteracao) };
}

/**
 * Grava o genero e registra (ou retira) o pedido de alteracao. `dados` = { genero, nomeCompleto,
 * email, telefone, crp }; chave ausente = campo intocado. Saida: { ok, dados, pedido }.
 */
function profSalvarMeusDados(s, dados) {
  var auth = _authProfissional_(s);
  if (!auth.ok) return auth;
  if (!dados || typeof dados !== 'object') return { ok: false, erro: 'Dados ausentes' };
  var profId = auth.profissional.profissional_id;
  var prof = buscarProfissional(profId);
  if (!prof) return { ok: false, erro: 'Profissional nao encontrado' };
  var atual = _meusDadosDe_(prof);

  var generoCru = String(dados.genero === undefined || dados.genero === null ? atual.genero : dados.genero).trim().toUpperCase();
  if (generoCru !== '' && generoCru !== 'M' && generoCru !== 'F') return { ok: false, erro: 'Gênero inválido.' };

  var pedidos = {};
  for (var k in PEDIDO_CAMPOS) {
    if (dados[k] === undefined || dados[k] === null) continue;
    var v = String(dados[k]).trim();
    if (v.length > PEDIDO_TAMANHO_MAX) return { ok: false, erro: 'Texto longo demais.' };
    if (k === 'email') v = normalizarEmail(v);
    if (k === 'telefone') v = normalizarTelefone(v);
    if (v !== atual[k]) pedidos[k] = v;
  }
  if (pedidos.nomeCompleto === '') return { ok: false, erro: 'Nome completo não pode ficar vazio.' };
  if (pedidos.email !== undefined) {
    if (!emailValido(pedidos.email)) return { ok: false, erro: 'E-mail inválido.' };
    var outra = _contaPorEmail_('profissional', pedidos.email);
    if (outra && outra.profissional_id !== String(profId).trim()) return { ok: false, erro: 'Este e-mail já está em uso por outra conta.' };
  }

  var tem = Object.keys(pedidos).length > 0;
  var pedido = tem ? { campos: pedidos, em: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss') } : null;
  var aba = _abrirPlanilha_(SISTEMA_VMC_ID).getSheetByName(ABA_PROFISSIONAIS);
  if (!_atualizarLinhaPorChave_(aba, 'profissional_id', profId, { genero: generoCru, pedido_alteracao: pedido ? JSON.stringify(pedido) : '' })) {
    return { ok: false, erro: 'Profissional nao encontrado' };
  }
  if (_MEMO_.linhas) delete _MEMO_.linhas['prof:' + String(profId).trim()];
  atual.genero = generoCru;
  return { ok: true, dados: atual, pedido: pedido };
}

/** Limpa o pedido da linha do profissional. */
function _pedidoApagar_(profissionalId) {
  var aba = _abrirPlanilha_(SISTEMA_VMC_ID).getSheetByName(ABA_PROFISSIONAIS);
  var ok = _atualizarLinhaPorChave_(aba, 'profissional_id', profissionalId, { pedido_alteracao: '' });
  if (_MEMO_.linhas) delete _MEMO_.linhas['prof:' + String(profissionalId).trim()];
  return ok;
}

/** O admin aprova o pedido: os campos pedidos entram no cadastro pelo caminho da edicao do admin. */
function admAprovarPedido(s, profissionalId) {
  var adm = _admDaSessao_(s);
  if (!adm) return { ok: false, erro: 'Credenciais de admin invalidas' };
  var prof = buscarProfissional(profissionalId);
  if (!prof) return { ok: false, erro: 'Profissional nao encontrado: ' + profissionalId };
  var pedido = _pedidoDe_(prof.pedido_alteracao);
  if (!pedido) return { ok: false, erro: 'Não há pedido de alteração para este profissional.' };
  if (pedido.campos.nomeCompleto === '') return { ok: false, erro: 'Nome completo não pode ficar vazio.' };
  var r = atualizarProfissional(s, profissionalId, pedido.campos);
  if (!r || !r.ok) return r || { ok: false, erro: 'Erro ao aplicar o pedido.' };
  _pedidoApagar_(profissionalId);
  return { ok: true, campos_alterados: r.campos_alterados };
}

/** O admin recusa o pedido: o cadastro fica como esta e o pedido sai. */
function admRecusarPedido(s, profissionalId) {
  var adm = _admDaSessao_(s);
  if (!adm) return { ok: false, erro: 'Credenciais de admin invalidas' };
  var prof = buscarProfissional(profissionalId);
  if (!prof) return { ok: false, erro: 'Profissional nao encontrado: ' + profissionalId };
  if (!_pedidoDe_(prof.pedido_alteracao)) return { ok: false, erro: 'Não há pedido de alteração para este profissional.' };
  _pedidoApagar_(profissionalId);
  return { ok: true };
}


/**
 * Cadastra um novo profissional. Cria automaticamente:
 *   - Pasta "Profissional_<SIGLA>" dentro de clinica-vmc/
 *   - Subpasta "Pacientes" dentro da pasta do profissional
 *   - Planilha "Clinica VMC - Controle" vazia com aba "Pacientes"
 *   - Linha em Sistema_VMC -> aba Profissionais
 *   - Linha em Sistema_VMC -> aba Indice_Siglas
 *
 * Pacote 18.1: sem senha inicial - o acesso nasce no convite (admEnviarConvite).
 *
 * Entrada: dados = {
 *   sigla, nomeCompleto, email, telefone, crp, dataInicio
 * }
 */
function cadastrarProfissional(s, dados) {
  var adm = _admDaSessao_(s);
  if (!adm) return { ok: false, erro: 'Credenciais de admin invalidas' };

  if (!dados) return { ok: false, erro: 'Dados do profissional ausentes' };

  var sigla = String(dados.sigla || '').trim().toUpperCase();
  var nome  = String(dados.nomeCompleto || '').trim();
  var email = normalizarEmail(dados.email);
  var tel   = normalizarTelefone(dados.telefone);
  var crp   = String(dados.crp || '').trim();
  var dataInicio = String(dados.dataInicio || '').trim();

  if (!sigla) return { ok: false, erro: 'Sigla obrigatoria' };
  if (!/^[A-Z0-9_]{2,15}$/.test(sigla)) {
    return { ok: false, erro: 'Sigla deve ter 2-15 caracteres (letras maiusculas, numeros, underline)' };
  }
  if (!nome) return { ok: false, erro: 'Nome completo obrigatorio' };
  if (!emailValido(email)) return { ok: false, erro: 'E-mail inválido.' };
  if (_contaPorEmail_('profissional', email)) return { ok: false, erro: 'Este e-mail já está em uso por outra conta.' };

  var profExistente = resolverProfissionalIdPorSigla(sigla, 'profissional');
  if (profExistente) {
    return { ok: false, erro: 'Ja existe um profissional com a sigla "' + sigla + '"' };
  }

  var profissionalId = 'PROF_' + sigla;

  // Localiza pasta clinica-vmc (pai do Sistema_VMC)
  var arquivoGlobal = DriveApp.getFileById(SISTEMA_VMC_ID);
  var pastasPai = arquivoGlobal.getParents();
  if (!pastasPai.hasNext()) {
    return { ok: false, erro: 'Nao consegui localizar a pasta raiz clinica-vmc' };
  }
  var pastaRaiz = pastasPai.next();

  var nomePastaProf = 'Profissional_' + sigla;
  if (pastaRaiz.getFoldersByName(nomePastaProf).hasNext()) {
    return { ok: false, erro: 'Ja existe uma pasta "' + nomePastaProf + '". Remova manualmente ou escolha outra sigla.' };
  }

  try {
    var pastaProf = pastaRaiz.createFolder(nomePastaProf);
    var pastaProfId = pastaProf.getId();
    pastaProf.createFolder('Pacientes');

    var shControle = SpreadsheetApp.create(NOME_CONTROLE);
    var arquivoControle = DriveApp.getFileById(shControle.getId());
    arquivoControle.moveTo(pastaProf);

    var abaControle = shControle.getSheets()[0];
    abaControle.setName(ABA_PACIENTES);
    var cabecalhosControle = [
      'sigla', 'senha_hash', 'link_planilha_individual',
      'data_cadastro', 'data_anamnese', 'ativo', 'observacoes',
      'email', 'telefone', 'nome'
    ];
    abaControle.getRange(1, 1, 1, cabecalhosControle.length).setValues([cabecalhosControle]);
    abaControle.setFrozenRows(1);
    abaControle.getRange(1, 1, 1, cabecalhosControle.length).setFontWeight('bold');
    _formatarColunasTexto_(abaControle, cabecalhosControle); // 18.2: identificacao nasce como texto

    var hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');

    var planilhaGlobal = _abrirPlanilha_(SISTEMA_VMC_ID);
    var abaProf = planilhaGlobal.getSheetByName(ABA_PROFISSIONAIS);
    var cabProf = abaProf.getRange(1, 1, 1, abaProf.getLastColumn()).getValues()[0];

    var linhaProf = [];
    for (var i = 0; i < cabProf.length; i++) {
      var col = cabProf[i];
      if      (col === 'profissional_id') linhaProf.push(profissionalId);
      else if (col === 'sigla')           linhaProf.push(sigla);
      else if (col === 'senha_hash')      linhaProf.push('');
      else if (col === 'nome_completo')   linhaProf.push(nome);
      else if (col === 'email')           linhaProf.push(email);
      else if (col === 'pasta_drive_id')  linhaProf.push(pastaProfId);
      else if (col === 'data_cadastro')   linhaProf.push(hoje);
      else if (col === 'ativo')           linhaProf.push('sim');
      else if (col === 'telefone')        linhaProf.push(tel);
      else if (col === 'crp')             linhaProf.push(crp);
      else if (col === 'data_inicio')     linhaProf.push(dataInicio);
      else if (col === 'controle_id')     linhaProf.push(shControle.getId()); // 18.10
      else                                linhaProf.push('');
    }
    abaProf.appendRow(linhaProf.map(function (v, k) { return _celulaTexto_(cabProf[k], v); })); // 18.2

    _anexarIndice_(sigla, 'profissional', profissionalId, email);

    return {
      ok: true,
      mensagem: 'Profissional cadastrado com sucesso',
      profissional_id: profissionalId,
      sigla: sigla,
      pasta_drive_id: pastaProfId
    };

  } catch (e) {
    return {
      ok: false,
      erro: 'Erro ao criar estrutura no Drive: ' + String(e) +
            '. Pode ter ficado lixo no Drive - verificar manualmente.'
    };
  }
}


/**
 * Atualiza campos do profissional. Aceita qualquer subconjunto de:
 *   nomeCompleto, email, telefone, crp, dataInicio
 *
 * NAO permite alterar: profissional_id, sigla, senha_hash, ativo,
 * pasta_drive_id, data_cadastro. Use funcoes especificas (troca senha,
 * desativar) para esses.
 */
function atualizarProfissional(s, profissionalId, mudancas) {
  var adm = _admDaSessao_(s);
  if (!adm) return { ok: false, erro: 'Credenciais de admin invalidas' };

  if (!profissionalId) return { ok: false, erro: 'profissionalId obrigatorio' };
  if (!mudancas) return { ok: false, erro: 'mudancas obrigatorias' };

  var mapaCampos = {
    nomeCompleto: 'nome_completo',
    email:        'email',
    telefone:     'telefone',
    crp:          'crp',
    dataInicio:   'data_inicio'
  };

  var planilha = _abrirPlanilha_(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_PROFISSIONAIS);
  if (!aba) return { ok: false, erro: 'Aba Profissionais nao encontrada' };

  var dados = aba.getDataRange().getValues();
  var cabecalhos = dados[0];
  var idxId = cabecalhos.indexOf('profissional_id');

  // Pacote 18.1: e-mail e o login do profissional - normalizado, unico e
  // copiado para o Indice_Siglas; telefone so com digitos.
  if (mudancas.telefone !== undefined) mudancas.telefone = normalizarTelefone(mudancas.telefone);
  if (mudancas.email !== undefined) {
    mudancas.email = normalizarEmail(mudancas.email);
    if (mudancas.email && !emailValido(mudancas.email)) return { ok: false, erro: 'E-mail inválido.' };
    var profAtual = buscarProfissional(profissionalId);
    if (profAtual) {
      var ri = _gravarEmailIndice_(profAtual.sigla, 'profissional', mudancas.email);
      if (!ri.ok) return ri;
      if (ri.mudou || normalizarEmail(profAtual.email) !== mudancas.email) _invalidarLinks_('profissional', profAtual.sigla);
    }
  }

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]).trim() === String(profissionalId).trim()) {
      var alteracoes = [];
      for (var chaveCli in mapaCampos) {
        if (mudancas[chaveCli] === undefined) continue;
        var nomeColuna = mapaCampos[chaveCli];
        var idxCol = cabecalhos.indexOf(nomeColuna);
        if (idxCol === -1) continue;
        aba.getRange(i + 1, idxCol + 1).setValue(_celulaTexto_(nomeColuna, String(mudancas[chaveCli]).trim())); // 18.2
        alteracoes.push(nomeColuna);
      }
      // 18.11: nome e e-mail da sessao vem da linha da conta
      _portaoEsquecer_([{ tipo: 'profissional', sigla: dados[i][cabecalhos.indexOf('sigla')], profissional_id: profissionalId }]);
      return {
        ok: true,
        mensagem: 'Profissional atualizado',
        campos_alterados: alteracoes
      };
    }
  }
  return { ok: false, erro: 'Profissional nao encontrado: ' + profissionalId };
}


/**
 * Troca a senha do profissional (hash v2). Senha nova com no minimo 8
 * caracteres.
 */
function trocarSenhaProfissional(s, profissionalId, novaSenha) {
  var adm = _admDaSessao_(s);
  if (!adm) return { ok: false, erro: 'Credenciais de admin invalidas' };

  if (!profissionalId) return { ok: false, erro: 'profissionalId obrigatorio' };
  if (!novaSenha || String(novaSenha).length < SENHA_MINIMA) {
    return { ok: false, erro: 'Escolha uma senha com pelo menos 8 caracteres.' };
  }
  if (String(novaSenha).length > SENHA_MAXIMA) return { ok: false, erro: 'Não foi possível gravar a senha. Tente de novo.' };

  var planilha = _abrirPlanilha_(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_PROFISSIONAIS);
  var dados = aba.getDataRange().getValues();
  var cabecalhos = dados[0];
  var idxId = cabecalhos.indexOf('profissional_id');
  var idxSenha = cabecalhos.indexOf('senha_hash');

  var hashProf = gerarHashSenha(String(novaSenha));
  if (!hashProf) return { ok: false, erro: 'Não foi possível gravar a senha. Tente de novo.' };

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]).trim() === String(profissionalId).trim()) {
      aba.getRange(i + 1, idxSenha + 1).setValue(hashProf);
      _portaoEsquecer_([{ tipo: 'profissional', sigla: dados[i][cabecalhos.indexOf('sigla')], profissional_id: profissionalId }]); // 18.11: senha trocada
      _invalidarLinks_('profissional', dados[i][cabecalhos.indexOf('sigla')]);
      return { ok: true, mensagem: 'Senha trocada com sucesso' };
    }
  }
  return { ok: false, erro: 'Profissional nao encontrado: ' + profissionalId };
}


/**
 * Marca o profissional como inativo. Nao apaga dados nem remove do
 * Indice_Siglas (mantemos historico). Profissional inativo nao
 * consegue mais logar.
 */
function desativarProfissional(s, profissionalId) {
  var r = _alterarStatusProfissional(s, profissionalId, 'nao');
  if (r && r.ok) _gcalDesligar_(profissionalId); // 14.8: a permissao da agenda dele sai junto
  return r;
}

function reativarProfissional(s, profissionalId) {
  return _alterarStatusProfissional(s, profissionalId, 'sim');
}

function _alterarStatusProfissional(s, profissionalId, novoStatus) {
  var adm = _admDaSessao_(s);
  if (!adm) return { ok: false, erro: 'Credenciais de admin invalidas' };

  if (!profissionalId) return { ok: false, erro: 'profissionalId obrigatorio' };

  var planilha = _abrirPlanilha_(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_PROFISSIONAIS);
  var dados = aba.getDataRange().getValues();
  var cabecalhos = dados[0];
  var idxId = cabecalhos.indexOf('profissional_id');
  var idxAtivo = cabecalhos.indexOf('ativo');

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]).trim() === String(profissionalId).trim()) {
      aba.getRange(i + 1, idxAtivo + 1).setValue(novoStatus);
      // 18.11: `ativo` do profissional mudou — cai o portao dele e o de todos os pacientes dele
      _portaoEsquecerProfissional_(profissionalId, dados[i][cabecalhos.indexOf('sigla')]);
      if (!_estaAtivo_(novoStatus)) _invalidarLinks_('profissional', dados[i][cabecalhos.indexOf('sigla')]);
      return {
        ok: true,
        mensagem: novoStatus === 'sim' ? 'Profissional reativado' : 'Profissional desativado'
      };
    }
  }
  return { ok: false, erro: 'Profissional nao encontrado: ' + profissionalId };
}


// ============================================================
// PACOTE 14.1 - GRADE DE ATENDIMENTO (Modulo Consultorio Digital)
// Abas na planilha Controle do profissional:
//   Config_Agenda   -> chave | valor          (configuracoes gerais)
//   Grade_Horarios  -> dia_semana | hora_inicio | hora_fim | modalidade | ativo
// Horarios gravados como TEXTO PURO (formato @) para o bug 1899
// nem existir nesta estrutura. Leitura via getDisplayValues().
// ============================================================

var GRADE_ABA_CONFIG = 'Config_Agenda';
var GRADE_ABA_HORARIOS = 'Grade_Horarios';
var GRADE_CONFIG_PADRAO = {
  duracao_slot_min: 60,
  antecedencia_min_horas: 24
};

/**
 * Garante que a aba exista na Controle, criando com cabecalho e
 * formato de texto puro se necessario. Retorna a aba.
 */
function _gradeObterOuCriarAba_(controle, nomeAba, cabecalhos) {
  var aba = controle.getSheetByName(nomeAba);
  if (!aba) {
    aba = controle.insertSheet(nomeAba);
    aba.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
    // Formato texto puro em toda a area util: Sheets nunca converte
    // "13:00" em celula TIME (raiz do bug 1899)
    aba.getRange(1, 1, aba.getMaxRows(), cabecalhos.length).setNumberFormat('@');
  }
  return aba;
}

/**
 * Le a grade de atendimento do profissional.
 * Entrada: s (sessao do profissional, do cracha)
 * Saida: { ok:true, config:{...}, grade:[{dia_semana,hora_inicio,hora_fim,modalidade,ativo}] }
 * Se as abas ainda nao existem, retorna config padrao e grade vazia
 * (primeiro acesso) sem criar nada.
 */
function lerGradeAtendimento(s) {
  // 1. Revalidar credenciais (padrao consolidado do Pacote 13.2)
  var authResult = _authProfissional_(s);
  if (!authResult.ok) return authResult;

  var profissionalId = authResult.profissional.profissional_id;
  var controle = abrirControleDoProfissional(profissionalId);
  if (!controle) {
    return { ok: false, erro: 'Planilha de Controle nao encontrada.' };
  }

  // 2. Config (merge sobre os padroes)
  var config = {
    duracao_slot_min: GRADE_CONFIG_PADRAO.duracao_slot_min,
    antecedencia_min_horas: GRADE_CONFIG_PADRAO.antecedencia_min_horas
  };
  var abaCfg = controle.getSheetByName(GRADE_ABA_CONFIG);
  if (abaCfg) {
    var valsCfg = abaCfg.getDataRange().getDisplayValues();
    for (var i = 1; i < valsCfg.length; i++) {
      var chave = String(valsCfg[i][0] || '').trim();
      if (!chave) continue;
      var valor = String(valsCfg[i][1] || '').trim();
      var num = Number(valor);
      config[chave] = isNaN(num) || valor === '' ? valor : num;
    }
  }

  // 3. Grade
  var grade = [];
  var abaGrade = controle.getSheetByName(GRADE_ABA_HORARIOS);
  if (abaGrade) {
    var vals = abaGrade.getDataRange().getDisplayValues();
    if (vals.length > 1) {
      var cab = vals[0];
      var iDia = cab.indexOf('dia_semana');
      var iIni = cab.indexOf('hora_inicio');
      var iFim = cab.indexOf('hora_fim');
      var iMod = cab.indexOf('modalidade');
      var iAtv = cab.indexOf('ativo');
      for (var r = 1; r < vals.length; r++) {
        var linha = vals[r];
        if (String(linha[iDia] || '').trim() === '') continue;
        grade.push({
          dia_semana: Number(linha[iDia]),
          hora_inicio: String(linha[iIni] || '').trim(),
          hora_fim: String(linha[iFim] || '').trim(),
          modalidade: String(linha[iMod] || '').trim(),
          ativo: String(linha[iAtv] || 'sim').trim()
        });
      }
    }
  }

  return { ok: true, config: config, grade: grade, // 14.8: a conta conectada vem na leitura da Agenda (agenda_externa)
    emails_prof_disponivel: _stpDisponivel_(profissionalId) }; // 20.2
}

/**
 * Salva a grade de atendimento do profissional.
 * Entrada:
 *   s      - sessao do profissional (cracha)
 *   config - { duracao_slot_min, antecedencia_min_horas }
 *   grade  - [{dia_semana, hora_inicio, hora_fim, modalidade, ativo}]
 * Cria as abas Config_Agenda e Grade_Horarios automaticamente no
 * primeiro salvamento. A grade representa o estado ATUAL da
 * configuracao: as linhas de dados sao substituidas a cada save
 * (config nao e historico clinico; o principio aditivo se aplica
 * ao schema das colunas, que nunca muda).
 */
function salvarGradeAtendimento(s, config, grade) {
  // 1. Revalidar credenciais
  var authResult = _authProfissional_(s);
  if (!authResult.ok) return authResult;

  var profissionalId = authResult.profissional.profissional_id;
  var controle = abrirControleDoProfissional(profissionalId);
  if (!controle) {
    return { ok: false, erro: 'Planilha de Controle nao encontrada.' };
  }

  // 2. Validacao server-side dos dados recebidos
  config = config || {};
  grade = grade || [];
  var reHora = /^([01]\d|2[0-3]):[0-5]\d$/;
  var modsValidas = { presencial: true, online: true, ambas: true };
  for (var i = 0; i < grade.length; i++) {
    var j = grade[i] || {};
    var dia = Number(j.dia_semana);
    if (!(dia >= 1 && dia <= 7)) {
      return { ok: false, erro: 'Linha ' + (i + 1) + ': dia_semana invalido.' };
    }
    if (!reHora.test(String(j.hora_inicio)) || !reHora.test(String(j.hora_fim))) {
      return { ok: false, erro: 'Linha ' + (i + 1) + ': horario invalido (use HH:MM).' };
    }
    if (String(j.hora_fim) <= String(j.hora_inicio)) {
      return { ok: false, erro: 'Linha ' + (i + 1) + ': hora final deve ser maior que a inicial.' };
    }
    if (!modsValidas[String(j.modalidade)]) {
      return { ok: false, erro: 'Linha ' + (i + 1) + ': modalidade invalida.' };
    }
  }

  // 3. Gravar Config_Agenda (upsert chave -> valor)
  if (_MEMO_.age) _MEMO_.age.cfg = new Map(); // 14.12: a Grade vai gravar a configuracao
  var abaCfg = _gradeObterOuCriarAba_(controle, GRADE_ABA_CONFIG, ['chave', 'valor']);
  var cfgGravar = {
    duracao_slot_min: Number(config.duracao_slot_min) || GRADE_CONFIG_PADRAO.duracao_slot_min,
    antecedencia_min_horas: Number(config.antecedencia_min_horas) || GRADE_CONFIG_PADRAO.antecedencia_min_horas
  };
  var valsCfg = abaCfg.getDataRange().getDisplayValues();
  var chavesExistentes = {};
  for (var c = 1; c < valsCfg.length; c++) {
    chavesExistentes[String(valsCfg[c][0]).trim()] = c + 1; // numero da linha na planilha
  }
  // 14.3: chave geral dos avisos de sessao (so muda quando a tela a manda; nasce 'Nao')
  if (config.avisos_sessao !== undefined) cfgGravar.avisos_sessao = String(config.avisos_sessao).toLowerCase() === 'sim' ? 'Sim' : 'Nao';
  // 14.5: endereco do consultorio e espelho no Google Calendar (so mudam quando a tela os manda)
  var txtEnd = function (v) { return String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, AGENDA_ENDERECO_MAX); };
  if (config.endereco !== undefined) cfgGravar.endereco = txtEnd(config.endereco);
  if (config.endereco_novo !== undefined) cfgGravar.endereco_novo = txtEnd(config.endereco_novo);
  if (config.endereco_novo_desde !== undefined) cfgGravar.endereco_novo_desde = _lemDia_(config.endereco_novo_desde) === null ? '' : String(config.endereco_novo_desde).trim();
  // 20.2: os dois e-mails ao profissional (so mudam quando a tela os manda; ligar exige a conta que pode recebe-los)
  if (config.email_status_pendente !== undefined || config.email_agenda_amanha !== undefined) {
    var podeEmailProf = _stpDisponivel_(profissionalId);
    if (config.email_status_pendente !== undefined) cfgGravar.email_status_pendente = (String(config.email_status_pendente).toLowerCase() === 'sim' && podeEmailProf) ? 'Sim' : 'Nao';
    if (config.email_agenda_amanha !== undefined) cfgGravar.email_agenda_amanha = (String(config.email_agenda_amanha).toLowerCase() === 'sim' && podeEmailProf) ? 'Sim' : 'Nao';
  }
  if (config.email_agenda_hora !== undefined && _stpHoraValida_(config.email_agenda_hora)) cfgGravar.email_agenda_hora = String(config.email_agenda_hora);
  for (var chave in cfgGravar) {
    var valorTxt = (chave === 'endereco' || chave === 'endereco_novo' || chave === 'endereco_novo_desde' || chave === 'email_agenda_hora') ? _lemCelula_(cfgGravar[chave]) : _celulaSegura_(String(cfgGravar[chave])); // 18.2; 14.5: endereco e texto literal
    if (chavesExistentes[chave]) {
      abaCfg.getRange(chavesExistentes[chave], 2).setValue(valorTxt);
    } else {
      abaCfg.appendRow([chave, valorTxt]);
    }
  }


  // 4. Gravar Grade_Horarios (substitui linhas de dados pelo estado atual)
  var abaGrade = _gradeObterOuCriarAba_(controle, GRADE_ABA_HORARIOS,
    ['dia_semana', 'hora_inicio', 'hora_fim', 'modalidade', 'ativo']);
  var ultimaLinha = abaGrade.getLastRow();
  if (ultimaLinha > 1) {
    abaGrade.getRange(2, 1, ultimaLinha - 1, 5).clearContent();
  }
  if (grade.length > 0) {
    var linhas = grade.map(function (g) {
      return [
        String(g.dia_semana),
        String(g.hora_inicio),
        String(g.hora_fim),
        String(g.modalidade),
        _celulaSegura_(String(g.ativo || 'sim')) // 18.2: unico campo da grade sem validacao de formato
      ];
    });
    var destino = abaGrade.getRange(2, 1, linhas.length, 5);
    destino.setNumberFormat('@'); // garante texto puro mesmo em abas antigas
    destino.setValues(linhas);
  }

  return { ok: true, mensagem: 'Grade de atendimento salva.', total_janelas: grade.length };
}


// ============================================================
// BACKUP E MONITORAMENTO (Pacote E3)
// ============================================================
//
// Nada aqui passa pelo doPost. O backup roda SOB DEMANDA (rodarBackupAgora,
// indicado pelo Code antes de mudanca com risco de perda — decisao do
// usuario de 30/09); so o monitor roda por gatilho de tempo, 1x ao dia.
// Gatilhos executam o codigo HEAD do projeto, por isso o E3 faz so
// `clasp push`, sem deploy do web app. Nenhuma acao do doPost muda de
// contrato (o ping so ganha campos).
//
// Erros usam console.error (severidade ERROR no Cloud Logging, coerente
// com exceptionLogging: STACKDRIVER) e nunca carregam conteudo clinico —
// so nome de planilha e mensagem da excecao. Mensagens informativas usam
// Logger.log, o padrao do resto do arquivo.
//
// REGRA DE OURO, decidida em 30/09 depois de duas revisoes adversariais:
// backup que falha NAO pode parecer saudavel. Em ordem de importancia:
//   1. toda fonte que DEVIA existir e conferida contra uma expectativa
//      independente (a lista de pacientes da Controle), nao contra o que o
//      proprio backup conseguiu enumerar;
//   2. subpasta obrigatoria ausente e ERRO, nao "nada a copiar";
//   3. nome de destino repetido na mesma execucao e ERRO, nunca "ja estava
//      copiado" — senao um arquivo que nunca foi copiado entra na conta;
//   4. a retencao SO roda quando o backup do dia fechou limpo, e o texto do
//      log e o e-mail sao montados DEPOIS dela, para nao mentirem;
//   5. falha total lanca excecao; falha parcial manda e-mail, e se o e-mail
//      nao sair, lanca tambem.
// Na duvida o pacote guarda dados a mais e grita, nunca apaga em silencio.

var ABA_BACKUPS = 'Backups';
var HEADERS_BACKUPS = ['data_hora', 'arquivos', 'erros', 'duracao_s', 'detalhe'];

// Quantas copias de backup ficam guardadas (as mais recentes). A limpeza
// so roda quando o backup do dia fechou limpo. Decisao do usuario (30/09).
var E3_RETENCAO_COPIAS = 5;

// URL da implantacao de PRODUCAO (@26). E a mesma constante APPS_SCRIPT_URL
// de index-dev.html e admin.html: se a implantacao mudar, os tres pontos
// mudam juntos (o index.html so redireciona desde 07/10/2026). Publica por decisao do usuario (28/09).
var E3_PING_URL = 'https://script.google.com/macros/s/AKfycbx7kHrVq7KizCWCVeEhTpsBFcU36Vc1zUBWF1AuJxdPD3iO5K4LIPuZs2vXXr1OK94eAg/exec';

// Propriedade do script que guarda a hora do ultimo aviso por e-mail
// (limite de 1 e-mail por hora). Nenhum segredo vive aqui.
var E3_PROP_ULTIMO_AVISO = 'e3_ultimo_aviso_ping';

// Subpastas de paciente na pasta do profissional. `Pacientes` e OBRIGATORIA
// (cadastrarProfissional sempre cria, e cadastrarPaciente devolve erro sem
// ela); `Pacientes_Desativados` so nasce na primeira desativacao.
var E3_SUBPASTAS_PACIENTE = [
  { nome: 'Pacientes', obrigatoria: true },
  { nome: 'Pacientes_Desativados', obrigatoria: false }
];

// Separador entre o prefixo e o nome original no arquivo de backup. NAO
// pertence ao alfabeto das siglas (/^[A-Z0-9_]+$/), logo a primeira
// ocorrencia delimita o prefixo sem ambiguidade — ao contrario de '_'.
var E3_SEPARADOR = ' - ';


// ------------------------------------------------------------
// Funcoes puras (testadas em Node antes do clasp push)
// ------------------------------------------------------------

/**
 * Nome da pasta do dia, AAAA-MM-DD.
 *
 * Nao usa Utilities.formatDate de proposito: precisa ser pura para rodar
 * em Node no teste. O appsscript.json fixa timeZone America/Sao_Paulo, e
 * os metodos de Date no Apps Script respeitam o fuso do projeto — logo
 * getFullYear/getMonth/getDate ja devolvem a data civil de Sao Paulo.
 */
function nomeDaPastaDoDia(data) {
  var a = data.getFullYear();
  var m = data.getMonth() + 1;
  var d = data.getDate();
  return a + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
}

/**
 * Dada a lista de nomes de subpasta de Backups/, devolve as que EXCEDEM as
 * `manter` DATAS mais recentes. Vale `AAAA-MM-DD` e, desde o 18.2.1,
 * `AAAA-MM-DD_<sufixo>` (copia extra daquele dia, feita antes de um pacote):
 * a ordem e pela data, e as pastas com sufixo saem junto com a do mesmo dia.
 *
 * Nome que nao comece exatamente por AAAA-MM-DD (sozinho ou seguido de `_`)
 * e ignorado: pasta que nao foi criada pelo backup nunca vai para a lixeira.
 * Uma pasta com nome de data criada a mao pelo usuario conta como copia — nao
 * ha como distinguir pelo nome, e isso esta registrado no relatorio do pacote.
 */
function pastasExcedentes(lista, manter) {
  var n = Number(manter);
  if (!isFinite(n) || n < 1) return [];
  var porData = {};
  for (var i = 0; i < lista.length; i++) {
    var nome = String(lista[i]);
    var m = /^([0-9]{4}-[0-9]{2}-[0-9]{2})(_.+)?$/.exec(nome);
    if (!m) continue;
    (porData[m[1]] = porData[m[1]] || []).push(nome);
  }
  var datas = Object.keys(porData).sort(); // crescente: mais antigas primeiro
  if (datas.length <= n) return [];
  var saem = [];
  datas.slice(0, datas.length - n).forEach(function (d) { saem = saem.concat(porData[d].sort()); });
  return saem;
}

/**
 * Nome do arquivo dentro da pasta do dia: `<prefixo> - <nome original>`.
 *
 * A pasta do dia e plana e toda Controle se chama "Clinica VMC - Controle"
 * (NOME_CONTROLE): sem prefixo a restauracao com mais de um profissional
 * fica ambigua, e duas Controles colidiriam. O prefixo tambem torna o nome
 * de destino previsivel, que e o que permite a idempotencia.
 *
 * O prefixo vazio (so a planilha global) mantem o nome original. Quem
 * chama no caminho do profissional passa a sigla ou, se ela faltar, o
 * profissional_id — nunca vazio.
 */
function nomeDoBackup(prefixo, nomeOriginal) {
  var p = String(prefixo == null ? '' : prefixo).trim();
  var nome = String(nomeOriginal == null ? '' : nomeOriginal);
  return p ? p + ' - ' + nome : nome;
}

/**
 * Corta um texto em `max` caracteres.
 */
function e3Truncar(texto, max) {
  var t = String(texto == null ? '' : texto);
  return t.length <= max ? t : t.slice(0, max);
}

/**
 * Monta o texto da coluna `detalhe`: o resumo da falta na frente, depois a
 * lista de erros. Chamada DEPOIS da retencao, para nao congelar um texto
 * que a retencao ainda pode contradizer.
 */
function detalheDoBackup(faltam, esperados, detalhes) {
  var texto = detalhes.join(' | ');
  if (faltam > 0) {
    var resumo = 'faltam ' + faltam + ' de ' + esperados + ' arquivo(s) na pasta do dia';
    texto = texto ? resumo + ' | ' + texto : resumo;
  }
  return texto;
}


// ------------------------------------------------------------
// Auxiliares de Drive, de log e de aviso
// ------------------------------------------------------------

/**
 * Pasta raiz clinica-vmc = pai da planilha global Sistema_VMC.
 * Mesmo caminho usado em cadastrarProfissional: nenhum ID de pasta
 * hardcoded no backend.
 */
function _e3PastaRaiz_() {
  var pastasPai = DriveApp.getFileById(SISTEMA_VMC_ID).getParents();
  if (!pastasPai.hasNext()) {
    throw new Error('Nao consegui localizar a pasta raiz clinica-vmc');
  }
  return pastasPai.next();
}

/**
 * Subpasta de nome dado, criando se faltar.
 */
function _e3ObterOuCriarPasta_(pastaPai, nome) {
  var iter = pastaPai.getFoldersByName(nome);
  return iter.hasNext() ? iter.next() : pastaPai.createFolder(nome);
}

/**
 * E-mail do dono do script. Nunca vem de codigo.
 */
function _e3EmailDoDono_() {
  try {
    return Session.getEffectiveUser().getEmail() || '';
  } catch (e) {
    return '';
  }
}

/**
 * Aba Backups garantida, no padrao _garantirColunasX_(): cria a aba se
 * faltar e garante CADA coluna de HEADERS_BACKUPS pelo NOME, inclusive em
 * aba que ja existia sem cabecalho ou com cabecalho incompleto.
 *
 * Devolve { aba, cabecalhos } — a gravacao e sempre por nome, nunca por
 * posicao (regra dura do projeto).
 */
function _e3GarantirAbaBackups_(planilha) {
  var aba = planilha.getSheetByName(ABA_BACKUPS);
  if (!aba) {
    aba = planilha.insertSheet(ABA_BACKUPS);
    aba.getRange(1, 1, 1, HEADERS_BACKUPS.length).setValues([HEADERS_BACKUPS]);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, HEADERS_BACKUPS.length).setFontWeight('bold');
    return { aba: aba, cabecalhos: HEADERS_BACKUPS.slice() };
  }

  var ultima = aba.getLastColumn();
  var header = ultima > 0 ? aba.getRange(1, 1, 1, ultima).getValues()[0] : [];
  for (var i = 0; i < header.length; i++) header[i] = String(header[i]).trim();

  HEADERS_BACKUPS.forEach(function (col) {
    if (header.indexOf(col) === -1) {
      ultima++;
      aba.getRange(1, ultima).setValue(col).setFontWeight('bold');
      header.push(col);
    }
  });
  if (aba.getFrozenRows() < 1) aba.setFrozenRows(1);
  return { aba: aba, cabecalhos: header };
}

/**
 * Grava uma linha por execucao na aba Backups, montando a linha pelo NOME
 * do cabecalho (padrao das linhas de cadastro deste arquivo).
 */
function _e3RegistrarBackup_(inicio, arquivos, erros, detalhe) {
  try {
    var planilha = _abrirPlanilha_(SISTEMA_VMC_ID);
    var g = _e3GarantirAbaBackups_(planilha);
    var duracao = Math.round((new Date().getTime() - inicio.getTime()) / 1000);

    var valores = {
      data_hora: Utilities.formatDate(inicio, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss'),
      arquivos: arquivos,
      erros: erros,
      duracao_s: duracao,
      detalhe: _celulaSegura_(e3Truncar(detalhe, 2000)) // trava unica do 18.2 (o E3 tinha uma versao local)
    };

    var linha = [];
    for (var i = 0; i < g.cabecalhos.length; i++) {
      var col = g.cabecalhos[i];
      linha.push(Object.prototype.hasOwnProperty.call(valores, col) ? valores[col] : '');
    }
    _comTrava_(function () { g.aba.appendRow(linha); }); // 18.10: escrita em planilha na trava
  } catch (e) {
    console.error('E3 backup: nao consegui registrar na aba Backups: ' + String(e));
  }
}

/**
 * E-mail ao dono quando o backup nao fechou limpo.
 * Sem limite por hora: o backup e sob demanda (sem gatilho), e cada falha
 * deve avisar.
 *
 * `retencaoRodou` e passado de fora: o texto nao pode afirmar que nada foi
 * apagado quando a retencao rodou e falhou no meio.
 */
function _e3AvisarBackup_(inicio, esperados, presentes, detalhes, retencaoRodou) {
  var dono = _e3EmailDoDono_();
  if (!dono) {
    console.error('E3 backup: sem e-mail do dono; aviso de falha nao enviado.');
    return false;
  }
  var quando = Utilities.formatDate(inicio, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
  var sobreRetencao = retencaoRodou
    ? 'A retenção (5 cópias mais recentes) JÁ havia rodado nesta execução quando o erro apareceu: confira na ' +
      'lixeira do Drive se alguma pasta de backup foi apagada e restaure se precisar.'
    : 'A retenção (5 cópias mais recentes) NÃO rodou nesta execução: nenhuma cópia antiga foi apagada.';

  var texto =
    'O backup não fechou limpo.\n\n' +
    'Hora (America/Sao_Paulo): ' + quando + '\n' +
    'Arquivos esperados: ' + esperados + '\n' +
    'Arquivos presentes na pasta do dia: ' + presentes + '\n' +
    'Erros: ' + detalhes.length + '\n\n' +
    'Detalhe (nomes de planilha e mensagens de erro, sem conteúdo de paciente):\n' +
    e3Truncar(detalhes.join('\n'), 3000) + '\n\n' +
    sobreRetencao + '\n' +
    'Confira a aba Backups da Sistema_VMC e a página Execuções do projeto.';
  try {
    MailApp.sendEmail({
      to: dono,
      subject: 'COGNIATIVO - backup com falha',
      body: texto,
      name: 'COGNIATIVO'
    });
    return true;
  } catch (e) {
    console.error('E3 backup: falha ao enviar o e-mail de aviso: ' + String(e));
    return false;
  }
}

/**
 * Copia um File para a pasta do dia com o nome de destino dado, SE ele
 * ainda nao estiver la. Idempotente entre execucoes do mesmo dia.
 *
 * `usados` acumula os nomes de destino JA tratados NESTA execucao: nome
 * repetido e colisao (dois arquivos diferentes disputando o mesmo destino)
 * e vira ERRO, nunca "ja estava copiado" — sem isso, um arquivo que nunca
 * foi copiado entraria na contagem de presentes.
 *
 * Devolve { ok, novo } — `novo:false` com `ok:true` significa "copiado por
 * uma execucao anterior de hoje".
 */
function _e3CopiarSeFaltar_(arquivo, pastaDia, nomeDestino, usados) {
  try {
    if (Object.prototype.hasOwnProperty.call(usados, nomeDestino)) {
      console.error('E3 backup: nome de destino repetido nesta execucao: "' + nomeDestino + '".');
      return { ok: false, novo: false,
               erro: 'nome de destino repetido nesta execucao: ' + nomeDestino };
    }
    usados[nomeDestino] = true;

    if (pastaDia.getFilesByName(nomeDestino).hasNext()) {
      return { ok: true, novo: false, nome: nomeDestino };
    }
    arquivo.makeCopy(nomeDestino, pastaDia);
    return { ok: true, novo: true, nome: nomeDestino };
  } catch (e) {
    console.error('E3 backup: falha ao copiar "' + nomeDestino + '": ' + String(e));
    return { ok: false, novo: false, erro: nomeDestino + ': ' + String(e) };
  }
}

/**
 * Idem, para um arquivo identificado por ID.
 */
function _e3CopiarPorIdSeFaltar_(id, pastaDia, prefixo, usados) {
  try {
    var arquivo = DriveApp.getFileById(id);
    return _e3CopiarSeFaltar_(arquivo, pastaDia,
                              nomeDoBackup(prefixo, arquivo.getName()), usados);
  } catch (e) {
    console.error('E3 backup: falha ao abrir o arquivo ' + id + ': ' + String(e));
    return { ok: false, novo: false, erro: 'id ' + id + ': ' + String(e) };
  }
}

/**
 * Quantos pacientes a Controle do profissional declara (linhas com sigla).
 * E a expectativa INDEPENDENTE contra a qual o numero de planilhas
 * encontradas no Drive e conferido: sem ela, `esperados` seria apenas o que
 * o backup conseguiu enumerar, e arquivo-fonte ausente passaria batido.
 *
 * Devolve -1 quando nao foi possivel apurar (a conferencia e omitida e o
 * motivo vai para o detalhe).
 */
function _e3PacientesDeclarados_(controle) {
  try {
    var linhas = lerAbaComoObjetos(controle, ABA_PACIENTES);
    var n = 0;
    for (var i = 0; i < linhas.length; i++) {
      if (String(linhas[i].sigla || '').trim()) n++;
    }
    return n;
  } catch (e) {
    console.error('E3 backup: nao consegui contar os pacientes da Controle: ' + String(e));
    return -1;
  }
}


// ------------------------------------------------------------
// backupSobDemanda_ — copia sob demanda, guardando as ultimas 5
// ------------------------------------------------------------

/**
 * Copia a Sistema_VMC, a Controle de CADA profissional (ativo ou nao) e
 * cada planilha de paciente (ativa e desativada) para
 * Backups/AAAA-MM-DD/ dentro da pasta clinica-vmc.
 *
 * Escopo sem filtro por decisao do usuario de 30/09: desativar um
 * profissional preserva os dados de proposito (ver desativarProfissional,
 * "mantemos historico"), e o status e o docs/arquitetura.md mandam copiar
 * "cada Controle e cada planilha de paciente", sem qualificador.
 *
 * Roda SOB DEMANDA, pelo involucro rodarBackupAgora, quando o Code
 * indica (mudanca com risco de perda). Nao ha gatilho de backup.
 * Lanca excecao em falha TOTAL e em falha parcial sem e-mail, para o Apps
 * Script avisar o dono.
 */
function backupSobDemanda_() {
  var inicio = new Date();
  var hoje = nomeDaPastaDoDia(inicio);
  var esperados = 0;   // arquivos que este backup DEVIA ter na pasta do dia
  var novos = 0;       // copiados agora
  var jaTinha = 0;     // copiados por execucao anterior de hoje
  var detalhes = [];
  var usados = {};     // nomes de destino tratados nesta execucao

  function contar(res) {
    esperados++;
    if (!res.ok) { detalhes.push(res.erro); return; }
    if (res.novo) novos++; else jaTinha++;
  }

  function falhar(msg) {
    detalhes.push(msg);
    console.error('E3 backup: ' + msg);
  }

  var pastaBackups, pastaDia;
  try {
    pastaBackups = _e3ObterOuCriarPasta_(_e3PastaRaiz_(), 'Backups');
    pastaDia = _e3ObterOuCriarPasta_(pastaBackups, hoje);
  } catch (e) {
    console.error('E3 backup: pasta de destino indisponivel: ' + String(e));
    _e3RegistrarBackup_(inicio, 0, 1, 'pasta de destino: ' + String(e));
    _e3AvisarBackup_(inicio, 0, 0, ['pasta de destino: ' + String(e)], false);
    throw new Error('E3 backup: pasta de destino indisponivel.');
  }

  // 1. Planilha global (sem prefixo: nao pertence a nenhum profissional)
  contar(_e3CopiarPorIdSeFaltar_(SISTEMA_VMC_ID, pastaDia, '', usados));

  // 2. Cada profissional: Controle + planilhas de pacientes
  var profs = [];
  try {
    profs = lerAbaComoObjetos(_abrirPlanilha_(SISTEMA_VMC_ID), ABA_PROFISSIONAIS);
  } catch (e) {
    falhar('aba ' + ABA_PROFISSIONAIS + ': ' + String(e));
  }

  // Lista vazia e ERRO, nao "nada a fazer": lerAbaComoObjetos devolve []
  // sem excecao quando a aba nao existe ou foi renomeada.
  if (profs.length === 0) {
    falhar('aba ' + ABA_PROFISSIONAIS + ' vazia ou inacessivel: nenhum profissional lido');
  }

  for (var i = 0; i < profs.length; i++) {
    var prof = profs[i];
    var idProf = String(prof.profissional_id || '(sem id)');
    var siglaProf = String(prof.sigla || '').trim();

    // O prefixo nunca fica vazio: sem sigla, cai no profissional_id, senao
    // duas Controles colidiriam no mesmo nome de destino.
    var prefixo = siglaProf || idProf;
    if (!siglaProf) {
      falhar(idProf + ': sem sigla na aba ' + ABA_PROFISSIONAIS +
             ' (prefixo do backup caiu no profissional_id)');
    }

    if (!prof.pasta_drive_id) {
      falhar(idProf + ': sem pasta_drive_id — Controle e pacientes NAO entraram no backup');
      continue;
    }

    var pastaProf;
    try {
      pastaProf = DriveApp.getFolderById(prof.pasta_drive_id);
    } catch (e) {
      falhar(idProf + ' pasta inacessivel (Controle e pacientes NAO entraram): ' + String(e));
      continue;
    }

    // 2a. Controle do profissional
    var controle = null;
    try {
      var iterCtrl = pastaProf.getFilesByName(NOME_CONTROLE);
      if (iterCtrl.hasNext()) {
        var arqCtrl = iterCtrl.next();
        contar(_e3CopiarSeFaltar_(arqCtrl, pastaDia,
                                  nomeDoBackup(prefixo, NOME_CONTROLE), usados));
        try {
          controle = _abrirPlanilha_(arqCtrl.getId());
        } catch (e) {
          falhar(idProf + ': Controle copiada mas ilegivel para conferencia: ' + String(e));
        }
      } else {
        esperados++;
        falhar(idProf + ': Controle nao encontrada na pasta do profissional');
      }
    } catch (e) {
      esperados++;
      falhar(idProf + ' Controle: ' + String(e));
    }

    // 2b. Pacientes/ (obrigatoria) e Pacientes_Desativados/ (opcional)
    var encontradas = 0;
    for (var s = 0; s < E3_SUBPASTAS_PACIENTE.length; s++) {
      var sub = E3_SUBPASTAS_PACIENTE[s];
      try {
        var iterSub = pastaProf.getFoldersByName(sub.nome);
        var achouPasta = false;
        // Pode existir mais de uma pasta com o mesmo nome: varre TODAS.
        while (iterSub.hasNext()) {
          achouPasta = true;
          var arquivos = iterSub.next().getFiles();
          while (arquivos.hasNext()) {
            var arq = arquivos.next();
            contar(_e3CopiarSeFaltar_(arq, pastaDia,
                                      nomeDoBackup(prefixo, arq.getName()), usados));
            encontradas++;
          }
        }
        if (!achouPasta && sub.obrigatoria) {
          falhar(idProf + ': subpasta ' + sub.nome + ' nao encontrada — nenhuma planilha de ' +
                 'paciente deste profissional entrou no backup');
        }
      } catch (e) {
        falhar(idProf + ' ' + sub.nome + ' (enumeracao interrompida): ' + String(e));
      }
    }

    // 2c. Conferencia contra a expectativa INDEPENDENTE da Controle
    if (controle) {
      var declarados = _e3PacientesDeclarados_(controle);
      if (declarados < 0) {
        falhar(idProf + ': nao foi possivel conferir o numero de pacientes da Controle');
      } else if (encontradas < declarados) {
        esperados += (declarados - encontradas);
        falhar(idProf + ': a Controle declara ' + declarados + ' paciente(s) e o Drive tem ' +
               encontradas + ' planilha(s) — ' + (declarados - encontradas) + ' fonte(s) ausente(s)');
      }
    }
  }

  var presentes = novos + jaTinha;
  var faltam = esperados - presentes;
  // Toda falta deveria nascer de um erro ja registrado. Falta sem erro e bug
  // de contagem deste proprio bloco: essa sim e erro novo.
  if (faltam > 0 && detalhes.length === 0) {
    falhar('contagem inconsistente: faltam ' + faltam + ' de ' + esperados +
           ' arquivo(s) sem erro registrado');
  }

  // 3. Retencao: SO com o backup do dia fechado limpo. Na duvida guarda.
  var limpoAntes = detalhes.length === 0 && presentes > 0 && faltam === 0;
  var retencaoRodou = false;
  if (limpoAntes) {
    retencaoRodou = true;
    try {
      var nomes = [];
      var iterTodas = pastaBackups.getFolders();
      while (iterTodas.hasNext()) nomes.push(iterTodas.next().getName());
      var velhas = pastasExcedentes(nomes, E3_RETENCAO_COPIAS);
      for (var v = 0; v < velhas.length; v++) {
        try {
          var iterVelha = pastaBackups.getFoldersByName(velhas[v]);
          while (iterVelha.hasNext()) iterVelha.next().setTrashed(true);
        } catch (e) {
          falhar('retencao ' + velhas[v] + ': ' + String(e));
        }
      }
      if (velhas.length) Logger.log('E3 backup: ' + velhas.length + ' pasta(s) antiga(s) na lixeira.');
    } catch (e) {
      falhar('retencao: ' + String(e));
    }
  } else {
    Logger.log('E3 backup: retencao NAO rodou (backup do dia com pendencia). Nada foi apagado.');
  }

  // 4. Texto e veredito montados DEPOIS da retencao, para nao mentirem
  var detalheTexto = detalheDoBackup(faltam, esperados, detalhes);
  var limpo = detalhes.length === 0 && presentes > 0 && faltam === 0;

  _e3RegistrarBackup_(inicio, presentes, detalhes.length, detalheTexto);
  Logger.log('E3 backup: ' + presentes + '/' + esperados + ' arquivo(s) em Backups/' + hoje +
             '/ (' + novos + ' novo(s), ' + jaTinha + ' de execucao anterior de hoje), ' +
             detalhes.length + ' erro(s); retencao ' + (retencaoRodou ? 'rodou' : 'NAO rodou') + '.');

  // 5. Avisar o dono: e-mail em qualquer falha, excecao quando o aviso nao
  //    basta (falha total) ou quando o proprio aviso nao saiu
  var emailEnviado = false;
  if (detalhes.length > 0) {
    emailEnviado = _e3AvisarBackup_(inicio, esperados, presentes, detalhes, retencaoRodou);
  }
  if (presentes === 0) {
    throw new Error('E3 backup: nenhum arquivo copiado (0 de ' + esperados + '). ' +
                    'Veja a aba Backups e o Cloud Logging.');
  }
  if (detalhes.length > 0 && !emailEnviado) {
    throw new Error('E3 backup: ' + detalhes.length + ' erro(s) e o aviso por e-mail nao saiu. ' +
                    'Veja a aba Backups e o Cloud Logging.');
  }

  return {
    ok: limpo,
    esperados: esperados,
    presentes: presentes,
    novos: novos,
    ja_existiam: jaTinha,
    erros: detalhes.length,
    retencao_rodou: retencaoRodou,
    pasta: hoje
  };
}


// ============================================================
// Pacote 19.2.1 — PLANO DE LEMBRETES (22/11/2026)
// ============================================================
// Aba `Lembretes` na Controle do profissional: uma linha por item do plano de um paciente
// (o que lembrar, recorrencia, periodo, hora). Nasce no primeiro item gravado, so pelo
// cabecalho. Toda celula e TEXTO LITERAL (apostrofo) e a leitura e por getDisplayValues:
// o Sheets nao retipa data nem hora (licao 105), e a regra de datas trabalha so com
// 'AAAA-MM-DD' e 'HH:mm' — nenhum Date de celula, nenhum fuso no caminho.
//   id                  identificador do item (vem do cliente; salvar de novo o mesmo id = editar)
//   sigla               paciente
//   tipo                auto | escala | outro
//   instrumento         codigo da escala (chave de ESCALAS_MENU), so em `escala`
//   texto               texto livre, so em `outro` (19.2.2: aparece no Inicio do paciente, no e-mail e no WhatsApp)
//   recorrencia         agora | uma_vez | recorrente
//   periodicidade       diaria | semanal | quinzenal | mensal | dias_semana (so em `recorrente`)
//   dias_semana         '1,3,5' (0 = domingo), so em `dias_semana`
//   data_inicio / data_termino / hora   'AAAA-MM-DD' / 'AAAA-MM-DD' ou vazio / 'HH:mm'
//   ativo / encerrado_em                'Sim' | 'Nao' / 'AAAA-MM-DD HH:mm'
//   criado_em / criado_por / atualizado_em
//   ultimo_email_em     'AAAA-MM-DD HH:mm' do ultimo e-mail (um por item por dia)
//   ultimo_cumprido_em  'AAAA-MM-DD' do ultimo dia em que o paciente respondeu
// WhatsApp e e-mail valem sempre (decisao do usuario): nao ha coluna de canal.

var ABA_LEMBRETES = 'Lembretes';
var COLUNAS_LEMBRETES = ['id', 'sigla', 'tipo', 'instrumento', 'texto', 'recorrencia', 'periodicidade', 'dias_semana',
  'data_inicio', 'data_termino', 'hora', 'ativo', 'encerrado_em', 'criado_em', 'criado_por', 'atualizado_em',
  'ultimo_email_em', 'ultimo_cumprido_em'];
var LEMBRETES_DIA_MAX = 60;      // e-mails de lembrete por dia (cota propria; convites 20 e redefinicoes 10 ficam a parte)
var LEMBRETE_ATRASO_DIAS = 7;    // item de data unica ou ja terminado sai de "Atrasados" depois disto
var LEMBRETE_TEXTO_MAX = 200;

// Textos do e-mail de lembrete, aprovados pelo usuario em 22/11/2026.
// 19.2.2 (decisao do usuario, 22/11/2026): a SIGLA da escala (a chave do catalogo: PHQ-9, URICA-A...) e o texto do
// "Outro" entram no paragrafo do e-mail (EMAIL_LEMBRETE_COM_DETALHE). Assunto, titulo e previa continuam genericos
// (o assunto aparece na tela bloqueada). Sem sigla conhecida ou sem texto, vale o paragrafo generico de EMAIL_LEMBRETE.
var EMAIL_LEMBRETE = {
  auto: { assunto: 'Hora do seu registro no COGNIATIVO', titulo: 'Hora do seu registro', previa: 'Quando puder, registre como foi o seu dia.',
    paragrafo: 'Este é o lembrete que combinamos para hoje. Quando puder, registre como foi o seu dia: leva poucos minutos e ajuda a próxima sessão.',
    botao: 'Fazer o registro de hoje' },
  escala: { assunto: 'Há uma escala para você no COGNIATIVO', titulo: 'Uma escala para responder', previa: 'Quando puder, responda à escala combinada.',
    paragrafo: 'Este é o lembrete que combinamos para hoje. Há uma escala aberta para você em Escalas e Inventários; quando puder, responda.',
    botao: 'Abrir o COGNIATIVO' },
  outro: { assunto: 'Lembrete do COGNIATIVO', titulo: 'Lembrete de hoje', previa: 'Há um combinado para hoje.',
    paragrafo: 'Este é o lembrete que combinamos para hoje. O que foi combinado está no Início do COGNIATIVO.',
    botao: 'Abrir o COGNIATIVO' }
};
// [antes do detalhe, depois do detalhe]
var EMAIL_LEMBRETE_COM_DETALHE = {
  escala: ['Este é o lembrete que combinamos para hoje. Há uma escala aberta para você: ', '. Quando puder, responda.'],
  outro: ['Este é o lembrete que combinamos. Combinado de hoje: ', '']
};
var EMAIL_LEMBRETE_SOB_BOTAO = 'Abre o COGNIATIVO; se a sessão tiver expirado, é só entrar de novo.';
var EMAIL_LEMBRETE_AVISO = 'Este lembrete faz parte do plano combinado nas sessões. Para mudar o horário ou parar de receber, é só avisar.';

// ---------- regra de datas (funcoes puras: recebem a data, nunca leem o relogio) ----------

/** 'AAAA-MM-DD' -> numero do dia (dias desde 01/01/1970); null se nao for uma data que existe. */
function _lemDia_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso === undefined || iso === null ? '' : iso).trim());
  if (!m) return null;
  var ano = +m[1], mes = +m[2], dia = +m[3];
  var n = Math.round(Date.UTC(ano, mes - 1, dia) / 86400000);
  var d = new Date(n * 86400000);
  return (d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia) ? n : null;
}

/** Numero do dia -> 'AAAA-MM-DD'. */
function _lemIso_(n) {
  var d = new Date(n * 86400000);
  var p = function (x) { return ('0' + x).slice(-2); };
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

/** Dia da semana do numero do dia: 0 = domingo (01/01/1970 foi quinta-feira). */
function _lemDiaDaSemana_(n) { return (((n + 4) % 7) + 7) % 7; }

/** '1, 3,5' -> [1, 3, 5] (so 0..6, sem repeticao, em ordem). */
function _lemDiasSemana_(v) {
  var visto = {}, lista = [];
  String(v === undefined || v === null ? '' : v).split(',').forEach(function (x) {
    var t = String(x).trim();
    if (!/^[0-6]$/.test(t) || visto[t]) return;
    visto[t] = true; lista.push(parseInt(t, 10));
  });
  return lista.sort();
}

/** 'H:mm' ou 'HH:mm' -> 'HH:mm'; '' se nao for hora. */
function _lemHora_(v) {
  var m = /^(\d{1,2}):(\d{2})/.exec(String(v === undefined || v === null ? '' : v).trim());
  if (!m || +m[1] > 23 || +m[2] > 59) return '';
  return ('0' + m[1]).slice(-2) + ':' + m[2];
}

function _lemAtivo_(item) { return String(item.ativo === undefined || item.ativo === null ? '' : item.ativo).trim().toLowerCase() !== 'nao'; }

/**
 * O item esta previsto para o dia `iso`? Olha so inicio, termino (inclusive) e periodicidade;
 * quem chama decide o que fazer com item encerrado.
 *   agora / uma_vez  so na data de inicio
 *   diaria           todo dia
 *   semanal          a cada 7 dias a partir do inicio (mesmo dia da semana)
 *   quinzenal        a cada 14 dias a partir do inicio
 *   mensal           mesmo dia do mes do inicio; em mes mais curto, o ultimo dia do mes
 *   dias_semana      nos dias da semana escolhidos
 */
function _lembreteOcorre_(item, iso) {
  var d = _lemDia_(iso), ini = _lemDia_(item.data_inicio);
  if (d === null || ini === null || d < ini) return false;
  if (item.recorrencia !== 'recorrente') return d === ini;
  var fim = _lemDia_(item.data_termino);
  if (fim !== null && d > fim) return false;
  if (item.periodicidade === 'diaria') return true;
  if (item.periodicidade === 'semanal') return (d - ini) % 7 === 0;
  if (item.periodicidade === 'quinzenal') return (d - ini) % 14 === 0;
  if (item.periodicidade === 'mensal') {
    var alvo = new Date(ini * 86400000).getUTCDate();
    var dia = new Date(d * 86400000);
    var ultimoDoMes = new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth() + 1, 0)).getUTCDate();
    return dia.getUTCDate() === Math.min(alvo, ultimoDoMes);
  }
  if (item.periodicidade === 'dias_semana') return _lemDiasSemana_(item.dias_semana).indexOf(_lemDiaDaSemana_(d)) !== -1;
  return false;
}

/** Ultima data prevista ANTES de `hojeIso` ('' se nao houve nos ultimos 31 dias — o maior intervalo e o mensal). */
function _lembreteUltimaAntes_(item, hojeIso) {
  var h = _lemDia_(hojeIso);
  if (h === null) return '';
  for (var k = 1; k <= 31; k++) {
    var iso = _lemIso_(h - k);
    if (_lembreteOcorre_(item, iso)) return iso;
  }
  return '';
}

/**
 * Situacao do item no dia `hojeIso`:
 *   hoje             previsto para hoje
 *   atrasado         '' ou a ultima data prevista antes de hoje que ficou sem resposta
 *   respondido_hoje  o paciente ja respondeu hoje
 *   email_hoje       '' ou 'HH:mm' do e-mail de hoje
 * "Outro" nunca fica atrasado (o sistema nao sabe se foi feito). Item de data unica ou ja
 * terminado sai dos atrasados depois de LEMBRETE_ATRASO_DIAS. Item encerrado nao aparece.
 */
function _lembreteSituacao_(item, hojeIso) {
  var s = { hoje: false, atrasado: '', respondido_hoje: false, email_hoje: '' };
  var h = _lemDia_(hojeIso);
  if (h === null || !_lemAtivo_(item)) return s;
  var cumprido = _lemDia_(String(item.ultimo_cumprido_em || '').slice(0, 10));
  s.hoje = _lembreteOcorre_(item, hojeIso);
  s.respondido_hoje = s.hoje && cumprido !== null && cumprido >= h;
  var enviado = String(item.ultimo_email_em || '');
  if (s.hoje && enviado.slice(0, 10) === hojeIso) s.email_hoje = _lemHora_(enviado.slice(11));
  if (item.tipo === 'outro') return s;
  var ultima = _lembreteUltimaAntes_(item, hojeIso);
  if (!ultima) return s;
  var u = _lemDia_(ultima);
  if (cumprido !== null && cumprido >= u) return s;
  var fim = _lemDia_(item.data_termino);
  var semProxima = item.recorrencia !== 'recorrente' || (fim !== null && fim < h);
  if (semProxima && h - u > LEMBRETE_ATRASO_DIAS) return s;
  s.atrasado = ultima;
  return s;
}

/** O e-mail do item vence agora? Previsto para hoje, hora ja passou, nao enviado hoje, paciente ainda nao respondeu hoje. */
function _lembreteEmailVence_(item, hojeIso, horaAgora) {
  if (!_lemAtivo_(item) || !_lembreteOcorre_(item, hojeIso)) return false;
  var hora = _lemHora_(item.hora);
  if (!hora || hora > horaAgora) return false;
  if (String(item.ultimo_email_em || '').slice(0, 10) === hojeIso) return false;
  if (String(item.ultimo_cumprido_em || '').slice(0, 10) === hojeIso) return false;
  return true;
}

/** O item ainda interessa a tela do plano? Ativo com data por vir (ou ha ate 7 dias); encerrado ha ate 7 dias. */
function _lembreteVigente_(item, hojeIso) {
  var h = _lemDia_(hojeIso);
  if (h === null) return true;
  var ref;
  if (!_lemAtivo_(item)) ref = _lemDia_(String(item.encerrado_em || '').slice(0, 10));
  else if (item.recorrencia !== 'recorrente') ref = _lemDia_(item.data_inicio);
  else { ref = _lemDia_(item.data_termino); if (ref === null) return true; }
  return ref !== null && h - ref <= LEMBRETE_ATRASO_DIAS;
}

/**
 * Confere o item que veio da tela e devolve so as colunas do plano. `comPlano` = false no
 * "lembrar agora" (so o que lembrar). As mensagens sao as aprovadas para a tela.
 */
function _lembreteValidar_(dados, comPlano) {
  var d = dados && typeof dados === 'object' ? dados : {};
  var id = String(d.id === undefined || d.id === null ? '' : d.id).trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return { ok: false, erro: 'Parametros incompletos' };
  var tipo = String(d.tipo || '').trim();
  var campos = { tipo: tipo, instrumento: '', texto: '', recorrencia: '', periodicidade: '', dias_semana: '', data_inicio: '', data_termino: '', hora: '' };
  if (tipo === 'escala') {
    campos.instrumento = String(d.instrumento || '').trim();
    if (!_idDaEscala_(campos.instrumento)) return { ok: false, erro: 'Escolha o que lembrar.' };
  } else if (tipo === 'outro') {
    campos.texto = String(d.texto === undefined || d.texto === null ? '' : d.texto).replace(/\s+/g, ' ').trim().slice(0, LEMBRETE_TEXTO_MAX);
    if (!campos.texto) return { ok: false, erro: 'Escreva o que foi combinado.' };
  } else if (tipo !== 'auto') {
    return { ok: false, erro: 'Escolha o que lembrar.' };
  }
  if (!comPlano) return { ok: true, id: id, campos: campos };

  campos.recorrencia = d.recorrencia === 'recorrente' ? 'recorrente' : 'uma_vez';
  campos.data_inicio = String(d.data_inicio || '').trim();
  if (_lemDia_(campos.data_inicio) === null) return { ok: false, erro: 'Escolha a data.' };
  campos.hora = _lemHora_(d.hora);
  if (!campos.hora) return { ok: false, erro: 'Escolha o horário.' };
  if (campos.recorrencia === 'recorrente') {
    campos.periodicidade = String(d.periodicidade || '').trim();
    if (['diaria', 'semanal', 'quinzenal', 'mensal', 'dias_semana'].indexOf(campos.periodicidade) === -1) return { ok: false, erro: 'Parametros incompletos' };
    if (campos.periodicidade === 'dias_semana') {
      campos.dias_semana = _lemDiasSemana_(Array.isArray(d.dias_semana) ? d.dias_semana.join(',') : d.dias_semana).join(',');
      if (!campos.dias_semana) return { ok: false, erro: 'Escolha pelo menos um dia da semana.' };
    }
    campos.data_termino = String(d.data_termino || '').trim();
    if (campos.data_termino) {
      var fim = _lemDia_(campos.data_termino);
      if (fim === null || fim < _lemDia_(campos.data_inicio)) return { ok: false, erro: 'A data de término não pode ser antes do início.' };
    }
  }
  return { ok: true, id: id, campos: campos };
}

// ---------- aba, leitura e gravacao ----------

/** Data e hora de agora no fuso do consultorio: { data: 'AAAA-MM-DD', hora: 'HH:mm', carimbo: 'AAAA-MM-DD HH:mm' }. */
function _lemAgora_(quando) {
  var d = quando instanceof Date ? quando : new Date();
  var data = Utilities.formatDate(d, 'America/Sao_Paulo', 'yyyy-MM-dd');
  var hora = Utilities.formatDate(d, 'America/Sao_Paulo', 'HH:mm');
  return { data: data, hora: hora, carimbo: data + ' ' + hora };
}

/** Aba Lembretes da Controle; com `criar`, nasce (e ganha as colunas) no primeiro uso. Leitura nunca cria. */
function _lembretesAba_(controle, criar) {
  if (!controle) return null;
  var aba = controle.getSheetByName(ABA_LEMBRETES);
  if (!aba && criar) aba = controle.insertSheet(ABA_LEMBRETES);
  if (aba && criar) _garantirColunas_(aba, COLUNAS_LEMBRETES);
  return aba;
}

/** Itens da aba como objetos de texto (o que a celula mostra), com `__linha`. */
function _lembretesLer_(aba) {
  if (!aba || aba.getLastRow() < 2) return [];
  var dados = aba.getDataRange().getDisplayValues();
  var cab = dados[0], itens = [];
  for (var i = 1; i < dados.length; i++) {
    var o = { __linha: i + 1 };
    for (var j = 0; j < cab.length; j++) o[cab[j]] = String(dados[i][j] === undefined || dados[i][j] === null ? '' : dados[i][j]).trim();
    if (o.id) itens.push(o);
  }
  return itens;
}

/** Texto literal: toda celula nao vazia vai com apostrofo (nem data, nem hora, nem formula). */
function _lemCelula_(v) {
  var t = String(v === undefined || v === null ? '' : v);
  return t === '' ? '' : "'" + t;
}

/** Grava `campos` pelo nome do cabecalho: linha nova (`linha` = 0) ou so as colunas dadas de uma linha que existe. */
function _lembreteGravar_(aba, linha, campos) {
  var header = _garantirColunas_(aba, COLUNAS_LEMBRETES);
  if (!linha) {
    aba.appendRow(header.map(function (col) { return campos[col] !== undefined ? _lemCelula_(campos[col]) : ''; }));
    return;
  }
  for (var col in campos) {
    var i = header.indexOf(col);
    if (i >= 0) aba.getRange(linha, i + 1).setValue(_lemCelula_(campos[col]));
  }
}

/** Item como a tela do profissional o recebe. */
function _lembreteParaCliente_(item) {
  return { id: item.id, tipo: item.tipo, instrumento: item.instrumento, texto: item.texto,
    recorrencia: item.recorrencia, periodicidade: item.periodicidade, dias_semana: _lemDiasSemana_(item.dias_semana),
    data_inicio: item.data_inicio, data_termino: item.data_termino, hora: _lemHora_(item.hora),
    ativo: _lemAtivo_(item) ? 'Sim' : 'Nao', encerrado_em: item.encerrado_em, ultimo_email_em: item.ultimo_email_em };
}

/** Plano de um paciente para a tela do profissional: os itens vigentes, ativos primeiro, por hora. */
function _lembretesDoPaciente_(controle, sigla, hojeIso) {
  var alvo = _siglaChave_(sigla);
  return _lembretesLer_(_lembretesAba_(controle, false))
    .filter(function (i) { return _siglaChave_(i.sigla) === alvo && _lembreteVigente_(i, hojeIso); })
    .map(_lembreteParaCliente_)
    .sort(function (a, b) {
      if (a.ativo !== b.ativo) return a.ativo === 'Sim' ? -1 : 1;
      return a.hora < b.hora ? -1 : (a.hora > b.hora ? 1 : 0);
    });
}

/** Lembretes de hoje e atrasados de todos os pacientes da Controle, por sigla: { SIGLA: [ {...} ] }. */
function _lembretesDoInicio_(controle, hojeIso) {
  var mapa = {};
  _lembretesLer_(_lembretesAba_(controle, false)).forEach(function (item) {
    var s = _lembreteSituacao_(item, hojeIso);
    if (!s.hoje && !s.atrasado) return;
    var chave = _siglaChave_(item.sigla);
    (mapa[chave] = mapa[chave] || []).push({ id: item.id, tipo: item.tipo, instrumento: item.instrumento, texto: item.texto,
      hora: _lemHora_(item.hora), hoje: s.hoje, atrasado: s.atrasado, respondido_hoje: s.respondido_hoje, email_hoje: s.email_hoje });
  });
  return mapa;
}

/** Profissional do cracha + paciente dele + a Controle (sem abrir a planilha do paciente). */
function _lembreteAlvo_(s, siglaPaciente) {
  var auth = _authProfissional_(s);
  if (!auth.ok) return auth;
  var profId = auth.profissional.profissional_id;
  if (!siglaPaciente) return { ok: false, erro: 'Sigla do paciente e obrigatoria' };
  var paciente = buscarPaciente(siglaPaciente);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };
  if (paciente.__profissional_id !== profId) return { ok: false, erro: 'Este paciente nao pertence a voce' };
  var controle = abrirControleDoProfissional(profId);
  if (!controle) return { ok: false, erro: 'Controle do profissional não encontrada.' };
  return { ok: true, profissionalId: profId, paciente: paciente, controle: controle, sigla: String(paciente.sigla).trim(), nome: auth.profissional.nome_completo };
}

/**
 * Fecha a resposta de uma acao que gravou: `lembretes` = o plano do paciente (tela do paciente aberto) e
 * `inicio` = os itens de hoje e atrasados dele + o contato, como vao na lista do profissional — a tela
 * atualiza os blocos do Inicio sem nova chamada.
 */
function _lembreteResposta_(alvo, resp, hojeIso) {
  resp.lembretes = _lembretesDoPaciente_(alvo.controle, alvo.sigla, hojeIso);
  var itens = _estaAtivo_(alvo.paciente.ativo) ? (_lembretesDoInicio_(alvo.controle, hojeIso)[_siglaChave_(alvo.sigla)] || []) : [];
  resp.inicio = { lembretes: itens, telefone: normalizarTelefone(alvo.paciente.telefone), tem_email: !!normalizarEmail(alvo.paciente.email) };
  return resp;
}

/** Lembrete de escala abre a escala para o paciente (o lembrete nao pode apontar para um cadeado). Acrescenta o resultado em `resp`. */
function _lembreteAbrirEscala_(alvo, campos, resp) {
  if (campos.tipo !== 'escala') return;
  var estava = _escalasLiberadasLista_(alvo.paciente.escalas_liberadas).indexOf(_idDaEscala_(campos.instrumento)) !== -1;
  resp.escalas_liberadas = _abrirEscalaParaPaciente_(alvo.profissionalId, alvo.sigla, campos.instrumento);
  resp.escala_aberta = !estava;
}

// ---------- acoes do profissional ----------

/** Cria ou edita um item do plano (o `id` vem da tela: salvar de novo o mesmo id regrava as colunas do plano, nunca duplica). */
function profSalvarLembrete(s, siglaPaciente, dados) {
  var alvo = _lembreteAlvo_(s, siglaPaciente);
  if (!alvo.ok) return alvo;
  var v = _lembreteValidar_(dados, true);
  if (!v.ok) return v;
  var aba = _lembretesAba_(alvo.controle, true);
  var agora = _lemAgora_();
  var existente = _lembretesLer_(aba).filter(function (i) { return i.id === v.id; })[0];
  var campos = {};
  for (var k in v.campos) campos[k] = v.campos[k];
  campos.atualizado_em = agora.carimbo;
  if (existente) {
    if (_siglaChave_(existente.sigla) !== _siglaChave_(alvo.sigla) || !_lemAtivo_(existente)) return { ok: false, erro: 'Lembrete não encontrado.' };
    _lembreteGravar_(aba, existente.__linha, campos);
  } else {
    campos.id = v.id; campos.sigla = alvo.sigla; campos.ativo = 'Sim';
    campos.criado_em = agora.carimbo; campos.criado_por = String(alvo.nome || '');
    _lembreteGravar_(aba, 0, campos);
  }
  var resp = { ok: true };
  _lembreteAbrirEscala_(alvo, v.campos, resp);
  return _lembreteResposta_(alvo, resp, agora.data);
}

/** Encerra um item: o paciente deixa de receber; a linha fica (o que ja foi enviado continua registrado). */
function profEncerrarLembrete(s, siglaPaciente, id) {
  var alvo = _lembreteAlvo_(s, siglaPaciente);
  if (!alvo.ok) return alvo;
  var aba = _lembretesAba_(alvo.controle, false);
  var agora = _lemAgora_();
  var item = _lembretesLer_(aba).filter(function (i) { return i.id === String(id || '').trim(); })[0];
  if (!item || _siglaChave_(item.sigla) !== _siglaChave_(alvo.sigla)) return { ok: false, erro: 'Lembrete não encontrado.' };
  if (_lemAtivo_(item)) _lembreteGravar_(aba, item.__linha, { ativo: 'Nao', encerrado_em: agora.carimbo, atualizado_em: agora.carimbo });
  return _lembreteResposta_(alvo, { ok: true }, agora.data);
}

/**
 * "Lembrar agora": grava o item (data de hoje, hora de agora) e manda o e-mail na hora.
 * Saida: { ok, email_enviado, motivo ('' | sem_email | inativo | cota | falha), lembretes, inicio }.
 * Repetir o mesmo id nao manda o e-mail de novo.
 */
function profLembrarAgora(s, siglaPaciente, dados) {
  var alvo = _lembreteAlvo_(s, siglaPaciente);
  if (!alvo.ok) return alvo;
  if (dados && dados.enviar_id) return _lembreteEnviarAgora_(alvo, dados.enviar_id);
  var v = _lembreteValidar_(dados, false);
  if (!v.ok) return v;
  var aba = _lembretesAba_(alvo.controle, true);
  var agora = _lemAgora_();
  var existente = _lembretesLer_(aba).filter(function (i) { return i.id === v.id; })[0];
  if (existente) {
    if (_siglaChave_(existente.sigla) !== _siglaChave_(alvo.sigla)) return { ok: false, erro: 'Lembrete não encontrado.' };
    return _lembreteResposta_(alvo, { ok: true, duplicado: true, email_enviado: !!existente.ultimo_email_em, motivo: existente.ultimo_email_em ? '' : 'falha' }, agora.data);
  }
  var campos = {};
  for (var k in v.campos) campos[k] = v.campos[k];
  campos.id = v.id; campos.sigla = alvo.sigla; campos.ativo = 'Sim';
  campos.recorrencia = 'agora'; campos.data_inicio = agora.data; campos.hora = agora.hora;
  campos.criado_em = agora.carimbo; campos.criado_por = String(alvo.nome || ''); campos.atualizado_em = agora.carimbo;

  var motivo = _lembreteMandarEmail_(alvo, campos);
  if (!motivo) campos.ultimo_email_em = agora.carimbo;
  _lembreteGravar_(aba, 0, campos);

  var resp = { ok: true, email_enviado: !motivo, motivo: motivo };
  _lembreteAbrirEscala_(alvo, v.campos, resp);
  return _lembreteResposta_(alvo, resp, agora.data);
}

/** Manda o e-mail de um item ao paciente do `alvo`. Devolve o motivo de nao ter ido ('' = enviado | inativo | sem_email | sem_conexao | cota | falha). */
function _lembreteMandarEmail_(alvo, item) {
  var email = normalizarEmail(alvo.paciente.email);
  if (!_estaAtivo_(alvo.paciente.ativo)) return 'inativo';
  if (!email) return 'sem_email';
  if (!_emailPermitido_(alvo.profissionalId)) return 'sem_conexao'; // 14.10
  if (!_reservarEmail_('lembretes')) return 'cota';
  if (!_enviarEmail_(email, montarEmailLembrete(item.tipo, _lemPrimeiroNome_(alvo.paciente), _assinaturaDoProfissional_(alvo.profissionalId), _lembreteDetalhe_(item), _lembreteDestino_(item)), alvo.profissionalId)) return 'falha';
  return '';
}

/**
 * 19.2.3 — botao "E-mail" de um item do plano (`dados.enviar_id` em profLembrarAgora): manda agora o e-mail de um
 * item ativo que ja existe; nenhuma linha nova. A marca `ultimo_email_em` fica com a hora deste envio, entao o
 * gatilho nao manda o mesmo item de novo no mesmo dia. Saida igual a do "Lembrar agora".
 */
function _lembreteEnviarAgora_(alvo, id) {
  var aba = _lembretesAba_(alvo.controle, false);
  var agora = _lemAgora_();
  var item = _lembretesLer_(aba).filter(function (i) { return i.id === String(id || '').trim(); })[0];
  if (!item || _siglaChave_(item.sigla) !== _siglaChave_(alvo.sigla) || !_lemAtivo_(item)) return { ok: false, erro: 'Lembrete não encontrado.' };
  var motivo = _lembreteMandarEmail_(alvo, item);
  if (!motivo) _lembreteGravar_(aba, item.__linha, { ultimo_email_em: agora.carimbo });
  return _lembreteResposta_(alvo, { ok: true, email_enviado: !motivo, motivo: motivo }, agora.data);
}

// ---------- acao do paciente (so leitura) ----------

/**
 * O que esta combinado para os proximos 7 dias (hoje + 6): uma linha por item ativo, com a
 * proxima data prevista. Item ja respondido hoje passa para a data seguinte.
 * Saida: { ok, hoje, lembretes: [ { data, hora, tipo, instrumento, texto, recorrencia, periodicidade, dias_semana } ] }.
 */
function lerMeusLembretes(sigla) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };
  var controle = abrirControleDoProfissional(paciente.__profissional_id);
  var hoje = _lemAgora_().data, h = _lemDia_(hoje), alvo = _siglaChave_(sigla);
  var lista = [];
  _lembretesLer_(_lembretesAba_(controle, false)).forEach(function (item) {
    if (_siglaChave_(item.sigla) !== alvo || !_lemAtivo_(item)) return;
    var feitoHoje = String(item.ultimo_cumprido_em || '').slice(0, 10) === hoje && item.tipo !== 'outro';
    for (var k = feitoHoje ? 1 : 0; k < 7; k++) {
      var iso = _lemIso_(h + k);
      if (!_lembreteOcorre_(item, iso)) continue;
      lista.push({ data: iso, hora: _lemHora_(item.hora), tipo: item.tipo, instrumento: item.instrumento, texto: item.texto,
        recorrencia: item.recorrencia, periodicidade: item.periodicidade, dias_semana: _lemDiasSemana_(item.dias_semana) });
      break;
    }
  });
  lista.sort(function (a, b) {
    var x = a.data + ' ' + a.hora, y = b.data + ' ' + b.hora;
    return x < y ? -1 : (x > y ? 1 : 0);
  });
  // 14.3: a proxima sessao agendada vai junto (faixa do Inicio do paciente, sem chamada nova)
  var proxima = null;
  try { proxima = _ageProxima_(controle, sigla, _lemAgora_()); } catch (erroSes) { console.error('lerMeusLembretes: proxima sessao nao foi junto: ' + String(erroSes && erroSes.message || erroSes).slice(0, 120)); }
  return { ok: true, hoje: hoje, lembretes: lista, proxima_sessao: proxima };
}

// ---------- o paciente respondeu ----------

/**
 * Marca como respondidos hoje os itens ativos do paciente para aquele instrumento
 * (`tipo` = 'auto' ou 'escala'; em escala, `instrumento` = codigo). Chamada pela gravacao
 * do registro completo e da escala, na mesma trava. Nunca derruba a gravacao que a chamou.
 */
function _lembretesCumprir_(profissionalId, sigla, tipo, instrumento) {
  try {
    var aba = _lembretesAba_(abrirControleDoProfissional(profissionalId), false);
    if (!aba) return;
    var hoje = _lemAgora_().data, alvo = _siglaChave_(sigla), instr = String(instrumento || '').trim();
    _lembretesLer_(aba).forEach(function (item) {
      if (_siglaChave_(item.sigla) !== alvo || item.tipo !== tipo || !_lemAtivo_(item)) return;
      if (tipo === 'escala' && item.instrumento !== instr) return;
      if (item.ultimo_cumprido_em === hoje) return;
      _lembreteGravar_(aba, item.__linha, { ultimo_cumprido_em: hoje });
    });
  } catch (e) {
    console.error('lembretes: nao marquei como respondido: ' + String(e && e.message || e).slice(0, 160));
  }
}

/** Registro completo (Negativo ou Positivo)? A checagem de humor sozinha nao conta (a regra do chip de Meus Registros). */
function _registroCompleto_(dados) {
  var sim = function (v) { return String(v === undefined || v === null ? '' : v).trim().toLowerCase() === 'sim'; };
  return !!dados && (sim(dados.neg_preenchido) || sim(dados.pos_preenchido));
}

/** Paciente excluido: os itens dele saem da aba (a sigla pode voltar a ser usada por outro paciente). */
function _lembretesApagarDoPaciente_(controle, sigla) {
  var aba = _lembretesAba_(controle, false);
  if (!aba) return;
  var alvo = _siglaChave_(sigla);
  _lembretesLer_(aba).reverse().forEach(function (item) {
    if (_siglaChave_(item.sigla) === alvo) aba.deleteRow(item.__linha);
  });
}

// ---------- e-mail ----------

/** Primeiro nome do paciente: o da anamnese (ind_nome) ou, sem ela, o do cadastro. */
function _lemPrimeiroNome_(paciente) {
  var nome = String((paciente && (paciente.ind_nome || paciente.nome)) || '').trim();
  return nome ? nome.split(/\s+/)[0] : '';
}

/** 19.2.2: o que o lembrete nomeia na mensagem — a sigla da escala (so se for do catalogo) ou o texto do "Outro"; '' = frase generica. */
function _lembreteDetalhe_(item) {
  if (!item) return '';
  if (item.tipo === 'escala') return _idDaEscala_(item.instrumento) ? String(item.instrumento).trim() : '';
  if (item.tipo === 'outro') return String(item.texto === undefined || item.texto === null ? '' : item.texto).trim();
  return '';
}

/**
 * 19.2.4: para onde o link do lembrete leva — 'auto' (abre o registro), 'escala.<SIGLA>' (abre aquela escala, so se
 * for do catalogo) ou '' (o "Outro": Inicio). So o destino vai no link; nenhum dado do paciente.
 */
function _lembreteDestino_(item) {
  if (!item) return '';
  if (item.tipo === 'auto') return 'auto';
  if (item.tipo === 'escala' && _idDaEscala_(item.instrumento)) return 'escala.' + encodeURIComponent(String(item.instrumento).trim());
  return '';
}
/** Link do site com o destino (so aceita o formato de _lembreteDestino_; qualquer outra coisa vira o link simples). */
function _lembreteLink_(destino) {
  var d = String(destino === undefined || destino === null ? '' : destino);
  return /^(auto|escala\.[A-Za-z0-9%._~-]{1,60})$/.test(d) ? SITE_URL + '?ir=' + d : SITE_URL;
}

/**
 * E-mail de lembrete (texto puro e HTML no layout dos convites), com os textos aprovados; o link e o do site
 * e, desde o 19.2.4, leva o `destino` (opcional, _lembreteDestino_): abre direto o registro ou a escala.
 * 19.2.2: `detalhe` (opcional, _lembreteDetalhe_) entra no paragrafo da escala e do "Outro". No HTML ele passa
 * pelo escapador unico (_layoutEmail_ escapa o paragrafo inteiro); na versao em texto vai como foi digitado.
 */
function montarEmailLembrete(tipo, nome, assinatura, detalhe, destino) {
  var link = _lembreteLink_(destino);
  var t = EMAIL_LEMBRETE[tipo] || EMAIL_LEMBRETE.outro;
  var linhasAssinatura = assinatura || [];
  var ola = nome ? 'Olá, ' + nome + '.' : 'Olá.';
  var d = String(detalhe === undefined || detalhe === null ? '' : detalhe).trim();
  var molde = EMAIL_LEMBRETE_COM_DETALHE[tipo];
  var paragrafo = (d && molde) ? molde[0] + d + molde[1] : t.paragrafo;
  var texto = [EMAIL_DESTAQUE, '', ola, '', paragrafo, '', link, '', EMAIL_LEMBRETE_AVISO, ''].concat(linhasAssinatura).join('\n');
  var html = _layoutEmail_({ previa: t.previa, titulo: t.titulo, acompanhamento: '', ola: ola, paragrafo: paragrafo,
    botao: t.botao, sobBotao: EMAIL_LEMBRETE_SOB_BOTAO, link: link, aviso: EMAIL_LEMBRETE_AVISO, assinatura: linhasAssinatura });
  return { assunto: t.assunto, texto: texto, html: html };
}

// ---------- gatilho (a cada 5 minutos desde o 19.2.3; de hora em hora antes) ----------

/**
 * Percorre a aba Lembretes de cada profissional ativo e manda o e-mail dos itens que vencem
 * agora (_lembreteEmailVence_). `quando` (Date) so nos testes; o gatilho passa o evento dele,
 * que e ignorado. A marca `ultimo_email_em` e gravada ANTES do envio, dentro da trava e relendo
 * a celula: rodar duas vezes no mesmo dia nunca manda o mesmo item duas vezes. Se o envio
 * falhar, a marca volta ao que era e a rodada seguinte tenta de novo.
 * Devolve so contagens (nenhuma sigla, nenhum e-mail).
 */
function enviarLembretes_(quando) {
  _memoZerar_(true);
  var agora = _lemAgora_(quando);
  var r = { ok: true, data: agora.data, hora: agora.hora, profissionais: 0, itens: 0, vencendo: 0, enviados: 0,
    ja_enviados: 0, sem_email: 0, sem_conexao: 0, inativos: 0, sem_cota: 0, falhas: 0 };
  lerAbaComoObjetos(_abrirPlanilha_(SISTEMA_VMC_ID), ABA_PROFISSIONAIS).forEach(function (prof) {
    try {
      if (!prof.profissional_id || !_estaAtivo_(prof.ativo)) return;
      var controle = abrirControleDoProfissional(prof.profissional_id);
      var aba = _lembretesAba_(controle, false);
      var itens = _lembretesLer_(aba);
      if (!itens.length) return;
      r.profissionais++;
      r.itens += itens.length;
      var devidos = itens.filter(function (i) { return _lembreteEmailVence_(i, agora.data, agora.hora); });
      if (!devidos.length) return;
      if (!_emailPermitido_(prof.profissional_id)) { r.sem_conexao += devidos.length; return; } // 14.10: sem a conta conectada, nenhum e-mail aos pacientes dele
      var pacientes = {};
      lerAbaComoObjetos(controle, ABA_PACIENTES).forEach(function (p) { pacientes[_siglaChave_(p.sigla)] = p; });
      var assinatura = _assinaturaDe_(prof.nome_completo, prof.crp, prof.genero);
      var colEnvio = _garantirColunas_(aba, COLUNAS_LEMBRETES).indexOf('ultimo_email_em') + 1;
      var colId = _garantirColunas_(aba, COLUNAS_LEMBRETES).indexOf('id') + 1;
      devidos.forEach(function (item) {
        r.vencendo++;
        var pac = pacientes[_siglaChave_(item.sigla)];
        if (!pac || !_estaAtivo_(pac.ativo)) { r.inativos++; return; }
        var email = normalizarEmail(pac.email);
        if (!email) { r.sem_email++; return; }
        var anterior = '';
        var reserva;
        try {
          reserva = _comTrava_(function () {
            if (String(aba.getRange(item.__linha, colId).getDisplayValues()[0][0]).trim() !== item.id) return 'mudou';
            anterior = String(aba.getRange(item.__linha, colEnvio).getDisplayValues()[0][0]).trim();
            if (anterior.slice(0, 10) === agora.data) return 'ja';
            if (!_reservarEmail_('lembretes')) return 'cota';
            aba.getRange(item.__linha, colEnvio).setValue(_lemCelula_(agora.carimbo));
            return 'ok';
          });
        } catch (erroTrava) {
          reserva = 'falha';
        }
        if (reserva === 'ja' || reserva === 'mudou') { r.ja_enviados++; return; }
        if (reserva === 'cota') { r.sem_cota++; return; }
        if (reserva !== 'ok') { r.falhas++; return; }
        if (_enviarEmail_(email, montarEmailLembrete(item.tipo, _lemPrimeiroNome_(pac), assinatura, _lembreteDetalhe_(item), _lembreteDestino_(item)), prof.profissional_id)) { r.enviados++; return; }
        r.falhas++;
        _comTravaSeDer_(function () { aba.getRange(item.__linha, colEnvio).setValue(_lemCelula_(anterior)); });
      });
    } catch (e) {
      r.falhas++;
      console.error('lembretes: ' + String(e && e.message || e).slice(0, 160));
    }
  });
  // 14.3: o lembrete das sessoes vai no mesmo gatilho (nunca derruba a rodada dos lembretes)
  try {
    r.sessoes = enviarAvisosSessao_(quando);
  } catch (erroSessoes) {
    r.sessoes = { falhas: 1 };
    console.error('agenda: ' + String(erroSessoes && erroSessoes.message || erroSessoes).slice(0, 160));
  }
  // 20.2: os dois e-mails ao profissional (status pendente e agenda de amanha), no mesmo gatilho e sem derrubar a rodada
  try {
    r.agenda_prof = enviarEmailsProfissional_(quando);
  } catch (erroProf) {
    r.agenda_prof = { falhas: 1 };
    console.error('agenda (e-mails ao profissional): ' + String(erroProf && erroProf.message || erroProf).slice(0, 160));
  }
  Logger.log('Lembretes: ' + JSON.stringify(r));
  return r;
}


// ============================================================
// Pacote 14.3 — AGENDA COMPLETA (22/11/2026)
// ============================================================
// Quatro abas na Controle do profissional, criadas no primeiro uso, so pelo cabecalho. Como nos
// lembretes (19.2.1): toda celula e TEXTO LITERAL (_lemCelula_), a leitura e por getDisplayValues
// (_lembretesLer_) e a regra de datas trabalha so com 'AAAA-MM-DD' e 'HH:mm', recebendo o "agora"
// por parametro.
//   Sessoes         uma linha por sessao. estado: agendada | realizada | falta | cancelada.
//                   cobrada: Sim | Nao | vazio. reposicao_de: id da sessao cobrada que esta repoe
//                   (a reposicao nunca gera cobranca). avisos: 'confirmacao,lembrete,cancelamento'.
//                   cancelada_por: paciente | profissional | edicao_serie (esta ultima nao e
//                   cancelamento de ninguem: a repeticao foi refeita, e a linha nao aparece em historico).
//   Series          a regra de cada repeticao (dias_semana no padrao da Grade: 1 = segunda ... 7 = domingo).
//   Bloqueios       periodo fechado (dia inteiro ou com hora).
//   Pedidos_Agenda  pedidos do paciente: agendar (14.7; sem sessao ate ser aprovado) | remarcar | repor; pendente | aprovado | recusado.
//                   Pedido pendente com data e hora RESERVA o horario: ele sai da lista de livres ate o profissional decidir.
// Decisoes do usuario (22/11/2026): horario ocupado ou bloqueado NUNCA recebe sessao (na serie a
// data e pulada e listada); paciente so cancela e pede remarcacao com `antecedencia_min_horas` ou
// mais; reposicao e sempre decisao do profissional. Avisos por e-mail so saem com a chave
// `avisos_sessao` = Sim na Config_Agenda (nasce desligada) E a caixa da sessao marcada.

var ABA_SESSOES = 'Sessoes';
var ABA_SERIES = 'Series';
var ABA_BLOQUEIOS = 'Bloqueios';
var ABA_PEDIDOS_AGENDA = 'Pedidos_Agenda';
var COLUNAS_SESSOES = ['id', 'sigla', 'data', 'hora_inicio', 'duracao_min', 'modalidade', 'valor', 'notas', 'serie_id',
  'estado', 'cobrada', 'reposicao_de', 'origem', 'confirmada_em', 'cancelada_em', 'cancelada_por', 'avisos',
  'ultimo_aviso_em', 'criado_em', 'criado_por', 'atualizado_em',
  'lembrete48_em', // 14.4: marca do lembrete de 48 h (ultimo_aviso_em e a do de 24 h); 'dispensado' = a sessao nasceu ja dentro do prazo
  'gcal_evento', 'gcal_sinc', 'meet_link']; // 14.5: id do evento no Google Calendar, 'pendente' enquanto o espelho nao foi feito, link do Meet da sessao on-line
var COLUNAS_SERIES = ['id', 'sigla', 'cada', 'unidade', 'dias_semana', 'modo_mes', 'fim_tipo', 'fim_n', 'fim_data',
  'ocupado', 'criada_em', 'encerrada_em'];
var COLUNAS_BLOQUEIOS = ['id', 'data_inicio', 'hora_inicio', 'data_fim', 'hora_fim', 'dia_todo', 'nome'];
var COLUNAS_PEDIDOS_AGENDA = ['id', 'sigla', 'tipo', 'sessao_id', 'data', 'hora', 'estado', 'criado_em', 'decidido_em',
  'sugestao',  // 14.5: "horario ideal" escrito pelo paciente quando nenhum horario livre serve (data e hora ficam vazias)
  'modalidade']; // 14.7: modalidade que o paciente escolheu no pedido de agendamento
var AGENDA_SERIE_MAX = 60;        // sessoes por repeticao
var AGENDA_SERIE_DIAS = 366;      // 12 meses a partir da primeira data
var AGENDA_LEITURA_DIAS = 100;    // periodo maximo de uma leitura da agenda
var AGENDA_NOTAS_MAX = 500;
var AGENDA_AVISOS = ['confirmacao', 'lembrete48', 'lembrete', 'cancelamento']; // lembrete = 24 h antes; cancelamento = mudanca ou cancelamento
var AGENDA_EVENTOS_DIAS = 30;    // janela dos eventos da agenda (sino)
var SESSOES_EMAIL_DIA_MAX = 60;   // e-mails de sessao por dia (cota propria)
var AGENDA_ENDERECO_MAX = 200;
var AGENDA_SUGESTAO_MAX = 200;
var CAL_NOME_PADRAO = 'Cogniativo: Agenda Consultório'; // 14.5: agenda do Google que recebe o espelho (decisao do usuario de 22/11/2026)
var CAL_COR = { presencial: '1', online: '2' };         // cores do Google Calendar: 1 = lavanda (lilas), 2 = salvia (verde)
var CAL_SINC_RODADA = 20;         // eventos espelhados por rodada do gatilho, por profissional
// 14.13 (decisao do usuario, 24/11/2026): o e-mail de criar, mudar, cancelar e responder pedido SO sai com o clique do
// profissional (profAvisarSessao). As gravacoes devolvem aviso = 'clique' e nao enviam nada. A chave abaixo existe so
// para as suites antigas, que conferem o conteudo dos e-mails pelo caminho de antes; em producao ela e sempre false.
var AGE_EMAIL_AUTOMATICO = false;
var CAL_LISTA_PAGINAS = 4;        // 14.11: paginas (2500 eventos cada) lidas para saber que eventos existem no Google
var CAL_LIVRES_DIAS_PROF = 14;    // dias da lista de horarios livres do profissional

// Mensagens de tela (aprovadas pelo usuario em 22/11/2026)
var MSG_AGE_OCUPADO = 'Este horário já está ocupado. Escolha outro.';
var MSG_AGE_BLOQUEADO = 'Este horário está bloqueado. Escolha outro.';
var MSG_AGE_TETO = 'A repetição vai até 12 meses ou 60 sessões. Diminua o período.';
var MSG_AGE_ACABOU = 'Este horário acabou de ser ocupado. Escolha outro.';
var MSG_AGE_PEDIDO_OCUPADO = 'O horário pedido já foi ocupado. Recuse o pedido ou marque outro horário.';
var MSG_AGE_PEDIDO_PASSOU = 'O horário pedido já passou. Recuse o pedido ou escolha outro horário.'; // 14.7
var MSG_AGE_BLOQ_SESSOES = 'Há sessões neste período. Remarque ou cancele antes de bloquear.';
var MSG_AGE_NAO_ACHEI = 'Sessão não encontrada.';

// ---------- regra de datas e de horario (funcoes puras) ----------

/** 'HH:mm' -> minutos desde 00:00; null se nao for hora. */
function _ageMin_(hora) {
  var h = _lemHora_(hora);
  return h ? (+h.slice(0, 2)) * 60 + (+h.slice(3)) : null;
}

/** Duracao em minutos (10 a 480); fora disso, o padrao. */
function _ageDur_(v, padrao) {
  var n = parseInt(v, 10);
  return (n >= 10 && n <= 480) ? n : (padrao || 60);
}

/** Dia da semana no padrao da Grade: 1 = segunda ... 7 = domingo. */
function _ageDow_(n) { var d = _lemDiaDaSemana_(n); return d === 0 ? 7 : d; }

/** Dois intervalos [inicio, inicio + duracao) em minutos se sobrepoem? Encostar nao e conflito. */
function _ageSobrepoe_(iniA, durA, iniB, durB) { return iniA < iniB + durB && iniB < iniA + durA; }

/** Numero do dia do domingo de Pascoa (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
function _agePascoa_(ano) {
  var a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  var mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Math.round(Date.UTC(ano, mes - 1, dia) / 86400000);
}

/** Feriados nacionais do ano e, pelo nome, Carnaval e Corpus Christi: { 'AAAA-MM-DD': nome }. */
function _ageFeriados_(ano) {
  var f = {}, p = _agePascoa_(ano);
  var fixo = function (md, nome) { f[ano + '-' + md] = nome; };
  fixo('01-01', 'Confraternização Universal'); fixo('04-21', 'Tiradentes'); fixo('05-01', 'Dia do Trabalho');
  fixo('09-07', 'Independência do Brasil'); fixo('10-12', 'Nossa Senhora Aparecida'); fixo('11-02', 'Finados');
  fixo('11-15', 'Proclamação da República'); fixo('11-20', 'Dia da Consciência Negra'); fixo('12-25', 'Natal');
  f[_lemIso_(p - 48)] = 'Carnaval'; f[_lemIso_(p - 47)] = 'Carnaval';
  f[_lemIso_(p - 2)] = 'Sexta-feira Santa'; f[_lemIso_(p + 60)] = 'Corpus Christi';
  return f;
}

/** Nome do feriado em `iso` ('' se nao for). */
function _ageFeriadoEm_(iso) {
  var ano = parseInt(String(iso).slice(0, 4), 10);
  return ano ? (_ageFeriados_(ano)[iso] || '') : '';
}

/** Feriados entre dois dias (inclusive): { iso: nome }. */
function _ageFeriadosEntre_(deIso, ateIso) {
  var r = {}, a = parseInt(String(deIso).slice(0, 4), 10), b = parseInt(String(ateIso).slice(0, 4), 10);
  for (var ano = a; ano && b && ano <= b; ano++) {
    var f = _ageFeriados_(ano);
    for (var iso in f) if (iso >= deIso && iso <= ateIso) r[iso] = f[iso];
  }
  return r;
}

/**
 * Confere a regra de repeticao que veio da tela.
 *   cada 1..12 · unidade semana | mes · dias_semana [1..7] (so em semana) ·
 *   modo_mes dia_mes | dia_semana (so em mes) · fim_tipo n | data · fim_n · fim_data · pular_feriado
 */
function _ageRegra_(r) {
  var o = r && typeof r === 'object' ? r : {};
  var regra = { cada: parseInt(o.cada, 10), unidade: o.unidade === 'mes' ? 'mes' : 'semana', dias_semana: [],
    modo_mes: o.modo_mes === 'dia_semana' ? 'dia_semana' : 'dia_mes', fim_tipo: o.fim_tipo === 'data' ? 'data' : 'n',
    fim_n: parseInt(o.fim_n, 10), fim_data: String(o.fim_data || '').trim(), pular_feriado: o.pular_feriado === true };
  if (!(regra.cada >= 1 && regra.cada <= 12)) return { ok: false, erro: 'Parametros incompletos' };
  var visto = {};
  (Array.isArray(o.dias_semana) ? o.dias_semana : String(o.dias_semana || '').split(',')).forEach(function (x) {
    var n = parseInt(x, 10);
    if (n >= 1 && n <= 7 && !visto[n]) { visto[n] = true; regra.dias_semana.push(n); }
  });
  regra.dias_semana.sort();
  if (regra.fim_tipo === 'n') {
    if (!(regra.fim_n >= 1)) return { ok: false, erro: 'Parametros incompletos' };
    regra.fim_data = '';
  } else {
    if (_lemDia_(regra.fim_data) === null) return { ok: false, erro: 'Escolha a data.' };
    regra.fim_n = 0;
  }
  return { ok: true, regra: regra };
}

/** Dias (numero do dia) em que a regra cai, do `ini` ate `limite`, em ordem. */
function _ageCandidatas_(regra, ini, limite) {
  var lista = [], n, k;
  if (regra.unidade === 'semana') {
    var dias = regra.dias_semana.slice();
    if (dias.indexOf(_ageDow_(ini)) === -1) { dias.push(_ageDow_(ini)); dias.sort(); }
    var segunda = ini - (_ageDow_(ini) - 1);
    for (var w = 0; ; w += regra.cada) {
      for (k = 0; k < dias.length; k++) {
        n = segunda + w * 7 + (dias[k] - 1);
        if (n < ini) continue;
        if (n > limite) return lista;
        lista.push(n);
      }
      if (segunda + w * 7 > limite) return lista;
    }
  }
  var d0 = new Date(ini * 86400000), ano = d0.getUTCFullYear(), mes = d0.getUTCMonth(), dia = d0.getUTCDate();
  var dow = d0.getUTCDay(), ordem = Math.ceil(dia / 7);
  for (k = 0; ; k += regra.cada) {
    var ultimo = new Date(Date.UTC(ano, mes + k + 1, 0)).getUTCDate(), alvo;
    if (regra.modo_mes === 'dia_semana') {
      var primeiroDow = new Date(Date.UTC(ano, mes + k, 1)).getUTCDay();
      alvo = 1 + ((dow - primeiroDow + 7) % 7) + (ordem - 1) * 7;
      if (alvo > ultimo) alvo -= 7;
    } else {
      alvo = Math.min(dia, ultimo);
    }
    n = Math.round(Date.UTC(ano, mes + k, alvo) / 86400000);
    if (n > limite) return lista;
    if (n >= ini) lista.push(n);
  }
}

/**
 * Datas de uma repeticao a partir de `inicioIso`. `ocupada(iso)` diz se o horario daquele dia ja
 * tem sessao ou bloqueio: a data e PULADA e a serie segue ("apos N consultas" = N sessoes criadas).
 * Saida: { ok, datas, puladas, feriados (criadas em feriado), pulados_feriado } ou { ok:false, codigo:'teto' }.
 */
function _ageSerie_(regra, inicioIso, ocupada) {
  var ini = _lemDia_(inicioIso);
  if (ini === null) return { ok: false, erro: 'Escolha a data.' };
  var limite = ini + AGENDA_SERIE_DIAS;
  var teto = { ok: false, codigo: 'teto', erro: MSG_AGE_TETO };
  if (regra.fim_tipo === 'n' && regra.fim_n > AGENDA_SERIE_MAX) return teto;
  var fim = limite;
  if (regra.fim_tipo === 'data') {
    fim = _lemDia_(regra.fim_data);
    if (fim === null || fim < ini) return { ok: false, erro: 'A data de término não pode ser antes do início.' };
    if (fim > limite) return teto;
  }
  var r = { ok: true, datas: [], puladas: [], feriados: [], pulados_feriado: [] };
  var cand = _ageCandidatas_(regra, ini, fim);
  for (var i = 0; i < cand.length; i++) {
    var iso = _lemIso_(cand[i]);
    if (ocupada(iso)) { r.puladas.push(iso); continue; }
    if (_ageFeriadoEm_(iso)) {
      if (regra.pular_feriado) { r.pulados_feriado.push(iso); continue; }
      r.feriados.push(iso);
    }
    r.datas.push(iso);
    if (r.datas.length > AGENDA_SERIE_MAX) return teto;
    if (regra.fim_tipo === 'n' && r.datas.length === regra.fim_n) return r;
  }
  if (regra.fim_tipo === 'n') return teto; // os 12 meses acabaram antes de completar N
  return r;
}

/** Minutos de `agora` ({ data, hora }) ate o inicio da sessao (negativo = ja passou). */
function _ageMinutosAte_(dataIso, hora, agora) {
  var d = _lemDia_(dataIso), h = _lemDia_(agora.data), m = _ageMin_(hora), a = _ageMin_(agora.hora);
  if (d === null || h === null || m === null || a === null) return null;
  return (d - h) * 1440 + m - a;
}

/** A antecedencia combinada foi respeitada? (faltam `horas` ou mais para a sessao) */
function _ageNoPrazo_(dataIso, hora, agora, horas) {
  var m = _ageMinutosAte_(dataIso, hora, agora);
  return m !== null && m >= horas * 60;
}

/**
 * Tabela de cobranca (decisao 12 do usuario). evento: realizada | falta | cancel_paciente | cancel_profissional.
 * Reposicao nunca e cobrada: a cobranca e uma so e fica na sessao original.
 */
function _ageCobrada_(evento, noPrazo, ehReposicao) {
  if (ehReposicao) return 'Nao';
  if (evento === 'realizada' || evento === 'falta') return 'Sim';
  if (evento === 'cancel_paciente') return noPrazo ? 'Nao' : 'Sim';
  return 'Nao';
}

// ---------- abas, leitura e gravacao ----------

function _ageAba_(controle, nome, colunas, criar) {
  if (!controle) return null;
  var mapa = null, aba = null;
  if (_MEMO_.age) { mapa = _MEMO_.age.abas.get(controle); if (!mapa) { mapa = {}; _MEMO_.age.abas.set(controle, mapa); } aba = mapa[nome] || null; } // 14.12
  if (!aba) aba = controle.getSheetByName(nome);
  if (!aba && criar) aba = controle.insertSheet(nome);
  if (aba && mapa) mapa[nome] = aba;
  if (aba && criar) _garantirColunas_(aba, colunas);
  return aba;
}

/** Grava `campos` pelo nome do cabecalho: linha nova (`linha` = 0) ou so as colunas dadas. */
function _ageGravar_(aba, colunas, linha, campos) {
  if (colunas === COLUNAS_SESSOES && campos.gcal_sinc === undefined && (!linha || campos.data !== undefined || campos.hora_inicio !== undefined ||
      campos.duracao_min !== undefined || campos.modalidade !== undefined || campos.estado === 'cancelada')) campos.gcal_sinc = 'pendente'; // 14.5
  var header = _garantirColunas_(aba, colunas);
  var guardado = _MEMO_.age ? _MEMO_.age.linhas.get(aba) : null; // 14.12: a memoria da chamada acompanha a gravacao
  var texto = function (v) { return String(v === undefined || v === null ? '' : v).trim(); };
  if (!linha) {
    aba.appendRow(header.map(function (col) { return campos[col] !== undefined ? _lemCelula_(campos[col]) : ''; }));
    if (guardado) {
      var novo = { __linha: aba.getLastRow() };
      header.forEach(function (col) { if (col !== '') novo[col] = texto(campos[col]); });
      if (novo.id) guardado.push(novo); else _ageEsquecer_(aba);
    }
    return;
  }
  var item = null;
  if (guardado) { item = guardado.filter(function (o) { return o.__linha === linha; })[0] || null; if (!item) _ageEsquecer_(aba); }
  for (var col in campos) {
    var i = header.indexOf(col);
    if (i >= 0) { aba.getRange(linha, i + 1).setValue(_lemCelula_(campos[col])); if (item) item[col] = texto(campos[col]); }
  }
  if (item && !item.id) _ageEsquecer_(aba);
}

/** Config_Agenda como a agenda a usa (padroes da Grade + a chave dos avisos, que nasce 'Nao'). */
function _ageConfig_(controle) {
  // 14.12: uma leitura por chamada; quem recebe leva uma copia, e _ageConfigGravar_ e a Grade esquecem a guardada
  if (_MEMO_.age && controle) {
    var pronta = _MEMO_.age.cfg.get(controle);
    if (!pronta) { pronta = _ageConfigLer_(controle); _MEMO_.age.cfg.set(controle, pronta); }
    var copia = {};
    for (var k in pronta) copia[k] = pronta[k];
    return copia;
  }
  return _ageConfigLer_(controle);
}

function _ageConfigLer_(controle) {
  var cfg = { duracao_slot_min: GRADE_CONFIG_PADRAO.duracao_slot_min, antecedencia_min_horas: GRADE_CONFIG_PADRAO.antecedencia_min_horas, avisos_sessao: 'Nao' };
  var aba = controle ? controle.getSheetByName(GRADE_ABA_CONFIG) : null;
  if (!aba) return cfg;
  var v = aba.getDataRange().getDisplayValues();
  for (var i = 1; i < v.length; i++) {
    var chave = String(v[i][0] || '').trim(), valor = String(v[i][1] || '').trim();
    if (chave === 'duracao_slot_min' && parseInt(valor, 10) > 0) cfg.duracao_slot_min = parseInt(valor, 10);
    if (chave === 'antecedencia_min_horas' && parseInt(valor, 10) >= 0 && valor !== '') cfg.antecedencia_min_horas = parseInt(valor, 10);
    if (chave === 'avisos_sessao') cfg.avisos_sessao = valor.toLowerCase() === 'sim' ? 'Sim' : 'Nao';
    if (chave === 'agenda_vistos_ate') cfg.agenda_vistos_ate = valor; // 14.4: 'AAAA-MM-DD HH:mm' do ultimo "Marcar como vistos"
    // 14.5: endereco do consultorio (o atual e o que passa a valer numa data) e o espelho no Google Calendar (nasce 'Nao')
    if (chave === 'endereco' || chave === 'endereco_novo' || chave === 'endereco_novo_desde' || chave === 'gcal_id' || chave === 'gcal_nome') cfg[chave] = valor;
    if (chave === 'google_calendar') cfg.google_calendar = valor.toLowerCase() === 'sim' ? 'Sim' : 'Nao';
    // 14.8: conta conectada (so o e-mail), opcao dos compromissos pessoais (nasce 'Nao') e o aviso de conexao caida
    if (chave === 'agenda_conta' || chave === 'agenda_aviso') cfg[chave] = valor;
    if (chave === 'agenda_ocupado') cfg.agenda_ocupado = valor.toLowerCase() === 'sim' ? 'Sim' : 'Nao';
  }
  return cfg;
}

// ---------- 14.4: link de confirmacao, eventos e marcas dos lembretes ----------

/** Token do link de confirmacao: corpo (conf|profissional|sessao) + assinatura com o segredo da sessao. Nao expira sozinho: quem o invalida e o estado da sessao. */
function _ageTokenConfirmar_(profId, sessaoId) {
  var corpo = _b64url_(['conf', String(profId), String(sessaoId)].join('|'));
  return corpo + '.' + _hmacHex_(corpo, _segredoSessao_()).slice(0, 32);
}
function _ageLinkConfirmar_(profId, sessaoId) {
  return (profId && sessaoId) ? SITE_URL + '?confirmar=' + _ageTokenConfirmar_(profId, sessaoId) : '';
}
/** Confere a assinatura; devolve { profId, sessaoId } ou null. */
function _ageLerTokenConfirmar_(token) {
  var partes = String(token === undefined || token === null ? '' : token).split('.');
  if (partes.length !== 2 || !partes[0] || partes[1].length !== 32 || partes[0].length > 300) return null;
  if (!_iguaisTempoConstante_(_hmacHex_(partes[0], _segredoSessao_()).slice(0, 32), partes[1])) return null;
  var campos;
  try { campos = _deB64url_(partes[0]).split('|'); } catch (e) { return null; }
  if (campos.length !== 3 || campos[0] !== 'conf' || !campos[1] || !campos[2]) return null;
  return { profId: campos[1], sessaoId: campos[2] };
}

/**
 * Acao PUBLICA (sem cracha): o link do e-mail e do WhatsApp. So faz uma coisa — marcar a presenca
 * como confirmada na sessao do token — e so devolve dia, hora, modalidade e ONDE e a sessao (nenhum nome).
 * 14.5.1: o "onde" e o endereco do consultorio que vale na data, com o link do mapa (presencial), ou a sala
 * do Meet daquela sessao (on-line) — o WhatsApp deixou de levar o endereco por extenso.
 * Token invalido nem abre planilha. Sessao cancelada, com situacao marcada ou ja iniciada: link vencido.
 */
function confirmarSessaoPorLink(token) {
  var t = _ageLerTokenConfirmar_(token);
  var vencido = { ok: false, codigo: 'vencido', erro: 'Este link não vale mais. Entre no COGNIATIVO para ver suas sessões.' };
  if (!t) return vencido;
  var prof = buscarProfissional(t.profId);
  if (!prof || !_estaAtivo_(prof.ativo)) return vencido;
  var controle = abrirControleDoProfissional(t.profId);
  var aba = _ageAba_(controle, ABA_SESSOES, COLUNAS_SESSOES, false);
  var agora = _lemAgora_();
  var x = _lembretesLer_(aba).filter(function (y) { return y.id === t.sessaoId; })[0];
  if (!x || (x.estado !== 'agendada' && x.estado !== '') || _ageMinutosAte_(x.data, x.hora_inicio, agora) <= 0) return vencido;
  var ja = !!x.confirmada_em;
  if (!ja) _ageGravar_(aba, COLUNAS_SESSOES, x.__linha, { confirmada_em: agora.carimbo, atualizado_em: agora.carimbo, gcal_sinc: 'pendente' }); // 14.11: a confirmacao vai ao evento do Google na rodada seguinte
  var online = x.modalidade === 'online';
  var ender = online ? '' : _ageEndereco_(_ageConfig_(controle), x.data);
  return { ok: true, ja_confirmada: ja, data: x.data, hora: _lemHora_(x.hora_inicio), modalidade: online ? 'online' : 'presencial',
    estado: 'agendada', endereco: ender, mapa: _ageMapa_(ender), meet_link: online ? String(x.meet_link || '') : '' };
}

/** Marcas dos dois lembretes para uma sessao que nasce ou muda de data: 'dispensado' quando ela ja esta dentro do prazo daquele lembrete. */
function _ageMarcasLembrete_(dataIso, hora, agora) {
  var m = _ageMinutosAte_(dataIso, hora, agora);
  return { lembrete48_em: (m !== null && m <= 2880) ? 'dispensado' : '', ultimo_aviso_em: (m !== null && m <= 1440) ? 'dispensado' : '' };
}

/** Linha nova em Sessoes, com as marcas dos lembretes. */
function _ageNovaSessao_(ctx, agora, campos) {
  var marcas = _ageMarcasLembrete_(campos.data, campos.hora_inicio, agora);
  campos.lembrete48_em = marcas.lembrete48_em; campos.ultimo_aviso_em = marcas.ultimo_aviso_em;
  _ageGravar_(ctx.abaS, COLUNAS_SESSOES, 0, campos);
}

/**
 * Eventos da agenda feitos pelo PACIENTE nos ultimos AGENDA_EVENTOS_DIAS dias, do mais novo ao mais antigo
 * (nenhuma aba nova: saem das colunas que ja existem). tipo: confirmou | agendou (ate o 14.6) | agendar (pedido, 14.7) | cancelou | remarcar | repor.
 */
function _ageEventos_(ctx, pacs, agora) {
  var corte = _lemIso_(_lemDia_(agora.data) - AGENDA_EVENTOS_DIAS), lista = [];
  var nome = function (sigla) { var p = pacs[_siglaChave_(sigla)]; return p ? p.nome : sigla; };
  var ev = function (tipo, x, em) {
    if (!em || em.slice(0, 10) < corte) return;
    var e = { tipo: tipo, sigla: x.sigla, nome: nome(x.sigla), data: x.data, hora: _lemHora_(x.hora_inicio), em: em };
    lista.push(e);
    return e;
  };
  ctx.sessoes.forEach(function (x) {
    if (x.cancelada_por === 'edicao_serie') return;
    if (x.origem === 'paciente' && !x.reposicao_de) ev('agendou', x, x.criado_em);
    if (x.confirmada_em) ev('confirmou', x, x.confirmada_em);
    if (x.estado === 'cancelada' && x.cancelada_por === 'paciente') ev('cancelou', x, x.cancelada_em);
  });
  ctx.pedidos.forEach(function (p) {
    if (p.tipo === 'agendar') { ev('agendar', { sigla: p.sigla, data: p.data, hora_inicio: p.hora }, p.criado_em); return; } // 14.7: o pedido, nao a sessao
    var x = ctx.sessoes.filter(function (y) { return y.id === p.sessao_id; })[0];
    if (!x) return;
    // remarcacao: o evento mostra o horario PEDIDO (depois de aprovado, a sessao ja esta nele e a data antiga nao existe mais)
    if (p.tipo === 'repor') ev('repor', x, p.criado_em);
    else { // 14.5: pedido com "horario ideal" (sem horario ate o profissional escolher) leva a sugestao
      var e = ev('remarcar', p.data ? { sigla: x.sigla, data: p.data, hora_inicio: p.hora } : x, p.criado_em);
      if (e && p.sugestao) { e.sugestao = p.sugestao; e.sem_horario = !p.data; }
    }
  });
  return lista.sort(function (a, b) { return a.em < b.em ? 1 : (a.em > b.em ? -1 : 0); }).slice(0, 60);
}

/** Grava uma chave da Config_Agenda (cria a aba se preciso). */
function _ageConfigGravar_(controle, chave, valor) {
  if (_MEMO_.age) _MEMO_.age.cfg = new Map(); // 14.12
  var aba = _gradeObterOuCriarAba_(controle, GRADE_ABA_CONFIG, ['chave', 'valor']);
  var v = aba.getDataRange().getDisplayValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === chave) { aba.getRange(i + 1, 2).setValue(_lemCelula_(valor)); return; }
  }
  aba.appendRow([chave, _lemCelula_(valor)]);
}

/** Janelas ativas da Grade: [ { dia_semana, ini, fim (minutos), modalidade } ]. */
function _ageJanelas_(controle) {
  var aba = controle ? controle.getSheetByName(GRADE_ABA_HORARIOS) : null;
  if (!aba) return [];
  var v = aba.getDataRange().getDisplayValues();
  if (v.length < 2) return [];
  var cab = v[0], iD = cab.indexOf('dia_semana'), iI = cab.indexOf('hora_inicio'), iF = cab.indexOf('hora_fim'), iM = cab.indexOf('modalidade'), iA = cab.indexOf('ativo');
  var lista = [];
  for (var r = 1; r < v.length; r++) {
    var dia = parseInt(v[r][iD], 10), ini = _ageMin_(v[r][iI]), fim = _ageMin_(v[r][iF]);
    if (!(dia >= 1 && dia <= 7) || ini === null || fim === null || fim <= ini) continue;
    if (iA >= 0 && String(v[r][iA] || 'sim').trim().toLowerCase() === 'nao') continue;
    lista.push({ dia_semana: dia, ini: ini, fim: fim, modalidade: String(v[r][iM] || '').trim() });
  }
  return lista;
}

/** O horario cabe inteiro numa janela aberta da Grade? */
function _ageNaGrade_(janelas, dataIso, ini, dur) {
  var dow = _ageDow_(_lemDia_(dataIso));
  return janelas.some(function (j) { return j.dia_semana === dow && ini >= j.ini && ini + dur <= j.fim; });
}

/**
 * Tudo o que uma acao da agenda precisa, lido uma vez: sessoes (todas), ativas (nao canceladas),
 * bloqueios, series, pedidos e a config. Com `criar`, as abas nascem.
 */
function _ageCtx_(controle, criar) {
  var c = { controle: controle, cfg: _ageConfig_(controle) };
  c.abaS = _ageAba_(controle, ABA_SESSOES, COLUNAS_SESSOES, criar);
  c.abaR = _ageAba_(controle, ABA_SERIES, COLUNAS_SERIES, criar);
  c.abaB = _ageAba_(controle, ABA_BLOQUEIOS, COLUNAS_BLOQUEIOS, criar);
  c.abaP = _ageAba_(controle, ABA_PEDIDOS_AGENDA, COLUNAS_PEDIDOS_AGENDA, criar);
  c.sessoes = _ageLer_(c.abaS); // 14.12: cada aba da Agenda e lida uma vez por chamada
  c.series = _ageLer_(c.abaR);
  c.bloqueios = _ageLer_(c.abaB);
  c.pedidos = _ageLer_(c.abaP);
  return c;
}

function _ageAtiva_(x) { return x.estado !== 'cancelada'; }
/** 14.6: sessao cancelada e COBRADA — continua na grade do profissional (apagada, sem ocupar o horario) para poder ser reposta. */
function _ageCanceladaCobrada_(x) { return x.estado === 'cancelada' && x.cobrada === 'Sim' && x.cancelada_por !== 'edicao_serie'; }

/** O bloqueio pega o intervalo [ini, ini + dur) do dia `dataIso`? */
function _ageBloqueioPega_(b, dataIso, ini, dur) {
  var d = _lemDia_(dataIso), di = _lemDia_(b.data_inicio), df = _lemDia_(b.data_fim || b.data_inicio);
  if (d === null || di === null || df === null) return false;
  var todo = String(b.dia_todo || '').toLowerCase() === 'sim';
  var hi = todo ? 0 : _ageMin_(b.hora_inicio), hf = todo ? 1440 : _ageMin_(b.hora_fim);
  if (hi === null || hf === null) return false;
  var a = d * 1440 + ini;
  return a < df * 1440 + hf && di * 1440 + hi < a + dur;
}

/** '' (livre) | 'ocupado' (ha sessao) | 'bloqueado' (ha bloqueio). `ignorar`: ids de sessao fora da conta. */
function _ageOcupado_(ctx, dataIso, hora, dur, ignorar) {
  var ini = _ageMin_(hora), fora = ignorar || {};
  for (var i = 0; i < ctx.sessoes.length; i++) {
    var x = ctx.sessoes[i];
    if (!_ageAtiva_(x) || x.data !== dataIso || fora[x.id]) continue;
    if (_ageSobrepoe_(ini, dur, _ageMin_(x.hora_inicio), _ageDur_(x.duracao_min, ctx.cfg.duracao_slot_min))) return 'ocupado';
  }
  for (var j = 0; j < ctx.bloqueios.length; j++) if (_ageBloqueioPega_(ctx.bloqueios[j], dataIso, ini, dur)) return 'bloqueado';
  return '';
}

function _ageRecusa_(motivo) {
  return { ok: false, codigo: motivo, erro: motivo === 'bloqueado' ? MSG_AGE_BLOQUEADO : MSG_AGE_OCUPADO };
}

/** Pacientes da Controle por sigla: { nome, primeiro, telefone, email, ativo }. */
function _agePacientes_(controle) {
  if (_MEMO_.age && controle && _MEMO_.age.pacs.get(controle)) return _MEMO_.age.pacs.get(controle); // 14.12
  var mapa = {};
  if (_MEMO_.age && controle) _MEMO_.age.pacs.set(controle, mapa);
  lerAbaComoObjetos(controle, ABA_PACIENTES).forEach(function (p) {
    var sigla = _siglaChave_(p.sigla);
    if (!sigla) return;
    var nome = String(p.ind_nome || p.nome || '').trim();
    mapa[sigla] = { nome: nome || String(p.sigla).trim(), primeiro: _lemPrimeiroNome_(p), telefone: normalizarTelefone(p.telefone),
      email: normalizarEmail(p.email), ativo: _estaAtivo_(p.ativo),
      valor: String(p.valor_sessao === undefined || p.valor_sessao === null ? '' : p.valor_sessao).replace(/[^0-9.,]/g, '').slice(0, 12) }; // 14.7: a sessao aprovada nasce com o valor do cadastro
  });
  var excluidos = _excluidosLer_(controle); // 19.6
  Object.keys(excluidos).forEach(function (sig) { if (!mapa[sig]) mapa[sig] = { nome: excluidos[sig] + MARCA_EXCLUIDO, primeiro: '', telefone: '', email: '', ativo: false, valor: '', excluido: true }; });
  return mapa;
}

function _ageAvisosLista_(v) {
  var visto = {}, lista = [];
  (Array.isArray(v) ? v : String(v === undefined || v === null ? '' : v).split(',')).forEach(function (x) {
    var t = String(x).trim();
    if (AGENDA_AVISOS.indexOf(t) !== -1 && !visto[t]) { visto[t] = true; lista.push(t); }
  });
  return lista;
}

/** Data em que a sessao `id` foi reposta ('' se nao foi): a reposicao ativa que aponta para ela. */
function _ageRepostaEm_(ctx, id) {
  var r = ctx.sessoes.filter(function (x) { return x.reposicao_de === id && _ageAtiva_(x); })[0];
  return r ? r.data : '';
}

/** A sessao pode ganhar reposicao? Cobrada, por falta ou cancelamento, e ainda nao reposta. */
function _agePodeRepor_(ctx, x) {
  return x.cobrada === 'Sim' && (x.estado === 'falta' || x.estado === 'cancelada') && !x.reposicao_de && !_ageRepostaEm_(ctx, x.id);
}

/** Sessao como a tela do profissional a recebe. */
function _ageSessaoProf_(ctx, x, pacs) {
  var p = pacs[_siglaChave_(x.sigla)] || { nome: x.sigla, telefone: '', email: '' };
  return { id: x.id, sigla: x.sigla, nome: p.nome, data: x.data, hora: _lemHora_(x.hora_inicio),
    duracao_min: _ageDur_(x.duracao_min, ctx.cfg.duracao_slot_min), modalidade: x.modalidade === 'online' ? 'online' : 'presencial',
    valor: x.valor, notas: x.notas, serie_id: x.serie_id, estado: x.estado || 'agendada', cobrada: x.cobrada,
    reposicao_de: x.reposicao_de, reposta_em: _ageRepostaEm_(ctx, x.id), pode_repor: _agePodeRepor_(ctx, x), origem: x.origem || 'profissional',
    confirmada: !!x.confirmada_em, avisos: _ageAvisosLista_(x.avisos), cancelada_por: x.cancelada_por,
    link_confirmar: ((x.estado === 'agendada' || x.estado === '') && ctx.profId) ? _ageLinkConfirmar_(ctx.profId, x.id) : '', // 14.4
    meet_link: x.modalidade === 'online' ? (x.meet_link || '') : '', endereco: x.modalidade === 'online' ? '' : _ageEndereco_(ctx.cfg, x.data), // 14.5
    mapa: x.modalidade === 'online' ? '' : _ageMapa_(_ageEndereco_(ctx.cfg, x.data)), no_calendar: !!x.gcal_evento,
    telefone: p.telefone, tem_email: !!p.email };
}

/** Pedidos pendentes, com o que a tela mostra (nome e a sessao a que se referem). */
function _agePedidosPendentes_(ctx, pacs) {
  return ctx.pedidos.filter(function (p) { return p.estado === 'pendente'; }).map(function (p) {
    var x = (p.sessao_id && ctx.sessoes.filter(function (y) { return y.id === p.sessao_id; })[0]) || {};
    var pac = pacs[_siglaChave_(p.sigla)] || { nome: p.sigla };
    return { id: p.id, sigla: p.sigla, nome: pac.nome, tipo: p.tipo, sessao_id: p.sessao_id, sessao_data: x.data || '',
      sessao_hora: _lemHora_(x.hora_inicio), data: p.data, hora: _lemHora_(p.hora), criado_em: p.criado_em, sugestao: p.sugestao || '', // 14.5
      modalidade: p.tipo === 'agendar' ? (p.modalidade === 'online' ? 'online' : 'presencial') : '' }; // 14.7
  });
}

/** Leitura do periodo para a tela do profissional (uma chamada: sessoes, bloqueios, feriados, pedidos, series, config). */
function _ageLeitura_(ctx, de, ate, pacs, agora) {
  var hoje = agora.data, h = _lemDia_(hoje);
  var a = _lemDia_(de), b = _lemDia_(ate);
  if (a === null) a = h - 7;
  if (b === null || b < a) b = a + 41;
  if (b - a > AGENDA_LEITURA_DIAS) b = a + AGENDA_LEITURA_DIAS;
  var deIso = _lemIso_(a), ateIso = _lemIso_(b);
  var sessoes = ctx.sessoes.filter(function (x) { return x.data >= deIso && x.data <= ateIso && (_ageAtiva_(x) || _ageCanceladaCobrada_(x)); })
    .map(function (x) { return _ageSessaoProf_(ctx, x, pacs); });
  var series = {};
  sessoes.forEach(function (x) {
    if (!x.serie_id || series[x.serie_id]) return;
    var r = ctx.series.filter(function (y) { return y.id === x.serie_id; })[0];
    if (r) series[r.id] = { cada: parseInt(r.cada, 10) || 1, unidade: r.unidade, dias_semana: String(r.dias_semana || '').split(',').filter(String).map(Number),
      modo_mes: r.modo_mes, fim_tipo: r.fim_tipo, fim_n: parseInt(r.fim_n, 10) || 0, fim_data: r.fim_data };
  });
  var externa = ctx.profId ? _calEstadoTela_(ctx.profId, ctx.cfg) : null; // 14.8
  var bloqueios = ctx.bloqueios.filter(function (x) { return x.data_inicio <= ateIso && (x.data_fim || x.data_inicio) >= deIso; })
    .map(function (x) { return { id: x.id, data_inicio: x.data_inicio, hora_inicio: _lemHora_(x.hora_inicio), data_fim: x.data_fim || x.data_inicio,
      hora_fim: _lemHora_(x.hora_fim), dia_todo: String(x.dia_todo || '').toLowerCase() === 'sim', nome: x.nome }; });
  return { de: deIso, ate: ateIso, hoje: hoje, agora_hora: agora.hora, config: ctx.cfg, sessoes: sessoes, series: series, bloqueios: bloqueios,
    feriados: _ageFeriadosEntre_(deIso, ateIso), pedidos: _agePedidosPendentes_(ctx, pacs),
    eventos: _ageEventos_(ctx, pacs, agora), eventos_vistos_ate: ctx.cfg.agenda_vistos_ate || '', // 14.4
    agenda_externa: externa, ocupados: (externa && externa.ocupado) ? _calOcupadosTela_(ctx.profId, ctx.cfg, deIso, ateIso) : [] }; // 14.8
}

/** Profissional do cracha + a Controle dele. */
function _ageProf_(s) {
  var auth = _authProfissional_(s);
  if (!auth.ok) return auth;
  var controle = abrirControleDoProfissional(auth.profissional.profissional_id);
  if (!controle) return { ok: false, erro: 'Controle do profissional não encontrada.' };
  return { ok: true, profissionalId: auth.profissional.profissional_id, controle: controle, nome: auth.profissional.nome_completo };
}

/** Fecha a resposta de uma acao do profissional que gravou: a agenda do periodo que a tela esta mostrando vai junto (sem chamada nova). */
function _ageResposta_(alvo, resp, periodo, agora) {
  var p = periodo && typeof periodo === 'object' ? periodo : {};
  _calSincronizar_(alvo.controle, alvo.profissionalId, { max: 3, agora: agora }); // 14.5: o espelho no Calendar (nunca derruba a acao)
  var ctx = _ageCtx_(alvo.controle, false);
  ctx.profId = alvo.profissionalId; // 14.4: o link de confirmacao de cada sessao
  resp.agenda = _ageLeitura_(ctx, p.de, p.ate, _agePacientes_(alvo.controle), agora);
  return resp;
}

function _ageIdValido_(id) { return /^[A-Za-z0-9-]{8,64}$/.test(String(id === undefined || id === null ? '' : id).trim()); }

/** Confere os campos de uma sessao que vieram da tela. */
function _ageValidarSessao_(d, cfg) {
  var v = { data: String(d.data || '').trim(), hora: _lemHora_(d.hora), dur: _ageDur_(d.duracao_min, cfg.duracao_slot_min),
    modalidade: d.modalidade === 'online' ? 'online' : 'presencial',
    valor: String(d.valor === undefined || d.valor === null ? '' : d.valor).replace(/[^0-9.,]/g, '').slice(0, 12),
    notas: String(d.notas === undefined || d.notas === null ? '' : d.notas).replace(/\s+/g, ' ').trim().slice(0, AGENDA_NOTAS_MAX),
    avisos: _ageAvisosLista_(d.avisos).join(',') };
  if (_lemDia_(v.data) === null) return { ok: false, erro: 'Escolha a data.' };
  if (!v.hora) return { ok: false, erro: 'Escolha o horário.' };
  if (_ageMin_(v.hora) + v.dur > 1440) return { ok: false, erro: 'Escolha o horário.' };
  v.ok = true;
  return v;
}

// ---------- e-mails de sessao ----------

var AGE_DIAS_NOME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function _ageDataBR_(iso) { return String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) + '/' + String(iso).slice(0, 4); }
function _ageDiaMes_(iso) { return String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7); }
function _ageDiaNome_(iso) { var n = _lemDia_(iso); return n === null ? '' : AGE_DIAS_NOME[_lemDiaDaSemana_(n)]; }
function _ageModNome_(m) { return m === 'online' ? 'On-line' : 'Presencial'; }
/** "quinta, 26/11/2026, às 10:00 (On-line)" */
function _ageQuando_(x) { return _ageDiaNome_(x.data) + ', ' + _ageDataBR_(x.data) + ', às ' + _lemHora_(x.hora_inicio || x.hora) + ' (' + _ageModNome_(x.modalidade) + ')'; }

/**
 * E-mail de sessao (textos aprovados pelo usuario em 22/11/2026), no layout dos convites.
 * tipo: confirmacao | serie | lembrete | cancelamento | remarcacao | pedido_aprovado | pedido_recusado | profissional
 * p: { nome (primeiro nome de quem recebe), profissional, sessao, anterior, n, horas, frase, assinatura }
 */
function montarEmailSessao(tipo, p) {
  var prof = String(p.profissional || '').trim();
  var x = p.sessao || {};
  var t;
  // 14.4: confirmacao e lembretes levam o botao "Confirmar presenca" com o link que confirma direto (p.link)
  var sobConfirmar = 'Para remarcar ou cancelar, entre no COGNIATIVO com ' + p.horas + ' horas ou mais de antecedência.';
  if (tipo === 'confirmacao') t = { assunto: 'Sessão agendada — COGNIATIVO', titulo: 'Sua sessão está agendada',
    paragrafo: 'Sua sessão com ' + prof + ' está marcada para ' + _ageQuando_(x) + '.', botao: 'Confirmar presença', aviso: '', sob: sobConfirmar, confirma: true };
  else if (tipo === 'lembrete48') t = { assunto: 'Lembrete de sessão — COGNIATIVO', titulo: 'Sua sessão é em dois dias',
    paragrafo: 'Lembrete da sua sessão com ' + prof + ': ' + _ageQuando_(x) + '.', botao: 'Confirmar presença', aviso: '', sob: sobConfirmar, confirma: true };
  else if (tipo === 'serie') t = { assunto: 'Sessões agendadas — COGNIATIVO', titulo: 'Suas sessões estão agendadas',
    paragrafo: 'Foram marcadas ' + p.n + ' sessões com ' + prof + '. A primeira é ' + _ageQuando_(x) + '. Todas as datas estão em Minhas sessões.', botao: 'Ver minhas sessões',
    aviso: 'Para cancelar ou pedir remarcação, use o sistema com ' + p.horas + ' horas ou mais de antecedência.' };
  else if (tipo === 'lembrete') t = { assunto: 'Lembrete de sessão — COGNIATIVO', titulo: 'Sua sessão está chegando',
    paragrafo: 'Lembrete da sua sessão com ' + prof + ': ' + _ageQuando_(x) + '.', botao: 'Confirmar presença', aviso: '', sob: sobConfirmar, confirma: true };
  else if (tipo === 'cancelamento') t = { assunto: 'Sessão cancelada — COGNIATIVO', titulo: 'Sessão cancelada',
    paragrafo: 'A sessão de ' + _ageDataBR_(x.data) + ' às ' + _lemHora_(x.hora_inicio) + ' com ' + prof + ' foi cancelada. Para marcar outra data, acesse Minhas sessões.', botao: 'Ver minhas sessões', aviso: '' };
  else if (tipo === 'remarcacao') t = { assunto: 'Sessão remarcada — COGNIATIVO', titulo: 'Sua sessão mudou de horário',
    paragrafo: 'Sua sessão com ' + prof + ' passou de ' + _ageDataBR_(p.anterior.data) + ' às ' + _lemHora_(p.anterior.hora_inicio) + ' para ' + _ageDataBR_(x.data) + ' às ' + _lemHora_(x.hora_inicio) + ' (' + _ageModNome_(x.modalidade) + ').', botao: 'Confirmar presença', aviso: '', sob: sobConfirmar, confirma: true }; // 14.5.2: remarcada, a sessao volta a pedir a confirmacao
  else if (tipo === 'pedido_aprovado') t = { assunto: 'Pedido aprovado — COGNIATIVO', titulo: 'Seu pedido foi aprovado',
    paragrafo: prof + ' aprovou o seu pedido. A sessão está marcada para ' + _ageQuando_(x) + '.', botao: 'Confirmar presença', aviso: '', sob: sobConfirmar, confirma: true }; // 14.5.4: pedido aprovado sempre pede a confirmacao (o paciente confirma depois, mesmo tendo pedido o horario)
  else if (tipo === 'pedido_recusado') t = { assunto: 'Pedido respondido — COGNIATIVO', titulo: 'Seu pedido não foi aprovado',
    paragrafo: prof + ' não pôde aprovar o horário pedido (' + _ageDataBR_(x.data) + ' às ' + _lemHora_(x.hora_inicio) + '). Veja outros horários em Minhas sessões ou fale diretamente com ' + prof + '.', botao: 'Ver minhas sessões', aviso: '' };
  else t = { assunto: 'Agenda — movimento de paciente', titulo: 'Movimento na sua agenda', paragrafo: String(p.frase || ''), botao: 'Abrir a Agenda', aviso: '' };
  // sessao ja confirmada (ou sem link): o botao volta a ser o do sistema e a frase avisa
  var link = SITE_URL, sob = EMAIL_LEMBRETE_SOB_BOTAO;
  if (t.confirma && p.confirmada) { t.paragrafo += ' Sua presença já está confirmada.'; t.botao = 'Ver minhas sessões'; }
  else if (t.confirma && p.link) { link = p.link; sob = t.sob; }
  else if (t.confirma) { t.botao = 'Ver minhas sessões'; }
  // 14.5: onde a sessao acontece — endereco (com link do mapa) na presencial, sala do Meet na on-line
  var extra = null;
  if (['confirmacao', 'serie', 'lembrete48', 'lembrete', 'remarcacao', 'pedido_aprovado'].indexOf(tipo) !== -1) {
    if (x.modalidade === 'online' && p.meet) { t.paragrafo += ' A sessão acontece pelo Google Meet.'; extra = { rotulo: 'Entrar na sessão on-line', url: p.meet }; }
    else if (x.modalidade !== 'online' && p.endereco) { t.paragrafo += ' Endereço: ' + p.endereco + '.'; extra = { rotulo: 'Abrir o endereço no mapa', url: _ageMapa_(p.endereco) }; }
  }
  if (tipo === 'pedido_recusado' && !x.data) t.paragrafo = prof + ' não pôde atender ao horário que você sugeriu. Veja outros horários em Minhas sessões ou fale diretamente com ' + prof + '.';
  var ola = p.nome ? 'Olá, ' + p.nome + '.' : 'Olá.';
  var ass = p.assinatura || [];
  var texto = [EMAIL_DESTAQUE, '', ola, '', t.paragrafo, ''].concat(extra ? [extra.rotulo + ': ' + extra.url, ''] : []).concat([link, '']).concat(link !== SITE_URL ? [sob, ''] : []).concat(t.aviso ? [t.aviso, ''] : []).concat(ass).join('\n');
  var html = _layoutEmail_({ previa: t.titulo, titulo: t.titulo, acompanhamento: '', ola: ola, paragrafo: t.paragrafo, botao: t.botao,
    sobBotao: sob, link: link, aviso: t.aviso, assinatura: ass, linkExtra: extra });
  return { assunto: t.assunto, texto: texto, html: html };
}

/**
 * Manda um aviso de sessao ao PACIENTE. So sai com a chave geral ligada, paciente ativo e com e-mail,
 * cota do dia livre e, quando `caixa` e dada, com a caixa daquele aviso marcada na sessao.
 * Devolve '' (enviado) ou o motivo: desligado | caixa | inativo | sem_email | sem_conexao | cota | falha.
 */
function _ageAvisarPaciente_(ctx, profId, pac, tipo, sessao, caixa, extra) {
  var forcar = !!(extra && extra.forcar); // 14.4: "Enviar e-mail agora" e decisao do profissional, sessao por sessao — nao depende da chave nem da caixa
  if (!forcar && ctx.cfg.avisos_sessao !== 'Sim') return 'desligado';
  if (!forcar && caixa && _ageAvisosLista_(sessao.avisos).indexOf(caixa) === -1) return 'caixa';
  if (!pac || !pac.ativo) return 'inativo';
  if (!pac.email) return 'sem_email';
  if (!_emailPermitido_(profId)) return 'sem_conexao'; // 14.10
  if (!_reservarEmail_('sessoes')) return 'cota';
  var prof = buscarProfissional(profId) || {};
  var p = { nome: pac.primeiro, profissional: String(prof.nome_completo || '').trim(), sessao: sessao, horas: ctx.cfg.antecedencia_min_horas,
    assinatura: _assinaturaDoProfissional_(profId), link: _ageLinkConfirmar_(profId, sessao.id), confirmada: !!sessao.confirmada_em };
  for (var k in (extra || {})) p[k] = extra[k];
  // 14.5: endereco (presencial), sala do Meet (on-line: espelha a sessao agora se ainda nao ha link) e o evento em anexo
  if (sessao.modalidade === 'online') {
    if (!sessao.meet_link && sessao.id && ctx.controle && tipo !== 'cancelamento' && tipo !== 'pedido_recusado') sessao.meet_link = _calSincronizar_(ctx.controle, profId, { ids: [sessao.id], max: 1 })[sessao.id] || '';
    p.meet = sessao.meet_link || '';
  } else if (sessao.data) {
    p.endereco = _ageEndereco_(ctx.cfg, sessao.data);
  }
  var email = montarEmailSessao(tipo, p);
  var icsDe = { confirmacao: 'PUBLISH', serie: 'PUBLISH', remarcacao: 'PUBLISH', pedido_aprovado: 'PUBLISH', cancelamento: 'CANCEL' }[tipo];
  if (icsDe && sessao.id && sessao.data) {
    var lista = (p.sessoes && p.sessoes.length) ? p.sessoes : [sessao];
    email.anexo = { nome: 'sessao.ics', metodo: icsDe, texto: _ageIcs_(lista, p.profissional, ctx.cfg, icsDe, _ageAgoraUtc_()) };
  }
  return _enviarEmail_(pac.email, email, profId) ? '' : 'falha';
}

/** Avisa o PROFISSIONAL de um movimento feito pelo paciente (mesma chave geral). Nunca derruba a acao que chamou. */
function _ageAvisarProfissional_(ctx, profId, frase) {
  try {
    if (ctx.cfg.avisos_sessao !== 'Sim') return 'desligado';
    var prof = buscarProfissional(profId) || {};
    var email = normalizarEmail(prof.email);
    if (!email) return 'sem_email';
    if (!_emailPermitido_(profId)) return 'sem_conexao'; // 14.10: o aviso ao profissional sai da conta dele mesmo
    if (!_reservarEmail_('sessoes')) return 'cota';
    var nome = String(prof.nome_completo || '').trim().split(/\s+/)[0] || '';
    return _enviarEmail_(email, montarEmailSessao('profissional', { nome: nome, frase: frase, assinatura: [] }), profId) ? '' : 'falha';
  } catch (e) {
    console.error('agenda: aviso ao profissional nao saiu: ' + String(e && e.message || e).slice(0, 160));
    return 'falha';
  }
}

// ---------- acoes do profissional ----------

/** Agenda do periodo (padrao: de 7 dias atras a 5 semanas a frente). */
function profLerAgenda(s, de, ate) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var ctx = _ageCtx_(alvo.controle, false);
  ctx.profId = alvo.profissionalId;
  var r = _ageLeitura_(ctx, de, ate, _agePacientes_(alvo.controle), _lemAgora_());
  r.ok = true;
  return r;
}

/**
 * Cria ou edita uma sessao. `dados`: { id, sigla, data, hora, duracao_min, modalidade, valor, notas, avisos,
 *   repeticao (cria a serie), reposicao_de (liga a sessao cobrada que esta repoe), escopo ('seguintes' ao editar
 *   sessao de serie), simular }. Com `simular: true` nada e gravado: volta a lista de datas, as puladas, as em
 * feriado e o conflito. O `id` vem da tela: salvar de novo o mesmo id edita, nunca duplica.
 */
function profSalvarSessao(s, dados, periodo) {
  var d = dados && typeof dados === 'object' ? dados : {};
  var alvo = _lembreteAlvo_(s, d.sigla);
  if (!alvo.ok) return alvo;
  if (!_ageIdValido_(d.id)) return { ok: false, erro: 'Parametros incompletos' };
  var id = String(d.id).trim(), simular = d.simular === true;
  var ctx = _ageCtx_(alvo.controle, !simular);
  var agora = _lemAgora_();
  var v = _ageValidarSessao_(d, ctx.cfg);
  if (!v.ok) return v;
  var janelas = _ageJanelas_(alvo.controle);
  var iniMin = _ageMin_(v.hora);
  var pac = _agePacientes_(alvo.controle)[_siglaChave_(alvo.sigla)];
  var existente = ctx.sessoes.filter(function (x) { return x.id === id; })[0];
  var avisoDe = function (iso) {
    return { fora_grade: !_ageNaGrade_(janelas, iso, iniMin, v.dur), passado: _ageMinutosAte_(iso, v.hora, agora) < 0, feriado: _ageFeriadoEm_(iso) };
  };

  if (existente) {
    if (_siglaChave_(existente.sigla) !== _siglaChave_(alvo.sigla) || !_ageAtiva_(existente)) return { ok: false, erro: MSG_AGE_NAO_ACHEI };
    var mudouQuando = existente.data !== v.data || _lemHora_(existente.hora_inicio) !== v.hora || _ageDur_(existente.duracao_min, ctx.cfg.duracao_slot_min) !== v.dur;
    // 14.6: "esta e as seguintes" leva tambem o DIA — as seguintes da serie andam o mesmo numero de dias (terca -> quinta: todas vao para quinta)
    var delta = _lemDia_(v.data) - _lemDia_(existente.data);
    var seguintes = (d.escopo === 'seguintes' && existente.serie_id) ? ctx.sessoes.filter(function (x) { return x.serie_id === existente.serie_id && x.id !== id && x.data > existente.data && x.estado === 'agendada'; }) : [];
    var plano = _ageSeguintesPlano_(ctx, seguintes, delta, v.hora, v.dur, id);
    var proprio = {}; proprio[id] = true;
    plano.movidas.forEach(function (m) { proprio[m.x.id] = true; }); // as que saem do lugar nao contam como ocupacao
    var oc = mudouQuando ? _ageOcupado_(ctx, v.data, v.hora, v.dur, proprio) : '';
    if (simular) return { ok: true, simulacao: { datas: oc ? [] : [v.data].concat(plano.movidas.map(function (m) { return m.data; })), puladas: (oc ? [v.data] : []).concat(plano.puladas),
      conflito: oc, avisos: avisoDe(v.data), seguintes: seguintes.length } };
    if (oc) return _ageRecusa_(oc);
    var anterior = { data: existente.data, hora_inicio: existente.hora_inicio };
    var campos = { data: v.data, hora_inicio: v.hora, duracao_min: String(v.dur), modalidade: v.modalidade, valor: existente.reposicao_de ? existente.valor : v.valor,
      notas: v.notas, avisos: v.avisos, atualizado_em: agora.carimbo };
    if (mudouQuando) { // 14.4: a confirmacao cai e os lembretes voltam a valer para a data nova
      var marcas = _ageMarcasLembrete_(v.data, v.hora, agora);
      campos.confirmada_em = ''; campos.ultimo_aviso_em = marcas.ultimo_aviso_em; campos.lembrete48_em = marcas.lembrete48_em;
    }
    _ageGravar_(ctx.abaS, COLUNAS_SESSOES, existente.__linha, campos);
    var naoAlteradas = plano.puladas;
    plano.movidas.forEach(function (m) {
      var x = m.x, camposSeg = { hora_inicio: v.hora, duracao_min: String(v.dur), modalidade: v.modalidade, valor: v.valor, notas: v.notas, avisos: v.avisos, atualizado_em: agora.carimbo };
      if (m.data !== m.de || m.horaDe !== v.hora) { // mudou o dia ou a hora: o paciente confirma de novo e os lembretes valem para a data nova
        var marcasSeg = _ageMarcasLembrete_(m.data, v.hora, agora);
        camposSeg.data = m.data; camposSeg.confirmada_em = ''; camposSeg.ultimo_aviso_em = marcasSeg.ultimo_aviso_em; camposSeg.lembrete48_em = marcasSeg.lembrete48_em;
      }
      _ageGravar_(ctx.abaS, COLUNAS_SESSOES, x.__linha, camposSeg);
    });
    if (delta !== 0 && plano.movidas.length) { // a regra da serie acompanha o dia novo (so a semanal guarda dias da semana)
      var serie = ctx.series.filter(function (y) { return y.id === existente.serie_id; })[0];
      if (serie && serie.unidade === 'semana' && String(serie.dias_semana || '').trim()) {
        var diasNovos = String(serie.dias_semana).split(',').filter(String).map(function (n) { return ((((parseInt(n, 10) - 1 + delta) % 7) + 7) % 7) + 1; })
          .filter(function (n, i, a) { return a.indexOf(n) === i; }).sort(function (a, b) { return a - b; });
        _ageGravar_(ctx.abaR, COLUNAS_SERIES, serie.__linha, { dias_semana: diasNovos.join(',') });
      }
    }
    var resp = { ok: true, editada: true, remarcada: mudouQuando, nao_alteradas: naoAlteradas, movidas: plano.movidas.length };
    if (mudouQuando && (existente.data !== v.data || _lemHora_(existente.hora_inicio) !== v.hora)) {
      resp.aviso = AGE_EMAIL_AUTOMATICO ? _ageAvisarPaciente_(ctx, alvo.profissionalId, pac, 'remarcacao', { id: id, data: v.data, hora_inicio: v.hora, modalidade: v.modalidade, avisos: v.avisos, duracao_min: String(v.dur) }, 'cancelamento', { anterior: { data: existente.data, hora_inicio: existente.hora_inicio } }) : 'clique'; // 14.13
    }
    return _ageResposta_(alvo, resp, periodo, agora);
  }

  var base = { sigla: alvo.sigla, hora_inicio: v.hora, duracao_min: String(v.dur), modalidade: v.modalidade, valor: v.valor, notas: v.notas,
    estado: 'agendada', origem: 'profissional', avisos: v.avisos, criado_em: agora.carimbo, criado_por: String(alvo.nome || ''), atualizado_em: agora.carimbo };

  var repoe = String(d.reposicao_de || '').trim();
  if (repoe) {
    var orig = ctx.sessoes.filter(function (x) { return x.id === repoe; })[0];
    if (!orig || _siglaChave_(orig.sigla) !== _siglaChave_(alvo.sigla) || !_agePodeRepor_(ctx, orig)) return { ok: false, erro: 'Esta sessão não pode ser reposta.' };
    base.reposicao_de = repoe; base.valor = orig.valor; base.cobrada = 'Nao';
  }

  if (d.repeticao && !repoe) {
    var rg = _ageRegra_(d.repeticao);
    if (!rg.ok) return rg;
    var serie = _ageSerie_(rg.regra, v.data, function (iso) { return !!_ageOcupado_(ctx, iso, v.hora, v.dur, null); });
    if (!serie.ok) return serie;
    var sim = { datas: serie.datas, puladas: serie.puladas, feriados: serie.feriados, pulados_feriado: serie.pulados_feriado,
      fora_grade: serie.datas.filter(function (iso) { return !_ageNaGrade_(janelas, iso, iniMin, v.dur); }),
      passado: serie.datas.filter(function (iso) { return _ageMinutosAte_(iso, v.hora, agora) < 0; }) };
    if (simular) return { ok: true, simulacao: sim };
    if (!serie.datas.length) return _ageRecusa_('ocupado');
    var serieId = 'serie-' + id.slice(0, 50);
    _ageGravar_(ctx.abaR, COLUNAS_SERIES, 0, { id: serieId, sigla: alvo.sigla, cada: String(rg.regra.cada), unidade: rg.regra.unidade, dias_semana: rg.regra.dias_semana.join(','),
      modo_mes: rg.regra.modo_mes, fim_tipo: rg.regra.fim_tipo, fim_n: rg.regra.fim_n ? String(rg.regra.fim_n) : '', fim_data: rg.regra.fim_data, ocupado: 'pular', criada_em: agora.carimbo });
    serie.datas.forEach(function (iso, i) {
      var linha = {}; for (var k in base) linha[k] = base[k];
      linha.id = i === 0 ? id : id.slice(0, 58) + '-' + (i + 1); linha.data = iso; linha.serie_id = serieId;
      _ageNovaSessao_(ctx, agora, linha);
    });
    var respS = { ok: true, criadas: serie.datas.length, simulacao: sim };
    respS.aviso = !AGE_EMAIL_AUTOMATICO ? 'clique' : _ageAvisarPaciente_(ctx, alvo.profissionalId, pac, serie.datas.length > 1 ? 'serie' : 'confirmacao', // 14.13
      { id: id, data: serie.datas[0], hora_inicio: v.hora, modalidade: v.modalidade, avisos: v.avisos, duracao_min: String(v.dur) }, 'confirmacao',
      { n: serie.datas.length, sessoes: serie.datas.map(function (iso, i) { return { id: i === 0 ? id : id.slice(0, 58) + '-' + (i + 1), data: iso, hora_inicio: v.hora, modalidade: v.modalidade, duracao_min: String(v.dur) }; }) }); // 14.5: o anexo leva todas as datas
    return _ageResposta_(alvo, respS, periodo, agora);
  }

  var ocN = _ageOcupado_(ctx, v.data, v.hora, v.dur, null);
  if (simular) return { ok: true, simulacao: { datas: ocN ? [] : [v.data], puladas: ocN ? [v.data] : [], conflito: ocN, avisos: avisoDe(v.data) } };
  if (ocN) return _ageRecusa_(ocN);
  base.id = id; base.data = v.data;
  _ageNovaSessao_(ctx, agora, base);
  var respN = { ok: true, criadas: 1 };
  if (_ageMinutosAte_(v.data, v.hora, agora) >= 0) respN.aviso = !AGE_EMAIL_AUTOMATICO ? 'clique' : _ageAvisarPaciente_(ctx, alvo.profissionalId, pac, 'confirmacao', { id: id, data: v.data, hora_inicio: v.hora, modalidade: v.modalidade, avisos: v.avisos, duracao_min: String(v.dur) }, 'confirmacao'); // 14.13
  return _ageResposta_(alvo, respN, periodo, agora);
}

/**
 * Refaz a repeticao a partir de uma sessao: as seguintes da serie que ainda estao agendadas saem
 * (estado cancelada, cancelada_por edicao_serie — nao e cancelamento de ninguem) e as datas da regra
 * nova entram. `dados`: { id (do envio), sessao_id, repeticao, simular }.
 */
function profEditarSerie(s, dados, periodo) {
  var d = dados && typeof dados === 'object' ? dados : {};
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  if (!_ageIdValido_(d.id)) return { ok: false, erro: 'Parametros incompletos' };
  var id = String(d.id).trim(), simular = d.simular === true;
  var ctx = _ageCtx_(alvo.controle, !simular);
  var agora = _lemAgora_();
  var ref = ctx.sessoes.filter(function (x) { return x.id === String(d.sessao_id || '').trim(); })[0];
  if (!ref || !_ageAtiva_(ref)) return { ok: false, erro: MSG_AGE_NAO_ACHEI };
  var rg = _ageRegra_(d.repeticao);
  if (!rg.ok) return rg;
  var novaId = 'serie-' + id.slice(0, 50);
  if (ctx.series.some(function (x) { return x.id === novaId; })) return _ageResposta_(alvo, { ok: true, duplicado: true }, periodo, agora);
  var saem = ref.serie_id ? ctx.sessoes.filter(function (x) { return x.serie_id === ref.serie_id && x.id !== ref.id && x.data > ref.data && x.estado === 'agendada'; }) : [];
  var fora = {}; fora[ref.id] = true; saem.forEach(function (x) { fora[x.id] = true; });
  var hora = _lemHora_(ref.hora_inicio), dur = _ageDur_(ref.duracao_min, ctx.cfg.duracao_slot_min);
  var serie = _ageSerie_(rg.regra, ref.data, function (iso) { return !!_ageOcupado_(ctx, iso, hora, dur, fora); });
  if (!serie.ok) return serie;
  var janelas = _ageJanelas_(alvo.controle);
  var sim = { datas: serie.datas, puladas: serie.puladas, feriados: serie.feriados, pulados_feriado: serie.pulados_feriado,
    fora_grade: serie.datas.filter(function (iso) { return !_ageNaGrade_(janelas, iso, _ageMin_(hora), dur); }), passado: [] };
  if (simular) return { ok: true, simulacao: sim };
  saem.forEach(function (x) {
    _ageGravar_(ctx.abaS, COLUNAS_SESSOES, x.__linha, { estado: 'cancelada', cancelada_em: agora.carimbo, cancelada_por: 'edicao_serie', cobrada: 'Nao', atualizado_em: agora.carimbo });
  });
  var antiga = ref.serie_id ? ctx.series.filter(function (x) { return x.id === ref.serie_id; })[0] : null;
  if (antiga && !antiga.encerrada_em) _ageGravar_(ctx.abaR, COLUNAS_SERIES, antiga.__linha, { encerrada_em: agora.carimbo });
  _ageGravar_(ctx.abaR, COLUNAS_SERIES, 0, { id: novaId, sigla: ref.sigla, cada: String(rg.regra.cada), unidade: rg.regra.unidade, dias_semana: rg.regra.dias_semana.join(','),
    modo_mes: rg.regra.modo_mes, fim_tipo: rg.regra.fim_tipo, fim_n: rg.regra.fim_n ? String(rg.regra.fim_n) : '', fim_data: rg.regra.fim_data, ocupado: 'pular', criada_em: agora.carimbo });
  _ageGravar_(ctx.abaS, COLUNAS_SESSOES, ref.__linha, { serie_id: novaId, atualizado_em: agora.carimbo });
  var n = 0;
  serie.datas.forEach(function (iso) {
    if (iso === ref.data) return;
    n++;
    _ageNovaSessao_(ctx, agora, { id: id.slice(0, 58) + '-' + n, sigla: ref.sigla, data: iso, hora_inicio: hora, duracao_min: String(dur), modalidade: ref.modalidade,
      valor: ref.valor, notas: ref.notas, serie_id: novaId, estado: 'agendada', origem: 'profissional', avisos: ref.avisos,
      criado_em: agora.carimbo, criado_por: String(alvo.nome || ''), atualizado_em: agora.carimbo });
  });
  return _ageResposta_(alvo, { ok: true, criadas: n, retiradas: saem.length, simulacao: sim }, periodo, agora);
}

/**
 * Cancela uma sessao agendada. `opcoes`: { escopo: 'esta' | 'seguintes', quem: 'paciente' | 'profissional', avisar }.
 * A cobranca segue a tabela: pedido do paciente com menos que a antecedencia combinada = cobrada.
 */
function profCancelarSessao(s, id, opcoes, periodo) {
  var o = opcoes && typeof opcoes === 'object' ? opcoes : {};
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var ctx = _ageCtx_(alvo.controle, false);
  var agora = _lemAgora_();
  var ref = ctx.sessoes.filter(function (x) { return x.id === String(id || '').trim(); })[0];
  if (!ref) return { ok: false, erro: MSG_AGE_NAO_ACHEI };
  if (ref.estado === 'cancelada') return _ageResposta_(alvo, { ok: true, duplicado: true, canceladas: 0 }, periodo, agora);
  if (ref.estado !== 'agendada' && ref.estado !== '') return { ok: false, erro: 'Esta consulta já tem situação marcada e não pode ser cancelada.' };
  var quem = o.quem === 'paciente' ? 'paciente' : 'profissional';
  var lista = [ref];
  if (o.escopo === 'seguintes' && ref.serie_id) {
    ctx.sessoes.forEach(function (x) { if (x.serie_id === ref.serie_id && x.id !== ref.id && x.data > ref.data && x.estado === 'agendada') lista.push(x); });
    var regra = ctx.series.filter(function (x) { return x.id === ref.serie_id; })[0];
    if (regra && !regra.encerrada_em) _ageGravar_(ctx.abaR, COLUNAS_SERIES, regra.__linha, { encerrada_em: agora.carimbo });
  }
  lista.forEach(function (x) {
    var noPrazo = _ageNoPrazo_(x.data, x.hora_inicio, agora, ctx.cfg.antecedencia_min_horas);
    _ageGravar_(ctx.abaS, COLUNAS_SESSOES, x.__linha, { estado: 'cancelada', cancelada_em: agora.carimbo, cancelada_por: quem,
      cobrada: _ageCobrada_(quem === 'paciente' ? 'cancel_paciente' : 'cancel_profissional', noPrazo, !!x.reposicao_de), atualizado_em: agora.carimbo });
    _agePedidosFechar_(ctx, x.id, agora);
  });
  var resp = { ok: true, canceladas: lista.length };
  resp.aviso = !AGE_EMAIL_AUTOMATICO ? 'clique' : (o.avisar === true ? _ageAvisarPaciente_(ctx, alvo.profissionalId, _agePacientes_(alvo.controle)[_siglaChave_(ref.sigla)], 'cancelamento', ref, '') : 'caixa'); // 14.13
  return _ageResposta_(alvo, resp, periodo, agora);
}

/** Pedidos pendentes de uma sessao que deixou de existir como estava: recusados. */
function _agePedidosFechar_(ctx, sessaoId, agora) {
  ctx.pedidos.forEach(function (p) {
    if (p.sessao_id === sessaoId && p.estado === 'pendente') { _ageGravar_(ctx.abaP, COLUNAS_PEDIDOS_AGENDA, p.__linha, { estado: 'recusado', decidido_em: agora.carimbo }); p.estado = 'recusado'; }
  });
}

/** Situacao: 'realizada' | 'falta' | '' (volta a ficar sem marcacao). */
function profMarcarSituacao(s, id, situacao, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var ctx = _ageCtx_(alvo.controle, false);
  var agora = _lemAgora_();
  var x = ctx.sessoes.filter(function (y) { return y.id === String(id || '').trim(); })[0];
  if (!x || !_ageAtiva_(x)) return { ok: false, erro: MSG_AGE_NAO_ACHEI };
  var estado = situacao === 'realizada' ? 'realizada' : (situacao === 'falta' ? 'falta' : 'agendada');
  if (estado === 'agendada' && _ageRepostaEm_(ctx, x.id)) return { ok: false, erro: 'Esta sessão já foi reposta. Cancele a reposição antes de mudar o status.' };
  _ageGravar_(ctx.abaS, COLUNAS_SESSOES, x.__linha, { estado: estado, cobrada: estado === 'agendada' ? (x.reposicao_de ? 'Nao' : '') : _ageCobrada_(estado, true, !!x.reposicao_de), atualizado_em: agora.carimbo });
  return _ageResposta_(alvo, { ok: true }, periodo, agora);
}

/** Cria ou edita um bloqueio. `dados`: { id, data_inicio, hora_inicio, data_fim, hora_fim, dia_todo, nome }. */
function profSalvarBloqueio(s, dados, periodo) {
  var d = dados && typeof dados === 'object' ? dados : {};
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  if (!_ageIdValido_(d.id)) return { ok: false, erro: 'Parametros incompletos' };
  var todo = d.dia_todo === true || String(d.dia_todo).toLowerCase() === 'sim';
  var b = { id: String(d.id).trim(), data_inicio: String(d.data_inicio || '').trim(), data_fim: String(d.data_fim || d.data_inicio || '').trim(),
    hora_inicio: todo ? '' : _lemHora_(d.hora_inicio), hora_fim: todo ? '' : _lemHora_(d.hora_fim), dia_todo: todo ? 'Sim' : 'Nao',
    nome: String(d.nome === undefined || d.nome === null ? '' : d.nome).replace(/\s+/g, ' ').trim().slice(0, 80) };
  var di = _lemDia_(b.data_inicio), df = _lemDia_(b.data_fim);
  if (di === null || df === null) return { ok: false, erro: 'Escolha a data.' };
  if (!todo && (!b.hora_inicio || !b.hora_fim)) return { ok: false, erro: 'Escolha o horário.' };
  if (df < di || (df === di && !todo && b.hora_fim <= b.hora_inicio)) return { ok: false, erro: 'A data de término não pode ser antes do início.' };
  if (df - di > AGENDA_SERIE_DIAS) return { ok: false, erro: MSG_AGE_TETO };
  var ctx = _ageCtx_(alvo.controle, true);
  var agora = _lemAgora_();
  var pega = ctx.sessoes.some(function (x) {
    return (x.estado === 'agendada' || x.estado === '') && _ageBloqueioPega_(b, x.data, _ageMin_(x.hora_inicio), _ageDur_(x.duracao_min, ctx.cfg.duracao_slot_min));
  });
  if (pega) return { ok: false, codigo: 'sessoes', erro: MSG_AGE_BLOQ_SESSOES };
  var existente = ctx.bloqueios.filter(function (x) { return x.id === b.id; })[0];
  _ageGravar_(ctx.abaB, COLUNAS_BLOQUEIOS, existente ? existente.__linha : 0, b);
  return _ageResposta_(alvo, { ok: true }, periodo, agora);
}

function profApagarBloqueio(s, id, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var ctx = _ageCtx_(alvo.controle, false);
  var b = ctx.bloqueios.filter(function (x) { return x.id === String(id || '').trim(); })[0];
  if (b) { ctx.abaB.deleteRow(b.__linha); _ageEsquecer_(ctx.abaB); } // 14.12
  return _ageResposta_(alvo, { ok: true }, periodo, _lemAgora_());
}

/** Aprova (a sessao nasce, muda ou a reposicao nasce) ou recusa um pedido do paciente. `quando` { data, hora }: aprovar em outro horario. */
function profDecidirPedido(s, id, aprovar, periodo, quando) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var ctx = _ageCtx_(alvo.controle, false);
  var agora = _lemAgora_();
  var p = ctx.pedidos.filter(function (x) { return x.id === String(id || '').trim(); })[0];
  if (!p) return { ok: false, erro: 'Pedido não encontrado.' };
  if (p.estado !== 'pendente') return _ageResposta_(alvo, { ok: true, duplicado: true }, periodo, agora);
  var ehAgendar = p.tipo === 'agendar'; // 14.7: pedido de agendamento — nao ha sessao ate ser aprovado
  var x = ehAgendar ? null : ctx.sessoes.filter(function (y) { return y.id === p.sessao_id; })[0];
  var pac = _agePacientes_(alvo.controle)[_siglaChave_(p.sigla)];
  // 14.5: `quando` { data, hora } = o horario que o profissional escolheu (obrigatorio quando o paciente so escreveu o horario ideal)
  var q = quando && typeof quando === 'object' ? quando : {};
  var escolheu = _lemDia_(q.data) !== null && !!_lemHora_(q.hora);
  var dataPed = escolheu ? String(q.data).trim() : p.data;
  var hora = escolheu ? _lemHora_(q.hora) : _lemHora_(p.hora);
  if (aprovar !== true) {
    _ageGravar_(ctx.abaP, COLUNAS_PEDIDOS_AGENDA, p.__linha, { estado: 'recusado', decidido_em: agora.carimbo });
    var av = !AGE_EMAIL_AUTOMATICO ? 'clique' : _ageAvisarPaciente_(ctx, alvo.profissionalId, pac, 'pedido_recusado', { data: p.data, hora_inicio: _lemHora_(p.hora), modalidade: ehAgendar ? p.modalidade : (x ? x.modalidade : ''), avisos: '' }, ''); // 14.13
    return _ageResposta_(alvo, { ok: true, aprovado: false, aviso: av, pedido: p.id }, periodo, agora);
  }
  if (ehAgendar) {
    // 14.7: aprovado (no horario pedido ou em outro), a sessao nasce A CONFIRMAR (14.5.4) e o e-mail "Pedido aprovado" leva o botao "Confirmar presenca"
    if (_lemDia_(dataPed) === null || !hora) return { ok: false, codigo: 'sem_horario', erro: 'Escolha o horário.' };
    if (!(_ageMinutosAte_(dataPed, hora, agora) > 0)) return { ok: false, codigo: 'passou', erro: MSG_AGE_PEDIDO_PASSOU };
    var durA = ctx.cfg.duracao_slot_min;
    if (_ageOcupado_(ctx, dataPed, hora, durA, null)) return { ok: false, codigo: 'ocupado', erro: MSG_AGE_PEDIDO_OCUPADO };
    // a modalidade pedida vale se a Grade a oferece naquele horario; senao, a que a Grade oferece
    var modA = p.modalidade === 'online' ? 'online' : 'presencial', modsA = [], dowA = _ageDow_(_lemDia_(dataPed)), iniA = _ageMin_(hora);
    _ageJanelas_(alvo.controle).forEach(function (j) {
      if (j.dia_semana !== dowA || iniA < j.ini || iniA + durA > j.fim) return;
      (j.modalidade === 'ambas' ? ['presencial', 'online'] : [j.modalidade === 'online' ? 'online' : 'presencial']).forEach(function (m) { if (modsA.indexOf(m) === -1) modsA.push(m); });
    });
    if (modsA.length && modsA.indexOf(modA) === -1) modA = modsA[0];
    var idS = 'ag-' + p.id.slice(0, 56);
    var nova = { id: idS, sigla: p.sigla, data: dataPed, hora_inicio: hora, duracao_min: String(durA), modalidade: modA, valor: pac ? pac.valor : '', notas: '',
      estado: 'agendada', origem: 'pedido', avisos: AGENDA_AVISOS.join(','), criado_em: agora.carimbo, criado_por: String(alvo.nome || ''), atualizado_em: agora.carimbo };
    _ageNovaSessao_(ctx, agora, nova);
    _ageGravar_(ctx.abaP, COLUNAS_PEDIDOS_AGENDA, p.__linha, { estado: 'aprovado', decidido_em: agora.carimbo, sessao_id: idS, data: dataPed, hora: hora });
    var avG = !AGE_EMAIL_AUTOMATICO ? 'clique' : _ageAvisarPaciente_(ctx, alvo.profissionalId, pac, 'pedido_aprovado', nova, ''); // 14.13
    return _ageResposta_(alvo, { ok: true, aprovado: true, data: dataPed, hora: hora, aviso: avG, pedido: p.id }, periodo, agora);
  }
  if (!x) return { ok: false, erro: MSG_AGE_NAO_ACHEI };
  if (_lemDia_(dataPed) === null || !hora) return { ok: false, codigo: 'sem_horario', erro: 'Escolha o horário.' };
  var dur = _ageDur_(x.duracao_min, ctx.cfg.duracao_slot_min);
  var fora = {};
  if (p.tipo === 'remarcar') {
    if (x.estado !== 'agendada' && x.estado !== '') return { ok: false, erro: MSG_AGE_NAO_ACHEI };
    fora[x.id] = true;
  } else if (!_agePodeRepor_(ctx, x)) {
    return { ok: false, erro: 'Esta sessão não pode ser reposta.' };
  }
  if (_ageOcupado_(ctx, dataPed, hora, dur, fora)) return { ok: false, codigo: 'ocupado', erro: MSG_AGE_PEDIDO_OCUPADO };
  // 14.5.4 (decisao do usuario, 23/11/2026): o paciente SEMPRE confirma depois — mesmo quando foi ele quem pediu o horario.
  // Toda sessao remarcada ou reposta por pedido fica a confirmar e o e-mail "Pedido aprovado" leva o botao "Confirmar presenca".
  if (p.tipo === 'remarcar') {
    var marcasPed = _ageMarcasLembrete_(dataPed, hora, agora);
    _ageGravar_(ctx.abaS, COLUNAS_SESSOES, x.__linha, { data: dataPed, hora_inicio: hora, confirmada_em: '', ultimo_aviso_em: marcasPed.ultimo_aviso_em, lembrete48_em: marcasPed.lembrete48_em, atualizado_em: agora.carimbo });
  } else {
    _ageNovaSessao_(ctx, agora, { id: 'rep-' + p.id.slice(0, 56), sigla: x.sigla, data: dataPed, hora_inicio: hora, duracao_min: String(dur), modalidade: x.modalidade,
      valor: x.valor, notas: '', estado: 'agendada', cobrada: 'Nao', reposicao_de: x.id, origem: 'paciente', avisos: x.avisos,
      criado_em: agora.carimbo, criado_por: String(alvo.nome || ''), atualizado_em: agora.carimbo });
  }
  _ageGravar_(ctx.abaP, COLUNAS_PEDIDOS_AGENDA, p.__linha, escolheu ? { estado: 'aprovado', decidido_em: agora.carimbo, data: dataPed, hora: hora } : { estado: 'aprovado', decidido_em: agora.carimbo });
  var avA = !AGE_EMAIL_AUTOMATICO ? 'clique' : _ageAvisarPaciente_(ctx, alvo.profissionalId, pac, 'pedido_aprovado', { id: p.tipo === 'remarcar' ? x.id : 'rep-' + p.id.slice(0, 56), data: dataPed, hora_inicio: hora, modalidade: x.modalidade, avisos: '', duracao_min: String(dur) }, ''); // 14.13
  return _ageResposta_(alvo, { ok: true, aprovado: true, data: dataPed, hora: hora, aviso: avA, pedido: p.id }, periodo, agora);
}

/**
 * 14.6: para onde vai cada sessao seguinte da serie quando a sessao aberta muda (`delta` dias, hora e duracao novas).
 * Devolve { movidas: [{ x, data }], puladas: [datas que ficam como estao] }. Horario ocupado ou bloqueado no destino: a sessao
 * fica onde esta. Quem vai sair do lugar nao conta como ocupacao; quem fica, conta (a ordem evita que uma caia sobre a outra).
 */
function _ageSeguintesPlano_(ctx, seguintes, delta, hora, dur, idAberta) {
  var plano = { movidas: [], puladas: [] };
  if (!seguintes.length) return plano;
  var ordem = seguintes.slice().sort(function (a, b) { return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0); });
  if (delta > 0) ordem.reverse(); // andando para a frente, a ultima sai primeiro
  var pendentes = {}; ordem.forEach(function (x) { pendentes[x.id] = true; });
  ordem.forEach(function (x) {
    var destino = _lemIso_(_lemDia_(x.data) + delta);
    var fora = {}; for (var k in pendentes) fora[k] = true; // as que ainda nao foram decididas (vao andar na mesma direcao) + ela mesma
    fora[idAberta] = true; // a sessao aberta tambem sai do lugar antigo
    if (_ageOcupado_(ctx, destino, hora, dur, fora)) { plano.puladas.push(x.data); delete pendentes[x.id]; return; } // fica: passa a contar como ocupacao
    plano.movidas.push({ x: x, data: destino, de: x.data, horaDe: _lemHora_(x.hora_inicio) });
    delete pendentes[x.id];
    x.data = destino; x.hora_inicio = hora; x.duracao_min = String(dur); // ja no lugar novo: e ali que ela ocupa para as proximas da fila
  });
  plano.movidas.sort(function (a, b) { return a.data < b.data ? -1 : 1; });
  plano.puladas.sort();
  return plano;
}

/** 14.6: valor da sessao no cadastro do paciente (coluna `valor_sessao` da aba Pacientes da Controle, texto literal). A nova consulta ja abre com ele. */
function profSalvarValorSessao(s, siglaPaciente, valor) {
  var auth = _authProfissional_(s);
  if (!auth.ok) return auth;
  var profId = auth.profissional.profissional_id;
  var dono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!dono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (dono !== profId) return { ok: false, erro: 'Este paciente nao pertence a voce' };
  var controle = abrirControleDoProfissional(profId);
  var aba = controle ? controle.getSheetByName(ABA_PACIENTES) : null;
  if (!aba) return { ok: false, erro: 'Paciente não encontrado na Controle.' };
  var v = String(valor === undefined || valor === null ? '' : valor).replace(/[^0-9.,]/g, '').slice(0, 12);
  if (!_atualizarLinhaPorChave_(aba, 'sigla', siglaPaciente, {}, { valor_sessao: _lemCelula_(v) })) return { ok: false, erro: 'Paciente não encontrado na Controle.' };
  return { ok: true, valor_sessao: v };
}

/** 14.4: zera o contador do sino (guarda o instante em que os eventos foram vistos). */
function profMarcarEventosVistos(s, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var agora = _lemAgora_();
  _ageConfigGravar_(alvo.controle, 'agenda_vistos_ate', agora.carimbo);
  return _ageResposta_(alvo, { ok: true }, periodo, agora);
}

/**
 * 14.4: "Enviar e-mail agora" — manda ao paciente o e-mail da sessao na hora, mesmo com a chave geral desligada.
 * `dados`: { tipo: 'confirmacao' | 'lembrete' | 'remarcacao' | 'cancelamento', anterior: { data, hora } (so em remarcacao) }.
 * Saida: { ok, enviado, motivo ('' | inativo | sem_email | cota | falha), hora }.
 */
function profAvisarSessao(s, id, dados) {
  var d = dados && typeof dados === 'object' ? dados : {};
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var ctx = _ageCtx_(alvo.controle, false), agora = _lemAgora_();
  // 14.13: a resposta a um pedido (aprovado ou recusado) tambem so sai com o clique: `dados.pedido` = id do pedido
  if (d.pedido) {
    var ped = ctx.pedidos.filter(function (y) { return y.id === String(d.pedido).trim(); })[0];
    if (!ped || (ped.estado !== 'aprovado' && ped.estado !== 'recusado')) return { ok: false, erro: 'Pedido não encontrado.' };
    var pacPed = _agePacientes_(alvo.controle)[_siglaChave_(ped.sigla)], motPed;
    if (ped.estado === 'recusado') {
      var orig = ped.tipo === 'agendar' ? null : ctx.sessoes.filter(function (y) { return y.id === ped.sessao_id; })[0];
      motPed = _ageAvisarPaciente_(ctx, alvo.profissionalId, pacPed, 'pedido_recusado', { data: ped.data, hora_inicio: _lemHora_(ped.hora), modalidade: ped.tipo === 'agendar' ? ped.modalidade : (orig ? orig.modalidade : ''), avisos: '' }, '', { forcar: true });
      return { ok: true, enviado: motPed === '', motivo: motPed, hora: agora.hora, tipo: 'pedido_recusado' };
    }
    var idPed = ped.tipo === 'repor' ? 'rep-' + ped.id.slice(0, 56) : (ped.tipo === 'agendar' ? 'ag-' + ped.id.slice(0, 56) : ped.sessao_id);
    var sPed = ctx.sessoes.filter(function (y) { return y.id === idPed; })[0];
    if (!sPed || sPed.estado === 'cancelada') return { ok: false, erro: MSG_AGE_NAO_ACHEI };
    motPed = _ageAvisarPaciente_(ctx, alvo.profissionalId, pacPed, 'pedido_aprovado', sPed, '', { forcar: true });
    return { ok: true, enviado: motPed === '', motivo: motPed, hora: agora.hora, tipo: 'pedido_aprovado' };
  }
  var x = ctx.sessoes.filter(function (y) { return y.id === String(id || '').trim(); })[0];
  if (!x) return { ok: false, erro: MSG_AGE_NAO_ACHEI };
  var tipo = ['confirmacao', 'lembrete', 'remarcacao', 'cancelamento'].indexOf(d.tipo) !== -1 ? d.tipo : 'confirmacao';
  if ((tipo === 'cancelamento') !== (x.estado === 'cancelada')) tipo = x.estado === 'cancelada' ? 'cancelamento' : 'confirmacao';
  var extra = { forcar: true };
  // 14.13: sessoes recorrentes — um e-mail so, com a lista das datas (desta em diante)
  if (d.tipo === 'serie' && x.serie_id && x.estado !== 'cancelada') {
    var irmas = ctx.sessoes.filter(function (y) { return y.serie_id === x.serie_id && _ageAtiva_(y) && y.data >= x.data; })
      .sort(function (a, b) { return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0); });
    if (irmas.length > 1) { tipo = 'serie'; extra.n = irmas.length; extra.sessoes = irmas; }
  }
  if (tipo === 'remarcacao') {
    var ant = d.anterior && typeof d.anterior === 'object' ? d.anterior : {};
    if (_lemDia_(ant.data) === null || !_lemHora_(ant.hora)) tipo = 'confirmacao';
    else extra.anterior = { data: String(ant.data), hora_inicio: _lemHora_(ant.hora) };
  }
  var motivo = _ageAvisarPaciente_(ctx, alvo.profissionalId, _agePacientes_(alvo.controle)[_siglaChave_(x.sigla)], tipo, x, '', extra);
  return { ok: true, enviado: motivo === '', motivo: motivo, hora: agora.hora, tipo: tipo };
}

// ---------- acoes do paciente ----------

/** Paciente do cracha + a Controle do profissional dele. */
function _agePaciente_(sigla) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };
  var controle = abrirControleDoProfissional(paciente.__profissional_id);
  if (!controle) return { ok: false, erro: 'Paciente nao encontrado' };
  var prof = buscarProfissional(paciente.__profissional_id) || {};
  return { ok: true, sigla: String(paciente.sigla).trim(), paciente: paciente, controle: controle, profissionalId: paciente.__profissional_id,
    profissional: String(prof.nome_completo || '').trim(), nome: String(paciente.ind_nome || paciente.nome || paciente.sigla).trim() };
}

/** As sessoes do paciente como a tela "Minhas sessoes" as recebe (sem valor e sem notas). */
function _ageMinhas_(ctx, alvo, agora) {
  var chave = _siglaChave_(alvo.sigla), horas = ctx.cfg.antecedencia_min_horas;
  var pedidos = ctx.pedidos.filter(function (p) { return _siglaChave_(p.sigla) === chave; });
  var sessoes = ctx.sessoes.filter(function (x) { return _siglaChave_(x.sigla) === chave && x.cancelada_por !== 'edicao_serie'; }).map(function (x) {
    var futura = _ageMinutosAte_(x.data, x.hora_inicio, agora) > 0, agendada = x.estado === 'agendada' || x.estado === '';
    var noPrazo = _ageNoPrazo_(x.data, x.hora_inicio, agora, horas);
    var pend = pedidos.filter(function (p) { return p.sessao_id === x.id && p.estado === 'pendente'; })[0];
    var ultimo = pedidos.filter(function (p) { return p.sessao_id === x.id; }).sort(function (a, b) { return a.criado_em < b.criado_em ? 1 : -1; })[0];
    return { id: x.id, data: x.data, hora: _lemHora_(x.hora_inicio), duracao_min: _ageDur_(x.duracao_min, ctx.cfg.duracao_slot_min),
      modalidade: x.modalidade === 'online' ? 'online' : 'presencial', estado: x.estado || 'agendada', reposicao: !!x.reposicao_de,
      reposta_em: _ageRepostaEm_(ctx, x.id), confirmada: !!x.confirmada_em, futura: futura,
      pode_confirmar: agendada && futura && !x.confirmada_em, pode_cancelar: agendada && noPrazo, pode_remarcar: agendada && noPrazo && !pend,
      pode_repor: _agePodeRepor_(ctx, x) && !pend,
      meet_link: (agendada && futura && x.modalidade === 'online') ? (x.meet_link || '') : '', // 14.5
      endereco: (agendada && futura && x.modalidade !== 'online') ? _ageEndereco_(ctx.cfg, x.data) : '',
      mapa: (agendada && futura && x.modalidade !== 'online') ? _ageMapa_(_ageEndereco_(ctx.cfg, x.data)) : '',
      pedido: ultimo ? { tipo: ultimo.tipo, estado: ultimo.estado, data: ultimo.data, hora: _lemHora_(ultimo.hora), sugestao: ultimo.sugestao || '' } : null };
  }).sort(function (a, b) { var p = a.data + ' ' + a.hora, q = b.data + ' ' + b.hora; return p < q ? -1 : (p > q ? 1 : 0); });
  // 14.7: pedidos de agendamento do paciente — o que espera resposta e o que foi recusado ha ate 7 dias (so de horario que ainda nao passou)
  var hojeN = _lemDia_(agora.data);
  var agendar = pedidos.filter(function (p) {
    if (p.tipo !== 'agendar' || !(_ageMinutosAte_(p.data, _lemHora_(p.hora), agora) > 0)) return false;
    if (p.estado === 'pendente') return true;
    var dec = _lemDia_(String(p.decidido_em || '').slice(0, 10));
    return p.estado === 'recusado' && dec !== null && hojeN - dec <= 7;
  }).map(function (p) { return { id: p.id, estado: p.estado, data: p.data, hora: _lemHora_(p.hora), modalidade: p.modalidade === 'online' ? 'online' : 'presencial' }; })
    .sort(function (a, b) { var p = a.data + ' ' + a.hora, q = b.data + ' ' + b.hora; return p < q ? -1 : (p > q ? 1 : 0); });
  return { ok: true, hoje: agora.data, agora_hora: agora.hora, antecedencia_horas: horas, profissional: alvo.profissional, sessoes: sessoes, pedidos_agendar: agendar };
}

/**
 * 14.7: horarios pedidos por pacientes e ainda sem resposta (so os que nao passaram). Enquanto o profissional nao decide,
 * eles ficam fora da lista de horarios livres. `menosId`: pedido cuja reserva nao conta (o profissional escolhendo o horario dele).
 * A reserva nao impede o profissional de marcar ali: quem decide ocupacao continua sendo _ageOcupado_.
 */
function _ageReservas_(ctx, agora, menosId) {
  return ctx.pedidos.filter(function (p) {
    return p.estado === 'pendente' && p.id !== menosId && _lemDia_(p.data) !== null && !!_lemHora_(p.hora) && _ageMinutosAte_(p.data, _lemHora_(p.hora), agora) > 0;
  }).map(function (p) {
    var x = p.sessao_id ? ctx.sessoes.filter(function (y) { return y.id === p.sessao_id; })[0] : null;
    return { data: p.data, ini: _ageMin_(_lemHora_(p.hora)), dur: _ageDur_(x ? x.duracao_min : '', ctx.cfg.duracao_slot_min) };
  });
}

/** Proxima sessao agendada do paciente (para a faixa do Inicio): { data, hora, modalidade } ou null. */
function _ageProxima_(controle, sigla, agora) {
  var chave = _siglaChave_(sigla);
  var lista = _lembretesLer_(_ageAba_(controle, ABA_SESSOES, COLUNAS_SESSOES, false)).filter(function (x) {
    return _siglaChave_(x.sigla) === chave && (x.estado === 'agendada' || x.estado === '') && _ageMinutosAte_(x.data, x.hora_inicio, agora) > 0;
  }).sort(function (a, b) { var p = a.data + ' ' + a.hora_inicio, q = b.data + ' ' + b.hora_inicio; return p < q ? -1 : 1; });
  return lista.length ? { data: lista[0].data, hora: _lemHora_(lista[0].hora_inicio), modalidade: lista[0].modalidade === 'online' ? 'online' : 'presencial' } : null;
}

function lerMinhasSessoes(sigla) {
  var alvo = _agePaciente_(sigla);
  if (!alvo.ok) return alvo;
  return _ageMinhas_(_ageCtx_(alvo.controle, false), alvo, _lemAgora_());
}

/**
 * Horarios livres para o paciente em `dias` dias a partir de `deIso`: janelas da Grade, de
 * `duracao_slot_min` em `duracao_slot_min`, menos sessoes, bloqueios, feriados e o que esta a menos
 * que a antecedencia combinada. Saida: [ { data, hora, modalidades: ['presencial', 'online'] } ].
 */
function _ageLivres_(ctx, janelas, deIso, dias, agora, horas) {
  var ini = _lemDia_(deIso), dur = ctx.cfg.duracao_slot_min, mapa = {}, lista = [];
  if (ini === null) return lista;
  var prazo = horas === undefined ? ctx.cfg.antecedencia_min_horas : horas; // 14.5: o profissional ve os livres sem o prazo do paciente
  var externos = ctx.externos || [];                                        // 14.5: ocupado na agenda pessoal do Google
  var reservas = _ageReservas_(ctx, agora, ctx.semReservaDe);               // 14.7: horarios pedidos e ainda sem resposta
  for (var k = 0; k < dias; k++) {
    var iso = _lemIso_(ini + k), dow = _ageDow_(ini + k);
    if (_ageFeriadoEm_(iso)) continue;
    janelas.forEach(function (j) {
      if (j.dia_semana !== dow) return;
      for (var t = j.ini; t + dur <= j.fim; t += dur) {
        var hora = ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + (t % 60)).slice(-2);
        if (!_ageNoPrazo_(iso, hora, agora, prazo) || _ageMinutosAte_(iso, hora, agora) <= 0) continue; // 14.5: horario que ja comecou nunca e livre
        if (_ageOcupado_(ctx, iso, hora, dur, null)) continue;
        if (reservas.some(function (v) { return v.data === iso && _ageSobrepoe_(t, dur, v.ini, v.dur); })) continue;
        var abs = (ini + k) * 1440 + t;
        if (externos.some(function (e) { return abs < e.fim && e.ini < abs + dur; })) continue;
        var mods = j.modalidade === 'ambas' ? ['presencial', 'online'] : [j.modalidade === 'online' ? 'online' : 'presencial'];
        var chave = iso + ' ' + hora;
        if (!mapa[chave]) { mapa[chave] = { data: iso, hora: hora, modalidades: [] }; lista.push(mapa[chave]); }
        mods.forEach(function (m) { if (mapa[chave].modalidades.indexOf(m) === -1) mapa[chave].modalidades.push(m); });
      }
    });
  }
  return lista.sort(function (a, b) { var p = a.data + ' ' + a.hora, q = b.data + ' ' + b.hora; return p < q ? -1 : (p > q ? 1 : 0); });
}

/** Horarios livres da semana que comeca em `de` (7 dias; padrao: hoje). */
function lerHorariosLivres(sigla, de) {
  var alvo = _agePaciente_(sigla);
  if (!alvo.ok) return alvo;
  var agora = _lemAgora_();
  var deIso = _lemDia_(de) === null || String(de) < agora.data ? agora.data : String(de);
  var ctx = _ageCtx_(alvo.controle, false);
  ctx.externos = _calOcupados_(alvo.profissionalId, ctx.cfg, deIso, 7);
  return { ok: true, de: deIso, hoje: agora.data, livres: _ageLivres_(ctx, _ageJanelas_(alvo.controle), deIso, 7, agora) };
}

/** 14.5: horarios livres para o PROFISSIONAL repor ou remarcar (14 dias a partir de `de`; sem o prazo do paciente). */
function profLerHorariosLivres(s, de, pedido) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var agora = _lemAgora_();
  var deIso = _lemDia_(de) === null || String(de) < agora.data ? agora.data : String(de);
  var ctx = _ageCtx_(alvo.controle, false);
  ctx.semReservaDe = String(pedido === undefined || pedido === null ? '' : pedido).trim(); // 14.7: escolhendo o horario de um pedido, a reserva dele nao conta
  ctx.externos = _calOcupados_(alvo.profissionalId, ctx.cfg, deIso, CAL_LIVRES_DIAS_PROF);
  return { ok: true, de: deIso, hoje: agora.data, dias: CAL_LIVRES_DIAS_PROF, livres: _ageLivres_(ctx, _ageJanelas_(alvo.controle), deIso, CAL_LIVRES_DIAS_PROF, agora, 0) };
}

/** O horario (data, hora) esta entre os livres do paciente? Devolve o slot ou null. */
function _ageSlotLivre_(ctx, controle, data, hora, agora) {
  if (ctx.profId && !ctx.externos) ctx.externos = _calOcupados_(ctx.profId, ctx.cfg, data, 1); // 14.5
  return _ageLivres_(ctx, _ageJanelas_(controle), data, 1, agora).filter(function (x) { return x.hora === hora; })[0] || null;
}

/**
 * 14.7 (decisao do usuario, 23/11/2026): o paciente PEDE o horario; a sessao so nasce quando o profissional aprova.
 * `dados`: { id, data, hora, modalidade }. Grava um pedido `agendar` pendente; o horario fica reservado ate a resposta.
 * O nome da acao nao mudou (chave tecnica).
 */
function pacienteAgendarSessao(sigla, dados) {
  var d = dados && typeof dados === 'object' ? dados : {};
  var alvo = _agePaciente_(sigla);
  if (!alvo.ok) return alvo;
  if (!_ageIdValido_(d.id)) return { ok: false, erro: 'Parametros incompletos' };
  var id = String(d.id).trim(), agora = _lemAgora_();
  var ctx = _ageCtx_(alvo.controle, true);
  ctx.profId = alvo.profissionalId; // 14.5: o ocupado do Google entra na conferencia do horario
  var ja = ctx.pedidos.filter(function (p) { return p.id === id; })[0];
  if (ja) {
    if (_siglaChave_(ja.sigla) !== _siglaChave_(alvo.sigla)) return { ok: false, erro: 'Parametros incompletos' };
    var rd = _ageMinhas_(ctx, alvo, agora); rd.duplicado = true; return rd;
  }
  var data = String(d.data || '').trim(), hora = _lemHora_(d.hora);
  var slot = (_lemDia_(data) !== null && hora) ? _ageSlotLivre_(ctx, alvo.controle, data, hora, agora) : null;
  if (!slot) return { ok: false, codigo: 'ocupado', erro: MSG_AGE_ACABOU };
  var modalidade = slot.modalidades.indexOf(d.modalidade) !== -1 ? d.modalidade : slot.modalidades[0];
  _ageGravar_(ctx.abaP, COLUNAS_PEDIDOS_AGENDA, 0, { id: id, sigla: alvo.sigla, tipo: 'agendar', sessao_id: '', data: data, hora: hora, estado: 'pendente',
    criado_em: agora.carimbo, modalidade: modalidade });
  _ageAvisarProfissional_(ctx, alvo.profissionalId, alvo.nome + ' pediu para agendar uma sessão em ' + _ageDiaMes_(data) + ' às ' + hora + '.');
  return _ageMinhas_(_ageCtx_(alvo.controle, false), alvo, agora);
}

/** Sessao do proprio paciente pelo id (ou null). */
function _ageDoPaciente_(ctx, alvo, id) {
  var x = ctx.sessoes.filter(function (y) { return y.id === String(id || '').trim(); })[0];
  return x && _siglaChave_(x.sigla) === _siglaChave_(alvo.sigla) ? x : null;
}

function pacienteConfirmarSessao(sigla, id) {
  var alvo = _agePaciente_(sigla);
  if (!alvo.ok) return alvo;
  var ctx = _ageCtx_(alvo.controle, false), agora = _lemAgora_();
  var x = _ageDoPaciente_(ctx, alvo, id);
  if (!x || (x.estado !== 'agendada' && x.estado !== '') || _ageMinutosAte_(x.data, x.hora_inicio, agora) <= 0) return { ok: false, erro: MSG_AGE_NAO_ACHEI };
  if (!x.confirmada_em) _ageGravar_(ctx.abaS, COLUNAS_SESSOES, x.__linha, { confirmada_em: agora.carimbo, atualizado_em: agora.carimbo, gcal_sinc: 'pendente' }); // 14.11
  return _ageMinhas_(_ageCtx_(alvo.controle, false), alvo, agora);
}

/** Texto da regra do prazo, como a tela do paciente o mostra. */
function _ageMsgPrazo_(horas, profissional) {
  return 'Cancelamento e remarcação pelo sistema só com ' + horas + ' horas ou mais de antecedência. Com menos de ' + horas + ' horas, fale diretamente com ' + profissional + '; a sessão é cobrada.';
}

/** O paciente cancela a propria sessao, so com a antecedencia combinada ou mais: nao e cobrada. */
function pacienteCancelarSessao(sigla, id) {
  var alvo = _agePaciente_(sigla);
  if (!alvo.ok) return alvo;
  var ctx = _ageCtx_(alvo.controle, false), agora = _lemAgora_();
  var x = _ageDoPaciente_(ctx, alvo, id);
  if (!x) return { ok: false, erro: MSG_AGE_NAO_ACHEI };
  if (x.estado === 'cancelada') { var rd = _ageMinhas_(ctx, alvo, agora); rd.duplicado = true; return rd; }
  if (x.estado !== 'agendada' && x.estado !== '') return { ok: false, erro: MSG_AGE_NAO_ACHEI };
  if (!_ageNoPrazo_(x.data, x.hora_inicio, agora, ctx.cfg.antecedencia_min_horas)) return { ok: false, codigo: 'prazo', erro: _ageMsgPrazo_(ctx.cfg.antecedencia_min_horas, alvo.profissional) };
  _ageGravar_(ctx.abaS, COLUNAS_SESSOES, x.__linha, { estado: 'cancelada', cancelada_em: agora.carimbo, cancelada_por: 'paciente', cobrada: _ageCobrada_('cancel_paciente', true, !!x.reposicao_de), atualizado_em: agora.carimbo });
  _agePedidosFechar_(ctx, x.id, agora);
  _ageAvisarProfissional_(ctx, alvo.profissionalId, alvo.nome + ' cancelou a sessão de ' + _ageDiaMes_(x.data) + ' às ' + _lemHora_(x.hora_inicio) + '.');
  _calSincronizar_(alvo.controle, alvo.profissionalId, { max: 2, agora: agora }); // 14.5
  return _ageMinhas_(_ageCtx_(alvo.controle, false), alvo, agora);
}

/**
 * Pedido do paciente: remarcar a propria sessao (so com a antecedencia combinada) ou repor uma sessao cobrada.
 * `dados`: { id, tipo: 'remarcar' | 'repor', sessao_id, data, hora }. A agenda so muda quando o profissional aprova.
 */
function pacientePedirAgenda(sigla, dados) {
  var d = dados && typeof dados === 'object' ? dados : {};
  var alvo = _agePaciente_(sigla);
  if (!alvo.ok) return alvo;
  if (!_ageIdValido_(d.id)) return { ok: false, erro: 'Parametros incompletos' };
  var id = String(d.id).trim(), agora = _lemAgora_();
  var ctx = _ageCtx_(alvo.controle, true);
  ctx.profId = alvo.profissionalId; // 14.5
  if (ctx.pedidos.some(function (p) { return p.id === id; })) { var rd = _ageMinhas_(ctx, alvo, agora); rd.duplicado = true; return rd; }
  var tipo = d.tipo === 'repor' ? 'repor' : 'remarcar';
  var x = _ageDoPaciente_(ctx, alvo, d.sessao_id);
  if (!x) return { ok: false, erro: MSG_AGE_NAO_ACHEI };
  if (ctx.pedidos.some(function (p) { return p.sessao_id === x.id && p.estado === 'pendente'; })) return { ok: false, erro: 'Já existe um pedido aguardando resposta para esta sessão.' };
  if (tipo === 'remarcar') {
    if (x.estado !== 'agendada' && x.estado !== '') return { ok: false, erro: MSG_AGE_NAO_ACHEI };
    if (!_ageNoPrazo_(x.data, x.hora_inicio, agora, ctx.cfg.antecedencia_min_horas)) return { ok: false, codigo: 'prazo', erro: _ageMsgPrazo_(ctx.cfg.antecedencia_min_horas, alvo.profissional) };
  } else if (!_agePodeRepor_(ctx, x)) {
    return { ok: false, erro: 'Esta sessão não pode ser reposta.' };
  }
  var data = String(d.data || '').trim(), hora = _lemHora_(d.hora);
  // 14.5: nenhum horario livre serve -> o paciente escreve o horario ideal; o profissional escolhe o horario ao aprovar
  var sugestao = String(d.sugestao === undefined || d.sugestao === null ? '' : d.sugestao).replace(/\s+/g, ' ').trim().slice(0, AGENDA_SUGESTAO_MAX);
  if (sugestao && !data) {
    _ageGravar_(ctx.abaP, COLUNAS_PEDIDOS_AGENDA, 0, { id: id, sigla: alvo.sigla, tipo: tipo, sessao_id: x.id, data: '', hora: '', estado: 'pendente', criado_em: agora.carimbo, sugestao: sugestao });
    _ageAvisarProfissional_(ctx, alvo.profissionalId, alvo.nome + (tipo === 'remarcar' ? ' pediu remarcação da sessão de ' : ' pediu reposição da sessão de ') +
      _ageDiaMes_(x.data) + (tipo === 'remarcar' ? ' às ' + _lemHora_(x.hora_inicio) : '') + ' e sugeriu: ' + sugestao);
    return _ageMinhas_(_ageCtx_(alvo.controle, false), alvo, agora);
  }
  if (_lemDia_(data) === null || !hora || !_ageSlotLivre_(ctx, alvo.controle, data, hora, agora)) return { ok: false, codigo: 'ocupado', erro: MSG_AGE_ACABOU };
  _ageGravar_(ctx.abaP, COLUNAS_PEDIDOS_AGENDA, 0, { id: id, sigla: alvo.sigla, tipo: tipo, sessao_id: x.id, data: data, hora: hora, estado: 'pendente', criado_em: agora.carimbo });
  _ageAvisarProfissional_(ctx, alvo.profissionalId, tipo === 'remarcar'
    ? alvo.nome + ' pediu remarcação de ' + _ageDiaMes_(x.data) + ' às ' + _lemHora_(x.hora_inicio) + ' para ' + _ageDiaMes_(data) + ' às ' + hora + '.'
    : alvo.nome + ' pediu reposição da sessão de ' + _ageDiaMes_(x.data) + ', em ' + _ageDiaMes_(data) + ' às ' + hora + '.');
  return _ageMinhas_(_ageCtx_(alvo.controle, false), alvo, agora);
}

// ---------- lista do profissional, exclusao de paciente e gatilho ----------

/** Pedidos pendentes e eventos da agenda de todos os pacientes da Controle, por sigla (vao na lista do login: blocos do Inicio sem chamada nova). */
function _ageInicio_(controle) {
  var r = { pedidos: {}, eventos: {} };
  if (!controle || !controle.getSheetByName(ABA_SESSOES)) return r;
  var ctx = _ageCtx_(controle, false);
  _agePedidosPendentes_(ctx, {}).forEach(function (p) { var k = _siglaChave_(p.sigla); (r.pedidos[k] = r.pedidos[k] || []).push(p); });
  _ageEventos_(ctx, {}, _lemAgora_()).forEach(function (e) { var k = _siglaChave_(e.sigla); (r.eventos[k] = r.eventos[k] || []).push(e); });
  return r;
}

/** Paciente excluido: sessoes e pedidos dele saem (a sigla pode voltar a ser usada por outro paciente). */
function _agendaApagarDoPaciente_(controle, sigla, guardar) {
  var alvo = _siglaChave_(sigla), fica = guardar || {}; // 19.6: `guardar` = { id da sessao: true } — so vale para a aba Sessoes
  [[ABA_SESSOES, COLUNAS_SESSOES], [ABA_SERIES, COLUNAS_SERIES], [ABA_PEDIDOS_AGENDA, COLUNAS_PEDIDOS_AGENDA]].forEach(function (par) {
    var aba = _ageAba_(controle, par[0], par[1], false);
    if (!aba) return;
    _lembretesLer_(aba).reverse().forEach(function (x) { if (_siglaChave_(x.sigla) === alvo && !(par[0] === ABA_SESSOES && fica[x.id])) aba.deleteRow(x.__linha); });
    _ageEsquecer_(aba); // 14.12
  });
}

/**
 * Lembrete da sessao por e-mail: sai na primeira rodada do gatilho depois de faltarem 24 horas
 * (e so para sessao que ainda nao comecou). Chamada no fim de enviarLembretes_, de hora em hora.
 * A marca `ultimo_aviso_em` e gravada ANTES do envio, dentro da trava e relendo a celula: duas
 * rodadas nunca mandam o mesmo lembrete duas vezes. Devolve so contagens.
 */
function enviarAvisosSessao_(quando) {
  var agora = _lemAgora_(quando);
  var r = { profissionais: 0, sessoes: 0, vencendo: 0, enviados: 0, ja_enviados: 0, desligados: 0, sem_email: 0, sem_conexao: 0, inativos: 0, sem_cota: 0, falhas: 0, calendar: 0, recolocados: 0 };
  lerAbaComoObjetos(_abrirPlanilha_(SISTEMA_VMC_ID), ABA_PROFISSIONAIS).forEach(function (prof) {
    try {
      if (!prof.profissional_id || !_estaAtivo_(prof.ativo)) return;
      var controle = abrirControleDoProfissional(prof.profissional_id);
      var aba = _ageAba_(controle, ABA_SESSOES, COLUNAS_SESSOES, false);
      r.recolocados += _calRecolocar_(controle, prof.profissional_id, agora); // 14.11: evento apagado direto no Google volta para a fila
      r.calendar += Object.keys(_calSincronizar_(controle, prof.profissional_id, { max: CAL_SINC_RODADA, agora: agora, contar: true })).length; // 14.5: series e o que ficou pendente
      var sessoes = _lembretesLer_(aba);
      if (!sessoes.length) return;
      r.profissionais++;
      r.sessoes += sessoes.length;
      // 14.4: dois lembretes — 48 h antes (entre 48 h e 24 h) e 24 h antes; cada um com a sua caixa e a sua marca
      var devidas = [];
      sessoes.forEach(function (x) {
        if (x.estado !== 'agendada' && x.estado !== '') return;
        var m = _ageMinutosAte_(x.data, x.hora_inicio, agora), caixas = _ageAvisosLista_(x.avisos);
        if (m === null || m <= 0) return;
        if (m > 1440 && m <= 2880 && !x.lembrete48_em && caixas.indexOf('lembrete48') !== -1) devidas.push({ x: x, tipo: 'lembrete48', coluna: 'lembrete48_em' });
        if (m <= 1440 && !x.ultimo_aviso_em && caixas.indexOf('lembrete') !== -1) devidas.push({ x: x, tipo: 'lembrete', coluna: 'ultimo_aviso_em' });
      });
      if (!devidas.length) return;
      var cfg = _ageConfig_(controle);
      if (cfg.avisos_sessao !== 'Sim') { r.desligados += devidas.length; return; }
      if (!_emailPermitido_(prof.profissional_id)) { r.sem_conexao += devidas.length; return; } // 14.10
      var pacs = _agePacientes_(controle);
      var ctx = { cfg: cfg };
      var header = _garantirColunas_(aba, COLUNAS_SESSOES);
      var colId = header.indexOf('id') + 1;
      devidas.forEach(function (item) {
        var x = item.x, colMarca = header.indexOf(item.coluna) + 1;
        r.vencendo++;
        var pac = pacs[_siglaChave_(x.sigla)];
        if (!pac || !pac.ativo) { r.inativos++; return; }
        if (!pac.email) { r.sem_email++; return; }
        var reserva;
        try {
          reserva = _comTrava_(function () {
            if (String(aba.getRange(x.__linha, colId).getDisplayValues()[0][0]).trim() !== x.id) return 'mudou';
            if (String(aba.getRange(x.__linha, colMarca).getDisplayValues()[0][0]).trim()) return 'ja';
            aba.getRange(x.__linha, colMarca).setValue(_lemCelula_(agora.carimbo)); _ageEsquecer_(aba); // 14.12: marca gravada direto na celula
            return 'ok';
          });
        } catch (erroTrava) { reserva = 'falha'; }
        if (reserva === 'ja' || reserva === 'mudou') { r.ja_enviados++; return; }
        if (reserva !== 'ok') { r.falhas++; return; }
        var motivo = _ageAvisarPaciente_(ctx, prof.profissional_id, pac, item.tipo, x, item.tipo);
        if (!motivo) { r.enviados++; return; }
        if (motivo === 'cota') r.sem_cota++; else r.falhas++;
        _comTravaSeDer_(function () { aba.getRange(x.__linha, colMarca).setValue(''); _ageEsquecer_(aba); });
      });
    } catch (e) {
      r.falhas++;
      console.error('agenda: ' + String(e && e.message || e).slice(0, 160));
    }
  });
  return r;
}


// ------------------------------------------------------------
// monitorarPing_ — monitor horario da implantacao de producao
// ------------------------------------------------------------

/**
 * Chama o ping da implantacao de producao. Se a resposta nao tiver
 * ok:true e versao_pacote, avisa o dono por e-mail (no maximo 1 por hora).
 *
 * O limite de tempo e o proprio do UrlFetchApp (~60 s, nao configuravel
 * no Apps Script); o tempo decorrido vai para o log.
 */
function monitorarPing_() {
  var inicio = new Date();
  var codigo = 0;
  var corpo = '';
  var falha = '';

  try {
    var resp = UrlFetchApp.fetch(E3_PING_URL, {
      method: 'post',
      contentType: 'text/plain;charset=utf-8',
      payload: JSON.stringify({ acao: 'ping' }),
      followRedirects: true,
      muteHttpExceptions: true
    });
    codigo = resp.getResponseCode();
    corpo = resp.getContentText();
  } catch (e) {
    falha = 'excecao na chamada: ' + String(e);
  }

  if (!falha && codigo !== 200) {
    falha = 'HTTP ' + codigo;
  }
  if (!falha) {
    var dados = null;
    try { dados = JSON.parse(corpo); } catch (e) { dados = null; }
    if (!dados || dados.ok !== true || !dados.versao_pacote) {
      falha = 'resposta sem ok:true e versao_pacote';
    }
  }

  var decorrido = Math.round((new Date().getTime() - inicio.getTime()) / 1000);
  if (!falha) {
    Logger.log('E3 monitor: ping OK em ' + decorrido + ' s.');
    return { ok: true, segundos: decorrido };
  }

  console.error('E3 monitor: ' + falha + ' (' + decorrido + ' s).');
  var enviado = _e3AvisarFalhaPing_(inicio, falha, codigo, corpo);
  return { ok: false, falha: falha, segundos: decorrido, email_enviado: enviado };
}

/**
 * E-mail de aviso ao dono, no maximo 1 por hora.
 */
function _e3AvisarFalhaPing_(agora, falha, codigo, corpo) {
  var props = PropertiesService.getScriptProperties();
  var ultimo = Number(props.getProperty(E3_PROP_ULTIMO_AVISO) || 0);
  var agoraMs = agora.getTime();
  if (ultimo && (agoraMs - ultimo) < 3600000) {
    Logger.log('E3 monitor: aviso silenciado (menos de 1 h desde o ultimo).');
    return false;
  }

  var dono = _e3EmailDoDono_();
  if (!dono) {
    console.error('E3 monitor: sem e-mail do dono; aviso nao enviado.');
    return false;
  }

  var quando = Utilities.formatDate(agora, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
  var texto =
    'O monitor horário não conseguiu confirmar que o servidor está no ar.\n\n' +
    'Hora (America/Sao_Paulo): ' + quando + '\n' +
    'Problema: ' + falha + '\n' +
    'Código HTTP: ' + (codigo ? codigo : '(sem resposta)') + '\n\n' +
    'Início da resposta (200 caracteres):\n' + e3Truncar(corpo, 200) + '\n\n' +
    'Confira a implantação de produção e a página Execuções do projeto.';

  try {
    MailApp.sendEmail({
      to: dono,
      subject: 'COGNIATIVO - servidor sem resposta no ping',
      body: texto,
      name: 'COGNIATIVO'
    });
    props.setProperty(E3_PROP_ULTIMO_AVISO, String(agoraMs));
    Logger.log('E3 monitor: aviso enviado ao dono.');
    return true;
  } catch (e) {
    console.error('E3 monitor: falha ao enviar e-mail: ' + String(e));
    return false;
  }
}


// ------------------------------------------------------------
// instalarGatilhos — uso unico
// ------------------------------------------------------------

/**
 * Remove gatilhos anteriores (backup e monitor, inclusive os que apontam
 * para o nome antigo backupDiario_) e cria UM so: monitorarPing_ diario.
 * O backup nao tem gatilho — e sob demanda (decisao do usuario de 30/09).
 * Rodada uma vez; repetir e seguro (apaga antes de criar).
 */
function instalarGatilhos() {
  var alvos = ['backupDiario_', 'backupSobDemanda_', 'monitorarPing_', 'enviarLembretes_'];
  var removidos = 0;

  var existentes = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existentes.length; i++) {
    if (alvos.indexOf(existentes[i].getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(existentes[i]);
      removidos++;
    }
  }

  ScriptApp.newTrigger('monitorarPing_')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .inTimezone('America/Sao_Paulo')
    .create();

  // 19.2.1: lembretes por e-mail (a hora de cada item e escolhida pelo profissional; o e-mail sai na primeira
  // rodada depois dela). 19.2.3: a rodada passou de hora em hora para a cada 5 minutos — com a rodada horaria o
  // e-mail chegava ate uma hora depois do horario escolhido.
  ScriptApp.newTrigger('enviarLembretes_')
    .timeBased()
    .everyMinutes(5)
    .create();

  var msg = 'E3: ' + removidos + ' gatilho(s) antigo(s) removido(s). Criados: ' +
            'monitorarPing_ (diario, entre 7 h e 8 h, America/Sao_Paulo) e ' +
            'enviarLembretes_ (a cada 5 minutos). ' +
            'Backup e sob demanda (rodarBackupAgora), sem gatilho.';
  Logger.log(msg);
  return msg;
}


// ------------------------------------------------------------
// Execucao manual (Pacote E3, 30/09/2026)
// ------------------------------------------------------------
//
// backupSobDemanda_ e monitorarPing_ terminam em `_`, o que no Apps Script
// marca funcao PRIVADA: o gatilho de tempo chama sem problema, mas ela nao
// aparece no seletor de funcao do editor. Estes dois involucros publicos
// existem so para permitir a execucao manual de verificacao (pelo editor
// ou por `clasp run`), sem renomear o que instalarGatilhos registra como
// handler.
//
// Nao sao acao do doPost: o web app so roteia pelo switch de doPost, logo
// isto NAO amplia a superficie exposta na web.

/**
 * 18.1.4: funcao de verificacao do clasp run — so leitura, sem tocar em dado algum.
 * Uso: clasp --user run run-function versaoDoServidor
 */
function versaoDoServidor() {
  return { ok: true, versao_pacote: VERSAO_PACOTE, politica_versao: POLITICA_VERSAO, hora_servidor: _e3HoraServidor_() };
}

function rodarBackupAgora() {
  return backupSobDemanda_();
}

function rodarMonitorAgora() {
  return monitorarPing_();
}

// ---------- Pacote 14.5: endereco do consultorio, evento em anexo (.ics) e Google Calendar ----------
// O espelho e de MAO UNICA (do COGNIATIVO para o Google) e nunca bloqueia a agenda: toda gravacao que muda o que o
// Calendar mostra marca a sessao com gcal_sinc = 'pendente' (_ageGravar_), e _calSincronizar_ cria, muda ou apaga o
// evento — na propria acao (ate 3) e no gatilho de 5 minutos (series e o que falhou). Vale para o profissional que
// conectou a propria conta (14.8) e, sem conectar, para o dono do script; sempre com a chave `google_calendar` = Sim
// na Config_Agenda (nasce 'Nao'). Acesso pela API REST com o token de quem conectou (_calToken_).

function _age2_(n) { return ('0' + Math.floor(n)).slice(-2); }

/** Endereco do consultorio que vale na data da sessao (o novo a partir de `endereco_novo_desde`). */
function _ageEndereco_(cfg, dataIso) {
  var c = cfg || {};
  if (c.endereco_novo && c.endereco_novo_desde && String(dataIso || '') >= c.endereco_novo_desde) return c.endereco_novo;
  return c.endereco || '';
}

/** Link que abre o endereco no mapa do aparelho (Google Maps). */
function _ageMapa_(endereco) {
  return endereco ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(endereco) : '';
}

/** Instante de agora em UTC, no formato do .ics, e um numero de sequencia que so cresce (minutos). */
function _ageAgoraUtc_() {
  var d = new Date();
  return { carimbo: d.getUTCFullYear() + _age2_(d.getUTCMonth() + 1) + _age2_(d.getUTCDate()) + 'T' + _age2_(d.getUTCHours()) + _age2_(d.getUTCMinutes()) + _age2_(d.getUTCSeconds()) + 'Z',
    seq: Math.floor(d.getTime() / 60000) - 29000000 };
}

/** Data civil de Sao Paulo + minutos -> instante UTC do .ics (Sao Paulo = UTC-3, sem horario de verao desde 2019). */
function _ageIcsUtc_(iso, minLocal) {
  var t = minLocal + 180, m = t % 1440;
  return _lemIso_(_lemDia_(iso) + Math.floor(t / 1440)).replace(/-/g, '') + 'T' + _age2_(m / 60) + _age2_(m % 60) + '00Z';
}

/**
 * Evento(s) da sessao no formato iCalendar, para o anexo do e-mail. Titulo neutro ("Sessao com <profissional>"):
 * e o que aparece na agenda do paciente. Mesmo UID a cada envio: abrir o anexo de uma remarcacao atualiza o evento
 * guardado; o de cancelamento (METHOD:CANCEL) o retira.
 */
function _ageIcs_(sessoes, profissional, cfg, metodo, utc) {
  var icsTexto = function (t) { return String(t === undefined || t === null ? '' : t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); };
  var dobra = function (linha) { var partes = []; for (var i = 0; i < linha.length; i += 60) partes.push((i ? ' ' : '') + linha.slice(i, i + 60)); return partes.join('\r\n'); };
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//COGNIATIVO//Agenda//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:' + metodo];
  (sessoes || []).forEach(function (x) {
    var ini = _ageMin_(_lemHora_(x.hora_inicio || x.hora));
    if (ini === null || _lemDia_(x.data) === null || !x.id) return;
    var dur = _ageDur_(x.duracao_min, cfg.duracao_slot_min), online = x.modalidade === 'online';
    var local = online ? (x.meet_link || 'On-line') : _ageEndereco_(cfg, x.data);
    L.push('BEGIN:VEVENT', 'UID:' + x.id + '@cogniativo', 'DTSTAMP:' + utc.carimbo, 'SEQUENCE:' + utc.seq,
      'DTSTART:' + _ageIcsUtc_(x.data, ini), 'DTEND:' + _ageIcsUtc_(x.data, ini + dur), 'SUMMARY:' + icsTexto('Sessão com ' + profissional));
    if (local) L.push('LOCATION:' + icsTexto(local));
    L.push('DESCRIPTION:' + icsTexto(online ? ('Sessão on-line.' + (x.meet_link ? ' ' + x.meet_link : '')) : 'Sessão presencial.'),
      'STATUS:' + (metodo === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'), 'TRANSP:OPAQUE', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(dobra).join('\r\n') + '\r\n';
}

/** Chamada a API do Google Calendar. Devolve { codigo, corpo } — nunca lanca: quem chama decide o que fazer com a falha. */
function _calApi_(metodo, caminho, corpo, profId) {
  try {
    var token = _calToken_(profId); // 14.8: a conta que o profissional conectou; sem `profId`, a do script (funcoes do editor)
    if (!token) return { codigo: 0, corpo: null };
    var opcoes = { method: metodo, headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };
    if (corpo !== undefined && corpo !== null) { opcoes.contentType = 'application/json'; opcoes.payload = JSON.stringify(corpo); }
    var r = UrlFetchApp.fetch('https://www.googleapis.com/calendar/v3' + caminho, opcoes);
    var texto = r.getContentText(), dados = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch (e) { dados = null; }
    if (r.getResponseCode() === 401 && profId) _cacheEsquecer_(['gcalat:' + profId]); // acesso vencido antes da hora: renova na proxima
    return { codigo: r.getResponseCode(), corpo: dados };
  } catch (e) {
    console.error('calendar: ' + String(e && e.message || e).slice(0, 160));
    return { codigo: 0, corpo: null };
  }
}

/**
 * O script consegue falar com o Google Calendar do dono? E a funcao que se roda no EDITOR para dar a autorizacao
 * (pelo `clasp run` o token e o de quem chama, sem o escopo do Calendar: la a resposta e 403).
 * Devolve so { ok, codigo, agendas, motivo } — nenhum nome de agenda.
 */
function autorizarGoogleCalendar() {
  var r = _calApi_('get', '/users/me/calendarList?maxResults=250&fields=items(id)');
  var erro = (r.corpo && r.corpo.error) || {};
  var motivo = (erro.errors && erro.errors[0] && erro.errors[0].reason) || erro.status || '';
  var saida = { ok: r.codigo === 200, codigo: r.codigo, agendas: (r.corpo && r.corpo.items) ? r.corpo.items.length : 0, motivo: String(motivo).slice(0, 60) };
  console.log('calendar: ' + JSON.stringify(saida));
  return saida;
}

/** O profissional e o dono do script? (o e-mail do cadastro, sem o "+marcador", e o da conta que roda o servidor) */
function _calDoDono_(profId) {
  try {
    var prof = buscarProfissional(profId) || {};
    var dono = normalizarEmail(Session.getEffectiveUser().getEmail());
    return !!dono && normalizarEmail(prof.email).replace(/\+[^@]*@/, '@') === dono;
  } catch (e) {
    return false;
  }
}

/** Id da agenda do Google que recebe o espelho: a de nome `gcal_nome` (padrao CAL_NOME_PADRAO); nasce se nao existir. '' se nao deu. */
function _calAgendaId_(controle, cfg, profId) {
  if (cfg.gcal_id) return cfg.gcal_id;
  var nome = cfg.gcal_nome || CAL_NOME_PADRAO, id = '';
  if (!_gcalGuardada_(profId)) { // dono do script: pode procurar a agenda pelo nome; a conta conectada so enxerga a que o sistema criar
    var r = _calApi_('get', '/users/me/calendarList?maxResults=250&fields=items(id,summary)', null, profId);
    if (r.codigo !== 200 || !r.corpo) return '';
    var achada = (r.corpo.items || []).filter(function (c) { return c.summary === nome; })[0];
    id = achada ? achada.id : '';
  }
  if (!id) {
    var nova = _calApi_('post', '/calendars', { summary: nome, timeZone: 'America/Sao_Paulo' }, profId);
    if (nova.codigo !== 200 || !nova.corpo || !nova.corpo.id) return '';
    id = nova.corpo.id;
  }
  _comTravaSeDer_(function () { _ageConfigGravar_(controle, 'gcal_id', id); });
  cfg.gcal_id = id;
  return id;
}

/** 'AAAA-MM-DD' + minutos desde 00:00 -> 'AAAA-MM-DDTHH:mm:00' (hora local; o fuso vai ao lado). */
function _calQuando_(iso, min) {
  var m = min % 1440;
  return _lemIso_(_lemDia_(iso) + Math.floor(min / 1440)) + 'T' + _age2_(m / 60) + ':' + _age2_(m % 60) + ':00';
}

/** A sessao como evento do Google Calendar: nome do paciente no titulo, cor pela modalidade, endereco ou sala do Meet. */
function _calEvento_(x, pac, cfg) {
  var ini = _ageMin_(_lemHora_(x.hora_inicio)), dur = _ageDur_(x.duracao_min, cfg.duracao_slot_min), online = x.modalidade === 'online';
  var ev = { summary: 'Sessão de Psicoterapia — ' + (pac ? pac.nome : x.sigla),
    start: { dateTime: _calQuando_(x.data, ini), timeZone: 'America/Sao_Paulo' }, end: { dateTime: _calQuando_(x.data, ini + dur), timeZone: 'America/Sao_Paulo' },
    colorId: CAL_COR[online ? 'online' : 'presencial'], location: online ? '' : _ageEndereco_(cfg, x.data),
    description: 'Criado pelo COGNIATIVO.' + (x.reposicao_de ? ' Reposição.' : '') + (x.confirmada_em ? ' Presença confirmada pelo paciente.' : ''), // 14.11
    status: 'confirmed', extendedProperties: { 'private': { cogniativo: x.id } } };
  // um link do Meet por sessao on-line, nunca o mesmo: cada evento pede a sua propria sala
  if (online && !x.meet_link) ev.conferenceData = { createRequest: { requestId: ('cg' + x.id + x.data + ini).replace(/[^A-Za-z0-9]/g, '').slice(-60), conferenceSolutionKey: { type: 'hangoutsMeet' } } };
  if (!online && x.meet_link) ev.conferenceData = null;
  return ev;
}

/**
 * Espelha no Google Calendar as sessoes marcadas como pendentes. `o`: { ids (so estas), max, agora }.
 * Devolve { id da sessao: link do Meet ('' se nao ha) } do que foi espelhado. Nunca lanca e nunca bloqueia:
 * o que falhar continua 'pendente' e volta na rodada seguinte do gatilho.
 */
function _calSincronizar_(controle, profId, o) {
  var feitos = {}, op = o || {};
  try {
    if (!controle) return feitos;
    var cfg = _ageConfig_(controle);
    if (!_calConectada_(profId, cfg)) return feitos;
    var aba = _ageAba_(controle, ABA_SESSOES, COLUNAS_SESSOES, false);
    if (!aba) return feitos;
    var so = null;
    if (op.ids) { so = {}; op.ids.forEach(function (i) { so[i] = true; }); }
    var pend = _ageLer_(aba).filter(function (x) { return x.gcal_sinc === 'pendente' && (!so || so[x.id]); }); // 14.12
    if (!pend.length) return feitos;
    var hoje = (op.agora || _lemAgora_()).data, max = op.max || 1, n = 0, calId = null, pacs = null;
    var colId = _garantirColunas_(aba, COLUNAS_SESSOES).indexOf('id') + 1;
    var gravar = function (x, campos) {
      _comTravaSeDer_(function () {
        if (String(aba.getRange(x.__linha, colId).getDisplayValues()[0][0]).trim() === x.id) _ageGravar_(aba, COLUNAS_SESSOES, x.__linha, campos);
      });
    };
    for (var i = 0; i < pend.length; i++) {
      var x = pend[i], ativa = x.estado !== 'cancelada';
      if (!x.gcal_evento && (!ativa || x.data < hoje)) { gravar(x, { gcal_sinc: '' }); continue; } // nada a espelhar (cancelada sem evento, ou sessao lancada no passado)
      if (n >= max) break;
      n++;
      if (calId === null) calId = _calAgendaId_(controle, cfg, profId);
      if (!calId) break;
      var base = '/calendars/' + encodeURIComponent(calId) + '/events';
      if (!ativa) {
        var ap = _calApi_('delete', base + '/' + encodeURIComponent(x.gcal_evento), null, profId);
        if ([200, 204, 404, 410].indexOf(ap.codigo) !== -1) { gravar(x, { gcal_evento: '', gcal_sinc: '', meet_link: '' }); feitos[x.id] = ''; }
        continue;
      }
      if (!pacs) pacs = _agePacientes_(controle);
      var corpo = _calEvento_(x, pacs[_siglaChave_(x.sigla)], cfg);
      var r = x.gcal_evento ? _calApi_('patch', base + '/' + encodeURIComponent(x.gcal_evento) + '?conferenceDataVersion=1', corpo, profId) : null;
      // 14.11: evento apagado direto no Google — se o proprio evento nao voltou com o patch, nasce outro; a sala do Meet
      // que o paciente ja recebeu continua a mesma (vai escrita no local do evento novo, que nao pede sala nova)
      if (!r || r.codigo === 404 || r.codigo === 410 || (r.codigo === 200 && r.corpo && r.corpo.status === 'cancelled')) {
        if (x.modalidade === 'online' && x.meet_link) corpo.location = x.meet_link;
        r = _calApi_('post', base + '?conferenceDataVersion=1', corpo, profId);
      }
      if (r.codigo === 200 && r.corpo && r.corpo.id) {
        var meet = x.modalidade === 'online' ? String(r.corpo.hangoutLink || x.meet_link || '') : '';
        gravar(x, { gcal_evento: r.corpo.id, gcal_sinc: '', meet_link: meet });
        feitos[x.id] = meet;
      } else if (r.codigo === 404) { // a agenda foi apagada no Google: esquece o id e tenta de novo na proxima rodada
        _comTravaSeDer_(function () { _ageConfigGravar_(controle, 'gcal_id', ''); });
        break;
      }
    }
  } catch (e) {
    console.error('calendar: ' + String(e && e.message || e).slice(0, 160));
  }
  return feitos;
}

/**
 * 14.11: os ids dos eventos que existem na agenda do espelho, de hoje em diante: { id: true }.
 * {} se a agenda inteira foi apagada no Google; null se nao deu para saber (falha ou agenda grande demais) —
 * e, sem saber, ninguem mexe em nada.
 */
function _calEventosVivos_(calId, hojeIso, profId) {
  var vivos = {}, pagina = '';
  for (var i = 0; i < CAL_LISTA_PAGINAS; i++) {
    var r = _calApi_('get', '/calendars/' + encodeURIComponent(calId) + '/events?maxResults=2500&showDeleted=false&singleEvents=true&timeMin=' +
      encodeURIComponent(hojeIso + 'T00:00:00-03:00') + '&fields=' + encodeURIComponent('items(id,status),nextPageToken') + (pagina ? '&pageToken=' + encodeURIComponent(pagina) : ''), null, profId);
    if (r.codigo === 404 || r.codigo === 410) return {};
    if (r.codigo !== 200 || !r.corpo) return null;
    (r.corpo.items || []).forEach(function (e) { if (e && e.id && e.status !== 'cancelled') vivos[e.id] = true; });
    pagina = String(r.corpo.nextPageToken || '');
    if (!pagina) return vivos;
  }
  return null;
}

/**
 * 14.11 (decisao do usuario, 24/11/2026): evento apagado direto no Google volta. A cada rodada do gatilho, a sessao
 * futura e agendada que ja tinha evento e nao o tem mais na agenda do espelho volta para a fila (gcal_sinc =
 * 'pendente'); quem recoloca e _calSincronizar_, na mesma rodada. Apagar no Google nunca cancela sessao nem avisa
 * paciente: aqui so se le o Google e so se grava a marca da fila. Devolve quantas sessoes voltaram para a fila.
 */
function _calRecolocar_(controle, profId, agora) {
  var n = 0;
  try {
    if (!controle) return 0;
    var cfg = _ageConfig_(controle);
    if (!cfg.gcal_id || !_calConectada_(profId, cfg)) return 0;
    var aba = _ageAba_(controle, ABA_SESSOES, COLUNAS_SESSOES, false);
    if (!aba) return 0;
    var alvo = _lembretesLer_(aba).filter(function (x) {
      return x.gcal_evento && x.gcal_sinc !== 'pendente' && (x.estado === 'agendada' || x.estado === '') && _ageMinutosAte_(x.data, x.hora_inicio, agora) > 0;
    });
    if (!alvo.length) return 0;
    var vivos = _calEventosVivos_(cfg.gcal_id, agora.data, profId);
    if (!vivos) return 0;
    var sumiram = alvo.filter(function (x) { return !vivos[x.gcal_evento]; });
    if (!sumiram.length) return 0;
    var colId = _garantirColunas_(aba, COLUNAS_SESSOES).indexOf('id') + 1;
    _comTravaSeDer_(function () {
      sumiram.forEach(function (x) {
        if (String(aba.getRange(x.__linha, colId).getDisplayValues()[0][0]).trim() !== x.id) return;
        _ageGravar_(aba, COLUNAS_SESSOES, x.__linha, { gcal_sinc: 'pendente' });
        n++;
      });
    });
  } catch (e) {
    console.error('calendar: ' + String(e && e.message || e).slice(0, 160));
  }
  return n;
}

/** Ao ligar o espelho: as sessoes agendadas de hoje em diante que ainda nao tem evento entram na fila. */
function _calMarcarFuturas_(controle, refazer) {
  var aba = _ageAba_(controle, ABA_SESSOES, COLUNAS_SESSOES, false);
  if (!aba) return;
  var hoje = _lemAgora_().data;
  _lembretesLer_(aba).forEach(function (x) {
    if (!((x.estado === 'agendada' || x.estado === '') && x.data >= hoje)) return;
    // 14.8: `refazer` = a conta do Google mudou — os eventos antigos ficam na agenda antiga e nascem de novo na nova
    if (refazer && x.gcal_evento) _ageGravar_(aba, COLUNAS_SESSOES, x.__linha, { gcal_evento: '', gcal_sinc: 'pendente' });
    else if (!x.gcal_evento && x.gcal_sinc !== 'pendente') _ageGravar_(aba, COLUNAS_SESSOES, x.__linha, { gcal_sinc: 'pendente' });
  });
}

/** Instante do Google ('2026-11-26T13:00:00Z') -> minutos absolutos de Sao Paulo (dia * 1440 + minutos); null se nao der. */
function _calAbs_(rfc) {
  var t = Date.parse(rfc);
  if (isNaN(t)) return null;
  var loc = new Date(t - 3 * 3600000);
  var dia = _lemDia_(loc.getUTCFullYear() + '-' + _age2_(loc.getUTCMonth() + 1) + '-' + _age2_(loc.getUTCDate()));
  return dia === null ? null : dia * 1440 + loc.getUTCHours() * 60 + loc.getUTCMinutes();
}

/**
 * Horarios ocupados na agenda PESSOAL do Google do profissional (a principal), em `dias` dias a partir de `deIso`:
 * [ { ini, fim } ] em minutos absolutos. So tira horarios da lista de livres; nunca impede o profissional de marcar.
 * As sessoes do COGNIATIVO ficam em outra agenda e nao entram aqui. 5 minutos no cache; falha = lista vazia.
 */
function _calOcupados_(profId, cfg, deIso, dias) {
  try {
    var d0 = _lemDia_(deIso);
    if (d0 === null || !_calConectada_(profId, cfg) || cfg.agenda_ocupado !== 'Sim') return []; // 14.8: so quando o profissional ligou a opcao
    var chave = 'calocup:' + profId + ':' + deIso + ':' + dias;
    var guardado = _cacheLer_(chave);
    if (guardado) { try { return JSON.parse(guardado); } catch (e) { /* le de novo */ } }
    var r = _calApi_('post', '/freeBusy', { timeMin: deIso + 'T00:00:00-03:00', timeMax: _lemIso_(d0 + dias) + 'T00:00:00-03:00', items: [{ id: 'primary' }] }, profId);
    if (r.codigo !== 200 || !r.corpo || !r.corpo.calendars || !r.corpo.calendars.primary) return [];
    var lista = (r.corpo.calendars.primary.busy || []).map(function (b) { return { ini: _calAbs_(b.start), fim: _calAbs_(b.end) }; })
      .filter(function (b) { return b.ini !== null && b.fim !== null && b.fim > b.ini; });
    _cacheGuardar_(chave, JSON.stringify(lista), 300);
    return lista;
  } catch (e) {
    return [];
  }
}

// ---------- Pacote 14.8: cada profissional conecta a propria conta do Google ----------
// (decisao do usuario, 23/11/2026) O espelho deixa de ser so da conta do dono do script. O profissional toca em
// "Conectar Google Agenda", da a permissao na tela do Google (a volta chega pela pagina conectar.html do site, 14.8.1)
// e o servidor guarda a permissao dele (refresh token) no
// cofre do script (PropertiesService, chave 'gcal:<profissional>') — nunca em planilha, nunca em resposta, nunca em log.
// O dono do script continua valendo pelo token do proprio script, sem conectar. O Google so RECEBE as sessoes; os
// compromissos pessoais so fecham horarios quando o profissional liga a opcao `agenda_ocupado` (nasce 'Nao').
// A chave do botao (cliente OAuth) fica em duas propriedades do script que so o usuario preenche.
var GCAL_PROP_ID = 'GOOGLE_OAUTH_CLIENT_ID';
var GCAL_PROP_SEGREDO = 'GOOGLE_OAUTH_CLIENT_SECRET';
var GCAL_ESCOPOS = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.app.created']; // so as agendas que o proprio sistema criar
var GCAL_ESCOPO_AGENDA = 'https://www.googleapis.com/auth/calendar.app.created';
var GCAL_ESCOPO_OCUPADO = 'https://www.googleapis.com/auth/calendar.freebusy';                   // ver SE esta ocupado, nunca o que e
var GCAL_ESTADO_MIN = 20;       // validade do pedido de conexao (ida ao Google e volta)
var GCAL_OCUPADOS_DIAS = 62;    // janela maxima dos compromissos pessoais mostrados na Agenda
var MSG_GCAL_INDISPONIVEL = 'A conexão com o Google ainda não está disponível.';
var MSG_GCAL_CONECTE = 'Conecte a sua agenda primeiro.';

function _gcalCliente_() {
  try {
    var p = PropertiesService.getScriptProperties();
    var id = String(p.getProperty(GCAL_PROP_ID) || '').trim(), seg = String(p.getProperty(GCAL_PROP_SEGREDO) || '').trim();
    return (id && seg) ? { id: id, segredo: seg } : null;
  } catch (e) {
    return null;
  }
}

/** A permissao guardada do profissional: { rt, conta, escopos } ou null. O `rt` nunca sai do servidor. */
function _gcalGuardada_(profId) {
  if (!profId) return null;
  if (_MEMO_.gcal === undefined) _MEMO_.gcal = {};
  if (_MEMO_.gcal[profId] !== undefined) return _MEMO_.gcal[profId];
  var g = null;
  try { var bruto = PropertiesService.getScriptProperties().getProperty('gcal:' + profId); g = bruto ? JSON.parse(bruto) : null; } catch (e) { g = null; }
  if (g && !g.rt) g = null;
  _MEMO_.gcal[profId] = g;
  return g;
}
function _gcalGuardar_(profId, dados) {
  PropertiesService.getScriptProperties().setProperty('gcal:' + profId, JSON.stringify(dados));
  if (_MEMO_.gcal === undefined) _MEMO_.gcal = {};
  _MEMO_.gcal[profId] = dados;
}
function _gcalEsquecer_(profId) {
  try { PropertiesService.getScriptProperties().deleteProperty('gcal:' + profId); } catch (e) { /* nada guardado */ }
  if (_MEMO_.gcal === undefined) _MEMO_.gcal = {};
  _MEMO_.gcal[profId] = null;
  if (_MEMO_.emailDe) delete _MEMO_.emailDe[profId];
  _cacheEsquecer_(['gcalat:' + profId]);
}
/** Retira a permissao no Google e esquece o que estava guardado (desconectar, profissional desativado). Nunca lanca. */
function _gcalDesligar_(profId) {
  var g = _gcalGuardada_(profId);
  if (g && g.rt) {
    try { UrlFetchApp.fetch('https://oauth2.googleapis.com/revoke', { method: 'post', muteHttpExceptions: true, payload: { token: g.rt } }); }
    catch (e) { console.error('agenda externa: a permissao nao foi retirada no Google'); }
  }
  _gcalEsquecer_(profId);
}

/** Pedido de conexao assinado: gcal|profissional|validade|ocupado. E o `state` que vai ao Google e volta. */
function _gcalEstado_(profId, ocupado, agoraMs) {
  var corpo = _b64url_(['gcal', String(profId), String(agoraMs + GCAL_ESTADO_MIN * 60000), ocupado ? '1' : '0'].join('|'));
  return corpo + '.' + _hmacHex_(corpo, _segredoSessao_()).slice(0, 32);
}
function _gcalLerEstado_(estado, agoraMs) {
  var partes = String(estado === undefined || estado === null ? '' : estado).split('.');
  if (partes.length !== 2 || !partes[0] || _hmacHex_(partes[0], _segredoSessao_()).slice(0, 32) !== partes[1]) return null;
  var c;
  try { c = _deB64url_(partes[0]).split('|'); } catch (e) { return null; }
  if (c.length !== 4 || c[0] !== 'gcal' || !c[1] || !(parseInt(c[2], 10) > agoraMs)) return null;
  return { profId: c[1], ocupado: c[3] === '1' };
}

/**
 * 14.8.1: endereco para onde o Google devolve o profissional — a pagina conectar.html do site, ao lado do index-dev.html.
 * Nao e mais o /exec do Apps Script: com mais de uma conta do Google no navegador o Google acrescenta `authuser=N` e o
 * Apps Script nao abre a pagina. Tem de ser igual, letra por letra, ao endereco cadastrado na chave do botao.
 */
function _gcalVolta_() {
  return String(SITE_URL).replace(/[^\/]*$/, 'conectar.html');
}

/** Endereco da tela de permissao do Google ('' se a chave do botao nao esta configurada). */
function _gcalUrl_(profId, ocupado) {
  var cli = _gcalCliente_(), volta = _gcalVolta_();
  if (!cli || !volta) return '';
  var q = { client_id: cli.id, redirect_uri: volta, response_type: 'code', scope: GCAL_ESCOPOS.concat([GCAL_ESCOPO_EMAIL]).concat(ocupado ? [GCAL_ESCOPO_OCUPADO] : []).join(' '), // 14.10: pede tambem o envio de e-mails
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: _gcalEstado_(profId, ocupado, Date.now()) };
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&');
}

function _gcalJson_(resposta) {
  try { return JSON.parse(resposta.getContentText()); } catch (e) { return null; }
}
/** E-mail da conta que deu a permissao (do id_token que o proprio Google devolveu ao servidor). */
function _gcalConta_(idToken) {
  try { return normalizarEmail(JSON.parse(_deB64url_(String(idToken || '').split('.')[1])).email || ''); } catch (e) { return ''; }
}

/**
 * Volta do Google (concluirConexaoAgenda): troca o codigo pela permissao e liga o espelho do profissional do `state`.
 * Devolve 'conectada' | 'negada' (o profissional nao permitiu) | 'erro'. Nunca lanca.
 */
function _gcalRetorno_(par) {
  try {
    var est = _gcalLerEstado_(par.state, Date.now());
    if (!est) return 'erro';
    if (par.error || !par.code) return 'negada';
    var cli = _gcalCliente_();
    if (!cli) return 'erro';
    var prof = buscarProfissional(est.profId);
    if (!prof || !_estaAtivo_(prof.ativo)) return 'erro';
    var controle = abrirControleDoProfissional(est.profId);
    if (!controle) return 'erro';
    var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', muteHttpExceptions: true,
      payload: { code: String(par.code), client_id: cli.id, client_secret: cli.segredo, redirect_uri: _gcalVolta_(), grant_type: 'authorization_code' } });
    var d = _gcalJson_(r);
    if (r.getResponseCode() !== 200 || !d || !d.refresh_token) { console.error('agenda externa: o Google nao devolveu a permissao (' + r.getResponseCode() + ')'); return 'erro'; }
    var conta = _gcalConta_(d.id_token), escopos = String(d.scope || '');
    var temOcupado = escopos.indexOf(GCAL_ESCOPO_OCUPADO) !== -1;
    // 14.10: a tela do Google mostra caixas — o profissional pode permitir a agenda, o envio de e-mails, os dois ou nenhum
    var temAgenda = escopos.indexOf(GCAL_ESCOPO_AGENDA) !== -1, temEmail = escopos.indexOf(GCAL_ESCOPO_EMAIL) !== -1;
    if (!temAgenda && !temEmail) {
      try { UrlFetchApp.fetch('https://oauth2.googleapis.com/revoke', { method: 'post', muteHttpExceptions: true, payload: { token: d.refresh_token } }); } catch (erroRevoga) { /* nada a retirar */ }
      return 'negada';
    }
    _comTrava_(function () {
      var antes = _gcalGuardada_(est.profId), cfg = _ageConfig_(controle);
      var outraConta = !antes || antes.conta !== conta;
      _gcalGuardar_(est.profId, { rt: d.refresh_token, conta: conta, escopos: escopos });
      if (_MEMO_.emailDe) delete _MEMO_.emailDe[est.profId];
      if (d.access_token) _cacheGuardar_('gcalat:' + est.profId, d.access_token, Math.max(60, (parseInt(d.expires_in, 10) || 3600) - 300));
      _ageConfigGravar_(controle, 'google_calendar', temAgenda ? 'Sim' : 'Nao');
      _ageConfigGravar_(controle, 'agenda_conta', conta);
      _ageConfigGravar_(controle, 'agenda_aviso', '');
      _ageConfigGravar_(controle, 'agenda_ocupado', temAgenda && temOcupado && (est.ocupado || cfg.agenda_ocupado === 'Sim') ? 'Sim' : 'Nao');
      if (outraConta) _ageConfigGravar_(controle, 'gcal_id', ''); // conta nova: a agenda do espelho nasce nela
      if (temAgenda) _calMarcarFuturas_(controle, outraConta);
    });
    return 'conectada';
  } catch (e) {
    console.error('agenda externa: a volta do Google falhou: ' + String(e && e.message || e).slice(0, 160));
    return 'erro';
  }
}

/**
 * 14.8.1: a pagina conectar.html do site (para onde o Google devolve o profissional, em OUTRA aba) entrega aqui o que
 * recebeu: `state` e `code`, ou `error` quando ele nao permitiu. Acao publica, sem cracha — a aba da volta nao tem a sessao
 * do profissional (que mora so na memoria da aba do COGNIATIVO); quem protege e o `state`, assinado pelo servidor, com o
 * profissional e a validade. Fica fora de ACOES_COM_TRAVA: a conversa com o Google roda sem a trava e so a gravacao a pega
 * (dentro de _gcalRetorno_). Devolve so o resultado — nenhum dado da conta, nenhuma permissao.
 */
function concluirConexaoAgenda(dados) {
  var d = dados && typeof dados === 'object' ? dados : {};
  var resultado = d.state ? _gcalRetorno_({ state: String(d.state), code: d.code ? String(d.code) : '', error: d.error ? String(d.error) : '' }) : 'erro';
  return { ok: resultado === 'conectada', resultado: resultado };
}

/** A permissao caiu no Google (retirada pelo profissional ou vencida): esquece, desliga o espelho e deixa o aviso para a tela. */
function _gcalCaiu_(profId) {
  _gcalEsquecer_(profId);
  try {
    var controle = abrirControleDoProfissional(profId);
    if (controle) _comTravaSeDer_(function () { _ageConfigGravar_(controle, 'google_calendar', 'Nao'); _ageConfigGravar_(controle, 'agenda_aviso', 'caiu'); });
  } catch (e) { /* o aviso fica para a proxima */ }
}

/** Token de acesso da conta conectada (55 minutos no cache). '' se nao ha conexao ou se ela caiu. */
function _gcalToken_(profId) {
  var g = _gcalGuardada_(profId);
  if (!g) return '';
  var guardado = _cacheLer_('gcalat:' + profId);
  if (guardado) return guardado;
  var cli = _gcalCliente_();
  if (!cli) return '';
  try {
    var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', muteHttpExceptions: true,
      payload: { client_id: cli.id, client_secret: cli.segredo, refresh_token: g.rt, grant_type: 'refresh_token' } });
    var d = _gcalJson_(r);
    if (r.getResponseCode() === 200 && d && d.access_token) {
      _cacheGuardar_('gcalat:' + profId, d.access_token, Math.max(60, (parseInt(d.expires_in, 10) || 3600) - 300));
      return d.access_token;
    }
    if (d && d.error === 'invalid_grant') _gcalCaiu_(profId);
  } catch (e) {
    console.error('agenda externa: nao renovei o acesso (' + String(e && e.message || e).slice(0, 120) + ')');
  }
  return '';
}

/** Token para falar com o Calendar do profissional: o da conta que ele conectou; para o dono do script, o do proprio script. */
function _calToken_(profId) {
  if (profId !== undefined && profId !== null) {
    if (_gcalGuardada_(profId)) return _gcalToken_(profId);
    if (!_calDoDono_(profId)) return '';
  }
  return ScriptApp.getOAuthToken();
}

/** O espelho esta ligado e ha por onde falar com o Google? */
function _calConectada_(profId, cfg) {
  return !!cfg && cfg.google_calendar === 'Sim' && (!!_gcalGuardada_(profId) || _calDoDono_(profId));
}

/** Como a tela mostra a conta conectada (nenhum segredo): { servico, disponivel, conectada, conta, ocupado, aviso, email, email_conta }.
 *  14.10: `email` = os e-mails aos pacientes saem da conta dele (`email_conta`); `ligada` = ha permissao guardada (agenda, e-mail ou os dois). */
function _calEstadoTela_(profId, cfg) {
  var g = _gcalGuardada_(profId), dono = !g && _calDoDono_(profId);
  var conectada = !!cfg && cfg.google_calendar === 'Sim' && (!!g || dono);
  var conta = '';
  if (conectada) { try { conta = g ? String(g.conta || '') : normalizarEmail(Session.getEffectiveUser().getEmail()); } catch (e) { conta = ''; } }
  return { servico: 'google', disponivel: !!g || dono || !!_gcalCliente_(), direta: dono, conectada: conectada, conta: conta, // `direta`: o dono do script liga sem ir ao Google
    ocupado: conectada && cfg.agenda_ocupado === 'Sim', aviso: conectada ? '' : String((cfg && cfg.agenda_aviso) || ''),
    ligada: !!g, email: _emailPermitido_(profId), email_conta: _emailPermitido_(profId) ? String(_emailRemetente_(profId).conta || '') : '' };
}

/** Compromissos pessoais do periodo como a Agenda os desenha: [ { data, hora_inicio, hora_fim } ], um pedaco por dia, sem titulo. */
function _calOcupadosTela_(profId, cfg, deIso, ateIso) {
  var a = _lemDia_(deIso), b = _lemDia_(ateIso), lista = [];
  if (a === null || b === null || b < a) return lista;
  _calOcupados_(profId, cfg, deIso, Math.min(b - a + 1, GCAL_OCUPADOS_DIAS)).forEach(function (o) {
    for (var d = Math.floor(o.ini / 1440); d <= Math.floor((o.fim - 1) / 1440); d++) {
      if (d < a || d > b) continue;
      var ini = Math.max(o.ini, d * 1440) - d * 1440, fim = Math.min(o.fim, (d + 1) * 1440) - d * 1440;
      lista.push({ data: _lemIso_(d), hora_inicio: _age2_(ini / 60) + ':' + _age2_(ini % 60), hora_fim: fim >= 1440 ? '23:59' : _age2_(fim / 60) + ':' + _age2_(fim % 60) });
    }
  });
  return lista;
}

/**
 * "Conectar Google Agenda". O dono do script ja tem a permissao: o espelho liga na hora. Os demais recebem o endereco
 * da tela de permissao do Google (`url`); a conexao se completa na volta (doGet). `dados`: { ocupado: true } pede junto
 * a permissao de ver os horarios ocupados.
 */
function profAgendaConectar(s, dados, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var d = dados && typeof dados === 'object' ? dados : {};
  if (!_gcalGuardada_(alvo.profissionalId) && _calDoDono_(alvo.profissionalId)) {
    _ageConfigGravar_(alvo.controle, 'google_calendar', 'Sim');
    _ageConfigGravar_(alvo.controle, 'agenda_aviso', '');
    _calMarcarFuturas_(alvo.controle);
    // as sessoes que ja existiam entram na fila; quem as leva ao Google e o gatilho (nada e enviado na hora)
    var ctx0 = _ageCtx_(alvo.controle, false), p0 = periodo && typeof periodo === 'object' ? periodo : {};
    ctx0.profId = alvo.profissionalId;
    return { ok: true, conectada: true, agenda: _ageLeitura_(ctx0, p0.de, p0.ate, _agePacientes_(alvo.controle), _lemAgora_()) };
  }
  var url = _gcalUrl_(alvo.profissionalId, d.ocupado === true);
  if (!url) return { ok: false, codigo: 'indisponivel', erro: MSG_GCAL_INDISPONIVEL };
  return { ok: true, conectada: false, url: url };
}

/** "Desconectar": retira a permissao no Google e desliga o espelho. O que ja esta na agenda do Google fica la. */
function profAgendaDesconectar(s, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  _gcalDesligar_(alvo.profissionalId);
  _ageConfigGravar_(alvo.controle, 'google_calendar', 'Nao');
  _ageConfigGravar_(alvo.controle, 'agenda_conta', '');
  _ageConfigGravar_(alvo.controle, 'agenda_ocupado', 'Nao');
  _ageConfigGravar_(alvo.controle, 'agenda_aviso', '');
  return _ageResposta_(alvo, { ok: true }, periodo, _lemAgora_());
}

/**
 * Opcao do profissional: os compromissos da agenda pessoal fecham horarios no COGNIATIVO? `dados`: { ocupado: true | false }.
 * Ligar numa conta conectada que ainda nao deu essa permissao devolve `url` (a tela do Google pede so o que falta).
 */
function profAgendaOpcao(s, dados, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var d = dados && typeof dados === 'object' ? dados : {}, cfg = _ageConfig_(alvo.controle);
  if (!_calConectada_(alvo.profissionalId, cfg)) return { ok: false, codigo: 'desconectada', erro: MSG_GCAL_CONECTE };
  if (d.ocupado === true) {
    var g = _gcalGuardada_(alvo.profissionalId);
    if (g && String(g.escopos || '').indexOf(GCAL_ESCOPO_OCUPADO) === -1) {
      var url = _gcalUrl_(alvo.profissionalId, true);
      if (!url) return { ok: false, codigo: 'indisponivel', erro: MSG_GCAL_INDISPONIVEL };
      return { ok: true, precisa_permissao: true, url: url };
    }
  }
  _ageConfigGravar_(alvo.controle, 'agenda_ocupado', d.ocupado === true ? 'Sim' : 'Nao');
  return _ageResposta_(alvo, { ok: true }, periodo, _lemAgora_());
}

/** 19.2.1: roda o gatilho dos lembretes a mao (clasp --user run run-function rodarLembretesAgora). Devolve so contagens. */
function rodarLembretesAgora() {
  return enviarLembretes_();
}

/**
 * 19.2.1: tira o gatilho dos lembretes (rollback do pacote: gatilho que aponta para funcao
 * que nao existe mais da erro toda hora). Uso: clasp --user run run-function removerGatilhoLembretes
 */
function removerGatilhoLembretes() {
  var removidos = 0;
  ScriptApp.getProjectTriggers().forEach(function (g) {
    if (g.getHandlerFunction() === 'enviarLembretes_') { ScriptApp.deleteTrigger(g); removidos++; }
  });
  return { ok: true, removidos: removidos };
}


// ============================================================
// FASE 20 — FLUXO DE CAIXA (Pacote 20.0)
// O financeiro LE a Agenda: o item a receber e a propria linha de `Sessoes`; nenhuma sessao e copiada.
// Abas novas na Controle (nascem no primeiro uso; toda celula e texto literal, `_lemCelula_`, lida por
// `getDisplayValues`): Fin_Cadastro, Fin_Pessoas, Fin_Pagamentos, Fin_Alocacoes, Fin_Cobrancas,
// Fin_Despesas_Fixas, Fin_Despesas e Config_Financeiro. Valores em CENTAVOS (inteiro em texto); o `valor`
// da sessao continua em reais, como a Agenda grava (`_finCent_` converte). Situacao de sessao e de
// cobranca (paga, parcial, atrasada) e sempre calculada, nunca gravada. As regras sao puras e recebem o
// "agora" por parametro. Nada e gerado nem enviado sozinho: nao ha gatilho neste bloco.
// ============================================================
var ABA_FIN_CADASTRO = 'Fin_Cadastro';
var ABA_FIN_PESSOAS = 'Fin_Pessoas';
var ABA_FIN_PAGAMENTOS = 'Fin_Pagamentos';
var ABA_FIN_ALOCACOES = 'Fin_Alocacoes';
var ABA_FIN_COBRANCAS = 'Fin_Cobrancas';
var ABA_FIN_FIXAS = 'Fin_Despesas_Fixas';
var ABA_FIN_DESPESAS = 'Fin_Despesas';
var ABA_FIN_CONFIG = 'Config_Financeiro';
var ABA_FIN_RECIBOS = 'Fin_Recibos'; // 20.1
var COLUNAS_FIN = {};
COLUNAS_FIN[ABA_FIN_CADASTRO] = ['id', 'modo', 'n', 'quando', 'pagador', 'recibo', 'titular', 'canal', 'encaminhamento', 'recibo_pedido_em', 'atualizado_em', 'enc_item', 'enc_sub', 'enc_texto', 'enc_nome']; // id = sigla do paciente; 19.5: encaminhamento em item e subitem (as quatro ultimas, aditivas)
COLUNAS_FIN[ABA_FIN_PESSOAS] = ['id', 'sigla', 'papel', 'nome', 'documento', 'telefone', 'email', 'criado_em'];
COLUNAS_FIN[ABA_FIN_PAGAMENTOS] = ['id', 'sigla', 'data', 'valor', 'forma', 'quem', 'origem', 'situacao', 'obs', 'arquivo_id', 'arquivo_nome', 'arquivo_tipo', 'criado_em', 'decidido_em'];
COLUNAS_FIN[ABA_FIN_ALOCACOES] = ['id', 'pagamento_id', 'sessao_id', 'sigla', 'valor', 'criado_em'];
COLUNAS_FIN[ABA_FIN_COBRANCAS] = ['id', 'sigla', 'para', 'canal', 'mes', 'sessoes', 'total', 'texto', 'vence_em', 'criada_em', 'enviada_em', 'enviada_por'];
COLUNAS_FIN[ABA_FIN_FIXAS] = ['id', 'nome', 'categoria', 'tipo', 'valor', 'dia', 'desde', 'encerrada_em', 'criado_em', 'conta', 'historico']; // 20.1: conta do plano de contas e historico fixo do item
COLUNAS_FIN[ABA_FIN_DESPESAS] = ['id', 'fixa_id', 'competencia', 'nome', 'categoria', 'valor', 'vence', 'paga_em', 'situacao', 'obs', 'arquivo_id', 'arquivo_nome', 'arquivo_tipo', 'criado_em', 'conta', 'historico', 'lote']; // 20.1: livro caixa
COLUNAS_FIN[ABA_FIN_CONFIG] = ['id', 'valor']; // id = chave
COLUNAS_FIN[ABA_FIN_RECIBOS] = ['id', 'sigla', 'mes', 'data', 'datas', 'unitario', 'modalidade', 'valor', 'descricao', 'titular_nome', 'titular_documento', 'situacao', 'numero', 'lote', 'arquivo_id', 'arquivo_nome', 'arquivo_tipo', 'criado_em', 'atualizado_em']; // 20.1
var FIN_CONFIG_PADRAO = { dados_receber: '', formas: 'Pix|Dinheiro|Transferência|Cartão|Outro', valor_padrao: '0', prazo_dias: '5',
  texto_cobranca: '{nome}, {saudacao}. Como vai?\n\nSegue o demonstrativo das sessões de {mes}.\n\n{demonstrativo}\n\n*Total: {total}*\n\nDados para o pagamento:\n*{dados}*',
  categorias: 'Aluguel|Contas (água, luz, internet)|Sistemas e assinaturas|Material|Serviços de terceiros|Formação e supervisão|Impostos e taxas|Outras',
  fiscal: 'Nao', cpf_emissor: '', cod_rendimento: 'R01.001.001', cod_ocupacao: '255' }; // 20.1: camada fiscal (desligada por padrao)
var FIN_CADASTRO_PADRAO = { modo: 'sessao', n: '', quando: '', pagador: 'paciente', recibo: 'Nao', titular: 'paciente', canal: 'ambos', encaminhamento: '', recibo_pedido_em: '', enc_item: '', enc_sub: '', enc_texto: '', enc_nome: '' };
/* 19.5 — Encaminhamento em item e subitem. A lista e a que o usuario aprovou em 25/11/2026 (onze itens; subitem so em rede
   social, medico e outro profissional de saude). Aqui ficam so as chaves; os rotulos sao da tela (FIN_ENC_ROTULOS, index-dev.html).
   Gravam-se item, subitem, texto do "outro" e nome em colunas separadas, para o grafico contar sem ler texto livre. */
var FIN_ENC = { rede_social: ['instagram', 'tiktok', 'facebook', 'youtube', 'outra'], busca: [], plataforma: [], paciente: [], colega: [],
  medico: ['psiquiatra', 'neurologista', 'cardiologista', 'clinico_geral', 'outra'],
  outro_prof: ['nutricionista', 'fisioterapeuta', 'fonoaudiologo', 'terapeuta_ocupacional', 'outro'], convenio: [], familiar: [], espontanea: [], outro: [] };
var FIN_ENC_TEXTO = { plataforma: true, outro: true };                       // itens com caixa de texto propria (o subitem "outra"/"outro" tambem abre a caixa)
var FIN_ENC_NOME = { colega: true, medico: true, outro_prof: true, convenio: true }; // itens com o nome de quem indicou (pode ficar em branco e ser preenchido depois)
/** Pura: o que a tela mandou vira os quatro campos validos; chave desconhecida vira vazio, e campo que nao cabe naquele item sai. */
function _finEnc_(d) {
  var tem = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var item = tem(FIN_ENC, String(d.enc_item || '')) ? String(d.enc_item) : '';
  var sub = item && FIN_ENC[item].indexOf(String(d.enc_sub || '')) !== -1 ? String(d.enc_sub) : '';
  return { enc_item: item, enc_sub: sub,
    enc_texto: (item && (tem(FIN_ENC_TEXTO, item) || sub === 'outra' || sub === 'outro')) ? _finTxt_(d.enc_texto, 80) : '',
    enc_nome: (item && tem(FIN_ENC_NOME, item)) ? _finTxt_(d.enc_nome, 100) : '' };
}
/** Pura: o encaminhamento de um cadastro. O texto livre de antes do 19.5 (coluna `encaminhamento`) aparece como "Outro" com aquele texto — nada se perde. */
function _finEncDoCad_(cad) {
  var o = _finEnc_(cad || {});
  if (!o.enc_item && String((cad || {}).encaminhamento || '').trim()) o = { enc_item: 'outro', enc_sub: '', enc_texto: String(cad.encaminhamento).trim(), enc_nome: '' };
  return o;
}
var FIN_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
var FIN_ARQUIVO_MAX_B64 = 7200000;      // ~5,4 MB em base64 (o limite dito na tela e 5 MB)
var FIN_ARQUIVO_TIPOS = ['image/jpeg', 'image/png', 'application/pdf'];
var FIN_COBRANCAS_EMAIL_DIA_MAX = 60;   // e-mails de cobranca por dia (cota propria)
var FIN_PASTA_COMPROVANTES = 'Comprovantes';

// ---------- regras puras ----------

/** Dinheiro digitado ("280", "280,5", "1.120,00", "R$ 90") -> centavos inteiros (0 se nao for numero). */
function _finCent_(txt) {
  var t = String(txt === undefined || txt === null ? '' : txt).replace(/[^0-9.,]/g, '');
  if (!t) return 0;
  if (t.indexOf(',') !== -1) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  var n = Math.round(parseFloat(t) * 100);
  return isFinite(n) && n > 0 ? n : 0;
}
/** Centavos que vieram da tela (inteiro >= 0, teto de R$ 999.999,99); qualquer outra coisa vira -1. */
function _finInt_(v) {
  var n = Number(v);
  return (typeof v !== 'boolean' && v !== '' && v !== null && isFinite(n) && Math.floor(n) === n && n >= 0 && n <= 99999999) ? n : -1;
}
function _finBRL_(c) {
  var n = Math.round(Number(c) || 0), neg = n < 0; n = Math.abs(n);
  return (neg ? '- ' : '') + 'R$ ' + String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + ('0' + (n % 100)).slice(-2);
}
function _finDataLonga_(iso) { var p = String(iso).split('-'); return p[2] + ' de ' + FIN_MESES[Number(p[1]) - 1] + ' de ' + p[0]; }
function _finMesNome_(mes) { var p = String(mes).split('-'); return FIN_MESES[Number(p[1]) - 1] + ' de ' + p[0]; }
/** Ultimo dia ('AAAA-MM-DD') do mes 'AAAA-MM'. */
function _finFimDoMes_(mes) { var p = String(mes).split('-'); return _lemIso_(Math.round(Date.UTC(Number(p[0]), Number(p[1]), 0) / 86400000)); }
/** 'AAAA-MM' deslocado de `n` meses. */
function _finMesMais_(mes, n) {
  var p = String(mes).split('-'), t = Number(p[0]) * 12 + (Number(p[1]) - 1) + n;
  return Math.floor(t / 12) + '-' + ('0' + (t % 12 + 1)).slice(-2);
}
/** CPF (11) ou CNPJ (14) com os digitos conferidos. Devolve so os digitos, '' se vazio, null se invalido. */
function _finDocumento_(txt) {
  var d = String(txt === undefined || txt === null ? '' : txt).replace(/\D/g, '');
  if (!d) return '';
  var dv = function (base, pesos) { var s = 0; for (var i = 0; i < pesos.length; i++) s += Number(base.charAt(i)) * pesos[i]; var r = s % 11; return r < 2 ? 0 : 11 - r; };
  if (/^(\d)\1+$/.test(d)) return null;
  if (d.length === 11) {
    var a = dv(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]), b = dv(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return (a === Number(d.charAt(9)) && b === Number(d.charAt(10))) ? d : null;
  }
  if (d.length === 14) {
    var c1 = dv(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]), c2 = dv(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return (c1 === Number(d.charAt(12)) && c2 === Number(d.charAt(13))) ? d : null;
  }
  return null;
}
/** O documento como a tela o mostra na leitura em lista: so o miolo (nunca o numero inteiro fora do cadastro aberto). */
function _finDocMascara_(d) {
  d = String(d || '').replace(/\D/g, '');
  if (d.length === 11) return '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**';
  if (d.length === 14) return '**.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/****-**';
  return '';
}
/** A sessao ja aconteceu em relacao ao "agora"? */
function _finPassou_(x, agora) { return x.data < agora.data || (x.data === agora.data && _lemHora_(x.hora_inicio) <= agora.hora); }
/**
 * A sessao entra no "a receber"? A tabela da Agenda manda (`cobrada`): Sim entra, Nao nao entra, reposicao nunca.
 * Sem situacao marcada: a que ja ocorreu entra como proposta; a futura so entra para quem paga o mes
 * (mensal adiantado ou por faixa) e so no mes corrente.
 */
function _finCobravel_(x, cad, agora) {
  if (x.reposicao_de) return false;
  if (x.cobrada === 'Sim') return true;
  if (x.cobrada === 'Nao' || x.estado === 'cancelada') return false;
  if (_finPassou_(x, agora)) return true;
  return cad.modo === 'mensal' && cad.quando !== 'seguinte' && String(x.data).slice(0, 7) === agora.data.slice(0, 7);
}
/**
 * A sessao em aberto ja pode ser cobrada hoje, pelo modo de pagamento do paciente?
 * Por sessao e a cada N: so o que ja ocorreu (e, no N, so com N ocorridas em aberto). Mensal: mes fechado em
 * aberto sempre; mes corrente desde o dia 1 (adiantado e faixa 1 a 10), o dia 11 ou o dia 21; "mes seguinte"
 * so depois que o mes fecha.
 */
function _finElegivel_(s, cad, hojeIso, ocorridasAbertas) {
  if (cad.modo !== 'mensal') return !s.futura && (cad.modo !== 'n' || ocorridasAbertas >= (parseInt(cad.n, 10) || 2));
  var mes = s.data.slice(0, 7), mesHoje = hojeIso.slice(0, 7), dia = Number(hojeIso.slice(8, 10));
  if (mes !== mesHoje) return mes < mesHoje;
  if (cad.quando === 'seguinte') return false;
  return cad.quando === 'f2' ? dia >= 11 : (cad.quando === 'f3' ? dia >= 21 : true);
}
/** Sugestao de abatimento: as mais antigas primeiro, ate o valor acabar. Devolve { itens: [{sessao, valor}], sobra }. */
function _finSugerir_(abertas, valor) {
  var resta = valor, itens = [];
  abertas.slice().sort(function (a, b) { return (a.data + a.hora).localeCompare(b.data + b.hora); }).forEach(function (s) {
    var falta = s.valor - s.pago;
    if (resta <= 0 || falta <= 0) return;
    var v = Math.min(resta, falta); itens.push({ sessao: s.id, valor: v }); resta -= v;
  });
  return { itens: itens, sobra: resta };
}
/** Periodo pedido pela tela -> { de, ate, rotulo, antes: {de, ate} } (o periodo de comparacao). */
function _finPeriodo_(p, hojeIso) {
  p = p && typeof p === 'object' ? p : {};
  var hoje = _lemDia_(hojeIso), mes = hojeIso.slice(0, 7), ano = hojeIso.slice(0, 4), de, ate, rotulo;
  var maiuscula = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
  if (p.periodo === 'mes_passado') { mes = _finMesMais_(mes, -1); de = mes + '-01'; ate = _finFimDoMes_(mes); rotulo = maiuscula(_finMesNome_(mes)); }
  else if (p.periodo === 'semana') { var seg = hoje - ((new Date(hoje * 86400000).getUTCDay() + 6) % 7); de = _lemIso_(seg); ate = _lemIso_(seg + 6); rotulo = 'Semana de ' + de.slice(8) + '/' + de.slice(5, 7) + ' a ' + ate.slice(8) + '/' + ate.slice(5, 7); }
  else if (p.periodo === 'ano') { de = ano + '-01-01'; ate = ano + '-12-31'; rotulo = 'Ano de ' + ano; }
  else if (p.periodo === '12m') { de = _finMesMais_(mes, -11) + '-01'; ate = _finFimDoMes_(mes); rotulo = 'Últimos 12 meses'; }
  else if (p.periodo === 'personalizado' && _lemDia_(p.de) !== null && _lemDia_(p.ate) !== null && p.de <= p.ate && _lemDia_(p.ate) - _lemDia_(p.de) <= 400) {
    de = p.de; ate = p.ate; rotulo = de.slice(8) + '/' + de.slice(5, 7) + '/' + de.slice(0, 4) + ' a ' + ate.slice(8) + '/' + ate.slice(5, 7) + '/' + ate.slice(0, 4);
  } else { de = mes + '-01'; ate = _finFimDoMes_(mes); rotulo = maiuscula(_finMesNome_(mes)); }
  var dias = _lemDia_(ate) - _lemDia_(de) + 1, antes;
  if (p.comparar === 'ano_passado') antes = { de: (Number(de.slice(0, 4)) - 1) + de.slice(4), ate: (Number(ate.slice(0, 4)) - 1) + ate.slice(4) };
  else if (de.slice(8) === '01' && ate === _finFimDoMes_(ate.slice(0, 7))) { // meses inteiros: compara com os meses inteiros anteriores
    var n = (Number(ate.slice(0, 4)) * 12 + Number(ate.slice(5, 7))) - (Number(de.slice(0, 4)) * 12 + Number(de.slice(5, 7))) + 1;
    antes = { de: _finMesMais_(de.slice(0, 7), -n) + '-01', ate: _finFimDoMes_(_finMesMais_(ate.slice(0, 7), -n)) };
  } else antes = { de: _lemIso_(_lemDia_(de) - dias), ate: _lemIso_(_lemDia_(de) - 1) };
  return { de: de, ate: ate, rotulo: rotulo, dias: dias, antes: antes };
}
/** "bom dia" ate 11:59, "boa tarde" ate 17:59, "boa noite" depois. */
function _finSaudacao_(hora) { return hora < '12:00' ? 'bom dia' : (hora < '18:00' ? 'boa tarde' : 'boa noite'); }
/** A mensagem de cobranca: o modelo da configuracao com {nome}, {saudacao}, {mes}, {demonstrativo}, {total} e {dados}. */
function _finTextoCobranca_(modelo, v) {
  var n = v.sessoes.length, valores = {};
  v.sessoes.forEach(function (s) { valores[s.valor] = true; });
  var umValor = Object.keys(valores).length === 1;
  var demo = n + (n === 1 ? ' sessão' : ' sessões') + ' de psicoterapia' + (umValor ? ' (' + _finBRL_(v.sessoes[0].valor) + (n === 1 ? ')' : ' cada)') : '') + (n === 1 ? ', no dia:' : ', nos dias:') + '\n' +
    v.sessoes.map(function (s, i) { return String.fromCharCode(97 + (i % 26)) + '. ' + _finDataLonga_(s.data) + (umValor ? '' : ' (' + _finBRL_(s.valor) + ')') + (s.pago ? ' (já pago: ' + _finBRL_(s.pago) + ')' : ''); }).join('\n');
  var troca = { nome: v.nome, saudacao: v.saudacao, mes: v.mes, demonstrativo: demo, total: _finBRL_(v.total), dados: v.dados || '' };
  return String(modelo || FIN_CONFIG_PADRAO.texto_cobranca).replace(/\{(nome|saudacao|mes|demonstrativo|total|dados)\}/g, function (_, k) { return troca[k]; });
}

// ---------- leitura das abas ----------

function _finAba_(controle, nome, criar) { return _ageAba_(controle, nome, COLUNAS_FIN[nome], criar); }
function _finGravar_(controle, nome, linha, campos) { _ageGravar_(_finAba_(controle, nome, true), COLUNAS_FIN[nome], linha, campos); }
function _finConfigDe_(linhas) {
  var c = {}, k;
  for (k in FIN_CONFIG_PADRAO) c[k] = FIN_CONFIG_PADRAO[k];
  linhas.forEach(function (l) { c[l.id] = l.valor; });
  var lista = function (t) { return String(t || '').split('|').map(function (x) { return x.trim(); }).filter(function (x) { return x; }); };
  return { dados_receber: c.dados_receber, formas: lista(c.formas), valor_padrao: Math.max(0, parseInt(c.valor_padrao, 10) || 0), prazo_dias: Math.min(90, Math.max(0, parseInt(c.prazo_dias, 10) || 0)),
    texto_cobranca: c.texto_cobranca, categorias: lista(c.categorias), fiscal: c.fiscal === 'Sim', fiscal_disponivel: true, cpf_emissor: c.cpf_emissor, cod_rendimento: c.cod_rendimento, cod_ocupacao: c.cod_ocupacao };
}
/** Tudo o que as regras precisam, lido uma vez: sessoes da Agenda, pacientes, abas do financeiro e a configuracao. Leitura nunca cria aba. */
function _finCtx_(controle) {
  var ler = function (nome) { return _lembretesLer_(_finAba_(controle, nome, false)); };
  var c = { controle: controle, cfgAgenda: _ageConfig_(controle), pacs: _agePacientes_(controle), cadastros: {} };
  c.abaS = _ageAba_(controle, ABA_SESSOES, COLUNAS_SESSOES, false);
  c.sessoes = _lembretesLer_(c.abaS);
  ler(ABA_FIN_CADASTRO).forEach(function (l) { c.cadastros[_siglaChave_(l.id)] = l; });
  c.pessoas = ler(ABA_FIN_PESSOAS); c.pagamentos = ler(ABA_FIN_PAGAMENTOS); c.alocacoes = ler(ABA_FIN_ALOCACOES);
  c.cobrancas = ler(ABA_FIN_COBRANCAS); c.fixas = ler(ABA_FIN_FIXAS); c.despesas = ler(ABA_FIN_DESPESAS); c.recibos = ler(ABA_FIN_RECIBOS);
  c.config = _finConfigDe_(ler(ABA_FIN_CONFIG));
  return c;
}
function _finCad_(c, sigla) {
  var l = c.cadastros[_siglaChave_(sigla)] || {}, o = {}, k;
  for (k in FIN_CADASTRO_PADRAO) o[k] = l[k] || FIN_CADASTRO_PADRAO[k];
  return o;
}
/** Valor da sessao em centavos: o da sessao; sem ele, o do cadastro do paciente; sem ele, o valor padrao do profissional. */
function _finValor_(x, c) {
  var p = c.pacs[_siglaChave_(x.sigla)];
  return _finCent_(x.valor) || _finCent_(p && p.valor) || c.config.valor_padrao;
}
/**
 * O estado calculado: quanto cada sessao ja recebeu, o credito de cada paciente e a lista de sessoes como o
 * financeiro as ve. So pagamento CONFIRMADO conta (comprovante aguardando, recusado e pagamento desfeito nao).
 */
function _finEstado_(c, agora) {
  var e = { pago: {}, credito: {}, sessoes: [], porId: {}, confirmados: {}, pagoEm: {} };
  c.pagamentos.forEach(function (p) {
    if (p.situacao !== 'confirmado') return;
    var s = _siglaChave_(p.sigla);
    e.confirmados[p.id] = p; e.credito[s] = (e.credito[s] || 0) + (parseInt(p.valor, 10) || 0);
  });
  c.alocacoes.forEach(function (a) {
    var p = e.confirmados[a.pagamento_id], v = parseInt(a.valor, 10) || 0, s = _siglaChave_(a.sigla);
    if (!p) return;
    e.pago[a.sessao_id] = (e.pago[a.sessao_id] || 0) + v; e.credito[s] = (e.credito[s] || 0) - v;
    if (!e.pagoEm[a.sessao_id] || p.data > e.pagoEm[a.sessao_id]) e.pagoEm[a.sessao_id] = p.data;
  });
  c.sessoes.forEach(function (x) {
    var estado = x.estado || 'agendada';
    if (estado === 'cancelada' && x.cobrada !== 'Sim') return; // cancelada sem cobranca nao e assunto do financeiro
    if (_lemDia_(x.data) === null) return;
    var passou = _finPassou_(x, agora), cobravel = _finCobravel_(x, _finCad_(c, x.sigla), agora);
    var s = { id: x.id, sigla: String(x.sigla).trim(), data: x.data, hora: _lemHora_(x.hora_inicio), modalidade: x.modalidade === 'online' ? 'online' : 'presencial',
      estado: (estado === 'agendada' && passou) ? 'ocorrida' : estado, cobravel: cobravel, valor: _finValor_(x, c), pago: 0, reposicao: !!x.reposicao_de, futura: !passou, cancelada_por: x.cancelada_por || '' };
    s.pago = Math.min(e.pago[x.id] || 0, s.valor);
    e.sessoes.push(s); e.porId[s.id] = s;
  });
  e.sessoes.sort(function (a, b) { return (a.data + a.hora).localeCompare(b.data + b.hora); });
  return e;
}
function _finAbertas_(e, sigla) {
  var alvo = sigla ? _siglaChave_(sigla) : '';
  return e.sessoes.filter(function (s) { return s.cobravel && s.pago < s.valor && (!alvo || _siglaChave_(s.sigla) === alvo); });
}
/** Situacao da cobranca, calculada: a_enviar, enviada, parcial (recebeu parte depois de cobrada), atrasada (vencida com saldo) ou paga. */
function _finCobranca_(cb, e, hojeIso) {
  var ids = String(cb.sessoes || '').split(',').filter(function (x) { return x; }), total = 0, pago = 0, pagaEm = '';
  ids.forEach(function (id) {
    var s = e.porId[id];
    if (!s || !s.cobravel) return;
    total += s.valor; pago += s.pago;
    if (e.pagoEm[id] && e.pagoEm[id] > pagaEm) pagaEm = e.pagoEm[id];
  });
  // `total` = o que a cobranca pediu (gravado ao gerar ou enviar); `falta` = o que as sessoes dela ainda devem hoje
  var falta = total - pago, cobrado = parseInt(cb.total, 10) || total;
  var sit = !cb.enviada_em ? 'a_enviar' : (falta <= 0 ? 'paga' : ((cb.vence_em && cb.vence_em < hojeIso) ? 'atrasada' : (falta < cobrado ? 'parcial' : 'enviada')));
  return { id: cb.id, sigla: cb.sigla, para: cb.para, canal: cb.canal, mes: _finMesNome_(cb.mes), sessoes: ids, total: cobrado, falta: Math.max(0, falta), pago: Math.max(0, cobrado - Math.max(0, falta)), texto: cb.texto, vence_em: cb.vence_em,
    enviada_em: String(cb.enviada_em || '').slice(0, 10), paga_em: sit === 'paga' ? pagaEm : '', situacao: sit };
}
/** O que o sistema PROPOE cobrar hoje: por paciente e por mes das sessoes, fora o que ja esta numa cobranca ainda nao paga. */
function _finPropostas_(c, e, hojeIso) {
  var emCobranca = {}, grupos = {}, ordem = [];
  c.cobrancas.forEach(function (cb) { var v = _finCobranca_(cb, e, hojeIso); if (v.situacao !== 'paga') v.sessoes.forEach(function (id) { emCobranca[id] = true; }); });
  var ocorridas = {};
  _finAbertas_(e).forEach(function (s) { if (!s.futura) ocorridas[_siglaChave_(s.sigla)] = (ocorridas[_siglaChave_(s.sigla)] || 0) + 1; });
  _finAbertas_(e).forEach(function (s) {
    var sig = _siglaChave_(s.sigla), p = c.pacs[sig], cad = _finCad_(c, sig);
    if (!p || !p.ativo || emCobranca[s.id] || !_finElegivel_(s, cad, hojeIso, ocorridas[sig] || 0)) return;
    var k = sig + '|' + s.data.slice(0, 7);
    if (!grupos[k]) { grupos[k] = { sigla: s.sigla, mes: s.data.slice(0, 7), sessoes: [], total: 0, motivo: _finMotivo_(cad) }; ordem.push(k); }
    grupos[k].sessoes.push(s.id); grupos[k].total += s.valor - s.pago;
  });
  return ordem.map(function (k) { return grupos[k]; });
}
function _finMotivo_(cad) {
  if (cad.modo === 'n') return 'A cada ' + (parseInt(cad.n, 10) || 2) + ' sessões';
  if (cad.modo !== 'mensal') return 'Por sessão';
  return 'Mensal, ' + ({ adiantado: 'adiantado', f1: 'do dia 1 ao 10', f2: 'do dia 11 ao 20', f3: 'do dia 21 ao fim do mês', seguinte: 'no mês seguinte' })[cad.quando || 'f1'];
}
/** Pagadores do paciente (so nomes na leitura em lista): os cadastrados ou, se for ele mesmo quem paga, o proprio paciente. */
function _finPagadores_(c, sigla, completo) {
  var sig = _siglaChave_(sigla), p = c.pacs[sig] || {};
  if (_finCad_(c, sig).pagador !== 'outro') return [{ nome: p.nome || sigla, email: p.email || '', telefone: p.telefone || '' }];
  var lista = c.pessoas.filter(function (x) { return _siglaChave_(x.sigla) === sig && x.papel === 'pagador'; }).map(function (x) {
    return completo ? { nome: x.nome, documento: x.documento, telefone: x.telefone, email: x.email } : { nome: x.nome, email: x.email, telefone: x.telefone };
  });
  return lista.length ? lista : [{ nome: p.nome || sigla, email: p.email || '', telefone: p.telefone || '' }];
}
/**
 * Contas do periodo: as despesas lancadas e, para cada despesa fixa ativa, a conta de cada mes que ainda
 * nao tem lancamento (nasce na leitura, com o id `fixa:<id>:<AAAA-MM>`; so vira linha quando o profissional paga).
 * Valor fixo sugere o ultimo valor pago; valor variavel vem em branco (0) ate ele informar.
 */
function _finDespesas_(c, de, ate, hojeIso) {
  var lista = [], temLinha = {}, ultimo = {}, tipoDe = {};
  c.fixas.forEach(function (f) { tipoDe[f.id] = f.tipo === 'variavel' ? 'variavel' : 'fixo'; });
  c.despesas.slice().sort(function (a, b) { return String(a.competencia).localeCompare(String(b.competencia)); }).forEach(function (d) {
    if (d.fixa_id) { temLinha[d.fixa_id + '|' + d.competencia] = true; if (d.situacao === 'paga') ultimo[d.fixa_id] = parseInt(d.valor, 10) || 0; }
    var ref = d.situacao === 'paga' ? d.paga_em : d.vence;
    if (ref >= de && ref <= ate) lista.push({ id: d.id, nome: d.nome, categoria: d.categoria, valor: parseInt(d.valor, 10) || 0, vence: d.vence, paga_em: d.paga_em, situacao: d.situacao === 'paga' ? 'paga' : 'a_pagar',
      fixa: !!d.fixa_id, tipo: d.fixa_id ? (tipoDe[d.fixa_id] || 'fixo') : '', obs: d.obs, tem_arquivo: !!d.arquivo_id, conta: d.conta || '', historico: d.historico || '', em_lote: !!d.lote });
  });
  c.fixas.forEach(function (f) {
    var mes = de.slice(0, 7), fim = ate.slice(0, 7) < hojeIso.slice(0, 7) ? ate.slice(0, 7) : hojeIso.slice(0, 7);
    for (; mes <= fim; mes = _finMesMais_(mes, 1)) {
      if (mes < String(f.desde).slice(0, 7) || (f.encerrada_em && mes > String(f.encerrada_em).slice(0, 7)) || temLinha[f.id + '|' + mes]) continue;
      var ultimoDia = Number(_finFimDoMes_(mes).slice(8)), vence = mes + '-' + ('0' + Math.min(ultimoDia, Math.max(1, parseInt(f.dia, 10) || 1))).slice(-2);
      if (vence < de || vence > ate) continue;
      lista.push({ id: 'fixa:' + f.id + ':' + mes, nome: f.nome, categoria: f.categoria, valor: f.tipo === 'variavel' ? 0 : (ultimo[f.id] !== undefined ? ultimo[f.id] : (parseInt(f.valor, 10) || 0)),
        vence: vence, paga_em: '', situacao: 'a_pagar', fixa: true, tipo: f.tipo === 'variavel' ? 'variavel' : 'fixo', obs: '', tem_arquivo: false, conta: f.conta || '', historico: f.historico || '', em_lote: false });
    }
  });
  return lista.sort(function (a, b) { return String(a.vence).localeCompare(String(b.vence)); });
}
/** Recebido (pelo mes das sessoes) e despesas pagas de um intervalo: os numeros da comparacao. */
function _finTotais_(c, e, de, ate, hojeIso) {
  var t = { recebido: 0, despesas: 0 };
  e.sessoes.forEach(function (s) { if (s.cobravel && s.data >= de && s.data <= ate) t.recebido += s.pago; });
  _finDespesas_(c, de, ate, hojeIso).forEach(function (d) { if (d.situacao === 'paga') t.despesas += d.valor; });
  return t;
}
/** Os numeros do Resumo que nao saem da lista de sessoes do periodo. */
function _finResumo_(c, e, per, agora) {
  var hoje = agora.data, ano = hoje.slice(0, 4), r = { recebido_entrada: 0, anterior: _finTotais_(c, e, per.antes.de, per.antes.ate, hoje) };
  c.pagamentos.forEach(function (p) { if (p.situacao === 'confirmado' && p.data >= per.de && p.data <= per.ate) r.recebido_entrada += parseInt(p.valor, 10) || 0; });
  // serie do grafico: por dia ate 62 dias; acima disso, por mes
  var porMes = per.dias > 62, mapa = {}, chaves = [];
  if (porMes) { for (var m = per.de.slice(0, 7); m <= per.ate.slice(0, 7); m = _finMesMais_(m, 1)) { mapa[m] = { dia: m + '-01', sessoes: 0, valor: 0 }; chaves.push(m); } }
  else { for (var d = _lemDia_(per.de); d <= _lemDia_(per.ate); d++) { mapa[_lemIso_(d)] = { dia: _lemIso_(d), sessoes: 0, valor: 0 }; chaves.push(_lemIso_(d)); } }
  var noPeriodo = e.sessoes.filter(function (s) { return s.data >= per.de && s.data <= per.ate; });
  noPeriodo.forEach(function (s) { var k = porMes ? s.data.slice(0, 7) : s.data; if (s.cobravel && mapa[k]) { mapa[k].sessoes++; mapa[k].valor += s.valor; } });
  r.granul = porMes ? 'mes' : 'dia';
  r.serie = chaves.map(function (k) { return mapa[k]; });
  // o ano corrente
  var a = { fat: 0, n: 0, rec: 0, com: 0, sem: 0, meses: {} };
  e.sessoes.forEach(function (s) {
    if (!s.cobravel || s.data.slice(0, 4) !== ano) return;
    a.fat += s.valor; a.n++; a.rec += s.pago; a.meses[s.data.slice(0, 7)] = true;
    if (_finCad_(c, s.sigla).recibo === 'Sim') a.com += s.valor; else a.sem += s.valor;
  });
  var nMeses = Object.keys(a.meses).length, media = nMeses ? Math.round(a.fat / nMeses) : 0;
  r.ano = { faturamento: a.fat, valor_medio: a.n ? Math.round(a.fat / a.n) : 0, acumulado: a.rec, media_mensal: media, com_recibo: a.com, sem_recibo: a.sem, projecao: media * 12 };
  // agenda do periodo (todas as linhas de Sessoes, tambem as canceladas sem cobranca)
  var g = { realizadas: 0, faltas: 0, canc_prof: 0, canc_pac: 0, online: 0, presencial: 0 }, primeira = {}, temNoPeriodo = {}, temAntes = {}, temDepois = {};
  c.sessoes.forEach(function (x) {
    var sig = _siglaChave_(x.sigla), estado = x.estado || 'agendada';
    if (_lemDia_(x.data) === null) return;
    if (estado !== 'cancelada' && (!primeira[sig] || x.data < primeira[sig])) primeira[sig] = x.data;
    if (estado !== 'cancelada' && x.data > per.ate) temDepois[sig] = true;
    if (estado !== 'cancelada' && x.data >= per.antes.de && x.data <= per.antes.ate) temAntes[sig] = true;
    if (x.data < per.de || x.data > per.ate) return;
    if (estado === 'cancelada') { if (x.cancelada_por === 'paciente') g.canc_pac++; else if (x.cancelada_por !== 'edicao_serie') g.canc_prof++; return; }
    temNoPeriodo[sig] = true;
    if (estado === 'falta') g.faltas++; else if (estado === 'realizada' || _finPassou_(x, agora)) g.realizadas++;
    if (x.modalidade === 'online') g.online++; else g.presencial++;
  });
  var totalAg = g.realizadas + g.faltas + g.canc_prof + g.canc_pac, pct = function (n) { return totalAg ? Math.round(n * 100 / totalAg) : 0; };
  g.pct_faltas = pct(g.faltas); g.pct_canc_prof = pct(g.canc_prof); g.pct_canc_pac = pct(g.canc_pac);
  r.agenda = g;
  var pc = { novos: 0, regulares: 0, sem_sessao: 0, sairam: 0, com_saldo: 0 }, saldo = {}, enc = {};
  _finAbertas_(e).forEach(function (s) { saldo[_siglaChave_(s.sigla)] = true; });
  Object.keys(c.pacs).forEach(function (sig) {
    var p = c.pacs[sig];
    if (saldo[sig]) pc.com_saldo++;
    if (temNoPeriodo[sig]) { if (primeira[sig] >= per.de) pc.novos++; else pc.regulares++; }
    else if (temAntes[sig] && !temDepois[sig]) pc.sairam++;
    else if (p.ativo) pc.sem_sessao++;
    // 19.5: conta todo paciente com encaminhamento informado, ativo ou nao (palavra do usuario: "de onde veio mais pacientes"), no item e no subitem
    var origem = _finEncDoCad_(_finCad_(c, sig));
    if (origem.enc_item) {
      var g = enc[origem.enc_item] || (enc[origem.enc_item] = { n: 0, subs: {} });
      g.n++;
      if (origem.enc_sub) g.subs[origem.enc_sub] = (g.subs[origem.enc_sub] || 0) + 1;
    }
  });
  r.pacientes = pc;
  var porN = function (x, y) { return y.n - x.n || String(x.item || x.sub).localeCompare(String(y.item || y.sub)); };
  r.encaminhamento = Object.keys(enc).map(function (k) {
    return { item: k, n: enc[k].n, subs: Object.keys(enc[k].subs).map(function (s) { return { sub: s, n: enc[k].subs[s] }; }).sort(porN) };
  }).sort(porN);
  return r;
}
function _finComprovantes_(c) {
  return c.pagamentos.filter(function (p) { return p.origem === 'comprovante' && p.situacao === 'aguardando'; }).map(function (p) {
    var pac = c.pacs[_siglaChave_(p.sigla)] || {};
    return { id: p.id, sigla: p.sigla, nome: pac.nome || p.sigla, valor: parseInt(p.valor, 10) || 0, data: p.data, arquivo_nome: p.arquivo_nome, arquivo_tipo: p.arquivo_tipo };
  });
}
/** A leitura da pagina Fluxo de caixa. */
function _finLeitura_(c, p, agora) {
  var e = _finEstado_(c, agora), per = _finPeriodo_(p, agora.data), comSessao = {};
  var sessoes = e.sessoes.filter(function (s) { return s.data >= per.de && s.data <= per.ate; });
  var abertas = _finAbertas_(e);
  sessoes.concat(abertas).forEach(function (s) { comSessao[_siglaChave_(s.sigla)] = true; });
  var pacientes = Object.keys(c.pacs).filter(function (sig) { return c.pacs[sig].ativo || comSessao[sig] || (e.credito[sig] || 0) > 0; }).map(function (sig) {
    var pc = c.pacs[sig], cad = _finCad_(c, sig);
    return { sigla: sig, nome: pc.nome, telefone: pc.telefone, tem_email: !!pc.email, valor: _finCent_(pc.valor) || c.config.valor_padrao, modo: cad.modo, n: cad.n, quando: cad.quando,
      recibo: cad.recibo === 'Sim', canal: cad.canal, encaminhamento: cad.encaminhamento, pagadores: _finPagadores_(c, sig, false).map(function (x) { return { nome: x.nome, tem_email: !!x.email, telefone: x.telefone }; }),
      credito: Math.max(0, e.credito[sig] || 0), recibo_pedido: String(cad.recibo_pedido_em || '').slice(0, 7) === agora.data.slice(0, 7) };
  }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
  return { hoje: agora.data, periodo: { de: per.de, ate: per.ate, rotulo: per.rotulo }, config: c.config, pacientes: pacientes, sessoes: sessoes, abertas: abertas,
    cobrancas: c.cobrancas.map(function (cb) { var v = _finCobranca_(cb, e, agora.data); v.recibo_emitido = c.recibos.some(function (r) { return _siglaChave_(r.sigla) === _siglaChave_(cb.sigla) && r.mes === cb.mes && (r.situacao === 'emitido' || r.situacao === 'no_lote'); }); return v; }).sort(function (a, b) { return String(b.vence_em).localeCompare(String(a.vence_em)); }),
    propostas: _finPropostas_(c, e, agora.data), despesas: _finDespesas_(c, per.de, per.ate, agora.data), comprovantes: _finComprovantes_(c),
    recibos: c.config.fiscal ? _finRecibos_(c, e, per, agora.data) : [], lote: c.config.fiscal ? _finLote_(c, e, per, agora.data) : null, fiscal: c.config.fiscal ? _finDemonstrativo_(c, per) : null, // 20.1
    resumo: _finResumo_(c, e, per, agora) };
}
/** O financeiro de UM paciente, para o modulo do paciente aberto: cadastro (com os documentos), o que a anamnese ja tem e o extrato. */
function _finPaciente_(c, sigla, agora) {
  var sig = _siglaChave_(sigla), e = _finEstado_(c, agora), cad = _finCad_(c, sig), pc = c.pacs[sig] || {}, extrato = [], emAberto = 0;
  e.sessoes.forEach(function (s) {
    if (_siglaChave_(s.sigla) !== sig || !s.cobravel) return;
    emAberto += s.valor - s.pago;
    extrato.push({ data: s.data, tipo: 'sessao', id: s.id, texto: ({ falta: 'Sessão (falta)', cancelada: 'Sessão (cancelada fora do prazo)', agendada: 'Sessão agendada' })[s.estado] || 'Sessão realizada', situacao: s.pago >= s.valor ? 'paga' : (s.pago ? 'parcial' : 'aberta'), valor: s.valor, pago: s.pago });
  });
  c.pagamentos.forEach(function (p) {
    if (_siglaChave_(p.sigla) !== sig || p.situacao !== 'confirmado') return;
    extrato.push({ data: p.data, tipo: 'pagamento', id: p.id, texto: 'Pagamento' + (p.forma ? ' · ' + p.forma : '') + (p.quem && p.quem !== pc.nome ? ' · ' + p.quem : ''), valor: parseInt(p.valor, 10) || 0 });
  });
  extrato.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
  var anam = { nome: '', cpf: '' };
  try {
    var plan = _planilhaDoPaciente_(sig), linha = plan ? lerAbaComoObjetos(plan, ABA_ANAMNESE)[0] : null;
    if (linha) anam = { nome: String(linha.nome_completo || '').trim(), cpf: _finDocMascara_(linha.cpf) };
  } catch (erroAnamnese) { /* sem a anamnese o cadastro abre assim mesmo */ }
  var titular = c.pessoas.filter(function (x) { return _siglaChave_(x.sigla) === sig && x.papel === 'recibo'; })[0];
  var encPac = _finEncDoCad_(cad); // 19.5
  return { cadastro: { valor: _finCent_(pc.valor), enc_item: encPac.enc_item, enc_sub: encPac.enc_sub, enc_texto: encPac.enc_texto, enc_nome: encPac.enc_nome, modo: cad.modo, n: cad.n, quando: cad.quando, pagador: cad.pagador, recibo: cad.recibo, titular: cad.titular, canal: cad.canal,
      pagadores: cad.pagador === 'outro' ? _finPagadores_(c, sig, true).filter(function (x) { return x.documento !== undefined; }) : [],
      titular_nome: titular ? titular.nome : '', titular_documento: titular ? titular.documento : '' },
    anamnese: anam, em_aberto: emAberto, credito: Math.max(0, e.credito[sig] || 0), valor_padrao: c.config.valor_padrao, extrato: extrato,
    recibo_pedido: String(cad.recibo_pedido_em || '').slice(0, 7) === agora.data.slice(0, 7) };
}
/** Os blocos do Inicio do profissional: comprovantes a conferir, pedidos de recibo do mes e contas que vencem em 7 dias. */
function _finInicio_(c, agora) {
  var ate = _lemIso_(_lemDia_(agora.data) + 7), mes = agora.data.slice(0, 7), recibos = [];
  Object.keys(c.cadastros).forEach(function (sig) {
    var l = c.cadastros[sig], p = c.pacs[sig];
    if (p && p.ativo && String(l.recibo_pedido_em || '').slice(0, 7) === mes) recibos.push({ sigla: sig, nome: p.nome, data: String(l.recibo_pedido_em).slice(0, 10) });
  });
  return { comprovantes: _finComprovantes_(c), recibos: recibos, status_pendente: _stpVisao_(c, agora), // 20.2
    contas: _finDespesas_(c, mes + '-01', ate > _finFimDoMes_(mes) ? ate : _finFimDoMes_(mes), agora.data).filter(function (d) { return d.situacao === 'a_pagar' && d.vence <= ate; })
      .map(function (d) { return { nome: d.nome, valor: d.valor, vence: d.vence }; }) };
}

// ---------- acoes do profissional ----------

function _finResposta_(alvo, resp, p, agora) { resp.financeiro = _finLeitura_(_finCtx_(alvo.controle), p, agora); return resp; }
function _finTxt_(v, max) { return String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
function _finDoPaciente_(c, sigla) { var sig = _siglaChave_(sigla); return (sig && c.pacs[sig]) ? sig : ''; }

/** Leitura unica do financeiro do profissional: `so: 'inicio'` (blocos do Inicio), `siglaPaciente` (um paciente) ou o periodo da pagina. */
function profLerFinanceiro(s, p) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  p = p && typeof p === 'object' ? p : {};
  var c = _finCtx_(alvo.controle), agora = _lemAgora_();
  if (p.so === 'inicio') return { ok: true, inicio: _finInicio_(c, agora) };
  if (p.siglaPaciente) {
    var sig = _finDoPaciente_(c, p.siglaPaciente);
    return sig ? { ok: true, paciente: _finPaciente_(c, sig, agora) } : { ok: false, erro: 'Este paciente nao pertence a voce' };
  }
  return { ok: true, financeiro: _finLeitura_(c, p, agora) };
}

/** Cadastro financeiro do paciente. O valor da sessao mora no cadastro do paciente (`valor_sessao`, 14.6): e o mesmo dado. */
function profSalvarCadastroFinanceiro(s, siglaPaciente, dados) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), sig = _finDoPaciente_(c, siglaPaciente), d = dados && typeof dados === 'object' ? dados : {}, agora = _lemAgora_();
  if (!sig) return { ok: false, erro: 'Este paciente nao pertence a voce' };
  var um = function (v, lista, padrao) { return lista.indexOf(v) !== -1 ? v : padrao; };
  var cad = { id: sig, modo: um(d.modo, ['sessao', 'n', 'mensal'], 'sessao'), pagador: um(d.pagador, ['paciente', 'outro'], 'paciente'), recibo: d.recibo === 'Sim' ? 'Sim' : 'Nao',
    titular: um(d.titular, ['paciente', 'pagador', 'outro'], 'paciente'), canal: um(d.canal, ['email', 'whatsapp', 'ambos'], 'ambos'), atualizado_em: agora.carimbo };
  // 19.5: a tela nova manda item, subitem, texto e nome; o texto livre antigo sai da coluna velha (ja veio na tela como "Outro" + texto).
  // Quem ainda mandar so `encaminhamento` (pagina aberta de antes do pacote) grava como antes e nao toca nos campos novos.
  if (d.enc_item !== undefined) { var encNovo = _finEnc_(d); cad.enc_item = encNovo.enc_item; cad.enc_sub = encNovo.enc_sub; cad.enc_texto = encNovo.enc_texto; cad.enc_nome = encNovo.enc_nome; cad.encaminhamento = ''; }
  else cad.encaminhamento = _finTxt_(d.encaminhamento, 80);
  cad.n = cad.modo === 'n' ? String(Math.min(12, Math.max(2, parseInt(d.n, 10) || 2))) : '';
  cad.quando = cad.modo === 'mensal' ? um(d.quando, ['adiantado', 'f1', 'f2', 'f3', 'seguinte'], 'f1') : '';
  var pessoas = [];
  if (cad.pagador === 'outro') {
    var lista = Array.isArray(d.pagadores) ? d.pagadores.slice(0, 4) : [];
    for (var i = 0; i < lista.length; i++) {
      var pg = lista[i] || {}, nome = _finTxt_(pg.nome, 100), doc = _finDocumento_(pg.documento);
      if (!nome && !String(pg.documento || '').trim()) continue;
      if (!nome) return { ok: false, erro: 'Informe o nome de quem paga.' };
      if (doc === null) return { ok: false, erro: 'O CPF ou CNPJ de ' + nome + ' não confere. Revise os números.' };
      pessoas.push({ papel: 'pagador', nome: nome, documento: doc, telefone: normalizarTelefone(pg.telefone), email: normalizarEmail(pg.email) });
    }
    if (!pessoas.length) return { ok: false, erro: 'Informe o nome de quem paga.' };
  }
  if (cad.recibo === 'Sim' && cad.titular === 'outro') {
    var tNome = _finTxt_(d.titular_nome, 100), tDoc = _finDocumento_(d.titular_documento);
    if (!tNome) return { ok: false, erro: 'Informe em nome de quem sai o recibo.' };
    if (tDoc === null) return { ok: false, erro: 'O CPF do recibo não confere. Revise os números.' };
    pessoas.push({ papel: 'recibo', nome: tNome, documento: tDoc, telefone: '', email: '' });
  }
  if (cad.recibo === 'Sim' && cad.titular === 'pagador' && cad.pagador !== 'outro') cad.titular = 'paciente';
  // valor da sessao: o mesmo campo do cabecalho do paciente (14.6); vale para as proximas sessoes ainda nao pagas
  var valor = _finInt_(d.valor);
  if (valor < 0) return { ok: false, erro: 'Valor da sessão inválido.' };
  var reais = valor ? String(valor / 100).replace('.', ',') : '';
  var abaPac = alvo.controle.getSheetByName(ABA_PACIENTES);
  if (!abaPac || !_atualizarLinhaPorChave_(abaPac, 'sigla', sig, {}, { valor_sessao: _lemCelula_(reais) })) return { ok: false, erro: 'Paciente não encontrado na Controle.' };
  var e = _finEstado_(c, agora), antigo = _finCent_(c.pacs[sig].valor);
  if (antigo !== valor && valor) c.sessoes.forEach(function (x) { // decisao 6: mudam so as proximas ainda nao pagas; a que teve o valor trocado a mao (diferente do cadastro antigo) fica
    if (_siglaChave_(x.sigla) === sig && (x.estado || 'agendada') === 'agendada' && !_finPassou_(x, agora) && !x.reposicao_de && !(e.pago[x.id] > 0) && (!_finCent_(x.valor) || _finCent_(x.valor) === antigo)) _ageGravar_(c.abaS, COLUNAS_SESSOES, x.__linha, { valor: reais, atualizado_em: agora.carimbo });
  });
  var linhaCad = c.cadastros[sig];
  _finGravar_(alvo.controle, ABA_FIN_CADASTRO, linhaCad ? linhaCad.__linha : 0, cad);
  var abaPes = _finAba_(alvo.controle, ABA_FIN_PESSOAS, true);
  _lembretesLer_(abaPes).reverse().forEach(function (x) { if (_siglaChave_(x.sigla) === sig) abaPes.deleteRow(x.__linha); });
  pessoas.forEach(function (x) { x.id = Utilities.getUuid(); x.sigla = sig; x.criado_em = agora.carimbo; _finGravar_(alvo.controle, ABA_FIN_PESSOAS, 0, x); });
  return { ok: true, paciente: _finPaciente_(_finCtx_(alvo.controle), sig, agora) };
}

function profSalvarConfigFinanceiro(s, dados, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var d = dados && typeof dados === 'object' ? dados : {}, atual = {}, agora = _lemAgora_();
  var lista = function (t, max) { return String(t === undefined || t === null ? '' : t).split(/[|\n]/).map(function (x) { return _finTxt_(x, 40); }).filter(function (x, i, l) { return x && l.indexOf(x) === i; }).slice(0, max).join('|'); };
  var novo = { dados_receber: String(d.dados_receber === undefined || d.dados_receber === null ? '' : d.dados_receber).replace(/\r/g, '').trim().slice(0, 600), formas: lista(d.formas, 12),
    valor_padrao: String(_finCent_(d.valor_padrao)), prazo_dias: String(Math.min(90, Math.max(0, parseInt(d.prazo_dias, 10) || 0))),
    texto_cobranca: String(d.texto_cobranca === undefined || d.texto_cobranca === null ? '' : d.texto_cobranca).replace(/\r/g, '').trim().slice(0, 1500), categorias: lista(d.categorias, 30) };
  if (!novo.formas) return { ok: false, erro: 'Informe pelo menos uma forma de pagamento.' };
  if (!novo.categorias) return { ok: false, erro: 'Informe pelo menos uma categoria de despesa.' };
  if (!novo.texto_cobranca) novo.texto_cobranca = FIN_CONFIG_PADRAO.texto_cobranca;
  if (d.fiscal !== undefined) { // 20.1: recibos e livro caixa
    var cpfE = _finDocumento_(d.cpf_emissor), codR = String(d.cod_rendimento === undefined || d.cod_rendimento === null ? '' : d.cod_rendimento).trim().toUpperCase(), codO = String(d.cod_ocupacao === undefined || d.cod_ocupacao === null ? '' : d.cod_ocupacao).trim();
    novo.fiscal = d.fiscal === 'Sim' ? 'Sim' : 'Nao';
    if (novo.fiscal === 'Sim' && (!cpfE || cpfE.length !== 11)) return { ok: false, erro: 'Informe o seu CPF: ele vai em cada linha do lote de recibos.' };
    novo.cpf_emissor = cpfE && cpfE.length === 11 ? cpfE : '';
    novo.cod_rendimento = /^R\d{2}\.\d{3}\.\d{3}$/.test(codR) ? codR : FIN_CONFIG_PADRAO.cod_rendimento;
    novo.cod_ocupacao = /^\d{1,4}$/.test(codO) ? codO : FIN_CONFIG_PADRAO.cod_ocupacao;
  }
  _lembretesLer_(_finAba_(alvo.controle, ABA_FIN_CONFIG, true)).forEach(function (l) { atual[l.id] = l; });
  Object.keys(novo).forEach(function (k) { if (!atual[k] || atual[k].valor !== novo[k]) _finGravar_(alvo.controle, ABA_FIN_CONFIG, atual[k] ? atual[k].__linha : 0, { id: k, valor: novo[k] }); });
  return _finResposta_(alvo, { ok: true }, periodo, agora);
}

/** Confere a alocacao pedida: cada sessao e do paciente, esta em aberto e nao recebe mais do que falta. Devolve a lista limpa ou { erro }. */
function _finConferirAlocacao_(e, sig, itens, teto) {
  var limpa = [], soma = 0, vistos = {};
  (Array.isArray(itens) ? itens : []).forEach(function (it) {
    var s = e.porId[String(it && it.sessao || '')], v = _finInt_(it && it.valor);
    if (!s || _siglaChave_(s.sigla) !== sig || !s.cobravel || v <= 0 || vistos[s.id] || v > s.valor - s.pago) { limpa = null; return; }
    if (limpa) { vistos[s.id] = true; limpa.push({ sessao: s.id, valor: v }); soma += v; }
  });
  if (!limpa) return { erro: 'As sessões escolhidas mudaram. Abra o pagamento de novo.' };
  return soma > teto ? { erro: 'As sessões escolhidas somam mais que o valor disponível.' } : { itens: limpa, soma: soma };
}
function _finAlocar_(controle, pagamentoId, sig, itens, agora) {
  itens.forEach(function (it) { _finGravar_(controle, ABA_FIN_ALOCACOES, 0, { id: Utilities.getUuid(), pagamento_id: pagamentoId, sessao_id: it.sessao, sigla: sig, valor: String(it.valor), criado_em: agora.carimbo }); });
}
/** Antes e depois, para a janela de confirmar (o painel nunca muda antes da confirmacao). */
function _finAntesDepois_(e, sig, soma, sobra) {
  var aberto = 0, recebido = 0;
  e.sessoes.forEach(function (x) { if (_siglaChave_(x.sigla) === sig && x.cobravel) { aberto += x.valor - x.pago; recebido += x.pago; } });
  var credito = Math.max(0, e.credito[sig] || 0);
  return { antes: { recebido: recebido, a_receber: aberto, credito: credito }, depois: { recebido: recebido + soma, a_receber: aberto - soma, credito: credito + sobra } };
}
/**
 * Lanca um pagamento. `dados`: { id, data, valor (centavos), forma, quem, obs, sessoes: [{sessao, valor}], credito }.
 * `sessoes` e a escolha do profissional (a tela sugere as mais antigas); o que nao for alocado fica como credito do
 * paciente. Com `credito: true` nenhum dinheiro novo entra: o credito que ja existe e que abate as sessoes escolhidas.
 * `simular: true` devolve o antes e o depois sem gravar. O mes do pagamento e o das sessoes que ele quita.
 */
function profSalvarPagamento(s, siglaPaciente, dados, simular, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), sig = _finDoPaciente_(c, siglaPaciente), d = dados && typeof dados === 'object' ? dados : {}, agora = _lemAgora_();
  if (!sig) return { ok: false, erro: 'Este paciente nao pertence a voce' };
  var id = String(d.id || '').trim(), e = _finEstado_(c, agora);
  if (!_ageIdValido_(id)) return { ok: false, erro: 'Identificador inválido.' };
  if (c.pagamentos.concat(c.alocacoes).some(function (x) { return x.id === id || x.pagamento_id === id; })) return simular ? { ok: false, erro: 'Este pagamento já foi lançado.' } : _finResposta_(alvo, { ok: true, duplicado: true }, periodo, agora);
  if (d.credito) { // usar o credito do paciente: aloca do saldo dos pagamentos ja confirmados, os mais antigos primeiro
    var saldoTotal = Math.max(0, e.credito[sig] || 0), confCred = _finConferirAlocacao_(e, sig, d.sessoes, saldoTotal);
    if (confCred.erro) return { ok: false, erro: confCred.erro };
    if (!confCred.soma) return { ok: false, erro: 'Marque as sessões que o crédito vai quitar.' };
    if (simular) return { ok: true, simulacao: _finAntesDepois_(e, sig, confCred.soma, -confCred.soma) };
    var usado = {};
    c.alocacoes.forEach(function (a) { usado[a.pagamento_id] = (usado[a.pagamento_id] || 0) + (parseInt(a.valor, 10) || 0); });
    var fontes = c.pagamentos.filter(function (p) { return p.situacao === 'confirmado' && _siglaChave_(p.sigla) === sig; }).sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); })
      .map(function (p) { return { id: p.id, livre: (parseInt(p.valor, 10) || 0) - (usado[p.id] || 0) }; }).filter(function (f) { return f.livre > 0; });
    confCred.itens.forEach(function (it) {
      var falta = it.valor;
      fontes.forEach(function (f) { if (falta <= 0 || f.livre <= 0) return; var v = Math.min(falta, f.livre); _finAlocar_(alvo.controle, f.id, sig, [{ sessao: it.sessao, valor: v }], agora); f.livre -= v; falta -= v; });
    });
    return _finResposta_(alvo, { ok: true }, periodo, agora);
  }
  var valor = _finInt_(d.valor), forma = _finTxt_(d.forma, 40);
  if (valor <= 0) return { ok: false, erro: 'Informe o valor do pagamento.' };
  if (_lemDia_(d.data) === null || d.data > agora.data) return { ok: false, erro: 'Informe a data do pagamento (não pode ser futura).' };
  if (!forma) return { ok: false, erro: 'Escolha a forma de pagamento.' };
  var conf = _finConferirAlocacao_(e, sig, d.sessoes, valor);
  if (conf.erro) return { ok: false, erro: conf.erro };
  if (simular) return { ok: true, simulacao: _finAntesDepois_(e, sig, conf.soma, valor - conf.soma) };
  _finGravar_(alvo.controle, ABA_FIN_PAGAMENTOS, 0, { id: id, sigla: sig, data: d.data, valor: String(valor), forma: forma, quem: _finTxt_(d.quem, 100) || c.pacs[sig].nome, origem: 'profissional', situacao: 'confirmado',
    obs: _finTxt_(d.obs, 200), criado_em: agora.carimbo, decidido_em: agora.carimbo });
  _finAlocar_(alvo.controle, id, sig, conf.itens, agora);
  return _finResposta_(alvo, { ok: true, sobra: valor - conf.soma }, periodo, agora);
}

/** Desfaz um pagamento confirmado: ele deixa de contar (a linha fica, com a situacao `estornado`); as sessoes voltam a ficar em aberto. */
function profEstornarPagamento(s, id) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), p = c.pagamentos.filter(function (x) { return x.id === String(id || ''); })[0], agora = _lemAgora_();
  if (!p || !_finDoPaciente_(c, p.sigla)) return { ok: false, erro: 'Pagamento não encontrado.' };
  if (p.situacao === 'confirmado') _finGravar_(alvo.controle, ABA_FIN_PAGAMENTOS, p.__linha, { situacao: 'estornado', decidido_em: agora.carimbo });
  else if (p.situacao !== 'estornado') return { ok: false, erro: 'Só um pagamento confirmado pode ser desfeito.' };
  return { ok: true, paciente: _finPaciente_(_finCtx_(alvo.controle), p.sigla, agora) };
}

/**
 * Comprovante enviado pelo paciente: confirmar (vira pagamento, com a forma, o valor conferido e as sessoes que o
 * profissional escolher) ou recusar. Nada conta como pago antes desta confirmacao.
 */
function profDecidirComprovante(s, id, aprovar, dados, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), p = c.pagamentos.filter(function (x) { return x.id === String(id || ''); })[0], d = dados && typeof dados === 'object' ? dados : {}, agora = _lemAgora_();
  if (!p || p.origem !== 'comprovante') return { ok: false, erro: 'Comprovante não encontrado.' };
  var sig = _finDoPaciente_(c, p.sigla);
  if (!sig) return { ok: false, erro: 'Comprovante não encontrado.' };
  if (p.situacao !== 'aguardando') return _finResposta_(alvo, { ok: true, duplicado: true }, periodo, agora);
  if (!aprovar) { _finGravar_(alvo.controle, ABA_FIN_PAGAMENTOS, p.__linha, { situacao: 'recusado', decidido_em: agora.carimbo }); return _finResposta_(alvo, { ok: true }, periodo, agora); }
  var valor = _finInt_(d.valor), forma = _finTxt_(d.forma, 40);
  if (valor <= 0) return { ok: false, erro: 'Informe o valor do pagamento.' };
  if (_lemDia_(d.data) === null || d.data > agora.data) return { ok: false, erro: 'Informe a data do pagamento (não pode ser futura).' };
  if (!forma) return { ok: false, erro: 'Escolha a forma de pagamento.' };
  var conf = _finConferirAlocacao_(_finEstado_(c, agora), sig, d.sessoes, valor);
  if (conf.erro) return { ok: false, erro: conf.erro };
  _finGravar_(alvo.controle, ABA_FIN_PAGAMENTOS, p.__linha, { situacao: 'confirmado', data: d.data, valor: String(valor), forma: forma, quem: _finTxt_(d.quem, 100) || c.pacs[sig].nome, obs: _finTxt_(d.obs, 200), decidido_em: agora.carimbo });
  _finAlocar_(alvo.controle, p.id, sig, conf.itens, agora);
  return _finResposta_(alvo, { ok: true, sobra: valor - conf.soma }, periodo, agora);
}

/**
 * Monta as cobrancas dos pacientes escolhidos, para revisar: uma por paciente e por mes das sessoes, na situacao
 * "a enviar". So roda quando o profissional pede; nada e enviado aqui.
 */
function profGerarCobrancas(s, siglas, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), agora = _lemAgora_(), e = _finEstado_(c, agora), quer = {}, feitas = 0;
  (Array.isArray(siglas) ? siglas : []).forEach(function (x) { quer[_siglaChave_(x)] = true; });
  _finPropostas_(c, e, agora.data).forEach(function (pr) {
    var sig = _siglaChave_(pr.sigla);
    if (!quer[sig]) return;
    var cad = _finCad_(c, sig), para = _finPagadores_(c, sig, false)[0], lista = pr.sessoes.map(function (id) { return e.porId[id]; });
    var texto = _finTextoCobranca_(c.config.texto_cobranca, { nome: String(para.nome).trim().split(/\s+/)[0], saudacao: _finSaudacao_(agora.hora), mes: _finMesNome_(pr.mes),
      sessoes: lista.map(function (x) { return { data: x.data, valor: x.valor, pago: x.pago }; }), total: pr.total, dados: c.config.dados_receber });
    _finGravar_(alvo.controle, ABA_FIN_COBRANCAS, 0, { id: Utilities.getUuid(), sigla: sig, para: para.nome, canal: cad.canal, mes: pr.mes, sessoes: pr.sessoes.join(','), total: String(pr.total), texto: texto,
      vence_em: _lemIso_(_lemDia_(agora.data) + c.config.prazo_dias), criada_em: agora.carimbo });
    feitas++;
  });
  if (!feitas) return { ok: false, erro: 'Nenhuma sessão a cobrar para os pacientes escolhidos.' };
  return _finResposta_(alvo, { ok: true, geradas: feitas }, periodo, agora);
}

/** E-mail de cobranca no layout do sistema: o texto que o profissional revisou, linha a linha; sem botao (quem paga pode nao ter acesso). */
function montarEmailCobranca(texto, mes, assinatura) {
  var linhas = String(texto || '').replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/^\*(.*)\*$/, '$1'); });
  return { assunto: 'Demonstrativo de ' + mes, texto: linhas.concat(['']).concat(assinatura || []).join('\n'),
    html: _layoutEmail_({ previa: 'Demonstrativo de ' + mes, titulo: 'Demonstrativo do mês', ola: linhas[0] || '', paragrafo: '', linhas: linhas.slice(1), semBotao: true, link: SITE_URL, aviso: '', assinatura: assinatura || [] }) };
}

/**
 * Envia uma cobranca revisada. `dados`: { canal: 'email' | 'marcar', sessoes: [ids], vence_em, texto }.
 * 'email' manda o e-mail a quem paga; 'marcar' so registra que ela saiu por fora (WhatsApp). Sessao desmarcada
 * fica fora DESTA cobranca e continua em aberto. E a unica porta de saida de cobranca: nao ha gatilho.
 */
function profEnviarCobranca(s, id, dados, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), cb = c.cobrancas.filter(function (x) { return x.id === String(id || ''); })[0], d = dados && typeof dados === 'object' ? dados : {}, agora = _lemAgora_();
  if (!cb) return { ok: false, erro: 'Cobrança não encontrada.' };
  var sig = _finDoPaciente_(c, cb.sigla), e = _finEstado_(c, agora);
  if (!sig) return { ok: false, erro: 'Cobrança não encontrada.' };
  var atuais = String(cb.sessoes).split(','), ids = (Array.isArray(d.sessoes) ? d.sessoes : atuais).filter(function (x, i, l) { return atuais.indexOf(x) !== -1 && l.indexOf(x) === i && e.porId[x] && e.porId[x].cobravel; });
  var texto = String(d.texto === undefined || d.texto === null ? cb.texto : d.texto).replace(/\r/g, '').trim().slice(0, 3000), vence = _lemDia_(d.vence_em) !== null ? d.vence_em : cb.vence_em;
  if (!ids.length) return { ok: false, erro: 'Marque pelo menos uma sessão.' };
  if (!texto) return { ok: false, erro: 'A mensagem está vazia.' };
  var total = 0; ids.forEach(function (x) { total += e.porId[x].valor - e.porId[x].pago; });
  var campos = { sessoes: ids.join(','), total: String(total), texto: texto, vence_em: vence };
  if (d.canal === 'email') {
    var para = _finPagadores_(c, sig, false).filter(function (x) { return x.email; })[0];
    if (!para) return { ok: false, erro: 'Quem paga não tem e-mail no cadastro. Use o WhatsApp ou complete o cadastro.' };
    if (!_emailPermitido_(alvo.profissionalId)) return { ok: false, codigo: 'sem_conexao', erro: MSG_EMAIL_CONECTE }; // 14.10
    if (!_reservarEmail_('cobrancas', 1)) return { ok: false, erro: 'O limite de e-mails de cobrança de hoje foi atingido. Tente amanhã ou use o WhatsApp.' };
    if (!_enviarEmail_(para.email, montarEmailCobranca(texto, _finMesNome_(cb.mes), _assinaturaDoProfissional_(alvo.profissionalId)), alvo.profissionalId)) return { ok: false, erro: 'O e-mail não pôde ser enviado agora. Tente de novo.' };
    campos.enviada_em = agora.carimbo; campos.enviada_por = 'email';
  } else if (d.canal === 'marcar') { campos.enviada_em = agora.carimbo; campos.enviada_por = 'whatsapp'; }
  _finGravar_(alvo.controle, ABA_FIN_COBRANCAS, cb.__linha, campos);
  return _finResposta_(alvo, { ok: true }, periodo, agora);
}

/** Descarta uma cobranca que ainda nao foi enviada (as sessoes continuam em aberto e voltam a ser propostas). */
function profDescartarCobranca(s, id, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), cb = c.cobrancas.filter(function (x) { return x.id === String(id || ''); })[0];
  if (cb && cb.enviada_em) return { ok: false, erro: 'Esta cobrança já foi enviada e fica no histórico.' };
  if (cb) _finAba_(alvo.controle, ABA_FIN_COBRANCAS, true).deleteRow(cb.__linha);
  return _finResposta_(alvo, { ok: true }, periodo, _lemAgora_());
}

/**
 * "Nao cobrar esta sessao": a sessao deixa de ser cobrada tambem na Agenda (`cobrada = Nao`). E um gesto proprio:
 * desmarcar uma sessao na cobranca NAO passa por aqui. Sessao com pagamento nao pode ser isentada.
 */
function profNaoCobrarSessao(s, sessoes, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), agora = _lemAgora_(), e = _finEstado_(c, agora), ids = Array.isArray(sessoes) ? sessoes : [], linhas = [];
  for (var i = 0; i < ids.length; i++) {
    var x = c.sessoes.filter(function (l) { return l.id === String(ids[i]); })[0], v = x && e.porId[x.id];
    if (!x || !v || !v.cobravel) return { ok: false, erro: 'Sessão não encontrada entre as que estão a receber.' };
    if (v.pago > 0) return { ok: false, erro: 'Esta sessão já tem pagamento. Desfaça o pagamento antes de deixar de cobrar.' };
    linhas.push(x);
  }
  if (!linhas.length) return { ok: false, erro: 'Escolha a sessão que não deve ser cobrada.' };
  linhas.forEach(function (x) { _ageGravar_(c.abaS, COLUNAS_SESSOES, x.__linha, { cobrada: 'Nao', atualizado_em: agora.carimbo }); });
  var fora = {}; linhas.forEach(function (x) { fora[x.id] = true; });
  c.cobrancas.forEach(function (cb) { // a sessao sai das cobrancas ainda nao enviadas; cobranca que ficar vazia e descartada
    if (cb.enviada_em) return;
    var resto = String(cb.sessoes).split(',').filter(function (id) { return !fora[id]; });
    if (resto.length !== String(cb.sessoes).split(',').length) _finGravar_(alvo.controle, ABA_FIN_COBRANCAS, cb.__linha, { sessoes: resto.join(',') });
  });
  var abaC = _finAba_(alvo.controle, ABA_FIN_COBRANCAS, false);
  _lembretesLer_(abaC).reverse().forEach(function (cb) { if (!cb.enviada_em && !cb.sessoes) abaC.deleteRow(cb.__linha); });
  return _finResposta_(alvo, { ok: true }, periodo, agora);
}

// ---------- arquivos (comprovantes) ----------

/** Guarda o arquivo na pasta "Comprovantes" do profissional. Devolve { id, nome, tipo } ou { erro }. */
function _finGuardarArquivo_(profissionalId, arquivo, prefixo) {
  var a = arquivo && typeof arquivo === 'object' ? arquivo : null;
  if (!a || !a.base64) return { erro: 'Escolha a foto ou o PDF do comprovante.' };
  var tipo = String(a.tipo || ''), b64 = String(a.base64);
  if (FIN_ARQUIVO_TIPOS.indexOf(tipo) === -1) return { erro: 'O comprovante precisa ser uma foto (JPG ou PNG) ou um PDF.' };
  if (b64.length > FIN_ARQUIVO_MAX_B64) return { erro: 'O arquivo passa de 5 MB.' };
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return { erro: 'Não foi possível ler o arquivo.' };
  var prof = buscarProfissional(profissionalId);
  if (!prof || !prof.pasta_drive_id) return { erro: 'Pasta do profissional não encontrada.' };
  try {
    var pasta = DriveApp.getFolderById(prof.pasta_drive_id), it = pasta.getFoldersByName(FIN_PASTA_COMPROVANTES);
    var destino = it.hasNext() ? it.next() : pasta.createFolder(FIN_PASTA_COMPROVANTES);
    var nome = prefixo + '_' + _finTxt_(a.nome, 60).replace(/[^A-Za-z0-9._-]/g, '_');
    var arq = DriveApp.createFile(Utilities.newBlob(Utilities.base64Decode(b64), tipo, nome));
    arq.moveTo(destino);
    return { id: arq.getId(), nome: nome, tipo: tipo };
  } catch (erroArquivo) {
    console.error('_finGuardarArquivo_: ' + String(erroArquivo && erroArquivo.message || erroArquivo).slice(0, 200));
    return { erro: 'Não foi possível guardar o arquivo agora. Tente de novo.' };
  }
}
/** Entrega um comprovante so a quem pode ve-lo: o profissional dono ou o paciente que o enviou. */
function lerArquivoFinanceiro(s, id) {
  var alvo = s && s.tipo === 'paciente' ? _agePaciente_(s.sigla) : _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), alvoId = String(id || '');
  var l = c.pagamentos.filter(function (x) { return x.id === alvoId && x.arquivo_id; })[0] || c.recibos.filter(function (x) { return x.id === alvoId && x.arquivo_id; })[0] || (s.tipo === 'paciente' ? null : c.despesas.filter(function (x) { return x.id === alvoId && x.arquivo_id; })[0]);
  if (!l || (s.tipo === 'paciente' && _siglaChave_(l.sigla) !== _siglaChave_(s.sigla))) return { ok: false, erro: 'Arquivo não encontrado.' };
  try {
    return { ok: true, arquivo: { nome: l.arquivo_nome, tipo: l.arquivo_tipo, base64: Utilities.base64Encode(DriveApp.getFileById(l.arquivo_id).getBlob().getBytes()) } };
  } catch (erroLeitura) { return { ok: false, erro: 'Não foi possível abrir o arquivo agora.' }; }
}

// ---------- despesas e contas a pagar ----------

/**
 * Lanca ou paga uma despesa. `dados`: { id, nome, categoria, valor (centavos), data, situacao: 'paga' | 'a_pagar',
 * repete: '' | 'fixo' | 'variavel', obs, arquivo }. `id` no formato `fixa:<id>:<AAAA-MM>` e a conta do mes de uma
 * despesa fixa (nasce na leitura): pagar grava o lancamento com a data e o valor reais. `repete` cria a despesa fixa.
 */
function profSalvarDespesa(s, dados, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), d = dados && typeof dados === 'object' ? dados : {}, agora = _lemAgora_(), id = String(d.id || '').trim();
  var valor = _finInt_(d.valor), nome = _finTxt_(d.nome, 80), categoria = _finTxt_(d.categoria, 40), situacao = d.situacao === 'paga' ? 'paga' : 'a_pagar';
  if (_lemDia_(d.data) === null) return { ok: false, erro: 'Informe a data.' };
  if (situacao === 'paga' && d.data > agora.data) return { ok: false, erro: 'A data do pagamento não pode ser futura.' };
  if (valor < 0 || (situacao === 'paga' && valor === 0)) return { ok: false, erro: 'Informe o valor.' };
  var conta = d.conta === undefined ? null : String(d.conta === null ? '' : d.conta).trim().toUpperCase(), historico = d.historico === undefined ? null : _finLoteHistorico_(d.historico).slice(0, 255); // 20.1: livro caixa
  if (conta && !/^P1[01]\.\d{2}\.\d{5}$/.test(conta)) return { ok: false, erro: 'A conta do livro caixa tem o formato P10.01.00002.' };
  if (historico && historico.indexOf(';') !== -1) return { ok: false, erro: 'O histórico não pode ter ponto e vírgula.' };
  var arq = { id: '', nome: '', tipo: '' };
  if (d.arquivo && d.arquivo.base64) { arq = _finGuardarArquivo_(alvo.profissionalId, d.arquivo, 'despesa_' + agora.data); if (arq.erro) return { ok: false, erro: arq.erro }; }
  var comArq = function (o) { if (arq.id) { o.arquivo_id = arq.id; o.arquivo_nome = arq.nome; o.arquivo_tipo = arq.tipo; } return o; };
  var m = /^fixa:([A-Za-z0-9-]{8,64}):(\d{4}-\d{2})$/.exec(id);
  if (m) { // a conta do mes de uma despesa fixa
    var f = c.fixas.filter(function (x) { return x.id === m[1]; })[0];
    if (!f) return { ok: false, erro: 'Despesa não encontrada.' };
    if (c.despesas.some(function (x) { return x.fixa_id === f.id && x.competencia === m[2]; })) return _finResposta_(alvo, { ok: true, duplicado: true }, periodo, agora);
    var ultimoDia = Number(_finFimDoMes_(m[2]).slice(8));
    _finGravar_(alvo.controle, ABA_FIN_DESPESAS, 0, comArq({ id: Utilities.getUuid(), fixa_id: f.id, competencia: m[2], nome: f.nome, categoria: f.categoria, valor: String(valor),
      vence: m[2] + '-' + ('0' + Math.min(ultimoDia, Math.max(1, parseInt(f.dia, 10) || 1))).slice(-2), paga_em: situacao === 'paga' ? d.data : '', situacao: situacao, obs: _finTxt_(d.obs, 200), criado_em: agora.carimbo, conta: conta !== null ? conta : (f.conta || ''), historico: historico !== null ? historico : (f.historico || '') }));
    return _finResposta_(alvo, { ok: true }, periodo, agora);
  }
  if (!_ageIdValido_(id)) return { ok: false, erro: 'Identificador inválido.' };
  var atual = c.despesas.filter(function (x) { return x.id === id; })[0];
  if (atual) { // pagar (ou corrigir) uma despesa que ja existe
    var mud = { valor: String(valor), paga_em: situacao === 'paga' ? d.data : '', situacao: situacao, obs: _finTxt_(d.obs, 200) || atual.obs };
    if (conta !== null) mud.conta = conta;
    if (historico !== null) mud.historico = historico;
    _finGravar_(alvo.controle, ABA_FIN_DESPESAS, atual.__linha, comArq(mud));
    return _finResposta_(alvo, { ok: true }, periodo, agora);
  }
  if (!nome) return { ok: false, erro: 'Informe o nome da despesa.' };
  if (!categoria) return { ok: false, erro: 'Escolha a categoria.' };
  var fixaId = '';
  if (d.repete === 'fixo' || d.repete === 'variavel') {
    fixaId = Utilities.getUuid();
    _finGravar_(alvo.controle, ABA_FIN_FIXAS, 0, { id: fixaId, nome: nome, categoria: categoria, tipo: d.repete, valor: String(valor), dia: String(Number(d.data.slice(8))), desde: d.data.slice(0, 7), criado_em: agora.carimbo, conta: conta || '', historico: historico || '' });
  }
  _finGravar_(alvo.controle, ABA_FIN_DESPESAS, 0, comArq({ id: id, fixa_id: fixaId, competencia: d.data.slice(0, 7), nome: nome, categoria: categoria, valor: String(valor), vence: d.data,
    paga_em: situacao === 'paga' ? d.data : '', situacao: situacao, obs: _finTxt_(d.obs, 200), criado_em: agora.carimbo, conta: conta || '', historico: historico || '' }));
  return _finResposta_(alvo, { ok: true }, periodo, agora);
}

/** A despesa fixa para de gerar a conta dos proximos meses (o que ja foi lancado fica). `id` = o da conta ou o da linha paga. */
function profEncerrarDespesaFixa(s, id, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), agora = _lemAgora_(), m = /^fixa:([A-Za-z0-9-]{8,64}):/.exec(String(id || '')), linha = c.despesas.filter(function (x) { return x.id === String(id || ''); })[0];
  var f = c.fixas.filter(function (x) { return x.id === (m ? m[1] : (linha ? linha.fixa_id : '')); })[0];
  if (!f) return { ok: false, erro: 'Despesa não encontrada.' };
  var mesConta = /^fixa:[A-Za-z0-9-]+:(\d{4}-\d{2})$/.exec(String(id || ''));
  if (!f.encerrada_em) _finGravar_(alvo.controle, ABA_FIN_FIXAS, f.__linha, { encerrada_em: mesConta ? _finMesMais_(mesConta[1], -1) : linha.competencia });
  return _finResposta_(alvo, { ok: true }, periodo, agora);
}

// ---------- lado do paciente (so o proprio financeiro, pela sigla do cracha) ----------

function _finMeu_(c, alvo, agora) {
  var sig = _siglaChave_(alvo.sigla), e = _finEstado_(c, agora), mes = agora.data.slice(0, 7), cad = _finCad_(c, sig), m = { sessoes: [], total: 0, pago: 0, aberto_anterior: 0 };
  e.sessoes.forEach(function (s) {
    if (_siglaChave_(s.sigla) !== sig || !s.cobravel) return;
    if (s.data.slice(0, 7) === mes) { m.sessoes.push({ data: s.data, paga: s.pago >= s.valor }); m.total += s.valor; m.pago += s.pago; }
    else if (s.data.slice(0, 7) < mes) m.aberto_anterior += s.valor - s.pago;
  });
  var rot = { confirmado: 'confirmado', aguardando: 'aguardando', recusado: 'recusado' };
  return { ok: true, meu: { mes: _finMesNome_(mes), sessoes: m.sessoes, total: m.total, pago: m.pago, aberto_anterior: m.aberto_anterior, credito: Math.max(0, e.credito[sig] || 0), dados_receber: c.config.dados_receber,
    pode_recibo: cad.recibo === 'Sim', recibo_pedido: String(cad.recibo_pedido_em || '').slice(0, 7) === mes, profissional: alvo.profissional,
    recibos: c.recibos.filter(function (r) { return _siglaChave_(r.sigla) === sig && r.situacao === 'emitido'; }).sort(function (a, b) { return String(b.mes).localeCompare(String(a.mes)); }).slice(0, 12)
      .map(function (r) { return { id: r.id, mes: _finMesNome_(r.mes), do_mes: r.mes === mes, tem_arquivo: !!r.arquivo_id }; }), // 20.1: o recibo emitido fica disponivel para o paciente
    historico: c.pagamentos.filter(function (p) { return _siglaChave_(p.sigla) === sig && rot[p.situacao]; }).sort(function (a, b) { return String(b.data + ' ' + b.criado_em).localeCompare(String(a.data + ' ' + a.criado_em)) || (b.__linha - a.__linha); }).slice(0, 24)
      .map(function (p) { return { id: p.id, data: p.data, valor: parseInt(p.valor, 10) || 0, forma: p.origem === 'comprovante' && p.situacao !== 'confirmado' ? '' : p.forma, situacao: p.situacao, tem_arquivo: !!p.arquivo_id }; }) } };
}
function lerMeuFinanceiro(sigla) {
  var alvo = _agePaciente_(sigla);
  if (!alvo.ok) return alvo;
  return _finMeu_(_finCtx_(alvo.controle), alvo, _lemAgora_());
}
/** O paciente envia o comprovante: fica AGUARDANDO a confirmacao do profissional e nao conta como pago. No maximo 3 a conferir por vez. */
function pacienteEnviarComprovante(sigla, dados) {
  var alvo = _agePaciente_(sigla);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), d = dados && typeof dados === 'object' ? dados : {}, agora = _lemAgora_(), id = String(d.id || '').trim(), sig = _siglaChave_(alvo.sigla);
  if (!_ageIdValido_(id)) return { ok: false, erro: 'Identificador inválido.' };
  var ja = c.pagamentos.filter(function (x) { return x.id === id; })[0];
  if (ja) return _siglaChave_(ja.sigla) === sig ? _finMeu_(c, alvo, agora) : { ok: false, erro: 'Identificador inválido.' };
  var valor = _finInt_(d.valor);
  if (valor <= 0) return { ok: false, erro: 'Informe o valor pago.' };
  if (_lemDia_(d.data) === null || d.data > agora.data) return { ok: false, erro: 'Informe a data do pagamento (não pode ser futura).' };
  if (c.pagamentos.filter(function (x) { return _siglaChave_(x.sigla) === sig && x.situacao === 'aguardando'; }).length >= 3) return { ok: false, erro: 'Você já tem comprovantes aguardando conferência. Aguarde o seu terapeuta conferir.' };
  var arq = _finGuardarArquivo_(alvo.profissionalId, d.arquivo, 'comprovante_' + sig + '_' + agora.data);
  if (arq.erro) return { ok: false, erro: arq.erro };
  _finGravar_(alvo.controle, ABA_FIN_PAGAMENTOS, 0, { id: id, sigla: sig, data: d.data, valor: String(valor), forma: '', quem: alvo.nome, origem: 'comprovante', situacao: 'aguardando', obs: '',
    arquivo_id: arq.id, arquivo_nome: arq.nome, arquivo_tipo: arq.tipo, criado_em: agora.carimbo });
  return _finMeu_(_finCtx_(alvo.controle), alvo, agora);
}
/** Pedido de recibo do mes: so para o paciente que o profissional marcou. Fica registrado e aparece no Inicio do profissional. */
function pacientePedirRecibo(sigla) {
  var alvo = _agePaciente_(sigla);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), sig = _siglaChave_(alvo.sigla), l = c.cadastros[sig], agora = _lemAgora_();
  if (!l || l.recibo !== 'Sim') return { ok: false, erro: 'O pedido de recibo não está disponível para você.' };
  if (String(l.recibo_pedido_em || '').slice(0, 7) !== agora.data.slice(0, 7)) _finGravar_(alvo.controle, ABA_FIN_CADASTRO, l.__linha, { recibo_pedido_em: agora.carimbo });
  return _finMeu_(_finCtx_(alvo.controle), alvo, agora);
}

/** Excluir o paciente: saem o cadastro financeiro, quem paga e as cobrancas dele. Pagamentos ficam (sao o caixa do profissional). */
function _finApagarDoPaciente_(controle, sigla, manterCadastro) {
  var alvo = _siglaChave_(sigla);
  // 19.6: quando ficam sessoes, pagamentos ou recibos do excluido, o modo de cobranca dele fica junto (e ele que diz o que era cobravel); quem paga e as cobrancas saem sempre
  [[ABA_FIN_CADASTRO, 'id'], [ABA_FIN_PESSOAS, 'sigla'], [ABA_FIN_COBRANCAS, 'sigla']].filter(function (par) { return !(manterCadastro && par[0] === ABA_FIN_CADASTRO); }).forEach(function (par) {
    var aba = _finAba_(controle, par[0], false);
    _lembretesLer_(aba).reverse().forEach(function (l) { if (_siglaChave_(l[par[1]]) === alvo) aba.deleteRow(l.__linha); });
  });
}
// ---------- Pacote 20.1: recibos e livro caixa (camada fiscal, opcional, ligada na configuracao do profissional) ----------
// O sistema PREPARA, MOSTRA e REGISTRA; nao fala com o site do governo. O arquivo de lote sai no formato do Carne-Leao
// Web: UTF-8 sem BOM, sem cabecalho, separador ";", linhas em CRLF (recibos com 16 campos, despesas com 4). A descricao
// do recibo e montada das datas, em uma linha, ate 255 caracteres (forma compacta quando a longa nao cabe). Codigo do
// rendimento, da ocupacao e CPF de quem emite vem da CONFIGURACAO, nunca do codigo.

/** Centavos -> "1600,00" (virgula, sem milhar): o valor nos campos do lote. */
function _finLoteValorCampo_(cent) { return (Math.round(cent) / 100).toFixed(2).replace('.', ','); }
/** Centavos -> "1.000,00": o valor dentro do texto da descricao. */
function _finLoteValorTexto_(cent) { return _finBRL_(cent).replace('R$ ', ''); }
/** 'AAAA-MM-DD' -> 'DD/MM/AAAA'. */
function _finLoteData_(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
/**
 * Descricao do recibo. `datas`: ['DD/MM/AAAA', ...] em ordem; `modalidade`: '', 'on-line' ou 'presencial'.
 * Devolve o texto ou null (mais de 26 sessoes, mais de 255 caracteres mesmo na forma compacta, ";" ou quebra de linha).
 */
function _finLoteDescricao_(datas, valorSessaoCent, modalidade) {
  var n = datas.length, v = _finLoteValorTexto_(valorSessaoCent), letras = 'abcdefghijklmnopqrstuvwxyz';
  if (!n || n > 26) return null;
  var ext = function (d) { return d.slice(0, 2) + ' de ' + FIN_MESES[Number(d.slice(3, 5)) - 1] + ' de ' + d.slice(6); };
  var itens = datas.map(function (d, i) { return letras.charAt(i) + '. ' + ext(d); }).join(', ');
  var valor, txt;
  if (n === 1) {
    valor = modalidade ? ', ofertada na modalidade ' + modalidade + ', no valor de (R$ ' + v + ')' : ' (R$ ' + v + ')';
    txt = 'Realização de 01 sessão de psicoterapia' + valor + ', datada em: ' + itens + '.';
  } else {
    valor = modalidade ? ', ofertadas na modalidade ' + modalidade + ', no valor de (R$ ' + v + ' cada)' : ' (R$ ' + v + ' cada)';
    txt = 'Realização de ' + ('0' + n).slice(-2) + ' sessões de psicoterapia' + valor + ', datadas em: ' + itens + '.';
  }
  if (txt.length > 255) { // forma compacta: os dias agrupados por mes
    var grupos = [];
    datas.forEach(function (d) {
      var chave = d.slice(3, 5) + '|' + d.slice(6);
      if (grupos.length && grupos[grupos.length - 1].chave === chave) grupos[grupos.length - 1].dias.push(d.slice(0, 2));
      else grupos.push({ chave: chave, dias: [d.slice(0, 2)] });
    });
    var partes = grupos.map(function (g) {
      var lista = g.dias.length === 1 ? g.dias[0] : g.dias.slice(0, -1).join(', ') + ' e ' + g.dias[g.dias.length - 1];
      return lista + ' de ' + FIN_MESES[Number(g.chave.slice(0, 2)) - 1] + ' de ' + g.chave.slice(3);
    });
    txt = 'Realização de ' + ('0' + n).slice(-2) + ' sessões de psicoterapia' + valor + ', datadas em: ' + partes.join(', ') + '.';
  }
  return (txt.length <= 255 && txt.indexOf(';') === -1 && !/[\r\n]/.test(txt)) ? txt : null;
}
/** Linha de recibo do lote (16 campos). `cfg`: { cod_rendimento, cod_ocupacao, cpf_emissor }. */
function _finLoteLinhaRecibo_(dataRecibo, valorTotalCent, descricao, cpf, cfg) {
  var doc = String(cpf).replace(/\D/g, '');
  return [dataRecibo, cfg.cod_rendimento, cfg.cod_ocupacao, _finLoteValorCampo_(valorTotalCent), '', descricao, 'PF', doc, doc, '', '', '', '', 'S', cfg.cpf_emissor, ''].join(';') + '\r\n';
}
/** Historico em uma linha: as quebras viram " - ". */
function _finLoteHistorico_(texto) {
  var quebras = [10, 13, 11, 12, 28, 29, 30, 133, 8232, 8233], t = String(texto === undefined || texto === null ? '' : texto), partes = [''];
  for (var i = 0; i < t.length; i++) { if (quebras.indexOf(t.charCodeAt(i)) !== -1) partes.push(''); else partes[partes.length - 1] += t.charAt(i); }
  return partes.map(function (x) { return x.trim(); }).filter(function (x) { return x; }).join(' - ');
}
/** Linha de despesa do lote (4 campos) ou null se a conta ou o historico nao servem. */
function _finLoteLinhaPagamento_(data, conta, valorCent, historico) {
  var h = _finLoteHistorico_(historico);
  if (!/^P1[01]\.\d{2}\.\d{5}$/.test(String(conta)) || h.length > 255 || h.indexOf(';') !== -1) return null;
  return [data, conta, _finLoteValorCampo_(valorCent), h].join(';') + '\r\n';
}
function _finCpfValido_(doc) { var d = _finDocumento_(doc); return !!d && d.length === 11; }
function _finFiscal_(c) {
  return { ligado: c.config.fiscal === true, cod_rendimento: c.config.cod_rendimento, cod_ocupacao: c.config.cod_ocupacao, cpf_emissor: c.config.cpf_emissor, pronto: c.config.fiscal === true && _finCpfValido_(c.config.cpf_emissor) };
}
/**
 * Em nome de quem sai o recibo do paciente. Com `abrirAnamnese`, o nome e o CPF do proprio paciente sao lidos da
 * anamnese (uma planilha aberta; so quando o recibo e salvo). Sem isso, devolve o nome do cadastro e `documento: null`.
 */
function _finTitular_(c, sigla, abrirAnamnese) {
  var sig = _siglaChave_(sigla), cad = _finCad_(c, sig), pc = c.pacs[sig] || {};
  if (cad.titular === 'outro') { var t = c.pessoas.filter(function (x) { return _siglaChave_(x.sigla) === sig && x.papel === 'recibo'; })[0]; if (t) return { nome: t.nome, documento: t.documento }; }
  if (cad.titular === 'pagador' && cad.pagador === 'outro') { var pg = c.pessoas.filter(function (x) { return _siglaChave_(x.sigla) === sig && x.papel === 'pagador'; })[0]; if (pg) return { nome: pg.nome, documento: pg.documento }; }
  if (!abrirAnamnese) return { nome: pc.nome || sig, documento: null };
  var nome = pc.nome || sig, doc = '';
  try {
    var plan = _planilhaDoPaciente_(sig), linha = plan ? lerAbaComoObjetos(plan, ABA_ANAMNESE)[0] : null;
    if (linha) { nome = String(linha.nome_completo || '').trim() || nome; doc = String(linha.cpf || '').replace(/\D/g, ''); }
  } catch (erroAnamnese) { /* sem a anamnese o recibo fica sem CPF e nao entra no lote */ }
  return { nome: nome, documento: doc };
}
/** O recibo como a tela o recebe (o documento de quem recebe nunca vai inteiro para a lista). */
function _finReciboVisao_(r, c) {
  var datas = String(r.datas || '').split(',').filter(function (x) { return x; }), pc = c.pacs[_siglaChave_(r.sigla)] || {};
  return { id: r.id, sigla: r.sigla, nome: pc.nome || r.sigla, mes: r.mes, mes_nome: _finMesNome_(r.mes), titular: r.titular_nome, titular_doc: r.titular_documento === null ? 'anamnese' : _finDocMascara_(r.titular_documento),
    cpf_ok: r.titular_documento === null ? null : _finCpfValido_(r.titular_documento), sessoes: datas.length, datas: datas, unitario: parseInt(r.unitario, 10) || 0, modalidade: r.modalidade || '', valor: parseInt(r.valor, 10) || 0,
    data: r.data || '', situacao: r.situacao || 'a_emitir', numero: r.numero || '', descricao: r.descricao || '', lote: r.lote || '', tem_arquivo: !!r.arquivo_id, novo: !!r.novo };
}
/**
 * Recibos dos meses do periodo: os que ja foram salvos e, para cada paciente marcado "precisa de recibo" com sessao
 * cobrada no mes e sem recibo valido, a PROPOSTA (id `novo:<sigla>:<AAAA-MM>`), com as datas das sessoes e a descricao
 * ja montadas e a data do recibo EM BRANCO (ela e sempre informada pelo profissional).
 */
function _finRecibos_(c, e, per, hojeIso) {
  var lista = [], tem = {}, fimMes = hojeIso.slice(0, 7) < per.ate.slice(0, 7) ? hojeIso.slice(0, 7) : per.ate.slice(0, 7);
  c.recibos.forEach(function (r) {
    if (r.situacao !== 'cancelado') tem[_siglaChave_(r.sigla) + '|' + r.mes] = true;
    if (r.mes >= per.de.slice(0, 7) && r.mes <= per.ate.slice(0, 7)) lista.push(_finReciboVisao_(r, c));
  });
  var porChave = {};
  e.sessoes.forEach(function (s) {
    var sig = _siglaChave_(s.sigla), mes = s.data.slice(0, 7);
    if (!s.cobravel || mes < per.de.slice(0, 7) || mes > fimMes || tem[sig + '|' + mes] || _finCad_(c, sig).recibo !== 'Sim' || !c.pacs[sig]) return;
    (porChave[sig + '|' + mes] = porChave[sig + '|' + mes] || []).push(s);
  });
  Object.keys(porChave).sort().forEach(function (k) {
    var ss = porChave[k], sig = k.split('|')[0], mes = k.split('|')[1], conta = {}, unit = 0;
    ss.forEach(function (s) { conta[s.valor] = (conta[s.valor] || 0) + 1; if (!unit || conta[s.valor] > conta[unit]) unit = s.valor; });
    var datas = ss.map(function (s) { return _finLoteData_(s.data); }), t = _finTitular_(c, sig, false);
    lista.push(_finReciboVisao_({ id: 'novo:' + sig + ':' + mes, sigla: sig, mes: mes, data: '', datas: datas.join(','), unitario: String(unit), modalidade: '', valor: String(unit * datas.length),
      descricao: _finLoteDescricao_(datas, unit, '') || '', titular_nome: t.nome, titular_documento: t.documento, situacao: 'a_emitir', numero: '', novo: true }, c));
  });
  return lista.sort(function (a, b) { return (a.mes + a.nome).localeCompare(b.mes + b.nome, 'pt-BR'); });
}
/**
 * A previa LITERAL dos lotes do periodo: as linhas que iriam para o arquivo e o que ficou de fora, com o motivo.
 * Recibo entra quando esta salvo, "a emitir", com a data informada e CPF valido de quem recebe. Despesa entra quando
 * esta paga no periodo, tem a conta do plano de contas e o historico, e ainda nao saiu em lote.
 */
function _finLote_(c, e, per, hojeIso) {
  var f = _finFiscal_(c), lote = { pronto: f.pronto, recibos: { linhas: [], itens: [], fora: [] }, despesas: { linhas: [], itens: [], fora: 0, em_lote: 0 } };
  _finRecibos_(c, e, per, hojeIso).forEach(function (r) {
    if (r.situacao !== 'a_emitir') return;
    var bruto = c.recibos.filter(function (x) { return x.id === r.id; })[0];
    var motivo = r.novo ? 'abra o recibo, informe a data e salve' : (!r.data ? 'falta a data do recibo' : (!r.cpf_ok ? 'falta o CPF de quem recebe o recibo' : (!r.descricao ? 'a descrição não cabe em 255 caracteres' : '')));
    if (motivo || !bruto) { lote.recibos.fora.push({ nome: r.nome, motivo: motivo }); return; }
    lote.recibos.itens.push({ id: r.id, data: r.data, titular: r.titular, valor: r.valor, descricao: r.descricao });
    lote.recibos.linhas.push(_finLoteLinhaRecibo_(_finLoteData_(r.data), r.valor, r.descricao, bruto.titular_documento, f));
  });
  c.despesas.forEach(function (d) {
    if (d.situacao !== 'paga' || d.paga_em < per.de || d.paga_em > per.ate) return;
    if (d.lote) { lote.despesas.em_lote++; return; }
    var linha = d.conta ? _finLoteLinhaPagamento_(_finLoteData_(d.paga_em), d.conta, parseInt(d.valor, 10) || 0, d.historico || d.nome) : null;
    if (!linha) { lote.despesas.fora++; return; }
    lote.despesas.itens.push({ id: d.id, data: d.paga_em, conta: d.conta, valor: parseInt(d.valor, 10) || 0, historico: _finLoteHistorico_(d.historico || d.nome) });
    lote.despesas.linhas.push(linha);
  });
  return lote;
}
/** Demonstrativo do periodo: rendimentos (recibos no lote ou emitidos, pela data do recibo) menos as despesas do livro caixa (pagas, com conta dedutivel P10). */
function _finDemonstrativo_(c, per) {
  var d = { rendimentos: 0, despesas: 0, a_emitir: 0 };
  c.recibos.forEach(function (r) {
    if (r.situacao === 'a_emitir' && r.mes >= per.de.slice(0, 7) && r.mes <= per.ate.slice(0, 7)) d.a_emitir++;
    if ((r.situacao === 'no_lote' || r.situacao === 'emitido') && r.data >= per.de && r.data <= per.ate) d.rendimentos += parseInt(r.valor, 10) || 0;
  });
  c.despesas.forEach(function (x) { if (x.situacao === 'paga' && x.paga_em >= per.de && x.paga_em <= per.ate && /^P10\./.test(String(x.conta))) d.despesas += parseInt(x.valor, 10) || 0; });
  d.resultado = d.rendimentos - d.despesas;
  return d;
}

/**
 * Salva um recibo. `id` = o do recibo, ou `novo:<sigla>:<AAAA-MM>` para a proposta do mes. `dados`: { data ('AAAA-MM-DD'),
 * datas (['DD/MM/AAAA']), unitario (centavos), modalidade ('' | 'on-line' | 'presencial'), numero, situacao, arquivo }.
 * A descricao e sempre montada das datas, do valor e da modalidade. Informar o numero marca "emitido"; "cancelado"
 * guarda o numero (recibo cancelado continua consumindo o numero); `situacao: 'a_emitir'` tira o recibo do lote.
 */
function profSalvarRecibo(s, id, dados, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), d = dados && typeof dados === 'object' ? dados : {}, agora = _lemAgora_(), e = _finEstado_(c, agora);
  if (!c.config.fiscal) return { ok: false, erro: 'Ligue "Recibos e livro caixa" na Configuração.' };
  var m = /^novo:([A-Za-z0-9]{1,12}):(\d{4}-\d{2})$/.exec(String(id || '')), atual, sig, mes;
  if (m) {
    sig = _finDoPaciente_(c, m[1]); mes = m[2];
    if (!sig) return { ok: false, erro: 'Este paciente nao pertence a voce' };
    if (c.recibos.some(function (r) { return _siglaChave_(r.sigla) === sig && r.mes === mes && r.situacao !== 'cancelado'; })) return _finResposta_(alvo, { ok: true, duplicado: true }, periodo, agora);
    var proposta = _finRecibos_(c, e, { de: mes + '-01', ate: _finFimDoMes_(mes) }, agora.data).filter(function (r) { return r.id === 'novo:' + sig + ':' + mes; })[0];
    if (!proposta) return { ok: false, erro: 'Não há sessão cobrada deste paciente neste mês.' };
    var tit = _finTitular_(c, sig, true);
    atual = { sigla: sig, mes: mes, data: '', datas: proposta.datas.join(','), unitario: String(proposta.unitario), modalidade: '', titular_nome: tit.nome, titular_documento: tit.documento, situacao: 'a_emitir', numero: '' };
  } else {
    atual = c.recibos.filter(function (r) { return r.id === String(id || ''); })[0];
    if (!atual || !_finDoPaciente_(c, atual.sigla)) return { ok: false, erro: 'Recibo não encontrado.' };
    sig = _siglaChave_(atual.sigla); mes = atual.mes;
  }
  var datas = Array.isArray(d.datas) ? d.datas.map(function (x) { return String(x).trim(); }).filter(function (x) { return x; }) : String(atual.datas).split(',');
  datas = datas.filter(function (x, i, l) { return l.indexOf(x) === i; }).sort(function (a, b) { return (a.slice(6) + a.slice(3, 5) + a.slice(0, 2)).localeCompare(b.slice(6) + b.slice(3, 5) + b.slice(0, 2)); });
  if (!datas.length) return { ok: false, erro: 'Informe pelo menos uma data de sessão.' };
  for (var i = 0; i < datas.length; i++) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(datas[i]) || _lemDia_(datas[i].slice(6) + '-' + datas[i].slice(3, 5) + '-' + datas[i].slice(0, 2)) === null) return { ok: false, erro: 'Data de sessão inválida: ' + datas[i].slice(0, 12) + '. Use dia/mês/ano.' };
    if (datas[i].slice(6) + '-' + datas[i].slice(3, 5) !== mes) return { ok: false, erro: 'Um recibo por mês de sessões: a data ' + datas[i] + ' não é de ' + _finMesNome_(mes) + '.' };
  }
  var unit = d.unitario === undefined ? (parseInt(atual.unitario, 10) || 0) : _finInt_(d.unitario);
  if (unit <= 0) return { ok: false, erro: 'Informe o valor unitário.' };
  var modalidade = d.modalidade === undefined ? (atual.modalidade || '') : (d.modalidade === 'on-line' || d.modalidade === 'presencial' ? d.modalidade : '');
  var data = d.data === undefined ? (atual.data || '') : String(d.data || '');
  if (data && _lemDia_(data) === null) return { ok: false, erro: 'Data do recibo inválida.' };
  var desc = _finLoteDescricao_(datas, unit, modalidade);
  if (!desc) return { ok: false, erro: 'A descrição não cabe em 255 caracteres ou há sessões demais (até 26).' };
  var numero = d.numero === undefined ? (atual.numero || '') : _finTxt_(d.numero, 20).replace(/[;]/g, '');
  var situacao = atual.situacao || 'a_emitir';
  if (d.situacao === 'cancelado') { if (!numero) return { ok: false, erro: 'Informe o número do recibo cancelado (ele continua valendo como número usado).' }; situacao = 'cancelado'; }
  else if (d.situacao === 'a_emitir') { situacao = 'a_emitir'; numero = ''; }
  else if (numero) { if (!data) return { ok: false, erro: 'Informe a data do recibo.' }; situacao = 'emitido'; }
  var campos = { data: data, datas: datas.join(','), unitario: String(unit), modalidade: modalidade, valor: String(unit * datas.length), descricao: desc, situacao: situacao, numero: numero, atualizado_em: agora.carimbo };
  if (situacao === 'a_emitir') campos.lote = '';
  if (d.arquivo && d.arquivo.base64) {
    var arq = _finGuardarArquivo_(alvo.profissionalId, d.arquivo, 'recibo_' + sig + '_' + mes);
    if (arq.erro) return { ok: false, erro: arq.erro };
    campos.arquivo_id = arq.id; campos.arquivo_nome = arq.nome; campos.arquivo_tipo = arq.tipo;
  }
  if (m) { campos.id = Utilities.getUuid(); campos.sigla = sig; campos.mes = mes; campos.titular_nome = atual.titular_nome; campos.titular_documento = atual.titular_documento; campos.criado_em = agora.carimbo; }
  _finGravar_(alvo.controle, ABA_FIN_RECIBOS, m ? 0 : atual.__linha, campos);
  return _finResposta_(alvo, { ok: true, id: m ? campos.id : atual.id }, periodo, agora);
}

/**
 * Gera o arquivo de lote do periodo: `qual` = 'recibos' ou 'despesas'. Com `simular: true` devolve so a previa (o portao
 * e da tela: a tabela literal aparece antes de o arquivo existir). Sem simular, marca o que entrou (recibo vira
 * "no lote"; despesa ganha o nome do lote) para nunca repetir linha, e devolve o texto do arquivo.
 */
function profGerarLote(s, qual, simular, periodo) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var c = _finCtx_(alvo.controle), agora = _lemAgora_(), e = _finEstado_(c, agora), per = _finPeriodo_(periodo, agora.data), f = _finFiscal_(c);
  if (!f.ligado) return { ok: false, erro: 'Ligue "Recibos e livro caixa" na Configuração.' };
  if (!f.pronto) return { ok: false, erro: 'Informe o seu CPF na Configuração (ele vai em cada linha do lote de recibos).' };
  var lote = _finLote_(c, e, per, agora.data), parte = qual === 'despesas' ? lote.despesas : lote.recibos;
  if (!parte.linhas.length) return { ok: false, erro: qual === 'despesas' ? 'Nenhuma despesa paga com conta do livro caixa neste período.' : 'Nenhum recibo pronto: informe a data de cada recibo e salve.' };
  if (parte.linhas.length > 1000) return { ok: false, erro: 'O lote passa de 1.000 linhas. Escolha um período menor.' };
  if (simular) return { ok: true, simulacao: parte };
  var nome = (qual === 'despesas' ? 'lote-despesas-' : 'lote-recibos-') + per.de + '-a-' + per.ate + '.csv', marca = nome + ' · ' + agora.carimbo;
  parte.itens.forEach(function (it) {
    if (qual === 'despesas') { var d = c.despesas.filter(function (x) { return x.id === it.id; })[0]; _finGravar_(alvo.controle, ABA_FIN_DESPESAS, d.__linha, { lote: marca }); }
    else { var r = c.recibos.filter(function (x) { return x.id === it.id; })[0]; _finGravar_(alvo.controle, ABA_FIN_RECIBOS, r.__linha, { situacao: 'no_lote', lote: marca, atualizado_em: agora.carimbo }); }
  });
  return _finResposta_(alvo, { ok: true, arquivo: { nome: nome, texto: parte.linhas.join(''), linhas: parte.linhas.length } }, periodo, agora);
}
// ---------- fim da Fase 20 ----------

// ============================================================
// PACOTE 20.2 — STATUS DAS SESSOES
// Bloco "Sessoes com status pendente" do Inicio do profissional e os dois e-mails que vao SO a ele:
// o de fim de dia (sobrou sessao sem status) e o da vespera (a agenda de amanha).
// Decisoes do usuario (23/11/2026): a palavra e "status"; a sessao de hoje so vira pendencia depois que a
// ULTIMA sessao do dia termina; dois e-mails; nome completo; grade com data e hora.
// Regras puras, com o "agora" por parametro. Nenhum e-mail vai a paciente por aqui.
// Remetente: enquanto o profissional nao tiver a propria conta conectada, os dois e-mails so existem para a
// conta do dono do script (_stpDisponivel_ e o unico lugar a trocar quando a conta conectada chegar).
// ============================================================

var STP_LISTA_MAX = 60;        // linhas do bloco do Inicio (as mais antigas primeiro)
var STP_EMAIL_FOLGA_MIN = 60;  // o e-mail de fim de dia sai uma hora depois do fim da ultima sessao
var STP_EMAIL_TETO_MIN = 1435; // ... e nunca depois das 23:55
var STP_HORA_PADRAO = '20:00'; // horario padrao do e-mail da vespera
var STP_DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function _stpHoraValida_(h) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(h)); }
/** '09:00' -> '9h'; '10:30' -> '10h30'. */
function _stpHoraCurta_(h) {
  var t = _lemHora_(h);
  return t ? String(+t.slice(0, 2)) + 'h' + (t.slice(3) === '00' ? '' : t.slice(3)) : '';
}
/** Numero por extenso, no feminino (conta sessoes), ate vinte; acima disso, em algarismos. Pedido do usuario (23/11/2026) para o e-mail de fim de dia. */
var STP_EXTENSO = ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];
function _stpExtenso_(n, masculino) { var k = parseInt(n, 10); if (masculino && (k === 1 || k === 2)) return k === 1 ? 'um' : 'dois'; return k >= 0 && k <= 20 ? STP_EXTENSO[k] : String(k); }
function _stpMaiuscula_(t) { return String(t).charAt(0).toUpperCase() + String(t).slice(1); }
/** Fim da sessao em minutos do dia (inicio + duracao; sem duracao valida, a padrao). */
function _stpFimMin_(x, durPadrao) {
  var ini = _ageMin_(x.hora_inicio), dur = parseInt(x.duracao_min, 10);
  return ini === null ? null : ini + (dur > 0 ? dur : durPadrao);
}
/** Minuto em que a agenda do dia termina (o fim da ultima sessao nao cancelada); null se o dia nao tem sessao. */
function _stpFimDoDia_(sessoes, dataIso, durPadrao) {
  var fim = null;
  sessoes.forEach(function (x) {
    if (x.data !== dataIso || !_ageAtiva_(x)) return;
    var f = _stpFimMin_(x, durPadrao);
    if (f !== null && (fim === null || f > fim)) fim = f;
  });
  return fim;
}
/**
 * Sessoes com status pendente: nao cancelada, ainda "agendada", de um dia anterior — ou de hoje, depois que a
 * ultima sessao do dia terminou. Mais antigas primeiro.
 */
function _stpPendentes_(sessoes, agora, durPadrao) {
  var fimHoje = _stpFimDoDia_(sessoes, agora.data, durPadrao), agoraMin = _ageMin_(agora.hora);
  var hojeFechou = fimHoje !== null && agoraMin !== null && agoraMin >= fimHoje;
  return sessoes.filter(function (x) {
    if (!_ageAtiva_(x) || (x.estado !== 'agendada' && x.estado !== '') || _lemDia_(x.data) === null) return false;
    return x.data < agora.data || (x.data === agora.data && hojeFechou);
  }).sort(function (a, b) {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    var ha = _lemHora_(a.hora_inicio), hb = _lemHora_(b.hora_inicio);
    return ha < hb ? -1 : (ha > hb ? 1 : 0);
  });
}
/** O bloco do Inicio: o total e as primeiras linhas (id, paciente, data, hora). `c` e o contexto do financeiro, que ja leu as sessoes. */
function _stpVisao_(c, agora) {
  var todas = _stpPendentes_(c.sessoes, agora, c.cfgAgenda.duracao_slot_min);
  return { total: todas.length, itens: todas.slice(0, STP_LISTA_MAX).map(function (x) {
    var p = c.pacs[_siglaChave_(x.sigla)];
    return { id: x.id, sigla: x.sigla, nome: p ? p.nome : x.sigla, data: x.data, hora: _lemHora_(x.hora_inicio) };
  }) };
}

/**
 * Informa o status de uma ou de varias sessoes pelo bloco do Inicio. `situacao`: 'realizada' | 'falta'.
 * So vale para sessao que esta com status pendente (nunca toca sessao futura, cancelada ou ja marcada) e grava
 * o mesmo que a Agenda grava. Devolve os blocos do Inicio ja atualizados.
 */
function profMarcarStatusLote(s, ids, situacao) {
  var alvo = _ageProf_(s);
  if (!alvo.ok) return alvo;
  var estado = situacao === 'realizada' ? 'realizada' : (situacao === 'falta' ? 'falta' : '');
  var lista = (Array.isArray(ids) ? ids : []).map(function (x) { return String(x === undefined || x === null ? '' : x).trim(); }).filter(String);
  if (!estado || !lista.length || lista.length > STP_LISTA_MAX) return { ok: false, erro: 'Parametros incompletos' };
  var c = _finCtx_(alvo.controle), agora = _lemAgora_(), pend = {}, marcadas = 0;
  _stpPendentes_(c.sessoes, agora, c.cfgAgenda.duracao_slot_min).forEach(function (x) { pend[x.id] = x; });
  lista.forEach(function (id) {
    var x = pend[id];
    if (!x) return;
    _ageGravar_(c.abaS, COLUNAS_SESSOES, x.__linha, { estado: estado, cobrada: _ageCobrada_(estado, true, !!x.reposicao_de), atualizado_em: agora.carimbo });
    delete pend[id];
    marcadas++;
  });
  return { ok: true, marcadas: marcadas, inicio: _finInicio_(marcadas ? _finCtx_(alvo.controle) : c, agora) };
}

// ---------- os dois e-mails ao profissional ----------

/** Este profissional pode receber os e-mails do sistema sobre a agenda dele? 14.10: o dono do script ou quem conectou a conta com a permissao de envio — o e-mail sai da conta dele mesmo. */
function _stpDisponivel_(profId) { return _emailPermitido_(profId); }

/** As chaves dos dois e-mails na Config_Agenda (nascem desligadas) e a marca do ultimo envio de cada um ('AAAA-MM-DD'). */
function _stpConfig_(controle) {
  var cfg = { email_status_pendente: 'Nao', email_agenda_amanha: 'Nao', email_agenda_hora: STP_HORA_PADRAO, email_status_enviado_em: '', email_agenda_enviado_em: '' };
  var aba = controle ? controle.getSheetByName(GRADE_ABA_CONFIG) : null;
  if (!aba) return cfg;
  var v = aba.getDataRange().getDisplayValues();
  for (var i = 1; i < v.length; i++) {
    var chave = String(v[i][0] || '').trim(), valor = String(v[i][1] || '').trim();
    if (chave === 'email_status_pendente' || chave === 'email_agenda_amanha') cfg[chave] = valor.toLowerCase() === 'sim' ? 'Sim' : 'Nao';
    if (chave === 'email_agenda_hora' && _stpHoraValida_(valor)) cfg.email_agenda_hora = valor;
    if (chave === 'email_status_enviado_em' || chave === 'email_agenda_enviado_em') cfg[chave] = valor;
  }
  return cfg;
}
/**
 * O e-mail de fim de dia vence agora? So em dia com sessao, uma hora depois do fim da ultima, uma vez por dia, e so
 * se sobrou sessao DE HOJE com status pendente. Devolve null ou { hoje: [sessoes], antigas: n }.
 */
function _stpEmailPendenteVence_(sessoes, cfg, agora, durPadrao) {
  if (cfg.email_status_pendente !== 'Sim' || cfg.email_status_enviado_em === agora.data) return null;
  var fim = _stpFimDoDia_(sessoes, agora.data, durPadrao), a = _ageMin_(agora.hora);
  if (fim === null || a === null || a < Math.min(fim + STP_EMAIL_FOLGA_MIN, STP_EMAIL_TETO_MIN)) return null;
  var pend = _stpPendentes_(sessoes, agora, durPadrao), hoje = pend.filter(function (x) { return x.data === agora.data; });
  return hoje.length ? { hoje: hoje, antigas: pend.length - hoje.length } : null;
}
/** O e-mail da vespera vence agora? A partir do horario escolhido, uma vez por dia, e so se amanha tem sessao agendada. Devolve null ou { data, sessoes }. */
function _stpEmailAmanhaVence_(sessoes, cfg, agora) {
  if (cfg.email_agenda_amanha !== 'Sim' || cfg.email_agenda_enviado_em === agora.data || agora.hora < cfg.email_agenda_hora) return null;
  var amanha = _lemIso_(_lemDia_(agora.data) + 1);
  var lista = sessoes.filter(function (x) { return x.data === amanha && (x.estado === 'agendada' || x.estado === ''); }).sort(function (a, b) {
    var ha = _lemHora_(a.hora_inicio), hb = _lemHora_(b.hora_inicio);
    return ha < hb ? -1 : (ha > hb ? 1 : 0);
  });
  return lista.length ? { data: amanha, sessoes: lista } : null;
}

/**
 * E-mail ao profissional sobre a agenda dele (textos aprovados pelo usuario em 23/11/2026), no layout do sistema.
 * tipo 'pendente': p = { nome, sessoes: [{ data, hora, paciente }], antigas }.
 * tipo 'amanha':   p = { nome, data, sessoes: [{ data, hora, paciente, modalidade, confirmada }], pedidos }.
 * O assunto e o titulo nunca levam nome de paciente; o nome completo vai so na grade.
 */
function montarEmailAgendaProfissional(tipo, p) {
  var lista = p.sessoes || [], n = lista.length, t;
  if (tipo === 'pendente') {
    var antigas = parseInt(p.antigas, 10) || 0;
    t = { assunto: 'Sessões com status pendente — COGNIATIVO', titulo: 'Sessões com status pendente', botao: 'Informar o status', aviso: '',
      // texto revisto pelo usuario (23/11/2026): numeros por extenso e a frase das pendencias antigas dizendo o que sao
      paragrafo: (n === 1 ? 'Uma sessão de hoje ainda está sem status.' : _stpMaiuscula_(_stpExtenso_(n)) + ' sessões de hoje ainda estão sem status.') +
        (antigas ? (n === 1 ? ' Além dessa, ' : ' Além dessas, ') + (antigas === 1 ? 'uma sessão de dias anteriores também está sem status.' : _stpExtenso_(antigas) + ' sessões de dias anteriores também estão sem status.') : ''),
      tabela: { cab: ['Data', 'Hora', 'Paciente'], linhas: lista.map(function (x) { return [_ageDiaMes_(x.data), _stpHoraCurta_(x.hora), String(x.paciente || '')]; }) } };
  } else {
    var conf = lista.filter(function (x) { return x.confirmada; }).length, falta = n - conf, dia = _lemDia_(p.data), pedidos = parseInt(p.pedidos, 10) || 0;
    var presenca = n === 1 ? (conf ? 'confirmada' : 'a confirmar')
      : (falta === 0 ? 'todas confirmadas' : (conf === 0 ? 'nenhuma confirmada ainda' : _stpExtenso_(conf) + (conf === 1 ? ' confirmada' : ' confirmadas') + ' e ' + _stpExtenso_(falta) + ' a confirmar')); // 20.2.2: numeros por extenso, como no e-mail de fim de dia
    t = { assunto: 'Sua agenda de amanhã — COGNIATIVO', titulo: 'Sua agenda de amanhã', botao: 'Abrir a Agenda',
      aviso: pedidos ? (pedidos === 1 ? 'Um pedido de paciente aguarda a sua resposta.' : _stpMaiuscula_(_stpExtenso_(pedidos, true)) + ' pedidos de pacientes aguardam a sua resposta.') : '',
      paragrafo: (dia === null ? '' : STP_DIAS[_lemDiaDaSemana_(dia)] + ', ') + _ageDataBR_(p.data) + ': ' + (n === 1 ? 'uma sessão, ' : _stpExtenso_(n) + ' sessões, ') + presenca + '.',
      // na grade do e-mail a modalidade vai sob o nome do paciente (cinco colunas nao cabem num telefone); no texto puro, as cinco em linha
      tabela: { cab: ['Data', 'Hora', 'Paciente', 'Presença'], linhas: lista.map(function (x) {
        return [_ageDiaMes_(x.data), _stpHoraCurta_(x.hora), [String(x.paciente || ''), _ageModNome_(x.modalidade)], x.confirmada ? 'Confirmada' : 'A confirmar'];
      }), cabTexto: ['Data', 'Hora', 'Paciente', 'Modalidade', 'Presença'] } };
  }
  var ola = p.nome ? 'Olá, ' + p.nome + '.' : 'Olá.';
  var texto = [EMAIL_DESTAQUE, '', ola, '', t.paragrafo, '', (t.tabela.cabTexto || t.tabela.cab).join(' · ')].concat(t.tabela.linhas.map(function (l) { return l.map(function (c) { return Array.isArray(c) ? c.join(' · ') : c; }).join(' · '); }))
    .concat(['', SITE_URL, '']).concat(t.aviso ? [t.aviso, ''] : []).join('\n');
  var html = _layoutEmail_({ previa: t.titulo, titulo: t.titulo, acompanhamento: '', ola: ola, paragrafo: t.paragrafo, tabela: t.tabela, botao: t.botao,
    sobBotao: EMAIL_LEMBRETE_SOB_BOTAO, link: SITE_URL, aviso: t.aviso, assinatura: [] });
  return { assunto: t.assunto, texto: texto, html: html };
}

/**
 * Os dois e-mails de UM profissional (quem chama ja conferiu a trava da conta). A marca do dia e gravada ANTES do
 * envio, dentro da trava e relendo a celula: duas rodadas do gatilho nunca mandam o mesmo e-mail duas vezes. Se o
 * envio nao sai (cota ou falha), a marca e desfeita e a rodada seguinte tenta de novo. Devolve so contagens.
 */
function _stpEnviarDe_(prof, controle, agora) {
  var r = { pendente: 0, amanha: 0, ja_enviados: 0, sem_email: 0, sem_cota: 0, falhas: 0 };
  var cfg = _stpConfig_(controle);
  if (cfg.email_status_pendente !== 'Sim' && cfg.email_agenda_amanha !== 'Sim') return r;
  var sessoes = _lembretesLer_(_ageAba_(controle, ABA_SESSOES, COLUNAS_SESSOES, false));
  if (!sessoes.length) return r;
  var devidos = [];
  var fimDeDia = _stpEmailPendenteVence_(sessoes, cfg, agora, _ageConfig_(controle).duracao_slot_min);
  if (fimDeDia) devidos.push({ tipo: 'pendente', marca: 'email_status_enviado_em', dados: fimDeDia });
  var vespera = _stpEmailAmanhaVence_(sessoes, cfg, agora);
  if (vespera) devidos.push({ tipo: 'amanha', marca: 'email_agenda_enviado_em', dados: vespera });
  if (!devidos.length) return r;
  var para = normalizarEmail(prof.email);
  if (!para) { r.sem_email += devidos.length; return r; }
  var pacs = _agePacientes_(controle), nome = String(prof.nome_completo || '').trim().split(/\s+/)[0] || '';
  var linha = function (x) {
    var p = pacs[_siglaChave_(x.sigla)];
    return { data: x.data, hora: x.hora_inicio, paciente: p ? p.nome : x.sigla, modalidade: x.modalidade, confirmada: !!x.confirmada_em };
  };
  devidos.forEach(function (d) {
    var reserva;
    try {
      reserva = _comTrava_(function () {
        if (_stpConfig_(controle)[d.marca] === agora.data) return 'ja';
        _ageConfigGravar_(controle, d.marca, agora.data);
        return 'ok';
      });
    } catch (erroTrava) { reserva = 'falha'; }
    if (reserva === 'ja') { r.ja_enviados++; return; }
    if (reserva !== 'ok') { r.falhas++; return; }
    var desfazer = function () { _comTravaSeDer_(function () { _ageConfigGravar_(controle, d.marca, ''); }); };
    if (!_reservarEmail_('sessoes')) { r.sem_cota++; desfazer(); return; }
    var email = d.tipo === 'pendente'
      ? montarEmailAgendaProfissional('pendente', { nome: nome, sessoes: d.dados.hoje.map(linha), antigas: d.dados.antigas })
      : montarEmailAgendaProfissional('amanha', { nome: nome, data: d.dados.data, sessoes: d.dados.sessoes.map(linha),
          pedidos: _lembretesLer_(_ageAba_(controle, ABA_PEDIDOS_AGENDA, COLUNAS_PEDIDOS_AGENDA, false)).filter(function (x) { return x.estado === 'pendente'; }).length });
    if (_enviarEmail_(para, email, prof.profissional_id)) r[d.tipo]++; else { r.falhas++; desfazer(); }
  });
  return r;
}

/** Rodada do gatilho (chamada no fim de enviarLembretes_): os dois e-mails de cada profissional que pode recebe-los. So contagens. */
function enviarEmailsProfissional_(quando) {
  var agora = _lemAgora_(quando);
  var r = { profissionais: 0, pendente: 0, amanha: 0, ja_enviados: 0, sem_email: 0, sem_cota: 0, falhas: 0 };
  lerAbaComoObjetos(_abrirPlanilha_(SISTEMA_VMC_ID), ABA_PROFISSIONAIS).forEach(function (prof) {
    try {
      if (!prof.profissional_id || !_estaAtivo_(prof.ativo) || !_stpDisponivel_(prof.profissional_id)) return;
      var controle = abrirControleDoProfissional(prof.profissional_id);
      if (!controle) return;
      r.profissionais++;
      var parte = _stpEnviarDe_(prof, controle, agora);
      for (var k in parte) r[k] += parte[k];
    } catch (e) {
      r.falhas++;
      console.error('agenda (e-mails ao profissional): ' + String(e && e.message || e).slice(0, 160));
    }
  });
  return r;
}

// ------------------------------------------------------------
// Auxiliares do ping (Pacote E3, decisao 4)
// ------------------------------------------------------------

/**
 * URL da implantacao que esta atendendo a chamada. Prova necessaria para
 * o candidato E2-lite (staging por implantacao). Nunca derruba o ping.
 */
function _e3UrlDoServico_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (e) {
    return '';
  }
}

/**
 * Hora do servidor no fuso do consultorio.
 */
function _e3HoraServidor_() {
  return Utilities.formatDate(new Date(), 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss");
}

// 16.11: logo do e-mail (docs/design/marca/logo-email.png, 480 x 112, fundo branco), em base64 para ir
// embutido no e-mail (cid:logo) sem depender do site. Trocou o PNG -> regenerar esta linha.
var EMAIL_LOGO_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAeAAAABwCAIAAABJpzQ1AAAQAElEQVR4nOydBVgUWxvHR0AFRRQRQVLSxELF1ovdit3dde266rWwu9trgYGJ3agodiCKgoCA0g2Cgd+fHe/c4czsMouIC9/5PfvwLGfPzM6eOfM/73nfExrfv39nKBQKhaJ6qDEUCoVCUUmoQFMoFIqKQgWaQqFQVBQq0BQKhaKiUIGmUCgUFYUKNIVCoagoVKApFApFRaECTaFQKCoKFWgKhUJRUahAUygUiopCBZpCoVBUFCrQFAqFoqJQgaZQKBQVhQo0hUKhqChUoCkUCkVFoQJNoVAoKgoVaAqFQlFRqEBTKBSKikIFmkKhUFQUKtAUCoWiomgwv4yYmOSkxNTk5LSv39KLFi1saanPUCgUCkUyOSzQTx4HPXoU9PBBQGhorPBTaLSFhX75imUaNrSFZDOUfIrHTc+XL1+ZlzVr06Y5k6fw8fG9feuurm6JZs2b4C9DofxWCnz//p3JCc66Pzt08F5CwieJ+e3tyzb5ozxeDCV/MWvmggP7j7DvGzWut2Pnei0tTSYv4Hbs9MQ/Z7HvTc2MXV134y9Dofw+ckCgb99+u3f3rfDwBEZ5zM31/pzU0tq6NEPJF2zdssd58Sp+SrfunVatXsSoPA/uP+7i1J+fYm1jee36aYZC+X38VJDw8+evy5aeW7bkbPbUGQQFRU+e6LJ71y2ciqHkfY4cOUGknDju/vVrHri5J064Eyl+b99BtRkK5feRfR90aEjswoWn8Zf5OdLTv584/uj5s+DFS7pQx3ReR60A2eRDnTU0fmEsmsDV5fhxt0xm74iRg5o2a5zlgQUKFBAm5pQDkELJHtm0oKHLE/90+Xl15vD3j5g90y05OY2h5GXatCWjgm3btWRykeDgkHv3HvJf4RGRUg5s3boZkWJsXKa2gz1Dofw+siPQsbHJs2e5ffr0mclRWI3O8dNScpNJk8fUrVuL+9fKquy8v6czeYEGDeuOGj2E+7d4cZ2165cwFMpvRem+JwR0zuzj0dFJzC8AGn3Y9f7AQQ0YSp7l8NE9N2/e8Xn52tKybMtWTZm8w8xZE9u3b+npeV9Xt4SjYyO9UiUZCuW3orRA79rpgcheltkMDYtbWOhbWJaytCqtpVUwLjYlKirploevn1+E4gPdzzylAp3Xady4Pl7M70DEa6yMH7myXUW8GApFNVBOoCHNFy94K85TrnyZCX82NzUVsT6cutg/fx7scsjL+0WIvMPT0r4mJqYWK5Y3Rs5SKBTKr0M5gd665bqCTzW1CvbrV69Dx+oK8lSpYorXfa93a1ZfTEoSCQnq6WlTdaZQKBRGqSCh1z1/BZavvn6xLVv6K1ZnjtoOloucu2hqFhR+1L5DNYZCoVAoSlnQ7meeyfuoaNHCCxZ1LqVfjJGMlVXpZcu7LVx4JioykUusWs20S9eazK8nLS3twvmrDx8+CX4fGvQ+ODTkg46OjnlZU1NT4/Llbbv36FSypC6jPElJye5nLj59+iI4OCQoMPj9+xBjEyNzc1MzM2M7u0rtO7QqUaI4ky2iIqOPHj31ysc3MPD927f+SCldWh8n79q1g1OX9ly2jx/DkYF/oLFxGTMzE+JsuMJPn1K5f3V0ilWq9GPOfWJikrv7xfNnL+PiIyIi09PTyxgZItzn4GDfqnUz4akIcIi/fyA/xcTYSMqE6RMn3B/cfxwa8jE4JBS3Q11DQ7+UnqFhabsqlapXt2vWvEnhwnLHyOPAr9++se8/hH4kPg0ICLp79wGRaGCgjx/FT0GBoFj4KfxiAcKT8MerZElCQuLLl6/5KYUKFrSvmYU5cuPG7Vsed3FPg9+H4I5oamqiOqE8cfHt2re0tbVmKPkaqVO94Rru6rRR3qcTJ7V0bFpBmB4f/yUx4UuBAkzx4oW0i4k0BnA3X7n88smT9zo6WtWrmzVt9svjMz4+vrt27j939lJycoqCbD16dh45crCVtQUjjSdPnu/dfejcucuQfgXZWrduNmBgr3r1HRjJ+Pq+Xbd2K3RfXgY9Pd3FS+ayyxLhp83/exn/01Gjh8ycNZE4pEmjdu/eBXL/VqlSyf3cYby5cvnGuLHTFJTM0GH9p04br2BtjUOHjs2Y9jc/Zdz44TiEkc+hg0c3btwZEhyqIA+aGeelc//4o6HopxUr1ElKVG5YUe8+3ZYum8dP8fcL+KNJe36Kg0PNo257uX+dOvd7+OAJP8P6jcs6dWrLSGPVyo24j/wUNNibNq8UzRwZGbV710G3Y6fCwhQF1RHP7NnTqf+AngwlnyLVglbg3DA1K/mHI6nO4WGp3i/ioiL/UytDQ027qiVK6mWyg+Bu7uxkjxeTK+zcsW/B/OVSch52PYHX9BkTxowdlmXm9eu2rVyxgZHA+fNX8Bo0uM/8BTOl5D918hwUU3Ge6OjYkcMnDhzUe8HCWUy2iI2Lw99/9rrM+Wux4pwowHv3Hv6zb7O+finmp4mPT+jTa9jz5y+zzBka+nFAv1HjJ4yYMnUc85sYMKAXIdAuB49JF2iXQ27CE4rmhKk+asSkmJisZ4F5v/D564WPq+vx7dvXmJjSdZ3yIVJ90O/eyZ2O1bmzPTFLNjAg6ca1cL46g7Cw1KuXw8M+Sl3uLmeB82H40AkS1Zlj2dJ10EcFRjEcAv36jJCozhx7dh/s2L63YuMIrFi+Pkt15ti759CG9dslZia6TXGx8ZDdLNWZBaLQt/dwBadmpBEdFdOlc38p6syBhvDveUt/5kuVOuQ7kylPx05tiJHRUFL4TxgJXL50PSLzhEZrG0vRaYpbNu/q0W2QFHXmwB1p0aLLtWseDCXfIVWg5c1MgTTXqWvFT0lO/vrAK0Y0c3r69wde0fjL5DpDB4+7cOEqozywYadMniPv0/59R9y8eYdRHrhEenYfnJoqV/r37DkoXXBZIOjPn0nSO2LdCTQzY0ZNYSTz6tWbtWu2yDs1I42hQ8e/eePHKMnuXQfgR8r2lyp1SAGGzNOnTzciBf4ZRgLw/BApgwb1EWbbvm3vEuc1jPLAwzOw/2hUKoaSv5Dq4pAn0IaGxYlRcX5vExVIcErKN2SwLafD5CLbtu719Lwv+lGFCraWVhYIvMDA8Xv7jggTsUCjmzZrLOzMwqB79Eg8cArntY21pYVlWUQL4dyEognzwAu8ZPHq+QtFfB1wQa5Ytl70zIgO1alby8bG0tKqLM4MD7XHTU/EBtlPhUuyiSJUJ3wj/19EIE1MjGAexsbGiZ4Bvo6RowZrahYWnFmSVkLXHj18SiTCtf2HY6OaNavhN4aFhUNu4BOHA4fIBh+3o2Mj/lfXrl0j5V+/eXBwaGjmOCHOVro06ZCxsirLZIXwp/Tt1wM3nZ9y5PDJ2X9l0bbh7ly9cpOfUqSIVmendkQ2VJJFC8Vd0gYGpW1srcqXt0lOSn7z1t/X10/U5z5+7PRLV07kldW3KVKQKtAx0cmi6SVLahMp8D4zCokIT81NgYaELV4kUu/t7avu2rORGK3heccLbhAEEonMs2YsqGlfje/mQ79S1LOBuM2evRvxRPET0WMdPuzP+16PiMwwk1u2blqvXm0ifdWKjfDJCE+OcNCixX9x/7JBs4SExJEjJt2+dZf5aXR1S8z+a3LTZk0QeGRT4uLi0T2fPWshYezjS0+eONuzlxOjPHAZrVq5iUjEb1m3YSl/lAvieDDtnRevPnjgCD8nLunM6fPdunfiUvb+s5l7j24E0fMYMWpQr15dmJzA0LA0wryIInApaMBOnzrfoWNrBUcddj1OpHTt1lFbuyiROHbMVOGxyLZpy0phdHTN6s14EYlBQcHOi1ctXDSboeQXpLo45G2VUkyHbK7TUr8xCklLTWdykS2bdwsTu3TtcOLUQeFYunr1HS5ccuMPXGOpXds+OrNbcNu2vcLT4kE9cXI/oc5MRjOme8ztn96CDjLYtHGHMPH0mQvCxFWrF/HVmUNHp9ghlx34RYxkRB2w1arZ3fBw796jM6fOAIoJKdy1W2QAz7WrN8XOnLX/qnDhwo+e3Ni5a72TUzvW3Ktbt9Y/+7cIxyAWK6a9ZOncKlUqEekSHQvSL0nOgSKJ/fr3YJS8GBeBf0MYHoT/7e0bfyLR2MTo9BkX0bErEyeN3rp9jbAHg0ivsM9BybtIFWhtbfFRqELh1tTKwiovrKnO5Bbx8QnH3c4QiTVrVV+z1lnBUWvXLWklW+VHX7/UuPHD7z+8tnff5qpVK3MZYMTB70EcBR3ZuGmFguG6S5fNa9KEXGbklsddzkHBcuniNWEHFgfybUYhc+dN0y6mzfwEOIO8XfgaNqorXI1T1G8jnRYtHdeuX+r79iGEZt2GZQpyCocJwrMEE575HTRoWLdsWTN+CrxnxNhzPtev3yLur4NDTfgriGwuB48Jjz14aDtiiYwc2rRp7rxkrjCdWA6bkqeRKtAldIuKpsfGkmNmSxtksei+QVYZcpBjR08JExc7z8nywNVrnTdsXA5Db+q08ejYEp+6HRN5BpyXzmWyYpGziAns6pJpANYZMfNZ1FXNB9o6duxQRhpCoxJuFrRbCg7pLOhVoEMtempGSSA0whLmU79BHaFDQGhvyiXbFjQjfuDAQb2JFG4PRiEHD5D2tdAGh4JDx4nEUaOHEFNphMBVAk8dkeji4sZQ8gtSBVpXt4hoenhYfGJiJqezja2OurrcSFHRohrWtrnngIZ9SqQMGNgLgcEsD4QidOzURt6nd+54ESk9enYW9sSFmJmZjJ8wgkj0vJMpgPnkMRmLr1OnpoWFOZMVHTuKXrAkeWre4g/FGXANampkbZFixubIpiTVa1QhUgiz9Oe/TnigvFN1796JCMTBDhDd1guRZ8Q5+SloR9u0bUFkuyuIYCNI++fEUYwEnJfOIwKziHVHR8UwlHyB1CBhiRLiAp2e/v2up1+Llv91/4sUUa9dp9TdOyLjptXUCtRy0MvGmKhsExLygUgRRs+zgXA+cWen9ow04OAmRgKEfsh0thjBwAnbcpJm9MJlCQeLYNS2SHELx1qUMTJkFAIHMRw+4eGZxm7D1QMPOHHqLL9LCNrR4JDQjx/CPnwICwsL//L5C5EhIID0IYgGURnRr5NW4YQHCrfvYoErCbeb73pGEPj8uSvtO7Qich45fDI9PVPEpW+/7hoapItPWEtbtW4qcTAGrI3y5W0IdxNqFF3MOn8gVaDLlZP7AJ8+9aR5i0r8+m1mXqSwpoH380wzCcsYadlVLaGrW4jJRUJCyAnERkZlmJ/mvWBesqmJ1Hlcwgvgz3KGvAod0NKXXIDL8qX3K0Z5jLISaCajV1EkPLPZmqjkBGshcOWvXLFB3FuikMTE3+ODZoGXg4gNHjxwRCjQLi6kZ1l0WrawvTc2VqKWomEmBBqKL6U/R1F9pAq0Qx2rIkUKpaSI7EcVFBR9/dprYi0OAwNNg+aGCQlfEhO+ytbiKFhUW9FaHMWKadaoYZ6za3HArklJIWOYit2dUoCAIODakgAAEABJREFUCjVUynpALIi8l9LXi4rMtOkBLEdWImNj44WHSH9cTUyMsifQ+qX0ssyjrS0IQv6E+wLXOWb0VP6SIErxe3cKh9EKlz1/5jcbKuTHDz1uega/z9SQt2zVVDjCB4SEkha0sbERIxlh9RAqPiWPosRyo8SMQT47tt/48EFkRoOOTkFjEy0jYy1RdX7nHzF+3MHdu249eRzkcdN37ZpL06Ye+fw5xx48oc+UkZmozM8hqknClkDRGdLJgYbp/y7Gpl1UxJUk7ALLI0yOZzZLCqhlXRM0CubY5txv3vj16D442+rMZNzc3BsLJIpwqBwxXvuQyOg6qasaffnyhZGM0Ff+9es3hpIvUEKgFaz1nJSUNmf28chIJXqd/v4R06cdjcp8yCufD7t25tiSAnCbCh15Qm+mshQrpl1UIKMBkrUmPj5BOFKVmwID/6ZwcKuf3ztGGj8jebnJhPEz5QUYcdesrMrWdrBHWJJ7mZubEtnU1bO5IX1OgRgyMY7e1eW/CSm4xefOXuJ/ijBvg4Z1RU8l9C/5+QUwkhFmluKwouQJlKjlVlalGzUqJ+/TiIiE0aP2nTv7jJHAfa93f81yS00VMRNu3vBlco4yZcia6i9Z7BRgJOhUSn+iEGQnUhCy5/8r7AVLPDlcOj/vFM4FLl28JvTDoFkaOWrQsxe3n3vfuX7T/ZjbP0eO7eVewjk+6uq/2YIGffpmuio0vWdO/xgieeTwCSKzgkVBf7KW+lOBzr8oZ4b0H6hoJ9DUT1+2bL4+c/rRsLB4eXmePw9GhoULTovud8VkrLWURozb+xmEgxOOH5e0WkUWpy1jQKRIXARDNCdxtmrV7YgMXvcevn8vd7lXDuHcGRkiLhmRIWXpEqZ3Co4SWXRFwmC1S5fIjdOgzqfdXWfNnixvpgy7RwEfeYNDsr1prPDA9O9ZlEmfvt0JN9qB/YfZU+3b58pPL1SoUI8eneWdRyjQHh6eEofKPXr4lBhaw4jVT0oeRTmBNjDQyXJLKm/v0GFD9owYtneJs7uri5eX1zuIMlzMx90eTZxwaPZMN2RQcHjhwho5uCdhw4Z1iJTLl64L18QQgg74tKlzEecR/bR+ffK01656CHfcEBIUFLzvH1fybA0yna1du5ZEBgTEZs9cyCgkKSl59apNYp9IGmYnxQctHK+mppb1mDbhdwnN54mTxiDsxsjnlWB1FA0NDTnXmM1RnNKH2XHAUG3WvAk/BXUAocK7nvdDM4cNnLq0UzDPs159cjEWhDRWr97ESGDe3CVECgKVxiZKxBgpqozSjrz+A+qXtch6sXbEDD3v+B08cHfRgtMQ5RXLz+/ZfcvPLyLLA9u3z8k9CXv0EFnNR8qq0Euc18Cl2LfP8OpVGy5auJJYtri72KxrSaddvFqY2Kt3pqV8EOsXPsw3b95RMF0NLJy/HF1sJi8QmXkEC6hbT9HeUZ53vIjNooCaHB+0MDIcEyO+IF+OIBoqPCRh8Q0+ZmYmDRuR7un9+w5nGVGAR0W4oHav3l0ZSn5BaYHW1Cw4f4Fy2w9Kx9KqdPeetZmcQ69USeFKY6jTgweNVbAm+vJl67iIPKI927ftbdemx+ZNO/mnFc4Hg2E4sP9oeadNS0ubMe1v4VrGCBwJI2CdxCYxzpq5YPKkv4RLSGesBTxgdB6a4CvsgMfIX98Hrc7EP0V2ilGXM4pD6NTy8XnN/DIgrMQkz6NHTp0+dZ6fUr16lUqVKyg+Tx+xhbR69xzq5fVQ3iHwaE2f/rcwvbt8Xwolz5GdUHjJkkUXLOxcpEgOTzmxtNRfsrSrllYOn3bChJHCBYyuXL7RvGln/rqRLBDQLk79N24gV5grpa/XP7MRJJyxDa5d82jq2PGs+0ViMN+9ew9btewqNKzknWfWrEmibsSjR042c+w4feq8nTv23bhxe/euA3jfvLkTHCyMMojNtpOwgH2B7Dg0hFSpSs6h2LFjn+gCxz4+vp079RWd1S2cj8diY02uLuR+5iKhmMTOVfKQ6CwZMDBTxRC20EQGUdDeC0X8w4ewbl0Gwlwg/NEISEyaOHvc2GnCQhs4qDd/MUJKXiebI1tNTUuuWNlj0cLTHz/GMzmBja3BosVdclz0ZWe2WrBoFoSMSI+MjBox7E+8qe1gX62a3evXb/DcyhvOnLFWXOb1eipWLLdg4ay5c8hV8fAsjRo5mZGtN13DvtrbN/737z+Sd9px44fXqSOyizlcHGvWOvfsMUT40XvZ7s6iZ0OorV37VqLrQ6kU/K2yWe7cvteoUdvRo4egP2FqahwXF+/r+9bzzv3tYmu6sshzmovu8zt2zFSE7yrbVUxPT3c7dlpdXf2u1+WcWti+W/dOS5eskbc5DsKewtVrRdm2fU2rFl2EU9hhLuBlZVXWwaFmalravbsPINyiZyhXzmb2X5MZSj4i+1MPzMz11q7vs2zJ2cePJW3LJg8Emjp2qtG3X91ChXJsHgRBr15dbnl4ytsYGzFDxWFDWCWie4Mi/cb12/L2gnv06Jm8/VZYqlatPHnKWHmf1qvvsHrN4imT56SnS10+e9XqxcKAvugoDuHoC26mjALE5tekZ5lHODqibbuW69dtI1QmKjJaqR0jReKTMkqW1EWbhy4LkY4UfuL+fa7DRwxkFF7nN2klX6yYdufO7eS5mLr36MRIA57o1Wudhw+dIPqpv38gXgoOR3uzY9c6BavdUvIiPzXaHwbv3ws6T53e2tCwePbOYGyiu2pNr8FDGv46dWbZvGVV9rb/GDN2mILdsrduX9OufUtGeWAqHnTZoaZw7ETXbh1379konLciBNb9lq2rhGtBMHJGO/zeURzFi+ts3LSCUYa+/boTKRrqciuM6JquBFu37iFSsjGKg2Pg4D7yPurfP2v/BkerVk1XrV7EKA9ccIdcdxELVVPyAT87HQu1ulGjclu2DRg+oomOjpb0AytWMpo+o82mzf2srX92cQyJLF+xAC+lDpk4afT0GRMUZIB6QvpnzVauXzl0WP9DLjvIdeDEcGza6MxZVxhoCvK0aOl4/uKxtrLBeUILGo+u8JDf64NmZHsm/DVH6ja1cNPDdUMkqmvInahia2stXHOZAAb7P3tdFOeRPmCvQgVb0dW0HR0bSV+khQUOE/dzh0WX7JAHumIXLh4TLgxNyQfkjN2qoaHWvkM1vJ48Dnr4MPDxo6CQEJFh9oULa5QurVOufJkOHatZWOgzuQ6M6Br2VfbuOXTy5LkkhZPuELQZOrSf4jXsOUaOGuRQx37/vsPuZy4o2KgbNG3WGCEj4b4qCoBjcd2GpXPmTnVzOxMa+iE2Ng6vggULGpTWNzYxcnJqxx/0GhhILgtnaKiicxbgYWjVutnmTbsUbxmFNhV3TTiYTE2hfC52nmNlZbFm9WZ5Qw+hg1kuga0U/Qf0FMYe+0tefINPlSqVLlxy27vnIO54SLCiSQNoGHr27iK6QTglf1AgR9ZTFyUmJjkpMTU5Oe3rt3RNzYIGBjpKmdi/mrPuF+97PX4fHBL8PjQ4OKRIES1zczMTUyM82N27d8reUP/k5JRzZy89efIccTycNiAgqEwZA3Q8Tc1MEFTs2LHNr16lt6ljR2KrkVNnDlWvTq52//Tpi0+fMk3XrFu3FpMVL71fJWRu1SAlxLIkERGRhKvUxNhIsRWJQ27fuufr6+fz8jVig7Gx8QYGGXuKt27TvGOnNuxGhYiyPnvmzT+qfHkbedMOOaDOMJPfvvXHvQgMfP/5yxe7yhUQKkRMQriVFAqE2NMdXRxhPFMBwplKUkpVMZ53vK5fvxUUiBr6ISjwPcKbsupkbGFh3qpVM7sqObn6I0UF+YUCTcl9LMyrfMscuLvrdVmpxYUpFIrq8GtDc5TcBNYioc6QZrpuDoWSd6ECnU9488ZPOEytT9/u2V6bgkKh/HZ+86K6FAXAIp745ywp20F5et4fOGCMcJV3uiwDhZKnoT5o1cWhVlN2lnNtB3snp3YtWjgKx8w9f/5y04YdwjnrjGwIwaLFWY8IplAoKgsVaBXFxcVNOD29sl1FE+MyeqX0dHWLv/R+ff/+o+TkFNHDy5WzcT/nSueVUSh5GirQqkh6enr9eq1CJW9FSKClpXnx8nE6r4xCyetQH7QqcuPG7Wyrs4WF+YlTB6k6Uyj5ACrQqoijY6MtW1cpO0sYdOna4fzFYxUrlmMoFEreh7o4VBqY0ocOHL19+55wFUo+enq6HTu17dHTqUIFW4ZCoeQXqEDnDXx8fL28Hn4I/ZgQnxifkJiQkFi8uI65uampqRF8GvXqOzAUCiXfQQWaQqFQVBTqg6ZQKBQVhQo0hUKhqCh0LQ6V5vUr/9DQ8IaNahUqVJCh5C7v/N+/execmJhcurRerdpV6C2g5D5UoFWaJYu34C+kARrNUHKRPbuO3rjuxf1bvHixynZ0hAwlt6ECrdI0cazj9ybQ1tZCqaNWr9z17OmraTNGVKpsw6gSA/pmbHP1z4GVjGrj4+MHdS5aVKt12ya6usXfvgmg6kz5LVCBVmkGDc7OcnTspt3StwPPHdjrUVdXZ1Qe7xe+TMYaVdXad2jKZOzwW5OhUH4HVKDzIexm2wXUVGslaHYL82/fvjEqT2xMxk6GVtZ0ujzlN6OcQCNmpaWlaV42YwpyVFTsS++3qZ9STc2NKla0lndIWtrnN77vQoLDCmsWNjUtY2Nblsjw9k3g9+/fbctl9OIDAoLf+QfjGdbX16teQ3y/NV/fgLCPEUmJKYZG+hUrWGsV0RTmeeXjFxQUWqSIlpW1ubExuWvq+6APKSmfzM2N2WM/f/4SH5+ory9pt8CI8OiYmDgDw1Lo+bIpHz9GlimTaQNcf7+gkJAwXKGJqWG58paamuJLyoWHRfn5BSbEJ5mYlrG2MUfBxsbGI7FkyRKlDX4sKxrwLhgFaGllRkSofF6+DfsYmZr2Gb+uQkVr7lN///dfPn9JSsyYdhgc9EHjX3O1fAUr9pci8FW4cCELS1M2PSYmvkgRTe4KUSy+r999CI0wMi5tbW1eTEebuGZUAJjA3E1MTEhiChQoVqwooxD8BPwQbsQ9TsK+0dYugt+ON9HRcZER0aVK6Zb69y58/BBRxui/na1RyCjVpKTksmVNhKWB24f87OHJyZ/83gaivukU10ZmUzOR7b6SklJwDVFRMYUKFjS3MLGy+k+IURtR/ditZiMiotlLLaCmVq5cJi9TclLKmzcBKKii+Akmhrh9xFegJFHNihTVMjP7sbllZGQMHNm4ctwC3Aj2jvi9DUIdKF5cp3JlG35p4/4GBYZqFdGytDQ1MxfZHjM1NS0jgBwSbmCoZ2llXrJkcSID7iMKnP2WjAtO/vT161dcAEPJUygxUQWPwfgx8/F4zJg1cv8/J255/LdFJrx1Awd3re1Abvx+6MCpixdu8VNQk0aN6WvLq+5jRs7FA7x85YyVy3eEhoZz6RDBUaP7cFICYizRg4MAABAASURBVKLj1q3dGxgQwj9h23Z/dO/ZlvsX9XLThv24VC4Fz8+QYd0teQ8hIm+o3LPnjElLSzt25HxgYGjd+jVGjurNSMD10Jnz5272G9AZP+Hg/lM4j7GJofPSKeynz5+93r3zKHSWf0iHjs26dGvFT4Gubdp4AK0IP7F3347q6moo2NZtGvfs3Z5NnDVjZWhI2NLl0zi1wnOLHxgeHsUdCGXv7NSiZetGeD918hI0IcLLZt2+ULEZ05bjgucv/PPokXOetx8lJibP/XscmjF8evL4pRPHL/GPQte+V58OkFH2X4jOqOFz8O+mrQuQ0+OGF/R97Pj+tWpXYRSC5mr2DBG/c9VqFSZNGYI37meuHT18rpNTiwYN7PfvOwl5QiuCb2FkSrRh3T/eL95wR0HjUJ6tWjfmUjzvPNq2xaVt+z9K6+vt2X2M/xVw4hNuIjiXUS1R5bgU1LRhw3uyrQ5qI+SbuE5czPZdzuz7T59S9+52u3c30wbeJUro9OnXkV//UTFQzSpWshk/YcChg6cfPniB0lu+aoaBQakZU5ehvVm5ZtbaVbtRMtwhAwZ1cWxaF3dk2ZKtwe8/cun9Bzo1bVaP/3VXr3iiHkLluZQa9pX6DXDiyzTn7kd1vXL5TlRkDHt+hpKnUNrFkfopbf2avd7ebxyb1atSpRzsuOvX7kEvoBp4cqpV/8/sXbt695PHPgULatSpW71K1fJ4JFCt8aQtXrjJedlUvmH75cvXjRv2p6SkopaXLq0Hkb1z+xFsSTyZq9f9t+T89m2uUOeyFia1a1eF4fDypR8k5qz7daYA071HhkbDNoHKo+La21eubl8J9uPdu08QLps/b/26jXPxFPF/yP37zy5fvI03eDLxQxhlgHF02MUdX4TORM2adj9O6PUMhcDIzFWUAx5FGFnnz944feqKuoZ6p87N2Ww4CiWARxSPE7yc+PbYmPgXL3yhGg51qmX51Zs2Zqgzuiw17CvD5nr+7BXKChKgqVW4cROHFi0aJiWn3PV8jNKr38Bev7Se8AzwBSOKCBHE4TVr2bFdAQguBBpaj6MqVrbBJeHBvn3rIWxbtMfEGbZsOohbiQ4KfibfzpWHjo42xJeRtQH4y74HhoaZeh5oWubNWQtbD22q3b93ZMWy7TAzkRMXZmpmhFuM8nQ5eAYf8TWayeg2+Z/1v44yrF6jEqxFaOLTJz43rt1DjUIrzuZB87Zn11G8adS4NuokeoGPH3m/8Q2AJi5ZPg29qDbt/sANwrEhwR9r1qqCPhAya2j86IigDi+avxGqilqN0q5U2TY6Ohblj/4Bbn1ycsofjpkU8PPnz86LN6O2oJARZtTm7YC+fOk2DXWNwUO7FSpUyOveEzwp/+xxMzQsdfLEZVwAGhVY3yjkRw+99+09DjOc67Vcv3YXKbgAtD12drboqF26dPvxo5dhH6OWLJ9KlDxsiEsXb6GHhG83N8/ORvWU34vSAv3hQzj6hjA/OSsYke61q/c8efxy5/bDq9bOhrmBxGtX76LOoXc2YeIg9D3ZnA0b1Tpy+OzZM9ehbqzpxBEWFrnIeTJrAuCxb9Wm8dzZa6AOaPybNa/PyDqVMDnxqMP6Yw/B8wPLAtZEw4Y/hqAlJCQZGRvY16wMo5VNgWm8Yd2+hw+eXzjv0bNXO/43Qp3xad9+nTgLUTo3b3jh5w8f2YtzjOCrd+04gjdjxvXjLCnYNXXrVl+0YKP76atNmjiU0M1oIU6duAx1xoHz5o/nerXNWzZwdXGHmiv+XsgTlNfCwnT6v6JZp261evXtfXze2lUpz56HkTlGZAJdU3QUB+xo6C//OsH39O9oUUaO7s11NXDlM6evQJnDbcJ3AsDAhHBAQSAQjDRw1zrzBLrzvwJNAEMYSjRrzhgINJsCCx3SjD7e1GnDWH8UHF/wJ6CBOX/2JiHQKByIJiSP/ReVDZUHPZLTJ69wAg29w9+u3Vuz0T+A/or76WuoA2z7zeZEEwiBRs8Axcv/CjQMUGfcxxkzR3ItU/MWDdjmDZZ1+fJW/BYLTQvOPGXaMDuBBfApJRVmio6sAtStV53tmeE5ggfJedkUttXEDWKfl+NuF6fPHPHjwE9puFP9BnRi7zioU6/6nNmr8WDi16Hy878F6tytR5t27R0ZSt5EiZmEnDOkR692tpldcnja4TZF7+yx7AEAF87dxF/0HDl1ZoGpCxWGVZvhvuTRrFl9fgcNzjLHZhnGSOi/fUC24wn/IGo2lw1P8oCBTtwjAWWHfHPqzMKark8fv8z8axj8BLg1lFVntgwgrJOnDuW7rW9cv4fOONoqws8DE7tlq0boIty796NTfPPmffyF64Dw8Dp1ack6cxX4nGBdMrJeNj8RxhFbquSlMt/lpQwa0o24TqeuLdEB5zuC4F1t2jyjZ/30sQ9xnt59OkhXZ0nIrgtW4dQZwzl1ZmQOsWEjesIJw480wDGCUo2LS4BXmjgNfgX/XzTtuL+4L5xHiN2AJjmzE6NdB0f8HHy7+GX9Cwof1iveTJo8hOg3oMmByOLN1aueP4789y6OHtvPTqx/1qhJbR1eBYBFwsgs9IaNa3HhDSaj/WjCyFzSXEqbtk1wpzh1BjCQW8vaKvQYiG9BZqrOeRolLGhuf2jYVsRHrB8DpoqfXxDMUpiT7COB7jYXEeJAvxuWkY+PH79HX7VaeSIbIjyMLHzE/gtHIeQDVtLC+Rvatne0sSnLRdKEwFsdHRP37WvGgAF2dBd3Ho4mf2RnBTi2DOrVq06E/tifid6D8PeyOb1fvIXFBzMHLRNc9oSlw8hcq/a17NAlV7ANN0KOenol0NuAkwS6b2Vtxn+YyUtlCoimwI9BGIZ8YN3HxyXw88MPQOSBf4DJWWRXWqt2VR1BWJIF4ggvKtcysdlwYaz3nAVmPuHFYmS1CO443H1YnYzM2IRZDVsVUogmCjWK7fApuqx/Qb8Ef9EpZIPkBCiTu55P4J37caTsLsI6kTcUvVKlTAOrceVoS2CF2GUecI02G8YKYipxsQlsD4wDjxgS2Zbgm6ySC+8U4XKh5DmUdnGgGhUVszpZwydBZhfHx/2I0S1z3irvPFGRmSqTXmZDm5FVTe6ELOMmDNi6+SCege1bXfAvtKlmbbuu3VrztRLPHrzShHnOyDy/sJv4V66nR36jdPRKkUM+8Kgwsi78STmHRMsenoT4jAuTN2IE4ssoBCI+cfKQLZsPwm2KF1KgO2gR5TkNRBHVdJQzwnQeMuuegIh5wpgVHTnz85QqJXJH4CVwdTnz9k0gk9WF6Ykdri2rRVyFRLs+YlSvfXtPwAWHF5OxeaNFy9aNhe2lEHZoh5GRgeinxrL6z1aD/36R/KFBuiXJtkRbuygEukQJ8u7gQYBAw9ZhBRo9SLdjFy5fui08Z2wMaYUoMGIoeQKlBVrxmA/WcGBtQPRPR8gfGkGIkXChAw2NjGvjDzLBCWf9NRouUQTBEL/C8wk/su+rd7PnjmE1Gt46+OzwBm5KE9MynD118YIHqnV6Zt8BOyw3e6irk8eqyVL6DejM76ELfw57nampn0XzfPn8lckKU7MyzkunoP+BAOktjwcwo9AqwLgjfPoKEB0fvX7tXogglBcShp9QSGZXQtfQqUfAjZ9TXe1XLbClJihVhA0RJISPAkIDW9iwjD5719BIwzn+7VummTiia2Ww8b3v3//LCZc94quIDd66+QDF6OsbgBduHBvqUEjW48oLZO7+KKhjwgk76rJL5QKS8k6ybasL4j0w/FHJTU2NEBxGYlpqGkyTbyo2NYny8ygt0LBDCVOUhR0wVFImu6xxCj+GhaWpwi5kdkBPFi8E9148f42wzPv3H064XerVJ2Nc2ln3a/g7Z944YlzqOffrzC+mZMkSwe8/4lniRp6Kwlp58FGgzw5HB/FpYGAII42KFa3x6j/QCc8qov/w6V+74umYeTCWdKBTUGeYe5B+/v168dwXAq2m9tuWPLxy5Q7UuXGT2oOHduenI/QHgVYrkM2ZOGgmIdN4od8AUxSuOZywatXyooNeOFiTAk4q0U/ZYEkpaaPps01oaDjuOGzqJcum8mMYCGlCoNUK0MUp8xvZuaMPHrwQSfR6hr8VZPIEQ4wNN7G9SAJ0WkXH6mYJ4bhAnAQRpIwT+gUyst4lVA/dQEKd8eSwI0Z/qdBUqZrhQ78u9nshMU/+DVHi0WIVHEFFIhs6BM+fvWaygt+Jhs0IPz7ijUxGIZARM+kj3D/Ihp/jJxCtKTorjMAqzE3YC6vtQHrMf/zYbF0YvwDhy+7StVXNWhnjuAMCsmgdceNQsd8HfQjlDV7mYEdG/+rFTz7KmgeEIogIM54pJpvlQVFpsqNZJ9wufvwQwU9xPXQGwSW4pytW+lFBG8viSMePXSCCZjBANq7fN3XyksjIGEYZYOmMHf2329EL/MQvXzKU97ts6QnWQ4fHjz9LJePaXNzZN1KqLywRXLCy1wYcHKrCLoM5f+jgaX462oa9u4+tXb3H/cw1NgWKwMi81fzF0tBibVq/P8tvOeziPmHcAv4UIUYW+mcyxrf8171lh6bwZ/0ohp1gFhyUaR9xlOSF8zcZyaDc8EJrpCBPkSIZnQbpzfOPCwv+yE/0uveUnaykbIv75cvXeXPWzpi2PDwsip+empoRe2QXMFEMO6Bzx7bD6B3y0+/eeXzzRob7vn4De+ZXUrx4RiUnnr6UlE+nTl5mMmo4taDzG0q7OKCDZmZGqOWyiSrlIbjXr92LjMh45IYM68GNVWriWOfp01ewHJcs3lKhonXNWnawVp4+eXXn9kNGNk5LX8nOIOw7LS3N06euxMUl1KtfIzExGXJw5/YjfNSw8Y9x0DAn8fSuWrETIogrCfsY6eHxALUZuoBKLMUShJJCnadMG6rs5cGiGTaix4Z1+y6e93h4/zkCd9bWZeGygE2NBsPCwpQb7WRbzqJv/04H9p3cs+sofC/4XTHRcY8eeSNE1smpxcnMc/kIqtWodO7sjZ3bD0NiKtvZ4lJRCHDH8wsh4ytsLVAyZ05dKaWvC+d7TEwcMfSQADcI1//2beCOba4NG9WC4gcFhV4471FESxOHSyk3GJW40WiiNm6ZryBbufIWTx777Nxx2KlLy3fvglHIimch1qlbHb8OzTw8s6amZeLiEvF74XWBt0E4LCdLUCVQY08HXFm8cFO3Hm3gbgoKDH3yyBs+aIQrqlWvkOUZcBQuICAgeOL4haj/lSvb4ube9njAdjUGDu5CTL3JcWxsMwYvoeldv2Zvs5YNvn39htYLVU5D9typ2uorlJ9HaYEuwBQYM67fsiXb4PTEi02EAg4e2q2GfSV+zj8nDTqw/yTieHAX8qc1d+3emp2XrBQGBqXG/zkAAupx8z5/sAG0mBtLhCckOTnF+8Wb1St3sSmQDETPYNXC5spSaKB3eKEh4Q8ylQ56ylD2bVtdoR3up69x6fCYT5k+jJ+zeYueAo+yAAADfElEQVQGaOSuX78Hzy8bjm/QsGbP3u2vysqzsJy1OxjZkIPhI3tu3+p65vRVvNhE+LL79OsIseCyoXV89+49bDo8xmxKvXo1FLhHYXGPnzAA0SeoISv3TMYANWN4fuf+tUaKQHt7ZwzUdahTVWw08X8MHNQ1OmonQnzsOtcoBMUCbVelHKIL6DahPeMSEc2DDqJqCUO1WdKlWyvcHVgJaOS4RGNjg1Fj+mrKL3YO+JQQkd698yjsAH79h+tjsGBo+S9i3IQBWzYeRIuOF5uC0pg0dci0yUupPOc/lFiLA6brhLELdHWLr90wB//CRouIiIaRZWJaRoHrDa4P1Gb2W9TUCtStW4MY+sMuTyOMraGzDFXFY1PWwoRLRHwS6pya9hmPiqWlqZW1uTB2D7MIrgaYjegCQ/hwwezqSNxXEIslccDnAKu2VevGbMhRFOFiSQTwaeAKE2XLFTGyYbP29lkP4WLZvtUFpcqfpCe6WBL615CYr1+/ofAtrc1sbMqKng3l4O8X9D1j9l0ldhqLcLEkAkQFw8OjcPG6JXTYa4DByF/xh1gsiYNdgXrWnDHEokKiwNUOuw/mc7XqFdnfJVwsiQ9CedD0qMgY3Hf8WHQdUBXRPeLuArtYEvwhwnnnSMenSOevE/TGN+ClbOoHvhG1yFgw8Ab9woT4jFmp8sZlw4hGd5B9D+ukYaOarPeGQ7hYEge7WJJwySd5C2Phu9JSPxPxdsR1UQIJ8YnaxYqikuMxwa0prFkIfTU2A7FYEiWPooxAxybAAcoJdP5j04b9972eLXSeJHyocgHIIowgbkkdJu8A9/fwobOKaRfNrxWDQvldKNNJzO89KPhhYEzlgjoTYUxG1jPYteMw1Bku6bylzkxGHyjg65evjbM1M5NCoSggO1O98yuKA1w5BSzlKROdEeaCfwbeGz093ZfebzzvPIY6o8c9fGQvJq+BfrTq72JFoeRF6I4quc2nlFQoGvyw8M5zETlGNkxl2IieWS5+T6FQ/n9QwgfNyGJEGhoawv0jKMqCEGjGti+Boeoa6vBpWNuUFS5HR6FQ/s9RTqApFAqFkmvQqUcUCoWiolCBplAoFBWFCjSFQqGoKFSgKRQKRUWhAk2hUCgqChVoCoVCUVGoQFMoFIqKQgWaQqFQVBQq0BQKhaKiUIGmUCgUFYUKNIVCoago/wMAAP//Fjs/6wAAAAZJREFUAwBDyVlOW6C7+AAAAABJRU5ErkJggg==';
