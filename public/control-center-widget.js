
(function () {
  const VERSION = 'v26';
  const STYLE_ID = 'akri-control-center-style-v26';
  const WIDGET_ID = 'akri-control-center';
  const STORAGE_KEY = 'akri_control_center_tab';
  const CHECK_INTERVAL_MS = 2500;
  let lastRoute = '';
  let lastContext = null;
  let loading = false;
  let activeTab = null;
  let scrolledForHash = '';

  const TAB_DEFS = {
    sites: { label: 'Sedes', badge: 'CRUD', path: '/ops/site-manager.html', description: 'Crear, editar, desactivar/reactivar y auditar sedes.' },
    profiles: { label: 'Perfiles', badge: 'Roles', path: '/ops/profile-manager.html', description: 'Gestionar perfiles, usabilidades y reasignaciones.' },
    users: { label: 'Usuarios', badge: 'Acceso', path: '/ops/user-manager.html', description: 'Crear, editar, activar/desactivar y filtrar usuarios.' },
    requests: { label: 'Solicitud de compra', badge: 'Central', path: '/ops/purchase-requests.html', description: 'Solicitud periférica → revisión central con alerta superior.' },
    inventory: { label: 'Inventario', badge: 'Local/General', path: '/ops/multisite-inventory.html', description: 'Inventario local por sede y consolidado general.' },
    scanners: { label: 'Lectores', badge: 'Auto-detección', path: '/ops/scanners.html', description: 'Canales, perfiles de hardware y auto-detección.' },
    dispensing: { label: 'Dispensación', badge: 'POS', path: '/ops/dispensing-requests.html', description: 'Manual, HCE y fórmula escaneada.' },
    traceability: { label: 'Trazabilidad', badge: 'Logs', path: '/ops/traceability.html', description: 'Quién hizo qué, con qué perfil y en qué sede.' },
    audit: { label: 'Auditoría', badge: 'Diff', path: '/ops/admin-audit.html', description: 'Altas, cambios y bajas con historial administrativo.' },
    permissions: { label: 'Matriz de permisos', badge: 'Sticky', path: '/ops/permissions.html', description: 'Asignación granular perfil × micro-función.' }
  };

  function getToken() { return localStorage.getItem('akri_token') || ''; }
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function routeIsDashboard() {
    const title = document.querySelector('.page-title');
    return (title?.textContent || '').toLowerCase().includes('dashboard');
  }
  function getAnchor() {
    const page = document.querySelector('.content .page');
    const pageHeader = page?.querySelector('.page-header');
    if (!page || !pageHeader || !routeIsDashboard()) return null;
    return { page, pageHeader };
  }
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .akri-cc-card{margin:0 0 1rem;padding:1rem 1.1rem;background:var(--surface,#fff);color:var(--text,#111827);border:1px solid var(--line,#E2E8F0);border-radius:20px;box-shadow:var(--shadow,0 12px 32px rgba(17,24,39,.06))}
      .akri-cc-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem}.akri-cc-head h3{margin:0 0 .25rem;font-size:1.15rem}.akri-cc-head p{margin:0;color:var(--muted,#64748B);font-size:.92rem;line-height:1.45}
      .akri-cc-actions{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}.akri-cc-btn{border:1px solid var(--line,#E2E8F0);background:var(--surface,#fff);color:var(--text,#111827);border-radius:999px;padding:.45rem .85rem;font-weight:700;cursor:pointer;text-decoration:none}.akri-cc-btn.primary{background:var(--primary,#6D28D9);border-color:var(--primary,#6D28D9);color:#fff}
      .akri-cc-tabs{display:flex;flex-wrap:wrap;gap:.55rem;margin-bottom:1rem}.akri-cc-tab{border:1px solid var(--line,#E2E8F0);background:var(--surface,#fff);color:var(--text,#111827);border-radius:999px;padding:.5rem .8rem;font-weight:700;cursor:pointer}.akri-cc-tab.active{background:var(--primary,#6D28D9);border-color:var(--primary,#6D28D9);color:#fff}.akri-cc-tab small{display:inline-block;margin-left:.35rem;font-size:.72rem;opacity:.9}
      .akri-cc-grid{display:grid;grid-template-columns:repeat(4,minmax(180px,1fr));gap:.75rem;margin-bottom:1rem}.akri-cc-tile{border:1px solid var(--line,#E2E8F0);border-radius:14px;padding:.85rem;background:var(--surface-muted,#F8FAFC)}.akri-cc-tile small{display:block;color:var(--muted,#64748B);margin-bottom:.35rem}.akri-cc-tile strong{display:block;font-size:1rem;margin-bottom:.18rem;color:var(--text,#111827)}.akri-cc-tile .meta{color:var(--muted,#64748B);font-size:.84rem;line-height:1.35}
      .akri-cc-content{border:1px solid var(--line,#E2E8F0);border-radius:16px;background:var(--surface,#fff);overflow:hidden}.akri-cc-module-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;padding:1rem;border-bottom:1px solid var(--line,#E2E8F0)}.akri-cc-module-head h4{margin:0 0 .35rem;font-size:1.05rem;color:var(--text,#111827)}.akri-cc-module-head p{margin:0;color:var(--muted,#64748B);font-size:.9rem;line-height:1.45}.akri-cc-iframe{width:100%;border:0;display:block;min-height:980px;background:#fff}.akri-cc-empty{padding:1rem;color:var(--muted,#64748B)}.akri-cc-note{margin-top:.5rem;color:var(--muted,#64748B);font-size:.85rem}
      @media (max-width:1100px){.akri-cc-grid{grid-template-columns:1fr 1fr}.akri-cc-head,.akri-cc-module-head{flex-direction:column}}@media (max-width:760px){.akri-cc-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }
  async function fetchContext() {
    const token = getToken();
    if (!token) throw new Error('No hay sesión activa.');
    const res = await fetch('/api/multisite/context', { headers: { Authorization: `Bearer ${token}` } });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.message || payload.error || `HTTP ${res.status}`);
    return payload.data || payload;
  }
  async function fetchSites() {
    const token = getToken();
    if (!token) return [];
    const res = await fetch('/api/admin/sites', { headers: { Authorization: `Bearer ${token}` } });
    const payload = await res.json().catch(() => ({}));
    return res.ok ? (payload.data || payload || []) : [];
  }
  function availableTabs(context) {
    const p = context?.permissions || {};
    const tabs = [];
    if (p.can_manage_sites) tabs.push('sites');
    if (p.can_manage_profiles || p.can_assign_profiles) tabs.push('profiles');
    if (p.can_manage_users) tabs.push('users');
    if (p.can_request_to_central || p.can_review_requests) tabs.push('requests');
    tabs.push('inventory', 'scanners', 'dispensing', 'traceability');
    if (p.can_manage_sites || p.can_manage_users || p.can_manage_profiles || p.can_assign_profiles) tabs.push('audit');
    if (p.can_manage_profiles) tabs.push('permissions');
    return [...new Set(tabs)];
  }
  function parseRequestedTab() {
    const hash = window.location.hash || '';
    const direct = hash.replace('#', '');
    if (TAB_DEFS[direct]) return direct;
    const match = hash.match(/control-center[:/](\w+)/i);
    const byHash = match?.[1] || null;
    if (TAB_DEFS[byHash]) return byHash;
    return null;
  }
  function ensureWidget() {
    injectStyles();
    const target = getAnchor();
    const existing = document.getElementById(WIDGET_ID);
    if (!target) { if (existing) existing.remove(); return null; }
    if (existing && target.page.contains(existing)) return existing;
    if (existing) existing.remove();
    const widget = document.createElement('div');
    widget.id = WIDGET_ID;
    widget.className = 'akri-cc-card';
    const connectivity = document.getElementById('akri-connectivity-widget');
    if (connectivity?.parentElement === target.page) target.page.insertBefore(widget, connectivity.nextSibling);
    else target.page.insertBefore(widget, target.pageHeader.nextSibling);
    return widget;
  }
  function defaultTab(context) { return availableTabs(context)[0] || null; }
  function preferredTab(context) {
    const tabs = availableTabs(context);
    const requested = parseRequestedTab();
    const saved = localStorage.getItem(STORAGE_KEY);
    return [requested, activeTab, saved, defaultTab(context)].find((item) => item && tabs.includes(item)) || tabs[0] || null;
  }
  function moduleSrc(tab) {
    const def = TAB_DEFS[tab];
    return `${def.path}?embedded=1&tab=${encodeURIComponent(tab)}&v=${VERSION}`;
  }
  function fullCenterHref(tab) {
    return `/ops/index.html?tab=${encodeURIComponent(tab)}&v=${VERSION}`;
  }
  function setHash(tab) {
    if (!tab) return;
    const base = `${window.location.pathname}${window.location.search}`;
    history.replaceState({}, '', `${base}#control-center:${tab}`);
  }
  function persistTab(tab) {
    activeTab = tab;
    localStorage.setItem(STORAGE_KEY, tab);
    setHash(tab);
  }
  async function render(context) {
    const widget = ensureWidget();
    if (!widget) return;
    const tabs = availableTabs(context);
    const selected = preferredTab(context);
    if (!selected) {
      widget.innerHTML = '<div class="akri-cc-empty">No hay módulos del centro de control habilitados para este perfil.</div>';
      return;
    }
    activeTab = selected;
    const currentDef = TAB_DEFS[selected];
    const sites = await fetchSites();
    const activeSites = sites.filter((site) => site.activo).length;
    const inactiveSites = sites.filter((site) => !site.activo).length;
    widget.innerHTML = `
      <div class="akri-cc-head">
        <div>
          <h3>Centro de control operativo</h3>
          <p>El dashboard carga directamente los módulos funcionales: sedes, perfiles, usuarios, solicitudes, inventario, lectores, dispensación, trazabilidad, auditoría y permisos.</p>
        </div>
        <div class="akri-cc-actions">
          <button type="button" class="akri-cc-btn" data-cc-refresh="1">Actualizar</button>
          <a class="akri-cc-btn primary" href="${fullCenterHref(selected)}">Abrir centro completo</a>
        </div>
      </div>
      <div class="akri-cc-grid">
        <div class="akri-cc-tile"><small>Sede activa</small><strong>${escapeHtml(context.current_site?.nombre || '—')}</strong><div class="meta">${context.current_site?.es_principal ? 'Sede central' : 'Sede periférica'}</div></div>
        <div class="akri-cc-tile"><small>Sedes activas / inactivas</small><strong>${escapeHtml(activeSites)} / ${escapeHtml(inactiveSites)}</strong><div class="meta">Gobierno multisede operativo</div></div>
        <div class="akri-cc-tile"><small>Inventario local / general</small><strong>${escapeHtml(Number(context.inventory?.local?.stock_unidades || 0).toFixed(3))} / ${escapeHtml(Number(context.inventory?.general?.stock_unidades || 0).toFixed(3))}</strong><div class="meta">Local por sede y consolidado general</div></div>
        <div class="akri-cc-tile"><small>Solicitudes pendientes</small><strong>${escapeHtml(context.purchase_request_alert?.pending_count || 0)}</strong><div class="meta">Indicador superior central</div></div>
      </div>
      <div class="akri-cc-tabs">${tabs.map((key) => `<button class="akri-cc-tab ${selected === key ? 'active' : ''}" data-cc-tab="${key}">${escapeHtml(TAB_DEFS[key].label)}<small>${escapeHtml(TAB_DEFS[key].badge)}</small></button>`).join('')}</div>
      <div class="akri-cc-content">
        <div class="akri-cc-module-head">
          <div>
            <h4>${escapeHtml(currentDef.label)}</h4>
            <p>${escapeHtml(currentDef.description)}</p>
            <div class="akri-cc-note">Este panel carga el módulo real dentro del dashboard. Si no ves formularios o tablas, recarga el módulo.</div>
          </div>
          <div class="akri-cc-actions">
            <button type="button" class="akri-cc-btn" data-cc-reload-module="1">Recargar módulo</button>
            <a class="akri-cc-btn" href="${fullCenterHref(selected)}">Pantalla completa</a>
          </div>
        </div>
        <iframe class="akri-cc-iframe" data-cc-iframe src="${moduleSrc(selected)}"></iframe>
      </div>`;
    widget.querySelectorAll('[data-cc-tab]').forEach((button) => button.addEventListener('click', () => { persistTab(button.dataset.ccTab); void render(context); }));
    widget.querySelector('[data-cc-refresh]')?.addEventListener('click', () => { lastContext = null; void refresh(true); });
    widget.querySelector('[data-cc-reload-module]')?.addEventListener('click', () => {
      const iframe = widget.querySelector('[data-cc-iframe]');
      if (iframe) iframe.src = moduleSrc(selected) + `&ts=${Date.now()}`;
    });
    const iframe = widget.querySelector('[data-cc-iframe]');
    if (iframe) iframe.style.height = '1180px';
    const hash = window.location.hash || '';
    if (/^#control-center:/.test(hash) && scrolledForHash !== hash) {
      scrolledForHash = hash;
      setTimeout(() => widget.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }
  async function refresh(force) {
    const widget = ensureWidget();
    if (!widget) return;
    const route = window.location.pathname + window.location.search + window.location.hash;
    if (!force && lastContext && route === lastRoute) { await render(lastContext); return; }
    if (loading) return;
    loading = true;
    widget.innerHTML = '<div class="akri-cc-empty">Cargando centro de control…</div>';
    try {
      const context = await fetchContext();
      lastContext = context;
      lastRoute = route;
      await render(context);
    } catch (error) {
      widget.innerHTML = `<div class="akri-cc-empty">${escapeHtml(error.message || 'No fue posible cargar el centro de control.')}</div>`;
    } finally {
      loading = false;
    }
  }
  function tick() {
    const widget = document.getElementById(WIDGET_ID);
    const target = getAnchor();
    if (!target) { if (widget) widget.remove(); return; }
    void refresh(!widget || (window.location.pathname + window.location.search + window.location.hash) !== lastRoute);
  }
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (data.type !== 'akri-ops-height') return;
    const iframe = document.querySelector('#' + WIDGET_ID + ' [data-cc-iframe]');
    if (iframe) iframe.style.height = `${Math.max(Number(data.height || 900), 760)}px`;
  });
  ['pushState', 'replaceState'].forEach((method) => {
    const original = history[method];
    if (typeof original !== 'function') return;
    history[method] = function () {
      const result = original.apply(this, arguments);
      window.dispatchEvent(new Event('akri-route-change'));
      return result;
    };
  });
  window.addEventListener('popstate', tick);
  window.addEventListener('hashchange', tick);
  window.addEventListener('akri-route-change', tick);
  window.addEventListener('load', tick);
  document.addEventListener('DOMContentLoaded', tick);
  setInterval(tick, CHECK_INTERVAL_MS);
})();
