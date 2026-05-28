import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Inventario con escaneo de código de barras</h1>
          <p class="page-subtitle">Opera ingresos, egresos y consultas usando lector físico, captura manual o cámara cuando el navegador lo soporte.</p>
        </div>
        <div class="toolbar" style="margin-bottom: 0; justify-content: flex-end;">
          <button class="btn secondary" (click)="exportInventory('json')">JSON</button>
          <button class="btn secondary" (click)="exportInventory('excel')">Excel</button>
          <button class="btn secondary" (click)="exportInventory('pdf')">PDF</button>
        </div>
      </div>

      <div *ngIf="message()" class="success-box" style="margin-bottom: 1rem;">{{ message() }}</div>
      <div *ngIf="error()" class="error-box" style="margin-bottom: 1rem;">{{ error() }}</div>

      <div class="scan-layout">
        <div class="scan-shell">
          <div class="card">
            <div class="card-header">
              <div>
                <h3>Resolver código de barras</h3>
                <div class="helper">Compatible con lectores tipo keyboard wedge, ingreso manual y cámara.</div>
              </div>
              <span class="chip" [ngClass]="cameraSupported ? 'success' : 'warn'">
                {{ cameraSupported ? 'Cámara disponible' : 'Usar lector / manual' }}
              </span>
            </div>

            <div class="form-grid">
              <label>
                Modo
                <select [(ngModel)]="scan.mode">
                  <option value="consulta">Consulta</option>
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                </select>
              </label>
              <label>
                Fuente
                <select [(ngModel)]="scan.source">
                  <option value="lector">Lector</option>
                  <option value="manual">Manual</option>
                  <option value="camara">Cámara</option>
                </select>
              </label>
              <label style="grid-column: span 2;">
                Código de barras
                <input [(ngModel)]="scan.barcode" placeholder="Escanea o digita el código" (keyup.enter)="resolveBarcode()">
              </label>
            </div>

            <div class="form-actions">
              <button class="btn secondary" *ngIf="cameraActive()" (click)="stopCamera()">Detener cámara</button>
              <button class="btn accent" *ngIf="!cameraActive()" [disabled]="!cameraSupported" (click)="startCamera()">Escanear con cámara</button>
              <button class="btn" (click)="resolveBarcode()">Resolver código</button>
            </div>
          </div>

          <div class="card resolved-card" *ngIf="resolved() as vm">
            <div class="card-header">
              <div>
                <h3>{{ vm.found ? 'Producto resuelto' : 'Código no encontrado' }}</h3>
                <div class="helper">Resultado del último escaneo procesado.</div>
              </div>
              <span class="chip" [ngClass]="vm.found ? 'success' : 'danger'">{{ vm.found ? 'Resuelto' : 'No encontrado' }}</span>
            </div>

            <ng-container *ngIf="vm.found; else notFound">
              <div class="resolved-product">
                <img *ngIf="vm.product?.imagen_principal_url" [src]="vm.product.imagen_principal_url" [alt]="vm.product.nombre_comercial">
                <div *ngIf="!vm.product?.imagen_principal_url" class="image-hero empty-state" style="min-height: 120px;">Sin imagen</div>
                <div>
                  <h4 style="margin-bottom: 0.4rem;">{{ vm.product.nombre_comercial }}</h4>
                  <div class="muted">{{ vm.product.sku }} · {{ vm.product.codigo_barras }}</div>
                  <div class="inline-list" style="margin-top: 0.75rem;">
                    <span class="chip primary">Stock total {{ vm.stock_total }}</span>
                    <span class="chip info" *ngIf="vm.product.requiere_cadena_frio">Cadena de frío</span>
                    <span class="chip accent" *ngIf="vm.product.es_controlado">Controlado</span>
                    <span class="chip warn" *ngIf="vm.product.requiere_receta">Receta</span>
                  </div>
                </div>
              </div>

              <div class="table-wrap compact" style="margin-top: 1rem;">
                <table>
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th>Vence</th>
                      <th>Almacén</th>
                      <th>Ubicación</th>
                      <th>Disponible</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of vm.lots">
                      <td>{{ row.numero_lote }}</td>
                      <td>{{ row.fecha_vencimiento | date:'yyyy-MM-dd' }}</td>
                      <td>{{ row.almacen }}</td>
                      <td>{{ row.ubicacion }}</td>
                      <td>{{ row.cantidad_disponible }}</td>
                    </tr>
                    <tr *ngIf="!vm.lots?.length">
                      <td colspan="5" class="muted">No hay lotes disponibles para este producto.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </ng-container>

            <ng-template #notFound>
              <div class="notice">No existe un producto activo asociado al código {{ vm.barcode }}.</div>
            </ng-template>
          </div>

          <div class="card" *ngIf="resolved()?.found && scan.mode === 'ingreso'">
            <div class="card-header">
              <div>
                <h3>Registrar ingreso con escaneo</h3>
                <div class="helper">Crea o reutiliza un lote y suma existencias en la ubicación destino.</div>
              </div>
            </div>

            <div class="form-grid">
              <label>
                Cantidad
                <input type="number" [(ngModel)]="ingress.quantity">
              </label>
              <label>
                Ubicación destino
                <select [(ngModel)]="ingress.id_ubicacion_destino">
                  <option *ngFor="let u of lookups().ubicaciones" [ngValue]="u.id_ubicacion">{{ u.almacen }} · {{ u.nombre }} ({{ u.codigo }})</option>
                </select>
              </label>
              <label>
                Número de lote
                <input [(ngModel)]="ingress.numero_lote">
              </label>
              <label>
                Vencimiento
                <input type="date" [(ngModel)]="ingress.fecha_vencimiento">
              </label>
              <label>
                Costo unitario
                <input type="number" [(ngModel)]="ingress.costo_unitario">
              </label>
              <label>
                Precio venta
                <input type="number" [(ngModel)]="ingress.precio_venta">
              </label>
              <label style="grid-column: span 2;">
                Motivo
                <input [(ngModel)]="ingress.motivo" placeholder="Ingreso por recepción, conteo o ajuste positivo">
              </label>
            </div>

            <div class="form-actions">
              <button class="btn success" (click)="registerIngress()">Registrar ingreso</button>
            </div>
          </div>

          <div class="card" *ngIf="resolved()?.found && scan.mode === 'egreso'">
            <div class="card-header">
              <div>
                <h3>Registrar egreso con escaneo</h3>
                <div class="helper">Selecciona el lote FEFO o un lote específico y descuenta disponibilidad.</div>
              </div>
            </div>

            <div class="form-grid">
              <label>
                Tipo de egreso
                <select [(ngModel)]="egress.tipo_egreso">
                  <option *ngFor="let tipo of lookups().tipos_egreso" [ngValue]="tipo">{{ tipo }}</option>
                </select>
              </label>
              <label>
                Cantidad
                <input type="number" [(ngModel)]="egress.quantity">
              </label>
              <label>
                Lote a egresar
                <select [(ngModel)]="egress.id_lote" (ngModelChange)="applySelectedLot()">
                  <option *ngFor="let lot of resolved()?.lots || []" [ngValue]="lot.id_lote">
                    {{ lot.numero_lote }} · {{ lot.cantidad_disponible }} uds · vence {{ lot.fecha_vencimiento | date:'yyyy-MM-dd' }}
                  </option>
                </select>
              </label>
              <label>
                Ubicación origen
                <select [(ngModel)]="egress.id_ubicacion_origen">
                  <option *ngFor="let lot of resolved()?.lots || []" [ngValue]="lot.id_ubicacion">
                    {{ lot.almacen }} · {{ lot.ubicacion }}
                  </option>
                </select>
              </label>
              <label style="grid-column: span 2;">
                Motivo
                <input [(ngModel)]="egress.motivo" placeholder="Salida por venta, merma, devolución o destrucción">
              </label>
            </div>

            <div class="form-actions">
              <button class="btn accent" (click)="registerEgress()">Registrar egreso</button>
            </div>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-header">
              <div>
                <h3>Captura por cámara</h3>
                <div class="helper">Usa la cámara trasera en móviles para leer EAN, UPC o Code 128 cuando el navegador soporte BarcodeDetector.</div>
              </div>
            </div>

            <div class="camera-box">
              <video #cameraVideo autoplay playsinline [style.display]="cameraActive() ? 'block' : 'none'"></video>
              <div class="camera-hint" *ngIf="!cameraActive()">
                <strong>La cámara está inactiva.</strong>
                <div class="muted">Actívala para detectar códigos automáticamente o usa el lector físico con el cursor en el campo de captura.</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h3>Escaneos recientes</h3>
                <div class="helper">Últimos eventos para auditoría operativa.</div>
              </div>
            </div>
            <div class="table-wrap compact">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Modo</th>
                    <th>Fuente</th>
                    <th>Código</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of recentScans()">
                    <td>{{ row.fecha_hora | date:'MM-dd HH:mm' }}</td>
                    <td>{{ row.modo }}</td>
                    <td>{{ row.fuente }}</td>
                    <td>{{ row.codigo_barras }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: 1rem;">
        <div class="card-header">
          <div>
            <h3>Stock por lote y ubicación</h3>
            <div class="helper">Consulta rápida del inventario físico disponible.</div>
          </div>
          <div class="toolbar" style="margin-bottom: 0;">
            <input [(ngModel)]="stockSearch" placeholder="Buscar por producto, SKU, código o lote" (keyup.enter)="loadStock()">
            <button class="btn secondary" (click)="loadStock()">Actualizar stock</button>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Código</th>
                <th>Lote</th>
                <th>Vence</th>
                <th>Almacén</th>
                <th>Ubicación</th>
                <th>Disponible</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of stock()">
                <td>{{ row.nombre_comercial }}</td>
                <td>{{ row.codigo_barras || '—' }}</td>
                <td>{{ row.numero_lote }}</td>
                <td>{{ row.fecha_vencimiento | date:'yyyy-MM-dd' }}</td>
                <td>{{ row.almacen }}</td>
                <td>{{ row.ubicacion }}</td>
                <td>{{ row.cantidad_disponible }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `
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
