import { environment as developmentEnv } from './environment';
import { environment as pruebasEnv } from './environment.pruebas';
import { environment as productionEnv } from './environment.production';

describe('environments', () => {
  it('development points at the relative /api path used by proxy.conf.json', () => {
    expect(developmentEnv.production).toBe(false);
    expect(developmentEnv.apiUrl).toBe('/api');
  });

  it('pruebas points at the relative /api path proxied by nginx', () => {
    expect(pruebasEnv.production).toBe(false);
    expect(pruebasEnv.apiUrl).toBe('/api');
  });

  it('production points at the absolute backend url', () => {
    expect(productionEnv.production).toBe(true);
    expect(productionEnv.apiUrl).toBe('https://backinventario.akribeia.tech/api');
  });

  it('every environment exposes a non-empty apiUrl', () => {
    for (const env of [developmentEnv, pruebasEnv, productionEnv]) {
      expect(env.apiUrl.length).toBeGreaterThan(0);
    }
  });
});
