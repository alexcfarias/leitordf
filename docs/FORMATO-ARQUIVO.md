# Contrato do arquivo de chaves — LeitorDF ⇄ Despesas2

Este documento é o **contrato entre os dois projetos**. Alterações aqui exigem
mudança coordenada no LeitorDF (produtor) e no Despesas2 (consumidor).

---

## 1. Formato

Arquivo texto plano, `UTF-8`, extensão `.txt`, **uma entrada por linha**.

```
# LeitorDF v1 — gerado em 2026-07-29T18:40:00-03:00
# 1 documento por linha: URL do QR Code (preferencial) OU 44 dígitos
http://www4.fazenda.rj.gov.br/consultaNFCe/QRCode?p=33260433381286000123650010000012341000012345|2|1|1|A1B2C3D4E5
33260433381286000123650010000012341000012345
35260714200166000187550010000123451000123456
```

**Regras de parsing:**

| Regra | Comportamento |
|---|---|
| Linha vazia | Ignorada |
| Linha iniciada por `#` | Ignorada (comentário/cabeçalho) |
| Linha com URL `http…` | Extrai a chave com `extrair_chave_44(linha, agressivo=True)` e **preserva a URL inteira** |
| Linha com 44 dígitos | Extrai com `extrair_chave_44(linha)`; sem URL associada |
| Linha não reconhecida | Registrada como erro, **não interrompe** o restante do arquivo |

Separadores visuais na chave (espaço, ponto, hífen) são tolerados: `3326 0433 3812 …`.

---

## 2. Por que a URL do QR Code é preferencial

Achado verificado no código atual do Despesas2:

- `parsers/chave_parser.py:255` — quando `url_qr` é fornecida, a consulta usa
  `consultar_url()`, que **contorna o reCAPTCHA** do portal SEFAZ.
- Sem a URL, o fluxo cai em `consultar_chave()`, que preenche o formulário
  público — muito mais sujeito a bloqueio, WAF e falha silenciosa.

**Consequência de projeto:** o app deve gravar a **URL completa** sempre que ler
um QR Code, e só cair para os 44 dígitos quando a leitura vier de um código de
barras linear (Code 128) ou de digitação manual.

> Não normalize, não encurte e não remova os parâmetros após `?p=` — eles fazem
> parte da autenticação da consulta.

---

## 3. Tipos de código por documento

| Documento | Código presente | O que o app captura |
|---|---|---|
| NFC-e (cupom fiscal) | QR Code + 44 dígitos impressos | **QR Code** (URL completa) |
| NF-e / DANFE (modelo 55) | Code 128 linear | 44 dígitos |
| Cupom sem QR legível | Texto impresso | Digitação manual com validação |

---

## 4. Validação obrigatória no lado do app

Antes de gravar qualquer entrada, o LeitorDF **deve** validar:

1. **44 dígitos exatos** após remover não-numéricos.
2. **Dígito verificador (módulo 11)** — espelho de `dv_chave_valido()`
   (`parsers/utils.py`). Rejeitar na hora da leitura, com feedback sonoro/visual.
3. **Duplicidade dentro da sessão** — a mesma chave não entra duas vezes no arquivo.

Validar no app evita a pior falha do fluxo: descobrir que a leitura saiu errada
só depois, longe do documento físico.

### Algoritmo do DV (módulo 11)

Pesos cíclicos `2..9` aplicados da direita para a esquerda sobre os 43 primeiros
dígitos; `resto = soma % 11`; `DV = 0` se `resto` for 0 ou 1, senão `11 - resto`.

---

## 5. Nome do arquivo

`leitordf-AAAAMMDD-HHMM.txt` — ex.: `leitordf-20260729-1840.txt`

O Despesas2 registra esse nome como identificador do lote, permitindo reprocessar
ou auditar a origem de cada despesa criada.

---

## 6. Compatibilidade

O formato é deliberadamente compatível com o campo de texto já existente na aba
**Chave de Acesso** do Despesas2: colar o conteúdo do arquivo inteiro na tela
funciona, porque a extração é feita por regex linha a linha.
