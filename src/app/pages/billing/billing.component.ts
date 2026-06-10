import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

@Component({
  selector: 'akri-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UppercaseInputDirective],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.css']
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
