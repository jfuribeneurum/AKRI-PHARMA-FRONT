import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard de gestión de inventario</h1>
          <p class="page-subtitle">KPIs operativos, cobertura de catálogo, alertas de vencimiento, cadena de frío y trazabilidad de escaneos.</p>
        </div>
        <div class="toolbar" style="margin-bottom: 0; justify-content: flex-end;">
          <span class="chip info" *ngIf="summary() as vm">Actualizado {{ vm.generatedAt | date:'yyyy-MM-dd HH:mm' }}</span>
          <button class="btn secondary" (click)="exportReport('json')">JSON</button>
          <button class="btn secondary" (click)="exportReport('excel')">Excel</button>
          <button class="btn secondary" (click)="exportReport('pdf')">PDF</button>
          <button class="btn" (click)="load()">Actualizar</button>
        </div>
      </div>

      <div *ngIf="message()" class="success-box" style="margin-bottom: 1rem;">{{ message() }}</div>
      <div *ngIf="error()" class="error-box" style="margin-bottom: 1rem;">{{ error() }}</div>

      <div *ngIf="status() as connectivity" class="card" style="margin-bottom: 1rem; border-left: 4px solid var(--primary);">
        <div class="card-header">
          <div>
            <h3>Estado de conectividad</h3>
            <div class="helper">Visibilidad de frontend ↔ backend ↔ MariaDB, SIESA y termohigrómetros.</div>
          </div>
          <div class="toolbar" style="margin-bottom: 0; justify-content: flex-end;">
            <span class="chip" [ngClass]="statusKindClass(connectivity.overall_status)">{{ connectivity.overall_label }}</span>
            <button class="btn secondary" (click)="loadStatus()">Actualizar conectividad</button>
          </div>
        </div>

        <div class="stats" style="margin-bottom: 1rem;">
          <div class="stat" [ngClass]="statusKindClass(connectivity.frontend_backend.status)">
            <small>Frontend → Backend</small>
            <strong>{{ connectivity.frontend_backend.label }}</strong>
            <div class="meta">{{ connectivity.frontend_backend.message }}</div>
          </div>
          <div class="stat" [ngClass]="statusKindClass(connectivity.database.status)">
            <small>Backend → MariaDB</small>
            <strong>{{ connectivity.database.label }}</strong>
            <div class="meta">{{ statusSummaryLine(connectivity.database) }}</div>
          </div>
          <div class="stat" [ngClass]="statusKindClass(connectivity.siesa.status)">
            <small>Facturación SIESA</small>
            <strong>{{ connectivity.siesa.label }}</strong>
            <div class="meta">{{ statusSummaryLine(connectivity.siesa) }}</div>
          </div>
          <div class="stat" [ngClass]="statusKindClass(connectivity.thermohygrometers.status)">
            <small>Termohigrómetros</small>
            <strong>{{ connectivity.thermohygrometers.label }}</strong>
            <div class="meta">{{ statusSummaryLine(connectivity.thermohygrometers) }}</div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="table-wrap compact">
            <table>
              <thead>
                <tr>
                  <th>Componente</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                  <th>Última marca</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>API backend</td>
                  <td><span class="chip" [ngClass]="statusKindClass(connectivity.backend.status)">{{ connectivity.backend.label }}</span></td>
                  <td>{{ connectivity.backend.message }}</td>
                  <td>{{ formatTimestamp(connectivity.backend.checked_at) }}</td>
                </tr>
                <tr>
                  <td>MariaDB</td>
                  <td><span class="chip" [ngClass]="statusKindClass(connectivity.database.status)">{{ connectivity.database.label }}</span></td>
                  <td>{{ statusSummaryLine(connectivity.database) }}</td>
                  <td>{{ formatTimestamp(connectivity.database.checked_at) }}</td>
                </tr>
                <tr>
                  <td>SIESA</td>
                  <td><span class="chip" [ngClass]="statusKindClass(connectivity.siesa.status)">{{ connectivity.siesa.label }}</span></td>
                  <td>{{ statusSummaryLine(connectivity.siesa) }}</td>
                  <td>{{ formatTimestamp(connectivity.siesa.ultima_interaccion || connectivity.siesa.checked_at) }}</td>
                </tr>
                <tr>
                  <td>Termohigrómetros</td>
                  <td><span class="chip" [ngClass]="statusKindClass(connectivity.thermohygrometers.status)">{{ connectivity.thermohygrometers.label }}</span></td>
                  <td>{{ statusSummaryLine(connectivity.thermohygrometers) }}</td>
                  <td>{{ formatTimestamp(connectivity.thermohygrometers.ultima_sincronizacion || connectivity.thermohygrometers.checked_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card" style="background: var(--surface-muted);">
            <h3 style="margin-top: 0;">Indicadores operativos</h3>
            <div class="metric-list">
              <div class="metric-row">
                <div class="metric-top">
                  <span>Facturas pendientes SIESA</span>
                  <strong>{{ connectivity.siesa.pendientes ?? 0 }}</strong>
                </div>
                <div class="muted">Aceptadas: {{ connectivity.siesa.aceptadas ?? 0 }} · Rechazadas: {{ connectivity.siesa.rechazadas ?? 0 }}</div>
              </div>
              <div class="metric-row">
                <div class="metric-top">
                  <span>Integraciones activas de termohigrómetros</span>
                  <strong>{{ connectivity.thermohygrometers.integraciones_activas ?? 0 }}</strong>
                </div>
                <div class="muted">Sensores mapeados: {{ connectivity.thermohygrometers.sensores_mapeados ?? 0 }} · Equipos: {{ connectivity.thermohygrometers.equipos_monitoreados ?? 0 }}</div>
              </div>
              <div class="metric-row">
                <div class="metric-top">
                  <span>Lecturas de cadena de frío 24h</span>
                  <strong>{{ connectivity.thermohygrometers.lecturas_24h ?? 0 }}</strong>
                </div>
                <div class="muted">Alertas abiertas: {{ connectivity.thermohygrometers.alertas_abiertas ?? 0 }}</div>
              </div>
              <div class="metric-row">
                <div class="metric-top">
                  <span>Latencia MariaDB</span>
                  <strong>{{ connectivity.database.latency_ms ?? '—' }} ms</strong>
                </div>
                <div class="muted">Base: {{ connectivity.database.database || '—' }} · Host: {{ connectivity.database.host || '—' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="summary() as vm" class="grid">
        <div class="card hero-card">
          <div class="hero-grid">
            <div>
              <h3 style="font-size: 1.8rem; margin-bottom: 0.4rem;">Control integral del inventario farmacéutico</h3>
              <p class="page-subtitle">Visibilidad sobre stock crítico, valor inventariado, cobertura de códigos de barras e imágenes, próximos vencimientos y condiciones de frío.</p>

              <div class="hero-metrics" style="margin-top: 1rem;">
                <div class="hero-metric">
                  <small>Valor inventario</small>
                  <strong>{{ vm.counters.inventoryValue | number:'1.0-0' }}</strong>
                  <div class="meta">Costo referencial acumulado</div>
                </div>
                <div class="hero-metric">
                  <small>Stock crítico + agotado</small>
                  <strong>{{ vm.counters.criticalStock + vm.counters.outOfStock }}</strong>
                  <div class="meta">Medicamentos que requieren acción inmediata</div>
                </div>
                <div class="hero-metric">
                  <small>Vence en 30 días</small>
                  <strong>{{ vm.counters.lotsExpiring30Days }}</strong>
                  <div class="meta">Lotes listos para redistribución o devolución</div>
                </div>
              </div>
            </div>

            <div class="stack">
              <div class="kpi-strip">
                <div class="kpi-pill">
                  <small>Productos activos</small>
                  <strong>{{ vm.counters.products }}</strong>
                </div>
                <div class="kpi-pill">
                  <small>Con código de barras</small>
                  <strong>{{ vm.counters.productsWithBarcode }}</strong>
                </div>
                <div class="kpi-pill">
                  <small>Con imágenes</small>
                  <strong>{{ vm.counters.productsWithImages }}</strong>
                </div>
                <div class="kpi-pill">
                  <small>Alertas frío</small>
                  <strong>{{ vm.counters.coldChainOpenAlerts }}</strong>
                </div>
              </div>
              <div class="metric-list">
                <div class="metric-row">
                  <div class="metric-top">
                    <span>Cobertura de códigos de barras</span>
                    <strong>{{ vm.coverage.barcodePct }}%</strong>
                  </div>
                  <div class="metric-bar info"><span [style.width]="barWidth(vm.coverage.barcodePct, 100)"></span></div>
                </div>
                <div class="metric-row">
                  <div class="metric-top">
                    <span>Cobertura de imágenes</span>
                    <strong>{{ vm.coverage.imagesPct }}%</strong>
                  </div>
                  <div class="metric-bar warn"><span [style.width]="barWidth(vm.coverage.imagesPct, 100)"></span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="stats">
          <div class="stat accent">
            <small>Stock bajo</small>
            <strong>{{ vm.counters.lowStock }}</strong>
            <div class="meta">Productos por debajo del mínimo operativo</div>
          </div>
          <div class="stat danger">
            <small>Agotados</small>
            <strong>{{ vm.counters.outOfStock }}</strong>
            <div class="meta">Sin disponibilidad para dispensación</div>
          </div>
          <div class="stat info">
            <small>Cadena de frío</small>
            <strong>{{ vm.counters.coldChainProducts }}</strong>
            <div class="meta">Productos que exigen conservación térmica</div>
          </div>
          <div class="stat success">
            <small>Controlados</small>
            <strong>{{ vm.counters.controlledProducts }}</strong>
            <div class="meta">Catálogo bajo control especial</div>
          </div>
          <div class="stat accent">
            <small>Compras pendientes</small>
            <strong>{{ vm.counters.purchasesPendingReceipt }}</strong>
            <div class="meta">Órdenes aprobadas sin recepción completa</div>
          </div>
          <div class="stat info">
            <small>Facturas pendientes</small>
            <strong>{{ vm.counters.invoicesPendingSync }}</strong>
            <div class="meta">Sincronización / rechazo con SIESA</div>
          </div>
        </div>

        <div class="analytics-grid">
          <div class="card">
            <div class="card-header">
              <div>
                <h3>Salud del inventario</h3>
                <div class="helper">Distribución por condición operativa.</div>
              </div>
            </div>

            <div class="inventory-kpis">
              <div class="summary-tile">
                <small>Saludable</small>
                <strong>{{ vm.stockHealth.healthy_stock }}</strong>
              </div>
              <div class="summary-tile">
                <small>Bajo</small>
                <strong>{{ vm.stockHealth.low_stock }}</strong>
              </div>
              <div class="summary-tile">
                <small>Crítico</small>
                <strong>{{ vm.stockHealth.critical_stock }}</strong>
              </div>
              <div class="summary-tile">
                <small>Agotado</small>
                <strong>{{ vm.stockHealth.out_of_stock }}</strong>
              </div>
            </div>

            <div class="metric-list" style="margin-top: 1rem;">
              <div class="metric-row" *ngFor="let row of stockHealthRows(vm)">
                <div class="metric-top">
                  <span>{{ row.label }}</span>
                  <strong>{{ row.value }}</strong>
                </div>
                <div class="metric-bar" [ngClass]="row.kind"><span [style.width]="barWidth(row.value, stockHealthMax(vm))"></span></div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h3>Stock por categoría</h3>
                <div class="helper">Unidades y valor por familia de producto.</div>
              </div>
            </div>

            <div class="metric-list">
              <div class="metric-row" *ngFor="let row of vm.categoryBreakdown">
                <div class="metric-top">
                  <span>{{ row.categoria }}</span>
                  <strong>{{ row.unidades }}</strong>
                </div>
                <div class="metric-bar info"><span [style.width]="barWidth(row.valor, maxValue(vm.categoryBreakdown, 'valor'))"></span></div>
                <div class="muted">Valor: {{ row.valor | number:'1.0-0' }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-header">
              <div>
                <h3>Stock por tipo de almacén</h3>
                <div class="helper">Capacidad activa distribuida por ambiente de conservación.</div>
              </div>
            </div>
            <div class="metric-list">
              <div class="metric-row" *ngFor="let row of vm.storageBreakdown">
                <div class="metric-top">
                  <span>{{ row.tipo_almacen }}</span>
                  <strong>{{ row.unidades }}</strong>
                </div>
                <div class="metric-bar success"><span [style.width]="barWidth(row.unidades, maxValue(vm.storageBreakdown, 'unidades'))"></span></div>
                <div class="muted">Lotes: {{ row.lotes }} · Valor: {{ row.valor | number:'1.0-0' }}</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h3>Movimientos de los últimos 6 meses</h3>
                <div class="helper">Comparativo de ingresos vs egresos registrados.</div>
              </div>
            </div>
            <div class="table-wrap compact">
              <table>
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th>Ingresos</th>
                    <th>Egresos</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of vm.monthlyMovements">
                    <td>{{ row.periodo }}</td>
                    <td>{{ row.ingresos }}</td>
                    <td>{{ row.egresos }}</td>
                  </tr>
                  <tr *ngIf="!vm.monthlyMovements?.length">
                    <td colspan="3" class="muted">No hay movimientos suficientes para el periodo.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-header">
              <div>
                <h3>Stock bajo priorizado</h3>
                <div class="helper">Lista para reabastecimiento inmediato.</div>
              </div>
            </div>
            <div class="table-wrap compact">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Producto</th>
                    <th>Actual</th>
                    <th>Mínimo</th>
                    <th>Severidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of vm.lowStock">
                    <td>{{ row.sku }}</td>
                    <td>{{ row.nombre_comercial }}</td>
                    <td>{{ row.stock_actual }}</td>
                    <td>{{ row.stock_minimo }}</td>
                    <td><span class="chip" [ngClass]="severityClass(row.severidad)">{{ row.severidad }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h3>Lotes próximos a vencer</h3>
                <div class="helper">Priorización FEFO para redistribución y venta.</div>
              </div>
            </div>
            <div class="table-wrap compact">
              <table>
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Producto</th>
                    <th>Vence</th>
                    <th>Días</th>
                    <th>Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of vm.expiringLots">
                    <td>{{ row.numero_lote }}</td>
                    <td>{{ row.nombre_comercial }}</td>
                    <td>{{ row.fecha_vencimiento | date:'yyyy-MM-dd' }}</td>
                    <td>{{ row.dias_para_vencer }}</td>
                    <td>{{ row.cantidad_disponible }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-header">
              <div>
                <h3>Estado de cadena de frío</h3>
                <div class="helper">Última lectura por equipo de conservación.</div>
              </div>
            </div>
            <div class="table-wrap compact">
              <table>
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Almacén</th>
                    <th>Temperatura</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of vm.coldChainStatus">
                    <td>{{ row.equipo }}</td>
                    <td>{{ row.almacen }}</td>
                    <td>{{ row.temperatura ?? '—' }} °C</td>
                    <td><span class="chip" [ngClass]="coldStateClass(row.estado)">{{ row.estado }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h3>Escaneos recientes</h3>
                <div class="helper">Actividad de lector físico, captura manual y cámara.</div>
              </div>
            </div>
            <div class="table-wrap compact">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Modo</th>
                    <th>Fuente</th>
                    <th>Código</th>
                    <th>Producto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of vm.recentScans">
                    <td>{{ row.fecha_hora | date:'MM-dd HH:mm' }}</td>
                    <td>{{ row.modo }}</td>
                    <td>{{ row.fuente }}</td>
                    <td>{{ row.codigo_barras }}</td>
                    <td>{{ row.nombre_comercial || 'No resuelto' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class DashboardComponent implements OnInit {
  summary = signal<any>(null);
  status = signal<any>(null);
  message = signal('');
  error = signal('');

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.error.set('');
    const [summaryResponse, statusResponse] = await Promise.all([
      this.api.get<{ success: boolean; data: any }>('/dashboard/summary'),
      this.api.get<{ success: boolean; data: any }>('/status/overview')
    ]);
    this.summary.set(summaryResponse.data);
    this.status.set(statusResponse.data);
  }

  async loadStatus() {
    try {
      const response = await this.api.get<{ success: boolean; data: any }>('/status/overview');
      this.status.set(response.data);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible consultar el estado de conectividad.');
    }
  }

  async exportReport(format: 'json' | 'excel' | 'pdf') {
    try {
      this.error.set('');
      const extension = format === 'excel' ? 'xls' : format;
      await this.api.download(`/reports/dashboard/export?format=${format}`, `akripharmacy-dashboard.${extension}`);
      this.message.set(`Reporte del dashboard exportado en formato ${format.toUpperCase()}.`);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible exportar el reporte del dashboard.');
    }
  }

  maxValue(rows: any[], field: string) {
    const max = Math.max(...(rows ?? []).map((item) => Number(item?.[field] ?? 0)), 0);
    return max || 1;
  }

  barWidth(value: number, max: number) {
    const numeric = Number(value ?? 0);
    const ratio = max > 0 ? (numeric / max) * 100 : 0;
    if (numeric <= 0) {
      return '0%';
    }
    return `${Math.max(10, Math.min(100, ratio))}%`;
  }

  stockHealthRows(vm: any) {
    return [
      { label: 'Saludable', value: Number(vm.stockHealth.healthy_stock ?? 0), kind: 'success' },
      { label: 'Bajo', value: Number(vm.stockHealth.low_stock ?? 0), kind: 'warn' },
      { label: 'Crítico', value: Number(vm.stockHealth.critical_stock ?? 0), kind: 'danger' },
      { label: 'Agotado', value: Number(vm.stockHealth.out_of_stock ?? 0), kind: 'info' }
    ];
  }

  stockHealthMax(vm: any) {
    return Math.max(
      Number(vm.stockHealth.healthy_stock ?? 0),
      Number(vm.stockHealth.low_stock ?? 0),
      Number(vm.stockHealth.critical_stock ?? 0),
      Number(vm.stockHealth.out_of_stock ?? 0),
      1
    );
  }

  severityClass(value: string) {
    switch (value) {
      case 'agotado':
        return 'danger';
      case 'critico':
        return 'accent';
      default:
        return 'warn';
    }
  }

  coldStateClass(state: string) {
    switch (state) {
      case 'en_rango':
        return 'success';
      case 'fuera_rango':
        return 'danger';
      default:
        return 'warn';
    }
  }


  statusKindClass(value: string) {
    switch (value) {
      case 'ok':
        return 'success';
      case 'mock':
      case 'configured':
        return 'info';
      case 'warning':
      case 'unconfigured':
      case 'degraded':
        return 'accent';
      case 'error':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  statusSummaryLine(section: any) {
    if (!section) {
      return 'Sin datos';
    }
    if (section.message) {
      return section.message;
    }
    if (section.database || section.host) {
      return `${section.database || 'DB'} · ${section.host || 'host'}:${section.port || ''}`;
    }
    return 'Operativo';
  }

  formatTimestamp(value: string | null | undefined) {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
  }
}
