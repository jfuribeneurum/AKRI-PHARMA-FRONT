import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { SignaturePadComponent } from '../shared/signature-pad.component';

@Component({
  selector: 'akri-dispensing',
  standalone: true,
  imports: [CommonModule, FormsModule, SignaturePadComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ isSebasDispensing ? 'Dispensación Sebas' : 'Dispensación' }}</h1>
          <p class="page-subtitle">
            Registra domiciliarios, paciente, receptor, temperatura de entrega y firma digital de recepción a conformidad.
          </p>
        </div>
        <div class="toolbar" style="margin-bottom: 0;">
          <button class="btn secondary" (click)="load()">Actualizar</button>
        </div>
      </div>

      <div *ngIf="message()" class="success-box" style="margin-bottom: 1rem;">{{ message() }}</div>
      <div *ngIf="error()" class="error-box" style="margin-bottom: 1rem;">{{ error() }}</div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>Domiciliarios</h3>
              <div class="helper">Base manual reutilizable hasta eliminación por administrador.</div>
            </div>
            <span class="chip info">{{ domiciliaries().length }} activos</span>
          </div>

          <div class="form-grid">
            <label>
              Nombre
              <input [(ngModel)]="domiciliaryForm.nombre">
            </label>
            <label>
              Apellido
              <input [(ngModel)]="domiciliaryForm.apellido">
            </label>
            <label>
              Cédula
              <input [(ngModel)]="domiciliaryForm.cedula">
            </label>
            <label>
              Teléfono
              <input [(ngModel)]="domiciliaryForm.telefono">
            </label>
            <label>
              Sexo
              <select [(ngModel)]="domiciliaryForm.sexo">
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
              </select>
            </label>
          </div>

          <div class="form-actions">
            <button class="btn" (click)="saveDomiciliary()">Guardar domiciliario</button>
          </div>

          <div class="table-wrap compact" style="margin-top: 1rem;">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Cédula</th>
                  <th>Teléfono</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of domiciliaries()">
                  <td>{{ row.nombre }} {{ row.apellido }}</td>
                  <td>{{ row.cedula }}</td>
                  <td>{{ row.telefono }}</td>
                  <td>
                    <button class="btn secondary btn-small" (click)="useDomiciliary(row)">Usar</button>
                    <button class="btn secondary btn-small" (click)="removeDomiciliary(row.id_domiciliario)">Eliminar</button>
                  </td>
                </tr>
                <tr *ngIf="!domiciliaries().length">
                  <td colspan="4" class="muted">No hay domiciliarios registrados.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card missing-meds-card" *ngIf="isSebasDispensing">
            <div class="card-header">
              <div>
                <h3>Medicamentos faltantes</h3>
                <div class="helper">Evidencia los medicamentos que no se pudieron entregar.</div>
              </div>
              <span class="chip warn">{{ form.missing_items.length }} faltantes</span>
            </div>

            <div class="form-grid">
              <label>
                Medicamento faltante
                <input [(ngModel)]="missingDraft.nombre" placeholder="Nombre del medicamento">
              </label>
              <label>
                Cantidad faltante
                <input type="number" min="0.001" step="0.001" [(ngModel)]="missingDraft.cantidad">
              </label>
              <label>
                Motivo
                <select [(ngModel)]="missingDraft.motivo">
                  <option value="Sin stock">Sin stock</option>
                  <option value="Lote no disponible">Lote no disponible</option>
                  <option value="Pendiente autorización">Pendiente autorización</option>
                  <option value="No entregado por novedad">No entregado por novedad</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>
            </div>

            <label class="report-label" style="margin-top: 0.9rem;">
              Evidencia / observación
              <textarea [(ngModel)]="missingDraft.evidencia" placeholder="Describe la novedad o soporte."></textarea>
            </label>

            <div class="form-actions">
              <button class="btn warn" (click)="addMissingItem()">Agregar faltante</button>
            </div>

            <div class="table-wrap compact" style="margin-top: 1rem;">
              <table>
                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th>Cantidad</th>
                    <th>Motivo</th>
                    <th>Evidencia</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of form.missing_items; let index = index">
                    <td><strong>{{ row.nombre }}</strong></td>
                    <td>{{ row.cantidad }}</td>
                    <td>{{ row.motivo }}</td>
                    <td>{{ row.evidencia || 'Sin detalle' }}</td>
                    <td><button class="btn secondary btn-small" (click)="removeMissingItem(index)">Quitar</button></td>
                  </tr>
                  <tr *ngIf="!form.missing_items.length">
                    <td colspan="5" class="muted">No hay medicamentos faltantes registrados.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card adjustment-exit-card" *ngIf="isSebasDispensing">
            <div class="card-header">
              <div>
                <h3>Salida de ajustes</h3>
                <div class="helper">Descuenta inventario únicamente para corregir diferencias de stock.</div>
              </div>
              <span class="chip danger">Ajuste</span>
            </div>

            <div class="form-grid">
              <label>
                Lote a ajustar
                <select [(ngModel)]="adjustmentDraft.id_lote" (ngModelChange)="selectAdjustmentLot()">
                  <option [ngValue]="null">Selecciona un lote</option>
                  <option *ngFor="let row of catalog()" [ngValue]="row.id_lote">
                    {{ row.nombre_comercial }} · {{ row.numero_lote }} · {{ row.ubicacion }} · {{ row.cantidad_disponible }}
                  </option>
                </select>
              </label>
              <label>
                Cantidad de salida
                <input type="number" min="0.001" step="0.001" [(ngModel)]="adjustmentDraft.cantidad">
              </label>
              <label>
                Motivo del ajuste
                <select [(ngModel)]="adjustmentDraft.motivo">
                  <option value="Ajuste por conteo físico">Ajuste por conteo físico</option>
                  <option value="Avería o pérdida">Avería o pérdida</option>
                  <option value="Vencimiento">Vencimiento</option>
                  <option value="Diferencia de inventario">Diferencia de inventario</option>
                  <option value="Otro ajuste">Otro ajuste</option>
                </select>
              </label>
            </div>

            <label class="report-label" style="margin-top: 0.9rem;">
              Soporte / observación
              <textarea [(ngModel)]="adjustmentDraft.soporte" placeholder="Describe el soporte del ajuste de salida."></textarea>
            </label>

            <div *ngIf="selectedAdjustmentLot()" class="notice" style="margin-top: 0.75rem;">
              <strong>{{ selectedAdjustmentLot()?.nombre_comercial }}</strong>
              <div>
                Lote {{ selectedAdjustmentLot()?.numero_lote }} · Disponible {{ selectedAdjustmentLot()?.cantidad_disponible }}
                · {{ selectedAdjustmentLot()?.almacen }} / {{ selectedAdjustmentLot()?.ubicacion }}
              </div>
            </div>

            <div class="form-actions">
              <button class="btn danger" (click)="saveAdjustmentExit()">Registrar salida de ajuste</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Encabezado de dispensación</h3>
              <div class="helper">Sede, almacén y datos de paciente / receptor.</div>
            </div>
          </div>

          <div class="form-grid">
            <label>
              Sede
              <select [(ngModel)]="form.id_sede" (ngModelChange)="onSiteChange()">
                <option [ngValue]="null">Selecciona una sede</option>
                <option *ngFor="let row of lookups().sites" [ngValue]="row.id_sede">{{ row.nombre }}</option>
              </select>
            </label>
            <label>
              Almacén
              <select [(ngModel)]="form.id_almacen">
                <option [ngValue]="null">Selecciona un almacén</option>
                <option *ngFor="let row of warehousesBySite()" [ngValue]="row.id_almacen">{{ row.nombre }}</option>
              </select>
            </label>
            <label>
              Tipo de receptor
              <select [(ngModel)]="form.receptor_tipo">
                <option value="paciente">Paciente</option>
                <option value="representante">Representante</option>
                <option value="domiciliario">Domiciliario</option>
              </select>
            </label>
          </div>

          <div class="switch-row">
            <label><input type="checkbox" [(ngModel)]="form.usar_domiciliario_receptor"> Quien recibe es un domiciliario</label>
          </div>

          <div class="form-grid" *ngIf="form.usar_domiciliario_receptor">
            <label>
              Domiciliario receptor
              <select [(ngModel)]="form.id_domiciliario" (ngModelChange)="applySelectedDomiciliary()">
                <option [ngValue]="null">Selecciona un domiciliario</option>
                <option *ngFor="let row of domiciliaries()" [ngValue]="row.id_domiciliario">
                  {{ row.nombre }} {{ row.apellido }} · {{ row.cedula }}
                </option>
              </select>
            </label>
          </div>

          <div class="form-grid" style="margin-top: 1rem;">
            <label>
              Paciente
              <input [(ngModel)]="form.paciente.nombre" placeholder="Nombre completo del paciente">
            </label>
            <label>
              Cédula paciente
              <input [(ngModel)]="form.paciente.documento">
            </label>
            <label>
              Teléfono paciente
              <input [(ngModel)]="form.paciente.telefono">
            </label>
            <label>
              Género
              <select [(ngModel)]="form.paciente.genero">
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
                <option value="O">Otro</option>
              </select>
            </label>
            <label>
              Nombre de quien recibe
              <input [(ngModel)]="form.receptor_nombre" [disabled]="form.usar_domiciliario_receptor">
            </label>
            <label>
              Documento receptor
              <input [(ngModel)]="form.receptor_documento" [disabled]="form.usar_domiciliario_receptor">
            </label>
            <label>
              Teléfono receptor
              <input [(ngModel)]="form.receptor_telefono" [disabled]="form.usar_domiciliario_receptor">
            </label>
            <label>
              Firma corresponde a
              <select [(ngModel)]="form.firma.tipo">
                <option value="domiciliario">Domiciliario</option>
                <option value="paciente">Paciente</option>
                <option value="representante">Representante</option>
              </select>
            </label>
            <label>
              Nombre firmante
              <input [(ngModel)]="form.firma.nombre">
            </label>
          </div>

          <label style="display:block; margin-top: 0.9rem; font-weight: 600;">
            Dirección del paciente
            <textarea [(ngModel)]="form.paciente.direccion"></textarea>
          </label>

          <label style="display:block; margin-top: 0.9rem; font-weight: 600;">
            Observaciones
            <textarea [(ngModel)]="form.observaciones"></textarea>
          </label>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top: 1rem;">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>Medicamentos a dispensar</h3>
              <div class="helper">Busca por medicamento, lote, principio activo o código de barras.</div>
            </div>
          </div>

          <div class="toolbar">
            <input [(ngModel)]="catalogSearch" placeholder="Buscar medicamento disponible">
            <button class="btn secondary" (click)="loadCatalog()">Buscar</button>
          </div>

          <div class="form-grid">
            <label>
              Lote disponible
              <select [(ngModel)]="lineDraft.id_lote" (ngModelChange)="selectCatalogLot()">
                <option [ngValue]="null">Selecciona un lote</option>
                <option *ngFor="let row of catalog()" [ngValue]="row.id_lote">
                  {{ row.nombre_comercial }} · {{ row.numero_lote }} · {{ row.cantidad_disponible }}
                </option>
              </select>
            </label>
            <label>
              Cantidad
              <input type="number" min="0.001" step="0.001" [(ngModel)]="lineDraft.cantidad">
            </label>
            <label>
              Temp. entrega (°C)
              <input type="number" step="0.1" [(ngModel)]="lineDraft.temperatura_entrega">
            </label>
          </div>

          <div *ngIf="selectedCatalog()" class="notice" style="margin-top: 0.75rem;">
            <strong>{{ selectedCatalog()?.nombre_comercial }}</strong>
            <div>
              {{ selectedCatalog()?.principio_activo }} · {{ selectedCatalog()?.concentracion }}
              · Lote {{ selectedCatalog()?.numero_lote }}
              · Disponible {{ selectedCatalog()?.cantidad_disponible }}
              · {{ selectedCatalog()?.requiere_cadena_frio ? 'Cadena de frío' : 'Temperatura ambiente' }}
              · {{ selectedCatalog()?.es_controlado ? 'Controlado' : 'No controlado' }}
            </div>
          </div>

          <div class="form-actions">
            <button class="btn" (click)="addItem()">Agregar medicamento</button>
          </div>

          <div class="table-wrap compact" style="margin-top: 1rem;">
            <table>
              <thead>
                <tr>
                  <th>Medicamento</th>
                  <th>Lote</th>
                  <th>Cantidad</th>
                  <th>Temp</th>
                  <th>Características</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of form.items; let index = index">
                  <td>
                    <strong>{{ row.nombre_comercial }}</strong>
                    <div class="muted">{{ row.principio_activo }} · {{ row.concentracion }}</div>
                  </td>
                  <td>{{ row.numero_lote }}</td>
                  <td>{{ row.cantidad }}</td>
                  <td>{{ row.temperatura_entrega ?? 'N/A' }}</td>
                  <td>
                    <span class="chip accent" *ngIf="row.requiere_cadena_frio">Frío</span>
                    <span class="chip warn" *ngIf="row.es_controlado">Controlado</span>
                  </td>
                  <td><button class="btn secondary btn-small" (click)="removeItem(index)">Quitar</button></td>
                </tr>
                <tr *ngIf="!form.items.length">
                  <td colspan="6" class="muted">Aún no hay medicamentos agregados.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Firma digital</h3>
              <div class="helper">La entrega queda soportada con la firma del domiciliario, paciente o representante.</div>
            </div>
          </div>

          <akri-signature-pad
            [clearTrigger]="signatureReset()"
            (valueChange)="form.firma.data_url = $event">
          </akri-signature-pad>

          <div class="notice" style="margin-top: 0.75rem;" *ngIf="form.firma.data_url">
            Firma capturada correctamente.
          </div>

          <div class="form-actions" style="margin-top: 1rem;">
            <button class="btn accent" (click)="saveDispensation()">Registrar dispensación</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: 1rem;">
        <div class="card-header">
          <div>
            <h3>Dispensaciones recientes</h3>
            <div class="helper">Trazabilidad de receptor, paciente, sede e ítems entregados.</div>
          </div>
        </div>
        <div class="table-wrap compact">
          <table>
            <thead>
              <tr>
                <th>Consecutivo</th>
                <th>Fecha</th>
                <th>Paciente</th>
                <th>Receptor</th>
                <th>Sede</th>
                <th>Ítems</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of dispensations()">
                <td>{{ row.consecutivo }}</td>
                <td>{{ row.fecha_hora | date:'yyyy-MM-dd HH:mm' }}</td>
                <td>{{ row.paciente }}</td>
                <td>{{ row.receptor_nombre }}</td>
                <td>{{ row.sede }}</td>
                <td>{{ row.items }} / {{ row.unidades }}</td>
              </tr>
              <tr *ngIf="!dispensations().length">
                <td colspan="6" class="muted">No hay dispensaciones recientes.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `
})
export class DispensingComponent implements OnInit {
  readonly message = signal('');
  readonly error = signal('');
  readonly lookups = signal<any>({ sites: [], warehouses: [], domiciliaries: [] });
  readonly domiciliaries = signal<any[]>([]);
  readonly catalog = signal<any[]>([]);
  readonly selectedCatalog = signal<any | null>(null);
  readonly selectedAdjustmentLot = signal<any | null>(null);
  readonly dispensations = signal<any[]>([]);
  readonly signatureReset = signal(0);

  catalogSearch = '';
  domiciliaryForm = this.blankDomiciliary();
  lineDraft: any = { id_lote: null, cantidad: 1, temperatura_entrega: null };
  missingDraft: any = this.blankMissingDraft();
  adjustmentDraft: any = this.blankAdjustmentDraft();
  form: any = this.blankForm();
  isSebasDispensing = false;

  constructor(
    private readonly api: ApiService,
    private readonly router: Router
  ) {}

  ngOnInit() {
    this.isSebasDispensing = this.router.url.includes('dispensing-sebas');
    void this.load();
  }

  async load() {
    try {
      this.error.set('');
      const [lookups, domiciliaryResponse, dispensations] = await Promise.all([
        this.api.get<{ success: boolean; data: any }>('/dispensing/lookups'),
        this.api.get<{ success: boolean; data: any[] }>('/dispensing/domiciliaries'),
        this.api.get<{ success: boolean; data: any[] }>('/dispensing')
      ]);

      this.lookups.set(lookups.data);
      this.domiciliaries.set(domiciliaryResponse.data);
      this.dispensations.set(dispensations.data);

      if (!this.form.id_sede && lookups.data.sites?.length) {
        this.form.id_sede = lookups.data.sites[0].id_sede;
      }
      this.onSiteChange();
      await this.loadCatalog();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar dispensación.');
    }
  }

  warehousesBySite() {
    return (this.lookups().warehouses ?? []).filter((row: any) => !this.form.id_sede || Number(row.id_sede) === Number(this.form.id_sede));
  }

  onSiteChange() {
    const options = this.warehousesBySite();
    if (options.length && !options.some((row: any) => Number(row.id_almacen) === Number(this.form.id_almacen))) {
      this.form.id_almacen = options[0].id_almacen;
    }
    void this.loadCatalog();
  }

  async loadCatalog() {
    try {
      const response = await this.api.get<{ success: boolean; data: any[] }>(
        `/dispensing/catalog?search=${encodeURIComponent(this.catalogSearch)}&id_sede=${this.form.id_sede || ''}`
      );
      this.catalog.set(response.data);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar el catálogo de dispensación.');
    }
  }

  selectCatalogLot() {
    const selected = this.catalog().find((row) => Number(row.id_lote) === Number(this.lineDraft.id_lote)) ?? null;
    this.selectedCatalog.set(selected);
    if (selected && !selected.requiere_cadena_frio) {
      this.lineDraft.temperatura_entrega = null;
    }
  }

  addItem() {
    const selected = this.selectedCatalog();
    if (!selected) {
      this.error.set('Selecciona un lote para agregar.');
      return;
    }

    const quantity = Number(this.lineDraft.cantidad);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      this.error.set('La cantidad debe ser mayor que cero.');
      return;
    }

    if (selected.requiere_cadena_frio && (this.lineDraft.temperatura_entrega === null || this.lineDraft.temperatura_entrega === undefined || this.lineDraft.temperatura_entrega === '')) {
      this.error.set('Debes registrar la temperatura de entrega del medicamento de cadena de frío.');
      return;
    }

    this.form.items = [
      ...this.form.items,
      {
        id_lote: selected.id_lote,
        cantidad: quantity,
        temperatura_entrega: this.lineDraft.temperatura_entrega !== null && this.lineDraft.temperatura_entrega !== undefined && this.lineDraft.temperatura_entrega !== '' ? Number(this.lineDraft.temperatura_entrega) : null,
        nombre_comercial: selected.nombre_comercial,
        principio_activo: selected.principio_activo,
        concentracion: selected.concentracion,
        numero_lote: selected.numero_lote,
        requiere_cadena_frio: Boolean(selected.requiere_cadena_frio),
        es_controlado: Boolean(selected.es_controlado)
      }
    ];

    this.lineDraft = { id_lote: null, cantidad: 1, temperatura_entrega: null };
    this.selectedCatalog.set(null);
    this.error.set('');
  }

  removeItem(index: number) {
    this.form.items = this.form.items.filter((_: any, rowIndex: number) => rowIndex !== index);
  }

  addMissingItem() {
    const quantity = Number(this.missingDraft.cantidad);
    if (!this.missingDraft.nombre.trim()) {
      this.error.set('Escribe el medicamento faltante.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      this.error.set('La cantidad faltante debe ser mayor que cero.');
      return;
    }

    this.form.missing_items = [
      ...this.form.missing_items,
      {
        nombre: this.missingDraft.nombre.trim(),
        cantidad: quantity,
        motivo: this.missingDraft.motivo,
        evidencia: this.missingDraft.evidencia.trim()
      }
    ];
    this.missingDraft = this.blankMissingDraft();
    this.error.set('');
  }

  removeMissingItem(index: number) {
    this.form.missing_items = this.form.missing_items.filter((_: any, rowIndex: number) => rowIndex !== index);
  }

  selectAdjustmentLot() {
    const selected = this.catalog().find((row) => Number(row.id_lote) === Number(this.adjustmentDraft.id_lote)) ?? null;
    this.selectedAdjustmentLot.set(selected);
  }

  async saveAdjustmentExit() {
    const selected = this.selectedAdjustmentLot();
    const quantity = Number(this.adjustmentDraft.cantidad);

    if (!selected) {
      this.error.set('Selecciona un lote para la salida de ajuste.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      this.error.set('La cantidad de salida debe ser mayor que cero.');
      return;
    }

    if (quantity > Number(selected.cantidad_disponible)) {
      this.error.set('La cantidad de salida no puede superar el disponible del lote.');
      return;
    }

    try {
      this.error.set('');
      await this.api.post('/inventory/movements', {
        tipo: 'merma',
        id_lote: selected.id_lote,
        id_almacen_origen: selected.id_almacen,
        id_ubicacion_origen: selected.id_ubicacion,
        cantidad: quantity,
        motivo: `${this.adjustmentDraft.motivo}${this.adjustmentDraft.soporte ? ` - ${this.adjustmentDraft.soporte}` : ''}`,
        referencia_tipo: 'AJUSTE_INVENTARIO_SEBAS',
        referencia_id: null
      });
      this.message.set('Salida de ajuste registrada y descontada del inventario.');
      this.adjustmentDraft = this.blankAdjustmentDraft();
      this.selectedAdjustmentLot.set(null);
      await this.loadCatalog();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible registrar la salida de ajuste.');
    }
  }

  useDomiciliary(row: any) {
    this.form.usar_domiciliario_receptor = true;
    this.form.id_domiciliario = row.id_domiciliario;
    this.applySelectedDomiciliary();
  }

  applySelectedDomiciliary() {
    const selected = this.domiciliaries().find((row) => Number(row.id_domiciliario) === Number(this.form.id_domiciliario));
    if (!selected || !this.form.usar_domiciliario_receptor) {
      return;
    }

    const name = `${selected.nombre} ${selected.apellido}`;
    this.form.receptor_tipo = 'domiciliario';
    this.form.receptor_nombre = name;
    this.form.receptor_documento = selected.cedula;
    this.form.receptor_telefono = selected.telefono;

    if (this.form.firma.tipo === 'domiciliario' || !this.form.firma.nombre) {
      this.form.firma.nombre = name;
    }
  }

  async saveDomiciliary() {
    try {
      this.error.set('');
      await this.api.post('/dispensing/domiciliaries', this.domiciliaryForm);
      this.message.set('Domiciliario guardado.');
      this.domiciliaryForm = this.blankDomiciliary();
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible guardar el domiciliario.');
    }
  }

  async removeDomiciliary(id: number) {
    try {
      this.error.set('');
      await this.api.delete(`/dispensing/domiciliaries/${id}`);
      this.message.set('Domiciliario eliminado.');
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'Solo el perfil administrador puede eliminar domiciliarios.');
    }
  }

  async saveDispensation() {
    try {
      this.error.set('');
      if (!this.form.items.length) {
        this.error.set('Agrega al menos un medicamento a dispensar.');
        return;
      }

      if (!this.form.firma.data_url) {
        this.error.set('Debes capturar la firma digital de recepción.');
        return;
      }

      const payload = {
        ...this.form,
        observaciones: this.buildObservations(),
        items: this.form.items.map((item: any) => ({
          id_lote: item.id_lote,
          cantidad: item.cantidad,
          temperatura_entrega: item.temperatura_entrega
        }))
      };

      const response = await this.api.post<{ success: boolean; data: any }>('/dispensing', payload);
      this.message.set(`Dispensación ${response.data.consecutivo} registrada.`);
      this.form = this.blankForm();
      this.form.id_sede = this.lookups().sites?.[0]?.id_sede ?? null;
      this.onSiteChange();
      this.signatureReset.set(Date.now());
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible registrar la dispensación.');
    }
  }

  private blankDomiciliary() {
    return {
      nombre: '',
      apellido: '',
      cedula: '',
      telefono: '',
      sexo: 'O'
    };
  }

  private blankMissingDraft() {
    return {
      nombre: '',
      cantidad: 1,
      motivo: 'Sin stock',
      evidencia: ''
    };
  }

  private blankAdjustmentDraft() {
    return {
      id_lote: null,
      cantidad: 1,
      motivo: 'Ajuste por conteo físico',
      soporte: ''
    };
  }

  private buildObservations() {
    const observations = String(this.form.observaciones ?? '').trim();
    if (!this.isSebasDispensing || !this.form.missing_items.length) {
      return observations;
    }

    const missingSummary = this.form.missing_items
      .map((item: any, index: number) => `${index + 1}. ${item.nombre} | Cantidad: ${item.cantidad} | Motivo: ${item.motivo} | Evidencia: ${item.evidencia || 'Sin detalle'}`)
      .join('\n');

    return [observations, `Medicamentos faltantes:\n${missingSummary}`].filter(Boolean).join('\n\n');
  }

  private blankForm() {
    return {
      id_sede: null,
      id_almacen: null,
      id_domiciliario: null,
      usar_domiciliario_receptor: false,
      receptor_tipo: 'paciente',
      receptor_nombre: '',
      receptor_documento: '',
      receptor_telefono: '',
      observaciones: '',
      paciente: {
        id_paciente: null,
        nombre: '',
        documento: '',
        direccion: '',
        telefono: '',
        genero: 'O'
      },
      firma: {
        tipo: 'paciente',
        nombre: '',
        data_url: ''
      },
      items: [],
      missing_items: []
    };
  }
}
