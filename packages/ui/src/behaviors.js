/**
 * Flavor DS behaviours — the keyboard and focus contracts behind the CSS-first components.
 *
 * Framework-agnostic on purpose: the system is consumed as HTML + CSS in most stacks
 * (that is what the MCP's adapt_project promises), so the behaviour that makes a menu a
 * menu cannot live only in a React wrapper. Each behaviour attaches to a data attribute
 * and follows the WAI-ARIA Authoring Practices pattern it names.
 *
 *   import { upgrade } from '@flavor-ds/ui/behaviors';
 *   upgrade(document);          // once, or per subtree after you render into it
 *
 * Markup contracts (roles are added if missing, never overwritten):
 *   [data-fds-tabs]      → .fds-tab[role=tab] children + [role=tabpanel] by aria-controls
 *   [data-fds-menu]      → a trigger button + .fds-menu[role=menu] with .fds-menu-item
 *   [data-fds-dialog]    → <dialog class="fds-dialog"> opened by [data-fds-dialog-open="id"]
 *   [data-fds-listbox]   → a button + [role=listbox] with [role=option] (custom select)
 *   [data-fds-tooltip]   → any element with data-fds-tooltip="text" (hover + focus, delayed)
 *   [data-fds-truncate]  → single-line ellipsis; WHEN it actually truncates, a tooltip reveals the
 *                          full text on hover/focus. The full text stays in the DOM (screen readers
 *                          read it whole — CSS ellipsis is visual only) and is also mirrored to
 *                          aria-label only if the element clips via JS, never for plain CSS ellipsis.
 *
 * The React wrappers in components.tsx call these same functions, so behaviour is
 * defined once and identical in every stack.
 */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const isVisible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
const focusables = (root) => [...root.querySelectorAll(FOCUSABLE)].filter(isVisible);
let uid = 0;
const id = (el, prefix) => (el.id ||= `${prefix}-${++uid}`);
const upgraded = new WeakSet();
const once = (el) => { if (upgraded.has(el)) return false; upgraded.add(el); return true; };

/* ------------------------------------------------------------------ tabs
 * APG "Tabs": arrow keys move focus AND selection (automatic activation), Home/End,
 * roving tabindex so only the active tab is in the tab sequence. */
export function tabs(root) {
  if (!once(root)) return;
  const list = root.querySelector('[role="tablist"]') || root;
  // Direct children only. A tabpanel can legitimately contain ANOTHER tabs widget (the
  // component docs preview a Tabs inside a tabbed page); a deep query would merge them.
  const tabsEl = [...list.querySelectorAll(':scope > .fds-tab, :scope > [role="tab"]')];
  if (!tabsEl.length) return;
  const horizontal = list.getAttribute('aria-orientation') !== 'vertical';
  const rtl = getComputedStyle(list).direction === 'rtl';
  list.setAttribute('role', 'tablist');
  const panelOf = (t) => t.getAttribute('aria-controls') ? document.getElementById(t.getAttribute('aria-controls')) : null;

  const select = (t, focus = true) => {
    for (const x of tabsEl) {
      const on = x === t;
      x.setAttribute('role', 'tab');
      x.setAttribute('aria-selected', String(on));
      x.tabIndex = on ? 0 : -1;
      const p = panelOf(x);
      if (p) { p.setAttribute('role', 'tabpanel'); p.hidden = !on; if (!p.hasAttribute('tabindex')) p.tabIndex = 0; if (!p.getAttribute('aria-labelledby')) p.setAttribute('aria-labelledby', id(x, 'fds-tab')); }
    }
    if (focus) t.focus();
    root.dispatchEvent(new CustomEvent('fds:change', { bubbles: true, detail: { tab: t } }));
  };
  const initial = tabsEl.find((t) => t.getAttribute('aria-selected') === 'true') || tabsEl[0];
  select(initial, false);

  list.addEventListener('click', (e) => { const t = e.target.closest('.fds-tab, [role="tab"]'); if (t && tabsEl.includes(t)) select(t); });
  list.addEventListener('keydown', (e) => {
    const i = tabsEl.indexOf(document.activeElement); if (i < 0) return;
    const prev = horizontal ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp';
    const next = horizontal ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown';
    let j = null;
    if (e.key === next) j = (i + 1) % tabsEl.length;
    else if (e.key === prev) j = (i - 1 + tabsEl.length) % tabsEl.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabsEl.length - 1;
    if (j !== null) { e.preventDefault(); select(tabsEl[j]); }
  });
}

/* ------------------------------------------------------------------ menu
 * APG "Menu button": Enter/Space/ArrowDown open and focus first item, ArrowUp opens and
 * focuses last; inside: arrows wrap, Home/End, typeahead by first letter, Escape closes
 * and returns focus to the trigger, Tab closes, click-outside closes. */
export function menu(root) {
  if (!once(root)) return;
  const trigger = root.querySelector('button, [role="button"]');
  const list = root.querySelector('.fds-menu, [role="menu"]');
  if (!trigger || !list) return;
  list.setAttribute('role', 'menu');
  list.id ||= id(list, 'fds-menu');
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-controls', list.id);
  trigger.setAttribute('aria-expanded', 'false');
  const items = () => [...list.querySelectorAll('.fds-menu-item, [role="menuitem"]')].filter((i) => i.getAttribute('aria-disabled') !== 'true' && isVisible(i));
  for (const it of list.querySelectorAll('.fds-menu-item, [role="menuitem"]')) { it.setAttribute('role', 'menuitem'); it.tabIndex = -1; }

  const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';
  const open = (focusIndex = 0) => {
    list.hidden = false; list.dataset.open = 'true';
    trigger.setAttribute('aria-expanded', 'true');
    const its = items(); const t = focusIndex < 0 ? its[its.length - 1] : its[focusIndex];
    if (t) t.focus();
    document.addEventListener('pointerdown', onOutside, true);
  };
  const close = (refocus = true) => {
    list.hidden = true; delete list.dataset.open;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    if (refocus) trigger.focus();
  };
  const onOutside = (e) => { if (!root.contains(e.target)) close(false); };
  close(false);

  trigger.addEventListener('click', () => (isOpen() ? close() : open(0)));
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); open(-1); }
  });
  let typed = '', typedAt = 0;
  list.addEventListener('keydown', (e) => {
    const its = items(); const i = its.indexOf(document.activeElement);
    const go = (j) => { e.preventDefault(); its[(j + its.length) % its.length].focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(its.length - 1);
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close(false);
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.activeElement.click(); }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now(); typed = now - typedAt < 500 ? typed + e.key : e.key; typedAt = now;
      const start = typed.length === 1 ? i + 1 : i;
      const hit = [...its.slice(start), ...its.slice(0, start)].find((it) => it.textContent.trim().toLowerCase().startsWith(typed.toLowerCase()));
      if (hit) { e.preventDefault(); hit.focus(); }
    }
  });
  list.addEventListener('click', (e) => { if (e.target.closest('[role="menuitem"]')) close(); });
}

/* ------------------------------------------------------------------ dialog
 * APG "Dialog (modal)" on the native <dialog>: showModal() gives us the top layer, ::backdrop,
 * Escape and inertness of the rest of the page for free. What the platform does NOT give
 * us is restoring focus to the opener, focusing the right first element, and keeping
 * Tab inside — those are done here. */
export function dialog(dlg) {
  if (!once(dlg)) return;
  dlg.setAttribute('role', dlg.getAttribute('role') || 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  if (!dlg.getAttribute('aria-labelledby')) { const h = dlg.querySelector('h1,h2,h3,.fds-dialog-title'); if (h) dlg.setAttribute('aria-labelledby', id(h, 'fds-dialog-title')); }
  let opener = null;
  const openDialog = (from) => {
    opener = from || document.activeElement;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    // Focus the first thing a user would act on: an explicitly marked element, else the
    // first field, else the first focusable that isn't the close button, else the dialog.
    const first = dlg.querySelector('[autofocus], [data-fds-autofocus]') || dlg.querySelector('input,select,textarea') || focusables(dlg).find((f) => !f.matches('[data-fds-dialog-close], .fds-dialog-close')) || focusables(dlg)[0];
    (first || dlg).focus();
    dlg.dispatchEvent(new CustomEvent('fds:open', { bubbles: true }));
  };
  const closeDialog = () => { if (dlg.open) dlg.close(); };
  dlg.addEventListener('close', () => { if (opener && document.contains(opener)) opener.focus(); dlg.dispatchEvent(new CustomEvent('fds:close', { bubbles: true })); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = focusables(dlg); if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // Click on the backdrop (outside the dialog's own box) closes it.
  dlg.addEventListener('click', (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
  });
  for (const c of dlg.querySelectorAll('[data-fds-dialog-close], .fds-dialog-close')) c.addEventListener('click', closeDialog);
  const key = dlg.id;
  if (key) for (const o of document.querySelectorAll(`[data-fds-dialog-open="${key}"]`)) {
    o.setAttribute('aria-haspopup', 'dialog');
    o.addEventListener('click', () => openDialog(o));
  }
  dlg.fdsOpen = openDialog; dlg.fdsClose = closeDialog;
}

/* ------------------------------------------------------------------ listbox (custom select)
 * APG "Select-only combobox": the button shows the value; ArrowDown/Up/Enter/Space open;
 * arrows move the highlighted option, Home/End, typeahead, Enter/Space commit, Escape
 * cancels; aria-activedescendant so focus stays on the button. Native <select> is still
 * the right default — use this only when the options need rich content. */
export function listbox(root) {
  if (!once(root)) return;
  const btn = root.querySelector('button, [role="combobox"]');
  const list = root.querySelector('[role="listbox"], .fds-listbox');
  if (!btn || !list) return;
  list.setAttribute('role', 'listbox'); list.id ||= id(list, 'fds-listbox'); list.tabIndex = -1;
  btn.setAttribute('role', 'combobox'); btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-controls', list.id); btn.setAttribute('aria-expanded', 'false');
  const opts = () => [...list.querySelectorAll('[role="option"], .fds-option')].filter((o) => o.getAttribute('aria-disabled') !== 'true');
  for (const o of opts()) { o.setAttribute('role', 'option'); id(o, 'fds-option'); }
  const label = btn.querySelector('[data-fds-value]') || btn;
  let active = opts().findIndex((o) => o.getAttribute('aria-selected') === 'true'); if (active < 0) active = 0;

  const highlight = (i) => {
    const os = opts(); active = (i + os.length) % os.length;
    os.forEach((o, k) => o.classList.toggle('is-active', k === active));
    btn.setAttribute('aria-activedescendant', os[active].id);
    os[active].scrollIntoView?.({ block: 'nearest' });
  };
  const commit = () => {
    const os = opts(); os.forEach((o, k) => o.setAttribute('aria-selected', String(k === active)));
    label.textContent = os[active].textContent.trim();
    root.dispatchEvent(new CustomEvent('fds:change', { bubbles: true, detail: { value: os[active].dataset.value ?? os[active].textContent.trim(), option: os[active] } }));
    close();
  };
  const isOpen = () => btn.getAttribute('aria-expanded') === 'true';
  const open = () => { list.hidden = false; btn.setAttribute('aria-expanded', 'true'); highlight(active); document.addEventListener('pointerdown', onOutside, true); };
  const close = () => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.removeAttribute('aria-activedescendant'); document.removeEventListener('pointerdown', onOutside, true); btn.focus(); };
  const onOutside = (e) => { if (!root.contains(e.target)) { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', onOutside, true); } };
  list.hidden = true;
  const sel = opts()[active]; if (sel && sel.getAttribute('aria-selected') === 'true') label.textContent = sel.textContent.trim();

  btn.addEventListener('click', () => (isOpen() ? close() : open()));
  let typed = '', typedAt = 0;
  btn.addEventListener('keydown', (e) => {
    const os = opts();
    if (!isOpen()) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); highlight(0); }
    else if (e.key === 'End') { e.preventDefault(); highlight(os.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { commit(); }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now(); typed = now - typedAt < 500 ? typed + e.key : e.key; typedAt = now;
      const j = os.findIndex((o, k) => k > active && o.textContent.trim().toLowerCase().startsWith(typed.toLowerCase()));
      const k = j >= 0 ? j : os.findIndex((o) => o.textContent.trim().toLowerCase().startsWith(typed.toLowerCase()));
      if (k >= 0) highlight(k);
    }
  });
  list.addEventListener('click', (e) => { const o = e.target.closest('[role="option"]'); if (!o) return; active = opts().indexOf(o); commit(); });
  list.addEventListener('pointermove', (e) => { const o = e.target.closest('[role="option"]'); if (o) highlight(opts().indexOf(o)); });
}

/* ------------------------------------------------------------------ tooltip
 * APG "Tooltip": shows on hover AND focus (never hover only — keyboard users), after a
 * short delay so it does not flicker across a toolbar; hides on blur, mouseleave and
 * Escape; role=tooltip linked by aria-describedby. Never the only place information lives. */
export function tooltip(el) {
  if (!once(el)) return;
  const text = el.getAttribute('data-fds-tooltip'); if (!text) return;
  const tip = document.createElement('div');
  tip.className = 'fds-tooltip'; tip.setAttribute('role', 'tooltip'); tip.textContent = text; tip.hidden = true;
  tip.id = `fds-tip-${++uid}`;
  document.body.appendChild(tip);
  el.setAttribute('aria-describedby', [el.getAttribute('aria-describedby'), tip.id].filter(Boolean).join(' '));
  if (!el.matches(FOCUSABLE)) el.tabIndex = 0;
  let timer;
  const place = () => {
    const r = el.getBoundingClientRect(); tip.style.position = 'fixed';
    tip.style.insetInlineStart = 'auto'; tip.style.left = `${r.left + r.width / 2}px`; tip.style.top = `${r.top - 8}px`; tip.style.translate = '-50% -100%';
  };
  const show = () => { clearTimeout(timer); timer = setTimeout(() => { place(); tip.hidden = false; }, 150); };
  const hide = () => { clearTimeout(timer); tip.hidden = true; };
  el.addEventListener('mouseenter', show); el.addEventListener('mouseleave', hide);
  el.addEventListener('focus', show); el.addEventListener('blur', hide);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}

/* ------------------------------------------------------------------ large title (iOS / M3 large app bar)
 * The bar starts expanded (data-large) and collapses to the standard height once its
 * scroll container moves past a threshold; the title moves from the leading edge to the
 * centre. Purely presentational — no ARIA change, the heading text is the same. */
export function largeTitle(bar) {
  if (!once(bar)) return;
  const scroller = bar.getAttribute('data-scroll-target') ? document.getElementById(bar.getAttribute('data-scroll-target')) : bar.nextElementSibling;
  if (!scroller) return;
  const update = () => { const y = scroller.scrollTop; bar.toggleAttribute('data-collapsed', y > 24); bar.toggleAttribute('data-scrolled', y > 0); };
  scroller.addEventListener('scroll', update, { passive: true }); update();
}

/* ------------------------------------------------------------------ upgrade */
/* ------------------------------------------------------------------ truncate
 * Truncation is a layout fact, not a content decision: the element keeps its full text (so
 * assistive tech reads all of it), gets a CSS ellipsis, and — only when the text really
 * overflows — a tooltip with the full text on hover AND focus. Re-evaluated on resize, so a
 * wider frame or a smaller type scale removes the tooltip again. */
const truncated = new WeakSet();
export function truncate(el) {
  if (truncated.has(el)) return; truncated.add(el);   // separate registry: tooltip() below needs once(host)
  el.classList.add('fds-truncate');
  // The hover/focus HOST is the nearest interactive ancestor when there is one (a list row, a link):
  // that is what the pointer and the tab key actually reach; a bare text node hosts itself.
  const host = el.closest('button, a[href], [tabindex], [role="button"], [role="option"], [role="menuitem"]') || el;
  let tip = null, live = false;
  const full = () => el.getAttribute('data-fds-truncate') || el.textContent.trim();
  const tipOf = () => document.getElementById((host.getAttribute('aria-describedby') || '').split(' ').pop() || '');
  const sync = () => {
    const overflowing = el.scrollWidth > el.clientWidth + 1;
    if (overflowing && !live) {
      live = true;
      el.setAttribute('data-truncated', '');
      host.removeAttribute('data-untruncated');
      if (!tip) { host.setAttribute('data-fds-tooltip', full()); tooltip(host); tip = tipOf(); }
      if (tip) { tip.textContent = full(); tip.hidden = true; }
    } else if (!overflowing && live) {
      live = false; el.removeAttribute('data-truncated'); if (tip) tip.hidden = true;
      host.setAttribute('data-untruncated', '');   // tooltip wiring stays but is inert until it overflows again
    }
  };
  // when inert, swallow the show: capture-phase listeners run before the tooltip's own
  for (const ev of ['mouseenter', 'focus']) host.addEventListener(ev, (e) => { if (host.hasAttribute('data-untruncated')) e.stopImmediatePropagation(); }, true);
  sync();
  if (typeof document !== 'undefined' && document.fonts?.ready) document.fonts.ready.then(sync);   // web fonts change widths
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(sync).observe(el);
  if (typeof window !== 'undefined') window.addEventListener('resize', sync);
  if (typeof MutationObserver !== 'undefined') new MutationObserver(sync).observe(el, { childList: true, characterData: true, subtree: true });
  return sync;
}

export function upgrade(root = document) {
  for (const el of root.querySelectorAll('[data-fds-truncate]')) truncate(el);
  for (const el of root.querySelectorAll('[data-fds-tabs]')) tabs(el);
  for (const el of root.querySelectorAll('[data-fds-menu]')) menu(el);
  for (const el of root.querySelectorAll('dialog[data-fds-dialog], dialog.fds-dialog')) dialog(el);
  for (const el of root.querySelectorAll('[data-fds-listbox]')) listbox(el);
  for (const el of root.querySelectorAll('[data-fds-tooltip]')) tooltip(el);
  for (const el of root.querySelectorAll('.fds-appbar[data-large]')) largeTitle(el);
}
if (typeof document !== 'undefined' && document.currentScript?.hasAttribute('data-auto')) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => upgrade()); else upgrade();
}
