import { DispensacionPharmaComponent } from './dispensacion-pharma.component';
import { ApiService } from '../../core/api.service';

// These cover the pure calculation/branching logic behind the dispensación
// modal's stat boxes (Form. / Control de entrega / Cant. dispensada /
// Cant. pendiente / Cant. faltante), which was rewritten and re-derived
// several times in the same session — a regression here silently shows the
// wrong numbers to whoever is dispensing medication.
function makeApiStub(): ApiService {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as ApiService;
}

function makeMed(overrides: Partial<any> = {}): any {
  return {
    id_med_formulacion: 1,
    idMedicamento: 999, // id de HealthSphere — nunca debe usarse para stock
    idProductoLocal: 10,
    nombre_medicamento: 'ABACAVIR 300 MG',
    cantidad: 24,
    control: null,
    ...overrides
  };
}

function makeItem(overrides: Partial<any> = {}): any {
  return {
    med: makeMed(),
    cantidad: 0, // "Control de entrega": solo referencia, no mueve inventario
    cantidadDispensadaOverride: 0, // "Cant. dispensada": lo que de verdad sale ahora
    dispensadaOriginal: 0,
    loteSeleccion: {},
    ...overrides
  };
}

describe('DispensacionPharmaComponent', () => {
  let component: DispensacionPharmaComponent;
  let api: ApiService;

  beforeEach(() => {
    api = makeApiStub();
    component = new DispensacionPharmaComponent(api);
  });

  describe('hasActiveFilter', () => {
    it('is false when no filter field has a value', () => {
      expect(component.hasActiveFilter()).toBe(false);
    });

    it('is true when only the search box has text', () => {
      component.search = 'Juan Perez';
      expect(component.hasActiveFilter()).toBe(true);
    });

    it('ignores a search box containing only whitespace', () => {
      component.search = '   ';
      expect(component.hasActiveFilter()).toBe(false);
    });

    it('is true when only an estado filter is set', () => {
      component.filterEstado = 'pendiente';
      expect(component.hasActiveFilter()).toBe(true);
    });

    it('is true when only a date range bound is set', () => {
      component.fechaDesde = '2026-01-01';
      expect(component.hasActiveFilter()).toBe(true);
    });
  });

  describe('load', () => {
    it('does not call the API and clears state when there is no active filter', async () => {
      component.total.set(225);
      component.formulaciones.set([{} as any]);

      await component.load();

      expect(api.get).not.toHaveBeenCalled();
      expect(component.formulaciones()).toEqual([]);
      expect(component.total()).toBe(0);
    });

    it('queries the API with search/estado/fecha params when a filter is active', async () => {
      component.search = '546';
      component.filterEstado = 'dispensado';
      component.fechaDesde = '2026-01-01';
      component.fechaHasta = '2026-01-31';
      (api.get as any).mockResolvedValue({ data: [{ id_formulacion: 1 }], total: 1 });

      await component.load();

      expect(api.get).toHaveBeenCalledTimes(1);
      const url = (api.get as any).mock.calls[0][0] as string;
      expect(url).toContain('/formulaciones-hs?');
      expect(url).toContain('search=546');
      expect(url).toContain('estado=dispensado');
      expect(url).toContain('fechaDesde=2026-01-01');
      expect(url).toContain('fechaHasta=2026-01-31');
      expect(component.formulaciones()).toEqual([{ id_formulacion: 1 }]);
      expect(component.total()).toBe(1);
    });

    it('surfaces the backend error message when the request fails', async () => {
      component.search = 'algo';
      (api.get as any).mockRejectedValue({ error: { message: 'Sesión expirada' } });

      await component.load();

      expect(component.error()).toBe('Sesión expirada');
      expect(component.loading()).toBe(false);
    });
  });

  describe('getMedRestante (valor sembrado al abrir el modal)', () => {
    it('equals the full formulated quantity when nothing has been dispensed', () => {
      expect(component.getMedRestante(makeMed({ cantidad: 24, control: null }))).toBe(24);
    });

    it('subtracts the historical accumulated amount', () => {
      const med = makeMed({ cantidad: 24, control: { cantidad_dispensada: 10 } as any });
      expect(component.getMedRestante(med)).toBe(14);
    });

    it('never goes negative when more was historically dispensed than formulated', () => {
      const med = makeMed({ cantidad: 5, control: { cantidad_dispensada: 8 } as any });
      expect(component.getMedRestante(med)).toBe(0);
    });
  });

  describe('getPendiente (formulada menos histórico ANTES de esta acción — fijo, no depende de lo que se escriba)', () => {
    it('equals formulada minus what was historically dispensed before opening the modal', () => {
      const item = makeItem({ med: makeMed({ cantidad: 24 }), dispensadaOriginal: 10 });
      expect(component.getPendiente(item)).toBe(14);
    });

    it('does not change no matter what is typed in "Control de entrega" or "Cant. dispensada"', () => {
      const item = makeItem({ med: makeMed({ cantidad: 24 }), dispensadaOriginal: 10, cantidad: 99, cantidadDispensadaOverride: 99 });
      expect(component.getPendiente(item)).toBe(14);
    });

    it('is zero once history already covers everything formulated', () => {
      const item = makeItem({ med: makeMed({ cantidad: 24 }), dispensadaOriginal: 24 });
      expect(component.getPendiente(item)).toBe(0);
    });

    it('clamps at zero instead of going negative', () => {
      const item = makeItem({ med: makeMed({ cantidad: 5 }), dispensadaOriginal: 8 });
      expect(component.getPendiente(item)).toBe(0);
    });
  });

  describe('getPendienteEntrega (Control de entrega menos Cant. dispensada — reactivo, se muestra en la tarjeta del modal)', () => {
    it('equals "Control de entrega" minus "Cant. dispensada"', () => {
      const item = makeItem({ cantidad: 100, cantidadDispensadaOverride: 30 });
      expect(component.getPendienteEntrega(item)).toBe(70);
    });

    it('reacts live as either field changes, unlike getPendiente', () => {
      const item = makeItem({ med: makeMed({ cantidad: 300 }), dispensadaOriginal: 0, cantidad: 100, cantidadDispensadaOverride: 30 });
      expect(component.getPendienteEntrega(item)).toBe(70);
      expect(component.getPendiente(item)).toBe(300);
    });

    it('is zero once the delivered amount covers the planned "Control de entrega"', () => {
      const item = makeItem({ cantidad: 50, cantidadDispensadaOverride: 50 });
      expect(component.getPendienteEntrega(item)).toBe(0);
    });

    it('clamps at zero instead of going negative when more was delivered than planned', () => {
      const item = makeItem({ cantidad: 20, cantidadDispensadaOverride: 30 });
      expect(component.getPendienteEntrega(item)).toBe(0);
    });
  });

  describe('getFaltante (formulada menos "Control de entrega" — reactivo, se muestra en la tarjeta del modal)', () => {
    it('equals formulada minus "Control de entrega"', () => {
      const item = makeItem({ med: makeMed({ cantidad: 600 }), cantidad: 100 });
      expect(component.getFaltante(item)).toBe(500);
    });

    it('ignores "Cant. dispensada" and dispensadaOriginal entirely', () => {
      const item = makeItem({ med: makeMed({ cantidad: 600 }), cantidad: 100, cantidadDispensadaOverride: 999, dispensadaOriginal: 999 });
      expect(component.getFaltante(item)).toBe(500);
    });

    it('is zero once "Control de entrega" covers everything formulated', () => {
      const item = makeItem({ med: makeMed({ cantidad: 24 }), cantidad: 24 });
      expect(component.getFaltante(item)).toBe(0);
    });

    it('clamps at zero instead of going negative when "Control de entrega" exceeds lo formulado', () => {
      const item = makeItem({ med: makeMed({ cantidad: 24 }), cantidad: 30 });
      expect(component.getFaltante(item)).toBe(0);
    });
  });

  describe('isMedExpanded / toggleMedCard (solo un MX visible a la vez cuando hay varios)', () => {
    it('toggling a collapsed item expands it and collapses whatever was open', () => {
      const itemA = makeItem({ med: makeMed({ id_med_formulacion: 1 }) });
      const itemB = makeItem({ med: makeMed({ id_med_formulacion: 2 }) });
      component.expandedMedId.set(1);
      expect(component.isMedExpanded(itemA)).toBe(true);
      expect(component.isMedExpanded(itemB)).toBe(false);

      component.toggleMedCard(itemB);

      expect(component.isMedExpanded(itemA)).toBe(false);
      expect(component.isMedExpanded(itemB)).toBe(true);
    });

    it('toggling the already-expanded item collapses it', () => {
      const item = makeItem({ med: makeMed({ id_med_formulacion: 1 }) });
      component.expandedMedId.set(1);

      component.toggleMedCard(item);

      expect(component.isMedExpanded(item)).toBe(false);
      expect(component.expandedMedId()).toBeNull();
    });
  });

  describe('getMedEntregaMax', () => {
    it('is limited by available stock even when more is pending', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 24, control: null });
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });
      expect(component.getMedEntregaMax(med)).toBe(5);
    });

    it('is limited by what is pending even when stock is abundant', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 24, control: { cantidad_dispensada: 20 } as any });
      component.stockByMed.set({ 10: [{ cantidad_disponible: 500 }] });
      expect(component.getMedEntregaMax(med)).toBe(4);
    });

    it('is zero when the medicamento has no MX product linked', () => {
      const med = makeMed({ idProductoLocal: null, cantidad: 24, control: null });
      expect(component.getMedEntregaMax(med)).toBe(0);
    });
  });

  describe('updateControlDeEntrega ("Control de entrega" es solo referencia, nunca toca "Cant. dispensada")', () => {
    it('updates "Control de entrega" without touching "Cant. dispensada" at all', () => {
      const item = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 3000, control: { cantidad_dispensada: 15 } as any }),
        dispensadaOriginal: 15
      });
      component.modalFormItems.set([item]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 100 }] });

      component.updateControlDeEntrega(item, 2);

      const updated = component.modalFormItems()[0];
      expect(updated.cantidad).toBe(2);
      expect(updated.cantidadDispensadaOverride).toBe(0);
    });

    it('leaves a manual "Cant. dispensada" value untouched no matter what Control de entrega does', () => {
      const item = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 3000, control: { cantidad_dispensada: 15 } as any }),
        dispensadaOriginal: 15
      });
      component.modalFormItems.set([item]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 100 }] });

      component.setDispensadaOverride(item, 16);
      component.updateControlDeEntrega(component.modalFormItems()[0], 3);

      const updated = component.modalFormItems()[0];
      expect(updated.cantidad).toBe(3);
      expect(updated.cantidadDispensadaOverride).toBe(16);
    });

    it('clamps Control de entrega to what is pending, WITHOUT being limited by available stock', () => {
      // Bug real: "Control de entrega" es solo un valor de referencia/planeación,
      // no debe estar atado al stock físico actual como "Cant. dispensada" sí lo
      // está — de lo contrario un producto con poco stock nunca deja escribir un
      // valor de referencia mayor, aunque falte mucho por formular.
      const item = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 300, control: null }),
        dispensadaOriginal: 0
      });
      component.modalFormItems.set([item]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });

      component.updateControlDeEntrega(item, 60);

      const updated = component.modalFormItems()[0];
      expect(updated.cantidad).toBe(60);
      expect(updated.cantidadDispensadaOverride).toBe(0);
    });

    it('still clamps Control de entrega to what is pending formulado (upper sanity bound)', () => {
      const item = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 24, control: null }),
        dispensadaOriginal: 0
      });
      component.modalFormItems.set([item]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 500 }] });

      component.updateControlDeEntrega(item, 999);

      const updated = component.modalFormItems()[0];
      expect(updated.cantidad).toBe(24);
      expect(updated.cantidadDispensadaOverride).toBe(0);
    });
  });

  describe('loadStockForMed (reclamp al llegar el stock del backend)', () => {
    it('does NOT clamp "Control de entrega" to arriving stock, only to lo pendiente', async () => {
      // Regresión real: al abrir la fila del medicamento, el stock llega de
      // forma asíncrona y antes recortaba "Control de entrega" al stock físico
      // (ej. de 60 a 30 automáticamente) aunque ese campo sea solo referencia.
      const item = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 300, control: null }),
        cantidad: 60,
        dispensadaOriginal: 0
      });
      component.modalFormItems.set([item]);
      (api.get as any).mockResolvedValue({ data: [{ id_lote: 1, cantidad_disponible: 30 }] });

      await (component as any).loadStockForMed(10);

      const updated = component.modalFormItems()[0];
      expect(updated.cantidad).toBe(60);
    });

    it('DOES clamp "Cant. dispensada" to arriving stock (that field really moves inventory)', async () => {
      const item = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 300, control: null }),
        cantidadDispensadaOverride: 60,
        dispensadaOriginal: 0
      });
      component.modalFormItems.set([item]);
      (api.get as any).mockResolvedValue({ data: [{ id_lote: 1, cantidad_disponible: 30 }] });

      await (component as any).loadStockForMed(10);

      const updated = component.modalFormItems()[0];
      expect(updated.cantidadDispensadaOverride).toBe(30);
    });

    it('still clamps "Control de entrega" down to lo pendiente formulado if it exceeds it', async () => {
      const item = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 24, control: null }),
        cantidad: 24,
        dispensadaOriginal: 0
      });
      component.modalFormItems.set([item]);
      (api.get as any).mockResolvedValue({ data: [{ id_lote: 1, cantidad_disponible: 500 }] });

      await (component as any).loadStockForMed(10);

      const updated = component.modalFormItems()[0];
      expect(updated.cantidad).toBe(24);
    });
  });

  describe('setDispensadaOverride ("Cant. dispensada" es lo que de verdad sale del inventario)', () => {
    it('clamps to the lesser of pending and available stock, same as Control de entrega', () => {
      const item = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 24, control: null }),
        dispensadaOriginal: 0
      });
      component.modalFormItems.set([item]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });

      component.setDispensadaOverride(item, 999);

      const updated = component.modalFormItems()[0];
      expect(updated.cantidadDispensadaOverride).toBe(5);
    });

    it('never touches "Control de entrega"', () => {
      const item = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 3000, control: null }),
        dispensadaOriginal: 0,
        cantidad: 7
      });
      component.modalFormItems.set([item]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 100 }] });

      component.setDispensadaOverride(item, 16);

      const updated = component.modalFormItems()[0];
      expect(updated.cantidad).toBe(7);
      expect(updated.cantidadDispensadaOverride).toBe(16);
    });

    it('leaving it at 0 (dejar pendiente) means nothing is being delivered', () => {
      const item = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 24, control: null }),
        dispensadaOriginal: 0,
        cantidad: 30 // Control de entrega es solo referencia, no obliga a nada
      });
      component.modalFormItems.set([item]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });

      expect(component.getAsignadoValido(item)).toBe(true); // 0 asignado == 0 requerido
    });
  });

  describe('getFaltante reproduce el incidente real: 15 ya dispensadas + 1 ahora', () => {
    it('is 2500 (formulada 3000 menos Control de entrega 500), regardless of history or "Cant. dispensada"', () => {
      const item = makeItem({
        med: makeMed({ cantidad: 3000 }),
        dispensadaOriginal: 15,
        cantidad: 500,
        cantidadDispensadaOverride: 1
      });
      expect(component.getFaltante(item)).toBe(2500);
    });
  });

  describe('loteKey / getAsignado / getAsignadoValido / setLoteQty', () => {
    it('builds a stable key from id_lote and id_ubicacion (a lote can have stock in more than one ubicación)', () => {
      expect(component.loteKey({ id_lote: 3, id_ubicacion: 1 })).toBe('3:1');
    });

    it('getAsignado sums every quantity assigned across lotes', () => {
      const item = makeItem({ loteSeleccion: { '3:1': 4, '3:2': 2 } });
      expect(component.getAsignado(item)).toBe(6);
    });

    it('getAsignadoValido is true only when the assigned total exactly matches "Cant. dispensada"', () => {
      const item = makeItem({ cantidadDispensadaOverride: 6, loteSeleccion: { '3:1': 4, '3:2': 2 } });
      expect(component.getAsignadoValido(item)).toBe(true);
      item.cantidadDispensadaOverride = 7;
      expect(component.getAsignadoValido(item)).toBe(false);
    });

    it('getAsignadoValido ignores "Control de entrega" completely — it never gates lote assignment', () => {
      const item = makeItem({ cantidad: 999, cantidadDispensadaOverride: 0, loteSeleccion: {} });
      expect(component.getAsignadoValido(item)).toBe(true);
    });

    it('setLoteQty clamps to the lot\'s available stock and updates the right key', () => {
      const item = makeItem();
      component.modalFormItems.set([item]);
      component.setLoteQty(item, { id_lote: 3, id_ubicacion: 1, cantidad_disponible: 5 }, 999);
      const updated = component.modalFormItems()[0];
      expect(updated.loteSeleccion['3:1']).toBe(5);
    });

    it('setLoteQty keeps the lote marked (checked) even when its quantity is set back to zero', () => {
      const item = makeItem({ loteSeleccion: { '3:1': 4 } });
      component.modalFormItems.set([item]);
      component.setLoteQty(item, { id_lote: 3, id_ubicacion: 1, cantidad_disponible: 5 }, 0);
      const updated = component.modalFormItems()[0];
      expect(updated.loteSeleccion['3:1']).toBe(0);
      expect(component.isLoteChecked(updated, { id_lote: 3, id_ubicacion: 1 })).toBe(true);
    });
  });

  describe('isLoteChecked / toggleLote (checkbox de selección de lote)', () => {
    it('isLoteChecked is true whenever that lote key is present, even with a quantity of zero', () => {
      const item = makeItem({ loteSeleccion: { '3:1': 4, '5:1': 0 } });
      expect(component.isLoteChecked(item, { id_lote: 3, id_ubicacion: 1 })).toBe(true);
      expect(component.isLoteChecked(item, { id_lote: 5, id_ubicacion: 1 })).toBe(true);
      expect(component.isLoteChecked(item, { id_lote: 9, id_ubicacion: 1 })).toBe(false);
    });

    it('checking a single lote with enough stock auto-assigns the full "Cant. dispensada" quantity — no typing needed', () => {
      const item = makeItem({ cantidadDispensadaOverride: 5 });
      component.modalFormItems.set([item]);
      component.toggleLote(item, { id_lote: 3, id_ubicacion: 1, cantidad_disponible: 24 }, true);
      const updated = component.modalFormItems()[0];
      expect(updated.loteSeleccion['3:1']).toBe(5);
      expect(component.getAsignadoValido(updated)).toBe(true);
    });

    it('checking a lote that cannot cover the full quantity alone assigns only what it has available', () => {
      const item = makeItem({ cantidadDispensadaOverride: 10 });
      component.modalFormItems.set([item]);
      component.toggleLote(item, { id_lote: 3, id_ubicacion: 1, cantidad_disponible: 4 }, true);
      const updated = component.modalFormItems()[0];
      expect(updated.loteSeleccion['3:1']).toBe(4);
      expect(component.getAsignadoValido(updated)).toBe(false);
    });

    it('checking a second lote fills only the remaining gap left by the first', () => {
      const item = makeItem({ cantidadDispensadaOverride: 10, loteSeleccion: { '3:1': 4 } });
      component.modalFormItems.set([item]);
      component.toggleLote(item, { id_lote: 5, id_ubicacion: 1, cantidad_disponible: 20 }, true);
      const updated = component.modalFormItems()[0];
      expect(updated.loteSeleccion['3:1']).toBe(4);
      expect(updated.loteSeleccion['5:1']).toBe(6);
      expect(component.getAsignadoValido(updated)).toBe(true);
    });

    it('unchecking a lote removes its assigned quantity entirely', () => {
      const item = makeItem({ cantidadDispensadaOverride: 10, loteSeleccion: { '3:1': 4, '5:1': 6 } });
      component.modalFormItems.set([item]);
      component.toggleLote(item, { id_lote: 3, id_ubicacion: 1, cantidad_disponible: 4 }, false);
      const updated = component.modalFormItems()[0];
      expect(updated.loteSeleccion['3:1']).toBeUndefined();
      expect(updated.loteSeleccion['5:1']).toBe(6);
    });

    it('checking a second lote when the first already covers everything still marks it (at 0) so it can be edited by hand', () => {
      const item = makeItem({ cantidadDispensadaOverride: 5, loteSeleccion: { '3:1': 5 } });
      component.modalFormItems.set([item]);
      component.toggleLote(item, { id_lote: 5, id_ubicacion: 1, cantidad_disponible: 15 }, true);
      const updated = component.modalFormItems()[0];
      expect(component.isLoteChecked(updated, { id_lote: 5, id_ubicacion: 1 })).toBe(true);
      expect(updated.loteSeleccion['5:1']).toBe(0);
      expect(component.getLotesMarcados(updated)).toBe(2);
    });

    it('ignores "Control de entrega" when computing how much is left to cover — only "Cant. dispensada" matters', () => {
      const item = makeItem({ cantidad: 999, cantidadDispensadaOverride: 5 });
      component.modalFormItems.set([item]);
      component.toggleLote(item, { id_lote: 3, id_ubicacion: 1, cantidad_disponible: 24 }, true);
      const updated = component.modalFormItems()[0];
      expect(updated.loteSeleccion['3:1']).toBe(5);
    });
  });

  describe('getLotesMarcados', () => {
    it('counts every marked lote regardless of its assigned quantity', () => {
      expect(component.getLotesMarcados(makeItem({ loteSeleccion: {} }))).toBe(0);
      expect(component.getLotesMarcados(makeItem({ loteSeleccion: { '3:1': 4 } }))).toBe(1);
      expect(component.getLotesMarcados(makeItem({ loteSeleccion: { '3:1': 4, '5:1': 0 } }))).toBe(2);
    });
  });

  describe('hasItemsToDispense', () => {
    it('is false when the only item is missing its MX product link (nothing dispensable) even with contrato/régimen set', () => {
      component.modalFormItems.set([
        makeItem({ med: makeMed({ idProductoLocal: null, cantidad: 10 }), cantidadDispensadaOverride: 1 })
      ]);
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('a Sin MX item does NOT block the others — is true when another item with MX is ready', () => {
      const sinMx = makeItem({ med: makeMed({ idProductoLocal: null, cantidad: 600 }), cantidadDispensadaOverride: 0 });
      const conMx = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 10, control: null }),
        cantidadDispensadaOverride: 5,
        loteSeleccion: { '3:1': 5 }
      });
      component.modalFormItems.set([sinMx, conMx]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      expect(component.hasItemsToDispense()).toBe(true);
    });

    it('is false when every medicamento is already fully dispensed', () => {
      component.modalFormItems.set([
        makeItem({ med: makeMed({ cantidad: 10, control: { cantidad_dispensada: 10 } as any }), cantidadDispensadaOverride: 10 })
      ]);
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('is false when the only pending medicamento has zero stock available (nothing dispensable)', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 10, control: null });
      component.modalFormItems.set([makeItem({ med, cantidadDispensadaOverride: 5 })]);
      component.stockByMed.set({ 10: [] });
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('a med with MX but zero stock does NOT block the others — is true when another item has stock and is ready', () => {
      const sinStock = makeItem({ med: makeMed({ id_med_formulacion: 1, idProductoLocal: 20, cantidad: 600 }), cantidadDispensadaOverride: 0 });
      const conStock = makeItem({
        med: makeMed({ id_med_formulacion: 2, idProductoLocal: 10, cantidad: 10, control: null }),
        cantidadDispensadaOverride: 5,
        loteSeleccion: { '3:1': 5 }
      });
      component.modalFormItems.set([sinStock, conStock]);
      component.stockByMed.set({ 20: [], 10: [{ cantidad_disponible: 5 }] });
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      expect(component.hasItemsToDispense()).toBe(true);
    });

    it('a med whose stock is still loading does not block nor enable — is false while it is the only pending one', () => {
      const cargando = makeItem({ med: makeMed({ idProductoLocal: 30, cantidad: 10 }), cantidadDispensadaOverride: 0 });
      component.modalFormItems.set([cargando]);
      component.stockLoading.set(new Set([30]));
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('is false when there is a positive quantity but no lote has been assigned yet', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 10, control: null });
      component.modalFormItems.set([makeItem({ med, cantidadDispensadaOverride: 5 })]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('is true when there is a pending medicamento with stock, a positive "Cant. dispensada", a matching lote assignment, and contrato/régimen are set', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 10, control: null });
      component.modalFormItems.set([makeItem({ med, cantidadDispensadaOverride: 5, loteSeleccion: { '3:1': 5 } })]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      expect(component.hasItemsToDispense()).toBe(true);
    });

    it('is false when the pending item has stock but "Cant. dispensada" is zero (dejar pendiente)', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 10, control: null });
      component.modalFormItems.set([makeItem({ med, cantidadDispensadaOverride: 0 })]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('ignores "Control de entrega" — a positive value there alone must not enable dispensing', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 10, control: null });
      component.modalFormItems.set([makeItem({ med, cantidad: 30, cantidadDispensadaOverride: 0 })]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('is false when everything else is valid but contrato or régimen is missing', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 10, control: null });
      component.modalFormItems.set([makeItem({ med, cantidadDispensadaOverride: 5, loteSeleccion: { '3:1': 5 } })]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });
      component.modalContrato = '';
      component.modalRegimen = 'contributivo';
      expect(component.hasItemsToDispense()).toBe(false);
      component.modalContrato = 'contrato_1';
      component.modalRegimen = '';
      expect(component.hasItemsToDispense()).toBe(false);
    });
  });

  describe('getResumenLabel / getResumenClass (fila de la lista principal)', () => {
    it('labels a formulación with no control record as Pendiente', () => {
      const f = { control: null, total_medicamentos: 3 } as any;
      expect(component.getResumenLabel(f)).toBe('Pendiente');
      expect(component.getResumenClass(f)).toBe('warning');
    });

    it('labels a fully dispensed formulación as Dispensado', () => {
      const f = { control: { dispensados: 3, parciales: 0 }, total_medicamentos: 3 } as any;
      expect(component.getResumenLabel(f)).toBe('Dispensado');
      expect(component.getResumenClass(f)).toBe('success');
    });

    it('labels a partially dispensed formulación as Parcial', () => {
      const f = { control: { dispensados: 1, parciales: 1 }, total_medicamentos: 3 } as any;
      expect(component.getResumenLabel(f)).toBe('Parcial');
      expect(component.getResumenClass(f)).toBe('error');
    });
  });

  describe('pedirExclusion / cancelarExclusion / confirmarExclusion (eliminar un medicamento formulado)', () => {
    it('pedirExclusion does nothing while a previous exclusion is still in flight', () => {
      component.excluyendoMedId.set(5);
      component.pedirExclusion(makeMed({ id_med_formulacion: 1 }));
      expect(component.medAExcluir()).toBeNull();
    });

    it('pedirExclusion stores the medicamento pending confirmation', () => {
      const med = makeMed({ id_med_formulacion: 1 });
      component.pedirExclusion(med);
      expect(component.medAExcluir()).toBe(med);
    });

    it('cancelarExclusion clears the pending confirmation without calling the API', () => {
      component.medAExcluir.set(makeMed());
      component.cancelarExclusion();
      expect(component.medAExcluir()).toBeNull();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('confirmarExclusion does nothing without a medicamento pending confirmation', async () => {
      component.medAExcluir.set(null);
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      await component.confirmarExclusion();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('confirmarExclusion does nothing without a formulación selected', async () => {
      component.medAExcluir.set(makeMed());
      component.selectedDetail.set(null);
      await component.confirmarExclusion();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('posts the exclusion, reloads the detail and clears the confirmation state on success', async () => {
      const med = makeMed({ id_med_formulacion: 11, nombre_medicamento: 'ABACAVIR 300 MG' });
      component.medAExcluir.set(med);
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      (api.post as any).mockResolvedValue({});
      (api.get as any).mockResolvedValue({ data: { id_formulacion: 7, medicamentos: [] } });

      await component.confirmarExclusion();

      expect(api.post).toHaveBeenCalledWith(
        '/dispensacion-hs/formulacion/7/medicamentos/11/excluir',
        { nombre_medicamento: 'ABACAVIR 300 MG' }
      );
      expect(api.get).toHaveBeenCalledWith('/formulaciones-hs/7');
      expect(component.medAExcluir()).toBeNull();
      expect(component.excluyendoMedId()).toBeNull();
    });

    it('surfaces the backend error message and clears excluyendoMedId on failure', async () => {
      component.medAExcluir.set(makeMed({ id_med_formulacion: 11 }));
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      (api.post as any).mockRejectedValue({ error: { message: 'No autorizado' } });

      await component.confirmarExclusion();

      expect(component.error()).toBe('No autorizado');
      expect(component.excluyendoMedId()).toBeNull();
    });

    it('also removes the medicamento from modalFormItems when excluded from inside the dispensar modal', async () => {
      // El botón de eliminar ahora vive dentro del modal "Dispensar formulación"
      // (ya no en la tabla de fuera) — al confirmar la exclusión ahí, la fila
      // debe desaparecer del modal sin esperar a cerrarlo y reabrirlo.
      const med = makeMed({ id_med_formulacion: 11, nombre_medicamento: 'ABACAVIR 300 MG' });
      const otroMed = makeMed({ id_med_formulacion: 22, nombre_medicamento: 'CETIRIZINA 10 MG' });
      component.medAExcluir.set(med);
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.showModal.set(true);
      component.modalFormItems.set([makeItem({ med }), makeItem({ med: otroMed })]);
      (api.post as any).mockResolvedValue({});
      (api.get as any).mockResolvedValue({ data: { id_formulacion: 7, medicamentos: [] } });

      await component.confirmarExclusion();

      const remaining = component.modalFormItems();
      expect(remaining.length).toBe(1);
      expect(remaining[0].med.id_med_formulacion).toBe(22);
    });

    it('does not touch modalFormItems when the dispensar modal is closed', async () => {
      const med = makeMed({ id_med_formulacion: 11 });
      component.medAExcluir.set(med);
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.showModal.set(false);
      component.modalFormItems.set([makeItem({ med })]);
      (api.post as any).mockResolvedValue({});
      (api.get as any).mockResolvedValue({ data: { id_formulacion: 7, medicamentos: [] } });

      await component.confirmarExclusion();

      expect(component.modalFormItems().length).toBe(1);
    });
  });

  describe('abrirAgregarMedModal / seleccionarMedicamento / cambiarMedicamentoSeleccionado (agregar mx manual)', () => {
    it('resets the form, clears any previous selection and opens the modal', () => {
      component.nuevoMed = { presentacion: 'x', via_administracion: 'y', cantidad: 9 };
      component.medSeleccionado.set({ id_producto: 1 });
      component.medSearch = 'algo';
      component.agregarMedError.set('previo');

      component.abrirAgregarMedModal();

      expect(component.showAgregarMedModal()).toBe(true);
      expect(component.medSeleccionado()).toBeNull();
      expect(component.medSearch).toBe('');
      expect(component.nuevoMed).toEqual({ presentacion: '', via_administracion: '', cantidad: 1 });
      expect(component.agregarMedError()).toBe('');
    });

    it('selecting a product fills presentación/vía from its forma_farmacéutica and clears the search list', () => {
      component.medResults.set([{ id_producto: 1 }]);

      component.seleccionarMedicamento({ id_producto: 42, nombre_comercial: 'IBUPROFENO 400', forma_farmaceutica: 'Tableta' });

      expect(component.medSeleccionado()).toEqual({ id_producto: 42, nombre_comercial: 'IBUPROFENO 400', forma_farmaceutica: 'Tableta' });
      expect(component.nuevoMed.presentacion).toBe('Tableta');
      expect(component.nuevoMed.via_administracion).toBe('Oral');
      expect(component.medResults()).toEqual([]);
    });

    it('infers the presentación from the nombre_comercial when the product has no forma_farmacéutica linked', () => {
      component.seleccionarMedicamento({
        id_producto: 7,
        nombre_comercial: '(ALFA) RIFAXIMINA 550 mg TABLETA RECUBIERTA',
        forma_farmaceutica: null
      });
      expect(component.nuevoMed.presentacion).toBe('Tableta Recubierta');
      expect(component.nuevoMed.via_administracion).toBe('Oral');
    });

    it('suggests Parenteral for an injectable form, always as an editable starting point', () => {
      component.seleccionarMedicamento({
        id_producto: 8,
        nombre_comercial: 'ABATACEPT 250 MG POLVO PARA RECONSTITUIR A SOLUCION INYECTABLE',
        forma_farmaceutica: 'Solución inyectable'
      });
      expect(component.nuevoMed.via_administracion).toBe('Parenteral');
    });

    it('leaves vía empty when the form cannot be recognized', () => {
      component.seleccionarMedicamento({ id_producto: 9, nombre_comercial: 'PRODUCTO SIN FORMA RECONOCIBLE', forma_farmaceutica: null });
      expect(component.nuevoMed.via_administracion).toBe('');
    });

    it('cambiarMedicamentoSeleccionado clears the current selection so the search box reappears', () => {
      component.medSeleccionado.set({ id_producto: 1 });
      component.cambiarMedicamentoSeleccionado();
      expect(component.medSeleccionado()).toBeNull();
    });
  });

  describe('onMedSearchChange / searchMedicamento (buscador del Maestro)', () => {
    it('clears results immediately when the search box is emptied, without calling the API', () => {
      component.medResults.set([{ id_producto: 1 }]);
      component.onMedSearchChange('   ');
      expect(component.medResults()).toEqual([]);
      expect(api.get).not.toHaveBeenCalled();
    });

    it('queries /products with the typed term and keeps at most 20 results', async () => {
      component.medSearch = 'rifaximina';
      const many = Array.from({ length: 25 }, (_, i) => ({ id_producto: i }));
      (api.get as any).mockResolvedValue({ data: many });

      await component.searchMedicamento();

      expect(api.get).toHaveBeenCalledWith('/products?search=rifaximina');
      expect(component.medResults().length).toBe(20);
      expect(component.medNoResults()).toBe(false);
      expect(component.medSearching()).toBe(false);
    });

    it('flags medNoResults when nothing matches', async () => {
      component.medSearch = 'zzz';
      (api.get as any).mockResolvedValue({ data: [] });

      await component.searchMedicamento();

      expect(component.medNoResults()).toBe(true);
    });

    it('flags medNoResults and stops the spinner when the request fails', async () => {
      component.medSearch = 'zzz';
      (api.get as any).mockRejectedValue(new Error('network'));

      await component.searchMedicamento();

      expect(component.medNoResults()).toBe(true);
      expect(component.medSearching()).toBe(false);
    });
  });

  describe('confirmarAgregarMed', () => {
    it('requires a medicamento to be selected from the catalog before submitting', async () => {
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.medSeleccionado.set(null);

      await component.confirmarAgregarMed();

      expect(component.agregarMedError()).toBe('Debes seleccionar un medicamento del listado.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('requires a positive cantidad', async () => {
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.medSeleccionado.set({ id_producto: 42 });
      component.nuevoMed.cantidad = 0;

      await component.confirmarAgregarMed();

      expect(component.agregarMedError()).toBe('La cantidad debe ser mayor a cero.');
      expect(api.post).not.toHaveBeenCalled();
    });

    it("posts id_producto plus the form fields, then reloads the detail and closes the modal", async () => {
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.medSeleccionado.set({ id_producto: 42 });
      component.nuevoMed = { presentacion: 'Tableta', via_administracion: 'Oral', cantidad: 3 };
      component.showAgregarMedModal.set(true);
      (api.post as any).mockResolvedValue({});
      (api.get as any).mockResolvedValue({ data: { id_formulacion: 7, medicamentos: [] } });

      await component.confirmarAgregarMed();

      expect(api.post).toHaveBeenCalledWith('/dispensacion-hs/formulacion/7/medicamentos-extra', {
        id_producto: 42,
        presentacion: 'Tableta',
        via_administracion: 'Oral',
        cantidad: 3
      });
      expect(component.showAgregarMedModal()).toBe(false);
      expect(api.get).toHaveBeenCalledWith('/formulaciones-hs/7');
    });

    it('keeps the modal open and surfaces the backend error message on failure', async () => {
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.medSeleccionado.set({ id_producto: 42 });
      component.nuevoMed.cantidad = 1;
      component.showAgregarMedModal.set(true);
      (api.post as any).mockRejectedValue({ error: { message: 'El medicamento seleccionado no existe en el Maestro de productos.' } });

      await component.confirmarAgregarMed();

      expect(component.agregarMedError()).toBe('El medicamento seleccionado no existe en el Maestro de productos.');
      expect(component.showAgregarMedModal()).toBe(true);
      expect(component.agregarMedSaving()).toBe(false);
    });

    it('also appends the new medicamento to modalFormItems when added from inside the dispensar modal', async () => {
      // "Agregar medicamento" ahora también se puede abrir desde dentro del
      // modal "Dispensar formulación" — la fila nueva debe aparecer ahí sin
      // esperar a cerrar/reabrir el modal.
      const existente = makeMed({ id_med_formulacion: 1, nombre_medicamento: 'ABACAVIR 300 MG' });
      const nuevoDesdeBackend = makeMed({ id_med_formulacion: 900000001, nombre_medicamento: 'RIFAXIMINA 550 MG', esManual: true });
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.medSeleccionado.set({ id_producto: 42 });
      component.nuevoMed = { presentacion: 'Tableta', via_administracion: 'Oral', cantidad: 3 };
      component.showModal.set(true);
      component.modalFormItems.set([makeItem({ med: existente })]);
      (api.post as any).mockResolvedValue({});
      (api.get as any).mockResolvedValue({ data: { id_formulacion: 7, medicamentos: [existente, nuevoDesdeBackend] } });

      await component.confirmarAgregarMed();

      const items = component.modalFormItems();
      expect(items.length).toBe(2);
      expect(items[1].med.id_med_formulacion).toBe(900000001);
      expect(items[1].cantidad).toBe(0);
      expect(items[1].cantidadDispensadaOverride).toBe(0);
    });

    it('does not touch modalFormItems when the dispensar modal is closed', async () => {
      const existente = makeMed({ id_med_formulacion: 1 });
      const nuevo = makeMed({ id_med_formulacion: 900000001, esManual: true });
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.medSeleccionado.set({ id_producto: 42 });
      component.nuevoMed.cantidad = 1;
      component.showModal.set(false);
      component.modalFormItems.set([makeItem({ med: existente })]);
      (api.post as any).mockResolvedValue({});
      (api.get as any).mockResolvedValue({ data: { id_formulacion: 7, medicamentos: [existente, nuevo] } });

      await component.confirmarAgregarMed();

      expect(component.modalFormItems().length).toBe(1);
    });
  });

  describe('saveDispensacion — "Cantidad pendiente" del soporte de entrega', () => {
    it('is Control de entrega minus Cant. dispensada, never the global faltante of the whole formulación', async () => {
      // formulada = 100, Control de entrega (referencia de hoy) = 48, se
      // entregan 30 realmente. El faltante GLOBAL sería 100-30=70, pero el
      // soporte debe mostrar 48-30=18 (lo que quedó debiendo de HOY).
      const med = makeMed({ id_med_formulacion: 1, idProductoLocal: 10, cantidad: 100 });
      const item = makeItem({
        med,
        cantidad: 48,
        cantidadDispensadaOverride: 30,
        dispensadaOriginal: 0,
        loteSeleccion: { '3:1': 30 }
      });
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.modalFormItems.set([item]);
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      (api.post as any).mockResolvedValue({ data: { cantidad_dispensada: 30 } });

      await component.saveDispensacion();

      expect((component as any).soporteData.items[0].cantidad_pendiente).toBe(18);
    });

    it('is zero once Cant. dispensada covers all of Control de entrega, regardless of the global faltante', async () => {
      const med = makeMed({ id_med_formulacion: 1, idProductoLocal: 10, cantidad: 100 });
      const item = makeItem({
        med,
        cantidad: 30,
        cantidadDispensadaOverride: 30,
        dispensadaOriginal: 0,
        loteSeleccion: { '3:1': 30 }
      });
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.modalFormItems.set([item]);
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      (api.post as any).mockResolvedValue({ data: { cantidad_dispensada: 30 } });

      await component.saveDispensacion();

      expect((component as any).soporteData.items[0].cantidad_pendiente).toBe(0);
    });
  });

  describe('saveDispensacion — medicamentos "Sin MX" o sin stock no bloquean la entrega de los demás', () => {
    it('saves the dispensable item, registers the Sin MX one with cantidad_dispensada 0 for real DB traceability, and documents both in the soporte', async () => {
      const conMx = makeItem({
        med: makeMed({ id_med_formulacion: 1, idProductoLocal: 10, cantidad: 100 }),
        cantidad: 30, cantidadDispensadaOverride: 30, dispensadaOriginal: 0,
        loteSeleccion: { '3:1': 30 }
      });
      const sinMx = makeItem({
        med: makeMed({ id_med_formulacion: 2, idProductoLocal: null, nombre_medicamento: 'TIRAS DE GLUCOMETRIA', cantidad: 600 }),
        cantidad: 10, cantidadDispensadaOverride: 0, dispensadaOriginal: 0
      });
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.modalFormItems.set([conMx, sinMx]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 30 }] });
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      (api.post as any).mockResolvedValue({ data: { cantidad_dispensada: 30 } });

      await component.saveDispensacion();

      expect(api.post).toHaveBeenCalledTimes(2);
      expect(api.post).toHaveBeenCalledWith('/dispensacion-hs', expect.objectContaining({
        id_med_formulacion_hs: 2,
        cantidad_dispensada: 0
      }));
      expect(component.modalError()).toBe('');
      const data = (component as any).soporteData;
      expect(data.pendientesNuevos).toContainEqual(
        expect.objectContaining({ nombre_medicamento: 'TIRAS DE GLUCOMETRIA', cantidad_dispensada: 0, cantidad_pendiente: 10 })
      );
    });

    it('still documents the Sin MX item as pending even if the informational API call fails', async () => {
      const conMx = makeItem({
        med: makeMed({ id_med_formulacion: 1, idProductoLocal: 10, cantidad: 100 }),
        cantidad: 30, cantidadDispensadaOverride: 30, dispensadaOriginal: 0,
        loteSeleccion: { '3:1': 30 }
      });
      const sinMx = makeItem({
        med: makeMed({ id_med_formulacion: 2, idProductoLocal: null, nombre_medicamento: 'TIRAS DE GLUCOMETRIA', cantidad: 600 }),
        cantidad: 10, cantidadDispensadaOverride: 0, dispensadaOriginal: 0
      });
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.modalFormItems.set([conMx, sinMx]);
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      (api.post as any)
        .mockResolvedValueOnce({ data: { cantidad_dispensada: 30 } })
        .mockRejectedValueOnce(new Error('network error'));

      await component.saveDispensacion();

      expect(component.modalError()).toBe('');
      const data = (component as any).soporteData;
      expect(data.pendientesNuevos).toContainEqual(
        expect.objectContaining({ nombre_medicamento: 'TIRAS DE GLUCOMETRIA', cantidad_pendiente: 10 })
      );
    });

    it('registers a med with MX but zero stock the same way, with a "sin stock" observación', async () => {
      const conStock = makeItem({
        med: makeMed({ id_med_formulacion: 1, idProductoLocal: 10, cantidad: 100 }),
        cantidad: 30, cantidadDispensadaOverride: 30, dispensadaOriginal: 0,
        loteSeleccion: { '3:1': 30 }
      });
      const sinStock = makeItem({
        med: makeMed({ id_med_formulacion: 2, idProductoLocal: 20, nombre_medicamento: 'IRBESARTAN 300 MG', cantidad: 90 }),
        cantidad: 20, cantidadDispensadaOverride: 0, dispensadaOriginal: 0
      });
      component.selectedDetail.set({ id_formulacion: 7 } as any);
      component.modalFormItems.set([conStock, sinStock]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 30 }], 20: [] });
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      (api.post as any).mockResolvedValue({ data: { cantidad_dispensada: 30 } });

      await component.saveDispensacion();

      expect(api.post).toHaveBeenCalledWith('/dispensacion-hs', expect.objectContaining({
        id_med_formulacion_hs: 2,
        cantidad_dispensada: 0,
        observaciones: 'Sin stock disponible en inventario — queda pendiente.'
      }));
      const data = (component as any).soporteData;
      expect(data.pendientesNuevos).toContainEqual(
        expect.objectContaining({ nombre_medicamento: 'IRBESARTAN 300 MG', cantidad_dispensada: 0, cantidad_pendiente: 20 })
      );
    });
  });

  describe('getEstadoLabel / getEstadoClass (por medicamento)', () => {
    it('maps every known estado to its label and class', () => {
      expect(component.getEstadoLabel('pendiente')).toBe('Pendiente');
      expect(component.getEstadoLabel('dispensado')).toBe('Dispensado');
      expect(component.getEstadoLabel('parcial')).toBe('Parcial');
      expect(component.getEstadoLabel('cancelado')).toBe('Cancelado');
      expect(component.getEstadoClass('dispensado')).toBe('success');
      expect(component.getEstadoClass('cancelado')).toBe('error');
    });

    it('falls back to the raw value for an unknown estado', () => {
      expect(component.getEstadoLabel('rareza')).toBe('rareza');
      expect(component.getEstadoClass('rareza')).toBe('');
    });
  });
});
