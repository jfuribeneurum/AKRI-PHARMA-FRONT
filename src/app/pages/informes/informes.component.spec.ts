import { InformesComponent } from './informes.component';
import { ApiService } from '../../core/api.service';
import { SiteContextService } from '../../core/site-context.service';

// A pedido explícito: solo RIPS queda "ready" mientras se termina de definir
// ese informe; el resto del catálogo se deshabilitó ("blocked") en la UI.
// Estas pruebas fijan que onGenerar() nunca llame a la API para los
// deshabilitados, y que RIPS siga funcionando normalmente.
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

  it('solo RIPS está "ready" — el resto del catálogo queda "blocked"', () => {
    const listos = component.reports.filter(r => r.estado === 'ready');
    expect(listos.map(r => r.key)).toEqual(['rips']);

    const bloqueados = component.reports.filter(r => r.key !== 'rips');
    expect(bloqueados.every(r => r.estado === 'blocked')).toBe(true);
    expect(bloqueados.every(r => !!r.motivoBloqueo)).toBe(true);
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

  it('onGenerar() descarga RIPS sin filtros con solo el formato', async () => {
    const rips = component.reports.find(r => r.key === 'rips')!;
    (api.download as any).mockResolvedValue('akripharmacy-rips.xls');

    await component.onGenerar(rips);

    expect(api.download).toHaveBeenCalledTimes(1);
    const [path] = (api.download as any).mock.calls[0];
    expect(path).toBe('/reports/rips-am/export?format=excel');
    expect(component.message()).toContain('RIPS');
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
