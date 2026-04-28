import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type MediaSourceType = 'escaneada' | 'importada' | 'fotografia';

@Component({
  selector: 'akri-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Productos, fichas visuales e imágenes</h1>
          <p class="page-subtitle">Carga imágenes escaneadas, importadas o fotografías directas para enriquecer la trazabilidad del catálogo.</p>
        </div>
      </div>

      <div *ngIf="message()" class="success-box" style="margin-bottom: 1rem;">{{ message() }}</div>
      <div *ngIf="error()" class="error-box" style="margin-bottom: 1rem;">{{ error() }}</div>

      <div class="product-layout">
        <div class="card">
          <div class="toolbar">
            <input [(ngModel)]="search" placeholder="Buscar por nombre, SKU, principio activo o código de barras" (keyup.enter)="load()">
            <button class="btn secondary" (click)="load()">Buscar</button>
          </div>

          <div class="table-wrap compact">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>Stock</th>
                  <th>Imagen</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of products()" class="table-row-clickable" [class.selected-row]="selected()?.id_producto === p.id_producto" (click)="selectProduct(p.id_producto)">
                  <td>
                    <strong>{{ p.nombre_comercial }}</strong><br>
                    <span class="muted">{{ p.sku }} · {{ p.principio_activo || 'Sin principio activo' }}</span>
                  </td>
                  <td>
                    <div>{{ p.codigo_barras || '—' }}</div>
                    <span class="chip" [ngClass]="p.requiere_cadena_frio ? 'info' : (p.es_controlado ? 'accent' : 'primary')">
                      {{ p.requiere_cadena_frio ? 'Frío' : (p.es_controlado ? 'Controlado' : p.tipo_producto) }}
                    </span>
                  </td>
                  <td>{{ p.stock_actual }}</td>
                  <td>
                    <span class="chip success" *ngIf="p.imagen_principal_url">Sí</span>
                    <span class="chip warn" *ngIf="!p.imagen_principal_url">Pendiente</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-header">
              <div>
                <h3>Nuevo producto</h3>
                <div class="helper">Alta rápida del maestro de catálogo.</div>
              </div>
            </div>

            <div class="form-grid">
              <label>
                Código interno
                <input [(ngModel)]="form.codigo_interno" placeholder="Código único del producto">
              </label>
              <label>
                Tipo de producto
                <select [(ngModel)]="form.tipo_producto">
                  <option value="">Seleccionar tipo</option>
                  <option value="medicamento">Medicamento</option>
                  <option value="insumo">Insumo</option>
                  <option value="controlado">Controlado</option>
                  <option value="vacuna">Vacuna</option>
                  <option value="dispositivo">Dispositivo</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              <label>
                Nombre del producto
                <input [(ngModel)]="form.nombre_producto" placeholder="Nombre genérico">
              </label>
              <label>
                Nombre comercial
                <input [(ngModel)]="form.nombre_comercial" placeholder="Marca comercial">
              </label>
              <label>
                Laboratorio
                <input [(ngModel)]="form.laboratorio" placeholder="Nombre del laboratorio">
              </label>
              <label>
                Lote
                <input [(ngModel)]="form.lote" placeholder="Número de lote">
              </label>
              <label>
                Fecha de vencimiento
                <input type="date" [(ngModel)]="form.fecha_vencimiento">
              </label>
              <label>
                Presentación
                <input type="number" [(ngModel)]="form.presentacion" placeholder="Ej: 500 (ml, mg, etc)">
              </label>
              <label>
                Registro INVIMA
                <input [(ngModel)]="form.registro_invima" placeholder="INVIMA-XXXXXX">
              </label>
              <label>
                CUM
                <input type="number" [(ngModel)]="form.cum" placeholder="Código de medicamento">
              </label>
              <label>
                Consecutivo CUM
                <input type="number" [(ngModel)]="form.consecutivo_cum" placeholder="Número consecutivo">
              </label>
              <label>
                ATC
                <input [(ngModel)]="form.atc" placeholder="Código ATC">
              </label>
              <label>
                Principio activo
                <input [(ngModel)]="form.principio_activo" placeholder="Ingrediente principal">
              </label>
              <label>
                Concentración
                <input [(ngModel)]="form.concentracion" placeholder="Ej: 500mg">
              </label>
              <label>
                Unidad
                <input type="number" [(ngModel)]="form.unidad" placeholder="Cantidad de unidades">
              </label>
              <label>
                IVA (%)
                <input type="number" [(ngModel)]="form.iva" step="0.1" placeholder="Porcentaje de IVA">
              </label>
            </div>

            <div class="form-actions">
              <button class="btn" (click)="create()">Guardar producto</button>
            </div>
          </div>

          <div class="card" *ngIf="selected() as item">
            <div class="card-header">
              <div>
                <h3>{{ item.nombre_comercial }}</h3>
                <div class="helper">Ficha visual del producto seleccionado.</div>
              </div>
              <span class="chip" [ngClass]="item.requiere_cadena_frio ? 'info' : (item.es_controlado ? 'accent' : 'primary')">
                {{ item.requiere_cadena_frio ? 'Cadena de frío' : (item.es_controlado ? 'Controlado' : item.tipo_producto) }}
              </span>
            </div>

            <div class="product-summary">
              <div class="summary-tile">
                <small>Stock total</small>
                <strong>{{ item.stock_total }}</strong>
              </div>
              <div class="summary-tile">
                <small>Código de barras</small>
                <strong style="font-size: 1rem;">{{ item.codigo_barras || 'Pendiente' }}</strong>
              </div>
              <div class="summary-tile">
                <small>Precio de venta</small>
                <strong>{{ item.precio_venta | number:'1.0-0' }}</strong>
              </div>
              <div class="summary-tile">
                <small>Imágenes</small>
                <strong>{{ item.images?.length || 0 }}</strong>
              </div>
            </div>

            <div class="image-gallery" style="margin-top: 1rem;">
              <div class="image-hero" [ngClass]="!heroImage(item) ? 'empty-state' : ''">
                <img *ngIf="heroImage(item)" [src]="heroImage(item)!" [alt]="item.nombre_comercial">
                <div *ngIf="!heroImage(item)" class="empty-state">
                  <div>
                    <strong>Sin imagen principal</strong>
                    <div class="muted">Adjunta una imagen escaneada, importada o una fotografía del producto.</div>
                  </div>
                </div>
              </div>

              <div class="toolbar">
                <select [(ngModel)]="mediaForm.tipo_origen">
                  <option value="importada">Importada</option>
                  <option value="escaneada">Escaneada</option>
                </select>
                <input [(ngModel)]="mediaForm.descripcion" placeholder="Descripción opcional de la imagen">
                <label class="btn secondary">
                  Adjuntar imagen
                  <input hidden type="file" accept="image/*" (change)="onImageSelected($event, mediaForm.tipo_origen)">
                </label>
                <label class="btn accent">
                  Tomar foto
                  <input hidden type="file" accept="image/*" capture="environment" (change)="onImageSelected($event, 'fotografia')">
                </label>
              </div>

              <div class="image-thumbs" *ngIf="item.images?.length; else noImages">
                <div class="image-thumb" *ngFor="let image of item.images">
                  <img [src]="image.url" [alt]="item.nombre_comercial">
                  <div class="meta">
                    <div><strong>{{ image.tipo_origen }}</strong></div>
                    <div class="muted">{{ image.fecha_creacion | date:'yyyy-MM-dd HH:mm' }}</div>
                    <span class="chip success" *ngIf="image.es_principal">Principal</span>
                  </div>
                </div>
              </div>
              <ng-template #noImages>
                <div class="notice">Todavía no hay imágenes asociadas a este producto.</div>
              </ng-template>
            </div>

            <div class="card" style="margin-top: 1rem; padding: 0; box-shadow: none;">
              <div style="padding: 1rem 1rem 0;">
                <h4>Stock por lote</h4>
              </div>
              <div class="table-wrap compact" style="border: 0; border-top: 1px solid var(--line); border-radius: 0 0 18px 18px;">
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
                    <tr *ngFor="let row of item.stock_lotes">
                      <td>{{ row.numero_lote }}</td>
                      <td>{{ row.fecha_vencimiento | date:'yyyy-MM-dd' }}</td>
                      <td>{{ row.almacen || '—' }}</td>
                      <td>{{ row.ubicacion || '—' }}</td>
                      <td>{{ row.cantidad_disponible }}</td>
                    </tr>
                    <tr *ngIf="!item.stock_lotes?.length">
                      <td colspan="5" class="muted">Aún no hay lotes registrados para este producto.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class ProductsComponent implements OnInit {
  search = '';
  products = signal<any[]>([]);
  selected = signal<any | null>(null);
  message = signal('');
  error = signal('');

  mediaForm: { tipo_origen: MediaSourceType; descripcion: string } = {
    tipo_origen: 'importada',
    descripcion: ''
  };

  form: any = {
    codigo_interno: '',
    tipo_producto: '',
    nombre_producto: '',
    nombre_comercial: '',
    laboratorio: '',
    lote: '',
    fecha_vencimiento: '',
    presentacion: 0,
    registro_invima: '',
    cum: 0,
    consecutivo_cum: 0,
    atc: '',
    principio_activo: '',
    concentracion: '',
    unidad: 0,
    iva: 0
  };

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
  }

  async load(preselectId?: number | null) {
    this.error.set('');
    const response = await this.api.get<{ success: boolean; data: any[] }>(`/products?search=${encodeURIComponent(this.search)}`);
    this.products.set(response.data);

    const selectedId = preselectId ?? this.selected()?.id_producto ?? response.data[0]?.id_producto ?? null;
    if (selectedId) {
      await this.selectProduct(selectedId);
    } else {
      this.selected.set(null);
    }
  }

  async selectProduct(id: number) {
    const response = await this.api.get<{ success: boolean; data: any }>(`/products/${id}`);
    this.selected.set(response.data);
  }

  async create() {
    this.error.set('');
    const response = await this.api.post<{ success: boolean; data: any }>('/products', this.form);
    this.message.set('Producto registrado correctamente.');
    this.form = {
      codigo_interno: '',
      tipo_producto: '',
      nombre_producto: '',
      nombre_comercial: '',
      laboratorio: '',
      lote: '',
      fecha_vencimiento: '',
      presentacion: 0,
      registro_invima: '',
      cum: 0,
      consecutivo_cum: 0,
      atc: '',
      principio_activo: '',
      concentracion: '',
      unidad: 0,
      iva: 0
    };
    await this.load(response.data.id_producto);
  }

  async onImageSelected(event: Event, sourceType: MediaSourceType) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const selected = this.selected();

    if (!file || !selected) {
      input.value = '';
      return;
    }

    try {
      const imageBase64 = await this.fileToDataUrl(file);
      await this.api.post(`/products/${selected.id_producto}/media`, {
        image_base64: imageBase64,
        tipo_origen: sourceType,
        descripcion: this.mediaForm.descripcion || file.name,
        metadata: {
          originalName: file.name,
          size: file.size,
          source: sourceType
        }
      });
      this.message.set('Imagen cargada correctamente.');
      this.mediaForm.descripcion = '';
      await this.selectProduct(selected.id_producto);
      await this.load(selected.id_producto);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar la imagen.');
    } finally {
      input.value = '';
    }
  }

  heroImage(item: any) {
    return item?.imagen_principal_url || item?.images?.[0]?.url || null;
  }

  private fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('No fue posible leer el archivo seleccionado.'));
      reader.readAsDataURL(file);
    });
  }
}
