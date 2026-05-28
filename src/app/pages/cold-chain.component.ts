import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type ExportFormat = 'json' | 'excel' | 'pdf';

@Component({
  selector: 'akri-cold-chain',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Cadena de frío y termohigrómetros</h1>
          <p class="page-subtitle">Monitorea neveras, registra lecturas manuales e integra termohigrómetros con captura automática vía polling o webhook.</p>
        </div>
        <div class="toolbar" style="margin-bottom: 0; justify-content: flex-end;">
          <label class="report-inline-label">
            Horas
            <input type="number" min="1" max="4320" [(ngModel)]="reportHours">
          </label>
          <button class="btn secondary" (click)="exportColdChain('json')">JSON</button>
          <button class="btn secondary" (click)="exportColdChain('excel')">Excel</button>
          <button class="btn secondary" (click)="exportColdChain('pdf')">PDF</button>
          <button class="btn secondary" (click)="load()">Actualizar</button>
        </div>
      </div>

      <div *ngIf="message()" class="success-box" style="margin-bottom: 1rem;">{{ message() }}</div>
      <div *ngIf="error()" class="error-box" style="margin-bottom: 1rem;">{{ error() }}</div>

      <div class="grid grid-2">
        <div class="card">
          <h3>Lectura manual de nevera</h3>
          <div class="form-grid">
            <label>
              Equipo
              <select [(ngModel)]="reading.id_equipo">
                <option *ngFor="let row of equipment()" [ngValue]="row.id_equipo">{{ row.sede }} · {{ row.nombre }}</option>
              </select>
            </label>
            <label>
              Temperatura
              <input type="number" [(ngModel)]="reading.temperatura">
            </label>
            <label>
              Humedad
              <input type="number" [(ngModel)]="reading.humedad">
            </label>
            <label>
              Fuente
              <select [(ngModel)]="reading.fuente">
                <option value="manual">manual</option>
                <option value="sensor">sensor</option>
                <option value="api">api</option>
              </select>
            </label>
          </div>
          <div class="form-actions">
            <button class="btn" (click)="saveReading()">Registrar lectura</button>
          </div>
        </div>

        <div class="card">
          <h3>Integración de termohigrómetros</h3>
          <p class="helper">Configura el gateway de las neveras. Soporta HTTP JSON con polling y webhook de ingestión automática.</p>

          <div class="form-grid">
            <label>
              Sede
              <select [(ngModel)]="integrationForm.id_sede">
                <option [ngValue]="null">Selecciona una sede</option>
                <option *ngFor="let row of sites()" [ngValue]="row.id_sede">{{ row.nombre }}</option>
              </select>
            </label>
            <label>
              Nombre integración
              <input [(ngModel)]="integrationForm.nombre">
            </label>
            <label>
              Protocolo
              <select [(ngModel)]="integrationForm.protocolo">
                <option value="http_json">http_json</option>
                <option value="webhook">webhook</option>
                <option value="mqtt_bridge">mqtt_bridge</option>
                <option value="modbus_gateway">modbus_gateway</option>
              </select>
            </label>
            <label>
              Endpoint URL
              <input [(ngModel)]="integrationForm.endpoint_url" placeholder="https://gateway/readings">
            </label>
            <label>
              Autenticación
              <select [(ngModel)]="integrationForm.auth_tipo">
                <option value="ninguna">ninguna</option>
                <option value="bearer">bearer</option>
                <option value="basic">basic</option>
                <option value="api_key">api_key</option>
              </select>
            </label>
            <label>
              Header API key
              <input [(ngModel)]="integrationForm.auth_header" placeholder="X-API-Key">
            </label>
            <label>
              Valor secreto / token
              <input [(ngModel)]="integrationForm.auth_valor" placeholder="Token o API key">
            </label>
            <label>
              Usuario Basic
              <input [(ngModel)]="integrationForm.username">
            </label>
            <label>
              Password Basic
              <input [(ngModel)]="integrationForm.password" type="password">
            </label>
            <label>
              Polling (segundos)
              <input type="number" min="30" max="86400" [(ngModel)]="integrationForm.polling_interval_segundos">
            </label>
          </div>

          <div class="switch-row">
            <label><input type="checkbox" [(ngModel)]="integrationForm.activo"> Integración activa</label>
          </div>

          <div class="card" style="margin-top: 1rem; background: var(--surface-muted); box-shadow: none;">
            <h4 style="margin-bottom: 0.75rem;">Mapeo equipo ↔ device_id</h4>
            <div class="form-grid">
              <label>
                Equipo
                <select [(ngModel)]="mappingDraft.id_equipo">
                  <option [ngValue]="null">Selecciona equipo</option>
                  <option *ngFor="let row of equipment()" [ngValue]="row.id_equipo">{{ row.sede }} · {{ row.nombre }}</option>
                </select>
              </label>
              <label>
                Device ID remoto
                <input [(ngModel)]="mappingDraft.device_id" placeholder="fridge-bogota-01">
              </label>
              <label>
                Etiqueta
                <input [(ngModel)]="mappingDraft.sensor_label" placeholder="Nevera principal">
              </label>
            </div>
            <div class="form-actions">
              <button class="btn secondary" (click)="addMapping()">Agregar mapeo</button>
            </div>

            <div class="table-wrap compact" *ngIf="integrationForm.mappings.length">
              <table>
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Device</th>
                    <th>Etiqueta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of integrationForm.mappings; let index = index">
                    <td>{{ equipmentName(row.id_equipo) }}</td>
                    <td>{{ row.device_id }}</td>
                    <td>{{ row.sensor_label }}</td>
                    <td><button class="btn secondary btn-small" (click)="removeMapping(index)">Quitar</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn" (click)="saveIntegration()">{{ integrationForm.id_integracion ? 'Actualizar integración' : 'Guardar integración' }}</button>
            <button class="btn secondary" (click)="resetIntegrationForm()">Limpiar</button>
          </div>

          <div class="notice" style="margin-top: 0.75rem;">
            Webhook de ingestión automática: <code>/api/cold-chain/integrations/ingest</code>
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top: 1rem;">
        <div class="card">
          <h3>Equipos de cadena de frío</h3>
          <div class="table-wrap compact">
            <table>
              <thead>
                <tr>
                  <th>Sede</th>
                  <th>Equipo</th>
                  <th>Rango</th>
                  <th>Sensores</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of equipment()">
                  <td>{{ item.sede }}</td>
                  <td>{{ item.nombre }}</td>
                  <td>{{ item.temp_min }}°C - {{ item.temp_max }}°C</td>
                  <td>{{ item.sensores_mapeados }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h3>Integraciones configuradas</h3>
          <div class="table-wrap compact">
            <table>
              <thead>
                <tr>
                  <th>Sede</th>
                  <th>Integración</th>
                  <th>Protocolo</th>
                  <th>Último estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of integrations()">
                  <td>{{ row.sede }}</td>
                  <td>
                    <strong>{{ row.nombre }}</strong>
                    <div class="muted">{{ row.equipos_mapeados }} equipos mapeados</div>
                  </td>
                  <td>{{ row.protocolo }}</td>
                  <td>{{ row.ultima_sincronizacion_estado }} · {{ row.ultima_sincronizacion_mensaje || 'Sin mensaje' }}</td>
                  <td>
                    <button class="btn secondary btn-small" (click)="editIntegration(row)">Editar</button>
                    <button class="btn secondary btn-small" (click)="syncIntegration(row.id_integracion)">Sincronizar</button>
                  </td>
                </tr>
                <tr *ngIf="!integrations().length">
                  <td colspan="5" class="muted">No hay integraciones registradas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top: 1rem;">
        <div class="card">
          <h3>Lecturas recientes</h3>
          <div class="table-wrap compact">
            <table>
              <thead>
                <tr>
                  <th>Sede</th>
                  <th>Equipo</th>
                  <th>Fecha</th>
                  <th>Temp</th>
                  <th>Fuente</th>
                  <th>Rango</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of readings()">
                  <td>{{ row.sede }}</td>
                  <td>{{ row.equipo }}</td>
                  <td>{{ row.fecha_hora | date:'yyyy-MM-dd HH:mm' }}</td>
                  <td>{{ row.temperatura }}°C / {{ row.humedad ?? 'N/A' }}%</td>
                  <td>{{ row.integracion || row.fuente }}</td>
                  <td>{{ row.fuera_rango ? 'Fuera' : 'OK' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h3>Alertas y logs automáticos</h3>
          <div class="table-wrap compact" style="margin-bottom: 1rem;">
            <table>
              <thead>
                <tr>
                  <th>Equipo</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Integración</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of alerts()">
                  <td>{{ row.equipo }}</td>
                  <td>{{ row.tipo }}</td>
                  <td>{{ row.estado }}</td>
                  <td>{{ row.integracion || 'manual' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="table-wrap compact">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Integración</th>
                  <th>Equipo</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of logs()">
                  <td>{{ row.fecha_hora | date:'yyyy-MM-dd HH:mm' }}</td>
                  <td>{{ row.integracion }}</td>
                  <td>{{ row.equipo || row.device_id }}</td>
                  <td>{{ row.exito ? 'OK' : 'Error' }} · {{ row.mensaje }}</td>
                </tr>
                <tr *ngIf="!logs().length">
                  <td colspan="4" class="muted">Aún no hay logs automáticos.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `
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
