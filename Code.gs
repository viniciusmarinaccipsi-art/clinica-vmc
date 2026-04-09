/**
 * ============================================================
 * SISTEMA CLINICO DIGITAL - TCC
 * Google Apps Script - Servidor
 * ============================================================
 *
 * Este e o "servidor" do sistema. Ele fica entre o HTML (que o
 * paciente usa no navegador) e as planilhas do Google Sheets.
 *
 * Funcoes principais:
 *   1. autenticar         - valida login (sigla + senha)
 *   2. salvarAnamnese     - salva dados da anamnese na planilha individual
 *   3. salvarAutomonitoramento - salva registro de automonitoramento
 *   4. lerHistorico       - retorna os registros anteriores do paciente
 *
 * Como funciona:
 *   - O HTML faz uma chamada (POST) para a URL publica deste script
 *   - O script recebe a chamada, identifica a "acao" solicitada
 *   - Executa a acao (ler/escrever na planilha correta)
 *   - Devolve uma resposta em JSON
 *
 * Seguranca:
 *   - Senhas nunca trafegam nem ficam armazenadas em texto puro
 *   - O script gera o hash SHA-256 da senha digitada e compara com
 *     o hash armazenado na planilha de controle
 *   - Apenas o terapeuta tem acesso direto as planilhas; o paciente
 *     so ve seus dados atraves do HTML apos autenticar
 */


// ============================================================
// CONFIGURACAO
// ============================================================

// ID da planilha de controle (fixo).
// Para trocar de planilha no futuro, basta alterar este valor.
var PLANILHA_CONTROLE_ID = '1fJSLiIJprqJgdwDhDar-8SNJcZNlnRmJb6efalOuwgM';

// Nome da aba na planilha de controle que contem os pacientes
var ABA_PACIENTES = 'Pacientes';

// Nomes das abas na planilha individual de cada paciente
var ABA_ANAMNESE = 'Anamnese';
var ABA_AUTOMONITORAMENTO = 'Automonitoramento';

// Versao atual do formulario (para versionamento aditivo dos dados)
var VERSAO_FORMULARIO = 'v1';


// ============================================================
// ROTEADOR PRINCIPAL
// ============================================================

/**
 * Recebe todas as chamadas do HTML.
 * Identifica qual acao foi pedida e chama a funcao correspondente.
 */
function doPost(e) {
  try {
    // O HTML envia os dados como JSON dentro de "postData.contents"
    var payload = JSON.parse(e.postData.contents);
    var acao = payload.acao;

    var resposta;
    switch (acao) {
      case 'ping':
        resposta = { ok: true, mensagem: 'Servidor respondendo', versao: VERSAO_FORMULARIO };
        break;

      case 'autenticar':
        resposta = autenticar(payload.sigla, payload.senha);
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

/**
 * Permite testar o servidor abrindo a URL no navegador (GET).
 * Util para conferir que a publicacao deu certo.
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      mensagem: 'Servidor do Sistema Clinico Digital esta no ar',
      versao: VERSAO_FORMULARIO
    }))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
// AUTENTICACAO
// ============================================================

/**
 * Valida o login do paciente.
 *
 * Entrada: sigla (ex: "TST") e senha em texto puro (ex: "teste1")
 * Saida:   { ok: true, paciente: {...} } ou { ok: false, erro: "..." }
 *
 * A senha digitada e transformada em hash SHA-256 e comparada com
 * o hash armazenado na planilha de controle. A senha em texto puro
 * nao e salva em lugar nenhum.
 */
function autenticar(sigla, senha) {
  if (!sigla || !senha) {
    return { ok: false, erro: 'Sigla e senha sao obrigatorias' };
  }

  var paciente = buscarPaciente(sigla);
  if (!paciente) {
    return { ok: false, erro: 'Sigla ou senha incorretos' };
  }

  if (paciente.ativo !== 'sim') {
    return { ok: false, erro: 'Paciente inativo' };
  }

  var hashDigitada = gerarHashSenha(senha);
  if (hashDigitada !== paciente.senha_hash) {
    return { ok: false, erro: 'Sigla ou senha incorretos' };
  }

  // Autenticado com sucesso. Retorna apenas dados seguros (nunca o hash).
  return {
    ok: true,
    paciente: {
      sigla: paciente.sigla,
      anamnese_preenchida: paciente.data_anamnese !== '',
      data_anamnese: paciente.data_anamnese
    }
  };
}

/**
 * Busca um paciente na planilha de controle pela sigla.
 * Retorna um objeto com as colunas da linha, ou null se nao encontrar.
 */
function buscarPaciente(sigla) {
  var planilha = SpreadsheetApp.openById(PLANILHA_CONTROLE_ID);
  var aba = planilha.getSheetByName(ABA_PACIENTES);
  var dados = aba.getDataRange().getValues();

  if (dados.length < 2) return null;

  var cabecalhos = dados[0];
  var idxSigla = cabecalhos.indexOf('sigla');

  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][idxSigla]).trim().toUpperCase() === String(sigla).trim().toUpperCase()) {
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
 * Gera o hash SHA-256 de uma senha.
 *
 * IMPORTANTE: esta funcao precisa produzir exatamente o mesmo
 * resultado que a funcao Python gerar_hash_senha() do script
 * setup_planilhas.py. Qualquer diferenca quebra o login.
 */
function gerarHashSenha(senha) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    senha,
    Utilities.Charset.UTF_8
  );
  // Converte bytes para string hexadecimal
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
// GRAVACAO DE DADOS
// ============================================================

/**
 * Salva os dados da anamnese na planilha individual do paciente.
 * Tambem registra a data de preenchimento na planilha de controle.
 *
 * O modulo de Anamnese so deve ser preenchido uma vez; este script
 * nao impede reenvios, mas o HTML deve bloquear a reedicao apos o
 * primeiro envio.
 */
function salvarAnamnese(sigla, dados) {
  var paciente = buscarPaciente(sigla);
  if (!paciente) return { ok: false, erro: 'Paciente nao encontrado' };

  var planilhaIndividualId = extrairIdDaUrl(paciente.link_planilha_individual);
  var planilha = SpreadsheetApp.openById(planilhaIndividualId);
  var aba = planilha.getSheetByName(ABA_ANAMNESE);

  var linha = montarLinha(aba, dados);
  aba.appendRow(linha);

  // Registra data de anamnese na planilha de controle
  registrarDataAnamnese(sigla);

  return { ok: true, mensagem: 'Anamnese salva com sucesso' };
}

/**
 * Salva um registro de automonitoramento na planilha individual.
 * Cada envio gera uma nova linha.
 */
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
 * da aba. Campos ausentes viram vazios. Preenche automaticamente
 * "timestamp" e "versao_formulario".
 *
 * Esta funcao e a chave para o versionamento aditivo: se a planilha
 * ganhar uma coluna nova no futuro, os dados antigos continuam no
 * lugar certo porque a linha e montada por nome de coluna, nao por
 * posicao.
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
 * Registra a data de anamnese do paciente na planilha de controle.
 */
function registrarDataAnamnese(sigla) {
  var planilha = SpreadsheetApp.openById(PLANILHA_CONTROLE_ID);
  var aba = planilha.getSheetByName(ABA_PACIENTES);
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
 * Retorna o historico de registros do paciente para exibir no HTML.
 * Ja devolve os dados em um formato compativel com graficos futuros.
 */
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

/**
 * Le uma aba inteira e devolve um array de objetos
 * onde cada objeto tem as chaves iguais aos cabecalhos.
 */
function lerAbaComoObjetos(planilha, nomeAba) {
  var aba = planilha.getSheetByName(nomeAba);
  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return [];

  var cabecalhos = dados[0];
  var resultado = [];
  for (var i = 1; i < dados.length; i++) {
    var obj = {};
    for (var j = 0; j < cabecalhos.length; j++) {
      obj[cabecalhos[j]] = dados[i][j];
    }
    resultado.push(obj);
  }
  return resultado;
}


// ============================================================
// UTILITARIOS
// ============================================================

/**
 * Extrai o ID de uma URL de planilha do Google Sheets.
 * Ex: https://docs.google.com/spreadsheets/d/ABC123/edit -> ABC123
 */
function extrairIdDaUrl(url) {
  if (!url) return '';
  var match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : String(url);
}


// ============================================================
// TESTES INTERNOS (rodar manualmente no editor)
// ============================================================

/**
 * Rode esta funcao uma vez no editor do Apps Script para:
 *   1. Conceder as permissoes necessarias (Drive + Sheets)
 *   2. Conferir que o hash esta correto (deve dar true)
 *   3. Conferir que encontra o paciente TST
 *
 * Como rodar: selecione "testarSetup" no menu superior do editor
 * e clique em "Executar". Na primeira vez o Google vai pedir
 * autorizacao.
 */
function testarSetup() {
  Logger.log('=== Testando setup do Apps Script ===');

  // Teste 1: hash da senha "teste1"
  var hash = gerarHashSenha('teste1');
  var hashEsperado = '15bf532d22345576b4a51b96da4754c039ef3458494066d76828e893d69ebd1e';
  Logger.log('Hash de "teste1": ' + hash);
  Logger.log('Hash correto?     ' + (hash === hashEsperado));

  // Teste 2: encontrar paciente TST
  var paciente = buscarPaciente('TST');
  Logger.log('Paciente TST encontrado? ' + (paciente !== null));
  if (paciente) {
    Logger.log('  sigla: ' + paciente.sigla);
    Logger.log('  ativo: ' + paciente.ativo);
    Logger.log('  link:  ' + paciente.link_planilha_individual);
  }

  // Teste 3: autenticar TST com senha correta
  var resultado = autenticar('TST', 'teste1');
  Logger.log('Login TST / teste1: ' + JSON.stringify(resultado));

  // Teste 4: autenticar TST com senha errada
  var resultadoErrado = autenticar('TST', 'senhaErrada');
  Logger.log('Login TST / senhaErrada: ' + JSON.stringify(resultadoErrado));
}
