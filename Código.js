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
// Pacote E3 — backup diário e monitor do ping (só clasp push, sem deploy)
// Pacote 18.1 — acesso por e-mail, cracha de sessao, convite e redefinicao (01/10/2026)
var VERSAO_PACOTE = '18.1';

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

    // Pacote 18.1: toda acao fora de ACOES_PUBLICAS exige o cracha de sessao.
    // Sigla e profissional saem do cracha (payload.sigla e ignorado);
    // payload.siglaPaciente continua sendo o alvo das acoes do profissional,
    // conferido contra o dono em cada funcao.
    var s = null;
    if (ACOES_PUBLICAS.indexOf(acao) === -1) {
      s = _validarToken_(payload.token);
      if (!s) return _respostaJson_(_respostaSessaoExpirada_());
    }

    var resposta;
    switch (acao) {
      case 'ping':
        resposta = { ok: true, versao_pacote: VERSAO_PACOTE, versao_formulario: VERSAO_FORMULARIO, versao: VERSAO_FORMULARIO, url: _e3UrlDoServico_(), hora_servidor: _e3HoraServidor_(), mensagem: 'Servidor respondendo (Pacote ' + VERSAO_PACOTE + ')' };
        break;

      // Pacote 18.1 - acoes publicas (sem cracha)
      case 'autenticar':
        resposta = autenticar(payload.tipo, payload.email, payload.senha);
        break;

      case 'pedirRedefinicao':
        resposta = pedirRedefinicao(payload.tipo, payload.email);
        break;

      case 'definirSenha':
        resposta = definirSenha(payload.ativar, payload.senha);
        break;

      // Acoes do paciente (sigla do cracha)
      case 'salvarAnamnese':
        resposta = _exigir_(s, 'paciente') || salvarAnamnese(s.sigla, payload.dados);
        break;

      case 'salvarAutomonitoramento':
        resposta = _exigir_(s, 'paciente') || salvarAutomonitoramento(s.sigla, payload.dados);
        break;

      case 'lerHistorico':
        resposta = _exigir_(s, 'paciente') || lerHistorico(s.sigla);
        break;

      case 'salvarEscala':
        resposta = _exigir_(s, 'paciente') || salvarEscala(s.sigla, payload.dados);
        break;

      case 'lerEscalas':
        resposta = _exigir_(s, 'paciente') || lerEscalas(s.sigla);
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
        resposta = _exigir_(s, 'paciente') || pacienteAtualizarAnamnese(s.sigla, payload.dados);
        break;

      case 'pacienteMarcarEditandoAuto':
        resposta = _exigir_(s, 'paciente') || pacienteMarcarEditandoAuto(s.sigla, payload.timestamp);
        break;

      case 'pacienteLimparEditandoAuto':
        resposta = _exigir_(s, 'paciente') || pacienteLimparEditandoAuto(s.sigla, payload.timestamp);
        break;

      case 'pacienteEditarAutomonitoramento':
        resposta = _exigir_(s, 'paciente') || pacienteEditarAutomonitoramento(s.sigla, payload.timestamp, payload.dados);
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
        resposta = profSalvarAnamnese(s, payload.siglaPaciente, payload.dados, payload.contato);
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
        resposta = profEditarAutomonitoramento(s, payload.siglaPaciente, payload.timestamp, payload.dados);
        break;

      case 'profDesativarPaciente':
        resposta = profDesativarPaciente(s, payload.siglaPaciente);
        break;

      case 'profReativarPaciente':
        resposta = profReativarPaciente(s, payload.siglaPaciente);
        break;

      case 'profExcluirPaciente':
        resposta = profExcluirPaciente(s, payload.siglaPaciente, payload.confirmacaoSigla);
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

      default:
        resposta = { ok: false, erro: 'Acao desconhecida: ' + acao };
    }

    return _respostaJson_(resposta);

  } catch (erro) {
    return _respostaJson_({ ok: false, erro: String(erro) });
  }
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

var SITE_URL = 'https://viniciusmarinaccipsi-art.github.io/clinica-vmc/index.html';
var ACOES_PUBLICAS = ['ping', 'autenticar', 'pedirRedefinicao', 'definirSenha'];
var PERFIS = ['paciente', 'profissional', 'admin'];
var SESSAO_HORAS = 6;
var LINK_HORAS = 48;
// Iteracoes do hash v2. Calibracao: alvo de 200-400 ms por conferencia no
// Apps Script. Comecou em 5000 (18.1); medir com medirHashSenha() no editor
// depois da virada e ajustar aqui (hashes antigos guardam o proprio iter).
var ITER_SENHA = 5000;
var SENHA_MINIMA = 8;
var FALHAS_MAX = 5;            // 5 falhas por (perfil, e-mail) ...
var BLOQUEIO_SEG = 15 * 60;    // ... bloqueiam por 15 minutos
var EMAILS_DIA_MAX = 20;
var COLUNAS_TOKENS = ['token_hash', 'tipo', 'sigla', 'profissional_id', 'finalidade', 'expira', 'usado', 'criado_em'];

// Textos aprovados pelo usuario (PROMPT_18_1.md, 30/09/2026)
var MSG_SESSAO = 'Sua sessão expirou. Entre de novo para continuar.';
var MSG_LOGIN = 'E-mail ou senha incorretos.';
var MSG_BLOQUEIO = 'Muitas tentativas. Aguarde 15 minutos e tente de novo.';
var MSG_LINK = 'Este link não é mais válido. Peça um novo em "Esqueci a senha" ou fale com seu terapeuta.';
var MSG_REDEFINICAO = 'Se o e-mail estiver cadastrado, o link chegará em alguns minutos. Confira também a caixa de spam.';
var EMAIL_DESTAQUE = 'COGNIATIVO — Psicoterapia para além das sessões, com intervenções cognitivo-comportamentais no dia a dia.';
var EMAIL_ASSINATURA = ['Vinícius Marinacci Cardim', 'Psicólogo — CRP 06/165128'];
var EMAIL_FORMACAO = [
  'Mestrando em Saúde Mental e Psiquiatria — Faculdade de Ciências Médicas, UNICAMP',
  'Especialização em Terapia Cognitivo-Comportamental — PUC-RS',
  'Especialização em Neurociências e Comportamento — PUC-RS'
];

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

/** Hash v2: HMAC-SHA256 iterado, com a senha como chave e o sal como semente. */
function _hashSenha_(senha, salHex, iter) {
  var bloco = String(salHex);
  for (var i = 0; i < iter; i++) bloco = _hmacHex_(bloco, senha);
  return 'v2$' + salHex + '$' + iter + '$' + bloco;
}

function gerarHashSenhaV2(senha) {
  return _hashSenha_(senha, _aleatorioHex_(), ITER_SENHA);
}

/** Confere a senha contra o hash guardado. So aceita v2 (o v1 morreu na virada). */
function conferirSenha(senha, guardado) {
  var partes = String(guardado || '').split('$');
  if (partes.length !== 4 || partes[0] !== 'v2') return false;
  var iter = parseInt(partes[2], 10);
  if (!(iter > 0) || !senha) return false;
  return _iguaisTempoConstante_(_hashSenha_(String(senha), partes[1], iter), String(guardado));
}

/** Cracha de sessao: dados = {tipo, sigla, profissional_id}; agoraMs = Date.now(). */
function emitirToken(dados, segredo, agoraMs) {
  var expira = agoraMs + SESSAO_HORAS * 3600 * 1000;
  var corpo = _b64url_([dados.tipo, dados.sigla, dados.profissional_id, expira].join('|'));
  return corpo + '.' + _hmacHex_(corpo, segredo);
}

/** Le e confere a assinatura e a validade; devolve {tipo, sigla, profissional_id, expira} ou null. */
function lerToken(token, segredo, agoraMs) {
  if (!token || !segredo) return null;
  var partes = String(token).split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  if (!_iguaisTempoConstante_(_hmacHex_(partes[0], segredo), partes[1])) return null;
  var campos;
  try { campos = _deB64url_(partes[0]).split('|'); } catch (e) { return null; }
  if (campos.length !== 4) return null;
  var expira = parseInt(campos[3], 10);
  if (!(expira > agoraMs)) return null;
  if (PERFIS.indexOf(campos[0]) === -1 || !campos[1] || !campos[2]) return null;
  return { tipo: campos[0], sigla: campos[1], profissional_id: campos[2], expira: expira };
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

/** Corpo dos e-mails (texto puro e HTML simples), com os textos aprovados. */
function montarEmail(tipoEmail, nome, link) {
  var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  var convite = tipoEmail === 'convite';
  var assunto = convite ? 'Seu acesso ao COGNIATIVO' : 'Redefinir a sua senha no COGNIATIVO';
  var ola = convite ? 'Olá, ' + nome + '.' : 'Olá.';
  var paragrafo = convite
    ? 'Seu acesso ao COGNIATIVO, o sistema de acompanhamento que usamos entre as sessões, está pronto. Para criar a sua senha, abra este link (ele vale por 48 horas e só funciona uma vez):'
    : 'Recebemos um pedido para redefinir a sua senha no COGNIATIVO. Para criar uma senha nova, abra este link (vale por 48 horas e só funciona uma vez):';
  var aviso = convite
    ? 'Se você não esperava este e-mail, ignore-o. Nada será alterado.'
    : 'Se você não pediu isso, ignore este e-mail. Sua senha atual continua a mesma.';
  var texto = [EMAIL_DESTAQUE, '', ola, '', paragrafo, '', link, '', aviso, '']
    .concat(EMAIL_ASSINATURA).concat(EMAIL_FORMACAO).join('\n');
  var html = '<p><strong>' + esc(EMAIL_DESTAQUE) + '</strong></p>' +
    '<p>' + esc(ola) + '</p>' +
    '<p>' + esc(paragrafo) + '</p>' +
    '<p><a href="' + esc(link) + '">' + esc(link) + '</a></p>' +
    '<p>' + esc(aviso) + '</p>' +
    '<p>' + EMAIL_ASSINATURA.map(esc).join('<br>') + '<br>' +
    '<span style="font-size:12px">' + EMAIL_FORMACAO.map(esc).join('<br>') + '</span></p>';
  return { assunto: assunto, texto: texto, html: html };
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

// ---------- planilhas: colunas, indice e tokens ----------

/** Garante as colunas em `lista` no cabecalho da aba (aditivo); devolve o cabecalho. */
function _garantirColunas_(aba, lista) {
  var ultima = Math.max(aba.getLastColumn(), 1);
  var header = aba.getRange(1, 1, 1, ultima).getValues()[0];
  if (header.length === 1 && header[0] === '') header = [];
  lista.forEach(function (col) {
    if (header.indexOf(col) === -1) {
      header.push(col);
      aba.getRange(1, header.length).setValue(col).setFontWeight('bold');
    }
  });
  return header;
}

/** Grava uma linha nova pelo nome do cabecalho (campos ausentes ficam vazios). */
function _anexarPorCabecalho_(aba, header, valores) {
  aba.appendRow(header.map(function (col) { return valores[col] !== undefined ? valores[col] : ''; }));
}

function _abaIndice_() {
  var aba = SpreadsheetApp.openById(SISTEMA_VMC_ID).getSheetByName(ABA_INDICE_SIGLAS);
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

function _contaPorEmail_(tipo, email) {
  var idx = _lerIndice_();
  for (var i = 0; i < idx.linhas.length; i++) {
    var l = idx.linhas[i];
    if (l.tipo === tipo && l.email && l.email === email) return l;
  }
  return null;
}

/** Grava o e-mail de (sigla, tipo) no Indice. Recusa e-mail ja usado por outra conta do mesmo perfil. */
function _gravarEmailIndice_(sigla, tipo, email) {
  var idx = _lerIndice_();
  var alvo = null;
  for (var i = 0; i < idx.linhas.length; i++) {
    var l = idx.linhas[i];
    if (l.tipo !== tipo) continue;
    if (l.sigla === String(sigla).toUpperCase()) alvo = l;
    else if (email && l.email === email) return { ok: false, erro: 'Este e-mail já está em uso por outra conta.' };
  }
  if (!alvo) return { ok: false, erro: 'Conta não encontrada no índice.' };
  idx.aba.getRange(alvo.linha, idx.header.indexOf('email') + 1).setValue(email);
  return { ok: true };
}

/** Atualiza colunas de uma linha localizada por `chave` = valor (comparacao sem caixa). */
function _atualizarLinhaPorChave_(aba, colChave, valorChave, campos) {
  var header = _garantirColunas_(aba, Object.keys(campos));
  var dados = aba.getDataRange().getValues();
  var iChave = header.indexOf(colChave);
  if (iChave === -1) return false;
  var alvo = String(valorChave).trim().toUpperCase();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][iChave]).trim().toUpperCase() === alvo) {
      for (var col in campos) aba.getRange(i + 1, header.indexOf(col) + 1).setValue(campos[col]);
      return true;
    }
  }
  return false;
}

function _abaTokens_() {
  var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_TOKENS);
  if (!aba) aba = planilha.insertSheet(ABA_TOKENS);
  _garantirColunas_(aba, COLUNAS_TOKENS);
  return aba;
}

/** Gera um link de uso unico (48 h) para (tipo, sigla); invalida o anterior ainda nao usado. */
function _criarLinkAtivacao_(tipo, sigla, profissionalId, finalidade) {
  var aba = _abaTokens_();
  var dados = aba.getDataRange().getValues();
  var h = dados[0];
  var iT = h.indexOf('tipo'), iS = h.indexOf('sigla'), iU = h.indexOf('usado');
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][iT]) === tipo && String(dados[i][iS]).toUpperCase() === String(sigla).toUpperCase() && !String(dados[i][iU])) {
      aba.getRange(i + 1, iU + 1).setValue('substituido');
    }
  }
  var bruto = gerarTokenLink();
  var agora = new Date();
  _anexarPorCabecalho_(aba, h, {
    token_hash: _sha256Hex_(bruto), tipo: tipo, sigla: String(sigla).toUpperCase(),
    profissional_id: profissionalId, finalidade: finalidade,
    expira: new Date(agora.getTime() + LINK_HORAS * 3600 * 1000).toISOString(),
    usado: '', criado_em: agora.toISOString()
  });
  return SITE_URL + '?ativar=' + bruto;
}

/** Localiza o link pelo token bruto; devolve {linha, tipo, sigla, profissional_id} se valido. */
function _linkValido_(bruto) {
  if (!bruto) return null;
  var aba = _abaTokens_();
  var dados = aba.getDataRange().getValues();
  var h = dados[0];
  var alvo = _sha256Hex_(String(bruto));
  var iH = h.indexOf('token_hash'), iE = h.indexOf('expira'), iU = h.indexOf('usado');
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][iH]) !== alvo) continue;
    var expira = dados[i][iE] instanceof Date ? dados[i][iE].getTime() : Date.parse(String(dados[i][iE]));
    if (String(dados[i][iU]) || !(expira > Date.now())) return null;
    return {
      aba: aba, linha: i + 1, colUsado: iU + 1,
      tipo: String(dados[i][h.indexOf('tipo')]),
      sigla: String(dados[i][h.indexOf('sigla')]),
      profissional_id: String(dados[i][h.indexOf('profissional_id')])
    };
  }
  return null;
}

// ---------- contas: leitura do registro de cada perfil ----------

/** Registro da conta (tipo, sigla, profissional_id): {ativo, senha_hash, nome, email, extra} ou null. */
function _registroDaConta_(tipo, sigla, profissionalId) {
  if (tipo === 'paciente') {
    var pac = buscarPaciente(sigla);
    if (!pac || pac.__profissional_id !== profissionalId) return null;
    var dono = buscarProfissional(profissionalId);
    var ativoPac = String(pac.ativo || '').trim().toLowerCase() === 'sim' && !!dono && String(dono.ativo).trim().toLowerCase() === 'sim';
    return {
      ativo: ativoPac, senha_hash: pac.senha_hash, nome: pac.nome || '', email: normalizarEmail(pac.email),
      extra: { anamnese_preenchida: pac.data_anamnese !== '' && pac.data_anamnese !== null, data_anamnese: pac.data_anamnese }
    };
  }
  if (tipo === 'profissional') {
    var prof = buscarProfissional(profissionalId);
    if (!prof || String(prof.sigla).trim().toUpperCase() !== String(sigla).toUpperCase()) return null;
    return {
      ativo: String(prof.ativo).trim().toLowerCase() === 'sim', senha_hash: prof.senha_hash,
      nome: prof.nome_completo || '', email: normalizarEmail(prof.email),
      extra: { profissional_id: prof.profissional_id, nome_completo: prof.nome_completo }
    };
  }
  if (tipo === 'admin') {
    var adm = buscarAdmin(profissionalId);
    if (!adm || String(adm.sigla).trim().toUpperCase() !== String(sigla).toUpperCase()) return null;
    return {
      ativo: String(adm.ativo).trim().toLowerCase() === 'sim', senha_hash: adm.senha_hash,
      nome: adm.nome_completo || '', email: normalizarEmail(adm.email),
      extra: { admin_id: adm.admin_id, nome_completo: adm.nome_completo }
    };
  }
  return null;
}

/** Grava o hash v2 da senha na linha da conta. */
function _gravarSenhaDaConta_(tipo, sigla, profissionalId, senha) {
  var hash = gerarHashSenhaV2(senha);
  if (tipo === 'paciente') {
    var controle = abrirControleDoProfissional(profissionalId);
    if (!controle) return false;
    return _atualizarLinhaPorChave_(controle.getSheetByName(ABA_PACIENTES), 'sigla', sigla, { senha_hash: hash });
  }
  var global = SpreadsheetApp.openById(SISTEMA_VMC_ID);
  if (tipo === 'profissional') return _atualizarLinhaPorChave_(global.getSheetByName(ABA_PROFISSIONAIS), 'profissional_id', profissionalId, { senha_hash: hash });
  if (tipo === 'admin') return _atualizarLinhaPorChave_(global.getSheetByName(ABA_ADMINS), 'admin_id', profissionalId, { senha_hash: hash });
  return false;
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
  var dados = lerToken(token, _segredoSessao_(), Date.now());
  if (!dados) return null;
  var reg = _registroDaConta_(dados.tipo, dados.sigla, dados.profissional_id);
  if (!reg || !reg.ativo) return null;
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
function autenticar(tipo, email, senha) {
  var t = String(tipo || '').trim().toLowerCase();
  var e = normalizarEmail(email);
  if (PERFIS.indexOf(t) === -1 || !e || !senha) return { ok: false, erro: MSG_LOGIN };

  var cache = CacheService.getScriptCache();
  var chave = 'falha:' + t + ':' + e;
  var falhas = parseInt(cache.get(chave) || '0', 10);
  if (falhas >= FALHAS_MAX) return { ok: false, codigo: 'bloqueado', erro: MSG_BLOQUEIO };

  var conta = _contaPorEmail_(t, e);
  var reg = conta ? _registroDaConta_(t, conta.sigla, conta.profissional_id) : null;
  var confere = reg ? conferirSenha(senha, reg.senha_hash) : (_hashSenha_(String(senha), '0', ITER_SENHA) && false);
  if (!reg || !reg.ativo || !confere) {
    cache.put(chave, String(falhas + 1), BLOQUEIO_SEG);
    return { ok: false, erro: MSG_LOGIN };
  }
  cache.remove(chave);

  var segredo = _segredoSessao_();
  if (!segredo) return { ok: false, erro: 'Servidor sem segredo de sessão: rode bootstrapAcesso18_1 no editor.' };
  var perfil = { tipo: t, sigla: conta.sigla, nome: reg.nome, email: e };
  for (var k in reg.extra) perfil[k] = reg.extra[k];
  return {
    ok: true,
    token: emitirToken({ tipo: t, sigla: conta.sigla, profissional_id: conta.profissional_id }, segredo, Date.now()),
    perfil: perfil
  };
}

/** Pede um link de redefinicao. Resposta identica exista ou nao o e-mail. */
function pedirRedefinicao(tipo, email) {
  var resposta = { ok: true, mensagem: MSG_REDEFINICAO };
  var t = String(tipo || '').trim().toLowerCase();
  var e = normalizarEmail(email);
  if (PERFIS.indexOf(t) === -1 || !emailValido(e)) return resposta;
  var conta = _contaPorEmail_(t, e);
  if (!conta) return resposta;
  var reg = _registroDaConta_(t, conta.sigla, conta.profissional_id);
  if (!reg || !reg.ativo) return resposta;
  var link = _criarLinkAtivacao_(t, conta.sigla, conta.profissional_id, 'redefinicao');
  _enviarEmail_(e, montarEmail('redefinicao', '', link));
  return resposta;
}

/**
 * Cria a senha a partir do link (?ativar=<token>).
 * Sem `senha`: so confere o link e devolve {ok, tipo, email} (tela "Crie sua senha").
 * Com `senha`: grava o hash v2, marca o link como usado e devolve {ok, tipo, email}.
 */
function definirSenha(ativar, senha) {
  var link = _linkValido_(ativar);
  if (!link) return { ok: false, codigo: 'link_invalido', erro: MSG_LINK };
  var reg = _registroDaConta_(link.tipo, link.sigla, link.profissional_id);
  if (!reg || !reg.ativo || !reg.email) return { ok: false, codigo: 'link_invalido', erro: MSG_LINK };
  if (senha === undefined || senha === null || senha === '') return { ok: true, tipo: link.tipo, email: reg.email };
  if (String(senha).length < SENHA_MINIMA) return { ok: false, erro: 'Escolha uma senha com pelo menos 8 caracteres.' };
  if (!_gravarSenhaDaConta_(link.tipo, link.sigla, link.profissional_id, String(senha))) {
    return { ok: false, erro: 'Não foi possível gravar a senha. Tente de novo.' };
  }
  link.aba.getRange(link.linha, link.colUsado).setValue(new Date().toISOString());
  CacheService.getScriptCache().remove('falha:' + link.tipo + ':' + reg.email);
  return { ok: true, tipo: link.tipo, email: reg.email };
}

// ---------- convites ----------

/** Envia um e-mail do COGNIATIVO respeitando o limite diario. Devolve true se enviou. */
function _enviarEmail_(para, email) {
  var props = PropertiesService.getScriptProperties();
  var chave = 'emails:' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
  var enviados = parseInt(props.getProperty(chave) || '0', 10);
  if (enviados >= EMAILS_DIA_MAX) return false;
  MailApp.sendEmail({ to: para, subject: email.assunto, body: email.texto, htmlBody: email.html, name: 'COGNIATIVO' });
  props.setProperty(chave, String(enviados + 1));
  return true;
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
  return { ok: true, email: c.email, telefone: c.telefone };
}

/** Nome do paciente para o convite: anamnese, senao o nome do cadastro. */
function _nomeDoPaciente_(paciente) {
  try {
    var anam = lerAbaComoObjetos(SpreadsheetApp.openById(extrairIdDaUrl(paciente.link_planilha_individual)), ABA_ANAMNESE);
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
  if (String(pac.ativo || '').trim().toLowerCase() !== 'sim') return { ok: false, erro: 'Paciente desativado.' };
  var email = normalizarEmail(pac.email);
  if (!email) return { ok: false, erro: 'Cadastre o e-mail do paciente antes do convite.' };
  var link = _criarLinkAtivacao_('paciente', pac.sigla, s.profissional_id, 'convite');
  var enviado = false;
  if (canal === 'email') {
    enviado = _enviarEmail_(email, montarEmail('convite', primeiroNome(_nomeDoPaciente_(pac)), link));
    if (!enviado) return { ok: false, erro: 'Limite diário de e-mails atingido. Use o botão WhatsApp ou tente amanhã.', link: link };
  }
  return { ok: true, link: link, email: email, telefone: normalizarTelefone(pac.telefone), enviado: enviado };
}

/** Convite do profissional pelo admin. canal = 'email' | 'link'. Saida: { ok, link, enviado }. */
function admEnviarConvite(s, profissionalId, canal) {
  var adm = _admDaSessao_(s);
  if (!adm) return _respostaSessaoExpirada_();
  var prof = buscarProfissional(profissionalId);
  if (!prof) return { ok: false, erro: 'Profissional nao encontrado: ' + profissionalId };
  if (String(prof.ativo).trim().toLowerCase() !== 'sim') return { ok: false, erro: 'Profissional desativado.' };
  var email = normalizarEmail(prof.email);
  if (!emailValido(email)) return { ok: false, erro: 'Cadastre o e-mail do profissional antes do convite.' };
  var idx = _gravarEmailIndice_(prof.sigla, 'profissional', email);
  if (!idx.ok) return idx;
  var link = _criarLinkAtivacao_('profissional', String(prof.sigla).toUpperCase(), prof.profissional_id, 'convite');
  var enviado = false;
  if (canal === 'email') {
    enviado = _enviarEmail_(email, montarEmail('convite', primeiroNome(prof.nome_completo), link));
    if (!enviado) return { ok: false, erro: 'Limite diário de e-mails atingido. Use o botão WhatsApp ou tente amanhã.', link: link };
  }
  return { ok: true, link: link, enviado: enviado };
}

// ---------- editor do Apps Script (uso do usuario) ----------

/**
 * Uso unico, no editor, logo depois do deploy do 18.1 (apagada no 18.2):
 * grava o segredo do cracha (se nao existir), os e-mails do admin ADM_VMC e
 * do profissional VMC (Admins, Profissionais e Indice_Siglas) e escreve no
 * Logger os dois links de ativacao. Nenhuma senha passa por aqui.
 */
function bootstrapAcesso18_1(emailAdmin, emailProf) {
  var ea = normalizarEmail(emailAdmin), ep = normalizarEmail(emailProf);
  if (!emailValido(ea) || !emailValido(ep)) throw new Error('Informe os dois e-mails: bootstrapAcesso18_1("admin@...", "prof@...")');
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SEGREDO_SESSAO')) {
    props.setProperty('SEGREDO_SESSAO', Utilities.getUuid() + Utilities.getUuid());
    Logger.log('Segredo de sessao criado.');
  }
  var global = SpreadsheetApp.openById(SISTEMA_VMC_ID);
  if (!_atualizarLinhaPorChave_(global.getSheetByName(ABA_ADMINS), 'admin_id', 'ADM_VMC', { email: ea })) throw new Error('ADM_VMC nao encontrado na aba Admins');
  if (!_atualizarLinhaPorChave_(global.getSheetByName(ABA_PROFISSIONAIS), 'profissional_id', 'PROF_VMC', { email: ep })) throw new Error('PROF_VMC nao encontrado na aba Profissionais');
  var r1 = _gravarEmailIndice_('ADM_VMC', 'admin', ea);
  var r2 = _gravarEmailIndice_('VMC', 'profissional', ep);
  if (!r1.ok || !r2.ok) throw new Error('Indice_Siglas: ' + (r1.erro || r2.erro));
  Logger.log('Link do admin (48 h, uso unico): ' + _criarLinkAtivacao_('admin', 'ADM_VMC', 'ADM_VMC', 'convite'));
  Logger.log('Link do profissional (48 h, uso unico): ' + _criarLinkAtivacao_('profissional', 'VMC', 'PROF_VMC', 'convite'));
}

/** Calibracao do ITER_SENHA (alvo 200-400 ms): rodar no editor e ler o Logger. */
function medirHashSenha() {
  var t0 = Date.now();
  _hashSenha_('medicao-sem-uso', _aleatorioHex_(), ITER_SENHA);
  Logger.log('ITER_SENHA=' + ITER_SENHA + ': ' + (Date.now() - t0) + ' ms');
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

  var cabecalhos = dados[0];
  var idxSigla = cabecalhos.indexOf('sigla');
  var idxLink = cabecalhos.indexOf('link_planilha_individual');
  var idxDataCad = cabecalhos.indexOf('data_cadastro');
  var idxDataAnam = cabecalhos.indexOf('data_anamnese');
  var idxAtivo = cabecalhos.indexOf('ativo');
  var idxNomeCad = cabecalhos.indexOf('nome'); // Pacote 18.1: nome do cadastro

  var lista = [];

  for (var i = 1; i < dados.length; i++) {
    var row = dados[i];
    var siglaPac = String(row[idxSigla] || '').trim();
    if (!siglaPac) continue; // Linha vazia

    var pacObj = {
      sigla: siglaPac,
      nome_completo: idxNomeCad >= 0 ? String(row[idxNomeCad] || '').trim() : '',
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
              if (String(nome || '').trim()) pacObj.nome_completo = String(nome).trim();
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
    total_escalas: escalas.length,
    // Pacote 18.1: contato do cadastro (Controle), unica fonte de e-mail e telefone
    contato: { email: normalizarEmail(paciente.email), telefone: normalizarTelefone(paciente.telefone) },
    nome_cadastro: String(paciente.nome || '')
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

function salvarAnamnese(sigla, dados) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };

  var planilhaIndividualId = extrairIdDaUrl(paciente.link_planilha_individual);
  var planilha = SpreadsheetApp.openById(planilhaIndividualId);
  var aba = planilha.getSheetByName(ABA_ANAMNESE);

  dados = _espelharContatoAnamnese_(aba, dados, paciente);
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
      erro: 'Aba "Escalas" nao encontrada na planilha individual.'
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
 * Sigla do cracha; confere a senha atual (hash v2) e grava o novo hash v2
 * na Controle do profissional dono.
 */
function alterarSenhaPaciente(sigla, senhaAtual, novaSenha) {
  if (!sigla) return { ok: false, erro: 'Sigla obrigatoria' };
  if (!senhaAtual) return { ok: false, erro: 'Senha atual obrigatoria' };
  if (!novaSenha || String(novaSenha).length < SENHA_MINIMA) {
    return { ok: false, erro: 'Escolha uma senha com pelo menos 8 caracteres.' };
  }
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };
  if (!conferirSenha(senhaAtual, paciente.senha_hash)) return { ok: false, erro: 'Senha atual incorreta' };
  if (!_gravarSenhaDaConta_('paciente', paciente.sigla, paciente.__profissional_id, String(novaSenha))) {
    return { ok: false, erro: 'Paciente nao encontrado na Controle' };
  }
  return { ok: true, mensagem: 'Senha alterada com sucesso' };
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

  // 2. Montar linha e sobrescrever (e-mail e telefone espelham o cadastro)
  dados = _espelharContatoAnamnese_(aba, dados, paciente);
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
 *   - Linha na Controle do profissional (sem senha: o acesso nasce no convite)
 *   - Linha no Indice_Siglas (com o e-mail)
 *   - Link de convite (canal 'link'), devolvido para o WhatsApp
 *
 * Seguranca:
 *   - Profissional do cracha de sessao
 *   - profissional_id derivado server-side (nunca do payload)
 *   - Sigla gerada pelo servidor (gerarSiglaPaciente), unica no Indice_Siglas
 *   - E-mail unico entre os pacientes (conta = perfil + e-mail)
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

  // 3. Unicidade do e-mail e sigla gerada (Indice_Siglas)
  var indice = _lerIndice_().linhas;
  var siglasPac = [];
  for (var n = 0; n < indice.length; n++) {
    if (indice[n].tipo !== 'paciente') continue;
    if (indice[n].email === contato.email) return { ok: false, erro: 'Este e-mail já está em uso por outra conta.' };
    siglasPac.push(indice[n].sigla);
  }
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
    var cabCtrl = _garantirColunas_(abaCtrl, ['email', 'telefone', 'nome']);
    _anexarPorCabecalho_(abaCtrl, cabCtrl, {
      sigla: sigla, senha_hash: '', link_planilha_individual: linkPlanilha,
      data_cadastro: hoje, data_anamnese: '', ativo: 'Sim', observacoes: '',
      email: contato.email, telefone: contato.telefone, nome: nome
    });

    // 8. Adicionar linha no Indice_Siglas (por nome de cabecalho, com o e-mail)
    _anexarIndice_(sigla, 'paciente', profissionalId, contato.email);

    // 9. Link de convite (canal 'link'): o profissional envia por e-mail ou WhatsApp
    var link = _criarLinkAtivacao_('paciente', sigla, profissionalId, 'convite');

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
 * Pacote 13.4: Profissional salva/atualiza a anamnese de um paciente.
 *
 * Se ja existe anamnese (row 2), SOBRESCREVE.
 * Se nao existe, INSERE nova linha.
 *
 * Seguranca: profissional do cracha + verifica ownership multi-tenant.
 * Pacote 18.1: contato (opcional) = {email, telefone} grava o cadastro
 * (Controle) antes; sem ele, a Controle nao muda. E-mail e telefone da
 * Anamnese espelham o cadastro.
 */
function profSalvarAnamnese(s, siglaPaciente, dados, contato) {
  // 1. Revalidar credenciais
  var authResult = _authProfissional_(s);
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  // 2. Validar ownership
  if (!siglaPaciente) return { ok: false, erro: 'Sigla do paciente e obrigatoria' };
  var profIdDono = resolverProfissionalIdPorSigla(siglaPaciente, 'paciente');
  if (!profIdDono) return { ok: false, erro: 'Paciente nao encontrado' };
  if (profIdDono !== profissionalId) return { ok: false, erro: 'Este paciente nao pertence a voce' };

  if (!dados) return { ok: false, erro: 'Dados da anamnese ausentes' };

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

  var planilha = SpreadsheetApp.openById(planilhaId);
  var aba = planilha.getSheetByName(ABA_ANAMNESE);
  if (!aba) return { ok: false, erro: 'Aba Anamnese nao encontrada' };

  // 4. Montar linha usando headers existentes (e-mail e telefone espelham o cadastro)
  dados = _espelharContatoAnamnese_(aba, dados, paciente);
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

function profEditarAutomonitoramento(s, siglaPaciente, timestamp, dados) {
  if (!siglaPaciente || !timestamp || !dados) return { ok: false, erro: 'Parametros incompletos' };
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
function profExcluirPaciente(s, siglaPaciente, confirmacaoSigla) {
  var authResult = _authProfissional_(s);
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
      var iSig = dadosIdx[0].indexOf('sigla'), iTip = dadosIdx[0].indexOf('tipo');
      for (var k = dadosIdx.length - 1; k >= 1; k--) {
        var siglaCel = String(dadosIdx[k][iSig] || '').trim().toUpperCase();
        var tipoCel  = String(dadosIdx[k][iTip] || '').trim().toLowerCase();
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
function profAlterarSenhaPaciente(s, siglaPaciente, novaSenha) {
  // 1. Autenticar profissional
  var authResult = _authProfissional_(s);
  if (!authResult.ok) return authResult;
  var profissionalId = authResult.profissional.profissional_id;

  // 2. Validar nova senha
  if (!novaSenha || String(novaSenha).length < SENHA_MINIMA) {
    return { ok: false, erro: 'Escolha uma senha com pelo menos 8 caracteres.' };
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

  var novoHash = gerarHashSenhaV2(String(novaSenha));

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
 * Lista todos os profissionais cadastrados no sistema.
 *
 * Retorna: { ok: true, total: N, profissionais: [...] }
 * Cada profissional inclui todos os campos EXCETO senha_hash.
 */
function listarProfissionais(s) {
  var adm = _admDaSessao_(s);
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

    var hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');

    var planilhaGlobal = SpreadsheetApp.openById(SISTEMA_VMC_ID);
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
      else                                linhaProf.push('');
    }
    abaProf.appendRow(linhaProf);

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

  var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
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

  var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
  var aba = planilha.getSheetByName(ABA_PROFISSIONAIS);
  var dados = aba.getDataRange().getValues();
  var cabecalhos = dados[0];
  var idxId = cabecalhos.indexOf('profissional_id');
  var idxSenha = cabecalhos.indexOf('senha_hash');

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]).trim() === String(profissionalId).trim()) {
      aba.getRange(i + 1, idxSenha + 1).setValue(gerarHashSenhaV2(String(novaSenha)));
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
  return _alterarStatusProfissional(s, profissionalId, 'nao');
}

function reativarProfissional(s, profissionalId) {
  return _alterarStatusProfissional(s, profissionalId, 'sim');
}

function _alterarStatusProfissional(s, profissionalId, novoStatus) {
  var adm = _admDaSessao_(s);
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

  return { ok: true, config: config, grade: grade };
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
// de index.html, index-dev.html e admin.html: se a implantacao mudar, os
// quatro pontos mudam juntos. Publica por decisao do usuario (28/09).
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
 * `manter` copias mais recentes. Nomes AAAA-MM-DD ordenam cronologicamente
 * como texto, entao basta ordenar e cortar.
 *
 * Nome que nao seja exatamente AAAA-MM-DD e ignorado: pasta que nao foi
 * criada pelo backup nunca vai para a lixeira. Uma pasta com nome de data
 * criada a mao pelo usuario conta como copia — nao ha como distinguir pelo
 * nome, e isso esta registrado no relatorio do pacote.
 */
function pastasExcedentes(lista, manter) {
  var n = Number(manter);
  if (!isFinite(n) || n < 1) return [];
  var validas = [];
  for (var i = 0; i < lista.length; i++) {
    var nome = String(lista[i]);
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(nome)) validas.push(nome);
  }
  validas.sort(); // crescente: mais antigas primeiro
  if (validas.length <= n) return [];
  return validas.slice(0, validas.length - n);
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
 * Celula que comeca com = + - @ vira texto: o Sheets nunca interpreta o
 * detalhe do log como formula.
 *
 * Versao local do E3. O Pacote 18.2 cria o _celulaSegura_ global para
 * toda gravacao; quando criar, esta funcao sai e o E3 passa a usar aquele.
 */
function e3TextoSeguro(valor) {
  var t = String(valor == null ? '' : valor);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
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
    var planilha = SpreadsheetApp.openById(SISTEMA_VMC_ID);
    var g = _e3GarantirAbaBackups_(planilha);
    var duracao = Math.round((new Date().getTime() - inicio.getTime()) / 1000);

    var valores = {
      data_hora: Utilities.formatDate(inicio, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss'),
      arquivos: arquivos,
      erros: erros,
      duracao_s: duracao,
      detalhe: e3TextoSeguro(e3Truncar(detalhe, 2000))
    };

    var linha = [];
    for (var i = 0; i < g.cabecalhos.length; i++) {
      var col = g.cabecalhos[i];
      linha.push(Object.prototype.hasOwnProperty.call(valores, col) ? valores[col] : '');
    }
    g.aba.appendRow(linha);
  } catch (e) {
    console.error('E3 backup: nao consegui registrar na aba Backups: ' + String(e));
  }
}

/**
 * E-mail ao dono quando o backup do dia nao fechou limpo.
 * Sem limite por hora: o gatilho e diario, e backup quebrado todo dia deve
 * incomodar todo dia.
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
    ? 'A retencao de 30 dias JA havia rodado nesta execucao quando o erro apareceu: confira na ' +
      'lixeira do Drive se alguma pasta de backup foi apagada e restaure se precisar.'
    : 'A retencao de 30 dias NAO rodou nesta execucao: nenhum backup antigo foi apagado.';

  var texto =
    'O backup diario nao fechou limpo.\n\n' +
    'Hora (America/Sao_Paulo): ' + quando + '\n' +
    'Arquivos esperados: ' + esperados + '\n' +
    'Arquivos presentes na pasta do dia: ' + presentes + '\n' +
    'Erros: ' + detalhes.length + '\n\n' +
    'Detalhe (nomes de planilha e mensagens de erro, sem conteudo de paciente):\n' +
    e3Truncar(detalhes.join('\n'), 3000) + '\n\n' +
    sobreRetencao + '\n' +
    'Confira a aba Backups da Sistema_VMC e a pagina Execucoes do projeto.';
  try {
    MailApp.sendEmail({
      to: dono,
      subject: 'Clinica VMC - backup diario com falha',
      body: texto,
      name: 'Clínica VMC'
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
    profs = lerAbaComoObjetos(SpreadsheetApp.openById(SISTEMA_VMC_ID), ABA_PROFISSIONAIS);
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
          controle = SpreadsheetApp.openById(arqCtrl.getId());
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
    'O monitor horario nao conseguiu confirmar que o servidor esta no ar.\n\n' +
    'Hora (America/Sao_Paulo): ' + quando + '\n' +
    'Problema: ' + falha + '\n' +
    'Codigo HTTP: ' + (codigo ? codigo : '(sem resposta)') + '\n\n' +
    'Inicio da resposta (200 caracteres):\n' + e3Truncar(corpo, 200) + '\n\n' +
    'Confira a implantacao de producao e a pagina Execucoes do projeto.';

  try {
    MailApp.sendEmail({
      to: dono,
      subject: 'Clinica VMC - servidor sem resposta no ping',
      body: texto,
      name: 'Clínica VMC'
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
  var alvos = ['backupDiario_', 'backupSobDemanda_', 'monitorarPing_'];
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

  var msg = 'E3: ' + removidos + ' gatilho(s) antigo(s) removido(s). Criado: ' +
            'monitorarPing_ (diario, entre 7 h e 8 h, America/Sao_Paulo). ' +
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

function rodarBackupAgora() {
  return backupSobDemanda_();
}

function rodarMonitorAgora() {
  return monitorarPing_();
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
