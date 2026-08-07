/**
 * scanner.js — leitura de QR Code e código de barras via BarcodeDetector nativo.
 *
 * Decisão de projeto (PLANEJAMENTO.md, D1): alvo Android/Chrome, portanto sem
 * fallback ZXing — BarcodeDetector cobre qr_code e code_128 nativamente.
 */

class Scanner {
  constructor(videoEl, { onDetect, onError } = {}) {
    this.video = videoEl;
    this.onDetect = onDetect;
    this.onError = onError;
    this.stream = null;
    this.detector = null;
    this.rafId = null;
    this.ativo = false;
    this.ultimaLeitura = null;
    this.ultimaLeituraEm = 0;
  }

  static suportado() {
    return 'BarcodeDetector' in window;
  }

  async iniciar() {
    if (!Scanner.suportado()) {
      throw new Error('BarcodeDetector não disponível neste navegador.');
    }
    this.detector = new BarcodeDetector({ formats: ['qr_code', 'code_128'] });
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.ativo = true;
    this._loop();
  }

  parar() {
    this.ativo = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  async _loop() {
    if (!this.ativo) return;
    try {
      const codigos = await this.detector.detect(this.video);
      if (codigos.length > 0) {
        const texto = codigos[0].rawValue;
        const agora = Date.now();
        // Evita disparos repetidos do mesmo código enquanto a câmera continua
        // apontando para ele — só reemite após 2s ou se o conteúdo mudar.
        if (texto !== this.ultimaLeitura || agora - this.ultimaLeituraEm > 2000) {
          this.ultimaLeitura = texto;
          this.ultimaLeituraEm = agora;
          this.onDetect?.(texto);
        }
      }
    } catch (e) {
      this.onError?.(e);
    }
    if (this.ativo) {
      this.rafId = requestAnimationFrame(() => this._loop());
    }
  }
}
