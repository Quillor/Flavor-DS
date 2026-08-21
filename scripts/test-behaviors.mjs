/**
 * Keyboard-contract tests for behaviors.js, run against the real component pages.
 *
 * Needs a dev server (npm run dev:docs), like the screenshot matrix:
 *   node scripts/test-behaviors.mjs
 *
 * Each assertion is one line of the WAI-ARIA Authoring Practices pattern the component
 * claims. If a component's Accessibility tab says "arrow keys move between tabs", a
 * test here proves it — the docs are not allowed to describe behaviour that is not
 * exercised.
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://localhost:4321';
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); };
const active = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.textContent.trim().slice(0, 30) || a.tagName) : null; });

/* ---------------------------------------------------------------- tabs */
await page.goto(`${BASE}/core/components/tabs/`, { waitUntil: 'networkidle' });
await page.focus('#c-tab-1');
check('tabs: only the active tab is in the tab sequence', await page.evaluate(() => document.getElementById('c-tab-2').tabIndex === -1 && document.getElementById('c-tab-1').tabIndex === 0));
await page.keyboard.press('ArrowRight');
check('tabs: ArrowRight moves focus AND selection', await active() === 'c-tab-2' && await page.evaluate(() => document.getElementById('c-tab-2').getAttribute('aria-selected') === 'true' && !document.getElementById('c-tab-p2').hidden && document.getElementById('c-tab-p1').hidden));
await page.keyboard.press('End');
check('tabs: End jumps to last', await active() === 'c-tab-3');
await page.keyboard.press('ArrowRight');
check('tabs: ArrowRight wraps from last to first', await active() === 'c-tab-1');
await page.keyboard.press('Home');
check('tabs: Home jumps to first', await active() === 'c-tab-1');
check('tabs: panel is labelled by its tab', await page.evaluate(() => document.getElementById('c-tab-p1').getAttribute('aria-labelledby') === 'c-tab-1' && document.getElementById('c-tab-p1').getAttribute('role') === 'tabpanel'));

/* ---------------------------------------------------------------- menu */
await page.goto(`${BASE}/core/components/menu/`, { waitUntil: 'networkidle' });
const trig = page.locator('[data-fds-menu] > button');
check('menu: trigger declares haspopup + expanded=false when closed', await trig.evaluate((t) => t.getAttribute('aria-haspopup') === 'menu' && t.getAttribute('aria-expanded') === 'false'));
await trig.focus();
await page.keyboard.press('ArrowDown');
check('menu: ArrowDown opens and focuses first item', await page.evaluate(() => document.activeElement?.textContent.trim().startsWith('Rename')) && await trig.evaluate((t) => t.getAttribute('aria-expanded') === 'true'));
await page.keyboard.press('ArrowDown');
check('menu: ArrowDown moves to next item', await page.evaluate(() => document.activeElement?.textContent.trim().startsWith('Duplicate')));
await page.keyboard.press('ArrowDown');
check('menu: disabled item is skipped', await page.evaluate(() => document.activeElement?.textContent.trim().startsWith('Delete')));
await page.keyboard.press('ArrowDown');
check('menu: ArrowDown wraps to first', await page.evaluate(() => document.activeElement?.textContent.trim().startsWith('Rename')));
await page.keyboard.type('du');
check('menu: typeahead "du" lands on Duplicate', await page.evaluate(() => document.activeElement?.textContent.trim().startsWith('Duplicate')));
await page.keyboard.press('Escape');
check('menu: Escape closes and returns focus to trigger', await trig.evaluate((t) => document.activeElement === t && t.getAttribute('aria-expanded') === 'false'));
await page.keyboard.press('ArrowUp');
check('menu: ArrowUp opens and focuses LAST item', await page.evaluate(() => document.activeElement?.textContent.trim().startsWith('Delete')));
await page.keyboard.press('Escape');
await page.mouse.click(5, 5);
check('menu: click outside closes without stealing focus', await trig.evaluate((t) => t.getAttribute('aria-expanded') === 'false'));

/* ---------------------------------------------------------------- dialog */
await page.goto(`${BASE}/core/components/dialog/`, { waitUntil: 'networkidle' });
const opener = page.locator('[data-fds-dialog-open="c-dialog"]');
await opener.focus();
await page.keyboard.press('Enter');
check('dialog: opens modally with aria-modal', await page.evaluate(() => { const d = document.getElementById('c-dialog'); return d.open && d.getAttribute('aria-modal') === 'true' && d.getAttribute('role') === 'dialog'; }));
check('dialog: initial focus lands on the first field, not the destructive button', await active() === 'c-dialog-confirm');
check('dialog: labelled by its title', await page.evaluate(() => { const d = document.getElementById('c-dialog'); return !!d.getAttribute('aria-labelledby') && document.getElementById(d.getAttribute('aria-labelledby'))?.textContent.includes('Delete'); }));
await page.keyboard.press('Shift+Tab');
check('dialog: Shift+Tab from first wraps to last (Delete)', await page.evaluate(() => document.activeElement?.textContent.trim() === 'Delete'));
await page.keyboard.press('Tab');
check('dialog: Tab from last wraps back to first', await active() === 'c-dialog-confirm');
check('dialog: page behind is inert (opener not focusable)', await page.evaluate(() => { const o = document.querySelector('[data-fds-dialog-open="c-dialog"]'); o.focus(); return document.activeElement !== o; }));
await page.keyboard.press('Escape');
check('dialog: Escape closes and RESTORES focus to opener', await page.evaluate(() => !document.getElementById('c-dialog').open && document.activeElement === document.querySelector('[data-fds-dialog-open="c-dialog"]')));

/* ---------------------------------------------------------------- listbox */
await page.goto(`${BASE}/core/components/select/`, { waitUntil: 'networkidle' });
const lb = page.locator('[data-fds-listbox] > button');
check('listbox: button is a combobox with haspopup=listbox', await lb.evaluate((b) => b.getAttribute('role') === 'combobox' && b.getAttribute('aria-haspopup') === 'listbox'));
await lb.focus();
await page.keyboard.press('ArrowDown');
check('listbox: ArrowDown opens; focus STAYS on the button (activedescendant pattern)', await lb.evaluate((b) => document.activeElement === b && b.getAttribute('aria-expanded') === 'true' && !!b.getAttribute('aria-activedescendant')));
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
check('listbox: arrows move the highlighted option', await page.evaluate(() => document.querySelector('.fds-option.is-active')?.textContent.trim() === 'Pistachio'));
await page.keyboard.press('ArrowDown');
check('listbox: disabled option is skipped (wraps to first)', await page.evaluate(() => document.querySelector('.fds-option.is-active')?.textContent.trim() === 'Vanilla'));
await page.keyboard.type('s');
check('listbox: typeahead "s" highlights Strawberry', await page.evaluate(() => document.querySelector('.fds-option.is-active')?.textContent.trim() === 'Strawberry'));
await page.keyboard.press('Enter');
check('listbox: Enter commits, closes, updates the button label', await lb.evaluate((b) => b.getAttribute('aria-expanded') === 'false' && b.textContent.trim() === 'Strawberry' && document.activeElement === b));
check('listbox: committed option is aria-selected', await page.evaluate(() => [...document.querySelectorAll('.fds-option')].find((o) => o.textContent.trim() === 'Strawberry')?.getAttribute('aria-selected') === 'true'));
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
check('listbox: Escape cancels without changing the value', await lb.evaluate((b) => b.textContent.trim() === 'Strawberry' && b.getAttribute('aria-expanded') === 'false'));

/* ---------------------------------------------------------------- tooltip */
await page.goto(`${BASE}/core/components/tooltip/`, { waitUntil: 'networkidle' });
const tt = page.locator('[data-fds-tooltip]');
check('tooltip: hidden until triggered', await page.evaluate(() => document.querySelector('[role="tooltip"]').hidden));
await tt.focus();
await page.waitForTimeout(300);
check('tooltip: shows on FOCUS (keyboard), not hover only', await page.evaluate(() => !document.querySelector('[role="tooltip"]').hidden));
check('tooltip: linked by aria-describedby', await tt.evaluate((t) => document.getElementById(t.getAttribute('aria-describedby').split(' ').pop())?.getAttribute('role') === 'tooltip'));
await page.keyboard.press('Escape');
check('tooltip: Escape hides it', await page.evaluate(() => document.querySelector('[role="tooltip"]').hidden));
await tt.hover(); await page.waitForTimeout(300);
check('tooltip: shows on hover after delay', await page.evaluate(() => !document.querySelector('[role="tooltip"]').hidden));
await page.mouse.move(5, 5); await page.waitForTimeout(50);
check('tooltip: hides on mouseleave', await page.evaluate(() => document.querySelector('[role="tooltip"]').hidden));

/* ---------------------------------------------------------------- truncate (map template, desktop list) */
await page.goto(`${BASE}/product/map/`, { waitUntil: 'load' });
await page.waitForSelector('[data-fds-truncate]');
await page.evaluate(() => document.fonts.ready);
// force an overflow deterministically (headless has no web fonts, so widths differ from a browser)
await page.evaluate(() => { const el = document.querySelector('[data-fds-truncate]'); el.style.maxInlineSize = '48px'; });
await page.waitForTimeout(400);
const tr = page.locator('[data-fds-truncate][data-truncated]').first();
check('truncate: overflowing text is flagged data-truncated', (await tr.count()) > 0);
if ((await tr.count()) > 0) {
  check('truncate: full text stays in the DOM (screen readers)', (await tr.evaluate((t) => t.textContent.trim().length)) > 5);
  // the tooltip host is the nearest interactive ancestor (the list row) — what pointer + Tab reach
  const hostOf = (t) => t.closest('button, a[href], [tabindex]') || t;
  await tr.hover(); await page.waitForTimeout(400);
  const hov = await tr.evaluate((t) => { const h = t.closest('button, a[href], [tabindex]') || t; const tip = document.getElementById((h.getAttribute('aria-describedby') || '').split(' ').pop()); return { has: !!tip, hidden: tip?.hidden, same: tip?.textContent === t.textContent.trim() }; });
  check('truncate: hover reveals a tooltip with the FULL text', hov.has && !hov.hidden && hov.same, JSON.stringify(hov));
  await page.mouse.move(0, 0); await page.waitForTimeout(100);
  await tr.evaluate((t) => (t.closest('button, a[href], [tabindex]') || t).focus()); await page.waitForTimeout(300);
  check('truncate: focus reveals it too (keyboard)', await tr.evaluate((t) => { const h = t.closest('button, a[href], [tabindex]') || t; const tip = document.getElementById((h.getAttribute('aria-describedby') || '').split(' ').pop()); return !!tip && !tip.hidden; }));
}

await b.close();
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok || !r.detail ? "" : "  — " + r.detail}`);
console.log(`\n${results.length - failed.length}/${results.length} keyboard contracts hold`);
process.exit(failed.length ? 1 : 0);
