/**
 * Adoption metrics — the numbers GOVERNANCE.md commits to tracking.
 *
 *   node scripts/adoption.mjs            # print + append to adoption.jsonl
 *   node scripts/adoption.mjs --check    # exit 1 if any metric regressed vs the last row
 *
 * A design system with enforcement points but no measurement is a hobby: the guards
 * say what is *forbidden*, this says how much of the surface actually *uses* the system.
 * Scope is the docs app (the only consumer in this repo); a product adopting Flavor
 * would point SCAN at its own src and keep its own adoption.jsonl.
 *
 * Metrics (all derived, none self-reported):
 *   tokenCoverage    % of colour/spacing/radius declarations that resolve to a token
 *   hardcodedValues  count of literal colours + px spacing in consumer CSS (target: 0, trend ↓)
 *   componentUsage   % of interactive elements carrying an fds-* class (vs bare <button>/<input>)
 *   iconCoverage     % of <svg> that are sprite icons or marked drawings
 *   behaviorCoverage % of menu/tabs/dialog/listbox/tooltip markup wired to behaviors.js
 */
import { readFileSync, readdirSync, statSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = ['apps/docs/src'];
// Nothing excluded. The Canvas board's chrome was originally spec'd as neutral grey and exempt;
// it is now bound to the brand theme through the same semantic tokens as the site, so it is
// scanned like everything else — the board is built from the tokens it reviews.
// canvas.tsx is the EthiGov reference implementation ported byte-for-byte (see its header). It is
// authored with Tailwind on bare <button>s by design; restyling it into fds-* would defeat the
// port. So it is excluded from COMPONENT and BEHAVIOUR usage only — its stylesheet (canvas-tw.css,
// every utility on a Flavor token) and its adapter still count toward token coverage.
const EXCLUDE = [];
const EXCLUDE_USAGE = ['apps/docs/src/canvas/canvas.tsx', 'apps/docs/src/canvas/shims.tsx'];
const LOG = join(ROOT, 'adoption.jsonl');
const check = process.argv.includes('--check');

const walk = (d, out = []) => { for (const e of readdirSync(d)) { const p = join(d, e); if (e === 'node_modules' || e.startsWith('.')) continue; statSync(p).isDirectory() ? walk(p, out) : /\.(astro|tsx|css)$/.test(p) && out.push(p); } return out; };
// `/* raw: reason */` after a value is a DECLARED literal (a colour picker's spectrum cannot be
// themed). Keep it as a sentinel through comment-stripping so the scan can honour it.
// Also neutralise `${…}` template expressions: a `}` inside one would otherwise end the value
// match early and hide a trailing /* raw */ marker (a colour-picker gradient interpolating a hue).
const strip = (s) => s.replace(/\/\*\s*raw:[^*]*\*\//g, '__RAW__').replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\$\{[^}]*\}/g, 'X');
const files = SCAN.flatMap((d) => walk(join(ROOT, d))).filter((f) => !EXCLUDE.some((e) => f.includes(e)));
const src = files.map((f) => strip(readFileSync(f, 'utf8'))).join('\n');
const usageSrc = files.filter((f) => !EXCLUDE_USAGE.some((e) => f.endsWith(e))).map((f) => strip(readFileSync(f, 'utf8'))).join('\n');

// --- token coverage: declarations of properties the SYSTEM owns. Layout dimensions
// (a 640px measure, a 240px sidebar) are deliberately excluded — there is no token for
// them and there should not be; counting them would only flatter or punish layout choices.
const PROPS = /(?:^|[;{\s])(color|background(?:-color)?|border(?:-[a-z]+)?-color|fill|stroke|border-radius|gap|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|font-size|font-family|box-shadow|transition-duration)\s*:\s*([^;}]+)/g;
let total = 0, tokened = 0, hardcoded = 0;
for (const m of src.matchAll(PROPS)) {
  const v = m[2].trim();
  // A declaration followed by /* raw: reason */ is a stated, deliberate literal (a colour
  // picker's hue rainbow cannot be themed). It is counted as tokened-by-intent, not drift.
  if (/__RAW__/.test(v)) { total++; tokened++; continue; }
  if (/^(0|auto|none|inherit|initial|currentColor|transparent|100%|50%|1|-?\d+%|min-content|max-content|fit-content|0 auto|0 0 [^;]*)$/.test(v)) continue;
  if (/^(0|-?\d+(?:\.\d+)?(?:px|em|rem)?)(\s+(0|-?\d+(?:\.\d+)?(?:px|em|rem)?))*$/.test(v) && !/[1-9]/.test(v)) continue;   // all-zero shorthands
  total++;
  if (/var\(--/.test(v)) tokened++;
  else if (/#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|\d+px/i.test(v)) hardcoded++;
}
const tokenCoverage = total ? Math.round((tokened / total) * 1000) / 10 : 100;

// --- component usage: interactive elements that are system components
const interactive = [...usageSrc.matchAll(/<(button|input|select|textarea|a)\b([^>]*)>/g)];
// class="…" (Astro/HTML), className="…" and className={`…`} / className={cond ? '…' : '…'} (JSX)
const styled = interactive.filter(([, , attrs]) => /class(?:Name)?=(?:"[^"]*\bfds-|\{`[^`]*\bfds-|\{[^}]*['"][^'"]*\bfds-)/.test(attrs));
const componentUsage = interactive.length ? Math.round((styled.length / interactive.length) * 1000) / 10 : 100;

// --- icon coverage
const svgs = [...src.matchAll(/<svg\b([^>]*)>/g)];
const goodSvg = svgs.filter(([, a]) => /fds-icon|data-icon|data-drawing|viewBox="0 0 (?!24 24)/.test(a) || /class="(?:mp-svg|db-chart|cv-edges|il-)/.test(a));
const iconCoverage = svgs.length ? Math.round((goodSvg.length / svgs.length) * 1000) / 10 : 100;

// --- behaviour coverage: widget markup that is actually wired
const widgets = { menu: /class="[^"]*fds-menu\b/g, tabs: /role="tablist"/g, dialog: /<dialog\b/g, listbox: /role="listbox"/g, tooltip: /class="[^"]*fds-tooltip\b|data-fds-tooltip/g };
let wTotal = 0, wWired = 0;
for (const [k, re] of Object.entries(widgets)) {
  const n = (usageSrc.match(re) || []).length; wTotal += n;
  const wired = (usageSrc.match(new RegExp(k === 'tabs' ? 'data-fds-tabs|data-cdoc-tabs' : k === 'tooltip' ? 'data-fds-tooltip' : `data-fds-${k}`, 'g')) || []).length;
  wWired += Math.min(n, wired);
}
const behaviorCoverage = wTotal ? Math.round((wWired / wTotal) * 1000) / 10 : 100;

const row = { date: new Date().toISOString().slice(0, 10), files: files.length, tokenCoverage, hardcodedValues: hardcoded, componentUsage, iconCoverage, behaviorCoverage };
console.log(`adoption (${SCAN.join(', ')} · ${files.length} files)`);
console.log(`  token coverage     ${tokenCoverage}%   (${tokened}/${total} themable declarations resolve to a token)`);
console.log(`  hardcoded values   ${hardcoded}      (literal colours / px in consumer CSS — target 0)`);
console.log(`  component usage    ${componentUsage}%   (${styled.length}/${interactive.length} interactive elements are fds-*)`);
console.log(`  icon coverage      ${iconCoverage}%   (${goodSvg.length}/${svgs.length} svg are sprite icons or marked drawings)`);
console.log(`  behaviour coverage ${behaviorCoverage}%   (${wWired}/${wTotal} widgets wired to behaviors.js)`);

if (check) {
  if (!existsSync(LOG)) { console.error('no baseline yet — run without --check first'); process.exit(1); }
  const last = JSON.parse(readFileSync(LOG, 'utf8').trim().split('\n').pop());
  const worse = [];
  for (const k of ['tokenCoverage', 'componentUsage', 'iconCoverage', 'behaviorCoverage']) if (row[k] < last[k] - 0.05) worse.push(`${k} ${last[k]} → ${row[k]}`);
  if (row.hardcodedValues > last.hardcodedValues) worse.push(`hardcodedValues ${last.hardcodedValues} → ${row.hardcodedValues}`);
  if (worse.length) { console.error('✗ adoption regressed:\n  ' + worse.join('\n  ')); process.exit(1); }
  console.log('✓ adoption held vs ' + last.date);
} else {
  appendFileSync(LOG, JSON.stringify(row) + '\n');
  console.log(`  → appended to ${relative(ROOT, LOG)}`);
}
