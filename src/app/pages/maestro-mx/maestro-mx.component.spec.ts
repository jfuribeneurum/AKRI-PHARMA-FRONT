import { MaestroMxComponent } from './maestro-mx.component';
import { ApiService } from '../../core/api.service';

// selectHsMed()'s forma-farmacéutica matching (matchForma) had a real bug
// this session: a bare HS text like "TABLETA" could resolve to a longer,
// wrong local form (e.g. "Tableta de liberación prolongada") depending on
// array order or a naive "longest match wins" heuristic. These tests lock
// in the fixed behavior: exact match always wins; otherwise the closest
// (not merely longest) partial match is used.
function makeApiStub(): ApiService {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as ApiService;
}

describe('MaestroMxComponent', () => {
  let component: MaestroMxComponent;

  beforeEach(() => {
    component = new MaestroMxComponent(makeApiStub());
    component.form = {};
    component.formas.set([
      { id_forma: 1, nombre: 'Tableta' },
      { id_forma: 2, nombre: 'Tableta recubierta' },
      { id_forma: 3, nombre: 'Tableta de liberación prolongada' },
      { id_forma: 4, nombre: 'Cápsula' },
      { id_forma: 5, nombre: 'Suspensión inyectable' },
      { id_forma: 6, nombre: 'Solución oral' }
    ]);
  });

  describe('selectHsMed', () => {
    it('copies principio activo, concentración, ATC, unidad de medida and DCI from the HS result', () => {
      component.selectHsMed({
        id: 1,
        codigo: 'MX01',
        principioActivo: 'Abacavir',
        concentracion: '300 mg',
        atc: 'J05AF06',
        unidad_dosificacion: 'TAB',
        forma_farmaceutica: 'TABLETA RECUBIERTA',
        codigo_dci: '7544'
      });

      expect(component.form.id_medicamento_hs).toBe(1);
      expect(component.form.codigo_interno).toBe('MX01');
      expect(component.form.principio_activo).toBe('Abacavir');
      expect(component.form.concentracion).toBe('300 mg');
      expect(component.form.atc).toBe('J05AF06');
      expect(component.form.unidad_medida).toBe('TAB');
      expect(component.form.codigo_dci).toBe('7544');
    });

    it('does not touch nombre_comercial (the user types it manually)', () => {
      component.form.nombre_comercial = 'Ya escrito por el usuario';
      component.selectHsMed({ id: 1, forma_farmaceutica: null });
      expect(component.form.nombre_comercial).toBe('Ya escrito por el usuario');
    });

    it('resolves an exact forma match regardless of other longer candidates', () => {
      component.selectHsMed({ id: 1, forma_farmaceutica: 'TABLETA' });
      expect(component.form.id_forma).toBe(1); // "Tableta", not the longer "Tableta de liberación prolongada"
    });

    it('resolves an exact match case- and accent-insensitively', () => {
      component.selectHsMed({ id: 1, forma_farmaceutica: 'tableta recubierta' });
      expect(component.form.id_forma).toBe(2);
    });

    it('picks the closest partial match when there is no exact one', () => {
      component.selectHsMed({ id: 1, forma_farmaceutica: 'POLVO PARA RECONSTITUIR A SUSPENSION INYECTABLE' });
      expect(component.form.id_forma).toBe(5); // only "Suspensión inyectable" is a substring match
    });

    it('leaves id_forma null when nothing in the local catalog matches', () => {
      component.selectHsMed({ id: 1, forma_farmaceutica: 'UNGÜENTO OFTÁLMICO' });
      expect(component.form.id_forma).toBeNull();
    });

    it('leaves id_forma null when HealthSphere has no forma_farmaceutica at all', () => {
      component.selectHsMed({ id: 1, forma_farmaceutica: null });
      expect(component.form.id_forma).toBeNull();
    });
  });

  describe('clearHsMed', () => {
    it('resets the HS-linked fields but leaves other form fields untouched', () => {
      component.form = {
        id_medicamento_hs: 1,
        nombre_comercial: 'Abacavir Genfar',
        principio_activo: 'Abacavir',
        concentracion: '300 mg',
        atc: 'J05AF06',
        id_forma: 2,
        codigo_dci: '7544',
        codigo_interno: 'MX01'
      };

      component.clearHsMed();

      expect(component.form.id_medicamento_hs).toBeNull();
      expect(component.form.nombre_comercial).toBe('');
      expect(component.form.principio_activo).toBe('');
      expect(component.form.concentracion).toBe('');
      expect(component.form.atc).toBe('');
      expect(component.form.id_forma).toBeNull();
      expect(component.form.codigo_dci).toBe('');
      expect(component.form.codigo_interno).toBe('MX01'); // no lo toca
    });
  });
});
