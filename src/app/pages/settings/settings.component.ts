import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'akri-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
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
