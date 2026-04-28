(function(){
function sessionToken(){ return localStorage.getItem('akri_token') || ''; }
function sessionUser(){ try { return JSON.parse(localStorage.getItem('akri_user') || 'null'); } catch { return null; } }
function isEmbedded(){ return new URLSearchParams(window.location.search).get('embedded') === '1'; }
async function api(path, options={}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  const shouldSerialize = body !== undefined
    && body !== null
    && !(body instanceof FormData)
    && !(body instanceof Blob)
    && !(body instanceof ArrayBuffer)
    && !(body instanceof URLSearchParams)
    && typeof body !== 'string';
  if (shouldSerialize) body = JSON.stringify(body);
  const isBodyJson = body !== undefined && !(body instanceof FormData);
  if (isBodyJson && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const token = sessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...options, body, headers });
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  return payload.data ?? payload;
}
function html(strings, ...values){ return strings.map((s, i) => s + (values[i] ?? '')).join(''); }
function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function formatDate(v){ if(!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(); }
function formatDateShort(v){ if(!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(); }
function currency(v){ const n = Number(v ?? 0); return Number.isFinite(n) ? n.toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:2}) : '—'; }
function number(v, digits=0){ const n = Number(v ?? 0); return Number.isFinite(n) ? n.toLocaleString('es-CO',{minimumFractionDigits:digits,maximumFractionDigits:digits}) : '0'; }
const formatNumber = number;
const formatCurrency = currency;
const formatShortDate = formatDateShort;
function requireSession(){ if(!sessionToken()){ document.body.innerHTML = '<div class="wrap"><div class="card"><h1>Sesión requerida</h1><p>Inicia sesión en AkriPharmacy antes de usar los módulos operativos.</p><a class="btn" href="/">Ir al inicio</a></div></div>'; throw new Error('no-session'); } }
async function switchSite(idSede){ const payload = await api('/api/auth/select-site', { method:'POST', body: { id_sede: Number(idSede) } }); localStorage.setItem('akri_token', payload.token); localStorage.setItem('akri_user', JSON.stringify(payload.user)); localStorage.setItem(`akri_site_choice_${payload.user.id}`, String(payload.user.id_sede)); return payload; }
function notifyParentHeight(){
  if (!isEmbedded() || window.parent === window) return;
  const send = () => {
    const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 640);
    window.parent.postMessage({ type: 'akri-ops-height', path: window.location.pathname, height }, window.location.origin);
  };
  requestAnimationFrame(send);
  window.addEventListener('load', send);
  window.addEventListener('resize', send);
  document.addEventListener('DOMContentLoaded', send);
  const observer = new MutationObserver(() => requestAnimationFrame(send));
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
}
function ensureToastRoot(){
  let root = document.getElementById('akri-toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'akri-toast-root';
    root.className = 'toast-stack';
    document.body.appendChild(root);
  }
  return root;
}
function toast(message, variant='info', timeout=3400){
  const root = ensureToastRoot();
  const el = document.createElement('div');
  el.className = `toast ${variant}`;
  el.innerHTML = `<strong>${escapeHtml(variant === 'error' ? 'Error' : variant === 'success' ? 'Hecho' : 'Info')}</strong><div>${escapeHtml(message)}</div>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 240); }, timeout);
}
const showToast = toast;
function modalShell(content){
  const host = document.createElement('div');
  host.className = 'modal-backdrop';
  host.innerHTML = `<div class="modal-shell">${content}</div>`;
  host.addEventListener('click', (event) => { if (event.target === host) host.remove(); });
  document.body.appendChild(host);
  return host;
}
function openModal(titleOrContent, maybeContent){
  const content = maybeContent !== undefined
    ? `<div class="modal-head"><div><h2 style="margin:.35rem 0 0">${escapeHtml(titleOrContent)}</h2></div><button class="btn secondary" data-close-modal>Cerrar</button></div><div class="modal-body">${maybeContent}</div>`
    : String(titleOrContent ?? '');
  const host = modalShell(content);
  host.querySelectorAll('[data-close-modal]').forEach((node) => node.addEventListener('click', () => host.remove()));
  return host;
}
function closeModal(target){
  const node = target?.target ?? target ?? document.activeElement;
  const backdrop = node?.closest ? node.closest('.modal-backdrop') : document.querySelector('.modal-backdrop');
  if (backdrop) backdrop.remove();
}
function drawerShell(content){
  const host = document.createElement('div');
  host.className = 'drawer-backdrop';
  host.innerHTML = `<aside class="drawer-shell">${content}</aside>`;
  host.addEventListener('click', (event) => { if (event.target === host) host.remove(); });
  document.body.appendChild(host);
  return host;
}
function fileToDataUrl(file){ return new Promise((resolve,reject)=>{ const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('No fue posible leer el archivo')); r.readAsDataURL(file); }); }
function groupBy(list, keyFn){ return list.reduce((acc, item) => { const key = keyFn(item); (acc[key] ||= []).push(item); return acc; }, {}); }
function debounce(fn, wait=250){ let timer = null; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; }
function downloadBlob(filename, blob){ const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1200); }
function downloadText(filename, text, mime='text/plain;charset=utf-8'){ downloadBlob(filename, new Blob([text], { type: mime })); }
function csvEscape(value){ const text = String(value ?? ''); return /[",\n;]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text; }
function downloadCsv(filename, rows = [], columns = []){ const header = columns.map((c)=> csvEscape(c.label || c.key)).join(','); const body = rows.map((row)=> columns.map((c)=> csvEscape(row?.[c.key])).join(',')).join('\n'); downloadText(filename, `${header}\n${body}`, 'text/csv;charset=utf-8'); }
function printHtml(title, bodyHtml){
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) { toast('El navegador bloqueó la ventana de impresión.', 'error'); return; }
  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111827}table{width:100%;border-collapse:collapse}th,td{border:1px solid #CBD5E1;padding:8px;text-align:left;font-size:12px}th{background:#F8FAFC}</style></head><body>${bodyHtml}</body></html>`);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 200);
}
(function applyEmbeddedMode(){
  if (!isEmbedded()) return;
  document.documentElement.classList.add('embedded-mode');
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('embedded-mode');
    notifyParentHeight();
  });
})();
window.requireSession = requireSession;
window.akriOps = { api, html, escapeHtml, formatDate, formatDateShort, formatCurrency, formatShortDate, currency, formatNumber, number, requireSession, sessionUser, sessionToken, switchSite, isEmbedded, notifyParentHeight, toast, showToast, modalShell, openModal, closeModal, drawerShell, fileToDataUrl, groupBy, debounce, downloadText, downloadCsv, printHtml };
})();
