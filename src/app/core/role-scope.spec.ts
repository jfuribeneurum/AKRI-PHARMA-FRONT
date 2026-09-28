import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { isPathAllowed, isReportVisible, reportFormatsFor, roleScopeGuard } from './role-scope';

describe('role-scope', () => {
  describe('reportFormatsFor', () => {
    it('INFORMES solo descarga RIPS en CSV', () => {
      expect(reportFormatsFor('INFORMES', 'rips', ['excel', 'csv'])).toEqual(['csv']);
    });

    it('ADMINISTRADOR conserva Excel y CSV', () => {
      expect(reportFormatsFor('ADMINISTRADOR', 'rips', ['excel', 'csv'])).toEqual(['excel', 'csv']);
    });
  });

  describe('isReportVisible', () => {
    it('INFORMES no ve Dispensación pero sí RIPS', () => {
      expect(isReportVisible('INFORMES', 'dispensacion')).toBe(false);
      expect(isReportVisible('INFORMES', 'rips')).toBe(true);
    });

    it('ADMINISTRADOR y sin rol ven todo', () => {
      expect(isReportVisible('ADMINISTRADOR', 'dispensacion')).toBe(true);
      expect(isReportVisible(null, 'dispensacion')).toBe(true);
    });
  });

  describe('isPathAllowed', () => {
    it('INFORMES solo puede entrar a /informes', () => {
      expect(isPathAllowed('INFORMES', '/informes')).toBe(true);
      expect(isPathAllowed('INFORMES', '/informes?x=1')).toBe(true);
      expect(isPathAllowed('INFORMES', '/dashboard')).toBe(false);
      expect(isPathAllowed('INFORMES', '/dispensing-pharma')).toBe(false);
      expect(isPathAllowed('INFORMES', '/admin')).toBe(false);
      expect(isPathAllowed('INFORMES', '/informesx')).toBe(false);
    });

    it('roles no listados (ej. ADMINISTRADOR) no se limitan', () => {
      expect(isPathAllowed('ADMINISTRADOR', '/admin')).toBe(true);
      expect(isPathAllowed(null, '/dashboard')).toBe(true);
    });
  });

  describe('roleScopeGuard', () => {
    const redirect = {} as UrlTree;
    const router = { createUrlTree: vi.fn(() => redirect) };

    beforeEach(() => {
      router.createUrlTree.mockClear();
      TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });
    });
    afterEach(() => localStorage.removeItem('akri_user'));

    function run(role: string, url: string) {
      localStorage.setItem('akri_user', JSON.stringify({ role }));
      return TestBed.runInInjectionContext(() => roleScopeGuard({} as any, { url } as any));
    }

    it('redirige a /informes cuando INFORMES intenta abrir otra pantalla', () => {
      expect(run('INFORMES', '/dashboard')).toBe(redirect);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/informes']);
    });

    it('deja entrar a INFORMES a /informes', () => {
      expect(run('INFORMES', '/informes')).toBe(true);
    });

    it('no limita a ADMINISTRADOR', () => {
      expect(run('ADMINISTRADOR', '/admin')).toBe(true);
    });
  });
});
