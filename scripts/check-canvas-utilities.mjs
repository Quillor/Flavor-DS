/**
 * The ported Canvas (EthiGov reference) uses Tailwind utility classes; this project has no
 * Tailwind, so canvas-tw.css defines each one on Flavor tokens. A class the reference uses
 * that the stylesheet does not define renders as nothing — silently. Fail on it.
 *   node scripts/check-canvas-utilities.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tsx = readFileSync(join(ROOT, 'apps/docs/src/canvas/canvas.tsx'), 'utf8');
const css = readFileSync(join(ROOT, 'apps/docs/src/canvas/canvas-tw.css'), 'utf8');
const used = new Set();
for (const m of tsx.matchAll(/className=\{?["`]([^"`]*)["`]|cn\(([^)]*)\)/g)) {
  const body = m[1] ?? m[2] ?? '';
  for (const lit of body.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)) for (const c of (lit[1] ?? lit[2] ?? lit[3]).split(/\s+/)) if (c && !/[${}?:]/.test(c) && !/^[a-z]+$/.test(c) === false || (c && !/[${}?]/.test(c))) used.add(c);
  if (m[1]) for (const c of m[1].split(/\s+/)) if (c && !/[${}]/.test(c)) used.add(c);
}
const esc = (c) => c.replace(/([.\/\[\]:%])/g, '\\$1');
const missing = [...used].filter((c) => !c.startsWith('cv-') && !c.startsWith('fds-') && !css.includes('.' + esc(c) + '{') && !css.includes('.' + esc(c) + ':') && !css.includes('.' + esc(c) + '>'));
if (missing.length) { console.error(`✗ canvas utilities: ${missing.length} class(es) used by canvas.tsx but undefined in canvas-tw.css:\n  ${missing.join(' ')}`); process.exit(1); }
console.log(`✓ canvas utilities: all ${used.size} classes used by the ported reference are defined on Flavor tokens`);
