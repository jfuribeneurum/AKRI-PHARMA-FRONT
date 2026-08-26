import { DispensacionSebasComponent } from './dispensacion-sebas.component';
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
    cantidad: 0,
    cantidadDispensadaOverride: 0,
    cantidadDispensadaTouched: false,
    dispensadaOriginal: 0,
    loteSeleccion: {},
    ...overrides
  };
}

describe('DispensacionSebasComponent', () => {
  let component: DispensacionSebasComponent;
  let api: ApiService;

  beforeEach(() => {
    api = makeApiStub();
    component = new DispensacionSebasComponent(api);
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

  describe('getPendiente (Control de entrega menos Cant. dispensada)', () => {
    it('equals "Control de entrega" minus the live "Cant. dispensada" override', () => {
      const item = makeItem({ med: makeMed({ cantidad: 24 }), cantidad: 10, cantidadDispensadaOverride: 4 });
      expect(component.getPendiente(item)).toBe(6);
    });

    it('ignores the formulated amount entirely — only Control de entrega and Cant. dispensada matter', () => {
      const item = makeItem({ med: makeMed({ cantidad: 100 }), cantidad: 10, cantidadDispensadaOverride: 3 });
      expect(component.getPendiente(item)).toBe(7);
    });

    it('drops to zero once the override reaches Control de entrega', () => {
      const item = makeItem({ med: makeMed({ cantidad: 24 }), cantidad: 5, cantidadDispensadaOverride: 5 });
      expect(component.getPendiente(item)).toBe(0);
    });

    it('clamps at zero instead of going negative', () => {
      const item = makeItem({ med: makeMed({ cantidad: 24 }), cantidad: 5, cantidadDispensadaOverride: 99 });
      expect(component.getPendiente(item)).toBe(0);
    });
  });

  describe('getFaltante (formulada menos histórico ya entregado menos Control de entrega)', () => {
    it('equals formulada minus what is being delivered right now when there is no history', () => {
      const item = makeItem({ med: makeMed({ cantidad: 90 }), cantidad: 15, dispensadaOriginal: 0 });
      expect(component.getFaltante(item)).toBe(75);
    });

    it('subtracts prior deliveries recorded before this modal session', () => {
      const item = makeItem({ med: makeMed({ cantidad: 3000 }), cantidad: 0, dispensadaOriginal: 2 });
      expect(component.getFaltante(item)).toBe(2998);
    });

    it('ignores "Cant. dispensada" entirely — typing there must not double-discount the delivery', () => {
      const item = makeItem({ med: makeMed({ cantidad: 3000 }), cantidad: 1, dispensadaOriginal: 0, cantidadDispensadaOverride: 1 });
      expect(component.getFaltante(item)).toBe(2999);
    });

    it('is zero when history plus the current delivery covers everything formulated', () => {
      const item = makeItem({ med: makeMed({ cantidad: 24 }), cantidad: 14, dispensadaOriginal: 10 });
      expect(component.getFaltante(item)).toBe(0);
    });

    it('clamps at zero instead of going negative', () => {
      const item = makeItem({ med: makeMed({ cantidad: 24 }), cantidad: 30, dispensadaOriginal: 0 });
      expect(component.getFaltante(item)).toBe(0);
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

  describe('updateControlDeEntrega ("Cant. dispensada" nunca se autocompleta, es 100% manual)', () => {
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
      expect(updated.cantidadDispensadaTouched).toBe(false);
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
      expect(updated.cantidadDispensadaTouched).toBe(true);
    });

    it('clamps Control de entrega to the lesser of pending and available stock', () => {
      const item = makeItem({
        med: makeMed({ idProductoLocal: 10, cantidad: 24, control: null }),
        dispensadaOriginal: 0
      });
      component.modalFormItems.set([item]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });

      component.updateControlDeEntrega(item, 999);

      const updated = component.modalFormItems()[0];
      expect(updated.cantidad).toBe(5);
      expect(updated.cantidadDispensadaOverride).toBe(0);
    });
  });

  describe('getFaltante reproduce el incidente real: 15 ya dispensadas + 1 ahora', () => {
    it('is 2984 regardless of what "Cant. dispensada" shows, since it ignores that field', () => {
      const item = makeItem({
        med: makeMed({ cantidad: 3000 }),
        dispensadaOriginal: 15,
        cantidad: 1,
        cantidadDispensadaOverride: 0
      });
      expect(component.getFaltante(item)).toBe(2984);
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

    it('getAsignadoValido is true only when the assigned total exactly matches "Control de entrega"', () => {
      const item = makeItem({ cantidad: 6, loteSeleccion: { '3:1': 4, '3:2': 2 } });
      expect(component.getAsignadoValido(item)).toBe(true);
      item.cantidad = 7;
      expect(component.getAsignadoValido(item)).toBe(false);
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

    it('checking a single lote with enough stock auto-assigns the full "Control de entrega" quantity — no typing needed', () => {
      const item = makeItem({ cantidad: 5 });
      component.modalFormItems.set([item]);
      component.toggleLote(item, { id_lote: 3, id_ubicacion: 1, cantidad_disponible: 24 }, true);
      const updated = component.modalFormItems()[0];
      expect(updated.loteSeleccion['3:1']).toBe(5);
      expect(component.getAsignadoValido(updated)).toBe(true);
    });

    it('checking a lote that cannot cover the full quantity alone assigns only what it has available', () => {
      const item = makeItem({ cantidad: 10 });
      component.modalFormItems.set([item]);
      component.toggleLote(item, { id_lote: 3, id_ubicacion: 1, cantidad_disponible: 4 }, true);
      const updated = component.modalFormItems()[0];
      expect(updated.loteSeleccion['3:1']).toBe(4);
      expect(component.getAsignadoValido(updated)).toBe(false);
    });

    it('checking a second lote fills only the remaining gap left by the first', () => {
      const item = makeItem({ cantidad: 10, loteSeleccion: { '3:1': 4 } });
      component.modalFormItems.set([item]);
      component.toggleLote(item, { id_lote: 5, id_ubicacion: 1, cantidad_disponible: 20 }, true);
      const updated = component.modalFormItems()[0];
      expect(updated.loteSeleccion['3:1']).toBe(4);
      expect(updated.loteSeleccion['5:1']).toBe(6);
      expect(component.getAsignadoValido(updated)).toBe(true);
    });

    it('unchecking a lote removes its assigned quantity entirely', () => {
      const item = makeItem({ cantidad: 10, loteSeleccion: { '3:1': 4, '5:1': 6 } });
      component.modalFormItems.set([item]);
      component.toggleLote(item, { id_lote: 3, id_ubicacion: 1, cantidad_disponible: 4 }, false);
      const updated = component.modalFormItems()[0];
      expect(updated.loteSeleccion['3:1']).toBeUndefined();
      expect(updated.loteSeleccion['5:1']).toBe(6);
    });

    it('checking a second lote when the first already covers everything still marks it (at 0) so it can be edited by hand', () => {
      const item = makeItem({ cantidad: 5, loteSeleccion: { '3:1': 5 } });
      component.modalFormItems.set([item]);
      component.toggleLote(item, { id_lote: 5, id_ubicacion: 1, cantidad_disponible: 15 }, true);
      const updated = component.modalFormItems()[0];
      expect(component.isLoteChecked(updated, { id_lote: 5, id_ubicacion: 1 })).toBe(true);
      expect(updated.loteSeleccion['5:1']).toBe(0);
      expect(component.getLotesMarcados(updated)).toBe(2);
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
    it('is false when any item is missing its MX product link', () => {
      component.modalFormItems.set([
        makeItem({ med: makeMed({ idProductoLocal: null }), cantidad: 1 })
      ]);
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('is false when every medicamento is already fully dispensed', () => {
      component.modalFormItems.set([
        makeItem({ med: makeMed({ cantidad: 10, control: { cantidad_dispensada: 10 } as any }), cantidad: 0, cantidadDispensadaOverride: 10 })
      ]);
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('is false when a pending medicamento has zero stock available', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 10, control: null });
      component.modalFormItems.set([makeItem({ med, cantidad: 5 })]);
      component.stockByMed.set({ 10: [] });
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('is false when there is a positive quantity but no lote has been assigned yet', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 10, control: null });
      component.modalFormItems.set([makeItem({ med, cantidad: 5 })]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('is true when there is a pending medicamento with stock, a positive quantity, a matching lote assignment, and contrato/régimen are set', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 10, control: null });
      component.modalFormItems.set([makeItem({ med, cantidad: 5, loteSeleccion: { '3:1': 5 } })]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      expect(component.hasItemsToDispense()).toBe(true);
    });

    it('is false when the pending item has stock but the chosen quantity is zero', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 10, control: null });
      component.modalFormItems.set([makeItem({ med, cantidad: 0 })]);
      component.stockByMed.set({ 10: [{ cantidad_disponible: 5 }] });
      component.modalContrato = 'contrato_1';
      component.modalRegimen = 'contributivo';
      expect(component.hasItemsToDispense()).toBe(false);
    });

    it('is false when everything else is valid but contrato or régimen is missing', () => {
      const med = makeMed({ idProductoLocal: 10, cantidad: 10, control: null });
      component.modalFormItems.set([makeItem({ med, cantidad: 5, loteSeleccion: { '3:1': 5 } })]);
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
