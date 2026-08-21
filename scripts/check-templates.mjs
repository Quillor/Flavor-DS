/**
 * Template theme-compatibility guard.
 *
 * A product template's job is to survive every axis: hue, saturation, light/dark,
 * AA/AAA, the four backgrounds, three radii, three densities, five type pairings and
 * both directions. Most ways of breaking that are invisible in the default theme and
 * only show up in one combination nobody opened — so they get checked mechanically.
 *
 *   node scripts/check-templates.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'apps/docs/src/pages/product');
const problems = [];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

const RULES = [
  {
    // A literal colour cannot invert for dark mode or follow the hue.
    re: /(?:color|background|background-color|fill|stroke|border-color)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/,
    msg: 'literal colour — use a semantic token so it follows mode and hue',
  },
  {
    // The numeric radius ramp predates the Radius axis and does not re-resolve,
    // so these render identically in Square, Rounded and Pill.
    re: /var\(--radius-(?:1|2|3|4|5|6|full)\)/,
    msg: 'numeric radius token ignores the Radius axis — use --radius-control/field/container/media, or --radius-round for anything that must stay circular',
  },
  {
    // Physical sides do not flip under dir="rtl".
    re: /(?:margin|padding|border)-(?:left|right)\s*:|(?:^|[^-\w])(?:left|right)\s*:\s*(?!auto)/,
    msg: 'physical left/right — use logical properties (inline-start/inline-end) so RTL flips for free',
  },
  {
    // Icons come from the Heroicons sprite (npm run build:icons), never drawn ad hoc: a
    // hand-drawn glyph has no name for the MCP, no solid variant, and drifts in stroke
    // weight. Genuine drawings (map geometry, charts) are allowed when the <svg> carries
    // an explicit viewBox that is not the 24-grid, or a data-drawing attribute.
    re: /<svg(?![^>]*data-drawing)(?![^>]*viewBox="0 0 (?!24 24)[^"]+")[^>]*>\s*<(?:path|rect|circle|line|polyline|polygon)\b/,
    msg: 'ad-hoc inline icon — use the sprite: <svg class="fds-icon" data-icon><use href="/icons/sprite.svg#hi-NAME-outline"></use></svg> (see /core/icons/); mark real drawings data-drawing',
  },
  {
    // prefers-reduced-motion zeroes the duration tokens; a literal ms bypasses it.
    re: /transition-duration:\s*\d+m?s|animation:[^;]*\s\d+m?s/,
    msg: 'hardcoded duration — use var(--duration-N) so reduced-motion can zero it',
  },
];

const files = readdirSync(DIR).filter((f) => f.endsWith('.astro') && f !== 'index.astro' && f !== 'native.astro');
for (const f of files) {
  const src = strip(readFileSync(join(DIR, f), 'utf8'));
  src.split('\n').forEach((line, i) => {
    for (const r of RULES) if (r.re.test(line)) problems.push(`${relative(ROOT, join(DIR, f))}:${i + 1}  ${r.msg}\n    ${line.trim().slice(0, 110)}`);
  });
}

// Every template must be reachable from the nav, or it ships invisible.
const nav = readFileSync(join(ROOT, 'apps/docs/src/product/productNav.ts'), 'utf8');
for (const f of files) {
  const slug = basename(f, '.astro');
  if (!nav.includes(`'${slug}'`)) problems.push(`productNav.ts  has no entry for /product/${slug}/ — the page builds but nothing links to it`);
}

if (problems.length) {
  console.error(`✗ template theme-compatibility: ${problems.length} problem(s)`);
  for (const p of problems.slice(0, 40)) console.error('  ' + p);
  if (problems.length > 40) console.error(`  … +${problems.length - 40} more`);
  process.exit(1);
}
console.log(`✓ templates theme-safe: ${files.length} templates — no literal colours, all radii follow the Radius axis, no physical left/right, no hardcoded durations, all in nav`);
