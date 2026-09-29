import { InformesComponent } from './informes.component';
import { ApiService } from '../../core/api.service';
import { SiteContextService } from '../../core/site-context.service';

// A pedido explícito: RIPS y Dispensación quedan "ready" (Dispensación
// clona el mismo dataset/columnas de RIPS, solo que únicamente en Excel);
// el resto del catálogo sigue "blocked" en la UI. Estas pruebas fijan que
// onGenerar() nunca llame a la API para los deshabilitados.
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

  describe('rol INFORMES', () => {
    beforeEach(() => localStorage.setItem('akri_user', JSON.stringify({ role: 'INFORMES' })));
    afterEach(() => localStorage.removeItem('akri_user'));

    it('solo ve el informe de RIPS', () => {
      const c = new InformesComponent(api, { sedes: () => [] } as unknown as SiteContextService);
      expect(c.reports.map(r => r.key)).toEqual(['rips']);
    });

    it('RIPS solo ofrece CSV', () => {
      const rips = component.reports.find(r => r.key === 'rips')!;
      expect(component.formatosOf(rips)).toEqual(['csv']);
    });
  });

  it('RIPS, Dispensación e Ingresos están "ready" — el resto del catálogo queda "blocked"', () => {
    const listos = component.reports.filter(r => r.estado === 'ready');
    expect(listos.map(r => r.key)).toEqual(['rips', 'dispensacion', 'ingresos']);

    const bloqueados = component.reports.filter(r => !listos.includes(r));
    expect(bloqueados.every(r => r.estado === 'blocked')).toBe(true);
    expect(bloqueados.every(r => !!r.motivoBloqueo)).toBe(true);
  });

  it('Dispensación solo ofrece formato Excel (sin csv)', () => {
    const dispensacion = component.reports.find(r => r.key === 'dispensacion')!;
    expect(component.formatosOf(dispensacion)).toEqual(['excel']);
  });

  it('RIPS ofrece Excel y csv', () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    expect(component.formatosOf(rips)).toEqual(['excel', 'csv']);
  });

  it('onGenerar() descarga Dispensación en excel apuntando a su propio export', async () => {
    const dispensacion = component.reports.find(r => r.key === 'dispensacion')!;
    (api.download as any).mockResolvedValue('akripharmacy-dispensacion.xls');

    await component.onGenerar(dispensacion, 'excel');

    const [path, filename] = (api.download as any).mock.calls[0];
    expect(path).toBe('/reports/dispensing/export?format=excel');
    expect(filename).toBe('akripharmacy-dispensacion.xls');
  });

  it('Ingresos ofrece Excel y csv y descarga desde su export', async () => {
    const ingresos = component.reports.find(r => r.key === 'ingresos')!;
    expect(component.formatosOf(ingresos)).toEqual(['excel', 'csv']);

    await component.onGenerar(ingresos, 'csv');
    const [path, filename] = (api.download as any).mock.calls[0];
    expect(path).toBe('/reports/ingresos/export?format=csv');
    expect(filename).toBe('akripharmacy-ingresos.csv');
  });

  it('onGenerar() no llama a la API para un informe bloqueado, y explica el motivo', async () => {
    const maestro = component.reports.find(r => r.key === 'maestro')!;
    await component.onGenerar(maestro);

    expect(api.download).not.toHaveBeenCalled();
    expect(component.error()).toContain(maestro.motivoBloqueo!);
  });

  it('onGenerar() no llama a la API para un informe en construcción', async () => {
    // Ya no queda ningún informe "build" real en el catálogo (todos están
    // "ready" o "blocked"), así que se prueba con uno sintético para no
    // perder la cobertura de esta rama de onGenerar().
    const enConstruccion = { key: 'x', categoria: 'compras', nombre: 'Informe de prueba', descripcion: '', estado: 'build' } as const;
    await component.onGenerar(enConstruccion as any);

    expect(api.download).not.toHaveBeenCalled();
    expect(component.error()).toContain('construcción');
  });

  it('onGenerar() descarga RIPS en excel por defecto, sin filtros con solo el formato', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    (api.download as any).mockResolvedValue('akripharmacy-rips.xls');

    await component.onGenerar(rips);

    expect(api.download).toHaveBeenCalledTimes(1);
    const [path, filename] = (api.download as any).mock.calls[0];
    expect(path).toBe('/reports/rips-am/export?format=excel');
    expect(filename).toBe('akripharmacy-rips.xls');
    expect(component.message()).toContain('RIPS');
  });

  it('onGenerar() descarga en csv cuando se elige ese formato', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    (api.download as any).mockResolvedValue('akripharmacy-rips.csv');

    await component.onGenerar(rips, 'csv');

    const [path, filename] = (api.download as any).mock.calls[0];
    expect(path).toBe('/reports/rips-am/export?format=csv');
    expect(filename).toBe('akripharmacy-rips.csv');
  });

  it('onGenerar() abre el modal de confirmación con el nombre del informe y "sin filtros" cuando no hay ninguno', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    (api.download as any).mockResolvedValue('akripharmacy-rips.xls');

    await component.onGenerar(rips);

    const modal = component.descargaModal();
    expect(modal?.nombre).toBe('Facturación — RIPS');
    expect(modal?.filtros).toEqual([
      { label: 'Formato', valor: 'Excel' },
      { label: 'Desde', valor: 'Sin definir' },
      { label: 'Hasta', valor: 'Sin definir' },
      { label: 'Sede / Bodega', valor: 'Todas las sedes' },
      { label: 'Contratos', valor: 'Todos los contratos' }
    ]);
  });

  it('onGenerar() muestra en el modal los filtros de fecha, sede, contratos y formato aplicados', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    component.desde = '2026-09-01';
    component.hasta = '2026-09-30';
    component.idSede = 3;
    component.contratoOptions.set([{ valor: 'contrato_a', etiqueta: 'Contrato A' }]);
    component.onContratoToggle('contrato_a', true);
    (component.siteContext.sedes as any) = () => [{ id_sede: 3, nombre: 'Sede Pereira' }];
    (api.download as any).mockResolvedValue('akripharmacy-rips.csv');

    await component.onGenerar(rips, 'csv');

    const modal = component.descargaModal();
    expect(modal?.filtros).toEqual([
      { label: 'Formato', valor: 'CSV' },
      { label: 'Desde', valor: '2026-09-01' },
      { label: 'Hasta', valor: '2026-09-30' },
      { label: 'Sede / Bodega', valor: 'Sede Pereira' },
      { label: 'Contratos', valor: 'Contrato A' }
    ]);
  });

  it('cerrarDescargaModal() limpia el modal', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    (api.download as any).mockResolvedValue('akripharmacy-rips.xls');
    await component.onGenerar(rips);
    expect(component.descargaModal()).not.toBeNull();

    component.cerrarDescargaModal();

    expect(component.descargaModal()).toBeNull();
  });

  it('onGenerar() no abre el modal cuando la descarga falla', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    (api.download as any).mockRejectedValue({ error: { message: 'Sin permisos' } });

    await component.onGenerar(rips);

    expect(component.descargaModal()).toBeNull();
  });

  it('onGenerar() incluye desde/hasta/id_sede en la query cuando están seleccionados', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    component.desde = '2026-09-01';
    component.hasta = '2026-09-30';
    component.idSede = 3;
    (api.download as any).mockResolvedValue('akripharmacy-rips.xls');

    await component.onGenerar(rips);

    const [path] = (api.download as any).mock.calls[0];
    expect(path).toContain('format=excel');
    expect(path).toContain('desde=2026-09-01');
    expect(path).toContain('hasta=2026-09-30');
    expect(path).toContain('id_sede=3');
  });

  it('onGenerar() incluye contratos seleccionados en la query', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    component.onContratoToggle('contrato_a', true);
    component.onContratoToggle('contrato_b', true);
    (api.download as any).mockResolvedValue('akripharmacy-rips.xls');

    await component.onGenerar(rips);

    const [path] = (api.download as any).mock.calls[0];
    expect(path).toContain('contratos=contrato_a%2Ccontrato_b');
  });

  it('onGenerar() muestra un error si la descarga falla, sin romper la página', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    (api.download as any).mockRejectedValue({ error: { message: 'Sin permisos' } });

    await component.onGenerar(rips);

    expect(component.error()).toBe('Sin permisos');
    expect(component.downloadingKey()).toBeNull();
  });

  it('RIPS (archivo AM) ya está "ready" y apunta a su propio export', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    expect(rips.estado).toBe('ready');

    (api.download as any).mockResolvedValue('ok');
    await component.onGenerar(rips);

    expect((api.download as any).mock.calls[0][0]).toBe('/reports/rips-am/export?format=excel');
  });
});
