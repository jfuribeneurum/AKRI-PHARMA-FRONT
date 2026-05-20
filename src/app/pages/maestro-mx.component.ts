import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type MediaSourceType = 'escaneada' | 'importada' | 'fotografia';

@Component({
  selector: 'akri-maestro-mx',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Modal: agregar producto -->
    @if (showModal()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Nuevo producto</h3>
              <div class="helper">Alta rápida del maestro de catálogo.</div>
            </div>
            <button class="btn secondary" (click)="closeModal()">✕ Cerrar</button>
          </div>

          @if (formMessage()) {
            <div class="success-box" style="margin-bottom: 1rem;">{{ formMessage() }}</div>
          }
          @if (formError()) {
            <div class="error-box" style="margin-bottom: 1rem;">{{ formError() }}</div>
          }

          <div class="form-grid">
            <label>Código interno
              <input [(ngModel)]="form.codigo_interno" placeholder="Código único del producto">
            </label>
            <label>Tipo de producto
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
            <label>Nombre del producto
              <input [(ngModel)]="form.nombre_producto" placeholder="Nombre genérico">
            </label>
            <label>Nombre comercial
              <input [(ngModel)]="form.nombre_comercial" placeholder="Marca comercial">
            </label>
            <label>Laboratorio
              <select [(ngModel)]="form.id_laboratorio">
                <option [value]="null">Sin laboratorio</option>
                @for (lab of laboratorios(); track lab.id_laboratorio) {
                  <option [value]="lab.id_laboratorio">{{ lab.nombre }}</option>
                }
              </select>
            </label>
            <label>Presentación
              <input type="number" [(ngModel)]="form.presentacion" placeholder="Ej: 500 (ml, mg, etc)">
            </label>
            <label>Registro INVIMA
              <input [(ngModel)]="form.registro_invima" placeholder="INVIMA-XXXXXX">
            </label>
            <label>CUM
              <input type="number" [(ngModel)]="form.cum" placeholder="Código de medicamento">
            </label>
            <label>Consecutivo CUM
              <input type="number" [(ngModel)]="form.consecutivo_cum" placeholder="Número consecutivo">
            </label>
            <label>ATC
              <input [(ngModel)]="form.atc" placeholder="Código ATC">
            </label>
            <label>Principio activo
              <input [(ngModel)]="form.principio_activo" placeholder="Ingrediente principal">
            </label>
            <label>Concentración
              <input [(ngModel)]="form.concentracion" placeholder="Ej: 500mg">
            </label>
            <label>Forma farmacéutica
              <input [(ngModel)]="form.forma_farmaceutica" placeholder="Ej: Tableta, Jarabe, Ampolla">
            </label>
            <label>Clasificación
              <input [(ngModel)]="form.clasificacion" placeholder="Ej: Analgésico, Antibiótico">
            </label>
            <label>IVA (%)
              <input type="number" [(ngModel)]="form.iva" step="0.1" placeholder="Porcentaje de IVA">
            </label>
          </div>

          <div class="form-actions">
            <button class="btn secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn" (click)="create()">Guardar producto</button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: detalle del producto -->
    @if (showDetailModal() && selected(); as item) {
      <div class="modal-backdrop" (click)="closeDetailModal()">
        <div class="modal-panel modal-panel--wide" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ item.nombre_comercial }}</h3>
              <div class="helper">Ficha visual · imágenes · stock por lote</div>
            </div>
            <div style="display:flex;gap:.5rem;align-items:center;">
              <span class="chip" [ngClass]="item.requiere_cadena_frio ? 'info' : (item.es_controlado ? 'accent' : 'primary')">
                {{ item.requiere_cadena_frio ? 'Cadena de frío' : (item.es_controlado ? 'Controlado' : item.tipo_producto) }}
              </span>
              <button class="btn secondary" (click)="closeDetailModal()">✕ Cerrar</button>
            </div>
          </div>

          @if (detailMessage()) {
            <div class="success-box" style="margin-bottom: 1rem;">{{ detailMessage() }}</div>
          }
          @if (detailError()) {
            <div class="error-box" style="margin-bottom: 1rem;">{{ detailError() }}</div>
          }

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

          <!-- Información de laboratorio -->
          @if (item.laboratorio) {
            <div class="lab-section">
              <h4>Laboratorio</h4>
              <div class="lab-grid">
                <div class="lab-field">
                  <small>Nombre</small>
                  <strong>{{ item.laboratorio.nombre }}</strong>
                </div>
                @if (item.laboratorio.pais) {
                  <div class="lab-field">
                    <small>País</small>
                    <span>{{ item.laboratorio.pais }}</span>
                  </div>
                }
                @if (item.laboratorio.contacto) {
                  <div class="lab-field">
                    <small>Contacto</small>
                    <span>{{ item.laboratorio.contacto }}</span>
                  </div>
                }
                @if (item.laboratorio.telefono) {
                  <div class="lab-field">
                    <small>Teléfono</small>
                    <span>{{ item.laboratorio.telefono }}</span>
                  </div>
                }
                @if (item.laboratorio.email) {
                  <div class="lab-field">
                    <small>Email</small>
                    <span>{{ item.laboratorio.email }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <div class="image-gallery" style="margin-top: 1rem;">
            <div class="image-hero" [ngClass]="!heroImage(item) ? 'empty-state' : ''">
              @if (heroImage(item)) {
                <img [src]="heroImage(item)!" [alt]="item.nombre_comercial">
              } @else {
                <div class="empty-state">
                  <div>
                    <strong>Sin imagen principal</strong>
                    <div class="muted">Adjunta una imagen escaneada, importada o una fotografía del producto.</div>
                  </div>
                </div>
              }
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

            @if (item.images?.length) {
              <div class="image-thumbs">
                @for (image of item.images; track image.id_imagen) {
                  <div class="image-thumb">
                    <img [src]="image.url" [alt]="item.nombre_comercial">
                    <div class="meta">
                      <div><strong>{{ image.tipo_origen }}</strong></div>
                      <div class="muted">{{ image.fecha_creacion | date:'yyyy-MM-dd HH:mm' }}</div>
                      @if (image.es_principal) {
                        <span class="chip success">Principal</span>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="notice">Todavía no hay imágenes asociadas a este producto.</div>
            }
          </div>

          <div style="margin-top: 1.5rem;">
            <h4 style="margin: 0 0 .75rem;">Stock por lote</h4>
            <div class="table-wrap compact" style="border-radius: 12px;">
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
                  @for (row of item.stock_lotes; track row.id_lote) {
                    <tr>
                      <td>{{ row.numero_lote }}</td>
                      <td>{{ row.fecha_vencimiento | date:'yyyy-MM-dd' }}</td>
                      <td>{{ row.almacen || '—' }}</td>
                      <td>{{ row.ubicacion || '—' }}</td>
                      <td>{{ row.cantidad_disponible }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="muted">Aún no hay lotes registrados para este producto.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Vista principal -->
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Maestro MX</h1>
          <p class="page-subtitle">Gestión del catálogo de medicamentos. Haz clic en un producto para ver su ficha y gestionar imágenes.</p>
        </div>
        <button class="btn" (click)="openModal()">+ Agregar producto</button>
      </div>

      @if (message()) {
        <div class="success-box" style="margin-bottom: 1rem;">{{ message() }}</div>
      }

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
                <th>Laboratorio</th>
                <th>Código</th>
                <th>Stock</th>
                <th>Imagen</th>
              </tr>
            </thead>
            <tbody>
              @for (p of products(); track p.id_producto) {
                <tr class="table-row-clickable" (click)="openDetail(p.id_producto)">
                  <td>
                    <strong>{{ p.nombre_comercial }}</strong><br>
                    <span class="muted">{{ p.sku }} · {{ p.principio_activo || 'Sin principio activo' }}</span>
                  </td>
                  <td>{{ p.laboratorio_nombre || '—' }}</td>
                  <td>
                    <div>{{ p.codigo_barras || '—' }}</div>
                    <span class="chip" [ngClass]="p.requiere_cadena_frio ? 'info' : (p.es_controlado ? 'accent' : 'primary')">
                      {{ p.requiere_cadena_frio ? 'Frío' : (p.es_controlado ? 'Controlado' : p.tipo_producto) }}
                    </span>
                  </td>
                  <td>{{ p.stock_actual }}</td>
                  <td>
                    @if (p.imagen_principal_url) {
                      <span class="chip success">Sí</span>
                    } @else {
                      <span class="chip warn">Pendiente</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="muted" style="text-align:center; padding: 2rem;">
                    No hay productos registrados. Usa "+ Agregar producto" para comenzar.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal-panel {
      background: var(--surface, #fff);
      border-radius: 18px;
      padding: 1.5rem;
      width: 100%;
      max-width: 760px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    }
    .modal-panel--wide {
      max-width: 960px;
    }
    .modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .modal-header h3 {
      margin: 0 0 0.25rem;
    }
    .lab-section {
      margin: 1.25rem 0;
      padding: 1rem 1.25rem;
      background: var(--surface-alt, #f8f9fa);
      border-radius: 12px;
      border: 1px solid var(--border, #e5e7eb);
    }
    .lab-section h4 {
      margin: 0 0 0.75rem;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted, #6b7280);
    }
    .lab-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 0.75rem;
    }
    .lab-field {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }
    .lab-field small {
      font-size: 0.75rem;
      color: var(--muted, #6b7280);
    }
    .lab-field strong,
    .lab-field span {
      font-size: 0.875rem;
    }
  `]
})
export class MaestroMxComponent implements OnInit {
  search = '';
  products = signal<any[]>([]);
  selected = signal<any | null>(null);
  laboratorios = signal<any[]>([]);

  message = signal('');
  formMessage = signal('');
  formError = signal('');
  detailMessage = signal('');
  detailError = signal('');

  showModal = signal(false);
  showDetailModal = signal(false);

  mediaForm: { tipo_origen: MediaSourceType; descripcion: string } = {
    tipo_origen: 'importada',
    descripcion: ''
  };

  form: any = {
    codigo_interno: '',
    tipo_producto: '',
    nombre_producto: '',
    nombre_comercial: '',
    id_laboratorio: null,
    presentacion: 0,
    registro_invima: '',
    cum: 0,
    consecutivo_cum: 0,
    atc: '',
    principio_activo: '',
    concentracion: '',
    forma_farmaceutica: '',
    clasificacion: '',
    iva: 0
  };

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.loadLookups();
    void this.load();
  }

  private async loadLookups() {
    try {
      const response = await this.api.get<{ success: boolean; data: { laboratorios: any[] } }>('/products/lookups');
      this.laboratorios.set(response.data.laboratorios ?? []);
    } catch {
      // non-fatal — form just won't have a lab dropdown populated
    }
  }

  openModal() {
    this.formMessage.set('');
    this.formError.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  async openDetail(id: number) {
    this.detailMessage.set('');
    this.detailError.set('');
    await this.selectProduct(id);
    this.showDetailModal.set(true);
  }

  closeDetailModal() {
    this.showDetailModal.set(false);
  }

  async load(preselectId?: number | null) {
    const response = await this.api.get<{ success: boolean; data: any[] }>(`/products?search=${encodeURIComponent(this.search)}`);
    this.products.set(response.data);

    if (preselectId) {
      await this.selectProduct(preselectId);
    }
  }

  async selectProduct(id: number) {
    const response = await this.api.get<{ success: boolean; data: any }>(`/products/${id}`);
    this.selected.set(response.data);
  }

  async create() {
    this.formError.set('');
    try {
      const response = await this.api.post<{ success: boolean; data: any }>('/products', this.form);
      this.formMessage.set('Producto registrado correctamente.');
      this.resetForm();
      this.closeModal();
      this.message.set('Producto registrado correctamente.');
      await this.load(response.data.id_producto);
    } catch (err: any) {
      this.formError.set(err?.error?.message || 'No fue posible guardar el producto.');
    }
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
        metadata: { originalName: file.name, size: file.size, source: sourceType }
      });
      this.detailMessage.set('Imagen cargada correctamente.');
      this.mediaForm.descripcion = '';
      await this.selectProduct(selected.id_producto);
      await this.load(selected.id_producto);
    } catch (error: any) {
      this.detailError.set(error?.error?.message || 'No fue posible cargar la imagen.');
    } finally {
      input.value = '';
    }
  }

  heroImage(item: any) {
    return item?.imagen_principal_url || item?.images?.[0]?.url || null;
  }

  private resetForm() {
    this.form = {
      codigo_interno: '',
      tipo_producto: '',
      nombre_producto: '',
      nombre_comercial: '',
      id_laboratorio: null,
      presentacion: 0,
      registro_invima: '',
      cum: 0,
      consecutivo_cum: 0,
      atc: '',
      principio_activo: '',
      concentracion: '',
      forma_farmaceutica: '',
      clasificacion: '',
      iva: 0
    };
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