(function () {
  const STYLE_ID = 'akri-site-governance-style';
  const PANEL_ID = 'akri-site-governance';
  let lastRoute = '';
  let cachedContext = null;

  function token(){ return localStorage.getItem('akri_token') || ''; }
  function user(){ try { return JSON.parse(localStorage.getItem('akri_user') || 'null'); } catch { return null; } }
  function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function currentRoute(){ return `${window.location.pathname}${window.location.search}${window.location.hash}`; }
  function topbarActions(){ return document.querySelector('.topbar .actions, .app-header .actions, .header-actions, .navbar-actions'); }
  function dashboardAnchor(){ const page = document.querySelector('.content .page'); const pageHeader = page?.querySelector('.page-header'); return page && pageHeader && (document.querySelector('.page-title')?.textContent || '').toLowerCase().includes('dashboard') ? { page, pageHeader } : null; }

  function injectStyles(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .akri-gov-actions{display:flex;gap:.55rem;flex-wrap:wrap;align-items:center}.akri-gov-btn{border:1px solid #E2E8F0;background:#fff;color:#111827;border-radius:999px;padding:.5rem .8rem;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:.45rem}.akri-gov-btn:hover{border-color:#6D28D9;color:#6D28D9}.akri-gov-btn.alert{background:#FFF7ED;border-color:#FDBA74;color:#9A3412}.akri-gov-btn.alert .count{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#EF4444;color:#fff;font-size:12px;font-weight:900;animation:akri-pulse 1.4s infinite}
      .akri-gov-dropdown{position:relative}.akri-gov-menu{position:absolute;top:calc(100% + 8px);right:0;min-width:260px;background:#fff;border:1px solid #E2E8F0;border-radius:16px;box-shadow:0 16px 36px rgba(17,24,39,.12);padding:10px;display:none;z-index:1100}.akri-gov-dropdown.open .akri-gov-menu{display:block}.akri-gov-menu button,.akri-gov-menu a{display:flex;width:100%;justify-content:space-between;gap:10px;border:none;background:#fff;border-radius:12px;padding:10px 12px;text-align:left;cursor:pointer;text-decoration:none;color:#111827;font:inherit}.akri-gov-menu button:hover,.akri-gov-menu a:hover{background:#F8FAFC}
      .akri-gov-card{margin:0 0 1rem;padding:1rem 1.1rem;background:#fff;border:1px solid #E2E8F0;border-radius:18px;box-shadow:0 16px 40px rgba(17,24,39,.08)}.akri-gov-card h3{margin:0 0 .4rem}.akri-gov-sub,.akri-gov-note{margin:0;color:#64748B;line-height:1.45}.akri-gov-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;margin-top:1rem}.akri-gov-stat{border:1px solid #E2E8F0;border-radius:14px;padding:.85rem;background:#F8FAFC}.akri-gov-stat small{display:block;color:#64748B;margin-bottom:.3rem}.akri-gov-stat strong{display:block;font-size:1.05rem}
      .akri-gov-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.42);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1200}.akri-gov-modal{width:min(760px,100vw);max-height:90vh;overflow:auto;background:#fff;border:1px solid #E2E8F0;border-radius:22px;padding:18px;box-shadow:0 18px 44px rgba(15,23,42,.18)}.akri-gov-modal .list{display:grid;gap:10px;margin-top:14px}.akri-gov-modal .row{display:flex;justify-content:space-between;gap:14px;align-items:center;border:1px solid #E2E8F0;border-radius:14px;padding:12px}.akri-gov-modal .toolbar{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}.akri-gov-modal button,.akri-gov-modal a{border:1px solid #E2E8F0;background:#fff;border-radius:12px;padding:10px 12px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none;color:#111827}.akri-gov-link{color:#6D28D9;font-weight:800;text-decoration:none}
      @keyframes akri-pulse{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,.35)}70%{transform:scale(1.05);box-shadow:0 0 0 12px rgba(239,68,68,0)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,0)}}
      @media (max-width:1020px){.akri-gov-stats{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function fetchContext(){
    const res = await fetch('/api/multisite/context', { headers: { Authorization: `Bearer ${token()}` } });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.message || payload.error || `HTTP ${res.status}`);
    return payload.data || payload;
  }

  function closeModal(){ document.querySelector('.akri-gov-modal-backdrop')?.remove(); }

  async function changeSite(idSede){
    const response = await fetch('/api/auth/select-site', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token()}` }, body: JSON.stringify({ id_sede:Number(idSede) }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    localStorage.setItem('akri_token', payload.data.token);
    localStorage.setItem('akri_user', JSON.stringify(payload.data.user));
    window.location.reload();
  }

  function siteModal(context){
    closeModal();
    const selectedSiteId = Number(user()?.id_sede || 0);
    const backdrop = document.createElement('div');
    backdrop.className = 'akri-gov-modal-backdrop';
    backdrop.innerHTML = `<div class="akri-gov-modal"><span class="chip primary">🏢 Gestor de sedes</span><h3 style="margin:8px 0 6px">Cambiar contexto de sede</h3><p class="akri-gov-sub">Selecciona la sede activa para ingreso, dispensación, inventario local y trazabilidad.</p><div class="list">${(context.authorized_sites || []).map((site) => `<div class="row"><div><strong>${escapeHtml(site.nombre)}</strong><div class="akri-gov-note">${escapeHtml(site.codigo)} · ${site.es_principal ? 'Sede central' : 'Sede periférica'}</div></div><button data-select-site="${site.id_sede}">${selectedSiteId === Number(site.id_sede) ? 'Usando esta sede' : 'Elegir'}</button></div>`).join('')}</div><div class="toolbar"><a class="akri-gov-link" href="/dashboard#control-center:sites">⚙️ Administrar sedes</a><button data-close-gov="1">Cerrar</button></div></div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
    backdrop.querySelector('[data-close-gov]')?.addEventListener('click', closeModal);
    backdrop.querySelectorAll('[data-select-site]').forEach((button) => button.addEventListener('click', async () => {
      try { await changeSite(button.dataset.selectSite); } catch (error) { alert(error.message); }
    }));
  }

  function purchaseAlertModal(context){
    closeModal();
    const items = context.purchase_request_alert?.items || [];
    const backdrop = document.createElement('div');
    backdrop.className = 'akri-gov-modal-backdrop';
    backdrop.innerHTML = `<div class="akri-gov-modal"><span class="chip accent">solicitud de compra</span><h3 style="margin:8px 0 6px">Solicitudes recibidas por sede central</h3><div class="list">${items.length ? items.map((item) => `<div class="row"><div><strong>${escapeHtml(item.consecutivo)}</strong><div class="akri-gov-note">${escapeHtml(item.sede_origen)} · ${escapeHtml(item.solicitado_por)} · ${new Date(item.fecha_solicitud).toLocaleString()}</div></div><a class="akri-gov-link" href="/dashboard#control-center:requests">Abrir</a></div>`).join('') : '<div class="akri-gov-note">No hay solicitudes pendientes.</div>'}</div><div class="toolbar"><button data-close-gov="1">Cerrar</button></div></div>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
    backdrop.querySelector('[data-close-gov]')?.addEventListener('click', closeModal);
  }

  function renderTopbar(context){
    const container = topbarActions();
    if (!container) return;
    container.querySelectorAll('[data-akri-gov]').forEach((node) => node.remove());
    const wrapper = document.createElement('div');
    wrapper.className = 'akri-gov-actions';
    wrapper.dataset.akriGov = '1';
    const dropdown = document.createElement('div');
    dropdown.className = 'akri-gov-dropdown';
    dropdown.innerHTML = `<button class="akri-gov-btn" type="button">🏢 ${escapeHtml(context.current_site?.nombre || 'Sede')}</button><div class="akri-gov-menu"><button type="button" data-open-sites="1"><span>Cambiar sede activa</span><span>→</span></button><a href="/dashboard#control-center:sites"><span>⚙️ Administrar sedes</span><span>→</span></a></div>`;
    dropdown.querySelector('button.akri-gov-btn')?.addEventListener('click', () => dropdown.classList.toggle('open'));
    dropdown.querySelector('[data-open-sites]')?.addEventListener('click', () => { dropdown.classList.remove('open'); siteModal(context); });
    wrapper.appendChild(dropdown);
    if (context.permissions.can_review_requests) {
      const alert = document.createElement('button');
      alert.className = 'akri-gov-btn alert';
      alert.innerHTML = `solicitud de compra <span class="count">${context.purchase_request_alert?.pending_count || 0}</span>`;
      alert.addEventListener('click', () => purchaseAlertModal(context));
      wrapper.appendChild(alert);
    }
    if (context.permissions.can_manage_profiles) {
      const profiles = document.createElement('a');
      profiles.className = 'akri-gov-btn';
      profiles.href = '/dashboard#control-center:profiles';
      profiles.textContent = 'Gestor de perfiles';
      wrapper.appendChild(profiles);
    }
    if (context.permissions.can_manage_users) {
      const users = document.createElement('a');
      users.className = 'akri-gov-btn';
      users.href = '/dashboard#control-center:users';
      users.textContent = 'Gestor de usuarios';
      wrapper.appendChild(users);
    }
    container.prepend(wrapper);
  }

  function renderDashboardPanel(context){
    const anchor = dashboardAnchor();
    if (!anchor) return;
    document.getElementById(PANEL_ID)?.remove();
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'akri-gov-card';
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h3>Gobierno multisede y experiencia operativa</h3>
          <p class="akri-gov-sub">El centro de control aplica tablas operativas, tarjetas de perfiles, filtros avanzados, solicitudes entre sedes y matriz de permisos con acceso según el perfil asignado.</p>
        </div>
        <div class="akri-gov-actions">
          <a class="akri-gov-btn" href="/dashboard#control-center:sites">Sedes</a>
          <a class="akri-gov-btn" href="/dashboard#control-center:profiles">Perfiles</a>
          <a class="akri-gov-btn" href="/dashboard#control-center:users">Usuarios</a>
          <a class="akri-gov-btn" href="/dashboard#control-center:requests">Solicitudes</a>
        </div>
      </div>
      <div class="akri-gov-stats">
        <div class="akri-gov-stat"><small>Sede activa</small><strong>${escapeHtml(context.current_site?.nombre || '—')}</strong><div class="akri-gov-note">${context.current_site?.es_principal ? 'Sede central' : 'Sede periférica'}</div></div>
        <div class="akri-gov-stat"><small>Inventario local</small><strong>${Number(context.inventory?.local?.stock_unidades || 0).toFixed(3)}</strong><div class="akri-gov-note">${Number(context.inventory?.local?.productos || 0)} productos</div></div>
        <div class="akri-gov-stat"><small>Solicitudes a central</small><strong>${context.current_site?.es_principal ? Number(context.purchase_request_alert?.pending_count || 0) : 'Habilitado'}</strong><div class="akri-gov-note">${context.current_site?.es_principal ? 'Visible en el banner superior' : 'Disponible para la sede periférica'}</div></div>
      </div>`;
    anchor.pageHeader.insertAdjacentElement('afterend', panel);
  }

  async function refresh(){
    if (!token()) return;
    try {
      injectStyles();
      const context = await fetchContext();
      cachedContext = context;
      renderTopbar(context);
      renderDashboardPanel(context);
    } catch (error) {
      console.warn('[akri-site-governance]', error.message);
    }
  }

  function loop(){
    const route = currentRoute();
    if (route !== lastRoute) { lastRoute = route; refresh(); }
    else if (cachedContext && dashboardAnchor()) { renderTopbar(cachedContext); renderDashboardPanel(cachedContext); }
  }

  window.setInterval(loop, 2500);
  window.addEventListener('load', refresh);
  window.addEventListener('hashchange', refresh);
})();
