import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TrasladosComponent } from './traslados.component';
import { ApiService } from '../../core/api.service';
import { SiteContextService } from '../../core/site-context.service';

// Sin pruebas previas pese a un bug real de autorización corregido esta
// sesión (cargarPendientes() mostraba y permitía confirmar/rechazar
// traslados de CUALQUIER bodega, no solo la bodega activa de la sesión).
// Estas pruebas fijan: el filtro por bodega activa al listar pendientes, las
// validaciones de enviar() (bodega igual a la emisora, duplicados, stock
// insuficiente), el payload exacto y el manejo de éxito/fallo parcial.
function makeApiStub(): ApiService {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as ApiService;
}

function makeSiteContextStub(idAlmacenActivo: number | null = 6): SiteContextService {
  return {
    activeAlmacenId: signal(idAlmacenActivo),
    almacenes: signal([{ id_almacen: 6, nombre: 'Almacén General · Sede Cali' }]),
    activeSedeId: signal(2),
    sedes: signal([])
  } as unknown as SiteContextService;
}

function createComponent(api: ApiService, siteContext: SiteContextService): TrasladosComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ApiService, useValue: api },
      { provide: SiteContextService, useValue: siteContext }
    ]
  });
  return TestBed.runInInjectionContext(() => new TrasladosComponent());
}

describe('TrasladosComponent', () => {
  let component: TrasladosComponent;
  let api: ApiService;

  beforeEach(() => {
    api = makeApiStub();
    component = createComponent(api, makeSiteContextStub(6));
    component.allStock.set([
      { id_lote: 10, nombre_comercial: 'PARACETAMOL', cantidad_disponible: 5, id_almacen: 6, id_ubicacion: 7 },
      { id_lote: 11, nombre_comercial: 'IBUPROFENO', cantidad_disponible: 20, id_almacen: 6, id_ubicacion: 7 }
    ]);
    component.todasUbicaciones.set([{ id_almacen: 9, id_ubicacion: 20 }]); // bodega destino de las pruebas
    component.bodegasDestino.set([{ id_almacen: 9, nombre: 'Almacén Principal', sede_nombre: 'SEDE MEDELLIN DIABETES' }]);
    component.idAlmacenDestino = 9;
  });

  describe('enviar — validaciones antes de llamar a la API', () => {
    it('rechaza cuando la sesión no tiene bodega activa', async () => {
      component = createComponent(api, makeSiteContextStub(null));
      component.idAlmacenDestino = 9;
      component.todasUbicaciones.set([{ id_almacen: 9, id_ubicacion: 20 }]);
      component.items = [{ id_lote: 10, cantidad: 1 }];

      await component.enviar();

      expect(component.error()).toBe('No hay una bodega activa en la sesión.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza sin bodega receptora seleccionada', async () => {
      component.idAlmacenDestino = 0;

      await component.enviar();

      expect(component.error()).toBe('Selecciona la bodega receptora.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza cuando la bodega receptora es la misma que la emisora', async () => {
      component.idAlmacenDestino = 6; // igual a activeAlmacenId del stub

      await component.enviar();

      expect(component.error()).toBe('La bodega receptora debe ser diferente a la bodega emisora.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza cuando la bodega receptora no tiene ubicaciones configuradas', async () => {
      component.todasUbicaciones.set([]);

      await component.enviar();

      expect(component.error()).toBe('La bodega receptora no tiene ubicaciones configuradas.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza cuando ninguna línea tiene lote seleccionado', async () => {
      component.items = [{ id_lote: null, cantidad: 1 }];

      await component.enviar();

      expect(component.error()).toBe('Agrega al menos un producto.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza un lote que ya no está en el stock cargado', async () => {
      component.items = [{ id_lote: 999, cantidad: 1 }];

      await component.enviar();

      expect(component.error()).toBe('Selecciona un lote válido en cada línea.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza dos líneas con el mismo lote', async () => {
      component.items = [{ id_lote: 10, cantidad: 1 }, { id_lote: 10, cantidad: 2 }];

      await component.enviar();

      expect(component.error()).toContain('Ya agregaste "PARACETAMOL"');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza cantidad <= 0', async () => {
      component.items = [{ id_lote: 10, cantidad: 0 }];

      await component.enviar();

      expect(component.error()).toContain('debe ser mayor a 0');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza cantidad mayor al stock disponible', async () => {
      component.items = [{ id_lote: 10, cantidad: 999 }];

      await component.enviar();

      expect(component.error()).toContain('Stock insuficiente para "PARACETAMOL"');
      expect(component.error()).toContain('Máximo disponible: 5');
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  describe('enviar — payload enviado a la API', () => {
    it('manda id_lote, origen (de la sesión), destino elegido y cantidad', async () => {
      (api.post as any).mockResolvedValue({});
      component.form.motivo = 'Reubicación por mantenimiento';
      component.items = [{ id_lote: 10, cantidad: 3 }];

      await component.enviar();

      expect(api.post).toHaveBeenCalledWith('/traslados', {
        id_lote: 10,
        id_almacen_origen: 6,
        id_ubicacion_origen: 7,
        id_almacen_destino: 9,
        id_ubicacion_destino: 20,
        cantidad: 3,
        motivo: 'Reubicación por mantenimiento'
      });
    });
  });

  describe('enviar — éxito y fallo parcial', () => {
    it('al enviar todo con éxito: limpia el formulario y salta a la pestaña "recibir"', async () => {
      (api.post as any).mockResolvedValue({});
      (api.get as any).mockResolvedValue({ data: [] });
      component.items = [{ id_lote: 10, cantidad: 2 }];

      await component.enviar();

      expect(component.message()).toContain('1 traslado(s) enviado(s) hacia Almacén Principal');
      expect(component.error()).toBe('');
      expect(component.items).toEqual([{ id_lote: null, cantidad: 1 }]);
      expect(component.idAlmacenDestino).toBe(0);
      expect(component.activeTab()).toBe('recibir');
    });

    it('deja en pantalla solo la(s) línea(s) que fallaron y NO cambia de pestaña', async () => {
      (api.post as any)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ error: { message: 'bodega destino inactiva' } });
      component.items = [{ id_lote: 10, cantidad: 1 }, { id_lote: 11, cantidad: 1 }];

      await component.enviar();

      expect(component.message()).toContain('1 traslado(s) enviado(s)');
      expect(component.error()).toContain('IBUPROFENO: bodega destino inactiva');
      expect(component.items).toEqual([{ id_lote: 11, cantidad: 1 }]);
      expect(component.activeTab()).toBe('enviar');
    });
  });

  describe('clampCantidad', () => {
    it('recorta la cantidad al stock disponible del lote', () => {
      const item = { id_lote: 10, cantidad: 999 };
      component.clampCantidad(item);
      expect(item.cantidad).toBe(5);
    });

    it('no deja la cantidad por debajo de 1 (a diferencia de Salida, que sí permite 0)', () => {
      const item = { id_lote: 10, cantidad: -3 };
      component.clampCantidad(item);
      expect(item.cantidad).toBe(1);
    });
  });

  describe('nombreBodegaEmisora / nombreBodegaDestino', () => {
    it('resuelve el nombre de la bodega emisora desde la bodega activa de la sesión', () => {
      component.todasBodegas.set([{ id_almacen: 6, nombre: 'Almacén General · Sede Cali' }]);
      expect(component.nombreBodegaEmisora()).toBe('Almacén General · Sede Cali');
    });

    it('resuelve el nombre de la bodega receptora elegida', () => {
      expect(component.nombreBodegaDestino()).toBe('Almacén Principal');
    });
  });

  describe('cargarPendientes — solo la bodega activa de la sesión', () => {
    it('filtra por id_almacen_destino de la bodega activa (no trae traslados de otras bodegas)', async () => {
      (api.get as any).mockResolvedValue({ data: [{ id_traslado: 1, cantidad: 5 }] });

      await component.cargarPendientes();

      expect(api.get).toHaveBeenCalledWith('/traslados?estado=pendiente&id_almacen_destino=6');
      expect(component.pendientes()).toEqual([{ id_traslado: 1, cantidad: 5 }]);
      expect(component.getAcc(1)).toEqual({ obs: '', rechazando: false });
    });
  });

  describe('toggleRechazando / getAcc', () => {
    it('alterna el estado de "rechazando" para un traslado', () => {
      expect(component.getAcc(1).rechazando).toBe(false);
      component.toggleRechazando(1);
      expect(component.getAcc(1).rechazando).toBe(true);
      component.toggleRechazando(1);
      expect(component.getAcc(1).rechazando).toBe(false);
    });
  });

  describe('confirmarRecepcion', () => {
    it('confirma la recepción y muestra un mensaje de éxito', async () => {
      (api.patch as any).mockResolvedValue({});
      (api.get as any).mockResolvedValue({ data: [] });
      component.accionMap[1] = { obs: 'todo bien', rechazando: false };

      await component.confirmarRecepcion({ id_traslado: 1, cantidad: 10, nombre_comercial: 'PARACETAMOL', almacen_destino: 'Almacén Principal' });

      expect(api.patch).toHaveBeenCalledWith('/traslados/1/recibir', { observaciones: 'todo bien' });
      expect(component.message()).toContain('Recepción confirmada: 10 ud(s) de "PARACETAMOL"');
      expect(component.error()).toBe('');
    });

    it('muestra el error del backend cuando la recepción es rechazada (p.ej. bodega equivocada)', async () => {
      (api.patch as any).mockRejectedValue({ error: { message: 'Este traslado no está destinado a tu bodega activa' } });

      await component.confirmarRecepcion({ id_traslado: 2, cantidad: 1, nombre_comercial: 'X', almacen_destino: 'Y' });

      expect(component.error()).toBe('Este traslado no está destinado a tu bodega activa');
    });
  });

  describe('rechazarTraslado', () => {
    it('rechaza el traslado con el motivo indicado y muestra un mensaje de éxito', async () => {
      (api.patch as any).mockResolvedValue({});
      (api.get as any).mockResolvedValue({ data: [] });
      component.accionMap[3] = { obs: 'lote equivocado', rechazando: true };

      await component.rechazarTraslado({ id_traslado: 3 });

      expect(api.patch).toHaveBeenCalledWith('/traslados/3/rechazar', { motivo: 'lote equivocado' });
      expect(component.message()).toBe('Traslado #3 rechazado.');
    });
  });

  describe('setTab', () => {
    it('limpia mensajes y recarga pendientes al cambiar a la pestaña "recibir"', () => {
      (api.get as any).mockResolvedValue({ data: [] });
      component.message.set('mensaje previo');
      component.error.set('error previo');

      component.setTab('recibir');

      expect(component.activeTab()).toBe('recibir');
      expect(component.message()).toBe('');
      expect(component.error()).toBe('');
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/traslados?estado=pendiente'));
    });
  });
});
