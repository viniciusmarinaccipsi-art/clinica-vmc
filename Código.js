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
// Pacote 18.1.2 — correcoes de seguranca do acesso: links, cracha, acoes publicas, ativo (02/10/2026)
// Pacote 18.10 — desempenho e integridade (18.10a: indicadores na Controle, controle_id, trava de gravacao,
// id_envio, autoria; 18.10b: rascunho no servidor) (03/10/2026)
// Pacote 18.5 — registro e edicao pelo profissional: edicao por campo com carimbo (autoria_campos), criacao pelo
// profissional (criado_por), escore de escala no servidor, leituras do paciente paginadas e por colunas (03/10/2026)
var VERSAO_PACOTE = '18.11';

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
  'item_funcional', 'item_funcional_texto',
  'escore_total', 'escore_depressao', 'escore_ansiedade', 'escore_estresse',
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
}

// 18.11: leituras em que a linha do paciente e a do profissional sao lidas uma vez por chamada
var ACOES_SO_LEITURA = ['lerHistorico', 'lerEscalas', 'lerRascunhos', 'lerEditandoAuto',
  'profListarPacientes', 'profLerDadosPaciente', 'profLerGrade', 'admListarProfissionais'];

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
  'profMarcarEditandoAuto', 'profLimparEditandoAuto', 'profEditarAutomonitoramento',
  'profCriarAutomonitoramento', 'profCriarEscala', 'profEditarEscala', // 18.5
  'profDesativarPaciente', 'profReativarPaciente', 'profExcluirPaciente', 'profAlterarSenhaPaciente',
  'profSalvarGrade',
  'admCadastrarProfissional', 'admAtualizarProfissional', 'admTrocarSenhaProfissional',
  'admDesativarProfissional', 'admReativarProfissional', 'admEnviarConvite'
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

var SITE_URL = 'https://viniciusmarinaccipsi-art.github.io/clinica-vmc/index.html';
// 18.1.6: versao da Politica de Privacidade (a mesma exibida em privacidade.html).
// Mudou o texto da politica -> sobe a versao aqui e na pagina; paciente com aceite
// de versao anterior ve o aceite de novo no proximo login.
var POLITICA_VERSAO = '2026-10';
var ACOES_PUBLICAS = ['ping', 'autenticar', 'pedirRedefinicao', 'definirSenha'];
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
// 18.10: a assinatura deixou de ser fixa — e o nome (e o CRP, se houver) de quem assina,
// lido da planilha (_assinaturaDe_). As linhas de formacao abaixo nao mudaram.
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

/**
 * Corpo dos e-mails (texto puro e HTML simples), com os textos aprovados.
 * 18.1.3: `profissionalNome` (opcional) acrescenta a linha "Acompanhamento com: <nome>"
 * — usada na redefinicao quando o mesmo e-mail tem conta com mais de um profissional.
 * 18.10: `assinatura` = linhas de quem assina (_assinaturaDe_): o profissional dono
 * do paciente; nos e-mails de profissional e de admin, o admin do sistema.
 */
function montarEmail(tipoEmail, nome, link, profissionalNome, assinatura) {
  var linhasAssinatura = assinatura || [];
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
  var acompanhamento = profissionalNome ? 'Acompanhamento com: ' + profissionalNome : '';
  var texto = [EMAIL_DESTAQUE, '', ola, '', paragrafo]
    .concat(acompanhamento ? ['', acompanhamento] : [])
    .concat(['', link, '', aviso, ''])
    .concat(linhasAssinatura).concat(EMAIL_FORMACAO).join('\n');
  var html = '<p><strong>' + esc(EMAIL_DESTAQUE) + '</strong></p>' +
    '<p>' + esc(ola) + '</p>' +
    '<p>' + esc(paragrafo) + '</p>' +
    (acompanhamento ? '<p>' + esc(acompanhamento) + '</p>' : '') +
    '<p><a href="' + esc(link) + '">' + esc(link) + '</a></p>' +
    '<p>' + esc(aviso) + '</p>' +
    '<p>' + linhasAssinatura.map(esc).join('<br>') + (linhasAssinatura.length ? '<br>' : '') +
    '<span style="font-size:12px">' + EMAIL_FORMACAO.map(esc).join('<br>') + '</span></p>';
  return { assunto: assunto, texto: texto, html: html };
}

/** Linhas da assinatura: nome e, se houver CRP, "Psicólogo — CRP <numero>". */
function _assinaturaDe_(nome, crp) {
  var n = String(nome || '').trim();
  if (!n) return [];
  var c = String(crp || '').trim().replace(/^crp\s*/i, '');
  return c ? [n, 'Psicólogo — CRP ' + c] : [n];
}

/** Assinatura do profissional (aba Profissionais: nome_completo e crp, se a coluna existir). */
function _assinaturaDoProfissional_(profissionalId) {
  var prof = buscarProfissional(profissionalId);
  return prof ? _assinaturaDe_(prof.nome_completo, prof.crp) : [];
}

/** Assinatura dos e-mails de profissional e de admin: o primeiro admin ativo (aba Admins). */
function _assinaturaDoSistema_() {
  var admins = lerAbaComoObjetos(_abrirPlanilha_(SISTEMA_VMC_ID), ABA_ADMINS);
  for (var i = 0; i < admins.length; i++) {
    if (_estaAtivo_(admins[i].ativo)) return _assinaturaDe_(admins[i].nome_completo, admins[i].crp);
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
  var ultima = Math.max(aba.getLastColumn(), 1);
  var header = aba.getRange(1, 1, 1, ultima).getValues()[0];
  if (header.length === 1 && header[0] === '') header = [];
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
      extra: { profissional_id: prof.profissional_id, nome_completo: prof.nome_completo }
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
      if (lista && lista.ok === true) entrada.pacientes = lista.pacientes;
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
      if (reg && reg.ativo) ativas.push(contas[i]);
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
        if (!_enviarEmail_(e, montarEmail('redefinicao', '', link, profNome, assina))) _anularLink_(link);
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
  var max = cota === 'redefinicoes' ? REDEFINICOES_DIA_MAX : EMAILS_DIA_MAX;
  var prefixo = cota === 'redefinicoes' ? 'redefinicoes:' : 'emails:';
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

/** Envia um e-mail do COGNIATIVO (a cota ja reservada). Devolve true se enviou. */
function _enviarEmail_(para, email) {
  try {
    MailApp.sendEmail({ to: para, subject: email.assunto, body: email.texto, htmlBody: email.html, name: 'COGNIATIVO' });
    return true;
  } catch (e) {
    console.error('_enviarEmail_: ' + String(e && e.message || e).slice(0, 200));
    return false;
  }
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
  if (canal === 'email' && !_reservarEmail_('convites')) return { ok: false, erro: MSG_COTA_EMAIL };
  var link = _criarLinkAtivacao_('paciente', pac.sigla, s.profissional_id, 'convite', email);
  var enviado = false;
  if (canal === 'email') {
    // 18.10: o convite e assinado pelo profissional dono (nome e CRP da aba Profissionais)
    enviado = _enviarEmail_(email, montarEmail('convite', primeiroNome(_nomeDoPaciente_(pac)), link, '', _assinaturaDoProfissional_(s.profissional_id)));
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
    enviado = _enviarEmail_(email, montarEmail('convite', primeiroNome(prof.nome_completo), link, '', _assinaturaDe_(adm.nome_completo, adm.crp)));
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
      ind_alertas: alerta.instrumento !== undefined ? [alerta] : []
    });
  }

  return { ok: true, pacientes: lista };
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
    ind.ind_total_auto = abaAuto.getLastRow() - 1; // descontar cabecalho
    var cabAuto = abaAuto.getRange(1, 1, 1, abaAuto.getLastColumn()).getValues()[0];
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
  'item_funcional', 'item_funcional_texto', 'escore_total', 'escore_depressao', 'escore_ansiedade', 'escore_estresse',
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

  var resposta = {
    ok: true,
    automonitoramento: pagina.registros,
    total_registros: pagina.total,
    tem_mais: pagina.tem_mais,
    tem_negativo: temNegativo
  };
  if (!(parseInt(antes, 10) > 0)) {
    var anamnese = lerAbaComoObjetos(planilha, ABA_ANAMNESE);
    resposta.anamnese_preenchida = anamnese.length > 0;
    resposta.anamnese = anamnese.length > 0 ? anamnese[0] : null;
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

  var linha = montarLinha(aba, dados);
  aba.appendRow(linha);
  _indicadoresAposGravar_(paciente.__profissional_id, sigla, planilha);
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
    escalas: pagina.registros
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
    sistema = _abrirPlanilha_(SISTEMA_VMC_ID);
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
    campos_alterados: r.alterados, autoria_campos: r.autoria_campos };
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
  return { ok: true, mensagem: mensagem, editado_em: r.editado_em, campos_alterados: r.alterados, autoria_campos: r.autoria_campos };
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
  return { ok: true, mensagem: 'Registro salvo com sucesso' };
}

// Regras de calculo de cada escala, geradas do catalogo do frontend (ESC_ESCALAS) e conferidas
// contra ele em Node (mesmo escore, faixa e alerta para qualquer resposta): n = itens;
// max = maior valor da resposta; rev = itens invertidos; crit = [item, limiar, chave do alerta];
// sub = itens de cada subescala (soma x 2); faixas = [min, max, rotulo]; func = opcoes do item funcional.
var ESCALAS_CALCULO = {
  'PHQ-9':{n:9,max:3,crit:[[9,1,'PHQ9_item9']],faixas:[[20,27,'Depressão grave'],[15,19,'Depressão moderadamente grave'],[10,14,'Depressão moderada'],[5,9,'Depressão leve'],[0,4,'Sintomas mínimos ou ausentes']],func:4},
  'GAD-7':{n:7,max:3,faixas:[[15,21,'Ansiedade grave'],[10,14,'Ansiedade moderada'],[5,9,'Ansiedade leve'],[0,4,'Ansiedade mínima']],func:4},
  'PSS-10':{n:10,max:4,rev:[4,5,7,8],faixas:[[27,40,'Estresse alto'],[14,26,'Estresse moderado'],[0,13,'Estresse baixo']]},
  'DASS-21':{n:21,max:3,crit:[[21,2,'DASS21_item21']],sub:{estresse:[1,6,8,11,12,14,18],ansiedade:[2,4,7,9,15,19,20],depressao:[3,5,10,13,16,17,21]},multi:true,faixasSub:{depressao:[[28,99,'Extremamente severo'],[21,27,'Severo'],[14,20,'Moderado'],[10,13,'Leve'],[0,9,'Normal']],ansiedade:[[20,99,'Extremamente severo'],[15,19,'Severo'],[10,14,'Moderado'],[8,9,'Leve'],[0,7,'Normal']],estresse:[[34,99,'Extremamente severo'],[26,33,'Severo'],[19,25,'Moderado'],[15,18,'Leve'],[0,14,'Normal']]}},
  'SRQ-20':{n:20,max:1,crit:[[17,1,'SRQ20_item17']],faixas:[[7,20,'Suspeita de transtorno mental comum'],[0,6,'Baixa probabilidade de TMC']]},
  'BDI-II':{n:21,max:3,crit:[[9,1,'BDI2_item9']],faixas:[[29,63,'Grave'],[20,28,'Moderado'],[14,19,'Leve'],[0,13,'Mínimo']],letra:[16,18]},
  'BAI':{n:21,max:3,faixas:[[31,63,'Grave'],[20,30,'Moderado'],[11,19,'Leve'],[0,10,'Mínimo']]}
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
  for (var id = 1; id <= t.n; id++) {
    var cru = lerColuna('item_' + (id < 10 ? '0' : '') + id);
    var bruto = parseInt(String(cru === undefined || cru === null ? '' : cru), 10);
    if (isNaN(bruto) || bruto < 0 || bruto > t.max) return { ok: false, erro: 'Responda todas as questões' };
    var v = (t.rev && t.rev.indexOf(id) !== -1) ? (t.max - bruto) : bruto;
    total += v;
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
    var rotulos = {};
    ['depressao', 'ansiedade', 'estresse'].forEach(function (sub) {
      var escore = (somas[sub] || 0) * 2; // DASS-21 -> DASS-42
      campos['escore_' + sub] = escore;
      rotulos[sub] = achar(t.faixasSub[sub], escore, 'ultima');
    });
    campos.faixa = 'Dep:' + rotulos.depressao + ' | Ans:' + rotulos.ansiedade + ' | Est:' + rotulos.estresse;
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
  return { ok: true, mensagem: 'Escala salva com sucesso' };
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
  return { ok: true, mensagem: 'Escala salva com sucesso', editado_em: r.editado_em,
    campos_alterados: r.alterados, autoria_campos: r.autoria_campos, registro: registro };
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
  if (_estaAtivo_(paciente.ativo)) {
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
      obj[cabecalhos[j]] = cabecalhos[j] === 'ativo' ? _ativoParaCliente_(dados[i][j]) : dados[i][j];
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
  return _alterarStatusProfissional(s, profissionalId, 'nao');
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
    var valorTxt = _celulaSegura_(String(cfgGravar[chave])); // 18.2
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
