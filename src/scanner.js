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
    this.stream = await this._abrirCameraTraseira();
    this.video.srcObject = this.stream;
    await this.video.play();
    this.ativo = true;
    this._loop();
  }

  /**
   * Abre a câmera traseira. Em vários aparelhos Android, pedir a câmera via
   * `facingMode: {ideal: 'environment'}` devolve um stream sem a capacidade
   * `torch` exposta — mesmo quando o hardware suporta lanterna — porque o
   * Chrome pode negociar uma câmera virtual/composta nesse modo. O contorno é
   * reabrir explicitamente pelo `deviceId` da câmera traseira física; só faz
   * isso quando a 1ª tentativa não trouxe torch, para não pagar o custo extra
   * à toa nos aparelhos onde já funciona de primeira.
   */
  async _abrirCameraTraseira() {
    const stream1 = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    const track1 = stream1.getVideoTracks()[0];
    if (track1.getCapabilities?.().torch) return stream1;

    try {
      const deviceIdAtual = track1.getSettings?.().deviceId;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const traseira = devices.find((d) => d.kind === 'videoinput' && d.deviceId !== deviceIdAtual
        && /back|rear|traseira|environment/i.test(d.label));
      if (!traseira) return stream1;

      const stream2 = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: traseira.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (stream2.getVideoTracks()[0].getCapabilities?.().torch) {
        stream1.getTracks().forEach((t) => t.stop());
        return stream2;
      }
      stream2.getTracks().forEach((t) => t.stop());
    } catch {
      // enumerateDevices/getUserMedia pode falhar (ex.: sem permissão de
      // labels) — segue com a 1ª stream, só sem lanterna disponível.
    }
    return stream1;
  }

  /** Se a câmera atual expõe controle de lanterna. Só é confiável após iniciar(). */
  suportaTorch() {
    const capabilities = this.stream?.getVideoTracks()[0]?.getCapabilities?.();
    return !!capabilities?.torch;
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

  async ligarTorch(ligar) {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return false;
    const capabilities = track.getCapabilities?.();
    if (!capabilities || !capabilities.torch) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: ligar }] });
      return true;
    } catch {
      return false;
    }
  }
}
