import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

type MediaSourceType = 'escaneada' | 'importada' | 'fotografia';

@Component({
  selector: 'akri-products',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UppercaseInputDirective],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
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

  tiposProducto: { valor: string; etiqueta: string }[] = [];

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.loadTiposProducto();
    void this.load();
  }

  private async loadTiposProducto() {
    try {
      const res = await this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/tipo_producto/activos');
      this.tiposProducto = res.data ?? [];
    } catch { /* non-fatal */ }
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
