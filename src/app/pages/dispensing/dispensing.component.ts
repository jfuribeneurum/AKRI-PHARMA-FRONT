import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SignaturePadComponent } from '../../shared/signature-pad.component';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

@Component({
  selector: 'akri-dispensing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dispensing.component.html',
  styleUrls: ['./dispensing.component.css'],
  imports: [CommonModule, FormsModule, SignaturePadComponent, UppercaseInputDirective]
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
  isPharmaDispensing = false;

  constructor(
    private readonly api: ApiService,
    private readonly router: Router
  ) {}

  ngOnInit() {
    this.isPharmaDispensing = this.router.url.includes('dispensing-pharma');
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
        referencia_tipo: 'AJUSTE_INVENTARIO_PHARMA',
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
    if (!this.isPharmaDispensing || !this.form.missing_items.length) {
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
