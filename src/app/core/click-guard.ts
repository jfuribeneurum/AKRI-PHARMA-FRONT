import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';

// Evita el doble clic en toda la app: un botón clicado queda bloqueado hasta
// que terminen las peticiones que modifican datos (POST/PUT/PATCH/DELETE) que
// disparó, con un mínimo de MIN_LOCK_MS aunque no dispare ninguna. Así
// "Guardar", "Agregar", "Confirmar dispensación", etc. no se ejecutan dos
// veces si el usuario hace doble clic o vuelve a clicar mientras espera.
//
// Un botón que sí debe aceptar clics seguidos (ej. +/- de cantidad) se excluye
// con el atributo data-multi-click.

export const MIN_LOCK_MS = 600;
const LOCK_CLASS = 'click-locked';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let pendingMutations = 0;
const lockedButtons = new Set<HTMLElement>();
const minLockElapsed = new WeakSet<HTMLElement>();

export const pendingMutationsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!MUTATING_METHODS.has(req.method)) {
    return next(req);
  }
  pendingMutations++;
  return next(req).pipe(
    finalize(() => {
      pendingMutations = Math.max(0, pendingMutations - 1);
      releaseIfIdle();
    })
  );
};

function release(el: HTMLElement) {
  lockedButtons.delete(el);
  el.classList.remove(LOCK_CLASS);
  el.removeAttribute('aria-busy');
}

function releaseIfIdle() {
  if (pendingMutations > 0) return;
  for (const el of [...lockedButtons]) {
    if (minLockElapsed.has(el)) release(el);
  }
}

function lock(el: HTMLElement) {
  lockedButtons.add(el);
  minLockElapsed.delete(el);
  el.classList.add(LOCK_CLASS);
  el.setAttribute('aria-busy', 'true');
  setTimeout(() => {
    minLockElapsed.add(el);
    if (pendingMutations === 0) release(el);
  }, MIN_LOCK_MS);
}

function guardedTarget(event: Event): HTMLElement | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>('button, input[type="submit"], input[type="button"], [role="button"]');
  if (!el || el.hasAttribute('data-multi-click')) return null;
  if ((el as HTMLButtonElement).disabled) return null;
  return el;
}

function blockEvent(event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

export function installClickGuard(doc: Document = document) {
  // Fase de captura en document: corre antes que los (click) de Angular, que
  // están en el propio botón, así que el segundo clic nunca les llega.
  doc.addEventListener('click', (event) => {
    const el = guardedTarget(event);
    if (!el) return;
    if (lockedButtons.has(el)) {
      blockEvent(event);
      return;
    }
    lock(el);
  }, true);
  // Enter dentro de un formulario no necesita listener propio: el navegador
  // lo convierte en un clic sobre el botón de envío, que pasa por aquí.
}

// Solo para pruebas.
export function resetClickGuardForTests() {
  pendingMutations = 0;
  for (const el of [...lockedButtons]) release(el);
}
