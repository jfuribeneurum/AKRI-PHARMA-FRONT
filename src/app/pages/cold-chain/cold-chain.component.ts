import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

type ExportFormat = 'json' | 'excel' | 'pdf';

@Component({
  selector: 'akri-cold-chain',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cold-chain.component.html',
  styleUrls: ['./cold-chain.component.css'],
  imports: [CommonModule, FormsModule]
})
export class ColdChainComponent implements OnInit {
  equipment = signal<any[]>([]);
  readings = signal<any[]>([]);
  alerts = signal<any[]>([]);
  integrations = signal<any[]>([]);
  logs = signal<any[]>([]);
  sites = signal<any[]>([]);
  message = signal('');
  error = signal('');

  reportHours = 72;

  reading: any = {
    id_equipo: null,
    temperatura: 4.4,
    humedad: 64,
    fuente: 'manual'
  };

  integrationForm: any = this.blankIntegration();
  mappingDraft: any = this.blankMapping();

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.error.set('');
      const [equipment, readings, alerts, integrations, lookups] = await Promise.all([
        this.api.get<{ success: boolean; data: any[] }>('/cold-chain/equipment'),
        this.api.get<{ success: boolean; data: any[] }>('/cold-chain/readings'),
        this.api.get<{ success: boolean; data: any[] }>('/cold-chain/alerts'),
        this.api.get<{ success: boolean; data: any }>('/cold-chain/integrations'),
        this.api.get<{ success: boolean; data: any }>('/dispensing/lookups')
      ]);

      this.equipment.set(equipment.data);
      this.readings.set(readings.data);
      this.alerts.set(alerts.data);
      this.integrations.set(integrations.data.integrations ?? []);
      this.logs.set(integrations.data.logs ?? []);
      this.sites.set(lookups.data.sites ?? []);

      if (!this.reading.id_equipo && equipment.data.length) {
        this.reading.id_equipo = equipment.data[0].id_equipo;
      }

      if (!this.integrationForm.id_sede && this.sites().length) {
        this.integrationForm.id_sede = this.sites()[0].id_sede;
      }
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar la cadena de frío.');
    }
  }

  equipmentName(idEquipo: number) {
    return this.equipment().find((row) => Number(row.id_equipo) === Number(idEquipo))?.nombre || `Equipo ${idEquipo}`;
  }

  addMapping() {
    if (!this.mappingDraft.id_equipo || !this.mappingDraft.device_id) {
      this.error.set('Debes seleccionar equipo y device_id.');
      return;
    }
    this.integrationForm.mappings = [...this.integrationForm.mappings, { ...this.mappingDraft }];
    this.mappingDraft = this.blankMapping();
    this.error.set('');
  }

  removeMapping(index: number) {
    this.integrationForm.mappings = this.integrationForm.mappings.filter((_: any, rowIndex: number) => rowIndex !== index);
  }

  editIntegration(row: any) {
    this.integrationForm = {
      id_integracion: row.id_integracion,
      id_sede: row.id_sede,
      nombre: row.nombre,
      protocolo: row.protocolo,
      endpoint_url: row.endpoint_url,
      auth_tipo: row.auth_tipo,
      auth_header: row.auth_header,
      auth_valor: row.auth_valor,
      username: row.username,
      password: row.password,
      polling_interval_segundos: row.polling_interval_segundos,
      timeout_ms: row.timeout_ms,
      activo: row.activo,
      mappings: (row.mappings ?? []).map((item: any) => ({
        id_equipo: item.id_equipo,
        device_id: item.device_id,
        sensor_label: item.sensor_label,
        campo_temperatura: item.campo_temperatura,
        campo_humedad: item.campo_humedad,
        campo_fecha: item.campo_fecha,
        activo: item.activo
      }))
    };
  }

  resetIntegrationForm() {
    this.integrationForm = this.blankIntegration();
    if (this.sites().length) {
      this.integrationForm.id_sede = this.sites()[0].id_sede;
    }
  }

  async saveReading() {
    try {
      this.error.set('');
      const response = await this.api.post<{ success: boolean; data: any }>('/cold-chain/readings', this.reading);
      this.message.set(response.data.fuera_rango ? 'Lectura registrada y alerta generada.' : 'Lectura registrada.');
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible registrar la lectura.');
    }
  }

  async saveIntegration() {
    try {
      this.error.set('');
      await this.api.post('/cold-chain/integrations', this.integrationForm);
      this.message.set('Integración de termohigrómetro guardada.');
      this.resetIntegrationForm();
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible guardar la integración.');
    }
  }

  async syncIntegration(id: number) {
    try {
      this.error.set('');
      const response = await this.api.post<{ success: boolean; data: any }>(`/cold-chain/integrations/${id}/sync`, {});
      this.message.set(`Sincronización ejecutada. Lecturas procesadas: ${response.data.processed}.`);
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible sincronizar la integración.');
    }
  }

  async exportColdChain(format: ExportFormat) {
    try {
      this.error.set('');
      const extension = format === 'excel' ? 'xls' : format;
      await this.api.download(
        `/reports/cold-chain/export?format=${format}&hours=${this.reportHours}`,
        `akripharmacy-cadena-frio.${extension}`
      );
      this.message.set(`Cadena de frío exportada en formato ${format.toUpperCase()}.`);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible exportar la cadena de frío.');
    }
  }

  private blankIntegration() {
    return {
      id_integracion: null,
      id_sede: null,
      nombre: '',
      protocolo: 'http_json',
      endpoint_url: '',
      auth_tipo: 'ninguna',
      auth_header: '',
      auth_valor: '',
      username: '',
      password: '',
      polling_interval_segundos: 300,
      timeout_ms: 10000,
      activo: true,
      mappings: []
    };
  }

  private blankMapping() {
    return {
      id_equipo: null,
      device_id: '',
      sensor_label: '',
      campo_temperatura: 'temperature',
      campo_humedad: 'humidity',
      campo_fecha: 'timestamp',
      activo: true
    };
  }
}
