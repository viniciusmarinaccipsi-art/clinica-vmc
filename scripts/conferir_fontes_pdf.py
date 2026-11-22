# -*- coding: utf-8 -*-
"""Fontes das escalas (22/11/2026) — conferência no PC: abre cada PDF anotado em docs/escalas/fontes.json,
na página indicada, e confirma que o TRECHO (poucas palavras de como o número aparece no artigo) está lá, com o
número por perto. Registro `conferido_por: "imagem"` (tabela girada ou em imagem) é aceito quando a captura PNG
indicada em `imagem` existe ao lado do PDF. Os PDFs vivem fora do repositório, no cache
VMC-offline/fontes_escalas/<SIGLA>/ — por isso este passo não roda no portão.
Uso: python scripts/conferir_fontes_pdf.py [--cache ../VMC-offline/fontes_escalas] [--so SIGLA,SIGLA] [--todas]
  sem --todas: confere só as escalas com `exige_pagina` e as que têm algum registro anotado.
Saída: lista por registro e `RESULTADO: OK` ou `RESULTADO: FALHA`."""
import argparse, json, os, re, sys, unicodedata

sys.stdout.reconfigure(encoding='utf-8')
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQ = os.path.join(RAIZ, 'docs', 'escalas', 'fontes.json')

ap = argparse.ArgumentParser()
ap.add_argument('--cache', default=os.path.join(RAIZ, '..', 'VMC-offline', 'fontes_escalas'))
ap.add_argument('--so', default='')
ap.add_argument('--todas', action='store_true')
a = ap.parse_args()

try:
    import pymupdf
except ImportError:  # pragma: no cover
    print('PyMuPDF ausente (pip install pymupdf)'); sys.exit(2)


def norm(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    s = s.replace('–', '-').replace('—', '-').replace('−', '-')
    return re.sub(r'\s+', ' ', s)


_cache_pdf = {}


def texto_pagina(caminho, pagina):
    chave = (caminho, pagina)
    if chave not in _cache_pdf:
        doc = pymupdf.open(caminho)
        if pagina < 1 or pagina > doc.page_count:
            _cache_pdf[chave] = None
        else:
            _cache_pdf[chave] = norm(doc[pagina - 1].get_text())
        doc.close()
    return _cache_pdf[chave]


falhas, confer, pend = 0, 0, 0


def conferir(sigla, rotulo, fonte, numeros):
    """numeros: lista de valores que precisam aparecer perto do trecho (até 160 caracteres)."""
    global falhas, confer, pend
    if not fonte or not fonte.get('arquivo'):
        pend += 1
        return
    pasta = os.path.join(a.cache, sigla)
    caminho = os.path.join(pasta, fonte['arquivo'])
    if not os.path.isfile(caminho):
        falhas += 1; print('  FALHA %s · %s: arquivo ausente no cache (%s)' % (sigla, rotulo, fonte['arquivo'])); return
    if fonte.get('conferido_por') == 'imagem':
        img = fonte.get('imagem')
        if img and os.path.isfile(os.path.join(pasta, img)):
            confer += 1; print('  ok   %s · %s: conferido por imagem (%s)' % (sigla, rotulo, img))
        else:
            falhas += 1; print('  FALHA %s · %s: conferido_por imagem sem a captura (%s)' % (sigla, rotulo, img))
        return
    if not fonte.get('trecho') or fonte.get('pagina') is None:
        falhas += 1; print('  FALHA %s · %s: registro sem trecho ou sem página' % (sigla, rotulo)); return
    txt = texto_pagina(caminho, int(fonte['pagina']))
    if txt is None:
        falhas += 1; print('  FALHA %s · %s: página %s fora do PDF' % (sigla, rotulo, fonte['pagina'])); return
    trecho = norm(fonte['trecho'])
    pos = txt.find(trecho)
    if pos < 0:
        falhas += 1; print('  FALHA %s · %s: trecho não está na página %s: "%s"' % (sigla, rotulo, fonte['pagina'], fonte['trecho'])); return
    janela = txt[max(0, pos - 160): pos + len(trecho) + 160]
    faltam = [str(n) for n in numeros if n is not None and not re.search(r'(?<![\d,.])' + re.escape(str(n).replace('.', ',')) + r'(?![\d])', janela) and not re.search(r'(?<![\d,.])' + re.escape(str(n)) + r'(?![\d])', janela)]
    if faltam:
        falhas += 1; print('  FALHA %s · %s: trecho na p. %s, mas sem o(s) número(s) %s por perto' % (sigla, rotulo, fonte['pagina'], ', '.join(faltam))); return
    confer += 1; print('  ok   %s · %s: p. %s, "%s"%s' % (sigla, rotulo, fonte['pagina'], fonte['trecho'], (' ' + ', '.join(str(n) for n in numeros)) if numeros else ''))


dados = json.load(open(ARQ, encoding='utf-8'))
so = [s for s in a.so.split(',') if s]
for sigla, e in dados['escalas'].items():
    if so and sigla not in so:
        continue
    anotado = any((f.get('fonte') or {}).get('arquivo') for f in e.get('faixas', [])) or any(v.get('arquivo') for v in e.get('fontes_estrutura', {}).values())
    if not a.todas and not e.get('exige_pagina') and not anotado:
        continue
    print(sigla + (' (exige página)' if e.get('exige_pagina') else ''))
    for f in e.get('faixas', []):
        # o número que identifica a faixa no artigo é o limite inferior (o corte); 0 não se procura
        conferir(sigla, 'faixa %s–%s' % (f['min'], f['max']), f.get('fonte'), [f['min']] if f['min'] else [])
    for bloco, fonte in e.get('fontes_estrutura', {}).items():
        nums = []
        if bloco == 'reversos':
            nums = e['estrutura'].get('reversos', [])[:3]
        conferir(sigla, 'estrutura ' + bloco, fonte, nums)
    if e.get('exige_pagina'):
        vazios = [('faixa %s–%s' % (f['min'], f['max'])) for f in e.get('faixas', []) if not (f.get('fonte') or {}).get('arquivo')]
        vazios += ['estrutura ' + b for b, v in e.get('fontes_estrutura', {}).items() if b != 'ancoras' and not v.get('arquivo')]
        if vazios:
            falhas += 1; print('  FALHA %s: exige página e falta fonte em %s' % (sigla, ', '.join(vazios)))

print('\n%d registro(s) conferido(s), %d sem fonte anotada, %d falha(s)' % (confer, pend, falhas))
print('RESULTADO: ' + ('OK' if not falhas else 'FALHA'))
sys.exit(1 if falhas else 0)
