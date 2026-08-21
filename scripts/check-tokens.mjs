/**
 * Tier guard: components and apps may reference ONLY semantic tokens.
 * Any `--flavor-*` primitive reference outside packages/tokens is a defect.
 * Wired as `npm run lint:tokens`; exit 1 on violation.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIRS = ['packages/ui', 'apps'];
const EXTS = new Set(['.css', '.tsx', '.ts', '.jsx', '.astro', '.mdx', '.html']);
const PRIMITIVE = /--flavor-(?!white|black|transparent)[a-z]+-(muted|regular|bold)-\d+/g;

let violations = 0;
function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (e === 'node_modules' || e === 'dist' || e === '.astro') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (![...EXTS].some((x) => p.endsWith(x))) continue;
    const src = readFileSync(p, 'utf8');
    for (const [i, line] of src.split('\n').entries()) {
      const m = line.match(PRIMITIVE);
      if (m) {
        console.error(`${relative(ROOT, p)}:${i + 1}  primitive reference: ${m.join(', ')}`);
        violations++;
      }
    }
  }
}
for (const d of SCAN_DIRS) walk(join(ROOT, d));
if (violations) {
  console.error(`\n${violations} primitive reference(s) found. Components must use semantic tokens (--surface-*, --text-*, --accent-*, --space-*, ...).`);
  process.exit(1);
}
console.log('Token tier guard passed: no primitive references outside packages/tokens.');
