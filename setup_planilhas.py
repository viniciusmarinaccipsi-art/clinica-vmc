"""
setup_planilhas.py
==================

Script de setup inicial do Sistema Clinico Digital - TCC.

Cria duas planilhas no Google Drive do terapeuta:

1. "Clinica VMC - Controle" (planilha de controle, privada)
   - Aba unica "Pacientes" com colunas padrao
   - Linha de exemplo do paciente TST (senha: teste1)

2. "Clinica VMC - TST" (planilha individual do paciente de teste)
   - Aba "Anamnese"
   - Aba "Automonitoramento"
   - Aba "Painel" (reservada para graficos futuros)

Ao final, imprime os IDs e URLs das duas planilhas, ja vinculadas.

Autenticacao:
    Este script usa OAuth de aplicativo instalado (InstalledAppFlow).
    Na primeira execucao, ele le o arquivo "credentials.json" que deve
    estar na mesma pasta do script, abre o navegador para voce autorizar,
    e salva um "token.json" localmente para reutilizar nas proximas
    execucoes (sem precisar autorizar de novo).

Requisitos:
    pip install gspread google-auth google-auth-oauthlib

Uso:
    Coloque "credentials.json" na mesma pasta deste script e rode:
        python setup_planilhas.py

Seguranca:
    - A senha do TST fica armazenada como hash SHA-256, nunca em texto puro.
    - NUNCA compartilhe os arquivos credentials.json ou token.json com
      ninguem, nem faca upload deles para repositorios publicos.
"""

import hashlib
import os
from datetime import datetime

import gspread
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow


# ---------------------------------------------------------------------------
# Configuracao
# ---------------------------------------------------------------------------

NOME_PLANILHA_CONTROLE = "Clinica VMC - Controle"
NOME_PLANILHA_TST = "Clinica VMC - TST"

# Escopos necessarios: Drive (criar arquivos) + Sheets (editar conteudo)
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]

# Caminhos dos arquivos de credencial (mesma pasta do script)
PASTA_SCRIPT = os.path.dirname(os.path.abspath(__file__))
ARQUIVO_CREDENCIAIS = os.path.join(PASTA_SCRIPT, "credentials.json")
ARQUIVO_TOKEN = os.path.join(PASTA_SCRIPT, "token.json")

# Cabecalhos da aba "Pacientes" na planilha de controle
COLUNAS_CONTROLE = [
    "sigla",
    "senha_hash",
    "link_planilha_individual",
    "data_cadastro",
    "data_anamnese",
    "ativo",
    "observacoes",
]

# Cabecalhos da aba "Anamnese" na planilha individual
COLUNAS_ANAMNESE = [
    "timestamp",
    "versao_formulario",
    "nome_completo",
    "data_nascimento",
    "rg",
    "cpf",
    "telefone",
    "email",
    "escolaridade",
    "profissao",
    "estado_civil",
    "reside_fora_brasil",
    "pais",
    "zip_code",
    "estado",
    "cidade",
    "cep",
    "endereco",
    "tratamentos_anteriores",
    "procedimento_medico_12m",
    "procedimento_medico_detalhes",
    "medicacao_12m",
    "medicacao_detalhes",
    "transtornos_esteve_tratamento",
    "transtornos_esta_tratamento",
    "transtornos_outros",
    "familiar_transtorno",
    "familiar_transtorno_detalhes",
    "complicacoes_esteve_tratamento",
    "complicacoes_esta_tratamento",
    "complicacoes_outros",
    "familiar_complicacao",
    "familiar_complicacao_detalhes",
    "pessoa_confianca_nome",
    "pessoa_confianca_relacao",
    "pessoa_confianca_contato",
]

# Cabecalhos da aba "Automonitoramento"
COLUNAS_AUTOMONITORAMENTO = [
    "timestamp",
    "versao_formulario",
    "data_registro",
    "hora_registro",
    "humor_nivel",
    "humor_observacoes",
    "neg_preenchido",
    "neg_sit_quando",
    "neg_sit_onde",
    "neg_sit_com_quem",
    "neg_sit_o_que",
    "neg_sit_tipo_interpessoais",
    "neg_sit_tipo_desempenho",
    "neg_sit_tipo_solidao",
    "neg_sit_tipo_perda",
    "neg_sit_tipo_internas",
    "neg_emo_tristeza",
    "neg_emo_tristeza_intensidade",
    "neg_emo_ansiedade",
    "neg_emo_ansiedade_intensidade",
    "neg_emo_raiva",
    "neg_emo_raiva_intensidade",
    "neg_emo_culpa",
    "neg_emo_culpa_intensidade",
    "neg_emo_ciume",
    "neg_emo_ciume_intensidade",
    "neg_fis_ativacao",
    "neg_fis_ativacao_intensidade",
    "neg_fis_desativacao",
    "neg_fis_desativacao_intensidade",
    "neg_fis_tensao",
    "neg_fis_tensao_intensidade",
    "neg_fis_digestivas",
    "neg_fis_digestivas_intensidade",
    "neg_fis_sono",
    "neg_fis_sono_intensidade",
    "neg_pens_sobre_mim",
    "neg_pens_sobre_mim_crenca",
    "neg_pens_sobre_futuro",
    "neg_pens_sobre_futuro_crenca",
    "neg_pens_sobre_outros",
    "neg_pens_sobre_outros_crenca",
    "neg_pens_cobranca",
    "neg_pens_cobranca_crenca",
    "neg_pens_culpa",
    "neg_pens_culpa_crenca",
    "neg_dist_previsao",
    "neg_dist_generalizacao",
    "neg_dist_percepcao",
    "neg_dist_interpretacao",
    "neg_dist_exigencia",
    "neg_comp_evitacao",
    "neg_comp_isolamento",
    "neg_comp_reatividade",
    "neg_comp_entorpecimento",
    "neg_comp_controle",
    "pos_preenchido",
    "pos_sit_quando",
    "pos_sit_onde",
    "pos_sit_com_quem",
    "pos_sit_o_que",
    "pos_emo_felicidade",
    "pos_emo_felicidade_intensidade",
    "pos_emo_orgulho",
    "pos_emo_orgulho_intensidade",
    "pos_emo_conexao",
    "pos_emo_conexao_intensidade",
    "pos_emo_calma",
    "pos_emo_calma_intensidade",
    "pos_emo_esperanca",
    "pos_emo_esperanca_intensidade",
    "pos_fis_calma",
    "pos_fis_calma_intensidade",
    "pos_fis_energia",
    "pos_fis_energia_intensidade",
    "pos_fis_relaxamento",
    "pos_fis_relaxamento_intensidade",
    "pos_fis_digestivo",
    "pos_fis_digestivo_intensidade",
    "pos_fis_atencao",
    "pos_fis_atencao_intensidade",
    "pos_pens_autocompaixao",
    "pos_pens_autocompaixao_crenca",
    "pos_pens_esperanca",
    "pos_pens_esperanca_crenca",
    "pos_pens_confianca",
    "pos_pens_confianca_crenca",
    "pos_pens_flexibilidade",
    "pos_pens_flexibilidade_crenca",
    "pos_pens_responsabilidade",
    "pos_pens_responsabilidade_crenca",
    "pos_comp_enfrentamento",
    "pos_comp_conexao",
    "pos_comp_expressao",
    "pos_comp_autocuidado",
    "pos_comp_aceitacao",
]

# Cabecalhos da aba "Painel"
COLUNAS_PAINEL = [
    "metrica",
    "descricao",
    "valor",
    "atualizado_em",
]


# ---------------------------------------------------------------------------
# Utilitarios
# ---------------------------------------------------------------------------


def gerar_hash_senha(senha: str) -> str:
    """Gera o hash SHA-256 de uma senha (mesma logica usada no Apps Script)."""
    return hashlib.sha256(senha.encode("utf-8")).hexdigest()


def autenticar() -> gspread.Client:
    """
    Autentica no Google usando OAuth de aplicativo instalado.

    Fluxo:
    1. Se existe um token.json valido, usa ele direto.
    2. Se o token expirou mas tem refresh_token, renova silenciosamente.
    3. Caso contrario, le credentials.json, abre o navegador para voce
       autorizar, e salva o token.json para a proxima vez.
    """
    creds = None

    if os.path.exists(ARQUIVO_TOKEN):
        try:
            creds = Credentials.from_authorized_user_file(ARQUIVO_TOKEN, SCOPES)
        except Exception:
            creds = None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(ARQUIVO_CREDENCIAIS):
                raise FileNotFoundError(
                    f"Arquivo 'credentials.json' nao encontrado em:\n"
                    f"  {ARQUIVO_CREDENCIAIS}\n\n"
                    f"Coloque seu credentials.json na mesma pasta deste script."
                )
            flow = InstalledAppFlow.from_client_secrets_file(ARQUIVO_CREDENCIAIS, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(ARQUIVO_TOKEN, "w") as f:
            f.write(creds.to_json())

    return gspread.authorize(creds)


# ---------------------------------------------------------------------------
# Criacao das planilhas
# ---------------------------------------------------------------------------


def criar_planilha_individual(client: gspread.Client, sigla: str) -> gspread.Spreadsheet:
    """Cria a planilha individual de um paciente com as tres abas padrao."""
    nome = f"Clinica VMC - {sigla}"
    print(f"  Criando planilha individual: {nome}")
    planilha = client.create(nome)

    aba_anamnese = planilha.sheet1
    aba_anamnese.update_title("Anamnese")
    aba_anamnese.update(range_name="A1", values=[COLUNAS_ANAMNESE])
    aba_anamnese.freeze(rows=1)
    print(f"    - Aba Anamnese criada ({len(COLUNAS_ANAMNESE)} colunas)")

    aba_auto = planilha.add_worksheet(
        title="Automonitoramento",
        rows=1000,
        cols=len(COLUNAS_AUTOMONITORAMENTO),
    )
    aba_auto.update(range_name="A1", values=[COLUNAS_AUTOMONITORAMENTO])
    aba_auto.freeze(rows=1)
    print(f"    - Aba Automonitoramento criada ({len(COLUNAS_AUTOMONITORAMENTO)} colunas)")

    aba_painel = planilha.add_worksheet(title="Painel", rows=100, cols=len(COLUNAS_PAINEL))
    aba_painel.update(range_name="A1", values=[COLUNAS_PAINEL])
    aba_painel.freeze(rows=1)
    print(f"    - Aba Painel criada (reservada para graficos futuros)")

    return planilha


def criar_planilha_controle(
    client: gspread.Client,
    sigla_tst: str,
    senha_tst: str,
    link_planilha_tst: str,
) -> gspread.Spreadsheet:
    """Cria a planilha de controle e popula com a linha do paciente TST."""
    print(f"  Criando planilha de controle: {NOME_PLANILHA_CONTROLE}")
    planilha = client.create(NOME_PLANILHA_CONTROLE)

    aba = planilha.sheet1
    aba.update_title("Pacientes")
    aba.update(range_name="A1", values=[COLUNAS_CONTROLE])
    aba.freeze(rows=1)

    hoje = datetime.now().strftime("%Y-%m-%d")
    linha_tst = [
        sigla_tst,
        gerar_hash_senha(senha_tst),
        link_planilha_tst,
        hoje,
        "",
        "sim",
        "Paciente de teste para desenvolvimento",
    ]
    aba.append_row(linha_tst)
    print(f"    - Linha do paciente {sigla_tst} adicionada")
    print(f"    - Senha armazenada como hash SHA-256 (nao fica em texto puro)")

    return planilha


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    print("=" * 60)
    print("Setup inicial - Sistema Clinico Digital TCC")
    print("=" * 60)

    print("\n[1/3] Autenticando no Google...")
    print("    (na primeira execucao, o navegador vai abrir para voce autorizar)")
    client = autenticar()
    print("    - Autenticado com sucesso")

    print("\n[2/3] Criando planilha individual do paciente TST...")
    planilha_tst = criar_planilha_individual(client, sigla="TST")

    print("\n[3/3] Criando planilha de controle...")
    planilha_controle = criar_planilha_controle(
        client,
        sigla_tst="TST",
        senha_tst="teste1",
        link_planilha_tst=planilha_tst.url,
    )

    print("\n" + "=" * 60)
    print("SETUP CONCLUIDO")
    print("=" * 60)
    print(f"\nPlanilha de Controle:")
    print(f"  ID:  {planilha_controle.id}")
    print(f"  URL: {planilha_controle.url}")
    print(f"\nPlanilha Individual do TST:")
    print(f"  ID:  {planilha_tst.id}")
    print(f"  URL: {planilha_tst.url}")
    print(f"\nCredenciais do paciente de teste:")
    print(f"  Sigla: TST")
    print(f"  Senha: teste1")
    print(f"\nProximo passo:")
    print(f"  Me envie apenas o ID da planilha de controle.")
    print(f"  NAO envie o conteudo de credentials.json ou token.json.")
    print()


if __name__ == "__main__":
    main()
