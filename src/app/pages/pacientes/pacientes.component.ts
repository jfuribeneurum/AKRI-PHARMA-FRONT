import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'akri-pacientes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pacientes.component.html',
  styleUrls: ['./pacientes.component.css'],
  imports: [CommonModule, FormsModule]
})
export class PacientesComponent implements OnInit {
  private api = inject(ApiService);

  loading   = signal(false);
  error     = signal('');
  pacientes = signal<any[]>([]);
  meta      = signal({ total: 0, pagina: 1, paginas: 1, limite: 50 });

  buscar       = '';
  paginaActual = 1;

  private readonly TIPOS_DOC: Record<number, string> = {
    1: 'CC', 2: 'TI', 3: 'RC', 4: 'RN', 5: 'CE', 6: 'PA',
    7: 'MS', 8: 'AS', 9: 'NIT', 10: 'CN', 11: 'PT', 12: 'PE'
  };

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.loading.set(true);
    this.error.set('');
    try {
      const params = new URLSearchParams();
      if (this.buscar.trim()) params.set('buscar', this.buscar.trim());
      params.set('pagina', String(this.paginaActual));
      params.set('limite', '50');

      const resp: any = await this.api.get(`/pacientes?${params.toString()}`);
      if (!resp?.success) { this.error.set(resp?.message ?? 'Error al cargar pacientes'); return; }

      this.pacientes.set(resp.data ?? []);
      this.meta.set(resp.meta ?? { total: 0, pagina: 1, paginas: 1, limite: 50 });
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Error de conexión con el servidor');
    } finally {
      this.loading.set(false);
    }
  }

  buscarAhora() {
    this.paginaActual = 1;
    this.cargar();
  }

  limpiar() {
    this.buscar = '';
    this.paginaActual = 1;
    this.cargar();
  }

  irPagina(n: number) {
    const m = this.meta();
    if (n < 1 || n > m.paginas || n === m.pagina) return;
    this.paginaActual = n;
    this.cargar();
  }

  paginasVisibles(): number[] {
    const { pagina, paginas } = this.meta();
    const delta = 2;
    const start = Math.max(1, pagina - delta);
    const end   = Math.min(paginas, pagina + delta);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  tipoDoc(codigo: number): string {
    return this.TIPOS_DOC[codigo] ?? `Tipo ${codigo}`;
  }
}
