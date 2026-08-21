/**
 * Spacing + responsive layout audit.
 *
 * Needs a dev server:  node scripts/check-responsive.mjs [--fix-report]
 *
 * Renders every product template at desktop / tablet / mobile × compact / regular / comfy
 * and MEASURES the failure modes that actually happen, rather than eyeballing:
 *   clipped     an element's content is taller than its fixed box (scrollHeight > clientHeight
 *               with overflow hidden) — the classic "compact looked fine, comfy overflowed"
 *   smallTarget an interactive element under 40×40 (24×24 on the desktop-only shell), the
 *               floor the polish layer promises
 *   tinyText    visible text below 11px — the type scale's floor
 *   hscroll     the frame scrolls horizontally
 *   spacingDrift a gap/padding on a template-local class that is not a --space-* multiple
 *               (measured, since a literal '13px' hides in a shorthand)
 * Prints per-template counts and the worst offenders with the element's class, so the
 * fix is a specific line and not "make it responsive".
 */
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://localhost:4321';
const PAGES = readdirSync(join(ROOT, 'apps/docs/src/pages/product')).filter((f) => f.endsWith('.astro') && !['index.astro', 'native.astro'].includes(f)).map((f) => f.replace('.astro', ''));
const DEVICES = ['desktop', 'tablet', 'mobile'];
const DENSITIES = ['compact', 'regular', 'comfy'];

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const rows = [];
for (const p of PAGES) {
  await page.goto(`${BASE}/product/${p}/`, { waitUntil: 'networkidle' });
  for (const density of DENSITIES) {
    await page.evaluate((d) => { document.documentElement.setAttribute('data-density', d); }, density);
    for (const device of DEVICES) {
      await page.evaluate((d) => { const btn = document.querySelector(`[data-device="${d}"]`); btn && btn.click(); }, device);
      await page.waitForTimeout(350);
      const r = await page.evaluate(({ device }) => {
        const frame = document.querySelector('.tpl-frame'); if (!frame) return null;
        const out = { clipped: [], smallTarget: [], tinyText: [], hscroll: frame.scrollWidth > frame.clientWidth + 2, spacingDrift: [] };
        const SPACE = [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80];
        const mul = { compact: 0.75, regular: 1, comfy: 1.25 }[document.documentElement.getAttribute('data-density')] || 1;
        const okSpace = new Set(SPACE.map((s) => Math.max(1, Math.round(s * mul))));
        const floor = device === 'desktop' ? 24 : 40;
        const cls = (n) => (typeof n.className === 'string' ? n.className.split(' ')[0] : n.tagName.toLowerCase()) || n.tagName.toLowerCase();
        for (const n of frame.querySelectorAll('*')) {
          if (!(n instanceof HTMLElement)) continue;
          if (!n.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })) continue;
          const cs = getComputedStyle(n);
          const r = n.getBoundingClientRect();
          // clipped: overflow hidden + content taller than box. Intentional crops are exempt:
          // ellipsis, -webkit-line-clamp (which IS overflow:hidden), boxes whose only
          // content is media (an image cover-fitted into a fixed ratio), and declared viewports
          // (data-viewport: a map / canvas whose content is by definition larger than its window).
          if (n.closest('[data-viewport]')) continue;
          const onlyMedia = n.children.length > 0 && [...n.children].every((c) => c.matches('img,svg,video,picture'));
          const clamped = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
          if (cs.overflowY === 'hidden' && cs.textOverflow !== 'ellipsis' && !clamped && !onlyMedia && n.scrollHeight > n.clientHeight + 4 && r.height > 0)
            out.clipped.push(`${cls(n)} +${n.scrollHeight - n.clientHeight}px`);
          // targets
          if (n.matches('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=menuitem],[role=option]')) {
            const w = Math.max(r.width, parseFloat(getComputedStyle(n, '::after').width) || 0);
            const h = Math.max(r.height, parseFloat(getComputedStyle(n, '::after').height) || 0);
            if ((w < floor || h < floor) && !(n.matches('input[type=checkbox],input[type=radio]') && w >= 40)) out.smallTarget.push(`${cls(n)} ${Math.round(w)}×${Math.round(h)}`);
          }
          // tiny text: leaf text nodes only
          if (n.childNodes.length && [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) {
            const fs = parseFloat(cs.fontSize); if (fs < 11) out.tinyText.push(`${cls(n)} ${fs}px`);
          }
          // spacing drift on template-local classes (fds-* are the system's own)
          if (/^(?!fds-)[a-z]{2,3}-/.test(cls(n))) {
            for (const prop of ['gap', 'paddingTop', 'paddingLeft', 'paddingBottom', 'paddingRight', 'rowGap', 'columnGap']) {
              // ≤2px is a hairline (equaliser bars, star gaps), not a spacing decision — exempt
              const v = parseFloat(cs[prop]); if (v > 2 && !okSpace.has(Math.round(v)) && Math.abs(v - Math.round(v)) < 0.01) { out.spacingDrift.push(`${cls(n)} ${prop}=${v}`); break; }
            }
          }
        }
        const uniq = (a) => [...new Set(a)];
        return { clipped: uniq(out.clipped), smallTarget: uniq(out.smallTarget), tinyText: uniq(out.tinyText), hscroll: out.hscroll, spacingDrift: uniq(out.spacingDrift) };
      }, { device });
      if (r) rows.push({ page: p, device, density, ...r });
    }
  }
}
await b.close();

const bad = rows.filter((r) => r.clipped.length || r.smallTarget.length || r.tinyText.length || r.hscroll || r.spacingDrift.length);
const totals = { clipped: 0, smallTarget: 0, tinyText: 0, hscroll: 0, spacingDrift: 0 };
for (const r of rows) { totals.clipped += r.clipped.length; totals.smallTarget += r.smallTarget.length; totals.tinyText += r.tinyText.length; totals.hscroll += r.hscroll ? 1 : 0; totals.spacingDrift += r.spacingDrift.length; }
console.log(`responsive audit: ${PAGES.length} templates × ${DEVICES.length} devices × ${DENSITIES.length} densities = ${rows.length} renders`);
console.log(`  clipped content    ${totals.clipped}\n  small targets      ${totals.smallTarget}\n  tiny text          ${totals.tinyText}\n  horizontal scroll  ${totals.hscroll}\n  spacing drift      ${totals.spacingDrift}`);
// group by page for actionability
const byPage = {};
for (const r of bad) { const k = r.page; (byPage[k] ||= []).push(r); }
for (const [p, list] of Object.entries(byPage)) {
  const agg = { clipped: new Set(), smallTarget: new Set(), tinyText: new Set(), spacingDrift: new Set(), hscroll: new Set() };
  for (const r of list) { r.clipped.forEach((x) => agg.clipped.add(`${x} @${r.device}/${r.density}`)); r.smallTarget.forEach((x) => agg.smallTarget.add(`${x} @${r.device}`)); r.tinyText.forEach((x) => agg.tinyText.add(x)); r.spacingDrift.forEach((x) => agg.spacingDrift.add(x)); if (r.hscroll) agg.hscroll.add(`${r.device}/${r.density}`); }
  console.log(`\n▸ ${p}`);
  for (const [k, set] of Object.entries(agg)) if (set.size) console.log(`  ${k.padEnd(13)} ${[...set].slice(0, 6).join(' · ')}${set.size > 6 ? ` … +${set.size - 6}` : ''}`);
}
process.exit(bad.length ? 1 : 0);
