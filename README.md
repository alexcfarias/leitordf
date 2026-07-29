# LeitorDF

Leitor de documentos fiscais pela câmera do celular. Lê o QR Code da NFC-e e o
código de barras do DANFE em sequência e gera um arquivo texto com as chaves de
acesso, importado pelo **Despesas2** para criar as despesas automaticamente.

> **Status:** planejamento. Nenhum código implementado ainda.
> Leia [`PLANEJAMENTO.md`](PLANEJAMENTO.md) antes de começar.

---

## Para que serve

```
cupom fiscal → [LeitorDF no celular] → leitordf-20260729-1840.txt → [Despesas2] → despesas criadas
```

Substitui a digitação manual de 44 dígitos por documento na aba
**Chave de Acesso** do Despesas2.

---

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [`PLANEJAMENTO.md`](PLANEJAMENTO.md) | Requisitos, alternativas avaliadas, recomendação, fases |
| [`docs/FORMATO-ARQUIVO.md`](docs/FORMATO-ARQUIVO.md) | Contrato do arquivo `.txt` — vale para os dois projetos |

## Projeto relacionado

**Despesas2** (`D:\Projetos\Despesas2`) — consumidor do arquivo.
A funcionalidade de importação em lote está planejada em
`PLANEJAMENTO-IMPORTACAO-LOTE-CHAVES.md`, no diretório daquela aplicação.

---

## Abordagem escolhida

PWA (HTML + JavaScript, **sem dependências e sem build step**), servido por HTTPS,
com `BarcodeDetector` nativo do Chrome/Android e persistência offline em IndexedDB.
Justificativa e comparação com as alternativas nativas em
[`PLANEJAMENTO.md`](PLANEJAMENTO.md#3-alternativas-avaliadas-para-o-app).

**Decisões tomadas:** alvo Android · entrega apenas por arquivo `.txt` ·
hospedagem com duas alternativas planejadas (`/scanner` no Despesas2 ou GitHub Pages).

## Requisito de ambiente

A câmera do navegador só funciona em **contexto seguro** (`https://` ou
`localhost`). Abrir o `index.html` por `file://` **não** dá acesso à câmera.
Para desenvolvimento local, sirva a pasta `src/` por HTTP em localhost.
