import { Component, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
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

// A pedido explícito: mientras se termina de definir el informe de RIPS,
// el resto queda deshabilitado en la UI (estado 'blocked', con motivo) para
// que no se puedan generar, aunque sus exports en el backend sigan existiendo.
const MOTIVO_DESHABILITADO = 'Deshabilitado temporalmente mientras se termina de definir el informe de RIPS.';

const REPORTS: InformeDef[] = [
  { key: 'maestro',      categoria: 'catalogo',     nombre: 'Listado maestro',                 descripcion: 'Catálogo completo de MX con todas sus variables.',       estado: 'blocked', path: '/reports/maestro/export', motivoBloqueo: MOTIVO_DESHABILITADO },
  { key: 'rips',         categoria: 'factura',      nombre: 'Facturación — RIPS',               descripcion: 'Archivo AM (medicamentos), estructura estándar pendiente de homologación oficial.', estado: 'ready', path: '/reports/rips-am/export' },
  { key: 'dispensacion', categoria: 'dispensacion', nombre: 'Dispensación',                     descripcion: 'Cruce entre lo formulado y lo realmente dispensado.',    estado: 'blocked', path: '/reports/dispensing/export', motivoBloqueo: MOTIVO_DESHABILITADO },
  { key: 'pendientes',   categoria: 'cartera',      nombre: 'Pendientes (generados y pagados)', descripcion: 'Facturas generadas y su estado — el pago aún no se registra en el sistema.', estado: 'blocked', path: '/reports/pendientes/export', motivoBloqueo: MOTIVO_DESHABILITADO },
  { key: 'inventario',   categoria: 'inventario',   nombre: 'Consulta de inventarios',          descripcion: 'Existencias disponibles, reservadas y en cuarentena.',   estado: 'blocked', path: '/reports/inventory/export', motivoBloqueo: MOTIVO_DESHABILITADO },
  { key: 'movimientos',  categoria: 'inventario',   nombre: 'Movimientos por producto',         descripcion: 'Historial de entradas, salidas y ajustes por MX.',       estado: 'blocked', path: '/reports/movimientos-producto/export', motivoBloqueo: MOTIVO_DESHABILITADO },
  { key: 'actas',        categoria: 'compras',      nombre: 'Actas de recepción',               descripcion: 'Detalle ítem por ítem de todas las recepciones de mercancía.', estado: 'blocked', path: '/reports/actas-recepcion/export', motivoBloqueo: MOTIVO_DESHABILITADO },
  { key: 'ordenes',      categoria: 'compras',      nombre: 'Órdenes de compra',                descripcion: 'Consolidado en Excel de todas las órdenes de compra.',   estado: 'blocked', path: '/reports/purchases/export', motivoBloqueo: MOTIVO_DESHABILITADO },
  { key: 'ingresos',     categoria: 'compras',      nombre: 'Ingresos',                         descripcion: 'Consolidado en Excel de todos los ingresos registrados.',estado: 'blocked', path: '/reports/ingresos/export', motivoBloqueo: MOTIVO_DESHABILITADO },
  { key: 'devoluciones', categoria: 'compras',      nombre: 'Devoluciones',                     descripcion: 'Consolidado en Excel de todas las devoluciones.',        estado: 'blocked', path: '/reports/devoluciones/export', motivoBloqueo: MOTIVO_DESHABILITADO },
  { key: 'entradas',     categoria: 'movimientos',  nombre: 'Entradas',                         descripcion: 'Consolidado en Excel de todos los movimientos de entrada.', estado: 'blocked', path: '/reports/entradas/export', motivoBloqueo: MOTIVO_DESHABILITADO },
  { key: 'salidas',      categoria: 'movimientos',  nombre: 'Salidas',                          descripcion: 'Consolidado en Excel de todos los movimientos de salida.', estado: 'blocked', path: '/reports/salidas/export', motivoBloqueo: MOTIVO_DESHABILITADO }
];

@Component({
  selector: 'akri-informes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './informes.component.html',
  styleUrls: ['./informes.component.css']
})
export class InformesComponent implements OnInit {
  readonly reports = REPORTS;
  readonly categorias = CATEGORIAS;
  readonly statusLabel = STATUS_LABEL;

  readonly message = signal('');
  readonly error = signal('');
  readonly downloadingKey = signal<string | null>(null);

  // Modal de confirmación de descarga: muestra el nombre del informe y los
  // filtros con los que se generó, para que quede claro qué se descargó.
  readonly descargaModal = signal<{ nombre: string; filtros: { label: string; valor: string }[] } | null>(null);

  desde = '';
  hasta = '';
  idSede: number | '' = '';

  // Mismas opciones que el selector "Contrato" del modal de dispensación
  // (/parametros/contrato/activos) — filtro de multi-selección para poder
  // acotar informes (ej. RIPS) a uno o varios contratos a la vez.
  // Como signals: con OnPush, una asignación de campo plano dentro de un
  // ngOnInit async (fuera de un evento de plantilla) no re-renderiza la
  // vista — el signal sí dispara la actualización.
  readonly contratoOptions = signal<{ valor: string; etiqueta: string }[]>([]);
  readonly contratosSeleccionados = signal<string[]>([]);

  constructor(
    private readonly api: ApiService,
    readonly siteContext: SiteContextService
  ) {}

  async ngOnInit() {
    try {
      const res = await this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/contrato/activos');
      this.contratoOptions.set(res.data ?? []);
    } catch {
      this.contratoOptions.set([]);
    }
  }

  onContratoToggle(valor: string, checked: boolean) {
    this.contratosSeleccionados.update(actual =>
      checked ? [...actual, valor] : actual.filter(v => v !== valor)
    );
  }

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
      if (this.contratosSeleccionados().length) params.set('contratos', this.contratosSeleccionados().join(','));

      await this.api.download(`${r.path}?${params.toString()}`, `akripharmacy-${r.key}.xls`);
      this.message.set(`${r.nombre} exportado.`);
      this.descargaModal.set({ nombre: r.nombre, filtros: this.filtrosAplicados() });
    } catch (err: any) {
      this.error.set(err?.error?.message || `No fue posible exportar ${r.nombre}.`);
    } finally {
      this.downloadingKey.set(null);
    }
  }

  private filtrosAplicados(): { label: string; valor: string }[] {
    const filtros: { label: string; valor: string }[] = [];
    filtros.push({ label: 'Desde', valor: this.desde || 'Sin definir' });
    filtros.push({ label: 'Hasta', valor: this.hasta || 'Sin definir' });

    const sede = this.idSede ? this.siteContext.sedes().find(s => s.id_sede === this.idSede) : null;
    filtros.push({ label: 'Sede / Bodega', valor: sede?.nombre ?? 'Todas las sedes' });

    const contratos = this.contratosSeleccionados();
    const etiquetasContratos = contratos.length
      ? this.contratoOptions()
          .filter(c => contratos.includes(c.valor))
          .map(c => c.etiqueta)
          .join(', ')
      : 'Todos los contratos';
    filtros.push({ label: 'Contratos', valor: etiquetasContratos });

    return filtros;
  }

  cerrarDescargaModal() {
    this.descargaModal.set(null);
  }
}
