import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <div class="card">
        <h3>Configuración SIESA</h3>

        <div class="notice" style="margin-bottom: 1rem;">
          En modo demo puedes dejar URL vacía. El backend responderá en modo mock.
        </div>

        <div *ngIf="message" class="success-box" style="margin-bottom: 1rem;">
          {{ message }}
        </div>

        <div class="form-grid">
          <label>
            Nombre
            <input [(ngModel)]="config.nombre">
          </label>
          <label>
            Ambiente
            <select [(ngModel)]="config.ambiente">
              <option value="sandbox">sandbox</option>
              <option value="produccion">produccion</option>
            </select>
          </label>
          <label>
            API base URL
            <input [(ngModel)]="config.api_base_url">
          </label>
          <label>
            Auth URL
            <input [(ngModel)]="config.auth_url">
          </label>
          <label>
            Endpoint factura
            <input [(ngModel)]="config.invoice_endpoint">
          </label>
          <label>
            Client ID
            <input [(ngModel)]="config.client_id">
          </label>
          <label>
            Client Secret
            <input [(ngModel)]="config.client_secret">
          </label>
          <label>
            Company ID
            <input [(ngModel)]="config.company_id">
          </label>
          <label>
            Timeout ms
            <input type="number" [(ngModel)]="config.timeout_ms">
          </label>
        </div>

        <button class="btn" style="margin-top: 1rem;" (click)="save()">Guardar configuración</button>
      </div>
    </section>
  `
})
export class SettingsComponent implements OnInit {
  config: any = {
    nombre: 'SIESA Sandbox',
    ambiente: 'sandbox',
    api_base_url: '',
    auth_url: '',
    invoice_endpoint: '/invoices',
    client_id: '',
    client_secret: '',
    company_id: '',
    timeout_ms: 15000,
    headers_extra: {}
  };

  message = '';

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    const response = await this.api.get<{ success: boolean; data: any }>('/siesa/config');
    if (response.data) {
      this.config = {
        ...response.data,
        headers_extra: typeof response.data.headers_extra === 'string'
          ? JSON.parse(response.data.headers_extra)
          : (response.data.headers_extra ?? {})
      };
    }
  }

  async save() {
    await this.api.post('/siesa/config', this.config);
    this.message = 'Configuración SIESA actualizada.';
  }
}
