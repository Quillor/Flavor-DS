/**
 * Component screenshot matrix — visual regression across theme axes.
 *   npx playwright install chromium   (once)
 *   npm run dev:docs                  (in another shell) — or set BASE_URL
 *   node scripts/screenshot-matrix.mjs [--update]
 * Writes screenshots/<combo>/<page>.png; with --update refreshes the baseline in
 * screenshots/baseline/. Without --update, compares pixel counts against baseline
 * (>0.5% differing pixels = fail). Playwright is an optional dev dependency:
 *   npm i -D playwright pngjs pixelmatch
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const update = process.argv.includes('--update');
const COMBOS = [
  { id: 'brand-light-aa', hue: 'brand', sat: 'regular', mode: 'light', contrast: 'aa' },
  { id: 'brand-dark-aa', hue: 'brand', sat: 'regular', mode: 'dark', contrast: 'aa' },
  { id: 'teal-bold-light-aaa', hue: 'teal', sat: 'bold', mode: 'light', contrast: 'aaa' },
  { id: 'brand-secondary-light', hue: 'brand', sat: 'regular', mode: 'light', contrast: 'aa', bg: 'secondary' },
  { id: 'yellow-accentbg-light', hue: 'yellow', sat: 'regular', mode: 'light', contrast: 'aa', bg: 'accent' },
  { id: 'blue-accentbg-dark', hue: 'blue', sat: 'regular', mode: 'dark', contrast: 'aa', bg: 'accent' },
  { id: 'purple-media', hue: 'purple', sat: 'regular', mode: 'dark', contrast: 'aa', bg: 'media' },
  { id: 'brand-pill', hue: 'brand', sat: 'regular', mode: 'light', contrast: 'aa', radius: 'pill' },
  { id: 'brand-square-dark', hue: 'brand', sat: 'regular', mode: 'dark', contrast: 'aa', radius: 'square' },
  { id: 'red-muted-compact', hue: 'red', sat: 'muted', mode: 'light', contrast: 'aa', density: 'compact' },
  { id: 'green-comfy-rtl', hue: 'green', sat: 'regular', mode: 'light', contrast: 'aa', density: 'comfy', dir: 'rtl' },
];
const PAGES = ['/core/components/', '/product/sign-in/', '/product/dashboard/',
  '/product/projects/', '/product/ai-chat/', '/product/map/',
  '/product/calendar/', '/product/music/', '/product/reader/'];

let chromium, PNG, pixelmatch;
try { ({ chromium } = await import('playwright')); ({ PNG } = await import('pngjs')); ({ default: pixelmatch } = await import('pixelmatch')); }
catch { console.error('Missing dev deps. Run: npm i -D playwright pngjs pixelmatch && npx playwright install chromium'); process.exit(2); }

const outDir = join(process.cwd(), 'screenshots'); mkdirSync(join(outDir, 'baseline'), { recursive: true });
const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage(); let failures = 0, shots = 0;
for (const cmb of COMBOS) {
  const state = { hue: 'brand', sat: 'regular', mode: 'light', contrast: 'aa', bg: 'primary', radius: 'rounded', density: 'regular', font: 'flavor', dir: 'ltr', ...cmb };
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.evaluate((s) => localStorage.setItem('flavor-theme', JSON.stringify(s)), state);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(300);
    const name = `${cmb.id}__${p.replace(/\//g, '_')}.png`;
    const cur = await page.screenshot({ fullPage: false });
    const basePath = join(outDir, 'baseline', name); mkdirSync(join(outDir, 'current'), { recursive: true }); writeFileSync(join(outDir, 'current', name), cur); shots++;
    if (update || !existsSync(basePath)) { writeFileSync(basePath, cur); continue; }
    const a = PNG.sync.read(readFileSync(basePath)), b = PNG.sync.read(cur);
    if (a.width !== b.width || a.height !== b.height) { failures++; console.log(`✗ ${name}: size changed`); continue; }
    const diff = new PNG({ width: a.width, height: a.height });
    const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
    const pct = (n / (a.width * a.height)) * 100;
    if (pct > 0.5) { failures++; mkdirSync(join(outDir, 'diff'), { recursive: true }); writeFileSync(join(outDir, 'diff', name), PNG.sync.write(diff)); console.log(`✗ ${name}: ${pct.toFixed(2)}% pixels differ`); }
  }
}
await browser.close();
console.log(`${shots} screenshots · ${failures} failures${update ? ' (baseline updated)' : ''}`);
process.exit(failures ? 1 : 0);
