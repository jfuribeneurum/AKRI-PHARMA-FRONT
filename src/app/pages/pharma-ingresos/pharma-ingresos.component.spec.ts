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
