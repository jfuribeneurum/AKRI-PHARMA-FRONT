
(function () {
  const STYLE_ID = 'akri-ops-bridge-style';
  const STORAGE_KEY = 'akri_control_center_tab';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `.akri-ops-nav-link { display:flex; align-items:center; justify-content:space-between; gap:.5rem; } .akri-ops-nav-link .badge { font-size:.72rem; padding:.2rem .45rem; border-radius:999px; background:#F5F3FF; color:#6D28D9; border:1px solid #DDD6FE; } .akri-ops-toplink { text-decoration:none; }`;
    document.head.appendChild(style);
  }
  function removeLegacyLauncher() { document.getElementById('akri-v15-launcher')?.remove(); document.getElementById('akri-v15-launcher-style')?.remove(); }
  function preferredTab() { return localStorage.getItem(STORAGE_KEY) || 'overview'; }
  function controlCenterHref() { return `/dashboard#control-center:${preferredTab()}`; }
  function navigateToControlCenter(event) {
    event?.preventDefault?.();
    const tab = preferredTab();
    const route = window.location.pathname;
    if (route === '/dashboard' || route.endsWith('/dashboard')) {
      history.replaceState({}, '', `${window.location.pathname}${window.location.search}#control-center:${tab}`);
      window.dispatchEvent(new Event('hashchange'));
      setTimeout(() => document.getElementById('akri-control-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      return;
    }
    window.location.href = `/dashboard#control-center:${tab}`;
  }
  function bindLink(element) { if (!element || element.dataset.bound) return; element.dataset.bound = 'true'; element.addEventListener('click', navigateToControlCenter); }
  function ensureSidebarLink() {
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;
    let anchor = nav.querySelector('[data-akri-ops-link]');
    if (!anchor) { anchor = document.createElement('a'); anchor.className = 'akri-ops-nav-link'; anchor.dataset.akriOpsLink = 'true'; anchor.innerHTML = '<span>Centro de control</span><span class="badge">v26</span>'; nav.appendChild(anchor); }
    anchor.href = controlCenterHref(); bindLink(anchor);
  }
  function ensureTopbarButton() {
    const actions = document.querySelector('.topbar-actions');
    if (!actions) return;
    let btn = actions.querySelector('[data-akri-ops-top]');
    if (!btn) { btn = document.createElement('a'); btn.className = 'btn secondary akri-ops-toplink'; btn.dataset.akriOpsTop = 'true'; btn.textContent = 'Centro de control'; const logout = Array.from(actions.querySelectorAll('button, a')).find((el) => (el.textContent || '').trim().toLowerCase() === 'salir'); if (logout) actions.insertBefore(btn, logout); else actions.appendChild(btn); }
    btn.href = controlCenterHref(); bindLink(btn);
  }
  function tick() { injectStyles(); removeLegacyLauncher(); ensureSidebarLink(); ensureTopbarButton(); }
  document.addEventListener('DOMContentLoaded', tick); window.addEventListener('load', tick); window.addEventListener('hashchange', tick); setInterval(tick, 1500);
})();
