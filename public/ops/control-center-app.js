
(function () {
  if (!window.akriOps) {
    document.body.innerHTML = '<div class="wrap"><div class="card"><strong>Error:</strong> no se cargó el runtime del centro de control.</div></div>';
    return;
  }
  const VERSION = 'v26';
  const { api, html, escapeHtml, formatDate, formatNumber, requireSession, notifyParentHeight } = window.akriOps;
  requireSession();
  const root = document.getElementById('app');
  const STORAGE_KEY = 'akri_control_center_tab';
  let context = null;
  let activeTab = null;
  const TAB_DEFS = {
    sites: { label: 'Sedes', badge: 'CRUD', path: './site-manager.html', description: 'Crear, editar, desactivar/reactivar y auditar sedes.' },
    profiles: { label: 'Perfiles', badge: 'Roles', path: './profile-manager.html', description: 'Gestionar perfiles, reasignaciones y usabilidades.' },
    users: { label: 'Usuarios', badge: 'Acceso', path: './user-manager.html', description: 'Crear, editar, activar/desactivar y filtrar usuarios.' },
    requests: { label: 'Solicitud de compra', badge: 'Central', path: './purchase-requests.html', description: 'Solicitud entre sedes y revisión central con decisión.' },
    inventory: { label: 'Inventario', badge: 'Local/General', path: './multisite-inventory.html', description: 'Inventario local por sede y consolidado general.' },
    scanners: { label: 'Lectores', badge: 'Hardware', path: './scanners.html', description: 'Auto-detección y perfiles de hardware por sede.' },
    dispensing: { label: 'Dispensación', badge: 'POS', path: './dispensing-requests.html', description: 'Manual, HCE y fórmula escaneada con checkout lateral.' },
    traceability: { label: 'Trazabilidad', badge: 'Logs', path: './traceability.html', description: 'Bitácora inmutable por fecha, usuario, perfil y sede.' },
    audit: { label: 'Auditoría', badge: 'Diff', path: './admin-audit.html', description: 'Historial administrativo de cambios y visor diff.' },
    permissions: { label: 'Matriz de permisos', badge: 'Sticky', path: './permissions.html', description: 'Permisos perfil × micro-función con guardado inmediato.' }
  };
  function availableTabs(ctx) {
    const p = ctx?.permissions || {};
    const tabs = [];
    if (p.can_manage_sites) tabs.push('sites');
    if (p.can_manage_profiles || p.can_assign_profiles) tabs.push('profiles');
    if (p.can_manage_users) tabs.push('users');
    if (p.can_request_to_central || p.can_review_requests) tabs.push('requests');
    tabs.push('inventory', 'scanners', 'dispensing', 'traceability');
    if (p.can_manage_sites || p.can_manage_users || p.can_manage_profiles || p.can_assign_profiles) tabs.push('audit');
    if (p.can_manage_profiles) tabs.push('permissions');
    return Array.from(new Set(tabs));
  }
  function requestedTab() {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('tab');
    const hash = (window.location.hash || '').replace('#', '');
    const hashTab = hash.startsWith('control-center:') ? hash.split(':')[1] : hash;
    const saved = localStorage.getItem(STORAGE_KEY);
    return [q, hashTab, saved].find((tab) => tab && TAB_DEFS[tab]) || null;
  }
  function defaultTab() { return availableTabs(context)[0] || null; }
  function moduleSrc(tab) { return `${TAB_DEFS[tab].path}?embedded=1&tab=${encodeURIComponent(tab)}&v=${VERSION}`; }
  function setTab(next) {
    const allowed = availableTabs(context);
    activeTab = allowed.includes(next) ? next : defaultTab();
    localStorage.setItem(STORAGE_KEY, activeTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    url.searchParams.set('v', VERSION);
    url.hash = `control-center:${activeTab}`;
    history.replaceState({}, '', url);
    render();
  }
  function render() {
    const allowed = availableTabs(context);
    if (!allowed.length) {
      root.innerHTML = '<div class="card"><strong>Acceso restringido.</strong><p class="muted">Tu perfil no tiene módulos habilitados en el centro de control.</p></div>';
      notifyParentHeight();
      return;
    }
    if (!allowed.includes(activeTab)) activeTab = defaultTab();
    const def = TAB_DEFS[activeTab];
    root.innerHTML = html`
      <div class="card">
        <div class="banner-row">
          <div>
            <span class="chip primary">Centro de control v26</span>
            <h2 class="section-title" style="margin-top:10px">Gobierno multisede integrado y operativo</h2>
            <div class="subtitle">El centro de control carga los módulos reales dentro de esta vista: sedes, perfiles, usuarios, solicitudes, inventario, lectores, dispensación, trazabilidad, auditoría y permisos.</div>
          </div>
          <div class="toolbar">
            <a class="btn secondary" href="/dashboard#control-center:${escapeHtml(activeTab)}">Ir al dashboard</a>
            <a class="btn secondary" href="/">Volver a la app</a>
          </div>
        </div>
        <div class="grid four" style="margin-top:16px">
          <div class="stat-card"><small>Sede activa</small><strong>${escapeHtml(context.current_site?.nombre || '—')}</strong><div class="meta">${context.current_site?.es_principal ? 'Sede central' : 'Sede periférica'}</div></div>
          <div class="stat-card"><small>Inventario local</small><strong>${formatNumber(context.inventory?.local?.stock_unidades || 0, 3)}</strong><div class="meta">${formatNumber(context.inventory?.local?.productos || 0)} productos</div></div>
          <div class="stat-card"><small>Inventario general</small><strong>${formatNumber(context.inventory?.general?.stock_unidades || 0, 3)}</strong><div class="meta">${formatNumber(context.inventory?.general?.productos || 0)} productos</div></div>
          <div class="stat-card"><small>Solicitudes pendientes</small><strong>${formatNumber(context.purchase_request_alert?.pending_count || 0)}</strong><div class="meta">Actualizado ${escapeHtml(formatDate(new Date()))}</div></div>
        </div>
        <div class="tabs" style="margin-top:16px">${allowed.map((key) => `<button type="button" class="tab-btn ${activeTab === key ? 'active' : ''}" data-tab="${key}">${escapeHtml(TAB_DEFS[key].label)} <small style="opacity:.8">${escapeHtml(TAB_DEFS[key].badge)}</small></button>`).join('')}</div>
      </div>
      <div class="card">
        <div class="banner-row">
          <div>
            <h2 class="section-title">${escapeHtml(def.label)}</h2>
            <div class="subtitle">${escapeHtml(def.description)}</div>
          </div>
          <div class="toolbar">
            <button class="btn secondary" id="reloadFrame" type="button">Recargar módulo</button>
            <a class="btn secondary" href="${escapeHtml(def.path)}?v=${VERSION}">Abrir módulo directo</a>
          </div>
        </div>
        <iframe id="centerFrame" class="hub-frame" data-hub-frame src="${moduleSrc(activeTab)}" title="${escapeHtml(def.label)}" style="width:100%;border:0;min-height:1180px;border-radius:16px"></iframe>
      </div>`;
    root.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));
    root.querySelector('#reloadFrame')?.addEventListener('click', () => {
      const frame = root.querySelector('#centerFrame');
      if (frame) frame.src = moduleSrc(activeTab) + `&ts=${Date.now()}`;
    });
    notifyParentHeight();
  }
  async function init() {
    context = await api('/api/multisite/context');
    const allowed = availableTabs(context);
    const requested = requestedTab();
    activeTab = allowed.includes(requested) ? requested : defaultTab();
    render();
  }
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    const frame = root.querySelector('#centerFrame');
    if (!frame) return;
    if (event.data?.type === 'akri-ops-height') frame.style.height = `${Math.max(Number(event.data.height || 900), 760)}px`;
  });
  window.addEventListener('hashchange', () => setTab(requestedTab() || activeTab));
  init().catch((error) => {
    root.innerHTML = `<div class="card"><strong>Error:</strong> ${escapeHtml(error.message || 'No fue posible cargar el centro de control.')}</div>`;
    notifyParentHeight();
  });
})();
