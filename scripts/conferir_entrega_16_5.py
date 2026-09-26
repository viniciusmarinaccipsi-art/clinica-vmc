#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pacote 16.5a — conferência da entrega do Design × código real (index-dev.html).

Uso (a partir da raiz do repositório):
    python scripts/conferir_entrega_16_5.py [pasta_da_entrega]

pasta_da_entrega: default `docs/design/16.5`. Deve conter 02_telas.md,
03_componentes.md, 04_tokens.css, 05_rostinhos.svg, catalogo.js, icones.js,
01_pranchas_16.5.html, 16.5_textos_interface.md e a pasta referencia_25-09/.

Saídas (sempre reescritas, determinísticas, sem data/hora):
    <pasta>/gabarito_codigo.json   — gabarito clínico extraído de index-dev.html
    <pasta>/CONFERENCIA_16_5a.md   — 7 itens, cada um "OK" ou a lista exata das diferenças
e um resumo no terminal (uma linha por item).

Python 3 puro, sem dependência externa. Reexecutável: rodar duas vezes gera
arquivos byte a byte iguais.
"""
import html
import json
import os
import re
import struct
import sys

# --------------------------------------------------------------------------
# Constantes do pacote (fontes: PROMPT_16_5a.md e BRIEF_rodada3_design.md §1)
# --------------------------------------------------------------------------
ETAPAS = ['sit', 'emo', 'fis', 'pens', 'comp']
LADOS = {'a': 'neg', 'b': 'pos'}
ESPERADO = {'grupos': 45, 'itens': 225, 'outro': 45, 'legendas': 3}

# Textos sem origem já aceitos pelo usuário (PROMPT_16_5a.md, Passo 1, item 3)
TEXTOS_ACEITOS = [
    'Nada marcado ainda', 'Continuar registro', 'Sair',
    '1 situação marcada', '2 reações físicas marcadas', '1 pensamento marcado',
    '2 comportamentos marcados', 'Iniciar novo registro',
    'Concluir só com a checagem de humor', 'Suas 5 etapas',
    'Toque em uma etapa para abrir.', 'Começar: Situação ›',
    'QUE TIPO DE REGISTRO?',
]

# Item 4 — esperados (PROMPT_16_5a.md)
TOKENS_NOVOS_ESPERADOS = [
    '--c-humor-1-bg', '--c-humor-2-bg', '--c-humor-3-bg', '--c-humor-4-bg', '--c-humor-5-bg',
    '--c-humor-1-ink', '--c-humor-2-ink', '--c-humor-3-ink', '--c-humor-4-ink', '--c-humor-5-ink',
    '--c-reg-neg-mid', '--c-reg-pos-mid', '--t-h2-sm', '--t-legend', '--hit-face', '--w-likert-col',
]
TOKENS_MUDOU_ESPERADOS = ['--f-title', '--t-display', '--t-h1', '--t-h2', '--t-h3', '--t-h4']

# Item 7 — referência 25/09 × rodada 2 (BRIEF_rodada3_design.md, seção 1)
REFERENCIA_TELAS = [
    # (arquivo, pranchas da rodada 2, situação)
    ('V-01_checagem.jpg', 'AUT-03 (fim da tela)', 'DIVERGE — aguarda rodada 3 (§1.1: escolha do tipo sai da checagem)'),
    ('V-02a_automonitoramento-primeiro-acesso.jpg', 'AUT-02 primeiro acesso', 'DIVERGE — aguarda rodada 3 (§1.1: cartões de tipo na página; aviso D11)'),
    ('V-02b_automonitoramento.jpg', 'AUT-02', 'DIVERGE — aguarda rodada 3 (§1.1: "QUE TIPO DE REGISTRO?" + cartões)'),
    ('V-03_menu-etapas.jpg', 'AUT-03c (nova)', 'NOVA — não existe na rodada 2 (§1.2: menu "Suas 5 etapas")'),
    ('V-04_etapa1-situacao.jpg', 'AUT-04', 'DIVERGE — aguarda rodada 3 (§1.3: subgrupos em lista com check redondo)'),
    ('V-05_etapa2-emocoes.jpg', 'AUT-05', 'DIVERGE — aguarda rodada 3 (§1.3: lista + barra deslizante)'),
    ('V-06_etapa3-reacoes.jpg', 'AUT-06', 'DIVERGE — aguarda rodada 3 (§1.3: lista + barra deslizante)'),
    ('V-07_etapa4-pensamentos.jpg', 'AUT-07', 'DIVERGE — aguarda rodada 3 (§1.3: lista + barra; ajuda âmbar recolhida)'),
    ('V-08_etapa5-comportamentos.jpg', 'AUT-08 / AUT-08p', 'DIVERGE — aguarda rodada 3 (§1.3: lista com check redondo)'),
    ('V-09_revisar.jpg', 'AUT-09', 'APROVADA como está na rodada 2'),
    ('V-10_enviado.jpg', 'AUT-10', 'APROVADA como está na rodada 2'),
    ('V-11_computador-1280_modelo.png', 'AUT-11', 'DIVERGE — aguarda rodada 3 (§1.4: coluna lateral + lista/barra em duas colunas)'),
]
APROVADAS_SEM_REFERENCIA = ['AUT-03b', 'AUT-12a', 'AUT-12b', 'AUT-12c']


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------
def ler(caminho):
    with open(caminho, 'r', encoding='utf-8') as f:
        return f.read()


def gravar(caminho, texto):
    with open(caminho, 'w', encoding='utf-8', newline='\n') as f:
        f.write(texto)


def limpar_html(s):
    """Remove tags e desfaz entidades; normaliza espaços."""
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    return re.sub(r'\s+', ' ', s).strip()


def secao_status(diferencas):
    return 'OK' if not diferencas else f'{len(diferencas)} diferença(s)'


# --------------------------------------------------------------------------
# Item 1 — Gabarito do código
# --------------------------------------------------------------------------
RE_SECAO = re.compile(r'<div class="(?:section|auto-tipo)" id="(sec-auto-[a-z0-9-]+)"')  # 16.5d-1: ids lógicos em div.auto-tipo
RE_GRUPO = re.compile(r'<div class="auto-group[^"]*" data-grupo="([^"]+)"([^>]*)>')
RE_TITULO = re.compile(r'<div class="auto-group-title">(.*?)</div>', re.S)
RE_DESC = re.compile(r'<div class="auto-group-desc">(.*?)</div>', re.S)
RE_ITEM = re.compile(r'<input type="checkbox" data-item="([^"]*)"')
RE_OUTRO = re.compile(
    r'<span class="auto-option-other-lbl">(.*?)</span>\s*<input class="auto-option-other-inp" type="text" placeholder="([^"]*)"',
    re.S)
RE_ROTULO = re.compile(r'<span class="auto-item-likert-label">(.*?)</span>', re.S)
RE_SCALE = re.compile(r'<div class="auto-scale[^"]*">(.*?)</div>', re.S)
RE_CIRCULADO = re.compile(r'^[①-⑳⓪-⓿]\s*')


def extrair_gabarito(html_dev):
    """Percorre as 10 seções sec-auto-{etapa}-{a,b} e devolve o gabarito."""
    linhas = html_dev.split('\n')
    inicios = []  # (linha_idx, id)
    for i, ln in enumerate(linhas):
        m = RE_SECAO.search(ln)
        if m:
            inicios.append((i, m.group(1)))
    limites = {}
    for k, (i, sid) in enumerate(inicios):
        fim = inicios[k + 1][0] if k + 1 < len(inicios) else len(linhas)
        limites[sid] = (i, fim)  # [i, fim)

    gabarito = {}
    linhas_secoes = {}
    for etapa in ETAPAS:
        for sufixo, lado in LADOS.items():
            sid = f'sec-auto-{etapa}-{sufixo}'
            if sid not in limites:
                raise SystemExit(f'Seção {sid} não encontrada em index-dev.html')
            ini, fim = limites[sid]
            bloco = '\n'.join(linhas[ini:fim])
            # última linha não vazia da seção (fechamento)
            fim_real = fim
            while fim_real > ini and not linhas[fim_real - 1].strip():
                fim_real -= 1
            linhas_secoes[sid] = {'inicio': ini + 1, 'fim': fim_real, 'total': fim_real - ini}

            # legenda(s) da seção
            legendas = []
            for m in RE_SCALE.finditer(bloco):
                palavras = [RE_CIRCULADO.sub('', limpar_html(x))
                            for x in re.findall(r'<span>(.*?)</span>', m.group(1), re.S)]
                legendas.append(palavras)
            legenda = legendas[0] if legendas else None
            if len(legendas) > 1:
                raise SystemExit(f'{sid}: mais de uma legenda .auto-scale ({len(legendas)})')

            # grupos: cada um vai do seu início até o próximo grupo (ou fim da seção)
            grupos = []
            achados = list(RE_GRUPO.finditer(bloco))
            for g, m in enumerate(achados):
                g_ini = m.start()
                g_fim = achados[g + 1].start() if g + 1 < len(achados) else len(bloco)
                gb = bloco[g_ini:g_fim]
                chave = m.group(1)
                attrs = m.group(2)
                tem_likert = re.search(r'data-tem-likert="([^"]*)"', attrs)
                mt = RE_TITULO.search(gb)
                md = RE_DESC.search(gb)
                itens = [html.unescape(x) for x in RE_ITEM.findall(gb)]
                outros = [(limpar_html(a), html.unescape(b)) for a, b in RE_OUTRO.findall(gb)]
                rotulos = sorted(set(limpar_html(r) for r in RE_ROTULO.findall(gb)))
                grupos.append({
                    'chave': chave,
                    'titulo': limpar_html(mt.group(1)) if mt else None,
                    'desc': limpar_html(md.group(1)) if md else None,
                    'itens': itens,
                    'outro': outros[0][0] if outros else None,
                    'outroDica': outros[0][1] if outros else None,
                    'n_outro': len(outros),
                    'rotulo': rotulos[0] if len(rotulos) == 1 else (rotulos if rotulos else None),
                    'data_tem_likert': tem_likert.group(1) if tem_likert else None,
                })
            gabarito.setdefault(lado, {})[etapa] = {
                'secao': sid,
                'legenda': legenda,
                'grupos': grupos,
            }
    return gabarito, linhas_secoes


def contar_gabarito(gab):
    n_grupos = n_itens = n_outro = 0
    legendas = set()
    for lado in gab.values():
        for et in lado.values():
            if et['legenda']:
                legendas.add(' · '.join(et['legenda']))
            for g in et['grupos']:
                n_grupos += 1
                n_itens += len(g['itens'])
                n_outro += g['n_outro']
    return {'grupos': n_grupos, 'itens': n_itens, 'outro': n_outro,
            'legendas': len(legendas), 'legendas_lista': sorted(legendas)}


# --------------------------------------------------------------------------
# Item 2 — catalogo.js × gabarito
# --------------------------------------------------------------------------
def carregar_export(texto_js, nome):
    """Extrai `export const <nome> = {...};` como JSON."""
    m = re.search(r'export const ' + nome + r'\s*=\s*', texto_js)
    if not m:
        raise SystemExit(f'catalogo.js: export const {nome} não encontrado')
    ini = m.end()
    # objeto termina no `};` de fechamento do nível zero
    prof = 0
    em_str = False
    esc = False
    for i in range(ini, len(texto_js)):
        c = texto_js[i]
        if em_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                em_str = False
            continue
        if c == '"':
            em_str = True
        elif c == '{' or c == '[':
            prof += 1
        elif c == '}' or c == ']':
            prof -= 1
            if prof == 0:
                return json.loads(texto_js[ini:i + 1])
    raise SystemExit(f'catalogo.js: objeto {nome} não fechado')


def comparar_catalogo(catalogo, gab):
    difs = []
    forma_titulo = set()
    for lado in ['neg', 'pos']:
        for etapa in ETAPAS:
            cat = catalogo[lado][etapa]
            cod = gab[lado][etapa]
            ref = f'{lado}.{etapa}'
            # legenda e rótulo da seção
            leg_cod = cod['legenda']
            if cat['legenda'] != leg_cod:
                difs.append(f'{ref} legenda: catálogo={cat["legenda"]} · código={leg_cod}')
            rot_cod = sorted(set(g['rotulo'] for g in cod['grupos'] if g['rotulo']))
            rot_cod = rot_cod[0] if len(rot_cod) == 1 else (rot_cod if rot_cod else None)
            if cat['rotulo'] != rot_cod:
                difs.append(f'{ref} rótulo: catálogo={cat["rotulo"]!r} · código={rot_cod!r}')
            # grupos
            gc, gk = cat['grupos'], cod['grupos']
            if len(gc) != len(gk):
                difs.append(f'{ref} número de grupos: catálogo={len(gc)} · código={len(gk)}')
            for i in range(max(len(gc), len(gk))):
                if i >= len(gc):
                    difs.append(f'{ref} grupo {i+1} só no código: {gk[i]["chave"]}')
                    continue
                if i >= len(gk):
                    difs.append(f'{ref} grupo {i+1} só no catálogo: {gc[i]["chave"]}')
                    continue
                c, k = gc[i], gk[i]
                pref = f'{ref} grupo {i+1} ({c["chave"]})'
                if c['chave'] != k['chave']:
                    difs.append(f'{pref} chave: catálogo={c["chave"]} · código={k["chave"]}')
                t_num = f'{c["n"]}. {c["titulo"]}'
                if k['titulo'] == t_num:
                    forma_titulo.add('numerado ("N. Título")')
                elif k['titulo'] == c['titulo']:
                    forma_titulo.add('puro ("Título")')
                else:
                    difs.append(f'{pref} título: catálogo={t_num!r} · código={k["titulo"]!r}')
                if c['desc'] != k['desc']:
                    difs.append(f'{pref} descrição: catálogo={c["desc"]!r} · código={k["desc"]!r}')
                if c['itens'] != k['itens']:
                    so_cat = [x for x in c['itens'] if x not in k['itens']]
                    so_cod = [x for x in k['itens'] if x not in c['itens']]
                    if so_cat or so_cod:
                        difs.append(f'{pref} itens: só no catálogo={so_cat} · só no código={so_cod}')
                    else:
                        difs.append(f'{pref} itens: mesma lista em ordem diferente')
                if c['outro'] != k['outro'] or c['outroDica'] != k['outroDica']:
                    difs.append(f'{pref} Outro: catálogo={c["outro"]!r}/{c["outroDica"]!r} · código={k["outro"]!r}/{k["outroDica"]!r}')
    return difs, sorted(forma_titulo)


# --------------------------------------------------------------------------
# Item 3 — Textos
# --------------------------------------------------------------------------
RE_QUOTED = re.compile(r'"([^"\n]{2,}?)"')


def strings_recursivas(obj, saida):
    if isinstance(obj, str):
        saida.append(obj)
    elif isinstance(obj, list):
        for x in obj:
            strings_recursivas(x, saida)
    elif isinstance(obj, dict):
        for x in obj.values():
            strings_recursivas(x, saida)


NOMES_DE_SECAO = {'Proposta', 'O que fica igual', 'Hoje'}


def eh_codigo_ou_nome(s):
    """Filtros do prompt: tokens --x, nomes de arquivo, códigos AUT-nn, trechos de código."""
    if s.startswith('--') or s.startswith('var(--'):
        return True
    if re.search(r'\.(md|css|js|svg|html|png|jpg|pdf)\b', s):
        return True
    if re.fullmatch(r'AUT-\d+[a-z]?', s):
        return True
    if s.startswith('i-') or s.startswith('#i-'):
        return True
    if re.search(r'(=|\{|\}|</?\w+>|\baria-|\brole\b|\bgrid\b|\bflex\b|\brepeat\(|\bminmax\(|\d ?px\b|\(\)|×)', s):
        return True
    if re.search(r'\b[A-Z][a-z]+[A-Z][a-z]+', s):   # nome de componente (CamelCase)
        return True
    if s in ('…', '...') or s in NOMES_DE_SECAO:
        return True
    return False


def eh_fragmento(s):
    """Sobra de aspas aninhadas no Markdown: começa por pontuação de continuação, traz negrito,
    começa em minúscula (meio de frase) ou termina em preposição/vírgula/ponto-e-vírgula."""
    if re.match(r'^[(),.;]', s) or '**' in s:
        return True
    nucleo = re.sub(r'^[+·]\s+', '', s)
    if nucleo and nucleo[0].islower():
        return True
    if re.search(r'(;|,|\b(com|de|do|da|e|ou|em|a|o|para|por|que)\.?)$', s):
        return True
    return False


def strings_md_entre_aspas(texto_md):
    """Todas as strings entre aspas retas (fora de `código`), já sem tokens/arquivos/códigos.
    Fragmentos de aspas aninhadas só são descartados depois de tentar encontrá-los
    (um rótulo em minúscula como "editar" é texto legítimo)."""
    saida = []
    for ln in texto_md.split('\n'):
        ln = re.sub(r'`[^`]*`', '', ln)
        for m in RE_QUOTED.finditer(ln):
            s = m.group(1).strip()
            if s and not eh_codigo_ou_nome(s):
                saida.append(s)
    return saida


RE_PLACEHOLDER_N = re.compile(r'(^|[^\w])N([^\w]|$)')
RE_DATA_HORA = re.compile(r'\d{1,2}/\d{2}|\d{1,2}:\d{2}')
RE_MARCADO = re.compile(r'^\d+ marcad[oa]s?$')
RE_ETAPA_N = re.compile(r'^Etapa \d+ de 5 · (.+)$')
RE_BLOCO_CONTAGEM = re.compile(r'^([^·]+?) · \d+$')
SEPARADORES_COMPOSTO = re.compile(r' · |/|: ')


def classificar_texto(s, existe_dev, existe_prop):
    """Devolve (categoria, detalhe). Ordem: literal → proposta → aceito → caixa alta →
    modelo (N / etapa / contagem) → data-hora de exemplo → abreviado (…) → composto → sem origem."""
    if existe_dev(s):
        return 'index-dev', ''
    if existe_prop(s):
        return 'proposta', ''
    if s in TEXTOS_ACEITOS:
        return 'aceito', ''
    low = s.lower()
    if s != low and (existe_dev(low, ci=True) or existe_prop(low, ci=True)):
        return 'caixa-alta', 'só a caixa difere (text-transform, LEIA-ME dúvida 5)'
    if RE_PLACEHOLDER_N.search(s) or 'Nome da próxima etapa' in s or 'nome completo' in s:
        return 'modelo', 'placeholder N / nome'
    if RE_MARCADO.match(s):
        return 'modelo', 'instância de "N marcado(s)"'
    m = RE_ETAPA_N.match(s)
    if m and (existe_dev(m.group(1)) or existe_prop(m.group(1))):
        return 'modelo', 'instância de "Etapa N de 5 · nome"'
    m = RE_BLOCO_CONTAGEM.match(s)
    if m and (existe_dev(m.group(1).lower(), ci=True) or existe_prop(m.group(1).lower(), ci=True)):
        return 'modelo', 'instância de "RÓTULO · N"'
    if s.endswith(' ›'):
        base = s[:-2].strip()
        if base and (existe_dev(base) or existe_prop(base)):
            return 'modelo', 'instância de "Nome da próxima etapa ›"'
    if RE_DATA_HORA.search(s):
        return 'exemplo', 'data/hora de exemplo da prancha'
    if s.endswith('…'):
        base = s[:-1].strip()
        if base and (existe_dev(base) or existe_prop(base)):
            return 'abreviado', 'texto existente cortado com …'
    partes = [p.strip(' +‹›…') for p in SEPARADORES_COMPOSTO.split(s)]
    partes = [p for p in partes if p]
    if len(partes) > 1 and all(existe_dev(p) or existe_prop(p) or existe_dev(p.lower(), ci=True) or p in TEXTOS_ACEITOS for p in partes):
        return 'composto', 'todas as partes existem: ' + ' | '.join(partes)
    if eh_fragmento(s):
        return 'fragmento', 'sobra de aspas aninhadas do Markdown'
    return 'sem_origem', ''


def coluna_proposta(texto_textos):
    """Strings entre aspas da coluna 'Proposta' (3ª) das tabelas de 16.5_textos_interface.md."""
    saida = set()
    for ln in texto_textos.split('\n'):
        if not ln.startswith('|'):
            continue
        cols = [c.strip() for c in ln.strip().strip('|').split('|')]
        if len(cols) < 3 or cols[0] in ('Onde', 'Motivo', 'Texto da prancha') or set(cols[0]) <= set('-'):
            continue
        prop = cols[2]
        for m in RE_QUOTED.finditer(prop):
            saida.add(m.group(1).strip())
        # também a célula inteira sem aspas (ex.: propostas curtas)
        saida.add(prop.strip().strip('"'))
    return saida


def conferir_textos(catalogo_js, telas_md, comp_md, textos_md, html_dev):
    textos_obj = carregar_export(catalogo_js, 'textos')
    lista = []
    strings_recursivas(textos_obj, lista)
    fontes = [('catalogo.js:textos', s) for s in lista]
    fontes += [('02_telas.md', s) for s in strings_md_entre_aspas(telas_md)]
    fontes += [('03_componentes.md', s) for s in strings_md_entre_aspas(comp_md)]

    dev_un = html.unescape(html_dev)
    dev_norm = re.sub(r'\s+', ' ', dev_un)
    dev_low = dev_norm.lower()
    proposta = coluna_proposta(textos_md)
    proposta_txt = '\n'.join(sorted(proposta))
    proposta_low = proposta_txt.lower()

    def existe_dev(s, ci=False):
        s2 = re.sub(r'\s+', ' ', s)
        if ci:
            return s2.lower() in dev_low
        return (s in html_dev) or (s in dev_un) or (s2 in dev_norm)

    def existe_prop(s, ci=False):
        if ci:
            return s.lower() in proposta_low
        return (s in proposta) or (s in proposta_txt)

    vistos = set()
    categorias = ('index-dev', 'proposta', 'aceito', 'caixa-alta', 'modelo', 'exemplo', 'abreviado', 'composto', 'fragmento', 'sem_origem')
    resultado = {k: [] for k in categorias}
    for origem, s in fontes:
        if s in vistos:
            continue
        vistos.add(s)
        cat, det = classificar_texto(s, existe_dev, existe_prop)
        resultado[cat].append((origem, s, det))
    for k in categorias:
        resultado[k] = sorted(resultado[k], key=lambda x: (x[0], x[1]))
    resultado['fragmentos'] = [s for o, s, d in resultado['fragmento']]
    return resultado


# --------------------------------------------------------------------------
# Item 4 — Tokens
# --------------------------------------------------------------------------
RE_TOKEN = re.compile(r'(--[\w-]+)\s*:\s*([^;]+);')


def blocos_tokens(css):
    """Devolve (claro, escuro): dicionários nome→valor."""
    m_dark = re.search(r'@media\s*\(prefers-color-scheme:\s*dark\)\s*\{', css)
    if not m_dark:
        raise SystemExit('tokens: bloco escuro não encontrado')
    claro_txt = css[:m_dark.start()]
    escuro_txt = css[m_dark.end():]
    # o bloco escuro termina no fechamento do @media (duas chaves)
    prof = 1
    fim = None
    for i, c in enumerate(escuro_txt):
        if c == '{':
            prof += 1
        elif c == '}':
            prof -= 1
            if prof == 0:
                fim = i
                break
    escuro_txt = escuro_txt[:fim]

    def parse(txt):
        txt = re.sub(r'/\*.*?\*/', '', txt, flags=re.S)
        d = {}
        for nome, val in RE_TOKEN.findall(txt):
            d[nome] = re.sub(r'\s+', ' ', val).strip()
        return d
    return parse(claro_txt), parse(escuro_txt)


def diff_tokens(design, repo):
    novo = sorted(set(design) - set(repo))
    sumiu = sorted(set(repo) - set(design))
    mudou = sorted(n for n in set(design) & set(repo) if design[n] != repo[n])
    return novo, mudou, sumiu


RE_VAR = re.compile(r'var\((--[\w-]+)')
RE_HEX = re.compile(r'#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![0-9A-Za-z_-])')


def separar_template(pranchas_html):
    """Lição 76: as telas vivem em <script type="__bundler/template">; o resto é o
    cromo do visualizador (estilos da página, selos, caixa de erro do bundler)."""
    m = re.search(r'<script type="__bundler/template">(.*?)</script>', pranchas_html, re.S)
    if not m:
        raise SystemExit('01_pranchas_16.5.html: bloco __bundler/template não encontrado')
    telas = m.group(1)
    cromo = pranchas_html[:m.start()] + pranchas_html[m.end():]
    return telas, cromo


def cores_fora(texto, valores_hex, rgba_tokens):
    hex_fora = {}
    for h in RE_HEX.findall(texto):
        hu = h.upper()
        if hu not in valores_hex:
            hex_fora[hu] = hex_fora.get(hu, 0) + 1
    rgba_fora = {}
    for m in re.finditer(r'rgba?\([^)]*\)', texto):
        if m.group(0) not in rgba_tokens:
            rgba_fora[m.group(0)] = rgba_fora.get(m.group(0), 0) + 1
    return dict(sorted(hex_fora.items())), dict(sorted(rgba_fora.items()))


def conferir_pranchas(pranchas_html, claro, escuro):
    telas, cromo = separar_template(pranchas_html)
    usados = sorted(set(RE_VAR.findall(pranchas_html)))
    declarados = set(claro) | set(escuro)
    faltam = [u for u in usados if u not in declarados]
    valores = set()
    rgba_tokens = set()
    for d in (claro, escuro):
        for v in d.values():
            for h in RE_HEX.findall(v):
                valores.add(h.upper())
            for m in re.finditer(r'rgba?\([^)]*\)', v):
                rgba_tokens.add(m.group(0))
    hex_telas, rgba_telas = cores_fora(telas, valores, rgba_tokens)
    hex_cromo, rgba_cromo = cores_fora(cromo, valores, rgba_tokens)
    return usados, faltam, hex_telas, rgba_telas, hex_cromo, rgba_cromo


# --------------------------------------------------------------------------
# Item 5 — Rostinhos
# --------------------------------------------------------------------------
def conferir_rostinhos(svg, ids_sprite, html_sprite=None):
    difs = []
    simbolos = re.findall(r'<symbol\s+([^>]*)>(.*?)</symbol>', svg, re.S)
    ids = []
    for attrs, corpo in simbolos:
        mid = re.search(r'id="([^"]+)"', attrs)
        mvb = re.search(r'viewBox="([^"]+)"', attrs)
        sid = mid.group(1) if mid else '(sem id)'
        ids.append(sid)
        if not mvb or mvb.group(1) != '0 0 24 24':
            difs.append(f'{sid}: viewBox={mvb.group(1) if mvb else None!r} (esperado "0 0 24 24")')
        filhos = re.findall(r'<(\w+)', corpo)
        for f in filhos:
            if f not in ('circle', 'path'):
                difs.append(f'{sid}: elemento {f} (só circle/path permitidos)')
        if re.search(r'\b(fill|stroke)\s*=', corpo) or re.search(r'\b(fill|stroke)\s*=', attrs):
            difs.append(f'{sid}: fill/stroke próprio (deve herdar currentColor do sprite)')
        if 'style=' in corpo:
            difs.append(f'{sid}: atributo style dentro do símbolo')
    esperados = [f'i-humor-{i}' for i in range(1, 6)]
    if ids != esperados:
        difs.append(f'ids={ids} (esperado {esperados})')
    # Pendências 16.5: desde o 16.5b os rostinhos ESTÃO no sprite. Id já existente só é problema se o
    # desenho divergir; igual = "já no sprite".
    def norm(markup):
        m = re.sub(r'\s+', ' ', markup).replace('></circle>', '/>').replace('></path>', '/>').replace(' />', '/>')
        return m.strip()
    ja_no_sprite = []
    for attrs, corpo in simbolos:
        mid = re.search(r'id="([^"]+)"', attrs)
        if not mid or mid.group(1) not in ids_sprite:
            continue
        sid = mid.group(1)
        m_dev = re.search(r'<symbol id="' + re.escape(sid) + r'"[^>]*>(.*?)</symbol>', html_sprite or '', re.S)
        if m_dev and norm(m_dev.group(1)) == norm(corpo):
            ja_no_sprite.append(sid)
        else:
            difs.append(f'{sid}: já existe no sprite de index-dev.html com desenho DIFERENTE do 05_rostinhos.svg')
    tem_metadata = bool(re.search(r'<metadata>.*?</metadata>', svg, re.S))
    return difs, ids, tem_metadata, ja_no_sprite


# --------------------------------------------------------------------------
# Item 6 — Ícones
# --------------------------------------------------------------------------
def conferir_icones(icones_js, ids_sprite):
    ic = carregar_export(icones_js, 'icones')
    ids = list(ic.keys())
    faltam = [i for i in ids if i not in ids_sprite]
    faltam_sem_humor = [i for i in faltam if not i.startswith('i-humor-')]
    return ids, faltam, faltam_sem_humor


# --------------------------------------------------------------------------
# Item 7 — Referência 25/09 (dimensões por cabeçalho)
# --------------------------------------------------------------------------
def dimensoes_imagem(caminho):
    with open(caminho, 'rb') as f:
        dados = f.read()
    if dados[:8] == b'\x89PNG\r\n\x1a\n':
        w, h = struct.unpack('>II', dados[16:24])
        return 'PNG', w, h
    if dados[:2] == b'\xff\xd8':
        i = 2
        while i < len(dados):
            if dados[i] != 0xFF:
                i += 1
                continue
            marker = dados[i + 1]
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                i += 2
                continue
            seg_len = struct.unpack('>H', dados[i + 2:i + 4])[0]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                h, w = struct.unpack('>HH', dados[i + 5:i + 9])
                return 'JPEG', w, h
            i += 2 + seg_len
        return 'JPEG', None, None
    return 'desconhecido', None, None


def conferir_referencia(pasta_ref):
    difs = []
    linhas = []
    existentes = sorted(os.listdir(pasta_ref)) if os.path.isdir(pasta_ref) else []
    esperados = [r[0] for r in REFERENCIA_TELAS]
    for extra in existentes:
        if extra not in esperados:
            difs.append(f'arquivo fora da lista do brief: {extra}')
    for arq, prancha, situacao in REFERENCIA_TELAS:
        p = os.path.join(pasta_ref, arq)
        if not os.path.exists(p):
            difs.append(f'arquivo ausente: {arq}')
            linhas.append((arq, '—', '—', prancha, situacao))
            continue
        tipo, w, h = dimensoes_imagem(p)
        linhas.append((arq, tipo, f'{w}×{h}' if w else '?', prancha, situacao))
    return difs, linhas, len(existentes)


# --------------------------------------------------------------------------
# Relatório
# --------------------------------------------------------------------------
def md_lista(itens, vazio='(nenhum)'):
    if not itens:
        return f'- {vazio}\n'
    return ''.join(f'- {x}\n' for x in itens)


def main():
    pasta = sys.argv[1] if len(sys.argv) > 1 else os.path.join('docs', 'design', '16.5')
    pasta = pasta.rstrip('/\\')
    raiz = os.getcwd()
    p = lambda *a: os.path.join(pasta, *a)

    # Pacote 16.5 (pendências): a mesma chamada serve à rodada 2 (docs/design/16.5) e à rodada 3
    # (pasta da entrega). Nomes "_v3" valem como equivalentes; o que a rodada 3 não reenvia
    # (tokens, ícones, rostinhos, textos, referência 25/09) vem de docs/design/16.5, e a saída diz isso.
    BASE_R2 = os.path.join('docs', 'design', '16.5')
    eh_base_r2 = os.path.normcase(os.path.abspath(pasta)) == os.path.normcase(os.path.abspath(BASE_R2))

    def um_dos(*nomes):
        for n in nomes:
            if os.path.exists(p(n)):
                return n
        return None

    pranchas_nome = um_dos('01_pranchas_16.5_v3.html', '01_pranchas_16.5.html')
    contrato_nome = um_dos('06_contrato_de_leitura_v3.md', '06_contrato_de_leitura_v2.md')
    rodada3 = bool(um_dos('01_pranchas_16.5_v3.html') or um_dos('06_contrato_de_leitura_v3.md'))
    faltando = []
    for f in ('00_LEIA-ME.md', '02_telas.md', '03_componentes.md', 'catalogo.js'):
        if not os.path.exists(p(f)):
            faltando.append(f)
    if not pranchas_nome:
        faltando.append('01_pranchas_16.5_v3.html ou 01_pranchas_16.5.html')
    if not contrato_nome:
        faltando.append('06_contrato_de_leitura_v3.md ou 06_contrato_de_leitura_v2.md')
    if rodada3 and not os.path.isdir(p('01_png')):
        faltando.append('01_png/ (obrigatório na rodada 3)')
    if faltando:
        raise SystemExit(f'Arquivo(s) obrigatório(s) ausente(s) em {pasta}: ' + ', '.join(faltando))
    for f in ('index-dev.html', os.path.join('docs', 'design', 'tokens.css')):
        if not os.path.exists(f):
            raise SystemExit(f'Arquivo do repositório ausente: {f} (rodar a partir da raiz)')

    emprestados = []  # (nome, origem) do que veio de docs/design/16.5

    def ler_ou_base(nome):
        if os.path.exists(p(nome)):
            return ler(p(nome))
        if os.path.exists(os.path.join(BASE_R2, nome)):
            emprestados.append(nome)
            return ler(os.path.join(BASE_R2, nome))
        raise SystemExit(f'Arquivo ausente na pasta e em {BASE_R2}: {nome}')

    html_dev = ler('index-dev.html')
    tokens_repo = ler(os.path.join('docs', 'design', 'tokens.css'))
    catalogo_js = ler(p('catalogo.js'))
    icones_js = ler_ou_base('icones.js')
    telas_md = ler(p('02_telas.md'))
    comp_md = ler(p('03_componentes.md'))
    textos_md = ler_ou_base('16.5_textos_interface.md')
    tokens_design = ler_ou_base('04_tokens.css')
    rostinhos = ler_ou_base('05_rostinhos.svg')
    pranchas = ler(p(pranchas_nome))
    pasta_ref = p('referencia_25-09') if os.path.isdir(p('referencia_25-09')) else os.path.join(BASE_R2, 'referencia_25-09')
    if not os.path.isdir(p('referencia_25-09')):
        emprestados.append('referencia_25-09/')

    ids_sprite = re.findall(r'<symbol id="(i-[a-z0-9-]+)"', html_dev)

    saida = []
    resumo = []
    falha_topo = []

    # ---- 0 (pendências 16.5): o catálogo da entrega tem de ser byte a byte o da rodada 2
    saida.append('## 0. Catálogo idêntico à rodada 2 (`catalogo.js` × `docs/design/16.5/catalogo.js`)\n\n')
    if eh_base_r2:
        saida.append('**IGUAL** — a pasta conferida é a própria rodada 2 (mesmo arquivo).\n\n')
        resumo.append('0 Catálogo: IGUAL (mesmo arquivo)')
    else:
        with open(p('catalogo.js'), 'rb') as f1, open(os.path.join(BASE_R2, 'catalogo.js'), 'rb') as f2:
            b1, b2 = f1.read(), f2.read()
        if b1 == b2:
            saida.append(f'**IGUAL** — {len(b1)} bytes, idêntico ao da rodada 2.\n\n')
            resumo.append('0 Catálogo: IGUAL')
        else:
            l1 = b1.decode('utf-8', 'replace').split('\n')
            l2 = b2.decode('utf-8', 'replace').split('\n')
            divergentes = []
            for i in range(max(len(l1), len(l2))):
                a = l1[i] if i < len(l1) else '(fim do arquivo)'
                b = l2[i] if i < len(l2) else '(fim do arquivo)'
                if a != b:
                    divergentes.append(f'linha {i + 1}: entrega=`{a.strip()[:100]}` · rodada 2=`{b.strip()[:100]}`')
                if len(divergentes) >= 5:
                    break
            saida.append(f'**FALHA** — {len(b1)} bytes na entrega × {len(b2)} bytes na rodada 2. Primeiras linhas divergentes:\n' + md_lista(divergentes) + '\n')
            resumo.append('0 Catálogo: FALHA (diferente da rodada 2)')
            falha_topo.append('FALHA no item 0: o catalogo.js da entrega difere do da rodada 2 — o conteúdo clínico não pode mudar. ' + ' | '.join(divergentes[:2]))

    # ---- 1
    gab, linhas_secoes = extrair_gabarito(html_dev)
    cont = contar_gabarito(gab)
    difs1 = []
    for k in ('grupos', 'itens', 'outro', 'legendas'):
        if cont[k] != ESPERADO[k]:
            difs1.append(f'{k}: {cont[k]} (esperado {ESPERADO[k]})')
    rot_neg = [gab['neg'][e]['grupos'][0]['rotulo'] for e in ('emo', 'fis', 'pens')]
    rot_pos = [gab['pos'][e]['grupos'][0]['rotulo'] for e in ('emo', 'fis', 'pens')]
    if rot_neg != ['Desconforto:', 'Mal-estar:', 'Acredito:']:
        difs1.append(f'rótulos negativo: {rot_neg}')
    if rot_pos != ['Conforto:', 'Bem-estar:', 'Acredito:']:
        difs1.append(f'rótulos positivo: {rot_pos}')
    for lado in ('neg', 'pos'):
        for et in ETAPAS:
            for g in gab[lado][et]['grupos']:
                if g['n_outro'] != 1:
                    difs1.append(f'{g["chave"]}: {g["n_outro"]} campos "Outro"')
                if isinstance(g['rotulo'], list):
                    difs1.append(f'{g["chave"]}: rótulos de intensidade mistos {g["rotulo"]}')
    if gab['pos']['sit']['grupos']:
        difs1.append(f'pos.sit tem {len(gab["pos"]["sit"]["grupos"])} grupos (esperado 0, débito 8.6)')
    gravar(p('gabarito_codigo.json'), json.dumps(gab, ensure_ascii=False, indent=2, sort_keys=True) + '\n')
    saida.append('## 1. Gabarito do código (`gabarito_codigo.json`)\n\n')
    saida.append(f'**{secao_status(difs1)}** — {cont["grupos"]} grupos · {cont["itens"]} itens · {cont["outro"]} "Outro" · {cont["legendas"]} legendas\n\n')
    saida.append('Legendas encontradas:\n' + md_lista(cont['legendas_lista']))
    saida.append(f'\nRótulos de intensidade — negativo: {rot_neg} · positivo: {rot_pos}\n\n')
    saida.append('Seções (linha inicial–final em `index-dev.html`, total de linhas):\n\n| Seção | Início | Fim | Linhas | Grupos | Itens |\n|---|---|---|---|---|---|\n')
    for lado in ('neg', 'pos'):
        for et in ETAPAS:
            s = gab[lado][et]
            ls = linhas_secoes[s['secao']]
            saida.append(f'| `{s["secao"]}` | {ls["inicio"]} | {ls["fim"]} | {ls["total"]} | {len(s["grupos"])} | {sum(len(g["itens"]) for g in s["grupos"])} |\n')
    if difs1:
        saida.append('\nDiferenças:\n' + md_lista(difs1))
    saida.append('\n')
    resumo.append(f'1 Gabarito: {secao_status(difs1)} ({cont["grupos"]} · {cont["itens"]} · {cont["outro"]} · {cont["legendas"]})')

    # ---- 2
    catalogo = carregar_export(catalogo_js, 'catalogo')
    difs2, forma = comparar_catalogo(catalogo, gab)
    saida.append('## 2. `catalogo.js` × gabarito\n\n')
    saida.append(f'**{secao_status(difs2)}** — forma do título no código: {", ".join(forma) if forma else "(indeterminada)"}\n\n')
    if difs2:
        saida.append(md_lista(difs2))
    saida.append('\n')
    resumo.append(f'2 Catálogo × gabarito: {secao_status(difs2)}')

    # ---- 3
    r3 = conferir_textos(catalogo_js, telas_md, comp_md, textos_md, html_dev)
    saida.append('## 3. Textos (`textos` do catalogo.js + strings entre aspas de 02/03)\n\n')
    n = {k: len(v) for k, v in r3.items()}
    saida.append(f'**{secao_status(r3["sem_origem"])}** — {n["index-dev"]} existem em `index-dev.html` · {n["proposta"]} na coluna "Proposta" · {n["aceito"]} aceitos pelo usuário · '
                 f'{n["caixa-alta"]} só caixa alta · {n["modelo"]} modelos com N · {n["exemplo"]} data/hora de exemplo · {n["abreviado"]} abreviados · {n["composto"]} compostos · **{n["sem_origem"]} sem origem**\n\n')
    saida.append('**Sem origem** (não estão em `index-dev.html`, nem na coluna "Proposta", nem na lista aceita):\n' + md_lista([f'`{o}` — "{s}"' for o, s, d in r3['sem_origem']]))
    saida.append('\nAceitos pelo usuário (não são erro):\n' + md_lista([f'"{s}"' for o, s, d in r3['aceito']]))
    saida.append('\nSó a caixa difere (o Design usa `text-transform`; LEIA-ME, dúvida 5):\n' + md_lista([f'"{s}"' for o, s, d in r3['caixa-alta']]))
    saida.append('\nModelos com placeholder ou instância de modelo ("N marcado(s)", "Etapa N de 5 · nome", "RÓTULO · N"):\n' + md_lista([f'"{s}" — {d}' for o, s, d in r3['modelo']]))
    saida.append('\nData/hora de exemplo da prancha:\n' + md_lista([f'"{s}"' for o, s, d in r3['exemplo']]))
    saida.append('\nTexto existente abreviado com "…":\n' + md_lista([f'"{s}"' for o, s, d in r3['abreviado']]))
    saida.append('\nCompostos de partes que existem (separadores " · ", "/", ": "):\n' + md_lista([f'"{s}" — {d}' for o, s, d in r3['composto']]))
    saida.append('\nNa coluna "Proposta" (texto novo previsto no arquivo de textos):\n' + md_lista([f'"{s}"' for o, s, d in r3['proposta']]))
    saida.append('\nFragmentos de aspas aninhadas do Markdown, ignorados (não são textos de interface):\n' + md_lista([f'"{s}"' for s in r3['fragmentos']]))
    saida.append('\n')
    resumo.append(f'3 Textos: {n["sem_origem"]} sem origem (além dos {n["aceito"]} aceitos)')

    # ---- 4
    d_claro, d_escuro = blocos_tokens(tokens_design)
    r_claro, r_escuro = blocos_tokens(tokens_repo)
    difs4 = []
    saida.append('## 4. Tokens (`04_tokens.css` × `docs/design/tokens.css`)\n\n')
    for nome, D, R in (('claro', d_claro, r_claro), ('escuro', d_escuro, r_escuro)):
        novo, mudou, sumiu = diff_tokens(D, R)
        saida.append(f'### Tema {nome}\n\n')
        saida.append('NOVO (entram no 16.5b, mesclados):\n' + md_lista([f'`{n}`: `{D[n]}`' for n in novo]))
        saida.append('\nMUDOU (16.4.5 troca só as linhas de fonte/peso):\n' + md_lista([f'`{n}`: `{R[n]}` → `{D[n]}`' for n in mudou]))
        saida.append('\nSUMIU no arquivo do Design — **ficam** no repositório (ganhos após 17/09):\n' + md_lista([f'`{n}`: `{R[n]}`' for n in sumiu]))
        saida.append('\n')
        if nome == 'claro':
            # Pendências 16.5: depois do 16.4.5 e do 16.5b, os NOVO/MUDOU esperados já estão no repositório;
            # "já aplicado, igual ao Design" não é diferença — só é se o valor divergir ou faltar nos dois.
            ja_aplicados = []
            for n in TOKENS_NOVOS_ESPERADOS:
                if n in novo:
                    continue
                if n in R and n in D and R[n] == D[n]:
                    ja_aplicados.append(n)
                else:
                    difs4.append(f'esperado NOVO não encontrado (nem já mesclado com o mesmo valor): {n}')
            for n in novo:
                if n not in TOKENS_NOVOS_ESPERADOS:
                    difs4.append(f'NOVO não previsto no prompt: {n}')
            for n in TOKENS_MUDOU_ESPERADOS:
                if n in mudou:
                    continue
                if n in R and n in D and R[n] == D[n]:
                    ja_aplicados.append(n)
                else:
                    difs4.append(f'esperado MUDOU não encontrado (nem já aplicado com o mesmo valor): {n}')
            for n in mudou:
                if n not in TOKENS_MUDOU_ESPERADOS:
                    difs4.append(f'MUDOU não previsto no prompt: {n}')
            saida.append('Já aplicados no repositório com o mesmo valor do Design (16.4.5 / 16.5b):\n' + md_lista([f'`{n}`' for n in ja_aplicados]) + '\n')
    usados, faltam, hex_telas, rgba_telas, hex_cromo, rgba_cromo = conferir_pranchas(pranchas, d_claro, d_escuro)
    saida.append('### Pranchas (`01_pranchas_16.5.html`)\n\n')
    saida.append('As telas vivem no `<script type="__bundler/template">` (lição 76); o resto do arquivo é o cromo do visualizador do pacote e não entra no app.\n\n')
    saida.append(f'`var(--x)` usados no arquivo: {len(usados)}; não declarados em `04_tokens.css`:\n' + md_lista([f'`{u}`' for u in faltam]))
    saida.append('\n**Dentro das telas** — `#hex` fora dos valores de `04_tokens.css` (ocorrências):\n' + md_lista([f'`#{h}` × {n}' for h, n in hex_telas.items()]))
    saida.append('\n**Dentro das telas** — `rgb()/rgba()` fora dos tokens (ocorrências):\n' + md_lista([f'`{k}` × {n}' for k, n in rgba_telas.items()]))
    saida.append('\nFora das telas (cromo do visualizador; informativo, não conta como diferença):\n' + md_lista(
        [f'`#{h}` × {n}' for h, n in hex_cromo.items()] + [f'`{k}` × {n}' for k, n in rgba_cromo.items()]))
    for u in faltam:
        difs4.append(f'var() sem token: {u}')
    for h, n in hex_telas.items():
        difs4.append(f'hex fora dos tokens nas telas: #{h} ×{n}')
    for k, n in rgba_telas.items():
        difs4.append(f'rgba fora dos tokens nas telas: {k} ×{n}')
    saida.append(f'\n**{secao_status(difs4)}**\n')
    if difs4:
        saida.append(md_lista(difs4))
    saida.append('\n')
    resumo.append(f'4 Tokens: {secao_status(difs4)}')

    # ---- 5
    difs5, ids5, tem_meta, ja5 = conferir_rostinhos(rostinhos, ids_sprite, html_dev)
    saida.append('## 5. Rostinhos (`05_rostinhos.svg`)\n\n')
    saida.append(f'**{secao_status(difs5)}** — símbolos: {ids5}; bloco `<metadata>` (C2PA) presente: {"sim" if tem_meta else "não"} — é descartado na importação para o sprite.\n\n')
    if ja5:
        saida.append('Já no sprite de `index-dev.html` com o mesmo desenho (16.5b): ' + ', '.join(f'`{i}`' for i in ja5) + '.\n\n')
    if difs5:
        saida.append(md_lista(difs5))
    saida.append('\n')
    resumo.append(f'5 Rostinhos: {secao_status(difs5)}')

    # ---- 6
    ids6, faltam6, faltam6_sh = conferir_icones(icones_js, ids_sprite)
    saida.append('## 6. Ícones (`icones.js` × sprite de `index-dev.html`)\n\n')
    saida.append(f'**{secao_status(faltam6_sh)}** — {len(ids6)} ids em icones.js; sprite tem {len(ids_sprite)} símbolos.\n\n')
    saida.append('Ausentes do sprite (esperado: só `i-humor-1..5`, que entram no 16.5b):\n' + md_lista([f'`{i}`' for i in faltam6]))
    saida.append('\nAusentes além de `i-humor-*`:\n' + md_lista([f'`{i}`' for i in faltam6_sh]))
    saida.append('\n')
    resumo.append(f'6 Ícones: {secao_status(faltam6_sh)} (faltam só {", ".join(faltam6) if faltam6 else "nenhum"})')

    # ---- 7
    difs7, linhas7, n_ref = conferir_referencia(pasta_ref)
    saida.append('## 7. Referência 25/09 × entrega da rodada 2\n\n')
    saida.append(f'**{secao_status(difs7)}** — {n_ref} arquivos em `referencia_25-09/`.\n\n')
    saida.append('| Arquivo | Tipo | Dimensões | Prancha rodada 2 | Situação |\n|---|---|---|---|---|\n')
    for arq, tipo, dim, prancha, sit in linhas7:
        saida.append(f'| `{arq}` | {tipo} | {dim} | {prancha} | {sit} |\n')
    saida.append('\nAprovadas como estão, sem imagem de referência (não mudam na rodada 3): ' + ', '.join(APROVADAS_SEM_REFERENCIA) + '.\n')
    saida.append('\nAguardam a rodada 3: AUT-02, AUT-03 (fim da tela), AUT-03c (nova), AUT-04 a AUT-08, AUT-08p, AUT-11.\n')
    if difs7:
        saida.append('\n' + md_lista(difs7))
    saida.append('\n')
    resumo.append(f'7 Referência: {secao_status(difs7)} ({n_ref} arquivos)')

    # ---- 8 (pendências 16.5): componentes e telas novos da rodada 3
    # (o prompt chamou este item de "7"; aqui é 8 porque o 7 já era a referência 25/09 desde o 16.5a)
    comp_esperados = ['ListaSubgrupo', 'BarraDeslizante', 'MenuEtapas']
    comp_achados = {}
    for nome in comp_esperados:
        m = re.search(r'^#+ .*' + nome, comp_md, re.M)
        comp_achados[nome] = m.group(0).strip() if m else None
    telas_grafias = {
        'AUT-03c': [r'AUT-03c'],
        'AUT-04 do Positivo': [r'AUT-04p', r'AUT-04 · Positivo', r'AUT-04 do Positivo', r'AUT-04 Positivo', r'AUT-04 \(Positivo\)'],
    }
    telas_achadas = {}
    for nome, pads in telas_grafias.items():
        achou = None
        for pad in pads:
            m = re.search(pad, telas_md)
            if m:
                achou = m.group(0)
                break
        telas_achadas[nome] = achou
    ausentes = [n for n, v in comp_achados.items() if not v] + [n for n, v in telas_achadas.items() if not v]
    saida.append('## 8. Componentes e telas da rodada 3 (`03_componentes.md`, `02_telas.md`)\n\n')
    saida.append('Componentes (título de seção por grep):\n' + md_lista([f'`{n}`: ' + (f'encontrado — "{v}"' if v else 'ausente') for n, v in comp_achados.items()]))
    saida.append('\nTelas:\n' + md_lista([f'`{n}`: ' + (f'encontrado — grafia "{v}"' if v else 'ausente') for n, v in telas_achadas.items()]))
    if rodada3:
        difs8 = [f'ausente na rodada 3: {n}' for n in ausentes]
        saida.append(f'\n**{secao_status(difs8)}**\n')
        if difs8:
            saida.append(md_lista(difs8))
        resumo.append(f'8 Componentes da rodada 3: {secao_status(difs8)}')
    else:
        if ausentes:
            saida.append(f'\n**AVISO** — componentes da rodada 3 ausentes (esperado na rodada 2): {", ".join(ausentes)}.\n')
            resumo.append('8 Componentes da rodada 3: ausentes (esperado na rodada 2)')
        else:
            saida.append('\n**OK** — todos presentes.\n')
            resumo.append('8 Componentes da rodada 3: OK')
    saida.append('\n')

    # ---- PNG da rodada 3: nomes obrigatórios
    if rodada3:
        pngs = sorted(os.listdir(p('01_png'))) if os.path.isdir(p('01_png')) else []
        faltam_png = [x for x in ('AUT-03c', 'AUT-11') if not any(x in n for n in pngs)]
        saida.append(f'## 9. PNG da rodada 3 (`01_png/`)\n\n{len(pngs)} arquivos. ' + ('**OK** — `AUT-03c` e `AUT-11` presentes nos nomes.\n\n' if not faltam_png else f'**{len(faltam_png)} diferença(s)** — sem PNG com o nome: {", ".join(faltam_png)}.\n\n'))
        resumo.append(f'9 PNG rodada 3: ' + ('OK' if not faltam_png else f'{len(faltam_png)} diferença(s)') + f' ({len(pngs)} arquivos)')

    rodada_txt = 'rodada 3' if rodada3 else 'rodada 2'
    cabecalho = (f'# Conferência 16.5 — entrega do Design ({rodada_txt}) × `index-dev.html`\n\n'
                 f'Gerado por `scripts/conferir_entrega_16_5.py` sobre `{pasta.replace(os.sep, "/")}` '
                 f'(pranchas: `{pranchas_nome}`; contrato: `{contrato_nome}`). '
                 'Reexecutável e determinístico (sem data/hora no corpo).\n\n')
    if emprestados:
        cabecalho += 'Arquivos que a pasta não tem e vieram de `docs/design/16.5/`: ' + ', '.join(f'`{e}`' for e in emprestados) + '.\n\n'
    if falha_topo:
        cabecalho += '> **FALHA** — ' + ' '.join(falha_topo) + '\n\n'
    cabecalho += '| # | Item | Resultado |\n|---|---|---|\n'
    for r in resumo:
        num, resto = r.split(' ', 1)
        item, res = resto.split(': ', 1)
        cabecalho += f'| {num} | {item} | {res} |\n'
    cabecalho += '\n'
    nome_saida = 'CONFERENCIA_16_5a.md' if eh_base_r2 else 'CONFERENCIA_rodada3.md'
    gravar(p(nome_saida), cabecalho + ''.join(saida))

    for f in falha_topo:
        print('!!! ' + f)
    if emprestados:
        print('(emprestados de docs/design/16.5: ' + ', '.join(emprestados) + ')')
    for r in resumo:
        print(r)
    print(f'-> {p("gabarito_codigo.json")}')
    print(f'-> {p(nome_saida)}')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    main()
