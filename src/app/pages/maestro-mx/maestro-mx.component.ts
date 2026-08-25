import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

type MediaSourceType = 'escaneada' | 'importada' | 'fotografia';

@Component({
  selector: 'akri-maestro-mx',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maestro-mx.component.html',
  styleUrls: ['./maestro-mx.component.css'],
  imports: [CommonModule, FormsModule, UppercaseInputDirective]
})
export class MaestroMxComponent implements OnInit {
  search = '';
  filterLaboratorio: number | null = null;
  filterLote = '';
  products = signal<any[]>([]);
  selected = signal<any | null>(null);
  laboratorios = signal<any[]>([]);
  formas = signal<any[]>([]);
  tiposProducto = signal<{ valor: string; etiqueta: string }[]>([]);
  clasificaciones = signal<{ valor: string; etiqueta: string }[]>([]);

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

  codigoControlPreview = signal<string>('');
  codigoControlDuplicateCum = signal<string | null>(null);
  presentacionDuplicate = signal<string | null>(null);
  submitted = signal(false);
  private controlCodeDebounce: ReturnType<typeof setTimeout> | null = null;
  private presentacionDebounce: ReturnType<typeof setTimeout> | null = null;

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
      const [lookups, tipos, clasifs] = await Promise.all([
        this.api.get<{ success: boolean; data: { laboratorios: any[]; formas: any[] } }>('/products/lookups'),
        this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/tipo_producto/activos'),
        this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/clasificacion_producto/activos')
      ]);
      this.laboratorios.set(lookups.data.laboratorios ?? []);
      this.formas.set(lookups.data.formas ?? []);
      this.tiposProducto.set(tipos.data ?? []);
      this.clasificaciones.set(clasifs.data ?? []);
    } catch {
      // non-fatal — dropdowns fallback to empty
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
    this.codigoControlPreview.set('');
    this.codigoControlDuplicateCum.set(null);
    this.presentacionDuplicate.set(null);
    this.submitted.set(false);
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

    this.codigoControlPreview.set('');
    this.codigoControlDuplicateCum.set(null);
    this.presentacionDuplicate.set(null);
    this.submitted.set(false);
    this.editingId.set(full.id_producto);
    this.form = {
      id_medicamento_hs:    full.id_medicamento_hs ?? null,
      codigo_interno:       full.sku ?? '',
      codigo_control:       full.codigo_control ?? '',
      tipo_producto:        full.tipo_producto ?? '',
      nombre_comercial:     full.nombre_comercial ?? '',
      principio_activo:     full.principio_activo ?? '',
      concentracion:        full.concentracion ?? '',
      presentacion:         full.presentacion ?? '',
      atc:                  full.codigo_atc ?? '',
      codigo_dci:           full.codigo_dci ?? '',
      id_forma:             full.id_forma ?? null,
      clasificacion:        full.clasificacion ?? '',
      unidad_medida:        full.unidad_medida ?? '',
      registro_invima:      full.registro_invima ?? '',
      cum:                  full.cum ?? null,
      consecutivo_cum:      full.consecutivo_cum ?? null,
      id_laboratorio:       full.id_laboratorio ?? null,
      iva:                  Number(full.iva_tasa ?? 0),
      mx_control:           !!full.mx_control,
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
    const params = new URLSearchParams({ search: this.search });
    if (this.filterLaboratorio) params.set('id_laboratorio', String(this.filterLaboratorio));
    if (this.filterLote.trim()) params.set('lote', this.filterLote.trim());
    const response = await this.api.get<{ success: boolean; data: any[] }>(`/products?${params.toString()}`);
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
    this.submitted.set(true);
    const err = this.validateForm();
    if (err) { this.formError.set(err); return; }
    if (this.editingId()) {
      await this.update();
    } else {
      await this.create();
    }
  }

  onTipoProductoChange(tipo: string) {
    if (tipo !== 'dispositivo') {
      this.form.clasificacion = '';
    }
  }

  private validateForm(): string | null {
    if (this.form.id_medicamento_hs && !this.form.id_forma) return 'Este medicamento no tiene forma farmacéutica en HealthSphere. Actualízalo allí primero.';
    if (this.form.tipo_producto === 'dispositivo' && !this.form.clasificacion) return 'El campo Clasificación es obligatorio para dispositivos médicos.';
    if (!this.form.tipo_producto) return 'El campo Tipo de producto es obligatorio.';
    if (!this.form.presentacion) return 'El campo Presentación es obligatorio.';
    if (this.presentacionDuplicate()) return `La presentación ya está asociada a "${this.presentacionDuplicate()}". No se puede duplicar.`;
    if (!this.form.registro_invima) return 'El campo Registro INVIMA es obligatorio.';
    if (!this.form.id_laboratorio) return 'El campo Proveedor / Laboratorio es obligatorio.';
    if (!this.form.cum && this.form.cum !== 0) return 'El campo CUM es obligatorio.';
    if (!this.form.consecutivo_cum || String(this.form.consecutivo_cum).trim() === '') return 'El campo Consecutivo CUM es obligatorio.';
    return null;
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
    } catch (err: any) {
      const status = err?.status ?? err?.error?.status;
      if (status === 401) {
        this.formError.set('Sesión expirada. Por favor recarga la página.');
      }
      this.hsNoResults.set(true);
    } finally {
      this.hsSearching.set(false);
    }
  }

  selectHsMed(med: any) {
    this.form.id_medicamento_hs = med.id;
    this.form.codigo_interno    = med.codigo ?? '';
    // nombre_comercial lo escribe el usuario manualmente
    this.form.principio_activo  = med.principioActivo ?? '';
    this.form.concentracion     = med.concentracion ?? '';
    this.form.atc               = med.atc ?? '';
    this.form.unidad_medida     = med.unidad_dosificacion ?? '';
    this.form.id_forma          = this.matchForma(med.forma_farmaceutica);
    this.form.codigo_dci        = med.codigo_dci ?? '';
    this.hsResults.set([]);
    this.hsSearch = '';
    this.hsNoResults.set(false);
  }

  private matchForma(hsText: string | null): number | null {
    if (!hsText) return null;
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const hsNorm = norm(hsText);
    // Se prefiere la coincidencia más larga (más específica) para evitar que
    // un texto de HS como "polvo para reconstituir a suspensión inyectable"
    // quede matcheado contra la forma corta "Suspensión inyectable".
    let best: any = null;
    let bestLen = -1;
    for (const f of this.formas()) {
      const fNorm = norm(f.nombre);
      if ((hsNorm.includes(fNorm) || fNorm.includes(hsNorm)) && fNorm.length > bestLen) {
        best = f;
        bestLen = fNorm.length;
      }
    }
    return best?.id_forma ?? null;
  }

  clearHsMed() {
    this.form.id_medicamento_hs  = null;
    this.form.nombre_comercial   = '';
    this.form.principio_activo   = '';
    this.form.concentracion      = '';
    this.form.atc               = '';
    this.form.id_forma          = null;
    this.form.codigo_dci        = '';
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
      presentacion:         this.form.presentacion != null && this.form.presentacion !== '' ? Number(this.form.presentacion) : null,
      unidad_medida:        this.form.unidad_medida || 'UND',
      registro_invima:      this.form.registro_invima || null,
      cum:                  this.form.cum != null ? Number(this.form.cum) : null,
      consecutivo_cum:      this.form.consecutivo_cum != null && this.form.consecutivo_cum !== '' ? Number(this.form.consecutivo_cum) : null,
      codigo_atc:           this.form.atc || null,
      codigo_dci:           this.form.codigo_dci != null && this.form.codigo_dci !== '' ? Number(this.form.codigo_dci) : null,
      clasificacion:        this.form.clasificacion || null,
      id_forma:             this.form.id_forma || null,
      tipo_producto:        this.form.tipo_producto || undefined,
      id_laboratorio:       this.form.id_laboratorio || null,
      iva_tasa:             Number(this.form.iva ?? 0),
      mx_control:           !!this.form.mx_control,
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

  private extractLastCumPart(cum: any): string {
    if (cum == null) return '';
    const str = String(cum).trim();
    // Extrae el último segmento después del último '.' o '-'
    const match = str.match(/[.\-](\w+)$/);
    return match ? match[1] : str;
  }

  onCodigoOrLabChange() {
    this.onPresentacionChange();
    if (this.editingId()) return;

    const sku   = (this.form.codigo_interno ?? '').trim();
    const idLab = this.form.id_laboratorio;
    const cum   = this.form.consecutivo_cum;

    if (!sku) {
      this.codigoControlPreview.set('');
      this.codigoControlDuplicateCum.set(null);
      if (this.controlCodeDebounce) clearTimeout(this.controlCodeDebounce);
      return;
    }

    // Construir preview: MX01 → MX01-1 → MX01-1.9 (solo último número del CUM)
    let preview = sku;
    if (idLab != null) {
      preview += `-${idLab}`;
    }
    const cumStr = cum != null ? String(cum).trim() : '';
    if (cumStr !== '') {
      preview += `.${this.extractLastCumPart(cum)}`;
    }
    this.codigoControlPreview.set(preview);

    // API solo para verificar duplicado (debounced)
    if (this.controlCodeDebounce) clearTimeout(this.controlCodeDebounce);
    if (cumStr !== '') {
      this.controlCodeDebounce = setTimeout(() => void this.checkControlCode(), 400);
    } else {
      this.codigoControlDuplicateCum.set(null);
    }
  }

  onPresentacionChange() {
    if (this.presentacionDebounce) clearTimeout(this.presentacionDebounce);
    const presentacion = this.form.presentacion;
    if (presentacion == null || presentacion === '') {
      this.presentacionDuplicate.set(null);
      return;
    }
    this.presentacionDebounce = setTimeout(() => void this.checkPresentacionDuplicate(), 400);
  }

  async checkPresentacionDuplicate() {
    const presentacion = this.form.presentacion;
    const idLab = this.form.id_laboratorio;
    if (presentacion == null || presentacion === '') return;
    try {
      const params = [
        `presentacion=${encodeURIComponent(presentacion)}`,
        idLab ? `id_laboratorio=${idLab}` : '',
        this.editingId() ? `exclude_id=${this.editingId()}` : ''
      ].filter(Boolean).join('&');
      const resp = await this.api.get<{
        success: boolean;
        data: { codigo_control: string | null };
      }>(`/products/check-presentacion?${params}`);
      this.presentacionDuplicate.set(resp.data.codigo_control);
    } catch { /* non-fatal */ }
  }

  async checkControlCode() {
    const sku = this.form.codigo_interno?.trim();
    if (!sku) return;
    try {
      const idLab = this.form.id_laboratorio;
      const cum = this.form.consecutivo_cum;
      const params = [
        `sku=${encodeURIComponent(sku)}`,
        idLab ? `id_laboratorio=${idLab}` : '',
        cum != null && cum !== '' ? `consecutivo_cum=${cum}` : ''
      ].filter(Boolean).join('&');
      const resp = await this.api.get<{
        success: boolean;
        data: { codigo_control: string; duplicate_cum: string | null };
      }>(`/products/next-control-code?${params}`);
      this.codigoControlPreview.set(resp.data.codigo_control);
      this.codigoControlDuplicateCum.set(resp.data.duplicate_cum);
    } catch { /* non-fatal */ }
  }

  private blankForm() {
    return {
      id_medicamento_hs:    null,
      codigo_interno:       '',
      codigo_control:       '',
      tipo_producto:        '',
      nombre_comercial:     '',
      principio_activo:     '',
      concentracion:        '',
      atc:                  '',
      codigo_dci:           '',
      id_forma:             null,
      clasificacion:        '',
      unidad_medida:        '',
      presentacion:         '',
      registro_invima:      '',
      cum:                  null,
      consecutivo_cum:      null,
      id_laboratorio:       null,
      iva:                  0,
      mx_control:           false,
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