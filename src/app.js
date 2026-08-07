/**
 * app.js — orquestração do LeitorDF: estado, persistência (IndexedDB),
 * renderização da lista e exportação do arquivo .txt (contrato em
 * docs/FORMATO-ARQUIVO.md).
 */

const DB_NOME = 'leitordf';
const DB_VERSAO = 1;
const STORE = 'leituras';

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'chave' });
        store.createIndex('lidoEm', 'lidoEm');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function listarLeituras(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.lidoEm - b.lidoEm));
    req.onerror = () => reject(req.error);
  });
}

function buscarLeitura(db, chave) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(chave);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function salvarLeitura(db, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function removerLeitura(db, chave) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(chave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function limparLeituras(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Feedback sonoro (Web Audio API — sem arquivos de áudio) -------------

function beep({ frequencia = 880, duracaoMs = 120 } = {}) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = beep._ctx || (beep._ctx = new Ctx());
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frequencia;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duracaoMs / 1000);
    osc.stop(ctx.currentTime + duracaoMs / 1000);
  } catch {
    // Web Audio indisponível — segue sem som, não quebra o app.
  }
}

function beepErro() {
  beep({ frequencia: 220, duracaoMs: 90 });
  setTimeout(() => beep({ frequencia: 220, duracaoMs: 90 }), 140);
}

// --- Exportação (contrato: docs/FORMATO-ARQUIVO.md) -----------------------

function nomeArquivoLote() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `leitordf-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.txt`;
}

function gerarConteudoArquivo(leituras) {
  const linhas = [
    `# LeitorDF v1 — gerado em ${new Date().toISOString()}`,
    '# 1 documento por linha: URL do QR Code (preferencial) OU 44 dígitos',
    ...leituras.map((l) => l.urlQr || l.chave),
  ];
  return linhas.join('\n') + '\n';
}

function exportarArquivo(leituras) {
  const conteudo = gerarConteudoArquivo(leituras);
  const blob = new Blob([conteudo], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivoLote();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- UI --------------------------------------------------------------------

(function main() {
  const els = {
    video: document.getElementById('video'),
    lista: document.getElementById('lista-leituras'),
    contador: document.getElementById('contador'),
    btnIniciar: document.getElementById('btn-iniciar'),
    btnParar: document.getElementById('btn-parar'),
    btnTorch: document.getElementById('btn-torch'),
    btnExportar: document.getElementById('btn-exportar'),
    btnLimpar: document.getElementById('btn-limpar'),
    status: document.getElementById('status'),
    formManual: document.getElementById('form-manual'),
    inputManual: document.getElementById('input-manual'),
  };

  let db = null;
  let scanner = null;
  let torchLigado = false;

  function setStatus(texto, tipo = '') {
    els.status.textContent = texto;
    els.status.className = 'status' + (tipo ? ' status-' + tipo : '');
  }

  function renderLista(leituras) {
    els.contador.textContent = String(leituras.length);
    els.lista.innerHTML = '';
    [...leituras].reverse().forEach((l) => {
      const li = document.createElement('li');
      li.className = 'item-leitura';
      const chaveResumida = l.chave.slice(0, 4) + ' … ' + l.chave.slice(-6);
      const li_chave = document.createElement('span');
      li_chave.className = 'chave';
      li_chave.textContent = chaveResumida;
      const li_origem = document.createElement('span');
      li_origem.className = 'origem';
      li_origem.textContent = l.urlQr ? 'QR' : 'código';
      const btnRemover = document.createElement('button');
      btnRemover.className = 'btn-remover';
      btnRemover.dataset.chave = l.chave;
      btnRemover.setAttribute('aria-label', 'Remover');
      btnRemover.textContent = '×';
      li.append(li_chave, li_origem, btnRemover);
      els.lista.appendChild(li);
    });
  }

  async function atualizarLista() {
    const leituras = await listarLeituras(db);
    renderLista(leituras);
    return leituras;
  }

  async function adicionarLeitura(texto) {
    const interpretada = interpretarLeitura(texto);
    if (!interpretada) {
      setStatus('Código lido, mas sem 44 dígitos reconhecíveis.', 'erro');
      beepErro();
      return;
    }
    if (!interpretada.valida) {
      setStatus('Dígito verificador inválido — provável erro de leitura. Tente novamente.', 'erro');
      beepErro();
      return;
    }
    const existente = await buscarLeitura(db, interpretada.chave);
    if (existente) {
      setStatus('Esta chave já foi lida nesta sessão.', 'aviso');
      beepErro();
      return;
    }
    await salvarLeitura(db, {
      chave: interpretada.chave,
      urlQr: interpretada.urlQr,
      lidoEm: Date.now(),
    });
    beep();
    setStatus('Chave lida com sucesso.', 'ok');
    await atualizarLista();
  }

  async function iniciar() {
    if (!Scanner.suportado()) {
      setStatus('Este navegador não suporta leitura nativa de código (BarcodeDetector). Use a entrada manual abaixo.', 'erro');
      return;
    }
    scanner = new Scanner(els.video, {
      onDetect: (texto) => adicionarLeitura(texto),
      onError: (e) => console.error('Erro no scanner:', e),
    });
    try {
      await scanner.iniciar();
      els.btnIniciar.disabled = true;
      els.btnParar.disabled = false;
      const temTorch = scanner.suportaTorch();
      els.btnTorch.disabled = !temTorch;
      els.btnTorch.title = temTorch ? '' : 'Este aparelho não expõe controle de lanterna pelo navegador.';
      setStatus('Câmera ativa — aponte para o código.', '');
    } catch (e) {
      setStatus('Não foi possível acessar a câmera: ' + e.message, 'erro');
    }
  }

  function parar() {
    scanner?.parar();
    els.btnIniciar.disabled = false;
    els.btnParar.disabled = true;
    els.btnTorch.disabled = true;
    els.btnTorch.textContent = '💡 Lanterna';
    torchLigado = false;
    setStatus('Câmera parada.', '');
  }

  els.btnIniciar.addEventListener('click', iniciar);
  els.btnParar.addEventListener('click', parar);
  els.btnTorch.addEventListener('click', async () => {
    const querLigar = !torchLigado;
    const ok = await scanner?.ligarTorch(querLigar);
    if (ok) {
      torchLigado = querLigar;
      els.btnTorch.textContent = torchLigado ? '💡 Lanterna (ligada)' : '💡 Lanterna';
    } else {
      setStatus('Não foi possível controlar a lanterna neste aparelho.', 'aviso');
    }
  });
  els.btnExportar.addEventListener('click', async () => {
    const leituras = await listarLeituras(db);
    if (leituras.length === 0) {
      setStatus('Nada para exportar ainda.', 'aviso');
      return;
    }
    exportarArquivo(leituras);
    setStatus(`Arquivo exportado com ${leituras.length} chave(s).`, 'ok');
  });
  els.btnLimpar.addEventListener('click', async () => {
    if (!confirm('Limpar toda a lista de leituras desta sessão?')) return;
    await limparLeituras(db);
    await atualizarLista();
    setStatus('Lista limpa.', '');
  });
  els.lista.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.btn-remover');
    if (!btn) return;
    await removerLeitura(db, btn.dataset.chave);
    await atualizarLista();
  });
  els.formManual.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const texto = els.inputManual.value.trim();
    if (!texto) return;
    await adicionarLeitura(texto);
    els.inputManual.value = '';
  });

  (async () => {
    db = await abrirDB();
    await atualizarLista();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  })();
})();
