import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'akri-facturacion-dian-salud',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './facturacion-dian-salud.component.html',
  styleUrls: ['./facturacion-dian-salud.component.css'],
  imports: [CommonModule, FormsModule]
})
export class FacturacionDianSaludComponent implements OnInit {
  private api = inject(ApiService);

  readonly loading = signal(false);
  readonly saving = signal<number | null>(null);
  readonly message = signal('');
  readonly error = signal('');
  readonly facturas = signal<any[]>([]);

  readonly showDocumentos = signal(false);
  readonly documentosLoading = signal(false);
  readonly documentosVista = signal<any | null>(null);
  private documentosFacturaId: number | null = null;

  search = '';

  ngOnInit() {
    void this.load();
  }

  tipoLabel(modo: string): string {
    if (modo === 'nota_credito') return 'Nota crédito';
    if (modo === 'nota_debito') return 'Nota débito';
    return 'Factura';
  }

  esFacturaOriginal(row: any): boolean {
    return row.modo !== 'nota_credito' && row.modo !== 'nota_debito';
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await this.api.get<{ success: boolean; data: any[] }>(
        `/dispensacion-hs/salud/facturas?search=${encodeURIComponent(this.search)}`
      );
      this.facturas.set(response.data ?? []);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible cargar las facturas de salud.');
    } finally {
      this.loading.set(false);
    }
  }

  async verDocumentos(row: any) {
    this.error.set('');
    this.documentosVista.set(null);
    this.documentosFacturaId = row.id_dispensacion_dian;
    this.showDocumentos.set(true);
    this.documentosLoading.set(true);
    try {
      const response = await this.api.get<{ success: boolean; data: any }>(
        `/dispensacion-hs/salud/facturas/${row.id_dispensacion_dian}/documentos`
      );
      this.documentosVista.set(response.data);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible obtener el PDF/tirilla.');
      this.showDocumentos.set(false);
    } finally {
      this.documentosLoading.set(false);
    }
  }

  cerrarDocumentos() {
    this.showDocumentos.set(false);
    this.documentosVista.set(null);
    this.documentosFacturaId = null;
  }

  async notaCredito(row: any) {
    if (!confirm(`¿Anular la factura al paciente ${row.paciente_invoice_number} con una nota crédito? Esta acción no se puede deshacer.`)) {
      return;
    }
    const motivo = prompt('Motivo de la nota crédito (opcional):', 'Anulación solicitada desde farmacia') || undefined;
    this.saving.set(row.id_dispensacion_dian);
    this.error.set('');
    try {
      const response = await this.api.post<{ success: boolean; data: any }>(
        `/dispensacion-hs/salud/facturas/${row.id_dispensacion_dian}/nota-credito`,
        { motivo }
      );
      this.message.set(`Nota crédito ${response.data.numero_nota} generada (DIAN: ${response.data.estado_dian}).`);
      await this.load();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible generar la nota crédito.');
    } finally {
      this.saving.set(null);
    }
  }

  async notaDebito(row: any) {
    if (!confirm(`¿Generar una nota débito adicional sobre la factura ${row.paciente_invoice_number}?`)) {
      return;
    }
    const motivo = prompt('Motivo de la nota débito (opcional):', 'Ajuste solicitado desde farmacia') || undefined;
    this.saving.set(row.id_dispensacion_dian);
    this.error.set('');
    try {
      const response = await this.api.post<{ success: boolean; data: any }>(
        `/dispensacion-hs/salud/facturas/${row.id_dispensacion_dian}/nota-debito`,
        { motivo }
      );
      this.message.set(`Nota débito ${response.data.numero_nota} generada (DIAN: ${response.data.estado_dian}).`);
      await this.load();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible generar la nota débito.');
    } finally {
      this.saving.set(null);
    }
  }
}
