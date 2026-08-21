/**
 * Template layout verification across theme extremes.
 *
 * Needs a running dev server (npm run dev:docs), like scripts/screenshot-matrix.mjs:
 *   node scripts/check-template-layout.mjs
 *
 * check-templates.mjs reads the source; this one measures the rendered result. It loads
 * every app template in four deliberately awkward combinations and asserts that no
 * in-flow content spills and the frame never scrolls horizontally.
 *
 * Two things it learned the hard way, both encoded below:
 *  - Raw scrollWidth is the wrong signal. The 40px hit-area pseudo-element inside a 16px
 *    checkbox, and a slider knob that overhangs its fill, both inflate it by design and
 *    are invisible. Only a statically-positioned child wider than its box is a real spill.
 *  - The frame carries its OWN direction. It is hardcoded dir="ltr" and flips only via its
 *    language selector, so setting dir on <html> mirrors the site chrome and leaves every
 *    template LTR. RTL has to be driven through the selector or it is not being tested.
 */
/* Assert theme compatibility by MEASURING each template in the extremes, rather
 * than trusting that token names imply correct rendering. */
import { chromium } from 'playwright';
const BASE = 'http://localhost:4321';
const COMBOS = [
  { id: 'dark-teal-pill-compact',  s: { hue:'teal', sat:'bold', mode:'dark', contrast:'aaa', bg:'primary', radius:'pill', density:'compact', font:'expressive', dir:'ltr' } },
  { id: 'accent-yellow-square',    s: { hue:'yellow', sat:'regular', mode:'light', contrast:'aa', bg:'accent', radius:'square', density:'regular', font:'reading', dir:'ltr' } },
  { id: 'media-purple',            s: { hue:'purple', sat:'regular', mode:'dark', contrast:'aa', bg:'media', radius:'rounded', density:'regular', font:'flavor', dir:'ltr' } },
  { id: 'rtl-green-comfy',         s: { hue:'green', sat:'muted', mode:'light', contrast:'aa', bg:'secondary', radius:'rounded', density:'comfy', font:'editorial', dir:'rtl' } },
];
const PAGES = ['projects','ai-chat','map','calendar','music','reader'];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const rows = [];
for (const c of COMBOS) for (const p of PAGES) {
  await page.goto(`${BASE}/product/${p}/`, { waitUntil: 'networkidle' });
  await page.evaluate((s) => localStorage.setItem('flavor-theme', JSON.stringify(s)), c.s);
  await page.reload({ waitUntil: 'networkidle' });
  // The frame carries its OWN direction (hardcoded dir="ltr", flipped by its language
  // selector) — the global dir only mirrors the site chrome. Driving the selector is the
  // only way to actually exercise RTL inside a template.
  if (c.s.dir === 'rtl') {
    await page.selectOption('.tpl-lang', 'ar');
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => {
    const frame = document.querySelector('.tpl-wrap');
    const el = document.documentElement;
    const who = [];
    // What actually matters is whether IN-FLOW content spills. A pseudo-element hit
    // area (40px inside a 16px checkbox) and an overhanging slider knob both inflate
    // scrollWidth by design and are invisible — measuring those was measuring the
    // wrong thing. Only count an element whose overflow is caused by a
    // statically-positioned child that is genuinely wider than the box.
    if (frame) for (const n of frame.querySelectorAll('*')) {
      if (n.scrollWidth <= n.clientWidth + 2) continue;
      if (getComputedStyle(n).overflowX !== 'visible') continue;      // it scrolls: fine
      const culprit = [...n.children].some((c) => {
        const cs = getComputedStyle(c);
        return cs.position === 'static' && c.getBoundingClientRect().width > n.clientWidth + 2;
      });
      if (culprit) who.push((String(n.className).split(' ')[0] || n.tagName) + ' +' + (n.scrollWidth - n.clientWidth));
    }
    // and: does the frame itself force a horizontal scrollbar?
    const frameScrolls = frame ? frame.scrollWidth > frame.clientWidth + 2 : false;
    const inner = document.querySelector('.tpl-frame');
    const innerDir = inner ? getComputedStyle(inner).direction : '-';
    const applied = ['hue','sat','mode','contrast','bg','radius','density'].every(a => el.getAttribute('data-'+a));
    return { overflow: who.length, who, frameScrolls, applied, innerDir };
  });
  rows.push({ combo: c.id, page: p, ...r });
}
await b.close();
const bad = rows.filter(r => r.overflow > 0 || r.frameScrolls || !r.applied);
console.log('frame direction per combo:', [...new Set(rows.map(r => r.combo + '=' + r.innerDir))].join(' '));
console.log(`${rows.length} checks · ${bad.length} with real layout overflow`);
for (const r of bad) console.log(`  ✗ ${r.combo} / ${r.page}: ${r.who.join(', ') || (r.frameScrolls ? 'frame scrolls horizontally' : 'axes not applied')}`);
if (!bad.length) console.log('✓ no in-flow overflow, no horizontal frame scroll, all axes applied — across ' + COMBOS.length + ' extremes × ' + PAGES.length + ' templates');
