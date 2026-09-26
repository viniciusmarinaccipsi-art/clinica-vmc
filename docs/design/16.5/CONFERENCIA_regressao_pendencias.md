# Teste de regressão — script de conferência preparado para a rodada 3 (Pacote 16.5, pendências)

Comando: `python scripts/conferir_entrega_16_5.py docs/design/16.5` (rodada 2), duas execuções idênticas, sem exceção Python. Saída do terminal:

```
0 Catálogo: IGUAL (mesmo arquivo)
1 Gabarito: OK (45 · 225 · 45 · 3)
2 Catálogo × gabarito: OK
3 Textos: 4 sem origem (além dos 1 aceitos)
4 Tokens: 2 diferença(s)
5 Rostinhos: OK
6 Ícones: OK (faltam só nenhum)
7 Referência: OK (12 arquivos)
8 Componentes da rodada 3: ausentes (esperado na rodada 2)
-> docs/design/16.5\gabarito_codigo.json
-> docs/design/16.5\CONFERENCIA_16_5a.md
```

Esperado e obtido: item 0 IGUAL (mesmo arquivo); item 1 = 45 · 225 · 45 · 3; item 8 avisa que os componentes da rodada 3 estão ausentes, como esperado na rodada 2. O prompt chamou o item de componentes de "7"; aqui é 8 porque o 7 já era a referência 25/09 desde o 16.5a. Os itens 4 e 5 passaram a reconhecer o que o 16.4.5 e o 16.5b já aplicaram (tokens mesclados, rostinhos no sprite) como "já aplicado, igual", em vez de diferença; o que resta no item 4 são os 2 `rgba()` literais nas telas das pranchas.
