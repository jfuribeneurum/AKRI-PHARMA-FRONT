import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UppercaseInputDirective } from './uppercase-input.directive';

type ScanOrigin = 'camara' | 'archivo' | 'manual' | 'scanner_usb';

export interface BarcodeScanEvent {
  code: string;
  origin: ScanOrigin;
}

@Component({
  selector: 'akri-barcode-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule, UppercaseInputDirective],
  template: `
    <div class="scanner-shell">
      <div class="toolbar">
        <input
          [(ngModel)]="manualCode"
          placeholder="Escanea o escribe el código de barras"
          (keyup.enter)="submitManual('scanner_usb')"
        >
        <button class="btn" type="button" (click)="submitManual('manual')">Usar código</button>
        <button class="btn secondary" type="button" (click)="toggleCamera()" [disabled]="!cameraAvailable()">
          {{ cameraActive() ? 'Detener cámara' : 'Escaneo en vivo' }}
        </button>
      </div>

      <div class="scanner-status" [class.error-state]="statusType() === 'error'" [class.success-state]="statusType() === 'success'">
        {{ status() }}
      </div>

      <div class="toolbar" style="margin-top: 0.75rem;">
        <label class="btn secondary inline-file">
          Imagen escaneada
          <input type="file" accept="image/*" (change)="handleFile($event, 'archivo')">
        </label>
        <label class="btn secondary inline-file">
          Fotografía directa
          <input type="file" accept="image/*" capture="environment" (change)="handleFile($event, 'camara')">
        </label>
      </div>

      @if (cameraActive()) {
        <div class="scanner-video-wrap">
          <video #preview playsinline muted></video>
        </div>
      }
    </div>
  `
})
export class BarcodeScannerComponent implements AfterViewInit, OnDestroy {
  @Output() detected = new EventEmitter<BarcodeScanEvent>();
  @ViewChild('preview') previewRef?: ElementRef<HTMLVideoElement>;

  manualCode = '';
  readonly supported = signal(Boolean((globalThis as any).BarcodeDetector));
  readonly cameraActive = signal(false);
  readonly status = signal('Listo para lectura manual, archivo, foto o cámara en vivo.');
  readonly statusType = signal<'info' | 'error' | 'success'>('info');

  private stream: MediaStream | null = null;
  private timer: number | null = null;
  private lastCode = '';
  private lastEmittedAt = 0;

  ngAfterViewInit(): void {
    if (!this.supported()) {
      this.status.set('BarcodeDetector no está disponible en este navegador. Usa captura por imagen, lector USB o ingreso manual.');
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  cameraAvailable() {
    return this.supported() && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  submitManual(origin: ScanOrigin) {
    const code = this.normalizeCode(this.manualCode);
    if (!code) {
      this.statusType.set('error');
      this.status.set('Ingresa o escanea un código válido.');
      return;
    }
    this.emitCode(code, origin);
  }

  async handleFile(event: Event, origin: ScanOrigin) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    try {
      const detector = this.createDetector();
      if (!detector) {
        throw new Error('El navegador no soporta lectura de barras desde imagen');
      }

      const bitmap = await createImageBitmap(file);
      const result = await detector.detect(bitmap);
      const code = this.normalizeCode(result?.[0]?.rawValue ?? '');
      bitmap.close();

      if (!code) {
        throw new Error('No se detectó un código de barras en la imagen');
      }

      this.emitCode(code, origin);
    } catch (error: unknown) {
      this.statusType.set('error');
      this.status.set(error instanceof Error ? error.message : 'No fue posible interpretar la imagen.');
    } finally {
      if (input) {
        input.value = '';
      }
    }
  }

  async toggleCamera() {
    if (this.cameraActive()) {
      this.stopCamera();
      return;
    }

    if (!this.cameraAvailable()) {
      this.statusType.set('error');
      this.status.set('El navegador no soporta cámara o BarcodeDetector para escaneo en vivo.');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      const video = this.previewRef?.nativeElement;
      if (!video) {
        throw new Error('No fue posible iniciar la vista previa de cámara');
      }

      video.srcObject = this.stream;
      await video.play();
      this.cameraActive.set(true);
      this.statusType.set('info');
      this.status.set('Apunta la cámara al código de barras.');
      await this.detectFromVideo();
    } catch (error: unknown) {
      this.stopCamera();
      this.statusType.set('error');
      this.status.set(error instanceof Error ? error.message : 'No fue posible iniciar la cámara.');
    }
  }

  private async detectFromVideo() {
    if (!this.cameraActive()) {
      return;
    }

    try {
      const detector = this.createDetector();
      const video = this.previewRef?.nativeElement;

      if (!detector || !video || video.readyState < 2) {
        this.queueNextDetection();
        return;
      }

      const result = await detector.detect(video);
      const code = this.normalizeCode(result?.[0]?.rawValue ?? '');

      if (code) {
        this.emitCode(code, 'camara');
      }
    } catch {
      // No interrumpimos el flujo si en un frame no se puede leer.
    }

    this.queueNextDetection();
  }

  private queueNextDetection() {
    if (!this.cameraActive()) {
      return;
    }
    this.timer = window.setTimeout(() => {
      void this.detectFromVideo();
    }, 900);
  }

  private stopCamera() {
    this.cameraActive.set(false);
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    const video = this.previewRef?.nativeElement;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  private createDetector(): any {
    const Detector = (globalThis as any).BarcodeDetector;
    if (!Detector) {
      return null;
    }
    return new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
  }

  private emitCode(code: string, origin: ScanOrigin) {
    const now = Date.now();
    if (code === this.lastCode && now - this.lastEmittedAt < 1800) {
      return;
    }

    this.lastCode = code;
    this.lastEmittedAt = now;
    this.manualCode = code;
    this.statusType.set('success');
    this.status.set(`Código detectado: ${code}`);
    this.detected.emit({ code, origin });
  }

  private normalizeCode(value: string) {
    return String(value ?? '').trim().replace(/\s+/g, '');
  }
}
