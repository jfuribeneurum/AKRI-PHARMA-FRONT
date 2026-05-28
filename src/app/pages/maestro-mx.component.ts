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
    <!-- Modal: agregar / editar producto -->
    @if (showModal()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ editingId() ? 'Editar producto' : 'Nuevo producto' }}</h3>
              <div class="helper">{{ editingId() ? 'Modifica los datos del catálogo.' : 'Alta rápida del maestro de catálogo.' }}</div>
            </div>
            <button class="btn secondary" (click)="closeModal()">✕ Cerrar</button>
          </div>

          @if (formMessage()) {
            <div class="success-box" style="margin-bottom: 1rem;">{{ formMessage() }}</div>
          }
          @if (formError()) {
            <div class="error-box" style="margin-bottom: 1rem;">{{ formError() }}</div>
          }

          <!-- Sección 1: Medicamento base desde HS -->
          <div class="hs-section">
            <div class="hs-section-title">Medicamento base <span class="chip info" style="font-size:0.7rem;vertical-align:middle;">HealthSphere</span></div>

            @if (form.id_medicamento_hs) {
              <div class="hs-linked">
                <div class="hs-linked-info">
                  <strong>{{ form.nombre_comercial }}</strong>
                  <span class="muted">{{ form.principio_activo }}{{ form.concentracion ? ' · ' + form.concentracion : '' }}{{ form.atc ? ' · ATC: ' + form.atc : '' }}</span>
                </div>
                <button class="btn secondary btn-small" (click)="clearHsMed()">Cambiar</button>
              </div>
            } @else {
              <div class="hs-search-row">
                <input [(ngModel)]="hsSearch" (ngModelChange)="onHsSearchChange($event)" placeholder="Buscar medicamento por nombre, principio activo o ATC…" autocomplete="off">
                @if (hsSearching()) {
                  <span class="hs-spinner">Buscando…</span>
                }
              </div>

              @if (hsResults().length) {
                <div class="hs-results">
                  @for (med of hsResults(); track med.id) {
                    <div class="hs-result-row" (click)="selectHsMed(med)">
                      <div>
                        <strong>{{ med.nombreComercial || med.nombre }}</strong>
                        @if (med.nombreComercial && med.nombreComercial !== med.nombre) {
                          <span class="muted"> · {{ med.nombre }}</span>
                        }
                        <span class="muted"> · {{ med.principioActivo }}{{ med.concentracion ? ' · ' + med.concentracion : '' }}</span>
                      </div>
                      @if (med.atc) {
                        <span class="chip primary" style="font-size:0.7rem;">{{ med.atc }}</span>
                      }
                    </div>
                  }
                </div>
              }

              @if (hsNoResults()) {
                <div class="notice">No se encontraron medicamentos para "{{ hsSearch }}".</div>
              }
            }
          </div>

          <!-- Sección 2: Datos completos -->
          <div class="form-two-col" style="margin-top:1.25rem;">

            <!-- Columna izquierda: info del medicamento (algunos pre-llenados por HS) -->
            <div>
              <div class="hs-section-title">
                Información del medicamento
                @if (form.id_medicamento_hs) {
                  <span class="chip info" style="font-size:0.65rem;vertical-align:middle;margin-left:0.4rem;">Desde HealthSphere</span>
                }
              </div>
              <div class="form-grid form-grid-1">
                <label>
                  Nombre comercial
                  <input [(ngModel)]="form.nombre_comercial" placeholder="Nombre comercial o de marca" [class.hs-filled]="form.id_medicamento_hs">
                </label>
                <label>
                  Principio activo
                  <input [(ngModel)]="form.principio_activo" placeholder="Ingrediente principal" [class.hs-filled]="form.id_medicamento_hs">
                </label>
                <label>
                  Concentración
                  <input [(ngModel)]="form.concentracion" placeholder="Ej: 500 mg, 100 mg/ml" [class.hs-filled]="form.id_medicamento_hs">
                </label>
                <label>
                  Código ATC
                  <input [(ngModel)]="form.atc" placeholder="Ej: N02BE01" [class.hs-filled]="form.id_medicamento_hs">
                </label>
                <label>
                  Forma farmacéutica
                  <select [(ngModel)]="form.id_forma" [class.hs-filled]="form.id_medicamento_hs && form.id_forma">
                    <option [value]="null">Sin especificar</option>
                    @for (f of formas(); track f.id_forma) {
                      <option [value]="f.id_forma">{{ f.nombre }}</option>
                    }
                  </select>
                </label>
                <label>
                  Clasificación
                  <input [(ngModel)]="form.clasificacion" placeholder="Ej: Analgésico, Antibiótico">
                </label>
              </div>
            </div>

            <!-- Columna derecha: datos de farmacia -->
            <div>
              <div class="hs-section-title">Datos de farmacia</div>
              <div class="form-grid form-grid-2">
                <label>
                  Código interno
                  <input [(ngModel)]="form.codigo_interno" placeholder="SKU / Código único">
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
                  Unidad de medida
                  <input [(ngModel)]="form.unidad_medida" placeholder="UND, TAB, CAP, ML…">
                </label>
                <label>
                  Presentación
                  <input [(ngModel)]="form.presentacion" placeholder="Ej: 30 tabletas / caja">
                </label>
                <label>
                  Registro INVIMA
                  <input [(ngModel)]="form.registro_invima" placeholder="INVIMA-XXXXXX">
                </label>
                <label>
                  CUM
                  <input type="number" [(ngModel)]="form.cum" placeholder="Código único de medicamento">
                </label>
                <label>
                  Consecutivo CUM
                  <input type="number" [(ngModel)]="form.consecutivo_cum" placeholder="Número consecutivo">
                </label>
                <label>
                  Proveedor / Laboratorio
                  <select [(ngModel)]="form.id_laboratorio">
                    <option [value]="null">Sin proveedor</option>
                    @for (lab of laboratorios(); track lab.id_laboratorio) {
                      <option [value]="lab.id_laboratorio">{{ lab.nombre }}</option>
                    }
                  </select>
                </label>
                <label>
                  IVA (%)
                  <input type="number" [(ngModel)]="form.iva" step="0.1" placeholder="0">
                </label>
                <label>
                  Precio de venta
                  <input type="number" [(ngModel)]="form.precio_venta" placeholder="0">
                </label>
                <label>
                  Costo de referencia
                  <input type="number" [(ngModel)]="form.costo_referencia" placeholder="0">
                </label>
              </div>

              <div class="switch-row" style="margin-top:1rem;gap:1.5rem;">
                <label style="display:flex;align-items:center;gap:0.4rem;">
                  <input type="checkbox" [(ngModel)]="form.requiere_receta"> Requiere receta
                </label>
                <label style="display:flex;align-items:center;gap:0.4rem;">
                  <input type="checkbox" [(ngModel)]="form.es_controlado"> Controlado
                </label>
                <label style="display:flex;align-items:center;gap:0.4rem;">
                  <input type="checkbox" [(ngModel)]="form.requiere_cadena_frio"> Cadena de frío
                </label>
              </div>
            </div>
          </div>

          <div class="form-actions" style="margin-top:1.5rem;">
            <button class="btn secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn" (click)="save()">{{ editingId() ? 'Actualizar producto' : 'Guardar producto' }}</button>
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
                <th>Stock</th>
                <th>Acción</th>
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
                  <td>{{ p.stock_actual }}</td>
                  <td (click)="$event.stopPropagation()">
                    <button class="btn secondary btn-small" (click)="openEditModal(p)">Editar</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="muted" style="text-align:center; padding: 2rem;">
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
      background: rgba(0, 0, 0, 0.55);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal-panel {
      background: var(--surface, #fff);
      border-radius: 18px;
      padding: 2rem 2.5rem;
      width: 100%;
      max-width: calc(100vw - 2rem);
      height: calc(100vh - 2rem);
      overflow-y: auto;
      box-shadow: 0 8px 40px rgba(0,0,0,0.22);
    }
    .modal-panel--wide {
      max-width: calc(100vw - 2rem);
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
    .btn-icon {
      background: none;
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 8px;
      padding: 0.25rem 0.5rem;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      color: var(--muted, #6b7280);
      transition: background 0.15s, color 0.15s;
    }
    .btn-icon:hover {
      background: var(--surface-alt, #f3f4f6);
      color: var(--fg, #111);
    }
    .hs-section {
      background: var(--surface-alt, #f8f9fa);
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      margin-bottom: 0.5rem;
    }
    .hs-section-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted, #6b7280);
      margin-bottom: 0.75rem;
    }
    .hs-linked {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .hs-linked-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .hs-search-row {
      display: flex;
      gap: 0.5rem;
    }
    .hs-search-row input {
      flex: 1;
    }
    .hs-spinner {
      font-size: 0.8rem;
      color: var(--muted, #6b7280);
      white-space: nowrap;
      align-self: center;
    }
    .form-two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    .form-grid-1 {
      grid-template-columns: 1fr;
    }
    .form-grid-2 {
      grid-template-columns: 1fr 1fr;
    }
    .hs-filled {
      background: color-mix(in srgb, var(--info, #3b82f6) 8%, transparent);
      border-color: var(--info, #3b82f6) !important;
    }
    .hs-results {
      margin-top: 0.5rem;
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 8px;
      overflow: hidden;
      max-height: 220px;
      overflow-y: auto;
    }
    .hs-result-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 1rem;
      cursor: pointer;
      border-bottom: 1px solid var(--border, #e5e7eb);
      transition: background 0.12s;
      background: var(--surface, #fff);
    }
    .hs-result-row:last-child { border-bottom: none; }
    .hs-result-row:hover { background: var(--surface-alt, #f3f4f6); }
  `]
})
export class MaestroMxComponent implements OnInit {
  search = '';
  products = signal<any[]>([]);
  selected = signal<any | null>(null);
  laboratorios = signal<any[]>([]);
  formas = signal<any[]>([]);

  message = signal('');
  formMessage = signal('');
  formError = signal('');
  detailMessage = signal('');
  detailError = signal('');

  showModal = signal(false);
  showDetailModal = signal(false);
  editingId = signal<number | null>(null);

  hsSearch = '';
  hsResults = signal<any[]>([]);
  hsSearching = signal(false);
  hsNoResults = signal(false);
  private hsDebounce: ReturnType<typeof setTimeout> | null = null;

  mediaForm: { tipo_origen: MediaSourceType; descripcion: string } = {
    tipo_origen: 'importada',
    descripcion: ''
  };

  form: any = {};

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.form = this.blankForm();
    void this.loadLookups();
    void this.load();
  }

  private async loadLookups() {
    try {
      const response = await this.api.get<{ success: boolean; data: { laboratorios: any[]; formas: any[] } }>('/products/lookups');
      this.laboratorios.set(response.data.laboratorios ?? []);
      this.formas.set(response.data.formas ?? []);
    } catch {
      // non-fatal — form just won't have a lab dropdown populated
    }
  }

  openModal() {
    this.editingId.set(null);
    this.resetForm();
    this.hsSearch = '';
    this.hsResults.set([]);
    this.hsNoResults.set(false);
    this.formMessage.set('');
    this.formError.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId.set(null);
  }

  async openEditModal(p: any) {
    this.formMessage.set('');
    this.formError.set('');
    this.hsSearch = '';
    this.hsResults.set([]);
    this.hsNoResults.set(false);

    let full = p;
    try {
      const resp = await this.api.get<{ success: boolean; data: any }>(`/products/${p.id_producto}`);
      full = resp.data;
    } catch { /* usa datos del listado como fallback */ }

    this.editingId.set(full.id_producto);
    this.form = {
      id_medicamento_hs:    full.id_medicamento_hs ?? null,
      codigo_interno:       full.sku ?? '',
      tipo_producto:        full.tipo_producto ?? '',
      nombre_comercial:     full.nombre_comercial ?? '',
      principio_activo:     full.principio_activo ?? '',
      concentracion:        full.concentracion ?? '',
      presentacion:         full.presentacion ?? '',
      atc:                  full.codigo_atc ?? '',
      id_forma:             full.id_forma ?? null,
      clasificacion:        full.clasificacion ?? '',
      unidad_medida:        full.unidad_medida ?? '',
      registro_invima:      full.registro_invima ?? '',
      cum:                  full.cum ?? null,
      consecutivo_cum:      full.consecutivo_cum ?? null,
      id_laboratorio:       full.id_laboratorio ?? null,
      iva:                  full.iva_tasa ?? 0,
      precio_venta:         full.precio_venta ?? 0,
      costo_referencia:     full.costo_referencia ?? 0,
      requiere_receta:      !!full.requiere_receta,
      es_controlado:        !!full.es_controlado,
      requiere_cadena_frio: !!full.requiere_cadena_frio
    };
    this.showModal.set(true);
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

  async save() {
    if (this.editingId()) {
      await this.update();
    } else {
      await this.create();
    }
  }

  async create() {
    this.formError.set('');
    try {
      const response = await this.api.post<{ success: boolean; data: any }>('/products', this.buildApiPayload());
      this.formMessage.set('Producto registrado correctamente.');
      this.resetForm();
      this.closeModal();
      this.message.set('Producto registrado correctamente.');
      await this.load(response.data.id_producto);
    } catch (err: any) {
      this.formError.set(err?.error?.message || 'No fue posible guardar el producto.');
    }
  }

  async update() {
    this.formError.set('');
    try {
      await this.api.put(`/products/${this.editingId()}`, this.buildApiPayload());
      this.closeModal();
      this.message.set('Producto actualizado correctamente.');
      await this.load(this.editingId()!);
    } catch (err: any) {
      this.formError.set(err?.error?.message || 'No fue posible actualizar el producto.');
    }
  }

  onHsSearchChange(value: string) {
    if (this.hsDebounce) clearTimeout(this.hsDebounce);
    if (!value.trim()) {
      this.hsResults.set([]);
      this.hsNoResults.set(false);
      return;
    }
    this.hsDebounce = setTimeout(() => this.searchHsMed(), 300);
  }

  async searchHsMed() {
    const term = this.hsSearch.trim();
    if (!term) return;
    this.hsSearching.set(true);
    this.hsNoResults.set(false);
    this.hsResults.set([]);
    try {
      const resp: any = await this.api.get(`/medicamentos-hs?search=${encodeURIComponent(term)}&limit=20`);
      const lista: any[] = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.hsResults.set(lista);
      this.hsNoResults.set(lista.length === 0);
    } catch {
      this.hsNoResults.set(true);
    } finally {
      this.hsSearching.set(false);
    }
  }

  selectHsMed(med: any) {
    this.form.id_medicamento_hs = med.id;
    this.form.codigo_interno    = med.codigo ?? '';
    this.form.nombre_comercial  = med.nombreComercial || med.nombre || '';
    this.form.principio_activo  = med.principioActivo ?? '';
    this.form.concentracion     = med.concentracion ?? '';
    this.form.atc               = med.atc ?? '';
    this.form.id_forma          = this.matchForma(med.forma_farmaceutica);
    this.hsResults.set([]);
    this.hsSearch = '';
    this.hsNoResults.set(false);
  }

  private matchForma(hsText: string | null): number | null {
    if (!hsText) return null;
    const norm = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    const hsNorm = norm(hsText);
    const match = this.formas().find(f => hsNorm.includes(norm(f.nombre)));
    return match?.id_forma ?? null;
  }

  clearHsMed() {
    this.form.id_medicamento_hs  = null;
    this.form.nombre_comercial   = '';
    this.form.principio_activo   = '';
    this.form.concentracion      = '';
    this.form.atc               = '';
    this.form.id_forma          = null;
    this.hsResults.set([]);
    this.hsSearch = '';
    this.hsNoResults.set(false);
  }

  private buildApiPayload() {
    return {
      id_medicamento_hs:    this.form.id_medicamento_hs ?? null,
      sku:                  this.form.codigo_interno,
      nombre_comercial:     this.form.nombre_comercial,
      principio_activo:     this.form.principio_activo || null,
      concentracion:        this.form.concentracion || null,
      presentacion:         this.form.presentacion || null,
      unidad_medida:        this.form.unidad_medida || 'UND',
      registro_invima:      this.form.registro_invima || null,
      cum:                  this.form.cum ? Number(this.form.cum) : null,
      consecutivo_cum:      this.form.consecutivo_cum ? Number(this.form.consecutivo_cum) : null,
      codigo_atc:           this.form.atc || null,
      id_forma:             this.form.id_forma || null,
      tipo_producto:        this.form.tipo_producto || undefined,
      id_laboratorio:       this.form.id_laboratorio || null,
      iva_tasa:             Number(this.form.iva ?? 0),
      precio_venta:         Number(this.form.precio_venta ?? 0),
      costo_referencia:     Number(this.form.costo_referencia ?? 0),
      requiere_receta:      !!this.form.requiere_receta,
      es_controlado:        !!this.form.es_controlado,
      requiere_cadena_frio: !!this.form.requiere_cadena_frio
    };
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
    this.form = this.blankForm();
  }

  private blankForm() {
    return {
      id_medicamento_hs:    null,
      codigo_interno:       '',
      tipo_producto:        '',
      nombre_comercial:     '',
      principio_activo:     '',
      concentracion:        '',
      atc:                  '',
      id_forma:             null,
      clasificacion:        '',
      unidad_medida:        '',
      presentacion:         '',
      registro_invima:      '',
      cum:                  null,
      consecutivo_cum:      null,
      id_laboratorio:       null,
      iva:                  0,
      precio_venta:         0,
      costo_referencia:     0,
      requiere_receta:      false,
      es_controlado:        false,
      requiere_cadena_frio: false
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