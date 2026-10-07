#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/validar_index_dev.py — validação estática versionada de `index-dev.html` (Pacote 16.5-esteira, 28/09/2026).

Substitui o Python reescrito a cada sessão. Regras (CLAUDE.md, checklist "antes de entregar"):
  1. `node --check` de cada bloco `<script>` inline;
  2. tags balanceadas FORA dos blocos `<script>` e dos comentários HTML, por profundidade (nunca negativa; delta 0);
  3. toda `var(--x)` declarada (CSS, atributo style ou `setProperty`);
  4. zero hex fixo fora dos blocos `:root` (o `theme-color` do `<head>` não conta); `rgba()/rgb()` fora do `:root`
     é contado e NÃO pode aumentar em relação à referência;
  5. zero classe CSS sem uso (classe usada = nome aparece fora do `<style>`); as sem uso já existentes na
     referência são toleradas e listadas; classe NOVA sem uso é falha;
  6. nenhum `font-size` abaixo de 13 px; 7. zero emoji; 8. marcadores preservados; `fetch(` só em
     `chamarServidor` + ViaCEP; 9. verbos proibidos fora de comentários = 0;
 10. funções: nova sem chamador = falha; função removida que ainda é chamada = falha;
 11. contagens antes × depois (linhas, CRLF, classes, rgba, funções, blocos) contra `--ref` (git, default HEAD)
     ou contra a linha de base gravada por `--antes`.

Uso (raiz do repositório):
  python scripts/validar_index_dev.py                       # valida index-dev.html e compara com HEAD
  python scripts/validar_index_dev.py --antes               # grava a linha de base em ../VMC-offline/validar_index_dev_antes.json
  python scripts/validar_index_dev.py --depois              # compara com essa linha de base (além do --ref)
  python scripts/validar_index_dev.py --ref 4586d3a         # outra revisão como referência
  python scripts/validar_index_dev.py --json saida.json     # também grava o resultado em JSON
  --proibidos "Gravar,gravado,Sair sem gravar,Módulo 2"     (lista padrão)
Saída: uma linha por regra (OK / AVISO / FALHA), tabela antes × depois; código 1 se houver FALHA.
Python 3 puro; `git` e `node` no PATH.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from collections import Counter

MARCADORES = ['pevConstruirCacheSubitens', 'P5_STATE', 'autoFormatarHora', '.hidden', 'chamarServidor', 'VMC_ACOES_GRAVACAO']
TAGS = ['div', 'button', 'span', 'svg', 'p', 'h2', 'h1', 'h3', 'section', 'label', 'ul', 'li', 'a', 'form', 'header', 'main', 'nav', 'table', 'tr', 'td', 'th']
PROIBIDOS_PADRAO = 'Gravar,gravado,Sair sem gravar,Módulo 2'
RE_EMOJI = re.compile('[\U0001F300-\U0001FAFF☀-➿\U0001F000-\U0001F2FF]')
RE_HEX = re.compile(r'(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])')
RE_RGB = re.compile(r'\brgba?\(')
FUNCOES_VAZIAS_TOLERADAS = set()


# ------------------------------------------------------------------ utilidades
def raiz_repo():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ler_trabalho(caminho):
    with open(caminho, 'rb') as f:
        return f.read()


def ler_ref(ref, arquivo):
    try:
        return subprocess.run(['git', 'show', f'{ref}:{arquivo}'], cwd=raiz_repo(), capture_output=True, check=True).stdout
    except subprocess.CalledProcessError as e:
        raise SystemExit(f'git show {ref}:{arquivo} falhou: {e.stderr.decode("utf-8", "replace").strip()}')


def linha_de(texto, pos):
    return texto.count('\n', 0, pos) + 1


def apagar_spans(texto, spans):
    """Substitui os trechos por espaços (mantém posições e linhas)."""
    partes = []
    ultimo = 0
    for a, b in sorted(spans):
        if a < ultimo:
            continue
        partes.append(texto[ultimo:a])
        partes.append(re.sub(r'[^\n]', ' ', texto[a:b]))
        ultimo = b
    partes.append(texto[ultimo:])
    return ''.join(partes)


def spans_de(texto, padrao):
    return [(m.start(), m.end()) for m in re.finditer(padrao, texto, re.S | re.I)]


def sem_comentarios(texto):
    """Apaga comentários HTML, `/* */` e linhas `//` (fora de strings, de forma aproximada mas conservadora)."""
    spans = spans_de(texto, r'<!--.*?-->') + spans_de(texto, r'/\*.*?\*/')
    # comentários `//` (de linha inteira ou no fim da linha): só quando o `//` vem depois de espaço e o trecho
    # anterior da linha tem aspas balanceadas — assim 'https://' dentro de string e regex não são cortados
    pos = 0
    for linha in texto.split('\n'):
        for m in re.finditer(r'(?:^|(?<=\s))//', linha):
            antes = linha[:m.start()]
            if antes.count("'") % 2 == 0 and antes.count('"') % 2 == 0 and antes.count('`') % 2 == 0:
                spans.append((pos + m.start(), pos + len(linha)))
                break
        pos += len(linha) + 1
    return apagar_spans(texto, spans)


def blocos(texto):
    """Spans dos `<script>` inline (sem src), dos `<script src>` e dos `<style>`."""
    scripts, scripts_src, styles = [], [], []
    for m in re.finditer(r'<script\b([^>]*)>(.*?)</script>', texto, re.S | re.I):
        (scripts_src if re.search(r'\bsrc\s*=', m.group(1), re.I) else scripts).append((m.start(), m.end(), m.start(2), m.end(2)))
    for m in re.finditer(r'<style\b[^>]*>(.*?)</style>', texto, re.S | re.I):
        styles.append((m.start(), m.end(), m.start(1), m.end(1)))
    return scripts, scripts_src, styles


def fechar_chave(texto, pos_abre):
    """Índice do `}` que fecha o `{` em pos_abre (ignora chaves dentro de strings CSS simples)."""
    prof = 0
    i = pos_abre
    while i < len(texto):
        c = texto[i]
        if c == '{':
            prof += 1
        elif c == '}':
            prof -= 1
            if prof == 0:
                return i
        i += 1
    return len(texto) - 1


def spans_root(texto, styles):
    """Spans (no texto inteiro) dos blocos `:root { … }` dentro dos `<style>` (inclui o do @media escuro)."""
    spans = []
    for _, _, a, b in styles:
        css = texto[a:b]
        for m in re.finditer(r':root\s*\{', css):
            fim = fechar_chave(css, m.end() - 1)
            spans.append((a + m.start(), a + fim + 1))
    return spans


# ------------------------------------------------------------------ análises
def analisar(texto_bytes, arquivo, opcoes):
    crlf = texto_bytes.count(b'\r\n')
    texto = texto_bytes.decode('utf-8').replace('\r\n', '\n')
    linhas = texto.split('\n')
    R = {'arquivo': arquivo, 'linhas': len(linhas) - (1 if texto.endswith('\n') else 0), 'crlf': crlf, 'marcador': (linhas[1] if len(linhas) > 1 else '').strip()[:120]}
    scripts, scripts_src, styles = blocos(texto)
    R['blocos'] = {'script_inline': len(scripts), 'script_src': len(scripts_src), 'style': len(styles)}
    falhas, avisos = [], []

    # 1. node --check por bloco
    R['node_check'] = []
    for i, (_, _, a, b) in enumerate(scripts, 1):
        with tempfile.NamedTemporaryFile('w', suffix=f'_bloco{i}.js', delete=False, encoding='utf-8') as tmp:
            tmp.write(texto[a:b])
            nome = tmp.name
        try:
            p = subprocess.run(['node', '--check', nome], capture_output=True, text=True, encoding='utf-8', errors='replace')
            ok = p.returncode == 0
            R['node_check'].append({'bloco': i, 'linha': linha_de(texto, a), 'ok': ok, 'erro': '' if ok else p.stderr.strip()[:400]})
            if not ok:
                falhas.append(f'node --check falhou no bloco {i} (linha {linha_de(texto, a)}): {p.stderr.strip().splitlines()[-1] if p.stderr.strip() else "?"}')
        finally:
            os.unlink(nome)

    # 2. tags fora dos <script> e dos comentários HTML, por profundidade
    html_so = apagar_spans(texto, [(s[0], s[1]) for s in scripts + scripts_src] + spans_de(texto, r'<!--.*?-->'))
    R['tags'] = {}
    for tag in TAGS:
        abre = fecha = 0
        prof = 0
        prof_min = 0
        for m in re.finditer(r'<(/?)' + tag + r'(?=[\s>/])[^<>]*?(/?)>', html_so, re.I):
            if m.group(1):
                fecha += 1
                prof -= 1
            elif m.group(2) == '/':
                continue  # auto-fechada
            else:
                abre += 1
                prof += 1
            prof_min = min(prof_min, prof)
        if abre or fecha:
            R['tags'][tag] = {'abre': abre, 'fecha': fecha, 'delta': abre - fecha, 'prof_min': prof_min}
            if abre != fecha or prof_min < 0:
                falhas.append(f'tag <{tag}>: abre {abre} × fecha {fecha} (delta {abre - fecha}, profundidade mínima {prof_min})')

    # 3. var(--x) sem declaração
    css_txt = ''.join(texto[a:b] for _, _, a, b in styles)
    usadas = set(re.findall(r'var\(\s*(--[\w-]+)', texto))
    decl_css = set(re.findall(r'(--[\w-]+)\s*:', css_txt))
    decl_inline = set(re.findall(r'style\s*=\s*"[^"]*?(--[\w-]+)\s*:', texto)) | set(re.findall(r"style\s*=\s*'[^']*?(--[\w-]+)\s*:", texto))
    decl_runtime = set(re.findall(r"setProperty\(\s*['\"](--[\w-]+)", texto))
    sem_decl = sorted(usadas - decl_css - decl_inline - decl_runtime)
    R['vars'] = {'usadas': len(usadas), 'declaradas_css': len(decl_css), 'runtime': sorted(decl_runtime), 'sem_declaracao': sem_decl}
    if sem_decl:
        falhas.append('var() sem declaração: ' + ', '.join(sem_decl))

    # 4. cor fixa fora dos :root (hex = falha; rgba = contagem)
    if not opcoes.get('sem_cor'):
        fora = sem_comentarios(apagar_spans(texto, spans_root(texto, styles)))
        fora = re.sub(r'<meta\s+name="theme-color"[^>]*>', lambda m: ' ' * len(m.group(0)), fora)
        hexes = [(linha_de(fora, m.start()), m.group(0)) for m in RE_HEX.finditer(fora)]
        rgbs = [linha_de(fora, m.start()) for m in RE_RGB.finditer(fora)]
        R['cores'] = {'hex_fora_root': hexes, 'rgba_fora_root': len(rgbs), 'rgba_linhas': rgbs}
        if hexes:
            falhas.append(f'{len(hexes)} hex fixo(s) fora do :root: ' + ', '.join(f'{c} (l.{l})' for l, c in hexes[:12]))

        # 5. classes CSS sem uso
        css_sem_com = re.sub(r'/\*.*?\*/', ' ', css_txt, flags=re.S)
        seletores = re.sub(r'\{[^{}]*\}', ' ', css_sem_com)          # tira os blocos de declarações (1 nível)
        seletores = re.sub(r'\{[^{}]*\}', ' ', seletores)              # @media { seletor { } } → resta o seletor
        definidas = set(re.findall(r'\.(-?[_a-zA-Z][\w-]*)', seletores))
        fora_style = apagar_spans(texto, [(s[0], s[1]) for s in styles])
        tokens = set(re.findall(r'[A-Za-z_-][\w-]*', fora_style))
        sem_uso = sorted(definidas - tokens)
        R['classes'] = {'definidas': len(definidas), 'sem_uso': sem_uso}

    # 6. font-size < 13px
    pequenos = [(linha_de(texto, m.start()), m.group(1)) for m in re.finditer(r'font-size\s*:\s*(\d+(?:\.\d+)?)px', texto) if float(m.group(1)) < 13]
    R['font_size_menor_13'] = pequenos
    if pequenos:
        falhas.append('font-size abaixo de 13 px: ' + ', '.join(f'{v}px (l.{l})' for l, v in pequenos[:10]))

    # 7. emoji
    emojis = [(linha_de(texto, m.start()), m.group(0)) for m in RE_EMOJI.finditer(texto)]
    R['emoji'] = len(emojis)
    if emojis:
        falhas.append(f'{len(emojis)} emoji: ' + ', '.join(f'l.{l}' for l, _ in emojis[:10]))

    # 8. marcadores e fetch(
    faltam = [m for m in MARCADORES if m not in texto]
    R['marcadores_ausentes'] = faltam
    if faltam:
        falhas.append('marcadores ausentes: ' + ', '.join(faltam))
    texto_sem_com = sem_comentarios(texto)
    fetches = [linha_de(texto_sem_com, m.start()) for m in re.finditer(r'\bfetch\s*\(', texto_sem_com)]
    R['fetch'] = fetches
    if len(fetches) > 2:
        falhas.append(f'fetch( em {len(fetches)} pontos (esperado ≤ 2: chamarServidor + ViaCEP): linhas {fetches}')

    # 9. verbos proibidos fora de comentários
    proibidos = {}
    for termo in [t.strip() for t in opcoes.get('proibidos', PROIBIDOS_PADRAO).split(',') if t.strip()]:
        ocorr = [linha_de(texto_sem_com, m.start()) for m in re.finditer(re.escape(termo), texto_sem_com)]
        if ocorr:
            proibidos[termo] = ocorr
    R['proibidos'] = proibidos
    if proibidos:
        falhas.append('texto proibido fora de comentários: ' + '; '.join(f'"{t}" l.{o[:6]}' for t, o in proibidos.items()))

    # 10. funções declaradas × chamadas (contagem de ocorrências do nome no arquivo inteiro)
    js_txt = ''.join(texto[a:b] for _, _, a, b in scripts)
    declaradas = set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', js_txt))
    declaradas |= set(re.findall(r'\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^()]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)', js_txt))
    contagem = Counter(re.findall(r'[A-Za-z_$][\w$]*', texto))
    sem_chamada = sorted(n for n in declaradas if contagem[n] <= 1)
    R['funcoes'] = {'declaradas': len(declaradas), 'nomes': sorted(declaradas), 'sem_chamada': sem_chamada}

    R['falhas'] = falhas
    R['avisos'] = avisos
    return R


def comparar(A, D):
    """Regras que dependem da referência: classes novas sem uso, rgba aumentou, funções novas sem chamador,
    funções removidas ainda chamadas. Devolve (falhas, avisos, tabela)."""
    falhas, avisos = [], []
    if 'classes' in D and 'classes' in A:
        novas_sem_uso = sorted(set(D['classes']['sem_uso']) - set(A['classes']['sem_uso']))
        toleradas = sorted(set(D['classes']['sem_uso']) & set(A['classes']['sem_uso']))
        if novas_sem_uso:
            falhas.append('classe(s) nova(s) sem uso: ' + ', '.join(novas_sem_uso))
        if toleradas:
            avisos.append('classes sem uso já existentes na referência (toleradas): ' + ', '.join(toleradas))
    elif 'classes' in D and D['classes']['sem_uso']:
        avisos.append('classes sem uso (sem referência para saber se são novas): ' + ', '.join(D['classes']['sem_uso']))
    if 'cores' in D and 'cores' in A and D['cores']['rgba_fora_root'] > A['cores']['rgba_fora_root']:
        falhas.append(f"rgba()/rgb() fora do :root aumentou: {A['cores']['rgba_fora_root']} → {D['cores']['rgba_fora_root']}")
    fa, fd = set(A['funcoes']['nomes']), set(D['funcoes']['nomes'])
    novas = sorted(fd - fa)
    removidas = sorted(fa - fd)
    novas_sem = [n for n in novas if n in D['funcoes']['sem_chamada']]
    if novas_sem:
        falhas.append('função nova sem chamador: ' + ', '.join(novas_sem))
    pend = [n for n in removidas if n in D.get('_contagem_removidas', {}) and D['_contagem_removidas'][n] > 0]
    if pend:
        falhas.append('função removida ainda referenciada (fragmento órfão/chamada pendente): ' + ', '.join(pend))
    linhas = [
        ('linhas', A['linhas'], D['linhas']),
        ('blocos script inline', A['blocos']['script_inline'], D['blocos']['script_inline']),
        ('classes CSS definidas', A.get('classes', {}).get('definidas', '-'), D.get('classes', {}).get('definidas', '-')),
        ('classes sem uso', len(A.get('classes', {}).get('sem_uso', [])), len(D.get('classes', {}).get('sem_uso', []))),
        ('hex fora do :root', len(A.get('cores', {}).get('hex_fora_root', [])), len(D.get('cores', {}).get('hex_fora_root', []))),
        ('rgba fora do :root', A.get('cores', {}).get('rgba_fora_root', '-'), D.get('cores', {}).get('rgba_fora_root', '-')),
        ('var() sem declaração', len(A['vars']['sem_declaracao']), len(D['vars']['sem_declaracao'])),
        ('font-size < 13 px', len(A['font_size_menor_13']), len(D['font_size_menor_13'])),
        ('emoji', A['emoji'], D['emoji']),
        ('funções declaradas', A['funcoes']['declaradas'], D['funcoes']['declaradas']),
        ('funções sem chamada', len(A['funcoes']['sem_chamada']), len(D['funcoes']['sem_chamada'])),
        ('fetch(', len(A['fetch']), len(D['fetch'])),
    ]
    for tag, v in D['tags'].items():
        linhas.append((f'<{tag}> abre', A['tags'].get(tag, {}).get('abre', 0), v['abre']))
    return falhas, avisos, linhas, {'funcoes_novas': novas, 'funcoes_removidas': removidas}


def main():
    argv = sys.argv[1:]
    opcoes = {'arquivo': 'index-dev.html', 'ref': 'HEAD', 'antes': False, 'depois': False, 'json': None, 'sem_cor': False, 'proibidos': PROIBIDOS_PADRAO, 'base': None}
    i = 0
    while i < len(argv):
        t = argv[i]
        if t == '--antes':
            opcoes['antes'] = True
        elif t == '--depois':
            opcoes['depois'] = True
        elif t == '--sem-cor':
            opcoes['sem_cor'] = True
        elif t in ('--ref', '--arquivo', '--json', '--proibidos', '--base'):
            opcoes[t[2:]] = argv[i + 1]
            i += 1
        else:
            raise SystemExit('argumento desconhecido: ' + t)
        i += 1
    raiz = raiz_repo()
    arquivo = opcoes['arquivo']
    caminho = os.path.join(raiz, arquivo)
    base = opcoes['base'] or os.path.join(raiz, '..', 'VMC-offline', 'validar_' + os.path.splitext(arquivo)[0].replace('-', '_') + '_antes.json')

    D = analisar(ler_trabalho(caminho), arquivo, opcoes)
    print(f'{arquivo}: {D["linhas"]} linhas · CRLF {D["crlf"]} · linha 2: {D["marcador"]}')

    if opcoes['antes']:
        os.makedirs(os.path.dirname(base), exist_ok=True)
        with open(base, 'w', encoding='utf-8') as f:
            json.dump(D, f, ensure_ascii=False, indent=1)
        print(f'linha de base gravada: {base}')

    # referência: linha de base (--depois) e/ou git ref
    refs = []
    if opcoes['depois']:
        if not os.path.exists(base):
            raise SystemExit('linha de base ausente (rode --antes antes de editar): ' + base)
        with open(base, encoding='utf-8') as f:
            refs.append(('linha de base ' + os.path.basename(base), json.load(f)))
    try:
        A = analisar(ler_ref(opcoes['ref'], arquivo), arquivo, opcoes)
        refs.append((opcoes['ref'], A))
    except SystemExit as e:
        print('(sem referência git: ' + str(e) + ')')

    falhas = list(D['falhas'])
    avisos = list(D['avisos'])
    D['comparacoes'] = {}
    texto_atual = ler_trabalho(caminho).decode('utf-8')
    for nome, A in refs:
        removidas = set(A['funcoes']['nomes']) - set(D['funcoes']['nomes'])
        # 18.3: hífen fora do nome — a classe CSS "btn-logout" não é chamada da função removida logout
        D['_contagem_removidas'] = {n: len(re.findall(r'(?<![\w$-])' + re.escape(n) + r'(?![\w$-])', texto_atual)) for n in removidas}
        f2, a2, tabela, extra = comparar(A, D)
        D['comparacoes'][nome] = {'falhas': f2, 'avisos': a2, 'tabela': tabela, **extra}
        falhas += [f'[{nome}] ' + x for x in f2]
        avisos += [f'[{nome}] ' + x for x in a2]
        print(f'\n{"contagem":28}{"antes (" + nome + ")":>34}{"depois":>10}')
        for rot, va, vd in tabela:
            marca = '' if va == vd else '  ←'
            print(f'{rot:28}{str(va):>34}{str(vd):>10}{marca}')
        if extra['funcoes_novas']:
            print('funções novas: ' + ', '.join(extra['funcoes_novas']))
        if extra['funcoes_removidas']:
            print('funções removidas: ' + ', '.join(extra['funcoes_removidas']))
    D.pop('_contagem_removidas', None)

    print('\nregras:')
    print(f'  node --check: {"OK" if all(b["ok"] for b in D["node_check"]) else "FALHA"} ({len(D["node_check"])} bloco(s))')
    print(f'  tags fora de <script>: ' + ('OK (' + ', '.join(f'{t} {v["abre"]}' for t, v in D['tags'].items() if v['delta'] == 0 and v['prof_min'] >= 0) + ')' if not any(v['delta'] or v['prof_min'] < 0 for v in D['tags'].values()) else 'FALHA'))
    print(f'  var() sem declaração: {"OK" if not D["vars"]["sem_declaracao"] else "FALHA " + str(D["vars"]["sem_declaracao"])} (runtime: {", ".join(D["vars"]["runtime"]) or "nenhuma"})')
    if 'cores' in D:
        print(f'  hex fora do :root: {"OK 0" if not D["cores"]["hex_fora_root"] else "FALHA " + str(len(D["cores"]["hex_fora_root"]))} · rgba fora do :root: {D["cores"]["rgba_fora_root"]}')
        print(f'  classes CSS: {D["classes"]["definidas"]} definidas · sem uso: {", ".join(D["classes"]["sem_uso"]) or "nenhuma"}')
    print(f'  font-size < 13 px: {"OK" if not D["font_size_menor_13"] else "FALHA"} · emoji: {D["emoji"]} · marcadores ausentes: {D["marcadores_ausentes"] or "nenhum"} · fetch( em {len(D["fetch"])} ponto(s) l.{D["fetch"]}')
    print(f'  texto proibido fora de comentários: {"OK 0" if not D["proibidos"] else "FALHA " + json.dumps(D["proibidos"], ensure_ascii=False)}')
    print(f'  funções: {D["funcoes"]["declaradas"]} declaradas · sem chamada: {", ".join(D["funcoes"]["sem_chamada"]) or "nenhuma"}')
    for a in avisos:
        print('AVISO: ' + a)
    for f in falhas:
        print('FALHA: ' + f)
    print('\nRESULTADO: ' + ('OK — nenhuma falha' if not falhas else f'{len(falhas)} FALHA(S)'))
    D['falhas_total'] = falhas
    D['avisos_total'] = avisos
    if opcoes['json']:
        with open(opcoes['json'], 'w', encoding='utf-8') as f:
            json.dump(D, f, ensure_ascii=False, indent=1)
        print('-> ' + opcoes['json'])
    sys.exit(1 if falhas else 0)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    main()
