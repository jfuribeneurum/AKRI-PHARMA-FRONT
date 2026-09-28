import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

// Roles limitados a ciertas pantallas. Un rol que no está aquí (ej.
// ADMINISTRADOR) ve todo. Debe mantenerse alineado con ROLE_API_SCOPES en el
// backend (src/middleware/role-scope.js), que es quien realmente bloquea.
export const ROLE_ALLOWED_PATHS: Record<string, string[]> = {
  INFORMES: ['/informes']
};

// Informes (por key de la página /informes) que un rol no ve. El backend los
// bloquea con ROLE_API_DENY (src/middleware/role-scope.js).
export const ROLE_HIDDEN_REPORTS: Record<string, string[]> = {
  INFORMES: ['dispensacion']
};

export function isReportVisible(role: string | null | undefined, key: string): boolean {
  return !(role && ROLE_HIDDEN_REPORTS[role]?.includes(key));
}

// Formatos de descarga que un rol puede usar por informe (key de /informes).
// Si el informe no aparece aquí, el rol usa los formatos normales del informe.
// El backend lo exige con ROLE_API_FORMATS.
export const ROLE_REPORT_FORMATS: Record<string, Record<string, ('excel' | 'csv')[]>> = {
  INFORMES: { rips: ['csv'] }
};

export function reportFormatsFor<F extends string>(role: string | null | undefined, key: string, formatos: F[]): F[] {
  const permitidos = role ? ROLE_REPORT_FORMATS[role]?.[key] : undefined;
  return permitidos ? formatos.filter(f => (permitidos as string[]).includes(f)) : formatos;
}

export function allowedPathsFor(role: string | null | undefined): string[] | null {
  return (role && ROLE_ALLOWED_PATHS[role]) || null;
}

export function isPathAllowed(role: string | null | undefined, url: string): boolean {
  const allowed = allowedPathsFor(role);
  if (!allowed) return true;
  const path = url.split(/[?#]/)[0];
  return allowed.some(p => path === p || path.startsWith(`${p}/`));
}

export function currentRole(): string | null {
  try {
    return JSON.parse(localStorage.getItem('akri_user') ?? 'null')?.role ?? null;
  } catch {
    return null;
  }
}

export const roleScopeGuard: CanActivateChildFn = (_route, state) => {
  const role = currentRole();
  if (isPathAllowed(role, state.url)) return true;
  return inject(Router).createUrlTree([allowedPathsFor(role)![0]]);
};
