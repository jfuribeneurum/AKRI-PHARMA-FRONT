import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'akri-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  imports: [CommonModule]
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
