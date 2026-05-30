import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'akri-inventory',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css'],
  imports: [CommonModule, FormsModule]
})
export class InventoryComponent implements OnInit, OnDestroy {
  @ViewChild('cameraVideo') cameraVideo?: ElementRef<HTMLVideoElement>;

  stock = signal<any[]>([]);
  recentScans = signal<any[]>([]);
  lookups = signal<any>({ ubicaciones: [], tipos_egreso: [] });
  resolved = signal<any | null>(null);
  message = signal('');
  error = signal('');
  cameraActive = signal(false);

  stockSearch = '';
  cameraSupported = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!(window as any).BarcodeDetector
    && !!navigator.mediaDevices?.getUserMedia;

  scan: any = {
    mode: 'consulta',
    source: 'lector',
    barcode: ''
  };

  ingress: any = {
    quantity: 1,
    id_ubicacion_destino: 1,
    numero_lote: `LOT-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`,
    fecha_vencimiento: this.nextYearDate(),
    costo_unitario: 0,
    precio_venta: 0,
    motivo: 'Ingreso por escaneo de código de barras'
  };

  egress: any = {
    quantity: 1,
    id_lote: null,
    id_ubicacion_origen: null,
    tipo_egreso: 'salida_venta',
    motivo: 'Egreso por escaneo de código de barras'
  };

  private detector: any = null;
  private mediaStream: MediaStream | null = null;
  private scanTimer: number | null = null;
  private detecting = false;

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.bootstrap();
  }

  ngOnDestroy() {
    void this.stopCamera();
  }

  async bootstrap() {
    await Promise.all([this.loadStock(), this.loadLookups(), this.loadRecentScans()]);
  }

  async loadStock() {
    const response = await this.api.get<{ success: boolean; data: any[] }>(`/inventory/stock?search=${encodeURIComponent(this.stockSearch)}`);
    this.stock.set(response.data);
  }

  async loadLookups() {
    const response = await this.api.get<{ success: boolean; data: any }>('/inventory/lookups');
    this.lookups.set(response.data);
    if (!this.ingress.id_ubicacion_destino && response.data.ubicaciones?.length) {
      this.ingress.id_ubicacion_destino = response.data.ubicaciones[0].id_ubicacion;
    }
  }

  async loadRecentScans() {
    const response = await this.api.get<{ success: boolean; data: any[] }>('/inventory/scans/recent?limit=8');
    this.recentScans.set(response.data);
  }

  async resolveBarcode() {
    if (!this.scan.barcode?.trim()) {
      this.error.set('Ingresa o escanea un código de barras antes de continuar.');
      return;
    }

    this.error.set('');
    this.message.set('');

    try {
      const response = await this.api.post<{ success: boolean; data: any }>('/inventory/barcode/resolve', {
        barcode: this.scan.barcode.trim(),
        mode: this.scan.mode,
        source: this.scan.source
      });
      this.resolved.set(response.data);
      if (response.data?.found) {
        this.ingress.costo_unitario = response.data.product?.costo_referencia ?? 0;
        this.ingress.precio_venta = response.data.product?.precio_venta ?? 0;
        this.ingress.numero_lote = this.ingress.numero_lote || `LOT-${Date.now()}`;
        this.egress.id_lote = response.data.suggested_lot_id ?? null;
        this.egress.id_ubicacion_origen = response.data.suggested_location_id ?? null;
      }
      await this.loadRecentScans();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible resolver el código de barras.');
    }
  }

  async registerIngress() {
    const resolved = this.resolved();
    if (!resolved?.found) {
      this.error.set('Primero resuelve un código válido para registrar el ingreso.');
      return;
    }

    try {
      const response = await this.api.post<{ success: boolean; data: any }>('/inventory/barcode/ingress', {
        barcode: this.scan.barcode.trim(),
        source: this.scan.source,
        quantity: Number(this.ingress.quantity),
        id_ubicacion_destino: Number(this.ingress.id_ubicacion_destino),
        numero_lote: this.ingress.numero_lote,
        fecha_vencimiento: this.ingress.fecha_vencimiento,
        costo_unitario: Number(this.ingress.costo_unitario ?? 0),
        precio_venta: Number(this.ingress.precio_venta ?? 0),
        motivo: this.ingress.motivo
      });
      this.message.set(response.data.message);
      await this.afterMutation();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible registrar el ingreso.');
    }
  }

  async registerEgress() {
    const resolved = this.resolved();
    if (!resolved?.found) {
      this.error.set('Primero resuelve un código válido para registrar el egreso.');
      return;
    }

    try {
      const response = await this.api.post<{ success: boolean; data: any }>('/inventory/barcode/egress', {
        barcode: this.scan.barcode.trim(),
        source: this.scan.source,
        quantity: Number(this.egress.quantity),
        id_lote: this.egress.id_lote ? Number(this.egress.id_lote) : null,
        id_ubicacion_origen: this.egress.id_ubicacion_origen ? Number(this.egress.id_ubicacion_origen) : null,
        tipo_egreso: this.egress.tipo_egreso,
        motivo: this.egress.motivo
      });
      this.message.set(response.data.message);
      await this.afterMutation();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible registrar el egreso.');
    }
  }

  async exportInventory(format: 'json' | 'excel' | 'pdf') {
    try {
      this.error.set('');
      const extension = format === 'excel' ? 'xls' : format;
      await this.api.download(`/reports/inventory/export?format=${format}&search=${encodeURIComponent(this.stockSearch)}`, `akripharmacy-inventario.${extension}`);
      this.message.set(`Inventario exportado en formato ${format.toUpperCase()}.`);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible exportar el inventario.');
    }
  }

  applySelectedLot() {
    const selectedLot = (this.resolved()?.lots || []).find((lot: any) => lot.id_lote === this.egress.id_lote);
    if (selectedLot) {
      this.egress.id_ubicacion_origen = selectedLot.id_ubicacion;
    }
  }

  async startCamera() {
    if (!this.cameraSupported || !this.cameraVideo?.nativeElement) {
      this.error.set('Este navegador no soporta escaneo por cámara. Usa un lector físico o captura manual.');
      return;
    }

    try {
      this.error.set('');
      this.scan.source = 'camara';
      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      this.detector = new BarcodeDetectorCtor({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
      });
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      const video = this.cameraVideo.nativeElement;
      video.srcObject = this.mediaStream;
      await video.play();
      this.cameraActive.set(true);
      this.scanTimer = window.setInterval(() => {
        void this.detectFromCamera();
      }, 900);
    } catch (error) {
      this.error.set('No fue posible activar la cámara para el escaneo.');
      await this.stopCamera();
    }
  }

  async stopCamera() {
    if (this.scanTimer) {
      window.clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    const video = this.cameraVideo?.nativeElement;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    this.cameraActive.set(false);
    this.detecting = false;
  }

  private async detectFromCamera() {
    if (!this.detector || !this.cameraVideo?.nativeElement || this.detecting) {
      return;
    }

    try {
      this.detecting = true;
      const codes = await this.detector.detect(this.cameraVideo.nativeElement);
      const firstCode = String(codes?.[0]?.rawValue ?? '').trim();
      if (firstCode) {
        this.scan.barcode = firstCode;
        await this.resolveBarcode();
        await this.stopCamera();
      }
    } catch {
      // Ignora lecturas vacías y sigue escuchando.
    } finally {
      this.detecting = false;
    }
  }

  private async afterMutation() {
    await Promise.all([this.loadStock(), this.loadRecentScans(), this.resolveBarcode()]);
  }

  private nextYearDate() {
    const now = new Date();
    return `${now.getFullYear() + 1}-12-31`;
  }
}
