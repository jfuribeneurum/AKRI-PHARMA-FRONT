import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

type ExportFormat = 'json' | 'excel' | 'pdf';

@Component({
  selector: 'akri-ingresos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UppercaseInputDirective],
  templateUrl: './ingresos.component.html',
  styleUrls: ['./ingresos.component.css']
})
export class IngresosComponent implements OnInit {
  ingresos = signal<any[]>([]);
  message = signal('');
  error = signal('');
  reportSearch = '';

  nuevoIngreso = {
    referencia: '',
    producto: '',
    cantidad: 0,
    lote: '',
    fecha_vencimiento: '',
    estado: 'pendiente'
  };

  estadosIngreso: { valor: string; etiqueta: string }[] = [];

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
    void this.loadEstados();
  }

  private async loadEstados() {
    try {
      const res = await this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/estado_ingreso/activos');
      this.estadosIngreso = res.data ?? [];
    } catch { /* non-fatal */ }
  }

  async load() {
    try {
      this.error.set('');
      const response = await this.api.get<{ success: boolean; data: any[] }>('/ingresos');
      this.ingresos.set(response.data || []);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar los ingresos.');
      this.ingresos.set([]);
    }
  }

  async crearIngreso() {
    try {
      this.error.set('');
      this.message.set('');

      if (!this.nuevoIngreso.referencia || !this.nuevoIngreso.producto || !this.nuevoIngreso.cantidad) {
        this.error.set('Por favor completa los campos requeridos: referencia, producto y cantidad.');
        return;
      }

      await this.api.post('/ingresos', this.nuevoIngreso);
      this.message.set('Ingreso creado exitosamente.');
      this.limpiarFormulario();
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible crear el ingreso.');
    }
  }

  limpiarFormulario() {
    this.nuevoIngreso = {
      referencia: '',
      producto: '',
      cantidad: 0,
      lote: '',
      fecha_vencimiento: '',
      estado: 'pendiente'
    };
  }

  calcularTotalCantidad(): number {
    return (this.ingresos() || []).reduce((total, item) => total + (item.cantidad || 0), 0);
  }

  contarPorEstado(estado: string): number {
    return (this.ingresos() || []).filter(item => item.estado === estado).length;
  }

  exportIngresos(format: ExportFormat) {
    const data = this.ingresos();
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `ingresos_${timestamp}`;

    if (format === 'json') {
      const json = JSON.stringify(data, null, 2);
      this.downloadFile(json, `${filename}.json`, 'application/json');
    } else if (format === 'excel') {
      this.exportToExcel(data, filename);
    } else if (format === 'pdf') {
      this.exportToPDF(data, filename);
    }
  }

  private downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private exportToExcel(data: any[], filename: string) {
    const headers = ['Referencia', 'Producto', 'Cantidad', 'Fecha', 'Estado', 'Lote'];
    const rows = data.map(item => [
      item.referencia,
      item.producto,
      item.cantidad,
      new Date(item.fecha).toLocaleDateString(),
      item.estado,
      item.lote
    ]);

    let csv = headers.join('\t') + '\n';
    rows.forEach(row => csv += row.join('\t') + '\n');

    this.downloadFile(csv, `${filename}.csv`, 'text/csv');
  }

  private exportToPDF(data: any[], filename: string) {
    this.message.set('Exportación a PDF en desarrollo. Por ahora usa JSON o Excel.');
  }
}
