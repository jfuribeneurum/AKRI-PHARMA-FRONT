import { InformesComponent } from './informes.component';
import { ApiService } from '../../core/api.service';
import { SiteContextService } from '../../core/site-context.service';

// Los informes marcados "build"/"blocked" no tienen un export real todavía —
// esta prueba fija que onGenerar() nunca llame a la API para ellos (nada de
// descargar un archivo roto o pegarle a un endpoint que no existe), y que
// los que sí están "ready" manden los filtros de Fecha/Sede como querystring.
function makeApiStub(): ApiService {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), download: vi.fn() } as unknown as ApiService;
}

describe('InformesComponent', () => {
  let component: InformesComponent;
  let api: ApiService;

  beforeEach(() => {
    api = makeApiStub();
    component = new InformesComponent(api, { sedes: () => [] } as unknown as SiteContextService);
  });

  it('lista los 12 informes solicitados', () => {
    expect(component.reports.length).toBe(12);
  });

  it('onGenerar() no llama a la API para un informe bloqueado, y explica el motivo', async () => {
    // RIPS ya está "ready" (archivo AM); se prueba con uno sintético para
    // no perder la cobertura de la rama "blocked" de onGenerar().
    const bloqueado = { key: 'x', categoria: 'compras', nombre: 'Informe bloqueado', descripcion: '', estado: 'blocked', motivoBloqueo: 'Falta información X.' } as const;
    await component.onGenerar(bloqueado as any);

    expect(api.download).not.toHaveBeenCalled();
    expect(component.error()).toContain('Falta información X.');
  });

  it('onGenerar() no llama a la API para un informe en construcción', async () => {
    // Ya no queda ningún informe "build" real en el catálogo (los 12 están
    // "ready" o "blocked"), así que se prueba con uno sintético para no
    // perder la cobertura de esta rama de onGenerar().
    const enConstruccion = { key: 'x', categoria: 'compras', nombre: 'Informe de prueba', descripcion: '', estado: 'build' } as const;
    await component.onGenerar(enConstruccion as any);

    expect(api.download).not.toHaveBeenCalled();
    expect(component.error()).toContain('construcción');
  });

  it('onGenerar() descarga un informe "ready" sin filtros con solo el formato', async () => {
    const ordenes = component.reports.find(r => r.key === 'ordenes')!;
    (api.download as any).mockResolvedValue('akripharmacy-ordenes.xls');

    await component.onGenerar(ordenes);

    expect(api.download).toHaveBeenCalledTimes(1);
    const [path] = (api.download as any).mock.calls[0];
    expect(path).toBe('/reports/purchases/export?format=excel');
    expect(component.message()).toContain('Órdenes de compra');
  });

  it('onGenerar() incluye desde/hasta/id_sede en la query cuando están seleccionados', async () => {
    const inventario = component.reports.find(r => r.key === 'inventario')!;
    component.desde = '2026-09-01';
    component.hasta = '2026-09-30';
    component.idSede = 3;
    (api.download as any).mockResolvedValue('akripharmacy-inventario.xls');

    await component.onGenerar(inventario);

    const [path] = (api.download as any).mock.calls[0];
    expect(path).toContain('format=excel');
    expect(path).toContain('desde=2026-09-01');
    expect(path).toContain('hasta=2026-09-30');
    expect(path).toContain('id_sede=3');
  });

  it('onGenerar() muestra un error si la descarga falla, sin romper la página', async () => {
    const ordenes = component.reports.find(r => r.key === 'ordenes')!;
    (api.download as any).mockRejectedValue({ error: { message: 'Sin permisos' } });

    await component.onGenerar(ordenes);

    expect(component.error()).toBe('Sin permisos');
    expect(component.downloadingKey()).toBeNull();
  });

  it('Entradas y Salidas ya están "ready" y apuntan a sus propios exports', async () => {
    const entradas = component.reports.find(r => r.key === 'entradas')!;
    const salidas = component.reports.find(r => r.key === 'salidas')!;
    expect(entradas.estado).toBe('ready');
    expect(salidas.estado).toBe('ready');

    (api.download as any).mockResolvedValue('ok');
    await component.onGenerar(entradas);
    await component.onGenerar(salidas);

    expect((api.download as any).mock.calls[0][0]).toBe('/reports/entradas/export?format=excel');
    expect((api.download as any).mock.calls[1][0]).toBe('/reports/salidas/export?format=excel');
  });

  it('Ingresos, Devoluciones y Actas de recepción ya están "ready" y apuntan a sus propios exports', async () => {
    const ingresos = component.reports.find(r => r.key === 'ingresos')!;
    const devoluciones = component.reports.find(r => r.key === 'devoluciones')!;
    const actas = component.reports.find(r => r.key === 'actas')!;
    expect(ingresos.estado).toBe('ready');
    expect(devoluciones.estado).toBe('ready');
    expect(actas.estado).toBe('ready');

    (api.download as any).mockResolvedValue('ok');
    await component.onGenerar(ingresos);
    await component.onGenerar(devoluciones);
    await component.onGenerar(actas);

    expect((api.download as any).mock.calls[0][0]).toBe('/reports/ingresos/export?format=excel');
    expect((api.download as any).mock.calls[1][0]).toBe('/reports/devoluciones/export?format=excel');
    expect((api.download as any).mock.calls[2][0]).toBe('/reports/actas-recepcion/export?format=excel');
  });

  it('Dispensación ya está "ready" y apunta a su propio export', async () => {
    const dispensacion = component.reports.find(r => r.key === 'dispensacion')!;
    expect(dispensacion.estado).toBe('ready');

    (api.download as any).mockResolvedValue('ok');
    await component.onGenerar(dispensacion);

    expect((api.download as any).mock.calls[0][0]).toBe('/reports/dispensing/export?format=excel');
  });

  it('Listado maestro ya está "ready" y apunta a su propio export', async () => {
    const maestro = component.reports.find(r => r.key === 'maestro')!;
    expect(maestro.estado).toBe('ready');

    (api.download as any).mockResolvedValue('ok');
    await component.onGenerar(maestro);

    expect((api.download as any).mock.calls[0][0]).toBe('/reports/maestro/export?format=excel');
  });

  it('Movimientos por producto ya está "ready" y apunta a su propio export', async () => {
    const movimientos = component.reports.find(r => r.key === 'movimientos')!;
    expect(movimientos.estado).toBe('ready');

    (api.download as any).mockResolvedValue('ok');
    await component.onGenerar(movimientos);

    expect((api.download as any).mock.calls[0][0]).toBe('/reports/movimientos-producto/export?format=excel');
  });

  it('los 12 informes ya están "ready" — ninguno queda "build" ni "blocked"', () => {
    const noListos = component.reports.filter(r => r.estado !== 'ready');
    expect(noListos).toEqual([]);
  });

  it('RIPS (archivo AM) ya está "ready" y apunta a su propio export', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    expect(rips.estado).toBe('ready');

    (api.download as any).mockResolvedValue('ok');
    await component.onGenerar(rips);

    expect((api.download as any).mock.calls[0][0]).toBe('/reports/rips-am/export?format=excel');
  });

  it('Pendientes ya está "ready" y apunta a su propio export', async () => {
    const pendientes = component.reports.find(r => r.key === 'pendientes')!;
    expect(pendientes.estado).toBe('ready');

    (api.download as any).mockResolvedValue('ok');
    await component.onGenerar(pendientes);

    expect((api.download as any).mock.calls[0][0]).toBe('/reports/pendientes/export?format=excel');
  });
});
