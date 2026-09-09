import { TestBed } from '@angular/core/testing';
import { MovimientoEntradaComponent } from './movimiento-entrada.component';
import { ApiService } from '../../core/api.service';

// Este componente no tenía ninguna prueba unitaria pese a haber sido
// reescrito varias veces esta sesión (modo "producto/lote nuevo", bodega
// destino filtrada por sede, signals en vez de campos planos). Estas
// pruebas fijan el comportamiento real de registrar(): las validaciones
// antes de llamar a la API, el payload exacto que se envía para cada modo
// ('existente' vs 'nuevo'), la detección de líneas duplicadas y el manejo
// de éxito/fallo parcial.
function makeApiStub(): ApiService {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as ApiService;
}

function createComponent(api: ApiService): MovimientoEntradaComponent {
  TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
  return TestBed.runInInjectionContext(() => new MovimientoEntradaComponent());
}

describe('MovimientoEntradaComponent', () => {
  let component: MovimientoEntradaComponent;
  let api: ApiService;

  beforeEach(() => {
    api = makeApiStub();
    component = createComponent(api);
    component.form = { tipo: 'entrada_compra', id_almacen_destino: 6, motivo: '' };
    component.lookups.set({
      almacenes: [{ id_almacen: 6, nombre: 'Almacén general', sede_nombre: 'SEDE MEDELLIN HEMOFILIA' }],
      ubicaciones: [{ id_almacen: 6, id_ubicacion: 7 }]
    });
  });

  describe('registrar — validaciones antes de llamar a la API', () => {
    it('rechaza sin tipo de movimiento seleccionado', async () => {
      component.form.tipo = '';

      await component.registrar();

      expect(component.error()).toBe('Selecciona el tipo de movimiento.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza sin bodega destino seleccionada', async () => {
      component.form.id_almacen_destino = 0;

      await component.registrar();

      expect(component.error()).toBe('Selecciona la bodega destino.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza cuando la bodega destino no tiene ubicaciones configuradas', async () => {
      component.lookups.set({ almacenes: [], ubicaciones: [] });

      await component.registrar();

      expect(component.error()).toBe('La bodega destino no tiene ubicaciones configuradas.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza cuando ninguna línea tiene producto/lote seleccionado', async () => {
      component.items = [{
        modo: 'existente', id_lote: null, id_producto: null, nombre_producto: '',
        numero_lote: '', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0
      }];

      await component.registrar();

      expect(component.error()).toBe('Agrega al menos un producto.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza un lote "existente" que ya no está en el stock cargado', async () => {
      component.allStock.set([]); // el lote 55 no existe en el stock actual
      component.items = [{
        modo: 'existente', id_lote: 55, id_producto: null, nombre_producto: '',
        numero_lote: '', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0
      }];

      await component.registrar();

      expect(component.error()).toBe('Selecciona un lote válido en cada línea.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza cantidad <= 0', async () => {
      component.items = [{
        modo: 'nuevo', id_lote: null, id_producto: 25, nombre_producto: 'TRANEXAM',
        numero_lote: '', fecha_vencimiento: '', cantidad: 0, costo_unitario: 0
      }];

      await component.registrar();

      expect(component.error()).toContain('debe ser mayor a 0');
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  describe('registrar — líneas duplicadas', () => {
    it('rechaza dos líneas "existente" con el mismo id_lote', async () => {
      component.allStock.set([{ id_lote: 10, nombre_comercial: 'PARACETAMOL', cantidad_disponible: 5 }]);
      component.items = [
        { modo: 'existente', id_lote: 10, id_producto: null, nombre_producto: '', numero_lote: '', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0 },
        { modo: 'existente', id_lote: 10, id_producto: null, nombre_producto: '', numero_lote: '', fecha_vencimiento: '', cantidad: 2, costo_unitario: 0 }
      ];

      await component.registrar();

      expect(component.error()).toContain('Ya agregaste "PARACETAMOL"');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza dos líneas "nuevo" con el mismo producto y mismo número de lote', async () => {
      component.items = [
        { modo: 'nuevo', id_lote: null, id_producto: 25, nombre_producto: 'TRANEXAM', numero_lote: 'L1', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0 },
        { modo: 'nuevo', id_lote: null, id_producto: 25, nombre_producto: 'TRANEXAM', numero_lote: 'L1', fecha_vencimiento: '', cantidad: 2, costo_unitario: 0 }
      ];

      await component.registrar();

      expect(component.error()).toContain('Ya agregaste "TRANEXAM"');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('permite el mismo producto "nuevo" en dos líneas si el número de lote es distinto', async () => {
      (api.post as any).mockResolvedValue({});
      component.items = [
        { modo: 'nuevo', id_lote: null, id_producto: 25, nombre_producto: 'TRANEXAM', numero_lote: 'L1', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0 },
        { modo: 'nuevo', id_lote: null, id_producto: 25, nombre_producto: 'TRANEXAM', numero_lote: 'L2', fecha_vencimiento: '', cantidad: 2, costo_unitario: 0 }
      ];

      await component.registrar();

      expect(component.error()).toBe('');
      expect(api.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('registrar — payload enviado a la API', () => {
    it('para modo "existente": manda id_lote y deja id_producto/numero_lote/fecha_vencimiento en null', async () => {
      (api.post as any).mockResolvedValue({});
      component.allStock.set([{ id_lote: 10, nombre_comercial: 'PARACETAMOL', cantidad_disponible: 5, costo_unitario: 100 }]);
      component.items = [{
        modo: 'existente', id_lote: 10, id_producto: null, nombre_producto: '',
        numero_lote: '', fecha_vencimiento: '', cantidad: 4, costo_unitario: 100
      }];

      await component.registrar();

      expect(api.post).toHaveBeenCalledWith('/inventory/movements', {
        tipo: 'entrada_compra',
        id_lote: 10,
        id_producto: null,
        numero_lote: null,
        fecha_vencimiento: null,
        id_almacen_destino: 6,
        id_ubicacion_destino: 7,
        cantidad: 4,
        costo_unitario: 100,
        motivo: null
      });
    });

    it('para modo "nuevo": manda id_producto/numero_lote/fecha_vencimiento y deja id_lote en null', async () => {
      (api.post as any).mockResolvedValue({});
      component.items = [{
        modo: 'nuevo', id_lote: null, id_producto: 25, nombre_producto: 'TRANEXAM',
        numero_lote: 'ABC123', fecha_vencimiento: '2027-01-01', cantidad: 3, costo_unitario: 50
      }];

      await component.registrar();

      expect(api.post).toHaveBeenCalledWith('/inventory/movements', {
        tipo: 'entrada_compra',
        id_lote: null,
        id_producto: 25,
        numero_lote: 'ABC123',
        fecha_vencimiento: '2027-01-01',
        id_almacen_destino: 6,
        id_ubicacion_destino: 7,
        cantidad: 3,
        costo_unitario: 50,
        motivo: null
      });
    });

    it('modo "nuevo" con lote/vencimiento en blanco: los manda como null (el backend genera un lote automático)', async () => {
      (api.post as any).mockResolvedValue({});
      component.items = [{
        modo: 'nuevo', id_lote: null, id_producto: 25, nombre_producto: 'TRANEXAM',
        numero_lote: '', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0
      }];

      await component.registrar();

      const [, payload]: any = (api.post as any).mock.calls[0];
      expect(payload.numero_lote).toBeNull();
      expect(payload.fecha_vencimiento).toBeNull();
    });
  });

  describe('registrar — éxito y fallo parcial', () => {
    it('limpia el formulario tras registrar exitosamente todas las líneas', async () => {
      (api.post as any).mockResolvedValue({});
      component.items = [{
        modo: 'nuevo', id_lote: null, id_producto: 25, nombre_producto: 'TRANEXAM',
        numero_lote: '', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0
      }];

      await component.registrar();

      expect(component.message()).toBe('1 entrada(s) registrada(s) exitosamente.');
      expect(component.error()).toBe('');
      expect(component.items).toHaveLength(1);
      expect(component.items[0].id_producto).toBeNull();
      expect(component.form.tipo).toBe('');
    });

    it('deja en pantalla solo la(s) línea(s) que fallaron, sin perder las que sí se registraron', async () => {
      (api.post as any)
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ error: { message: 'stock insuficiente' } });
      component.items = [
        { modo: 'nuevo', id_lote: null, id_producto: 25, nombre_producto: 'TRANEXAM', numero_lote: 'L1', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0 },
        { modo: 'nuevo', id_lote: null, id_producto: 26, nombre_producto: 'FALLIDO', numero_lote: 'L2', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0 }
      ];

      await component.registrar();

      expect(component.message()).toBe('1 entrada(s) registrada(s) exitosamente.');
      expect(component.error()).toContain('FALLIDO: stock insuficiente');
      expect(component.items).toHaveLength(1);
      expect(component.items[0].nombre_producto).toBe('FALLIDO');
    });
  });

  describe('toggleModo', () => {
    it('limpia los campos del modo anterior al cambiar de "existente" a "nuevo"', () => {
      const item = { modo: 'existente' as const, id_lote: 10, id_producto: null, nombre_producto: '', numero_lote: '', fecha_vencimiento: '', cantidad: 5, costo_unitario: 20 };

      component.toggleModo(item, 'nuevo');

      expect(item.modo).toBe('nuevo');
      expect(item.id_lote).toBeNull();
      expect(item.cantidad).toBe(1);
      expect(item.costo_unitario).toBe(0);
    });
  });

  describe('onProductoNuevoSelect', () => {
    it('copia nombre y costo de referencia del producto elegido', () => {
      component.allProducts.set([{ id_producto: 25, nombre_comercial: 'TRANEXAM', costo_referencia: '268.95' }]);
      const item = { modo: 'nuevo' as const, id_lote: null, id_producto: null, nombre_producto: '', numero_lote: '', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0 };

      component.onProductoNuevoSelect(item, '25');

      expect(item.id_producto).toBe(25);
      expect(item.nombre_producto).toBe('TRANEXAM');
      expect(item.costo_unitario).toBe(268.95);
    });

    it('prefiere el nombre completo de HealthSphere sobre el nombre comercial cuando ambos existen', () => {
      component.allProducts.set([{ id_producto: 25, nombre_medicamento_hs: 'TRANEXAMICO 500 MG TABLETA', nombre_comercial: 'TRANEXAM', costo_referencia: 0 }]);
      const item = { modo: 'nuevo' as const, id_lote: null, id_producto: null, nombre_producto: '', numero_lote: '', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0 };

      component.onProductoNuevoSelect(item, '25');

      expect(item.nombre_producto).toBe('TRANEXAMICO 500 MG TABLETA');
    });
  });

  describe('onLoteChange', () => {
    it('copia el costo_unitario del lote seleccionado', () => {
      component.allStock.set([{ id_lote: 10, nombre_comercial: 'PARACETAMOL', costo_unitario: 150 }]);
      const item = { modo: 'existente' as const, id_lote: null, id_producto: null, nombre_producto: '', numero_lote: '', fecha_vencimiento: '', cantidad: 1, costo_unitario: 0 };

      component.onLoteChange(item, '10');

      expect(item.id_lote).toBe(10);
      expect(item.costo_unitario).toBe(150);
    });
  });

  describe('cargarLookups', () => {
    it('carga bodegas desde /purchases/warehouses?scope=propia y tipos desde /parametros', async () => {
      (api.get as any).mockImplementation((path: string) => {
        if (path === '/inventory/lookups') return Promise.resolve({ data: { almacenes: [], ubicaciones: [{ id_almacen: 6, id_ubicacion: 7 }] } });
        if (path === '/parametros/tipo_movimiento_entrada/activos') return Promise.resolve({ data: [{ valor: 'entrada_compra', etiqueta: 'Compra' }] });
        if (path === '/purchases/warehouses?scope=propia') return Promise.resolve({ data: [{ id_almacen: 6, nombre: 'Almacén general', sede_nombre: 'SEDE MEDELLIN HEMOFILIA' }] });
        return Promise.resolve({ data: [] });
      });

      await component.cargarLookups();

      expect(component.lookups().almacenes).toEqual([{ id_almacen: 6, nombre: 'Almacén general', sede_nombre: 'SEDE MEDELLIN HEMOFILIA' }]);
      expect(component.lookups().ubicaciones).toEqual([{ id_almacen: 6, id_ubicacion: 7 }]);
      expect(component.tiposMovimiento()).toEqual([{ valor: 'entrada_compra', etiqueta: 'Compra' }]);
    });
  });
});
