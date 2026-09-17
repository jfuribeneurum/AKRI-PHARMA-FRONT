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
        nombre: 'ABACAVIR 300 MG TABLETA',
        principioActivo: 'Abacavir',
        concentracion: '300 mg',
        atc: 'J05AF06',
        unidad_dosificacion: 'TAB',
        forma_farmaceutica: 'TABLETA RECUBIERTA',
        codigo_dci: '7544'
      });

      expect(component.form.id_medicamento_hs).toBe(1);
      expect(component.form.codigo_interno).toBe('MX01');
      expect(component.form.nombre_comercial).toBe('ABACAVIR 300 MG TABLETA');
      expect(component.form.principio_activo).toBe('Abacavir');
      expect(component.form.concentracion).toBe('300 mg');
      expect(component.form.atc).toBe('J05AF06');
      expect(component.form.unidad_medida).toBe('TAB');
      expect(component.form.codigo_dci).toBe('7544');
    });

    it('prefills nombre_comercial with the full HealthSphere description (med.nombre)', () => {
      component.selectHsMed({ id: 1, forma_farmaceutica: null, nombre: 'TELMISARTAN 80 MG + AMLODIPINO 10 MG TABLETA' });
      expect(component.form.nombre_comercial).toBe('TELMISARTAN 80 MG + AMLODIPINO 10 MG TABLETA');
    });

    it('falls back to nombreComercial when HS has no full "medicamento" description', () => {
      component.selectHsMed({ id: 1, forma_farmaceutica: null, nombreComercial: 'MARCA HS' });
      expect(component.form.nombre_comercial).toBe('MARCA HS');
    });

    it('overwrites whatever was previously typed when a new HS medicamento is selected', () => {
      component.form.nombre_comercial = 'Texto anterior';
      component.selectHsMed({ id: 1, forma_farmaceutica: null, nombre: 'NUEVO MEDICAMENTO SELECCIONADO' });
      expect(component.form.nombre_comercial).toBe('NUEVO MEDICAMENTO SELECCIONADO');
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

  // BUG REAL: <option [value]="lab.id_laboratorio"> / <option [value]="f.id_forma">
  // (en vez de [ngValue]) hacía que, tras elegir una opción en el <select>,
  // form.id_laboratorio/form.id_forma quedaran como STRING (el atributo DOM
  // siempre es texto), no number. El backend exige z.number().int() para
  // ambos campos y rechazaba el guardado con "Validación fallida" sin
  // detalle visible. Se corrigió el HTML a [ngValue] y, como refuerzo, el
  // payload ahora coerciona explícitamente a Number.
  describe('create — payload envía id_laboratorio/id_forma como number, nunca string', () => {
    let api: ApiService;

    beforeEach(() => {
      api = makeApiStub();
      component = new MaestroMxComponent(api);
      component.form = {
        codigo_interno: 'MX01', nombre_comercial: 'ABACAVIR 300 MG',
        cum: '12', id_laboratorio: '3', id_forma: '2'
      };
      (api.post as any).mockResolvedValue({ data: { id_producto: 1 } });
      (component as any).load = vi.fn();
    });

    it('convierte id_laboratorio y id_forma a number aunque vengan como string del <select>', async () => {
      await component.create();

      const [, payload] = (api.post as any).mock.calls[0];
      expect(payload.id_laboratorio).toBe(3);
      expect(typeof payload.id_laboratorio).toBe('number');
      expect(payload.id_forma).toBe(2);
      expect(typeof payload.id_forma).toBe('number');
    });

    it('manda null (no string vacío) cuando id_laboratorio/id_forma no se seleccionaron', async () => {
      component.form.id_laboratorio = null;
      component.form.id_forma = null;

      await component.create();

      const [, payload] = (api.post as any).mock.calls[0];
      expect(payload.id_laboratorio).toBeNull();
      expect(payload.id_forma).toBeNull();
    });
  });

  describe('create — errores de validación muestran el campo específico que falló', () => {
    it('agrega los fieldErrors del backend al mensaje, no solo "Validación fallida"', async () => {
      const api = makeApiStub();
      component = new MaestroMxComponent(api);
      component.form = { codigo_interno: 'MX01', nombre_comercial: 'ABACAVIR 300 MG' };
      (api.post as any).mockRejectedValue({
        error: {
          message: 'Validación fallida',
          details: { fieldErrors: { id_laboratorio: ['Expected number, received string'] } }
        }
      });

      await component.create();

      expect(component.formError()).toBe('Validación fallida — id_laboratorio: Expected number, received string');
    });

    it('cae al mensaje genérico cuando el backend no manda fieldErrors', async () => {
      const api = makeApiStub();
      component = new MaestroMxComponent(api);
      component.form = { codigo_interno: 'MX01', nombre_comercial: 'ABACAVIR 300 MG' };
      (api.post as any).mockRejectedValue({ error: { message: 'SKU duplicado' } });

      await component.create();

      expect(component.formError()).toBe('SKU duplicado');
    });
  });

  // El buscador de Maestro MX antes solo buscaba con Enter — el usuario pidió
  // que busque mientras se escribe, como el resto de buscadores con debounce
  // de la app (ver onHsSearchChange). onSearchChange() debe reiniciar el
  // temporizador en cada tecla y solo disparar load() una vez, tras la pausa.
  // A petición del usuario: al guardar o editar un MX, correcta o
  // incorrectamente, debe aparecer un aviso imposible de pasar por alto.
  // Primero se hizo con alert() nativo, pero el usuario pidió que se viera
  // "más bonito" — resultModal() es el modal propio de la app (mismo estilo
  // que el resto de modales) que reemplaza al alert() feo del navegador.
  describe('resultModal al guardar/editar (create, update, save)', () => {
    it('save() muestra el modal de error de validación y no llega a llamar a create()/update()', async () => {
      const api = makeApiStub();
      component = new MaestroMxComponent(api);
      component.form = {}; // sin tipo_producto -> falla validateForm()

      await component.save();

      expect(component.resultModal()).toEqual({ tipo: 'error', mensaje: 'El campo Tipo de producto es obligatorio.' });
      expect(api.post).not.toHaveBeenCalled();
    });

    it('create() exitoso muestra el modal de éxito', async () => {
      const api = makeApiStub();
      component = new MaestroMxComponent(api);
      component.form = { codigo_interno: 'MX01', nombre_comercial: 'ABACAVIR 300 MG' };
      (api.post as any).mockResolvedValue({ data: { id_producto: 1 } });
      (component as any).load = vi.fn();

      await component.create();

      expect(component.resultModal()).toEqual({ tipo: 'success', mensaje: 'Producto registrado correctamente.' });
    });

    it('create() fallido muestra el modal de error con el mensaje del backend', async () => {
      const api = makeApiStub();
      component = new MaestroMxComponent(api);
      component.form = { codigo_interno: 'MX01', nombre_comercial: 'ABACAVIR 300 MG' };
      (api.post as any).mockRejectedValue({ error: { message: 'SKU duplicado' } });

      await component.create();

      expect(component.resultModal()).toEqual({ tipo: 'error', mensaje: 'SKU duplicado' });
    });

    it('update() exitoso muestra el modal de éxito', async () => {
      const api = makeApiStub();
      component = new MaestroMxComponent(api);
      component.editingId.set(7);
      component.form = { codigo_interno: 'MX01', nombre_comercial: 'ABACAVIR 300 MG' };
      (api.put as any).mockResolvedValue({});
      (component as any).load = vi.fn();

      await component.update();

      expect(component.resultModal()).toEqual({ tipo: 'success', mensaje: 'Producto actualizado correctamente.' });
    });

    it('update() fallido muestra el modal de error con el mensaje del backend', async () => {
      const api = makeApiStub();
      component = new MaestroMxComponent(api);
      component.editingId.set(7);
      component.form = { codigo_interno: 'MX01', nombre_comercial: 'ABACAVIR 300 MG' };
      (api.put as any).mockRejectedValue({ error: { message: 'No autorizado' } });

      await component.update();

      expect(component.resultModal()).toEqual({ tipo: 'error', mensaje: 'No autorizado' });
    });

    it('cerrarResultado() limpia el modal', () => {
      component.resultModal.set({ tipo: 'success', mensaje: 'x' });
      component.cerrarResultado();
      expect(component.resultModal()).toBeNull();
    });
  });

  describe('onSearchChange (buscador con debounce)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('no llama a load() inmediatamente al escribir', () => {
      const api = makeApiStub();
      component = new MaestroMxComponent(api);
      component.search = 'abacavir';

      component.onSearchChange();

      expect(api.get).not.toHaveBeenCalled();
    });

    it('llama a load() después de la pausa de 300ms', () => {
      const api = makeApiStub();
      (api.get as any).mockResolvedValue({ data: [] });
      component = new MaestroMxComponent(api);
      component.search = 'abacavir';

      component.onSearchChange();
      vi.advanceTimersByTime(300);

      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('search=abacavir'));
    });

    it('reinicia el temporizador en cada tecla, sin disparar load() varias veces', () => {
      const api = makeApiStub();
      (api.get as any).mockResolvedValue({ data: [] });
      component = new MaestroMxComponent(api);

      component.search = 'a';
      component.onSearchChange();
      vi.advanceTimersByTime(150);
      component.search = 'ab';
      component.onSearchChange();
      vi.advanceTimersByTime(150);
      component.search = 'aba';
      component.onSearchChange();
      vi.advanceTimersByTime(300);

      expect(api.get).toHaveBeenCalledTimes(1);
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('search=aba'));
    });
  });
});
