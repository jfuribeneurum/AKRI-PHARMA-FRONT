(function () {
  const STYLE_ID = 'akri-connectivity-widget-style';
  const WIDGET_ID = 'akri-connectivity-widget';
  const CHECK_INTERVAL_MS = 2500;
  const REFRESH_INTERVAL_MS = 60000;
  let lastRefreshAt = 0;
  let lastRoute = '';
  let lastStatusData = null;
  let isFetching = false;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .akri-connectivity-card { margin: 0 0 1rem; padding: 1rem 1.1rem; background: var(--surface, #fff); border: 1px solid var(--line, #e2e8f0); border-left: 4px solid var(--primary, #6D28D9); border-radius: 16px; box-shadow: 0 12px 32px rgba(17,24,39,.06); }
      .akri-connectivity-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; }
      .akri-connectivity-head h3 { margin: 0 0 .25rem; font-size: 1.1rem; color: var(--text, #111827); }
      .akri-connectivity-head p { margin: 0; color: var(--muted, #64748B); font-size: .92rem; }
      .akri-connectivity-actions { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: flex-end; align-items: center; }
      .akri-connectivity-refresh, .akri-connectivity-linkbtn {
        border: 1px solid var(--line, #E2E8F0); background: #fff; color: var(--text, #111827);
        border-radius: 999px; padding: .45rem .9rem; font-weight: 600; cursor: pointer; text-decoration: none;
      }
      .akri-connectivity-linkbtn.primary { background: var(--primary, #6D28D9); color: #fff; border-color: var(--primary, #6D28D9); }
      .akri-connectivity-refresh:hover, .akri-connectivity-linkbtn:hover { border-color: var(--primary, #6D28D9); color: var(--primary, #6D28D9); }
      .akri-connectivity-linkbtn.primary:hover { color: #fff; filter: brightness(.96); }
      .akri-connectivity-grid { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: .75rem; margin-bottom: 1rem; }
      .akri-connectivity-tile { border: 1px solid var(--line, #E2E8F0); border-radius: 14px; padding: .85rem; background: var(--surface-muted, #F8FAFC); }
      .akri-connectivity-tile small { display: block; color: var(--muted, #64748B); margin-bottom: .4rem; }
      .akri-connectivity-tile strong { display: block; margin-bottom: .3rem; font-size: 1rem; }
      .akri-connectivity-tile .meta { color: var(--muted, #64748B); font-size: .84rem; line-height: 1.35; }
      .akri-chip { display: inline-flex; align-items: center; border-radius: 999px; padding: .28rem .7rem; font-size: .8rem; font-weight: 700; border: 1px solid transparent; }
      .akri-chip-success { background: #ECFDF5; color: #065F46; border-color: #A7F3D0; }
      .akri-chip-info { background: #EFF6FF; color: #1D4ED8; border-color: #BFDBFE; }
      .akri-chip-warn { background: #FFF7ED; color: #C2410C; border-color: #FDBA74; }
      .akri-chip-danger { background: #FEF2F2; color: #B91C1C; border-color: #FECACA; }
      .akri-chip-muted { background: #F8FAFC; color: #475569; border-color: #E2E8F0; }
      .akri-connectivity-details { display: grid; grid-template-columns: 1.2fr .8fr; gap: 1rem; }
      .akri-connectivity-panel { border: 1px solid var(--line, #E2E8F0); border-radius: 14px; background: #fff; padding: .9rem 1rem; }
      .akri-connectivity-panel h4 { margin: 0 0 .75rem; font-size: 1rem; }
      .akri-connectivity-table { width: 100%; border-collapse: collapse; }
      .akri-connectivity-table th, .akri-connectivity-table td { text-align: left; padding: .6rem .45rem; border-bottom: 1px solid var(--line, #E2E8F0); vertical-align: top; font-size: .9rem; }
      .akri-connectivity-table th { color: var(--muted, #64748B); font-weight: 600; }
      .akri-connectivity-list { display: grid; gap: .8rem; }
      .akri-connectivity-metric { border-bottom: 1px solid var(--line, #E2E8F0); padding-bottom: .7rem; }
      .akri-connectivity-metric:last-child { border-bottom: 0; padding-bottom: 0; }
      .akri-connectivity-metric-top { display: flex; justify-content: space-between; gap: 1rem; font-weight: 600; margin-bottom: .18rem; }
      .akri-connectivity-metric .meta { color: var(--muted, #64748B); font-size: .84rem; }
      .akri-connectivity-error { border-radius: 12px; padding: .9rem 1rem; background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
      @media (max-width: 1100px) { .akri-connectivity-grid, .akri-connectivity-details { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function chipClass(status) {
    switch (status) {
      case 'ok': return 'akri-chip-success';
      case 'mock':
      case 'configured': return 'akri-chip-info';
      case 'warning':
      case 'degraded':
      case 'unconfigured': return 'akri-chip-warn';
      case 'error': return 'akri-chip-danger';
      default: return 'akri-chip-muted';
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
  }

  function routeIsDashboard() {
    const title = document.querySelector('.page-title');
    const text = (title?.textContent || '').toLowerCase();
    return text.includes('dashboard');
  }

  function getTargetContainer() {
    const page = document.querySelector('.content .page');
    const pageHeader = page?.querySelector('.page-header');
    if (!page || !pageHeader || !routeIsDashboard()) return null;
    return { page, pageHeader };
  }

  function getToken() { return localStorage.getItem('akri_token') || ''; }

  async function fetchStatus() {
    const token = getToken();
    if (!token) throw new Error('No hay sesión activa en el navegador.');
    const response = await fetch('/api/status/overview', { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
    return payload?.data || payload;
  }

  function renderError(errorMessage) {
    return `<div class="akri-connectivity-error"><strong>No fue posible consultar el estado de conectividad.</strong><div style="margin-top:.35rem;">${escapeHtml(errorMessage)}</div></div>`;
  }

  function detailLine(section, fallback) {
    if (!section) return fallback || 'Sin datos';
    if (section.message) return section.message;
    if (section.database || section.host) return `${escapeHtml(section.database || 'DB')} · ${escapeHtml(section.host || 'host')}:${escapeHtml(section.port || '')}`;
    return fallback || 'Operativo';
  }

  function renderStatus(data) {
    const overallClass = chipClass(data?.overall_status);
    const siesa = data?.siesa || {};
    const thermo = data?.thermohygrometers || {};
    const database = data?.database || {};
    const backend = data?.backend || {};
    const frontendBackend = data?.frontend_backend || {};

    return `
      <div class="akri-connectivity-head">
        <div>
          <h3>Estado de conectividad</h3>
          <p>Validación visible de frontend ↔ backend ↔ MariaDB, SIESA y termohigrómetros.</p>
        </div>
        <div class="akri-connectivity-actions">
          <span class="akri-chip ${overallClass}">${escapeHtml(data?.overall_label || 'Sin estado')}</span>
          <a class="akri-connectivity-linkbtn primary" href="/dashboard#control-center:sites">Centro de control</a>
          <a class="akri-connectivity-linkbtn" href="/downloads/GUIA_DEFINITIVA_AkriPharmacy_v19.pdf" target="_blank" rel="noopener">Guía PDF</a>
          <button type="button" class="akri-connectivity-refresh">Actualizar conectividad</button>
        </div>
      </div>

      <div class="akri-connectivity-grid">
        <div class="akri-connectivity-tile"><small>Frontend → Backend</small><strong>${escapeHtml(frontendBackend.label || 'Operativo')}</strong><div class="meta">${escapeHtml(frontendBackend.message || 'El navegador autenticado alcanzó la API.')}</div></div>
        <div class="akri-connectivity-tile"><small>Backend → MariaDB</small><strong>${escapeHtml(database.label || 'Sin datos')}</strong><div class="meta">${escapeHtml(detailLine(database, 'Conectividad a base de datos.'))}</div></div>
        <div class="akri-connectivity-tile"><small>Facturación SIESA</small><strong>${escapeHtml(siesa.label || 'Sin datos')}</strong><div class="meta">${escapeHtml(detailLine(siesa, 'Integración de facturación.'))}</div></div>
        <div class="akri-connectivity-tile"><small>Termohigrómetros</small><strong>${escapeHtml(thermo.label || 'Sin datos')}</strong><div class="meta">${escapeHtml(detailLine(thermo, 'Integración automática de cadena de frío.'))}</div></div>
      </div>

      <div class="akri-connectivity-details">
        <div class="akri-connectivity-panel">
          <h4>Detalle por componente</h4>
          <table class="akri-connectivity-table">
            <thead><tr><th>Componente</th><th>Estado</th><th>Detalle</th><th>Última marca</th></tr></thead>
            <tbody>
              <tr><td>API backend</td><td><span class="akri-chip ${chipClass(backend.status)}">${escapeHtml(backend.label || 'Operativo')}</span></td><td>${escapeHtml(backend.message || 'Respuesta recibida.')}</td><td>${escapeHtml(formatDate(backend.checked_at))}</td></tr>
              <tr><td>MariaDB</td><td><span class="akri-chip ${chipClass(database.status)}">${escapeHtml(database.label || 'Sin datos')}</span></td><td>${escapeHtml(detailLine(database, 'Conectividad a base de datos.'))}</td><td>${escapeHtml(formatDate(database.checked_at))}</td></tr>
              <tr><td>SIESA</td><td><span class="akri-chip ${chipClass(siesa.status)}">${escapeHtml(siesa.label || 'Sin datos')}</span></td><td>${escapeHtml(detailLine(siesa, 'Integración de facturación.'))}</td><td>${escapeHtml(formatDate(siesa.ultima_interaccion || siesa.checked_at))}</td></tr>
              <tr><td>Termohigrómetros</td><td><span class="akri-chip ${chipClass(thermo.status)}">${escapeHtml(thermo.label || 'Sin datos')}</span></td><td>${escapeHtml(detailLine(thermo, 'Monitoreo automático de frío.'))}</td><td>${escapeHtml(formatDate(thermo.ultima_sincronizacion || thermo.checked_at))}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="akri-connectivity-panel">
          <h4>Indicadores operativos</h4>
          <div class="akri-connectivity-list">
            <div class="akri-connectivity-metric"><div class="akri-connectivity-metric-top"><span>Facturas pendientes SIESA</span><strong>${escapeHtml(siesa.pendientes ?? 0)}</strong></div><div class="meta">Aceptadas: ${escapeHtml(siesa.aceptadas ?? 0)} · Rechazadas: ${escapeHtml(siesa.rechazadas ?? 0)}</div></div>
            <div class="akri-connectivity-metric"><div class="akri-connectivity-metric-top"><span>Integraciones activas de termohigrómetros</span><strong>${escapeHtml(thermo.integraciones_activas ?? 0)}</strong></div><div class="meta">Sensores mapeados: ${escapeHtml(thermo.sensores_mapeados ?? 0)} · Equipos: ${escapeHtml(thermo.equipos_monitoreados ?? 0)}</div></div>
            <div class="akri-connectivity-metric"><div class="akri-connectivity-metric-top"><span>Lecturas de cadena de frío 24h</span><strong>${escapeHtml(thermo.lecturas_24h ?? 0)}</strong></div><div class="meta">Alertas abiertas: ${escapeHtml(thermo.alertas_abiertas ?? 0)} · Última lectura: ${escapeHtml(formatDate(thermo.ultima_lectura))}</div></div>
            <div class="akri-connectivity-metric"><div class="akri-connectivity-metric-top"><span>Latencia MariaDB</span><strong>${escapeHtml(database.latency_ms ?? '—')} ms</strong></div><div class="meta">Base: ${escapeHtml(database.database || '—')} · Host: ${escapeHtml(database.host || '—')}</div></div>
          </div>
        </div>
      </div>
    `;
  }

  function ensureWidgetContainer() {
    injectStyles();
    const target = getTargetContainer();
    const existing = document.getElementById(WIDGET_ID);
    if (!target) { if (existing) existing.remove(); return null; }
    if (existing && target.page.contains(existing)) return existing;
    if (existing) existing.remove();
    const widget = document.createElement('div');
    widget.id = WIDGET_ID;
    widget.className = 'akri-connectivity-card';
    target.page.insertBefore(widget, target.pageHeader.nextSibling);
    return widget;
  }

  function bindRefresh(widget) {
    const button = widget.querySelector('.akri-connectivity-refresh');
    if (button && !button.dataset.bound) {
      button.dataset.bound = 'true';
      button.addEventListener('click', function () { lastRefreshAt = 0; void refresh(true); });
    }
  }

  async function refresh(force) {
    const widget = ensureWidgetContainer();
    if (!widget) return;
    const route = window.location.pathname + window.location.search;
    const now = Date.now();
    if (!force && route === lastRoute && lastStatusData && now - lastRefreshAt < REFRESH_INTERVAL_MS) {
      widget.innerHTML = renderStatus(lastStatusData);
      bindRefresh(widget);
      return;
    }
    if (isFetching) return;
    isFetching = true;
    widget.innerHTML = '<div class="meta">Consultando conectividad de plataforma…</div>';
    try {
      const data = await fetchStatus();
      lastStatusData = data;
      lastRoute = route;
      lastRefreshAt = Date.now();
      widget.innerHTML = renderStatus(data);
      bindRefresh(widget);
    } catch (error) {
      widget.innerHTML = renderError(error?.message || 'Error no identificado.');
    } finally {
      isFetching = false;
    }
  }

  function tick() {
    const route = window.location.pathname + window.location.search;
    const widget = document.getElementById(WIDGET_ID);
    const onDashboard = !!getTargetContainer();
    if (!onDashboard) { if (widget) widget.remove(); return; }
    const shouldForce = route !== lastRoute || !widget;
    void refresh(shouldForce);
  }

  function patchHistory() {
    ['pushState', 'replaceState'].forEach(function (methodName) {
      const original = history[methodName];
      if (typeof original !== 'function') return;
      history[methodName] = function () {
        const result = original.apply(this, arguments);
        window.dispatchEvent(new Event('akri-route-change'));
        return result;
      };
    });
  }

  patchHistory();
  window.addEventListener('popstate', tick);
  window.addEventListener('akri-route-change', tick);
  window.addEventListener('load', tick);
  document.addEventListener('DOMContentLoaded', tick);
  setInterval(tick, CHECK_INTERVAL_MS);
})();
