import { PharmaIngresosComponent } from './pharma-ingresos.component';
import { ApiService } from '../../core/api.service';
import { ChangeDetectorRef } from '@angular/core';
import { SiteContextService } from '../../core/site-context.service';

// El acta de recepción técnica (buildActaRecepcionHtml) se recortó varias
// veces en la misma sesión a pedido del usuario: se le quitó el marco
// normativo, Estado del ingreso, Bodega/Almacén, CUFE, Contacto, los
// contadores de verificación técnica y varias filas de totales. Estas
// pruebas fijan ese contrato para que un cambio futuro no los reintroduzca
// por accidente ni borre lo que sí debe seguir apareciendo.
function makeApiStub(): ApiService {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as ApiService;
}

function makeIngreso(overrides: Partial<any> = {}): any {
  return {
    id_ingreso: 42,
    referencia: 'ING-042',
    numero_orden_compra: 'OC-100',
    fecha_recepcion: '2026-08-20',
    fecha_ingreso: '2026-08-20',
    sede: 'Sede Norte',
    bodega: 'Bodega Central',
    prefijo_factura: 'FE',
    numero_factura: '1001',
    cufe: 'abc-123-cufe',
    estado: 'cancelado',
    proveedor_nombre: 'Distribuidora ACME',
    proveedor_nit: '900123456-7',
    proveedor_contacto: 'Juan Pérez',
    proveedor_telefono: '3001234567',
    proveedor_direccion: 'Calle 1 # 2-3',
    items: [
      {
        codigo: 'SKU-1', nombre: 'IBUPROFENO 400MG', laboratorio: 'Genfar', lote: 'L1',
        fecha_vencimiento: '2027-01-01', cantidad: 10, registro_invima: 'INV-1', cum: 'CUM-1',
        consecutivo_cum: '01', presentacion: 'Tableta', temperatura: 'Ambiente', cumple: 1
      }
    ],
    observaciones: 'Sin novedad',
    total_bruto: 100,
    total_descuento: 10,
    subtotal_neto: 90,
    total_iva: 17.1,
    total_ingreso: 107.1,
    creado_por_nombre: 'María Gómez',
    ...overrides
  };
}

describe('PharmaIngresosComponent — acta de recepción técnica (PDF)', () => {
  let component: PharmaIngresosComponent;
  let html: string;

  beforeEach(() => {
    component = new PharmaIngresosComponent(
      makeApiStub(),
      {} as unknown as ChangeDetectorRef,
      {} as unknown as SiteContextService
    );
    html = (component as any).buildActaRecepcionHtml(makeIngreso());
  });

  it('no incluye el marco normativo aplicable', () => {
    expect(html).not.toContain('Marco normativo aplicable');
    expect(html).not.toContain('Resolución 1403 de 2007');
  });

  it('no incluye Estado del ingreso, Bodega/Almacén ni CUFE', () => {
    expect(html).not.toContain('Estado del ingreso');
    expect(html).not.toContain('Bodega / Almacén');
    expect(html).not.toContain('CUFE');
  });

  it('no incluye el campo Contacto del proveedor', () => {
    expect(html).not.toContain('Contacto :');
  });

  it('no incluye los contadores de verificación técnica (Productos/Cumplen/No cumplen/Sin validar)', () => {
    expect(html).not.toContain('resumen-verificacion');
    expect(html).not.toContain('<span>Cumplen</span>');
    expect(html).not.toContain('<span>Sin validar</span>');
  });

  it('no incluye Total Items, Total Descuento ni Sub-Total', () => {
    expect(html).not.toContain('Total Items:');
    expect(html).not.toContain('Total Descuento:');
    expect(html).not.toContain('Sub-Total:');
  });

  it('sigue incluyendo Sede, N° Factura, IVA y el total recibido', () => {
    expect(html).toContain('Sede Norte');
    expect(html).toContain('FE1001');
    expect(html).toContain('IVA:');
    expect(html).toContain('TOTAL RECIBIDO:');
  });

  it('sigue advirtiendo cuando algún ítem quedó como NO CUMPLE', () => {
    const htmlConNoCumple = (component as any).buildActaRecepcionHtml(
      makeIngreso({ items: [{ nombre: 'X', cantidad: 1, cumple: 0 }] })
    );
    expect(htmlConNoCumple).toContain('NO CUMPLE');
    expect(htmlConNoCumple).toContain('gestionarse conforme al procedimiento de rechazo');
  });
});

// Cubre el pedido del usuario: al agregar/quitar MX en un ingreso con OC
// precargada, ¿el guardado (POST /ingresos) refleja exactamente lo que quedó
// en pantalla? El payload se reconstruye desde this.ocItems en el momento de
// guardar (ingresoConOrdenPayload), así que un producto quitado nunca debe
// viajar al backend y uno agregado siempre debe viajar, sin depender de lo
// que la OC original traía.
function makeOcItem(overrides: Partial<any> = {}): any {
  return {
    id_producto: 0, product_key: '', productoFiltro: '',
    codigo: '', nombre: '', laboratorio: '', cantidad: 0, valor_unitario: 0,
    lote: '', fecha_vencimiento: '',
    _showMed: false,
    registro_invima: '', cum: '', consecutivo_cum: '',
    presentacion: '', iva: 0, temperatura: '', cumple: null as (boolean | null),
    descuento_pct: 0, descuento_valor: 0,
    ...overrides
  };
}

describe('PharmaIngresosComponent — agregar/quitar MX en ingreso con orden de compra', () => {
  let component: PharmaIngresosComponent;
  let api: ApiService;

  beforeEach(() => {
    api = makeApiStub();
    component = new PharmaIngresosComponent(
      api,
      {} as unknown as ChangeDetectorRef,
      { activeAlmacenId: () => 6 } as unknown as SiteContextService
    );
    (component as any).ocMeta = {
      consecutivo: 'ING-001', numero_oc: 'OC-0001', fecha: '2026-09-17',
      id_sede: 1, id_almacen: 6, sede: 'Sede Test', bodega: 'Bodega Test',
      direccion_sede: '', ciudad_sede: '',
      id_proveedor: 10, proveedor_nombre: 'Distribuidora Prueba', proveedor_nit: '900111222',
      proveedor_contacto: '', proveedor_telefono: '', proveedor_direccion: ''
    };
    (component as any).ingresoExtra = {
      prefijo_factura: 'FV', numero_factura: 1, fecha_factura: '2026-09-17',
      cufe: '', fecha_recepcion: '2026-09-17', observaciones: ''
    };
    // Simula lo que precargarDesdeOrden() dejaría en pantalla: 2 items
    // que vinieron de la OC original, y la fotografía que precargarDesdeOrden()
    // toma de esos mismos códigos antes de que el usuario edite nada.
    component.ocItems = [
      makeOcItem({ codigo: 'MX1', nombre: 'ACETAMINOFEN 500MG', laboratorio: 'GENFAR', cantidad: 10, valor_unitario: 20000, cumple: true }),
      makeOcItem({ codigo: 'MX2', nombre: 'IBUPROFENO 400MG', laboratorio: 'PROCAPS', cantidad: 5, valor_unitario: 15000, cumple: true }),
    ];
    (component as any).ocItemsOriginales = ['MX1', 'MX2'];
  });

  it('agregarItem() agrega una fila nueva y vacía al final, sin tocar las existentes', () => {
    component.agregarItem();
    expect(component.ocItems.length).toBe(3);
    expect(component.ocItems[2].codigo).toBe('');
    expect(component.ocItems[0].codigo).toBe('MX1');
    expect(component.ocItems[1].codigo).toBe('MX2');
  });

  it('removeItem() quita exactamente la fila indicada y deja las demás intactas', () => {
    component.removeItem(0);
    expect(component.ocItems.length).toBe(1);
    expect(component.ocItems[0].codigo).toBe('MX2');
  });

  it('removeItem() no deja la lista de detalle vacía (protege el mínimo de 1 fila)', () => {
    component.removeItem(0);
    component.removeItem(0);
    expect(component.ocItems.length).toBe(1);
  });

  it('el payload de guardado excluye un producto quitado', () => {
    component.removeItem(0); // quita MX1, queda solo MX2
    const payload = (component as any).ingresoConOrdenPayload();
    expect(payload.items.length).toBe(1);
    expect(payload.items[0].codigo).toBe('MX2');
    expect(payload.items.some((i: any) => i.codigo === 'MX1')).toBe(false);
  });

  it('el payload de guardado incluye un producto agregado que no venía en la OC', () => {
    component.agregarItem();
    Object.assign(component.ocItems[2], {
      codigo: 'MX3', nombre: 'LORATADINA 10MG', laboratorio: 'TECNOQUIMICAS',
      cantidad: 8, valor_unitario: 9000, cumple: true
    });
    const payload = (component as any).ingresoConOrdenPayload();
    expect(payload.items.length).toBe(3);
    expect(payload.items.find((i: any) => i.codigo === 'MX3')).toEqual(
      expect.objectContaining({ codigo: 'MX3', nombre: 'LORATADINA 10MG', cantidad: 8, valor_unitario: 9000 })
    );
  });

  it('crearIngreso() envía al backend exactamente el detalle tras quitar uno y agregar otro (trazabilidad del guardado real)', async () => {
    component.removeItem(0); // quita MX1
    component.agregarItem();
    Object.assign(component.ocItems[1], {
      codigo: 'MX3', nombre: 'LORATADINA 10MG', laboratorio: 'TECNOQUIMICAS',
      cantidad: 8, valor_unitario: 9000, cumple: true
    });
    (api.post as any).mockResolvedValue({});

    await component.crearIngreso();

    expect(api.post).toHaveBeenCalledTimes(1);
    const [endpoint, payload] = (api.post as any).mock.calls[0];
    expect(endpoint).toBe('/ingresos');
    expect(payload.items.length).toBe(2);
    expect(payload.items.some((i: any) => i.codigo === 'MX1')).toBe(false); // el quitado nunca viaja
    expect(payload.items.some((i: any) => i.codigo === 'MX2')).toBe(true); // el que se mantuvo sí viaja
    expect(payload.items.some((i: any) => i.codigo === 'MX3')).toBe(true); // el agregado sí viaja
    // El backend liga el ingreso a la OC vía numero_orden_compra — con eso
    // basta para poder comparar después qué pidió la OC vs qué se recibió.
    expect(payload.numero_orden_compra).toBe('OC-0001');
    // Y además el payload ya trae la diferencia calculada explícitamente,
    // para que quede en la traza sin tener que comparar tablas a mano.
    expect(payload.productos_agregados).toEqual(['MX3']);
    expect(payload.productos_quitados).toEqual(['MX1']);
  });

  it('el payload no marca cambios cuando el detalle final es igual al de la OC original', () => {
    // No se toca nada: mismos 2 items que trajo la OC.
    const payload = (component as any).ingresoConOrdenPayload();
    expect(payload.productos_agregados).toEqual([]);
    expect(payload.productos_quitados).toEqual([]);
  });

  it('crearIngreso() no guarda nada si falta diligenciar el cumplimiento de un producto agregado', async () => {
    component.agregarItem();
    Object.assign(component.ocItems[2], {
      codigo: 'MX4', nombre: 'DICLOFENACO 50MG', cantidad: 3, valor_unitario: 5000
      // cumple queda null a propósito
    });
    (api.post as any).mockResolvedValue({});

    await component.crearIngreso();

    expect(api.post).not.toHaveBeenCalled();
    expect(component.error()).toContain('cumplimiento');
  });
});
