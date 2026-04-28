(function () {
  if (!window.akriOps) {
    document.body.innerHTML = '<div class="wrap"><div class="card empty-state"><strong>Error:</strong> no se cargó el runtime del centro de control.</div></div>';
    return;
  }

  const { api, html, escapeHtml, formatDate, formatNumber, requireSession, isEmbedded, notifyParentHeight } = window.akriOps;
  requireSession();

  const root = document.getElementById('app');
  const STORAGE_KEY = 'akri_control_center_tab';
  const tabs = {
    overview: { label: 'Resumen', badge: 'Dashboard' },
    sites: { label: 'Sedes', badge: 'Gestor', path: './site-manager.html?embedded=1' },
    profiles: { label: 'Perfiles', badge: 'Roles', path: './profile-manager.html?embedded=1' },
    users: { label: 'Usuarios', badge: 'Accesos', path: './user-manager.html?embedded=1' },
    requests: { label: 'Solicitud de compra', badge: 'Central', path: './purchase-requests.html?embedded=1' },
    inventory: { label: 'Inventario local y general', badge: 'Stock', path: './multisite-inventory.html?embedded=1' },
    scanners: { label: 'Lectores y auto-detección', badge: 'Hardware', path: './scanners.html?embedded=1' },
    dispensing: { label: 'Solicitudes de dispensación', badge: 'POS', path: './dispensing-requests.html?embedded=1' },
    audit: { label: 'Auditoría administrativa', badge: 'Auditoría', path: './admin-audit.html?embedded=1' },
    permissions: { label: 'Asignaciones de perfil', badge: 'Matriz', path: './permissions.html?embedded=1' }
  };
  let context = null;
  let activeTab = 'overview';

  function permittedKeys(ctx) {
    const p = ctx?.permissions || {};
    const keys = ['overview'];
    if (p.can_manage_sites) keys.push('sites');
    if (p.can_manage_profiles || p.can_assign_profiles) keys.push('profiles');
    if (p.can_manage_users) keys.push('users');
    if (p.can_request_to_central || p.can_review_requests) keys.push('requests');
    keys.push('inventory');
    keys.push('scanners');
    keys.push('dispensing');
    if (p.can_manage_control_center || p.can_manage_users || p.can_manage_profiles) keys.push('audit');
    if (p.can_manage_profiles) keys.push('permissions');
    return Array.from(new Set(keys));
  }

  function requestedTab() {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('tab');
    const hash = (window.location.hash || '').replace('#', '');
    const hashTab = hash.startsWith('control-center:') ? hash.split(':')[1] : '';
    const saved = localStorage.getItem(STORAGE_KEY);
    return q || hashTab || (saved === 'overview' ? 'sites' : saved) || 'sites';
  }

  function setTab(next) {
    const allowed = permittedKeys(context);
    const fallback = allowed.find((item) => item !== 'overview') || allowed[0];
    activeTab = allowed.includes(next) ? next : fallback;
    localStorage.setItem(STORAGE_KEY, activeTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    url.hash = `control-center:${activeTab}`;
    history.replaceState({}, '', url);
    render();
  }

  function buildOverview() {
    const p = context.permissions || {};
    const items = permittedKeys(context).filter((key) => key !== 'overview').map((key) => {
      const def = tabs[key];
      return `<button class="link-card" data-open-tab="${key}" type="button">
        <div class="banner-row"><span class="icon-bullet">${escapeHtml(def.label[0])}</span><span class="chip primary">${escapeHtml(def.badge)}</span></div>
        <strong>${escapeHtml(def.label)}</strong>
        <div class="muted">${escapeHtml(descriptionForTab(key, p))}</div>
      </button>`;
    }).join('');

    return html`
      <div class="dashboard-shell">
        <div class="card">
          <div class="banner-row">
            <div>
              <h2 class="section-title">Centro de control integral</h2>
              <div class="subtitle">Gobierno multisede, seguridad, abastecimiento, inventario y trazabilidad en una sola capa operativa.</div>
            </div>
            <div class="toolbar">
              ${permittedKeys(context).includes('sites') ? '<button class="btn secondary" data-open-tab="sites">Administrar sedes</button>' : ''}
              ${permittedKeys(context).includes('profiles') ? '<button class="btn secondary" data-open-tab="profiles">Perfiles y roles</button>' : ''}
              ${permittedKeys(context).includes('users') ? '<button class="btn secondary" data-open-tab="users">Usuarios</button>' : ''}
              ${permittedKeys(context).includes('requests') ? '<button class="btn accent" data-open-tab="requests">Solicitudes</button>' : ''}
            </div>
          </div>
        </div>
        <div class="grid four">
          <div class="card kpi"><div><small>Sede activa</small><strong>${escapeHtml(context.current_site?.nombre || '—')}</strong><div class="helper">${context.current_site?.es_principal ? 'Sede central' : 'Sede periférica'}</div></div><span class="chip ${context.current_site?.es_principal ? 'primary' : 'info'}">${context.current_site?.es_principal ? 'Central' : 'Periférica'}</span></div>
          <div class="card kpi"><div><small>Inventario local</small><strong>${formatNumber(context.inventory?.local?.stock_unidades || 0, 3)}</strong><div class="helper">${formatNumber(context.inventory?.local?.productos || 0)} productos</div></div><span class="chip success">Local</span></div>
          <div class="card kpi"><div><small>Inventario general</small><strong>${formatNumber(context.inventory?.general?.stock_unidades || 0, 3)}</strong><div class="helper">${formatNumber(context.inventory?.general?.productos || 0)} productos</div></div><span class="chip info">Consolidado</span></div>
          <div class="card kpi"><div><small>Solicitudes pendientes</small><strong>${formatNumber(context.purchase_request_alert?.pending_count || 0)}</strong><div class="helper">Última marca ${escapeHtml(formatDate(new Date()))}</div></div><span class="chip ${Number(context.purchase_request_alert?.pending_count || 0) > 0 ? 'danger' : 'success'}">Alerta</span></div>
        </div>
        <div class="link-grid">${items || '<div class="card">No hay módulos operativos habilitados para este perfil.</div>'}</div>
      </div>`;
  }

  function descriptionForTab(tabKey, permissions) {
    const map = {
      sites: 'Creación, desactivación controlada, auditoría y estructura automática por sede.',
      profiles: 'Tarjetas de roles, usabilidades por acordeón y adjudicación segura.',
      users: 'Tabla operativa con filtros, suspensión inmediata y formulario lateral.',
      requests: 'Solicitud desde periféricas y revisión central con alerta superior.',
      inventory: 'Pestañas de inventario local y consolidado multisede con desglose por producto.',
      scanners: 'Canales disponibles, auto-detección y perfiles de hardware por sede.',
      dispensing: 'POS con orígenes manual, HCE y fórmula escaneada.',
      audit: 'Bitácora cronológica, filtros avanzados, diff viewer y exportación.',
      permissions: 'Matriz interactiva de permisos por perfil con guardado inmediato.'
    };
    return map[tabKey] || '';
  }

  function frameFor(tabKey) {
    const def = tabs[tabKey];
    if (!def?.path) return '';
    const src = `${def.path}${def.path.includes('?') ? '&' : '?'}tab=${encodeURIComponent(tabKey)}`;
    return `<div class="card"><iframe class="hub-frame" data-hub-frame src="${src}" title="${escapeHtml(def.label)}" style="width:100%;border:0;min-height:${isEmbedded() ? 920 : 1080}px;border-radius:16px"></iframe></div>`;
  }

  function bind() {
    root.querySelectorAll('[data-open-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.openTab)));
    root.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));
    notifyParentHeight();
  }

  function render() {
    const allowed = permittedKeys(context);
    if (!allowed.length) {
      root.innerHTML = '<div class="wrap"><div class="card empty-state"><h2>Acceso restringido</h2><p>No tienes módulos activos dentro del centro de control.</p></div></div>';
      return;
    }
    if (!allowed.includes(activeTab)) activeTab = allowed[0];
    root.innerHTML = html`
      <div class="wrap">
        <div class="card">
          <div class="banner-row">
            <div>
              <span class="chip primary">Centro de control</span>
              <h2 class="section-title" style="margin-top:10px">Arquitectura operativa aplicada al dashboard</h2>
              <div class="subtitle">Las directrices UX/UI se aplican sobre gestor de sedes, perfiles, usuarios, solicitudes, inventario, lectores, dispensación, trazabilidad y matriz de permisos.</div>
            </div>
            <div class="toolbar"><a class="btn secondary" href="/">Volver a la app</a></div>
          </div>
          <div class="tabs" style="margin-top:14px">${allowed.map((key) => `<button type="button" class="tab-btn ${activeTab === key ? 'active' : ''}" data-tab="${key}">${escapeHtml(tabs[key].label)}</button>`).join('')}</div>
        </div>
        ${activeTab === 'overview' ? buildOverview() : frameFor(activeTab)}
      </div>`;
    bind();
  }

  async function init() {
    context = await api('/api/multisite/context');
    const allowed = permittedKeys(context);
    const fallback = allowed.find((item) => item !== 'overview') || allowed[0];
    activeTab = allowed.includes(requestedTab()) ? requestedTab() : fallback;
    render();
  }

  window.addEventListener('hashchange', () => setTab(requestedTab()));
  init().catch((error) => {
    root.innerHTML = `<div class="wrap"><div class="card empty-state"><strong>Error:</strong> ${escapeHtml(error.message || 'No fue posible cargar el centro de control.')}</div></div>`;
    notifyParentHeight();
  });
})();
