/**
 * WCAG QA over the SHIPPED CSS (not the generator's intent): resolves every
 * semantic token through flavor.css's real cascade for every theme combination
 * and checks the pairings the components actually use.
 *
 *   node scripts/wcag-qa.mjs            → report (exit 1 on any failure)
 *   node scripts/wcag-qa.mjs --json     → machine-readable
 *
 * Pairings (threshold AA 4.5 / AAA 7 for text; 3.0 for UI):
 *   text-primary/secondary/tertiary  vs surface-page/1/2/3
 *   accent-fg vs accent-bg · text-on-accent-subtle vs accent-subtle · text-accent vs surfaces
 *   {feedback}-text vs {feedback}-bg · {feedback}-solid-fg vs {feedback}-solid
 *   border-interactive vs surface-1 (UI 3.0) · accent-bg vs surface-1 (UI 3.0)
 *   secondary-fg vs secondary-bg · text-on-secondary-subtle vs secondary-subtle · secondary-text vs surfaces
 *   secondary-bg vs surface-1 (UI) · secondary-border vs surface-1 (UI) · focus-ring vs surfaces (UI)
 *   {feedback}-text vs surfaces (inline status text) · {feedback}-solid vs surface-1 (UI)
 * HARDENED: every text threshold carries a +0.05 safety margin (AA ≥ 4.55, AAA ≥ 7.05, UI ≥ 3.05) so
 * sRGB rounding in a browser or a design tool can never push a pass to a fail.
 * On media, "surfaces" = white (page is transparent over a photo, all UI is on white).
 */
import { readFileSync } from 'node:fs';
import { wcagContrast } from 'culori';
import { parseCss, declarationsFor, makeValueResolver } from '../packages/tokens/lib/resolve-css.mjs';

const css = readFileSync(new URL('../packages/tokens/dist/flavor.css', import.meta.url), 'utf8');
const meta = JSON.parse(readFileSync(new URL('../packages/tokens/dist/meta.json', import.meta.url), 'utf8'));

// Parsing + cascade resolution live in packages/tokens/lib/resolve-css.mjs so this QA
// and the Figma export can never disagree about what a browser would compute.
const blocks = parseCss(css);
const resolveVars = (attrs) => makeValueResolver(declarationsFor(blocks, attrs));

const HUES = meta.axes.hue, SATS = meta.axes.sat;
const FEED = ['success', 'warning', 'danger', 'info'];
const r2 = (n) => Math.round(n * 100) / 100;
const MARGIN = 0.05; // safety margin above the WCAG floor
const failures = [], results = [];
let combos = 0;
for (const hue of HUES) for (const sat of SATS) for (const mode of ['light', 'dark']) for (const contrast of ['aa', 'aaa']) for (const bg of meta.axes.bg) {
  const media = bg === 'media';
  const attrs = { hue, sat, mode, contrast, bg };
  const get = resolveVars(attrs);
  const th = contrast === 'aa' ? 4.5 : 7;
  const label = `${hue}/${sat}/${mode}/${contrast}/${bg}`;
  combos++;
  const surfaces = media ? ['#ffffff'] : ['--surface-page', '--surface-1', '--surface-2', '--surface-3'].map(get);
  const check = (what, fg, bgs, min) => {
    // An unresolvable token is a defect, not a pass — skipping it here is how a whole
    // half of the matrix once went unverified. Transparent backgrounds are legitimately
    // not contrast-checkable (the media backdrop is checked via text-on-media instead).
    if (!fg) { failures.push({ label, what, ratio: null, min, fg: 'UNRESOLVED', bgs }); return; }
    if (bgs.some((b) => !b)) { failures.push({ label, what, ratio: null, min, fg, bgs: 'UNRESOLVED' }); return; }
    if (bgs.some((b) => b === 'transparent')) return;
    const worst = Math.min(...bgs.map((b) => wcagContrast(fg, b)));
    results.push({ label, what, ratio: r2(worst), min });
    if (worst < min + MARGIN) failures.push({ label, what, ratio: r2(worst), min, fg, bgs });
  };
  check('text-primary on surfaces', get('--text-primary'), surfaces, th);
  check('text-secondary on surfaces', get('--text-secondary'), surfaces, th);
  check('text-tertiary on surfaces', get('--text-tertiary'), surfaces, th);
  check('text-accent on surfaces', get('--text-accent'), surfaces, th);
  check('accent-fg on accent-bg', get('--accent-fg'), [get('--accent-bg')], th);
  check('text-on-accent-subtle on accent-subtle', get('--text-on-accent-subtle'), [get('--accent-subtle')], th);
  check('accent-bg vs surface-1 (UI)', get('--accent-bg'), [media ? '#ffffff' : get('--surface-1')], 3);
  check('border-interactive vs surface-1 (UI)', get('--border-interactive'), [media ? '#ffffff' : get('--surface-1')], 3);
  check('secondary-fg on secondary-bg', get('--secondary-fg'), [get('--secondary-bg')], th);
  check('text-on-secondary-subtle on secondary-subtle', get('--text-on-secondary-subtle'), [get('--secondary-subtle')], th);
  check('secondary-text on surfaces', get('--secondary-text'), surfaces, th);
  check('secondary-bg vs surface-1 (UI)', get('--secondary-bg'), [media ? '#ffffff' : get('--surface-1')], 3);
  check('secondary-border vs surface-1 (UI)', get('--secondary-border'), [media ? '#ffffff' : get('--surface-1')], 3);
  check('focus-ring vs surfaces (UI)', get('--focus-ring'), surfaces, 3);
  for (const f of FEED) {
    check(`${f}-text on ${f}-bg`, get(`--${f}-text`), [get(`--${f}-bg`)], th);
    check(`${f}-solid-fg on ${f}-solid`, get(`--${f}-solid-fg`), [get(`--${f}-solid`)], th);
    check(`${f}-text on surfaces`, get(`--${f}-text`), surfaces, th);
    check(`${f}-solid vs surface-1 (UI)`, get(`--${f}-solid`), [media ? '#ffffff' : get('--surface-1')], 3);
  }
}

const json = process.argv.includes('--json');
if (json) { console.log(JSON.stringify({ combos, checks: results.length, failures }, null, 2)); }
else {
  console.log(`WCAG QA: ${combos} theme combinations · ${results.length} pairings checked`);
  if (failures.length) {
    console.log(`\n✗ ${failures.length} FAIL`);
    for (const f of failures.slice(0, 60)) console.log(`  ${f.label.padEnd(36)} ${f.what.padEnd(40)} ${f.ratio}:1 < ${f.min}  (${f.fg} on ${f.bgs.join(',')})`);
    if (failures.length > 60) console.log(`  … +${failures.length - 60} more`);
  } else console.log('✓ all pairings pass');
  const worst = {}; for (const r of results) if (!worst[r.what] || r.ratio < worst[r.what].ratio) worst[r.what] = r;
  console.log('\nWorst case per pairing:'); for (const w of Object.values(worst)) console.log(`  ${w.what.padEnd(40)} ${w.ratio}:1  (${w.label})`);
}
process.exit(failures.length ? 1 : 0);
