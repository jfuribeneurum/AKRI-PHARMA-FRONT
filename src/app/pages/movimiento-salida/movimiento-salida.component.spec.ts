import { TestBed } from '@angular/core/testing';
import { MovimientoSalidaComponent } from './movimiento-salida.component';
import { ApiService } from '../../core/api.service';

// Este componente no tenía ninguna prueba unitaria pese al bug real que se
// corrigió esta sesión (form.tipo precargado con 'salida_venta', un valor
// que no existe en las opciones del <select>, dejaba el combo en blanco
// pero el movimiento se registraba igual con ese tipo equivocado si el
// usuario no lo tocaba). Estas pruebas fijan el guard de tipo, el resto de
// validaciones de registrar() (duplicados, cantidad > 0, cantidad <= stock
// disponible) y el payload exacto que se envía a la API.
function makeApiStub(): ApiService {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as ApiService;
}

function createComponent(api: ApiService): MovimientoSalidaComponent {
  TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
  return TestBed.runInInjectionContext(() => new MovimientoSalidaComponent());
}

describe('MovimientoSalidaComponent', () => {
  let component: MovimientoSalidaComponent;
  let api: ApiService;

  beforeEach(() => {
    api = makeApiStub();
    component = createComponent(api);
    component.form = { tipo: 'salida_venta', motivo: '' };
    component.allStock.set([
      { id_lote: 10, nombre_comercial: 'PARACETAMOL', cantidad_disponible: 5, id_almacen: 6, id_ubicacion: 7 },
      { id_lote: 11, nombre_comercial: 'IBUPROFENO', cantidad_disponible: 20, id_almacen: 6, id_ubicacion: 7 }
    ]);
  });

  describe('registrar — el bug real: tipo vacío por defecto', () => {
    it('rechaza sin llamar a la API cuando no se ha elegido un tipo de movimiento', async () => {
      component.form.tipo = '';
      component.items = [{ id_lote: 10, cantidad: 1 }];

      await component.registrar();

      expect(component.error()).toBe('Selecciona el tipo de movimiento.');
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  describe('registrar — validaciones antes de llamar a la API', () => {
    it('rechaza cuando ninguna línea tiene lote seleccionado', async () => {
      component.items = [{ id_lote: null, cantidad: 1 }];

      await component.registrar();

      expect(component.error()).toBe('Agrega al menos un producto.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza un lote que ya no está en el stock cargado', async () => {
      component.items = [{ id_lote: 999, cantidad: 1 }];

      await component.registrar();

      expect(component.error()).toBe('Selecciona un lote válido en cada línea.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza dos líneas con el mismo lote', async () => {
      component.items = [{ id_lote: 10, cantidad: 1 }, { id_lote: 10, cantidad: 2 }];

      await component.registrar();

      expect(component.error()).toContain('Ya agregaste "PARACETAMOL"');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza cantidad <= 0', async () => {
      component.items = [{ id_lote: 10, cantidad: 0 }];

      await component.registrar();

      expect(component.error()).toContain('debe ser mayor a 0');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza cantidad mayor al stock disponible', async () => {
      component.items = [{ id_lote: 10, cantidad: 999 }];

      await component.registrar();

      expect(component.error()).toContain('no puede superar el stock disponible (5)');
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  describe('registrar — payload enviado a la API', () => {
    it('manda id_lote, almacén/ubicación de origen y cantidad tomados del stock', async () => {
      (api.post as any).mockResolvedValue({});
      component.items = [{ id_lote: 10, cantidad: 3 }];

      await component.registrar();

      expect(api.post).toHaveBeenCalledWith('/inventory/movements', {
        tipo: 'salida_venta',
        id_lote: 10,
        id_almacen_origen: 6,
        id_ubicacion_origen: 7,
        cantidad: 3,
        motivo: null
      });
    });
  });

  describe('registrar — éxito y fallo parcial', () => {
    it('limpia el formulario tras registrar exitosamente todas las líneas', async () => {
      (api.post as any).mockResolvedValue({});
      component.items = [{ id_lote: 10, cantidad: 2 }];

      await component.registrar();

      expect(component.message()).toBe('1 salida(s) registrada(s) exitosamente.');
      expect(component.error()).toBe('');
      expect(component.items).toEqual([{ id_lote: null, cantidad: 1 }]);
      expect(component.form.tipo).toBe('');
    });

    it('deja en pantalla solo la(s) línea(s) que fallaron, sin perder las que sí se registraron', async () => {
      (api.post as any)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ error: { message: 'stock insuficiente' } });
      component.items = [{ id_lote: 10, cantidad: 1 }, { id_lote: 11, cantidad: 1 }];

      await component.registrar();

      expect(component.message()).toBe('1 salida(s) registrada(s) exitosamente.');
      expect(component.error()).toContain('IBUPROFENO: stock insuficiente');
      expect(component.items).toEqual([{ id_lote: 11, cantidad: 1 }]);
    });
  });

  describe('clampCantidad', () => {
    it('recorta la cantidad al stock disponible del lote', () => {
      const item = { id_lote: 10, cantidad: 999 };

      component.clampCantidad(item);

      expect(item.cantidad).toBe(5);
    });

    it('no deja la cantidad en negativo', () => {
      const item = { id_lote: 10, cantidad: -3 };

      component.clampCantidad(item);

      expect(item.cantidad).toBe(0);
    });

    it('no toca la cantidad si el lote todavía no se ha elegido', () => {
      const item = { id_lote: null, cantidad: 999 };

      component.clampCantidad(item);

      expect(item.cantidad).toBe(999);
    });
  });

  describe('onLoteChange', () => {
    it('fija id_lote y reinicia la cantidad a 1', () => {
      const item = { id_lote: null, cantidad: 999 };

      component.onLoteChange(item, '11');

      expect(item.id_lote).toBe(11);
      expect(item.cantidad).toBe(1);
    });
  });

  describe('cargarTipos (vía ngOnInit)', () => {
    it('carga los tipos de movimiento de salida desde /parametros/tipo_movimiento_salida/activos', async () => {
      (api.get as any).mockImplementation((path: string) => {
        if (path === '/parametros/tipo_movimiento_salida/activos') {
          return Promise.resolve({ data: [{ valor: 'merma', etiqueta: 'Merma' }] });
        }
        return Promise.resolve({ data: [] });
      });

      await component.ngOnInit();

      expect(component.tiposMovimiento()).toEqual([{ valor: 'merma', etiqueta: 'Merma' }]);
    });
  });

  describe('cargarHistorial', () => {
    it('pide /inventory/movements/history?direction=salida y guarda el resultado', async () => {
      (api.get as any).mockResolvedValue({ data: [{ id_movimiento: 1, tipo: 'merma', cantidad: 2 }] });

      await component.cargarHistorial();

      expect(api.get).toHaveBeenCalledWith('/inventory/movements/history?direction=salida&limit=50');
      expect(component.historial()).toEqual([{ id_movimiento: 1, tipo: 'merma', cantidad: 2 }]);
    });

    it('deja el historial vacío si la API falla, sin lanzar', async () => {
      (api.get as any).mockRejectedValue(new Error('network'));

      await component.cargarHistorial();

      expect(component.historial()).toEqual([]);
    });
  });

  describe('registrar — refresca el historial tras un guardado exitoso', () => {
    it('llama a cargarHistorial cuando al menos una salida se registró', async () => {
      (api.post as any).mockResolvedValue({});
      (api.get as any).mockResolvedValue({ data: [] });
      component.items = [{ id_lote: 10, cantidad: 1 }];

      await component.registrar();

      const calledHistory = (api.get as any).mock.calls.some((c: any[]) => c[0] === '/inventory/movements/history?direction=salida&limit=50');
      expect(calledHistory).toBe(true);
    });
  });

  describe('anularMovimiento', () => {
    afterEach(() => {
      (window.confirm as any)?.mockRestore?.();
    });

    it('no llama a la API si el usuario cancela la confirmación', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      await component.anularMovimiento({ id_movimiento: 50, nombre_comercial: 'LOSARTAN', cantidad: 3 });

      expect(api.post).not.toHaveBeenCalled();
    });

    it('llama a /inventory/movements/:id/anular y refresca historial + stock cuando se confirma', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      (api.post as any).mockResolvedValue({});
      (api.get as any).mockResolvedValue({ data: [] });

      await component.anularMovimiento({ id_movimiento: 50, nombre_comercial: 'LOSARTAN', cantidad: 3 });

      expect(api.post).toHaveBeenCalledWith('/inventory/movements/50/anular', {});
      expect(component.message()).toBe('Movimiento anulado correctamente.');
    });

    it('muestra el mensaje de error del backend si la anulación falla', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      (api.post as any).mockRejectedValue({ error: { message: 'Este movimiento ya fue anulado.' } });

      await component.anularMovimiento({ id_movimiento: 50, nombre_comercial: 'LOSARTAN', cantidad: 3 });

      expect(component.error()).toBe('Este movimiento ya fue anulado.');
    });
  });
});
