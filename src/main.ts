import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { installClickGuard } from './app/core/click-guard';

// Un <input type="number"> con foco cambia su valor al girar la rueda del
// mouse (o el scroll del touchpad) sobre él. Quitando el foco el scroll sigue
// moviendo la página y el número digitado no se altera.
document.addEventListener('wheel', () => {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement && el.type === 'number') {
    el.blur();
  }
}, { passive: true });

installClickGuard();

bootstrapApplication(AppComponent, appConfig)
  .catch((error) => console.error(error));
