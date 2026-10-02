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

  /** Un data: URI gigante (PDF en base64) enlazado directo en [href] queda
   *  en blanco en Chrome con bastante frecuencia — mismo patrón que ya usa
   *  cartera-compra.component.ts en el front de Akribeia: armar un Blob real
   *  y abrirlo con un object URL, que sí renderiza siempre. */
  abrirPdfBase64(base64: string | undefined | null): void {
    if (!base64) return;
    try {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch { /* si falla, no hay mas que hacer aqui */ }
  }

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

  /** request_json es lo que se iba a mandar a AkribeIA cuando falló —
   *  contrato, centro de costo/sede, paciente, medicamentos (CUM) y el
   *  copago/cuota moderadora. Queda guardado tal cual para poder reintentar
   *  sin tener que volver a digitar nada, y para mostrarlo en pantalla. */
  requestInfo(row: any): any {
    if (!row?.request_json) return null;
    try { return typeof row.request_json === 'string' ? JSON.parse(row.request_json) : row.request_json; }
    catch { return null; }
  }

  async reintentar(row: any) {
    this.saving.set(row.id);
    this.error.set('');
    this.message.set('');
    try {
      const response = await this.api.post<{ success: boolean; data: any }>(
        `/dispensacion-hs/salud/facturas/${row.id}/reintentar`, {}
      );
      if (response.data?.dian?.ok === false) {
        this.error.set(response.data.dian.error || 'Siguió fallando — revisa el detalle del error.');
      } else {
        this.message.set('Factura enviada a la DIAN correctamente.');
      }
      await this.load();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible reintentar esta factura.');
    } finally {
      this.saving.set(null);
    }
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
    this.documentosFacturaId = row.id;
    this.showDocumentos.set(true);
    this.documentosLoading.set(true);
    try {
      const response = await this.api.get<{ success: boolean; data: any }>(
        `/dispensacion-hs/salud/facturas/${row.id}/documentos`
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
    this.saving.set(row.id);
    this.error.set('');
    try {
      const response = await this.api.post<{ success: boolean; data: any }>(
        `/dispensacion-hs/salud/facturas/${row.id}/nota-credito`,
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
    this.saving.set(row.id);
    this.error.set('');
    try {
      const response = await this.api.post<{ success: boolean; data: any }>(
        `/dispensacion-hs/salud/facturas/${row.id}/nota-debito`,
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
