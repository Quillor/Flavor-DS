/**
 * Interface-polish guard.
 *
 * The principles in .claude/skills/make-interfaces-feel-better are only worth
 * installing if they cannot silently rot back out. Each rule below is one that
 * a reviewer would otherwise have to catch by eye, and each names the exact
 * failure it prevents rather than a style preference.
 *
 *   node scripts/check-polish.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = ['packages/ui/src', 'apps/docs/src'];
const problems = [];

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|astro|tsx|jsx|ts)$/.test(p)) out.push(p);
  }
  return out;
};

/** strip comments so documenting an anti-pattern is not itself a violation */
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const RULES = [
  {
    // Watching every property costs optimisation and animates things you never meant to.
    test: /transition:\s*all\b|transition-property:\s*all\b|\btransition-all\b/,
    msg: 'transition: all — name the exact properties that change',
  },
  {
    // Each compositing layer costs memory; `all` promotes everything.
    test: /will-change:\s*all\b/,
    msg: 'will-change: all — only transform, opacity or filter, and only for observed stutter',
  },
  {
    // A tinted ring picks up the surface underneath and reads as dirt on the edge.
    // Only an outline that draws a themed COLOUR; `outline:none` (a focus reset) is not one,
    // and a minified line can carry both — anchor the value to the same declaration.
    test: /outline:\s*(?!none)[^;{}]*\bvar\(--(?:border|text|accent|surface)[^)]*\)/,
    msg: 'image outline drawn from a themed token — use --image-outline (pure black/white)',
  },
  {
    // Below 0.95 the press reads as exaggerated rather than tactile. Compared
    // numerically — a regex over decimal ranges misses cases like 0.9.
    match: (line) => {
      for (const m of line.matchAll(/(?:scale|transform):\s*(?:scale\()?\s*(0?\.\d+)/g))
        if (Number(m[1]) < 0.95) return true;
      return false;
    },
    msg: 'press scale below 0.95 — use var(--press-scale)',
  },
  {
    // Motion must never be the only feedback channel, and 0ms durations are the
    // reduced-motion contract; a hardcoded ms bypasses both.
    test: /transition-duration:\s*\d+m?s|transition:\s*[a-z-]+\s+\d+m?s/,
    msg: 'hardcoded transition duration — use var(--duration-N) so reduced-motion can zero it',
  },
];

for (const rel of SCAN) {
  let files = [];
  try { files = walk(join(ROOT, rel)); } catch { continue; }
  for (const file of files) {
    const src = strip(readFileSync(file, 'utf8'));
    src.split('\n').forEach((line, i) => {
      for (const r of RULES) if (r.match ? r.match(line) : r.test.test(line)) problems.push(`${relative(ROOT, file)}:${i + 1}  ${r.msg}\n    ${line.trim().slice(0, 110)}`);
    });
  }
}

// Positive checks: the polish tokens must actually exist and stay untinted.
const css = readFileSync(join(ROOT, 'packages/tokens/dist/flavor.css'), 'utf8');
for (const t of ['--press-scale', '--hit-area-touch', '--hit-area-dense', '--image-outline', '--shadow-border', '--icon-stroke-regular'])
  if (!css.includes(t + ':')) problems.push(`packages/tokens/dist/flavor.css  missing polish token ${t}`);
for (const m of css.matchAll(/--image-outline:\s*([^;]+);/g)) {
  const v = m[1].trim();
  if (!/^oklch\(\s*(0|1)\s+0\s+0\s*\/\s*[\d.]+\s*\)$/.test(v))
    problems.push(`--image-outline resolves to "${v}" — must be pure black or white at low alpha, never a tinted neutral`);
}
const press = css.match(/--press-scale:\s*([\d.]+)/);
if (press && Number(press[1]) < 0.95) problems.push(`--press-scale is ${press[1]} — anything below 0.95 reads as exaggerated`);

if (problems.length) {
  console.error(`✗ interface polish: ${problems.length} problem(s)`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('✓ interface polish: no transition:all, no will-change:all, untinted image outline, press scale in range, all polish tokens present');
