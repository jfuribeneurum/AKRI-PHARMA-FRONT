import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-billing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page grid">
      <div class="card">
        <div class="toolbar">
          <label>
            ID venta
            <input type="number" [(ngModel)]="saleId">
          </label>
          <button class="btn" (click)="createInvoice()">Crear factura</button>
          <button class="btn secondary" (click)="load()">Actualizar</button>
        </div>

        <div *ngIf="message()" class="success-box" style="margin-bottom: 1rem;">
          {{ message() }}
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Venta</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of invoices()">
                <td>{{ row.numero_completo }}</td>
                <td>{{ row.folio_venta }}</td>
                <td>{{ row.estado }}</td>
                <td>{{ row.total | number }}</td>
                <td>
                  <button class="btn success" (click)="submitToSiesa(row.id_factura)">Enviar a SIESA</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `
})
export class BillingComponent implements OnInit {
  invoices = signal<any[]>([]);
  message = signal('');
  saleId = 1;

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    const response = await this.api.get<{ success: boolean; data: any[] }>('/billing/invoices');
    this.invoices.set(response.data);
  }

  async createInvoice() {
    await this.api.post('/billing/invoices', { id_venta: this.saleId });
    this.message.set('Factura creada.');
    await this.load();
  }

  async submitToSiesa(id: number) {
    const response = await this.api.post<{ success: boolean; data: any }>(`/billing/invoices/${id}/submit-siesa`, {});
    this.message.set(`Respuesta SIESA: ${response.data.status ?? 'procesada'}`);
    await this.load();
  }
}
