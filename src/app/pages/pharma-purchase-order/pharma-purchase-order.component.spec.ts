import { PharmaPurchaseOrderComponent } from './pharma-purchase-order.component';
import { ApiService } from '../../core/api.service';

// saveOrder()/buildPayload() tenían un bug real: el guard de saveOrder()
// exige que exista AL MENOS UN item con producto+cantidad válidos antes de
// guardar, pero buildPayload() filtraba los items a enviar solo por
// "cantidad > 0" (sin exigir producto) y le ponía "|| 1" al id_producto
// faltante — una fila con cantidad escrita pero sin MX seleccionado se
// colaba igual en el payload como si fuera el producto id 1, generando una
// orden de compra del medicamento equivocado sin ningún aviso. Estas
// pruebas fijan el comportamiento corregido: buildPayload() usa el mismo
// criterio que el guard, y saveOrder() también exige proveedor.
function makeApiStub(): ApiService {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as ApiService;
}

function makeItem(overrides: Partial<any> = {}): any {
  return {
    id_producto: 451,
    product_key: 'GLIFORMIN|850MG|METFORMINA',
    codigo: 'MX01-3',
    nombre: 'GLIFORMIN',
    laboratorio: 'MSN LABORATORIES',
    cantidad: 10,
    valor_unitario: 5000,
    precio_venta: 8000,
    costo_referencia: 5000,
    productoFiltro: 'GLIFORMIN · 850MG',
    ...overrides
  };
}

describe('PharmaPurchaseOrderComponent — creación de orden de compra', () => {
  let component: PharmaPurchaseOrderComponent;
  let api: ApiService;

  beforeEach(() => {
    api = makeApiStub();
    component = new PharmaPurchaseOrderComponent(api);
    component.order.id_proveedor = 9;
    component.order.consecutivo = 'OC-0000100';
  });

  describe('buildPayload', () => {
    it('incluye un item con producto y cantidad válidos', () => {
      component.items = [makeItem()];
      const payload: any = (component as any).buildPayload();

      expect(payload.id_proveedor).toBe(9);
      expect(payload.items).toEqual([
        { id_producto: 451, cantidad: 10, precio_unitario: 5000, precio_venta: 8000, costo_referencia: 5000, descuento: 0, impuesto: 0, fecha_requerida: null }
      ]);
    });

    it('excluye una fila con cantidad escrita pero sin MX seleccionado (id_producto = 0), en vez de mandarla como producto id 1', () => {
      component.items = [
        makeItem({ id_producto: 451, cantidad: 10 }),
        makeItem({ id_producto: 0, product_key: '', cantidad: 5 })
      ];
      const payload: any = (component as any).buildPayload();

      expect(payload.items).toHaveLength(1);
      expect(payload.items[0].id_producto).toBe(451);
      expect(payload.items.some((i: any) => i.id_producto === 1)).toBe(false);
    });

    it('excluye una fila con producto seleccionado pero cantidad en 0', () => {
      component.items = [
        makeItem({ id_producto: 451, cantidad: 10 }),
        makeItem({ id_producto: 452, cantidad: 0 })
      ];
      const payload: any = (component as any).buildPayload();

      expect(payload.items).toHaveLength(1);
      expect(payload.items[0].id_producto).toBe(451);
    });

    it('no manda ningún item cuando ninguna fila tiene producto y cantidad válidos a la vez', () => {
      component.items = [
        makeItem({ id_producto: 0, cantidad: 10 }),
        makeItem({ id_producto: 452, cantidad: 0 })
      ];
      const payload: any = (component as any).buildPayload();

      expect(payload.items).toEqual([]);
    });
  });

  describe('saveOrder — validaciones antes de guardar', () => {
    it('rechaza sin llamar a la API cuando no hay proveedor seleccionado', async () => {
      component.order.id_proveedor = null;
      component.items = [makeItem()];

      await component.saveOrder();

      expect(component.error()).toBe('Debe seleccionar un proveedor.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rechaza sin llamar a la API cuando ningún item tiene producto y cantidad válidos', async () => {
      component.items = [makeItem({ id_producto: 0, cantidad: 10 })];

      await component.saveOrder();

      expect(component.error()).toBe('Debe agregar al menos un item con producto y cantidad válidos.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('permite guardar si AL MENOS una fila es válida, aunque otra fila esté incompleta (y esa fila incompleta no se envía)', async () => {
      (api.post as any).mockResolvedValue({ data: { numero_oc: 'OC-0000100' } });
      (api.get as any).mockResolvedValue({ data: [] });
      component.items = [
        makeItem({ id_producto: 451, cantidad: 10 }),
        makeItem({ id_producto: 0, cantidad: 5 })
      ];

      await component.saveOrder();

      expect(api.post).toHaveBeenCalledTimes(1);
      const [, payload]: any = (api.post as any).mock.calls[0];
      expect(payload.items).toHaveLength(1);
      expect(payload.items[0].id_producto).toBe(451);
    });
  });

  describe('saveOrder — creación exitosa', () => {
    beforeEach(() => {
      (api.post as any).mockResolvedValue({ data: { numero_oc: 'OC-0000100' } });
      (api.get as any).mockResolvedValue({ data: [] });
      component.items = [makeItem()];
    });

    it('llama a POST /purchases (no PUT) con el payload construido', async () => {
      await component.saveOrder();

      expect(api.post).toHaveBeenCalledWith('/purchases', expect.objectContaining({
        id_proveedor: 9,
        items: [expect.objectContaining({ id_producto: 451, cantidad: 10 })]
      }));
      expect(api.put).not.toHaveBeenCalled();
    });

    it('muestra el modal de éxito de creación con el numero_oc devuelto por el backend', async () => {
      await component.saveOrder();

      expect(component.showSuccessModal()).toBe(true);
      expect(component.successModalTitle()).toBe('¡Orden creada!');
      expect(component.createdOcNumber()).toBe('OC-0000100');
    });

    it('recarga el listado de órdenes después de crear', async () => {
      await component.saveOrder();

      expect(api.get).toHaveBeenCalledWith('/purchases');
    });

    it('limpia el mensaje de error previo al reintentar', async () => {
      component.error.set('error previo');
      await component.saveOrder();

      expect(component.error()).toBe('');
    });
  });

  describe('saveOrder — el backend rechaza la orden', () => {
    it('muestra el mensaje de error del backend y no abre el modal de éxito', async () => {
      (api.post as any).mockRejectedValue({ error: { message: 'El proveedor no existe' } });
      component.items = [makeItem()];

      await component.saveOrder();

      expect(component.error()).toBe('El proveedor no existe');
      expect(component.showSuccessModal()).toBe(false);
    });

    it('deja de mostrar el estado "guardando" incluso si la API falla', async () => {
      (api.post as any).mockRejectedValue({ error: { message: 'falló' } });
      component.items = [makeItem()];

      await component.saveOrder();

      expect(component.saving()).toBe(false);
    });
  });

  describe('saveOrder — modo edición usa PUT en vez de POST', () => {
    it('llama a PUT /purchases/:id cuando editingOrderId está seteado', async () => {
      (api.put as any).mockResolvedValue({ data: { numero_oc: 'OC-0000050' } });
      (api.get as any).mockResolvedValue({ data: [] });
      component.editingOrderId.set(50);
      component.items = [makeItem()];

      await component.saveOrder();

      expect(api.put).toHaveBeenCalledWith('/purchases/50', expect.any(Object));
      expect(api.post).not.toHaveBeenCalled();
      expect(component.successModalTitle()).toBe('¡Orden actualizada!');
    });
  });
});
