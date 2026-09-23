/**
 * ============================================================
 * SISTEMA CLINICO DIGITAL VMC - Google Apps Script (Servidor)
 * ============================================================
 *
 * VERSAO 13.4 - CADASTRO DE PACIENTE PELO PROFISSIONAL
 *
 * Mudancas desta versao:
 *   - 13.4: Nova rota profCadastrarPaciente + funcao cadastrarPaciente()
 *   - Headers das 4 abas definidos como constantes (HEADERS_ANAMNESE etc)
 *   - 13.3.1: Nova rota profLerDadosPaciente (anamnese)
 *   - 13.3.2: + automonitoramento
 *   - 13.3.3: + escalas. lerDadosPaciente retorna tudo de uma vez
 *   - Funcoes admin: listar, cadastrar, atualizar, trocar senha e
 *     ativar/desativar profissionais
 *   - atualizarSchemaSistemaVMC: garante colunas extras na aba
 *     Profissionais (telefone, crp, data_inicio)
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
 * Funcoes principais (assinatura externa MANTIDA - frontend antigo
 * continua funcionando sem alteracao):
 *   1. autenticar(sigla, senha, tipo?) - valida login
 *      - tipo opcional: 'paciente' (default), 'profissional' ou 'admin'
 *   2. salvarAnamnese(sigla, dados) - salva anamnese
 *   3. salvarAutomonitoramento(sigla, dados) - salva registro
 *   4. lerHistorico(sigla) - retorna registros anteriores
 *   5. salvarEscala(sigla, dados) - salva aplicacao de escala
 *   6. lerEscalas(sigla) - retorna historico de escalas
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
var VERSAO_PACOTE = '17.0';

var SISTEMA_VMC_ID = '1B6DbaQ8pq1oRudP_7tWikGAFpzL5ldqG_N0u6HHzGI0';

// Nomes das abas da planilha global Sistema_VMC
var ABA_PROFISSIONAIS  = 'Profissionais';
var ABA_ADMINS         = 'Admins';
var ABA_INDICE_SIGLAS  = 'Indice_Siglas';
// Pacote 17.0: textos dos inventarios respondidos pelo paciente (BDI-II, BAI).
// Os enunciados NAO ficam no codigo - o repositorio e o site sao publicos.
// Uma linha por texto; colunas: instrumento, tipo, item, opcao, texto, ativo.
var ABA_ITENS_INSTRUMENTOS = 'Itens_Instrumentos';

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

// Versao atual do formulario
var VERSAO_FORMULARIO = 'v1';

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
  'pessoa_confianca_3_email'
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
  'editado', 'editado_por', 'editado_em'
];

var HEADERS_ESCALAS = [
  'timestamp', 'versao_formulario', 'data_aplicacao',
  'instrumento', 'versao_instrumento',
  'item_01', 'item_02', 'item_03', 'item_04', 'item_05',
  'item_06', 'item_07', 'item_08', 'item_09', 'item_10',
  'item_11', 'item_12', 'item_13', 'item_14', 'item_15',
  'item_16', 'item_17', 'item_18', 'item_19', 'item_20', 'item_21',
  'item_funcional', 'item_funcional_texto',
  'escore_total', 'escore_depressao', 'escore_ansiedade', 'escore_estresse',
  'faixa',
  'alerta_risco_flag', 'alerta_risco_item', 'alerta_risco_valor',
  'observacoes', 'tempo_preenchimento_seg'
];


// ============================================================
// ROTEADOR PRINCIPAL
// ============================================================

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var acao = payload.acao;

    var resposta;
    switch (acao) {
      case 'ping':
        resposta = { ok: true, versao_pacote: VERSAO_PACOTE, versao_formulario: VERSAO_FORMULARIO, versao: VERSAO_FORMULARIO, mensagem: 'Servidor respondendo (Pacote ' + VERSAO_PACOTE + ')' };
        break;

      case 'autenticar':
        // tipo e opcional: se ausente, assume 'paciente' (compatibilidade
        // com frontend pre-13.1 que ainda nao tem o seletor de tipo)
        resposta = autenticar(payload.sigla, payload.senha, payload.tipo);
        break;

      case 'salvarAnamnese':
        resposta = salvarAnamnese(payload.sigla, payload.dados);
        break;

      case 'salvarAutomonitoramento':
        resposta = salvarAutomonitoramento(payload.sigla, payload.dados);
        break;

      case 'lerHistorico':
        resposta = lerHistorico(payload.sigla);
        break;

      case 'salvarEscala':
        resposta = salvarEscala(payload.sigla, payload.dados);
        break;

      case 'lerEscalas':
        resposta = lerEscalas(payload.sigla);
        break;

      // Pacote 17.0 - textos dos inventarios (BDI-II, BAI). Exige sessao valida
      // (paciente ou profissional); sem 'instrumento' devolve so quais estao
      // liberados, para o menu decidir o que mostrar. Nao grava nada.
      case 'lerItensInstrumento':
        resposta = lerItensInstrumento(payload);
        break;

      // Pacote 13.4.1 - Acoes do paciente
      case 'alterarSenhaPaciente':
        resposta = alterarSenhaPaciente(payload.sigla, payload.senhaAtual, payload.novaSenha);
        break;

      case 'pacienteAtualizarAnamnese':
        resposta = pacienteAtualizarAnamnese(payload.sigla, payload.dados);
        break;

      // ============================================================
      // PACOTE 13.2 - ACOES DO PROFISSIONAL
      // ============================================================
      case 'profListarPacientes':
        resposta = listarPacientesDoProfissional(payload.profSigla, payload.profSenha);
        break;

      case 'profLerDadosPaciente':
        resposta = lerDadosPaciente(payload.profSigla, payload.profSenha, payload.siglaPaciente);
        break;

      // Pacote 13.4
      case 'profCadastrarPaciente':
        resposta = cadastrarPaciente(payload.profSigla, payload.profSenha, payload.dados);
        break;

      case 'profSalvarAnamnese':
        resposta = profSalvarAnamnese(payload.profSigla, payload.profSenha, payload.siglaPaciente, payload.dados);
        break;

      // Pacote 13.6 - Edição de automonitoramento
      case 'pacienteMarcarEditandoAuto':
        resposta = pacienteMarcarEditandoAuto(payload.sigla, payload.timestamp);
        break;

      case 'pacienteLimparEditandoAuto':
        resposta = pacienteLimparEditandoAuto(payload.sigla, payload.timestamp);
        break;

      case 'pacienteEditarAutomonitoramento':
        resposta = pacienteEditarAutomonitoramento(payload.sigla, payload.timestamp, payload.dados);
        break;

      case 'profMarcarEditandoAuto':
        resposta = profMarcarEditandoAuto(payload.profSigla, payload.profSenha, payload.siglaPaciente, payload.timestamp);
        break;

      case 'profLimparEditandoAuto':
        resposta = profLimparEditandoAuto(payload.profSigla, payload.profSenha, payload.siglaPaciente, payload.timestamp);
        break;

      case 'profEditarAutomonitoramento':
        resposta = profEditarAutomonitoramento(payload.profSigla, payload.profSenha, payload.siglaPaciente, payload.timestamp, payload.dados);
        break;

      // Pacote 13.6.2: leitura em tempo real do lock de presença
      case 'lerEditandoAuto':
        resposta = lerEditandoAuto(payload.sigla, payload.timestamp);
        break;

      // Pacote 13.5 - Desativar / Reativar / Excluir paciente
      case 'profDesativarPaciente':
        resposta = profDesativarPaciente(payload.profSigla, payload.profSenha, payload.siglaPaciente);
        break;

      case 'profReativarPaciente':
        resposta = profReativarPaciente(payload.profSigla, payload.profSenha, payload.siglaPaciente);
        break;

      case 'profExcluirPaciente':
        resposta = profExcluirPaciente(payload.profSigla, payload.profSenha, payload.siglaPaciente, payload.confirmacaoSigla);
        break;

      // Pacote 13.7 - Alterar senha do paciente pelo profissional
      case 'profAlterarSenhaPaciente':
        resposta = profAlterarSenhaPaciente(payload.profSigla, payload.profSenha, payload.sigla_paciente, payload.nova_senha);
        break;

      // ============================================================
      // PACOTE 13.1 - ACOES ADMIN (todas exigem adminSigla + adminSenha
      // que sao revalidadas em cada chamada)
      // ============================================================
      case 'admListarProfissionais':
        resposta = listarProfissionais(payload.adminSigla, payload.adminSenha);
        break;

      case 'admCadastrarProfissional':
        resposta = cadastrarProfissional(
          payload.adminSigla, payload.adminSenha, payload.dados
        );
        break;

      case 'admAtualizarProfissional':
        resposta = atualizarProfissional(
          payload.adminSigla, payload.adminSenha,
          payload.profissionalId, payload.mudancas
        );
        break;

      case 'admTrocarSenhaProfissional':
        resposta = trocarSenhaProfissional(
          payload.adminSigla, payload.adminSenha,
          payload.profissionalId, payload.novaSenha
        );
        break;

      case 'admDesativarProfissional':
        resposta = desativarProfissional(
          payload.adminSigla, payload.adminSenha, payload.profissionalId
        );
        break;

      case 'admReativarProfissional':
        resposta = reativarProfissional(
          payload.adminSigla, payload.adminSenha, payload.profissionalId
        );
        break;

      // ============================================================
      // PACOTE 14.1 - GRADE DE ATENDIMENTO (Modulo Consultorio Digital)
      // ============================================================
      case 'profLerGrade':
        resposta = lerGradeAtendimento(payload.profSigla, payload.profSenha);
        break;

      case 'profSalvarGrade':
        resposta = salvarGradeAtendimento(payload.profSigla, payload.profSenha, payload.config, payload.grade);
        break;

      default:
        resposta = { ok: false, erro: 'Acao desconhecida: ' + acao };
    }

    return ContentService
      .createTextOutput(JSON.stringify(resposta))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (erro) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: String(erro) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      mensagem: 'Sistema Clinico Digital VMC - Backend 13.4 (multi-tenant)',
      versao: VERSAO_FORMULARIO
    }))
    .setMimeType(ContentService.MimeType.JSON);
}


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

  var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_INDICE_SIGLAS);
  if (!aba) return null;

  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return null;

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
      return String(dados[i][idxProf]).trim();
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

  var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
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

  var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
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
  var prof = buscarProfissional(profissionalId);
  if (!prof || !prof.pasta_drive_id) return null;

  try {
    var pasta = DriveApp.getFolderById(prof.pasta_drive_id);
    var arquivos = pasta.getFilesByName(NOME_CONTROLE);
    if (!arquivos.hasNext()) return null;
    var arquivo = arquivos.next();
    return SpreadsheetApp.openById(arquivo.getId());
  } catch (e) {
    return null;
  }
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
      return obj;
    }
  }
  return null;
}


// ============================================================
// AUTENTICACAO
// ============================================================

/**
 * Valida o login. Suporta 3 tipos de usuario.
 *
 * Entrada:
 *   sigla - codigo do usuario
 *   senha - senha em texto puro
 *   tipo  - 'paciente' (default), 'profissional' ou 'admin'
 *
 * Saida (paciente):
 *   { ok: true, paciente: { sigla, anamnese_preenchida, data_anamnese } }
 * Saida (profissional):
 *   { ok: true, profissional: { profissional_id, sigla, nome_completo } }
 * Saida (admin):
 *   { ok: true, admin: { admin_id, sigla, nome_completo } }
 * Saida (erro): { ok: false, erro: "..." }
 */
function autenticar(sigla, senha, tipo) {
  if (!sigla || !senha) {
    return { ok: false, erro: 'Sigla e senha sao obrigatorias' };
  }

  // Default: paciente (compatibilidade com frontend pre-13.1)
  var tipoLimpo = String(tipo || 'paciente').trim().toLowerCase();

  if (tipoLimpo === 'admin') {
    return autenticarAdmin(sigla, senha);
  }
  if (tipoLimpo === 'profissional') {
    return autenticarProfissional(sigla, senha);
  }
  // Default: paciente
  return autenticarPaciente(sigla, senha);
}

function autenticarPaciente(sigla, senha) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) {
    return { ok: false, erro: 'Sigla ou senha incorretos' };
  }

  if (String(paciente.ativo).trim().toLowerCase() !== 'sim') {
    return { ok: false, erro: 'Paciente inativo' };
  }

  var hashDigitada = gerarHashSenha(senha);
  if (hashDigitada !== String(paciente.senha_hash).trim()) {
    return { ok: false, erro: 'Sigla ou senha incorretos' };
  }

  return {
    ok: true,
    paciente: {
      sigla: paciente.sigla,
      anamnese_preenchida: paciente.data_anamnese !== '' && paciente.data_anamnese !== null,
      data_anamnese: paciente.data_anamnese
    }
  };
}

function autenticarProfissional(sigla, senha) {
  var profissionalId = resolverProfissionalIdPorSigla(sigla, 'profissional');
  if (!profissionalId) {
    return { ok: false, erro: 'Sigla ou senha incorretos' };
  }

  var prof = buscarProfissional(profissionalId);
  if (!prof) {
    return { ok: false, erro: 'Sigla ou senha incorretos' };
  }

  if (String(prof.ativo).trim().toLowerCase() !== 'sim') {
    return { ok: false, erro: 'Profissional inativo' };
  }

  var hashDigitada = gerarHashSenha(senha);
  if (hashDigitada !== String(prof.senha_hash).trim()) {
    return { ok: false, erro: 'Sigla ou senha incorretos' };
  }

  return {
    ok: true,
    profissional: {
      profissional_id: prof.profissional_id,
      sigla: prof.sigla,
      nome_completo: prof.nome_completo,
      email: prof.email || ''
    }
  };
}

function autenticarAdmin(sigla, senha) {
  var adminId = resolverProfissionalIdPorSigla(sigla, 'admin');
  if (!adminId) {
    return { ok: false, erro: 'Sigla ou senha incorretos' };
  }

  var adm = buscarAdmin(adminId);
  if (!adm) {
    return { ok: false, erro: 'Sigla ou senha incorretos' };
  }

  if (String(adm.ativo).trim().toLowerCase() !== 'sim') {
    return { ok: false, erro: 'Admin inativo' };
  }

  var hashDigitada = gerarHashSenha(senha);
  if (hashDigitada !== String(adm.senha_hash).trim()) {
    return { ok: false, erro: 'Sigla ou senha incorretos' };
  }

  return {
    ok: true,
    admin: {
      admin_id: adm.admin_id,
      sigla: adm.sigla,
      nome_completo: adm.nome_completo
    }
  };
}

/**
 * Gera o hash SHA-256 de uma senha. Mesmo algoritmo que o Python
 * (hashlib.sha256).
 */
function gerarHashSenha(senha) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    senha,
    Utilities.Charset.UTF_8
  );
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    if (h.length === 1) h = '0' + h;
    hex += h;
  }
  return hex;
}


// ============================================================
// PACOTE 13.2 - AREA DO PROFISSIONAL
// ============================================================

/**
 * Lista todos os pacientes de um profissional.
 *
 * Revalida credenciais em cada chamada (licao 22).
 * Le a Controle do profissional e retorna dados basicos.
 * Para cada paciente com anamnese preenchida, tenta ler o nome
 * completo da aba Anamnese da planilha individual.
 *
 * Parametros:
 *   profSigla - sigla do profissional
 *   profSenha - senha em texto plano
 *
 * Retorna:
 *   { ok: true, pacientes: [ { sigla, nome_completo, data_cadastro,
 *     data_anamnese, ativo } ] }
 */
function listarPacientesDoProfissional(profSigla, profSenha) {
  // 1. Revalidar credenciais do profissional
  var authResult = autenticar(profSigla, profSenha, 'profissional');
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

  var cabecalhos = dados[0];
  var idxSigla = cabecalhos.indexOf('sigla');
  var idxLink = cabecalhos.indexOf('link_planilha_individual');
  var idxDataCad = cabecalhos.indexOf('data_cadastro');
  var idxDataAnam = cabecalhos.indexOf('data_anamnese');
  var idxAtivo = cabecalhos.indexOf('ativo');

  var lista = [];

  for (var i = 1; i < dados.length; i++) {
    var row = dados[i];
    var siglaPac = String(row[idxSigla] || '').trim();
    if (!siglaPac) continue; // Linha vazia

    var pacObj = {
      sigla: siglaPac,
      nome_completo: '',
      data_cadastro: idxDataCad >= 0 ? formatarDataParaExibicao_(row[idxDataCad]) : '',
      data_anamnese: idxDataAnam >= 0 ? formatarDataParaExibicao_(row[idxDataAnam]) : '',
      ativo: idxAtivo >= 0 ? String(row[idxAtivo] || '').trim() : 'Sim',
      // Pacote 13.2.3: indicadores clinicos (defaults seguros)
      ind_total_auto: 0,
      ind_ultimo_auto_data: '',
      ind_dias_desde_auto: null,
      ind_ultimo_humor: null,
      ind_ultima_escala_nome: '',
      ind_ultima_escala_faixa: '',
      ind_ultima_escala_data: '',
      ind_alertas: []
    };

    // 3. Tentar ler dados da planilha individual
    if (idxLink >= 0 && row[idxLink]) {
      try {
        var planilhaId = extrairIdDaUrl(String(row[idxLink]));
        if (planilhaId) {
          var planilha = SpreadsheetApp.openById(planilhaId);

          // 3a. Nome da Anamnese
          var abaAnam = planilha.getSheetByName(ABA_ANAMNESE);
          if (abaAnam && abaAnam.getLastRow() >= 2) {
            var cabAnam = abaAnam.getRange(1, 1, 1, abaAnam.getLastColumn()).getValues()[0];
            var idxNome = cabAnam.indexOf('nome_completo');
            if (idxNome >= 0) {
              var ultimaLinha = abaAnam.getLastRow();
              var nome = abaAnam.getRange(ultimaLinha, idxNome + 1).getValue();
              pacObj.nome_completo = String(nome || '').trim();
            }
          }

          // 3b. Pacote 13.2.3: Indicadores do Automonitoramento
          var abaAuto = planilha.getSheetByName(ABA_AUTOMONITORAMENTO);
          if (abaAuto && abaAuto.getLastRow() >= 2) {
            var totalAuto = abaAuto.getLastRow() - 1; // descontar cabecalho
            pacObj.ind_total_auto = totalAuto;
            var cabAuto = abaAuto.getRange(1, 1, 1, abaAuto.getLastColumn()).getValues()[0];
            var idxDataReg = cabAuto.indexOf('data_registro');
            var idxHumor = cabAuto.indexOf('humor_nivel');
            if (idxDataReg >= 0 || idxHumor >= 0) {
              var ultLinha = abaAuto.getRange(abaAuto.getLastRow(), 1, 1, abaAuto.getLastColumn()).getValues()[0];
              if (idxDataReg >= 0 && ultLinha[idxDataReg]) {
                var dataStr = formatarDataParaExibicao_(ultLinha[idxDataReg]);
                pacObj.ind_ultimo_auto_data = dataStr;
                // Calcular dias desde ultimo registro (datas civis)
                try {
                  var dUlt = (ultLinha[idxDataReg] instanceof Date) ? ultLinha[idxDataReg] : new Date(ultLinha[idxDataReg]);
                  if (!isNaN(dUlt.getTime())) {
                    var hoje = new Date();
                    var hojeCivil = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
                    var ultCivil = new Date(dUlt.getFullYear(), dUlt.getMonth(), dUlt.getDate());
                    pacObj.ind_dias_desde_auto = Math.round((hojeCivil - ultCivil) / 86400000);
                  }
                } catch(ed) {}
              }
              if (idxHumor >= 0 && ultLinha[idxHumor]) {
                pacObj.ind_ultimo_humor = parseInt(ultLinha[idxHumor], 10) || null;
              }
            }
          }

          // 3c. Pacote 13.2.3: Indicadores das Escalas
          var abaEsc = planilha.getSheetByName(ABA_ESCALAS);
          if (abaEsc && abaEsc.getLastRow() >= 2) {
            var cabEsc = abaEsc.getRange(1, 1, 1, abaEsc.getLastColumn()).getValues()[0];
            var idxInstr = cabEsc.indexOf('instrumento');
            var idxFaixa = cabEsc.indexOf('faixa');
            var idxDataApl = cabEsc.indexOf('data_aplicacao');
            var idxAlertaFlag = cabEsc.indexOf('alerta_risco_flag');
            var idxAlertaItem = cabEsc.indexOf('alerta_risco_item');
            var idxAlertaValor = cabEsc.indexOf('alerta_risco_valor');

            // Ultima escala aplicada
            var ultEsc = abaEsc.getRange(abaEsc.getLastRow(), 1, 1, abaEsc.getLastColumn()).getValues()[0];
            if (idxInstr >= 0) pacObj.ind_ultima_escala_nome = String(ultEsc[idxInstr] || '');
            if (idxFaixa >= 0) pacObj.ind_ultima_escala_faixa = String(ultEsc[idxFaixa] || '');
            if (idxDataApl >= 0) pacObj.ind_ultima_escala_data = formatarDataParaExibicao_(ultEsc[idxDataApl]);

            // Alertas criticos: varrer TODAS as escalas para encontrar o mais recente com flag
            if (idxAlertaFlag >= 0) {
              var dadosEsc = abaEsc.getDataRange().getValues();
              for (var e = dadosEsc.length - 1; e >= 1; e--) {
                var flagVal = String(dadosEsc[e][idxAlertaFlag] || '').trim().toLowerCase();
                if (flagVal === 'sim' || flagVal === 'true' || flagVal === '1') {
                  pacObj.ind_alertas.push({
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
        }
      } catch (e) {
        // Se nao conseguir abrir a planilha individual, segue sem indicadores
        Logger.log('listarPacientes: erro ao ler dados de ' + siglaPac + ': ' + e.message);
      }
    }

    lista.push(pacObj);
  }

  return { ok: true, pacientes: lista };
}

/**
 * Pacote 13.3.1: Le dados de um paciente para visualizacao pelo profissional.
 *
 * Seguranca:
 *   1. Revalida credenciais do profissional em cada chamada
 *   2. Verifica que o paciente pertence a este profissional (isolamento multi-tenant)
 *   3. Retorna dados read-only (anamnese por enquanto; futuramente auto + escalas)
 *
 * Parametros:
 *   profSigla      - sigla do profissional autenticado
 *   profSenha      - senha em texto plano
 *   siglaPaciente  - sigla do paciente a consultar
 *
 * Retorna:
 *   { ok: true, anamnese: { ... } | null, anamnese_preenchida: bool }
 */
function lerDadosPaciente(profSigla, profSenha, siglaPaciente) {
  // 1. Revalidar credenciais do profissional
  var authResult = autenticar(profSigla, profSenha, 'profissional');
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

  var planilha = SpreadsheetApp.openById(planilhaId);

  // 4. Ler anamnese (reuso de lerAbaComoObjetos)
  var anamnese = lerAbaComoObjetos(planilha, ABA_ANAMNESE);

  // 5. Pacote 13.3.2: Ler automonitoramento
  var automonitoramento = lerAbaComoObjetos(planilha, ABA_AUTOMONITORAMENTO);

  // 6. Pacote 13.3.3: Ler escalas
  var escalas = lerAbaComoObjetos(planilha, ABA_ESCALAS);

  return {
    ok: true,
    ativo: String(paciente.ativo || 'Sim').trim(), // Pacote 13.5
    anamnese_preenchida: anamnese.length > 0,
    anamnese: anamnese.length > 0 ? anamnese[0] : null,
    automonitoramento: automonitoramento,
    total_auto: automonitoramento.length,
    escalas: escalas,
    total_escalas: escalas.length
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

function salvarAnamnese(sigla, dados) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };

  var planilhaIndividualId = extrairIdDaUrl(paciente.link_planilha_individual);
  var planilha = SpreadsheetApp.openById(planilhaIndividualId);
  var aba = planilha.getSheetByName(ABA_ANAMNESE);

  var linha = montarLinha(aba, dados);
  aba.appendRow(linha);

  // Registra data de anamnese na Controle do profissional dono
  registrarDataAnamnese(sigla, paciente.__profissional_id);

  return { ok: true, mensagem: 'Anamnese salva com sucesso' };
}

function salvarAutomonitoramento(sigla, dados) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };

  var planilhaIndividualId = extrairIdDaUrl(paciente.link_planilha_individual);
  var planilha = SpreadsheetApp.openById(planilhaIndividualId);
  var aba = planilha.getSheetByName(ABA_AUTOMONITORAMENTO);

  var linha = montarLinha(aba, dados);
  aba.appendRow(linha);

  return { ok: true, mensagem: 'Registro salvo com sucesso' };
}

/**
 * Monta uma linha para insercao seguindo a ordem dos cabecalhos
 * da aba. Continua aditiva: campos ausentes viram vazios, novos
 * cabecalhos sao preenchidos automaticamente.
 */
function montarLinha(aba, dados) {
  var cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var agora = new Date();
  var linha = [];

  for (var i = 0; i < cabecalhos.length; i++) {
    var col = cabecalhos[i];
    if (col === 'timestamp') {
      linha.push(Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss'));
    } else if (col === 'versao_formulario') {
      linha.push(VERSAO_FORMULARIO);
    } else if (dados && dados[col] !== undefined && dados[col] !== null) {
      linha.push(dados[col]);
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
  var linha = _encontrarLinhaAuto_(planilhaId, timestamp);
  if (!linha) return { ok: true, editando_quem: '' }; // registro nao encontrado = sem lock
  var idx = linha.cabecalhos.indexOf('editando_quem');
  if (idx === -1) return { ok: true, editando_quem: '' };
  var aba = linha.aba;
  var val = aba.getRange(linha.rowIndex, idx + 1).getValue();
  return { ok: true, editando_quem: String(val || '').trim() };
}

function lerHistorico(sigla) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };

  var planilhaIndividualId = extrairIdDaUrl(paciente.link_planilha_individual);
  var planilha = SpreadsheetApp.openById(planilhaIndividualId);

  var registros = lerAbaComoObjetos(planilha, ABA_AUTOMONITORAMENTO);
  var anamnese = lerAbaComoObjetos(planilha, ABA_ANAMNESE);

  return {
    ok: true,
    anamnese_preenchida: anamnese.length > 0,
    anamnese: anamnese.length > 0 ? anamnese[0] : null,
    automonitoramento: registros,
    total_registros: registros.length
  };
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
    for (var j = 0; j < cabecalhos.length; j++) {
      var val = dados[i][j];
      // Pacote 13.7.6 — lição 22/62: Google Sheets serializa células TIME/DATE
      // como Date objects. Para hora_registro, o Sheets converte "20:35" (local)
      // para UTC internamente. Utilities.formatDate reconverte ao fuso correto.
      // Para campos de data, usamos toISOString para formato consistente YYYY-MM-DD.
      if (val instanceof Date) {
        var col = cabecalhos[j];
        if (col === 'hora_registro') {
          // TIME: o Sheets armazena "20:35" como UTC 23:35 (offset São Paulo).
          // Utilities.formatDate reconverte de volta ao fuso correto.
          val = Utilities.formatDate(val, 'America/Sao_Paulo', 'HH:mm');
        } else if (col === 'data_registro' || col === 'data_aplicacao' || col === 'data_anamnese') {
          // DATE: manter em YYYY-MM-DD usando UTC para evitar off-by-one
          val = val.toISOString().slice(0, 10);
        } else if (col === 'timestamp' || col === 'editando_desde' || col === 'editado_em') {
          // DATETIME: manter como ISO string completo
          val = val.toISOString();
        }
        // outros campos Date: deixar o JSON.stringify serializar normalmente
      }
      obj[cabecalhos[j]] = val;
    }
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
  var planilha = SpreadsheetApp.openById(planilhaIndividualId);
  var aba = planilha.getSheetByName(ABA_ESCALAS);

  if (!aba) {
    return {
      ok: false,
      erro: 'Aba "Escalas" nao encontrada na planilha individual. ' +
            'Rode criarAbaEscalas() no editor do Apps Script para criar a aba.'
    };
  }

  var linha = montarLinha(aba, dados);
  aba.appendRow(linha);

  return { ok: true, mensagem: 'Escala salva com sucesso' };
}

function lerEscalas(sigla) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };

  var planilhaIndividualId = extrairIdDaUrl(paciente.link_planilha_individual);
  var planilha = SpreadsheetApp.openById(planilhaIndividualId);

  var aba = planilha.getSheetByName(ABA_ESCALAS);
  if (!aba) {
    return { ok: true, total: 0, escalas: [] };
  }

  var registros = lerAbaComoObjetos(planilha, ABA_ESCALAS);
  return {
    ok: true,
    total: registros.length,
    escalas: registros
  };
}

/**
 * Utilitario para criar a aba "Escalas" nas planilhas individuais
 * de todos os pacientes ativos do PROFISSIONAL VINICIUS.
 *
 * No 13.0.2 a planilha VMC ja tem a aba Escalas (criada no Pacote
 * 12.2). Esta funcao continua existindo para uso futuro quando novos
 * pacientes forem cadastrados.
 *
 * IMPORTANTE: esta versao cria abas apenas nos pacientes do
 * profissional PROF_VMC. Quando o sistema crescer para multiplos
 * profissionais, sera generalizada para receber profissional_id.
 */
function criarAbaEscalas() {
  var PROF_PADRAO = 'PROF_VMC';
  var cabecalhos = [
    'timestamp', 'versao_formulario', 'data_aplicacao',
    'instrumento', 'versao_instrumento',
    'item_01', 'item_02', 'item_03', 'item_04', 'item_05',
    'item_06', 'item_07', 'item_08', 'item_09', 'item_10',
    'item_11', 'item_12', 'item_13', 'item_14', 'item_15',
    'item_16', 'item_17', 'item_18', 'item_19', 'item_20', 'item_21',
    'item_funcional', 'item_funcional_texto',
    'escore_total', 'escore_depressao', 'escore_ansiedade', 'escore_estresse',
    'faixa',
    'alerta_risco_flag', 'alerta_risco_item', 'alerta_risco_valor',
    'observacoes', 'tempo_preenchimento_seg'
  ];

  Logger.log('=== criarAbaEscalas() - profissional ' + PROF_PADRAO + ' ===');

  var controle = abrirControleDoProfissional(PROF_PADRAO);
  if (!controle) {
    Logger.log('ERRO: nao consegui abrir a Controle do profissional ' + PROF_PADRAO);
    return;
  }

  var abaCtrl = controle.getSheetByName(ABA_PACIENTES);
  var dados = abaCtrl.getDataRange().getValues();
  if (dados.length < 2) {
    Logger.log('Nenhum paciente cadastrado.');
    return;
  }

  var cabCtrl = dados[0];
  var idxSigla = cabCtrl.indexOf('sigla');
  var idxAtivo = cabCtrl.indexOf('ativo');
  var idxLink  = cabCtrl.indexOf('link_planilha_individual');

  var criadas = 0, puladas = 0, erros = 0;

  for (var i = 1; i < dados.length; i++) {
    var sigla = String(dados[i][idxSigla]).trim();
    var ativo = String(dados[i][idxAtivo]).trim().toLowerCase();
    var link  = String(dados[i][idxLink]).trim();
    if (!sigla) continue;
    if (ativo !== 'sim') {
      Logger.log('[' + sigla + '] paciente inativo - pulando');
      continue;
    }

    try {
      var pid = extrairIdDaUrl(link);
      if (!pid) {
        Logger.log('[' + sigla + '] link ausente - PULADO');
        erros++;
        continue;
      }
      var pInd = SpreadsheetApp.openById(pid);
      var existente = pInd.getSheetByName(ABA_ESCALAS);
      if (existente) {
        Logger.log('[' + sigla + '] aba ja existe - pulando');
        puladas++;
        continue;
      }
      var nova = pInd.insertSheet(ABA_ESCALAS);
      nova.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
      nova.setFrozenRows(1);
      nova.getRange(1, 1, 1, cabecalhos.length).setFontWeight('bold');
      Logger.log('[' + sigla + '] aba CRIADA');
      criadas++;
    } catch (e) {
      Logger.log('[' + sigla + '] ERRO: ' + String(e));
      erros++;
    }
  }

  Logger.log('=== Resumo: criadas=' + criadas + ' puladas=' + puladas + ' erros=' + erros + ' ===');
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

var INSTRUMENTOS_VALIDOS = ['bdi2', 'bai'];

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
 * Confere a sessao de quem pediu os textos.
 * Profissional: (profSigla, profSenha) revalidados a cada chamada, como nas
 * demais acoes prof*. Paciente: sigla existente e ativa na Controle do
 * profissional dono - mesmo nivel das demais acoes de paciente (lerHistorico,
 * lerEscalas). Sem nenhum dos dois, recusa.
 */
function _itensSessaoValida_(payload) {
  if (payload.profSigla && payload.profSenha) {
    var auth = autenticarProfissional(payload.profSigla, payload.profSenha);
    if (!auth || !auth.ok) return { ok: false, erro: 'Sessao invalida' };
    return { ok: true, quem: 'profissional' };
  }
  if (payload.sigla) {
    var pac = buscarPaciente(payload.sigla);
    if (!pac) return { ok: false, erro: 'Sessao invalida' };
    if (String(pac.ativo || 'Sim').trim().toLowerCase() !== 'sim') {
      return { ok: false, erro: 'Sessao invalida' };
    }
    return { ok: true, quem: 'paciente' };
  }
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
 * Entrada (paciente):     { sigla }                      [+ instrumento]
 * Entrada (profissional): { profSigla, profSenha }       [+ instrumento]
 *
 * Sem 'instrumento': { ok: true, liberados: ['bdi2'] } - so a lista, sem texto,
 *   para o menu decidir quais cartoes mostrar.
 * Com 'instrumento' liberado: { ok: true, instrumento, hash, textos: {...} }.
 * Com 'instrumento' nao liberado: { ok: false, erro, motivo } - sem texto.
 */
function lerItensInstrumento(payload) {
  payload = payload || {};
  var sessao = _itensSessaoValida_(payload);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  var sistema;
  try {
    sistema = SpreadsheetApp.openById(SISTEMA_VMC_ID);
  } catch (e) {
    return { ok: false, erro: 'Planilha do sistema indisponivel' };
  }
  var todas = lerAbaComoObjetos(sistema, ABA_ITENS_INSTRUMENTOS);

  var pedido = _itensNormalizar_(payload.instrumento).toLowerCase();

  // Sem instrumento: devolve so quais estao liberados (nenhum texto).
  if (!pedido) {
    var liberados = [];
    for (var i = 0; i < INSTRUMENTOS_VALIDOS.length; i++) {
      var cod = INSTRUMENTOS_VALIDOS[i];
      var est = _itensEstado_(_itensLinhasDoInstrumento_(todas, cod));
      if (est.liberado) liberados.push(cod);
    }
    return { ok: true, liberados: liberados };
  }

  if (INSTRUMENTOS_VALIDOS.indexOf(pedido) === -1) {
    return { ok: false, erro: 'Instrumento desconhecido' };
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
 * Valida senha atual, grava novo hash na Controle do profissional dono.
 */
function alterarSenhaPaciente(sigla, senhaAtual, novaSenha) {
  if (!sigla) return { ok: false, erro: 'Sigla obrigatoria' };
  if (!senhaAtual) return { ok: false, erro: 'Senha atual obrigatoria' };
  if (!novaSenha || novaSenha.length < 6) {
    return { ok: false, erro: 'Nova senha obrigatoria, minimo 6 caracteres' };
  }

  // 1. Validar credenciais atuais
  var authResult = autenticar(sigla, senhaAtual, 'paciente');
  if (!authResult.ok) {
    return { ok: false, erro: 'Senha atual incorreta' };
  }

  // 2. Localizar o paciente na Controle do profissional dono
  var profissionalId = resolverProfissionalIdPorSigla(sigla, 'paciente');
  if (!profissionalId) return { ok: false, erro: 'Paciente nao encontrado' };

  var controle = abrirControleDoProfissional(profissionalId);
  if (!controle) return { ok: false, erro: 'Controle do profissional nao encontrada' };

  var aba = controle.getSheetByName(ABA_PACIENTES);
  if (!aba) return { ok: false, erro: 'Aba Pacientes nao encontrada' };

  var dados = aba.getDataRange().getValues();
  var cabecalhos = dados[0];
  var idxSigla = cabecalhos.indexOf('sigla');
  var idxHash = cabecalhos.indexOf('senha_hash');

  if (idxSigla === -1 || idxHash === -1) {
    return { ok: false, erro: 'Estrutura da Controle invalida' };
  }

  // 3. Encontrar e atualizar
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxSigla]).trim().toUpperCase() === String(sigla).trim().toUpperCase()) {
      aba.getRange(i + 1, idxHash + 1).setValue(gerarHashSenha(novaSenha));
      return { ok: true, mensagem: 'Senha alterada com sucesso' };
    }
  }

  return { ok: false, erro: 'Paciente nao encontrado na Controle' };
}


/**
 * Paciente atualiza sua propria anamnese.
 *
 * Sobrescreve row 2 da aba Anamnese.
 * Segue o mesmo padrao de salvarAnamnese/salvarAutomonitoramento:
 * recebe apenas sigla (autenticacao ja foi feita no login).
 */
function pacienteAtualizarAnamnese(sigla, dados) {
  if (!sigla) return { ok: false, erro: 'Sigla obrigatoria' };
  if (!dados) return { ok: false, erro: 'Dados da anamnese ausentes' };

  // 1. Abrir planilha individual
  var paciente = buscarPaciente(sigla);
  if (!paciente || !paciente.link_planilha_individual) {
    return { ok: false, erro: 'Planilha do paciente nao encontrada' };
  }
  var planilhaId = extrairIdDaUrl(paciente.link_planilha_individual);
  if (!planilhaId) return { ok: false, erro: 'Link da planilha invalido' };

  var planilha = SpreadsheetApp.openById(planilhaId);
  var aba = planilha.getSheetByName(ABA_ANAMNESE);
  if (!aba) return { ok: false, erro: 'Aba Anamnese nao encontrada' };

  // 2. Montar linha e sobrescrever
  var cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var agora = new Date();
  var linha = [];
  for (var i = 0; i < cabecalhos.length; i++) {
    var col = cabecalhos[i];
    if (col === 'timestamp') {
      linha.push(Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss'));
    } else if (col === 'versao_formulario') {
      linha.push(VERSAO_FORMULARIO);
    } else if (dados[col] !== undefined && dados[col] !== null) {
      linha.push(dados[col]);
    } else {
      linha.push('');
    }
  }

  if (aba.getLastRow() >= 2) {
    aba.getRange(2, 1, 1, linha.length).setValues([linha]);
  } else {
    aba.appendRow(linha);
  }

  // 3. Atualizar data_anamnese na Controle
  var profissionalId = resolverProfissionalIdPorSigla(sigla, 'paciente');
  if (profissionalId) registrarDataAnamnese(sigla, profissionalId);

  return { ok: true, mensagem: 'Anamnese atualizada com sucesso' };
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
 *   - Linha na Controle do profissional
 *   - Linha no Indice_Siglas
 *
 * Seguranca:
 *   - Revalida credenciais do profissional em cada chamada
 *   - profissional_id derivado server-side (nunca do payload)
 *   - Unicidade da sigla verificada globalmente no Indice_Siglas
 *
 * Entrada: dados = { sigla, nomeCompleto, senhaInicial }
 */
function cadastrarPaciente(profSigla, profSenha, dados) {
  // 1. Revalidar credenciais do profissional
  var authResult = autenticar(profSigla, profSenha, 'profissional');
  if (!authResult.ok) {
    return authResult;
  }
  var profissionalId = authResult.profissional.profissional_id;

  // 2. Validar dados de entrada
  if (!dados) return { ok: false, erro: 'Dados do paciente ausentes' };

  var sigla = String(dados.sigla || '').trim().toUpperCase();
  var nome  = String(dados.nomeCompleto || '').trim();
  var senha = String(dados.senhaInicial || '');

  if (!sigla) return { ok: false, erro: 'Sigla obrigatoria' };
  if (!/^[A-Z0-9_]{2,10}$/.test(sigla)) {
    return { ok: false, erro: 'Sigla deve ter 2-10 caracteres (letras maiusculas, numeros, underline)' };
  }
  if (!nome) return { ok: false, erro: 'Nome completo obrigatorio' };
  if (!senha || senha.length < 6) {
    return { ok: false, erro: 'Senha obrigatoria, minimo 6 caracteres' };
  }

  // 3. Verificar unicidade da sigla (paciente) no Indice_Siglas
  var pacExistente = resolverProfissionalIdPorSigla(sigla, 'paciente');
  if (pacExistente) {
    return { ok: false, erro: 'Ja existe um paciente com a sigla "' + sigla + '"' };
  }

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

    var cabCtrl = abaCtrl.getRange(1, 1, 1, abaCtrl.getLastColumn()).getValues()[0];
    var linhaCtrl = [];
    for (var i = 0; i < cabCtrl.length; i++) {
      var col = cabCtrl[i];
      if      (col === 'sigla')                      linhaCtrl.push(sigla);
      else if (col === 'senha_hash')                 linhaCtrl.push(gerarHashSenha(senha));
      else if (col === 'link_planilha_individual')   linhaCtrl.push(linkPlanilha);
      else if (col === 'data_cadastro')              linhaCtrl.push(hoje);
      else if (col === 'data_anamnese')              linhaCtrl.push('');
      else if (col === 'ativo')                      linhaCtrl.push('Sim');
      else if (col === 'observacoes')                linhaCtrl.push('');
      else                                           linhaCtrl.push('');
    }
    abaCtrl.appendRow(linhaCtrl);

    // 8. Adicionar linha no Indice_Siglas
    var planilhaGlobal = SpreadsheetApp.openById(SISTEMA_VMC_ID);
    var abaIdx = planilhaGlobal.getSheetByName(ABA_INDICE_SIGLAS);
    abaIdx.appendRow([
      sigla + '|paciente|' + profissionalId,
      sigla,
      'paciente',
      profissionalId,
      hoje
    ]);

    return {
      ok: true,
      mensagem: 'Paciente cadastrado com sucesso',
      sigla: sigla
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
 * Pacote 13.4: Profissional salva/atualiza a anamnese de um paciente.
 *
 * Se ja existe anamnese (row 2), SOBRESCREVE.
 * Se nao existe, INSERE nova linha.
 *
 * Seguranca: revalida credenciais + verifica ownership multi-tenant.
 */
function profSalvarAnamnese(profSigla, profSenha, siglaPaciente, dados) {
  // 1. Revalidar credenciais
  var authResult = autenticar(profSigla, profSenha, 'profissional');
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  // 2. Validar ownership
  if (!siglaPaciente) return { ok: false, erro: 'Sigla do paciente e obrigatoria' };
  var profIdDono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!profIdDono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (profIdDono !== profissionalId) return { ok: false, erro: 'Este paciente nao pertence a voce' };

  if (!dados) return { ok: false, erro: 'Dados da anamnese ausentes' };

  // 3. Abrir planilha individual
  var paciente = buscarPaciente(siglaPaciente);
  if (!paciente || !paciente.link_planilha_individual) {
    return { ok: false, erro: 'Planilha do paciente nao encontrada' };
  }
  var planilhaId = extrairIdDaUrl(paciente.link_planilha_individual);
  if (!planilhaId) return { ok: false, erro: 'Link da planilha invalido' };

  var planilha = SpreadsheetApp.openById(planilhaId);
  var aba = planilha.getSheetByName(ABA_ANAMNESE);
  if (!aba) return { ok: false, erro: 'Aba Anamnese nao encontrada' };

  // 4. Montar linha usando headers existentes
  var cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var agora = new Date();
  var linha = [];
  for (var i = 0; i < cabecalhos.length; i++) {
    var col = cabecalhos[i];
    if (col === 'timestamp') {
      linha.push(Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss'));
    } else if (col === 'versao_formulario') {
      linha.push(VERSAO_FORMULARIO);
    } else if (dados[col] !== undefined && dados[col] !== null) {
      linha.push(dados[col]);
    } else {
      linha.push('');
    }
  }

  // 5. Sobrescrever row 2 se existe, senao append
  if (aba.getLastRow() >= 2) {
    aba.getRange(2, 1, 1, linha.length).setValues([linha]);
  } else {
    aba.appendRow(linha);
  }

  // 6. Atualizar data_anamnese na Controle
  registrarDataAnamnese(siglaPaciente, profissionalId);

  return { ok: true, mensagem: 'Anamnese salva com sucesso' };
}


// ============================================================
// PACOTE 13.1 - FUNCOES ADMIN
// ============================================================
// Todas as funcoes admin recebem (adminSigla, adminSenha) e revalidam
// essas credenciais antes de qualquer operacao. Isso garante que:
//   1. Apenas admins ativos podem chamar essas funcoes
//   2. A senha e verificada SERVER-SIDE em cada chamada
//   3. Nao confiamos em "ja autenticou antes" - cada chamada e isolada
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
  var planilha = SpreadsheetApp.openById(planilhaId);
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
      aba.getRange(rowIndex, idx + 1).setValue(campos[col]);
    }
  }
}

/**
 * Abre planilha do paciente dado o profissionalId e a sigla (via Controle).
 * Retorna o planilhaId ou null.
 */
function _obterPlanilhaIdPaciente_(sigla) {
  var pac = buscarPaciente(sigla);
  if (!pac || !pac.link_planilha_individual) return null;
  return extrairIdDaUrl(String(pac.link_planilha_individual));
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

function pacienteEditarAutomonitoramento(sigla, timestamp, dados) {
  if (!sigla || !timestamp || !dados) return { ok: false, erro: 'Parametros incompletos' };
  var pac = buscarPaciente(sigla);
  if (!pac) return { ok: false, erro: 'Paciente nao encontrado' };
  var planilhaId = extrairIdDaUrl(String(pac.link_planilha_individual || ''));
  if (!planilhaId) return { ok: false, erro: 'Planilha nao encontrada' };
  var linha = _encontrarLinhaAuto_(planilhaId, timestamp);
  if (!linha) return { ok: false, erro: 'Registro nao encontrado' };
  var agora = Utilities.formatDate(new Date(), 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss");
  // Mescla dados editados com metadados de auditoria
  var campos = {};
  for (var k in dados) {
    if (k !== 'timestamp' && k !== 'versao_formulario') campos[k] = dados[k];
  }
  campos.editando_quem  = '';
  campos.editando_desde = '';
  campos.editado        = 'Sim';
  campos.editado_por    = 'paciente';
  campos.editado_em     = agora;
  _atualizarCamposLinha_(linha.aba, linha.rowIndex, linha.cabecalhos, campos);
  return { ok: true, mensagem: 'Registro atualizado com sucesso', editado_em: agora };
}

// --- Profissional: marcar / limpar / salvar ---

function profMarcarEditandoAuto(profSigla, profSenha, siglaPaciente, timestamp) {
  var auth = autenticar(profSigla, profSenha, 'profissional');
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
  var quem = 'profissional:' + profSigla;
  _atualizarCamposLinha_(linha.aba, linha.rowIndex, linha.cabecalhos, {
    editando_quem:  quem,
    editando_desde: agora
  });
  return { ok: true, editando_quem: quem };
}

function profLimparEditandoAuto(profSigla, profSenha, siglaPaciente, timestamp) {
  var auth = autenticar(profSigla, profSenha, 'profissional');
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

function profEditarAutomonitoramento(profSigla, profSenha, siglaPaciente, timestamp, dados) {
  if (!siglaPaciente || !timestamp || !dados) return { ok: false, erro: 'Parametros incompletos' };
  var auth = autenticar(profSigla, profSenha, 'profissional');
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
  var campos = {};
  for (var k in dados) {
    if (k !== 'timestamp' && k !== 'versao_formulario') campos[k] = dados[k];
  }
  campos.editando_quem  = '';
  campos.editando_desde = '';
  campos.editado        = 'Sim';
  campos.editado_por    = 'profissional';
  campos.editado_em     = agora;
  _atualizarCamposLinha_(linha.aba, linha.rowIndex, linha.cabecalhos, campos);
  return { ok: true, mensagem: 'Registro atualizado com sucesso', editado_em: agora };
}


// ============================================================
// PACOTE 13.5 — DESATIVAR / REATIVAR / EXCLUIR PACIENTE
// ============================================================

/**
 * Desativa um paciente.
 * Marca ativo = Nao na Controle e move planilha para Pacientes_Desativados/.
 */
function profDesativarPaciente(profSigla, profSenha, siglaPaciente) {
  var authResult = autenticar(profSigla, profSenha, 'profissional');
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  if (!siglaPaciente) return { ok: false, erro: 'Sigla do paciente obrigatoria' };

  var profIdDono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!profIdDono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (profIdDono !== profissionalId) return { ok: false, erro: 'Este paciente nao pertence a voce' };

  var paciente = buscarPaciente(siglaPaciente);
  if (!paciente) return { ok: false, erro: 'Dados do paciente nao encontrados' };
  if (String(paciente.ativo || '').trim().toLowerCase() === 'nao') {
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

    return { ok: true, mensagem: 'Paciente desativado com sucesso' };
  } catch (e) {
    return { ok: false, erro: 'Erro ao desativar paciente: ' + String(e) };
  }
}

/**
 * Reativa um paciente.
 * Marca ativo = Sim na Controle e move planilha de volta para Pacientes/.
 */
function profReativarPaciente(profSigla, profSenha, siglaPaciente) {
  var authResult = autenticar(profSigla, profSenha, 'profissional');
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  if (!siglaPaciente) return { ok: false, erro: 'Sigla do paciente obrigatoria' };

  var profIdDono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!profIdDono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (profIdDono !== profissionalId) return { ok: false, erro: 'Este paciente nao pertence a voce' };

  var paciente = buscarPaciente(siglaPaciente);
  if (!paciente) return { ok: false, erro: 'Dados do paciente nao encontrados' };
  if (String(paciente.ativo || '').trim().toLowerCase() !== 'nao') {
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
function profExcluirPaciente(profSigla, profSenha, siglaPaciente, confirmacaoSigla) {
  var authResult = autenticar(profSigla, profSenha, 'profissional');
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  if (!siglaPaciente) return { ok: false, erro: 'Sigla do paciente obrigatoria' };

  // Validar confirmacao dupla
  if (String(confirmacaoSigla || '').trim().toUpperCase() !== String(siglaPaciente).trim().toUpperCase()) {
    return { ok: false, erro: 'Confirmacao incorreta. Digite exatamente a sigla do paciente.' };
  }

  var profIdDono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!profIdDono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (profIdDono !== profissionalId) return { ok: false, erro: 'Este paciente nao pertence a voce' };

  var paciente = buscarPaciente(siglaPaciente);
  if (!paciente) return { ok: false, erro: 'Dados do paciente nao encontrados' };

  // So permite excluir pacientes desativados
  if (String(paciente.ativo || '').trim().toLowerCase() !== 'nao') {
    return { ok: false, erro: 'So e possivel excluir pacientes desativados. Desative primeiro.' };
  }

  var planilhaId = extrairIdDaUrl(String(paciente.link_planilha_individual || ''));

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
    }

    // 3. Remover linha do Indice_Siglas
    var planilhaGlobal = SpreadsheetApp.openById(SISTEMA_VMC_ID);
    var abaIdx = planilhaGlobal.getSheetByName(ABA_INDICE_SIGLAS);
    if (abaIdx) {
      var dadosIdx = abaIdx.getDataRange().getValues();
      for (var k = dadosIdx.length - 1; k >= 0; k--) {
        var siglaCel = String(dadosIdx[k][1] || '').trim().toUpperCase();
        var tipoCel  = String(dadosIdx[k][2] || '').trim().toLowerCase();
        if (siglaCel === String(siglaPaciente).trim().toUpperCase() && tipoCel === 'paciente') {
          abaIdx.deleteRow(k + 1);
          break;
        }
      }
    }

    return { ok: true, mensagem: 'Paciente excluido permanentemente' };
  } catch (e) {
    return { ok: false, erro: 'Erro ao excluir paciente: ' + String(e) };
  }
}

/**
 * Pacote 13.7 — Altera a senha de um paciente pelo profissional responsável.
 * Não exige senha atual do paciente — o profissional tem autoridade.
 */
function profAlterarSenhaPaciente(profSigla, profSenha, siglaPaciente, novaSenha) {
  // 1. Autenticar profissional
  var authResult = autenticar(profSigla, profSenha, 'profissional');
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  // 2. Validar nova senha
  if (!novaSenha || String(novaSenha).length < 6) {
    return { ok: false, erro: 'Nova senha deve ter no minimo 6 caracteres.' };
  }

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

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxSigla]).trim().toUpperCase() === String(siglaPaciente).trim().toUpperCase()) {
      aba.getRange(i + 1, idxHash + 1).setValue(novoHash);
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
      return true;
    }
  }
  return false;
}


/**
 * Valida credenciais de admin. Retorna o objeto admin se OK, ou
 * null se invalido. Usado internamente por todas as acoes admin.
 */
function validarCredenciaisAdmin(adminSigla, adminSenha) {
  if (!adminSigla || !adminSenha) return null;

  var adminId = resolverProfissionalIdPorSigla(adminSigla, 'admin');
  if (!adminId) return null;

  var adm = buscarAdmin(adminId);
  if (!adm) return null;
  if (String(adm.ativo).trim().toLowerCase() !== 'sim') return null;

  var hash = gerarHashSenha(adminSenha);
  if (hash !== String(adm.senha_hash).trim()) return null;

  return adm;
}


/**
 * Garante que a aba Profissionais do Sistema_VMC tem todas as colunas
 * necessarias para o Pacote 13.1: telefone, crp, data_inicio.
 *
 * Idempotente: se as colunas ja existem, nao faz nada. Pode ser
 * chamada quantas vezes quiser.
 *
 * Esta funcao deve ser rodada UMA VEZ no editor do Apps Script apos
 * o deploy do Pacote 13.1.1.
 */
function atualizarSchemaSistemaVMC() {
  Logger.log('=== atualizarSchemaSistemaVMC ===');

  var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_PROFISSIONAIS);
  if (!aba) {
    Logger.log('ERRO: aba Profissionais nao encontrada.');
    return;
  }

  var cabecalhos = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getValues()[0];
  Logger.log('Cabecalhos atuais: ' + JSON.stringify(cabecalhos));

  var necessarias = ['telefone', 'crp', 'data_inicio'];
  var adicionadas = [];

  for (var i = 0; i < necessarias.length; i++) {
    var col = necessarias[i];
    if (cabecalhos.indexOf(col) === -1) {
      var novaPosicao = cabecalhos.length + 1;
      aba.getRange(1, novaPosicao).setValue(col);
      aba.getRange(1, novaPosicao).setFontWeight('bold');
      cabecalhos.push(col);
      adicionadas.push(col);
      Logger.log('Adicionada coluna "' + col + '" na posicao ' + novaPosicao);
    } else {
      Logger.log('Coluna "' + col + '" ja existe (posicao ' +
                 (cabecalhos.indexOf(col) + 1) + ')');
    }
  }

  Logger.log('=== Total adicionado: ' + adicionadas.length + ' ===');
}


/**
 * Lista todos os profissionais cadastrados no sistema.
 *
 * Retorna: { ok: true, total: N, profissionais: [...] }
 * Cada profissional inclui todos os campos EXCETO senha_hash.
 */
function listarProfissionais(adminSigla, adminSenha) {
  var adm = validarCredenciaisAdmin(adminSigla, adminSenha);
  if (!adm) return { ok: false, erro: 'Credenciais de admin invalidas' };

  var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
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
      obj[cabecalhos[j]] = dados[i][j];
    }
    lista.push(obj);
  }
  return { ok: true, total: lista.length, profissionais: lista };
}


/**
 * Cadastra um novo profissional. Cria automaticamente:
 *   - Pasta "Profissional_<SIGLA>" dentro de clinica-vmc/
 *   - Subpasta "Pacientes" dentro da pasta do profissional
 *   - Planilha "Clinica VMC - Controle" vazia com aba "Pacientes"
 *   - Linha em Sistema_VMC -> aba Profissionais
 *   - Linha em Sistema_VMC -> aba Indice_Siglas
 *
 * Entrada: dados = {
 *   sigla, senhaInicial, nomeCompleto, email,
 *   telefone, crp, dataInicio
 * }
 */
function cadastrarProfissional(adminSigla, adminSenha, dados) {
  var adm = validarCredenciaisAdmin(adminSigla, adminSenha);
  if (!adm) return { ok: false, erro: 'Credenciais de admin invalidas' };

  if (!dados) return { ok: false, erro: 'Dados do profissional ausentes' };

  var sigla = String(dados.sigla || '').trim().toUpperCase();
  var senha = String(dados.senhaInicial || '');
  var nome  = String(dados.nomeCompleto || '').trim();
  var email = String(dados.email || '').trim();
  var tel   = String(dados.telefone || '').trim();
  var crp   = String(dados.crp || '').trim();
  var dataInicio = String(dados.dataInicio || '').trim();

  if (!sigla) return { ok: false, erro: 'Sigla obrigatoria' };
  if (!/^[A-Z0-9_]{2,15}$/.test(sigla)) {
    return { ok: false, erro: 'Sigla deve ter 2-15 caracteres (letras maiusculas, numeros, underline)' };
  }
  if (!senha || senha.length < 6) {
    return { ok: false, erro: 'Senha obrigatoria, minimo 6 caracteres' };
  }
  if (!nome) return { ok: false, erro: 'Nome completo obrigatorio' };

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
      'data_cadastro', 'data_anamnese', 'ativo', 'observacoes'
    ];
    abaControle.getRange(1, 1, 1, cabecalhosControle.length).setValues([cabecalhosControle]);
    abaControle.setFrozenRows(1);
    abaControle.getRange(1, 1, 1, cabecalhosControle.length).setFontWeight('bold');

    var hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');

    var planilhaGlobal = SpreadsheetApp.openById(SISTEMA_VMC_ID);
    var abaProf = planilhaGlobal.getSheetByName(ABA_PROFISSIONAIS);
    var cabProf = abaProf.getRange(1, 1, 1, abaProf.getLastColumn()).getValues()[0];

    var linhaProf = [];
    for (var i = 0; i < cabProf.length; i++) {
      var col = cabProf[i];
      if      (col === 'profissional_id') linhaProf.push(profissionalId);
      else if (col === 'sigla')           linhaProf.push(sigla);
      else if (col === 'senha_hash')      linhaProf.push(gerarHashSenha(senha));
      else if (col === 'nome_completo')   linhaProf.push(nome);
      else if (col === 'email')           linhaProf.push(email);
      else if (col === 'pasta_drive_id')  linhaProf.push(pastaProfId);
      else if (col === 'data_cadastro')   linhaProf.push(hoje);
      else if (col === 'ativo')           linhaProf.push('sim');
      else if (col === 'telefone')        linhaProf.push(tel);
      else if (col === 'crp')             linhaProf.push(crp);
      else if (col === 'data_inicio')     linhaProf.push(dataInicio);
      else                                linhaProf.push('');
    }
    abaProf.appendRow(linhaProf);

    var abaIdx = planilhaGlobal.getSheetByName(ABA_INDICE_SIGLAS);
    abaIdx.appendRow([
      sigla + '|profissional|' + profissionalId,
      sigla,
      'profissional',
      profissionalId,
      hoje
    ]);

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
function atualizarProfissional(adminSigla, adminSenha, profissionalId, mudancas) {
  var adm = validarCredenciaisAdmin(adminSigla, adminSenha);
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

  var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_PROFISSIONAIS);
  if (!aba) return { ok: false, erro: 'Aba Profissionais nao encontrada' };

  var dados = aba.getDataRange().getValues();
  var cabecalhos = dados[0];
  var idxId = cabecalhos.indexOf('profissional_id');

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]).trim() === String(profissionalId).trim()) {
      var alteracoes = [];
      for (var chaveCli in mapaCampos) {
        if (mudancas[chaveCli] === undefined) continue;
        var nomeColuna = mapaCampos[chaveCli];
        var idxCol = cabecalhos.indexOf(nomeColuna);
        if (idxCol === -1) continue;
        aba.getRange(i + 1, idxCol + 1).setValue(String(mudancas[chaveCli]).trim());
        alteracoes.push(nomeColuna);
      }
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
 * Troca a senha do profissional. Senha nova precisa ter no minimo 6
 * caracteres.
 */
function trocarSenhaProfissional(adminSigla, adminSenha, profissionalId, novaSenha) {
  var adm = validarCredenciaisAdmin(adminSigla, adminSenha);
  if (!adm) return { ok: false, erro: 'Credenciais de admin invalidas' };

  if (!profissionalId) return { ok: false, erro: 'profissionalId obrigatorio' };
  if (!novaSenha || String(novaSenha).length < 6) {
    return { ok: false, erro: 'Senha nova invalida (minimo 6 caracteres)' };
  }

  var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_PROFISSIONAIS);
  var dados = aba.getDataRange().getValues();
  var cabecalhos = dados[0];
  var idxId = cabecalhos.indexOf('profissional_id');
  var idxSenha = cabecalhos.indexOf('senha_hash');

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]).trim() === String(profissionalId).trim()) {
      aba.getRange(i + 1, idxSenha + 1).setValue(gerarHashSenha(String(novaSenha)));
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
function desativarProfissional(adminSigla, adminSenha, profissionalId) {
  return _alterarStatusProfissional(adminSigla, adminSenha, profissionalId, 'nao');
}

function reativarProfissional(adminSigla, adminSenha, profissionalId) {
  return _alterarStatusProfissional(adminSigla, adminSenha, profissionalId, 'sim');
}

function _alterarStatusProfissional(adminSigla, adminSenha, profissionalId, novoStatus) {
  var adm = validarCredenciaisAdmin(adminSigla, adminSenha);
  if (!adm) return { ok: false, erro: 'Credenciais de admin invalidas' };

  if (!profissionalId) return { ok: false, erro: 'profissionalId obrigatorio' };

  var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_PROFISSIONAIS);
  var dados = aba.getDataRange().getValues();
  var cabecalhos = dados[0];
  var idxId = cabecalhos.indexOf('profissional_id');
  var idxAtivo = cabecalhos.indexOf('ativo');

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]).trim() === String(profissionalId).trim()) {
      aba.getRange(i + 1, idxAtivo + 1).setValue(novoStatus);
      return {
        ok: true,
        mensagem: novoStatus === 'sim' ? 'Profissional reativado' : 'Profissional desativado'
      };
    }
  }
  return { ok: false, erro: 'Profissional nao encontrado: ' + profissionalId };
}


// ============================================================
// TESTES INTERNOS (rodar manualmente no editor)
// ============================================================

/**
 * Teste de fumaca apos o redeploy do Pacote 13.0.2.
 * Roda este e olha o Logger para conferir.
 *
 * Como rodar: selecione "testarSetup" no menu superior do editor
 * e clique em "Executar".
 */
function testarSetup() {
  Logger.log('=== Teste Pacote 13.0.2 - multi-tenant ===');

  // Teste 1: hash conhecido
  var hash = gerarHashSenha('teste1');
  var hashEsperado = '15bf532d22345576b4a51b96da4754c039ef3458494066d76828e893d69ebd1e';
  Logger.log('Hash de "teste1": ' + hash);
  Logger.log('Hash correto?     ' + (hash === hashEsperado));

  // Teste 2: resolver sigla VMC paciente -> deve dar PROF_VMC
  var profId = resolverProfissionalIdPorSigla('VMC', 'paciente');
  Logger.log('VMC paciente -> profissional dono: ' + profId);

  // Teste 3: encontrar paciente VMC
  var paciente = buscarPaciente('VMC');
  Logger.log('Paciente VMC encontrado? ' + (paciente !== null));
  if (paciente) {
    Logger.log('  sigla: ' + paciente.sigla);
    Logger.log('  ativo: ' + paciente.ativo);
    Logger.log('  link:  ' + paciente.link_planilha_individual);
    Logger.log('  prof:  ' + paciente.__profissional_id);
  }

  // Teste 4: autenticar VMC paciente
  var resPac = autenticar('VMC', 'vinicius2026', 'paciente');
  Logger.log('Login VMC paciente / vinicius2026: ' + JSON.stringify(resPac));

  // Teste 5: autenticar VMC profissional
  var resProf = autenticar('VMC', 'V!N!C!U$-P$!', 'profissional');
  Logger.log('Login VMC profissional: ' + JSON.stringify(resProf));

  // Teste 6: autenticar admin
  var resAdm = autenticar('ADM_VMC', 'V!N!C!U$-@DM', 'admin');
  Logger.log('Login ADM_VMC admin: ' + JSON.stringify(resAdm));

  // Teste 7: compatibilidade com frontend antigo (sem tipo)
  var resCompat = autenticar('VMC', 'vinicius2026');
  Logger.log('Login VMC sem tipo (compatibilidade): ' + JSON.stringify(resCompat));

  // Teste 8: senha errada
  var resErr = autenticar('VMC', 'senhaErrada', 'paciente');
  Logger.log('Login VMC senha errada: ' + JSON.stringify(resErr));

  Logger.log('=== Fim dos testes ===');
}


/**
 * Teste das funcoes admin (Pacote 13.1.1).
 *
 * IMPORTANTE: este teste cadastra um profissional fake "TESTEPROF"
 * e o deixa cadastrado. Voce vai ver no Drive:
 *   - Pasta clinica-vmc/Profissional_TESTEPROF/
 *   - Subpasta Pacientes/
 *   - Planilha Clinica VMC - Controle (vazia)
 *
 * Depois de validar que esta tudo OK, voce pode apagar manualmente
 * (jogar a pasta na lixeira), e tambem remover a linha do TESTEPROF
 * das abas Profissionais e Indice_Siglas do Sistema_VMC.
 *
 * (No Pacote 13.1.2 vamos ter botao "Desativar" pela interface.)
 *
 * Como rodar: selecione "testarAdmin13_1_1" no dropdown e clique
 * em Executar.
 */
function testarAdmin13_1_1() {
  Logger.log('=== Teste Pacote 13.1.1 - Funcoes Admin ===');

  var admSigla = 'ADM_VMC';
  var admSenha = 'V!N!C!U$-@DM';

  // Teste 1: listarProfissionais com credenciais corretas
  Logger.log('--- Teste 1: listar profissionais ---');
  var r1 = listarProfissionais(admSigla, admSenha);
  Logger.log('Resultado: ' + JSON.stringify(r1));

  // Teste 2: listarProfissionais com senha errada
  Logger.log('--- Teste 2: listar com senha errada ---');
  var r2 = listarProfissionais(admSigla, 'senhaErrada');
  Logger.log('Resultado: ' + JSON.stringify(r2));

  // Teste 3: cadastrar profissional fake
  Logger.log('--- Teste 3: cadastrar TESTEPROF ---');
  var r3 = cadastrarProfissional(admSigla, admSenha, {
    sigla: 'TESTEPROF',
    senhaInicial: 'senha123',
    nomeCompleto: 'Profissional de Teste',
    email: 'teste@exemplo.com',
    telefone: '11999998888',
    crp: '06/123456',
    dataInicio: '2026-05-11'
  });
  Logger.log('Resultado: ' + JSON.stringify(r3));

  // Teste 4: tentar cadastrar de novo (deve falhar - sigla duplicada)
  Logger.log('--- Teste 4: cadastrar TESTEPROF novamente (deve falhar) ---');
  var r4 = cadastrarProfissional(admSigla, admSenha, {
    sigla: 'TESTEPROF',
    senhaInicial: 'senha456',
    nomeCompleto: 'Outro Teste'
  });
  Logger.log('Resultado: ' + JSON.stringify(r4));

  // Teste 5: atualizar nome
  Logger.log('--- Teste 5: atualizar nome do TESTEPROF ---');
  var r5 = atualizarProfissional(admSigla, admSenha, 'PROF_TESTEPROF', {
    nomeCompleto: 'Profissional de Teste ATUALIZADO',
    email: 'novo@exemplo.com'
  });
  Logger.log('Resultado: ' + JSON.stringify(r5));

  // Teste 6: trocar senha
  Logger.log('--- Teste 6: trocar senha do TESTEPROF ---');
  var r6 = trocarSenhaProfissional(admSigla, admSenha, 'PROF_TESTEPROF', 'novaSenha789');
  Logger.log('Resultado: ' + JSON.stringify(r6));

  // Teste 7: tentar logar como TESTEPROF com senha nova
  Logger.log('--- Teste 7: logar TESTEPROF com nova senha ---');
  var r7 = autenticar('TESTEPROF', 'novaSenha789', 'profissional');
  Logger.log('Resultado: ' + JSON.stringify(r7));

  // Teste 8: desativar
  Logger.log('--- Teste 8: desativar TESTEPROF ---');
  var r8 = desativarProfissional(admSigla, admSenha, 'PROF_TESTEPROF');
  Logger.log('Resultado: ' + JSON.stringify(r8));

  // Teste 9: tentar logar quando inativo (deve falhar)
  Logger.log('--- Teste 9: logar TESTEPROF inativo (deve falhar) ---');
  var r9 = autenticar('TESTEPROF', 'novaSenha789', 'profissional');
  Logger.log('Resultado: ' + JSON.stringify(r9));

  // Teste 10: reativar
  Logger.log('--- Teste 10: reativar TESTEPROF ---');
  var r10 = reativarProfissional(admSigla, admSenha, 'PROF_TESTEPROF');
  Logger.log('Resultado: ' + JSON.stringify(r10));

  // Teste 11: listar de novo (deve aparecer TESTEPROF)
  Logger.log('--- Teste 11: listar profissionais final ---');
  var r11 = listarProfissionais(admSigla, admSenha);
  Logger.log('Total: ' + r11.total);
  for (var i = 0; i < r11.profissionais.length; i++) {
    Logger.log('  ' + r11.profissionais[i].profissional_id + ' - ' +
               r11.profissionais[i].nome_completo + ' (' +
               r11.profissionais[i].ativo + ')');
  }

  Logger.log('=== Fim dos testes 13.1.1 ===');
  Logger.log('');
  Logger.log('ATENCAO: TESTEPROF foi cadastrado de verdade!');
  Logger.log('Confira no Drive:');
  Logger.log('  clinica-vmc/Profissional_TESTEPROF/');
  Logger.log('    Clinica VMC - Controle (vazia)');
  Logger.log('    Pacientes/');
  Logger.log('Apos validar, apague manualmente.');
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
 * Entrada: profSigla, profSenha (revalidados a cada chamada)
 * Saida: { ok:true, config:{...}, grade:[{dia_semana,hora_inicio,hora_fim,modalidade,ativo}] }
 * Se as abas ainda nao existem, retorna config padrao e grade vazia
 * (primeiro acesso) sem criar nada.
 */
function lerGradeAtendimento(profSigla, profSenha) {
  // 1. Revalidar credenciais (padrao consolidado do Pacote 13.2)
  var authResult = autenticar(profSigla, profSenha, 'profissional');
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

  return { ok: true, config: config, grade: grade };
}

/**
 * Salva a grade de atendimento do profissional.
 * Entrada:
 *   profSigla, profSenha - revalidados a cada chamada
 *   config - { duracao_slot_min, antecedencia_min_horas }
 *   grade  - [{dia_semana, hora_inicio, hora_fim, modalidade, ativo}]
 * Cria as abas Config_Agenda e Grade_Horarios automaticamente no
 * primeiro salvamento. A grade representa o estado ATUAL da
 * configuracao: as linhas de dados sao substituidas a cada save
 * (config nao e historico clinico; o principio aditivo se aplica
 * ao schema das colunas, que nunca muda).
 */
function salvarGradeAtendimento(profSigla, profSenha, config, grade) {
  // 1. Revalidar credenciais
  var authResult = autenticar(profSigla, profSenha, 'profissional');
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
  for (var chave in cfgGravar) {
    var valorTxt = String(cfgGravar[chave]);
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
        String(g.ativo || 'sim')
      ];
    });
    var destino = abaGrade.getRange(2, 1, linhas.length, 5);
    destino.setNumberFormat('@'); // garante texto puro mesmo em abas antigas
    destino.setValues(linhas);
  }

  return { ok: true, mensagem: 'Grade de atendimento salva.', total_janelas: grade.length };
}
