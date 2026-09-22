import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SiteContextService } from '../../core/site-context.service';

type InformeStatus = 'ready' | 'build' | 'blocked';
type InformeCategoria = 'catalogo' | 'factura' | 'dispensacion' | 'cartera' | 'inventario' | 'movimientos' | 'compras';

interface InformeDef {
  key: string;
  categoria: InformeCategoria;
  nombre: string;
  descripcion: string;
  estado: InformeStatus;
  /** Ruta del export en el backend — solo presente cuando estado = 'ready'. */
  path?: string;
  motivoBloqueo?: string;
}

const CATEGORIAS: Record<InformeCategoria, { label: string; color: string }> = {
  catalogo:     { label: 'Catálogo',     color: '#6D28D9' },
  factura:      { label: 'Facturación',  color: '#0EA5E9' },
  dispensacion: { label: 'Dispensación', color: '#F97316' },
  cartera:      { label: 'Cartera',      color: '#EAB308' },
  inventario:   { label: 'Inventario',   color: '#10B981' },
  movimientos:  { label: 'Movimientos',  color: '#3B82F6' },
  compras:      { label: 'Compras',      color: '#EF4444' }
};

const STATUS_LABEL: Record<InformeStatus, string> = {
  ready: 'Listo',
  build: 'Por construir',
  blocked: 'Bloqueado'
};

// Catálogo de los 12 informes solicitados. Los que ya tienen un export real
// en el backend llevan `path` y se descargan de una vez; el resto se marca
// explícitamente para no prometer algo que todavía no existe.
const REPORTS: InformeDef[] = [
  { key: 'maestro',      categoria: 'catalogo',     nombre: 'Listado maestro',                 descripcion: 'Catálogo completo de MX con todas sus variables.',       estado: 'ready', path: '/reports/maestro/export' },
  { key: 'rips',         categoria: 'factura',      nombre: 'Facturación — RIPS',               descripcion: 'Archivo AM (medicamentos), estructura estándar pendiente de homologación oficial.', estado: 'ready', path: '/reports/rips-am/export' },
  { key: 'dispensacion', categoria: 'dispensacion', nombre: 'Dispensación',                     descripcion: 'Cruce entre lo formulado y lo realmente dispensado.',    estado: 'ready', path: '/reports/dispensing/export' },
  { key: 'pendientes',   categoria: 'cartera',      nombre: 'Pendientes (generados y pagados)', descripcion: 'Facturas generadas y su estado — el pago aún no se registra en el sistema.', estado: 'ready', path: '/reports/pendientes/export' },
  { key: 'inventario',   categoria: 'inventario',   nombre: 'Consulta de inventarios',          descripcion: 'Existencias disponibles, reservadas y en cuarentena.',   estado: 'ready', path: '/reports/inventory/export' },
  { key: 'movimientos',  categoria: 'inventario',   nombre: 'Movimientos por producto',         descripcion: 'Historial de entradas, salidas y ajustes por MX.',       estado: 'ready', path: '/reports/movimientos-producto/export' },
  { key: 'actas',        categoria: 'compras',      nombre: 'Actas de recepción',               descripcion: 'Detalle ítem por ítem de todas las recepciones de mercancía.', estado: 'ready', path: '/reports/actas-recepcion/export' },
  { key: 'ordenes',      categoria: 'compras',      nombre: 'Órdenes de compra',                descripcion: 'Consolidado en Excel de todas las órdenes de compra.',   estado: 'ready', path: '/reports/purchases/export' },
  { key: 'ingresos',     categoria: 'compras',      nombre: 'Ingresos',                         descripcion: 'Consolidado en Excel de todos los ingresos registrados.',estado: 'ready', path: '/reports/ingresos/export' },
  { key: 'devoluciones', categoria: 'compras',      nombre: 'Devoluciones',                     descripcion: 'Consolidado en Excel de todas las devoluciones.',        estado: 'ready', path: '/reports/devoluciones/export' },
  { key: 'entradas',     categoria: 'movimientos',  nombre: 'Entradas',                         descripcion: 'Consolidado en Excel de todos los movimientos de entrada.', estado: 'ready', path: '/reports/entradas/export' },
  { key: 'salidas',      categoria: 'movimientos',  nombre: 'Salidas',                          descripcion: 'Consolidado en Excel de todos los movimientos de salida.', estado: 'ready', path: '/reports/salidas/export' }
];

@Component({
  selector: 'akri-informes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './informes.component.html',
  styleUrls: ['./informes.component.css']
})
export class InformesComponent {
  readonly reports = REPORTS;
  readonly categorias = CATEGORIAS;
  readonly statusLabel = STATUS_LABEL;

  readonly message = signal('');
  readonly error = signal('');
  readonly downloadingKey = signal<string | null>(null);

  desde = '';
  hasta = '';
  idSede: number | '' = '';

  constructor(
    private readonly api: ApiService,
    readonly siteContext: SiteContextService
  ) {}

  categoriaOf(r: InformeDef) {
    return this.categorias[r.categoria];
  }

  async onGenerar(r: InformeDef) {
    this.error.set('');
    this.message.set('');

    if (r.estado === 'blocked') {
      this.error.set(`${r.nombre}: ${r.motivoBloqueo ?? 'Este informe todavía no está disponible.'}`);
      return;
    }
    if (r.estado === 'build' || !r.path) {
      this.error.set(`${r.nombre} está en construcción — todavía no se puede generar.`);
      return;
    }

    this.downloadingKey.set(r.key);
    try {
      const params = new URLSearchParams({ format: 'excel' });
      if (this.desde) params.set('desde', this.desde);
      if (this.hasta) params.set('hasta', this.hasta);
      if (this.idSede) params.set('id_sede', String(this.idSede));

      await this.api.download(`${r.path}?${params.toString()}`, `akripharmacy-${r.key}.xls`);
      this.message.set(`${r.nombre} exportado.`);
    } catch (err: any) {
      this.error.set(err?.error?.message || `No fue posible exportar ${r.nombre}.`);
    } finally {
      this.downloadingKey.set(null);
    }
  }
}
