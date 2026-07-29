# LeitorDF — Planejamento

**Objetivo:** ler com a câmera do celular os códigos (QR Code / código de barras)
de vários documentos fiscais em sequência e gerar um arquivo texto com as chaves
de acesso, consumido pelo **Despesas2** para criar as despesas automaticamente.

**Data:** 2026-07-29
**Status:** fases 1–6 implementadas. Hospedagem: **Alternativa H2 — GitHub Pages**
(decisão tomada em 2026-07-29; ver seção 6).

---

## 1. Requisitos

### Funcionais

| # | Requisito |
|---|---|
| RF1 | Ler QR Code da NFC-e e código de barras Code 128 do DANFE pela câmera |
| RF2 | Leitura **em sequência** (vários documentos sem sair da tela de câmera) |
| RF3 | Validar 44 dígitos + dígito verificador módulo 11 no ato da leitura |
| RF4 | Rejeitar duplicatas dentro da sessão |
| RF5 | Preservar a **URL completa** do QR Code (ver `docs/FORMATO-ARQUIVO.md`) |
| RF6 | Listar o que foi lido, permitindo remover entradas antes de exportar |
| RF7 | Exportar arquivo `.txt` no formato do contrato |
| RF8 | Entrada manual dos 44 dígitos (cupom com QR danificado) |

### Não funcionais

| # | Requisito |
|---|---|
| RNF1 | Funcionar **offline** — leitura no caixa do mercado, sem sinal |
| RNF2 | Persistir a lista entre aberturas (fechar o app não perde leituras) |
| RNF3 | Zero instalação via loja de aplicativos |
| RNF4 | Manutenção compatível com a stack que já domino (Python/Flask/JS) |
| RNF5 | Feedback imediato de leitura válida/inválida (som + cor) |

### Restrição técnica decisiva

O acesso à câmera (`getUserMedia`) exige **contexto seguro**: `https://` ou
`localhost`. Abrir um `.html` por `file://` **não dá acesso à câmera** no Android.
Qualquer alternativa web precisa de uma origem HTTPS — é o que a seção 6 resolve.

---

## 2. Decisões tomadas

| # | Decisão | Efeito |
|---|---|---|
| D1 | **Android** é o alvo | Usa `BarcodeDetector` nativo do Chrome — sem ZXing, sem dependências externas, app inteiro em JS puro |
| D2 | Entrega **apenas por arquivo `.txt`** | Sem endpoint de envio, sem autenticação no app, offline de verdade. Menor superfície e menor esforço |
| D3 | Hospedagem | Duas alternativas planejadas — seção 6 |

---

## 3. Alternativas avaliadas para o app

### Alternativa A — PWA (HTML + JS puro) ⭐ escolhida

Página única servida por HTTPS, câmera via `getUserMedia`, decodificação via
**`BarcodeDetector`** (API nativa do Chrome/Android, suporta `qr_code` e
`code_128`). Lista persistida em IndexedDB. Instalável na tela inicial via
`manifest.json`; Service Worker garante uso offline.

| Prós | Contras |
|---|---|
| Stack já dominada (HTML/JS), sem toolchain nova | Depende de HTTPS para a câmera |
| Com Android, **zero dependências** — API nativa | Leitura de Code 128 linear é menos tolerante que a de apps nativos |
| Sem loja, sem APK, sem assinatura | |
| Atualiza sozinho (basta recarregar) | |
| Coerente com o Despesas2 — "sem build step de frontend" | |

### Alternativa B — App nativo Android (Kotlin + CameraX + ML Kit)

| Prós | Contras |
|---|---|
| Melhor taxa de leitura, especialmente Code 128 | Toolchain pesada (Android Studio, Gradle, SDK) |
| Offline real, sem depender de HTTPS | Linguagem fora da stack atual |
| Acesso pleno ao sistema de arquivos | Atualizar = gerar e instalar APK a cada mudança |

### Alternativa C — Flutter (Dart) + `mobile_scanner`

| Prós | Contras |
|---|---|
| Android + iOS de um código só | Terceira linguagem no ecossistema pessoal |
| ML Kit por baixo no Android | SDK grande, build lento — desproporcional para 1 tela |
| | Multiplataforma não é requisito (D1: só Android) |

### Alternativa D — App de scanner pronto da loja + só a importação no Despesas2

| Prós | Contras |
|---|---|
| Esforço zero no lado mobile | Apps genéricos **descartam a URL do QR**, guardando só o texto — perde-se o bypass do reCAPTCHA |
| Disponível hoje | Sem validação de DV: erros só aparecem na importação |
| | Formato de exportação instável, sujeito a mudanças de terceiros |

---

## 4. Recomendação

**Alternativa A — PWA**, pelos motivos, em ordem de peso:

1. **Preserva a URL do QR Code.** É o único ganho técnico que realmente muda a
   taxa de sucesso da importação, e a Alternativa D o perde por completo.
2. **Com Android definido, o app não tem dependência nenhuma.** `BarcodeDetector`
   é nativo: HTML, CSS e JS puro, sem bundler, sem biblioteca de terceiro.
3. **Custo de manutenção.** Uma tela. As alternativas B e C introduzem toolchains
   inteiras para um aplicativo de uso pessoal.
4. **Distribuição.** Instalar na tela inicial e atualizar com um reload.

---

## 5. Arquitetura

```
LeitorDF/
├── PLANEJAMENTO.md
├── README.md
├── docs/
│   └── FORMATO-ARQUIVO.md      contrato com o Despesas2
└── src/
    ├── index.html              tela única: câmera + lista + exportar
    ├── app.js                  orquestração, estado, persistência
    ├── scanner.js              BarcodeDetector + controle da câmera
    ├── chave.js                extração e validação de DV (módulo 11)
    ├── style.css
    ├── manifest.json           instalável na tela inicial
    └── sw.js                   Service Worker — funcionamento offline
```

### Fluxo de uso

```
Abrir o app  →  câmera ativa
      │
      ├─ aponta para o QR/código de barras
      │        ↓
      │   decodifica → extrai 44 dígitos → valida DV
      │        ↓                              ↓
      │     válido                        inválido
      │   bipe curto + verde            bipe duplo + vermelho
      │        ↓
      │   já existe na lista? → sim: avisa e ignora
      │        ↓ não
      │   grava {chave, url_qr, lido_em} no IndexedDB
      │        ↓
      └── contador incrementa, câmera segue ativa (próximo documento)

Ao terminar  →  "Exportar .txt"  →  leitordf-AAAAMMDD-HHMM.txt
                          ↓
         importar na aba "Lote de chaves" do Despesas2
```

### Decisões técnicas

| Tema | Decisão |
|---|---|
| Decodificação | `BarcodeDetector` nativo (Chrome/Android) — sem biblioteca externa |
| Formatos | `qr_code`, `code_128` |
| Câmera | `facingMode: 'environment'`, foco contínuo, torch quando disponível |
| Persistência | IndexedDB (a lista sobrevive a fechar o app / recarregar) |
| Validação | `chave.js` espelha `dv_chave_valido()` do Despesas2 |
| Offline | Service Worker com cache dos assets (`cache-first`) |
| Exportação | `Blob` + `URL.createObjectURL` + `<a download>` |

---

## 6. Hospedagem — decisão: Alternativa H2 (GitHub Pages)

**Decidido em 2026-07-29:** apenas GitHub Pages. A Alternativa H1 (`/scanner`
no Despesas2) fica descrita abaixo só como referência histórica — não será
implementada por ora. A escolha continua reversível: o app é 100% estático,
então migrar depois é apenas copiar arquivos.

**Implementação:** `.github/workflows/pages.yml` publica automaticamente o
conteúdo de `src/` a cada `git push` na branch `main`, via
`actions/upload-pages-artifact` + `actions/deploy-pages`. `docs/` (contrato do
arquivo) e os `.md` de planejamento ficam fora do site publicado — só o
conteúdo de `src/` é servido. Endereço final:
`https://<usuário-github>.github.io/<nome-do-repositório>/`.

### Alternativa H1 — servido pelo Despesas2, rota `/scanner`

O Despesas2 passa a servir o app como página estática, aproveitando o HTTPS
válido que o PythonAnywhere já fornece.

**Implementação no Despesas2:**

```python
@app.route('/scanner')
def scanner_view():
    return render_template('scanner.html')
```

- Arquivos de `LeitorDF/src/` copiados para `static/scanner/` no deploy;
  `index.html` vira `templates/scanner.html` com os caminhos ajustados para
  `url_for('static', filename='scanner/…')`.
- **Autenticação:** hoje o acesso é controlado por `session['autenticado']`
  (`app.py:551`). A rota `/scanner` e os assets precisam ser liberados ou o app
  exigirá login no celular antes de abrir a câmera — decidir na implementação.
- O Service Worker precisa de escopo `/static/scanner/`.

| Prós | Contras |
|---|---|
| Um só endereço e um só deploy para lembrar | Acopla o app ao ciclo de deploy do Despesas2 |
| HTTPS já existente, sem configurar nada | Exige tratar a interação com o login |
| Link direto da tela de importação para o scanner | Passo extra no deploy: copiar `src/` → `static/scanner/` |
| App e consumidor sempre em versões coerentes | Se o PythonAnywhere cair, o app não abre (mitigado pelo Service Worker) |

### Alternativa H2 — GitHub Pages (independente)

Repositório próprio do LeitorDF publicado em GitHub Pages, com HTTPS gratuito.

- `git push` na branch configurada publica automaticamente.
- Endereço no formato `https://<usuario>.github.io/LeitorDF/`.
- Nenhuma alteração no Despesas2.

| Prós | Contras |
|---|---|
| Deploy independente — mudar o app não toca no Despesas2 | Segundo repositório e segundo fluxo de deploy para manter |
| Sem interação nenhuma com o login | Sem link direto a partir do Despesas2 |
| Disponível mesmo com o Despesas2 fora do ar | **Repositório público** por padrão no plano gratuito — o código é trivial e sem segredos, mas é uma exposição a considerar |
| Publicar é um `git push` | Requer criar o repositório e configurar o Pages |

### Comparação

| Critério | H1 (`/scanner`) | H2 (GitHub Pages) |
|---|---|---|
| Esforço inicial | Médio (rota + deploy + login) | Baixo (criar repo + ativar Pages) |
| Esforço recorrente | Copiar assets a cada mudança | `git push` |
| Acoplamento | Alto | Nenhum |
| Privacidade do código | Privado | Público (plano gratuito) |
| Integração com o Despesas2 | Link direto na tela de importação | Favorito no celular |

**Sugestão de sequência:** começar por **H2** para validar o app rapidamente sem
mexer no Despesas2, e migrar para **H1** depois, se a conveniência do endereço
único compensar. Como o app é 100% estático e offline, a migração é apenas copiar
arquivos — nenhuma reescrita.

---

## 7. Fases de implementação

| Fase | Entrega | Critério de aceite |
|---|---|---|
| 1 | Tela de câmera lendo QR e exibindo o conteúdo bruto | Lê o QR de um cupom real |
| 2 | `chave.js` — extração + validação de DV | Testes com chaves válidas e adulteradas |
| 3 | Lista persistente, dedup, remoção de item | Fechar e reabrir mantém a lista |
| 4 | Exportação `.txt` no formato do contrato | Arquivo importa sem erro no Despesas2 |
| 5 | `manifest.json` + Service Worker (offline, instalável) | Funciona em modo avião |
| 6 | Publicação (H1 ou H2) | Acessível pelo celular via HTTPS |

Fases 1–4 já entregam o escopo pedido. As 5–6 tornam o uso prático no dia a dia.

Durante o desenvolvimento, servir `src/` em `localhost` — contexto seguro
aceito pelo navegador sem HTTPS.

---

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Code 128 do DANFE lê mal sob luz baixa | Botão de lanterna; entrada manual como saída de emergência (RF8) |
| Chave lida corretamente mas SEFAZ fora do ar | Problema do lado Despesas2: a fila permite reprocessar |
| Perda das leituras antes de exportar | IndexedDB persiste; a lista só é limpa por ação explícita |
| Trocar de celular para um iPhone | `BarcodeDetector` não existe no Safari — exigiria adicionar o fallback ZXing-wasm |

---

## 9. Referências cruzadas

- Contrato do arquivo: [`docs/FORMATO-ARQUIVO.md`](docs/FORMATO-ARQUIVO.md)
- Consumidor: `D:\Projetos\Despesas2\PLANEJAMENTO-IMPORTACAO-LOTE-CHAVES.md`
